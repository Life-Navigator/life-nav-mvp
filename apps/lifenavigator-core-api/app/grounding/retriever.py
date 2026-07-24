"""Personal GraphRAG retrieval (port of the graphrag-query Edge function).

Embeds the query (Gemini, server-side), runs a user-scoped Qdrant vector search
and a user-scoped Neo4j graph lookup, and returns fused graph evidence. Every
call is scoped to ``tenant_id == user_id``. All failures degrade to empty
evidence — retrieval never raises into the chat path, and it never returns
another user's data.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from ..clients.gemini import GeminiClient
from ..clients.neo4j import Neo4jClient
from ..clients.qdrant import QdrantClient
from ..models.common import UserContext

log = logging.getLogger("core.retriever")

# Recommendation node label per domain. New domains extend this map — the evidence
# traversal itself is domain-generic (it matches the HAS_RECOMMENDATION edge).
RECOMMENDATION_LABELS: dict[str, str] = {
    "finance": "FinancialRecommendation",
    "health": "HealthRecommendation",
    "career": "CareerRecommendation",
    "education": "EducationRecommendation",
    "family": "FamilyRecommendation",
}


class Retriever:
    def __init__(self, gemini: GeminiClient, qdrant: QdrantClient, neo4j: Neo4jClient) -> None:
        self._gemini = gemini
        self._qdrant = qdrant
        self._neo4j = neo4j

    async def retrieve_personal(
        self,
        query: str,
        ctx: UserContext,
        *,
        domain: Optional[str] = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """Return fused, user-scoped graph evidence. [] if nothing configured/found."""
        if not query or not query.strip():
            return []

        evidence: list[dict[str, Any]] = []

        # --- vector (Qdrant), if Gemini + Qdrant are configured ---
        if self._gemini.configured and self._qdrant.configured:
            try:
                vector = await self._gemini.embed(query)
                hits = await self._qdrant.search_personal(
                    vector, user_id=ctx.user_id, limit=limit, domain=domain
                )
                for h in hits:
                    payload = h.get("payload", {}) if isinstance(h, dict) else {}
                    evidence.append(
                        {
                            "source": "qdrant",
                            "entity_type": payload.get("entity_type"),
                            "entity_id": payload.get("entity_id"),
                            "title": payload.get("title"),
                            "score": h.get("score") if isinstance(h, dict) else None,
                        }
                    )
            except Exception as exc:  # noqa: BLE001
                log.warning("vector retrieval degraded: %s", exc)

        # --- graph (Neo4j): user-scoped, domain-filtered nodes with their real content ---
        # Every node the worker writes carries tenant_id/entity_id/domain/title/summary (see
        # ingestion-worker normalizer). Filter to the turn's domain when known and return the title +
        # summary so the advisor gets the user's actual graph entities as grounding — not a bare label dump.
        if self._neo4j.configured:
            try:
                rows = await self._neo4j.query_personal(
                    "MATCH (n {tenant_id: $user_id}) "
                    "WHERE $domain IS NULL OR n.domain = $domain "
                    "RETURN labels(n) AS labels, n.entity_id AS entity_id, n.title AS title, "
                    "n.summary AS summary, n.domain AS domain "
                    "LIMIT $k",
                    user_id=ctx.user_id,
                    parameters={"k": limit, "domain": domain},
                )
                for row in rows:
                    labels = row[0] if len(row) > 0 and row[0] else None
                    evidence.append(
                        {
                            "source": "neo4j",
                            "label": labels[0] if isinstance(labels, list) and labels else labels,
                            "entity_id": row[1] if len(row) > 1 else None,
                            "title": row[2] if len(row) > 2 else None,
                            "summary": row[3] if len(row) > 3 else None,
                            "domain": row[4] if len(row) > 4 else None,
                            "score": None,
                        }
                    )
            except Exception as exc:  # noqa: BLE001
                log.warning("graph retrieval degraded: %s", exc)

        return evidence

    async def recommendation_evidence(
        self, ctx: UserContext, *, domain: str | None = None
    ) -> list[dict[str, Any]]:
        """Domain-generic recommendation evidence retrieval.

        Traverses the user's recommendation subgraph — any domain via the
        HAS_RECOMMENDATION edge, or a specific domain's label when ``domain`` is set —
        and returns Evidence / Assumption / Tradeoff / AdviceBoundary as authoritative
        facts, so chat answers "why are you recommending this?" strictly from graph
        evidence (never invented rationale).

        Tenant-scoped (``tenant_id = $user_id``): no cross-tenant leakage. Returns
        ``[]`` when there is no matching recommendation (the explicit missing-evidence
        signal — the orchestrator's anti-hallucination gate then asks for data).
        """
        if not self._neo4j.configured:
            return []
        label = RECOMMENDATION_LABELS.get(domain) if domain else None
        rec_match = f"(r:{label})" if label else "(r)"
        cypher = (
            f"MATCH (u:UserProfile {{tenant_id: $user_id}})-[:HAS_RECOMMENDATION]->{rec_match} "
            "OPTIONAL MATCH (r)-[:HAS_EVIDENCE]->(e:Evidence) "
            "OPTIONAL MATCH (r)-[:HAS_ASSUMPTION]->(a:Assumption) "
            "OPTIONAL MATCH (r)-[:HAS_TRADEOFF]->(t:Tradeoff) "
            "OPTIONAL MATCH (r)-[:REQUIRES_REVIEW]->(b:AdviceBoundary) "
            "RETURN r.title AS title, "
            "collect(DISTINCT [e.metric_name, e.metric_value, e.source_table, e.confidence, e.explanation]) AS evidence, "
            "collect(DISTINCT [a.assumption_text, a.confidence]) AS assumptions, "
            "collect(DISTINCT [t.option_a, t.option_b]) AS tradeoffs, "
            "collect(DISTINCT [b.boundary_type, b.disclaimer_text]) AS boundaries"
        )
        facts: list[dict[str, Any]] = []
        try:
            rows = await self._neo4j.query_personal(cypher, user_id=ctx.user_id)
        except Exception as exc:  # noqa: BLE001
            log.warning("recommendation evidence retrieval degraded: %s", exc)
            return []
        for row in rows:
            title = (row[0] if len(row) > 0 else None) or "Recommendation"
            evidence = row[1] if len(row) > 1 and row[1] else []
            assumptions = row[2] if len(row) > 2 and row[2] else []
            tradeoffs = row[3] if len(row) > 3 and row[3] else []
            boundaries = row[4] if len(row) > 4 and row[4] else []
            for ev in evidence:
                if ev and ev[0] is not None:
                    expl = f" — {ev[4]}" if len(ev) > 4 and ev[4] else ""
                    facts.append(
                        {
                            "fact": f"[{title}] evidence: {ev[0]}",
                            "value": f"{ev[1]} (source {ev[2]}, confidence {ev[3]}){expl}",
                        }
                    )
            for a in assumptions:
                if a and a[0]:
                    conf = f" (confidence {a[1]})" if len(a) > 1 and a[1] is not None else ""
                    facts.append({"fact": f"[{title}] assumption", "value": f"{a[0]}{conf}"})
            for t in tradeoffs:
                if t and t[0]:
                    other = f" vs {t[1]}" if len(t) > 1 and t[1] else ""
                    facts.append({"fact": f"[{title}] tradeoff", "value": f"{t[0]}{other}"})
            for b in boundaries:
                bt = b[0] if b else None
                dt = b[1] if b and len(b) > 1 else None
                if bt or dt:
                    facts.append(
                        {"fact": f"[{title}] governance ({bt or 'boundary'})", "value": dt or "review boundary"}
                    )
        return facts
