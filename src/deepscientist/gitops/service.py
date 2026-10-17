from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from pathlib import Path

from ..file_lock import advisory_file_lock
from ..shared import ensure_dir, read_json, run_command, slugify, utc_now, write_json


# Git checkpoints are intended for source, metadata, metrics, and reports. A
# model/checkpoint file above this limit is kept in the experiment worktree and
# referenced by a local manifest instead of being copied into the Git object
# database. This is deliberately conservative: a large unexpected artifact is
# safer left local than silently turning every checkpoint into a multi-GB pack.
GIT_CHECKPOINT_MAX_FILE_BYTES = 256 * 1024 * 1024
_LOCAL_MODEL_EXTENSIONS = ("safetensors", "bin", "pt", "pth", "ckpt", "onnx", "gguf")
_LOCAL_MODEL_PATHSPECS = tuple(
    f":(glob){prefix}/**/*.{extension}"
    for prefix in ("artifacts/experiments", "artifacts/experiment", "experiments")
    for extension in _LOCAL_MODEL_EXTENSIONS
)
_EPHEMERAL_RUNTIME_ROOTS = (
    ".ds/codex-home",
    ".ds/codex_homes",
    ".ds/claude-home",
    ".ds/opencode-home",
)


def _is_ephemeral_runtime_path(path: str) -> bool:
    normalized = str(path or "").strip().replace("\\", "/").strip("/")
    return any(
        normalized == root or normalized.startswith(f"{root}/")
        for root in _EPHEMERAL_RUNTIME_ROOTS
    )


def _git_common_dir(repo: Path) -> Path:
    """Return the Git directory shared by the main checkout and worktrees."""

    git_entry = repo / ".git"
    if git_entry.is_dir():
        return git_entry.resolve()
    if git_entry.is_file():
        try:
            line = next(
                line for line in git_entry.read_text(encoding="utf-8").splitlines() if line.startswith("gitdir:")
            )
            git_dir = Path(line.split(":", 1)[1].strip())
            if not git_dir.is_absolute():
                git_dir = repo / git_dir
            git_dir = git_dir.resolve()
            commondir = git_dir / "commondir"
            if commondir.exists():
                common = Path(commondir.read_text(encoding="utf-8").strip())
                if not common.is_absolute():
                    common = git_dir / common
                return common.resolve()
            return git_dir
        except (OSError, StopIteration, ValueError):
            pass
    return (repo / ".git").resolve()


@contextmanager
def git_operation_lock(repo: Path) -> Iterator[None]:
    """Serialize mutating Git operations across all worktrees of a quest."""

    common_dir = _git_common_dir(repo)
    with advisory_file_lock(common_dir / "deepscientist-operation.lock"):
        yield


def _git_paths(repo: Path, args: list[str]) -> list[str]:
    result = run_command(["git", *args, "-z"], cwd=repo, check=False)
    if result.returncode != 0:
        return []
    return [item for item in result.stdout.split("\0") if item]


def _ignored_model_paths(repo: Path) -> list[str]:
    result = run_command(
        ["git", "ls-files", "-o", "-i", "--exclude-standard", "-z", "--", *_LOCAL_MODEL_PATHSPECS],
        cwd=repo,
        check=False,
    )
    if result.returncode != 0:
        return []
    return [item for item in result.stdout.split("\0") if item]


def _large_file_records(repo: Path, paths: list[str], max_file_bytes: int) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    seen: set[str] = set()
    for raw_path in paths:
        relative = str(raw_path or "").strip().replace("\\", "/")
        if not relative or relative in seen:
            continue
        seen.add(relative)
        candidate = repo / relative
        try:
            # Symlinks are stored as links by Git; do not follow them while
            # deciding whether a real blob would be too large.
            if candidate.is_symlink() or not candidate.is_file():
                continue
            size_bytes = candidate.stat().st_size
        except OSError:
            continue
        if size_bytes <= max_file_bytes:
            continue
        records.append(
            {
                "path": relative,
                "size_bytes": size_bytes,
                "max_file_bytes": max_file_bytes,
                "local_only": True,
                "reason": "exceeds_git_checkpoint_limit",
            }
        )
    return sorted(records, key=lambda item: str(item.get("path") or ""))


