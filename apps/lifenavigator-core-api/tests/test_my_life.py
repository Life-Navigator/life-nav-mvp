"""Sprint 44 — My Life flagship aggregator: six sections from the canonical model, source-labeled."""
from __future__ import annotations

import pytest

from app.domains.career import CareerService
from app.domains.education import EducationService
from app.domains.family import FamilyService
from app.domains.finance import FinanceService
from app.domains.health import HealthService
from app.models.common import UserContext
from app.services.compensation import CompensationIntelligenceEngine
from app.services.life_discovery import LifeDiscoveryService
from app.services.market_intelligence import MarketPositionAnalyzer
from app.services.my_life import MyLifeService
from app.services.readiness import LifeReadinessEngine
from app.services.recommendations_os import RecommendationOS
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _svc(sb):
    comp = CompensationIntelligenceEngine(sb)
    domains = {"finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb),
               "career": CareerService(sb, comp, MarketPositionAnalyzer(sb)), "family": FamilyService(sb, comp)}
    readiness = LifeReadinessEngine(domains=domains, education=EducationService(sb, comp), supabase=sb)
    return MyLifeService(LifeDiscoveryService(sb), readiness, RecommendationOS(sb), sb)


@pytest.mark.asyncio
async def test_my_life_has_all_six_sections_with_sources():
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.save_vision(CTX, vision_text="Retire by 60 and raise a secure family")
    await life.discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "start a family"}])
    out = await _svc(sb).my_life(CTX)
    for sec in ("life_vision", "what_matters_most", "life_readiness", "constraints", "recent_intelligence"):
        assert sec in out
    assert out["life_vision"]["source"] == "Advisor Discovery"
    assert out["what_matters_most"]["primary_objective"] == "Build family stability"
    # depends_on/risks/opportunities are no longer archetype-derived — empty until evidence grounds them.
    assert out["what_matters_most"]["depends_on"] == []
    assert out["what_matters_most"]["risks"] == [] and out["what_matters_most"]["opportunities"] == []
    assert out["has_discovery"] is True


@pytest.mark.asyncio
async def test_my_life_recent_intelligence_feed():
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.discover_goal(CTX, surface_goal="retire early", why_chain=[{"a": "freedom and independence"}])
    out = await _svc(sb).my_life(CTX)
    feed = out["recent_intelligence"]
    assert feed and any(f["type"] == "objective" for f in feed)


@pytest.mark.asyncio
async def test_my_life_empty_for_no_discovery():
    out = await _svc(FakeSupabase({})).my_life(CTX)
    assert out["has_discovery"] is False


# ---- Addendum: disciplined dashboard attention feed (one action + <=3 alerts) ----
@pytest.mark.asyncio
async def test_attention_returns_one_action_and_capped_alerts():
    from app.services.financial_resolver import FinancialInputResolver
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.save_vision(CTX, vision_text="Retire by 60 and raise a secure family")
    await life.discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "start a family"}])
    comp = CompensationIntelligenceEngine(sb)
    domains = {"finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb),
               "career": CareerService(sb, comp, MarketPositionAnalyzer(sb)), "family": FamilyService(sb, comp)}
    readiness = LifeReadinessEngine(domains=domains, education=EducationService(sb, comp), supabase=sb)
    svc = MyLifeService(life, readiness, RecommendationOS(sb), sb, FinancialInputResolver(sb, comp))
    out = await svc.attention(CTX)
    assert "next_best_action" in out and "life_vision" in out
    assert len(out["alerts"]) <= 3 and out["view_all"] == "/dashboard/recommendations"
    # alerts are severity-ordered (high before low)
    rank = {"high": 0, "medium": 1, "low": 2}
    sev = [rank[a["severity"]] for a in out["alerts"]]
    assert sev == sorted(sev)
    # each alert is source-labeled with a CTA
    assert all(a.get("source") and a.get("cta") for a in out["alerts"])


