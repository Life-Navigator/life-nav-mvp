"""Sprint 16 — Advanced Financial Planning Engine (retirement / Monte Carlo / SS / withdrawal)."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.comp_benefits import CompensationBenefitsEngine
from app.services.financial_planning import FinancialPlanningEngine

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
DOCS = [
    {"id": "d1", "user_id": CTX.user_id, "doc_type": "offer_letter", "uploaded_at": "2026-06-08", "extracted_json": {"base_salary": "192000"}},
    {"id": "d2", "user_id": CTX.user_id, "doc_type": "401k_statement", "uploaded_at": "2026-06-08", "extracted_json": {"total_balance": "250000", "contribution_rate": "10", "employer_match": "4"}},
    {"id": "d3", "user_id": CTX.user_id, "doc_type": "social_security_estimate", "uploaded_at": "2026-06-08", "extracted_json": {"monthly_benefit_at_67": "2800", "monthly_benefit_at_62": "1960", "monthly_benefit_at_70": "3470"}},
    {"id": "d4", "user_id": CTX.user_id, "doc_type": "life_insurance_policy", "uploaded_at": "2026-06-08", "extracted_json": {"coverage_amount": "1000000"}},
]


def _eng(docs=DOCS, extra=None) -> FinancialPlanningEngine:
    rows = {"documents": docs}
    if extra:
        rows.update(extra)
    sb = FakeSupabase(rows)
    return FinancialPlanningEngine(supabase=sb, comp_benefits=CompensationBenefitsEngine(sb))


@pytest.mark.asyncio
async def test_plan_produces_retirement_readiness_and_monte_carlo():
    p = await _eng().plan(CTX, current_age=40, retirement_age=67)
    assert p["available"] is True
    rr = p["retirement_readiness"]
    assert rr["target_nest_egg"] > 0 and rr["projected_median"] > 0 and rr["readiness_ratio"] is not None
    mc = p["monte_carlo"]
    assert mc["p10"] <= mc["p50"] <= mc["p90"] and mc["simulations"] == 1000
    assert 0 <= mc["success_probability_vs_target"] <= 1


@pytest.mark.asyncio
async def test_monte_carlo_is_reproducible():
    p1 = await _eng().plan(CTX, current_age=40, retirement_age=67)
    p2 = await _eng().plan(CTX, current_age=40, retirement_age=67)
    assert p1["monte_carlo"]["p50"] == p2["monte_carlo"]["p50"]  # seeded -> reproducible
    assert p1["monte_carlo"]["success_probability_vs_target"] == p2["monte_carlo"]["success_probability_vs_target"]


@pytest.mark.asyncio
async def test_social_security_from_document_and_claim_age():
    p = await _eng().plan(CTX)
    ss = p["social_security"]
    assert ss["monthly_at_67"] == 2800 and ss["monthly_at_70"] == 3470
    assert ss["optimal_claim_age"] == 70 and "document" in ss["source"]


@pytest.mark.asyncio
async def test_insurance_optimization_and_withdrawal():
    p = await _eng().plan(CTX)
    assert p["insurance_optimization"]["life"]["current"] == 1000000
    w = p["withdrawal_planning"]
    assert w["withdrawal_rate"] == 0.04 and w["sustainable_annual_withdrawal"] >= 0


@pytest.mark.asyncio
async def test_goal_funding_probability():
    extra = {"financial_goals": [{"id": "g1", "user_id": CTX.user_id, "name": "House down payment", "target_amount": "100000", "current_amount": "40000", "monthly_contribution": "1500"}]}
    p = await _eng(extra=extra).plan(CTX)
    gf = p["goal_funding"]
    assert gf and 0 <= gf[0]["probability"] <= 1 and gf[0]["goal"] == "House down payment"


@pytest.mark.asyncio
async def test_no_data_returns_prompt_not_fabricated_plan():
    p = await _eng(docs=[]).plan(CTX)
    assert p["available"] is False and p.get("prompt")


@pytest.mark.asyncio
async def test_readiness_inputs_exposed():
    p = await _eng().plan(CTX)
    ri = p["readiness_inputs"]
    assert "retirement_readiness_ratio" in ri and "retirement_success_probability" in ri
