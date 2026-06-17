"""Advisor Output Validator (Hybrid Advisor sprint).

The deterministic trust gate over the LLM's output. The LLM leads the conversation; this layer guarantees
it can never fabricate or overstep. It REJECTS (→ rule-based fallback) or REPAIRS output that: invents
financial numbers not in context, gives medical/legal/tax/financial advice, claims a goal was confirmed,
tries to persist, merges fact categories that must stay separate, or is malformed.

Persistence rule: the LLM may PROPOSE candidate facts/goals, but this validator is the only thing that may
let anything through, and it forces should_persist=False — nothing is saved without later confirmation.
"""
from __future__ import annotations

import re
from typing import Any

from .advisor_context import AdvisorContext, _norm
from .advisor_math import verify_derivations

# Connective phrases that assert a relationship between two goals/objectives. If the LLM uses one, it must
# cite a supporting edge — otherwise it is inventing graph reasoning and we reject it.
_RELATION = re.compile(
    r"\b(connected to|linked to|tied to|tied together|ties? into|tie in with|related to|relates to|"
    r"connects? to|connection between|feeds? into|interrelated|interconnected|"
    r"work against each other|compete[s]? with|trade ?off against|at odds with|reinforces|"
    r"is connected|are connected|both (?:support|feed|point|connect|relate))\b",
    re.IGNORECASE,
)

# Phrases that inherently assert a link between TWO entities — the real "invented graph reasoning" risk.
# (Single-target discovery talk like "tied to this goal" / "connects to your vision" is NOT here — that was
# a false-positive fallback source. A two-named-goal claim is caught separately, below.)
_RELATION_ASSERT = re.compile(
    r"\b(connection between|interrelated|interconnected|tied together|"
    r"work against each other|competes? with|trade ?off against|at odds with|reinforces?|"
    r"both (?:support|feed|point|connect|relate)|are connected|are linked|are related|"
    r"connected to each other|relate to each other)\b",
    re.IGNORECASE,
)


def _asserts_goal_relationship(text: str, goals: list[str]) -> bool:
    """True only if the text asserts a relationship that needs a real graph edge:
      * explicit two-entity / mutual phrasing ("connection between", "interrelated", "compete with"), OR
      * a single-target relation phrase ("connected to", "tied to") that names ≥2 of the user's OWN goals
        (i.e. claims goal-A links to goal-B).
    Generic "…tied to this goal / connects to your vision/future…" is benign discovery language and passes."""
    if _RELATION_ASSERT.search(text):
        return True
    if _RELATION.search(text):
        low = text.lower()
        # A single-target phrase is a goal-to-goal claim when it links two goals: either ≥2 of the user's
        # OWN goal labels appear, or the text says "goal"/"objective" ≥2 times ("retirement goal is
        # connected to your education goal"). One "…tied to this goal" is benign discovery talk.
        named = sum(1 for g in goals if g and len(str(g)) > 3 and str(g).lower() in low)
        goal_words = len(re.findall(r"\b(?:goals?|objectives?)\b", low))
        if named >= 2 or goal_words >= 2:
            return True
    return False

# V4 (grounded-advice relaxation, signed off): strategic / personal-finance / life-planning recommendations
# are now ALLOWED ("prioritize the 24% debt", "this looks affordable on your numbers", "lean toward renting").
# These four categories remain HARD-BLOCKED for liability — the advisor must defer to a licensed professional:
#   * MEDICAL  — diagnosis, prescription, dosage, naming a treatment/drug
#   * LEGAL    — specific legal directives (how to title assets, "legally you must…")
#   * TAX      — specific tax directives (how to file/claim, a specific tax maneuver)
#   * PRODUCT  — recommending a specific investment product / security / insurer by name
# The number-grounding gate (invented-numbers, below) is UNCHANGED: still zero fabricated figures, ever.
_ADVICE = re.compile(
    r"("
    # MEDICAL
    r"\bi diagnose\b|\byou have (?:a )?(?:condition|disease|disorder)\b|\bprescrib\w*|\bdiagnos(?:e|es|ed|is)\b|"
    r"\byou should (?:take|start)\b[^.?!]{0,25}\b(?:mg|medication|dose|pill|drug)\b|\btake\b[^.?!]{0,15}\bmg\b|"
    # LEGAL (specific directives)
    r"\blegally,? you (?:should|must)\b|\byou should sue\b|\byou should file (?:suit|a lawsuit)\b|"
    r"\btitle (?:the|your) (?:house|home|assets|property)\b|"
    # TAX (specific directives)
    r"\bfor tax purposes,? you should\b|\byou qualify for a tax\b|\byou should claim the\b|\bfile your taxes as\b|"
    # PRODUCT / SECURITY by name
    r"\binvest in (?:the )?\w+ (?:fund|etf)\b|\bbuy (?:shares of|stock in)\b|\byou should buy [A-Z]{1,5}\b"
    r")",
    re.IGNORECASE,
)
# A financial-looking number = has $ or % or is >= 100. Trivial counts (ages aside, handled by context) ignored.
_FIN_NUM = re.compile(r"\$\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?%|\b\d{3,}\b")


