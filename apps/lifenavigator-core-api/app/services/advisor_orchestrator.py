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

import json
import logging
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..models.common import UserContext
from .advisor_agents import ALL_LIFE_DOMAINS, focus_domains as _focus_domains, get_agent, route_domains
from .advisor_context import AdvisorContextBuilder
from .advisor_llm import AdvisorLLM, ADVISOR_PROMPT_VERSION
from .advisor_validator import classify_issues, validate
from . import fact_domain_sync
from . import model_registry as reg
from .model_router import detect_health_urgent, health_safety_response


def _citations_from_context(context: Any) -> list[dict[str, Any]]:
    """Map the in-scope grounded facts → citation records (Phase 9: source domain, table, record id,
    confidence, timestamp). These are SECTION-LEVEL: the grounding the agent was constrained to for this
    turn, not a per-sentence map — labeled honestly as such in the UI. Bounded by the fact packet size."""
    cites: list[dict[str, Any]] = []
    for f in getattr(context, "domain_facts", []) or []:
        cites.append({
            "kind": "fact",
            "domain": f.get("domain"),
            "label": f.get("label"),
            "value": f.get("value"),
            "sourceTable": f.get("sourceTable"),
            "recordId": f.get("recordId"),
            "confidence": f.get("confidence"),
            "updatedAt": f.get("updatedAt"),
        })
    return cites

log = logging.getLogger("core.advisor")

# Strong references to in-flight best-effort turn-log writes. asyncio only keeps a weak reference to a
# fire-and-forget task, so without this the task can be garbage-collected mid-await and the insert is
# silently dropped (observed: most rows lost under load). Module scope so it survives the per-request
# orchestrator instance. Each task removes itself on completion.
_PENDING_WRITES: set = set()


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
        "relationships_available": context.relationships_available,
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


# RELIABILITY: soft wall-clock budget for a single advisor turn's repair loop. Once total turn time
# exceeds this, we stop repairing and return the safe deterministic fallback (a clean degrade instead of
# a multi-minute hang). Tunable via env; default 45s keeps turns under the client/Vercel timeout.
_ADVISOR_TURN_BUDGET_S = float(os.environ.get("ADVISOR_TURN_BUDGET_S", "45"))


def _is_repairable(reasons: list[str]) -> bool:
    """Supervised-repair model (2026-06-25): ALL content failures are worth a repair attempt — ungrounded
    numbers, unsupported relationships, AND advice/clinical/legal/tax/verdict overreach (the model is asked
    to reframe as a checklist/hedge). Only a structurally malformed (non-JSON) output is not repairable.
    The validator re-checks every repaired draft, so the trust floor is unchanged — repair never lets unsafe
    content through; it just gives the model a chance to fix itself before a deterministic fallback."""
    txt = " ".join(reasons).lower()
    if "not a json object" in txt:
        return False
    return bool(txt.strip())


def _build_repair_note(issues: list[dict], reasons: list[str]) -> str:
    """Render structured issues into a precise, per-item repair instruction for the model."""
    if not issues:
        return ("Your previous draft failed compliance review for: " + "; ".join(reasons) +
                ". Keep all grounded content and fix those items, then return the full JSON again.")
    lines = [f"{i + 1}. [{x['type']}] " + (f'"{x["text"]}": ' if x.get("text") else "") + x["repair_instruction"]
             for i, x in enumerate(issues)]
    return (
        "Your draft was strong but a compliance reviewer flagged the items below. Keep ALL the good content "
        "and the six-section structure; fix ONLY these specific items and return the full JSON again:\n"
        + "\n".join(lines)
        + "\nDo not introduce any new ungrounded personal number. Benchmarks and clearly-labeled scenarios "
        "are encouraged."
    )


# ── RELEASE_HARDENING: observable, classified fallback causes ───────────────────────────────────────────
# Distinguishable fallback causes (item 2). Maps the raw llm_status / LLM last_error / validator reasons to
# ONE actionable category so dashboards can tell an auth/socket outage from a trust-spine block from variance.
_AUTH_ERRORS = ("VertexAuthError", "PermissionError", "not_available")
_TIMEOUT_ERRORS = ("ReadTimeout", "TimeoutException", "ConnectTimeout", "ConnectError", "PoolTimeout")


def classify_fallback_cause(llm_status: str, last_error: str, reasons: list[str]) -> str:
    s = llm_status or ""
    if not s.startswith("fallback") and s not in ("safety_fallback",):
        return ""  # not a fallback
    if s == "safety_fallback":
        return "safety_gate"
    txt = " ".join(reasons or []).lower()
    if s == "fallback:unavailable" or s == "fallback:error":
        if any(e in (last_error or "") for e in _AUTH_ERRORS):
            return "infrastructure_auth"  # the socket/WIF/ADC failure class — the one that hid for a sprint
        if any(e in (last_error or "") for e in _TIMEOUT_ERRORS):
            return "provider_timeout"
        if last_error == "malformed_output":
            return "malformed_output"
        return "provider_error"
    if s == "fallback:empty":
        return "malformed_output"
    # validator-rejected content fallbacks
    if "invented numbers" in txt or "fabricated" in txt:
        return "trust_spine_block"
    if "advice" in txt or "medical" in txt or "legal" in txt:
        return "policy_safety_gate"
    if "relationship" in txt:
        return "unsupported_relationship"
    if "json object" in txt or "malformed" in txt:
        return "malformed_output"
    return "repair_loop_exhausted"


# The exact persisted columns of analytics.advisor_turns (migration 160_advisor_turns.sql). The insert is
# whitelisted to these so transient telemetry keys (mode/routing/retries/observability) never 400 the row.
_ADVISOR_TURNS_COLUMNS = (
    "turn_id", "conversation_id", "user_id", "timestamp", "prompt_version", "llm_status", "validator_result",
    "validator_reason", "validator_repairs", "fallback_used", "fallback_reason", "latency_ms", "stages_ms",
    "prompt_tokens", "completion_tokens", "total_tokens", "graph_edges_available", "relationships_referenced",
    "confidence", "user_message", "advisor_response", "llm_response_raw",
)


# Latency-aware routing tiers (item 4). DETERMINISTIC + conservative: high-risk turns (finance/health/legal,
# numeric-sensitive, cross-domain) ALWAYS get the full supervised path; only clearly-trivial conversational
# turns are eligible for the lighter fast path. Safety/validation is identical across tiers — the tier only
# tunes the repair budget (latency), never what the validator blocks.
_HIGH_RISK_CUE = re.compile(
    r"\$|%|\b(afford|mortgage|loan|debt|invest\w*|retire\w*|salary|income|tax|insurance|net worth|estate|"
    r"will|trust|guardian|medic\w*|dose|dosage|symptom|diagnos\w*|trt|testosterone|legal|attorney|lawsuit)\b",
    re.IGNORECASE,
)
_TRIVIAL = re.compile(r"^\s*(hi|hey|hello|thanks|thank you|ok(ay)?|cool|got it|yes|no|sure|what can you do)\b",
                      re.IGNORECASE)

