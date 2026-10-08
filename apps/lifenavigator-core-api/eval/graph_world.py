"""A synthetic graph that actually walks edges — so retrieval BEHAVIOUR is testable offline.

WHY THIS EXISTS WHEN 65 GRAPHRAG TESTS ALREADY PASS
---------------------------------------------------
The existing suite is strong on STRUCTURE and it covers the things that matter most: every generated
Cypher pattern is tenant-constrained, the client refuses untenanted statements and tenant overrides,
hop bounds and node budgets hold, RRF matches the harvested formula, all 147 manifest relationship
types are reachable. Those tests assert on generated Cypher and on contracts rather than on rows,
deliberately — a results-only test would pass against an implementation that fetched everything and
filtered in Python.

What they cannot answer is whether retrieval FINDS THE RIGHT THINGS, because their fakes return
scripted single rows. `_FakeNeo4j(hop_rows)` replays a list; it does not contain a graph. So the one
question production readiness actually turns on — "does a bounded typed traversal surface the
evidence a question needs?" — has never been measurable without a live Neo4j and human relevance
labels.

This module closes that gap for the MECHANICS of relevance. It is a real graph: nodes, typed edges,
and a query engine that walks them. Because the world is declared, the ground truth is known — so a
case can assert "the CONFLICTS edge two hops out must be found" without anyone labelling anything.

WHAT IT DOES AND DOES NOT PROVE
-------------------------------
Proves, in CI, with no credentials: multi-hop reach, that typed traversal finds relationships flat
vector search cannot, domain narrowing, threshold behaviour, dragnet detection, and tenant isolation
against a graph that genuinely contains another user's subgraph (strictly stronger than a fake that
returns one hardcoded row).

Does NOT prove retrieval is relevant to REAL users. That still needs human labels over the live
graph — `eval/fixtures/retrieval_cases.json` and the README cover that, and it stays the honest
precondition for flipping `GRAPH_GROUNDING_ENABLED`.

CONTRACT FIDELITY
-----------------
`query_personal` returns POSITIONAL rows and `query_personal_dicts` returns named ones, because the
real `Neo4jClient` does. The existing suite documents a production defect that a fake hid by
returning dicts from both: traversal's `row.get(...)` passed under test and raised against a live
database, where the hop handler swallowed it as "degraded" and the walk silently returned seeds only.
Emulating the dual contract is what stops this file from hiding the same class of bug.
"""
from __future__ import annotations

import json
import pathlib
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from .model import FIXTURES


@dataclass(frozen=True)
class Node:
    entity_id: str
    tenant_id: str
    labels: tuple[str, ...]
    title: str
    domain: str
    summary: str = ""
    updated_at: str = "2026-01-01"


@dataclass(frozen=True)
class Edge:
    src: str
    rel: str
    dst: str
    tenant_id: str


@dataclass
class GraphWorld:
    """An in-memory typed graph, loaded from a declarative fixture."""

    nodes: dict[str, Node] = field(default_factory=dict)
    edges: list[Edge] = field(default_factory=list)

    @classmethod
    def load(cls, path: Optional[pathlib.Path] = None) -> "GraphWorld":
        p = path or FIXTURES / "graph_world.json"
        doc = json.loads(p.read_text())
        w = cls()
        for n in doc["nodes"]:
            w.nodes[n["entity_id"]] = Node(
                entity_id=n["entity_id"], tenant_id=n["tenant_id"],
                labels=tuple(n.get("labels") or ["Entity"]), title=n["title"],
                domain=n.get("domain", "general"), summary=n.get("summary", ""),
                updated_at=n.get("updated_at", "2026-01-01"),
            )
        for e in doc["edges"]:
            src = w.nodes[e["src"]]
            w.edges.append(Edge(src=e["src"], rel=e["rel"], dst=e["dst"], tenant_id=src.tenant_id))
        return w

    def neighbours(self, entity_id: str, rels: set[str], tenant: str) -> list[tuple[str, str]]:
        """(rel, neighbour_id) pairs reachable in one hop, UNDIRECTED, tenant-scoped.

        Undirected because `build_expand_cypher` emits `(a)-[r:...]-(b)` with no arrow. Matching that
        matters: treating edges as directed here would make this fixture answer a different question
        than production asks.
        """
        out: list[tuple[str, str]] = []
        for e in self.edges:
            if e.tenant_id != tenant or e.rel not in rels:
                continue
            if e.src == entity_id and self._in_tenant(e.dst, tenant):
                out.append((e.rel, e.dst))
            elif e.dst == entity_id and self._in_tenant(e.src, tenant):
                out.append((e.rel, e.src))
        return out

    def _in_tenant(self, entity_id: str, tenant: str) -> bool:
        n = self.nodes.get(entity_id)
        return bool(n and n.tenant_id == tenant)

    def by_domain(self, tenant: str, domain: Optional[str]) -> list[Node]:
        return [n for n in self.nodes.values()
                if n.tenant_id == tenant and (domain is None or n.domain == domain)]


