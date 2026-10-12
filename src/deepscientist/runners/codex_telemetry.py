from __future__ import annotations

import json
from typing import Any

DEFAULT_TURN_TOOL_CALL_BUDGET = 24


def _parse_tool_args(raw_args: object) -> dict[str, Any]:
    if isinstance(raw_args, dict):
        return dict(raw_args)
    if not isinstance(raw_args, str) or not raw_args.strip():
        return {}
    try:
        parsed = json.loads(raw_args)
    except json.JSONDecodeError:
        return {}
    return dict(parsed) if isinstance(parsed, dict) else {}


def _tool_result_structured_payload(event: dict[str, Any]) -> dict[str, Any]:
    output = event.get("output")
    if not isinstance(output, str) or not output.strip():
        return {}
    try:
        parsed = json.loads(output)
    except json.JSONDecodeError:
        return {}
    if not isinstance(parsed, dict):
        return {}
    structured = parsed.get("structured_content") or parsed.get("structuredContent")
    return dict(structured) if isinstance(structured, dict) else parsed


def _is_read_tool_event(event: dict[str, Any]) -> bool:
    tool_name = str(event.get("tool_name") or "").strip()
    mcp_server = str(event.get("mcp_server") or "").strip()
    mcp_tool = str(event.get("mcp_tool") or "").strip()
    if tool_name.startswith("mcp__"):
        parts = tool_name.split("__", 2)
        if len(parts) == 3:
            mcp_server = mcp_server or parts[1]
            mcp_tool = mcp_tool or parts[2]
            tool_name = f"{parts[1]}.{parts[2]}"
    if mcp_server and mcp_tool and "." not in tool_name:
        tool_name = f"{mcp_server}.{mcp_tool}"
    args = _parse_tool_args(event.get("args"))
    mode = str(args.get("mode") or "").strip().lower()
    return tool_name in {
        "artifact.get_quest_state",
        "artifact.list_paper_outlines",
        "artifact.get_global_status",
        "artifact.get_paper_contract_health",
        "artifact.validate_manuscript_coverage",
        "artifact.read_quest_documents",
    } or (tool_name == "bash_exec.bash_exec" and mode == "read")


def _new_tool_budget_telemetry(*, tool_call_budget: int = DEFAULT_TURN_TOOL_CALL_BUDGET) -> dict[str, Any]:
    return {
        "tool_call_budget": max(1, int(tool_call_budget)),
        "tool_call_count": 0,
        "tool_count": 0,
        "tool_call_budget_remaining": max(1, int(tool_call_budget)),
        "tool_call_budget_exceeded": False,
        "unique_command_count": 0,
        "read_tool_call_count": 0,
        "repeated_read_result_count": 0,
        "repeated_read_ratio": 0.0,
        "full_detail_count": 0,
        "saved_bytes": 0,
        "_unique_command_fingerprints": set(),
    }


def _record_tool_budget_event(telemetry: dict[str, Any], event: dict[str, Any]) -> None:
    event_type = str(event.get("type") or "")
    metadata = event.get("metadata") if isinstance(event.get("metadata"), dict) else {}
    result_payload = _tool_result_structured_payload(event) if event_type == "runner.tool_result" else {}
    command_fingerprint = str(
        event.get("command_fingerprint")
        or metadata.get("command_fingerprint")
        or result_payload.get("command_fingerprint")
        or ""
    ).strip()
    fingerprints = telemetry.setdefault("_unique_command_fingerprints", set())
    if command_fingerprint:
        fingerprints.add(command_fingerprint)
        telemetry["unique_command_count"] = len(fingerprints)
    if event_type == "runner.tool_call":
        telemetry["tool_call_count"] = int(telemetry.get("tool_call_count") or 0) + 1
        telemetry["tool_count"] = telemetry["tool_call_count"]
        budget = max(1, int(telemetry.get("tool_call_budget") or DEFAULT_TURN_TOOL_CALL_BUDGET))
        remaining = max(0, budget - int(telemetry["tool_call_count"]))
        telemetry["tool_call_budget_remaining"] = remaining
        telemetry["tool_call_budget_exceeded"] = int(telemetry["tool_call_count"]) > budget
        if _is_read_tool_event(event):
            telemetry["read_tool_call_count"] = int(telemetry.get("read_tool_call_count") or 0) + 1
        args_text = str(event.get("args") or "")
        if "detail" in args_text and "full" in args_text.lower():
            telemetry["full_detail_count"] = int(telemetry.get("full_detail_count") or 0) + 1
        _refresh_repeated_read_ratio(telemetry)
        return
    if event_type == "runner.tool_result":
        delta_marker = bool(event.get("delta_marker") or result_payload.get("delta_marker"))
        delta_kind = str(event.get("delta_kind") or result_payload.get("delta_kind") or "")
        if delta_marker and (
            delta_kind == "unchanged_read_cache"
            or (delta_kind == "unchanged_tool_result" and _is_read_tool_event(event))
        ):
            telemetry["repeated_read_result_count"] = int(telemetry.get("repeated_read_result_count") or 0) + 1
        read_cache = result_payload.get("read_cache") if isinstance(result_payload.get("read_cache"), dict) else {}
        telemetry["saved_bytes"] = int(telemetry.get("saved_bytes") or 0) + int(read_cache.get("saved_bytes") or 0)
    _refresh_repeated_read_ratio(telemetry)


def _refresh_repeated_read_ratio(telemetry: dict[str, Any]) -> None:
    read_count = int(telemetry.get("read_tool_call_count") or 0)
    repeated_count = int(telemetry.get("repeated_read_result_count") or 0)
    telemetry["repeated_read_ratio"] = (repeated_count / read_count) if read_count else 0.0


def _finalize_tool_budget_telemetry(telemetry: dict[str, Any]) -> None:
    telemetry.pop("_unique_command_fingerprints", None)
    telemetry["tool_count"] = int(telemetry.get("tool_call_count") or telemetry.get("tool_count") or 0)
    telemetry["saved_bytes"] = int(telemetry.get("saved_bytes") or telemetry.get("tool_result_bytes_saved_total") or 0)
    _refresh_repeated_read_ratio(telemetry)
