"""Shared pytest fixtures.

We override ``get_settings`` so every test sees a deterministic Settings
instance with a known JWT secret, and we keep the Gemini/Qdrant/Neo4j
client deps unbound (tests that need them inject fakes via
``app.dependency_overrides``).
"""
from __future__ import annotations

import os
import sys
import datetime as dt
from pathlib import Path

import jwt
import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.config import Settings, get_settings  # noqa: E402
from app.main import create_app  # noqa: E402


TEST_JWT_SECRET = "test-secret-please-rotate"


def _test_settings() -> Settings:
    return Settings(
        supabase_url="https://test.supabase.local",
        supabase_anon_key="anon",
        supabase_jwt_secret=TEST_JWT_SECRET,
        supabase_service_role_key="service",
        gemini_api_key="g",
        qdrant_url="https://qdrant.local",
        qdrant_api_key="q",
        neo4j_uri="https://neo4j.local",
        neo4j_username="neo4j",
        neo4j_password="n",
    )


@pytest.fixture
def settings_override() -> Settings:
    return _test_settings()


@pytest.fixture
def app(settings_override):
    app = create_app()
    app.dependency_overrides[get_settings] = lambda: settings_override
    yield app
    app.dependency_overrides.clear()


@pytest.fixture
def client(app):
    return TestClient(app)


def make_jwt(
    sub: str = "00000000-0000-0000-0000-000000000001",
    email: str = "u@example.com",
    role: str = "authenticated",
    *,
    expires_in_seconds: int = 3600,
    secret: str = TEST_JWT_SECRET,
    audience: str = "authenticated",
) -> str:
    now = dt.datetime.now(dt.timezone.utc)
    payload = {
        "sub": sub,
        "email": email,
        "role": role,
        "aud": audience,
        "iat": int(now.timestamp()),
        "exp": int((now + dt.timedelta(seconds=expires_in_seconds)).timestamp()),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def bearer():
    """Returns ``(token, headers)`` for a valid bearer token."""
    token = make_jwt()
    return token, {"Authorization": f"Bearer {token}"}
