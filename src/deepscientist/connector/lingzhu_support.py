from __future__ import annotations

import base64
import ipaddress
import json
import re
import secrets
from typing import Any
from urllib.parse import urlparse


DEFAULT_LINGZHU_GATEWAY_PORT = 18789
DEFAULT_LINGZHU_LOCAL_HOST = "127.0.0.1"
DEFAULT_LINGZHU_AGENT_ID = "main"
DEFAULT_LINGZHU_SESSION_NAMESPACE = "lingzhu"
DEFAULT_LINGZHU_TASK_PREFIX = "我现在的任务是"
DEFAULT_LINGZHU_PASSIVE_CHAT_TYPE = "passive"
_LINGZHU_COMMAND_PUNCTUATION = "：:，,。.;；!！?？、~～`'\"“”‘’（）()【】[]《》<>"
_LINGZHU_COMMAND_PUNCT_TRANSLATION = str.maketrans({char: " " for char in _LINGZHU_COMMAND_PUNCTUATION})
_LINGZHU_PREFIX_SEPARATORS_CLASS = re.escape(_LINGZHU_COMMAND_PUNCTUATION) + r"\s"

_AUTH_AK_SEGMENTS = (8, 4, 4, 4, 12)
_AUTH_AK_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"
_EXAMPLE_AUTH_AKS = frozenset(
    {
        "abcd1234-abcd-abcd-abcd-abcdefghijkl",
    }
)
_PRIVATE_IPV4_NETWORKS = tuple(
    ipaddress.ip_network(item)
    for item in (
        "0.0.0.0/8",
        "10.0.0.0/8",
        "100.64.0.0/10",
        "127.0.0.0/8",
        "169.254.0.0/16",
        "172.16.0.0/12",
        "192.168.0.0/16",
        "198.18.0.0/15",
    )
)
_PRIVATE_IPV6_NETWORKS = tuple(
    ipaddress.ip_network(item)
    for item in (
        "::/128",
        "::1/128",
        "fc00::/7",
        "fe80::/10",
    )
)
_LINGZHU_EXPERIMENTAL_COMMANDS = {
    "send_notification",
    "send_toast",
    "speak_tts",
    "start_video_record",
    "stop_video_record",
    "open_custom_view",
}
_LINGZHU_TOOL_COMMAND_ALIASES = {
    "take_photo": "take_photo",
    "camera": "take_photo",
    "photo": "take_photo",
    "takepicture": "take_photo",
    "take_picture": "take_photo",
    "snapshot": "take_photo",
    "take_navigation": "take_navigation",
    "navigate": "take_navigation",
    "navigation": "take_navigation",
    "maps": "take_navigation",
    "route": "take_navigation",
    "directions": "take_navigation",
    "control_calendar": "control_calendar",
    "calendar": "control_calendar",
    "add_calendar": "control_calendar",
    "schedule": "control_calendar",
    "reminder": "control_calendar",
    "add_reminder": "control_calendar",
    "create_event": "control_calendar",
    "set_schedule": "control_calendar",
    "notify_agent_off": "notify_agent_off",
    "exit_agent": "notify_agent_off",
    "exit": "notify_agent_off",
    "quit": "notify_agent_off",
    "close_agent": "notify_agent_off",
    "leave_agent": "notify_agent_off",
    "send_notification": "send_notification",
    "notification": "send_notification",
    "notify": "send_notification",
    "send_toast": "send_toast",
    "toast": "send_toast",
    "speak_tts": "speak_tts",
    "tts": "speak_tts",
    "speak": "speak_tts",
    "start_video_record": "start_video_record",
    "start_recording": "start_video_record",
    "record_video": "start_video_record",
    "stop_video_record": "stop_video_record",
    "stop_recording": "stop_video_record",
    "open_custom_view": "open_custom_view",
    "custom_view": "open_custom_view",
    "show_view": "open_custom_view",
}
_LINGZHU_TOOL_MARKER_RE = re.compile(r"<LINGZHU_TOOL_CALL:([^:>]+):([^>]*)>")
_LINGZHU_PHOTO_REQUEST_RE = re.compile(r"^(?:请|先|帮我|麻烦|现在|立即)?(?:拍照|拍张照|照相|拍一张|帮我拍)(?:[^\n]*)$", re.IGNORECASE)
_LINGZHU_EXIT_REQUEST_RE = re.compile(r"^(?:请|先|帮我|麻烦|现在|立即)?(?:退出智能体|退出当前会话|结束对话|关闭智能体)(?:[^\n]*)$", re.IGNORECASE)
_LINGZHU_NOTIFICATION_REQUEST_RE = re.compile(r"^(?:请|先|帮我|麻烦|现在|立即)?(?:发(?:一条|个)?通知|发送通知)(?:[^\n]*)$", re.IGNORECASE)
_LINGZHU_TOAST_REQUEST_RE = re.compile(r"^(?:请|先|帮我|麻烦|现在|立即)?(?:toast|轻提示|弹出提示)(?:[^\n]*)$", re.IGNORECASE)
_LINGZHU_TTS_REQUEST_RE = re.compile(r"^(?:请|先|帮我|麻烦|现在|立即)?(?:播报|朗读|语音提示|念一段)(?:[^\n]*)$", re.IGNORECASE)
_LINGZHU_START_RECORD_RE = re.compile(r"^(?:请|先|帮我|麻烦|现在|立即)?(?:开始录像|录一段视频|开始录制)(?:[^\n]*)$", re.IGNORECASE)
_LINGZHU_STOP_RECORD_RE = re.compile(r"^(?:请|先|帮我|麻烦|现在|立即)?(?:停止录像|结束录像|停止录制)(?:[^\n]*)$", re.IGNORECASE)
_LINGZHU_OPEN_VIEW_RE = re.compile(r"^(?:请|先|帮我|麻烦|现在|立即)?(?:打开.*页面|显示.*页面|展示.*页面)(?:[^\n]*)$", re.IGNORECASE)
_LINGZHU_NAVIGATION_REQUEST_RE = re.compile(r"^(?:请|先|帮我|麻烦|现在|立即)?(?:导航(?:到|去)?|前往|带我去|带路去)\s*[:：]?\s*([^\n，。！？]+)", re.IGNORECASE)


