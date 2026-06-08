"""Sprint 9 — Beta instrumentation: event emit + Executive Dashboard (counts only)."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.analytics import AnalyticsService

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _seed() -> dict:
    return {
        "reports": [{"id": "r1", "user_id": CTX.user_id, "report_type": "education"},
                    {"id": "r2", "user_id": CTX.user_id, "report_type": "full"}],
        "report_shares": [{"id": "s1", "user_id": CTX.user_id, "audience": "parent", "revoked": False}],
        "share_access_log": [{"id": "l1", "user_id": CTX.user_id}],
        "decisions": [{"id": "d1", "user_id": CTX.user_id, "decision_type": "new_job"}],
        "career_goals": [{"id": "g1", "user_id": CTX.user_id}],
        "career_recommendations": [{"id": "cr1", "user_id": CTX.user_id}],
    }


@pytest.mark.asyncio
async def test_dashboard_returns_all_sections_counts_only():
    d = await AnalyticsService(FakeSupabase(_seed())).dashboard()
    for k in ("users", "reports", "shares", "goals", "decisions", "domain_usage", "funnel"):
        assert k in d
    assert d["reports"]["total"] == 2
    assert d["reports"]["by_type"]["education"] == 1 and d["reports"]["by_type"]["full"] == 1
    assert d["shares"]["total"] == 1 and d["shares"]["by_audience"]["parent"] == 1
    assert d["shares"]["accesses"] == 1
    assert d["decisions"]["total"] == 1
    assert d["goals"]["career"] == 1
    assert d["domain_usage"]["career"] == 1


@pytest.mark.asyncio
async def test_dashboard_has_no_pii_only_aggregates():
    d = await AnalyticsService(FakeSupabase(_seed())).dashboard()
    blob = str(d)
    # only counts/types/status — no user_id, no content
    assert CTX.user_id not in blob
    assert all(isinstance(v, int) for v in d["domain_usage"].values())


@pytest.mark.asyncio
async def test_emit_records_event():
    sb = FakeSupabase({})
    svc = AnalyticsService(sb)
    await svc.emit(CTX, "report_generated", domain="report", props={"report_type": "full"})
    events = await sb.select("events", schema="analytics")
    assert len(events) == 1 and events[0]["event_type"] == "report_generated"
    # the funnel then counts it
    d = await svc.dashboard()
    assert d["funnel"]["by_type"]["report_generated"] == 1


@pytest.mark.asyncio
async def test_empty_platform_is_zeroed_not_fabricated():
    d = await AnalyticsService(FakeSupabase({})).dashboard()
    assert d["reports"]["total"] == 0 and d["decisions"]["total"] == 0
    assert d["users"]["retention_7d_pct"] == 0
