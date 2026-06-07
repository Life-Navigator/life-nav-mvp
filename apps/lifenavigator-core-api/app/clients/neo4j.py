"""Neo4j grounding client (F1 placeholder).

Holds server-side config only. Real Cypher (Aura Query API v2, every query
filtered ``tenant_id = $user_id``) lands in F2. Never reachable from frontend.
"""
from __future__ import annotations

import logging

import httpx

from ..config import Settings

log = logging.getLogger("core.neo4j")


def _host_from_uri(uri: str) -> str:
    # neo4j+s://<id>.databases.neo4j.io -> https://<id>.databases.neo4j.io
    if "://" in uri:
        uri = uri.split("://", 1)[1]
    return "https://" + uri.split("/", 1)[0]


class Neo4jClient:
    def __init__(self, uri: str, username: str, password: str, database: str, timeout: float = 8.0) -> None:
        self._uri = uri
        self._username = username
        self._password = password
        self._database = database
        self._timeout = timeout

    @classmethod
    def from_settings(cls, settings: Settings) -> "Neo4jClient":
        return cls(
            uri=settings.neo4j_uri,
            username=settings.neo4j_username,
            password=settings.neo4j_password,
            database=settings.neo4j_personal_database,
            timeout=settings.http_timeout_seconds,
        )

    @property
    def configured(self) -> bool:
        return bool(self._uri and self._password)

    async def ready(self) -> bool:
        """Readiness ping via the Query API v2 (RETURN 1). Never raises."""
        if not self.configured:
            return False
        url = f"{_host_from_uri(self._uri)}/db/{self._database}/query/v2"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    url,
                    auth=(self._username, self._password),
                    json={"statement": "RETURN 1 AS ok"},
                    headers={"Accept": "application/json"},
                )
                return resp.status_code < 500
        except Exception as exc:  # noqa: BLE001
            log.warning("neo4j ready failed: %s", exc)
            return False
