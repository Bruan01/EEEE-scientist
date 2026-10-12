from __future__ import annotations

import base64
import time
from pathlib import Path

import pytest

from deepscientist.channels.weixin_ilink import WeixinIlinkService
from deepscientist.home import ensure_home_layout
from deepscientist.shared import ensure_dir, read_json
from deepscientist.connector.weixin_support import (
    get_weixin_context_token,
    get_weixin_updates,
    load_weixin_get_updates_buf,
    save_weixin_get_updates_buf,
    send_weixin_message,
    upload_local_media_to_weixin,
)


def test_weixin_ilink_service_polls_updates_and_persists_context_token(
    temp_home: Path,
    monkeypatch,
) -> None:
    ensure_home_layout(temp_home)
    events: list[dict] = []
    calls = {"count": 0}

    def fake_get_updates(*, base_url, token, get_updates_buf="", route_tag=None, timeout_ms=35_000):  # noqa: ANN001
        calls["count"] += 1
        if calls["count"] == 1:
            return {
                "ret": 0,
                "msgs": [
                    {
                        "from_user_id": "wx-user-1@im.wechat",
                        "message_id": 1001,
                        "context_token": "ctx-token-1",
                        "item_list": [
                            {
                                "type": 1,
                                "text_item": {"text": "hello from weixin"},
                            }
                        ],
                    }
                ],
                "get_updates_buf": "buf-1",
            }
        service.stop()
        return {"ret": 0, "msgs": [], "get_updates_buf": "buf-1"}

    monkeypatch.setattr("deepscientist.channels.weixin_ilink.get_weixin_updates", fake_get_updates)

    service = WeixinIlinkService(
        home=temp_home,
        config={
            "enabled": True,
            "transport": "ilink_long_poll",
            "bot_token": "wx-bot-token",
            "account_id": "wx-bot-1@im.bot",
            "base_url": "https://ilinkai.weixin.qq.com",
            "cdn_base_url": "https://novac2c.cdn.weixin.qq.com/c2c",
        },
        on_event=lambda event: events.append(event),
    )

    assert service.start() is True
    deadline = time.time() + 3.0
    while time.time() < deadline and not events:
        time.sleep(0.05)
    service.stop()

    assert events
    assert events[0]["conversation_id"] == "weixin:direct:wx-user-1@im.wechat"
    assert events[0]["text"] == "hello from weixin"
    connector_root = ensure_dir(temp_home / "logs" / "connectors" / "weixin")
    assert get_weixin_context_token(connector_root, "wx-user-1@im.wechat") == "ctx-token-1"
    assert load_weixin_get_updates_buf(connector_root) == "buf-1"


def test_weixin_ilink_service_emits_media_only_messages_as_attachments(
    temp_home: Path,
    monkeypatch,
) -> None:
    ensure_home_layout(temp_home)
    events: list[dict] = []
    media_path = temp_home / "downloaded-weixin-image.png"
    media_path.write_bytes(b"fake-png")
    calls = {"count": 0}

    def fake_get_updates(*, base_url, token, get_updates_buf="", route_tag=None, timeout_ms=35_000):  # noqa: ANN001
        calls["count"] += 1
        if calls["count"] == 1:
            return {
                "ret": 0,
                "msgs": [
                    {
                        "from_user_id": "wx-user-2@im.wechat",
                        "message_id": 1002,
                        "context_token": "ctx-token-2",
                        "item_list": [
                            {
                                "type": 2,
                                "image_item": {
                                    "media": {
                                        "encrypt_query_param": "enc-param",
                                        "aes_key": "YWJjZGVmZ2hpamtsbW5vcA==",
                                    }
                                },
                            }
                        ],
                    }
                ],
                "get_updates_buf": "buf-2",
            }
        service.stop()
        return {"ret": 0, "msgs": [], "get_updates_buf": "buf-2"}

    monkeypatch.setattr("deepscientist.channels.weixin_ilink.get_weixin_updates", fake_get_updates)
    monkeypatch.setattr(
        "deepscientist.channels.weixin_ilink.download_weixin_message_attachment",
        lambda **kwargs: {
            "kind": "path",
            "name": "weixin-image.png",
            "content_type": "image/png",
            "path": str(media_path),
        },
    )

    service = WeixinIlinkService(
        home=temp_home,
        config={
            "enabled": True,
            "transport": "ilink_long_poll",
            "bot_token": "wx-bot-token",
            "account_id": "wx-bot-1@im.bot",
            "base_url": "https://ilinkai.weixin.qq.com",
            "cdn_base_url": "https://novac2c.cdn.weixin.qq.com/c2c",
        },
        on_event=lambda event: events.append(event),
    )

    assert service.start() is True
    deadline = time.time() + 3.0
    while time.time() < deadline and not events:
        time.sleep(0.05)
    service.stop()

    assert events
    assert events[0]["conversation_id"] == "weixin:direct:wx-user-2@im.wechat"
    assert events[0]["text"] == ""
    assert (events[0].get("attachments") or [])[0]["path"] == str(media_path)


