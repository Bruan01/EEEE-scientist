from __future__ import annotations

from deepscientist.tui import render_tui


def test_render_tui_uses_acp_session_and_events(monkeypatch) -> None:
    responses = {
        "http://0.0.0.0:20999/api/quests": [
            {
                "quest_id": "q-001",
                "title": "ACP quest",
                "status": "running",
                "active_anchor": "decision",
                "branch": "main",
                "artifact_count": 2,
                "history_count": 3,
            }
        ],
        "http://0.0.0.0:20999/api/connectors": [
            {"name": "qq", "display_mode": "user_facing_only", "inbox_count": 1, "outbox_count": 2}
        ],
        "http://0.0.0.0:20999/api/quests/q-001/session": {
            "snapshot": {
                "quest_id": "q-001",
                "quest_root": "/tmp/q-001",
                "runner": "codex",
                "active_anchor": "decision",
                "branch": "main",
                "head": "abc123",
            }
        },
        "http://0.0.0.0:20999/api/quests/q-001/events?format=acp&session_id=quest:q-001&tail=1&limit=12": {
            "cursor": 2,
            "acp_updates": [
                {
                    "params": {
                        "update": {
                            "kind": "message",
                            "created_at": "2026-03-09T00:00:00Z",
                            "message": {
                                "role": "assistant",
                                "source": "codex",
                                "content": "baseline reproduced",
                            },
                        }
                    }
                }
            ],
        },
    }

    def fake_get_json(url: str):
        return responses[url]

    monkeypatch.setattr("deepscientist.tui._get_json", fake_get_json)
    screen, cursor = render_tui("http://0.0.0.0:20999")

    assert "Quest root: /tmp/q-001" in screen
    assert "baseline reproduced" in screen
    assert "qq (user_facing_only)" in screen
    assert cursor == 2


def test_render_tui_shows_latest_bash_exec_tail(monkeypatch) -> None:
    responses = {
        "http://0.0.0.0:20999/api/quests": [
            {
                "quest_id": "q-001",
                "title": "Bash quest",
                "status": "running",
                "active_anchor": "experiment",
                "branch": "main",
                "artifact_count": 2,
                "history_count": 3,
            }
        ],
        "http://0.0.0.0:20999/api/connectors": [],
        "http://0.0.0.0:20999/api/quests/q-001/session": {
            "snapshot": {
                "quest_id": "q-001",
                "quest_root": "/tmp/q-001",
                "runner": "codex",
                "active_anchor": "experiment",
                "branch": "main",
                "head": "abc123",
            }
        },
        "http://0.0.0.0:20999/api/quests/q-001/events?format=acp&session_id=quest:q-001&tail=1&limit=12": {
            "cursor": 5,
            "acp_updates": [
                {
                    "params": {
                        "update": {
                            "event_type": "runner.tool_result",
                            "kind": "event",
                            "data": {
                                "label": "tool_result",
                                "tool_name": "bash_exec.bash_exec",
                                "mcp_server": "bash_exec",
                                "output": {
                                    "bash_id": "bash-001",
                                    "status": "running",
                                },
                            },
                        }
                    }
                }
            ],
        },
        "http://0.0.0.0:20999/api/quests/q-001/bash/sessions/bash-001/logs?limit=6": [
            {"line": "__DS_BASH_STATUS__ status=running bash_id=bash-001"},
            {"line": "alpha"},
            {"line": "__DS_BASH_CR__epoch 1/3"},
            {"line": "omega"},
        ],
    }

    def fake_get_json(url: str):
        return responses[url]

    monkeypatch.setattr("deepscientist.tui._get_json", fake_get_json)
    screen, cursor = render_tui("http://0.0.0.0:20999")

    assert "bash_exec[bash-001] latest output:" in screen
    assert "  | alpha" in screen
    assert "  | epoch 1/3" in screen
    assert "  | omega" in screen
    assert cursor == 5
