"""Bounded, typed, tenant-scoped graph traversal.

WHY THIS EXISTS
---------------
Both previous retrievers ran `MATCH (n {tenant_id: $user_id}) ... LIMIT $k` — a filtered node scan with no
relationship pattern. The ontology declares ~62 typed relationships and 78 edge rules that retrieval never
read. This module is what makes the graph a graph: it starts from linked seed entities and walks the user's
real edges, returning PATHS so the advisor can cite *how* a fact connects, not just that it exists.

THREE HARD BOUNDS, because unbounded traversal on a dense personal graph is a latency and cost incident:

    max_hops     — depth (1-3, from the query plan)
    node_budget  — total nodes visited across the whole walk
    fan_out      — neighbours expanded per node per hop

TENANT SAFETY IS STRUCTURAL, NOT CONVENTIONAL
---------------------------------------------
Every node pattern this module emits carries `{tenant_id: $user_id}` — including the far end of every
relationship. A path cannot leave the tenant partition because there is no pattern in which the neighbour
is unconstrained. The generated Cypher is additionally checked by `Neo4jClient.query_personal`, which
refuses any statement lacking `$user_id` and refuses to let a caller override the bound tenant.

Relationship types are an ALLOWLIST resolved from the ontology (`planner.allowed_edge_types`) and are
validated against `_SAFE_REL` before interpolation. Cypher has no parameter form for relationship types or
labels, so interpolation is unavoidable — the allowlist plus the pattern check is what makes it safe.
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from .planner import EDGE_WEIGHT_FROM_ONTOLOGY, QueryPlan, allowed_edge_types

log = logging.getLogger("core.graphrag.traversal")

# A relationship type may only ever be UPPER_SNAKE. Anything else is refused before it reaches Cypher.
_SAFE_REL = re.compile(r"^[A-Z][A-Z0-9_]{1,48}$")

# Edge weights — not all relationships carry equal evidential value. `HAS_EVIDENCE` is a grounded,
# provenance-carrying link; `RELATED_TO` is the worker's fallback for an unmapped entity and means almost
# nothing. Weighting by type is the cheapest large win over unweighted traversal.
# Edge weights come from the SAME generated ontology contract the planner reads, so a relationship
# cannot be traversable-but-unweighted or weighted-but-untraversable. Both states existed: this table
# previously carried 38 hand-written entries against a 61-type vocabulary, and RELATED_TO had a weight
# here while appearing in no family — rankable, never reachable.
EDGE_WEIGHT: dict[str, float] = dict(EDGE_WEIGHT_FROM_ONTOLOGY)
_DEFAULT_EDGE_WEIGHT = 0.40
# Each additional hop multiplies confidence down. Two hops from a seed is materially weaker evidence.
HOP_DECAY = 0.55


@dataclass
class GraphNode:
    entity_id: str
    entity_type: str
    title: str
    summary: str
    domain: str
    hops: int
    path: tuple[str, ...]          # relationship types followed from the seed
    path_titles: tuple[str, ...]   # human-readable trail, for citations
    seed_entity_id: str
    score: float = 0.0

    def provenance(self) -> str:
        """How this node was reached — rendered into evidence so the advisor can cite the connection."""
        if not self.path:
            return "direct match"
        trail = " → ".join(self.path_titles) if self.path_titles else " → ".join(self.path)
        return f"{self.hops} hop{'s' if self.hops > 1 else ''} via {' → '.join(self.path)} ({trail})"


@dataclass
class TraversalResult:
    nodes: list[GraphNode] = field(default_factory=list)
    nodes_visited: int = 0
    hops_executed: int = 0
    truncated: bool = False        # a bound stopped the walk — surfaced so budgets are tunable, not silent
    cypher_executed: list[str] = field(default_factory=list)


def _validate_rel_types(rel_types: tuple[str, ...]) -> list[str]:
    """Refuse anything that is not a plain UPPER_SNAKE relationship type."""
    safe: list[str] = []
    for r in rel_types:
        if _SAFE_REL.match(r):
            safe.append(r)
        else:  # pragma: no cover - defensive; the allowlist is ontology-derived
            log.warning("refusing unsafe relationship type in traversal: %r", r)
    return safe


def build_expand_cypher(rel_types: tuple[str, ...], *, fan_out: int) -> Optional[str]:
    """One hop of expansion from a set of frontier entity_ids.

    BOTH ends of the relationship are tenant-constrained. There is no pattern here in which a neighbour
    can belong to another tenant, which is what makes cross-tenant traversal structurally impossible
    rather than merely filtered out afterwards.
    """
    safe = _validate_rel_types(rel_types)
    if not safe:
        return None
    rels = "|".join(safe)
    return (
        # frontier node — tenant-scoped
        "MATCH (a {tenant_id: $user_id}) WHERE a.entity_id IN $frontier "
        # neighbour — ALSO tenant-scoped, in the same pattern
        f"MATCH (a)-[r:{rels}]-(b {{tenant_id: $user_id}}) "
        "WHERE b.entity_id IS NOT NULL AND NOT b.entity_id IN $visited "
        "WITH a, r, b, "
        "     coalesce(b.updated_at, b.created_at) AS recency "
        "RETURN a.entity_id AS from_id, type(r) AS rel, "
        "       b.entity_id AS entity_id, labels(b) AS labels, b.title AS title, "
        "       b.summary AS summary, b.domain AS domain, recency "
        "ORDER BY recency DESC "
        "LIMIT $fan_limit"
    )


def build_seed_cypher() -> str:
    """Hydrate seed entities by id. Tenant-scoped; ids come from a tenant-scoped vector search."""
    return (
        "MATCH (n {tenant_id: $user_id}) WHERE n.entity_id IN $ids "
        "RETURN n.entity_id AS entity_id, labels(n) AS labels, n.title AS title, "
        "       n.summary AS summary, n.domain AS domain"
    )


def build_lexical_seed_cypher() -> str:
    """Find seeds by title for an explicit mention ('my Roth IRA'). Tenant-scoped, case-insensitive."""
    return (
        "MATCH (n {tenant_id: $user_id}) "
        "WHERE n.title IS NOT NULL AND toLower(n.title) CONTAINS toLower($mention) "
        "RETURN n.entity_id AS entity_id, labels(n) AS labels, n.title AS title, "
        "       n.summary AS summary, n.domain AS domain "
        "LIMIT $k"
    )


def _label_of(labels: Any) -> str:
    if isinstance(labels, list) and labels:
        return str(labels[0])
    return str(labels or "Entity")


async def traverse(
    neo4j: Any,
    *,
    user_id: str,
    plan: QueryPlan,
    seeds: list[dict[str, Any]],
    fan_out: int = 12,
) -> TraversalResult:
    """Breadth-first, bounded, typed expansion from the seed set.

    `seeds` are dicts with at least `entity_id`; they come from tenant-scoped vector search or lexical
    linking. Degrades to whatever it has on error — retrieval must never raise into the chat path.
    """
    result = TraversalResult()
    if not user_id:
        raise ValueError("traverse requires a non-empty user_id")   # fail closed, never wildcard
    if not seeds:
        return result

    rel_types = allowed_edge_types(plan)
    visited: set[str] = set()
    by_id: dict[str, GraphNode] = {}

    for s in seeds:
        eid = str(s.get("entity_id") or "").strip()
        if not eid or eid in visited:
            continue
        visited.add(eid)
        by_id[eid] = GraphNode(
            entity_id=eid,
            entity_type=_label_of(s.get("labels") or s.get("entity_type")),
            title=str(s.get("title") or ""),
            summary=str(s.get("summary") or ""),
            domain=str(s.get("domain") or ""),
            hops=0,
            path=(),
            path_titles=(),
            seed_entity_id=eid,
            score=float(s.get("score") or 0.0),
        )

    result.nodes_visited = len(visited)
    frontier = list(visited)

    cypher = build_expand_cypher(rel_types, fan_out=fan_out)
    if cypher is None:
        result.nodes = list(by_id.values())
        return result

    for hop in range(1, max(0, plan.max_hops) + 1):
        if not frontier:
            break
        if result.nodes_visited >= plan.node_budget:
            result.truncated = True
            break
        try:
            # NAMED rows — this RETURN has nine columns and is read by name below. `query_personal`
            # returns positional rows, against which every `row.get(...)` raises and the handler below
            # would swallow it as a generic "degraded" with hops_executed=0. That failure is
            # indistinguishable from a sparse graph, which is why the shape is pinned here explicitly.
            rows = await neo4j.query_personal_dicts(
                cypher,
                user_id=user_id,
                parameters={
                    "frontier": frontier[:fan_out * 4],
                    "visited": list(visited)[:2000],
                    "fan_limit": int(fan_out * max(1, len(frontier))),
                },
            )
        except Exception as exc:  # noqa: BLE001 — degrade; never break the turn
            log.warning("graph traversal hop %s degraded: %s", hop, exc)
            break

        result.cypher_executed.append(cypher)
        result.hops_executed = hop
        next_frontier: list[str] = []

        for row in rows or []:
            if result.nodes_visited >= plan.node_budget:
                result.truncated = True
                break
            from_id = str(row.get("from_id") or "")
            eid = str(row.get("entity_id") or "")
            rel = str(row.get("rel") or "")
            if not eid or eid in visited:
                continue
            parent = by_id.get(from_id)
            if parent is None:
                continue

            visited.add(eid)
            result.nodes_visited += 1
            next_frontier.append(eid)

            edge_w = EDGE_WEIGHT.get(rel, _DEFAULT_EDGE_WEIGHT)
            # Confidence decays with distance and with the weakness of the edge traversed.
            score = (parent.score or 0.5) * edge_w * (HOP_DECAY ** (hop - 1))
            title = str(row.get("title") or "")
            by_id[eid] = GraphNode(
                entity_id=eid,
                entity_type=_label_of(row.get("labels")),
                title=title,
                summary=str(row.get("summary") or ""),
                domain=str(row.get("domain") or ""),
                hops=hop,
                path=parent.path + (rel,),
                path_titles=parent.path_titles + ((parent.title or parent.entity_type),) if hop == 1
                else parent.path_titles + (title,),
                seed_entity_id=parent.seed_entity_id,
                score=score,
            )

        frontier = next_frontier

    result.nodes = list(by_id.values())
    return result
