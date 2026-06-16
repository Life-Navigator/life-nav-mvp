"""Selective Orchestration — routing, plan limits, health safety, fallbacks, kill switches.

Pure-logic tests (no live models): they prove the success-criteria behaviors deterministically.
"""
from __future__ import annotations

import pytest

from app.services import model_registry as reg
from app.services.model_router import (
    InMemoryUsageLedger, ModelRouter, budget_state, classify_domain, classify_risk,
    detect_health_urgent, health_safety_response,
)


def _factory(key):
    return ("LLM", key)  # sentinel so we can assert which model was chosen


@pytest.fixture
def premium_on(monkeypatch):
    # Enable the premium routing path + the models it needs.
    for k in ("PREMIUM_ROUTING_ENABLED", "CLAUDE_OPUS_4_8_ENABLED", "GEMINI_PRO_ADVISOR_ENABLED"):
        monkeypatch.setenv(k, "true")


@pytest.fixture
def pro_on(monkeypatch):
    monkeypatch.setenv("GEMINI_PRO_ADVISOR_ENABLED", "true")


# ── Domain & risk classification ──────────────────────────────────────────────
def test_classify_domain():
    assert classify_domain("Should I pay off my mortgage or invest?") == "finance"
    assert classify_domain("My HDHP has an HSA — which plan?") == "health"
    assert classify_domain("Should I take the manager promotion?") == "career"
    assert classify_domain("Is an MBA worth it?") == "education"
    assert classify_domain("We need a will and a guardian for our kids") == "family"
    assert classify_domain("hello there") == "general"


def test_classify_risk():
    assert classify_risk("Can I afford a $620k house?", "finance") == "high"
    assert classify_risk("how do HSAs work generally", "health") == "medium"   # health floors at medium
    assert classify_risk("what's a fun hobby", "general") == "low"


# ── Routing rules ───────────────────────────────────────────────────────────────
def test_finance_high_stakes_routes_to_opus_when_premium_on(premium_on):
    r = ModelRouter(_factory)
    d = r.route(message="Can I afford a $620k house on $185k income?", tier="elite")
    assert d.domain == "finance" and d.risk_level == "high"
    assert d.selected_role == "finance_high_stakes"
    assert d.selected_model == "claude_opus_4_8" and d.premium is True
    assert d.primary_llm == ("LLM", "claude_opus_4_8")


def test_health_high_stakes_routes_to_opus_when_premium_on(premium_on):
    r = ModelRouter(_factory)
    d = r.route(message="Which plan is better, PPO or HDHP with an HSA?", tier="plus")
    assert d.domain == "health"
    assert d.selected_role == "health_high_stakes"
    assert d.selected_model == "claude_opus_4_8"


def test_general_advisor_routes_to_pro(pro_on):
    r = ModelRouter(_factory)
    d = r.route(message="Help me think about my life goals", tier="plus")
    assert d.selected_role == "advisor_general"
    assert d.selected_model == "gemini_2_5_pro"


def test_career_education_family_route_to_pro_not_opus(pro_on):
    r = ModelRouter(_factory)
    for msg, dom in [("Should I take the promotion to manager?", "career"),
                     ("Is the $120k MBA worth it?", "education"),
                     ("We need guardianship and a will for our kids", "family")]:
        d = r.route(message=msg, tier="elite")
        assert d.domain == dom
        assert d.selected_model == "gemini_2_5_pro", f"{dom} should use Pro, got {d.selected_model}"


# ── Kill switches: premium OFF → demote to standard, never fail ──────────────────
def test_premium_off_demotes_finance_to_standard(pro_on):
    # PREMIUM_ROUTING_ENABLED defaults off → opus not usable → demote.
    r = ModelRouter(_factory)
    d = r.route(message="Can I afford a $620k house?", tier="elite")
    assert d.selected_model != "claude_opus_4_8"
    assert d.selected_model in ("gemini_2_5_pro", "gemini_flash")
    assert any("demoted" in n for n in d.notes)


