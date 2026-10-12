from __future__ import annotations

from pathlib import Path

from deepscientist.channels.telegram_polling import TelegramPollingService
from deepscientist.config import ConfigManager
from deepscientist.daemon import DaemonApp
from deepscientist.home import ensure_home_layout
from deepscientist.shared import read_json, write_yaml


def test_telegram_polling_service_ingests_updates_and_exposes_connected_status(
    temp_home: Path,
    monkeypatch,
) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    config = manager.load_named("config")
    config["connectors"]["system_enabled"]["telegram"] = True
    write_yaml(manager.path_for("config"), config)
    connectors = manager.load_named("connectors")
    connectors["telegram"]["enabled"] = True
    connectors["telegram"]["transport"] = "polling"
    connectors["telegram"]["bot_token"] = "telegram-token"
    connectors["telegram"]["bot_name"] = "DeepScientist"
    write_yaml(manager.path_for("connectors"), connectors)

    app = DaemonApp(temp_home)
    observed_events: list[dict] = []

    def on_event(event: dict) -> None:
        observed_events.append(dict(event))
        app.handle_connector_inbound("telegram", event)

    service = TelegramPollingService(
        home=temp_home,
        config=connectors["telegram"],
        on_event=on_event,
    )

    def fake_bot_api_json(token: str, method: str, *, payload=None, timeout: float = 10.0):  # noqa: ANN001
        assert token == "telegram-token"
        assert timeout > 0
        if method != "getUpdates":
            raise AssertionError(method)
        assert payload["offset"] == 100
        return {
            "ok": True,
            "result": [
                {
                    "update_id": 100,
                    "message": {
                        "message_id": 7,
                        "chat": {"id": 12345, "type": "private"},
                        "from": {"id": 54321, "username": "researcher"},
                        "text": "请总结一下现在的计划。",
                    },
                },
                {
                    "update_id": 101,
                    "message": {
                        "message_id": 8,
                        "chat": {"id": -100001, "type": "supergroup"},
                        "from": {"id": 777, "username": "lead"},
                        "text": "/use@DeepScientist q-demo",
                        "entities": [{"type": "bot_command"}],
                    },
                },
            ],
        }

    monkeypatch.setattr(TelegramPollingService, "_bot_api_json", staticmethod(fake_bot_api_json))

    next_offset = service._poll_once("telegram-token", offset=100)

    assert next_offset == 102
    assert len(observed_events) == 2
    assert observed_events[0]["conversation_id"] == "telegram:direct:12345"
    assert observed_events[1]["conversation_id"] == "telegram:group:-100001"
    assert observed_events[1]["text"] == "/use q-demo"

    runtime_state = read_json(temp_home / "logs" / "connectors" / "telegram" / "runtime.json", {})
    assert runtime_state["connection_state"] == "connected"
    assert runtime_state["auth_state"] == "ready"
    assert runtime_state["update_offset"] == 102
    assert runtime_state["last_conversation_id"] == "telegram:group:-100001"

    connector_statuses = {item["name"]: item for item in app.handlers.connectors()}
    telegram_status = connector_statuses["telegram"]
    assert telegram_status["transport"] == "polling"
    assert telegram_status["connection_state"] == "connected"
    assert telegram_status["auth_state"] == "ready"
    assert telegram_status["last_conversation_id"] == "telegram:group:-100001"
    assert any(item["conversation_id"] == "telegram:group:-100001" for item in telegram_status["discovered_targets"])


def test_connector_settings_save_reloads_telegram_channel_config(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    app = DaemonApp(temp_home)

    structured = manager.load_named("connectors")
    structured["telegram"]["enabled"] = True
    structured["telegram"]["transport"] = "polling"
    structured["telegram"]["bot_token"] = "telegram-token"

    payload = app.handlers.config_save("connectors", {"structured": structured})

    assert payload["ok"] is True
    assert payload["runtime_reload"]["ok"] is True
    channel = app._channel_with_bindings("telegram")
    assert channel.config["enabled"] is True
    assert channel.config["transport"] == "polling"
    assert channel.status()["auth_state"] == "ready"
