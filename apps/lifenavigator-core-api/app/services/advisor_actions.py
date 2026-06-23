"""Advisor Action Loop — exactly FIVE explicit, approval-gated life-change actions.

The contract (no exceptions):
  detect(message) -> which life change the user mentioned (deterministic, no LLM, no write)
  proposal(key)   -> the impact areas + the fields to collect (shown BEFORE any write, no write)
  apply(...)      -> writes ONLY after the user approves, ONLY through IngestionService.submit_life_fact
                     (the same tenant-scoped, provenance-stamped, idempotent MCP write path)

This is NOT a generic framework, NOT an autonomous agent, NOT a workflow engine. It is five hand-built
actions. Arcana proposes; the user approves; the system writes; the reads (readiness/recommendations/
dashboard) recompute on next load. Nothing is ever written silently.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Callable, Optional

from ..models.common import UserContext


@dataclass(frozen=True)
class Field:
    key: str
    label: str
    type: str = "text"  # "text" | "number"
    optional: bool = False


@dataclass(frozen=True)
class Action:
    key: str
    label: str
    confirm: str  # the warm opener Arcana shows on detection
    domain: str
    impact: tuple[str, ...]  # areas this change touches (shown before any write)
    fields: tuple[Field, ...]
    # builder: collected fields -> list of (fact_type, value) to submit. Empty/None values are skipped.
    facts: Callable[[dict[str, Any]], list[tuple[str, str]]]
    trigger: re.Pattern[str]


def _v(fields: dict[str, Any], k: str) -> str:
    return str(fields.get(k) or "").strip()


ACTIONS: dict[str, Action] = {
    "promotion": Action(
        key="promotion",
        label="Promotion",
        confirm="Congratulations on the promotion! This likely affects your compensation, retirement "
        "projections, taxes, and home-purchase timeline. Want me to update your career profile?",
        domain="career",
        impact=("Compensation", "Retirement projections", "Taxes", "Home-purchase timeline"),
        fields=(
            Field("title", "New title"),
            Field("salary", "New base salary", "number"),
            Field("bonus", "Annual bonus", "number", optional=True),
            Field("equity", "Equity grant", "number", optional=True),
        ),
        facts=lambda f: [
            ("promotion.title", _v(f, "title")),
            ("promotion.base_salary", _v(f, "salary")),
            ("promotion.annual_bonus", _v(f, "bonus")),
            ("promotion.equity_grant", _v(f, "equity")),
        ],
        trigger=re.compile(
            r"\b(got|just|recently)?\s*promot(ed|ion)\b|\bgot a raise\b|\bnew (title|role|position)\b|\bmoved up\b",
            re.IGNORECASE,
        ),
    ),
    "new_child": Action(
        key="new_child",
        label="New child",
        confirm="That's wonderful news. A new child changes several areas of your plan — life "
        "insurance, estate planning and guardianship, your emergency fund, college savings, and cash "
        "flow. Want me to note this and flag what to revisit?",
        domain="family",
        impact=("Life insurance", "Estate planning & guardianship", "Emergency fund", "College savings", "Cash flow"),
        fields=(
            Field("due_date", "Due date / arrival", optional=True),
            Field("child_name", "Name (if chosen)", optional=True),
        ),
        facts=lambda f: [
            ("family.expecting_child", "yes"),
            ("family.child_due_date", _v(f, "due_date")),
            ("family.child_name", _v(f, "child_name")),
        ],
        trigger=re.compile(
            r"\b(having|expecting) a baby\b|\bwe'?re expecting\b|\bpregnan\w*|\bnew (baby|child)\b|\bbaby on the way\b",
            re.IGNORECASE,
        ),
    ),
    "home_purchase": Action(
        key="home_purchase",
        label="Home purchase",
        confirm="Congratulations on the home! This changes your net worth, liabilities, cash reserves, "
        "readiness, and retirement assumptions. Want me to update your finances?",
        domain="finance",
        impact=("Net worth", "Liabilities (mortgage)", "Cash reserves", "Readiness", "Retirement assumptions"),
        fields=(
            Field("price", "Purchase price", "number"),
            Field("down_payment", "Down payment", "number", optional=True),
            Field("mortgage", "Mortgage balance", "number", optional=True),
        ),
        facts=lambda f: [
            ("home.purchase_price", _v(f, "price")),
            ("home.down_payment", _v(f, "down_payment")),
            ("home.mortgage_balance", _v(f, "mortgage")),
        ],
        trigger=re.compile(
            r"\bbought a (house|home|condo)\b|\bpurchased a (house|home|condo)\b|\bclosing on (a|our|the) (house|home)\b|\bhome purchase\b|\bwe bought\b",
            re.IGNORECASE,
        ),
    ),
    "degree_enrollment": Action(
        key="degree_enrollment",
        label="Degree enrollment",
        confirm="Great step. Enrolling affects your education profile, time commitment, cash flow "
        "(tuition), and career trajectory. Want me to add it to your plan?",
        domain="education",
        impact=("Education profile", "Time commitment", "Cash flow (tuition)", "Career trajectory"),
        fields=(
            Field("program", "Program / degree"),
            Field("cost", "Total tuition", "number", optional=True),
            Field("duration", "Duration (e.g. 2 years)", optional=True),
        ),
        facts=lambda f: [
            ("education.enrollment", _v(f, "program")),
            ("education.tuition", _v(f, "cost")),
            ("education.program_duration", _v(f, "duration")),
        ],
        trigger=re.compile(
            r"\benrolled in\b|\bstarting (a|my|the) (master|mba|degree|program|phd)\b|\bgoing back to school\b|\bstarted (a|my) (master|mba|degree)\b|\bgot into\b.*\b(master|mba|program)\b",
            re.IGNORECASE,
        ),
    ),
    "health_goal": Action(
        key="health_goal",
        label="Health goal",
        confirm="Love it — a concrete target. I'll add it to your health goals; it also moves your "
        "readiness and recommendations. Want me to set it?",
        domain="health",
        impact=("Health goals", "Readiness", "Recommendations"),
        fields=(
            Field("goal", "Your goal (e.g. lose 30 lbs)"),
            Field("target_date", "Target date / event", optional=True),
        ),
        facts=lambda f: [
            ("health.goal", _v(f, "goal")),
            ("health.goal_target_date", _v(f, "target_date")),
        ],
        trigger=re.compile(
            r"\blose \d+ ?(lbs|pounds)\b|\bwant to lose weight\b|\bget in shape\b|\b(fitness|health|weight) goal\b|\blose weight\b|\bgain muscle\b",
            re.IGNORECASE,
        ),
    ),
}

# Detection order: most specific patterns first so e.g. "bought a house" beats a generic match.
_ORDER = ("promotion", "new_child", "home_purchase", "degree_enrollment", "health_goal")


def detect(message: str) -> Optional[str]:
    """Which of the five life changes (if any) the message mentions. Deterministic, no write."""
    text = message or ""
    for key in _ORDER:
        if ACTIONS[key].trigger.search(text):
            return key
    return None


def proposal(key: str, message: str = "") -> Optional[dict[str, Any]]:
    """The impact preview + fields to collect — shown BEFORE any write. No write happens here."""
    a = ACTIONS.get(key)
    if not a:
        return None
    return {
        "action": a.key,
        "label": a.label,
        "message": a.confirm,
        "impact": list(a.impact),
        "fields": [{"key": f.key, "label": f.label, "type": f.type, "optional": f.optional} for f in a.fields],
        "domain": a.domain,
    }


async def apply(ingestion: Any, ctx: UserContext, key: str, fields: dict[str, Any],
                *, conversation_id: Optional[str] = None) -> dict[str, Any]:
    """APPROVED write step. Writes each non-empty fact via IngestionService.submit_life_fact ONLY.
    Returns what was written + the impacted areas + a plain-language summary. Idempotent (re-approving
    the same values is a no-op upsert). Never called except on explicit user approval."""
    a = ACTIONS.get(key)
    if not a:
        return {"ok": False, "code": "unknown_action", "errors": key}
    pairs = [(ft, val) for ft, val in a.facts(fields) if val]
    if not pairs:
        return {"ok": False, "code": "no_values", "errors": "nothing to write — provide at least one field"}
    written: list[dict[str, Any]] = []
    for fact_type, value in pairs:
        payload = {
            "fact_type": fact_type,
            "value": value,
            "domain": a.domain,
            "confidence": 1.0,
            "confirmation_status": "confirmed",  # the user explicitly approved this change
            "provenance": {
                "submitted_by": "arcana-action-loop",
                "source_type": "user_message",
                "conversation_id": conversation_id,
            },
            "idempotency_key": f"action:{a.key}:{fact_type}",
        }
        res = await ingestion.submit_life_fact(ctx, payload)
        written.append({"fact_type": fact_type, "value": value, "ok": bool(res.get("ok")), "id": res.get("id")})
    ok = all(w["ok"] for w in written)
    summary = (f"Updated your {a.label.lower()} — saved "
               + ", ".join(w["fact_type"].split(".")[-1].replace("_", " ") for w in written if w["ok"])
               + f". This refreshes: {', '.join(a.impact)}.") if ok else "Some updates couldn't be saved."
    return {"ok": ok, "action": a.key, "label": a.label, "written": written,
            "impact": list(a.impact), "domain": a.domain, "summary": summary,
            "refresh": ["dashboard", "readiness", "recommendations"]}
