"""Advisor Action Loop — SIX explicit, approval-gated actions (five life-changes + set-a-goal).

The contract (no exceptions):
  detect(message) -> which action the user mentioned (deterministic, no LLM, no write)
  proposal(key)   -> the impact areas + the fields to collect (shown BEFORE any write, no write)
  apply(...)      -> writes ONLY after the user approves, ONLY through IngestionService
                     (the same tenant-scoped, provenance-stamped, idempotent MCP write path). Life-change
                     actions write life.facts; the `set_goal` action writes a TRACKED goal (life.candidate_goals
                     + finance.financial_planning_goals for finance) so goal-setting persists AND advances
                     discovery coverage — no more "set a goal and nothing happens".

This is NOT a generic framework, NOT an autonomous agent, NOT a workflow engine. It is hand-built actions.
Arcana proposes; the user approves; the system writes; the reads (readiness/recommendations/dashboard/
coverage) recompute on next load. Nothing is ever written silently.
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
    # optional builder: collected fields -> list of TRACKED-GOAL dicts to persist on approval.
    # Each dict: {title, domain, target_amount, target_date, toward}. Used by the set_goal action.
    goals: Optional[Callable[[dict[str, Any]], list[dict[str, Any]]]] = None


def _v(fields: dict[str, Any], k: str) -> str:
    return str(fields.get(k) or "").strip()


def _num(v: Any) -> Optional[float]:
    """Coerce a currency-ish field ('$25,000', '25000') to a float; None if empty/invalid."""
    try:
        if v is None or isinstance(v, bool):
            return None
        s = str(v).replace(",", "").replace("$", "").strip()
        return float(s) if s else None
    except (TypeError, ValueError):
        return None


def _slug(s: str, cap: int = 48) -> str:
    return re.sub(r"[^a-z0-9]+", "_", (s or "").strip().lower()).strip("_")[:cap] or "goal"


# Goal domains must be valid IngestionService Domain enum values.
_VALID_GOAL_DOMAINS = {"finance", "career", "health", "education", "family", "core"}
_DOMAIN_ALIASES = {
    "money": "finance", "financial": "finance", "finances": "finance",
    "job": "career", "work": "career", "profession": "career",
    "fitness": "health", "wellness": "health", "fit": "health",
    "school": "education", "learning": "education", "degree": "education",
    "relationship": "family", "relationships": "family", "home": "family",
}


def _norm_domain(v: str) -> str:
    d = re.sub(r"[^a-z]", "", (v or "").strip().lower())
    if d in _VALID_GOAL_DOMAINS:
        return d
    return _DOMAIN_ALIASES.get(d, "core")


def infer_goal_domain(message: str) -> str:
    """Best-effort domain from a goal-setting message, so the card prefills the right life area."""
    t = (message or "").lower()
    for kw, dom in (
        ("emergency fund", "finance"), ("net worth", "finance"), ("save", "finance"), ("debt", "finance"),
        ("retire", "finance"), ("invest", "finance"), ("budget", "finance"), ("down payment", "finance"),
        ("promot", "career"), ("salary", "career"), ("raise", "career"), ("career", "career"), ("job", "career"),
        ("weight", "health"), ("fitness", "health"), ("workout", "health"), ("muscle", "health"), ("health", "health"),
        ("degree", "education"), ("course", "education"), ("certif", "education"), ("school", "education"),
        ("education", "education"), ("wedding", "family"), ("child", "family"), ("family", "family"),
    ):
        if kw in t:
            return dom
    return "core"


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
            # Comp is optional — a user can save the promotion goal (the title) before they know the numbers.
            # This is what made the action card's submit button "dead": salary was required + never prefilled.
            Field("salary", "New base salary", "number", optional=True),
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
    "set_goal": Action(
        key="set_goal",
        label="Short-term goal",
        confirm="Great — let's turn that into a tracked goal. I'll save it as a short-term target so it "
        "shows up on your dashboard, ladders toward your bigger goals, and moves your discovery forward. "
        "Want me to set it?",
        domain="core",  # the real domain comes from the (inferred, editable) "area" field
        impact=("Tracked goals", "Discovery coverage", "Dashboard"),
        fields=(
            Field("goal", "Your goal / target"),
            Field("area", "Life area (finance, career, health, education, family)"),
            Field("target_amount", "Target amount ($)", "number", optional=True),
            Field("target_date", "Target date", optional=True),
            Field("toward", "Works toward (bigger goal)", optional=True),
        ),
        facts=lambda f: [],  # set_goal persists a tracked goal (below), not a life.fact
        goals=lambda f: (
            [{
                "title": _v(f, "goal"),
                "domain": _norm_domain(_v(f, "area")),
                "target_amount": _v(f, "target_amount"),
                "target_date": _v(f, "target_date"),
                "toward": _v(f, "toward"),
            }]
            if _v(f, "goal") else []
        ),
        trigger=re.compile(
            r"\bset (a |an |my |up )?(short[- ]?term )?(goal|target)\b|\bshort[- ]?term goal\b|\bmilestone\b|"
            r"\bsavings? target\b|\bemergency fund\b|\bsave (up )?for\b|\bset an? target\b|\bgoal:\s|\btrack (a|this) goal\b",
            re.IGNORECASE,
        ),
    ),
}

# Detection order: most specific life-changes first (so "bought a house" beats a generic match); the
# generic goal-setter is LAST so it only fires when no concrete life-change matched.
_ORDER = ("promotion", "new_child", "home_purchase", "degree_enrollment", "health_goal", "set_goal")


def detect(message: str) -> Optional[str]:
    """Which of the five life changes (if any) the message mentions. Deterministic, no write."""
    text = message or ""
    for key in _ORDER:
        if ACTIONS[key].trigger.search(text):
            return key
    return None


# Pull the target title out of the triggering message so the action card PREFILLS it (the user shouldn't
# retype "Principal Architect"). E.g. "The next promotion is Principal Architect." → "Principal Architect".
_TITLE_PATS = (
    re.compile(r"promotion is\s+(?:a\s+|an\s+|to\s+)?([A-Z][A-Za-z0-9/&+.\- ]{2,40})"),
    re.compile(r"promoted to\s+(?:a\s+|an\s+)?([A-Z][A-Za-z0-9/&+.\- ]{2,40})"),
    re.compile(r"next (?:role|title|position) is\s+(?:a\s+|an\s+)?([A-Z][A-Za-z0-9/&+.\- ]{2,40})"),
    re.compile(r"become (?:a\s+|an\s+|the\s+)?([A-Z][A-Za-z0-9/&+.\- ]{2,40})"),
)


def _prefill(key: str, message: str) -> dict[str, str]:
    pre: dict[str, str] = {}
    if key == "promotion" and message:
        for pat in _TITLE_PATS:
            m = pat.search(message)
            if m:
                title = re.split(r"[.,;:!?]", m.group(1))[0]  # stop at sentence punctuation
                title = re.split(r"\s+\b(?:that|which|and|so|because|since|would|will)\b", title, flags=re.I)[0]
                title = title.strip()
                if 2 < len(title) <= 40:
                    pre["title"] = title
                break
    if key == "set_goal" and message:
        # Prefill the life area from the message so the user rarely has to pick it.
        pre["area"] = infer_goal_domain(message)
    return pre


async def _write_finance_planning_goal(sb: Any, ctx: UserContext, title: str, amount: Optional[float],
                                       target_date: Optional[str], conversation_id: Optional[str]) -> bool:
    """Persist a finance short-term target to finance.financial_planning_goals (grounds the finance domain).
    Reuses fact_domain_sync's deterministic id scheme so it dedupes with passive chat capture. Fail-soft."""
    from . import fact_domain_sync  # local import avoids a cycle
    goal_type = _slug(title)
    td = (target_date or "").strip()
    iso = td if re.match(r"^\d{4}-\d{2}-\d{2}", td) else None
    row = {
        "id": fact_domain_sync._det_id(ctx.user_id, f"finplan:{goal_type}"),
        "user_id": ctx.user_id, "goal_type": goal_type, "label": title[:80],
        "target_amount": amount, "target_date": iso, "timeline": (None if iso else (td or None)),
        "status": "active", "source": "advisor_action:set_goal", "confidence": 1.0, "linked_domains": [],
    }
    try:
        res = await sb.upsert("financial_planning_goals", row, schema="finance", on_conflict="id")
        return bool(res)
    except Exception:  # noqa: BLE001 — missing table (unapplied migration) must not break the whole apply
        return False


