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
from typing import Any

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
    """Deterministic stand-in for SupabaseClient — no network.

    ``rows`` may be a list (applied to ``financial_accounts``) or a dict
    ``{table: rows}`` for per-table control. Captures inserts for assertions.
    """

    configured = True

    def __init__(self, rows: Any = None) -> None:
        if isinstance(rows, dict):
            self._by_table: dict[str, list[dict[str, Any]]] = rows
        elif rows:
            self._by_table = {"financial_accounts": rows}
        else:
            self._by_table = {}
        self.inserts: list[tuple[str, dict[str, Any]]] = []

    async def select(self, table: str, *, filters: Any = None, **_: Any) -> list[dict[str, Any]]:
        rows = list(self._by_table.get(table, []))
        # Apply `eq.` filters LENIENTLY: a row missing the filtered field passes (so
        # fixtures that omit user_id still return), but a present field must match —
        # this lets reference lookups (e.g. compensation_bands by occupation_code) work.
        for field, expr in (filters or {}).items():
            if isinstance(expr, str) and expr.startswith("eq."):
                want = expr[3:]
                rows = [r for r in rows if field not in r or str(r.get(field)) == want]
        return rows

    async def count(self, table: str, *, filters: Any = None, **_: Any) -> int:
        return len(await self.select(table, filters=filters))

    async def insert(self, table: str, row: dict[str, Any], **_: Any) -> list[dict[str, Any]]:
        stored = {**row, "id": row.get("id", "new-id")}
        self.inserts.append((table, row))
        self._by_table.setdefault(table, []).append(stored)  # persist so it's queryable
        return [stored]

    async def upsert(self, table: str, row: dict[str, Any], **_: Any) -> list[dict[str, Any]]:
        # Idempotent: replace any existing row with the same id, else append (stateful store).
        self.inserts.append((table, row))
        bucket = self._by_table.setdefault(table, [])
        rid = row.get("id")
        for i, existing in enumerate(bucket):
            if rid is not None and existing.get("id") == rid:
                bucket[i] = dict(row)
                return [dict(row)]
        bucket.append(dict(row))
        return [dict(row)]

    async def update(self, table: str, patch: dict[str, Any], *, filters: Any = None, **_: Any) -> list[dict[str, Any]]:
        updated = []
        for r in self._by_table.get(table, []):
            ok = True
            for field, expr in (filters or {}).items():
                if isinstance(expr, str) and expr.startswith("eq.") and str(r.get(field)) != expr[3:]:
                    ok = False
                    break
            if ok:
                r.update(patch)
                updated.append(dict(r))
        return updated

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

    def _make(rows: Any = None) -> TestClient:
        application = create_app()
        fake = FakeSupabase(rows)
        application.dependency_overrides[get_settings] = _test_settings
        application.dependency_overrides[get_supabase] = lambda: fake
        tc = TestClient(application)
        tc.fake_supabase = fake  # type: ignore[attr-defined]  # for write assertions
        return tc

    return _make


@pytest.fixture
def client(make_client):
    return make_client(None)


@pytest.fixture
def auth_header():
    return {"Authorization": f"Bearer {make_jwt()}"}
