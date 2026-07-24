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

import asyncio
import logging
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from ..models.common import UserContext
from .advisor_agents import domains_for, route_domains
from .advisor_facts import build_fact_packet, numbers_in_facts

log = logging.getLogger("core.advisor_context")

LIFE = "life"

# Numbers the LLM is allowed to echo = numbers already present in the user's message / known context.
# Anything else in the LLM output is an invented figure and is rejected by the validator.
_NUM_RE = re.compile(r"\$?\d[\d,]*(?:\.\d+)?\s*[kKmMbB]?%?")

# Node types that are "primary" for relationship reasoning — the things a user calls "my goals".
# Domain hubs (ids ending in "_hub", e.g. education/career) are primary too so cross-domain links surface.
_PRIMARY_TYPES = {"Goal", "Life Objective"}

_SAFETY = [
    "Clinical medical advice is off-limits — no diagnosis, prescriptions, dosing, or interpreting labs/"
    "imaging. General fitness, exercise, sleep, and nutrition COACHING is allowed and encouraged. Specific "
    "legal or tax directives, and naming a specific investment product/security/insurer, are off-limits — "
    "refer the user to a licensed professional for those.",
    "Grounded strategic / personal-finance / life-planning recommendations ARE allowed, reasoned from the "
    "user's own facts. General benchmarks (e.g. a 3-6 month emergency fund) are fine; do not assert a "
    "specific dollar figure as the user's own unless they gave it or you show the derivation.",
    "Never invent goals, facts, or personal financial numbers. If unknown, ask or mark as missing.",
    "Keep confirmed facts, candidate facts, assumptions and missing data in separate categories.",
    "You may suggest candidate facts/goals, but nothing is saved until a deterministic validator confirms it.",
    "Reference a relationship between goals/objectives ONLY if it appears in relationship_edges or "
    "graph_connections. If those are empty, do not mention any connection.",
]


# Finance-turn detection (for the no-agent/orchestrator path) + a home-price parse for down-payment scenarios.
_FINANCE_WORDS = re.compile(
    r"\b(afford|mortgage|down\s?-?payment|home price|house (price|cost|budget)|net worth|cash flow|emergency "
    r"fund|savings|debt|invest\w*|retire\w*|529|roth|ira|401\s?\(?k\)?|budget|income|expenses?|pmi|hysa)\b",
    re.IGNORECASE)
_MONEY = re.compile(r"\$?\s?(\d[\d,]*(?:\.\d+)?)\s?([kmb])?\b", re.IGNORECASE)


def _mentions_finance(message: str) -> bool:
    return bool(_FINANCE_WORDS.search(message or ""))


def _parse_money(message: str) -> Optional[float]:
    """Extract a plausible home-PRICE amount from the message (e.g. '$500K house', '500,000 home') so the engine
    can compute down-payment tiers. Conservative: only when a housing word is present and the amount is large."""
    m = message or ""
    if not re.search(r"\b(house|home|property|down\s?-?payment|mortgage)\b", m, re.IGNORECASE):
        return None
    best: Optional[float] = None
    for match in _MONEY.finditer(m):
        raw, suf = match.group(1).replace(",", ""), (match.group(2) or "").lower()
        try:
            val = float(raw)
        except ValueError:
            continue
        val *= {"k": 1_000, "m": 1_000_000, "b": 1_000_000_000}.get(suf, 1)
        if val >= 50_000:  # a home price, not a percentage or small figure
            best = max(best or 0.0, val)
    return best


