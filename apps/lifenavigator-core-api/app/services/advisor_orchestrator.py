"""Advisor Orchestrator (Hybrid Advisor sprint).

Ties the hybrid flow together WITHOUT letting the rules script the conversation:

  user message
    → RelationshipManager.converse()   [deterministic: persistence of candidate/rejected goals, canonical
                                         writes, safety, and a guaranteed safe rule-based fallback text]
    → AdvisorContextBuilder            [real DB/API GUARDRAILS for the LLM: classified facts, discovery
                                         scores, domain priorities, safety, allowed numbers]
    → build_constraints()              [the rule ENVELOPE: persistence=off, one question max, disallowed
                                         topics, required disclaimers, coarse intent for temperature — it
                                         does NOT decide the question]
    → AdvisorLLM.generate()            [the LLM IS the advisor: it reasons within the guardrails and decides
                                         the reflection, the ONE question, why it matters, and the summary]
    → validate()                       [deterministic trust gate: no invented data, no advice, no persistence]
    → merge: the validated reflection + question REPLACES only the assistant text; everything the
      deterministic engine decided (pending_key, candidate_goals, updates, persistence) is preserved.

Rules guide; the LLM leads. If the LLM is unavailable, returns None, fails validation, or errors → the
rule-based response is returned unchanged. The user never sees an error or degraded UX; the LLM can only
make the advisor feel more human and perceptive, never fabricate or write.
"""
from __future__ import annotations

from typing import Any, Optional

from ..models.common import UserContext
from .advisor_context import AdvisorContextBuilder
from .advisor_llm import AdvisorLLM, ADVISOR_PROMPT_VERSION
from .advisor_validator import validate


def build_constraints(base: dict[str, Any], context: Any) -> dict[str, Any]:
    """The rule ENVELOPE the LLM must reason inside — constraints and permissions, NOT a scripted move.

    Deliberately does not choose ask/confirm/clarify: the LLM detects corrections, decides when to confirm
    a goal, and decides when to summarise from the guardrail context itself. The only deterministic signal
    is `intent`, a coarse hint (used for temperature + to permit a closing summary) derived purely from the
    deterministic completion flag.
    """
    intent = "summary" if base.get("complete") else "discovery"
    return {
        "intent": intent,
        "may_summarise": bool(base.get("complete")),
        "focus_candidates": context.domain_priorities or list(context.missing_areas or []),
        "objective": context.primary_objective,
        "allowed_topics": ["discovery", "clarification", "summary", context.current_stage],
        "disallowed_topics": [
            "final financial advice", "medical advice", "legal advice", "tax advice",
            "specific product recommendations",
        ],
        "required_disclaimers": [],
        "max_questions": 1,
        "persistence_allowed": False,  # the LLM never persists; the deterministic engine already did
        "must_classify_facts": True,
        "reason": f"stage={context.current_stage}; complete={bool(base.get('complete'))}; "
                  f"priorities={context.domain_priorities[:3]}",
    }


def _compose(safe: dict[str, Any]) -> str:
    """Assemble the human-facing message the LLM chose: reflection → (its summary) → question → why.

    The LLM controls whether to summarise (we include the summary only if it returned one), so the rules
    never force a 'summary turn'.
    """
    parts: list[str] = []
    refl = str(safe.get("reflection") or "").strip()
    if refl:
        parts.append(refl)
    s = str(safe.get("summary") or "").strip()
    if s:
        parts.append(s)
    q = str(safe.get("next_question") or "").strip()
    if q:
        parts.append(q)
    why = str(safe.get("why_this_question") or "").strip()
    if q and why:
        parts.append(why)
    return " ".join(parts).strip()


class AdvisorOrchestrator:
    def __init__(self, relationship_manager: Any, context_builder: AdvisorContextBuilder, llm: AdvisorLLM, *, enabled: bool = True) -> None:
        self._rm = relationship_manager
        self._ctx = context_builder
        self._llm = llm
        self._enabled = enabled
        self.prompt_version = ADVISOR_PROMPT_VERSION

    async def converse(self, ctx: UserContext, message: str, pending_key: Optional[str] = None) -> dict[str, Any]:
        # 1) Deterministic turn — persistence (candidate/rejected goals), canonical writes, safe fallback text.
        base = await self._rm.converse(ctx, message, pending_key)
        if not self._enabled:
            return base
        try:
            context = await self._ctx.build(ctx, message, base)
            constraints = build_constraints(base, context)
            out = await self._llm.generate(context, constraints)
            if out is None:
                base["llm_status"] = "fallback:unavailable"
                return base
            ok, safe, reasons = validate(out, context)
            if not ok:
                base["llm_status"] = "fallback:" + ("; ".join(reasons))[:140]
                return base
            composed = _compose(safe)
            if not composed:
                base["llm_status"] = "fallback:empty"
                return base
            # Merge: only the human-facing text changes; all deterministic outcomes are preserved.
            base["assistant_message"] = composed
            base["llm_status"] = "enhanced"
            base["prompt_version"] = self.prompt_version
            if safe.get("missing_data"):
                base["missing_data"] = safe["missing_data"]  # advisory display only — not persisted
            return base
        except Exception:  # noqa: BLE001 — never break the user experience
            base["llm_status"] = "fallback:error"
            return base