def _experiment_manifest_path(repo: Path, relative_path: str) -> Path | None:
    parts = tuple(part for part in relative_path.replace("\\", "/").split("/") if part and part != ".")
    if len(parts) >= 3 and parts[:2] == ("artifacts", "experiments"):
        return repo.joinpath(*parts[:3], "weights_manifest.json")
    if len(parts) >= 3 and parts[:2] == ("artifacts", "experiment"):
        return repo.joinpath(*parts[:3], "weights_manifest.json")
    if len(parts) >= 2 and parts[0] == "experiments":
        return repo.joinpath(*parts[:2], "weights_manifest.json")
    return None


def _write_local_file_manifests(repo: Path, records: list[dict[str, object]]) -> list[str]:
    grouped: dict[Path, list[dict[str, object]]] = {}
    for record in records:
        path = _experiment_manifest_path(repo, str(record.get("path") or ""))
        if path is not None:
            grouped.setdefault(path, []).append(dict(record))

    manifest_paths: list[str] = []
    for path, new_records in grouped.items():
        existing = read_json(path, {})
        manifest = dict(existing) if isinstance(existing, dict) else {}
        existing_files = manifest.get("files") if isinstance(manifest.get("files"), list) else []
        by_path = {
            str(item.get("path") or ""): dict(item)
            for item in existing_files
            if isinstance(item, dict) and str(item.get("path") or "").strip()
        }
        by_path.update({str(item["path"]): item for item in new_records if str(item.get("path") or "").strip()})
        manifest.update(
            {
                "schema_version": 1,
                "policy": "large experiment files remain local and are referenced by path",
                "generated_at": utc_now(),
                "files": [by_path[key] for key in sorted(by_path)],
            }
        )
        write_json(path, manifest)
        manifest_paths.append(path.relative_to(repo).as_posix())
    return manifest_paths


def init_repo(repo: Path) -> None:
    run_command(["git", "init"], cwd=repo)
    run_command(["git", "branch", "-M", "main"], cwd=repo, check=False)


def current_branch(repo: Path) -> str:
    result = run_command(["git", "branch", "--show-current"], cwd=repo, check=False)
    branch = result.stdout.strip()
    return branch or "main"


def head_commit(repo: Path) -> str | None:
    result = run_command(["git", "rev-parse", "HEAD"], cwd=repo, check=False)
    commit = result.stdout.strip()
    return commit or None


def has_changes(repo: Path) -> bool:
    result = run_command(["git", "status", "--porcelain"], cwd=repo, check=False)
    return bool(result.stdout.strip())


def branch_exists(repo: Path, branch: str) -> bool:
    result = run_command(["git", "rev-parse", "--verify", branch], cwd=repo, check=False)
    return result.returncode == 0


def ensure_branch(repo: Path, branch: str, *, start_point: str | None = None, checkout: bool = False) -> dict:
    with git_operation_lock(repo):
        start = start_point or current_branch(repo)
        if not branch_exists(repo, branch):
            result = run_command(["git", "branch", branch, start], cwd=repo, check=False)
            created = result.returncode == 0
        else:
            result = run_command(["git", "rev-parse", "--verify", branch], cwd=repo, check=False)
            created = False
        if checkout:
            run_command(["git", "checkout", branch], cwd=repo, check=False)
        return {
            "branch": branch,
            "created": created,
            "head": head_commit(repo),
            "stdout": result.stdout,
            "stderr": result.stderr,
        }


def create_worktree(
    repo: Path,
    *,
    branch: str,
    worktree_root: Path,
    start_point: str | None = None,
) -> dict:
    with git_operation_lock(repo):
        ensure_dir(worktree_root.parent)
        if worktree_root.exists() and any(worktree_root.iterdir()):
            return {
                "ok": True,
                "branch": branch,
                "worktree_root": str(worktree_root),
                "created": False,
                "head": head_commit(repo),
            }

        if branch_exists(repo, branch):
            result = run_command(["git", "worktree", "add", str(worktree_root), branch], cwd=repo, check=False)
        else:
            start = start_point or current_branch(repo)
            result = run_command(
                ["git", "worktree", "add", "-b", branch, str(worktree_root), start],
                cwd=repo,
                check=False,
            )
        return {
            "ok": result.returncode == 0,
            "branch": branch,
            "worktree_root": str(worktree_root),
            "created": result.returncode == 0,
            "head": head_commit(repo),
            "stdout": result.stdout,
            "stderr": result.stderr,
        }


def canonical_worktree_root(repo: Path, run_id: str) -> Path:
    return repo / ".ds" / "worktrees" / slugify(run_id, "run")


