"""Family F2 — FamilyService Decision Engine + 5 recommendation families."""
from __future__ import annotations

import pytest

from app.domains.family import FamilyService
from app.models.common import UserContext
from app.services.compensation import CompensationIntelligenceEngine

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")

BANDS = [{"occupation_code": "15-2051", "geography": "US", "p10": 60000, "p25": 75000, "p50": 95000, "p75": 120000, "p90": 145000, "currency": "USD", "confidence": 0.8, "source_name": "BLS OEWS May 2024", "as_of_date": "2024-05-01"}]
CAREER_PROFILE = {"id": "cp1", "current_title": "Data Analyst", "seniority_level": "mid", "location": "US"}
DEPENDENTS = [{"id": "d1", "relationship": "child", "birth_year": 2015}, {"id": "d2", "relationship": "child", "birth_year": 2018}]
INSURANCE = {"id": "i1", "life_coverage": 100000, "disability_coverage": 0}
ESTATE_INCOMPLETE = {"id": "e1", "has_will": False, "has_poa": False, "has_beneficiaries": True, "status": "incomplete"}
GUARDIAN_UNDESIGNATED = {"id": "g1", "status": "undesignated"}
GUARDIAN_DESIGNATED = {"id": "g1", "status": "designated", "designated_guardian": "sibling"}
COLLEGE = [{"id": "c1", "target_year": 2033, "projected_cost": 120000, "saved_amount": 8000, "vehicle": "529"}]
DEBTS = [{"id": "db1", "current_balance": 15000}]

FULL = {
    "dependents": DEPENDENTS, "insurance_profiles": [INSURANCE], "estate_plans": [ESTATE_INCOMPLETE],
    "guardianship_plans": [GUARDIAN_UNDESIGNATED], "college_planning": COLLEGE,
    "career_profiles": [CAREER_PROFILE], "debts": DEBTS, "compensation_bands": BANDS,
}


def _svc(rows: dict) -> FamilyService:
    sb = FakeSupabase(rows)
    return FamilyService(sb, CompensationIntelligenceEngine(sb))


# ---- Decision: all 5 families ----
@pytest.mark.asyncio
async def test_all_five_families_fire_with_full_data():
    rows = await _svc(FULL).persist_recommendations(CTX)
    types = {r["recommendation_type"] for r in rows}
    assert {"insurance_gap", "guardianship_gap", "estate_gap", "college_funding", "survivor_scenario"} <= types
    for r in rows:
        assert r["evidence_json"]  # every rec evidence-backed
        assert r["governance_verdict"]["boundary_type"] in ("family_planning", "legal")


@pytest.mark.asyncio
async def test_insurance_gap_evidence_and_need_calc():
    rows = await _svc(FULL).persist_recommendations(CTX)
    ins = next(r for r in rows if r["recommendation_type"] == "insurance_gap")
    metrics = {e["metric_name"]: e["metric_value"] for e in ins["evidence_json"]}
    assert metrics["life_coverage"] == 100000
    assert metrics["insurance_need"] == 95000 * 10 + 15000  # 10x income + debt, cited
    assert ins["governance_verdict"]["escalation_path"] == "licensed_advisor"


@pytest.mark.asyncio
async def test_guardianship_and_estate_use_legal_boundary():
    rows = await _svc(FULL).persist_recommendations(CTX)
    for t in ("guardianship_gap", "estate_gap"):
        r = next(x for x in rows if x["recommendation_type"] == t)
        assert r["governance_verdict"]["boundary_type"] == "legal"
        assert r["governance_verdict"]["escalation_path"] == "attorney"


@pytest.mark.asyncio
async def test_guardianship_gap_not_fired_when_designated():
    rows = await _svc({**FULL, "guardianship_plans": [GUARDIAN_DESIGNATED]}).persist_recommendations(CTX)
    assert not any(r["recommendation_type"] == "guardianship_gap" for r in rows)  # honest: they have a guardian


