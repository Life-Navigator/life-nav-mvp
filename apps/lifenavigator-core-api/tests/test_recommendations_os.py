"""Elite Sprint 25 — Recommendation Operating System (registry/collector/prioritize/conflict/lifecycle)."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.recommendations_os import RecommendationOS

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _os(rows=None) -> RecommendationOS:
    return RecommendationOS(FakeSupabase(rows or {}))


@pytest.mark.asyncio
async def test_write_requires_evidence_no_orphans():
    os = _os()
    rid = await os.write(CTX, title="Do X", source_module="test", category="finance", evidence=[])
    assert rid is None  # no evidence -> no recommendation (Deliverable 3 integrity)
    rid2 = await os.write(CTX, title="Do X", source_module="test", category="finance",
                          evidence=[{"statement": "because Y", "source_table": "docs"}])
    assert rid2 is not None


@pytest.mark.asyncio
async def test_write_is_idempotent_no_duplicates():
    os = _os()
    ev = [{"statement": "e", "source_table": "d"}]
    a = await os.write(CTX, title="Same", source_module="m", category="finance", evidence=ev)
    b = await os.write(CTX, title="Same", source_module="m", category="finance", evidence=ev)
    assert a == b  # deterministic id -> upsert, not duplicate
    recs = await os.active(CTX)
    assert len([r for r in recs if r["title"] == "Same"]) == 1


@pytest.mark.asyncio
async def test_every_recommendation_has_the_required_fields():
    os = _os()
    await os.write(CTX, title="R", source_module="comp_benefits", category="finance",
                   evidence=[{"statement": "e", "source_table": "documents:401k"}], confidence=0.7,
                   impacted_domains=["finance"], readiness_impact={"domain": "finance"}, recommended_action="do it")
    r = (await os.active(CTX))[0]
    for f in ("id", "title", "category", "source_module", "priority", "status", "confidence",
              "evidence", "impacted_domains", "readiness_impact", "recommended_action", "chat_visibility", "report_visibility"):
        assert f in r


@pytest.mark.asyncio
async def test_prioritize_gives_one_ranked_answer():
    os = _os()
    ev = [{"statement": "e", "source_table": "d"}]
    await os.write(CTX, title="High free money", source_module="comp_benefits", category="finance", priority="high", confidence=0.9, evidence=ev, estimated_effort="low")
    await os.write(CTX, title="Low minor tweak", source_module="x", category="finance", priority="low", confidence=0.4, evidence=ev, estimated_effort="high")
    p = await os.prioritize(CTX, top=3)
    assert p["top_actions"][0]["title"] == "High free money"  # ranked, not arbitrary
    assert p["top_actions"][0]["why"] and "note" in p


@pytest.mark.asyncio
async def test_conflict_engine_detects_competing_resource():
    os = _os()
    ev = [{"statement": "e", "source_table": "d"}]
    await os.write(CTX, title="Max 401k", source_module="comp", category="finance", priority="high", evidence=ev, resource="savings_dollars")
    await os.write(CTX, title="Pay down debt", source_module="fin", category="finance", priority="high", evidence=ev, resource="savings_dollars")
    conflicts = await os.conflicts(CTX)
    assert conflicts and conflicts[0]["resource"] == "savings_dollars"
    assert len(conflicts[0]["competing"]) == 2 and conflicts[0]["suggested_sequence"]


@pytest.mark.asyncio
async def test_lifecycle_tracks_status_and_events():
    os = _os()
    rid = await os.write(CTX, title="R", source_module="m", category="finance", evidence=[{"statement": "e", "source_table": "d"}])
    res = await os.set_status(CTX, rid, "accepted")
    assert res["updated"] and res["status"] == "accepted"
    # dismissed/completed drop out of the active list
    await os.set_status(CTX, rid, "dismissed")
    assert all(r["id"] != rid for r in await os.active(CTX))


@pytest.mark.asyncio
async def test_invalid_status_rejected():
    os = _os()
    rid = await os.write(CTX, title="R", source_module="m", category="finance", evidence=[{"statement": "e", "source_table": "d"}])
    with pytest.raises(ValueError):
        await os.set_status(CTX, rid, "banana")


# ---- Sprint 26: consumer consistency (same OS top everywhere) ----
@pytest.mark.asyncio
async def test_chat_next_action_reads_the_same_os():
    from app.agents.orchestrator import LifeOrchestratorAgent
    sb = FakeSupabase({})
    os_engine = RecommendationOS(sb)
    await os_engine.write(CTX, title="Maximize your 401(k) match", source_module="comp_benefits", category="finance",
                          priority="high", confidence=0.9, evidence=[{"statement": "Employer match $4,000/yr", "source_table": "documents:401k"}],
                          recommended_action="Contribute to the full match", estimated_effort="low")
    orch = LifeOrchestratorAgent(context_builder=None, gemini=None, trust_safety=None, memory=None, recommendation_os=os_engine)
    assert orch._is_next_action_query("what should I do next?") is True
    resp = await orch._answer_from_os(CTX, "what should I do next?", None)
    pri = await os_engine.prioritize(CTX, top=1)
    # chat's answer is the SAME top recommendation the OS prioritizes (== dashboard)
    assert pri["top_actions"][0]["title"] in resp.message
    assert resp.used_gemini is False and resp.grounded is True


@pytest.mark.asyncio
async def test_report_recommendations_come_from_os():
    from app.domains.career import CareerService
    from app.domains.education import EducationService
    from app.domains.family import FamilyService
    from app.domains.finance import FinanceService
    from app.domains.health import HealthService
    from app.services.compensation import CompensationIntelligenceEngine
    from app.services.market_intelligence import MarketPositionAnalyzer
    from app.services.report_engine import UniversalReportEngine
    sb = FakeSupabase({"financial_accounts": [{"id": "a1", "account_type": "depository", "current_balance": 5000}]})
    os_engine = RecommendationOS(sb)
    await os_engine.write(CTX, title="Build your emergency fund", source_module="readiness:finance", category="finance",
                          priority="high", confidence=0.7, evidence=[{"statement": "Low cash buffer", "source_table": "finance"}])
    comp = CompensationIntelligenceEngine(sb)
    domains = {"finance": FinanceService(supabase=sb), "health": HealthService(supabase=sb),
               "career": CareerService(sb, comp, MarketPositionAnalyzer(sb)), "family": FamilyService(sb, comp)}
    engine = UniversalReportEngine(domains=domains, education=EducationService(sb, comp), supabase=sb, reco_os=os_engine)
    rpt = await engine.build(CTX, "financial")
    sec = next((s for s in rpt.sections if s.key == "prioritized_recommendations"), None)
    pri = await os_engine.prioritize(CTX, top=5)
    assert sec is not None
    assert sec.recommendations[0].id == pri["top_actions"][0]["id"]  # report == OS, no report-only recs


# ---- Sprint 27: quality engine ----
@pytest.mark.asyncio
async def test_confidence_floor_excludes_low_confidence_from_top():
    os = _os()
    ev = [{"statement": "e", "source_table": "d"}]
    await os.write(CTX, title="Solid action", source_module="m", category="finance", priority="high", confidence=0.9, evidence=ev)
    await os.write(CTX, title="Shaky guess", source_module="m2", category="finance", priority="high", confidence=0.1, evidence=ev)
    p = await os.prioritize(CTX, top=5)
    titles = [a["title"] for a in p["top_actions"]]
    assert "Solid action" in titles and "Shaky guess" not in titles  # <0.25 cannot rank
    assert any(n["title"] == "Shaky guess" for n in p["needs_more_information"])


@pytest.mark.asyncio
async def test_dependency_and_information_never_rank_as_actions():
    os = _os()
    ev = [{"statement": "e", "source_table": "d"}]
    await os.write(CTX, title="Upload your 401k", source_module="m", category="finance", rec_type="DEPENDENCY", priority="high", confidence=0.9, evidence=ev)
    await os.write(CTX, title="Your cholesterol is 210", source_module="h", category="health", rec_type="INFORMATION", priority="low", confidence=0.5, evidence=ev)
    await os.write(CTX, title="Increase 401k 6% to 10%", source_module="c", category="finance", rec_type="ACTION", priority="high", confidence=0.9, evidence=ev)
    p = await os.prioritize(CTX, top=5)
    assert [a["title"] for a in p["top_actions"]] == ["Increase 401k 6% to 10%"]
    assert {n["title"] for n in p["needs_more_information"]} == {"Upload your 401k", "Your cholesterol is 210"}


@pytest.mark.asyncio
async def test_quantified_fields_persisted_and_surfaced():
    os = _os()
    await os.write(CTX, title="Increase your 401(k) from 6% to 10%", source_module="comp_benefits", category="finance",
                   rec_type="ACTION", priority="high", confidence=0.9, current_state="6%", target_state="10%", delta_text="+4%",
                   quantified_impact={"readiness_before": 45, "readiness_after": 51, "financial_impact_annual": 4800},
                   recommended_action="Raise to 10%", evidence=[{"statement": "401k at 6% vs 10% match", "source_table": "documents:401k_statement"}])
    a = (await os.prioritize(CTX, top=1))["top_actions"][0]
    assert a["current_state"] == "6%" and a["target_state"] == "10%" and a["delta"] == "+4%"
    assert a["quantified_impact"]["financial_impact_annual"] == 4800
    assert a["rec_type"] == "ACTION" and a["narrative"]["current"] == "6%"