def test_weixin_ilink_service_retries_session_expiry_without_hour_pause(
    temp_home: Path,
    monkeypatch,
) -> None:
    ensure_home_layout(temp_home)
    events: list[dict] = []
    logs: list[tuple[str, str]] = []
    get_updates_buf_calls: list[str] = []
    connector_root = ensure_dir(temp_home / "logs" / "connectors" / "weixin")
    save_weixin_get_updates_buf(connector_root, "stale-buf")
    calls = {"count": 0}

    monkeypatch.setattr("deepscientist.channels.weixin_ilink._SESSION_RETRY_INITIAL_SECONDS", 0.01)
    monkeypatch.setattr("deepscientist.channels.weixin_ilink._SESSION_RETRY_MAX_SECONDS", 0.01)

    def fake_get_updates(*, base_url, token, get_updates_buf="", route_tag=None, timeout_ms=35_000):  # noqa: ANN001
        get_updates_buf_calls.append(get_updates_buf)
        calls["count"] += 1
        if calls["count"] == 1:
            return {
                "ret": 0,
                "errcode": -14,
                "errmsg": "session expired",
                "msgs": [],
                "get_updates_buf": get_updates_buf,
            }
        if calls["count"] == 2:
            return {
                "ret": 0,
                "msgs": [
                    {
                        "from_user_id": "wx-user-recovered@im.wechat",
                        "message_id": 2001,
                        "context_token": "ctx-recovered-1",
                        "item_list": [
                            {
                                "type": 1,
                                "text_item": {"text": "session recovered"},
                            }
                        ],
                    }
                ],
                "get_updates_buf": "buf-recovered",
            }
        service.stop()
        return {"ret": 0, "msgs": [], "get_updates_buf": "buf-recovered"}

    monkeypatch.setattr("deepscientist.channels.weixin_ilink.get_weixin_updates", fake_get_updates)

    service = WeixinIlinkService(
        home=temp_home,
        config={
            "enabled": True,
            "transport": "ilink_long_poll",
            "bot_token": "wx-bot-token",
            "account_id": "wx-bot-1@im.bot",
            "base_url": "https://ilinkai.weixin.qq.com",
            "cdn_base_url": "https://novac2c.cdn.weixin.qq.com/c2c",
        },
        on_event=lambda event: events.append(event),
        log=lambda level, message: logs.append((level, message)),
    )

    assert service.start() is True
    deadline = time.time() + 3.0
    while time.time() < deadline and not events:
        time.sleep(0.05)
    service.stop()

    assert events
    assert events[0]["text"] == "session recovered"
    assert get_updates_buf_calls[:2] == ["stale-buf", ""]
    assert load_weixin_get_updates_buf(connector_root) == "buf-recovered"
    state = read_json(connector_root / "runtime.json", {})
    assert state["connection_state"] in {"connected", "stopped"}
    assert state["pause_until"] is None
    assert state["retry_reason"] is None
    assert any("retrying" in message for _, message in logs)
    assert all("one hour" not in message for _, message in logs)


