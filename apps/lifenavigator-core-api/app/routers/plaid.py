"""Plaid endpoints — the backend owns the integration; the frontend proxies to here.

- GET  /v1/finance/plaid/personas          → public persona catalog (no creds)
- POST /v1/finance/plaid/activate-persona   → activate a sandbox persona for the caller
- POST /v1/finance/plaid/link-token         → create a Link token (real-user connect)
- POST /v1/finance/plaid/exchange           → exchange a public_token + sync (real-user)

All write the caller's own finance.* rows (user_id from the verified JWT, never the body).
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Body, Depends, HTTPException

from ..auth import AuthenticatedUser
from ..clients.plaid import PlaidClient, PlaidError
from ..clients.supabase import SupabaseClient
from ..dependencies import authenticated, get_plaid, get_supabase
from ..services import plaid_personas as personas
from ..services import plaid_service

log = logging.getLogger("core.plaid.router")

router = APIRouter(prefix="/v1/finance/plaid", tags=["plaid"])


@router.get("/personas")
async def list_personas() -> dict:
    """Public persona catalog for the frontend dropdown — no credentials, no Plaid wiring."""
    return {"personas": personas.list_public_personas()}


@router.post("/activate-persona")
async def activate_persona(
    persona_id: str = Body(..., embed=True),
    user: AuthenticatedUser = Depends(authenticated),
    plaid: PlaidClient = Depends(get_plaid),
    sb: SupabaseClient = Depends(get_supabase),
) -> dict:
    if not plaid.configured:
        raise HTTPException(status_code=503, detail="Sample financial profiles are not available yet.")
    if not personas.is_valid_persona_id(persona_id):
        raise HTTPException(status_code=400, detail="Unknown sample financial profile")
    try:
        return await plaid_service.activate_persona(plaid, sb, user.user_id, persona_id)
    except PlaidError as exc:
        log.warning("activate_persona plaid error: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach the financial data provider.")
    except Exception as exc:  # noqa: BLE001
        log.exception("activate_persona failed: %s", exc)
        raise HTTPException(status_code=500, detail="Activation failed. Please try again.")


@router.post("/link-token")
async def link_token(
    user: AuthenticatedUser = Depends(authenticated),
    plaid: PlaidClient = Depends(get_plaid),
) -> dict:
    if not plaid.configured:
        raise HTTPException(status_code=503, detail="Bank connections are not available yet.")
    try:
        return await plaid.link_token_create(user.user_id)
    except PlaidError as exc:
        log.warning("link_token error: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach the financial data provider.")


@router.post("/exchange")
async def exchange(
    public_token: str = Body(..., embed=True),
    user: AuthenticatedUser = Depends(authenticated),
    plaid: PlaidClient = Depends(get_plaid),
    sb: SupabaseClient = Depends(get_supabase),
) -> dict:
    """Real-user Link flow: exchange the browser-obtained public_token, then pull + persist."""
    if not plaid.configured:
        raise HTTPException(status_code=503, detail="Bank connections are not available yet.")
    try:
        exchanged = await plaid.exchange_public_token(public_token)
        access_token, item_id = exchanged["access_token"], exchanged["item_id"]
        await plaid_service.persist_plaid_item(
            sb, user_id=user.user_id, item_id=item_id, access_token=access_token,
            institution_id="", institution_name=None,
        )
        accounts = await plaid.get_accounts(access_token)
        liabilities = await plaid.get_liabilities(access_token)
        accounts = plaid_service._merge_aprs(accounts, None, liabilities)
        account_map = await plaid_service.persist_accounts(sb, user.user_id, accounts)
        return {"success": True, "accounts_linked": len(account_map)}
    except PlaidError as exc:
        log.warning("exchange plaid error: %s", exc)
        raise HTTPException(status_code=502, detail="Could not reach the financial data provider.")
    except Exception as exc:  # noqa: BLE001
        log.exception("exchange failed: %s", exc)
        raise HTTPException(status_code=500, detail="Could not link your account. Please try again.")