# ── Finance intent subtypes (first-5 latency) ──────────────────────────────────────────────────────────
# LOW-RISK finance EDUCATION (define/explain a concept — "what is a 529?", "what is PMI?") may take the fast
# path; PERSONALIZED finance planning/calculation/high-risk stays supervised on the reasoning model. The
# distinction is deterministic and conservative: an educational opener + a finance concept + NO personalization,
# NO dollar amount, NO decision verb. Anything ambiguous falls through to supervised.
_EDU_OPENER = re.compile(
    r"^\s*(what\s+(is|are|does|do)\b|what'?s\b|explain\b|define\b|describe\b|"
    r"(the\s+)?difference between\b|tell me about\b|meaning of\b)", re.IGNORECASE)
_FINANCE_CONCEPT = re.compile(
    r"\b(529|pmi|roth|ira|401\s?\(?k\)?|hysa|mortgage|down\s?-?payment|emergency fund|net worth|cash flow|"
    r"debt|avalanche|snowball|apr|apy|compound|interest rate|budget|savings|checking|preapproval|"
    r"refinanc\w*|credit score|escrow|amortiz\w*|dividend|etf|index fund|bond|equity|expense ratio|"
    r"capital gains|deductible|premium|term life|whole life)\b", re.IGNORECASE)
# Personalization / decision signals — force the deep supervised path even with an educational opener.
_FINANCE_PERSONAL = re.compile(
    r"\b(my|mine|our|should i|can i|how much (should|do|can) i|afford|for me|do with my|allocat\w*|"
    r"prioriti[sz]e|pay off|target be|best (tax|strateg\w*|option|way))\b", re.IGNORECASE)
_MONEY_AMOUNT = re.compile(r"\$\s?\d|\b\d{2,3}\s?k\b|\b\d{4,}\b", re.IGNORECASE)

# Cross-domain LIFE DECISION detection: a decision-seeking cue + TWO OR MORE distinct life-domain cues → route
# to the supervised (Opus) path even when domain keyword-routing missed a finance tag. Catches "should I buy
# before the wedding or after promotion?" (wedding + promotion) that has no explicit finance word. A generic
# "should I rename this button?" has zero life-domain cues, so it is NOT caught (no over-routing).
_DECISION_CUE = re.compile(
    r"\b(should\s+(i|we)|do\s+(i|we)|can\s+i\s+afford|is\s+it\s+better\s+to|compare|choose between|"
    r"before or after|now or later|now versus|now vs|prioriti[sz]e|sequence|trade[\s-]?off)\b", re.IGNORECASE)
_LIFE_DOMAIN_CUE = re.compile(
    r"\b(wedding|marriage|married|spouse|partner|family|baby|child(?:ren)?|kids|home|house|mortgage|"
    r"down\s?-?payment|promotion|job|career|income|salary|bonus|raise|debt|loan|savings|emergency\s?(?:fund|"
    r"reserve)|retire\w*|insurance|school|college|degree|tuition|buy(?:ing)?|purchase)\b", re.IGNORECASE)


def _count_life_domains(message: str) -> int:
    """Distinct life-domain cues present (for the cross-domain-decision router)."""
    return len({mt.group(0).lower() for mt in _LIFE_DOMAIN_CUE.finditer(message or "")})


def _is_cross_domain_life_decision(message: str) -> bool:
    m = message or ""
    return bool(_DECISION_CUE.search(m)) and _count_life_domains(m) >= 2


def _is_finance_education(message: str, domains: set[str]) -> bool:
    """True only for a LOW-RISK finance education/definition question — safe for the fast model. False (→ deep
    supervised) for anything personalized, calculational, decision-seeking, health, or ambiguous."""
    m = message or ""
    if "health" in domains:
        return False  # health is always supervised (clinical safety)
    if not _EDU_OPENER.search(m):
        return False  # must be a definitional/explanatory question
    if not (_FINANCE_CONCEPT.search(m) or "finance" in domains):
        return False  # must actually be a finance topic
    if _FINANCE_PERSONAL.search(m) or _MONEY_AMOUNT.search(m):
        return False  # personalization / a dollar amount → planning/calculation → supervised
    return True


def select_route_path(message: str, domains: list[str] | None) -> str:
    msg = message or ""
    doms = set(domains or [])
    if "health" in doms:
        return "supervised"  # clinical safety — never fast
    # Low-risk finance EDUCATION → fast model (still validated). Checked BEFORE the finance/high-risk gate so a
    # definition question isn't forced slow by the finance nouns it contains. Personalized finance stays deep.
    if _is_finance_education(msg, doms):
        return "standard"
    # Cross-domain LIFE DECISION (decision cue + ≥2 life-domain cues) → supervised/Opus, even without an
    # explicit finance keyword. Generic "should I rename this button?" (no life-domain cues) is not caught.
    if _is_cross_domain_life_decision(msg):
        return "supervised"
    if doms & {"finance", "health"} or _HIGH_RISK_CUE.search(msg):
        return "supervised"
    if len(doms) >= 2:
        return "supervised"  # cross-domain synthesis → full supervision
    if _TRIVIAL.match(msg) and len(msg) <= 40 and not any(c.isdigit() for c in msg):
        return "fast"
    return "standard"


# Discovery/onboarding response contract — the phrases that mark advisor/consultant output. Discovery
# turns must contain NONE of these (the RelationshipManager never produces them; this is a tripwire that
# proves the contract holds and alerts if a future change regresses discovery into advisor mode).
_DISCOVERY_FORBIDDEN = (
    "**The tradeoffs:**", "**What we know:**", "**My read:**", "**What would change this:**",
    "not personalized", "licensed professional",  # the advisor scope disclaimer
    "your primary objective is",  # stating an inferred/candidate objective as a confirmed fact
)


def discovery_contract_violations(text: str) -> list[str]:
    """Return any advisor-mode artifacts present in a discovery turn (case-insensitive). Empty list = the
    turn honors the conversational discovery contract (one reflection + one question, no sections, no
    disclaimer, no objective-as-fact). Used by the discovery-mode tripwire + tests."""
    low = (text or "").lower()
    return [p for p in _DISCOVERY_FORBIDDEN if p.lower() in low]


def _reasoning_payload(safe: dict[str, Any]) -> dict[str, Any]:
    """The structured reasoning the model produced — tradeoffs / what-we-know / what-we-still-need — kept
    as DATA for the UI to render behind an expandable "Why / evidence" drawer, instead of being dumped into
    the chat message as '**section:**' markdown headers. Validator-checked already; this only reshapes it."""
    out: dict[str, Any] = {}
    tradeoffs = [t for t in (safe.get("tradeoffs") or []) if isinstance(t, dict)
                 and (t.get("option") or t.get("benefit") or t.get("cost"))]
    if tradeoffs:
        out["tradeoffs"] = [{"option": str(t.get("option") or "").strip(),
                             "benefit": str(t.get("benefit") or "").strip(),
                             "cost": str(t.get("cost") or "").strip()} for t in tradeoffs]
    know = [str(x).strip() for x in (safe.get("what_we_know") or []) if str(x).strip()]
    if know:
        out["what_we_know"] = know
    need = [str(x).strip() for x in (safe.get("what_we_still_need") or []) if str(x).strip()]
    if need:
        out["what_we_still_need"] = need
    return out


