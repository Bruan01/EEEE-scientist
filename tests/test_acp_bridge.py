from __future__ import annotations

from deepscientist.acp import OptionalACPBridge, get_acp_bridge_status


def test_acp_bridge_status_is_stable_without_sdk() -> None:
    status = get_acp_bridge_status().as_dict()
    assert "available" in status
    assert status["module_name"] == "acp"

    bridge = OptionalACPBridge()
    if not bridge.is_available():
        assert bridge.build_sdk_notification(
            session_id="quest:q-001",
            event={"type": "conversation.message", "role": "user", "content": "hello"},
        ) is None
