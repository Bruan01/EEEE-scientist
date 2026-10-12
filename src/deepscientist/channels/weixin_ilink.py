from __future__ import annotations

import threading
import time
from pathlib import Path
from typing import Any, Callable

from ..connector_runtime import format_conversation_id
from ..shared import ensure_dir, read_json, utc_now, write_json
from ..connector.weixin_support import (
    DEFAULT_WEIXIN_LONG_POLL_TIMEOUT_MS,
    SESSION_EXPIRED_ERRCODE,
    download_weixin_message_attachment,
    get_weixin_updates,
    load_weixin_get_updates_buf,
    normalize_weixin_base_url,
    normalize_weixin_cdn_base_url,
    remember_weixin_context_token,
    save_weixin_get_updates_buf,
)

_SESSION_RETRY_INITIAL_SECONDS = 5.0
_SESSION_RETRY_MAX_SECONDS = 60.0
_POLL_RETRY_INITIAL_SECONDS = 2.0
_POLL_RETRY_MAX_SECONDS = 30.0
# Hard ceiling on the long-poll timeout we will accept from the iLink server.
# Without this, a misbehaving server can return an arbitrarily large
# longpolling_timeout_ms, which then becomes the urlopen() timeout for the
# next request — and Python's urllib does not always honour socket timeouts
# during stalled SSL reads, so the polling thread can hang indefinitely and
# block the daemon scheduler that depends on it.
_SERVER_LONG_POLL_CEILING_MS = 60_000