# ── Store doubles over the world ──────────────────────────────────────────────────────────────────
class WorldNeo4j:
    """Neo4j double that answers the engine's real Cypher by walking `GraphWorld`.

    It parses only what it must: the relationship alternation out of the expand pattern. Anything
    else it cannot recognise raises, rather than returning [] — a double that silently answers
    "no rows" to a query it did not understand would report retrieval as working-but-empty, which
    is indistinguishable from a broken traversal and far harder to notice.
    """

    configured = True

    def __init__(self, world: GraphWorld) -> None:
        self._w = world
        self.statements: list[str] = []
        self.tenants_seen: set[str] = set()

    async def query_personal_dicts(self, statement: str, *, user_id: str,
                                   parameters: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        # Signature mirrors the real Neo4jClient EXACTLY: keyword-only `user_id` and `parameters`.
        # A double with a different signature fails as "hop degraded" inside the engine's broad
        # except-handler, which looks like an empty graph rather than a broken test double — the
        # same silent-degradation class the existing suite documents.
        params = parameters or {}
        self.statements.append(statement)
        self.tenants_seen.add(user_id)
        self._assert_tenanted(statement, params, user_id)

        if "$frontier" in statement:
            rels = self._rels_from(statement)
            frontier = list(params.get("frontier") or [])
            visited = set(params.get("visited") or [])
            limit = int(params.get("fan_limit") or 25)
            rows: list[dict[str, Any]] = []
            for fid in frontier:
                for rel, nid in self._w.neighbours(fid, rels, user_id):
                    if nid in visited:
                        continue
                    n = self._w.nodes[nid]
                    rows.append({"from_id": fid, "rel": rel, "entity_id": n.entity_id,
                                 "labels": list(n.labels), "title": n.title,
                                 "summary": n.summary, "domain": n.domain,
                                 "recency": n.updated_at})
            rows.sort(key=lambda r: r["recency"], reverse=True)
            return rows[:limit]

        if "$ids" in statement:   # seed hydration
            ids = list(params.get("ids") or [])
            return [self._row(self._w.nodes[i]) for i in ids
                    if i in self._w.nodes and self._w.nodes[i].tenant_id == user_id]

        if "$terms" in statement or "toLower" in statement:   # lexical seeding
            terms = [str(t).lower() for t in (params.get("terms") or [])]
            hits = [n for n in self._w.nodes.values()
                    if n.tenant_id == user_id
                    and any(t in n.title.lower() or t in n.summary.lower() for t in terms)]
            return [self._row(n) for n in hits[: int(params.get("limit") or 20)]]

        raise AssertionError(
            f"WorldNeo4j does not recognise this statement, and refuses to answer 'no rows' to a "
            f"query it did not understand: {statement[:160]}"
        )

    async def query_personal(self, statement: str, *, user_id: str,
                             parameters: dict[str, Any] | None = None) -> list[list[Any]]:
        """POSITIONAL rows, exactly as the real client returns — see the module docstring."""
        dicts = await self.query_personal_dicts(statement, user_id=user_id, parameters=parameters)
        return [list(d.values()) for d in dicts]

    @staticmethod
    def _row(n: Node) -> dict[str, Any]:
        return {"entity_id": n.entity_id, "labels": list(n.labels), "title": n.title,
                "summary": n.summary, "domain": n.domain}

    @staticmethod
    def _rels_from(statement: str) -> set[str]:
        m = re.search(r"-\[r:([A-Z_|]+)\]-", statement)
        if not m:
            raise AssertionError(f"no relationship alternation in expand Cypher: {statement[:160]}")
        return set(m.group(1).split("|"))

    @staticmethod
    def _assert_tenanted(statement: str, params: dict[str, Any], user_id: str) -> None:
        """Mirror the real client's refusal contract, so a regression fails here too.

        The production client refuses statements without `$user_id` and refuses a parameter override
        of the bound tenant. A double that skipped these would let the harness pass against code the
        real client would reject.
        """
        if "$user_id" not in statement:
            raise AssertionError("untenanted statement reached the store")
        if "user_id" in params and params["user_id"] != user_id:
            raise AssertionError("tenant override attempted via params")


class WorldQdrant:
    """Vector search double. Scores by term overlap — deterministic and inspectable.

    Real embeddings are not needed to ask the questions this probe asks. What matters is that vector
    search returns PLAUSIBLE SEEDS and nothing more, so a case can prove the typed traversal is what
    reached the answer rather than the seeding having handed it over directly.
    """

    configured = True

    def __init__(self, world: GraphWorld, *, top_k: int = 3) -> None:
        self._w = world
        self._k = top_k
        self.queries: list[str] = []

    async def search_personal(self, vector: Any, *, user_id: str, limit: int = 10,
                              domain: Optional[str] = None) -> list[dict[str, Any]]:
        terms = set(getattr(vector, "terms", []) or [])
        self.queries.append(" ".join(sorted(terms)))
        scored: list[tuple[float, Node]] = []
        for n in self._w.by_domain(user_id, domain):
            text = f"{n.title} {n.summary}".lower()
            overlap = sum(1 for t in terms if t in text)
            if overlap:
                scored.append((overlap / max(1, len(terms)), n))
        scored.sort(key=lambda s: (-s[0], s[1].entity_id))
        return [{"payload": {"entity_type": n.labels[0], "entity_id": n.entity_id,
                             "title": n.title, "summary": n.summary, "domain": n.domain},
                 "score": round(score, 3)}
                for score, n in scored[: min(limit, self._k)]]


class WorldGemini:
    """Embedding double. Returns the query's terms so WorldQdrant can score lexically."""

    configured = True

    class _Vec(list):
        terms: list[str] = []

    async def embed(self, text: str) -> Any:
        v = self._Vec([0.0] * 8)
        v.terms = [t for t in re.findall(r"[a-z]{3,}", (text or "").lower())]
        return v
