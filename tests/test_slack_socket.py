from __future__ import annotations

from pathlib import Path

from deepscientist.channels.slack_socket import SlackSocketModeService
from deepscientist.config import ConfigManager
from deepscientist.daemon.app import DaemonApp
from deepscientist.home import ensure_home_layout
from deepscientist.shared import read_json, write_yaml


class _FakeConnection:
    def __init__(self) -> None:
        self.sent: list[str] = []

    def send(self, payload: str) -> None:
        self.sent.append(payload)


def test_slack_socket_mode_handles_envelope_and_updates_runtime_status(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    config = manager.load_named("config")
    config["connectors"]["system_enabled"]["slack"] = True
    write_yaml(manager.path_for("config"), config)
    connectors = manager.load_named("connectors")
    connectors["slack"]["enabled"] = True
    connectors["slack"]["transport"] = "socket_mode"
    connectors["slack"]["bot_token"] = "xoxb-token"
    connectors["slack"]["app_token"] = "xapp-token"
    write_yaml(manager.path_for("connectors"), connectors)

    app = DaemonApp(temp_home)
    events: list[dict] = []

    def on_event(event: dict) -> None:
        events.append(dict(event))
        app.handle_connector_inbound("slack", event)

    service = SlackSocketModeService(
        home=temp_home,
        config=connectors["slack"],
        on_event=on_event,
    )
    service._write_state(enabled=True, transport="socket_mode")
    connection = _FakeConnection()

    service._handle_payload({"type": "hello"}, connection=connection, bot_user_id="UBOT")
    service._handle_payload(
        {
            "envelope_id": "env-123",
            "type": "events_api",
            "payload": {
                "event": {
                    "type": "app_mention",
                    "text": "<@UBOT> /help",
                    "user": "U123",
                    "channel": "C456",
                    "channel_type": "channel",
                    "ts": "1710000000.000001",
                }
            },
        },
        connection=connection,
        bot_user_id="UBOT",
    )

    assert connection.sent == ['{"envelope_id": "env-123"}']
    assert events
    assert events[0]["conversation_id"] == "slack:group:C456"
    assert events[0]["text"] == "/help"

    runtime_state = read_json(temp_home / "logs" / "connectors" / "slack" / "runtime.json", {})
    assert runtime_state["connection_state"] == "connected"
    assert runtime_state["auth_state"] == "ready"
    assert runtime_state["last_conversation_id"] == "slack:group:C456"

    connector_statuses = {item["name"]: item for item in app.handlers.connectors()}
    slack_status = connector_statuses["slack"]
    assert slack_status["transport"] == "socket_mode"
    assert slack_status["connection_state"] == "connected"
    assert slack_status["last_conversation_id"] == "slack:group:C456"
