"""Plaid API client — BACKEND ONLY.

The Plaid integration lives on the backend (Fly core-api), never on the Vercel
frontend: the credentials (``PLAID_CLIENT_ID`` / ``PLAID_CLIENT_SECRET``) are Fly
secrets, and every Plaid API call happens here. The frontend renders the
resulting ``finance.*`` rows and hands us a ``public_token`` for the real-user
Link flow — it never talks to Plaid directly.

Thin async httpx wrapper over Plaid's REST API (no SDK — the endpoints are plain
JSON, consistent with how this service already calls Supabase/Qdrant). Credentials
are sent in the request body (``client_id`` + ``secret``), as Plaid accepts.
"""
from __future__ import annotations

import json
import logging
from typing import Any, Optional

import httpx

from ..config import Settings

log = logging.getLogger("core.plaid")

_BASE_BY_ENV = {
    "sandbox": "https://sandbox.plaid.com",
    "development": "https://development.plaid.com",
    "production": "https://production.plaid.com",
}


class PlaidError(RuntimeError):
    """Raised when Plaid returns an error response (surfaced to the route as 502)."""


class PlaidClient:
    def __init__(self, client_id: str, secret: str, env: str = "sandbox", timeout: float = 20.0) -> None:
        self._client_id = client_id
        self._secret = secret
        self._base = _BASE_BY_ENV.get((env or "sandbox").lower(), _BASE_BY_ENV["sandbox"])
        self._timeout = timeout

    @classmethod
    def from_settings(cls, settings: Settings) -> "PlaidClient":
        return cls(
            client_id=settings.plaid_client_id,
            secret=settings.plaid_client_secret,
            env=settings.plaid_env,
            timeout=max(settings.http_timeout_seconds, 20.0),
        )

    @property
    def configured(self) -> bool:
        return bool(self._client_id and self._secret)

    async def _post(self, path: str, body: dict[str, Any]) -> dict[str, Any]:
        payload = {"client_id": self._client_id, "secret": self._secret, **body}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(f"{self._base}{path}", json=payload)
        except Exception as exc:  # noqa: BLE001 — transport failure
            raise PlaidError(f"plaid transport error on {path}: {exc}") from exc
        if resp.status_code >= 400:
            # Plaid returns a structured {error_code, error_message} body.
            try:
                err = resp.json()
                msg = f"{err.get('error_code')}: {err.get('error_message')}"
            except Exception:  # noqa: BLE001
                msg = resp.text[:200]
            raise PlaidError(f"plaid {path} -> {resp.status_code} {msg}")
        return resp.json()

    # --- Sandbox persona activation (no Link UI) --------------------------------
    async def sandbox_public_token_create(
        self,
        *,
        institution_id: str,
        products: Optional[list[str]] = None,
        username: str = "user_good",
        password: str = "pass_good",
        custom_config: Optional[dict[str, Any]] = None,
    ) -> str:
        """Create a sandbox public_token. When ``custom_config`` is given, uses
        Plaid's ``user_custom`` mechanism (override_password = JSON config) so the
        persona gets a distinct dataset; otherwise a documented sandbox user."""
        if custom_config:
            options = {
                "override_username": "user_custom",
                "override_password": json.dumps(custom_config),
            }
        else:
            options = {"override_username": username, "override_password": password}
        data = await self._post(
            "/sandbox/public_token/create",
            {
                "institution_id": institution_id,
                "initial_products": products or ["transactions"],
                "options": options,
            },
        )
        return data["public_token"]

    # --- Real-user Link flow -----------------------------------------------------
    async def link_token_create(self, user_id: str, products: Optional[list[str]] = None) -> dict[str, Any]:
        data = await self._post(
            "/link/token/create",
            {
                "user": {"client_user_id": user_id},
                "client_name": "Life Navigator",
                "products": products or ["auth", "transactions"],
                "country_codes": ["US"],
                "language": "en",
            },
        )
        return {"link_token": data.get("link_token"), "expiration": data.get("expiration")}

    async def exchange_public_token(self, public_token: str) -> dict[str, str]:
        data = await self._post("/item/public_token/exchange", {"public_token": public_token})
        return {"access_token": data["access_token"], "item_id": data["item_id"]}

    # --- Data pulls --------------------------------------------------------------
    async def get_accounts(self, access_token: str) -> list[dict[str, Any]]:
        data = await self._post("/accounts/get", {"access_token": access_token})
        return data.get("accounts", [])

    async def get_transactions(self, access_token: str, start_date: str, end_date: str) -> list[dict[str, Any]]:
        data = await self._post(
            "/transactions/get",
            {"access_token": access_token, "start_date": start_date, "end_date": end_date},
        )
        return data.get("transactions", [])

    async def get_liabilities(self, access_token: str) -> dict[str, Any]:
        try:
            data = await self._post("/liabilities/get", {"access_token": access_token})
        except PlaidError as exc:
            # Not every item has liabilities; treat as empty rather than failing activation.
            log.info("plaid liabilities unavailable: %s", exc)
            return {}
        return data.get("liabilities", {})

    async def item_remove(self, access_token: str) -> None:
        await self._post("/item/remove", {"access_token": access_token})
