#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
import uuid
from datetime import UTC, datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


def _utc_now() -> str:
    return datetime.now(UTC).isoformat()


def _json_dumps(payload: Any) -> str:
    return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def _append_jsonl(path: Path | None, payload: dict[str, Any]) -> None:
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(payload, ensure_ascii=False) + "\n")


def _extract_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        block_type = str(block.get("type") or "")
        if block_type in {"input_text", "output_text", "text"}:
            text = str(block.get("text") or "")
            if text:
                parts.append(text)
    return "\n".join(part for part in parts if part).strip()


def _translate_input(instructions: str | None, items: list[Any] | None) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []
    if instructions:
        messages.append({"role": "system", "content": instructions})
    for item in items or []:
        if not isinstance(item, dict):
            continue
        item_type = str(item.get("type") or "")
        if item_type == "reasoning":
            continue
        if item_type == "message":
            role = str(item.get("role") or "user")
            text = _extract_text(item.get("content"))
            if not text:
                continue
            if role == "developer":
                role = "system"
            messages.append({"role": role, "content": text})
            continue
        if item_type == "function_call":
            name = str(item.get("name") or "").strip()
            call_id = str(item.get("call_id") or f"call_{uuid.uuid4().hex}")
            arguments = str(item.get("arguments") or "")
            if not name:
                continue
            messages.append(
                {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {
                            "id": call_id,
                            "type": "function",
                            "function": {
                                "name": name,
                                "arguments": arguments,
                            },
                        }
                    ],
                }
            )
            continue
        if item_type == "function_call_output":
            call_id = str(item.get("call_id") or "").strip()
            if not call_id:
                continue
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call_id,
                    "content": str(item.get("output") or ""),
                }
            )
    return messages


def _translate_tools(items: list[Any] | None) -> list[dict[str, Any]]:
    translated: list[dict[str, Any]] = []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        if str(item.get("type") or "") != "function":
            continue
        name = str(item.get("name") or "").strip()
        if not name:
            continue
        translated.append(
            {
                "type": "function",
                "function": {
                    "name": name,
                    "description": str(item.get("description") or ""),
                    "parameters": item.get("parameters") or {"type": "object", "properties": {}},
                },
            }
        )
    return translated


def _chunk_text(text: str, *, chunk_size: int = 48) -> list[str]:
    if not text:
        return []
    chunks: list[str] = []
    cursor = 0
    while cursor < len(text):
        chunks.append(text[cursor : cursor + chunk_size])
        cursor += chunk_size
    return chunks


