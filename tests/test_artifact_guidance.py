from __future__ import annotations

from deepscientist.artifact.guidance import build_guidance_for_record
from deepscientist.artifact.schemas import validate_artifact_payload


def test_main_run_guidance_prefers_iteration_when_paper_disabled() -> None:
    guidance = build_guidance_for_record(
        {
            "kind": "run",
            "run_kind": "main_experiment",
            "delivery_policy": {
                "need_research_paper": False,
                "recommended_next_route": "iterate",
            },
            "paths": {
                "run_md": "experiments/main/run-001/RUN.md",
                "result_json": "experiments/main/run-001/RESULT.json",
            },
        }
    )

    assert guidance["recommended_skill"] == "decision"
    assert guidance["recommended_action"] == "continue"
    assert any(route["action"] == "iterate" for route in guidance["alternative_routes"])
    assert all(route["action"] != "write" for route in guidance["alternative_routes"])


def test_idea_submission_guidance_routes_directly_to_experiment() -> None:
    guidance = build_guidance_for_record(
        {
            "kind": "idea",
            "flow_type": "idea_submission",
            "protocol_step": "create",
            "paths": {"idea_md": "memory/ideas/idea-001/idea.md"},
        }
    )

    assert guidance["recommended_skill"] == "experiment"
    assert guidance["recommended_action"] == "launch_experiment"


def test_decision_guidance_supports_iterate_action() -> None:
    guidance = build_guidance_for_record(
        {
            "kind": "decision",
            "action": "iterate",
            "reason": "Use the latest strong result to start the next optimization round.",
            "paths": {},
        }
    )

    assert guidance["recommended_skill"] == "idea"
    assert guidance["recommended_action"] == "iterate"
    assert any("lineage_intent='continue_line'" in item["name"] for item in guidance["suggested_artifact_calls"])


def test_decision_schema_accepts_iterate_action() -> None:
    errors = validate_artifact_payload(
        {
            "kind": "decision",
            "verdict": "good",
            "action": "iterate",
            "reason": "Continue optimization from the latest measured result.",
        }
    )

    assert errors == []
