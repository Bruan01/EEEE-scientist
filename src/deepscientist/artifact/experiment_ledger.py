"""Pure normalization and aggregation helpers for the experiment ledger.

The ledger is a read model over durable artifact records.  Keeping this module
free of filesystem and service dependencies makes the most important contract
cheap to test and safe to reuse from the API, MCP, and UI projections.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any


_STATUS_ALIASES = {
    "pending": "planned",
    "plan": "planned",
    "planned": "planned",
    "queued": "planned",
    "active": "running",
    "running": "running",
    "in_progress": "running",
    "in-progress": "running",
    "complete": "completed",
    "completed": "completed",
    "success": "completed",
    "passed": "completed",
    "done": "completed",
    "error": "failed",
    "failure": "failed",
    "failed": "failed",
    "blocked": "blocked",
    "warning": "warning",
    "superseded": "superseded",
}

_STATUS_ORDER = (
    "planned",
    "running",
    "completed",
    "failed",
    "blocked",
    "warning",
    "superseded",
)


def _text(value: Any) -> str | None:
    if value is None:
        return None
    normalized = str(value).strip()
    return normalized or None


def _list(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    if not isinstance(value, (list, tuple, set)):
        return []
    return [item.strip() for item in (str(entry) for entry in value) if item.strip()]


def _mapping(value: Any) -> dict[str, Any]:
    return dict(value) if isinstance(value, Mapping) else {}


def _first_text(*values: Any) -> str | None:
    for value in values:
        normalized = _text(value)
        if normalized:
            return normalized
    return None


def normalize_status(value: Any, *, default: str = "planned") -> str:
    normalized = str(value or "").strip().lower().replace(" ", "_")
    return _STATUS_ALIASES.get(normalized, normalized or default)


def _metric_value(metrics_summary: Mapping[str, Any], metric_id: str | None) -> Any:
    if metric_id and metric_id in metrics_summary:
        return metrics_summary.get(metric_id)
    for key, value in metrics_summary.items():
        if str(key).strip():
            return value
    return None


def _primary_metric(payload: Mapping[str, Any], details: Mapping[str, Any], metrics_summary: Mapping[str, Any]) -> dict[str, Any] | None:
    explicit = _mapping(payload.get("primary_metric"))
    progress_eval = _mapping(payload.get("progress_eval"))
    comparisons = _mapping(payload.get("baseline_comparisons"))
    primary_comparison = _mapping(comparisons.get("primary"))
    metric_id = _first_text(
        explicit.get("id"),
        explicit.get("metric_id"),
        payload.get("primary_metric_id"),
        details.get("primary_metric_id"),
        progress_eval.get("primary_metric_id"),
        primary_comparison.get("metric_id"),
    )
    value = explicit.get("value")
    if value is None:
        value = explicit.get("run_value")
    if value is None:
        value = payload.get("primary_value")
    if value is None:
        value = details.get("primary_value")
    if value is None:
        value = progress_eval.get("primary_value")
    if value is None:
        value = primary_comparison.get("run_value")
    if value is None:
        value = _metric_value(metrics_summary, metric_id)

    baseline_value = explicit.get("baseline_value")
    if baseline_value is None:
        baseline_value = payload.get("baseline_value")
    if baseline_value is None:
        baseline_value = details.get("baseline_value")
    if baseline_value is None:
        baseline_value = primary_comparison.get("baseline_value")

    delta = explicit.get("delta_vs_baseline")
    if delta is None:
        delta = explicit.get("delta")
    if delta is None:
        delta = payload.get("delta_vs_baseline")
    if delta is None:
        delta = details.get("delta_vs_baseline")
    if delta is None:
        delta = progress_eval.get("delta_vs_baseline")
    if delta is None:
        delta = primary_comparison.get("delta")

    if not metric_id and value is None and baseline_value is None and delta is None:
        return None
    result: dict[str, Any] = {
        "id": metric_id or "primary",
        "value": value,
    }
    if baseline_value is not None:
        result["baseline_value"] = baseline_value
    if delta is not None:
        result["delta_vs_baseline"] = delta
    direction = _first_text(
        explicit.get("direction"),
        details.get("primary_metric_direction"),
        progress_eval.get("direction"),
        primary_comparison.get("direction"),
    )
    if direction:
        result["direction"] = direction
    return result


def normalize_experiment_payload(
    payload: Mapping[str, Any],
    *,
    artifact_path: str | None = None,
    source_kind: str | None = None,
) -> dict[str, Any]:
    """Convert an explicit experiment or an existing run artifact to one row."""

    raw = dict(payload)
    details = _mapping(raw.get("details"))
    run_context = _mapping(raw.get("run_context"))
    source = _text(source_kind) or _text(raw.get("kind")) or "experiment"
    run_id = _first_text(raw.get("run_id"), details.get("run_id"))
    experiment_id = _first_text(
        raw.get("experiment_id"),
        raw.get("exp_id"),
        raw.get("artifact_id") if source == "experiment" else None,
        run_id,
        raw.get("slice_id"),
        raw.get("artifact_id"),
    ) or "experiment"
    metrics_summary = _mapping(raw.get("metrics_summary"))
    if not metrics_summary:
        metrics_summary = _mapping(details.get("metrics_summary"))
    baseline_ref = _mapping(raw.get("baseline_ref"))
    if not baseline_ref:
        baseline_ref = _mapping(details.get("baseline_ref"))
    if not baseline_ref:
        baseline_id = _first_text(raw.get("baseline_id"), details.get("baseline_id"))
        variant_id = _first_text(raw.get("baseline_variant_id"), details.get("variant_id"))
        if baseline_id or variant_id:
            baseline_ref = {"baseline_id": baseline_id, "variant_id": variant_id}

    configuration = _mapping(raw.get("configuration"))
    if not configuration and isinstance(run_context.get("configuration"), Mapping):
        configuration = _mapping(run_context.get("configuration"))
    config_paths = _list(raw.get("config_paths")) or _list(run_context.get("config_paths"))
    evidence_paths = _list(raw.get("evidence_paths")) or _list(details.get("evidence_paths"))
    changed_files = _list(raw.get("changed_files")) or _list(raw.get("files_changed"))
    if not changed_files:
        changed_files = _list(details.get("changed_files"))
    title = _first_text(raw.get("title"), details.get("title"), raw.get("summary"), experiment_id) or experiment_id
    research_question = _first_text(
        raw.get("research_question"),
        details.get("research_question"),
        raw.get("reviewer_question"),
        raw.get("goal"),
    )
    hypothesis = _first_text(raw.get("hypothesis"), details.get("hypothesis"))
    conclusion = _first_text(
        raw.get("conclusion"),
        raw.get("reason"),
        raw.get("results"),
        raw.get("results_summary"),
        details.get("conclusion"),
    )
    dataset_scope = _first_text(
        raw.get("dataset_scope"),
        run_context.get("dataset_scope"),
        details.get("dataset_scope"),
    )
    primary_metric = _primary_metric(raw, details, metrics_summary)
    row: dict[str, Any] = {
        "experiment_id": experiment_id,
        "run_id": run_id,
        "title": title,
        "status": normalize_status(raw.get("status"), default="completed" if source == "run" else "planned"),
        "source_kind": source,
        "artifact_path": _text(artifact_path) or _text(raw.get("artifact_path")),
        "research_question": research_question,
        "hypothesis": hypothesis,
        "baseline_ref": baseline_ref,
        "dataset_scope": dataset_scope,
        "configuration": configuration,
        "config_paths": config_paths,
        "seed": raw.get("seed", configuration.get("seed")),
        "command": _first_text(raw.get("command"), configuration.get("command")),
        "metrics_summary": metrics_summary,
        "primary_metric": primary_metric,
        "metric_rows": raw.get("metric_rows") if isinstance(raw.get("metric_rows"), list) else [],
        "conclusion": conclusion,
        "verdict": _first_text(raw.get("verdict"), details.get("verdict")),
        "evidence_paths": evidence_paths,
        "changed_files": changed_files,
        "environment": _mapping(raw.get("environment")),
        "replicate_group_id": _first_text(raw.get("replicate_group_id"), details.get("replicate_group_id")),
        "created_at": _first_text(raw.get("created_at")),
        "updated_at": _first_text(raw.get("updated_at"), raw.get("created_at")),
    }
    for key in ("branch", "parent_branch", "campaign_id", "slice_id", "idea_id", "flow_type"):
        value = _first_text(raw.get(key), details.get(key))
        if value:
            row[key] = value
    if raw.get("evaluation_summary") is not None:
        row["evaluation_summary"] = _mapping(raw.get("evaluation_summary"))
    elif details.get("evaluation_summary") is not None:
        row["evaluation_summary"] = _mapping(details.get("evaluation_summary"))
    return row


def _source_priority(item: Mapping[str, Any]) -> int:
    return 2 if str(item.get("source_kind") or "").strip() == "experiment" else 1


def build_experiment_ledger(records: Iterable[Mapping[str, Any]]) -> dict[str, Any]:
    """Build a compact, deduplicated ledger from artifact wrappers or payloads."""

    selected: dict[str, dict[str, Any]] = {}
    for record in records:
        wrapper = dict(record)
        payload = wrapper.get("payload") if isinstance(wrapper.get("payload"), Mapping) else wrapper
        if not isinstance(payload, Mapping):
            continue
        source_kind = _text(wrapper.get("kind")) or _text(payload.get("kind"))
        if source_kind not in {"experiment", "run"}:
            continue
        if source_kind == "run" and _text(payload.get("run_kind")) not in {
            "main_experiment",
            "analysis.slice",
            "analysis_slice",
        }:
            continue
        item = normalize_experiment_payload(
            payload,
            artifact_path=_text(wrapper.get("path")),
            source_kind=source_kind,
        )
        key = str(item.get("experiment_id") or "").strip()
        if not key:
            continue
        existing = selected.get(key)
        if existing is None:
            selected[key] = item
            continue
        existing_rank = (_source_priority(existing), str(existing.get("updated_at") or ""))
        item_rank = (_source_priority(item), str(item.get("updated_at") or ""))
        preferred, fallback = (item, existing) if item_rank >= existing_rank else (existing, item)
        merged = dict(fallback)
        merged.update({key: value for key, value in preferred.items() if value not in (None, "", [], {})})
        selected[key] = merged

    items = sorted(
        selected.values(),
        key=lambda item: (str(item.get("updated_at") or item.get("created_at") or ""), str(item.get("experiment_id") or "")),
        reverse=True,
    )
    counts = {status: 0 for status in _STATUS_ORDER}
    for item in items:
        status = str(item.get("status") or "planned")
        counts.setdefault(status, 0)
        counts[status] += 1
    latest = items[0] if items else None
    return {
        "schema_version": 1,
        "count": len(items),
        "items": items,
        "summary": {
            "total": len(items),
            **counts,
            "latest_experiment_id": latest.get("experiment_id") if latest else None,
            "latest_updated_at": latest.get("updated_at") if latest else None,
        },
    }
