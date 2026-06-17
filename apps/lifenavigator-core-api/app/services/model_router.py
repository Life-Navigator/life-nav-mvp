"""Capability Router (Selective Orchestration sprint).

Given a request's domain / intent / risk / user-tier / token budget, pick the best ROLE and resolve it to an
enabled model — with graceful, user-invisible fallback when a premium model is unavailable (kill switch off,
plan limit hit, provider error, timeout, or disabled). Also houses the DETERMINISTIC health-urgent safety
detector + response, which runs before any LLM and never depends on a model.

Everything here is pure logic over the registry + an injected LLM factory, so it is fully unit-testable with
fakes. The router NEVER raises into the request path.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from . import model_registry as reg

# ── Domain classification (keyword/topic heuristic; cheap + deterministic; refine via the classifier model
#    later). Maps to the registry roles. ──────────────────────────────────────────────────────────────────
_DOMAIN_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("health",    re.compile(r"\b(health|insurance|hsa|fsa|ppo|hdhp|medicare|medicaid|deductible|premium|prescription|doctor|hospital|medical|wellness|therapy|copay)\b", re.I)),
    ("finance",   re.compile(r"\b(invest|investment|retire|retirement|401k|ira|roth|debt|mortgage|loan|savings|emergency fund|net worth|portfolio|stock|tax|budget|cash flow|insurance|afford|down payment|inherit)\b", re.I)),
    ("career",    re.compile(r"\b(job|career|promotion|raise|salary|manager|layoff|offer|equity|sabbatical|resign|counteroffer|relocat)\b", re.I)),
    ("education",  re.compile(r"\b(mba|degree|college|tuition|student loan|bootcamp|certification|grad school|school)\b", re.I)),
    ("family",    re.compile(r"\b(kids?|child|children|baby|divorce|guardian|estate|will|beneficiary|spouse|marriage|parent|aging|custody)\b", re.I)),
]


def classify_domain(message: str, context: Any = None) -> str:
    """Return the dominant domain. Health is checked first (safety-sensitive); finance before the others
    because money terms co-occur widely. Falls back to context.domain_priorities, then 'general'."""
    text = str(message or "")
    for dom, pat in _DOMAIN_PATTERNS:
        if pat.search(text):
            return dom
    pri = getattr(context, "domain_priorities", None) or []
    if pri:
        d = str(pri[0]).lower()
        return d if d in ("health", "finance", "career", "education", "family") else "general"
    return "general"


# ── Risk classification ───────────────────────────────────────────────────────
_HIGH_STAKES = re.compile(
    r"\b(should i|can i afford|all my|life savings|everything|retire|bankrupt|foreclos|lawsuit|"
    r"\$\d[\d,]*k?|\d{4,})\b", re.I)


def classify_risk(message: str, domain: str) -> str:
    """LOW / MEDIUM / HIGH. Health & finance default at least MEDIUM; explicit high-stakes phrasing or large
    figures → HIGH. HIGH is what unlocks premium routing for finance/health."""
    text = str(message or "")
    high = bool(_HIGH_STAKES.search(text))
    if domain in ("finance", "health"):
        return "high" if high else "medium"
    return "high" if high else "low"


# ── Health urgent-care safety net (deterministic; runs before any LLM) ─────────
_URGENT = [
    ("chest pain",            re.compile(r"\bchest (pain|pressure|tightness)\b|\bpain in my chest\b", re.I)),
    ("stroke symptoms",       re.compile(r"\b(stroke|face drooping|slurred speech|sudden numbness|one side of (my|the) (face|body))\b", re.I)),
    ("trouble breathing",     re.compile(r"\b(can'?t breathe|trouble breathing|short(ness)? of breath|struggling to breathe)\b", re.I)),
    ("suicidal ideation",     re.compile(r"\b(suicidal|kill myself|end my life|don'?t want to (be alive|live)|harm myself)\b", re.I)),
    ("severe allergic reaction", re.compile(r"\b(anaphylax|throat closing|severe allergic|can'?t swallow)\b", re.I)),
    ("severe bleeding",       re.compile(r"\b(won'?t stop bleeding|severe bleeding|bleeding (heavily|a lot))\b", re.I)),
    ("loss of consciousness", re.compile(r"\b(passed out|fainted|unconscious|blacked out|loss of consciousness)\b", re.I)),
]


def detect_health_urgent(message: str) -> Optional[str]:
    """Return the matched urgent indicator, or None. Conservative on purpose."""
    text = str(message or "")
    for label, pat in _URGENT:
        if pat.search(text):
            return label
    return None


def health_safety_response(indicator: str) -> str:
    """Deterministic, model-free safety-first reply. NEVER a generic life-vision prompt."""
    if indicator == "suicidal ideation":
        return ("I'm really concerned about what you're describing, and I want you to be safe. I'm not able to "
                "provide crisis care, but help is available right now. If you're in the US, call or text **988** "
                "(Suicide & Crisis Lifeline) to reach a trained counselor any time. If you might act on these "
                "feelings or you're in immediate danger, please call **911** or go to the nearest emergency room. "
                "You don't have to handle this alone — please reach out to one of these now.")
    return (f"What you're describing ({indicator}) can be a sign of a serious medical emergency, and it isn't "
            "something to wait on or self-assess. **Please seek medical care now** — call **911** (or your local "
            "emergency number) or go to the nearest emergency room, especially since it's been recurring. If "
            "symptoms ease, still contact a doctor promptly. I can help with planning questions afterward, but "
            "your health comes first right now.")


# ── Usage ledger (interface + in-memory default; production = DB-backed, RLS-scoped) ──
class UsageLedger:
    """Interface. A production impl persists per (tenant_id, user_id, month) under RLS."""
    def get(self, tenant_id: str, user_id: str) -> dict[str, int]:  # noqa: ARG002
        return {}

    def increment(self, tenant_id: str, user_id: str, key: str, n: int = 1) -> None:  # noqa: ARG002
        ...


class InMemoryUsageLedger(UsageLedger):
    """Process-local ledger for tests/dev. Keys: premium_calls, standard_calls, reports, safety_fallbacks,
    model_fallbacks. Not durable — swap for a DB-backed impl in production (migration + RLS)."""
    def __init__(self) -> None:
        self._d: dict[tuple[str, str], dict[str, int]] = {}

    def get(self, tenant_id: str, user_id: str) -> dict[str, int]:
        return dict(self._d.get((tenant_id, user_id), {}))

    def increment(self, tenant_id: str, user_id: str, key: str, n: int = 1) -> None:
        self._d.setdefault((tenant_id, user_id), {})
        self._d[(tenant_id, user_id)][key] = self._d[(tenant_id, user_id)].get(key, 0) + n


def budget_state(tier: str, ledger: UsageLedger, tenant_id: str, user_id: str) -> str:
    """available | nearing_limit | exhausted. Honors MODEL_USAGE_LIMITS_ENABLED (off → always available)."""
    if not reg.flag("MODEL_USAGE_LIMITS_ENABLED"):
        return "available"
    cap = reg.plan_limits(tier).get("monthly_premium_model_calls")
    if cap is None:
        return "available"
    used = ledger.get(tenant_id, user_id).get("premium_calls", 0)
    if used >= cap:
        return "exhausted"
    if cap > 0 and used >= int(cap * 0.8):
        return "nearing_limit"
    return "available"


# ── Routing decision ──────────────────────────────────────────────────────────
@dataclass
class RoutingDecision:
    selected_role: str
    selected_model: str
    provider: str
    reason: str
    fallback: str
    risk_level: str
    domain: str
    plan_tier: str
    budget_state: str
    estimated_cost: float
    estimated_latency_ms: int
    primary_llm: Any = None         # AdvisorLLM instance (or None if not constructible)
    fallback_llm: Any = None
    premium: bool = False
    notes: list[str] = field(default_factory=list)

    def to_log(self) -> dict[str, Any]:
        return {
            "selected_role": self.selected_role, "selected_model": self.selected_model,
            "provider": self.provider, "reason": self.reason, "fallback": self.fallback,
            "risk_level": self.risk_level, "domain": self.domain, "plan_tier": self.plan_tier,
            "budget_state": self.budget_state, "estimated_cost": self.estimated_cost,
            "estimated_latency_ms": self.estimated_latency_ms, "premium": self.premium,
            "notes": self.notes,
        }


def _role_for(domain: str, risk: str) -> str:
    if domain == "finance":
        return "finance_high_stakes" if risk == "high" else "advisor_general"
    if domain == "health":
        return "health_high_stakes" if risk in ("high", "medium") else "advisor_general"
    if domain in ("career", "education", "family"):
        return domain
    return "advisor_general"


class ModelRouter:
    """Resolves a request to an enabled model + fallback, honoring kill switches, tier eligibility, and budget.
    llm_factory(model_key) returns an AdvisorLLM instance or None (e.g. creds missing)."""

    def __init__(self, llm_factory: Callable[[str], Any], ledger: Optional[UsageLedger] = None) -> None:
        self._factory = llm_factory
        self._ledger = ledger or InMemoryUsageLedger()

    @property
    def ledger(self) -> UsageLedger:
        return self._ledger

    def _resolve(self, model_key: str, tier: str) -> Optional[str]:
        """Return model_key if usable (exists, enabled, tier-eligible), else None."""
        m = reg.MODELS.get(model_key)
        if not m or not reg.model_enabled(model_key):
            return None
        if tier and tier.lower() not in (m.get("tiers") or []):
            return None
        return model_key

    def route(self, *, message: str, domain: Optional[str] = None, risk: Optional[str] = None,
              tier: str = "free", tenant_id: str = "", user_id: str = "", context: Any = None) -> RoutingDecision:
        dom = domain or classify_domain(message, context)
        rsk = risk or classify_risk(message, dom)
        role = _role_for(dom, rsk)
        if not reg.is_role_enabled(role):              # e.g. critic disabled → general advisor
            role = "advisor_general"
        spec = reg.ROLES.get(role, reg.ROLES["advisor_general"])
        primary_key, fallback_key = spec["primary"], spec["fallback"]
        notes: list[str] = []

        bstate = budget_state(tier, self._ledger, tenant_id, user_id)
        # Demote premium → fallback when: premium kill-switch/model off, tier ineligible, or budget exhausted.
        chosen = self._resolve(primary_key, tier)
        if chosen and reg.is_premium(primary_key) and bstate == "exhausted":
            chosen, notes = None, notes + ["premium_budget_exhausted"]
        if chosen is None and primary_key != fallback_key:
            demoted = self._resolve(fallback_key, tier) or self._resolve("gemini_flash", tier) or "gemini_flash"
            notes.append(f"demoted_{primary_key}_to_{demoted}")
            primary_used, fb_used = demoted, "gemini_flash"
        else:
            primary_used = chosen or self._resolve(fallback_key, tier) or "gemini_flash"
            fb_used = self._resolve(fallback_key, tier) or "gemini_flash"
            if chosen is None:
                notes.append(f"primary_{primary_key}_unavailable_used_{primary_used}")

        m = reg.MODELS.get(primary_used, reg.MODELS["gemini_flash"])
        reason = (f"domain={dom}, risk={rsk}, role={role} → {primary_used}"
                  + (f" ({', '.join(notes)})" if notes else ""))
        return RoutingDecision(
            selected_role=role, selected_model=primary_used, provider=m["provider"], reason=reason,
            fallback=fb_used, risk_level=rsk, domain=dom, plan_tier=tier, budget_state=bstate,
            estimated_cost=m["cost_estimate"], estimated_latency_ms=m["latency_budget_ms"],
            primary_llm=self._factory(primary_used), fallback_llm=self._factory(fb_used),
            premium=reg.is_premium(primary_used), notes=notes,
        )

    def record_usage(self, decision: RoutingDecision, tenant_id: str, user_id: str, *, fell_back: bool = False) -> None:
        key = "premium_calls" if decision.premium else "standard_calls"
        self._ledger.increment(tenant_id, user_id, key)
        if fell_back:
            self._ledger.increment(tenant_id, user_id, "model_fallbacks")
