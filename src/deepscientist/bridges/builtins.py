from __future__ import annotations

from .connectors import (
    DiscordConnectorBridge,
    FeishuConnectorBridge,
    QQConnectorBridge,
    SlackConnectorBridge,
    TelegramConnectorBridge,
    WeixinConnectorBridge,
    WhatsAppConnectorBridge,
)
from .registry import register_connector_bridge


def register_builtin_connector_bridges() -> None:
    register_connector_bridge("qq", QQConnectorBridge)
    register_connector_bridge("weixin", WeixinConnectorBridge)
    register_connector_bridge("telegram", TelegramConnectorBridge)
    register_connector_bridge("discord", DiscordConnectorBridge)
    register_connector_bridge("slack", SlackConnectorBridge)
    register_connector_bridge("feishu", FeishuConnectorBridge)
    register_connector_bridge("whatsapp", WhatsAppConnectorBridge)
