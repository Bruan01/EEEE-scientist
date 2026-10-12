from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
from typing import Any

from .shared import ensure_dir, read_json, utc_now, write_json

DEFAULT_EVIDENCE_PACKET_THRESHOLD_BYTES = 48_000
DEFAULT_RUNNER_TOOL_RESULT_THRESHOLD_BYTES = 8_000
_MAX_SUMMARY_CHARS = 900
_MAX_BLOCKERS = 12
_RAW_PAYLOAD_UNSET = object()
_READ_CACHE_SCHEMA_VERSION = 1
_HOT_TOOL_RESULT_THRESHOLDS_BYTES = {
    "artifact.get_quest_state": 4_000,
    "artifact.get_global_status": 4_000,
    "artifact.get_paper_contract_health": 4_000,
    "artifact.validate_manuscript_coverage": 4_000,
    "artifact.list_paper_outlines": 2_000,
    "bash_exec.bash_exec": 2_000,
}
_FULL_DETAIL_FORCE_COMPACT_TOOLS = {
    "artifact.get_quest_state",
    "artifact.get_global_status",
    "artifact.get_paper_contract_health",
    "artifact.validate_manuscript_coverage",
    "artifact.list_paper_outlines",
}


def payload_json_bytes(payload: Any) -> bytes:
    try:
        return json.dumps(payload, ensure_ascii=False, sort_keys=True, default=str).encode("utf-8")
    except Exception:
        return str(payload).encode("utf-8", errors="replace")


def payload_sha256(payload: Any) -> str:
    return hashlib.sha256(payload_json_bytes(payload)).hexdigest()


def _normalized_tool_name(tool_name: str | None) -> str:
    return str(tool_name or "").strip()


def _compact_threshold_for_tool(tool_name: str, *, default_threshold: int) -> int:
    hot_threshold = _HOT_TOOL_RESULT_THRESHOLDS_BYTES.get(_normalized_tool_name(tool_name))
    if hot_threshold is None:
        return int(default_threshold)
    return min(int(default_threshold), hot_threshold)


def _tool_force_compaction(*, tool_name: str, full_detail_requested: bool | None, force: bool) -> bool:
    if force:
        return True
    return bool(full_detail_requested) and _normalized_tool_name(tool_name) in _FULL_DETAIL_FORCE_COMPACT_TOOLS


def _slug(value: str) -> str:
    normalized = re.sub(r"[^A-Za-z0-9_.-]+", "-", str(value or "").strip())
    return normalized.strip("-")[:80] or "payload"


def _strip_read_cache_volatile(value: Any) -> Any:
    volatile_keys = {
        "created_at",
        "updated_at",
        "generated_at",
        "completed_at",
        "read_cache",
        "run_age_seconds",
        "status_age_seconds",
        "silent_seconds",
        "progress_age_seconds",
        "signal_age_seconds",
    }
    if isinstance(value, dict):
        return {
            key: _strip_read_cache_volatile(item)
            for key, item in value.items()
            if str(key) not in volatile_keys and not str(key).endswith("_age_seconds")
        }
    if isinstance(value, list):
        return [_strip_read_cache_volatile(item) for item in value]
    return value


def _read_cache_path(*, quest_root: Path, tool_name: str, detail: str | None, cache_key: Any) -> Path:
    key_hash = payload_sha256({"tool_name": tool_name, "detail": detail, "cache_key": cache_key})[:20]
    return quest_root / ".ds" / "read_cache" / f"{_slug(tool_name)}-{key_hash}.json"


def _command_fingerprint(payload: dict[str, Any]) -> str:
    return payload_sha256(
        {
            "command": " ".join(str(payload.get("command") or "").split()),
            "cwd": str(payload.get("cwd") or payload.get("workdir") or "").strip(),
        }
    )


def _sidecar_path(
    *,
    quest_root: Path,
    run_id: str | None,
    tool_name: str,
    payload_hash: str,
    item_id: str | None = None,
) -> Path:
    run_segment = _slug(run_id or "manual")
    item_segment = _slug(item_id or payload_hash[:12])
    tool_segment = _slug(tool_name)
    return quest_root / ".ds" / "evidence_packets" / run_segment / f"{tool_segment}-{item_segment}.json"


