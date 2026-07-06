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
    # CTA must open the HEALTH advisor (not the generic Arcana orchestrator), pre-seeded with a goal prompt
    assert health["cta"].startswith("/dashboard/advisor?agent=health_advisor")
    assert "seed=" in health["cta"]
    assert out["overall_coverage_pct"] == 0 and out["recommendation_quality"] == "Low"


def _uid() -> str:
    return CTX.user_id


@pytest.mark.asyncio
async def test_one_tracked_goal_advances_domain_past_the_30_floor():
    """Founder #1: setting a goal must MOVE the domain forward, not sit at 30% 'started' forever."""
    sb = FakeSupabase({"candidate_goals": [
        {"user_id": _uid(), "domain": "health", "goal_text": "Run a half marathon", "status": "confirmed"},
    ]})
    svc = DiscoveryCoverageService(LifeDiscoveryService(sb), sb)
    out = await svc.coverage(CTX)
    health = next(d for d in out["domains"] if d["domain"] == "health")
    assert health["coverage_pct"] >= 40 and health["status"] == "partial"  # 1 goal → partial, not stuck at 30


@pytest.mark.asyncio
async def test_three_tracked_goals_complete_the_domain():
    sb = FakeSupabase({"candidate_goals": [
        {"user_id": _uid(), "domain": "career", "goal_text": "Make staff engineer", "status": "confirmed"},
        {"user_id": _uid(), "domain": "career", "goal_text": "Lead a project", "status": "confirmed"},
        {"user_id": _uid(), "domain": "career", "goal_text": "Mentor two juniors", "status": "confirmed"},
    ]})
    svc = DiscoveryCoverageService(LifeDiscoveryService(sb), sb)
    out = await svc.coverage(CTX)
    career = next(d for d in out["domains"] if d["domain"] == "career")
    assert career["coverage_pct"] >= 80 and career["status"] == "complete"


@pytest.mark.asyncio
async def test_finance_planning_goal_advances_finance_coverage():
    """A finance short-term target lives in finance.financial_planning_goals (not candidate_goals) — it must
    still advance finance coverage."""
    sb = FakeSupabase({"financial_planning_goals": [
        {"user_id": _uid(), "goal_type": "emergency_fund", "label": "Build a $25k emergency fund",
         "target_amount": 25000, "status": "active"},
    ]})
    svc = DiscoveryCoverageService(LifeDiscoveryService(sb), sb, FinancialInputResolver(sb))
    out = await svc.coverage(CTX)
    finance = next(d for d in out["domains"] if d["domain"] == "finance")
    assert finance["coverage_pct"] >= 40 and finance["status"] in ("partial", "complete")
