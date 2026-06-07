"""Qdrant grounding client.

Holds server-side config only; never reachable from the frontend. Every personal
search is filtered by ``tenant_id == authenticated user_id`` (defense in depth:
also ``user_id``). An empty user_id is refused — never a wildcard search.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import httpx

from ..config import Settings

log = logging.getLogger("core.qdrant")


def build_personal_filter(user_id: str, *, domain: Optional[str] = None) -> dict[str, Any]:
    """Scope a personal-collection search to one user. Refuses empty user_id."""
    if not user_id or not isinstance(user_id, str):
        raise ValueError("personal qdrant filter requires a non-empty user_id")
    must: list[dict[str, Any]] = [
        {"key": "tenant_id", "match": {"value": user_id}},
        {"key": "user_id", "match": {"value": user_id}},
    ]
    if domain:
        must.append({"key": "domain", "match": {"value": domain}})
    return {"must": must}


class QdrantClient:
    def __init__(self, url: str, api_key: str, collection: str, timeout: float = 8.0) -> None:
        self._url = url.rstrip("/")
        self._api_key = api_key
        self._collection = collection
        self._timeout = timeout

    @classmethod
    def from_settings(cls, settings: Settings) -> "QdrantClient":
        return cls(
            url=settings.qdrant_url,
            api_key=settings.qdrant_api_key,
            collection=settings.qdrant_personal_collection,
            timeout=settings.http_timeout_seconds,
        )

    @property
    def configured(self) -> bool:
        return bool(self._url and self._api_key)

    async def search_personal(
        self,
        vector: list[float],
        *,
        user_id: str,
        limit: int = 10,
        domain: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """User-scoped vector search. Returns [] on missing config or any error
        (degrade, never raise into the chat path). Always filters by user_id.
        """
        if not self.configured:
            return []
        flt = build_personal_filter(user_id, domain=domain)  # raises on empty user_id
        url = f"{self._url}/collections/{self._collection}/points/search"
        body = {"vector": vector, "limit": limit, "with_payload": True, "filter": flt}
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(url, headers={"api-key": self._api_key}, json=body)
                resp.raise_for_status()
                return resp.json().get("result", []) or []
        except Exception as exc:  # noqa: BLE001
            log.warning("qdrant search_personal failed: %s", exc)
            return []

    async def points_count(self) -> int | None:
        """Collection point count (used by /readyz). None on error."""
        if not self.configured:
            return None
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.get(
                    f"{self._url}/collections/{self._collection}",
                    headers={"api-key": self._api_key},
                )
                resp.raise_for_status()
                return resp.json().get("result", {}).get("points_count")
        except Exception as exc:  # noqa: BLE001
            log.warning("qdrant points_count failed: %s", exc)
            return None

    async def ready(self) -> bool:
        return self.configured and (await self.points_count()) is not None
