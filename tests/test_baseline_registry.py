from __future__ import annotations

from pathlib import Path

from deepscientist.artifact import ArtifactService
from deepscientist.config import ConfigManager
from deepscientist.home import ensure_home_layout, repo_root
from deepscientist.quest import QuestService
from deepscientist.registries import BaselineRegistry
from deepscientist.skills import SkillInstaller


def test_baseline_publish_and_attach(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    ConfigManager(temp_home).ensure_files()
    quest = QuestService(temp_home, skill_installer=SkillInstaller(repo_root(), temp_home)).create("baseline quest")
    quest_root = Path(quest["quest_root"])
    artifact = ArtifactService(temp_home)
    result = artifact.record(
        quest_root,
        {
            "kind": "baseline",
            "publish_global": True,
            "baseline_id": "baseline-demo",
            "name": "Demo baseline",
            "primary_metric": {"name": "accuracy", "value": 0.9},
            "metrics_summary": {"accuracy": 0.9},
            "baseline_variants": [{"variant_id": "main", "label": "Main"}],
            "default_variant_id": "main",
        },
    )
    assert result["ok"] is True
    registry = BaselineRegistry(temp_home)
    entry = registry.get("baseline-demo")
    assert entry is not None
    assert entry["metric_contract"]["primary_metric_id"] == "accuracy"
    assert entry["metric_contract"]["metrics"][0]["metric_id"] == "accuracy"
    attachment = registry.attach(quest_root, "baseline-demo", "main")
    assert attachment["source_baseline_id"] == "baseline-demo"
    assert attachment["source_variant_id"] == "main"


def test_baseline_registry_republish_keeps_single_canonical_entry(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    registry = BaselineRegistry(temp_home)

    first = registry.publish(
        {
            "baseline_id": "baseline-demo",
            "name": "Demo baseline",
            "metrics_summary": {"accuracy": 0.9},
        }
    )
    second = registry.publish(
        {
            "baseline_id": "baseline-demo",
            "name": "Demo baseline v2",
            "metrics_summary": {"accuracy": 0.95},
        }
    )

    entries = registry.list_entries()
    assert len(entries) == 1
    assert entries[0]["baseline_id"] == "baseline-demo"
    assert entries[0]["metrics_summary"]["accuracy"] == 0.95
    assert entries[0]["created_at"] == first["created_at"]
    assert second["created_at"] == first["created_at"]


def test_baseline_registry_rejects_unsafe_ids(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    registry = BaselineRegistry(temp_home)

    try:
        registry.publish({"baseline_id": "../bad-baseline"})
    except ValueError as exc:
        assert "Baseline id" in str(exc)
    else:  # pragma: no cover
        raise AssertionError("Expected baseline id validation error")


def test_baseline_registry_normalizes_explicit_metric_contract(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    registry = BaselineRegistry(temp_home)

    entry = registry.publish(
        {
            "baseline_id": "baseline-explicit",
            "name": "Explicit contract baseline",
            "metrics_summary": {"acc": 0.9, "loss": 0.12},
            "metric_contract": {
                "contract_id": "demo-contract",
                "primary_metric_id": "acc",
                "metrics": [
                    {"metric_id": "acc", "label": "Accuracy", "direction": "maximize"},
                    {"metric_id": "loss", "label": "Loss", "direction": "minimize"},
                ],
            },
        }
    )

    assert entry["metric_contract"]["contract_id"] == "demo-contract"
    assert entry["metric_contract"]["primary_metric_id"] == "acc"
    metrics = {item["metric_id"]: item for item in entry["metric_contract"]["metrics"]}
    assert metrics["acc"]["direction"] == "maximize"
    assert metrics["loss"]["direction"] == "minimize"


def test_baseline_registry_delete_writes_tombstone_and_hides_entry(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    registry = BaselineRegistry(temp_home)

    registry.publish(
        {
            "baseline_id": "baseline-delete-me",
            "name": "Delete me",
            "metrics_summary": {"accuracy": 0.9},
        }
    )

    deleted = registry.delete("baseline-delete-me")

    assert deleted["baseline_id"] == "baseline-delete-me"
    assert deleted["status"] == "deleted"
    assert registry.get("baseline-delete-me") is None
    assert registry.get("baseline-delete-me", include_deleted=True)["status"] == "deleted"
    assert registry.list_entries() == []