@pytest.mark.asyncio
async def test_college_funding_gap():
    rows = await _svc(FULL).persist_recommendations(CTX)
    col = next(r for r in rows if r["recommendation_type"] == "college_funding")
    metrics = {e["metric_name"] for e in col["evidence_json"]}
    assert {"projected_cost", "saved_amount"} <= metrics
    assert "education" in col["affected_domains"]


@pytest.mark.asyncio
async def test_survivor_scenario_has_shortfall_evidence():
    rows = await _svc(FULL).persist_recommendations(CTX)
    surv = next(r for r in rows if r["recommendation_type"] == "survivor_scenario")
    metrics = {e["metric_name"] for e in surv["evidence_json"]}
    assert {"income_at_risk", "life_coverage", "protection_shortfall"} <= metrics


@pytest.mark.asyncio
async def test_no_insurance_gap_when_well_covered():
    rows = await _svc({**FULL, "insurance_profiles": [{"id": "i2", "life_coverage": 2000000}]}).persist_recommendations(CTX)
    assert not any(r["recommendation_type"] == "insurance_gap" for r in rows)  # coverage exceeds need


@pytest.mark.asyncio
async def test_no_recommendation_without_data():
    assert await _svc({}).persist_recommendations(CTX) == []


# ---- Summary + chat ----
@pytest.mark.asyncio
async def test_summary_sections_and_prompts():
    vm = await _svc({}).summary(CTX)
    assert vm.domain == "family"
    assert "dependents" in vm.missing
    btypes = {b["boundary_type"] for b in vm.data["safety_boundaries"]}
    assert {"family_planning", "legal"} <= btypes


@pytest.mark.asyncio
async def test_chat_context_cites_insurance_need_and_estate():
    ctx_obj = await _svc(FULL).chat_context(CTX)
    joined = " ".join(f"{f['fact']} {f['value']}" for f in ctx_obj.authoritative_facts)
    assert "insurance need" in joined and "estate plan" in joined


# ---- P0 My Life consistency: family PLANNING facts must not read as "no data" ----
@pytest.mark.asyncio
async def test_family_planning_facts_make_domain_not_empty():
    """Partner + pets + beneficiaries (no insurance/estate) → family is 'started', NOT 0/no-data/missing."""
    rows = {
        "family_profiles": [{"id": "fp1", "marital_status": "engaged",
                             "metadata": {"wedding_timeline": "next June", "home_goal": "first home",
                                          "children_goal": "after marriage", "partner_name": "Jenny Doe"}}],
        "pets": [{"id": "p1", "name": "Thor", "species": "dog"}],
        "beneficiaries": [{"id": "b1"}, {"id": "b2"}, {"id": "b3"}, {"id": "b4"}],
        "emergency_contacts": [{"id": "ec1"}],
        "trusted_advisors": [{"id": "a1"}, {"id": "a2"}, {"id": "a3"}],
        "career_profiles": [CAREER_PROFILE], "compensation_bands": BANDS,
    }
    vm = await _svc(rows).summary(CTX)
    # NOT empty / missing once planning facts exist
    assert vm.confidence.basis == "partial"
    assert vm.confidence.score >= 0.4
    fp = vm.data["family_planning"]
    assert fp["status"] == "started"
    assert any("Marital status" in k for k in fp["known"])
    assert any("Pets" in k for k in fp["known"])
    # Protection is SEPARATE and shows the real gaps (no will/insurance/POA)
    prot = vm.data["protection_readiness"]
    assert prot["status"] == "needs_attention"
    assert "will" in prot["missing"]
    assert "life insurance" in prot["missing"]
    # Protection KNOWN still reflects beneficiaries/contacts/advisors
    assert any("Beneficiaries" in k for k in prot["known"])


@pytest.mark.asyncio
async def test_family_truly_empty_still_missing():
    """No family facts at all → still honestly 'missing' (we did not paper over a real empty state)."""
    vm = await _svc({"career_profiles": [CAREER_PROFILE], "compensation_bands": BANDS}).summary(CTX)
    assert vm.confidence.basis == "missing"
    assert vm.data["family_planning"]["status"] == "not_started"