def numbers_in(*texts: Optional[str]) -> set[str]:
    """Numbers the user has stated, as strings the validator can match. Captures k/M/B suffixes and emits
    BOTH the bare digits and the magnitude-expanded form (so '$22k' allows the advisor to write '22' or
    '22000', and percentages allow the fraction) — this also fixes the k-notation false-positive fallbacks."""
    out: set[str] = set()
    for t in texts:
        if not t:
            continue
        for m in _NUM_RE.findall(str(t)):
            raw = m.strip().replace(" ", "")
            # bare literal (digits as written, suffix/symbols stripped) — preserves existing behavior
            out.add(raw.lstrip("$").rstrip("%").rstrip("kKmMbB").replace(",", ""))
            # magnitude/percent-expanded forms (k/M/B → full integer, % → fraction)
            for v in _expand_money_forms(raw):
                out.add(v)
    return {n for n in out if n}


def _expand_money_forms(token: str) -> set[str]:
    """Normalized string forms of a money/percent token: '$22k'→{'22000'}, '24%'→{'24','0.24'}."""
    t = token.lower().lstrip("$").replace(",", "")
    pct = t.endswith("%")
    t = t.rstrip("%")
    mult = 1.0
    if t[-1:] == "k":
        mult, t = 1_000.0, t[:-1]
    elif t[-1:] == "m":
        mult, t = 1_000_000.0, t[:-1]
    elif t[-1:] == "b":
        mult, t = 1_000_000_000.0, t[:-1]
    if not t:
        return set()
    try:
        base = float(t)
    except ValueError:
        return set()
    forms: set[str] = set()
    def _fmt(x: float) -> str:
        return str(int(x)) if abs(x - round(x)) < 1e-9 else (f"{x:.4f}".rstrip("0").rstrip("."))
    forms.add(_fmt(base * mult))
    if pct:
        forms.add(_fmt(base / 100.0))
    return forms


def _norm(s: Any) -> str:
    return re.sub(r"\s+", " ", str(s or "").strip().lower())


def _is_primary(node: dict[str, Any]) -> bool:
    return node.get("type") in _PRIMARY_TYPES or str(node.get("id") or "").endswith("_hub")


