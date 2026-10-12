from __future__ import annotations

from pathlib import Path

import deepscientist.bash_exec.shells as shells
import deepscientist.process_control as process_control


def test_build_exec_shell_launch_prefers_powershell_on_windows(monkeypatch) -> None:
    monkeypatch.setattr(shells.os, "name", "nt", raising=False)
    monkeypatch.setattr(
        shells.shutil,
        "which",
        lambda binary: {
            "pwsh": r"C:\Program Files\PowerShell\7\pwsh.exe",
            "powershell.exe": r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
            "cmd.exe": r"C:\Windows\System32\cmd.exe",
        }.get(binary),
    )

    launch = shells.build_exec_shell_launch("Write-Output 'ok'")

    assert launch.family == "powershell"
    assert launch.argv[0].endswith("pwsh.exe")
    assert launch.argv[-1] == "Write-Output 'ok'"


def test_build_exec_shell_launch_prefers_bash_when_available_on_windows(monkeypatch) -> None:
    monkeypatch.setattr(shells.os, "name", "nt", raising=False)
    monkeypatch.setattr(
        shells.shutil,
        "which",
        lambda binary: {
            "bash.exe": r"C:\Program Files\Git\bin\bash.exe",
            "pwsh": r"C:\Program Files\PowerShell\7\pwsh.exe",
        }.get(binary),
    )

    launch = shells.build_exec_shell_launch("pwd")

    assert launch.family == "bash"
    assert launch.argv[:2] == [r"C:\Program Files\Git\bin\bash.exe", "-lc"]


def test_build_exec_shell_launch_falls_back_to_cmd_on_windows(monkeypatch) -> None:
    monkeypatch.setattr(shells.os, "name", "nt", raising=False)
    monkeypatch.setattr(
        shells.shutil,
        "which",
        lambda binary: {
            "cmd.exe": r"C:\Windows\System32\cmd.exe",
        }.get(binary),
    )

    launch = shells.build_exec_shell_launch("dir")

    assert launch.family == "cmd"
    assert launch.argv[:4] == [r"C:\Windows\System32\cmd.exe", "/d", "/s", "/c"]


def test_build_terminal_shell_launch_uses_powershell_on_windows(monkeypatch) -> None:
    monkeypatch.setattr(shells.os, "name", "nt", raising=False)
    monkeypatch.setattr(
        shells.shutil,
        "which",
        lambda binary: {
            "powershell.exe": r"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe",
        }.get(binary),
    )

    launch = shells.build_terminal_shell_launch(Path("terminal.ps1"))

    assert launch.family == "powershell"
    assert launch.argv[-2:] == ["-File", "terminal.ps1"]


def test_process_session_popen_kwargs_windows(monkeypatch) -> None:
    monkeypatch.setattr(process_control.os, "name", "nt", raising=False)
    monkeypatch.setattr(process_control.subprocess, "CREATE_NEW_PROCESS_GROUP", 512, raising=False)
    monkeypatch.setattr(process_control.subprocess, "CREATE_NO_WINDOW", 1024, raising=False)
    monkeypatch.setattr(process_control.subprocess, "STARTF_USESHOWWINDOW", 1, raising=False)
    monkeypatch.setattr(process_control.subprocess, "SW_HIDE", 0, raising=False)

    class FakeStartupInfo:
        def __init__(self) -> None:
            self.dwFlags = 0
            self.wShowWindow = None

    monkeypatch.setattr(process_control.subprocess, "STARTUPINFO", FakeStartupInfo, raising=False)

    kwargs = process_control.process_session_popen_kwargs(hide_window=True)

    assert kwargs["creationflags"] == 1536
    assert kwargs["startupinfo"].dwFlags == 1