def test_upload_local_media_to_weixin_encodes_aes_key_like_openclaw(
    temp_home: Path,
    monkeypatch,
) -> None:
    ensure_home_layout(temp_home)
    payload_path = temp_home / "payload.bin"
    payload_path.write_bytes(b"hello-weixin")

    monkeypatch.setattr(
        "deepscientist.connector.weixin_support.get_weixin_upload_url",
        lambda **kwargs: {"upload_param": "upload-param-1"},
    )
    monkeypatch.setattr(
        "deepscientist.connector.weixin_support.upload_buffer_to_weixin_cdn",
        lambda **kwargs: {"download_param": "download-param-1", "ciphertext_size": 32},
    )

    random_values = iter([b"\x01" * 16, b"\x02" * 16])
    monkeypatch.setattr(
        "deepscientist.connector.weixin_support.os.urandom",
        lambda size: next(random_values),
    )

    uploaded = upload_local_media_to_weixin(
        file_path=payload_path,
        to_user_id="wx-user-3@im.wechat",
        base_url="https://ilinkai.weixin.qq.com",
        cdn_base_url="https://novac2c.cdn.weixin.qq.com/c2c",
        token="wx-token",
        media_type=1,
    )

    expected_hex = "02" * 16
    expected_b64 = base64.b64encode(expected_hex.encode("ascii")).decode("ascii")

    assert uploaded["aes_key_hex"] == expected_hex
    assert uploaded["aes_key_base64"] == expected_b64


def test_send_weixin_message_raises_on_nonzero_ret(monkeypatch) -> None:
    import httpx as _httpx

    def _fake_request(self, method, url, **kwargs):  # noqa: ANN001
        return _httpx.Response(200, text='{"ret":-2,"errmsg":"context invalid"}')

    monkeypatch.setattr("httpx.Client.request", _fake_request)

    with pytest.raises(RuntimeError, match="ret=-2"):
        send_weixin_message(
            base_url="https://ilinkai.weixin.qq.com",
            token="wx-token",
            body={"msg": {"to_user_id": "wx-user-1@im.wechat", "item_list": [{"type": 1, "text_item": {"text": "hello"}}]}},
        )


def test_weixin_ilink_caps_server_controlled_long_poll_timeout(
    temp_home: Path,
    monkeypatch,
) -> None:
    ensure_home_layout(temp_home)
    events: list[dict] = []
    timeouts_seen: list[int] = []

    def fake_get_updates(*, base_url, token, get_updates_buf="", route_tag=None, timeout_ms=35_000):  # noqa: ANN001
        timeouts_seen.append(timeout_ms)
        if len(timeouts_seen) == 1:
            # Server returns an absurdly large long-poll timeout (1 hour).
            return {
                "ret": 0,
                "msgs": [],
                "get_updates_buf": "buf-cap",
                "longpolling_timeout_ms": 3_600_000,
            }
        service.stop()
        return {"ret": 0, "msgs": [], "get_updates_buf": "buf-cap"}

    monkeypatch.setattr("deepscientist.channels.weixin_ilink.get_weixin_updates", fake_get_updates)

    service = WeixinIlinkService(
        home=temp_home,
        config={
            "enabled": True,
            "transport": "ilink_long_poll",
            "bot_token": "wx-bot-token",
            "account_id": "wx-bot-1@im.bot",
            "base_url": "https://ilinkai.weixin.qq.com",
            "cdn_base_url": "https://novac2c.cdn.weixin.qq.com/c2c",
        },
        on_event=lambda event: events.append(event),
    )

    assert service.start() is True
    deadline = time.time() + 3.0
    while time.time() < deadline and len(timeouts_seen) < 2:
        time.sleep(0.05)
    service.stop()

    assert len(timeouts_seen) >= 2
    # First call uses the default long-poll timeout (35s); second call must
    # not adopt the server's 1-hour value, but be capped to the 60s ceiling.
    assert timeouts_seen[1] == 60_000


def test_get_weixin_updates_treats_timeout_as_empty_poll(monkeypatch) -> None:
    import httpx as _httpx

    def _raise_timeout(self, method, url, **kwargs):  # noqa: ANN001
        raise _httpx.ReadTimeout("timed out")

    monkeypatch.setattr("httpx.Client.request", _raise_timeout)

    response = get_weixin_updates(
        base_url="https://ilinkai.weixin.qq.com",
        token="wx-token",
        get_updates_buf="buf-123",
        timeout_ms=5000,
    )

    assert response == {"ret": 0, "msgs": [], "get_updates_buf": "buf-123"}