class ResponsesEventBuilder:
    def __init__(self, *, request_body: dict[str, Any]) -> None:
        self.request_body = request_body
        self.sequence = 1
        self.response_id = f"resp_{uuid.uuid4().hex}"
        self.created_at_epoch = int(datetime.now(UTC).timestamp())
        self.output_items: list[dict[str, Any]] = []
        self.events: list[str] = []

    def _next_sequence(self) -> int:
        value = self.sequence
        self.sequence += 1
        return value

    def _emit(self, event_name: str, payload: dict[str, Any]) -> None:
        self.events.append(f"event: {event_name}\ndata: {_json_dumps(payload)}\n\n")

    def start(self) -> None:
        self._emit(
            "response.created",
            {
                "type": "response.created",
                "response": self._response_payload(status="in_progress"),
            },
        )

    def add_message(self, *, text: str, phase: str = "final_answer") -> None:
        if not text:
            return
        item_id = f"msg_{uuid.uuid4().hex}"
        output_index = len(self.output_items)
        item_payload = {
            "id": item_id,
            "type": "message",
            "status": "completed",
            "content": [
                {
                    "type": "output_text",
                    "annotations": [],
                    "logprobs": [],
                    "text": text,
                }
            ],
            "phase": phase,
            "role": "assistant",
        }
        self.output_items.append(item_payload)
        self._emit(
            "response.output_item.added",
            {
                "type": "response.output_item.added",
                "item": {
                    "id": item_id,
                    "type": "message",
                    "status": "in_progress",
                    "content": [],
                    "phase": phase,
                    "role": "assistant",
                },
                "output_index": output_index,
                "sequence_number": self._next_sequence(),
            },
        )
        self._emit(
            "response.content_part.added",
            {
                "type": "response.content_part.added",
                "content_index": 0,
                "item_id": item_id,
                "output_index": output_index,
                "part": {
                    "type": "output_text",
                    "annotations": [],
                    "logprobs": [],
                    "text": "",
                },
                "sequence_number": self._next_sequence(),
            },
        )
        for chunk in _chunk_text(text):
            self._emit(
                "response.output_text.delta",
                {
                    "type": "response.output_text.delta",
                    "content_index": 0,
                    "delta": chunk,
                    "item_id": item_id,
                    "logprobs": [],
                    "output_index": output_index,
                    "sequence_number": self._next_sequence(),
                },
            )
        self._emit(
            "response.output_text.done",
            {
                "type": "response.output_text.done",
                "content_index": 0,
                "item_id": item_id,
                "logprobs": [],
                "output_index": output_index,
                "sequence_number": self._next_sequence(),
                "text": text,
            },
        )
        self._emit(
            "response.content_part.done",
            {
                "type": "response.content_part.done",
                "content_index": 0,
                "item_id": item_id,
                "output_index": output_index,
                "part": {
                    "type": "output_text",
                    "annotations": [],
                    "logprobs": [],
                    "text": text,
                },
                "sequence_number": self._next_sequence(),
            },
        )
        self._emit(
            "response.output_item.done",
            {
                "type": "response.output_item.done",
                "item": item_payload,
                "output_index": output_index,
                "sequence_number": self._next_sequence(),
            },
        )

    def add_function_call(self, *, name: str, call_id: str, arguments: str) -> None:
        item_id = f"fc_{uuid.uuid4().hex}"
        output_index = len(self.output_items)
        item_payload = {
            "id": item_id,
            "type": "function_call",
            "call_id": call_id,
            "name": name,
            "arguments": arguments,
        }
        self.output_items.append(item_payload)
        self._emit(
            "response.output_item.added",
            {
                "type": "response.output_item.added",
                "item": {
                    "id": item_id,
                    "type": "function_call",
                    "call_id": call_id,
                    "name": name,
                    "arguments": "",
                },
                "output_index": output_index,
                "sequence_number": self._next_sequence(),
            },
        )
        for chunk in _chunk_text(arguments, chunk_size=32):
            self._emit(
                "response.function_call_arguments.delta",
                {
                    "type": "response.function_call_arguments.delta",
                    "delta": chunk,
                    "item_id": item_id,
                    "output_index": output_index,
                    "sequence_number": self._next_sequence(),
                },
            )
        self._emit(
            "response.function_call_arguments.done",
            {
                "type": "response.function_call_arguments.done",
                "arguments": arguments,
                "item_id": item_id,
                "output_index": output_index,
                "sequence_number": self._next_sequence(),
            },
        )
        self._emit(
            "response.output_item.done",
            {
                "type": "response.output_item.done",
                "item": item_payload,
                "output_index": output_index,
                "sequence_number": self._next_sequence(),
            },
        )

    def complete(self) -> str:
        self._emit(
            "response.completed",
            {
                "type": "response.completed",
                "response": self._response_payload(status="completed"),
            },
        )
        self.events.append("data: [DONE]\n\n")
        return "".join(self.events)

    def _response_payload(self, *, status: str) -> dict[str, Any]:
        tools = self.request_body.get("tools")
        translated_tools = [
            item
            for item in (tools if isinstance(tools, list) else [])
            if isinstance(item, dict)
        ]
        return {
            "id": self.response_id,
            "object": "response",
            "created_at": self.created_at_epoch,
            "status": status,
            "completed_at": self.created_at_epoch if status == "completed" else None,
            "error": None,
            "instructions": self.request_body.get("instructions"),
            "model": self.request_body.get("model"),
            "output": self.output_items,
            "parallel_tool_calls": bool(self.request_body.get("parallel_tool_calls", True)),
            "previous_response_id": self.request_body.get("previous_response_id"),
            "reasoning": self.request_body.get("reasoning") or {"effort": None, "summary": None},
            "store": bool(self.request_body.get("store", False)),
            "text": self.request_body.get("text") or {"format": {"type": "text"}, "verbosity": "low"},
            "tool_choice": self.request_body.get("tool_choice") or "auto",
            "tools": translated_tools,
            "usage": None,
            "metadata": {},
        }


class ShimConfig:
    def __init__(
        self,
        *,
        upstream_base_url: str,
        api_key: str,
        request_log_path: Path | None,
        response_log_path: Path | None,
    ) -> None:
        self.upstream_base_url = upstream_base_url.rstrip("/")
        self.api_key = api_key
        self.request_log_path = request_log_path
        self.response_log_path = response_log_path


def _call_upstream_chat_completion(config: ShimConfig, body: dict[str, Any]) -> dict[str, Any]:
    messages = _translate_input(
        str(body.get("instructions") or "").strip() or None,
        body.get("input") if isinstance(body.get("input"), list) else None,
    )
    payload: dict[str, Any] = {
        "model": str(body.get("model") or "gpt-5.4"),
        "messages": messages,
        "stream": False,
    }
    tools = _translate_tools(body.get("tools") if isinstance(body.get("tools"), list) else None)
    if tools:
        payload["tools"] = tools
        tool_choice = body.get("tool_choice")
        if isinstance(tool_choice, str) and tool_choice:
            payload["tool_choice"] = tool_choice
    request = Request(
        f"{config.upstream_base_url}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {config.api_key}",
        },
        method="POST",
    )
    with urlopen(request, timeout=300) as response:  # noqa: S310
        return json.loads(response.read().decode("utf-8"))


