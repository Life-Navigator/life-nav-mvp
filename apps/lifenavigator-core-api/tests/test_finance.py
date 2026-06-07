"""FinanceService / finance route view-model shape."""
from __future__ import annotations

import pytest

from app.domains.finance import FinanceService
from app.models.common import DomainViewModel, UserContext

from .conftest import FakeSupabase, make_jwt

SAMPLE_ACCOUNTS = [
    {
        "id": "acc-1",
        "name": "Checking",
        "institution_name": "Test Bank",
        "account_type": "depository",
        "current_balance": 5000,
        "currency": "USD",
    },
    {
        "id": "acc-2",
        "name": "Brokerage",
        "institution_name": "Test Broker",
        "account_type": "investment",
        "current_balance": 12000,
        "currency": "USD",
    },
]


def _assert_view_model_shape(body: dict) -> None:
    assert body["domain"] == "finance"
    assert "user_id" in body and "generated_at" in body
    assert "freshness" in body and "confidence" in body
    assert "data" in body and "recommendations" in body and "missing" in body
    assert "net_worth" in body["data"] and "accounts" in body["data"]
    assert body["confidence"]["basis"] in {"complete", "partial", "sparse", "missing"}


def test_finance_summary_empty_returns_placeholder_shape(client, auth_header):
    # Default fake Supabase returns no rows → honest empty view-model.
    resp = client.get("/v1/finance/summary", headers=auth_header)
    assert resp.status_code == 200
    body = resp.json()
    _assert_view_model_shape(body)
    assert body["data"]["net_worth"] is None
    assert body["data"]["accounts"] == []
    assert body["confidence"]["basis"] == "missing"
    assert "plaid_link" in body["missing"]


def test_finance_summary_populated_returns_real_view_model(make_client):
    client = make_client(SAMPLE_ACCOUNTS)
    resp = client.get(
        "/v1/finance/summary", headers={"Authorization": f"Bearer {make_jwt()}"}
    )
    assert resp.status_code == 200
    body = resp.json()
    _assert_view_model_shape(body)
    # net worth = 5000 + 12000; cash = depository only
    assert body["data"]["net_worth"]["amount"] == 17000
    assert body["data"]["cash"]["amount"] == 5000
    assert len(body["data"]["accounts"]) == 2
    assert body["confidence"]["basis"] == "partial"


@pytest.mark.asyncio
async def test_finance_service_summary_is_typed_view_model():
    svc = FinanceService(supabase=FakeSupabase(SAMPLE_ACCOUNTS))
    vm = await svc.summary(UserContext(user_id="u-1"))
    assert isinstance(vm, DomainViewModel)
    assert vm.domain == "finance"
    assert vm.data["net_worth"]["amount"] == 17000


@pytest.mark.asyncio
async def test_finance_chat_context_shape():
    svc = FinanceService(supabase=FakeSupabase(SAMPLE_ACCOUNTS))
    ctx = await svc.chat_context(UserContext(user_id="u-1"))
    assert ctx.domain == "finance"
    assert any(f["fact"] == "net_worth" for f in ctx.authoritative_facts)
