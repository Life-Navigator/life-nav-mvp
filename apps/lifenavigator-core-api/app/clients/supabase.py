"""Supabase access — system of record.

Two credentials:
  * anon key      — RLS-respecting reads (owner-scoped) when a user JWT is forwarded.
  * service-role   — privileged reads/writes (the Core API's write path).

This F1 scaffold uses PostgREST over httpx. All calls degrade gracefully:
on missing config or any transport error they return an empty result rather
than raising, so a domain service can fall back to a typed placeholder
view-model (never a 500, never a fake number).
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from ..config import Settings

log = logging.getLogger("core.supabase")


class SupabaseClient:
    def __init__(
        self,
        url: str,
        anon_key: str,
        service_role_key: str,
        timeout: float = 8.0,
    ) -> None:
        self._url = url.rstrip("/")
        self._anon_key = anon_key
        self._service_role_key = service_role_key
        self._timeout = timeout

    @classmethod
    def from_settings(cls, settings: Settings) -> "SupabaseClient":
        return cls(
            url=settings.supabase_url,
            anon_key=settings.supabase_anon_key,
            service_role_key=settings.supabase_service_role_key,
            timeout=settings.http_timeout_seconds,
        )

    @property
    def configured(self) -> bool:
        return bool(self._url and self._service_role_key)

    def _headers(self, *, user_jwt: Optional[str] = None) -> dict[str, str]:
        # service-role for privileged reads/writes; user JWT for RLS-scoped reads.
        key = self._service_role_key if user_jwt is None else self._anon_key
        bearer = user_jwt or self._service_role_key
        return {
            "apikey": key,
            "Authorization": f"Bearer {bearer}",
            "Content-Type": "application/json",
        }

    async def select(
        self,
        table: str,
        *,
        columns: str = "*",
        filters: Optional[dict[str, str]] = None,
        limit: Optional[int] = None,
        user_jwt: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """PostgREST select. Returns [] on missing config or any error."""
        if not self.configured:
            return []
        params: dict[str, str] = {"select": columns}
        if filters:
            params.update(filters)
        if limit is not None:
            params["limit"] = str(limit)
        endpoint = f"{self._url}/rest/v1/{table}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(
                    endpoint, headers=self._headers(user_jwt=user_jwt), params=params
                )
                resp.raise_for_status()
                data = resp.json()
                return data if isinstance(data, list) else []
        except Exception as exc:  # noqa: BLE001 — degrade, never raise to the route
            log.warning("supabase select %s failed: %s", table, exc)
            return []

    async def ready(self) -> bool:
        """Readiness ping — never raises."""
        if not self.configured:
            return False
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(
                    f"{self._url}/rest/v1/", headers=self._headers()
                )
                return resp.status_code < 500
        except Exception:  # noqa: BLE001
            return False
