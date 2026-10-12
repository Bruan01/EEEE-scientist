from __future__ import annotations

import json
from pathlib import Path

from deepscientist.channels.whatsapp_local_session import WhatsAppLocalSessionService
from deepscientist.config import ConfigManager
from deepscientist.daemon.app import DaemonApp
from deepscientist.home import ensure_home_layout
from deepscientist.shared import read_json, write_yaml


def test_whatsapp_local_session_drains_inbox_and_updates_runtime_state(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    config = manager.load_named("config")
    config["connectors"]["system_enabled"]["whatsapp"] = True
    write_yaml(manager.path_for("config"), config)
    session_dir = temp_home / "whatsapp-session"
    connectors = manager.load_named("connectors")
    connectors["whatsapp"]["enabled"] = True
    connectors["whatsapp"]["transport"] = "local_session"
    connectors["whatsapp"]["session_dir"] = str(session_dir)
    write_yaml(manager.path_for("connectors"), connectors)

    app = DaemonApp(temp_home)

    def on_event(event: dict) -> None:
        app.handle_connector_inbound("whatsapp", event)

    service = WhatsAppLocalSessionService(home=temp_home, config=connectors["whatsapp"], on_event=on_event)
    session_dir.mkdir(parents=True, exist_ok=True)
    (session_dir / "runtime.json").write_text(
        json.dumps({"connected": True, "authenticated": True, "display_name": "DS WA"}, ensure_ascii=False),
        encoding="utf-8",
    )
    (session_dir / "inbox.jsonl").write_text(
        json.dumps({"jid": "15550001111@s.whatsapp.net", "from": "15550001111@s.whatsapp.net", "body": "/help", "id": "wamid-1"}, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    service._sync_runtime(session_dir)
    service._drain_inbox(session_dir)

    runtime_state = read_json(temp_home / "logs" / "connectors" / "whatsapp" / "runtime.json", {})
    assert runtime_state["connection_state"] == "connected"
    assert runtime_state["auth_state"] == "ready"
    assert runtime_state["last_conversation_id"] == "whatsapp:direct:15550001111@s.whatsapp.net"

    connector_statuses = {item["name"]: item for item in app.handlers.connectors()}
    whatsapp_status = connector_statuses["whatsapp"]
    assert whatsapp_status["transport"] == "local_session"
    assert whatsapp_status["connection_state"] == "connected"
    assert whatsapp_status["last_conversation_id"] == "whatsapp:direct:15550001111@s.whatsapp.net"


def test_whatsapp_local_session_delivery_queues_sidecar_outbox(temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    config = manager.load_named("config")
    config["connectors"]["system_enabled"]["whatsapp"] = True
    write_yaml(manager.path_for("config"), config)
    session_dir = temp_home / "whatsapp-session"
    connectors = manager.load_named("connectors")
    connectors["whatsapp"]["enabled"] = True
    connectors["whatsapp"]["transport"] = "local_session"
    connectors["whatsapp"]["session_dir"] = str(session_dir)
    write_yaml(manager.path_for("connectors"), connectors)

    app = DaemonApp(temp_home)
    result = app.channels["whatsapp"].send(
        {
            "conversation_id": "whatsapp:direct:15550001111@s.whatsapp.net",
            "message": "hello from DeepScientist",
        }
    )

    assert result["delivery"]["ok"] is True
    outbox_path = session_dir / "outbox.jsonl"
    assert outbox_path.exists()
    payload = json.loads(outbox_path.read_text(encoding="utf-8").splitlines()[0])
    assert payload["transport"] == "local_session"
    assert payload["payload"]["to"] == "15550001111@s.whatsapp.net"
