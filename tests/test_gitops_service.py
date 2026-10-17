from __future__ import annotations

import json
from pathlib import Path

from deepscientist.gitops import checkpoint_repo, create_worktree, init_repo
from deepscientist.gitops.service import _git_common_dir
from deepscientist.shared import run_command


def _configure_git(repo: Path) -> None:
    run_command(["git", "config", "user.email", "tests@example.invalid"], cwd=repo)
    run_command(["git", "config", "user.name", "EEEE tests"], cwd=repo)


def test_checkpoint_keeps_large_experiment_files_local_and_commits_manifest(tmp_path: Path) -> None:
    repo = tmp_path / "quest"
    repo.mkdir()
    init_repo(repo)
    _configure_git(repo)
    (repo / ".gitignore").write_text("artifacts/experiments/**/*.safetensors\n", encoding="utf-8")

    metadata = repo / "artifacts" / "experiments" / "run-001" / "run_manifest.json"
    metadata.parent.mkdir(parents=True)
    metadata.write_text('{"run_id": "run-001"}\n', encoding="utf-8")
    weights = metadata.parent / "adapter_model.safetensors"
    with weights.open("wb") as handle:
        handle.truncate(4096)

    result = checkpoint_repo(repo, "record experiment metadata", max_file_bytes=1024)

    assert result["committed"] is True
    assert [item["path"] for item in result["excluded_large_files"]] == [
        "artifacts/experiments/run-001/adapter_model.safetensors"
    ]
    manifest = metadata.parent / "weights_manifest.json"
    assert manifest.exists()
    manifest_payload = json.loads(manifest.read_text(encoding="utf-8"))
    assert manifest_payload["files"][0]["path"] == str(weights.relative_to(repo)).replace("\\", "/")

    tracked = run_command(["git", "ls-tree", "-r", "--name-only", "HEAD"], cwd=repo).stdout.splitlines()
    assert "artifacts/experiments/run-001/run_manifest.json" in tracked
    assert "artifacts/experiments/run-001/weights_manifest.json" in tracked
    assert "artifacts/experiments/run-001/adapter_model.safetensors" not in tracked
    assert weights.exists()


def test_worktree_checkpoint_lock_uses_shared_git_common_dir(tmp_path: Path) -> None:
    repo = tmp_path / "quest"
    repo.mkdir()
    init_repo(repo)
    _configure_git(repo)
    (repo / "README.md").write_text("quest\n", encoding="utf-8")
    assert checkpoint_repo(repo, "initial checkpoint")["committed"] is True

    worktree = repo / ".ds" / "worktrees" / "run-001"
    created = create_worktree(repo, branch="run/run-001", worktree_root=worktree)

    assert created["ok"] is True
    assert _git_common_dir(repo) == _git_common_dir(worktree)


def test_checkpoint_does_not_stage_tracked_provider_runtime_home(tmp_path: Path) -> None:
    repo = tmp_path / "quest"
    repo.mkdir()
    init_repo(repo)
    _configure_git(repo)
    (repo / ".gitignore").write_text(".ds/codex-home/\n", encoding="utf-8")
    runtime_state = repo / ".ds" / "codex-home" / "state.sqlite"
    runtime_state.parent.mkdir(parents=True)
    runtime_state.write_text("initial\n", encoding="utf-8")
    run_manifest = repo / "artifacts" / "experiments" / "run-001" / "run_manifest.json"
    run_manifest.parent.mkdir(parents=True)
    run_manifest.write_text('{"run_id": "run-001"}\n', encoding="utf-8")
    run_command(["git", "add", "-f", ".ds/codex-home/state.sqlite", "artifacts/experiments/run-001/run_manifest.json"], cwd=repo)
    run_command(["git", "commit", "-m", "initial"], cwd=repo)

    runtime_state.write_text("updated cache\n", encoding="utf-8")
    report = repo / "artifacts" / "experiments" / "run-001" / "report.md"
    report.write_text("# Report\n", encoding="utf-8")

    result = checkpoint_repo(repo, "record report")

    assert result["committed"] is True
    committed_paths = run_command(
        ["git", "show", "--format=", "--name-only", "HEAD"],
        cwd=repo,
    ).stdout.splitlines()
    assert "artifacts/experiments/run-001/report.md" in committed_paths
    assert ".ds/codex-home/state.sqlite" not in committed_paths
    assert runtime_state.read_text(encoding="utf-8") == "updated cache\n"