def _collect_blockers(value: Any, blockers: list[str]) -> None:
    if len(blockers) >= _MAX_BLOCKERS:
        return
    if isinstance(value, dict):
        for key, item in value.items():
            lowered = str(key or "").lower()
            if any(marker in lowered for marker in ("block", "gap", "missing", "error", "invalid", "unresolved")):
                if isinstance(item, str) and item.strip():
                    blockers.append(item.strip())
                elif isinstance(item, list):
                    for child in item:
                        if len(blockers) >= _MAX_BLOCKERS:
                            break
                        if isinstance(child, str) and child.strip():
                            blockers.append(child.strip())
                        elif isinstance(child, dict):
                            title = str(child.get("title") or child.get("summary") or child.get("reason") or "").strip()
                            status = str(child.get("status") or "").strip()
                            if title:
                                blockers.append(f"{status}: {title}".strip(": "))
                elif isinstance(item, dict):
                    title = str(item.get("title") or item.get("summary") or item.get("reason") or "").strip()
                    if title:
                        blockers.append(title)
            if isinstance(item, (dict, list)):
                _collect_blockers(item, blockers)
            if len(blockers) >= _MAX_BLOCKERS:
                break
    elif isinstance(value, list):
        for item in value:
            _collect_blockers(item, blockers)
            if len(blockers) >= _MAX_BLOCKERS:
                break


def extract_key_blockers(payload: Any) -> list[str]:
    blockers: list[str] = []
    _collect_blockers(payload, blockers)
    seen: set[str] = set()
    ordered: list[str] = []
    for blocker in blockers:
        text = " ".join(str(blocker).split())
        if not text or text in seen:
            continue
        seen.add(text)
        ordered.append(text[:240])
        if len(ordered) >= _MAX_BLOCKERS:
            break
    return ordered


