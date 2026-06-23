"""Runtime configuration sourced from environment variables.

Read once at process start. Tests construct ``Settings`` directly with
overrides so they never touch the real environment. Secrets are NEVER
hardcoded — every value comes from the Fly.io environment (see fly.toml).
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Supabase (system of record + auth) ---
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_service_role_key: str = ""

    # --- Gemini (server-side reasoning only; NEVER exposed to frontend) ---
    gemini_api_key: str = ""
    gemini_embedding_model: str = "gemini-embedding-001"  # 3072-dim; must match the worker
    gemini_generation_model: str = "gemini-2.5-pro"

    # --- Model provider / Vertex (ADC, NO API key) ---
    # "ai_studio" = Gemini via API key (gemini_api_key). "vertex" = Gemini via Vertex AI + ADC (no key —
    # required where org policy disallows API keys). Production under that policy MUST set model_provider=vertex.
    model_provider: str = "ai_studio"
    vertex_project: str = "gen-lang-client-0849161409"  # LifeNav GCP project (Vertex AI). Override via env.
    vertex_region: str = "us-central1"
    vertex_gemini_model: str = "gemini-2.5-pro"

    # --- Qdrant (grounding vectors) ---
    qdrant_url: str = ""
    qdrant_api_key: str = ""
    qdrant_personal_collection: str = "life_navigator"
    qdrant_central_collection: str = "ln_central"

    # --- Neo4j (grounding graph) ---
    neo4j_uri: str = ""
    neo4j_username: str = "neo4j"
    neo4j_password: str = ""
    neo4j_personal_database: str = "neo4j"
    neo4j_central_database: str = "central"

    # --- Service config ---
    port: int = 8080
    log_level: str = "info"
    allowed_origins: str = "*"

    # HTTP client timeout for downstream calls (seconds).
    http_timeout_seconds: float = 8.0

    # Comma-separated allow-list of admin emails (platform-wide metrics access).
    admin_emails: str = ""

    def admin_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_emails.split(",") if e.strip()}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
