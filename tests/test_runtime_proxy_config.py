from __future__ import annotations

from deepscientist.config import ConfigManager
from deepscientist.daemon.app import DaemonApp
from deepscientist.home import ensure_home_layout
from deepscientist.network import configure_runtime_proxy, runtime_proxy_url


def test_default_config_exposes_runtime_proxy_setting(temp_home) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()

    config = manager.load_runtime_config()

    assert config["network"]["proxy"] is None


def test_config_save_hot_reloads_runtime_proxy(monkeypatch, temp_home) -> None:
    ensure_home_layout(temp_home)
    manager = ConfigManager(temp_home)
    manager.ensure_files()
    for key in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        monkeypatch.delenv(key, raising=False)
    configure_runtime_proxy(None)
    app = DaemonApp(temp_home)

    config = manager.load_runtime_config()
    config["network"]["proxy"] = "http://127.0.0.1:7897"
    saved = app.handlers.config_save("config", {"structured": config})

    assert saved["ok"] is True
    assert saved["runtime_reload"]["proxy"] == "http://127.0.0.1:7897"
    assert runtime_proxy_url() == "http://127.0.0.1:7897"

    config["network"]["proxy"] = None
    saved = app.handlers.config_save("config", {"structured": config})

    assert saved["ok"] is True
    assert saved["runtime_reload"]["proxy"] is None
    assert runtime_proxy_url() is None
