from __future__ import annotations

import base64
import hashlib
import json
import mimetypes
import os
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.parse import quote, urlparse
from urllib.request import Request

import httpx

from .. import __version__ as DEEPSCIENTIST_VERSION
from ..network import urlopen_with_proxy as urlopen
from ..shared import ensure_dir, read_json, utc_now, write_json

DEFAULT_WEIXIN_BASE_URL = "https://ilinkai.weixin.qq.com"
DEFAULT_WEIXIN_CDN_BASE_URL = "https://novac2c.cdn.weixin.qq.com/c2c"
DEFAULT_WEIXIN_BOT_TYPE = "3"
DEFAULT_WEIXIN_LONG_POLL_TIMEOUT_MS = 35_000
DEFAULT_WEIXIN_API_TIMEOUT_MS = 15_000
DEFAULT_WEIXIN_INBOUND_MEDIA_MAX_BYTES = 25 * 1024 * 1024
DEFAULT_WEIXIN_REMOTE_ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024
SESSION_EXPIRED_ERRCODE = -14

WEIXIN_UPLOAD_MEDIA_IMAGE = 1
WEIXIN_UPLOAD_MEDIA_VIDEO = 2
WEIXIN_UPLOAD_MEDIA_FILE = 3


def weixin_base_info() -> dict[str, Any]:
    return {"channel_version": DEEPSCIENTIST_VERSION}


def normalize_weixin_base_url(value: Any, *, default: str = DEFAULT_WEIXIN_BASE_URL) -> str:
    text = str(value or "").strip()
    if not text:
        return default
    return text.rstrip("/")


def normalize_weixin_cdn_base_url(value: Any, *, default: str = DEFAULT_WEIXIN_CDN_BASE_URL) -> str:
    text = str(value or "").strip()
    if not text:
        return default
    return text.rstrip("/")


def _random_wechat_uin() -> str:
    value = int.from_bytes(os.urandom(4), "big", signed=False)
    return base64.b64encode(str(value).encode("utf-8")).decode("ascii")


def _build_weixin_headers(
    *,
    body_present: bool,
    token: str | None,
    extra: dict[str, str] | None,
) -> dict[str, str]:
    out: dict[str, str] = {"iLink-App-ClientVersion": "1"}
    if body_present:
        out["Content-Type"] = "application/json"
        out["AuthorizationType"] = "ilink_bot_token"
        out["X-WECHAT-UIN"] = _random_wechat_uin()
    if token:
        out["Authorization"] = f"Bearer {token}"
    for key, value in (extra or {}).items():
        if value:
            out[key] = value
    return out


def _json_request(
    url: str,
    *,
    method: str,
    body: dict[str, Any] | None = None,
    token: str | None = None,
    timeout: float = DEFAULT_WEIXIN_API_TIMEOUT_MS / 1000.0,
    headers: dict[str, str] | None = None,
) -> dict[str, Any]:
    raw = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
    request_headers = _build_weixin_headers(body_present=raw is not None, token=token, extra=headers)
    # httpx.Timeout exposes per-phase timeouts; `read` is the inactivity
    # timeout — the critical defense against stalled SSL reads behind an
    # HTTP CONNECT proxy tunnel, which urllib's urlopen does not reliably
    # honour and which has been observed to hang the polling thread (and
    # therefore the daemon scheduler) indefinitely.
    total_timeout = max(float(timeout), 1.0)
    timeout_obj = httpx.Timeout(
        connect=min(total_timeout, 10.0),
        read=total_timeout,
        write=min(total_timeout, 10.0),
        pool=min(total_timeout, 10.0),
    )
    try:
        with httpx.Client(timeout=timeout_obj, trust_env=True, follow_redirects=False) as client:
            response = client.request(
                method.upper(),
                url,
                content=raw,
                headers=request_headers,
            )
    except httpx.TimeoutException as exc:
        # Translate to TimeoutError so existing _is_weixin_timeout_error keeps working.
        raise TimeoutError(f"Weixin request timed out: {exc}") from exc
    if response.status_code >= 400:
        body_text = response.text or ""
        raise RuntimeError(f"Weixin HTTP {response.status_code}: {body_text or response.reason_phrase}")
    payload = response.text
    if not payload.strip():
        return {}
    try:
        parsed = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Weixin returned invalid JSON: {payload[:200]}") from exc
    if not isinstance(parsed, dict):
        raise RuntimeError("Weixin returned a non-object JSON payload.")
    return parsed