# ---- Sprint 46: next best action biases to ACTION, not RISK ----
@pytest.mark.asyncio
async def test_next_best_action_prefers_action_over_risk(monkeypatch):
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "start a family"}])
    comp = CompensationIntelligenceEngine(sb)
    domains = {"finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb),
               "career": CareerService(sb, comp, MarketPositionAnalyzer(sb)), "family": FamilyService(sb, comp)}
    readiness = LifeReadinessEngine(domains=domains, education=EducationService(sb, comp), supabase=sb)
    svc = MyLifeService(life, readiness, RecommendationOS(sb), sb)

    async def fake_prioritize(ctx, top=3):
        return {"top_actions": [
            {"title": "Income loss risk", "rec_type": "RISK", "confidence": 0.9, "quantified_impact": {}},
            {"title": "Increase 401(k) to capture match", "rec_type": "ACTION", "confidence": 0.85, "quantified_impact": {}},
        ]}
    monkeypatch.setattr(svc._os, "prioritize", fake_prioritize)
    out = await svc.my_life(CTX)
    nba = out["next_best_action"]
    assert nba and nba["rec_type"] == "ACTION" and "401(k)" in nba["title"]  # RISK was skipped


# ---- Dashboard Trust Fix: no invented risks/opps, honest north star, honest priority ----
@pytest.mark.asyncio
async def test_generic_archetype_risks_and_opps_are_not_surfaced():
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.discover_goal(CTX, surface_goal="retire early", why_chain=[{"a": "freedom and independence"}])
    out = await _svc(sb).my_life(CTX)
    risks = out["what_matters_most"]["risks"]
    opps = out["what_matters_most"]["opportunities"]
    # Archetype templates must NOT appear as personalized dashboard risks/opps without grounding.
    for generic in ("Outliving your assets", "Sequence-of-returns risk"):
        assert generic not in risks
    for generic in ("Full employer 401(k) match", "Tax-advantaged accounts"):
        assert generic not in opps


@pytest.mark.asyncio
async def test_grounded_recommendation_risk_surfaces(monkeypatch):
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.discover_goal(CTX, surface_goal="retire early", why_chain=[{"a": "freedom"}])
    svc = _svc(sb)

    async def fake_prioritize(ctx, top=6):
        return {"top_actions": [{"title": "Underfunded emergency reserve", "rec_type": "RISK", "confidence": 0.8}]}

    monkeypatch.setattr(svc._os, "prioritize", fake_prioritize)
    out = await svc.my_life(CTX)
    assert "Underfunded emergency reserve" in out["what_matters_most"]["risks"]  # grounded → shown
    assert out["next_best_action"]["kind"] == "priority_issue"


@pytest.mark.asyncio
async def test_persona_bridge_vision_is_not_confirmed_north_star():
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.save_vision(CTX, vision_text="Build security and progress through mid-career.",
                           prompts={"source": "persona_bridge"})
    await life.discover_goal(CTX, surface_goal="retire early", why_chain=[{"a": "freedom"}])
    v = (await _svc(sb).my_life(CTX))["life_vision"]
    assert v["vision_authored"] is False
    assert v["vision_confirmed"] is False
    assert v["objective_inferred"] is True
    assert v["source"] == "Inferred from onboarding"
    assert v["provenance"]["provenance_type"] == "advisor_inferred"  # inferred, NOT confirmed fact


@pytest.mark.asyncio
async def test_authored_vision_is_advisor_sourced():
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.save_vision(CTX, vision_text="Retire by 60 and raise a secure family")  # no persona source
    v = (await _svc(sb).my_life(CTX))["life_vision"]
    assert v["vision_authored"] is True and v["source"] == "Advisor Discovery"
    assert v["provenance"]["provenance_type"] in ("user_stated", "user_confirmed")  # never 'assumption'


@pytest.mark.asyncio
async def test_no_grounded_action_yields_honest_insufficient_state():
    nba = (await _svc(FakeSupabase({})).my_life(CTX))["next_best_action"]
    assert nba["kind"] == "insufficient"
    assert "Not enough information" in nba["title"]
    assert "income" in nba["needed_to_act"].lower()


