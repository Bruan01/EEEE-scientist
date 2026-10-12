from __future__ import annotations

import os
from copy import deepcopy
from typing import Any


def _as_text(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _as_bool_env(name: str) -> bool:
    value = _as_text(os.environ.get(name))
    if value is None:
        return False
    return value.lower() in {"1", "true", "yes", "on", "y"}


def _as_optional_bool_env(name: str) -> bool | None:
    value = _as_text(os.environ.get(name))
    if value is None:
        return None
    normalized = value.lower()
    if normalized in {"1", "true", "yes", "on", "y"}:
        return True
    if normalized in {"0", "false", "no", "off", "n"}:
        return False
    return True


def codex_runtime_overrides() -> dict[str, str]:
    binary = _as_text(os.environ.get("DEEPSCIENTIST_CODEX_BINARY") or os.environ.get("DS_CODEX_BINARY"))
    approval_policy = _as_text(os.environ.get("DEEPSCIENTIST_CODEX_APPROVAL_POLICY"))
    sandbox_mode = _as_text(os.environ.get("DEEPSCIENTIST_CODEX_SANDBOX_MODE"))
    profile = _as_text(os.environ.get("DEEPSCIENTIST_CODEX_PROFILE"))
    model = _as_text(os.environ.get("DEEPSCIENTIST_CODEX_MODEL"))

    yolo_enabled = _as_optional_bool_env("DEEPSCIENTIST_CODEX_YOLO")
    if yolo_enabled is True:
        approval_policy = approval_policy or "never"
        sandbox_mode = sandbox_mode or "danger-full-access"
    elif yolo_enabled is False:
        approval_policy = approval_policy or "on-request"
        sandbox_mode = sandbox_mode or "workspace-write"

    overrides: dict[str, str] = {}
    if binary:
        overrides["binary"] = binary
    if approval_policy:
        overrides["approval_policy"] = approval_policy
    if sandbox_mode:
        overrides["sandbox_mode"] = sandbox_mode
    if profile:
        overrides["profile"] = profile
    if model:
        overrides["model"] = model
    return overrides


def apply_codex_runtime_overrides(config: dict[str, Any] | None) -> dict[str, Any]:
    resolved = deepcopy(config or {})
    resolved.update(codex_runtime_overrides())
    return resolved


def claude_runtime_overrides() -> dict[str, str]:
    binary = _as_text(os.environ.get("DEEPSCIENTIST_CLAUDE_BINARY") or os.environ.get("DS_CLAUDE_BINARY"))
    model = _as_text(os.environ.get("DEEPSCIENTIST_CLAUDE_MODEL") or os.environ.get("DS_CLAUDE_MODEL"))
    max_turns = _as_text(os.environ.get("DEEPSCIENTIST_CLAUDE_MAX_TURNS"))
    mcp_timeout_ms = _as_text(os.environ.get("DEEPSCIENTIST_CLAUDE_MCP_TIMEOUT_MS"))
    mcp_tool_timeout_ms = _as_text(os.environ.get("DEEPSCIENTIST_CLAUDE_MCP_TOOL_TIMEOUT_MS"))
    yolo_enabled = _as_optional_bool_env("DEEPSCIENTIST_CLAUDE_YOLO")

    overrides: dict[str, str] = {}
    if binary:
        overrides["binary"] = binary
    if model:
        overrides["model"] = model
    if max_turns:
        overrides["max_turns"] = max_turns
    if mcp_timeout_ms:
        overrides["mcp_timeout_ms"] = mcp_timeout_ms
    if mcp_tool_timeout_ms:
        overrides["mcp_tool_timeout_ms"] = mcp_tool_timeout_ms
    if yolo_enabled is True:
        overrides["permission_mode"] = "bypassPermissions"
    elif yolo_enabled is False:
        overrides["permission_mode"] = "default"
    return overrides


def apply_claude_runtime_overrides(config: dict[str, Any] | None) -> dict[str, Any]:
    resolved = deepcopy(config or {})
    resolved.update(claude_runtime_overrides())
    return resolved


def kimi_runtime_overrides() -> dict[str, str | bool]:
    binary = _as_text(os.environ.get("DEEPSCIENTIST_KIMI_BINARY") or os.environ.get("DS_KIMI_BINARY"))
    model = _as_text(os.environ.get("DEEPSCIENTIST_KIMI_MODEL") or os.environ.get("DS_KIMI_MODEL"))
    agent = _as_text(os.environ.get("DEEPSCIENTIST_KIMI_AGENT") or os.environ.get("DS_KIMI_AGENT"))
    mcp_tool_timeout_ms = _as_text(os.environ.get("DEEPSCIENTIST_KIMI_MCP_TOOL_TIMEOUT_MS"))
    thinking_enabled = _as_optional_bool_env("DEEPSCIENTIST_KIMI_THINKING")
    yolo_enabled = _as_optional_bool_env("DEEPSCIENTIST_KIMI_YOLO")

    overrides: dict[str, str | bool] = {}
    if binary:
        overrides["binary"] = binary
    if model:
        overrides["model"] = model
    if agent:
        overrides["agent"] = agent
    if mcp_tool_timeout_ms:
        overrides["mcp_tool_timeout_ms"] = mcp_tool_timeout_ms
    if thinking_enabled is not None:
        overrides["thinking"] = thinking_enabled
    if yolo_enabled is not None:
        overrides["yolo"] = yolo_enabled
    return overrides


def apply_kimi_runtime_overrides(config: dict[str, Any] | None) -> dict[str, Any]:
    resolved = deepcopy(config or {})
    resolved.update(kimi_runtime_overrides())
    return resolved


def opencode_runtime_overrides() -> dict[str, str]:
    binary = _as_text(os.environ.get("DEEPSCIENTIST_OPENCODE_BINARY") or os.environ.get("DS_OPENCODE_BINARY"))
    model = _as_text(os.environ.get("DEEPSCIENTIST_OPENCODE_MODEL") or os.environ.get("DS_OPENCODE_MODEL"))
    variant = _as_text(os.environ.get("DEEPSCIENTIST_OPENCODE_VARIANT") or os.environ.get("DS_OPENCODE_VARIANT"))
    default_agent = _as_text(os.environ.get("DEEPSCIENTIST_OPENCODE_AGENT") or os.environ.get("DS_OPENCODE_AGENT"))
    mcp_timeout_ms = _as_text(os.environ.get("DEEPSCIENTIST_OPENCODE_MCP_TIMEOUT_MS"))
    yolo_enabled = _as_optional_bool_env("DEEPSCIENTIST_OPENCODE_YOLO")

    overrides: dict[str, str] = {}
    if binary:
        overrides["binary"] = binary
    if model:
        overrides["model"] = model
    if variant:
        overrides["variant"] = variant
    if default_agent:
        overrides["default_agent"] = default_agent
    if mcp_timeout_ms:
        overrides["mcp_timeout_ms"] = mcp_timeout_ms
    if yolo_enabled is True:
        overrides["permission_mode"] = "allow"
    elif yolo_enabled is False:
        overrides["permission_mode"] = "ask"
    return overrides


def apply_opencode_runtime_overrides(config: dict[str, Any] | None) -> dict[str, Any]:
    resolved = deepcopy(config or {})
    resolved.update(opencode_runtime_overrides())
    return resolved


def apply_runners_runtime_overrides(runners_config: dict[str, Any] | None) -> dict[str, Any]:
    resolved = deepcopy(runners_config or {})
    codex = resolved.get("codex")
    resolved["codex"] = apply_codex_runtime_overrides(codex if isinstance(codex, dict) else {})
    claude = resolved.get("claude")
    resolved["claude"] = apply_claude_runtime_overrides(claude if isinstance(claude, dict) else {})
    kimi = resolved.get("kimi")
    resolved["kimi"] = apply_kimi_runtime_overrides(kimi if isinstance(kimi, dict) else {})
    opencode = resolved.get("opencode")
    resolved["opencode"] = apply_opencode_runtime_overrides(opencode if isinstance(opencode, dict) else {})
    return resolved