def _is_weixin_timeout_error(exc: Exception) -> bool:
    if isinstance(exc, TimeoutError):
        return True
    message = str(exc or "").strip().lower()
    return "timed out" in message or "timeout" in message


def _raise_for_weixin_api_error(payload: dict[str, Any], *, endpoint: str) -> None:
    ret = int(payload.get("ret") or 0)
    errcode = int(payload.get("errcode") or 0)
    if ret == 0 and errcode == 0:
        return
    errmsg = str(payload.get("errmsg") or payload.get("message") or "").strip()
    detail = f": {errmsg}" if errmsg else ""
    raise RuntimeError(f"Weixin {endpoint} failed with ret={ret} errcode={errcode}{detail}")


def fetch_weixin_qrcode(
    *,
    base_url: str,
    bot_type: str = DEFAULT_WEIXIN_BOT_TYPE,
    route_tag: str | None = None,
    timeout: float = DEFAULT_WEIXIN_API_TIMEOUT_MS / 1000.0,
) -> dict[str, Any]:
    normalized_base_url = normalize_weixin_base_url(base_url)
    encoded_bot_type = quote(str(bot_type or DEFAULT_WEIXIN_BOT_TYPE), safe="")
    return _json_request(
        f"{normalized_base_url}/ilink/bot/get_bot_qrcode?bot_type={encoded_bot_type}",
        method="GET",
        timeout=timeout,
        headers={"SKRouteTag": str(route_tag or "").strip()},
    )


def poll_weixin_qrcode_status(
    *,
    base_url: str,
    qrcode: str,
    route_tag: str | None = None,
    timeout: float = DEFAULT_WEIXIN_LONG_POLL_TIMEOUT_MS / 1000.0,
) -> dict[str, Any]:
    normalized_base_url = normalize_weixin_base_url(base_url)
    encoded_qrcode = quote(str(qrcode or "").strip(), safe="")
    return _json_request(
        f"{normalized_base_url}/ilink/bot/get_qrcode_status?qrcode={encoded_qrcode}",
        method="GET",
        timeout=timeout,
        headers={"SKRouteTag": str(route_tag or "").strip()},
    )


def get_weixin_updates(
    *,
    base_url: str,
    token: str,
    get_updates_buf: str = "",
    route_tag: str | None = None,
    timeout_ms: int = DEFAULT_WEIXIN_LONG_POLL_TIMEOUT_MS,
) -> dict[str, Any]:
    normalized_base_url = normalize_weixin_base_url(base_url)
    payload = {
        "get_updates_buf": str(get_updates_buf or ""),
        "base_info": weixin_base_info(),
    }
    try:
        return _json_request(
            f"{normalized_base_url}/ilink/bot/getupdates",
            method="POST",
            body=payload,
            token=str(token or "").strip(),
            timeout=max(float(timeout_ms) / 1000.0, 1.0),
            headers={"SKRouteTag": str(route_tag or "").strip()},
        )
    except Exception as exc:
        if _is_weixin_timeout_error(exc):
            return {
                "ret": 0,
                "msgs": [],
                "get_updates_buf": str(get_updates_buf or ""),
            }
        raise


def send_weixin_message(
    *,
    base_url: str,
    token: str,
    body: dict[str, Any],
    route_tag: str | None = None,
    timeout_ms: int = DEFAULT_WEIXIN_API_TIMEOUT_MS,
) -> dict[str, Any]:
    normalized_base_url = normalize_weixin_base_url(base_url)
    payload = {**body, "base_info": weixin_base_info()}
    response = _json_request(
        f"{normalized_base_url}/ilink/bot/sendmessage",
        method="POST",
        body=payload,
        token=str(token or "").strip(),
        timeout=max(float(timeout_ms) / 1000.0, 1.0),
        headers={"SKRouteTag": str(route_tag or "").strip()},
    )
    _raise_for_weixin_api_error(response, endpoint="sendmessage")
    return response


def get_weixin_upload_url(
    *,
    base_url: str,
    token: str,
    body: dict[str, Any],
    route_tag: str | None = None,
    timeout_ms: int = DEFAULT_WEIXIN_API_TIMEOUT_MS,
) -> dict[str, Any]:
    normalized_base_url = normalize_weixin_base_url(base_url)
    payload = {**body, "base_info": weixin_base_info()}
    response = _json_request(
        f"{normalized_base_url}/ilink/bot/getuploadurl",
        method="POST",
        body=payload,
        token=str(token or "").strip(),
        timeout=max(float(timeout_ms) / 1000.0, 1.0),
        headers={"SKRouteTag": str(route_tag or "").strip()},
    )
    _raise_for_weixin_api_error(response, endpoint="getuploadurl")
    return response