def _first_text(payload: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return " ".join(value.split())
    return None


def summarize_payload(payload: Any, *, tool_name: str) -> str:
    if not isinstance(payload, dict):
        text = str(payload).strip()
        return (text[: _MAX_SUMMARY_CHARS - 1].rstrip() + "...") if len(text) > _MAX_SUMMARY_CHARS else text

    parts: list[str] = []
    ok_value = payload.get("ok")
    if isinstance(ok_value, bool):
        parts.append(f"ok={ok_value}")
    status = _first_text(payload, ("status", "state", "detail", "summary", "message"))
    if status:
        parts.append(f"status={status}")
    for key in ("count", "total", "item_count", "log_line_count"):
        if key in payload and isinstance(payload.get(key), int | float | str):
            parts.append(f"{key}={payload.get(key)}")
    for key in ("items", "results", "entries", "files"):
        value = payload.get(key)
        if isinstance(value, list):
            parts.append(f"{key}={len(value)}")
            break

    blockers = extract_key_blockers(payload)
    if blockers:
        parts.append(f"key_blockers={len(blockers)}")
        parts.append(f"first_blocker={blockers[0]}")

    summary = f"{tool_name}: " + "; ".join(str(part) for part in parts if str(part).strip())
    if summary.strip() == f"{tool_name}:":
        summary = f"{tool_name}: compact evidence packet available in sidecar."
    if len(summary) > _MAX_SUMMARY_CHARS:
        summary = summary[: _MAX_SUMMARY_CHARS - 3].rstrip() + "..."
    return summary


def _ok_from_payload_or_status(payload: Any, *, status: str | None = None) -> bool | None:
    if isinstance(payload, dict):
        ok_value = payload.get("ok")
        if isinstance(ok_value, bool):
            return ok_value
        success_value = payload.get("success")
        if isinstance(success_value, bool):
            return success_value
        for key in ("status", "state"):
            value = payload.get(key)
            if isinstance(value, str):
                normalized = value.strip().lower()
                if normalized in {"failed", "failure", "error", "errored", "cancelled", "canceled", "invalid"}:
                    return False
                if normalized in {"completed", "complete", "success", "succeeded", "ok", "ready"}:
                    return True
    normalized_status = str(status or "").strip().lower()
    if normalized_status in {"failed", "failure", "error", "errored", "cancelled", "canceled", "invalid"}:
        return False
    if normalized_status in {"completed", "complete", "success", "succeeded", "ok", "ready"}:
        return True
    return None


def compact_evidence_payload(
    payload: Any,
    *,
    quest_root: Path,
    run_id: str | None,
    tool_name: str,
    detail: str | None = None,
    item_id: str | None = None,
    force: bool = False,
    threshold_bytes: int = DEFAULT_EVIDENCE_PACKET_THRESHOLD_BYTES,
    reason: str | None = None,
    full_detail_requested: bool | None = None,
    status: str | None = None,
) -> tuple[Any, dict[str, Any]]:
    payload_bytes = len(payload_json_bytes(payload))
    threshold = max(1, int(threshold_bytes))
    if not force and payload_bytes <= threshold:
        return payload, {
            "compacted": False,
            "payload_bytes": payload_bytes,
            "threshold_bytes": threshold,
        }

    digest = payload_sha256(payload)
    sidecar_path = _sidecar_path(
        quest_root=quest_root,
        run_id=run_id,
        tool_name=tool_name,
        payload_hash=digest,
        item_id=item_id,
    )
    ensure_dir(sidecar_path.parent)
    key_blockers = extract_key_blockers(payload)
    summary = summarize_payload(payload, tool_name=tool_name)
    write_json(
        sidecar_path,
        {
            "version": 1,
            "created_at": utc_now(),
            "tool_name": tool_name,
            "detail": detail,
            "summary": summary,
            "key_blockers": key_blockers,
            "payload_sha256": digest,
            "payload_bytes": payload_bytes,
            "payload": payload,
        },
    )
    index_path = sidecar_path.parent / "index.json"
    existing_index = read_json(index_path, {})
    existing_items = (
        [dict(item) for item in (existing_index.get("items") or []) if isinstance(item, dict)]
        if isinstance(existing_index, dict)
        else []
    )
    entry = {
        "tool_name": tool_name,
        "detail": detail,
        "summary": summary,
        "sidecar_path": str(sidecar_path),
        "payload_sha256": digest,
        "payload_bytes": payload_bytes,
        "key_blockers": key_blockers,
        "created_at": utc_now(),
    }
    write_json(
        index_path,
        {
            "version": 1,
            "updated_at": utc_now(),
            "run_id": run_id,
            "items": [*existing_items, entry][-200:],
        },
    )
    evidence_packet = {
        "version": 1,
        "tool_name": tool_name,
        "detail": detail,
        "summary": summary,
        "sidecar_path": str(sidecar_path),
        "index_path": str(index_path),
        "payload_sha256": digest,
        "payload_bytes": payload_bytes,
        "key_blockers": key_blockers,
        "full_detail_requested": bool(full_detail_requested),
        "compaction_reason": reason or "context_budget",
        "drill_down_rule": "Read sidecar_path only when the compact facts are insufficient for the next decision.",
    }
    compacted = {
        "compacted": True,
        "evidence_packet": evidence_packet,
    }
    ok_value = _ok_from_payload_or_status(payload, status=status)
    if ok_value is not None:
        compacted["ok"] = ok_value
    return compacted, {
        "compacted": True,
        "sidecar_path": str(sidecar_path),
        "payload_sha256": digest,
        "payload_bytes": payload_bytes,
        "summary": summary,
        "key_blocker_count": len(key_blockers),
    }


def compact_runner_tool_event(
    event: dict[str, Any],
    *,
    quest_root: Path,
    run_id: str,
    threshold_bytes: int = DEFAULT_RUNNER_TOOL_RESULT_THRESHOLD_BYTES,
    raw_payload: Any = _RAW_PAYLOAD_UNSET,
) -> tuple[dict[str, Any], dict[str, Any]]:
    if str(event.get("type") or "") != "runner.tool_result":
        return event, {"compacted": False}
    output = str(event.get("output") or "")
    tool_name = str(event.get("tool_name") or event.get("mcp_tool") or "tool").strip() or "tool"
    args = str(event.get("args") or "")
    full_detail_requested = "detail" in args and "full" in args.lower()
    output_bytes = len(output.encode("utf-8", errors="replace"))
    has_raw_payload = raw_payload is not _RAW_PAYLOAD_UNSET
    source_payload = raw_payload if has_raw_payload else _RAW_PAYLOAD_UNSET
    source_payload_bytes = len(payload_json_bytes(source_payload)) if has_raw_payload else 0
    threshold = max(1, int(threshold_bytes))
    if output_bytes <= threshold and source_payload_bytes <= threshold:
        return event, {
            "compacted": False,
            "output_bytes": output_bytes,
            "source_payload_bytes": source_payload_bytes,
            "threshold_bytes": threshold,
        }

    if not has_raw_payload:
        try:
            source_payload = json.loads(output)
        except json.JSONDecodeError:
            source_payload = {"text": output}
    compacted_payload, meta = compact_evidence_payload(
        source_payload,
        quest_root=quest_root,
        run_id=run_id,
        tool_name=tool_name,
        item_id=str(event.get("event_id") or event.get("tool_call_id") or ""),
        force=True,
        threshold_bytes=threshold_bytes,
        reason="runner_tool_result_context_budget",
        full_detail_requested=full_detail_requested,
        status=str(event.get("status") or ""),
    )
    compacted_event = dict(event)
    compacted_event["output"] = json.dumps(compacted_payload, ensure_ascii=False, indent=2)
    compacted_event["output_bytes"] = output_bytes
    compacted_event["output_sha256"] = hashlib.sha256(output.encode("utf-8", errors="replace")).hexdigest()
    if has_raw_payload:
        compacted_event["source_payload_bytes"] = source_payload_bytes
        compacted_event["source_payload_sha256"] = payload_sha256(source_payload)
    compacted_event["output_compacted"] = True
    compacted_event["evidence_packet"] = (
        compacted_payload.get("evidence_packet") if isinstance(compacted_payload, dict) else None
    )
    return compacted_event, {
        **meta,
        "output_bytes": output_bytes,
        "source_payload_bytes": source_payload_bytes,
    }


def compact_mcp_tool_result(
    payload: dict[str, Any],
    *,
    quest_root: Path,
    run_id: str | None,
    tool_name: str,
    detail: str | None = None,
    force: bool = False,
    threshold_bytes: int | None = None,
    reason: str | None = None,
    full_detail_requested: bool | None = None,
) -> dict[str, Any]:
    normalized_detail = str(detail or "").strip().lower() or None
    requested_full_detail = bool(full_detail_requested) or normalized_detail == "full"
    default_threshold = DEFAULT_EVIDENCE_PACKET_THRESHOLD_BYTES if threshold_bytes is None else int(threshold_bytes)
    effective_threshold = (
        _compact_threshold_for_tool(tool_name, default_threshold=default_threshold)
        if requested_full_detail
        else default_threshold
    )
    compacted, _meta = compact_evidence_payload(
        payload,
        quest_root=quest_root,
        run_id=run_id,
        tool_name=tool_name,
        detail=normalized_detail,
        force=_tool_force_compaction(
            tool_name=tool_name,
            full_detail_requested=requested_full_detail,
            force=force,
        ),
        threshold_bytes=effective_threshold,
        reason=reason,
        full_detail_requested=requested_full_detail,
    )
    return compacted if isinstance(compacted, dict) else payload


def cached_compact_mcp_tool_result(
    payload: dict[str, Any],
    *,
    quest_root: Path,
    run_id: str | None,
    tool_name: str,
    detail: str | None = None,
    cache_key: Any = None,
    source_path: Path | None = None,
    force: bool = False,
    threshold_bytes: int | None = None,
    reason: str | None = None,
    full_detail_requested: bool | None = None,
) -> dict[str, Any]:
    normalized_detail = str(detail or "").strip().lower() or None
    if _normalized_tool_name(tool_name) == "bash_exec.bash_exec":
        payload = dict(payload)
        if not payload.get("cwd"):
            payload["cwd"] = str(quest_root)
        if not payload.get("command_fingerprint"):
            payload["command_fingerprint"] = _command_fingerprint(payload)
    resolved_source = source_path.expanduser().resolve() if source_path is not None else None
    source_stat = resolved_source.stat() if resolved_source is not None and resolved_source.exists() else None
    stable_payload = _strip_read_cache_volatile(payload)
    payload_fingerprint = payload_sha256(stable_payload)
    original_bytes = len(payload_json_bytes(payload))
    resolved_cache_key = cache_key if cache_key is not None else {"detail": normalized_detail}
    cache_path = _read_cache_path(
        quest_root=quest_root,
        tool_name=tool_name,
        detail=normalized_detail,
        cache_key=resolved_cache_key,
    )
    cached = read_json(cache_path, {})
    cache_hit = (
        isinstance(cached, dict)
        and int(cached.get("schema_version") or 0) == _READ_CACHE_SCHEMA_VERSION
        and cached.get("payload_fingerprint") == payload_fingerprint
    )
    read_cache = {
        "schema_version": _READ_CACHE_SCHEMA_VERSION,
        "cache_hit": cache_hit,
        "cache_path": str(cache_path),
        "payload_fingerprint": payload_fingerprint,
        "payload_bytes": original_bytes,
        "source_path": str(resolved_source) if resolved_source is not None else None,
        "source_mtime_ns": getattr(source_stat, "st_mtime_ns", None) if source_stat is not None else None,
        "source_size": getattr(source_stat, "st_size", None) if source_stat is not None else None,
    }
    if cache_hit:
        cached_evidence_packet = (
            dict(cached.get("evidence_packet") or {})
            if isinstance(cached.get("evidence_packet"), dict)
            else None
        )
        if cached_evidence_packet is None:
            sidecar_payload, _sidecar_meta = compact_evidence_payload(
                payload,
                quest_root=quest_root,
                run_id=run_id,
                tool_name=tool_name,
                detail=normalized_detail,
                force=True,
                threshold_bytes=1,
                reason="read_cache_sidecar_ref",
                full_detail_requested=full_detail_requested,
            )
            if isinstance(sidecar_payload, dict) and isinstance(sidecar_payload.get("evidence_packet"), dict):
                cached_evidence_packet = dict(sidecar_payload["evidence_packet"])
                cached["evidence_packet"] = cached_evidence_packet
                write_json(cache_path, cached)
        read_cache["saved_bytes"] = max(0, original_bytes)
        if cached_evidence_packet:
            read_cache["sidecar_path"] = cached_evidence_packet.get("sidecar_path")
            read_cache["payload_sha256"] = cached_evidence_packet.get("payload_sha256")
        ok_value = _ok_from_payload_or_status(payload)
        result = {
            "ok": ok_value if ok_value is not None else True,
            "compacted": True,
            "delta_marker": True,
            "delta_kind": "unchanged_read_cache",
            "tool_name": tool_name,
            "detail": normalized_detail,
            "fingerprint": payload_fingerprint,
            "summary": cached.get("summary") or summarize_payload(payload, tool_name=tool_name),
            "read_cache": read_cache,
            "command_fingerprint": payload.get("command_fingerprint"),
            "cwd": payload.get("cwd"),
        }
        if cached_evidence_packet:
            result["evidence_packet"] = cached_evidence_packet
        return result

    compacted = compact_mcp_tool_result(
        payload,
        quest_root=quest_root,
        run_id=run_id,
        tool_name=tool_name,
        detail=normalized_detail,
        force=force,
        threshold_bytes=threshold_bytes,
        reason=reason,
        full_detail_requested=full_detail_requested,
    )
    evidence_packet = (
        dict(compacted.get("evidence_packet") or {})
        if isinstance(compacted, dict) and isinstance(compacted.get("evidence_packet"), dict)
        else None
    )
    if evidence_packet is None:
        sidecar_payload, _sidecar_meta = compact_evidence_payload(
            payload,
            quest_root=quest_root,
            run_id=run_id,
            tool_name=tool_name,
            detail=normalized_detail,
            force=True,
            threshold_bytes=1,
            reason="read_cache_sidecar_ref",
            full_detail_requested=full_detail_requested,
        )
        if isinstance(sidecar_payload, dict) and isinstance(sidecar_payload.get("evidence_packet"), dict):
            evidence_packet = dict(sidecar_payload["evidence_packet"])
    read_cache["saved_bytes"] = 0
    if evidence_packet:
        read_cache["sidecar_path"] = evidence_packet.get("sidecar_path")
        read_cache["payload_sha256"] = evidence_packet.get("payload_sha256")
    compacted["read_cache"] = read_cache
    if evidence_packet and compacted.get("compacted") is True and "evidence_packet" not in compacted:
        compacted["evidence_packet"] = evidence_packet
    ensure_dir(cache_path.parent)
    write_json(
        cache_path,
        {
            "schema_version": _READ_CACHE_SCHEMA_VERSION,
            "created_at": utc_now(),
            "updated_at": utc_now(),
            "tool_name": tool_name,
            "detail": normalized_detail,
            "cache_key": resolved_cache_key,
            "payload_fingerprint": payload_fingerprint,
            "payload_bytes": original_bytes,
            "summary": summarize_payload(payload, tool_name=tool_name),
            "source_path": str(resolved_source) if resolved_source is not None else None,
            "source_mtime_ns": getattr(source_stat, "st_mtime_ns", None) if source_stat is not None else None,
            "source_size": getattr(source_stat, "st_size", None) if source_stat is not None else None,
            "evidence_packet": evidence_packet,
        },
    )
    return compacted
