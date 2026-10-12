from __future__ import annotations

from copy import deepcopy
import os
from typing import Any

from ..connector_runtime import infer_connector_transport
from ..shared import slugify


PROFILEABLE_CONNECTOR_NAMES = ("telegram", "discord", "slack", "feishu", "whatsapp")


def _normalize_secret_pair(payload: dict[str, Any], direct_key: str, env_key: str) -> None:
    direct = _as_text(payload.get(direct_key))
    env_name = _as_text(payload.get(env_key))
    payload[direct_key] = direct
    payload[env_key] = None if direct else env_name


CONNECTOR_PROFILE_SPECS: dict[str, dict[str, Any]] = {
    "telegram": {
        "profile_id_prefix": "telegram-profile",
        "shared_fields": (
            "enabled",
            "profiles",
            "transport",
            "bot_name",
            "bot_token",
            "bot_token_env",
            "command_prefix",
            "dm_policy",
            "allow_from",
            "group_policy",
            "group_allow_from",
            "groups",
            "require_mention_in_groups",
            "auto_bind_dm_to_active_quest",
        ),
        "profile_defaults": {
            "profile_id": None,
            "enabled": True,
            "transport": "polling",
            "bot_name": "DeepScientist",
            "bot_token": None,
            "bot_token_env": None,
        },
        "profile_fields": (
            "enabled",
            "transport",
            "bot_name",
            "bot_token",
            "bot_token_env",
        ),
        "migration_keys": ("bot_token",),
        "label_fields": ("bot_name",),
        "id_fields": ("bot_name",),
        "secret_pairs": (("bot_token", "bot_token_env"),),
        "activation_env_defaults": {"bot_token_env": "TELEGRAM_BOT_TOKEN"},
    },
    "discord": {
        "profile_id_prefix": "discord-profile",
        "shared_fields": (
            "enabled",
            "profiles",
            "transport",
            "bot_name",
            "bot_token",
            "bot_token_env",
            "command_prefix",
            "application_id",
            "dm_policy",
            "allow_from",
            "group_policy",
            "group_allow_from",
            "groups",
            "require_mention_in_groups",
            "auto_bind_dm_to_active_quest",
            "guild_allowlist",
        ),
        "profile_defaults": {
            "profile_id": None,
            "enabled": True,
            "transport": "gateway",
            "bot_name": "DeepScientist",
            "bot_token": None,
            "bot_token_env": None,
            "application_id": None,
        },
        "profile_fields": (
            "enabled",
            "transport",
            "bot_name",
            "bot_token",
            "bot_token_env",
            "application_id",
        ),
        "migration_keys": ("bot_token", "application_id"),
        "label_fields": ("bot_name", "application_id"),
        "id_fields": ("application_id", "bot_name"),
        "secret_pairs": (("bot_token", "bot_token_env"),),
        "activation_env_defaults": {"bot_token_env": "DISCORD_BOT_TOKEN"},
    },
    "slack": {
        "profile_id_prefix": "slack-profile",
        "shared_fields": (
            "enabled",
            "profiles",
            "transport",
            "bot_name",
            "bot_token",
            "bot_token_env",
            "bot_user_id",
            "app_token",
            "app_token_env",
            "command_prefix",
            "dm_policy",
            "allow_from",
            "group_policy",
            "group_allow_from",
            "groups",
            "require_mention_in_groups",
            "auto_bind_dm_to_active_quest",
        ),
        "profile_defaults": {
            "profile_id": None,
            "enabled": True,
            "transport": "socket_mode",
            "bot_name": "DeepScientist",
            "bot_token": None,
            "bot_token_env": None,
            "bot_user_id": None,
            "app_token": None,
            "app_token_env": None,
        },
        "profile_fields": (
            "enabled",
            "transport",
            "bot_name",
            "bot_token",
            "bot_token_env",
            "bot_user_id",
            "app_token",
            "app_token_env",
        ),
        "migration_keys": ("bot_token", "bot_user_id", "app_token"),
        "label_fields": ("bot_name", "bot_user_id"),
        "id_fields": ("bot_user_id", "bot_name"),
        "secret_pairs": (
            ("bot_token", "bot_token_env"),
            ("app_token", "app_token_env"),
        ),
        "activation_env_defaults": {
            "bot_token_env": "SLACK_BOT_TOKEN",
            "app_token_env": "SLACK_APP_TOKEN",
        },
    },
    "feishu": {
        "profile_id_prefix": "feishu-profile",
        "shared_fields": (
            "enabled",
            "profiles",
            "transport",
            "bot_name",
            "app_id",
            "app_secret",
            "app_secret_env",
            "api_base_url",
            "command_prefix",
            "dm_policy",
            "allow_from",
            "group_policy",
            "group_allow_from",
            "groups",
            "require_mention_in_groups",
            "auto_bind_dm_to_active_quest",
        ),
        "profile_defaults": {
            "profile_id": None,
            "enabled": True,
            "transport": "long_connection",
            "bot_name": "DeepScientist",
            "app_id": None,
            "app_secret": None,
            "app_secret_env": None,
            "api_base_url": "https://open.feishu.cn",
        },
        "profile_fields": (
            "enabled",
            "transport",
            "bot_name",
            "app_id",
            "app_secret",
            "app_secret_env",
            "api_base_url",
        ),
        "migration_keys": ("app_id", "app_secret"),
        "label_fields": ("bot_name", "app_id"),
        "id_fields": ("app_id", "bot_name"),
        "secret_pairs": (("app_secret", "app_secret_env"),),
        "activation_env_defaults": {"app_secret_env": "FEISHU_APP_SECRET"},
    },
    "whatsapp": {
        "profile_id_prefix": "whatsapp-profile",
        "shared_fields": (
            "enabled",
            "profiles",
            "transport",
            "bot_name",
            "auth_method",
            "session_dir",
            "command_prefix",
            "dm_policy",
            "allow_from",
            "group_policy",
            "group_allow_from",
            "groups",
            "auto_bind_dm_to_active_quest",
        ),
        "profile_defaults": {
            "profile_id": None,
            "enabled": True,
            "transport": "local_session",
            "bot_name": "DeepScientist",
            "auth_method": "qr_browser",
            "session_dir": "~/.deepscientist/connectors/whatsapp",
        },
        "profile_fields": (
            "enabled",
            "transport",
            "bot_name",
            "auth_method",
            "session_dir",
        ),
        "migration_keys": ("session_dir",),
        "label_fields": ("bot_name",),
        "id_fields": ("bot_name",),
        "secret_pairs": (),
    },
}

