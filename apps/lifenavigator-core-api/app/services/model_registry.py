"""Model Registry (Selective Orchestration sprint).

Single source of truth mapping ROLES → models, with per-model metadata, kill switches, and plan limits.
Business logic must reference ROLES (e.g. "finance_high_stakes"), never raw model names. All values are
overridable via environment so commercial limits / enablement can change without code edits.

Default-safe: every premium route is gated by a kill switch that defaults OFF, and the router itself defaults
OFF — so with no env set, production keeps its existing single-model path. Evidence for the routing choices
lives in docs/model-routing/ and docs/advisor-benchmark/.
"""
from __future__ import annotations

import os
from typing import Any, Optional

# ── Kill switches (env, safe defaults) ───────────────────────────────────────
# Router OFF by default → orchestrator uses its existing single LLM (no behaviour change).
_DEFAULTS = {
    "MODEL_ROUTER_ENABLED": "false",
    "PREMIUM_ROUTING_ENABLED": "false",
    "CLAUDE_OPUS_4_8_ENABLED": "false",
    "GEMINI_PRO_ADVISOR_ENABLED": "false",
    "HEALTH_SAFETY_FALLBACK_ENABLED": "true",   # deterministic, no LLM — safe to keep ON always
    "MODEL_USAGE_LIMITS_ENABLED": "false",
    "USAGE_TRACKING_ENABLED": "false",          # write per-turn usage to analytics.model_usage (needs migration)
}


def flag(name: str) -> bool:
    return os.environ.get(name, _DEFAULTS.get(name, "false")).lower() in ("1", "true", "yes", "on")


# ── Model metadata ────────────────────────────────────────────────────────────
# benchmark_score/trust_score are the measured in-pipeline numbers (see docs/model-routing/). cost_estimate is
# $/turn from public list pricing (~3.5k in / 0.7k out) — an estimate, not metered. latency_budget_ms = the
# measured p50 we expect. tiers = which plan tiers may use this model.
MODELS: dict[str, dict[str, Any]] = {
    "gemini_flash_lite": {
        "provider": "google_aistudio", "model_id": "gemini-2.5-flash-lite",
        "enabled_flag": None, "max_tokens": 2048, "timeout_s": 30, "cost_estimate": 0.001,
        "latency_budget_ms": 8000, "tiers": ["free", "plus", "premium", "enterprise"],
        "benchmark_score": None, "trust_score": None, "last_evaluated": "untested",
    },
    "gemini_flash": {
        "provider": "google_aistudio", "model_id": "gemini-2.5-flash",
        "enabled_flag": None, "max_tokens": 2048, "timeout_s": 30, "cost_estimate": 0.003,
        "latency_budget_ms": 13000, "tiers": ["free", "plus", "premium", "enterprise"],
        "benchmark_score": 6.66, "trust_score": 8.5, "last_evaluated": "2026-06-16",
    },
    "gemini_2_5_pro": {
        "provider": "google_aistudio", "model_id": "gemini-2.5-pro",
        "enabled_flag": "GEMINI_PRO_ADVISOR_ENABLED", "max_tokens": 2048, "timeout_s": 45,
        "cost_estimate": 0.011, "latency_budget_ms": 27000, "tiers": ["plus", "premium", "enterprise"],
        "benchmark_score": 7.60, "trust_score": 8.7, "last_evaluated": "2026-06-16",
    },
    "claude_opus_4_8": {
        "provider": "vertex_anthropic", "model_id": "claude-opus-4-8",
        "enabled_flag": "CLAUDE_OPUS_4_8_ENABLED", "max_tokens": 2048, "timeout_s": 90,
        "cost_estimate": 0.15, "latency_budget_ms": 26000, "tiers": ["premium", "enterprise"],
        "benchmark_score": 8.84, "trust_score": 9.3, "last_evaluated": "2026-06-16",
        "premium": True,  # counts against premium allowance
    },
    # NOTE: claude_opus_4_7 deliberately absent — benchmark showed it unreliable (timeouts). Do not add.
    "health_safety_fallback": {
        "provider": "deterministic", "model_id": "n/a", "enabled_flag": None,
        "max_tokens": 0, "timeout_s": 0, "cost_estimate": 0.0, "latency_budget_ms": 0,
        "tiers": ["free", "plus", "elite"], "benchmark_score": None, "trust_score": 10.0,
        "last_evaluated": "2026-06-16",
    },
}