def generate_lingzhu_auth_ak() -> str:
    parts: list[str] = []
    for segment_length in _AUTH_AK_SEGMENTS:
        parts.append("".join(secrets.choice(_AUTH_AK_CHARS) for _ in range(segment_length)))
    return "-".join(parts)


def lingzhu_auth_ak_needs_rotation(value: Any) -> bool:
    return str(value or "").strip() in _EXAMPLE_AUTH_AKS


def lingzhu_local_host(config: dict[str, Any] | None) -> str:
    value = str((config or {}).get("local_host") or DEFAULT_LINGZHU_LOCAL_HOST).strip()
    return value or DEFAULT_LINGZHU_LOCAL_HOST


def lingzhu_gateway_port(config: dict[str, Any] | None) -> int:
    raw = (config or {}).get("gateway_port")
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_LINGZHU_GATEWAY_PORT
    if value < 1 or value > 65535:
        return DEFAULT_LINGZHU_GATEWAY_PORT
    return value


def normalize_public_base_url(value: Any) -> str | None:
    text = str(value or "").strip()
    if not text:
        return None
    parsed = urlparse(text)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return text.rstrip("/")


def public_base_url_looks_public(value: Any) -> bool:
    normalized = normalize_public_base_url(value)
    if normalized is None:
        return False
    parsed = urlparse(normalized)
    hostname = str(parsed.hostname or "").strip().lower()
    if not hostname:
        return False
    if hostname in {"localhost", "0.0.0.0", "::", "::1"}:
        return False
    if hostname.endswith(".local"):
        return False
    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        return True
    if ip.is_multicast:
        return False
    networks = _PRIVATE_IPV4_NETWORKS if ip.version == 4 else _PRIVATE_IPV6_NETWORKS
    return not any(ip in network for network in networks)


def lingzhu_local_base_url(config: dict[str, Any] | None) -> str:
    return f"http://{lingzhu_local_host(config)}:{lingzhu_gateway_port(config)}"


def lingzhu_public_base_url(config: dict[str, Any] | None) -> str | None:
    return normalize_public_base_url((config or {}).get("public_base_url"))


def lingzhu_health_url(config: dict[str, Any] | None, *, public: bool = False) -> str | None:
    base = lingzhu_public_base_url(config) if public else lingzhu_local_base_url(config)
    if not base:
        return None
    return f"{base}/metis/agent/api/health"


def lingzhu_sse_url(config: dict[str, Any] | None, *, public: bool = False) -> str | None:
    base = lingzhu_public_base_url(config) if public else lingzhu_local_base_url(config)
    if not base:
        return None
    return f"{base}/metis/agent/api/sse"


