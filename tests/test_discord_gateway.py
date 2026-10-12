from __future__ import annotations

import json
from pathlib import Path

from deepscientist.channels.discord_gateway import DISCORD_GATEWAY_INTENTS, DiscordGatewayService
from deepscientist.config import ConfigManager
from deepscientist.daemon.app import DaemonApp
from deepscientist.home import ensure_home_layout
from deepscientist.shared import read_json, write_yaml


class _FakeConnection:
    def __init__(self) -> None:
        self.sent: list[dict] = []

    def send(self, payload: str) -> None:
        self.sent.append(json.loads(payload))


def test_discord_gateway_identify_and_message_normalization(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    config = manager.load_named("config")
    config["connectors"]["system_enabled"]["discord"] = True
    write_yaml(manager.path_for("config"), config)
    connectors = manager.load_named("connectors")
    connectors["discord"]["enabled"] = True
    connectors["discord"]["transport"] = "gateway"
    connectors["discord"]["bot_token"] = "discord-token"
    write_yaml(manager.path_for("connectors"), connectors)

    app = DaemonApp(temp_home)
    events: list[dict] = []

    def on_event(event: dict) -> None:
        events.append(dict(event))
        app.handle_connector_inbound("discord", event)

    service = DiscordGatewayService(
        home=temp_home,
        config=connectors["discord"],
        on_event=on_event,
    )
    connection = _FakeConnection()

    service._send_handshake(connection, "discord-token")
    assert connection.sent[0]["op"] == 2
    assert connection.sent[0]["d"]["token"] == "discord-token"
    assert connection.sent[0]["d"]["intents"] == DISCORD_GATEWAY_INTENTS
    assert connection.sent[0]["d"]["properties"]["browser"] == "deepscientist"
    assert connection.sent[0]["d"]["properties"]["device"] == "deepscientist"

    service._write_state(enabled=True, transport="gateway")
    service._handle_payload({"op": 0, "t": "READY", "d": {"session_id": "discord-session", "user": {"id": "BOT-1", "username": "DeepScientist"}}})
    service._handle_payload(
        {
            "op": 0,
            "s": 3,
            "t": "MESSAGE_CREATE",
            "d": {
                "id": "msg-1",
                "channel_id": "D-123",
                "content": "<@BOT-1> /help",
                "author": {"id": "USER-1", "username": "researcher"},
                "mentions": [{"id": "BOT-1"}],
            },
        }
    )

    assert service._session_id == "discord-session"
    assert events
    assert events[0]["conversation_id"] == "discord:direct:D-123"
    assert events[0]["text"] == "/help"

    runtime_state = read_json(temp_home / "logs" / "connectors" / "discord" / "runtime.json", {})
    assert runtime_state["session_id"] == "discord-session"
    assert runtime_state["connection_state"] == "connected"
    assert runtime_state["last_conversation_id"] == "discord:direct:D-123"

    connector_statuses = {item["name"]: item for item in app.handlers.connectors()}
    discord_status = connector_statuses["discord"]
    assert discord_status["transport"] == "gateway"
    assert discord_status["connection_state"] == "connected"
    assert discord_status["last_conversation_id"] == "discord:direct:D-123"
