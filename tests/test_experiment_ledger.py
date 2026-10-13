from __future__ import annotations

from pathlib import Path

from deepscientist.artifact import ArtifactService
from deepscientist.artifact.experiment_ledger import build_experiment_ledger
from deepscientist.config import ConfigManager
from deepscientist.daemon.app import DaemonApp
from deepscientist.home import ensure_home_layout, repo_root
from deepscientist.quest import QuestService
from deepscientist.skills import SkillInstaller


def test_experiment_ledger_prefers_explicit_record_and_keeps_run_evidence() -> None:
    payload = build_experiment_ledger(
        [
            {
                "kind": "run",
                "path": "/quest/artifacts/runs/run-001.json",
                "payload": {
                    "kind": "run",
                    "run_id": "run-001",
                    "run_kind": "main_experiment",
                    "status": "completed",
                    "title": "Measured run",
                    "metrics_summary": {"accuracy": 0.91},
                    "evidence_paths": ["experiments/main/run-001/RESULT.json"],
                    "details": {
                        "primary_metric_id": "accuracy",
                        "primary_value": 0.91,
                        "baseline_value": 0.88,
                        "delta_vs_baseline": 0.03,
                    },
                },
            },
            {
                "kind": "experiment",
                "path": "/quest/artifacts/experiments/run-001.json",
                "payload": {
                    "kind": "experiment",
                    "experiment_id": "run-001",
                    "status": "running",
                    "title": "Adapter ablation",
                    "hypothesis": "The adapter improves accuracy.",
                    "dataset_scope": "full",
                },
            },
        ]
    )

    assert payload["count"] == 1
    item = payload["items"][0]
    assert item["title"] == "Adapter ablation"
    assert item["status"] == "running"
    assert item["metrics_summary"] == {"accuracy": 0.91}
    assert item["primary_metric"]["id"] == "accuracy"
    assert item["primary_metric"]["value"] == 0.91
    assert item["primary_metric"]["delta_vs_baseline"] == 0.03
    assert item["evidence_paths"] == ["experiments/main/run-001/RESULT.json"]
    assert payload["summary"]["running"] == 1


def test_artifact_service_reads_explicit_and_historical_experiments(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    ConfigManager(temp_home).ensure_files()
    quest_service = QuestService(temp_home, skill_installer=SkillInstaller(repo_root(), temp_home))
    quest = quest_service.create("experiment ledger quest")
    quest_root = Path(quest["quest_root"])
    artifact = ArtifactService(temp_home)

    artifact.record(
        quest_root,
        {
            "kind": "run",
            "run_id": "run-legacy-001",
            "run_kind": "main_experiment",
            "status": "completed",
            "title": "Legacy measured run",
            "metrics_summary": {"accuracy": 0.9},
            "details": {"primary_metric_id": "accuracy", "primary_value": 0.9},
        },
        checkpoint=False,
    )
    result = artifact.record_experiment(
        quest_root,
        experiment_id="plan-001",
        title="Planned adapter experiment",
        hypothesis="The adapter improves accuracy.",
        configuration={"seed": 7, "lr": 0.001},
        status="planned",
    )

    assert result["ok"] is True
    ledger = artifact.get_experiment_ledger(quest_root)
    assert ledger["ok"] is True
    assert ledger["count"] == 2
    assert {item["experiment_id"] for item in ledger["items"]} == {"run-legacy-001", "plan-001"}
    planned = next(item for item in ledger["items"] if item["experiment_id"] == "plan-001")
    assert planned["status"] == "planned"
    assert planned["hypothesis"] == "The adapter improves accuracy."

    api_payload = DaemonApp(temp_home).handlers.experiment_ledger(quest["quest_id"])
    assert api_payload["ok"] is True
    assert api_payload["count"] == 2