def _build_sse_response(request_body: dict[str, Any], upstream_payload: dict[str, Any]) -> str:
    builder = ResponsesEventBuilder(request_body=request_body)
    builder.start()
    choices = upstream_payload.get("choices") if isinstance(upstream_payload.get("choices"), list) else []
    message = choices[0].get("message") if choices and isinstance(choices[0], dict) else {}
    if not isinstance(message, dict):
        message = {}
    content = message.get("content")
    if isinstance(content, str) and content.strip():
        builder.add_message(text=content.strip(), phase="final_answer")
    tool_calls = message.get("tool_calls") if isinstance(message.get("tool_calls"), list) else []
    for tool_call in tool_calls:
        if not isinstance(tool_call, dict):
            continue
        function = tool_call.get("function") if isinstance(tool_call.get("function"), dict) else {}
        name = str(function.get("name") or "").strip()
        if not name:
            continue
        builder.add_function_call(
            name=name,
            call_id=str(tool_call.get("id") or f"call_{uuid.uuid4().hex}"),
            arguments=str(function.get("arguments") or ""),
        )
    return builder.complete()


def _write_response_log(path: Path | None, *, request_id: str, payload: str) -> None:
    if path is None:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps({"request_id": request_id, "sse": payload}, ensure_ascii=False))
        handle.write("\n")


class ShimHandler(BaseHTTPRequestHandler):
    server_version = "CodexSglangShim/0.1"

    @property
    def config(self) -> ShimConfig:
        return self.server.config  # type: ignore[attr-defined]

    def do_GET(self) -> None:
        if self.path == "/health":
            body = _json_dumps({"ok": True, "time": _utc_now()}).encode("utf-8")
            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        if self.path != "/v1/responses":
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        request_id = uuid.uuid4().hex
        length = int(self.headers.get("Content-Length") or "0")
        raw_body = self.rfile.read(length)
        try:
            body = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            self._send_error(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "message": "Invalid JSON payload."},
            )
            return
        _append_jsonl(
            self.config.request_log_path,
            {
                "request_id": request_id,
                "received_at": _utc_now(),
                "headers": dict(self.headers),
                "body": body,
            },
        )
        try:
            upstream_payload = _call_upstream_chat_completion(self.config, body)
            sse_payload = _build_sse_response(body, upstream_payload)
        except HTTPError as exc:
            message = exc.read().decode("utf-8", errors="replace")
            _append_jsonl(
                self.config.response_log_path,
                {
                    "request_id": request_id,
                    "received_at": _utc_now(),
                    "upstream_http_error": {
                        "status": exc.code,
                        "message": message,
                    },
                },
            )
            self._send_error(exc.code, {"ok": False, "message": message or str(exc)})
            return
        except URLError as exc:
            self._send_error(HTTPStatus.BAD_GATEWAY, {"ok": False, "message": str(exc)})
            return
        except Exception as exc:  # pragma: no cover - runtime safeguard
            _append_jsonl(
                self.config.response_log_path,
                {
                    "request_id": request_id,
                    "received_at": _utc_now(),
                    "internal_error": str(exc),
                },
            )
            self._send_error(HTTPStatus.INTERNAL_SERVER_ERROR, {"ok": False, "message": str(exc)})
            return

        _write_response_log(self.config.response_log_path, request_id=request_id, payload=sse_payload)
        payload_bytes = sse_payload.encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.send_header("Content-Length", str(len(payload_bytes)))
        self.end_headers()
        self.wfile.write(payload_bytes)

    def _send_error(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        return


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Translate Codex Responses API requests to sglang chat.completions.")
    parser.add_argument("--listen-host", default="127.0.0.1")
    parser.add_argument("--listen-port", type=int, default=18080)
    parser.add_argument("--upstream-base-url", default="http://127.0.0.1:8004/v1")
    parser.add_argument("--api-key", default="1234")
    parser.add_argument("--request-log-path", default=None)
    parser.add_argument("--response-log-path", default=None)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv or sys.argv[1:])
    config = ShimConfig(
        upstream_base_url=str(args.upstream_base_url),
        api_key=str(args.api_key),
        request_log_path=Path(args.request_log_path).expanduser() if args.request_log_path else None,
        response_log_path=Path(args.response_log_path).expanduser() if args.response_log_path else None,
    )
    server = ThreadingHTTPServer((str(args.listen_host), int(args.listen_port)), ShimHandler)
    server.config = config  # type: ignore[attr-defined]
    print(
        json.dumps(
            {
                "ok": True,
                "listen": f"http://{args.listen_host}:{args.listen_port}",
                "upstream": config.upstream_base_url,
                "request_log_path": str(config.request_log_path) if config.request_log_path else None,
                "response_log_path": str(config.response_log_path) if config.response_log_path else None,
            },
            ensure_ascii=False,
        ),
        flush=True,
    )
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        return 0
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
