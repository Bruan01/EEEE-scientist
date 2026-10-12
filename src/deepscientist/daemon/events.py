from __future__ import annotations

from ..shared import generate_id, utc_now


def build_event(event_type: str, *, quest_id: str | None = None, payload: dict | None = None) -> dict:
    return {
        "event_id": generate_id("evt"),
        "event_type": event_type,
        "quest_id": quest_id,
        "created_at": utc_now(),
        "payload": payload or {},
    }