def derive_graph_relations(graph: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """The ONE relationship algorithm, at NODE-ID level. Both the advisor (label view, below) and the Life
    Graph workspace (id view) build on this, so they share an identical, real relationship model.

    Returns (by_id, id_edges, id_connections):
      - by_id          : {node_id: node}
      - id_edges       : persisted edges with known endpoints  [{source, target, rel, confidence}]
      - id_connections : real 2-hop primary-node links  [{source, target, basis, via}] where basis is
                         "direct_edge" (already a persisted edge) or "shared_node" (via a single shared node)
    Computed from persisted edges only — never inferred. No edges → empty.
    """
    nodes = graph.get("nodes") or []
    raw_edges = graph.get("edges") or []
    by_id = {n.get("id"): n for n in nodes if n.get("id")}

    id_edges: list[dict[str, Any]] = []
    adj: dict[str, set[str]] = {}
    for e in raw_edges:
        a, b = e.get("from"), e.get("to")
        if a not in by_id or b not in by_id:
            continue
        id_edges.append({"source": a, "target": b, "rel": e.get("rel"), "confidence": e.get("confidence")})
        adj.setdefault(a, set()).add(b)
        adj.setdefault(b, set()).add(a)

    primary = [n["id"] for n in nodes if n.get("id") and _is_primary(n)]
    id_connections: list[dict[str, Any]] = []
    seen: set[frozenset[str]] = set()
    for i in range(len(primary)):
        for j in range(i + 1, len(primary)):
            a, b = primary[i], primary[j]
            if a == b:
                continue
            na, nb = adj.get(a, set()), adj.get(b, set())
            if b in na:
                basis, via = "direct_edge", None
            else:
                shared = na & nb
                if not shared:
                    continue
                basis, via = "shared_node", sorted(shared)[0]
            key = frozenset({a, b})
            if key in seen:
                continue
            seen.add(key)
            id_connections.append({"source": a, "target": b, "basis": basis, "via": via})
    return by_id, id_edges, id_connections


def build_relationships(graph: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], set[frozenset[str]]]:
    """Advisor LABEL view over the shared relation core:
      - relationship_edges : label-resolved real edges  [{from, from_type, rel, to, to_type, confidence}]
      - connections        : real primary-node links within 2 undirected hops, each with its `via` basis
      - connected_pairs    : set of frozenset({norm(a), norm(b)}) used by the validator to gate claims
    """
    by_id, id_edges, id_connections = derive_graph_relations(graph)

    def label(nid: Optional[str]) -> str:
        return str((by_id.get(nid) or {}).get("label") or nid)

    def ntype(nid: Optional[str]) -> str:
        return str((by_id.get(nid) or {}).get("type") or "")

    relationship_edges: list[dict[str, Any]] = []
    connected_pairs: set[frozenset[str]] = set()
    for e in id_edges:
        la, lb = label(e["source"]), label(e["target"])
        relationship_edges.append({
            "from": la, "from_type": ntype(e["source"]),
            "rel": e.get("rel"), "to": lb, "to_type": ntype(e["target"]),
            "confidence": e.get("confidence"),
        })
        if _norm(la) != _norm(lb):
            connected_pairs.add(frozenset({_norm(la), _norm(lb)}))

    connections: list[dict[str, Any]] = []
    seen: set[frozenset[str]] = set()
    for c in id_connections:
        la, lb = label(c["source"]), label(c["target"])
        pair = frozenset({_norm(la), _norm(lb)})
        if _norm(la) == _norm(lb) or pair in seen:
            continue
        seen.add(pair)
        connected_pairs.add(pair)  # 2-hop primary links are citable too
        via_type = ntype(c["via"]) if c.get("via") else None
        connections.append({
            "a": la, "a_type": ntype(c["source"]), "b": lb, "b_type": ntype(c["target"]),
            "basis": c["basis"], "via": (label(c["via"]) if c.get("via") else None), "via_type": via_type,
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
    # P0.1 cross-turn context: the recent turns this session (most-recent last), so the advisor never
    # "starts over". [{ "user": "...", "advisor": "..." }]. Read from analytics.advisor_turns, not persisted.
    conversation_so_far: list[dict[str, str]] = field(default_factory=list)
    # Phase 8: deterministic career/education fact packet, each fact carrying provenance
    # (domain, sourceTable, recordId, confidence, updatedAt). The advisor may cite these; it
    # may NOT state career/education facts that are absent here.
    domain_facts: list[dict[str, Any]] = field(default_factory=list)
    # Command Center: the active agent persona (id/name/persona) and the grounding domains in scope for
    # this turn. Direct agents scope domain_facts to their domain(s); the Relationship Manager routes by
    # message. None/[] means the legacy broad advisor (back-compat).
    active_agent: Optional[dict[str, Any]] = None
    agent_domains: list[str] = field(default_factory=list)
    # The MESSAGE's topic domains (education/career/health/…), used to append the matching conversational
    # playbook to the advisor prompt. Empty when the route is broad/ambiguous (no single topic).
    turn_domains: list[str] = field(default_factory=list)
    # WS-E: user-scoped GraphRAG evidence (Qdrant vector hits + Neo4j nodes) for THIS query. Empty unless
    # GRAPH_GROUNDING_ENABLED and the retriever found something. Additive grounding — never a fabrication source.
    graph_evidence: list[dict[str, Any]] = field(default_factory=list)
    # Deterministic finance figures (net worth, cash flow, emergency-fund range, down-payment scenarios, debt
    # payoff, savings target, affordability band) computed by FinanceScenarioEngine — the numbers the LLM
    # INTERPRETS. None unless the turn is finance. Missing inputs are named gaps (needs_*), never fabricated.
    finance_scenarios: Optional[dict[str, Any]] = None

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
            # The user's own stated figures — SAFE to reference/reflect back (validator allows these).
            # Surfacing them explicitly so the advisor engages the numbers instead of deflecting.
            "numbers_you_may_reference": sorted(self.allowed_numbers),
            # WS-E: user-scoped GraphRAG evidence (vector hits + graph nodes) the advisor MAY reference as
            # grounding. Empty unless GRAPH_GROUNDING_ENABLED. Never a licence to fabricate — it's retrieved.
            "graph_evidence": self.graph_evidence,
            # DETERMINISTIC finance figures the advisor INTERPRETS (never recomputes/invents). Every value is
            # arithmetic from finance.* ; `needs_*: true` marks a gap to ASK about, not to guess. Present only
            # on finance turns.
            "finance_scenarios": self.finance_scenarios,
            # Phase 8: grounded career/education facts the advisor MAY cite (and ONLY these for those
            # domains). Each carries domain/sourceTable/recordId/confidence for auditable citation.
            "domain_facts": self.domain_facts,
            # Command Center: who is answering + which domains are in scope. The model adopts this persona
            # and stays within agent_domains; it must not answer outside its grounding.
            "active_agent": self.active_agent,
            "agent_domains": self.agent_domains,
            "relationship_edges": self.relationship_edges,
            "graph_connections": self.connections,
            "relationships_available": self.relationships_available,
            # P0.1: the recent conversation so the advisor uses prior turns and never starts over.
            "conversation_so_far": self.conversation_so_far,
            "user_message": self.user_message,
            "safety_constraints": self.safety_constraints,
        }


class AdvisorContextBuilder:
    def __init__(self, supabase: Any, coverage: Any = None, life: Any = None, scenarios: Any = None,
                 retriever: Any = None) -> None:
        self._sb = supabase
        self._coverage = coverage  # DiscoveryCoverageService (optional) — per-domain discovery scores
        self._life = life  # LifeDiscoveryService (optional) — real personal graph edges
        self._scenarios = scenarios  # FinanceScenarioEngine (optional) — deterministic finance figures
        # WS-E: live GraphRAG retriever (Neo4j + Qdrant). None unless GRAPH_GROUNDING_ENABLED — until then the
        # advisor grounds on Supabase only. When present, build() adds user-scoped graph/vector evidence.
        self._retriever = retriever

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

    async def _facts(self, ctx: UserContext) -> list[dict[str, Any]]:
        """Phase 8: deterministic career/education fact packet (provenance-carrying). Empty on error."""
        try:
            return await build_fact_packet(self._sb, ctx)
        except Exception:  # noqa: BLE001 — grounding must never break a turn
            return []

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

    async def build(self, ctx: UserContext, message: str, base: dict[str, Any],
                    history: Optional[list[dict[str, str]]] = None,
                    agent: Optional[Any] = None) -> AdvisorContext:
        """`base` is the deterministic RelationshipManager.converse() result for this turn. `history` is the
        recent conversation (most-recent last, [{user, advisor}]) — P0.1 cross-turn context.

        `agent` (Command Center) is an advisor_agents.Agent. A DIRECT agent scopes domain_facts to its
        domain(s) so it answers only from its own grounding; the Relationship Manager keeps all facts but
        routes which domains it drew from. None → legacy broad advisor (all facts, no persona)."""
        panel = base.get("context_panel") or {}
        cands = [c.get("goal") for c in (base.get("candidate_goals") or []) if c.get("goal")]
        if not cands:
            cands = list(panel.get("priorities_i_heard") or [])
        # These three reads are independent (rejected goals, discovery scores, personal graph) — run them
        # concurrently to cut the context_build stage (~16% of turn latency) roughly to its slowest read.
        rejected, (scores, priorities), (edges, connections, connected_pairs), domain_facts = await asyncio.gather(
            self._rejected(ctx), self._scores(ctx), self._relationships(ctx), self._facts(ctx)
        )
        risks = [str(r) for r in (panel.get("top_risks") or [])]
        opps = [str(o) for o in (panel.get("top_opportunities") or [])]
        cons = [str(c) for c in (panel.get("top_constraints") or [])]
        # P0.1: numbers the user stated in PRIOR turns are still their own — allow the advisor to reflect
        # them (the validator checks against this exact set), so it never "loses" $60k said two turns ago.
        hist = list(history or [])[-6:]
        prior_user_msgs = [str(h.get("user") or "") for h in hist]
        allowed_numbers = numbers_in(message, *prior_user_msgs, *cands, *risks, *opps, *cons, panel.get("life_vision"))
        # Command Center: scope grounding to the active agent's domains. A direct agent (e.g. Career)
        # sees ONLY its domains' facts, so it can't wander into another domain it isn't grounding for.
        # The Relationship Manager (is_orchestrator) keeps every fact and synthesizes across them.
        active_agent: Optional[dict[str, Any]] = None
        agent_domains: list[str] = []
        if agent is not None:
            agent_domains = domains_for(agent, message)
            active_agent = {"id": agent.id, "name": agent.name, "persona": agent.persona,
                            "domains": agent_domains, "isOrchestrator": agent.is_orchestrator}
            if not agent.is_orchestrator and agent_domains:
                domain_facts = [f for f in domain_facts if f.get("domain") in agent_domains]
        # Phase 8: figures that appear in grounded, cited facts are safe to echo — add them so the
        # validator's number-gate doesn't reject e.g. "~8 years" or a credential count.
        allowed_numbers |= numbers_in_facts(domain_facts)
        # DETERMINISTIC finance grounding: on a finance turn, compute the scenario packet (net worth, down-payment
        # tiers, emergency-fund range, …) and add its figures to allowed_numbers so the LLM can cite REAL numbers
        # and the validator passes — the LLM interprets these, never invents. A parsed home-price goal from the
        # message unlocks the down-payment scenarios. Best-effort: never breaks the turn.
        finance_scenarios: Optional[dict[str, Any]] = None
        finance_in_scope = ("finance" in (agent_domains or [])) or any(
            f.get("domain") == "finance" for f in (domain_facts or [])
        ) or (agent is None and _mentions_finance(message))
        if self._scenarios is not None and finance_in_scope:
            try:
                finance_scenarios = await self._scenarios.compute(
                    ctx, home_price_goal=_parse_money(message))
                allowed_numbers |= {str(n) for n in (finance_scenarios.get("allowed_numbers") or [])}
            except Exception:  # noqa: BLE001 — grounding is an enhancement; never break the turn
                finance_scenarios = None
        stage = base.get("pending_key") or ("complete" if base.get("complete") else "discovery")
        # turn_domains: the MESSAGE's topic for per-domain prompt guidance. route_domains returns a focused
        # subset, or all domains when ambiguous — treat the broad fallback (≥4) as "no specific topic".
        _routed = route_domains(message)
        turn_domains = [] if len(_routed) >= 4 else _routed

        # WS-E: live GraphRAG retrieval (Option A). Best-effort and user-scoped; never raises into the turn.
        # Off (retriever is None) until GRAPH_GROUNDING_ENABLED, so today this is a no-op.
        graph_evidence: list[dict[str, Any]] = []
        if self._retriever is not None:
            try:
                graph_evidence = await self._retriever.retrieve_personal(
                    message, ctx, domain=(turn_domains[0] if turn_domains else None), limit=8
                ) or []
            except Exception as exc:  # noqa: BLE001 — grounding degrades to empty, never breaks the turn
                log.warning("graph grounding degraded: %s", exc)
                graph_evidence = []

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
            conversation_so_far=[{"user": str(h.get("user") or ""), "advisor": str(h.get("advisor") or "")} for h in hist],
            domain_facts=domain_facts,
            active_agent=active_agent,
            agent_domains=agent_domains,
            turn_domains=turn_domains,
            graph_evidence=graph_evidence,
            finance_scenarios=finance_scenarios,
        )
