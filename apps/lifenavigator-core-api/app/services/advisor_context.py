"""Advisor Context Builder (Hybrid Advisor sprint).

Assembles a DETERMINISTIC AdvisorContext from real DB/API sources only — the GUARDRAILS the LLM advisor
reasons inside. The rules here never script the conversation; they supply constraints, classified facts,
discovery scores, domain priorities, safety boundaries, the set of numbers the LLM may echo, and the
REAL graph relationships the user actually has.

Fact classification is first-class and the categories are NEVER merged:
  - confirmed_facts : the user stated it (or it is persisted) — known truth
  - candidate_facts : plausibly true, not yet confirmed (needs confirmation before it counts)
  - assumptions     : a default the engine applied because data is missing (must be surfaced, not hidden)
  - missing_data    : known-unknowns the advisor should work to fill, highest-value first

Relationship enrichment (GraphRAG): relationship_edges + connections come straight from the user's
PERSISTED personal life graph (life_graph_edges + domain-hub edges). The advisor may reference a
relationship ONLY when it appears here; if the graph has no edges, both lists are empty and the advisor
says nothing about connections.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Optional

from ..models.common import UserContext

LIFE = "life"

# Numbers the LLM is allowed to echo = numbers already present in the user's message / known context.
# Anything else in the LLM output is an invented figure and is rejected by the validator.
_NUM_RE = re.compile(r"\$?\d[\d,]*(?:\.\d+)?%?")

# Node types that are "primary" for relationship reasoning — the things a user calls "my goals".
# Domain hubs (ids ending in "_hub", e.g. education/career) are primary too so cross-domain links surface.
_PRIMARY_TYPES = {"Goal", "Life Objective"}

_SAFETY = [
    "Do not give medical, legal, or tax advice.",
    "Do not state final financial recommendations — those come from the recommendation engine.",
    "Never invent goals, facts, or numbers. If unknown, ask or mark as missing.",
    "Keep confirmed facts, candidate facts, assumptions and missing data in separate categories.",
    "You may suggest candidate facts/goals, but nothing is saved until a deterministic validator confirms it.",
    "Reference a relationship between goals/objectives ONLY if it appears in relationship_edges or "
    "graph_connections. If those are empty, do not mention any connection.",
]


def numbers_in(*texts: Optional[str]) -> set[str]:
    out: set[str] = set()
    for t in texts:
        if not t:
            continue
        for m in _NUM_RE.findall(str(t)):
            out.add(m.strip().lstrip("$").rstrip("%").replace(",", ""))
    return {n for n in out if n}


def _norm(s: Any) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def _is_primary(node: dict[str, Any]) -> bool:
    return node.get("type") in _PRIMARY_TYPES or str(node.get("id") or "").endswith("_hub")


def build_relationships(graph: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], set[frozenset[str]]]:
    """From a REAL personal_graph() result, derive:
      - relationship_edges : label-resolved real edges  [{from, from_type, rel, to, to_type, confidence}]
      - connections        : real primary-node links within 2 undirected hops, each with its `via` basis
      - connected_pairs    : set of frozenset({norm(a), norm(b)}) used by the validator to gate claims
    Everything here is computed from persisted edges only — never inferred. No edges → all empty.
    """
    nodes = graph.get("nodes") or []
    raw_edges = graph.get("edges") or []
    by_id = {n.get("id"): n for n in nodes if n.get("id")}

    def label(nid: str) -> str:
        return str((by_id.get(nid) or {}).get("label") or nid)

    def ntype(nid: str) -> str:
        return str((by_id.get(nid) or {}).get("type") or "")

    relationship_edges: list[dict[str, Any]] = []
    adj: dict[str, set[str]] = {}
    # A relationship the LLM may cite = any REAL direct edge, OR a real 2-hop connection (below).
    connected_pairs: set[frozenset[str]] = set()
    for e in raw_edges:
        a, b = e.get("from"), e.get("to")
        if a not in by_id or b not in by_id:
            continue
        la, lb = label(a), label(b)
        relationship_edges.append({
            "from": la, "from_type": ntype(a),
            "rel": e.get("rel"), "to": lb, "to_type": ntype(b),
            "confidence": e.get("confidence"),
        })
        if _norm(la) != _norm(lb):
            connected_pairs.add(frozenset({_norm(la), _norm(lb)}))
        adj.setdefault(a, set()).add(b)
        adj.setdefault(b, set()).add(a)

    # Real connections between primary nodes: a direct edge, or a single shared neighbour (2 hops).
    primary = [n["id"] for n in nodes if n.get("id") and _is_primary(n)]
    connections: list[dict[str, Any]] = []
    seen: set[frozenset[str]] = set()  # dedup the display list (citation gate is connected_pairs)
    for i in range(len(primary)):
        for j in range(i + 1, len(primary)):
            a, b = primary[i], primary[j]
            na, nb = adj.get(a, set()), adj.get(b, set())
            if b in na:
                basis, via, via_type = "direct_edge", None, None
            else:
                shared = na & nb
                if not shared:
                    continue
                via_id = sorted(shared)[0]
                basis, via, via_type = "shared_node", label(via_id), ntype(via_id)
            la, lb = label(a), label(b)
            pair = frozenset({_norm(la), _norm(lb)})
            if _norm(la) == _norm(lb) or pair in seen:
                continue
            seen.add(pair)
            connected_pairs.add(pair)  # 2-hop primary links are citable too
            connections.append({
                "a": la, "a_type": ntype(a), "b": lb, "b_type": ntype(b),
                "basis": basis, "via": via, "via_type": via_type,
            })
    # Bound the prompt — prefer connections that go through a meaningful shared node (objective/constraint).
    connections.sort(key=lambda c: (c["basis"] != "direct_edge", c.get("via_type") or ""))
    return relationship_edges[:40], connections[:15], connected_pairs


@dataclass
class AdvisorContext:
    user_id: str
    user_message: str
    current_stage: str  # the pending discovery key, or "complete"
    life_vision: Optional[str]
    primary_objective: Optional[str]
    candidate_goals: list[str]  # the user's OWN words (from the deterministic engine)
    rejected_goals: list[str]
    risks: list[str]
    opportunities: list[str]
    constraints: list[str]
    domains_touched: list[str]
    missing_areas: list[str]
    discovery_pct: int
    allowed_numbers: set[str]  # numbers the LLM may echo (validator guard)
    # Classified facts — kept strictly separate so the LLM never collapses them.
    confirmed_facts: list[dict[str, Any]] = field(default_factory=list)
    assumptions: list[dict[str, Any]] = field(default_factory=list)
    # Per-domain discovery scores + the priority order the LLM should use to choose the next question.
    discovery_scores: list[dict[str, Any]] = field(default_factory=list)
    domain_priorities: list[str] = field(default_factory=list)
    # Real graph relationships (GraphRAG enrichment) — empty unless the user has persisted edges.
    relationship_edges: list[dict[str, Any]] = field(default_factory=list)
    connections: list[dict[str, Any]] = field(default_factory=list)
    connected_pairs: set[frozenset[str]] = field(default_factory=set)
    safety_constraints: list[str] = field(default_factory=lambda: list(_SAFETY))

    @property
    def relationships_available(self) -> bool:
        return bool(self.relationship_edges or self.connections)

    def prompt_dict(self) -> dict[str, Any]:
        """The exact, bounded guardrail context handed to the LLM (no raw DB rows, no secrets).

        These are CONSTRAINTS and SIGNALS, not a script. The LLM uses discovery_scores +
        highest_value_missing to choose the next question, and may only reference relationships present
        in relationship_edges / graph_connections.
        """
        return {
            "current_stage": self.current_stage,
            "life_vision": self.life_vision,
            "primary_objective": self.primary_objective,
            "confirmed_facts": self.confirmed_facts,
            "candidate_facts": [],  # the deterministic engine asserts none yet; the LLM may propose some
            "assumptions": self.assumptions,
            "goals_heard_so_far": self.candidate_goals,
            "previously_rejected_goals": self.rejected_goals,
            "known_risks": self.risks,
            "known_opportunities": self.opportunities,
            "known_constraints": self.constraints,
            "domains_with_data": self.domains_touched,
            "areas_missing_data": self.missing_areas,
            "discovery_scores_by_domain": self.discovery_scores,
            "domain_priorities_lowest_coverage_first": self.domain_priorities,
            "discovery_completion_pct": self.discovery_pct,
            "relationship_edges": self.relationship_edges,
            "graph_connections": self.connections,
            "relationships_available": self.relationships_available,
            "user_message": self.user_message,
            "safety_constraints": self.safety_constraints,
        }


class AdvisorContextBuilder:
    def __init__(self, supabase: Any, coverage: Any = None, life: Any = None) -> None:
        self._sb = supabase
        self._coverage = coverage  # DiscoveryCoverageService (optional) — per-domain discovery scores
        self._life = life  # LifeDiscoveryService (optional) — real personal graph edges

    async def _rejected(self, ctx: UserContext) -> list[str]:
        try:
            rows = await self._sb.select("rejected_goals", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema=LIFE)
        except Exception:  # noqa: BLE001
            return []
        return [str(r.get("rejected_goal") or r.get("normalized_goal")) for r in (rows or []) if r.get("rejected_goal") or r.get("normalized_goal")]

    async def _scores(self, ctx: UserContext) -> tuple[list[dict[str, Any]], list[str]]:
        """Per-domain discovery scores + priority order (lowest coverage first) from the coverage service."""
        if self._coverage is None:
            return [], []
        try:
            cov = await self._coverage.coverage(ctx)
        except Exception:  # noqa: BLE001
            return [], []
        domains = cov.get("domains") or []
        scores = [
            {
                "domain": d.get("domain"),
                "label": d.get("label"),
                "coverage_pct": d.get("coverage_pct"),
                "status": d.get("status"),
                "missing_inputs": d.get("missing_inputs") or [],
            }
            for d in domains
        ]
        priorities = [
            str(d.get("domain"))
            for d in sorted(domains, key=lambda x: (x.get("coverage_pct") or 0))
            if (d.get("coverage_pct") or 0) < 80
        ]
        return scores, priorities

    async def _relationships(self, ctx: UserContext) -> tuple[list[dict[str, Any]], list[dict[str, Any]], set[frozenset[str]]]:
        """Real graph edges + connections from the persisted personal graph. No graph service → empty."""
        if self._life is None:
            return [], [], set()
        try:
            graph = await self._life.personal_graph(ctx)
        except Exception:  # noqa: BLE001
            return [], [], set()
        return build_relationships(graph or {})

    def _confirmed(self, panel: dict[str, Any], cands: list[str]) -> list[dict[str, Any]]:
        """Confirmed = the user said it (vision/objective/goals) — these are known, not candidates."""
        out: list[dict[str, Any]] = []
        if panel.get("life_vision"):
            out.append({"label": "life_vision", "value": panel["life_vision"], "source": "user_message"})
        if panel.get("primary_objective"):
            out.append({"label": "primary_objective", "value": panel["primary_objective"], "source": "user_message"})
        for g in cands:
            out.append({"label": "goal", "value": g, "source": "user_message"})
        return out

    async def build(self, ctx: UserContext, message: str, base: dict[str, Any]) -> AdvisorContext:
        """`base` is the deterministic RelationshipManager.converse() result for this turn."""
        panel = base.get("context_panel") or {}
        cands = [c.get("goal") for c in (base.get("candidate_goals") or []) if c.get("goal")]
        if not cands:
            cands = list(panel.get("priorities_i_heard") or [])
        rejected = await self._rejected(ctx)
        scores, priorities = await self._scores(ctx)
        edges, connections, connected_pairs = await self._relationships(ctx)
        risks = [str(r) for r in (panel.get("top_risks") or [])]
        opps = [str(o) for o in (panel.get("top_opportunities") or [])]
        cons = [str(c) for c in (panel.get("top_constraints") or [])]
        allowed_numbers = numbers_in(message, *cands, *risks, *opps, *cons, panel.get("life_vision"))
        stage = base.get("pending_key") or ("complete" if base.get("complete") else "discovery")
        return AdvisorContext(
            user_id=ctx.user_id,
            user_message=message,
            current_stage=str(stage),
            life_vision=panel.get("life_vision"),
            primary_objective=panel.get("primary_objective"),
            candidate_goals=cands,
            rejected_goals=rejected,
            risks=risks,
            opportunities=opps,
            constraints=cons,
            domains_touched=list(panel.get("domains_touched") or []),
            missing_areas=list(panel.get("missing_areas") or []),
            discovery_pct=int(panel.get("discovery_completion_pct") or 0),
            allowed_numbers=allowed_numbers,
            confirmed_facts=self._confirmed(panel, cands),
            assumptions=[],  # the deterministic engine does not assume; if it ever does, surface it here
            discovery_scores=scores,
            domain_priorities=priorities,
            relationship_edges=edges,
            connections=connections,
            connected_pairs=connected_pairs,
        )