CONNECTOR_PROFILE_READY_REQUIREMENTS: dict[str, tuple[object, ...]] = {
    "telegram": (("bot_token", "bot_token_env"),),
    "discord": (("bot_token", "bot_token_env"),),
    "slack": (
        ("bot_token", "bot_token_env"),
        ("app_token", "app_token_env"),
    ),
    "feishu": (
        "app_id",
        ("app_secret", "app_secret_env"),
    ),
    "whatsapp": ("session_dir",),
}


def _as_text(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _resolved_env_secret(env_name: Any) -> str | None:
    normalized = _as_text(env_name)
    if not normalized:
        return None
    resolved = str(os.environ.get(normalized) or "").strip()
    return resolved or None


def _has_secret_value(payload: dict[str, Any], direct_key: str, env_key: str) -> bool:
    return bool(_as_text(payload.get(direct_key)) or _resolved_env_secret(payload.get(env_key)))


def _secret_pair_has_activation_seed(
    payload: dict[str, Any],
    defaults: dict[str, Any],
    *,
    direct_key: str,
    env_key: str,
    placeholder_env_defaults: dict[str, Any] | None = None,
) -> bool:
    direct_value = _as_text(payload.get(direct_key))
    if direct_value:
        return True
    env_name = _as_text(payload.get(env_key))
    if not env_name:
        return False
    default_env_name = _as_text((placeholder_env_defaults or {}).get(env_key) or defaults.get(env_key))
    return bool(_resolved_env_secret(env_name) or env_name != default_env_name)


def connector_profile_is_configured(connector_name: str, profile: dict[str, Any] | None) -> bool:
    if connector_name not in CONNECTOR_PROFILE_READY_REQUIREMENTS or not isinstance(profile, dict):
        return False
    for requirement in CONNECTOR_PROFILE_READY_REQUIREMENTS[connector_name]:
        if isinstance(requirement, tuple):
            direct_key, env_key = requirement
            if not _has_secret_value(profile, str(direct_key), str(env_key)):
                return False
            continue
        if not _as_text(profile.get(str(requirement))):
            return False
    return True


def connector_profile_has_activation_seed(connector_name: str, profile: dict[str, Any] | None) -> bool:
    if connector_name not in CONNECTOR_PROFILE_SPECS or not isinstance(profile, dict):
        return False
    if bool(profile.get("enabled")):
        return True
    spec = CONNECTOR_PROFILE_SPECS[connector_name]
    defaults = spec["profile_defaults"]
    secret_direct_keys = {str(direct_key) for direct_key, _ in spec.get("secret_pairs", ())}
    for direct_key, env_key in spec.get("secret_pairs", ()):
        if _secret_pair_has_activation_seed(
            profile,
            defaults,
            direct_key=str(direct_key),
            env_key=str(env_key),
            placeholder_env_defaults=spec.get("activation_env_defaults"),
        ):
            return True
    for key in spec["migration_keys"]:
        normalized_key = str(key)
        if normalized_key in secret_direct_keys:
            continue
        value = _as_text(profile.get(normalized_key))
        default_value = _as_text(defaults.get(normalized_key))
        if value and value != default_value:
            return True
    return False


def _profile_seed(connector_name: str, raw: dict[str, Any], *, index: int) -> str:
    spec = CONNECTOR_PROFILE_SPECS[connector_name]
    explicit = _as_text(raw.get("profile_id"))
    if explicit:
        return explicit
    for key in spec["id_fields"]:
        candidate = _as_text(raw.get(key))
        if candidate:
            return f"{connector_name}-{candidate}"
    return f"{spec['profile_id_prefix']}-{index:03d}"


def _unique_profile_id(seed: str, *, prefix: str, used: set[str]) -> str:
    base = slugify(seed, default=prefix)
    candidate = base
    suffix = 2
    while candidate in used:
        candidate = f"{base}-{suffix}"
        suffix += 1
    used.add(candidate)
    return candidate


def default_connector_profile(connector_name: str) -> dict[str, Any]:
    spec = CONNECTOR_PROFILE_SPECS[connector_name]
    return deepcopy(spec["profile_defaults"])


def connector_profile_label(connector_name: str, profile: dict[str, Any] | None) -> str:
    if not isinstance(profile, dict):
        return connector_name.capitalize()
    spec = CONNECTOR_PROFILE_SPECS[connector_name]
    parts = [_as_text(profile.get(key)) for key in spec["label_fields"]]
    filtered = [item for item in parts if item]
    return " · ".join(filtered) if filtered else connector_name.capitalize()


def normalize_connector_config(connector_name: str, config: dict[str, Any] | None) -> dict[str, Any]:
    if connector_name not in CONNECTOR_PROFILE_SPECS:
        raise KeyError(f"Connector `{connector_name}` does not support generic profile normalization.")
    spec = CONNECTOR_PROFILE_SPECS[connector_name]
    payload = deepcopy(config or {})
    shared = {
        key: deepcopy(payload.get(key))
        for key in spec["shared_fields"]
        if key in payload
    }
    shared["profiles"] = []
    for direct_key, env_key in spec.get("secret_pairs", ()):
        _normalize_secret_pair(shared, direct_key, env_key)

    raw_profiles = payload.get("profiles")
    items = list(raw_profiles) if isinstance(raw_profiles, list) else []
    has_direct_migration_value = any(
        _as_text(payload.get(key))
        and _as_text(payload.get(key)) != _as_text(spec["profile_defaults"].get(key))
        for key in spec["migration_keys"]
    )
    has_env_only_secret = any(
        _secret_pair_has_activation_seed(
            payload,
            spec["profile_defaults"],
            direct_key=str(direct_key),
            env_key=str(env_key),
            placeholder_env_defaults=spec.get("activation_env_defaults"),
        )
        for direct_key, env_key in spec.get("secret_pairs", ())
    )
    if not items and (has_direct_migration_value or has_env_only_secret or bool(payload.get("enabled"))):
        items = [{key: payload.get(key) for key in spec["profile_fields"]}]

    used_ids: set[str] = set()
    profiles: list[dict[str, Any]] = []
    for index, raw in enumerate(items, start=1):
        if not isinstance(raw, dict):
            continue
        current = default_connector_profile(connector_name)
        for key in ("profile_id", *spec["profile_fields"]):
            if key in raw:
                current[key] = deepcopy(raw.get(key))
        for key in spec["profile_fields"]:
            if key in {"enabled", "transport", "mode"}:
                continue
            if isinstance(current.get(key), list):
                continue
            if current.get(key) is None:
                continue
            current[key] = _as_text(current.get(key))
        current["transport"] = infer_connector_transport(connector_name, current)
        if "mode" in spec["profile_defaults"] or current.get("mode") is not None:
            current["mode"] = _as_text(current.get("mode")) or str(spec["profile_defaults"].get("mode") or "")
        for direct_key, env_key in spec.get("secret_pairs", ()):
            _normalize_secret_pair(current, direct_key, env_key)
        if not connector_profile_has_activation_seed(connector_name, current):
            continue
        current["enabled"] = connector_profile_is_configured(connector_name, current)
        current["profile_id"] = _unique_profile_id(
            _profile_seed(connector_name, current, index=index),
            prefix=str(spec["profile_id_prefix"]),
            used=used_ids,
        )
        profiles.append(current)

    shared["transport"] = infer_connector_transport(connector_name, shared)
    shared["profiles"] = profiles
    shared["enabled"] = any(bool(item.get("enabled")) for item in profiles)
    if len(profiles) == 1:
        for key in spec["profile_fields"]:
            shared[key] = profiles[0].get(key)
    elif len(profiles) > 1:
        for direct_key, env_key in spec.get("secret_pairs", ()):
            shared[direct_key] = None
            shared[env_key] = None
    return shared


def list_connector_profiles(connector_name: str, config: dict[str, Any] | None) -> list[dict[str, Any]]:
    normalized = normalize_connector_config(connector_name, config)
    profiles = normalized.get("profiles")
    return [dict(item) for item in profiles] if isinstance(profiles, list) else []


def find_connector_profile(
    connector_name: str,
    config: dict[str, Any] | None,
    *,
    profile_id: str | None = None,
) -> dict[str, Any] | None:
    normalized_profile_id = _as_text(profile_id)
    for profile in list_connector_profiles(connector_name, config):
        if normalized_profile_id and str(profile.get("profile_id") or "").strip() == normalized_profile_id:
            return profile
    return None


def merge_connector_profile_config(
    connector_name: str,
    shared_config: dict[str, Any] | None,
    profile: dict[str, Any],
) -> dict[str, Any]:
    normalized = normalize_connector_config(connector_name, shared_config)
    merged = deepcopy(normalized)
    merged.pop("profiles", None)
    for key in CONNECTOR_PROFILE_SPECS[connector_name]["profile_fields"]:
        merged[key] = profile.get(key)
    merged["profile_id"] = str(profile.get("profile_id") or "").strip() or None
    merged["enabled"] = bool(normalized.get("enabled", False)) and bool(profile.get("enabled", True))
    return merged
