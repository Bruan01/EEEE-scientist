from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def parse_launcher_args(*args: str) -> dict:
    script = """
const launcher = require('./bin/ds.js').__internal;
const parsed = launcher.parseLauncherArgs(process.argv.slice(1));
console.log(JSON.stringify(parsed));
"""
    result = subprocess.run(
        ["node", "-e", script, "--", *args],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return json.loads(result.stdout)


def test_launcher_accepts_tui_debug_flags() -> None:
    parsed = parse_launcher_args(
        "--tui",
        "--debug",
        "--debug-log",
        "/tmp/deepscientist_tui_debug_test.jsonl",
    )

    assert parsed["mode"] == "tui"
    assert parsed["tuiDebug"] is True
    assert parsed["tuiDebugLogPath"] == "/tmp/deepscientist_tui_debug_test.jsonl"
    assert parsed["error"] is None


def test_launcher_debug_log_implies_tui_debug() -> None:
    parsed = parse_launcher_args("--both", "--debug-log", "/tmp/tui-debug.jsonl")

    assert parsed["mode"] == "both"
    assert parsed["tuiDebug"] is True
    assert parsed["tuiDebugLogPath"] == "/tmp/tui-debug.jsonl"
    assert parsed["error"] is None
