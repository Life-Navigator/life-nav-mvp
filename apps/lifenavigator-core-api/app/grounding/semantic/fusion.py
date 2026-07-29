"""Hybrid fusion and reranking across retrieval channels.

WHY THIS EXISTS
---------------
core-api's previous retriever concatenated the vector list and the graph list and handed the result to the
model in arrival order, with `score: None` on every graph row. That is not hybrid retrieval — it is two
lists glued together, and it means the most relevant evidence had no way to reach the top.

`rrf()` below is HARVESTED from `apps/api-gateway/app/services/graphrag_personal.py::rrf_fuse` — the
orphaned tier's implementation, which was the only correct fusion in the repository. It is reproduced with
the same k=60 constant and the same (entity_type, entity_id) keying so results are comparable, and a test
pins that fidelity.

WHAT IS ADDED ON TOP
--------------------
1. A THIRD channel — central/world knowledge — which the gateway fused but core-api had no concept of.
2. A feature-based RERANKER. A cross-encoder would cost a model call per turn on a p50 that is already the
   dominant complaint; instead we rank on signals we actually have and can explain: semantic similarity,
   graph distance, edge strength, recency, domain match, and evidential value. Every result carries the
   reason it ranked where it did, which the advisor's citation layer can surface.
3. A RELEVANCE THRESHOLD, so weak evidence is dropped rather than padded into the prompt. Passing
   everything to the model is how ungrounded answers get "supported" by irrelevant context.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

RRF_K = 60          # harvested constant — matches api-gateway's rrf_fuse
DEFAULT_THRESHOLD = 0.10


@dataclass
class Candidate:
    entity_type: str
    entity_id: str
    title: str
    summary: str
    domain: str
    channels: set[str] = field(default_factory=set)
    rrf_score: float = 0.0
    vector_score: Optional[float] = None
    hops: int = 0
    path: tuple[str, ...] = ()
    provenance: str = ""
    recency: Optional[str] = None
    final_score: float = 0.0
    rank_reasons: list[str] = field(default_factory=list)

    def key(self) -> tuple[str, str]:
        return (self.entity_type, self.entity_id)

    def to_evidence(self) -> dict[str, Any]:
        """The shape the advisor context consumes. Provenance travels with the fact, never separately."""
        return {
            "source": "+".join(sorted(self.channels)) or "graph",
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "title": self.title,
            "summary": self.summary,
            "domain": self.domain,
            "score": round(self.final_score, 6),
            "hops": self.hops,
            "path": list(self.path),
            "provenance": self.provenance,
            "why_ranked": "; ".join(self.rank_reasons),
        }


def _key_of(hit: dict[str, Any]) -> Optional[tuple[str, str]]:
    payload = hit.get("payload") or hit
    et = payload.get("entity_type")
    eid = payload.get("entity_id")
    if not et or not eid:
        return None
    return (str(et), str(eid))


def rrf(ranked_lists: list[list[dict[str, Any]]], *, k: int = RRF_K) -> dict[tuple[str, str], float]:
    """Reciprocal Rank Fusion over N ranked lists.

    Score(d) = Σ 1 / (k + rank(d)). Rank-based, so it needs no score normalisation across channels whose
    scores are not comparable (cosine similarity vs a decayed graph confidence).
    """
    scores: dict[tuple[str, str], float] = {}
    for lst in ranked_lists:
        for rank, hit in enumerate(lst or []):
            key = _key_of(hit)
            if key is None:
                continue
            scores[key] = scores.get(key, 0.0) + 1.0 / (k + rank)
    return scores


def _recency_boost(recency: Optional[str]) -> tuple[float, str]:
    """Newer facts about a person's life are usually the true ones. Half-life ~180 days."""
    if not recency:
        return 0.0, ""
    try:
        ts = datetime.fromisoformat(str(recency).replace("Z", "+00:00"))
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        days = max(0.0, (datetime.now(timezone.utc) - ts).total_seconds() / 86400.0)
    except (ValueError, TypeError):
        return 0.0, ""
    boost = 0.15 * math.exp(-days / 180.0)
    if boost >= 0.05:
        return boost, f"recent ({int(days)}d)"
    return boost, ""


# Entity types that carry provenance by construction — the advisor's trust spine values these most.
_EVIDENTIAL = frozenset({"Evidence", "Assumption", "Tradeoff", "AdviceBoundary", "Recommendation",
                         "FinancialRecommendation", "HealthRecommendation", "CareerRecommendation",
                         "EducationRecommendation", "FamilyRecommendation", "Decision"})


