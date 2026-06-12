"""Advisor Context Builder (Hybrid Advisor sprint).

Assembles a DETERMINISTIC AdvisorContext from real DB/API sources only — the GUARDRAILS the LLM advisor
reasons inside. The rules here never script the conversation; they supply constraints, classified facts,
discovery scores, domain priorities, safety boundaries and the set of numbers the LLM may echo. The LLM
decides what to ask. Anything not in this context is unknown — never faked.

Fact classification is first-class and the categories are NEVER merged:
  - confirmed_facts : the user stated it (or it is persisted) — known truth
  - candidate_facts : plausibly true, not yet confirmed (needs confirmation before it counts)
  - assumptions     : a default the engine applied because data is missing (must be surfaced, not hidden)
  - missing_data    : known-unknowns the advisor should work to fill, highest-value first
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

_SAFETY = [
    "Do not give medical, legal, or tax advice.",
    "Do not state final financial recommendations — those come from the recommendation engine.",
    "Never invent goals, facts, or numbers. If unknown, ask or mark as missing.",
    "Keep confirmed facts, candidate facts, assumptions and missing data in separate categories.",
    "You may suggest candidate facts/goals, but nothing is saved until a deterministic validator confirms it.",
]


def numbers_in(*texts: Optional[str]) -> set[str]:
    out: set[str] = set()
    for t in texts:
        if not t:
            continue
        for m in _NUM_RE.findall(str(t)):
            out.add(m.strip().lstrip("$").rstrip("%").replace(",", ""))
    return {n for n in out if n}


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
    safety_constraints: list[str] = field(default_factory=lambda: list(_SAFETY))

    def prompt_dict(self) -> dict[str, Any]:
        """The exact, bounded guardrail context handed to the LLM (no raw DB rows, no secrets).

        These are CONSTRAINTS and SIGNALS, not a script. The LLM uses discovery_scores +
        highest_value_missing to decide the single most useful question to ask next.
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
            "user_message": self.user_message,
            "safety_constraints": self.safety_constraints,
        }


class AdvisorContextBuilder:
    def __init__(self, supabase: Any, coverage: Any = None) -> None:
        self._sb = supabase
        self._coverage = coverage  # DiscoveryCoverageService (optional) — per-domain discovery scores

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
        # Priority = domains that still need work, lowest coverage first (highest leverage for the next question).
        priorities = [
            str(d.get("domain"))
            for d in sorted(domains, key=lambda x: (x.get("coverage_pct") or 0))
            if (d.get("coverage_pct") or 0) < 80
        ]
        return scores, priorities

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
        )
