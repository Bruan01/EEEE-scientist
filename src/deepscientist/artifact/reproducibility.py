"""Small, redacted reproducibility bundles for recorded experiments."""

from __future__ import annotations

import hashlib
import json
import platform
import re
import shlex
import subprocess
import sys
from pathlib import Path
from typing import Any, Mapping

from ..shared import ensure_dir, utc_now

_SENSITIVE_KEY_RE = re.compile(
    r"(?:api[_-]?key|access[_-]?token|auth(?:orization)?|cookie|credential|password|passwd|proxy[_-]?(?:url|user|password)|secret|token)",
    re.IGNORECASE,
)
_SENSITIVE_ASSIGNMENT_RE = re.compile(
    r"(?i)(\b(?:api[_-]?key|access[_-]?token|authorization|cookie|password|passwd|proxy[_-]?(?:url|user|password)|secret|token)\b\s*[=:]\s*)([^\s,;&]+)"
)
_BEARER_RE = re.compile(r"(?i)(\bBearer\s+)[^\s,;]+")
_URL_CREDENTIAL_RE = re.compile(r"(?i)(\b[a-z][a-z0-9+.-]*://)([^\s/@:]+):([^\s/@]+)@")
_SAFE_SEGMENT_RE = re.compile(r"[^A-Za-z0-9._-]+")
_MAX_LOG_BYTES = 256 * 1024


