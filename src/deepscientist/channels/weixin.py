from __future__ import annotations

from pathlib import Path
from typing import Any

from ..connector_runtime import parse_conversation_id
from ..bridges import get_connector_bridge
from .relay import GenericRelayChannel


class WeixinRelayChannel(GenericRelayChannel):
    name = "weixin"

    def __init__(self, home: Path, config: dict[str, Any] | None = None) -> None:
        super().__init__(home, "weixin", config)

    def normalize_inbound(self, payload: dict[str, Any]) -> dict[str, Any]:
        normalized = super().normalize_inbound(payload)
        attachments = [dict(item) for item in (payload.get("attachments") or []) if isinstance(item, dict)]
        if not normalized.get("accepted", False):
            if "raw_event" in payload and isinstance(payload.get("raw_event"), dict):
                normalized["raw_event"] = dict(payload["raw_event"])
            if str(payload.get("context_token") or "").strip():
                normalized["context_token"] = str(payload.get("context_token") or "").strip()
            if attachments:
                normalized["attachments"] = attachments
            return normalized
        if "raw_event" in payload and isinstance(payload.get("raw_event"), dict):
            normalized["raw_event"] = dict(payload["raw_event"])
        if str(payload.get("context_token") or "").strip():
            normalized["context_token"] = str(payload.get("context_token") or "").strip()
        if attachments:
            normalized["attachments"] = attachments
        return normalized

    def status(self) -> dict[str, Any]:
        payload = super().status()
        details = dict(payload.get("details") or {})
        details.update(
            {
                "base_url": str(self.config.get("base_url") or "").strip() or None,
                "cdn_base_url": str(self.config.get("cdn_base_url") or "").strip() or None,
                "account_id": str(self.config.get("account_id") or "").strip() or None,
                "login_user_id": str(self.config.get("login_user_id") or "").strip() or None,
            }
        )
        payload["details"] = details
        return payload

    def _deliver(self, record: dict[str, Any]) -> dict[str, Any] | None:
        delivery_config = dict(self.config)
        parsed = parse_conversation_id(record.get("conversation_id"))
        if parsed is not None:
            delivery_config["conversation_id"] = parsed.get("conversation_id")
        delivery_config["_connector_root"] = str(self.root)
        bridge = get_connector_bridge(self.name)
        if bridge is None:
            return None
        return bridge.deliver(record, delivery_config)
