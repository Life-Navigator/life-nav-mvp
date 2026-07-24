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

    async def storage_upload(self, bucket: str, path: str, data: bytes, content_type: str) -> bool:
        self.inserts.append((f"storage:{bucket}", {"path": path, "bytes": len(data)}))
        return True

    async def storage_signed_url(self, bucket: str, path: str, expires_in: int = 3600) -> str:
        return f"https://fake.storage/{bucket}/{path}?sig=test"

    async def insert(self, table: str, row: dict[str, Any], **_: Any) -> list[dict[str, Any]]:
        stored = {**row, "id": row.get("id", "new-id")}
        self.inserts.append((table, row))
        self._by_table.setdefault(table, []).append(stored)  # persist so it's queryable
        return [stored]

    async def upsert(self, table: str, row: dict[str, Any], **_: Any) -> list[dict[str, Any]]:
        # Idempotent like PostgREST merge-duplicates: replace the row matching the PK. Most tables
        # key on `id`; single-row-per-user tables (life_vision, risk_profiles, sync_state) key on
        # user_id with no id — mirror real PK-based upsert by deduping on user_id when id is absent.
        self.inserts.append((table, row))
        bucket = self._by_table.setdefault(table, [])
        # dedupe on the row's actual PK column: id / edge_id / tool_run_id, else (single-row-per-user
        # tables like life_vision / risk_profiles / sync_state) on user_id.
        key = next((k for k in ("id", "edge_id", "tool_run_id") if row.get(k) is not None), "user_id")
        val = row.get(key)
        for i, existing in enumerate(bucket):
            if val is not None and existing.get(key) == val:
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


def make_jwt(
    sub: str = "11111111-1111-1111-1111-111111111111",
    *,
    secret: str = TEST_JWT_SECRET,
    email: str = "test@lifenav.test",
    role: str = "authenticated",
    invited: bool = False,
) -> str:
    now = dt.datetime(2026, 1, 1, tzinfo=dt.timezone.utc)
    payload: dict[str, Any] = {
        "sub": sub,
        "aud": "authenticated",
        "role": role,
        "email": email,
        "iat": now,
        "exp": now + dt.timedelta(days=3650),
    }
    if invited:
        payload["app_metadata"] = {"invited": True}
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


class FakeInterpreterGemini:
    """Onboarding-interpreter LLM test double. Returns a structured plan whose goals mirror the deterministic
    clause analysis, so discovery tests exercise the PRODUCTION semantic path (interpreter -> candidate_goals)
    rather than the now-gated legacy fragment fallback. (HARDENING: prod always has an interpreter LLM.)"""

    configured = True

    async def generate_with_usage(self, system, user, temperature=None):  # noqa: ARG002
        import json as _json
        import re as _re
        from app.services.life_discovery import LifeDiscoveryService, _goal_domain
        m = _re.search(r'"""(.*?)"""', user, _re.S)
        msg = (m.group(1) if m else user).strip()
        goals = []
        for c in LifeDiscoveryService(None).analyze_statement(msg):
            g = str(c.get("goal") or "").strip()
            if len(g.split()) >= 2:
                goals.append({"goal": g[:1].upper() + g[1:], "domain": c.get("domain") or _goal_domain(g),
                              "status": c.get("status") or "active", "confidence": c.get("confidence") or 0.7})
        doms = sorted({g["domain"] for g in goals})
        synthesis = ("Here's the foundation I'm hearing — a plan across "
                     + (", ".join(doms) if doms else "your goals") + ".") if goals else ""
        return _json.dumps({"north_star": synthesis, "time_horizon": "", "goals": goals, "values": [],
                            "deprioritized_domains": [], "main_priority": "",
                            "dependencies": [g["goal"] for g in goals][:6],
                            "synthesis": synthesis, "next_question": ""}), {}
