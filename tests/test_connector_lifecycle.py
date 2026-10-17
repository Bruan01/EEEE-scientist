from __future__ import annotations

from deepscientist.daemon.app import DaemonApp


def _snapshot(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": "weixin",
        "enabled": True,
        "connection_state": "connected",
        "auth_state": "ready",
        "binding_count": 0,
        "target_count": 0,
        "bindings": [],
        "discovered_targets": [],
    }
    payload.update(overrides)
    return payload


def test_connector_lifecycle_stops_at_account_connection_until_a_session_is_seen() -> None:
    lifecycle = DaemonApp._connector_lifecycle(_snapshot())

    assert lifecycle["stage"] == "account_connected"
    assert lifecycle["stage_index"] == 1
    assert lifecycle["next_action"] == "discover_session"
    assert [item["status"] for item in lifecycle["steps"]] == ["complete", "current", "pending"]


def test_connector_lifecycle_moves_from_session_discovery_to_project_binding() -> None:
    discovered = DaemonApp._connector_lifecycle(
        _snapshot(
            target_count=1,
            discovered_targets=[{"conversation_id": "weixin:direct:user-1"}],
        )
    )
    assert discovered["stage"] == "session_discovered"
    assert discovered["next_action"] == "bind_project"
    assert [item["status"] for item in discovered["steps"]] == ["complete", "complete", "current"]

    bound = DaemonApp._connector_lifecycle(
        _snapshot(
            target_count=1,
            binding_count=1,
            bindings=[{"conversation_id": "weixin:direct:user-1", "quest_id": "003"}],
        )
    )
    assert bound["stage"] == "project_bound"
    assert bound["stage_index"] == 3
    assert bound["next_action"] is None
    assert [item["status"] for item in bound["steps"]] == ["complete", "complete", "complete"]


def test_connector_lifecycle_explains_disabled_accounts_without_faking_connection() -> None:
    lifecycle = DaemonApp._connector_lifecycle(
        _snapshot(enabled=False, connection_state="disabled", auth_state="disabled")
    )

    assert lifecycle["stage"] is None
    assert lifecycle["stage_index"] == 0
    assert lifecycle["status"] == "blocked"
    assert lifecycle["next_action"] == "connect_account"
    assert lifecycle["steps"][0]["status"] == "blocked"
