"""Sprint 12 — Compensation & Benefits Intelligence."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.comp_benefits import CompensationBenefitsEngine, marginal_rate

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _docs() -> dict:
    return {"documents": [
        {"id": "d1", "user_id": CTX.user_id, "doc_type": "offer_letter", "uploaded_at": "2026-06-08",
         "extracted_json": {"base_salary": "192000", "annual_bonus": "18", "signing_bonus": "30000", "equity_grant": "400000"}},
        {"id": "d2", "user_id": CTX.user_id, "doc_type": "401k_statement", "uploaded_at": "2026-06-08",
         "extracted_json": {"contribution_rate": "6", "employer_match": "4", "total_balance": "85000"}},
        {"id": "d3", "user_id": CTX.user_id, "doc_type": "medical_plan", "uploaded_at": "2026-06-08",
         "extracted_json": {"coverage_type": "HDHP Family", "premium": "300", "deductible": "3000"}},
        {"id": "d4", "user_id": CTX.user_id, "doc_type": "hsa", "uploaded_at": "2026-06-08",
         "extracted_json": {"employer_match": "1000", "balance": "5000"}},
        {"id": "d5", "user_id": CTX.user_id, "doc_type": "life_insurance_policy", "uploaded_at": "2026-06-08",
         "extracted_json": {"coverage_amount": "1500000"}},
    ]}


@pytest.mark.asyncio
async def test_total_compensation_from_documents():
    a = await CompensationBenefitsEngine(FakeSupabase(_docs())).analyze(CTX, healthcare_spend=4000)
    tc = a["total_compensation"]
    assert tc["base"] == 192000
    assert tc["bonus"] == pytest.approx(192000 * 0.18)  # 18% of base
    assert tc["equity_annualized"] == 100000  # 400k / 4
    assert tc["employer_benefits"] > 0  # 401k match + HSA employer
    assert tc["total"] > tc["base"]


@pytest.mark.asyncio
async def test_five_year_value_and_benefit_valuation():
    a = await CompensationBenefitsEngine(FakeSupabase(_docs())).analyze(CTX, healthcare_spend=4000)
    assert len(a["five_year_value"]["by_year"]) == 5 and a["five_year_value"]["cumulative"] > 0
    benefits = {b["benefit"] for b in a["benefit_valuation"]}
    assert any("401(k)" in b for b in benefits)
    assert any("HSA" in b for b in benefits)


@pytest.mark.asyncio
async def test_retirement_and_insurance_impact():
    a = await CompensationBenefitsEngine(FakeSupabase(_docs())).analyze(CTX, healthcare_spend=4000)
    r = a["retirement_impact"]
    assert r["annual_employer_match"] > 0 and r["projected_addition_at_retirement"] > r["annual_total"]
    assert a["insurance_impact"]["life"]["coverage"] == 1500000


@pytest.mark.asyncio
async def test_fsa_hsa_optimization_ties_to_spend():
    a = await CompensationBenefitsEngine(FakeSupabase(_docs())).analyze(CTX, healthcare_spend=4000)
    fh = a["fsa_hsa"]
    assert fh["annual_healthcare_spend"] == 4000 and fh["spend_source"] == "user-provided"
    assert fh["hsa"]["cap"] == 8550  # family HDHP
    assert fh["hsa"]["annual_tax_savings"] > 0
    assert fh["annual_net_worth_effect"] > 0


@pytest.mark.asyncio
async def test_missing_documents_reported_not_invented():
    sb = FakeSupabase({"documents": [{"id": "d1", "user_id": CTX.user_id, "doc_type": "offer_letter", "uploaded_at": "2026-06-08",
                                      "extracted_json": {"base_salary": "150000"}}]})
    a = await CompensationBenefitsEngine(sb).analyze(CTX)
    assert "401k_statement" in a["missing_documents"]
    assert "missing" in a["retirement_impact"]  # no 401k -> reported missing, not estimated
    assert a["fsa_hsa"].get("prompt")  # no spend -> prompt, not fabricated


def test_marginal_rate_brackets():
    assert marginal_rate(50000) == 0.22
    assert marginal_rate(250000) == 0.35
    assert marginal_rate(5000) == 0.10
