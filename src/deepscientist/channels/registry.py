from __future__ import annotations

import re
from typing import Callable


ChannelFactory = Callable[..., object]
_CHANNEL_FACTORIES: dict[str, ChannelFactory] = {}
_CHANNEL_NAME_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]*$")


def _normalize_channel_name(name: str) -> str:
    normalized = str(name or "").strip().lower()
    if not normalized or not _CHANNEL_NAME_PATTERN.fullmatch(normalized):
        raise ValueError(
            "Channel name must match `^[a-z0-9][a-z0-9_-]*$`."
        )
    return normalized


def register_channel(name: str, factory: ChannelFactory) -> None:
    _CHANNEL_FACTORIES[_normalize_channel_name(name)] = factory


def get_channel_factory(name: str) -> ChannelFactory:
    normalized = _normalize_channel_name(name)
    try:
        return _CHANNEL_FACTORIES[normalized]
    except KeyError as exc:
        available = ", ".join(sorted(_CHANNEL_FACTORIES)) or "none"
        raise KeyError(f"Unknown channel `{normalized}`. Available channels: {available}.") from exc


def list_channel_names() -> list[str]:
    return sorted(_CHANNEL_FACTORIES)
