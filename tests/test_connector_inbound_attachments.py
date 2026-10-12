from __future__ import annotations

import time
from pathlib import Path

from deepscientist.config import ConfigManager
from deepscientist.channels.weixin_ilink import WeixinIlinkService
from deepscientist.daemon.app import DaemonApp
from deepscientist.home import ensure_home_layout, repo_root
from deepscientist.quest import QuestService
from deepscientist.shared import read_json
from deepscientist.skills import SkillInstaller


class _FakeResponse:
    def __init__(self, payload: bytes) -> None:
        self._payload = payload
        self._offset = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def read(self, size: int = -1) -> bytes:
        if size is None or size < 0:
            size = len(self._payload) - self._offset
        chunk = self._payload[self._offset : self._offset + size]
        self._offset += len(chunk)
        return chunk


def test_connector_inbound_attachment_is_downloaded_to_userfiles_and_injected_into_message(
    temp_home: Path,
    monkeypatch,
) -> None:
    ensure_home_layout(temp_home)
    ConfigManager(temp_home).ensure_files()
    quest = QuestService(temp_home, skill_installer=SkillInstaller(repo_root(), temp_home)).create(
        "connector attachment quest"
    )
    quest_id = str(quest["quest_id"])
    app = DaemonApp(temp_home)
    conversation_id = "qq:direct:openid-attachment"
    app.channels["qq"].bind_conversation(conversation_id, quest_id)

    monkeypatch.setattr(
        app,
        "schedule_turn",
        lambda *args, **kwargs: {"scheduled": False, "started": False, "queued": False, "reason": "test"},
    )
    monkeypatch.setattr(
        "deepscientist.daemon.app.urlopen",
        lambda request, timeout=20: _FakeResponse(b"fake-image-bytes"),
    )

    app._route_connector_message(
        "qq",
        {
            "conversation_id": conversation_id,
            "chat_type": "direct",
            "sender_id": "openid-attachment",
            "sender_name": "qq-user",
            "message_id": "msg-attachment-001",
            "text": "请看这个图片",
            "attachments": [
                {
                    "name": "figure.png",
                    "content_type": "image/png",
                    "url": "https://example.test/figure.png",
                    "attachment_id": "att-001",
                }
            ],
        },
    )

    history = app.quest_service.history(quest_id, limit=10)
    latest_user = next(item for item in reversed(history) if item.get("role") == "user")
    attachment = dict((latest_user.get("attachments") or [])[0])
    local_path = Path(str(attachment.get("path") or ""))

    assert local_path.exists()
    assert local_path.read_bytes() == b"fake-image-bytes"
    assert "用户刚刚发送了附件" in str(latest_user.get("content") or "")
    assert str(local_path) in str(latest_user.get("content") or "")

    manifest = read_json(local_path.parent / "manifest.json", {})
    assert manifest.get("quest_id") == quest_id
    assert len(manifest.get("attachments") or []) == 1
    assert str((manifest.get("attachments") or [])[0].get("path") or "") == str(local_path)


def test_weixin_media_only_inbound_attachment_is_copied_into_userfiles_and_injected_into_message(
    temp_home: Path,
    monkeypatch,
) -> None:
    ensure_home_layout(temp_home)
    ConfigManager(temp_home).ensure_files()
    quest = QuestService(temp_home, skill_installer=SkillInstaller(repo_root(), temp_home)).create(
        "weixin media attachment quest"
    )
    quest_id = str(quest["quest_id"])
    app = DaemonApp(temp_home)
    conversation_id = "weixin:direct:wx-user-attachment@im.wechat"
    app.channels["weixin"].bind_conversation(conversation_id, quest_id)

    monkeypatch.setattr(
        app,
        "schedule_turn",
        lambda *args, **kwargs: {"scheduled": False, "started": False, "queued": False, "reason": "test"},
    )

    downloaded_media = temp_home / "weixin-downloaded-image.png"
    downloaded_media.write_bytes(b"fake-weixin-image")
    calls = {"count": 0}

    def fake_get_updates(*, base_url, token, get_updates_buf="", route_tag=None, timeout_ms=35_000):  # noqa: ANN001
        calls["count"] += 1
        if calls["count"] == 1:
            return {
                "ret": 0,
                "msgs": [
                    {
                        "from_user_id": "wx-user-attachment@im.wechat",
                        "message_id": 1003,
                        "context_token": "ctx-attachment",
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
                "get_updates_buf": "buf-media-1",
            }
        service.stop()
        return {"ret": 0, "msgs": [], "get_updates_buf": "buf-media-1"}

    monkeypatch.setattr("deepscientist.channels.weixin_ilink.get_weixin_updates", fake_get_updates)
    monkeypatch.setattr(
        "deepscientist.channels.weixin_ilink.download_weixin_message_attachment",
        lambda **kwargs: {
            "kind": "path",
            "name": "from-weixin.png",
            "content_type": "image/png",
            "path": str(downloaded_media),
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
        on_event=lambda event: app.handle_connector_inbound("weixin", event),
    )

    assert service.start() is True
    deadline = time.time() + 3.0
    while time.time() < deadline:
        history = app.quest_service.history(quest_id, limit=10)
        latest_user = next((item for item in reversed(history) if item.get("role") == "user"), None)
        if latest_user and latest_user.get("attachments"):
            break
        time.sleep(0.05)
    service.stop()

    history = app.quest_service.history(quest_id, limit=10)
    latest_user = next(item for item in reversed(history) if item.get("role") == "user")
    attachment = dict((latest_user.get("attachments") or [])[0])
    local_path = Path(str(attachment.get("path") or ""))

    assert local_path.exists()
    assert local_path.read_bytes() == b"fake-weixin-image"
    assert "用户刚刚发送了附件" in str(latest_user.get("content") or "")
    assert str(local_path) in str(latest_user.get("content") or "")

    manifest = read_json(local_path.parent / "manifest.json", {})
    assert manifest.get("quest_id") == quest_id
    assert len(manifest.get("attachments") or []) == 1
    assert str((manifest.get("attachments") or [])[0].get("path") or "") == str(local_path)
