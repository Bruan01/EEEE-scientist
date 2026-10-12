from __future__ import annotations

import argparse
import json
from pathlib import Path

from deepscientist.artifact import ArtifactService
from deepscientist.config import ConfigManager
from deepscientist.gitops import checkpoint_repo
from deepscientist.home import ensure_home_layout, repo_root
from deepscientist.quest import QuestService
from deepscientist.shared import run_command, write_text
from deepscientist.skills import SkillInstaller


FIXTURE_QUEST_ID = "e2e-git-diff"
FIXTURE_RUN_ID = "e2e-run-001"
FIXTURE_HEADING = "Historical Diff Fixture"
DIFF_HEADING = "Notes Diff Fixture"
OLD_PATH = "docs/old-name.md"
NEW_PATH = "docs/new-name.md"
DIFF_PATH = "docs/notes.md"

BASE_CONTENT = """# Historical Diff Fixture

Model summary: baseline stable today.
Remove this legacy note.
Shared conclusion line.
- Old bullet
"""

UPDATED_CONTENT = """# Historical Diff Fixture

Model summary: refined stable today.
Shared conclusion line.
- New bullet
Added follow-up observation.
"""

BASE_DIFF_CONTENT = """# Notes Diff Fixture

Model summary: baseline stable today.
Remove this legacy note.
Shared conclusion line.
"""

UPDATED_DIFF_CONTENT = """# Notes Diff Fixture

Model summary: refined stable today.
Shared conclusion line.
Added follow-up observation.
"""


def confirm_local_baseline(artifact: ArtifactService, quest_root: Path, baseline_id: str = "baseline-e2e") -> None:
    baseline_root = quest_root / "baselines" / "local" / baseline_id
    baseline_root.mkdir(parents=True, exist_ok=True)
    write_text(baseline_root / "README.md", "# Baseline\n")
    artifact.confirm_baseline(
        quest_root,
        baseline_path=str(baseline_root),
        baseline_id=baseline_id,
        summary=f"Confirmed {baseline_id}",
        metrics_summary={"acc": 0.8},
        primary_metric={"name": "acc", "value": 0.8},
        metric_contract={
            "primary_metric_id": "acc",
            "metrics": [{"metric_id": "acc", "direction": "higher"}],
        },
    )


def build_fixture(home: Path) -> dict[str, object]:
    ensure_home_layout(home)
    config_manager = ConfigManager(home)
    config_manager.ensure_files()

    installer = SkillInstaller(repo_root(), home)
    quest_service = QuestService(home, skill_installer=installer)
    quest = quest_service.create("Git diff viewer E2E fixture", quest_id=FIXTURE_QUEST_ID)
    quest_root = Path(quest["quest_root"])
    artifact = ArtifactService(home)
    base_ref = run_command(
        ["git", "branch", "--show-current"],
        cwd=quest_root,
        check=True,
    ).stdout.strip() or "main"
    confirm_local_baseline(artifact, quest_root)

    old_file = quest_root / OLD_PATH
    old_file.parent.mkdir(parents=True, exist_ok=True)
    write_text(old_file, BASE_CONTENT)
    write_text(quest_root / DIFF_PATH, BASE_DIFF_CONTENT)
    checkpoint_repo(quest_root, "seed git diff e2e fixture", allow_empty=False)

    branch = artifact.prepare_branch(
        quest_root,
        run_id=FIXTURE_RUN_ID,
        branch_kind="run",
        create_worktree_flag=False,
    )
    branch_ref = str(branch["branch"])

    run_command(["git", "checkout", branch_ref], cwd=quest_root, check=True)
    run_command(["git", "mv", OLD_PATH, NEW_PATH], cwd=quest_root, check=True)
    write_text(quest_root / NEW_PATH, UPDATED_CONTENT)
    write_text(quest_root / DIFF_PATH, UPDATED_DIFF_CONTENT)
    checkpoint_repo(quest_root, "rename markdown fixture and update lines", allow_empty=False)
    artifact.record(
        quest_root,
        {
            "kind": "run",
            "run_id": FIXTURE_RUN_ID,
            "run_kind": "experiment",
            "summary": "Exercise rename-aware diff rendering for the git viewer.",
            "metrics_summary": {"acc": 0.91},
        },
    )

    return {
        "quest_id": quest["quest_id"],
        "quest_root": str(quest_root),
        "branch_ref": branch_ref,
        "base_ref": base_ref,
        "run_id": FIXTURE_RUN_ID,
        "old_path": OLD_PATH,
        "new_path": NEW_PATH,
        "document_heading": FIXTURE_HEADING,
        "diff_path": DIFF_PATH,
        "diff_heading": DIFF_HEADING,
        "home": str(home),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Create an isolated git diff E2E fixture quest.")
    parser.add_argument("--home", required=True, help="DeepScientist home for the temporary fixture runtime.")
    parser.add_argument("--output", required=True, help="Path to write the fixture JSON.")
    args = parser.parse_args()

    home = Path(args.home).expanduser().resolve()
    output = Path(args.output).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)

    fixture = build_fixture(home)
    output.write_text(json.dumps(fixture, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(fixture, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
