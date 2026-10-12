from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = PROJECT_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))


@pytest.fixture
def project_root() -> Path:
    return PROJECT_ROOT


@pytest.fixture
def temp_home(tmp_path: Path) -> Path:
    return tmp_path / "DeepScientistHome"


@pytest.fixture
def pythonpath_env(project_root: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    src = str(project_root / "src")
    existing = os.environ.get("PYTHONPATH")
    monkeypatch.setenv("PYTHONPATH", f"{src}:{existing}" if existing else src)