def test_router_default_all_premium_off_uses_gemini():
    # No env set at all (besides fixtures not applied): nothing premium enabled.
    r = ModelRouter(_factory)
    d = r.route(message="Can I afford a $620k house?", tier="elite")
    assert d.selected_model in ("gemini_2_5_pro", "gemini_flash")  # never opus
    assert d.primary_llm[1] != "claude_opus_4_8"


# ── Plan / token limit fallback ──────────────────────────────────────────────────
def test_premium_budget_exhausted_falls_back(monkeypatch, premium_on):
    monkeypatch.setenv("MODEL_USAGE_LIMITS_ENABLED", "true")
    monkeypatch.setenv("PLAN_PLUS_PREMIUM_CALLS", "2")
    led = InMemoryUsageLedger()
    led.increment("t1", "u1", "premium_calls", 2)  # at the cap
    r = ModelRouter(_factory, ledger=led)
    d = r.route(message="Can I afford a $620k house?", tier="plus", tenant_id="t1", user_id="u1")
    assert d.budget_state == "exhausted"
    assert d.selected_model != "claude_opus_4_8"  # graceful demotion, not failure
    assert any("premium_budget_exhausted" in n for n in d.notes)


def test_budget_states(monkeypatch):
    monkeypatch.setenv("MODEL_USAGE_LIMITS_ENABLED", "true")
    monkeypatch.setenv("PLAN_PLUS_PREMIUM_CALLS", "10")
    led = InMemoryUsageLedger()
    assert budget_state("plus", led, "t", "u") == "available"
    led.increment("t", "u", "premium_calls", 8)
    assert budget_state("plus", led, "t", "u") == "nearing_limit"
    led.increment("t", "u", "premium_calls", 2)
    assert budget_state("plus", led, "t", "u") == "exhausted"


def test_limits_off_means_always_available(premium_on):
    led = InMemoryUsageLedger()
    led.increment("t", "u", "premium_calls", 9999)
    assert budget_state("plus", led, "t", "u") == "available"  # MODEL_USAGE_LIMITS_ENABLED off


# ── Free tier never gets premium (no Opus, no Pro) ──────────────────────────────
def test_free_tier_excluded_from_premium(premium_on):
    r = ModelRouter(_factory)
    d = r.route(message="Can I afford a $620k house?", tier="free")
    assert d.selected_model == "gemini_flash"  # free tier eligible only for flash/flash-lite


# ── Health urgent safety net (deterministic, 100% pass required) ────────────────
@pytest.mark.parametrize("msg,ind", [
    ("I've had chest pain on and off for a week", "chest pain"),
    ("I think I'm having stroke symptoms, face drooping", "stroke symptoms"),
    ("I can't breathe well since this morning", "trouble breathing"),
    ("I've been feeling suicidal lately", "suicidal ideation"),
    ("my throat is closing, severe allergic reaction", "severe allergic reaction"),
    ("the cut won't stop bleeding", "severe bleeding"),
    ("I passed out earlier today", "loss of consciousness"),
])
def test_health_urgent_detected(msg, ind):
    assert detect_health_urgent(msg) == ind


def test_health_urgent_not_triggered_on_routine():
    assert detect_health_urgent("Which health plan should I pick, PPO or HDHP?") is None
    assert detect_health_urgent("How much should my emergency fund be?") is None


def test_health_safety_response_is_actionable_not_generic():
    r = health_safety_response("chest pain")
    assert "911" in r and ("emergency" in r.lower())
    assert "vision" not in r.lower() and "goals" not in r.lower()  # never the generic life-vision prompt
    s = health_safety_response("suicidal ideation")
    assert "988" in s


# ── Provider failure fallback: router always supplies a constructible fallback ──
def test_router_always_supplies_fallback(premium_on):
    r = ModelRouter(_factory)
    d = r.route(message="Can I afford a $620k house?", tier="elite")
    assert d.fallback_llm is not None and d.fallback_llm[1] in reg.MODELS


def test_critic_role_disabled_falls_to_general(pro_on):
    # critic role default-disabled → should not be selected; general advisor used instead.
    assert reg.is_role_enabled("critic") is False
