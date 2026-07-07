"""Plaid backend port — unit coverage for the account mapping, APR merge, and the
activate-persona orchestration (with fake Plaid + Supabase, no network)."""
from __future__ import annotations

import pytest

from app.services import plaid_personas as personas
from app.services import plaid_service as svc


def test_map_account_type():
    assert svc.map_account_type("credit", "credit card") == "credit_card"
    assert svc.map_account_type("depository", "savings") == "savings"
    assert svc.map_account_type("depository", "checking") == "checking"
    assert svc.map_account_type("investment", "ira") == "retirement"
    assert svc.map_account_type("investment", "401k") == "retirement"
    assert svc.map_account_type("investment", "brokerage") == "investment"
    assert svc.map_account_type("loan", "mortgage") == "mortgage"
    assert svc.map_account_type("loan", "student") == "loan"
    assert svc.map_account_type(None, None) == "checking"


def test_merge_aprs_config_wins_over_live():
    # Config encodes 27.99% for "Secured Card"; live liabilities say 13% — config must win.
    accounts = [{"account_id": "a1", "name": "Secured Card", "type": "credit"}]
    custom = {"override_accounts": [
        {"meta": {"name": "Secured Card"}, "liability": {"credit": {"aprs": [{"apr_percentage": 27.99}]}}}
    ]}
    live = {"credit": [{"account_id": "a1", "aprs": [{"apr_type": "purchase_apr", "apr_percentage": 13.0}]}]}
    out = svc._merge_aprs(accounts, custom, live)
    assert out[0]["interest_rate"] == pytest.approx(0.2799)


def test_merge_aprs_single_card_fallback():
    # Name mismatch, but exactly one config APR + one live card → map directly.
    accounts = [{"account_id": "x", "name": "Different Name", "type": "credit"}]
    custom = {"override_accounts": [
        {"meta": {"name": "Card"}, "liability": {"credit": {"aprs": [{"apr_percentage": 21.99}]}}}
    ]}
    out = svc._merge_aprs(accounts, custom, {})
    assert out[0]["interest_rate"] == pytest.approx(0.2199)


class _FakePlaid:
    configured = True

    async def sandbox_public_token_create(self, **_):
        return "public-sandbox-token"

    async def exchange_public_token(self, _pt):
        return {"access_token": "access-tok", "item_id": "item-1"}

    async def get_accounts(self, _at):
        return [
            {"account_id": "chk", "name": "Checking", "type": "depository", "subtype": "checking",
             "balances": {"current": 5000, "iso_currency_code": "USD"}},
            {"account_id": "cc", "name": "Card", "type": "credit", "subtype": "credit card",
             "balances": {"current": 1200, "limit": 5000}},
        ]

    async def get_liabilities(self, _at):
        return {}

    async def get_transactions(self, _at, _s, _e):
        return [{"transaction_id": "t1", "account_id": "chk", "amount": 42.0, "date": "2026-07-01", "name": "Coffee"}]


class _FakeSupabase:
    def __init__(self):
        self.deleted, self.upserts, self.inserts, self.updates = [], [], [], []

    async def delete(self, table, *, filters, schema="public"):
        self.deleted.append((schema, table)); return True

    async def upsert(self, table, row, *, schema="public", on_conflict=None):
        self.upserts.append((schema, table, row))
        rows = row if isinstance(row, list) else [row]
        # emulate returning ids for financial_accounts
        return [{"id": f"id-{i}", "plaid_account_id": r.get("plaid_account_id")} for i, r in enumerate(rows)]

    async def insert(self, table, row, *, schema="public"):
        self.inserts.append((schema, table, row)); return row if isinstance(row, list) else [row]

    async def update(self, table, patch, *, filters, schema="public"):
        self.updates.append((table, patch, filters)); return [{"id": "u"}]


@pytest.mark.asyncio
async def test_activate_persona_orchestration():
    plaid, sb = _FakePlaid(), _FakeSupabase()
    result = await svc.activate_persona(plaid, sb, "user-123", "married_family")
    assert result["success"] is True
    assert result["persona_id"] == "married_family"
    assert result["accounts_linked"] == 2
    # cleared prior finance first (all finance tables)
    assert any(t == "financial_accounts" for _, t in sb.deleted)
    # accounts upserted into finance schema with mapped types
    fa = [r for s, t, r in sb.upserts if t == "financial_accounts"][0]
    assert {row["account_type"] for row in fa} == {"checking", "credit_card"}
    # persona profile persisted + setup_completed flipped
    assert any(t == "user_persona_profile" for _, t, _ in sb.upserts)
    assert sb.updates and sb.updates[0][1].get("setup_completed") is True


def test_invalid_persona_raises():
    import asyncio
    with pytest.raises(ValueError):
        asyncio.get_event_loop().run_until_complete(
            svc.activate_persona(_FakePlaid(), _FakeSupabase(), "u", "not_a_persona")
        )


def test_all_personas_have_institution_and_products():
    for p in personas.PLAID_PERSONAS:
        assert p["institution_id"]
        assert p["plaid_products"]
