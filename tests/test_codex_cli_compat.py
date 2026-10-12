from __future__ import annotations

import deepscientist.codex_cli_compat as codex_cli_compat


def test_sync_overlay_directory_skips_vcs_metadata_and_stale_read_only_files(tmp_path) -> None:
    source_root = tmp_path / "source" / "skills"
    skill_root = source_root / "academic-search"
    skill_root.mkdir(parents=True)
    (skill_root / "SKILL.md").write_text("skill\n", encoding="utf-8")

    source_pack = skill_root / ".git" / "objects" / "pack"
    source_pack.mkdir(parents=True)
    source_index = source_pack / "pack.idx"
    source_index.write_bytes(b"index")
    source_index.chmod(0o444)

    target_root = tmp_path / "target" / "skills"
    stale_pack = target_root / "academic-search" / ".git" / "objects" / "pack"
    stale_pack.mkdir(parents=True)
    stale_index = stale_pack / "pack.idx"
    stale_index.write_bytes(b"stale index")
    stale_index.chmod(0o444)

    codex_cli_compat._sync_overlay_directory(target_root, source_root)
    codex_cli_compat._sync_overlay_directory(target_root, source_root)

    assert (target_root / "academic-search" / "SKILL.md").read_text(encoding="utf-8") == "skill\n"
    assert not (target_root / "academic-search" / ".git").exists()


def test_parse_codex_cli_version_extracts_semver() -> None:
    assert codex_cli_compat.parse_codex_cli_version("codex-cli 0.57.0") == (0, 57, 0)
    assert codex_cli_compat.parse_codex_cli_version("Codex-CLI 0.116.0\n") == (0, 116, 0)
    assert codex_cli_compat.parse_codex_cli_version("not a version") is None


def test_normalize_codex_reasoning_effort_downgrades_xhigh_for_legacy_cli(monkeypatch) -> None:
    codex_cli_compat.codex_cli_version.cache_clear()
    monkeypatch.setattr(codex_cli_compat, "codex_cli_version", lambda binary: (0, 57, 0))

    reasoning_effort, warning = codex_cli_compat.normalize_codex_reasoning_effort(
        "xhigh",
        resolved_binary="/tmp/fake-codex",
    )

    assert reasoning_effort == "high"
    assert warning is not None
    assert "0.57.0" in warning


def test_normalize_codex_reasoning_effort_keeps_xhigh_for_supported_cli(monkeypatch) -> None:
    codex_cli_compat.codex_cli_version.cache_clear()
    monkeypatch.setattr(codex_cli_compat, "codex_cli_version", lambda binary: (0, 116, 0))

    reasoning_effort, warning = codex_cli_compat.normalize_codex_reasoning_effort(
        "xhigh",
        resolved_binary="/tmp/fake-codex",
    )

    assert reasoning_effort == "xhigh"
    assert warning is None


def test_adapt_profile_only_provider_config_promotes_model_and_provider() -> None:
    config = """
[model_providers.minimax]
name = "MiniMax Chat Completions API"
base_url = "https://api.minimaxi.com/v1"
env_key = "MINIMAX_API_KEY"
wire_api = "chat"
requires_openai_auth = false

[profiles.m27]
model = "MiniMax-M2.7"
model_provider = "minimax"
""".strip()

    adapted, warning = codex_cli_compat.adapt_profile_only_provider_config(config, profile="m27")

    assert warning is not None
    assert 'model_provider = "minimax"' in adapted
    assert 'model = "MiniMax-M2.7"' in adapted


def test_adapt_profile_only_provider_config_is_noop_when_top_level_fields_match_profile() -> None:
    config = """
model = "MiniMax-M2.7"
model_provider = "minimax"

[profiles.m27]
model = "MiniMax-M2.7"
model_provider = "minimax"
""".strip()

    adapted, warning = codex_cli_compat.adapt_profile_only_provider_config(config, profile="m27")

    assert adapted == config
    assert warning is None


def test_adapt_profile_only_provider_config_overrides_conflicting_top_level_fields() -> None:
    config = """
model = "gpt-5.4"
model_provider = "OpenAI"
model_reasoning_effort = "xhigh"

[model_providers.minimax]
name = "MiniMax Chat Completions API"
base_url = "https://api.minimaxi.com/v1"
env_key = "MINIMAX_API_KEY"
wire_api = "chat"
requires_openai_auth = false

[profiles.m27]
model = "MiniMax-M2.7"
model_provider = "minimax"
""".strip()

    adapted, warning = codex_cli_compat.adapt_profile_only_provider_config(config, profile="m27")

    assert warning is not None
    assert "overrode conflicting top-level" in warning
    header = adapted.split("[model_providers.minimax]", 1)[0]
    assert 'model_provider = "minimax"' in header
    assert 'model = "MiniMax-M2.7"' in header
    assert 'model_provider = "OpenAI"' not in adapted
    assert 'model = "gpt-5.4"' not in adapted
    assert 'model_reasoning_effort = "xhigh"' in adapted


def test_provider_base_url_looks_local_accepts_private_and_loopback_hosts() -> None:
    assert codex_cli_compat.provider_base_url_looks_local("http://127.0.0.1:8004/v1") is True
    assert codex_cli_compat.provider_base_url_looks_local("http://192.168.3.9:30000/v1") is True
    assert codex_cli_compat.provider_base_url_looks_local("https://api.minimaxi.com/v1") is False


def test_missing_provider_env_key_helpers_detect_missing_key_from_metadata_and_output() -> None:
    metadata = {"env_key": "sglang", "base_url": "http://192.168.3.9:30000/v1"}

    assert codex_cli_compat.missing_provider_env_key(metadata, {"OTHER": "value"}) == "sglang"
    assert codex_cli_compat.missing_provider_env_key(metadata, {"sglang": "1234"}) is None
    assert (
        codex_cli_compat.missing_provider_env_key_from_text(
            '{"type":"error","message":"Missing environment variable: `sglang`."}'
        )
        == "sglang"
    )
