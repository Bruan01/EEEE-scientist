from __future__ import annotations

import json
import time
from urllib.request import urlopen

_RECENT_EVENT_LIMIT = 12


def _get_json(url: str):
    with urlopen(url) as response:  # noqa: S310
        return json.loads(response.read().decode("utf-8"))


def _stringify_update_value(value) -> str:
    if isinstance(value, str):
        return value
    if value is None:
        return ""
    try:
        return json.dumps(value, ensure_ascii=False, indent=2)
    except TypeError:
        return str(value)


def _parse_bash_payload(value) -> dict:
    text = _stringify_update_value(value).strip()
    if not text.startswith("{") or not text.endswith("}"):
        return {}
    try:
        payload = json.loads(text)
    except json.JSONDecodeError:
        return {}
    return payload if isinstance(payload, dict) else {}


def _latest_bash_id(feed: dict) -> str | None:
    for item in reversed(feed.get("acp_updates") or []):
        update = (item.get("params") or {}).get("update") or {}
        data = update.get("data") or {}
        if (data.get("mcp_server") or "") != "bash_exec":
            continue
        payload = _parse_bash_payload(data.get("output"))
        bash_id = payload.get("bash_id")
        if isinstance(bash_id, str) and bash_id.strip():
            return bash_id.strip()
    return None


def _format_bash_tail(base_url: str, quest_id: str, bash_id: str) -> list[str]:
    payload = _get_json(f"{base_url}/api/quests/{quest_id}/bash/sessions/{bash_id}/logs?limit=6")
    lines: list[str] = []
    for entry in payload or []:
        line = str((entry or {}).get("line") or "")
        if not line or line.startswith("__DS_PROGRESS__") or line.startswith("__DS_BASH_STATUS__"):
            continue
        if line.startswith("__DS_BASH_CR__"):
            line = line[len("__DS_BASH_CR__") :]
        lines.append(f"  | {line}")
    return lines[-6:]


def _format_updates(feed: dict, *, base_url: str | None = None, quest_id: str | None = None) -> list[str]:
    lines: list[str] = []
    for item in feed.get("acp_updates") or []:
        update = (item.get("params") or {}).get("update") or {}
        kind = update.get("kind")
        if kind == "message":
            message = update.get("message") or {}
            prefix = "assistant" if message.get("role") == "assistant" else "user"
            suffix = " [stream]" if message.get("stream") else ""
            lines.append(f"- {prefix}{suffix}: {message.get('content') or ''}")
        elif kind == "artifact":
            artifact = update.get("artifact") or {}
            rendered = artifact.get("summary") or artifact.get("reason") or artifact.get("guidance") or artifact.get("kind")
            lines.append(f"- artifact[{artifact.get('kind')}]: {rendered}")
        else:
            data = update.get("data") or {}
            label = data.get("label") or update.get("event_type") or "event"
            summary = data.get("summary") or data.get("run_id") or ""
            lines.append(f"- {label}: {summary}".rstrip(": "))
    if base_url and quest_id:
        bash_id = _latest_bash_id(feed)
        if bash_id:
            lines.append(f"- bash_exec[{bash_id}] latest output:")
            lines.extend(_format_bash_tail(base_url, quest_id, bash_id) or ["  | waiting for output..."])
    return lines[-12:]


def render_tui(base_url: str, *, quest_id: str | None = None, cursor: int = 0) -> tuple[str, int]:
    quests = _get_json(f"{base_url}/api/quests")
    connectors = _get_json(f"{base_url}/api/connectors")
    active_quest_id = quest_id or (quests[0]["quest_id"] if quests else None)
    session_payload = None
    feed_payload = {"cursor": cursor, "acp_updates": []}
    if active_quest_id:
        session_payload = _get_json(f"{base_url}/api/quests/{active_quest_id}/session")
        if cursor > 0:
            feed_payload = _get_json(
                f"{base_url}/api/quests/{active_quest_id}/events?after={cursor}&format=acp&session_id=quest:{active_quest_id}"
            )
        else:
            feed_payload = _get_json(
                f"{base_url}/api/quests/{active_quest_id}/events?format=acp&session_id=quest:{active_quest_id}&tail=1&limit={_RECENT_EVENT_LIMIT}"
            )

    lines = [
        "DeepScientist TUI",
        "=" * 24,
        "",
        "Quests:",
    ]
    for quest in quests:
        marker = "*" if quest["quest_id"] == active_quest_id else "-"
        lines.extend(
            [
                f"{marker} {quest['quest_id']} :: {quest['title']}",
                f"  status={quest['status']} anchor={quest['active_anchor']} branch={quest['branch']}",
                f"  artifacts={quest['artifact_count']} history={quest['history_count']}",
            ]
        )

    if session_payload:
        snapshot = session_payload["snapshot"]
        lines.extend(
            [
                "",
                f"Active quest: {snapshot['quest_id']}",
                f"Quest root: {snapshot['quest_root']}",
                f"Runner: {snapshot.get('runner')} · Anchor: {snapshot.get('active_anchor')}",
                f"Branch: {snapshot.get('branch')} · Head: {snapshot.get('head')}",
                "",
                "Live updates:",
            ]
        )
        update_lines = _format_updates(feed_payload, base_url=base_url, quest_id=active_quest_id)
        lines.extend(update_lines or ["- no new updates"])

    lines.extend(["", "Connectors:"])
    for connector in connectors:
        lines.append(
            f"- {connector['name']} ({connector['display_mode']}) inbox={connector['inbox_count']} outbox={connector['outbox_count']}"
        )
    return "\n".join(lines) + "\n", int(feed_payload.get("cursor") or cursor)


def watch_tui(base_url: str, *, quest_id: str | None = None, interval_s: float = 1.5) -> None:
    try:
        while True:
            screen, _ = render_tui(base_url, quest_id=quest_id, cursor=0)
            print("\033[2J\033[H", end="")
            print(screen, end="")
            time.sleep(interval_s)
    except KeyboardInterrupt:
        return
