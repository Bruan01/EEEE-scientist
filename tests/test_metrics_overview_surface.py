from __future__ import annotations

from pathlib import Path

from deepscientist.artifact import ArtifactService
from deepscientist.artifact.metrics import build_baseline_compare_payload, build_metrics_timeline
from deepscientist.config import ConfigManager
from deepscientist.home import ensure_home_layout, repo_root
from deepscientist.quest import QuestService
from deepscientist.skills import SkillInstaller


REPO_ROOT = Path(__file__).resolve().parents[1]


def test_metrics_timeline_keeps_baseline_only_series_without_main_runs() -> None:
    timeline = build_metrics_timeline(
        quest_id="quest-baseline-only",
        run_records=[],
        baseline_entry={
            "baseline_id": "baseline-only",
            "metrics_summary": {"acc": 0.81, "loss": 0.42},
            "primary_metric": {"name": "acc", "value": 0.81},
            "metric_contract": {
                "primary_metric_id": "acc",
                "metrics": [
                    {"metric_id": "acc", "direction": "higher", "label": "Accuracy"},
                    {"metric_id": "loss", "direction": "lower", "label": "Loss"},
                ],
            },
        },
        selected_variant_id=None,
    )

    assert timeline["total_runs"] == 0
    assert timeline["primary_metric_id"] == "acc"
    series_by_id = {item["metric_id"]: item for item in timeline["series"]}
    assert set(series_by_id.keys()) == {"acc", "loss"}
    assert series_by_id["acc"]["points"] == []
    assert series_by_id["loss"]["points"] == []
    assert series_by_id["acc"]["baselines"][0]["value"] == 0.81
    assert series_by_id["loss"]["baselines"][0]["value"] == 0.42


def test_metrics_timeline_uses_primary_metric_when_baseline_summary_is_missing() -> None:
    timeline = build_metrics_timeline(
        quest_id="quest-baseline-primary-only",
        run_records=[],
        baseline_entry={
            "baseline_id": "baseline-primary-only",
            "metrics_summary": {},
            "primary_metric": {"name": "acc", "value": 0.83},
            "metric_contract": {
                "primary_metric_id": "acc",
                "metrics": [{"metric_id": "acc", "direction": "higher", "label": "Accuracy"}],
            },
        },
        selected_variant_id=None,
    )

    assert timeline["total_runs"] == 0
    series_by_id = {item["metric_id"]: item for item in timeline["series"]}
    assert set(series_by_id.keys()) == {"acc"}
    assert series_by_id["acc"]["points"] == []
    assert series_by_id["acc"]["baselines"][0]["value"] == 0.83


def test_baseline_compare_payload_keeps_multiple_baselines_and_variants() -> None:
    payload = build_baseline_compare_payload(
        quest_id="quest-baseline-compare",
        baseline_entries=[
            {
                "baseline_id": "baseline-a",
                "baseline_kind": "local",
                "summary": "First baseline",
                "default_variant_id": "main",
                "baseline_variants": [
                    {
                        "variant_id": "main",
                        "label": "Main",
                        "metrics_summary": {"acc": 0.81, "loss": 0.42},
                    }
                ],
                "metric_contract": {
                    "primary_metric_id": "acc",
                    "metrics": [
                        {"metric_id": "acc", "direction": "higher", "label": "Accuracy"},
                        {"metric_id": "loss", "direction": "lower", "label": "Loss"},
                    ],
                },
            },
            {
                "baseline_id": "baseline-b",
                "baseline_kind": "imported",
                "summary": "Second baseline",
                "default_variant_id": "fast",
                "baseline_variants": [
                    {
                        "variant_id": "fast",
                        "label": "Fast",
                        "metrics_summary": {"acc": 0.79, "loss": 0.38},
                    },
                    {
                        "variant_id": "stable",
                        "label": "Stable",
                        "metrics_summary": {"acc": 0.84, "loss": 0.47},
                    },
                ],
                "metric_contract": {
                    "primary_metric_id": "acc",
                    "metrics": [
                        {"metric_id": "acc", "direction": "higher", "label": "Accuracy"},
                        {"metric_id": "loss", "direction": "lower", "label": "Loss"},
                    ],
                },
            },
        ],
        active_baseline_id="baseline-b",
        active_variant_id="fast",
    )

    assert payload["total_entries"] == 3
    series_by_id = {item["metric_id"]: item for item in payload["series"]}
    assert set(series_by_id.keys()) == {"acc", "loss"}
    assert len(series_by_id["acc"]["values"]) == 3
    assert any(item["selected"] for item in series_by_id["acc"]["values"])
    assert any(item["label"] == "baseline-b:Stable" for item in series_by_id["acc"]["values"])


