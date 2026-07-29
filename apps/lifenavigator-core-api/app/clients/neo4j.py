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

    async def query_personal(
        self,
        statement: str,
        *,
        user_id: str,
        parameters: dict | None = None,
    ) -> list[list]:
        """Run a user-scoped Cypher via the Aura Query API v2. The caller's
        statement MUST filter ``tenant_id = $user_id``; we always bind it.

        Returns the raw POSITIONAL value rows (``data.values``) — index by integer, matching your own
        RETURN clause. Callers that read columns by NAME must use ``query_personal_dicts`` instead;
        calling this one and then using ``row.get(...)`` raises ``AttributeError`` at runtime while
        passing any test whose fake returns dicts.

        STRUCTURAL TENANT ENFORCEMENT (T-1, CROSS_SERVICE_TENANT_ISOLATION_AUDIT.md) lives in
        ``_post_personal`` so both row shapes are enforced by one implementation. Two defects made the
        tenant filter a convention rather than a mechanism: the statement was never checked (so one
        omitting the filter returned EVERY tenant's nodes), and ``parameters`` was spread AFTER user_id
        (so ``parameters={"user_id": "<victim>"}`` silently replaced the authenticated tenant). Both are
        now refused.
        """
        payload = await self._post_personal(statement, user_id=user_id, parameters=parameters)
        return payload.get("values", []) or []

    async def query_personal_dicts(
        self,
        statement: str,
        *,
        user_id: str,
        parameters: dict | None = None,
    ) -> list[dict]:
        """Same contract as ``query_personal``, but rows come back as ``{field: value}`` dicts.

        WHY THIS EXISTS
        ---------------
        The Aura Query API v2 returns ``data.fields`` (column names) alongside ``data.values``
        (POSITIONAL rows). ``query_personal`` returns the positional rows and drops the field names, so
        every caller must index by integer and stay in sync with its own RETURN clause by hand.

        That is workable for the legacy retriever, which does exactly that. It is a trap for the
        semantic engine, whose traversal emits a nine-column RETURN and reads it by name — against the
        positional contract those reads raise ``AttributeError``, the hop-level handler catches it, and
        traversal silently degrades to "seeds only" while logging a generic degradation. The graph walk
        would appear to run and return nothing, which reads as a sparse user graph rather than a bug.

        Binding names here — from the API's own ``fields``, not a hand-maintained list — removes the
        class of defect instead of the instance. The tenant guarantees are unchanged: this delegates the
        statement/parameter checks and the tenant binding to the same enforcement path.
        """
        payload = await self._post_personal(statement, user_id=user_id, parameters=parameters)
        fields = payload.get("fields") or []
        values = payload.get("values") or []
        out: list[dict] = []
        for row in values:
            if isinstance(row, dict):        # defensive: some drivers/mocks already map rows
                out.append(row)
            elif isinstance(row, (list, tuple)):
                out.append({f: row[i] if i < len(row) else None for i, f in enumerate(fields)})
        return out

    async def _post_personal(
        self,
        statement: str,
        *,
        user_id: str,
        parameters: dict | None = None,
    ) -> dict:
        """Tenant-enforced POST to the Query API. Returns the raw ``data`` object ({} on any failure).

        Single enforcement point for both row shapes — the checks below must never be duplicated into a
        caller, because a second copy is a second thing that can drift out of agreement with this one.
        """
        if not user_id:
            raise ValueError("query_personal requires a non-empty user_id")
        if "$user_id" not in statement:
            raise ValueError(
                "query_personal statement must reference $user_id — refusing to run an untenanted "
                "personal-graph query. Every MATCH must constrain tenant_id: {tenant_id: $user_id}."
            )
        if parameters and "user_id" in parameters:
            raise ValueError("cannot override user_id in personal query parameters — tenant is immutable")
        if not self.configured:
            return {}
        params = {**(parameters or {}), "user_id": user_id}  # tenant binds LAST — cannot be overridden
        url = f"{_host_from_uri(self._uri)}/db/{self._database}/query/v2"
        try:
            async with httpx.AsyncClient(timeout=self._timeout) as client:
                resp = await client.post(
                    url,
                    auth=(self._username, self._password),
                    json={"statement": statement, "parameters": params},
                    headers={"Accept": "application/json", "Content-Type": "application/json"},
                )
                resp.raise_for_status()
                return resp.json().get("data", {}) or {}
        except Exception as exc:  # noqa: BLE001
            log.warning("neo4j query_personal failed: %s", exc)
            return {}

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