def _compose(safe: dict[str, Any]) -> str:
    """Assemble the human-facing message as a NATURAL advisor reply, NOT a six-section consulting memo.
    The model still reasons through Decision Frame → Tradeoffs → What We Know → Recommendation → What Would
    Change This → Question (and the validator trust-checks all of it), but the CHAT only shows the frame +
    the read + one question, as flowing prose. Tradeoffs / what-we-know / what-we-still-need travel as
    structured data (_reasoning_payload) for an expandable UI drawer — never dumped as '**section:**'
    headers. The inline scope disclaimer is dropped (the chat already shows a persistent compliance footer).
    Falls back to the legacy reflection/summary shape for pre-V3 turns.
    """
    parts: list[str] = []

    # 1) The read, as natural paragraphs: the decision frame, then the recommendation — no section labels.
    frame = str(safe.get("decision_frame") or safe.get("reflection") or "").strip()
    if frame:
        parts.append(frame)
    rec = str(safe.get("recommendation") or "").strip()
    if rec:
        parts.append(rec)  # a normal paragraph — no "My read:" header
    if not frame and not rec:
        s = str(safe.get("summary") or "").strip()
        if s:
            parts.append(s)

    # 2) Exactly one natural follow-up question (no bold wrapper, no italic rationale dump).
    q = str(safe.get("next_question") or "").strip()
    if q:
        parts.append(q)

    return "\n\n".join(parts).strip()