def lingzhu_agent_id(config: dict[str, Any] | None) -> str:
    value = str((config or {}).get("agent_id") or DEFAULT_LINGZHU_AGENT_ID).strip()
    return value or DEFAULT_LINGZHU_AGENT_ID


def lingzhu_passive_conversation_id(config: dict[str, Any] | None) -> str:
    return f"lingzhu:{DEFAULT_LINGZHU_PASSIVE_CHAT_TYPE}:{lingzhu_agent_id(config)}"


def lingzhu_is_passive_conversation_id(value: Any, config: dict[str, Any] | None = None) -> bool:
    normalized = str(value or "").strip()
    if not normalized:
        return False
    if config is not None:
        return normalized == lingzhu_passive_conversation_id(config)
    return normalized.startswith(f"lingzhu:{DEFAULT_LINGZHU_PASSIVE_CHAT_TYPE}:")


def lingzhu_request_sender_id(body: dict[str, Any] | None) -> str:
    value = str((body or {}).get("user_id") or (body or {}).get("agent_id") or "anonymous").strip()
    return value or "anonymous"


def lingzhu_request_conversation_id(body: dict[str, Any] | None) -> str:
    return f"lingzhu:direct:{lingzhu_request_sender_id(body)}"


def lingzhu_extract_user_text(messages: Any) -> str:
    if not isinstance(messages, list):
        return ""
    preferred: list[str] = []
    fallback: list[str] = []
    for item in messages:
        if not isinstance(item, dict):
            continue
        text = str(item.get("text") or item.get("content") or "").strip()
        if not text:
            continue
        role = str(item.get("role") or "").strip().lower()
        if role in {"", "user"}:
            preferred.append(text)
        else:
            fallback.append(text)
    parts = preferred or fallback
    return "\n".join(parts).strip()


def lingzhu_normalize_command_text(text: Any) -> str:
    normalized = str(text or "").strip()
    if not normalized:
        return ""
    normalized = normalized.translate(_LINGZHU_COMMAND_PUNCT_TRANSLATION)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def lingzhu_extract_task_text(text: Any) -> str | None:
    raw_text = str(text or "").strip()
    if not raw_text:
        return None
    prefix_pattern = r"^[{separators}]*{prefix}[{separators}]*".format(
        separators=_LINGZHU_PREFIX_SEPARATORS_CLASS,
        prefix="".join(f"{re.escape(char)}[{_LINGZHU_PREFIX_SEPARATORS_CLASS}]*" for char in DEFAULT_LINGZHU_TASK_PREFIX),
    )
    matched = re.match(prefix_pattern, raw_text)
    if matched is None:
        return None
    remainder = raw_text[matched.end() :].strip()
    remainder = remainder.lstrip(_LINGZHU_COMMAND_PUNCTUATION + " \t\r\n")
    return remainder or None


def lingzhu_verify_auth_header(auth_header: Any, expected_ak: str) -> bool:
    if not expected_ak:
        return True
    if isinstance(auth_header, list):
        header = str(auth_header[0] or "").strip()
    else:
        header = str(auth_header or "").strip()
    if not header.lower().startswith("bearer "):
        return False
    return header[7:].strip() == expected_ak


def lingzhu_probe_payload(
    config: dict[str, Any] | None,
    *,
    message_id: str = "ds-lingzhu-probe-001",
    text: str = "你好",
) -> dict[str, Any]:
    return {
        "message_id": message_id,
        "agent_id": lingzhu_agent_id(config),
        "message": [
            {
                "role": "user",
                "type": "text",
                "text": text,
            }
        ],
    }


