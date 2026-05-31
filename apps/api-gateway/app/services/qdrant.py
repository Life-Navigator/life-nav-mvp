"""Qdrant client. Two collections:

* ``personal_collection`` — per-user vectors. Every search MUST filter
  by ``tenant_id == authenticated user_id``. ``build_personal_filter``
  is the single source of truth; the tests assert that no codepath
  ever bypasses it.

* ``central_collection`` — shared knowledge (financial concepts, tax
  rules, etc). Read-only.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

import httpx


def build_personal_filter(user_id: str, *, domain: Optional[str] = None) -> dict[str, Any]:
    """Build the Qdrant filter that scopes a personal-collection search
    to a single authenticated user.

    The Qdrant filter syntax:
       { "must": [ { "key": "tenant_id", "match": { "value": "<uuid>" } } ] }

    Optional ``domain`` adds a second clause so we can narrow to e.g.
    'health' or 'financial' if a caller wants to.
    """
    if not user_id or not isinstance(user_id, str):
        # An empty user_id would cause a wildcard search. We refuse it.
        raise ValueError("personal qdrant filter requires a non-empty user_id")
    must: list[dict[str, Any]] = [
        {"key": "tenant_id", "match": {"value": user_id}},
        # Defense in depth: also require user_id field to match. Every
        # payload the ingestion worker writes carries both.
        {"key": "user_id", "match": {"value": user_id}},
        {"key": "access_scope", "match": {"value": "personal"}},
    ]
    if domain:
        must.append({"key": "domain", "match": {"value": domain}})
    return {"must": must}


@dataclass
class QdrantClient:
    base_url: str
    api_key: str
    personal_collection: str
    central_collection: str
    timeout_seconds: float = 30.0

    def _headers(self) -> dict[str, str]:
        return {"api-key": self.api_key, "content-type": "application/json"}

    async def search_personal(
        self,
        *,
        user_id: str,
        vector: list[float],
        limit: int = 10,
        domain: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Search the personal collection. Always filters by user_id."""
        flt = build_personal_filter(user_id, domain=domain)
        url = f"{self.base_url.rstrip('/')}/collections/{self.personal_collection}/points/search"
        body = {
            "vector": vector,
            "limit": int(limit),
            "with_payload": True,
            "with_vector": False,
            "filter": flt,
        }
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            r = await client.post(url, headers=self._headers(), json=body)
            r.raise_for_status()
            return r.json().get("result", [])

    async def search_central(
        self,
        *,
        vector: list[float],
        limit: int = 10,
        domain: Optional[str] = None,
    ) -> list[dict[str, Any]]:
        """Search the central / shared-knowledge collection.

        No tenant filter — the central collection has no per-user data.
        Optional ``domain`` may be supplied if entries are tagged.
        """
        url = f"{self.base_url.rstrip('/')}/collections/{self.central_collection}/points/search"
        body: dict[str, Any] = {
            "vector": vector,
            "limit": int(limit),
            "with_payload": True,
            "with_vector": False,
        }
        if domain:
            body["filter"] = {"must": [{"key": "domain", "match": {"value": domain}}]}
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            r = await client.post(url, headers=self._headers(), json=body)
            r.raise_for_status()
            return r.json().get("result", [])