# ── Role → model (primary + fallback). Reference ROLES in code, never model names. ──
ROLES: dict[str, dict[str, str]] = {
    "classification":      {"primary": "gemini_flash_lite", "fallback": "gemini_flash"},
    "advisor_general":     {"primary": "gemini_2_5_pro",    "fallback": "gemini_flash"},
    "finance_high_stakes": {"primary": "claude_opus_4_8",   "fallback": "gemini_2_5_pro"},
    "health_high_stakes":  {"primary": "claude_opus_4_8",   "fallback": "gemini_2_5_pro"},
    "career":              {"primary": "gemini_2_5_pro",    "fallback": "gemini_flash"},
    "education":           {"primary": "gemini_2_5_pro",    "fallback": "gemini_flash"},
    "family":              {"primary": "gemini_2_5_pro",    "fallback": "gemini_flash"},
    "report_writer":       {"primary": "claude_opus_4_8",   "fallback": "gemini_2_5_pro"},
    "executive_review":    {"primary": "claude_opus_4_8",   "fallback": "gemini_2_5_pro"},
    # Critic role defined but DISABLED (benchmark pending) — see is_role_enabled / docs.
    "critic":              {"primary": "claude_opus_4_8",   "fallback": "gemini_2_5_pro"},
}

_ROLE_ENABLED_DEFAULT = {r: "true" for r in ROLES}
_ROLE_ENABLED_DEFAULT["critic"] = "false"  # benchmark pending — keep off until it earns it


def is_role_enabled(role: str) -> bool:
    return os.environ.get(f"ROLE_{role.upper()}_ENABLED", _ROLE_ENABLED_DEFAULT.get(role, "true")).lower() \
        in ("1", "true", "yes", "on")


def model_enabled(model_id_key: str) -> bool:
    """A model is usable iff it exists, its kill-switch flag (if any) is on, and (for premium) premium routing
    is on. Models with no flag (Flash/Flash-Lite/deterministic) are always available."""
    m = MODELS.get(model_id_key)
    if not m:
        return False
    if m.get("premium") and not flag("PREMIUM_ROUTING_ENABLED"):
        return False
    fl = m.get("enabled_flag")
    return True if fl is None else flag(fl)


def is_premium(model_id_key: str) -> bool:
    return bool(MODELS.get(model_id_key, {}).get("premium"))


# ── Plan limits (placeholders — set real commercial values via env/DB, never hardcode finals) ──
def _int_env(name: str, default: Optional[int]) -> Optional[int]:
    v = os.environ.get(name)
    if v is None:
        return default
    try:
        return int(v)
    except ValueError:
        return default


def plan_limits(tier: str) -> dict[str, Optional[int]]:
    """Per-tier monthly limits. None = unlimited/unset placeholder (commercial values TBD; configurable)."""
    t = (tier or "free").lower()
    prefix = f"PLAN_{t.upper()}"
    # Defaults are conservative placeholders; free gets 0 premium so it never routes to Opus by default.
    base = {
        "free":       {"premium": 0,    "standard": None, "reports": 0},
        "plus":       {"premium": 50,   "standard": None, "reports": 10},
        "premium":    {"premium": 500,  "standard": None, "reports": 100},
        "enterprise": {"premium": 5000, "standard": None, "reports": 1000},
    }.get(t, {"premium": 0, "standard": None, "reports": 0})
    return {
        "monthly_premium_model_calls": _int_env(f"{prefix}_PREMIUM_CALLS", base["premium"]),
        "monthly_standard_model_calls": _int_env(f"{prefix}_STANDARD_CALLS", base["standard"]),
        "max_report_generations": _int_env(f"{prefix}_REPORTS", base["reports"]),
    }
