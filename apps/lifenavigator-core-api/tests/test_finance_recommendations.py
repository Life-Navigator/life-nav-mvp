"""Phase 3 — persisted recommendation engine with structured evidence.

Verifies the engine never fabricates, persists full evidence, and is idempotent.
"""

import pytest

from app.domains.finance import FinanceService, _rec_id
from app.models.common import UserContext

from .conftest import FakeSupabase

CTX = UserContext(user_id="u-rec-1")
ACCOUNTS = [{"id": "a1", "account_type": "depository", "current_balance": 500, "currency": "USD"}]
EXPENSES = [{"id": "t1", "type": "expense", "amount": 2000, "transaction_date": "2026-06-01"}]
DEBTS = [{"id": "d1", "name": "Card", "balance": 4000, "interest_rate": 24.99}]


def _svc(*, accounts=None, txns=None, debts=None) -> FinanceService:
    tables: dict = {}
    if accounts is not None:
        tables["financial_accounts"] = accounts
    if txns is not None:
        tables["transactions"] = txns
    if debts is not None:
        tables["asset_loans"] = debts
    return FinanceService(supabase=FakeSupabase(tables))


@pytest.mark.asyncio
async def test_emergency_fund_persists_with_required_evidence():
    svc = _svc(accounts=ACCOUNTS, txns=EXPENSES)
    persisted = await svc.persist_recommendations(CTX)
    assert len(persisted) == 1
    row = persisted[0]
    assert row["recommendation_type"] == "emergency_fund"
    # tenant-safe: identity from ctx, not body
    assert row["user_id"] == "u-rec-1" and row["tenant_id"] == "u-rec-1"
    # required evidence metrics for emergency fund
    metrics = {e["metric_name"] for e in row["evidence_json"]}
    assert {"cash", "monthly_expenses", "emergency_reserve_months", "target_reserve_months", "gap"} <= metrics
    # every evidence node has the graph-required fields
    for e in row["evidence_json"]:
        assert {"metric_name", "metric_value", "source_table", "observed_at", "confidence", "explanation"} <= e.keys()
    # assumptions + governance
    assert any("expense" in a["assumption_text"] for a in row["assumptions_json"])
    assert row["governance_verdict"]["boundary_type"] == "financial_planning"
    assert row["governance_verdict"]["disclaimer_text"]


@pytest.mark.asyncio
async def test_no_accounts_no_recommendation():
    svc = _svc(accounts=[], txns=EXPENSES)
    assert await svc.persist_recommendations(CTX) == []


@pytest.mark.asyncio
async def test_accounts_but_no_expense_or_debt_does_not_fabricate():
    svc = _svc(accounts=ACCOUNTS, txns=[], debts=[])
    assert await svc.persist_recommendations(CTX) == []


@pytest.mark.asyncio
async def test_persist_is_idempotent_with_deterministic_id():
    svc = _svc(accounts=ACCOUNTS, txns=EXPENSES)
    a = await svc.persist_recommendations(CTX)
    b = await svc.persist_recommendations(CTX)
    assert a[0]["id"] == b[0]["id"] == _rec_id("u-rec-1", "emergency-fund-gap")


@pytest.mark.asyncio
async def test_no_recommendation_is_persisted_without_evidence():
    svc = _svc(accounts=ACCOUNTS, txns=EXPENSES, debts=DEBTS)
    persisted = await svc.persist_recommendations(CTX)
    assert persisted  # emergency fund + debt avalanche
    for row in persisted:
        assert row["evidence_json"], "a recommendation was persisted without evidence"


@pytest.mark.asyncio
async def test_debt_avalanche_persists_with_apr_evidence():
    svc = _svc(accounts=ACCOUNTS, txns=EXPENSES, debts=DEBTS)
    persisted = await svc.persist_recommendations(CTX)
    debt = next((r for r in persisted if r["recommendation_type"] == "debt_optimization"), None)
    assert debt is not None
    metrics = {e["metric_name"] for e in debt["evidence_json"]}
    assert {"apr", "balance"} <= metrics