# ---- Data Flow & Rendering Integrity: canonical rendering contract on /v1/life/my-life ----
@pytest.mark.asyncio
async def test_my_life_exposes_full_canonical_contract():
    """Every understood-but-previously-unexposed block is present (honest residuals, never fabricated)."""
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    rm_vision = "Get married next year, buy a home, and start a family"
    await life.save_vision(CTX, vision_text=rm_vision)
    await life.discover_goal(CTX, surface_goal="buy a house", why_chain=[{"a": "start a family"}])
    out = await _svc(sb).my_life(CTX)
    for field in ("dominant_narrative", "narrative_summary", "goal_portfolio", "canonical_goals",
                  "constraints", "motivations", "emotional_signals", "timeline", "coverage",
                  "missing_context", "what_matters_most", "next_best_action", "life_brief"):
        assert field in out, f"canonical contract missing {field}"
    # coverage is honest (real areas, never blank claims) and timeline is pass-through (no parsed dates)
    assert "missing_areas" in out["coverage"] and "covered_areas" in out["coverage"]
    assert out["timeline"]["structured"] is False
    assert "risks" in out["what_matters_most"] and "opportunities" in out["what_matters_most"]


@pytest.mark.asyncio
async def test_my_life_timeline_is_passthrough_not_parsed():
    """time_horizon free text is surfaced verbatim; we never parse 'next June' into a date (residual gap)."""
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.save_vision(CTX, vision_text="Build a family",
                           prompts={"time_horizon": "we're aiming for next June", "source": "relationship_manager"})
    out = await _svc(sb).my_life(CTX)
    tl = out["timeline"]
    assert tl["time_horizon_text"] == "we're aiming for next June"  # raw, unparsed
    assert tl["structured"] is False
    assert isinstance(tl["future_goals"], list)


@pytest.mark.asyncio
async def test_my_life_motivations_are_inferred_from_signals_never_confirmed():
    """Motivations are surfaced from emotional_signals (discovery never writes life.motivations) and are
    always provenance_type=advisor_inferred — candidate/inferred is never promoted to a confirmed fact."""
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    # A narrative with clear emotional signals (family + ambition) so motivations are non-empty.
    await life.save_vision(CTX, vision_text="I'm getting married and want to get promoted to director")
    # persist candidate goals so the snapshot narrative + signals compute
    await sb.upsert("candidate_goals", {"id": "c1", "user_id": CTX.user_id, "tenant_id": CTX.user_id,
                                        "goal_text": "get married", "normalized_goal": "get married",
                                        "domain": "family", "confidence": 0.7, "status": "active"}, schema="life")
    # also seed the narrative free text so dominant_narrative has signals
    await life.save_vision(CTX, vision_text="x", prompts={"narrative": "getting married and want a promotion to director"})
    out = await _svc(sb).my_life(CTX)
    for m in out["motivations"]:
        assert m["provenance_type"] == "advisor_inferred"  # NEVER confirmed
        assert m.get("signal") and m.get("text")
    # honest: emotional_signals list is exposed verbatim alongside motivations
    assert isinstance(out["emotional_signals"], list)


@pytest.mark.asyncio
async def test_my_life_coverage_is_honest_about_missing_areas():
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.discover_goal(CTX, surface_goal="get a new job", why_chain=[{"a": "burned out"}])  # career only
    out = await _svc(sb).my_life(CTX)
    cov = out["coverage"]
    assert "career" in cov["covered_areas"]
    # missing areas are surfaced honestly as missing_context entries (no fabricated data)
    assert out["missing_context"], "missing areas should surface as honest missing_context"
    assert all(mc.get("area") and mc.get("cta") for mc in out["missing_context"])


@pytest.mark.asyncio
async def test_attention_surfaces_risk_alerts_regression():
    """Regression: attention() previously called active().get(...) on a LIST and checked the wrong
    field name, so the except swallowed an AttributeError and RISK alerts NEVER surfaced. Lock it in."""
    sb = FakeSupabase({})
    life = LifeDiscoveryService(sb)
    await life.save_vision(CTX, vision_text="Protect my family")
    os = RecommendationOS(sb)
    ev = [{"statement": "Protection gap detected", "source_table": "documents"}]
    await os.write(CTX, title="Coverage gap leaves family exposed", source_module="family_office",
                   rec_type="RISK", category="family", finding_key="protection_gap", confidence=0.7, evidence=ev,
                   impacted_domains=["legacy"])
    out = await _svc(sb).attention(CTX)
    risk_alerts = [a for a in out["alerts"] if a.get("severity") == "high"
                   and a.get("source") == "Recommendation OS"]
    assert risk_alerts, "RISK recommendation must surface as a high-severity attention alert"
    assert "Coverage gap" in risk_alerts[0]["title"]