def _load_aes_helpers() -> tuple[Any, Any]:
    try:
        from cryptography.hazmat.primitives import padding
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

        def encrypt(plaintext: bytes, key: bytes) -> bytes:
            padder = padding.PKCS7(128).padder()
            padded = padder.update(plaintext) + padder.finalize()
            cipher = Cipher(algorithms.AES(key), modes.ECB())
            encryptor = cipher.encryptor()
            return encryptor.update(padded) + encryptor.finalize()

        def decrypt(ciphertext: bytes, key: bytes) -> bytes:
            cipher = Cipher(algorithms.AES(key), modes.ECB())
            decryptor = cipher.decryptor()
            padded = decryptor.update(ciphertext) + decryptor.finalize()
            unpadder = padding.PKCS7(128).unpadder()
            return unpadder.update(padded) + unpadder.finalize()

        return encrypt, decrypt
    except Exception:  # pragma: no cover - fallback path
        from Crypto.Cipher import AES
        from Crypto.Util.Padding import pad, unpad

        def encrypt(plaintext: bytes, key: bytes) -> bytes:
            return AES.new(key, AES.MODE_ECB).encrypt(pad(plaintext, 16))

        def decrypt(ciphertext: bytes, key: bytes) -> bytes:
            return unpad(AES.new(key, AES.MODE_ECB).decrypt(ciphertext), 16)

        return encrypt, decrypt


_AES_ENCRYPT, _AES_DECRYPT = _load_aes_helpers()


def encrypt_weixin_aes_ecb(plaintext: bytes, key: bytes) -> bytes:
    return _AES_ENCRYPT(plaintext, key)


def decrypt_weixin_aes_ecb(ciphertext: bytes, key: bytes) -> bytes:
    return _AES_DECRYPT(ciphertext, key)


