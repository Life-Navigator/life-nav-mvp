"""Elite Sprint 25 — Recommendation Operating System (registry/collector/prioritize/conflict/lifecycle)."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.recommendations_os import RecommendationOS, _now as _now_iso

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


# ---- Sprint 28: dedup + formula + roadmap ----
@pytest.mark.asyncio
async def test_dedup_collapses_same_finding():
    os = _os()
    ev = [{"statement": "$1M protection gap", "source_table": "documents:life_insurance_policy"}]
    # three modules surface the SAME underlying finding -> must collapse to one
    await os.write(CTX, title="Family gap", source_module="readiness:family", category="family", finding_key="protection_gap", confidence=0.6, evidence=ev, impacted_domains=["family"])
    await os.write(CTX, title="Survivor gap", source_module="family_office", category="family", finding_key="protection_gap", confidence=0.7, evidence=ev, impacted_domains=["family", "survivor"])
    await os.write(CTX, title="Legacy gap", source_module="family_office", rec_type="RISK", category="family", finding_key="protection_gap", confidence=0.65, evidence=ev, impacted_domains=["legacy"])
    p = await os.prioritize(CTX, top=10)
    protection = [a for a in p["top_actions"] if a.get("finding") or a["title"] in ("Family gap", "Survivor gap", "Legacy gap")]
    assert len(protection) == 1  # collapsed to ONE
    assert set(protection[0]["impacted_domains"]) >= {"family", "survivor", "legacy"}  # impacts merged
    assert p["deduped_total"] == 1


@pytest.mark.asyncio
async def test_formula_inputs_are_visible():
    os = _os()
    await os.write(CTX, title="Increase 401k", source_module="comp", category="finance", confidence=0.9, estimated_effort="low",
                   quantified_impact={"readiness_delta": 6, "financial_impact_annual": 5000},
                   evidence=[{"statement": "match", "source_table": "documents:401k_statement"}])
    a = (await os.prioritize(CTX, top=1))["top_actions"][0]
    f = a["formula"]
    for k in ("impact", "confidence", "urgency", "evidence_strength", "effort", "priority_score"):
        assert k in f
    assert f["formula"] == "Impact × Confidence × Urgency × Evidence ÷ Effort"


@pytest.mark.asyncio
async def test_roadmap_now_next_later_and_why():
    os = _os()
    ev = [{"statement": "e", "source_table": "documents:d"}]
    await os.write(CTX, title="A big win", source_module="m1", category="finance", confidence=0.9, estimated_effort="low",
                   quantified_impact={"readiness_delta": 8, "financial_impact_annual": 6000}, evidence=ev)
    await os.write(CTX, title="B medium", source_module="m2", category="finance", confidence=0.7, estimated_effort="medium", evidence=ev)
    await os.write(CTX, title="C smaller", source_module="m3", category="health", confidence=0.5, estimated_effort="high", evidence=ev)
    await os.write(CTX, title="D later", source_module="m4", category="career", confidence=0.4, estimated_effort="high", evidence=ev)
    rm = await os.roadmap(CTX)
    assert len(rm["now"]) == 1 and rm["now"][0]["title"] == "A big win"  # single highest-leverage
    assert len(rm["next"]) <= 2 and rm["later"]  # Next then Later
    assert rm["why_now"]  # explains the #1


@pytest.mark.asyncio
async def test_why_ranking_explains_number_one():
    os = _os()
    ev = [{"statement": "e", "source_table": "documents:d"}]
    await os.write(CTX, title="Top", source_module="m1", category="finance", confidence=0.95, estimated_effort="low",
                   quantified_impact={"readiness_delta": 9, "financial_impact_annual": 8000}, evidence=ev)
    await os.write(CTX, title="Second", source_module="m2", category="finance", confidence=0.6, estimated_effort="high", evidence=ev)
    p = await os.prioritize(CTX, top=3)
    wr = p["why_ranking"]
    assert "why_number_one" in wr and wr["ranked_above"]
    assert wr["ranked_above"][0]["over"] == "Second"


# ---- Sprint 29: freshness, aging, learning ----
class _FreshOS(RecommendationOS):
    """A tiny full-OS stub: a fixed signature flips after 'change()' so ensure_fresh re-syncs."""
    def __init__(self, sb):
        super().__init__(sb, readiness=object())  # non-None -> ensure_fresh is active
        self._sig = "A"
        self._synced = 0
    async def _signature(self, ctx):  # type: ignore[override]
        return self._sig
    async def sync(self, ctx):  # type: ignore[override]
        self._synced += 1
        await self._sb.upsert("sync_state", {"user_id": ctx.user_id, "tenant_id": ctx.user_id, "signature": self._sig}, schema="recommendations")
        return {"written": 0}


@pytest.mark.asyncio
async def test_reads_auto_resync_when_inputs_change_no_button():
    os = _FreshOS(FakeSupabase({}))
    assert await os.ensure_fresh(CTX) is True   # first time: no state -> sync
    assert await os.ensure_fresh(CTX) is False  # unchanged signature -> no re-sync
    os._sig = "B"                               # an input changed (e.g. a document uploaded)
    assert await os.ensure_fresh(CTX) is True   # auto re-sync, no manual trigger
    assert os._synced == 2


@pytest.mark.asyncio
async def test_aging_decays_priority():
    fresh = {"formula": {"priority_score": 1.0}, "updated_at": _now_iso()}
    old = {"formula": {"priority_score": 1.0}, "updated_at": "2025-01-01T00:00:00+00:00"}
    assert RecommendationOS._score(fresh) > RecommendationOS._score(old)  # stale loses priority
    assert RecommendationOS._score(old) >= 0.5  # but never below the floor


@pytest.mark.asyncio
async def test_learning_downweights_dismissed_findings_only():
    os = _os()
    ev = [{"statement": "e", "source_table": "documents:d"}]
    await os.write(CTX, title="Often dismissed", source_module="m", category="finance", finding_key="F_DIS", confidence=0.9, evidence=ev)
    await os.write(CTX, title="Never touched", source_module="m2", category="finance", finding_key="F_OK", confidence=0.9, evidence=ev)
    recs = await os.active(CTX)
    base_dis = RecommendationOS._score(next(r for r in recs if r["finding_key"] == "F_DIS"))
    learned, _ = os._rankable(recs, {"F_DIS": 0.4})  # behaviour: this finding was dismissed
    dis = next(r for r in learned if r["finding_key"] == "F_DIS")
    ok = next(r for r in learned if r["finding_key"] == "F_OK")
    assert RecommendationOS._score(dis) < base_dis      # down-weighted by learning
    assert RecommendationOS._score(ok) >= RecommendationOS._score(dis)  # untouched ranks above


# ---- Sprint 31: recomputed impact, personalized classes, audit + gates ----
class _PlanStub:
    """A planning engine whose success probability rises with contribution (real before/after)."""
    async def plan(self, ctx, *, monthly_contribution=None, **_):
        if monthly_contribution is None:
            return {"available": True, "inputs": {"annual_contribution": 6000.0},
                    "retirement_readiness": {"readiness_ratio": 0.60},
                    "readiness_inputs": {"retirement_success_probability": 0.63}}
        return {"available": True, "inputs": {"annual_contribution": monthly_contribution * 12},
                "retirement_readiness": {"readiness_ratio": 0.75},
                "readiness_inputs": {"retirement_success_probability": 0.78}}


@pytest.mark.asyncio
async def test_recompute_is_real_not_structural():
    os = RecommendationOS(FakeSupabase({}), planning=_PlanStub())
    rc = await os._recompute_retirement(CTX, 11000 / 12.0)
    assert rc["retirement_success_before_pct"] == 63 and rc["retirement_success_after_pct"] == 78  # real MC, not +5
    assert rc["success_delta_pts"] == 15 and rc["recomputed"] is True
    assert rc["readiness_delta"] == round(0.4 * (75 - 60))  # blend-recomputed, not hardcoded
    assert len(rc["calculation_trace"]) == 3


@pytest.mark.asyncio
async def test_audit_thresholds_and_gates_on_a_clean_set():
    os = _os()
    # an advisor-grade ACTION (recomputed) + a RISK + a personalized DEPENDENCY + an INFORMATION
    await os.write(CTX, title="Increase your 401(k) from 3% to 6%", source_module="comp_benefits", category="finance",
                   rec_type="ACTION", confidence=0.9, current_state="3%", target_state="6%",
                   quantified_impact={"recomputed": True, "financial_impact_annual": 5760, "success_delta_pts": 15},
                   assumptions=[{"label": "Tax treatment", "value": "traditional vs Roth"}],
                   evidence=[{"statement": "401k 3% vs 6%", "source_table": "documents:401k_statement"}])
    await os.write(CTX, title="Life coverage is $420,000 below your protection target", source_module="family_office", category="family",
                   rec_type="RISK", confidence=0.7, current_state="$1,500,000", target_state="$1,920,000",
                   quantified_impact={"recomputed": True, "coverage_gap": 420000, "risk_reduction": "closes the gap"},
                   evidence=[{"statement": "coverage vs need", "source_table": "documents:life_insurance_policy"}])
    a = await os.audit(CTX)
    m = a["metrics"]
    assert m["recomputed_delta_pct"] == 100   # both ACTION/RISK recomputed
    assert m["generic_template_count"] == 0 and m["metric_leak_count"] == 0
    assert m["duplicate_count"] == 0 and m["zero_confidence_ranked_count"] == 0
    assert a["reviewer_gate_results"]["CFP"] is True and a["reviewer_gate_results"]["executive_ai"] is True


@pytest.mark.asyncio
async def test_generic_recommendation_fails_exec_gate():
    os = _os()
    await os.write(CTX, title="Increase retirement contributions", source_module="m", category="finance",
                   rec_type="ACTION", confidence=0.9, evidence=[{"statement": "e", "source_table": "d"}])
    a = await os.audit(CTX)
    assert a["metrics"]["generic_template_count"] >= 1
    assert a["reviewer_gate_results"]["executive_ai"] is False  # generic -> exec/AI gate fails
