from __future__ import annotations

import json
from pathlib import Path

from deepscientist.cli import latex_install_runtime_command, latex_status_command
from deepscientist.home import ensure_home_layout
from deepscientist.tinytex import inspect_latex_runtime, resolve_latex_binary


def test_inspect_latex_runtime_prefers_managed_tinytex(monkeypatch, temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    tinytex_root = temp_home / "runtime" / "tools" / "TinyTeX"
    bin_dir = tinytex_root / "bin" / "x86_64-linux"
    bin_dir.mkdir(parents=True, exist_ok=True)
    for name in ("pdflatex", "bibtex"):
        path = bin_dir / name
        path.write_text("#!/usr/bin/env bash\n", encoding="utf-8")
        path.chmod(0o755)

    monkeypatch.setattr("deepscientist.tinytex.which", lambda binary: f"/usr/bin/{binary}")

    payload = inspect_latex_runtime(temp_home)

    assert payload["ok"] is True
    assert payload["tinytex"]["installed"] is True
    assert payload["binaries"]["pdflatex"]["source"] == "tinytex"
    assert payload["binaries"]["pdflatex"]["path"] == str(bin_dir / "pdflatex")
    assert payload["binaries"]["bibtex"]["path"] == str(bin_dir / "bibtex")


def test_resolve_latex_binary_falls_back_to_path(monkeypatch, temp_home: Path) -> None:
    ensure_home_layout(temp_home)
    monkeypatch.setattr("deepscientist.tinytex.which", lambda binary: f"/usr/bin/{binary}")

    match = resolve_latex_binary("pdflatex", temp_home)

    assert match["source"] == "path"
    assert match["path"] == "/usr/bin/pdflatex"


def test_cli_latex_status_and_install_runtime(monkeypatch, temp_home: Path, capsys) -> None:
    ensure_home_layout(temp_home)
    monkeypatch.setattr(
        "deepscientist.runtime_tools.service.RuntimeToolService.status",
        lambda self, name: {
            "ok": True,
            "summary": "A TinyTeX-managed `pdflatex` runtime is available for paper builds.",
            "binaries": {"pdflatex": {"path": str(temp_home / 'runtime' / 'tools' / 'TinyTeX' / 'bin' / 'pdflatex')}},
            "tinytex": {"installed": True, "root": str(temp_home / "runtime" / "tools" / "TinyTeX")},
            "warnings": [],
            "guidance": [],
        } if name == "tinytex" else {},
    )
    monkeypatch.setattr(
        "deepscientist.runtime_tools.service.RuntimeToolService.install",
        lambda self, name: {
            "ok": True,
            "changed": True,
            "summary": "TinyTeX-managed pdflatex is ready.",
            "runtime": {"tinytex": {"installed": True}},
        } if name == "tinytex" else {},
    )

    assert latex_status_command(temp_home) == 0
    status_payload = json.loads(capsys.readouterr().out)
    assert status_payload["ok"] is True

    assert latex_install_runtime_command(temp_home) == 0
    install_payload = json.loads(capsys.readouterr().out)
    assert install_payload["summary"] == "TinyTeX-managed pdflatex is ready."