class AdvisorOrchestrator:
    def __init__(self, relationship_manager: Any, context_builder: AdvisorContextBuilder, llm: AdvisorLLM,
                 *, enabled: bool = True, supabase: Any = None, router: Any = None,
                 hybrid_claude: Any = None, claude_domains: Any = None, claude_high_stakes_only: bool = True,
                 fast_llm: Any = None) -> None:
        self._rm = relationship_manager
        self._ctx = context_builder
        self._llm = llm
        # Optional FAST model (e.g. Gemini Flash) used for non-supervised turns to cut latency; deep/high-stakes
        # (supervised) turns stay on the reasoning model. None → unchanged behavior. Validator gates both.
        self._fast_llm = fast_llm
        self._enabled = enabled
        self._sb = supabase  # best-effort advisor-turn persistence (ops.advisor_turns)
        self._router = router  # optional ModelRouter; only used when MODEL_ROUTER_ENABLED (default off)
        # Opus hybrid (flag-gated): a Claude LLM used as PRIMARY only for finance/health turns, with the
        # DI Gemini as same-tier fallback. None → unchanged behavior. Default off.
        self._hybrid_claude = hybrid_claude
        self._claude_domains = set(claude_domains or ())
        self._claude_high_stakes_only = claude_high_stakes_only
        self.prompt_version = ADVISOR_PROMPT_VERSION

    # A bare money figure ("$500K - $750K", "500k") signals finance even when keyword routing misses it.
    _MONEY_SIGNAL = re.compile(
        r"\$\s?\d|\b\d{2,3}\s?k\b|\bdown[\s-]?payment|home (?:price|range|budget)|house (?:price|cost)", re.I)

    # RICH, domain-aware vocab for the handoff decision — deliberately broader than route_domains (which has
    # false positives like legal "will" matching the auxiliary verb, and misses plurals/training terms). Used
    # ONLY here: a STRONG in-domain signal keeps the turn in the current advisor; a STRONG other-domain signal
    # (with no in-domain signal) offers a handoff. Ambiguous → answer in the current domain.
    _HANDOFF_VOCAB: dict[str, "re.Pattern[str]"] = {
        "health": re.compile(
            r"\b(workout|exercis\w*|gym|train\w*|lift\w*|cardio|stamina|endurance|conditioning|muscl\w*|"
            r"tendon\w*|ligament\w*|joint\w*|knee\w*|shoulder\w*|mobility|prehab|rehab|recover\w*|sore\w*|"
            r"injur\w*|sleep|supplement\w*|vitamin\w*|nutrition|protein|macro\w*|calorie\w*|diet|body ?fat|"
            r"lean mass|recomp\w*|strength|stronger|squat\w*|bench|deadlift\w*|pull[- ]?up\w*|reps?|sets?|"
            r"rpe|reps in reserve|max effort|to failure|boxing|wrestl\w*|muay thai|jiu[- ]?jitsu|martial|"
            r"fitness|fat loss|weight loss|testosterone|hormone\w*|stretch\w*|warm[- ]?up|acclimat\w*)\b", re.I),
        "finance": re.compile(
            r"\b(money|afford\w*|debt|loan\w*|savings?|budget\w*|invest\w*|income|salary|cash flow|"
            r"expenses?|mortgage|retire\w*|401k|ira|roth|pension|tax(es)?|down ?payment|credit|portfolio|"
            r"stocks?|wealth|net worth|emergency fund|premium\w*)\b", re.I),
        "career": re.compile(
            r"\b(job|career|promotion\w*|promote\w*|raise|employer|employee|resume|interview\w*|manager|"
            r"compensation|offer letter|workplace|coworker\w*|negotiat\w*|new role|layoff|performance review|"
            r"principal|architect\w*|engineer\w*)\b", re.I),
        "education": re.compile(
            r"\b(school|degree\w*|college|universit\w*|certificat\w*|course\w*|studies|mba|masters?|"
            r"bachelor\w*|phd|doctorate|tuition|student|curriculum|enroll\w*|bootcamp)\b", re.I),
        "family": re.compile(
            r"\b(wedding|marriage|married|marry|spouse|wife|husband|fianc\w*|kids?|child\w*|baby|babies|"
            r"pregnan\w*|guardian\w*|custody|dependents?|estate plan\w*|beneficiar\w*|inheritance|"
            r"household|elderly|life insurance|start a family)\b", re.I),
    }

    def _domain_signal(self, message: str, domains: "set[str]") -> bool:
        m = message or ""
        return any(self._HANDOFF_VOCAB[d].search(m) for d in domains if d in self._HANDOFF_VOCAB)

    def _detect_handoff(self, agent_obj: Any, message: str) -> Optional[dict[str, Any]]:
        """Decide whether a direct domain advisor should ROUTE this turn to another specialist.

        Domain-aware + conservative: (1) any STRONG signal for the advisor's OWN domain → answer here (a
        Health turn about tendons/ligaments/max-effort stays in Health). (2) Otherwise route when a STRONG
        signal for another domain (or a bare money figure → finance) is present. (3) No clear signal → answer
        here. Returns {target, target_agent_obj, target_name, from_name, reason, ambiguous, options} or None."""
        if agent_obj is None or getattr(agent_obj, "is_orchestrator", False):
            return None
        adoms = {d for d in (getattr(agent_obj, "domains", ()) or ())}
        if self._domain_signal(message, adoms):  # (1) clear in-domain context → never hand off
            return None
        others = {d for d in self._HANDOFF_VOCAB if d not in adoms and self._domain_signal(message, {d})}
        if "finance" not in adoms and self._MONEY_SIGNAL.search(message or ""):
            others.add("finance")
        if not others:
            return None
        ordered = [d for d in ("finance", "health", "career", "family", "education") if d in others]
        target = ordered[0]
        ta = get_agent(f"{target}_advisor")
        return {"target": target, "target_agent_obj": ta,
                "target_name": ta.name if ta else f"{target.title()} Advisor",
                "from_name": getattr(agent_obj, "name", "your advisor"),
                "reason": f"This looks like a {target} question, so I'm bringing in the {ta.name if ta else target}.",
                "ambiguous": len(ordered) >= 2, "options": ordered[:2]}

    def _health_safety_check(self, message: str, base: dict[str, Any], tr: dict[str, Any]) -> bool:
        """Deterministic urgent-care safety net (no LLM). If triggered, overwrite the reply with a safety-first
        response and return True so the caller skips the LLM entirely. Gated by HEALTH_SAFETY_FALLBACK_ENABLED
        (default ON). Fixes the observed generic-fallback-on-chest-pain failure."""
        if not reg.flag("HEALTH_SAFETY_FALLBACK_ENABLED"):
            return False
        indicator = detect_health_urgent(message)
        if not indicator:
            return False
        base["assistant_message"] = health_safety_response(indicator)
        base["llm_status"] = "safety_fallback"
        base["pending_key"] = base.get("pending_key") or ""
        tr["safety_flags"] = [indicator]
        tr["llm_status"] = "safety_fallback"
        log.info(json.dumps({"event": "advisor_safety_fallback", "turn_id": tr["turn_id"],
                             "user": tr.get("user_id"), "indicator": indicator}))
        return True

    def _enforce_discovery_contract(self, base: dict[str, Any], tr: dict[str, Any]) -> None:
        """Tripwire for discovery/onboarding turns: they must carry NO advisor-mode artifacts (six-section
        labels, advice disclaimer, or an inferred objective stated as confirmed fact). The RelationshipManager
        never emits these, so this is defense-in-depth — it records + logs a warning if a future change ever
        regresses discovery into advisor output. Non-mutating; never breaks the turn."""
        violations = discovery_contract_violations(base.get("assistant_message") or "")
        if violations:
            tr["discovery_contract_violations"] = violations
            log.warning(json.dumps({"event": "discovery_contract_violation",
                                    "turn_id": tr.get("turn_id"), "violations": violations}))

    def _route(self, ctx: UserContext, message: str, context_obj: Any, tr: dict[str, Any]) -> tuple[Any, Any]:
        """Select (primary_llm, fallback_llm) for this turn. Default → the DI-provided single LLM, so
        production behavior is unchanged. Never raises."""
        # FAST PATH (first-5 latency): a non-supervised turn (route_path fast/standard — simple follow-ups,
        # explanations, single-domain non-finance/health Q&A) → a fast model (Flash) with the deep model as
        # same-tier fallback. supervised turns (finance/health/cross-domain/high-risk) keep the reasoning model.
        # The SAME validator gates both, so this trades a little model capability on simple turns for a large
        # latency win, never safety. Env kill-switch ADVISOR_FAST_PATH_ENABLED (default on).
        if (self._fast_llm is not None
                and tr.get("route_path") in ("fast", "standard")
                and os.environ.get("ADVISOR_FAST_PATH_ENABLED", "true").lower() in ("1", "true", "yes")):
            tr["fast_path"] = True
            tr["model_route"] = "fast"
            log.info(json.dumps({"event": "advisor_fast_path", "turn_id": tr["turn_id"],
                                 "route_path": tr.get("route_path"),
                                 "model": getattr(self._fast_llm, "model_name", "")}))
            return self._fast_llm, self._llm  # fast primary, deep same-tier fallback
        # Opus hybrid: route clearly finance/health turns AND cross-domain LIFE DECISIONS to Claude (Opus), with
        # Gemini as same-tier fallback. The cross-domain path catches "should I buy before the wedding or after
        # promotion?" that keyword-routing doesn't tag finance/health — exactly the turns that most need Opus.
        if self._hybrid_claude is not None and self._claude_domains:
            try:
                routed = route_domains(message)
                is_focused = len(routed) < len(ALL_LIFE_DOMAINS)  # a specific (not all-domain) hit
                hits_claude = bool(set(routed) & self._claude_domains)
                cross_domain = _is_cross_domain_life_decision(message)
                # high_stakes_only → require a focused finance/health turn (don't send ambiguous turns to Claude)
                if cross_domain or (hits_claude and (is_focused or not self._claude_high_stakes_only)):
                    tr["hybrid_route"] = {"to": "claude", "domains": routed, "cross_domain": cross_domain,
                                          "model": getattr(self._hybrid_claude, "model_name", "")}
                    log.info(json.dumps({"event": "opus_hybrid_route", "turn_id": tr["turn_id"],
                                         "domains": routed, "cross_domain": cross_domain,
                                         "model": getattr(self._hybrid_claude, "model_name", "")}))
                    return self._hybrid_claude, self._llm  # Claude primary, Gemini same-tier fallback
            except Exception as e:  # noqa: BLE001 — hybrid routing must never break the turn
                tr["hybrid_route_error"] = type(e).__name__
        if not (reg.flag("MODEL_ROUTER_ENABLED") and self._router is not None):
            return self._llm, None
        try:
            tier = str(getattr(ctx, "plan_tier", "") or getattr(ctx, "tier", "") or "free")
            decision = self._router.route(message=message, tier=tier, tenant_id=str(getattr(ctx, "tenant_id", "") or ""),
                                          user_id=str(ctx.user_id), context=context_obj)
            tr["routing"] = decision.to_log()
            log.info(json.dumps({"event": "model_route", "turn_id": tr["turn_id"], **decision.to_log()}))
            return (decision.primary_llm or self._llm), decision.fallback_llm
        except Exception as e:  # noqa: BLE001 — routing must never break the turn
            tr["routing_error"] = type(e).__name__
            return self._llm, None

    def _init_trace(self, message: str, conversation_id: Optional[str], user_id: str) -> dict[str, Any]:
        # Per-turn telemetry (P0.1/P0.4/P0.5) — stage timings + outcome, logged + best-effort persisted.
        return {
            "turn_id": str(uuid.uuid4()), "conversation_id": conversation_id, "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(), "prompt_version": self.prompt_version,
            "llm_status": "", "validator_result": "n/a", "validator_reason": "", "validator_repairs": [],
            "fallback_used": False, "fallback_reason": "", "stages_ms": {}, "latency_ms": 0,
            "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
            "graph_edges_available": 0, "relationships_referenced": [], "confidence": None,
            "llm_response_raw": "", "user_message": (message or "")[:4000], "advisor_response": "",
            # RELEASE_HARDENING observability (item 2) — logged every turn, distinguishable fallback causes.
            "fallback_cause": "", "provider_called": False, "auth_token_available": None,
            "gate_that_blocked": "", "route_path": "", "domains": [], "llm_last_error": "",
            "repair_attempts": 0, "agent": "", "model": "", "provider": "",
        }

    async def _fetch_history(self, ctx: UserContext, conversation_id: Optional[str]) -> list[dict[str, str]]:
        """P0.1 cross-turn context — read the recent turns of THIS conversation from the existing telemetry
        table (analytics.advisor_turns). No new store/schema. Tenant-scoped (user_id AND conversation_id);
        best-effort (returns [] on any failure or when there's no conversation_id). Oldest-first."""
        if not conversation_id or self._sb is None:
            return []
        try:
            rows = await self._sb.select(
                "advisor_turns",
                columns="user_message,advisor_response,created_at",
                filters={"user_id": f"eq.{ctx.user_id}", "conversation_id": f"eq.{conversation_id}"},
                order="created_at.desc", limit=4, schema="analytics",
            )  # 4 recent turns is ample continuity; fewer rows = smaller prompt (faster generate) + less query
            rows = list(reversed(rows or []))  # oldest-first
            return [{"user": str(r.get("user_message") or ""), "advisor": str(r.get("advisor_response") or "")}
                    for r in rows if r.get("user_message")]
        except Exception:  # noqa: BLE001 — context is an enhancement; never break the turn
            return []

    # A3 (counsel-first): when an ADVISOR-mode turn falls back, the deterministic reply is the
    # RelationshipManager's discovery opener ("…what would you most like your life to look like…").
    # Showing intake in response to a direct question reads as broken. Replace it with an honest,
    # counsel-framed holding reply and drop the discovery question-pin so the user isn't pinned to it.
    _COUNSEL_FALLBACK = (
        "Let's get you a concrete answer. Tell me a bit more about what you're weighing — or share the "
        "key numbers — and I'll lay out the options, the math, and the tradeoffs. I won't invent figures "
        "I can't stand behind, but I'll give you the most useful read I can from what you provide."
    )

    # Domain-shaped fallbacks: a non-finance turn must NEVER get the finance "give me your income/savings/
    # expenses" deflection (that was the education-misframe bug). When the routed domain is education/career/
    # health/family, open THAT conversation with a substantive, counsel-first prompt instead of a money ask.
    _DOMAIN_COUNSEL = {
        "education": ("Let's actually dig into your education. Tell me what you're weighing — a degree, a "
                      "certificate or credential, a bootcamp, grad school, or the ROI of one path versus staying "
                      "put — plus where you are now (field, role, rough timeline). I'll lay out how the options "
                      "compare, what tends to pay off, and the few things that decide it."),
        "career": ("Let's get into your career. Tell me what's in play — a move, a promotion, a pivot, or what "
                   "you're worth in the market — and where you stand now (role, field, years in). I'll map the "
                   "realistic paths, the tradeoffs between them, and what would actually move the needle."),
        "health": ("Let's build your health plan. Tell me what you're focused on — training, nutrition, sleep, "
                   "recovery, energy — and your starting point and any constraints, and I'll give you a concrete "
                   "approach and the tradeoffs. Anything that needs a clinician, I'll flag and point you to the "
                   "right professional."),
        "family": ("Let's map the family side. Tell me what you're weighing — guardianship, a will or estate "
                   "plan, protecting dependents, or a big family decision — and I'll walk through the "
                   "considerations, the sequence, and the calls that matter most."),
    }

    def _apply_counsel_fallback(self, base: dict[str, Any], *, cause: str = "",
                                issues: Optional[list[dict[str, Any]]] = None,
                                domains: Optional[list[str]] = None) -> None:
        """Cause-aware AND domain-aware fallback copy. For a trust-spine number block, say WHAT was blocked, WHY,
        and WHAT verified input unlocks a precise answer. For a NON-finance routed domain, open that domain's
        conversation rather than defaulting to the finance income/savings deflection."""
        types = {i.get("type") for i in (issues or [])}
        primary = next((d for d in (domains or []) if d in self._DOMAIN_COUNSEL), None)
        if cause == "trust_spine_block" and "unsupported_monthly_payment" in types:
            # Inherently a finance computation — keep the finance-specific copy.
            msg = ("I won't put an exact monthly payment on that yet — that needs the interest rate and loan term, "
                   "which I don't have. Share the rate and term (or a lender quote) and I'll compute the payment, "
                   "total interest, and how it fits your budget. I can still talk through the down payment and what "
                   "to watch for, qualitatively.")
        elif cause in ("policy_safety_gate", "safety_gate"):
            msg = ("This is an area I can't give a definitive ruling on (medical, legal, tax, or a specific "
                   "product). I can lay out the key considerations, a checklist, and the exact questions to take to "
                   "the right licensed professional — want me to do that?")
        elif cause in ("infrastructure_auth", "provider_timeout", "provider_error"):
            msg = ("I hit a brief issue reaching my reasoning engine, so I won't guess. Try again in a moment and "
                   "I'll give you the full analysis.")
        elif cause == "trust_spine_block" and primary:
            # Education/career/health/family turn whose number was gated — engage the actual topic instead of
            # the finance income/savings deflection (the education-misframe bug). Never ask for money inputs.
            msg = self._DOMAIN_COUNSEL[primary]
        elif cause == "trust_spine_block":
            msg = ("I won't put an exact dollar figure on that yet — a precise number would need your verified "
                   "income, savings, and monthly expenses, which I don't have on file. Share those (or connect your "
                   "accounts) and I'll run the real math and the tradeoffs. I'd rather be useful than guess at a "
                   "number I can't stand behind — tell me the inputs and I'll be specific.")
        else:
            msg = self._COUNSEL_FALLBACK
        base["assistant_message"] = msg
        base["pending_key"] = None
        base["options"] = None

    async def _enhance(self, base: dict[str, Any], ctx: UserContext, message: str, tr: dict[str, Any], lap,
                       history: Optional[list[dict[str, str]]] = None, llm: Any = None,
                       fallback_llm: Any = None, agent: Any = None, deadline: Optional[float] = None) -> None:
        """LLM enhancement: build context → generate → validate → compose. Mutates base + tr in place.
        Never raises — on any failure, base keeps its deterministic fallback text and llm_status is set.
        `llm` is the routed model for this turn (defaults to the DI LLM); `fallback_llm` (if provided by the
        router) is tried once when the primary is unavailable — a provider-failure fallback that is invisible
        to the user. Shared by converse()/converse_stream() so both paths produce identical outcomes."""
        active = llm or self._llm
        try:
            context = await self._ctx.build(ctx, message, base, history or [], agent=agent)
            lap("context_build")
            # Command Center: surface the grounded sources for this turn (Phase 9). Section-level — these
            # are the provenance-carrying facts the agent was constrained to, set even if generation fails.
            base["citations"] = _citations_from_context(context)
            constraints = build_constraints(base, context)
            lap("plan")
            tr["provider_called"] = True  # we attempted the provider this turn (item 2 observability)
            out = await active.generate(context, constraints)
            if out is None:
                # One retry: transient provider failures (502/timeout/truncated JSON) surface as None.
                out = await active.generate(context, constraints)
                tr["llm_retry"] = True
            if out is None and fallback_llm is not None:
                # Provider-failure fallback: the routed primary is unavailable — drop to the fallback model
                # once (still re-validated below). User never sees a provider error.
                active = fallback_llm
                out = await active.generate(context, constraints)
                tr["model_fallback"] = True
            lap("llm_generate")
            # Prove the runtime model/provider actually used this turn (Phase 2/8: metadata proves provider).
            tr["model"] = getattr(active, "model_name", "") or ""
            tr["provider"] = getattr(active, "provider", "") or ""
            base["model"], base["provider"] = tr["model"], tr["provider"]
            usage = getattr(active, "last_usage", {}) or {}
            tr["prompt_tokens"], tr["completion_tokens"], tr["total_tokens"] = (
                usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), usage.get("total_tokens", 0))
            tr["llm_response_raw"] = getattr(active, "last_raw", "") or ""
            tr["graph_edges_available"] = len(getattr(context, "relationship_edges", []) or [])
            last_error = getattr(active, "last_error", "") or ""
            if out is None:
                base["llm_status"] = "fallback:unavailable"
                cause = classify_fallback_cause("fallback:unavailable", last_error, [])
                tr["fallback_used"], tr["fallback_reason"], tr["validator_result"] = True, "llm_unavailable_or_unparseable", "n/a"
                tr["fallback_cause"], tr["llm_last_error"] = cause, last_error
                tr["auth_token_available"] = cause != "infrastructure_auth"
                tr["gate_that_blocked"] = ""
                self._apply_counsel_fallback(base, cause=cause, domains=route_domains(message))
                # LOUD: a model/auth failure must never be a silent quality drop (org-policy / ADC visibility).
                log.warning(json.dumps({"event": "advisor_model_fallback", "turn_id": tr["turn_id"],
                                        "reason": "llm_unavailable_or_unparseable", "cause": cause,
                                        "last_error": last_error,
                                        "provider": tr.get("provider", ""), "model": tr.get("model", "")}))
                return
            tr["auth_token_available"] = True  # the provider answered → token was acquired
            ok, safe, reasons = validate(out, context)
            lap("validate")
            # SUPERVISED REPAIR LOOP: the model produced a strong draft; the validator is the supervisor. On
            # failure we send STRUCTURED, per-issue repair instructions and let the model revise, re-validating
            # each time. The SAME gate checks every draft, so nothing unsafe slips through. (ADVISOR_SUPERVISION)
            # RELIABILITY (first-5): each repair is a full ~30s LLM call, so 2 attempts pushed worst-case turns
            # to ~120s (past the client/Vercel timeout → perceived as a dead advisor). Cap to ONE repair AND a
            # wall-clock DEADLINE for the whole turn — once the budget is spent we stop repairing and fall back
            # to the safe deterministic counsel (a clean degrade beats a 2-minute hang). The validator is never
            # relaxed; only the latency budget shrinks.
            _MAX_REPAIRS = 0 if tr.get("route_path") == "fast" else 1
            attempt = 0
            issues: list[dict[str, Any]] = []
            while (
                (not ok)
                and _is_repairable(reasons)
                and attempt < _MAX_REPAIRS
                and (deadline is None or time.perf_counter() < deadline)
            ):
                attempt += 1
                issues = classify_issues(out, context)
                repair_plan = dict(constraints)
                repair_plan["repair_note"] = _build_repair_note(issues, reasons)
                out_r = await active.generate(context, repair_plan)
                tr["repair_attempts"] = attempt
                tr["repair_retry"] = True  # back-compat flag
                if out_r is None:
                    break
                out = out_r
                ok, safe, reasons = validate(out, context)
                if ok:
                    tr["validator_result"] = f"repaired_attempt_{attempt}"
                    tr["llm_response_raw"] = getattr(active, "last_raw", "") or ""
                    break
            lap("repair")
            if not ok:
                base["llm_status"] = "fallback:" + ("; ".join(reasons))[:140]
                cause = classify_fallback_cause(base["llm_status"], "", reasons)
                if attempt >= _MAX_REPAIRS and _MAX_REPAIRS > 0:
                    cause = cause or "repair_loop_exhausted"
                issues = issues or classify_issues(out, context)
                tr["fallback_used"], tr["fallback_reason"], tr["validator_result"], tr["validator_reason"] = (
                    True, "; ".join(reasons), "rejected", "; ".join(reasons))
                tr["fallback_cause"], tr["gate_that_blocked"] = cause, "; ".join(reasons)[:120]
                self._apply_counsel_fallback(base, cause=cause, issues=issues, domains=route_domains(message))
                return
            composed = _compose(safe)
            lap("compose")
            if not composed:
                base["llm_status"] = "fallback:empty"
                tr["fallback_used"], tr["fallback_reason"], tr["validator_result"] = True, "empty_composed", "accepted"
                tr["fallback_cause"] = "malformed_output"
                self._apply_counsel_fallback(base, cause="malformed_output", domains=route_domains(message))
                return
            # Merge: only the human-facing text changes; all deterministic outcomes are preserved.
            base["assistant_message"] = composed
            base["llm_status"] = "enhanced"
            base["prompt_version"] = self.prompt_version
            # Structured reasoning for the UI's expandable "Why / evidence" drawer (NOT dumped in the chat
            # message). Citations already travel in base["citations"]. Preserves evidence without the memo feel.
            reasoning = _reasoning_payload(safe)
            if reasoning:
                base["reasoning"] = reasoning
            if safe.get("missing_data"):
                base["missing_data"] = safe["missing_data"]  # advisory display only — not persisted
            if safe.get("relationships_referenced"):
                base["relationships_referenced"] = safe["relationships_referenced"]  # real cited edges
            tr["validator_result"] = "repaired" if safe.get("_repairs") else "accepted"
            tr["validator_repairs"] = safe.get("_repairs") or []
            tr["relationships_referenced"] = safe.get("relationships_referenced") or []
        except Exception as e:  # noqa: BLE001 — never break the user experience
            base["llm_status"] = "fallback:error"
            tr["fallback_used"], tr["fallback_reason"], tr["validator_result"] = True, f"error:{type(e).__name__}", "n/a"
            # LOUD: surface provider/auth errors (e.g. VertexAuthError) instead of a silent deterministic drop.
            log.warning(json.dumps({"event": "advisor_model_fallback", "turn_id": tr["turn_id"],
                                    "reason": f"error:{type(e).__name__}", "detail": str(e)[:200],
                                    "provider": tr.get("provider", ""), "model": tr.get("model", "")}))

    async def converse(self, ctx: UserContext, message: str, pending_key: Optional[str] = None,
                       *, conversation_id: Optional[str] = None, trace: bool = False,
                       mode: str = "advisor", agent: Optional[str] = None) -> dict[str, Any]:
        t0 = time.perf_counter()
        tr = self._init_trace(message, conversation_id, ctx.user_id)
        tr["mode"] = mode
        mark = t0

        def lap(name: str) -> None:
            nonlocal mark
            now = time.perf_counter()
            tr["stages_ms"][name] = round((now - mark) * 1000, 1)
            mark = now

        # Command Center: resolve the answering agent (advisor mode only; discovery has no agent persona).
        # Resolved BEFORE the deterministic turn so the context_panel chips can be scoped to the turn's
        # routed domain(s) (a HEALTH turn shouldn't surface finance/career risk chips).
        agent_obj = get_agent(agent) if (mode != "discovery" and agent) else None
        fdoms = _focus_domains(agent_obj, message) if mode != "discovery" else None
        # Latency-aware routing tier (item 4): logged, and tunes the repair budget — never the safety gates.
        tr["domains"] = list(fdoms or [])
        tr["route_path"] = "discovery" if mode == "discovery" else select_route_path(message, fdoms)
        # 1) Deterministic turn — persistence (candidate/rejected goals), canonical writes, safe fallback text.
        base = await self._rm.converse(ctx, message, pending_key, focus_domains=fdoms)
        lap("deterministic_turn")
        if agent_obj is not None:
            base["agent"] = agent_obj.id
            tr["agent"] = agent_obj.id
        # FACT→DOMAIN SYNC: normalize durable facts in this message into the existing domain profile tables the
        # dashboard reads (career.career_profiles / education.education_profiles). Fail-soft, scoped to the
        # answering agent's domain(s) when known. Provenance stays in life.facts; this is the normalized state.
        if message and self._sb is not None:
            try:
                gem = getattr(self._rm, "_gemini", None)  # reuse the discovery interpreter's LLM
                synced = await fact_domain_sync.sync_from_message(
                    self._sb, gem, ctx, message, domains=set(fdoms) if fdoms else None, source="advisor_chat")
                if synced:
                    tr["domain_sync"] = [{"domain": s["domain"], "updated": s["fields_updated"]} for s in synced]
            except Exception:  # noqa: BLE001 — sync must never break the turn
                pass
        # Health urgent-care safety net runs BEFORE any model (deterministic, no LLM) — wins in EVERY mode.
        if self._health_safety_check(message, base, tr):
            return self._finish(ctx, base, tr, t0, trace)
        # CROSS-AGENT IN-CHAT HANDOFF: a direct domain advisor must NOT answer out-of-domain — but instead of
        # stopping, it ROUTES the turn to the correct specialist and that advisor answers in the same thread
        # (no retype, no page switch). High-confidence → auto-route; ambiguous (2+ domains) → ask which angle.
        hinfo = self._detect_handoff(agent_obj, message)
        if hinfo:
            if hinfo["ambiguous"]:
                opts = [get_agent(f"{d}_advisor") for d in hinfo["options"]]
                names = [o.name if o else d.title() for o, d in zip(opts, hinfo["options"])]
                base["assistant_message"] = (
                    f"I can route this to {names[0]} or {names[1]} — which angle do you want first?")
                base["reveal"] = None
                base["llm_status"] = "handoff_choice"
                tr["llm_status"] = "handoff_choice"
                base["handoff"] = {"response_type": "handoff_choice", "from_agent": agent_obj.id,
                                   "options": [o.id if o else f"{d}_advisor"
                                               for o, d in zip(opts, hinfo["options"])]}
                return self._finish(ctx, base, tr, t0, trace)
            # High-confidence → switch persona to the target and answer as that advisor below (_enhance).
            base["handoff"] = {
                "response_type": "handoff", "from_agent": agent_obj.id, "from_name": hinfo["from_name"],
                "target_agent": hinfo["target_agent_obj"].id if hinfo["target_agent_obj"] else f"{hinfo['target']}_advisor",
                "target_name": hinfo["target_name"], "target_domain": hinfo["target"], "reason": hinfo["reason"],
            }
            tr["handoff"] = base["handoff"]
            tr["fallback_cause"] = "cross_agent_handoff"
            if hinfo["target_agent_obj"] is not None:
                agent_obj = hinfo["target_agent_obj"]
                fdoms = {hinfo["target"]}
                base["agent"] = agent_obj.id
                tr["agent"] = agent_obj.id
        # Discovery/onboarding mode: keep the RelationshipManager's conversational reply verbatim — NO LLM
        # enhancement, NO six-section advisor template, NO advice disclaimer, NO objective-as-fact. This is
        # the fix for advisor-mode contaminating onboarding. Advisor mode (default) is unchanged below.
        if mode == "discovery":
            self._enforce_discovery_contract(base, tr)
            tr["llm_status"] = base.get("llm_status") or "discovery"
            base["llm_status"] = "discovery"
            return self._finish(ctx, base, tr, t0, trace)
        if not self._enabled:
            tr["llm_status"] = base.get("llm_status") or "disabled"
            return self._finish(ctx, base, tr, t0, trace)
        history = await self._fetch_history(ctx, conversation_id)
        lap("history_fetch")
        primary_llm, fallback_llm = self._route(ctx, message, None, tr)
        await self._enhance(base, ctx, message, tr, lap, history, primary_llm, fallback_llm, agent=agent_obj,
                            deadline=t0 + _ADVISOR_TURN_BUDGET_S)
        return self._finish(ctx, base, tr, t0, trace)

    async def converse_stream(self, ctx: UserContext, message: str, pending_key: Optional[str] = None,
                              *, conversation_id: Optional[str] = None, trace: bool = False,
                              mode: str = "advisor", agent: Optional[str] = None):
        """Progressive variant: yield a fast deterministic ACK first (the trust-safe text we'd show on
        fallback anyway, ready in ~1s), then the fully validated enhanced answer. Same telemetry/persistence
        as converse(). The validator still gates everything the user accepts as advice — the ack only mirrors
        the deterministic engine, which never fabricates. Yields event dicts: {"type": "ack"|"final", ...}."""
        t0 = time.perf_counter()
        tr = self._init_trace(message, conversation_id, ctx.user_id)
        mark = t0

        def lap(name: str) -> None:
            nonlocal mark
            now = time.perf_counter()
            tr["stages_ms"][name] = round((now - mark) * 1000, 1)
            mark = now

        agent_obj = get_agent(agent) if (mode != "discovery" and agent) else None
        fdoms = _focus_domains(agent_obj, message) if mode != "discovery" else None
        # Latency-aware routing tier (item 4): logged, and tunes the repair budget — never the safety gates.
        tr["domains"] = list(fdoms or [])
        tr["route_path"] = "discovery" if mode == "discovery" else select_route_path(message, fdoms)
        base = await self._rm.converse(ctx, message, pending_key, focus_domains=fdoms)
        lap("deterministic_turn")
        if agent_obj is not None:
            base["agent"] = agent_obj.id
            tr["agent"] = agent_obj.id
        # Health urgent-care safety net runs BEFORE the ack so an urgent message never shows the generic
        # opener first. If triggered, the safety reply IS the ack and the final.
        if self._health_safety_check(message, base, tr):
            yield {"type": "ack", "assistant_message": base["assistant_message"],
                   "pending_key": base.get("pending_key") or "", "turn_id": tr["turn_id"]}
            self._finish(ctx, base, tr, t0, trace)
            yield {"type": "final", **base}
            return
        # Fast first paint — the deterministic, trust-safe acknowledgment.
        yield {"type": "ack", "assistant_message": base.get("assistant_message") or "",
               "pending_key": base.get("pending_key") or "", "turn_id": tr["turn_id"]}
        # Discovery/onboarding mode: the conversational ack IS the answer — skip LLM enhancement / advisor
        # template / disclaimer entirely. Health-safety (above) still wins first.
        if mode == "discovery":
            self._enforce_discovery_contract(base, tr)
            base["llm_status"] = "discovery"
            self._finish(ctx, base, tr, t0, trace)
            yield {"type": "final", **base}
            return
        if self._enabled:
            history = await self._fetch_history(ctx, conversation_id)
            lap("history_fetch")
            primary_llm, fallback_llm = self._route(ctx, message, None, tr)
            await self._enhance(base, ctx, message, tr, lap, history, primary_llm, fallback_llm, agent=agent_obj,
                            deadline=t0 + _ADVISOR_TURN_BUDGET_S)
        else:
            tr["llm_status"] = base.get("llm_status") or "disabled"
        self._finish(ctx, base, tr, t0, trace)  # log + best-effort persist + (optional) attach _trace
        yield {"type": "final", **base}

    def _finish(self, ctx: UserContext, base: dict[str, Any], tr: dict[str, Any], t0: float, trace: bool) -> dict[str, Any]:
        """Finalize telemetry: stamp latency/outcome, emit a metadata log line, best-effort persist, and
        attach the full trace only when explicitly requested (dev trace mode)."""
        tr["latency_ms"] = round((time.perf_counter() - t0) * 1000, 1)
        tr["llm_status"] = base.get("llm_status") or tr.get("llm_status") or ""
        tr["advisor_response"] = base.get("assistant_message") or ""
        # Surface key observability fields on the RESPONSE so the live regression (item 1) can assert the LLM
        # actually ran on the deployed web path (provider_called + model + empty fallback_cause = real LLM turn).
        base["provider_called"] = tr.get("provider_called", False)
        base["fallback_cause"] = tr.get("fallback_cause", "")
        base["route_path"] = tr.get("route_path", "")
        base["latency_ms"] = tr["latency_ms"]
        # Structured, metadata-only log (no message/response/raw → no PII). Every fallback is now attributable
        # to a distinguishable cause (item 2). request_id == turn_id.
        log.info(json.dumps({
            "event": "advisor_turn", "turn_id": tr["turn_id"], "request_id": tr["turn_id"], "user": ctx.user_id,
            "tenant_id": str(getattr(ctx, "tenant_id", "") or ""), "environment": os.environ.get("ENVIRONMENT", ""),
            "route_path": tr.get("route_path", ""), "domain": tr.get("domains", []), "agent": tr.get("agent", ""),
            "llm_status": tr["llm_status"], "provider_called": tr.get("provider_called", False),
            "auth_token_available": tr.get("auth_token_available"), "provider": tr.get("provider", ""),
            "model": tr.get("model", ""), "validator_result": tr["validator_result"],
            "fallback": tr["fallback_used"], "fallback_reason": tr["fallback_reason"],
            "fallback_cause": tr.get("fallback_cause", ""), "gate_that_blocked": tr.get("gate_that_blocked", ""),
            "llm_last_error": tr.get("llm_last_error", ""), "repair_attempts": tr.get("repair_attempts", 0),
            "repairs": tr["validator_repairs"], "latency_ms": tr["latency_ms"], "stages_ms": tr["stages_ms"],
            "tokens": tr["total_tokens"], "edges": tr["graph_edges_available"], "msg_len": len(tr.get("user_message") or ""),
        }))
        # Best-effort durable write (analytics.advisor_turns, service-role only). Swallow if table absent.
        # jsonb columns (stages_ms / relationships_referenced / validator_repairs) are passed as native
        # dict/list — PostgREST serializes the row to JSON, so they land as jsonb objects/arrays (NOT
        # double-encoded JSON strings).
        if self._sb is not None:
            # Persist ONLY the columns analytics.advisor_turns actually has (migration 160). tr accumulates
            # many transient keys (mode, routing, llm_retry, model_fallback, repair_*, agent, model, provider,
            # the new observability fields) that are NOT columns — inserting them returned 400 and silently
            # dropped EVERY turn from the durable table. Whitelisting fixes it and survives future tr keys.
            row = {k: tr.get(k) for k in _ADVISOR_TURNS_COLUMNS if k in tr}
            row["advisor_response"] = (tr.get("advisor_response") or "")[:4000]
            row["llm_response_raw"] = (tr.get("llm_response_raw") or "")[:8000]
            try:
                import asyncio
                task = asyncio.ensure_future(self._persist(row))
                _PENDING_WRITES.add(task)  # hold a strong ref so the task isn't GC'd before it completes
                task.add_done_callback(_PENDING_WRITES.discard)
            except Exception:  # noqa: BLE001
                pass
        # Best-effort usage ledger increment (atomic via analytics.bump_model_usage). Default OFF
        # (USAGE_TRACKING_ENABLED) and swallows errors → no behavior change until the migration is applied.
        if self._sb is not None and reg.flag("USAGE_TRACKING_ENABLED"):
            try:
                import asyncio
                t = asyncio.ensure_future(self._persist_usage(ctx, tr))
                _PENDING_WRITES.add(t)
                t.add_done_callback(_PENDING_WRITES.discard)
            except Exception:  # noqa: BLE001
                pass
        if trace:
            base["_trace"] = tr
        return base

    async def _persist(self, row: dict[str, Any]) -> None:
        try:
            await self._sb.insert("advisor_turns", row, schema="analytics")
        except Exception:  # noqa: BLE001 — table may not exist yet; logging still works
            pass

    async def _persist_usage(self, ctx: UserContext, tr: dict[str, Any]) -> None:
        """Atomic per-turn usage increment to analytics.model_usage. Premium vs standard from the routing
        decision; safety + model-fallback flags from the trace. tenant defaults to the user (single-tenant)."""
        try:
            routing = tr.get("routing") or {}
            premium = bool(routing.get("premium"))
            period = datetime.now(timezone.utc).strftime("%Y-%m")
            tenant = str(getattr(ctx, "tenant_id", "") or ctx.user_id)
            await self._sb.rpc("bump_model_usage", {
                "p_tenant": tenant, "p_user": str(ctx.user_id), "p_period": period,
                "p_premium": 1 if premium else 0, "p_standard": 0 if premium else 1,
                "p_reports": 0, "p_safety": 1 if tr.get("safety_flags") else 0,
                "p_fallbacks": 1 if tr.get("model_fallback") else 0,
                "p_cost": float(routing.get("estimated_cost") or 0),
            }, schema="analytics")
        except Exception:  # noqa: BLE001 — best-effort; table/function may be absent pre-migration
            pass
