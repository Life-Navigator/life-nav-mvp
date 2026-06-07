"""Shared pytest fixtures.

We override ``get_settings`` so every test sees a deterministic Settings with a
known JWT secret, and we inject a fake Supabase client so finance tests never
touch the network. JWTs are minted locally with the same secret + audience the
service verifies ("authenticated").
"""
from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path
from typing import Any, Optional

import jwt
import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.config import Settings, get_settings  # noqa: E402
from app.dependencies import get_supabase  # noqa: E402
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
        neo4j_uri="neo4j+s://neo4j.local",
        neo4j_username="neo4j",
        neo4j_password="n",
    )


class FakeSupabase:
    """Deterministic stand-in for SupabaseClient — no network."""

    def __init__(self, rows: Optional[list[dict[str, Any]]] = None) -> None:
        self._rows = rows or []

    configured = True

    async def select(self, table: str, **_: Any) -> list[dict[str, Any]]:
        return list(self._rows)

    async def ready(self) -> bool:
        return True


def make_jwt(sub: str = "11111111-1111-1111-1111-111111111111", *, secret: str = TEST_JWT_SECRET) -> str:
    now = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    payload = {
        "sub": sub,
        "aud": "authenticated",
        "role": "authenticated",
        "email": "test@lifenav.test",
        "iat": now,
        "exp": now + dt.timedelta(days=3650),
    }
    return jwt.encode(payload, secret, algorithm="HS256")


@pytest.fixture
def make_client():
    """Factory: build a TestClient with an optional fake Supabase row set."""

    def _make(rows: Optional[list[dict[str, Any]]] = None) -> TestClient:
        application = create_app()
        application.dependency_overrides[get_settings] = _test_settings
        application.dependency_overrides[get_supabase] = lambda: FakeSupabase(rows)
        return TestClient(application)

    return _make


@pytest.fixture
def client(make_client):
    return make_client(None)


@pytest.fixture
def auth_header():
    return {"Authorization": f"Bearer {make_jwt()}"}