def proposal(key: str, message: str = "") -> Optional[dict[str, Any]]:
    """The impact preview + fields to collect (+ any prefill) — shown BEFORE any write. No write happens here."""
    a = ACTIONS.get(key)
    if not a:
        return None
    return {
        "action": a.key,
        "label": a.label,
        "message": a.confirm,
        "impact": list(a.impact),
        "fields": [{"key": f.key, "label": f.label, "type": f.type, "optional": f.optional} for f in a.fields],
        "prefill": _prefill(key, message),
        "domain": a.domain,
    }


async def apply(ingestion: Any, ctx: UserContext, key: str, fields: dict[str, Any],
                *, conversation_id: Optional[str] = None, supabase: Any = None) -> dict[str, Any]:
    """APPROVED write step. Life-change actions write facts via IngestionService.submit_life_fact; the
    set_goal action persists a TRACKED goal (life.candidate_goals + finance.financial_planning_goals for
    finance) so goal-setting actually advances discovery coverage. Idempotent (re-approving the same values
    is a no-op upsert). Never called except on explicit user approval."""
    a = ACTIONS.get(key)
    if not a:
        return {"ok": False, "code": "unknown_action", "errors": key}

    # 1) Facts (the five life-change actions).
    written: list[dict[str, Any]] = []
    for fact_type, value in a.facts(fields):
        if not value:
            continue
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

    # 2) Tracked goals (the set_goal action). candidate_goals is the signal discovery coverage reads;
    #    finance targets ALSO land in finance.financial_planning_goals.
    goals: list[dict[str, Any]] = []
    for g in (a.goals(fields) if a.goals else []):
        title = str(g.get("title") or "").strip()
        if not title:
            continue
        domain = _norm_domain(str(g.get("domain") or a.domain))
        target_date = str(g.get("target_date") or "").strip() or None
        gres = await ingestion.submit_goal(ctx, {
            "goal_title": title, "domain": domain,
            "timeframe": target_date, "priority": "short_term",
            "confidence": 1.0, "confirmation_status": "confirmed",
            "supporting_quote": (str(g.get("toward") or "").strip() or None),
            "provenance": {"submitted_by": "arcana-action-loop", "source_type": "user_message",
                           "conversation_id": conversation_id},
            "idempotency_key": f"goal:{_slug(title)}",
        })
        entry = {"goal": title, "domain": domain, "table": "life.candidate_goals",
                 "ok": bool(gres.get("ok")), "id": gres.get("id"),
                 "toward": (str(g.get("toward") or "").strip() or None)}
        # Finance targets are also grounded in finance.financial_planning_goals.
        if domain == "finance" and supabase is not None:
            fok = await _write_finance_planning_goal(
                supabase, ctx, title, _num(g.get("target_amount")), target_date, conversation_id)
            entry["finance_planning_ok"] = fok
        goals.append(entry)

    if not written and not goals:
        return {"ok": False, "code": "no_values", "errors": "nothing to write — provide at least one field"}

    ok = all(w["ok"] for w in written) and all(g["ok"] for g in goals)
    if goals:
        names = "; ".join(sorted({g["goal"] for g in goals if g["ok"]}))
        summary = (f"Saved your goal: {names}. It's now tracked on your dashboard and moves your "
                   f"{goals[0]['domain']} discovery forward." if ok
                   else "I couldn't save that goal — please try again.")
    else:
        summary = (f"Updated your {a.label.lower()} — saved "
                   + ", ".join(w["fact_type"].split(".")[-1].replace("_", " ") for w in written if w["ok"])
                   + f". This refreshes: {', '.join(a.impact)}.") if ok else "Some updates couldn't be saved."
    return {"ok": ok, "action": a.key, "label": a.label, "written": written, "goals": goals,
            "impact": list(a.impact), "domain": (goals[0]["domain"] if goals else a.domain),
            "summary": summary, "refresh": ["dashboard", "readiness", "recommendations", "coverage"]}