def test_details_surface_explicitly_handles_baseline_only_metrics_state() -> None:
    source = (REPO_ROOT / "src/ui/src/components/workspace/QuestWorkspaceSurface.tsx").read_text(
        encoding="utf-8"
    )

    assert "const hasMainExperimentMetricPoints = metricsTimelineSeries.some(" in source
    assert "Showing baseline-only metrics. Main-experiment traces will appear after the first recorded result." in source
    assert "Attach a baseline with recorded metrics to populate this section." in source
    assert 'title="Baseline Compare"' in source
    assert "Confirm more than one baseline or variant to populate cross-baseline comparison here." in source


def test_metrics_timeline_falls_back_to_confirmed_baseline_artifact_when_attachment_is_missing(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    ConfigManager(temp_home).ensure_files()
    quest_service = QuestService(temp_home, skill_installer=SkillInstaller(repo_root(), temp_home))
    quest = quest_service.create("baseline attachment fallback quest")
    quest_root = Path(quest["quest_root"])
    artifact = ArtifactService(temp_home)

    baseline_root = quest_root / "baselines" / "local" / "baseline-fallback"
    baseline_root.mkdir(parents=True, exist_ok=True)
    (baseline_root / "README.md").write_text("# Baseline\n", encoding="utf-8")
    artifact.confirm_baseline(
        quest_root,
        baseline_path=str(baseline_root),
        baseline_id="baseline-fallback",
        summary="Confirmed fallback baseline.",
        metrics_summary={"acc": 0.87},
        primary_metric={"metric_id": "acc", "value": 0.87},
        metric_contract={"primary_metric_id": "acc", "metrics": [{"metric_id": "acc", "direction": "higher"}]},
    )

    attachment_path = baseline_root / "attachment.yaml"
    if attachment_path.exists():
        attachment_path.unlink()

    timeline = quest_service.metrics_timeline(quest["quest_id"])
    series_by_id = {item["metric_id"]: item for item in timeline["series"]}

    assert set(series_by_id.keys()) == {"acc"}
    assert series_by_id["acc"]["points"] == []
    assert series_by_id["acc"]["baselines"][0]["value"] == 0.87


def test_baseline_compare_keeps_history_while_timeline_stays_on_active_baseline(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    ConfigManager(temp_home).ensure_files()
    quest_service = QuestService(temp_home, skill_installer=SkillInstaller(repo_root(), temp_home))
    quest = quest_service.create("baseline compare history quest")
    quest_root = Path(quest["quest_root"])
    artifact = ArtifactService(temp_home)

    baseline_a = quest_root / "baselines" / "local" / "baseline-a"
    baseline_b = quest_root / "baselines" / "local" / "baseline-b"
    baseline_a.mkdir(parents=True, exist_ok=True)
    baseline_b.mkdir(parents=True, exist_ok=True)
    (baseline_a / "README.md").write_text("# Baseline A\n", encoding="utf-8")
    (baseline_b / "README.md").write_text("# Baseline B\n", encoding="utf-8")

    artifact.confirm_baseline(
        quest_root,
        baseline_path=str(baseline_a),
        baseline_id="baseline-a",
        summary="Baseline A confirmed.",
        metrics_summary={"acc": 0.81},
        primary_metric={"metric_id": "acc", "value": 0.81},
        metric_contract={"primary_metric_id": "acc", "metrics": [{"metric_id": "acc", "direction": "higher"}]},
    )
    artifact.confirm_baseline(
        quest_root,
        baseline_path=str(baseline_b),
        baseline_id="baseline-b",
        summary="Baseline B confirmed.",
        metrics_summary={"acc": 0.86},
        primary_metric={"metric_id": "acc", "value": 0.86},
        metric_contract={"primary_metric_id": "acc", "metrics": [{"metric_id": "acc", "direction": "higher"}]},
    )

    timeline = quest_service.metrics_timeline(quest["quest_id"])
    compare_payload = quest_service.baseline_compare(quest["quest_id"])

    assert timeline["baseline_ref"]["baseline_id"] == "baseline-b"
    assert len(timeline["series"][0]["baselines"]) == 1
    assert compare_payload["total_entries"] == 2
    assert {item["baseline_id"] for item in compare_payload["entries"]} == {"baseline-a", "baseline-b"}
    assert compare_payload["baseline_ref"]["baseline_id"] == "baseline-b"
