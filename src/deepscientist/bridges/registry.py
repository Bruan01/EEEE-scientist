from __future__ import annotations

from collections.abc import Callable

from .base import BaseConnectorBridge


BridgeFactory = Callable[[], BaseConnectorBridge]

_REGISTRY: dict[str, BridgeFactory] = {}


def register_connector_bridge(name: str, factory: BridgeFactory) -> None:
    _REGISTRY[name] = factory


def get_connector_bridge(name: str) -> BaseConnectorBridge | None:
    factory = _REGISTRY.get(name)
    if factory is None:
        return None
    return factory()


def list_connector_bridge_names() -> list[str]:
    return sorted(_REGISTRY.keys())
