from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any


class BaseChannel(ABC):
    name: str = "base"
    display_mode: str = "user_facing_only"

    def __init__(self, home: Path) -> None:
        self.home = home

    @abstractmethod
    def send(self, payload: dict[str, Any]) -> dict[str, Any]:
        raise NotImplementedError

    @abstractmethod
    def poll(self) -> list[dict[str, Any]]:
        raise NotImplementedError

    @abstractmethod
    def status(self) -> dict[str, Any]:
        raise NotImplementedError
