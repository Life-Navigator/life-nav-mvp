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
        order: Optional[str] = None,
        schema: str = "public",
        user_jwt: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """PostgREST select. Returns [] on missing config or any error.

        ``schema`` selects a non-public schema (e.g. ``finance``) via the
        PostgREST ``Accept-Profile`` header.
        """
        if not self.configured:
            return []
        params: dict[str, str] = {"select": columns}
        if filters:
            params.update(filters)
        if order is not None:
            params["order"] = order
        if limit is not None:
            params["limit"] = str(limit)
        headers = self._headers(user_jwt=user_jwt)
        if schema != "public":
            headers["Accept-Profile"] = schema
        endpoint = f"{self._url}/rest/v1/{table}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(endpoint, headers=headers, params=params)
                resp.raise_for_status()
                data = resp.json()
                return data if isinstance(data, list) else []
        except Exception as exc:  # noqa: BLE001 — degrade, never raise to the route
            log.warning("supabase select %s failed: %s", table, exc)
            return []

    async def insert(
        self,
        table: str,
        row: dict[str, Any],
        *,
        schema: str = "public",
    ) -> list[dict[str, Any]]:
        """Service-role insert (write path). Returns the inserted row(s) or [] on
        error. ``schema`` selects a non-public schema via ``Content-Profile``.
        Callers MUST set ``user_id`` from the verified JWT, never the request body.
        """
        if not self.configured:
            return []
        headers = self._headers()
        headers["Prefer"] = "return=representation"
        if schema != "public":
            headers["Content-Profile"] = schema
        endpoint = f"{self._url}/rest/v1/{table}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(endpoint, headers=headers, json=row)
                resp.raise_for_status()
                data = resp.json()
                return data if isinstance(data, list) else [data]
        except Exception as exc:  # noqa: BLE001
            log.warning("supabase insert %s failed: %s", table, exc)
            return []

    async def upsert(
        self,
        table: str,
        row: dict[str, Any],
        *,
        schema: str = "public",
        on_conflict: str | None = None,
    ) -> list[dict[str, Any]]:
        """Service-role idempotent upsert (PostgREST ``resolution=merge-duplicates``).

        The caller supplies a deterministic primary key (or sets ``on_conflict`` to a
        unique column) so repeated calls update in place rather than duplicating.
        ``user_id`` MUST come from the verified JWT, never the request body.
        """
        if not self.configured:
            return []
        headers = self._headers()
        headers["Prefer"] = "return=representation,resolution=merge-duplicates"
        if schema != "public":
            headers["Content-Profile"] = schema
        endpoint = f"{self._url}/rest/v1/{table}"
        if on_conflict:
            endpoint += f"?on_conflict={on_conflict}"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(endpoint, headers=headers, json=row)
                resp.raise_for_status()
                data = resp.json()
                return data if isinstance(data, list) else [data]
        except Exception as exc:  # noqa: BLE001
            log.warning("supabase upsert %s failed: %s", table, exc)
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
