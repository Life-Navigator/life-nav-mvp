"""Semantic GraphRAG engine — the single authoritative retrieval path.

    plan → seed (vector + lexical entity linking) → bounded typed traversal → hybrid fusion → rerank

OWNERSHIP
---------
Per the Phase 5A decision, core-api owns GraphRAG orchestration. This module consolidates what were three
divergent implementations:

  * `app/grounding/retriever.py`            — vector + flat node scan, no fusion  (superseded)
  * `apps/api-gateway/.../graphrag_personal` — RRF + central, no traversal        (HARVESTED here)
  * `supabase/functions/graphrag-query`      — a third variant                    (to be retired)

Harvested from the gateway: reciprocal rank fusion (k=60), the central/world-knowledge channel, the
required-kwarg tenant signature, and the refuse-untenanted-Cypher contract. Added here: query planning,
entity linking, bounded multi-hop typed traversal, feature reranking, and relevance thresholding.

TENANT SAFETY
-------------
`user_id` is a required keyword argument at every layer, so omitting it is a static error rather than a
silent wildcard. Every generated Cypher pattern constrains BOTH ends of every relationship with
`{tenant_id: $user_id}`, and `Neo4jClient.query_personal` refuses statements lacking `$user_id` and refuses
parameter overrides of the bound tenant. Cross-tenant traversal is unrepresentable, not merely filtered.

FAILURE POSTURE
---------------
Retrieval degrades to fewer results, never to an exception in the chat path — but each degradation is
logged with its cause, so "the graph stopped working" is visible rather than silent.
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from .fusion import DEFAULT_THRESHOLD, Candidate, fuse
from .planner import QueryPlan, plan_query
from .traversal import build_lexical_seed_cypher, traverse

log = logging.getLogger("core.graphrag.engine")


@dataclass
class RetrievalTrace:
    """Per-turn diagnostics. Retrieval quality is unobservable without this."""
    plan: str = ""
    intent: str = ""
    vector_seeds: int = 0
    lexical_seeds: int = 0
    nodes_visited: int = 0
    hops_executed: int = 0
    truncated: bool = False
    central_hits: int = 0
    candidates: int = 0
    returned: int = 0
    latency_ms: int = 0
    degraded: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "plan": self.plan, "intent": self.intent, "vector_seeds": self.vector_seeds,
            "lexical_seeds": self.lexical_seeds, "nodes_visited": self.nodes_visited,
            "hops": self.hops_executed, "truncated": self.truncated,
            "central_hits": self.central_hits, "candidates": self.candidates,
            "returned": self.returned, "latency_ms": self.latency_ms, "degraded": self.degraded,
        }


class SemanticGraphRAG:
    """Tenant-scoped semantic retrieval over the user's personal graph plus shared knowledge."""

    def __init__(self, *, gemini: Any, qdrant: Any, neo4j: Any, central_qdrant: Any = None,
                 threshold: float = DEFAULT_THRESHOLD) -> None:
        self._gemini = gemini
        self._qdrant = qdrant
        self._neo4j = neo4j
        self._central = central_qdrant     # optional; None disables the central channel
        self._threshold = threshold

    @property
    def available(self) -> bool:
        return bool(getattr(self._gemini, "configured", False) and
                    (getattr(self._qdrant, "configured", False) or
                     getattr(self._neo4j, "configured", False)))

    async def retrieve(
        self,
        message: str,
        *,
        user_id: str,
        domain: Optional[str] = None,
        limit: int = 12,
    ) -> tuple[list[dict[str, Any]], RetrievalTrace]:
        """Return (evidence, trace). `user_id` is REQUIRED — there is no untenanted retrieval."""
        if not user_id:
            raise ValueError("SemanticGraphRAG.retrieve requires a non-empty user_id")

        t0 = time.perf_counter()
        trace = RetrievalTrace()
        if not (message or "").strip():
            return [], trace

        plan = plan_query(message, domain_hint=domain)
        trace.plan, trace.intent = plan.describe(), plan.intent.value

        vector_hits = await self._vector_seeds(plan, user_id=user_id, trace=trace)
        lexical = await self._lexical_seeds(plan, user_id=user_id, trace=trace)

        seeds = self._merge_seeds(vector_hits, lexical, limit=plan.seed_limit)

        graph_nodes: list[Any] = []
        if seeds and getattr(self._neo4j, "configured", False):
            try:
                tr = await traverse(self._neo4j, user_id=user_id, plan=plan, seeds=seeds)
                graph_nodes = tr.nodes
                trace.nodes_visited = tr.nodes_visited
                trace.hops_executed = tr.hops_executed
                trace.truncated = tr.truncated
            except Exception as exc:  # noqa: BLE001
                trace.degraded.append(f"traversal:{type(exc).__name__}")
                log.warning("traversal degraded: %s", exc)

        central_hits = await self._central_hits(plan, trace=trace)

        candidates: list[Candidate] = fuse(
            vector_hits=vector_hits,
            graph_nodes=graph_nodes,
            central_hits=central_hits,
            plan_domains=plan.domains,
            wants_evidence=plan.wants_evidence,
            threshold=self._threshold,
            limit=limit,
        )
        trace.candidates = len(graph_nodes) + len(vector_hits) + len(central_hits)
        trace.returned = len(candidates)
        trace.latency_ms = int((time.perf_counter() - t0) * 1000)

        if trace.degraded:
            # LOUD: a permanently broken store must not present as "the user has no data".
            log.warning("graphrag_degraded %s", trace.as_dict())

        return [c.to_evidence() for c in candidates], trace

    # ── channels ────────────────────────────────────────────────────────────────────────────────

    async def _vector_seeds(self, plan: QueryPlan, *, user_id: str, trace: RetrievalTrace) -> list[dict]:
        if not (getattr(self._gemini, "configured", False) and getattr(self._qdrant, "configured", False)):
            return []
        try:
            vector = await self._gemini.embed(plan.query)
            hits = await self._qdrant.search_personal(
                vector, user_id=user_id, limit=plan.seed_limit,
                domain=(plan.domains[0] if plan.domains else None),
            ) or []
            trace.vector_seeds = len(hits)
            return hits
        except Exception as exc:  # noqa: BLE001
            trace.degraded.append(f"vector:{type(exc).__name__}")
            log.warning("vector seeding degraded: %s", exc)
            return []

    async def _lexical_seeds(self, plan: QueryPlan, *, user_id: str, trace: RetrievalTrace) -> list[dict]:
        """Explicit mentions ('my Roth IRA') often beat embeddings for named entities."""
        if not plan.mentions or not getattr(self._neo4j, "configured", False):
            return []
        out: list[dict] = []
        cypher = build_lexical_seed_cypher()
        for mention in plan.mentions[:3]:
            try:
                # NAMED rows — see traversal.traverse. With positional rows the `isinstance(r, dict)`
                # test below is simply always False, so lexical linking would contribute nothing and
                # report no error at all: the quietest possible failure.
                rows = await self._neo4j.query_personal_dicts(
                    cypher, user_id=user_id, parameters={"mention": mention, "k": 3}
                )
                for r in rows or []:
                    if isinstance(r, dict) and r.get("entity_id"):
                        out.append(r)
            except Exception as exc:  # noqa: BLE001
                trace.degraded.append(f"lexical:{type(exc).__name__}")
                log.warning("lexical linking degraded for %r: %s", mention, exc)
        trace.lexical_seeds = len(out)
        return out

    async def _central_hits(self, plan: QueryPlan, *, trace: RetrievalTrace) -> list[dict]:
        """Shared world knowledge. NO tenant filter by design — the collection holds no per-user data."""
        if not (plan.include_central and self._central is not None):
            return []
        if not getattr(self._gemini, "configured", False):
            return []
        try:
            vector = await self._gemini.embed(plan.query)
            hits = await self._central.search_central(
                vector, limit=max(3, plan.seed_limit // 2),
                domain=(plan.domains[0] if plan.domains else None),
            ) or []
            trace.central_hits = len(hits)
            return hits
        except Exception as exc:  # noqa: BLE001
            trace.degraded.append(f"central:{type(exc).__name__}")
            log.warning("central retrieval degraded: %s", exc)
            return []

    # ── helpers ─────────────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _merge_seeds(vector_hits: list[dict], lexical: list[dict], *, limit: int) -> list[dict]:
        """Lexical matches first — an explicit mention is a stronger signal than a nearby embedding."""
        seeds: list[dict] = []
        seen: set[str] = set()
        for row in lexical:
            eid = str(row.get("entity_id") or "")
            if eid and eid not in seen:
                seen.add(eid)
                seeds.append({**row, "score": 1.0})
        for hit in vector_hits:
            payload = hit.get("payload") or hit
            eid = str(payload.get("entity_id") or "")
            if eid and eid not in seen:
                seen.add(eid)
                seeds.append({
                    "entity_id": eid,
                    "entity_type": payload.get("entity_type"),
                    "title": payload.get("title"),
                    "summary": payload.get("summary"),
                    "domain": payload.get("domain"),
                    "score": float(hit.get("score") or 0.5),
                })
        return seeds[:limit]
