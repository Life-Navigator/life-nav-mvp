"""Runtime configuration sourced from environment variables.

Settings are read once at process start. Tests construct Settings
directly with overrides so they don't need to manipulate the
environment.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Supabase — JWT VERIFICATION ONLY.
    #
    # This service verifies the JWT that Supabase Auth already issued. It does not read or write
    # Supabase. `supabase_url`, `supabase_anon_key` and `supabase_service_role_key` were declared here
    # but had ZERO read sites anywhere in the service (verified 2026-07-29, see
    # GATEWAY_PRIVILEGE_REDUCTION.md) — the service held a credential that bypasses every Row-Level
    # Security policy in the project and never used it.
    #
    # Do not re-add them. If this service ever legitimately needs Supabase, it needs a scoped
    # credential and a review — not the project-wide service_role key. `_FORBIDDEN_SETTINGS` below
    # makes an accidental re-introduction fail loudly instead of silently re-granting the privilege.
    supabase_jwt_secret: str = ""

    # Gemini
    gemini_api_key: str = ""
    gemini_embedding_model: str = "text-embedding-004"
    gemini_generation_model: str = "gemini-2.5-flash"

    # Qdrant
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_personal_collection: str = "life_navigator"
    qdrant_central_collection: str = "ln_central"

    # Neo4j
    neo4j_uri: str = ""
    neo4j_username: str = "neo4j"
    neo4j_password: str = ""
    neo4j_personal_database: str = "neo4j"
    neo4j_central_database: str = "central"

    # Service config
    port: int = 8080
    log_level: str = "info"
    allowed_origins: str = "*"


# Settings this service must never carry again. Each grants privilege it demonstrably does not need:
# the service_role key bypasses every RLS policy in the project; the URL and anon key only exist to
# reach an API this service never calls.
_FORBIDDEN_SETTINGS = ("supabase_service_role_key", "supabase_url", "supabase_anon_key")


def _forbidden_attr(self: Settings, name: str):  # pragma: no cover - exercised via test
    """Fail LOUD and CLOSED if code reaches for a removed Supabase setting.

    Without this, re-adding a read site would raise a bare AttributeError that reads like a typo, and
    the obvious 'fix' is to put the field back — silently re-granting a project-wide RLS-bypassing
    credential to a service with no Supabase usage. This turns that mistake into an explicit decision.
    """
    if name in _FORBIDDEN_SETTINGS:
        raise AttributeError(
            f"{name!r} was deliberately removed from the api-gateway (2026-07-29 privilege reduction; "
            "see GATEWAY_PRIVILEGE_REDUCTION.md). This service verifies JWTs and reads Neo4j/Qdrant/"
            "Gemini only — it has no Supabase usage.\n"
            "If you now need Supabase here, do NOT re-add this field: request a scoped credential and "
            "a security review. Re-adding it re-grants a key that bypasses all Row-Level Security."
        )
    raise AttributeError(name)


Settings.__getattr__ = _forbidden_attr  # type: ignore[method-assign]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