def checkpoint_repo(
    repo: Path,
    message: str,
    allow_empty: bool = False,
    *,
    max_file_bytes: int = GIT_CHECKPOINT_MAX_FILE_BYTES,
) -> dict:
    """Create a metadata-first checkpoint without importing large local files."""

    with git_operation_lock(repo):
        candidate_paths = [
            path
            for path in _git_paths(repo, ["ls-files", "-m", "-o", "--exclude-standard"])
            if not _is_ephemeral_runtime_path(path)
        ]
        candidate_paths.extend(_ignored_model_paths(repo))
        staged_paths = _git_paths(repo, ["diff", "--cached", "--name-only"])
        large_records = _large_file_records(repo, candidate_paths + staged_paths, max_file_bytes)
        manifest_paths = _write_local_file_manifests(repo, large_records)

        large_paths = {str(record.get("path") or "") for record in large_records}
        stage_paths: list[str] = []
        seen_stage_paths: set[str] = set()
        for path in [*candidate_paths, *manifest_paths]:
            normalized = str(path or "").strip().replace("\\", "/")
            if not normalized or normalized in large_paths or normalized in seen_stage_paths:
                continue
            seen_stage_paths.add(normalized)
            stage_paths.append(normalized)
        if stage_paths:
            # Always stage an explicit candidate list. Besides protecting
            # large model files, this keeps provider runtime homes (which may
            # already be tracked by an older quest) out of future automatic
            # checkpoints. Deletions are included because `git ls-files -m`
            # reports the deleted path as well.
            add_command = [
                "git",
                "add",
                "-A",
                "--",
                *(f":(literal){path}" for path in stage_paths),
            ]
        else:
            add_command = []
        if add_command:
            add_result = run_command(add_command, cwd=repo, check=False)
            add_failed = add_result.returncode != 0
        else:
            add_result = run_command(["git", "diff", "--cached", "--quiet"], cwd=repo, check=False)
            add_failed = add_result.returncode not in {0, 1}
        if add_failed:
            return {
                "committed": False,
                "branch": current_branch(repo),
                "head": head_commit(repo),
                "stdout": add_result.stdout,
                "stderr": add_result.stderr,
                "excluded_large_files": large_records,
                "weights_manifests": manifest_paths,
                "staging_failed": True,
            }

        staged_large_records = _large_file_records(
            repo,
            _git_paths(repo, ["diff", "--cached", "--name-only"]),
            max_file_bytes,
        )
        if staged_large_records:
            return {
                "committed": False,
                "blocked": True,
                "branch": current_branch(repo),
                "head": head_commit(repo),
                "stdout": add_result.stdout,
                "stderr": "Large files are already staged; they were left staged and no commit was created.",
                "excluded_large_files": large_records,
                "blocked_large_files": staged_large_records,
                "weights_manifests": manifest_paths,
            }

        staged_check = run_command(["git", "diff", "--cached", "--quiet"], cwd=repo, check=False)
        if staged_check.returncode not in {0, 1}:
            return {
                "committed": False,
                "branch": current_branch(repo),
                "head": head_commit(repo),
                "stdout": staged_check.stdout,
                "stderr": staged_check.stderr,
                "excluded_large_files": large_records,
                "weights_manifests": manifest_paths,
                "staging_failed": True,
            }
        if not allow_empty and staged_check.returncode == 0:
            return {
                "committed": False,
                "branch": current_branch(repo),
                "head": head_commit(repo),
                "excluded_large_files": large_records,
                "weights_manifests": manifest_paths,
            }

        command = ["git", "commit", "-m", message]
        if allow_empty:
            command.insert(2, "--allow-empty")
        result = run_command(command, cwd=repo, check=False)
        return {
            "committed": result.returncode == 0,
            "branch": current_branch(repo),
            "head": head_commit(repo),
            "stdout": result.stdout,
            "stderr": result.stderr,
            "excluded_large_files": large_records,
            "weights_manifests": manifest_paths,
        }


def log_graph_lines(repo: Path, limit: int = 40) -> list[str]:
    result = run_command(
        [
            "git",
            "log",
            "--graph",
            "--decorate",
            "--oneline",
            "--all",
            f"-n{limit}",
        ],
        cwd=repo,
        check=False,
    )
    return [line for line in result.stdout.splitlines() if line.strip()]
