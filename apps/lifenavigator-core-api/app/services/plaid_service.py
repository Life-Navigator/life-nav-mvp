"""Plaid orchestration + persistence — BACKEND owns this (port of the former Vercel route).

Activating a sandbox persona (or exchanging a real-user public_token) runs entirely here:
clear prior finance → Plaid token flow → pull accounts/liabilities/transactions → persist into
``finance.*`` (which fires the financial_account sync trigger → graph promotion). The frontend only
renders the resulting rows; it holds no Plaid credentials and makes no Plaid calls.

Faithful port of apps/web/src/lib/integrations/plaid/{persist.ts, activate-persona route}.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from ..clients.plaid import PlaidClient
from ..clients.supabase import SupabaseClient
from . import plaid_personas as personas

log = logging.getLogger("core.plaid.service")

_FINANCE = "finance"
# FK-safe order for wiping a user's prior Plaid data so re-activation is idempotent
# (sandbox mints fresh account_ids, so upserts never collide → old rows would linger).
_CLEAR_TABLES = [
    "transactions",
    "financial_accounts",
    "plaid_items",
    "assets",
    "retirement_plans",
    "investment_holdings",
]


def map_account_type(type_: Optional[str], subtype: Optional[str]) -> str:
    t = (type_ or "").lower()
    s = (subtype or "").lower()
    if t == "credit":
        return "credit_card"
    if t == "depository":
        return "savings" if s == "savings" else "checking"
    if t == "investment":
        if any(r in s for r in ("401k", "403b", "ira", "roth", "roth 401k", "pension", "retirement")):
            return "retirement"
        return "investment"
    if t == "loan":
        return "mortgage" if "mortgage" in s else "loan"
    return "checking"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def clear_prior_finance_data(sb: SupabaseClient, user_id: str) -> None:
    for table in _CLEAR_TABLES:
        await sb.delete(table, filters={"user_id": f"eq.{user_id}"}, schema=_FINANCE)


async def persist_plaid_item(
    sb: SupabaseClient, *, user_id: str, item_id: str, access_token: str,
    institution_id: str, institution_name: Optional[str] = None,
) -> None:
    await sb.upsert(
        "plaid_items",
        {
            "user_id": user_id,
            "plaid_item_id": item_id,
            # Sandbox access tokens are non-sensitive test tokens; a real-Plaid path
            # would encrypt via core.encrypt_text before storing.
            "access_token_encrypted": access_token,
            "institution_id": institution_id,
            "institution_name": institution_name,
            "status": "active",
            "last_synced_at": _now_iso(),
        },
        schema=_FINANCE,
        on_conflict="plaid_item_id",
    )


async def persist_accounts(
    sb: SupabaseClient, user_id: str, accounts: list[dict[str, Any]]
) -> dict[str, str]:
    """Upsert accounts; returns {plaid_account_id: finance.financial_accounts.id}."""
    rows = []
    for a in accounts:
        bal = a.get("balances") or {}
        rows.append(
            {
                "user_id": user_id,
                "account_name": a.get("name") or a.get("official_name") or "Account",
                "account_type": map_account_type(a.get("type"), a.get("subtype")),
                "institution_name": None,
                "current_balance": bal.get("current") if bal.get("current") is not None else 0,
                "available_balance": bal.get("available"),
                "currency": bal.get("iso_currency_code") or "USD",
                "credit_limit": bal.get("limit"),
                "interest_rate": a.get("interest_rate"),
                "is_active": True,
                "is_manual": False,
                "plaid_account_id": a.get("account_id"),
                "last_synced_at": _now_iso(),
            }
        )
    if not rows:
        return {}
    data = await sb.upsert("financial_accounts", rows, schema=_FINANCE, on_conflict="plaid_account_id")
    return {r["plaid_account_id"]: r["id"] for r in (data or []) if r.get("plaid_account_id")}


async def persist_transactions(
    sb: SupabaseClient, user_id: str, account_map: dict[str, str], transactions: list[dict[str, Any]]
) -> int:
    rows = []
    for t in transactions:
        acct = account_map.get(t.get("account_id"))
        if not acct:
            continue
        amount = t.get("amount", 0) or 0
        cats = t.get("category")
        rows.append(
            {
                "user_id": user_id,
                "account_id": acct,
                # Plaid: positive amount = money out. Store magnitude + a direction.
                "amount": abs(amount),
                "currency": t.get("iso_currency_code") or "USD",
                "transaction_date": t.get("date"),
                "description": t.get("name"),
                "merchant": t.get("merchant_name"),
                "category": cats[0] if isinstance(cats, list) and cats else None,
                "transaction_type": "expense" if amount >= 0 else "income",
                "is_recurring": False,
                "plaid_transaction_id": t.get("transaction_id"),
            }
        )
    if not rows:
        return 0
    await sb.upsert("transactions", rows, schema=_FINANCE, on_conflict="plaid_transaction_id")
    return len(rows)


async def persist_persona_investment_holdings(
    sb: SupabaseClient, user_id: str, config: Optional[dict[str, Any]]
) -> int:
    """Seed representative position-level holdings for a persona's investment accounts
    (sandbox user_custom items return balances but no securities). These live ONLY in
    investment_holdings, never summed into net worth."""
    if not config or not config.get("override_accounts"):
        return 0
    rows: list[dict[str, Any]] = []
    for acc in config["override_accounts"]:
        if (acc.get("type") or "").lower() != "investment":
            continue
        for h in personas.persona_holdings_for_account(acc.get("subtype"), acc.get("starting_balance")):
            rows.append({**h, "user_id": user_id, "purchase_date": None})
    if not rows:
        return 0
    await sb.insert("investment_holdings", rows, schema=_FINANCE)
    return len(rows)


async def persist_persona_profile(sb: SupabaseClient, user_id: str, meta: dict[str, Any]) -> None:
    # Note: user_persona_profile lives in the PUBLIC schema (matches the TS persist).
    await sb.upsert(
        "user_persona_profile",
        {
            "user_id": user_id,
            "persona_id": meta.get("persona_id"),
            "display_name": meta.get("display_name"),
            "life_stage": meta.get("life_stage"),
            "profession": meta.get("profession"),
            "family": meta.get("family"),
            "income_type": meta.get("income_type"),
            "spending_pattern": meta.get("spending_pattern"),
            "asset_profile": meta.get("asset_profile"),
            "liability_profile": meta.get("liability_profile"),
            "investment_profile": meta.get("investment_profile"),
            "risk_profile": meta.get("risk_profile"),
            "financial_complexity": meta.get("financial_complexity"),
            "config_source": meta.get("config_source"),
            "primary_goals": meta.get("primary_goals") or [],
            "expected_insights": meta.get("expected_insights") or [],
            "metadata": meta,
            "updated_at": _now_iso(),
        },
        on_conflict="user_id",
    )


def _merge_aprs(accounts: list[dict[str, Any]], custom_config: Optional[dict[str, Any]],
                live_liabilities: dict[str, Any]) -> list[dict[str, Any]]:
    """Intended config APR wins (Plaid sandbox doesn't honor override credit APR — returns ~13%);
    live liabilities only fill gaps. Port of the activate-persona APR-sourcing block."""
    config_apr_by_name: dict[str, float] = {}
    for acc in (custom_config or {}).get("override_accounts", []) or []:
        try:
            apr_pct = acc["liability"]["credit"]["aprs"][0]["apr_percentage"]
        except (KeyError, IndexError, TypeError):
            apr_pct = None
        name = (acc.get("meta") or {}).get("name")
        if name and isinstance(apr_pct, (int, float)):
            config_apr_by_name[name.strip().lower()] = apr_pct / 100.0

    config_apr_values = list(config_apr_by_name.values())
    live_cards = [a for a in accounts if (a.get("type") or "").lower() == "credit"]

    apr_by_account: dict[str, float] = {}
    for c in (live_liabilities or {}).get("credit", []) or []:
        aprs = c.get("aprs") or []
        apr_pct = next((a.get("apr_percentage") for a in aprs if a.get("apr_type") == "purchase_apr"), None)
        if apr_pct is None and aprs:
            apr_pct = aprs[0].get("apr_percentage")
        if c.get("account_id") and isinstance(apr_pct, (int, float)):
            apr_by_account[c["account_id"]] = apr_pct / 100.0

    out = []
    for a in accounts:
        by_name = config_apr_by_name.get((a.get("name") or "").strip().lower())
        single = (
            config_apr_values[0]
            if len(config_apr_values) == 1 and len(live_cards) == 1
            and a.get("account_id") == live_cards[0].get("account_id")
            else None
        )
        interest = by_name if by_name is not None else (
            single if single is not None else apr_by_account.get(a.get("account_id"))
        )
        out.append({**a, "interest_rate": interest})
    return out


async def activate_persona(
    plaid: PlaidClient, sb: SupabaseClient, user_id: str, persona_id: str
) -> dict[str, Any]:
    """Full sandbox-persona activation for a user. Replaces prior finance with Plaid data.
    Returns a summary dict. Raises PlaidError / RuntimeError on hard failure."""
    persona = personas.get_persona(persona_id)
    if persona is None:
        raise ValueError(f"unknown persona: {persona_id}")
    activation = personas.get_plaid_activation(persona)
    custom_config = activation.get("custom_config")

    # 0) Clear prior finance so re-activation is idempotent.
    await clear_prior_finance_data(sb, user_id)

    # 1) Sandbox token flow (server-side; no Link UI).
    public_token = await plaid.sandbox_public_token_create(
        institution_id=persona["institution_id"],
        products=persona.get("plaid_products"),
        username=activation.get("username", "user_good"),
        password=activation.get("password", "pass_good"),
        custom_config=custom_config,
    )
    exchanged = await plaid.exchange_public_token(public_token)
    access_token, item_id = exchanged["access_token"], exchanged["item_id"]

    # 2) Item + accounts (accounts fire graph promotion).
    await persist_plaid_item(
        sb, user_id=user_id, item_id=item_id, access_token=access_token,
        institution_id=persona["institution_id"], institution_name=persona["display_name"],
    )
    accounts = await plaid.get_accounts(access_token)
    live_liabilities = await plaid.get_liabilities(access_token)
    accounts_with_apr = _merge_aprs(accounts, custom_config, live_liabilities)
    account_map = await persist_accounts(sb, user_id, accounts_with_apr)

    # 2b) Representative holdings for investment accounts (positions table).
    holdings = 0
    try:
        holdings = await persist_persona_investment_holdings(sb, user_id, custom_config)
    except Exception as exc:  # noqa: BLE001 — non-fatal
        log.warning("persist holdings failed: %s", exc)

    # 3) Transactions (last 30 days) — can lag in sandbox; non-fatal.
    txns = 0
    try:
        end = datetime.now(timezone.utc)
        start = end - timedelta(days=30)
        transactions = await plaid.get_transactions(
            access_token, start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
        )
        txns = await persist_transactions(sb, user_id, account_map, transactions)
    except Exception as exc:  # noqa: BLE001
        log.info("persona transactions deferred: %s", exc)

    # 3b) Persona metadata → dashboard + recommendations (+ graph promotion trigger).
    await persist_persona_profile(sb, user_id, personas.persona_metadata(persona))

    # 3c) Activating a sample profile counts as setup (dashboard reachable).
    await sb.update("profiles", {"setup_completed": True, "updated_at": _now_iso()},
                    filters={"id": f"eq.{user_id}"})

    return {
        "success": True,
        "persona_id": persona_id,
        "accounts_linked": len(account_map),
        "transactions_synced": txns,
        "holdings_synced": holdings,
        "graph_promotion": "enqueued",
    }
