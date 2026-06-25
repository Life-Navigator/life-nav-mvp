"""Sprint 47 — discovery coverage: per-domain status, never blank; NBA reframing."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.discovery_coverage import DiscoveryCoverageService
from app.services.financial_resolver import FinancialInputResolver
from app.services.life_discovery import LifeDiscoveryService
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


@pytest.mark.asyncio
async def test_coverage_returns_all_domains_never_blank():
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "start a family"}])
    svc = DiscoveryCoverageService(life, sb, FinancialInputResolver(sb))
    out = await svc.coverage(CTX)
    keys = {d["domain"] for d in out["domains"]}
    assert keys == {"finance", "career", "family", "health", "education"}
    for d in out["domains"]:
        assert d["status"] in ("not_started", "started", "partial", "complete")
        assert "unlocks" in d and "coverage_pct" in d  # never blank
    # family got an objective from the goal → it should show some coverage
    fam = next(d for d in out["domains"] if d["domain"] == "family")
    assert fam["has_objective"] and fam["coverage_pct"] > 0


@pytest.mark.asyncio
async def test_uncovered_domain_is_not_started_with_unlocks():
    sb = FakeSupabase({})
    svc = DiscoveryCoverageService(LifeDiscoveryService(sb), sb)
    out = await svc.coverage(CTX)
    health = next(d for d in out["domains"] if d["domain"] == "health")
    assert health["status"] == "not_started" and health["unlocks"] and health["cta"]
    # CTA must open the HEALTH advisor (not the generic Arcana orchestrator)
    assert health["cta"] == "/dashboard/advisor?agent=health_advisor"
    assert out["overall_coverage_pct"] == 0 and out["recommendation_quality"] == "Low"