def lingzhu_generated_openclaw_config(config: dict[str, Any] | None) -> dict[str, Any]:
    resolved = dict(config or {})
    return {
        "gateway": {
            "port": lingzhu_gateway_port(resolved),
            "http": {
                "endpoints": {
                    "chatCompletions": {
                        "enabled": True,
                    }
                }
            },
        },
        "plugins": {
            "entries": {
                "lingzhu": {
                    "enabled": bool(resolved.get("enabled", False)),
                    "config": {
                        "authAk": str(resolved.get("auth_ak") or "").strip(),
                        "agentId": lingzhu_agent_id(resolved),
                        "includeMetadata": bool(resolved.get("include_metadata", True)),
                        "requestTimeoutMs": int(resolved.get("request_timeout_ms") or 60000),
                        "systemPrompt": str(resolved.get("system_prompt") or ""),
                        "defaultNavigationMode": str(resolved.get("default_navigation_mode") or "0"),
                        "enableFollowUp": bool(resolved.get("enable_follow_up", True)),
                        "followUpMaxCount": int(resolved.get("follow_up_max_count") or 3),
                        "maxImageBytes": int(resolved.get("max_image_bytes") or 5 * 1024 * 1024),
                        "sessionMode": str(resolved.get("session_mode") or "per_user"),
                        "sessionNamespace": str(
                            resolved.get("session_namespace") or DEFAULT_LINGZHU_SESSION_NAMESPACE
                        ),
                        "autoReceiptAck": bool(resolved.get("auto_receipt_ack", True)),
                        "visibleProgressHeartbeat": bool(
                            resolved.get("visible_progress_heartbeat", True)
                        ),
                        "visibleProgressHeartbeatSec": int(
                            resolved.get("visible_progress_heartbeat_sec") or 10
                        ),
                        "debugLogging": bool(resolved.get("debug_logging", False)),
                        "debugLogPayloads": bool(resolved.get("debug_log_payloads", False)),
                        "debugLogDir": str(resolved.get("debug_log_dir") or ""),
                        "enableExperimentalNativeActions": bool(
                            resolved.get("enable_experimental_native_actions", False)
                        ),
                    },
                }
            }
        },
    }


def lingzhu_generated_openclaw_config_text(config: dict[str, Any] | None) -> str:
    return json.dumps(lingzhu_generated_openclaw_config(config), indent=2, ensure_ascii=False)


def lingzhu_generated_curl(config: dict[str, Any] | None, *, text: str = "你好") -> str:
    auth_ak = str((config or {}).get("auth_ak") or "").strip()
    payload = lingzhu_probe_payload(config, text=text)
    endpoint_url = lingzhu_sse_url(config) or ""
    return (
        f"curl -X POST '{endpoint_url}' \\\n"
        f"  --header 'Authorization: Bearer {auth_ak}' \\\n"
        "  --header 'Content-Type: application/json' \\\n"
        f"  --data '{json.dumps(payload, ensure_ascii=False)}'"
    )


def lingzhu_health_payload(
    config: dict[str, Any] | None,
    *,
    chat_completions_enabled: bool = True,
) -> dict[str, Any]:
    resolved = dict(config or {})
    experimental_enabled = bool(resolved.get("enable_experimental_native_actions", False))
    return {
        "ok": True,
        "status": "ok",
        "endpoint": "/metis/agent/api/sse",
        "enabled": bool(resolved.get("enabled", False)),
        "agentId": lingzhu_agent_id(resolved),
        "supportedCommands": lingzhu_supported_commands(experimental_enabled=experimental_enabled),
        "followUpEnabled": bool(resolved.get("enable_follow_up", True)),
        "sessionMode": str(resolved.get("session_mode") or "per_user"),
        "debugLogging": bool(resolved.get("debug_logging", False)),
        "experimentalNativeActions": experimental_enabled,
        "chatCompletionsEnabled": bool(chat_completions_enabled),
    }


def lingzhu_sse_answer(
    *,
    message_id: str,
    agent_id: str,
    answer_stream: str,
    is_finish: bool = True,
) -> dict[str, Any]:
    return {
        "role": "agent",
        "type": "answer",
        "answer_stream": answer_stream,
        "message_id": str(message_id or "").strip(),
        "agent_id": str(agent_id or "").strip(),
        "is_finish": bool(is_finish),
    }


def lingzhu_sse_follow_up(
    *,
    message_id: str,
    agent_id: str,
    suggestions: list[str],
) -> dict[str, Any]:
    return {
        "role": "agent",
        "type": "follow_up",
        "message_id": str(message_id or "").strip(),
        "agent_id": str(agent_id or "").strip(),
        "is_finish": True,
        "follow_up": [str(item).strip() for item in suggestions if str(item).strip()],
    }


def lingzhu_sse_tool_call(
    *,
    message_id: str,
    agent_id: str,
    tool_call: dict[str, Any],
    is_finish: bool = True,
) -> dict[str, Any]:
    return {
        "role": "agent",
        "type": "tool_call",
        "message_id": str(message_id or "").strip(),
        "agent_id": str(agent_id or "").strip(),
        "is_finish": bool(is_finish),
        "tool_call": dict(tool_call or {}),
    }