class WeixinIlinkService:
    def __init__(
        self,
        *,
        home: Path,
        config: dict[str, Any],
        on_event: Callable[[dict[str, Any]], None],
        log: Callable[[str, str], None] | None = None,
    ) -> None:
        self.home = home
        self.config = config
        self.on_event = on_event
        self.log = log or self._default_log
        self._thread: threading.Thread | None = None
        self._stop_event = threading.Event()
        self._root = home / "logs" / "connectors" / "weixin"
        self._runtime_path = self._root / "runtime.json"

    def start(self) -> bool:
        enabled = bool(self.config.get("enabled", False))
        transport = str(self.config.get("transport") or "ilink_long_poll").strip().lower()
        token = self._secret("bot_token", "bot_token_env")
        account_id = str(self.config.get("account_id") or "").strip()
        if not enabled:
            self._write_state(
                enabled=False,
                transport="ilink_long_poll",
                connected=False,
                connection_state="disabled",
                auth_state="disabled",
                updated_at=utc_now(),
            )
            return False
        if transport != "ilink_long_poll":
            return False
        if not token or not account_id:
            self._write_state(
                enabled=True,
                transport="ilink_long_poll",
                connected=False,
                connection_state="needs_credentials",
                auth_state="missing_credentials",
                account_id=account_id or None,
                login_user_id=str(self.config.get("login_user_id") or "").strip() or None,
                base_url=normalize_weixin_base_url(self.config.get("base_url")),
                cdn_base_url=normalize_weixin_cdn_base_url(self.config.get("cdn_base_url")),
                updated_at=utc_now(),
            )
            return False
        if self._thread is not None and self._thread.is_alive():
            return True
        self._stop_event.clear()
        self._thread = threading.Thread(
            target=self._run,
            daemon=True,
            name="deepscientist-weixin-ilink",
        )
        self._thread.start()
        return True

    def stop(self, timeout: float = 5.0) -> None:
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=timeout)

    def _run(self) -> None:
        timeout_ms = DEFAULT_WEIXIN_LONG_POLL_TIMEOUT_MS
        retry_until = 0.0
        retry_reason: str | None = None
        sync_buf = load_weixin_get_updates_buf(self._root)
        base_url = normalize_weixin_base_url(self.config.get("base_url"))
        cdn_base_url = normalize_weixin_cdn_base_url(self.config.get("cdn_base_url"))
        account_id = str(self.config.get("account_id") or "").strip()
        login_user_id = str(self.config.get("login_user_id") or "").strip() or None
        token = self._secret("bot_token", "bot_token_env")
        route_tag = str(self.config.get("route_tag") or "").strip() or None
        session_retry_seconds = _SESSION_RETRY_INITIAL_SECONDS
        poll_retry_seconds = _POLL_RETRY_INITIAL_SECONDS
        session_expired_count = 0
        session_expired_since: str | None = None

        self._write_state(
            enabled=True,
            transport="ilink_long_poll",
            connected=False,
            connection_state="starting",
            auth_state="ready",
            account_id=account_id or None,
            login_user_id=login_user_id,
            base_url=base_url,
            cdn_base_url=cdn_base_url,
            retry_reason=None,
            retry_after_seconds=None,
            pause_until=None,
            updated_at=utc_now(),
        )

        while not self._stop_event.is_set():
            now = time.time()
            if retry_until > now:
                retry_after_seconds = max(int(retry_until - now + 0.999), 1)
                state_patch: dict[str, Any] = {
                    "connected": False,
                    "connection_state": "connecting" if retry_reason == "session_expired" else "error",
                    "auth_state": "ready" if token and account_id else "missing_credentials",
                    "retry_reason": retry_reason,
                    "retry_after_seconds": retry_after_seconds,
                    "session_expired_count": session_expired_count or None,
                    "session_expired_since": session_expired_since,
                    "pause_until": None,
                    "updated_at": utc_now(),
                }
                if retry_reason == "session_expired":
                    state_patch["last_error"] = f"session expired ({SESSION_EXPIRED_ERRCODE}); retrying automatically"
                self._write_state(**state_patch)
                self._stop_event.wait(min(max(retry_until - now, 0.5), 5.0))
                continue
            try:
                response = get_weixin_updates(
                    base_url=base_url,
                    token=token,
                    get_updates_buf=sync_buf,
                    route_tag=route_tag,
                    timeout_ms=timeout_ms,
                )
                long_poll_timeout_ms = int(response.get("longpolling_timeout_ms") or 0)
                if long_poll_timeout_ms > 0:
                    timeout_ms = min(long_poll_timeout_ms, _SERVER_LONG_POLL_CEILING_MS)
                errcode = int(response.get("errcode") or 0)
                retcode = int(response.get("ret") or 0)
                if errcode == SESSION_EXPIRED_ERRCODE or retcode == SESSION_EXPIRED_ERRCODE:
                    session_expired_count += 1
                    if session_expired_since is None:
                        session_expired_since = utc_now()
                    if sync_buf:
                        sync_buf = ""
                        save_weixin_get_updates_buf(self._root, "")
                    retry_delay_seconds = session_retry_seconds
                    retry_after_seconds = max(int(retry_delay_seconds + 0.999), 1)
                    session_retry_seconds = min(session_retry_seconds * 2.0, _SESSION_RETRY_MAX_SECONDS)
                    retry_reason = "session_expired"
                    retry_until = time.time() + retry_delay_seconds
                    timeout_ms = DEFAULT_WEIXIN_LONG_POLL_TIMEOUT_MS
                    self.log(
                        "warning",
                        (
                            "weixin.ilink: session expired; cleared sync state and "
                            f"retrying in {retry_after_seconds}s"
                        ),
                    )
                    self._write_state(
                        connected=False,
                        connection_state="connecting",
                        auth_state="ready" if token and account_id else "missing_credentials",
                        last_error=f"session expired ({SESSION_EXPIRED_ERRCODE}); retrying automatically",
                        retry_reason=retry_reason,
                        retry_after_seconds=retry_after_seconds,
                        session_expired_count=session_expired_count,
                        session_expired_since=session_expired_since,
                        pause_until=None,
                        updated_at=utc_now(),
                    )
                    continue
                if errcode or retcode:
                    raise RuntimeError(
                        str(response.get("errmsg") or f"getupdates failed with ret={retcode} errcode={errcode}")
                    )
                next_sync_buf = str(response.get("get_updates_buf") or "").strip()
                if next_sync_buf:
                    sync_buf = next_sync_buf
                    save_weixin_get_updates_buf(self._root, sync_buf)
                if session_expired_count > 0:
                    self.log(
                        "info",
                        f"weixin.ilink: session recovered after {session_expired_count} retry attempt(s)",
                    )
                retry_reason = None
                retry_until = 0.0
                session_retry_seconds = _SESSION_RETRY_INITIAL_SECONDS
                poll_retry_seconds = _POLL_RETRY_INITIAL_SECONDS
                session_expired_count = 0
                session_expired_since = None
                self._write_state(
                    connected=True,
                    connection_state="connected",
                    auth_state="ready",
                    last_error=None,
                    retry_reason=None,
                    retry_after_seconds=None,
                    session_expired_count=None,
                    session_expired_since=None,
                    pause_until=None,
                    updated_at=utc_now(),
                )
                for message in response.get("msgs") or []:
                    if not isinstance(message, dict):
                        continue
                    event = self._normalize_message(message)
                    if event is None:
                        continue
                    self.on_event(event)
                    self._write_state(
                        connected=True,
                        connection_state="connected",
                        auth_state="ready",
                        last_conversation_id=event.get("conversation_id"),
                        last_event_at=utc_now(),
                        updated_at=utc_now(),
                    )
            except Exception as exc:
                if self._stop_event.is_set():
                    break
                retry_reason = "poll_error"
                retry_delay_seconds = poll_retry_seconds
                retry_after_seconds = max(int(retry_delay_seconds + 0.999), 1)
                retry_until = time.time() + retry_delay_seconds
                poll_retry_seconds = min(poll_retry_seconds * 2.0, _POLL_RETRY_MAX_SECONDS)
                self.log(
                    "warning",
                    f"weixin.ilink: polling failed: {exc}; retrying in {retry_after_seconds}s",
                )
                self._write_state(
                    connected=False,
                    connection_state="error",
                    auth_state="ready" if token and account_id else "missing_credentials",
                    last_error=str(exc),
                    retry_reason=retry_reason,
                    retry_after_seconds=retry_after_seconds,
                    session_expired_count=session_expired_count or None,
                    session_expired_since=session_expired_since,
                    pause_until=None,
                    updated_at=utc_now(),
                )
                self._stop_event.wait(retry_delay_seconds)
        self._write_state(
            connected=False,
            connection_state="stopped",
            retry_reason=None,
            retry_after_seconds=None,
            pause_until=None,
            updated_at=utc_now(),
        )

    def _normalize_message(self, payload: dict[str, Any]) -> dict[str, Any] | None:
        sender_id = str(payload.get("from_user_id") or "").strip()
        if not sender_id:
            return None
        text = self._message_text(payload)
        attachments = self._message_attachments(payload)
        context_token = str(payload.get("context_token") or "").strip()
        conversation_id = format_conversation_id("weixin", "direct", sender_id)
        if context_token:
            remember_weixin_context_token(
                self._root,
                user_id=sender_id,
                context_token=context_token,
                account_id=str(self.config.get("account_id") or "").strip() or None,
                conversation_id=conversation_id,
                message_id=str(payload.get("message_id") or payload.get("client_id") or payload.get("seq") or "").strip() or None,
                updated_at=utc_now(),
            )
        if not text and not attachments:
            return None
        return {
            "chat_type": "direct",
            "group_id": "",
            "direct_id": sender_id,
            "sender_id": sender_id,
            "sender_name": sender_id,
            "message_id": str(payload.get("message_id") or payload.get("client_id") or payload.get("seq") or "").strip(),
            "conversation_id": conversation_id,
            "text": text,
            "mentioned": False,
            "attachments": attachments,
            "context_token": context_token or None,
            "raw_event": payload,
        }

    @staticmethod
    def _message_text(payload: dict[str, Any]) -> str:
        for item in payload.get("item_list") or []:
            if not isinstance(item, dict):
                continue
            if int(item.get("type") or 0) == 1:
                text_item = item.get("text_item") if isinstance(item.get("text_item"), dict) else {}
                text = str(text_item.get("text") or "").strip()
                if text:
                    return text
            if int(item.get("type") or 0) == 3:
                voice_item = item.get("voice_item") if isinstance(item.get("voice_item"), dict) else {}
                text = str(voice_item.get("text") or "").strip()
                if text:
                    return text
        return ""

    def _message_attachments(self, payload: dict[str, Any]) -> list[dict[str, Any]]:
        item_list = payload.get("item_list") if isinstance(payload.get("item_list"), list) else []
        message_key = str(payload.get("message_id") or payload.get("client_id") or payload.get("seq") or "").strip() or "weixin"
        dest_dir = ensure_dir(self._root / "tmp" / "inbound")
        attachments: list[dict[str, Any]] = []
        seen_paths: set[str] = set()

        def append_attachment(item: dict[str, Any], *, suffix: str) -> None:
            try:
                attachment = download_weixin_message_attachment(
                    item=item,
                    dest_dir=dest_dir,
                    cdn_base_url=normalize_weixin_cdn_base_url(self.config.get("cdn_base_url")),
                    prefix=f"{message_key}-{suffix}",
                )
            except Exception as exc:
                self.log("warning", f"weixin.ilink: failed to materialize inbound attachment: {exc}")
                return
            if not isinstance(attachment, dict):
                return
            path = str(attachment.get("path") or "").strip()
            if path and path in seen_paths:
                return
            if path:
                seen_paths.add(path)
            attachments.append(attachment)

        for index, item in enumerate(item_list, start=1):
            if not isinstance(item, dict):
                continue
            append_attachment(item, suffix=f"item-{index}")

        if attachments:
            return attachments

        for index, item in enumerate(item_list, start=1):
            if not isinstance(item, dict):
                continue
            ref_message = item.get("ref_msg") if isinstance(item.get("ref_msg"), dict) else {}
            ref_item = ref_message.get("message_item") if isinstance(ref_message.get("message_item"), dict) else None
            if not isinstance(ref_item, dict):
                continue
            append_attachment(ref_item, suffix=f"ref-{index}")
        return attachments

    def _secret(self, key: str, env_key: str) -> str:
        direct = str(self.config.get(key) or "").strip()
        if direct:
            return direct
        env_name = str(self.config.get(env_key) or "").strip()
        if not env_name:
            return ""
        from os import environ

        return str(environ.get(env_name) or "").strip()

    def _write_state(self, **patch: Any) -> None:
        state = read_json(self._runtime_path, {}) or {}
        if not isinstance(state, dict):
            state = {}
        state.update(patch)
        write_json(self._runtime_path, state)

    @staticmethod
    def _default_log(level: str, message: str) -> None:
        print(f"[{level}] {message}")
