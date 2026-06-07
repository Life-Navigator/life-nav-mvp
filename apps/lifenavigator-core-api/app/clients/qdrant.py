"""Qdrant grounding client (F1 placeholder).

Holds server-side config only. Real vector search (user-filtered, 3072-dim
gemini-embedding-001) lands in F2. Never reachable from the frontend.
"""
from __future__ import annotations

import logging

import httpx

from ..config import Settings

log = logging.getLogger("core.qdrant")


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