def lingzhu_resolve_command(raw_command: Any, *, experimental_enabled: bool = False) -> str | None:
    normalized = str(raw_command or "").strip().lower()
    if not normalized:
        return None
    resolved = _LINGZHU_TOOL_COMMAND_ALIASES.get(normalized, normalized)
    if resolved in _LINGZHU_EXPERIMENTAL_COMMANDS and not experimental_enabled:
        return None
    if resolved not in lingzhu_supported_commands(experimental_enabled=experimental_enabled):
        return None
    return resolved


def _lingzhu_action_text_value(action: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = str(action.get(key) or "").strip()
        if value:
            return value
    return ""


def _lingzhu_action_bool_value(action: dict[str, Any], key: str) -> bool | None:
    raw = action.get(key)
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        normalized = raw.strip().lower()
        if normalized in {"true", "1", "yes", "on"}:
            return True
        if normalized in {"false", "0", "no", "off"}:
            return False
    return None


def _lingzhu_action_int_value(action: dict[str, Any], key: str) -> int | None:
    raw = action.get(key)
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return None
    return value


def _lingzhu_command_payload_tool_call(
    command: str,
    payload: dict[str, Any],
    *,
    default_navigation_mode: str = "0",
) -> dict[str, Any]:
    resolved_navigation_mode = default_navigation_mode if default_navigation_mode in {"0", "1", "2"} else "0"
    tool_call: dict[str, Any] = {
        "handling_required": True,
        "command": command,
        "is_recall": bool(payload.get("is_recall", True)),
    }

    if command == "take_navigation":
        tool_call["action"] = _lingzhu_action_text_value(payload, "action") or "open"
        destination = _lingzhu_action_text_value(payload, "poi_name", "destination", "address", "name", "query")
        if destination:
            tool_call["poi_name"] = destination
        navigation_mode = _lingzhu_action_text_value(payload, "navi_type", "type")
        tool_call["navi_type"] = navigation_mode if navigation_mode in {"0", "1", "2"} else resolved_navigation_mode
        return tool_call

    if command == "control_calendar":
        tool_call["action"] = _lingzhu_action_text_value(payload, "action") or "create"
        title = _lingzhu_action_text_value(payload, "title", "name")
        if title:
            tool_call["title"] = title
        start_time = _lingzhu_action_text_value(payload, "start_time", "startTime")
        if start_time:
            tool_call["start_time"] = start_time
        end_time = _lingzhu_action_text_value(payload, "end_time", "endTime")
        if end_time:
            tool_call["end_time"] = end_time
        return tool_call

    if command in {"send_notification", "send_toast", "speak_tts"}:
        title = _lingzhu_action_text_value(payload, "title")
        body = _lingzhu_action_text_value(payload, "content", "body", "text", "message")
        if title and body and body != title:
            tool_call["content"] = f"{title}\n{body}"
        else:
            content = body or title
            if content:
                tool_call["content"] = content
        play_tts = _lingzhu_action_bool_value(payload, "play_tts")
        if play_tts is not None:
            tool_call["play_tts"] = play_tts
        icon_type = _lingzhu_action_text_value(payload, "icon_type")
        if icon_type:
            tool_call["icon_type"] = icon_type
        return tool_call

    if command == "start_video_record":
        for key in ("duration_sec", "width", "height", "quality"):
            value = _lingzhu_action_int_value(payload, key)
            if value is not None:
                tool_call[key] = value
        return tool_call

    if command == "open_custom_view":
        view_name = _lingzhu_action_text_value(payload, "view_name", "title", "name")
        if view_name:
            tool_call["view_name"] = view_name
        raw_payload = payload.get("view_payload", payload.get("payload", payload.get("data")))
        if raw_payload is not None and raw_payload != "":
            if isinstance(raw_payload, str):
                rendered_payload = raw_payload.strip()
            else:
                rendered_payload = json.dumps(raw_payload, ensure_ascii=False)
            if rendered_payload:
                tool_call["view_payload"] = rendered_payload
        return tool_call

    return tool_call


def _lingzhu_decode_marker_params(raw_value: str) -> dict[str, Any]:
    value = str(raw_value or "").strip()
    if not value:
        return {}
    try:
        decoded = json.loads(value)
        return decoded if isinstance(decoded, dict) else {}
    except json.JSONDecodeError:
        pass
    try:
        padded = value + ("=" * (-len(value) % 4))
        decoded_text = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
        decoded = json.loads(decoded_text)
        return decoded if isinstance(decoded, dict) else {}
    except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
        return {}


def lingzhu_detect_tool_call_from_text(
    text: Any,
    *,
    default_navigation_mode: str = "0",
    experimental_enabled: bool = False,
) -> tuple[dict[str, Any] | None, str]:
    normalized = str(text or "").strip()
    if not normalized:
        return None, ""

    marker_match = _LINGZHU_TOOL_MARKER_RE.search(normalized)
    if marker_match:
        command = lingzhu_resolve_command(marker_match.group(1), experimental_enabled=experimental_enabled)
        if command:
            params = _lingzhu_decode_marker_params(marker_match.group(2))
            cleaned = f"{normalized[:marker_match.start()]} {normalized[marker_match.end():]}".strip()
            cleaned = re.sub(r"\s+", " ", cleaned)
            return (
                _lingzhu_command_payload_tool_call(
                    command,
                    params,
                    default_navigation_mode=default_navigation_mode,
                ),
                cleaned,
            )

    explicit_command_match = re.match(r"^\s*([A-Za-z_]+)\b", normalized)
    if explicit_command_match:
        command = lingzhu_resolve_command(explicit_command_match.group(1), experimental_enabled=experimental_enabled)
        if command:
            return (
                _lingzhu_command_payload_tool_call(
                    command,
                    {},
                    default_navigation_mode=default_navigation_mode,
                ),
                normalized,
            )

    if _LINGZHU_PHOTO_REQUEST_RE.match(normalized):
        return _lingzhu_command_payload_tool_call("take_photo", {}, default_navigation_mode=default_navigation_mode), normalized
    if _LINGZHU_EXIT_REQUEST_RE.match(normalized):
        return _lingzhu_command_payload_tool_call("notify_agent_off", {}, default_navigation_mode=default_navigation_mode), normalized

    navigation_match = _LINGZHU_NAVIGATION_REQUEST_RE.match(normalized)
    if navigation_match and navigation_match.group(1).strip():
        return (
            _lingzhu_command_payload_tool_call(
                "take_navigation",
                {"poi_name": navigation_match.group(1).strip()},
                default_navigation_mode=default_navigation_mode,
            ),
            normalized,
        )

    if experimental_enabled:
        if _LINGZHU_NOTIFICATION_REQUEST_RE.match(normalized):
            return _lingzhu_command_payload_tool_call("send_notification", {}, default_navigation_mode=default_navigation_mode), normalized
        if _LINGZHU_TOAST_REQUEST_RE.match(normalized):
            return _lingzhu_command_payload_tool_call("send_toast", {}, default_navigation_mode=default_navigation_mode), normalized
        if _LINGZHU_TTS_REQUEST_RE.match(normalized):
            return _lingzhu_command_payload_tool_call("speak_tts", {}, default_navigation_mode=default_navigation_mode), normalized
        if _LINGZHU_START_RECORD_RE.match(normalized):
            return _lingzhu_command_payload_tool_call("start_video_record", {}, default_navigation_mode=default_navigation_mode), normalized
        if _LINGZHU_STOP_RECORD_RE.match(normalized):
            return _lingzhu_command_payload_tool_call("stop_video_record", {}, default_navigation_mode=default_navigation_mode), normalized
        if _LINGZHU_OPEN_VIEW_RE.match(normalized):
            return _lingzhu_command_payload_tool_call("open_custom_view", {}, default_navigation_mode=default_navigation_mode), normalized

    return None, normalized


def lingzhu_surface_action_tool_call(
    action: Any,
    *,
    default_navigation_mode: str = "0",
    experimental_enabled: bool = False,
) -> dict[str, Any] | None:
    if not isinstance(action, dict):
        return None

    command = lingzhu_resolve_command(
        action.get("command") or action.get("type"),
        experimental_enabled=experimental_enabled,
    )
    if not command:
        return None

    return _lingzhu_command_payload_tool_call(
        command,
        dict(action),
        default_navigation_mode=default_navigation_mode,
    )


def lingzhu_supported_commands(*, experimental_enabled: bool) -> list[str]:
    commands = [
        "take_photo",
        "take_navigation",
        "control_calendar",
        "notify_agent_off",
    ]
    if experimental_enabled:
        commands.extend(
            [
                "send_notification",
                "send_toast",
                "speak_tts",
                "start_video_record",
                "stop_video_record",
                "open_custom_view",
            ]
        )
    return commands