def redact_sensitive(value: Any, *, key: str | None = None) -> Any:
    """Recursively redact likely credentials before writing a bundle."""

    if key and _SENSITIVE_KEY_RE.search(key):
        return "[REDACTED]"
    if isinstance(value, Mapping):
        return {str(name): redact_sensitive(item, key=str(name)) for name, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [redact_sensitive(item) for item in value]
    if isinstance(value, str):
        text = _URL_CREDENTIAL_RE.sub(r"\1[REDACTED]@", value)
        text = _BEARER_RE.sub(r"\1[REDACTED]", text)
        return _SENSITIVE_ASSIGNMENT_RE.sub(r"\1[REDACTED]", text)
    return value


def _safe_segment(value: Any, *, default: str) -> str:
    text = _SAFE_SEGMENT_RE.sub("-", str(value or "").strip()).strip(".-_")
    return text[:120] or default


def reproducibility_dir(quest_root: Path, experiment_id: str) -> Path:
    return quest_root / "artifacts" / "experiments" / _safe_segment(experiment_id, default="experiment") / "reproducibility"


def _write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(redact_sensitive(payload), indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8")


def _git_value(root: Path, *args: str) -> str | None:
    try:
        completed = subprocess.run(
            ["git", "-C", str(root), *args],
            capture_output=True,
            text=True,
            timeout=4,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return None
    if completed.returncode != 0:
        return None
    value = completed.stdout.strip()
    return value or None


def _sha256(path: Path) -> str | None:
    try:
        digest = hashlib.sha256()
        with path.open("rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()
    except OSError:
        return None


def _bounded_text(path: Path, *, max_bytes: int = _MAX_LOG_BYTES) -> str:
    try:
        size = path.stat().st_size
        with path.open("rb") as handle:
            if size <= max_bytes:
                return handle.read().decode("utf-8", errors="replace")
            edge = max_bytes // 2
            head = handle.read(edge).decode("utf-8", errors="replace")
            handle.seek(max(0, size - edge))
            tail = handle.read(edge).decode("utf-8", errors="replace")
            return f"{head}\n[... log middle omitted: {size - edge * 2} bytes ...]\n{tail}"
    except OSError:
        return ""


def _resolve_reference(root: Path, value: Any) -> Path | None:
    text = str(value or "").strip()
    if not text:
        return None
    candidate = Path(text).expanduser()
    if not candidate.is_absolute():
        candidate = root / candidate
    try:
        return candidate.resolve()
    except OSError:
        return candidate


def _evidence_entries(quest_root: Path, item: Mapping[str, Any]) -> list[dict[str, Any]]:
    values: list[str] = []
    for key in ("evidence_paths", "changed_files", "config_paths"):
        raw = item.get(key)
        if isinstance(raw, str):
            values.append(raw)
        elif isinstance(raw, (list, tuple)):
            values.extend(str(value) for value in raw)
    seen: set[str] = set()
    entries: list[dict[str, Any]] = []
    for raw_value in values:
        value = str(raw_value or "").strip()
        if not value or value in seen:
            continue
        seen.add(value)
        path = _resolve_reference(quest_root, value)
        exists = bool(path and path.is_file())
        entries.append(
            {
                "path": value,
                "exists": exists,
                "size_bytes": path.stat().st_size if exists and path else None,
                "sha256": _sha256(path) if exists and path else None,
            }
        )
    return entries


def bundle_status(quest_root: Path, experiment_id: str) -> dict[str, Any]:
    directory = reproducibility_dir(quest_root, experiment_id)
    manifest = directory / "manifest.json"
    return {
        "available": manifest.exists(),
        "path": str(directory.relative_to(quest_root)) if directory.is_relative_to(quest_root) else str(directory),
        "manifest_path": str(manifest.relative_to(quest_root)) if manifest.is_relative_to(quest_root) else str(manifest),
    }


def generate_reproducibility_bundle(
    quest_root: Path,
    *,
    item: Mapping[str, Any],
    session: Mapping[str, Any] | None = None,
) -> dict[str, Any]:
    """Generate a reference-and-hash bundle; datasets/checkpoints are never copied."""

    resolved_root = quest_root.resolve()
    experiment_id = str(item.get("experiment_id") or "experiment").strip() or "experiment"
    directory = reproducibility_dir(resolved_root, experiment_id)
    logs_dir = ensure_dir(directory / "logs")
    execution = dict(item.get("execution") or {}) if isinstance(item.get("execution"), Mapping) else {}
    if session:
        execution = {**execution, **dict(session)}
    command = str(execution.get("command") or item.get("command") or "").strip()
    redacted_command = str(redact_sensitive(command))
    working_directory = str(execution.get("cwd") or execution.get("working_directory") or resolved_root)
    workdir_path = _resolve_reference(resolved_root, working_directory) or resolved_root
    git_root = workdir_path if (workdir_path / ".git").exists() else resolved_root
    git_commit = _git_value(git_root, "rev-parse", "HEAD")
    git_branch = _git_value(git_root, "branch", "--show-current")
    dependency_locks = [
        path.name
        for path in (git_root / "uv.lock", git_root / "poetry.lock", git_root / "requirements.txt", git_root / "pyproject.toml")
        if path.exists()
    ]

    environment = {
        "python_version": sys.version.split()[0],
        "platform": platform.platform(),
        "git_commit": git_commit,
        "git_branch": git_branch,
        "dependency_lock_files": dependency_locks,
        "recorded_environment": item.get("environment") or {},
    }
    metrics = {
        "metrics_summary": item.get("metrics_summary") or {},
        "primary_metric": item.get("primary_metric"),
        "metric_rows": item.get("metric_rows") or [],
        "status": item.get("status"),
        "verdict": item.get("verdict"),
    }
    git_lines = [
        f"commit: {git_commit or 'unknown'}",
        f"branch: {git_branch or 'unknown'}",
        f"working_directory: {working_directory}",
        f"generated_at: {utc_now()}",
    ]
    (directory / "git.txt").write_text("\n".join(redact_sensitive(git_lines)) + "\n", encoding="utf-8")
    (directory / "command.txt").write_text(redacted_command + "\n", encoding="utf-8")
    _write_json(directory / "environment.json", environment)
    _write_json(directory / "metrics.json", metrics)
    _write_json(directory / "evidence.json", _evidence_entries(resolved_root, item))

    run_lines = [
        "#!/usr/bin/env bash",
        "set -euo pipefail",
        f"cd {shlex.quote(working_directory)}",
        "",
        "# Generated by EEEE Scientist. Review paths and references before running.",
        redacted_command or "echo 'No executable command was recorded.'",
        "",
    ]
    run_path = directory / "run.sh"
    run_path.write_text("\n".join(run_lines), encoding="utf-8")
    run_path.chmod(0o750)

    if session:
        log_path = _resolve_reference(resolved_root, session.get("log_path"))
        if log_path and log_path.exists():
            (logs_dir / "terminal.log").write_text(redact_sensitive(_bounded_text(log_path)), encoding="utf-8")
        _write_json(logs_dir / "session.json", dict(session))

    files = sorted(
        str(path.relative_to(directory))
        for path in directory.rglob("*")
        if path.is_file() and path.name != "manifest.json"
    )
    manifest = {
        "schema_version": 1,
        "generated_at": utc_now(),
        "experiment_id": experiment_id,
        "run_id": item.get("run_id"),
        "status": item.get("status"),
        "source_kind": item.get("source_kind"),
        "redacted": True,
        "references_only": True,
        "files": files,
        "environment_path": "environment.json",
        "command_path": "command.txt",
        "run_script": "run.sh",
        "metrics_path": "metrics.json",
        "evidence_path": "evidence.json",
        "logs_path": "logs/",
        "item": dict(item),
    }
    _write_json(directory / "manifest.json", manifest)
    return {
        "ok": True,
        "experiment_id": experiment_id,
        "path": str(directory.relative_to(resolved_root)),
        "manifest_path": str((directory / "manifest.json").relative_to(resolved_root)),
        "files": files + ["manifest.json"],
        "redacted": True,
        "references_only": True,
    }
