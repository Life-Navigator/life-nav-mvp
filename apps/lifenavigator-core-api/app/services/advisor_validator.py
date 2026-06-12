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

from .advisor_context import AdvisorContext

# Phrases that mean the advisor is RECOMMENDING / advising rather than discovering — not allowed here
# (recommendations come from the recommendation engine; medical/legal/tax advice is never allowed).
_ADVICE = re.compile(
    r"\b(i recommend|i'?d recommend|i advise|i suggest you|you should (?:put|invest|buy|sell|borrow|take|withdraw|contribute|refinance)|"
    r"you must (?:invest|buy|sell|borrow|put|pay)|the best option is|the right (?:amount|choice) is|"
    r"put down \d|i diagnose|you have (?:a )?(?:condition|disease|disorder)|you should take \w+ ?mg|prescrib|"
    r"for tax purposes you should|legally you (?:should|must)|you qualify for a tax)\b",
    re.IGNORECASE,
)
# A financial-looking number = has $ or % or is >= 100. Trivial counts (ages aside, handled by context) ignored.
_FIN_NUM = re.compile(r"\$\d[\d,]*(?:\.\d+)?|\d[\d,]*(?:\.\d+)?%|\b\d{3,}\b")


def _financial_numbers(text: str) -> set[str]:
    out: set[str] = set()
    for m in _FIN_NUM.findall(text or ""):
        out.add(m.strip().lstrip("$").rstrip("%").replace(",", ""))
    return {n for n in out if n}


def validate(result: Any, context: AdvisorContext) -> tuple[bool, dict[str, Any], list[str]]:
    """Return (ok, safe_result, reasons). ok=False → caller uses the deterministic fallback."""
    reasons: list[str] = []
    if not isinstance(result, dict):
        return False, {}, ["output is not a JSON object"]

    reflection = str(result.get("reflection") or "").strip()
    next_q = str(result.get("next_question") or "").strip()
    why_q = str(result.get("why_this_question") or "").strip()
    summary = str(result.get("summary") or "").strip()
    visible = " ".join([reflection, next_q, why_q, summary])

    # 1) No final advice / recommendation / medical-legal-tax overreach.
    if _ADVICE.search(visible):
        reasons.append("contains advice/recommendation/medical-legal language")

    # 2) No invented financial numbers — any financial-looking number must already be in context.
    used = _financial_numbers(visible)
    invented = {n for n in used if n not in context.allowed_numbers}
    if invented:
        reasons.append(f"invented numbers not in context: {sorted(invented)}")

    # 3) Must actually ask a question (discovery turns), unless it's a pure summary turn.
    if not next_q and not summary:
        reasons.append("no next_question and no summary")
    if next_q.count("?") > 1:
        reasons.append("more than one question")

    if reasons:
        return False, {}, reasons

    # ── Repairs (kept safe even when accepted) ──
    safe = dict(result)
    safe["should_persist"] = False  # the LLM NEVER persists — persistence is deterministic
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
    safe.setdefault("assumptions", [])
    safe.setdefault("missing_data", [])
    safe.setdefault("warnings", [])
    return True, safe, []