def _first_question(text: str) -> str:
    """Keep everything up to and including the FIRST question mark (the first question), dropping any
    trailing extra questions. Preserves a single choice-question ('…a, b, or c?') untouched."""
    i = text.find("?")
    return text[: i + 1].strip() if i != -1 else text.strip()


def _financial_numbers(text: str) -> set[str]:
    out: set[str] = set()
    for m in _FIN_NUM.findall(text or ""):
        out.add(m.strip().lstrip("$").rstrip("%").replace(",", ""))
    return {n for n in out if n}


def _pair_supported(a: str, b: str, pairs: set[frozenset[str]]) -> bool:
    """A cited {a, b} is real if it matches a connected pair — exact, or label-containment either way
    (the LLM may shorten 'Financial Independence' to 'retirement/financial' etc.)."""
    na, nb = _norm(a), _norm(b)
    if not na or not nb:
        return False
    if frozenset({na, nb}) in pairs:
        return True
    for p in pairs:
        xs = list(p)
        if len(xs) != 2:
            continue
        x, y = xs[0], xs[1]
        if ((na in x or x in na) and (nb in y or y in nb)) or ((na in y or y in na) and (nb in x or x in nb)):
            return True
    return False


def _check_relationships(result: dict[str, Any], context: AdvisorContext, visible: str) -> tuple[list[str], list[dict[str, Any]]]:
    """Gate graph reasoning. Returns (reasons, kept_citations).

    Rules:
      * every cited relationship must be a REAL connected pair in the user's graph,
      * if the text asserts a relationship, it must be backed by at least one valid citation,
      * if the user has no graph edges at all, no relationship may be claimed.
    """
    cited = result.get("relationships_referenced") or []
    if not isinstance(cited, list):
        cited = []
    pairs = context.connected_pairs
    valid = [c for c in cited if isinstance(c, dict) and _pair_supported(c.get("from"), c.get("to"), pairs)]
    invalid = [c for c in cited if c not in valid]

    reasons: list[str] = []
    if invalid:
        bad = ", ".join(f"{(c or {}).get('from')}–{(c or {}).get('to')}" for c in invalid)
        reasons.append(f"unsupported relationship referenced (not in graph): {bad}")
    goal_labels = list(context.candidate_goals or []) + ([context.primary_objective] if context.primary_objective else [])
    if _asserts_goal_relationship(visible, goal_labels):
        if not pairs:
            reasons.append("relationship mentioned but the user's graph has no edges")
        elif not valid:
            reasons.append("relationship mentioned without a supporting graph edge")
    return reasons, valid


