"""Sprint 45 — Financial Input Resolver: canonical Supabase resolution + source + missing flags."""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.financial_resolver import FinancialInputResolver, MISSING, PLAID, ADVISOR
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


@pytest.mark.asyncio
async def test_resolves_persona_data_with_sources():
    sb = FakeSupabase({
        "financial_accounts": [{"id": "a", "user_id": CTX.user_id, "account_type": "checking", "current_balance": 8000, "plaid_account_id": "p1"}],
        "assets": [{"id": "i", "user_id": CTX.user_id, "current_value": 184250}],
        "retirement_plans": [{"id": "r", "user_id": CTX.user_id, "current_savings": 92500}],
        "risk_profiles": [{"user_id": CTX.user_id, "behavior": "moderate"}],
    })
    r = await FinancialInputResolver(sb).resolve(CTX)
    i = r["inputs"]
    assert i["cash_balance"]["present"] and i["cash_balance"]["source"] == PLAID and i["cash_balance"]["value"] == 8000
    assert i["investment_balance"]["value"] == 184250 and i["retirement_balance"]["value"] == 92500
    assert i["risk_profile"]["value"] == "moderate" and i["risk_profile"]["source"] == ADVISOR


@pytest.mark.asyncio
async def test_missing_inputs_are_named_not_defaulted():
    r = await FinancialInputResolver(FakeSupabase({})).resolve(CTX)
    i = r["inputs"]
    assert i["income"]["present"] is False and i["income"]["source"] == MISSING and i["income"]["value"] is None
    assert i["housing_target"]["source"] == MISSING  # only ever user-entered
    assert r["missing"] and any(m["input"] == "income" and m["prompt"] for m in r["missing"])


@pytest.mark.asyncio
async def test_401k_resolves_from_uploaded_document():
    sb = FakeSupabase({"documents": [{"id": "d", "user_id": CTX.user_id, "doc_type": "401k_statement",
                                       "extracted_json": {"contribution_rate": "3", "employer_match": "6"}}]})
    r = await FinancialInputResolver(sb).resolve(CTX)
    assert r["inputs"]["retirement_contribution_rate"]["value"] == 3 and r["inputs"]["retirement_contribution_rate"]["source"] == "Uploaded document"
    assert r["inputs"]["employer_match_rate"]["value"] == 6


@pytest.mark.asyncio
async def test_tool_inputs_are_flat_canonical_no_zeros_for_missing():
    sb = FakeSupabase({"retirement_plans": [{"id": "r", "user_id": CTX.user_id, "current_savings": 92500}]})
    ti = await FinancialInputResolver(sb).tool_inputs(CTX)
    assert ti.get("current_assets") == 92500
    assert "annual_income" not in ti  # missing income -> absent, NOT 0
