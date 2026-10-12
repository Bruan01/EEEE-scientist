from __future__ import annotations

from pathlib import Path

from deepscientist.runtime_tools import (
    RuntimeToolService,
    get_runtime_tool_factory,
    list_runtime_tool_names,
    register_runtime_tool,
)


class DummyRuntimeTool:
    tool_name = "dummy-test-tool"

    def __init__(self, home: Path) -> None:
        self.home = home

    def status(self) -> dict:
        return {"ok": True, "summary": f"dummy tool ready at {self.home}"}

    def install(self) -> dict:
        return {"ok": True, "changed": False, "summary": "dummy install skipped"}

    def resolve_binary(self, binary: str) -> dict:
        if binary == "dummy-bin":
            return {
                "binary": binary,
                "path": str(self.home / "runtime" / "tools" / "dummy" / "bin" / binary),
                "source": "dummy-test-tool",
                "root": str(self.home / "runtime" / "tools" / "dummy"),
                "bin_dir": str(self.home / "runtime" / "tools" / "dummy" / "bin"),
            }
        return {"binary": binary, "path": None, "source": None, "root": None, "bin_dir": None}


def test_runtime_tool_registry_and_service_support_custom_registration(temp_home: Path) -> None:
    register_runtime_tool("dummy-test-tool", lambda **kwargs: DummyRuntimeTool(kwargs["home"]))

    assert "dummy-test-tool" in list_runtime_tool_names()
    factory = get_runtime_tool_factory("dummy-test-tool")
    tool = factory(home=temp_home)
    assert isinstance(tool, DummyRuntimeTool)

    service = RuntimeToolService(temp_home)
    status = service.status("dummy-test-tool")
    match = service.resolve_binary("dummy-bin", preferred_tools=("dummy-test-tool",), allow_system_fallback=False)

    assert status["ok"] is True
    assert "dummy tool ready" in status["summary"]
    assert match["source"] == "dummy-test-tool"
    assert match["path"].endswith("/runtime/tools/dummy/bin/dummy-bin")


def test_runtime_tool_service_lists_builtin_tinytex(temp_home: Path) -> None:
    names = RuntimeToolService(temp_home).list_tool_names()
    assert "tinytex" in names
