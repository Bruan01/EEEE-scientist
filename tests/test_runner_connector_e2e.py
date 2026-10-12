from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

import pytest

from deepscientist.config import ConfigManager
from deepscientist.daemon.app import DaemonApp
from deepscientist.home import ensure_home_layout
from deepscientist.shared import iter_jsonl, write_yaml


def _write_fake_qq_sitecustomize(support_root: Path) -> None:
    support_root.mkdir(parents=True, exist_ok=True)
    (support_root / "sitecustomize.py").write_text(
        "\n".join(
            [
                "import json",
                "import os",
                "from deepscientist.bridges import connectors as connectors_module",
                "",
                "",
                "class _FakeResponse:",
                "    def __init__(self, payload: str, status: int = 200) -> None:",
                "        self._payload = payload.encode('utf-8')",
                "        self.status = status",
                "",
                "    def read(self) -> bytes:",
                "        return self._payload",
                "",
                "    def __enter__(self):",
                "        return self",
                "",
                "    def __exit__(self, exc_type, exc, tb):",
                "        return False",
                "",
                "",
                "def _append_record(record: dict) -> None:",
                "    capture_path = str(os.environ.get('FAKE_QQ_CAPTURE') or '').strip()",
                "    if not capture_path:",
                "        return",
                "    with open(capture_path, 'a', encoding='utf-8') as handle:",
                "        handle.write(json.dumps(record, ensure_ascii=False) + '\\n')",
                "",
                "",
                "def _fake_urlopen(request, timeout=8):",
                "    url = request.full_url if hasattr(request, 'full_url') else str(request)",
                "    body = {}",
                "    data = getattr(request, 'data', None)",
                "    if data:",
                "        try:",
                "            body = json.loads(data.decode('utf-8'))",
                "        except Exception:",
                "            body = {'raw': data.decode('utf-8', errors='replace')}",
                "    _append_record({'url': url, 'body': body})",
                "    if url == 'https://bots.qq.com/app/getAppAccessToken':",
                "        return _FakeResponse('{\"access_token\":\"qq-access-token\",\"expires_in\":7200}', status=200)",
                "    if url.startswith('https://api.sgroup.qq.com/v2/'):",
                "        return _FakeResponse('{\"id\":\"msg-1\",\"timestamp\":\"1741440000\"}', status=200)",
                "    raise RuntimeError(f'Unexpected QQ url: {url}')",
                "",
                "",
                "connectors_module.urlopen = _fake_urlopen",
                "connectors_module.QQConnectorBridge._token_cache = {}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )


def _install_parent_fake_qq_transport(monkeypatch: pytest.MonkeyPatch, capture_path: Path) -> None:
    from deepscientist.bridges import connectors as connectors_module

    class _FakeResponse:
        def __init__(self, payload: str, status: int = 200) -> None:
            self._payload = payload.encode("utf-8")
            self.status = status

        def read(self) -> bytes:
            return self._payload

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    def fake_urlopen(request, timeout=8):  # noqa: ANN001
        url = request.full_url if hasattr(request, "full_url") else str(request)
        body = {}
        data = getattr(request, "data", None)
        if data:
            try:
                body = json.loads(data.decode("utf-8"))
            except Exception:
                body = {"raw": data.decode("utf-8", errors="replace")}
        with capture_path.open("a", encoding="utf-8") as handle:
            handle.write(json.dumps({"url": url, "body": body}, ensure_ascii=False) + "\n")
        if url == "https://bots.qq.com/app/getAppAccessToken":
            return _FakeResponse('{"access_token":"qq-access-token","expires_in":7200}', status=200)
        if url.startswith("https://api.sgroup.qq.com/v2/"):
            return _FakeResponse('{"id":"msg-1","timestamp":"1741440000"}', status=200)
        raise RuntimeError(f"Unexpected QQ url: {url}")

    connectors_module.QQConnectorBridge._token_cache = {}
    monkeypatch.setattr("deepscientist.bridges.connectors.urlopen", fake_urlopen)


def _write_fake_runner_binary(path: Path, *, protocol: str) -> None:
    path.write_text(
        "\n".join(
            [
                f"#!{sys.executable}",
                "import asyncio",
                "import json",
                "import os",
                "import sys",
                "from pathlib import Path",
                "from mcp.client.session import ClientSession",
                "from mcp.client.stdio import StdioServerParameters, stdio_client",
                "",
                f"PROTOCOL = {protocol!r}",
                "",
                "",
                "def _load_artifact_server():",
                "    if PROTOCOL == 'claude':",
                "        if '--mcp-config' not in sys.argv:",
                "            raise SystemExit('missing --mcp-config')",
                "        if '--allowedTools' not in sys.argv:",
                "            raise SystemExit('missing --allowedTools')",
                "        allowed = {item for item in sys.argv[sys.argv.index('--allowedTools') + 1].split(',') if item}",
                "        if 'mcp__artifact' not in allowed:",
                "            raise SystemExit(f'artifact MCP not allowed: {sorted(allowed)}')",
                "        config_path = Path(sys.argv[sys.argv.index('--mcp-config') + 1])",
                "        payload = json.loads(config_path.read_text(encoding='utf-8'))",
                "        server = dict(payload['mcpServers']['artifact'])",
                "        if server['command'] != sys.executable:",
                "            raise SystemExit(f\"unexpected claude MCP python: {server['command']}\")",
                "        return server['command'], list(server.get('args') or []), dict(server.get('env') or {})",
                "    if PROTOCOL == 'kimi':",
                "        if '--mcp-config-file' not in sys.argv:",
                "            raise SystemExit('missing --mcp-config-file')",
                "        config_path = Path(sys.argv[sys.argv.index('--mcp-config-file') + 1])",
                "        payload = json.loads(config_path.read_text(encoding='utf-8'))",
                "        server = dict(payload['mcpServers']['artifact'])",
                "        if server['command'] != sys.executable:",
                "            raise SystemExit(f\"unexpected kimi MCP python: {server['command']}\")",
                "        return server['command'], list(server.get('args') or []), dict(server.get('env') or {})",
                "    if PROTOCOL == 'opencode':",
                "        config_path = Path(os.environ['XDG_CONFIG_HOME']) / 'opencode' / 'opencode.json'",
                "        payload = json.loads(config_path.read_text(encoding='utf-8'))",
                "        server = dict(payload['mcp']['artifact'])",
                "        command = list(server.get('command') or [])",
                "        if not command:",
                "            raise SystemExit('missing opencode artifact command')",
                "        if command[0] != sys.executable:",
                "            raise SystemExit(f'unexpected opencode MCP python: {command[0]}')",
                "        return command[0], command[1:], dict(server.get('environment') or {})",
                "    raise SystemExit(f'unsupported protocol: {PROTOCOL}')",
                "",
                "",
                "async def _call_interact(tool_args: dict):",
                "    command, args, env = _load_artifact_server()",
                "    params = StdioServerParameters(command=command, args=args, env=env)",
                "    async with stdio_client(params) as (read_stream, write_stream):",
                "        async with ClientSession(read_stream, write_stream) as session:",
                "            await session.initialize()",
                "            result = await session.call_tool('interact', tool_args)",
                "            return result.model_dump(by_alias=True, exclude_none=True)",
                "",
                "",
                "def _emit_events(tool_args: dict, result_payload: dict):",
                "    if PROTOCOL == 'claude':",
                "        print(json.dumps({",
                "            'type': 'assistant',",
                "            'message': {",
                "                'id': 'msg-1',",
                "                'content': [",
                "                    {",
                "                        'type': 'tool_use',",
                "                        'id': 'tool-1',",
                "                        'name': 'mcp__artifact__interact',",
                "                        'input': tool_args,",
                "                    }",
                "                ],",
                "            },",
                "        }))",
                "        print(json.dumps({",
                "            'type': 'user',",
                "            'message': {",
                "                'content': [",
                "                    {",
                "                        'type': 'tool_result',",
                "                        'tool_use_id': 'tool-1',",
                "                        'content': [{'type': 'text', 'text': json.dumps(result_payload, ensure_ascii=False)}],",
                "                    }",
                "                ],",
                "            },",
                "        }))",
                "        return",
                "    if PROTOCOL == 'kimi':",
                "        print(json.dumps({",
                "            'role': 'assistant',",
                "            'content': '',",
                "            'tool_calls': [",
                "                {",
                "                    'id': 'tool-1',",
                "                    'function': {",
                "                        'name': 'mcp__artifact__interact',",
                "                        'arguments': json.dumps(tool_args, ensure_ascii=False),",
                "                    },",
                "                }",
                "            ],",
                "        }))",
                "        print(json.dumps({",
                "            'role': 'tool',",
                "            'tool_call_id': 'tool-1',",
                "            'name': 'mcp__artifact__interact',",
                "            'content': json.dumps(result_payload, ensure_ascii=False),",
                "        }))",
                "        return",
                "    if PROTOCOL == 'opencode':",
                "        print(json.dumps({",
                "            'type': 'tool_use',",
                "            'sessionID': 'ses-1',",
                "            'part': {",
                "                'type': 'tool',",
                "                'tool': 'artifact_interact',",
                "                'callID': 'call-1',",
                "                'messageID': 'msg-1',",
                "                'state': {",
                "                    'status': 'completed',",
                "                    'input': tool_args,",
                "                    'output': json.dumps(result_payload, ensure_ascii=False),",
                "                },",
                "            },",
                "        }))",
                "        return",
                "    raise SystemExit(f'unsupported protocol: {PROTOCOL}')",
                "",
                "",
                "def main() -> int:",
                "    _ = sys.stdin.read()",
                "    tool_args = {",
                "        'kind': 'answer',",
                "        'message': str(os.environ['FAKE_RUNNER_REPLY']),",
                "        'deliver_to_bound_conversations': True,",
                "        'include_recent_inbound_messages': False,",
                "    }",
                "    result_payload = asyncio.run(_call_interact(tool_args))",
                "    _emit_events(tool_args, result_payload)",
                "    return 0",
                "",
                "",
                "if __name__ == '__main__':",
                "    raise SystemExit(main())",
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    path.chmod(0o755)


def _wait_for_condition(predicate, *, timeout_seconds: float = 10.0) -> None:  # noqa: ANN001
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        if predicate():
            return
        time.sleep(0.05)
    raise AssertionError("condition was not satisfied before timeout")


def _capture_records(capture_path: Path) -> list[dict]:
    return list(iter_jsonl(capture_path))


@pytest.mark.parametrize(
    ("runner_name", "protocol"),
    [
        ("claude", "claude"),
        ("kimi", "kimi"),
        ("opencode", "opencode"),
    ],
)
def test_runner_bound_qq_roundtrip_uses_artifact_interact(
    temp_home: Path,
    project_root: Path,
    monkeypatch: pytest.MonkeyPatch,
    runner_name: str,
    protocol: str,
) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()

    support_root = temp_home / "py-support"
    capture_path = temp_home / "qq-capture.jsonl"
    _write_fake_qq_sitecustomize(support_root)
    _install_parent_fake_qq_transport(monkeypatch, capture_path)

    pythonpath_parts = [str(support_root), str(project_root / "src")]
    existing_pythonpath = str(os.environ.get("PYTHONPATH") or "").strip()
    if existing_pythonpath:
        pythonpath_parts.append(existing_pythonpath)
    monkeypatch.setenv("PYTHONPATH", ":".join(pythonpath_parts))
    monkeypatch.setenv("FAKE_QQ_CAPTURE", str(capture_path))

    fake_bin_root = temp_home / "bin"
    fake_bin_root.mkdir(parents=True, exist_ok=True)
    fake_runner = fake_bin_root / runner_name
    _write_fake_runner_binary(fake_runner, protocol=protocol)
    monkeypatch.setenv("FAKE_RUNNER_REPLY", f"{runner_name} reply via artifact.interact")

    config = manager.load_named("config")
    config["default_runner"] = runner_name
    write_yaml(manager.path_for("config"), config)

    connectors = manager.load_named("connectors")
    connectors["qq"]["enabled"] = True
    connectors["qq"]["app_id"] = "1903299925"
    connectors["qq"]["app_secret"] = "qq-secret"
    connectors["_routing"]["artifact_delivery_policy"] = "primary_only"
    write_yaml(manager.path_for("connectors"), connectors)

    runners = manager.load_named("runners")
    runner_cfg = dict(runners[runner_name])
    runner_cfg["enabled"] = True
    runner_cfg["binary"] = str(fake_runner)
    runner_cfg["config_dir"] = str(temp_home / f"{runner_name}-home")
    runners[runner_name] = runner_cfg
    write_yaml(manager.path_for("runners"), runners)

    app = DaemonApp(temp_home)
    quest = app.quest_service.create(f"{runner_name} qq e2e quest")
    quest_id = str(quest["quest_id"])
    conversation_id = "qq:direct:runner-qq-e2e"
    bind_result = app.update_quest_binding(quest_id, conversation_id, force=True)
    assert not isinstance(bind_result, tuple)

    inbound = app.handle_qq_inbound(
        {
            "chat_type": "direct",
            "sender_id": "runner-qq-e2e",
            "sender_name": "Runner QQ",
            "message_id": "msg-inbound-001",
            "text": "请通过 artifact.interact 给我回一条消息。",
        }
    )

    assert inbound["accepted"] is True
    assert any(
        "已经成功收到消息" in str((item.get("body") or {}).get("content") or "")
        for item in _capture_records(capture_path)
    )

    expected_reply = f"{runner_name} reply via artifact.interact"
    outbox_path = temp_home / "logs" / "connectors" / "qq" / "outbox.jsonl"
    events_path = Path(quest["quest_root"]) / ".ds" / "events.jsonl"

    def has_runner_reply() -> bool:
        outbox_ready = any(str(item.get("text") or "") == expected_reply for item in iter_jsonl(outbox_path))
        if not outbox_ready:
            return False
        return any(
            str(item.get("type") or "") == "runner.tool_result"
            and str(item.get("mcp_server") or "") == "artifact"
            and str(item.get("mcp_tool") or "") == "interact"
            for item in iter_jsonl(events_path)
        )

    _wait_for_condition(has_runner_reply)

    events = list(iter_jsonl(events_path))
    assert any(
        str(item.get("type") or "") == "runner.tool_call"
        and str(item.get("mcp_server") or "") == "artifact"
        and str(item.get("mcp_tool") or "") == "interact"
        for item in events
    )
    assert any(
        str(item.get("type") or "") == "runner.tool_result"
        and str(item.get("mcp_server") or "") == "artifact"
        and str(item.get("mcp_tool") or "") == "interact"
        for item in events
    )
    assert any(
        str(item.get("type") or "") == "connector.outbound"
        and str(item.get("channel") or "") == "qq"
        and str(item.get("kind") or "") == "answer"
        for item in events
    )

    outbox = list(iter_jsonl(outbox_path))
    assert any(str(item.get("text") or "") == expected_reply for item in outbox)
    app.stop_quest(quest_id, source="test")
