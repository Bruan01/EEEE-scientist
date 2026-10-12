from __future__ import annotations

from pathlib import Path
from typing import Any

from ..shared import append_jsonl, count_jsonl, ensure_dir, read_jsonl, utc_now
from .base import BaseChannel


class LocalChannel(BaseChannel):
    name = "local"
    display_mode = "full_trace"

    def __init__(self, home: Path) -> None:
        super().__init__(home)
        self.root = ensure_dir(home / "logs" / "connectors" / "local")

    def send(self, payload: dict[str, Any]) -> dict[str, Any]:
        record = {"sent_at": utc_now(), **payload}
        append_jsonl(self.root / "outbox.jsonl", record)
        return {"ok": True, "channel": self.name, "payload": record}

    def poll(self) -> list[dict[str, Any]]:
        return read_jsonl(self.root / "inbox.jsonl")

    def status(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "display_mode": self.display_mode,
            "inbox_count": count_jsonl(self.root / "inbox.jsonl"),
            "outbox_count": count_jsonl(self.root / "outbox.jsonl"),
        }