def rerank(
    candidates: list[Candidate],
    *,
    plan_domains: tuple[str, ...] = (),
    wants_evidence: bool = False,
    threshold: float = DEFAULT_THRESHOLD,
    limit: int = 12,
) -> list[Candidate]:
    """Feature-based reranking. Deterministic, explainable, no model call.

    Every contribution appends a human-readable reason, so a surprising ranking can be diagnosed from the
    trace instead of guessed at.
    """
    if not candidates:
        return []

    max_rrf = max((c.rrf_score for c in candidates), default=0.0) or 1.0

    for c in candidates:
        reasons: list[str] = []

        # 1. Fused retrieval rank, normalised to the best candidate this turn.
        base = c.rrf_score / max_rrf
        score = base * 0.50
        if base > 0.0:
            reasons.append(f"fused rank {base:.2f}")

        # 2. Multi-channel agreement — found by vector AND graph is a strong signal.
        if len(c.channels) > 1:
            score += 0.12
            reasons.append(f"agreed by {len(c.channels)} channels")

        # 3. Graph distance. A direct hit outranks a two-hop inference.
        if c.hops == 0:
            score += 0.15
            reasons.append("direct match")
        elif c.hops == 1:
            score += 0.08
            reasons.append("1 hop")
        else:
            score += max(0.0, 0.05 - 0.01 * (c.hops - 2))
            reasons.append(f"{c.hops} hops")

        # 4. Domain alignment with the planned domains.
        if plan_domains and c.domain and c.domain in plan_domains:
            score += 0.10
            reasons.append(f"domain {c.domain}")

        # 5. Evidential value — only when the plan actually asked "why".
        if wants_evidence and c.entity_type in _EVIDENTIAL:
            score += 0.12
            reasons.append("evidential node")

        # 6. Recency.
        boost, why = _recency_boost(c.recency)
        score += boost
        if why:
            reasons.append(why)

        # 7. Substance — a node with no title and no summary cannot ground anything.
        if not (c.title or c.summary):
            score *= 0.35
            reasons.append("no content (penalised)")

        c.final_score = round(score, 6)
        c.rank_reasons = reasons

    kept = [c for c in candidates if c.final_score >= threshold]
    kept.sort(key=lambda x: (-x.final_score, x.entity_id))
    return kept[:limit]


def fuse(
    *,
    vector_hits: list[dict[str, Any]],
    graph_nodes: list[Any],
    central_hits: Optional[list[dict[str, Any]]] = None,
    plan_domains: tuple[str, ...] = (),
    wants_evidence: bool = False,
    threshold: float = DEFAULT_THRESHOLD,
    limit: int = 12,
) -> list[Candidate]:
    """Fuse all channels into one ranked, thresholded, explainable candidate list."""
    central_hits = central_hits or []

    graph_as_hits = [
        {"entity_type": n.entity_type, "entity_id": n.entity_id, "title": n.title,
         "summary": n.summary, "domain": n.domain}
        for n in sorted(graph_nodes, key=lambda x: -getattr(x, "score", 0.0))
    ]
    scores = rrf([vector_hits, graph_as_hits, central_hits])

    by_key: dict[tuple[str, str], Candidate] = {}

    def _upsert(key: tuple[str, str], channel: str, payload: dict[str, Any]) -> Candidate:
        c = by_key.get(key)
        if c is None:
            c = Candidate(
                entity_type=key[0], entity_id=key[1],
                title=str(payload.get("title") or ""),
                summary=str(payload.get("summary") or ""),
                domain=str(payload.get("domain") or ""),
                rrf_score=scores.get(key, 0.0),
            )
            by_key[key] = c
        c.channels.add(channel)
        if not c.title:
            c.title = str(payload.get("title") or "")
        if not c.summary:
            c.summary = str(payload.get("summary") or "")
        return c

    for hit in vector_hits or []:
        key = _key_of(hit)
        if key is None:
            continue
        payload = hit.get("payload") or hit
        c = _upsert(key, "vector", payload)
        c.vector_score = hit.get("score")
        c.recency = c.recency or payload.get("updated_at") or payload.get("created_at")
        if not c.provenance:
            c.provenance = "semantic match"

    for n in graph_nodes or []:
        key = (n.entity_type, n.entity_id)
        c = _upsert(key, "graph", {"title": n.title, "summary": n.summary, "domain": n.domain})
        # A node reachable by several paths keeps the shortest — the strongest explanation.
        if not c.path or n.hops < c.hops:
            c.hops = n.hops
            c.path = n.path
            c.provenance = n.provenance()

    for hit in central_hits or []:
        key = _key_of(hit)
        if key is None:
            continue
        payload = hit.get("payload") or hit
        c = _upsert(key, "central", payload)
        if not c.provenance:
            c.provenance = "shared knowledge base"

    return rerank(
        list(by_key.values()),
        plan_domains=plan_domains,
        wants_evidence=wants_evidence,
        threshold=threshold,
        limit=limit,
    )
