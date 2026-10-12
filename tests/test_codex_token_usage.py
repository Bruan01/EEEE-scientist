from __future__ import annotations

from pathlib import Path

from deepscientist.config import ConfigManager
from deepscientist.home import ensure_home_layout, repo_root
from deepscientist.quest import QuestService
from deepscientist.shared import write_json
from deepscientist.skills import SkillInstaller


def test_codex_token_usage_sums_codex_telemetry_and_ignores_other_runners(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    ConfigManager(temp_home).ensure_files()
    quest_service = QuestService(temp_home, skill_installer=SkillInstaller(repo_root(), temp_home))
    quest = quest_service.create("codex token usage quest")
    quest_root = Path(quest["quest_root"])

    write_json(
        quest_root / ".ds" / "runs" / "run-1" / "telemetry.json",
        {
            "runner": "codex",
            "run_id": "run-1",
            "skill_id": "scout",
            "model": "inherit",
            "completed_at": "2026-10-13T01:00:00Z",
            "token_usage": {
                "input_tokens": 1_000,
                "cached_input_tokens": 200,
                "output_tokens": 300,
                "total_tokens": 1_300,
            },
        },
    )
    write_json(
        quest_root / ".ds" / "runs" / "run-2" / "telemetry.json",
        {
            "runner": "codex",
            "run_id": "run-2",
            "completed_at": "2026-10-13T02:00:00Z",
            "token_usage": {"input_tokens": 500, "output_tokens": 125},
        },
    )
    write_json(
        quest_root / ".ds" / "runs" / "run-3" / "telemetry.json",
        {
            "runner": "claude",
            "run_id": "run-3",
            "token_usage": {"input_tokens": 99_999, "output_tokens": 99_999},
        },
    )

    payload = quest_service.codex_token_usage(quest["quest_id"])

    assert payload["available"] is True
    assert payload["input_tokens"] == 1_500
    assert payload["cached_input_tokens"] == 200
    assert payload["output_tokens"] == 425
    assert payload["total_tokens"] == 1_925
    assert payload["run_count"] == 2
    assert payload["telemetry_run_count"] == 2
    assert payload["estimated"] is True
    assert [item["run_id"] for item in payload["runs"]] == ["run-1", "run-2"]
    assert (quest_root / ".ds" / "cache" / "codex_token_usage.v1.json").exists()


def test_codex_token_usage_cache_invalidates_when_telemetry_changes(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    ConfigManager(temp_home).ensure_files()
    quest_service = QuestService(temp_home, skill_installer=SkillInstaller(repo_root(), temp_home))
    quest = quest_service.create("codex token cache quest")
    quest_root = Path(quest["quest_root"])
    telemetry_path = quest_root / ".ds" / "runs" / "run-1" / "telemetry.json"

    write_json(
        telemetry_path,
        {
            "runner": "codex",
            "run_id": "run-1",
            "token_usage": {"input_tokens": 10, "output_tokens": 5, "total_tokens": 15},
        },
    )
    first = quest_service.codex_token_usage(quest["quest_id"])
    write_json(
        telemetry_path,
        {
            "runner": "codex",
            "run_id": "run-1",
            "token_usage": {"input_tokens": 20, "output_tokens": 8, "total_tokens": 28},
        },
    )

    second = quest_service.codex_token_usage(quest["quest_id"])

    assert first["total_tokens"] == 15
    assert second["total_tokens"] == 28