def weixin_aes_ecb_padded_size(plaintext_size: int) -> int:
    return ((int(plaintext_size) // 16) + 1) * 16


def build_weixin_cdn_upload_url(*, cdn_base_url: str, upload_param: str, filekey: str) -> str:
    normalized_cdn_base_url = normalize_weixin_cdn_base_url(cdn_base_url)
    return (
        f"{normalized_cdn_base_url}/upload"
        f"?encrypted_query_param={quote(str(upload_param or ''), safe='')}"
        f"&filekey={quote(str(filekey or ''), safe='')}"
    )


def build_weixin_cdn_download_url(*, cdn_base_url: str, encrypted_query_param: str) -> str:
    normalized_cdn_base_url = normalize_weixin_cdn_base_url(cdn_base_url)
    return (
        f"{normalized_cdn_base_url}/download"
        f"?encrypted_query_param={quote(str(encrypted_query_param or ''), safe='')}"
    )


def _read_bounded_response_bytes(response: Any, *, max_bytes: int) -> bytes:
    payload = bytearray()
    while True:
        chunk = response.read(65536)
        if not chunk:
            break
        payload.extend(chunk)
        if len(payload) > max_bytes:
            raise RuntimeError(f"Weixin media exceeds max size limit ({max_bytes} bytes).")
    return bytes(payload)


def _parse_weixin_aes_key(value: str) -> bytes:
    normalized = str(value or "").strip()
    if not normalized:
        raise RuntimeError("Weixin media did not include `aes_key`.")
    if len(normalized) == 32 and all(char in "0123456789abcdefABCDEF" for char in normalized):
        return bytes.fromhex(normalized)
    decoded = base64.b64decode(normalized)
    if len(decoded) == 16:
        return decoded
    if len(decoded) == 32:
        decoded_text = decoded.decode("ascii", errors="ignore")
        if len(decoded_text) == 32 and all(char in "0123456789abcdefABCDEF" for char in decoded_text):
            return bytes.fromhex(decoded_text)
    raise RuntimeError("Weixin media `aes_key` uses an unsupported encoding.")


def download_weixin_cdn_buffer(
    *,
    encrypted_query_param: str,
    cdn_base_url: str,
    timeout: float = 20.0,
    max_bytes: int = DEFAULT_WEIXIN_INBOUND_MEDIA_MAX_BYTES,
) -> bytes:
    request = Request(
        build_weixin_cdn_download_url(
            cdn_base_url=cdn_base_url,
            encrypted_query_param=encrypted_query_param,
        ),
        method="GET",
    )
    try:
        with urlopen(request, timeout=timeout) as response:  # noqa: S310
            return _read_bounded_response_bytes(response, max_bytes=max_bytes)
    except HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Weixin CDN download failed with HTTP {exc.code}: {body_text or exc.reason}") from exc


def download_and_decrypt_weixin_media(
    *,
    encrypted_query_param: str,
    aes_key: str,
    cdn_base_url: str,
    timeout: float = 20.0,
    max_bytes: int = DEFAULT_WEIXIN_INBOUND_MEDIA_MAX_BYTES,
) -> bytes:
    encrypted = download_weixin_cdn_buffer(
        encrypted_query_param=encrypted_query_param,
        cdn_base_url=cdn_base_url,
        timeout=timeout,
        max_bytes=max_bytes,
    )
    return decrypt_weixin_aes_ecb(encrypted, _parse_weixin_aes_key(aes_key))


def sniff_weixin_media_content_type(buffer: bytes, *, fallback: str = "application/octet-stream") -> str:
    if buffer.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if buffer.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if buffer.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if len(buffer) >= 12 and buffer[:4] == b"RIFF" and buffer[8:12] == b"WEBP":
        return "image/webp"
    if buffer.startswith(b"BM"):
        return "image/bmp"
    if buffer.startswith(b"%PDF-"):
        return "application/pdf"
    if len(buffer) >= 12 and buffer[4:8] == b"ftyp":
        brand = buffer[8:12]
        if brand == b"qt  ":
            return "video/quicktime"
        return "video/mp4"
    return fallback


def _weixin_attachment_suffix(content_type: str) -> str:
    normalized = str(content_type or "").strip().lower()
    if normalized == "image/jpeg":
        return ".jpg"
    return mimetypes.guess_extension(normalized, strict=False) or ".bin"


def download_weixin_message_attachment(
    *,
    item: dict[str, Any],
    dest_dir: Path,
    cdn_base_url: str,
    prefix: str = "weixin-inbound",
    timeout: float = 20.0,
    max_bytes: int = DEFAULT_WEIXIN_INBOUND_MEDIA_MAX_BYTES,
) -> dict[str, Any] | None:
    item_type = int(item.get("type") or 0)
    ensure_dir(dest_dir)

    if item_type == 2:
        image_item = item.get("image_item") if isinstance(item.get("image_item"), dict) else {}
        media = image_item.get("media") if isinstance(image_item.get("media"), dict) else {}
        encrypted_query_param = str(media.get("encrypt_query_param") or "").strip()
        aes_key = str(image_item.get("aeskey") or media.get("aes_key") or "").strip()
        if not encrypted_query_param:
            return None
        payload = (
            download_and_decrypt_weixin_media(
                encrypted_query_param=encrypted_query_param,
                aes_key=aes_key,
                cdn_base_url=cdn_base_url,
                timeout=timeout,
                max_bytes=max_bytes,
            )
            if aes_key
            else download_weixin_cdn_buffer(
                encrypted_query_param=encrypted_query_param,
                cdn_base_url=cdn_base_url,
                timeout=timeout,
                max_bytes=max_bytes,
            )
        )
        content_type = sniff_weixin_media_content_type(payload, fallback="application/octet-stream")
        suffix = _weixin_attachment_suffix(content_type)
        name = f"{prefix}-image{suffix}"
        target = dest_dir / f"{prefix}-{os.urandom(8).hex()}{suffix}"
        target.write_bytes(payload)
        return {
            "kind": "path",
            "name": name,
            "content_type": content_type,
            "path": str(target),
        }

    if item_type == 4:
        file_item = item.get("file_item") if isinstance(item.get("file_item"), dict) else {}
        media = file_item.get("media") if isinstance(file_item.get("media"), dict) else {}
        encrypted_query_param = str(media.get("encrypt_query_param") or "").strip()
        aes_key = str(media.get("aes_key") or "").strip()
        if not encrypted_query_param or not aes_key:
            return None
        payload = download_and_decrypt_weixin_media(
            encrypted_query_param=encrypted_query_param,
            aes_key=aes_key,
            cdn_base_url=cdn_base_url,
            timeout=timeout,
            max_bytes=max_bytes,
        )
        raw_name = str(file_item.get("file_name") or "").strip()
        content_type = (
            str(mimetypes.guess_type(raw_name, strict=False)[0] or "").strip().lower()
            or sniff_weixin_media_content_type(payload, fallback="application/octet-stream")
        )
        suffix = Path(raw_name).suffix or _weixin_attachment_suffix(content_type)
        name = raw_name or f"{prefix}-file{suffix}"
        target = dest_dir / f"{prefix}-{os.urandom(8).hex()}{suffix or '.bin'}"
        target.write_bytes(payload)
        return {
            "kind": "path",
            "name": name,
            "content_type": content_type,
            "path": str(target),
        }

    if item_type == 5:
        video_item = item.get("video_item") if isinstance(item.get("video_item"), dict) else {}
        media = video_item.get("media") if isinstance(video_item.get("media"), dict) else {}
        encrypted_query_param = str(media.get("encrypt_query_param") or "").strip()
        aes_key = str(media.get("aes_key") or "").strip()
        if not encrypted_query_param or not aes_key:
            return None
        payload = download_and_decrypt_weixin_media(
            encrypted_query_param=encrypted_query_param,
            aes_key=aes_key,
            cdn_base_url=cdn_base_url,
            timeout=timeout,
            max_bytes=max_bytes,
        )
        content_type = sniff_weixin_media_content_type(payload, fallback="video/mp4")
        suffix = _weixin_attachment_suffix(content_type)
        name = f"{prefix}-video{suffix}"
        target = dest_dir / f"{prefix}-{os.urandom(8).hex()}{suffix}"
        target.write_bytes(payload)
        return {
            "kind": "path",
            "name": name,
            "content_type": content_type,
            "path": str(target),
        }

    return None


def upload_buffer_to_weixin_cdn(
    *,
    buffer: bytes,
    upload_param: str,
    filekey: str,
    cdn_base_url: str,
    aes_key: bytes,
    timeout: float = DEFAULT_WEIXIN_API_TIMEOUT_MS / 1000.0,
) -> dict[str, Any]:
    ciphertext = encrypt_weixin_aes_ecb(buffer, aes_key)
    request = Request(
        build_weixin_cdn_upload_url(cdn_base_url=cdn_base_url, upload_param=upload_param, filekey=filekey),
        data=ciphertext,
        method="POST",
    )
    request.add_header("Content-Type", "application/octet-stream")
    try:
        with urlopen(request, timeout=timeout) as response:  # noqa: S310
            download_param = str(response.headers.get("x-encrypted-param") or "").strip()
            if not download_param:
                raise RuntimeError("Weixin CDN upload returned no `x-encrypted-param` header.")
            return {
                "download_param": download_param,
                "ciphertext_size": len(ciphertext),
            }
    except HTTPError as exc:
        body_text = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Weixin CDN upload failed with HTTP {exc.code}: {body_text or exc.reason}") from exc


def upload_local_media_to_weixin(
    *,
    file_path: Path,
    to_user_id: str,
    base_url: str,
    cdn_base_url: str,
    token: str,
    media_type: int,
    route_tag: str | None = None,
    timeout_ms: int = DEFAULT_WEIXIN_API_TIMEOUT_MS,
) -> dict[str, Any]:
    plaintext = file_path.read_bytes()
    raw_size = len(plaintext)
    raw_md5 = hashlib.md5(plaintext).hexdigest()
    file_size = weixin_aes_ecb_padded_size(raw_size)
    filekey = os.urandom(16).hex()
    aes_key = os.urandom(16)
    upload_url_response = get_weixin_upload_url(
        base_url=base_url,
        token=token,
        route_tag=route_tag,
        timeout_ms=timeout_ms,
        body={
            "filekey": filekey,
            "media_type": int(media_type),
            "to_user_id": str(to_user_id or "").strip(),
            "rawsize": raw_size,
            "rawfilemd5": raw_md5,
            "filesize": file_size,
            "no_need_thumb": True,
            "aeskey": aes_key.hex(),
        },
    )
    upload_param = str(upload_url_response.get("upload_param") or "").strip()
    if not upload_param:
        raise RuntimeError("Weixin upload URL response did not include `upload_param`.")
    cdn_upload = upload_buffer_to_weixin_cdn(
        buffer=plaintext,
        upload_param=upload_param,
        filekey=filekey,
        cdn_base_url=cdn_base_url,
        aes_key=aes_key,
        timeout=max(float(timeout_ms) / 1000.0, 1.0),
    )
    return {
        "filekey": filekey,
        "download_param": str(cdn_upload.get("download_param") or "").strip(),
        "aes_key_hex": aes_key.hex(),
        # Match openclaw-weixin: media.aes_key is base64 of the hex string, not base64 of raw bytes.
        "aes_key_base64": base64.b64encode(aes_key.hex().encode("ascii")).decode("ascii"),
        "file_size": raw_size,
        "ciphertext_size": int(cdn_upload.get("ciphertext_size") or file_size),
    }


def download_weixin_remote_attachment(
    *,
    url: str,
    dest_dir: Path,
    prefix: str = "weixin-remote",
    timeout: float = 20.0,
    max_bytes: int = DEFAULT_WEIXIN_REMOTE_ATTACHMENT_MAX_BYTES,
) -> Path:
    ensure_dir(dest_dir)
    raw_url = str(url or "").strip()
    parsed_url = urlparse(raw_url)
    if parsed_url.scheme.lower() not in {"http", "https"}:
        raise RuntimeError("Weixin remote attachments only support `http` or `https` URLs.")
    request = Request(raw_url, method="GET")
    with urlopen(request, timeout=timeout) as response:  # noqa: S310
        payload = _read_bounded_response_bytes(response, max_bytes=max_bytes)
        content_type = str(response.headers.get("Content-Type") or "").split(";", 1)[0].strip().lower()
    suffix = Path(parsed_url.path).suffix
    if not suffix and content_type:
        guessed = mimetypes.guess_extension(content_type)
        suffix = guessed or ""
    target = dest_dir / f"{prefix}-{os.urandom(8).hex()}{suffix}"
    target.write_bytes(payload)
    return target


def weixin_context_tokens_path(root: Path) -> Path:
    return ensure_dir(root) / "context_tokens.json"


def load_weixin_context_tokens(root: Path) -> dict[str, dict[str, Any]]:
    payload = read_json(weixin_context_tokens_path(root), {})
    if not isinstance(payload, dict):
        return {}
    tokens = payload.get("tokens")
    return {str(key): dict(value) for key, value in (tokens or {}).items() if isinstance(value, dict)} if isinstance(tokens, dict) else {}


def save_weixin_context_tokens(root: Path, items: dict[str, dict[str, Any]]) -> None:
    write_json(weixin_context_tokens_path(root), {"tokens": items})


def _weixin_replay_cursor(value: Any) -> int:
    try:
        return max(0, int(value or 0))
    except (TypeError, ValueError):
        return 0


def get_weixin_context_entry(root: Path, user_id: str) -> dict[str, Any]:
    normalized_user_id = str(user_id or "").strip()
    if not normalized_user_id:
        return {}
    items = load_weixin_context_tokens(root)
    current = items.get(normalized_user_id)
    return dict(current) if isinstance(current, dict) else {}


def remember_weixin_context_token(
    root: Path,
    *,
    user_id: str,
    context_token: str,
    account_id: str | None = None,
    conversation_id: str | None = None,
    message_id: str | None = None,
    updated_at: str | None = None,
) -> None:
    normalized_user_id = str(user_id or "").strip()
    normalized_context_token = str(context_token or "").strip()
    if not normalized_user_id or not normalized_context_token:
        return
    items = load_weixin_context_tokens(root)
    current = items.get(normalized_user_id, {})
    items[normalized_user_id] = {
        **current,
        "user_id": normalized_user_id,
        "context_token": normalized_context_token,
        "account_id": str(account_id or current.get("account_id") or "").strip() or None,
        "conversation_id": str(conversation_id or current.get("conversation_id") or "").strip() or None,
        "message_id": str(message_id or current.get("message_id") or "").strip() or None,
        "updated_at": str(updated_at or current.get("updated_at") or "").strip() or None,
        "stale_context": False,
        "stale_since": None,
        "last_ret_minus_2_at": None,
        "last_outbound_error": None,
        "last_outbound_kind": None,
        "queued_replay_cursor": _weixin_replay_cursor(current.get("queued_replay_cursor")),
        "last_replay_at": str(current.get("last_replay_at") or "").strip() or None,
        "last_replay_trigger_message_id": str(current.get("last_replay_trigger_message_id") or "").strip() or None,
        "last_replayed_count": _weixin_replay_cursor(current.get("last_replayed_count")) or None,
        "last_replay_dropped_count": _weixin_replay_cursor(current.get("last_replay_dropped_count")) or None,
    }
    save_weixin_context_tokens(root, items)


def get_weixin_context_token(root: Path, user_id: str) -> str | None:
    normalized_user_id = str(user_id or "").strip()
    if not normalized_user_id:
        return None
    items = load_weixin_context_tokens(root)
    token = str((items.get(normalized_user_id) or {}).get("context_token") or "").strip()
    return token or None


def get_weixin_replay_cursor(root: Path, user_id: str) -> int:
    entry = get_weixin_context_entry(root, user_id)
    return _weixin_replay_cursor(entry.get("queued_replay_cursor"))


def update_weixin_replay_cursor(
    root: Path,
    *,
    user_id: str,
    queued_replay_cursor: int,
    last_replay_at: str | None = None,
    last_replay_trigger_message_id: str | None = None,
    last_replayed_count: int | None = None,
    last_replay_dropped_count: int | None = None,
) -> dict[str, Any]:
    normalized_user_id = str(user_id or "").strip()
    if not normalized_user_id:
        return {}
    items = load_weixin_context_tokens(root)
    current = dict(items.get(normalized_user_id) or {})
    current.update(
        {
            "user_id": normalized_user_id,
            "queued_replay_cursor": _weixin_replay_cursor(queued_replay_cursor),
            "last_replay_at": str(last_replay_at or utc_now()).strip() or utc_now(),
            "last_replay_trigger_message_id": str(last_replay_trigger_message_id or "").strip() or None,
            "last_replayed_count": _weixin_replay_cursor(last_replayed_count) if last_replayed_count is not None else None,
            "last_replay_dropped_count": _weixin_replay_cursor(last_replay_dropped_count)
            if last_replay_dropped_count is not None
            else None,
        }
    )
    items[normalized_user_id] = current
    save_weixin_context_tokens(root, items)
    return current


def mark_weixin_context_stale(
    root: Path,
    *,
    user_id: str,
    error: str,
    kind: str | None = None,
    updated_at: str | None = None,
) -> dict[str, Any]:
    normalized_user_id = str(user_id or "").strip()
    if not normalized_user_id:
        return {}
    timestamp = str(updated_at or utc_now()).strip() or utc_now()
    items = load_weixin_context_tokens(root)
    current = dict(items.get(normalized_user_id) or {})
    current.update(
        {
            "user_id": normalized_user_id,
            "stale_context": True,
            "stale_since": str(current.get("stale_since") or "").strip() or timestamp,
            "last_ret_minus_2_at": timestamp,
            "last_outbound_error": str(error or "").strip() or None,
            "last_outbound_kind": str(kind or "").strip() or None,
        }
    )
    items[normalized_user_id] = current
    save_weixin_context_tokens(root, items)
    return current


def clear_weixin_context_send_state(
    root: Path,
    *,
    user_id: str,
    kind: str | None = None,
    updated_at: str | None = None,
) -> dict[str, Any]:
    normalized_user_id = str(user_id or "").strip()
    if not normalized_user_id:
        return {}
    timestamp = str(updated_at or utc_now()).strip() or utc_now()
    items = load_weixin_context_tokens(root)
    current = dict(items.get(normalized_user_id) or {})
    current.update(
        {
            "user_id": normalized_user_id,
            "stale_context": False,
            "stale_since": None,
            "last_ret_minus_2_at": None,
            "last_outbound_error": None,
            "last_outbound_kind": str(kind or "").strip() or None,
            "last_success_at": timestamp,
        }
    )
    items[normalized_user_id] = current
    save_weixin_context_tokens(root, items)
    return current


def weixin_sync_state_path(root: Path) -> Path:
    return ensure_dir(root) / "sync_state.json"


def load_weixin_get_updates_buf(root: Path) -> str:
    payload = read_json(weixin_sync_state_path(root), {})
    if not isinstance(payload, dict):
        return ""
    return str(payload.get("get_updates_buf") or "").strip()


def save_weixin_get_updates_buf(root: Path, get_updates_buf: str) -> None:
    write_json(weixin_sync_state_path(root), {"get_updates_buf": str(get_updates_buf or "")})
