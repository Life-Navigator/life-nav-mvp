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


# ---- Sprint 45D: retirement projection card (tool-run-backed, missing-aware) ----
@pytest.mark.asyncio
async def test_projection_missing_age_does_not_run():
    from app.services.tools import ToolRunner
    sb = FakeSupabase({"retirement_plans": [{"id": "r", "user_id": CTX.user_id, "current_savings": 92500, "target_retirement_age": 65}]})
    card = await FinancialInputResolver(sb).retirement_projection_card(CTX, ToolRunner(sb), current_age=None)
    assert card["available"] is False and any(m["input"] == "current_age" for m in card["missing"])
    # nothing was projected / persisted
    assert not await sb.select("tool_runs", filters={"user_id": f"eq.{CTX.user_id}"}, schema="tools")


@pytest.mark.asyncio
async def test_projection_runs_and_persists_with_age():
    from app.services.tools import ToolRunner
    sb = FakeSupabase({"retirement_plans": [{"id": "r", "user_id": CTX.user_id, "current_savings": 92500, "target_retirement_age": 65}]})
    card = await FinancialInputResolver(sb).retirement_projection_card(CTX, ToolRunner(sb), current_age=40)
    assert card["available"] is True and card["source"] == "Deterministic tool run"
    assert card["tool_run_id"] and card["outputs"]["projected_assets"] > 92500  # grew
    assert card["inputs_used"]["current_age"] == 40 and card["limitations"]
    # the run was persisted + the age remembered canonically
    assert await sb.select("tool_runs", filters={"user_id": f"eq.{CTX.user_id}"}, schema="tools")
    vis = await sb.select("life_vision", filters={"user_id": f"eq.{CTX.user_id}"}, schema="life")
    assert vis and (vis[0].get("prompts") or {}).get("current_age") == 40


# ---- P0: investment/retirement resolve from financial_accounts (not just assets/plans) ----
import pytest as _pytest


@_pytest.mark.asyncio
async def test_investment_retirement_resolve_from_accounts():
    sb = FakeSupabase({"financial_accounts": [
        {"id": "i", "user_id": CTX.user_id, "account_type": "investment", "current_balance": 1330000, "plaid_account_id": "p1"},
        {"id": "r", "user_id": CTX.user_id, "account_type": "retirement", "current_balance": 250000, "plaid_account_id": "p2"},
    ]})
    out = await FinancialInputResolver(sb).resolve(CTX)
    assert out["inputs"]["investment_balance"]["present"] and out["inputs"]["investment_balance"]["value"] == 1330000
    assert out["inputs"]["retirement_balance"]["present"] and out["inputs"]["retirement_balance"]["value"] == 250000
    assert out["inputs"]["investment_balance"]["source"] == PLAID  # not Missing


@_pytest.mark.asyncio
async def test_canonical_summary_matches_accounts():
    sb = FakeSupabase({"financial_accounts": [
        {"id": "c", "user_id": CTX.user_id, "account_type": "checking", "current_balance": 203200, "plaid_account_id": "p0"},
        {"id": "i", "user_id": CTX.user_id, "account_type": "investment", "current_balance": 1330000, "plaid_account_id": "p1"},
        {"id": "d", "user_id": CTX.user_id, "account_type": "credit_card", "current_balance": 12000, "plaid_account_id": "p3"},
    ]})
    s = await FinancialInputResolver(sb).summary(CTX)
    assert s["cash_balance"] == 203200 and s["investment_balance"] == 1330000 and s["total_debt"] == 12000
    assert s["net_worth"] == 203200 + 1330000 - 12000 and s["has_data"] and s["accounts_count"] == 3


# ---- First-5 Plaid/synthetic source-label honesty ----
def test_acct_source_labels_honestly():
    from app.services.financial_resolver import _acct_source, PLAID, SYNTHETIC, MANUAL, MISSING
    # real Plaid marker → Plaid (never anything else)
    assert _acct_source([{"plaid_account_id": "abc", "account_type": "checking"}]) == PLAID
    assert _acct_source([{"metadata": {"source": "connected_account"}}]) == PLAID
    # synthetic-beta seed → Synthetic (NOT Plaid, NOT generic user-entered)
    assert _acct_source([{"metadata": {"source": "synthetic_beta"}, "account_type": "checking"}]) == SYNTHETIC
    # plain manual rows → user-entered
    assert _acct_source([{"account_type": "checking", "is_manual": True}]) == MANUAL
    # no accounts → missing (never a fake source)
    assert _acct_source([]) == MISSING
    # mixed synthetic + a real plaid account → Plaid wins (a real connection is present)
    assert _acct_source([{"metadata": {"source": "synthetic_beta"}}, {"plaid_account_id": "x"}]) == PLAID
    # synthetic is NOT labeled plaid and plaid is NOT labeled synthetic
    assert _acct_source([{"metadata": {"source": "synthetic_beta"}}]) != PLAID
    assert _acct_source([{"plaid_account_id": "x"}]) != SYNTHETIC
