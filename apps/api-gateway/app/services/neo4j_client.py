"""Neo4j HTTP client. Two databases:

* personal_database — per-user knowledge graph. Every Cypher query MUST
  carry a ``tenant_id: $tenant_id`` filter; ``run_personal`` builds
  the parameter bag with the user_id baked in so callers can't forget.

* central_database — read-only shared knowledge graph.
"""
from __future__ import annotations

import base64
from dataclasses import dataclass
from typing import Any, Optional

import httpx


@dataclass
class Neo4jClient:
    base_url: str
    username: str
    password: str
    personal_database: str
    central_database: str
    timeout_seconds: float = 30.0

    def _basic_auth_header(self) -> str:
        creds = f"{self.username}:{self.password}".encode()
        return f"Basic {base64.b64encode(creds).decode()}"

    def build_personal_params(self, user_id: str, extra: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        """Build the canonical parameter bag for a personal-graph
        query. ``tenant_id`` is bound to the authenticated user.

        Caller is responsible for embedding ``$tenant_id`` in the Cypher
        statement. ``cypher_filters_personal`` returns True if the
        statement does so.
        """
        if not user_id or not isinstance(user_id, str):
            raise ValueError("personal neo4j params require a non-empty user_id")
        params: dict[str, Any] = {"tenant_id": user_id}
        if extra:
            for k, v in extra.items():
                if k == "tenant_id":
                    # Refuse to let the caller override the tenant.
                    raise ValueError("cannot override tenant_id in personal params")
                params[k] = v
        return params

    @staticmethod
    def cypher_filters_personal(cypher: str) -> bool:
        """Sanity check used by the auditor middleware and the tests.
        Statement must mention ``$tenant_id`` to be considered personal-safe.
        """
        return "$tenant_id" in cypher

    async def run_personal(self, *, user_id: str, cypher: str, extra: Optional[dict[str, Any]] = None) -> list[dict[str, Any]]:
        if not self.cypher_filters_personal(cypher):
            raise ValueError(
                "personal cypher must reference $tenant_id — refusing to run"
            )
        params = self.build_personal_params(user_id, extra)
        return await self._tx_commit(self.personal_database, cypher, params)

    async def run_central(self, cypher: str, params: Optional[dict[str, Any]] = None) -> list[dict[str, Any]]:
        return await self._tx_commit(self.central_database, cypher, params or {})

    def _http_base(self) -> str:
        """The Query API is HTTP(S). Normalize a bolt-style URI
        (``neo4j+s://host``) — which is what Aura hands out — to the
        equivalent ``https://host`` the HTTP endpoint expects.
        """
        base = self.base_url.rstrip("/")
        for scheme in ("neo4j+s://", "neo4j+ssc://", "neo4j://", "bolt+s://", "bolt+ssc://", "bolt://"):
            if base.startswith(scheme):
                return "https://" + base[len(scheme):]
        return base

    async def _tx_commit(self, database: str, cypher: str, params: dict[str, Any]) -> list[dict[str, Any]]:
        # Neo4j Aura forbids the legacy ``/db/{db}/tx/commit`` endpoint
        # (403 "Denied by administrative rules"). Use the Query API v2.
        url = f"{self._http_base()}/db/{database}/query/v2"
        body = {"statement": cypher, "parameters": params}
        headers = {
            "authorization": self._basic_auth_header(),
            "accept": "application/json",
            "content-type": "application/json",
        }
        async with httpx.AsyncClient(timeout=self.timeout_seconds) as client:
            r = await client.post(url, headers=headers, json=body)
            r.raise_for_status()
            data = r.json()
            block = data.get("data") or {}
            fields = block.get("fields") or []
            values = block.get("values") or []
            return [{c: v for c, v in zip(fields, row)} for row in values]