def validate(result: Any, context: AdvisorContext) -> tuple[bool, dict[str, Any], list[str]]:
    """Return (ok, safe_result, reasons). ok=False → caller uses the deterministic fallback."""
    reasons: list[str] = []
    if not isinstance(result, dict):
        return False, {}, ["output is not a JSON object"]

    reflection = str(result.get("reflection") or "").strip()
    next_q = str(result.get("next_question") or "").strip()
    why_q = str(result.get("why_this_question") or "").strip()
    summary = str(result.get("summary") or "").strip()
    # V3 exposes the advisor's reasoning as five user-visible sections. EVERY field rendered to the user must
    # pass the SAME trust checks (advice + invented numbers), so they are folded into `visible` here. This
    # widens coverage of the existing gate; it does not change the gate's logic, thresholds, or allowed set.
    frame = str(result.get("decision_frame") or "").strip()
    tradeoffs = result.get("tradeoffs") or []
    tradeoff_text = " ".join(
        f"{(t or {}).get('option', '')} {(t or {}).get('benefit', '')} {(t or {}).get('cost', '')}"
        for t in tradeoffs if isinstance(t, dict)
    )
    know = " ".join(str(x) for x in (result.get("what_we_know") or []) if x)
    need = " ".join(str(x) for x in (result.get("what_we_still_need") or []) if x)
    recommendation = str(result.get("recommendation") or "").strip()  # V4: grounded advice, still number-gated
    visible = " ".join([frame, tradeoff_text, know, recommendation, need, reflection, next_q, why_q, summary])

    # 1) No final advice / recommendation / medical-legal-tax overreach.
    if _ADVICE.search(visible):
        reasons.append("contains advice/recommendation/medical-legal language")

    # 2) No invented financial numbers — any financial-looking number must already be in context, OR be a
    #    deterministically VERIFIED computation from the user's own numbers (V5 grounded math). The verifier
    #    rejects any derivation with a non-user operand or wrong arithmetic, so a fabricated/incorrect figure
    #    still never reaches the user — the guarantee widens from "user's own" to "user's own or verified".
    verified_vals, kept_derivs = verify_derivations(result.get("derivations"), context.allowed_numbers)
    allowed = context.allowed_numbers | verified_vals
    used = _financial_numbers(visible)
    invented = {n for n in used if n not in allowed}
    if invented:
        reasons.append(f"invented numbers not in context: {sorted(invented)}")

    # 3) Must actually ask a question (discovery turns), unless it's a pure summary turn.
    if not next_q and not summary:
        reasons.append("no next_question and no summary")
    # NOTE: a multi-question reply is REPAIRED (trimmed to the first question), not rejected — see below.
    # A single question that offers choices ("…sooner, liquidity, or wealth?") has one "?" and is untouched.

    # 4) No invented graph reasoning — relationship claims must be backed by real edges.
    rel_reasons, valid_citations = _check_relationships(result, context, visible)
    reasons.extend(rel_reasons)

    if reasons:
        return False, {}, reasons

    # ── Repairs (kept safe even when accepted) ──
    safe = dict(result)
    repairs: list[str] = []
    safe["should_persist"] = False  # the LLM NEVER persists — persistence is deterministic
    # Repair (not reject) a multi-question turn: keep the reflection + the FIRST question, drop the extra.
    # This salvages the LLM's good, on-topic reply on exactly the high-value decision questions instead of
    # discarding it for a generic rule-based fallback — without weakening any safety gate.
    if next_q.count("?") > 1:
        trimmed = _first_question(next_q)
        if trimmed and trimmed != next_q:
            safe["next_question"] = trimmed
            repairs.append("multi_question_trimmed")
    safe["_repairs"] = repairs
    # Drop any candidate goal that matches a previously rejected goal (never resurrect).
    rej = {r.lower() for r in context.rejected_goals}
    cg = []
    for g in (safe.get("candidate_goals") or []):
        title = str((g or {}).get("title") or "").lower()
        if title and not any(r in title or title in r for r in rej):
            cg.append(g)
    safe["candidate_goals"] = cg
    # Facts must declare a user_message source; drop fabricated-source facts. Categories stay separate.
    safe["confirmed_facts"] = [f for f in (safe.get("confirmed_facts") or []) if (f or {}).get("source") == "user_message"]
    safe["candidate_facts"] = [f for f in (safe.get("candidate_facts") or []) if (f or {}).get("source") == "user_message"]
    # Only keep relationship citations that are real graph edges (the accept-path repair).
    safe["relationships_referenced"] = valid_citations
    safe["derivations"] = kept_derivs  # only the verified-correct computations survive
    safe.setdefault("assumptions", [])
    safe.setdefault("missing_data", [])
    safe.setdefault("warnings", [])
    return True, safe, []
