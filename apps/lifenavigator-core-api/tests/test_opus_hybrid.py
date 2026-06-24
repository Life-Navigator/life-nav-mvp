"""Opus 4.8 hybrid routing — flag-gated finance/health → Claude, Gemini same-tier fallback."""
import pytest
from app.models.common import UserContext
from app.services.advisor_orchestrator import AdvisorOrchestrator


class _LLM:
    def __init__(self, name, out=None):
        self.model_name = name; self.provider = "x"; self._out = out
        self.last_usage = {}; self.last_raw = ""
    async def generate(self, ctx, plan): return self._out


def _orch(hybrid, gemini, domains=("finance", "health"), hs=True):
    return AdvisorOrchestrator(None, None, gemini, hybrid_claude=hybrid, claude_domains=set(domains),
                               claude_high_stakes_only=hs)


def _ctx(): return UserContext(user_id="u", email="t@e.com")


def test_finance_turn_routes_to_claude():
    claude, gem = _LLM("claude-opus-4-8"), _LLM("gemini-2.5-pro")
    tr = {"turn_id": "t"}
    primary, fb = _orch(claude, gem)._route(_ctx(), "Can I afford a $500k house on my income?", None, tr)
    assert primary is claude and fb is gem and tr["hybrid_route"]["to"] == "claude"


def test_health_turn_routes_to_claude():
    claude, gem = _LLM("claude-opus-4-8"), _LLM("gemini-2.5-pro")
    primary, fb = _orch(claude, gem)._route(_ctx(), "build me a workout and nutrition plan", None, {"turn_id": "t"})
    assert primary is claude and fb is gem


def test_offdomain_turn_stays_gemini():
    claude, gem = _LLM("claude-opus-4-8"), _LLM("gemini-2.5-pro")
    # an education-only message must NOT route to a finance/health Claude
    primary, fb = _orch(claude, gem)._route(_ctx(), "should I enroll in a master's degree program?", None, {"turn_id": "t"})
    assert primary is gem and fb is None


def test_no_hybrid_when_disabled():
    gem = _LLM("gemini-2.5-pro")
    primary, fb = AdvisorOrchestrator(None, None, gem)._route(_ctx(), "afford a $500k house?", None, {"turn_id": "t"})
    assert primary is gem and fb is None


def test_high_stakes_only_skips_ambiguous():
    claude, gem = _LLM("claude-opus-4-8"), _LLM("gemini-2.5-pro")
    # an ambiguous greeting → route_domains returns all domains → high_stakes_only blocks Claude
    primary, fb = _orch(claude, gem, hs=True)._route(_ctx(), "hello, tell me about life", None, {"turn_id": "t"})
    assert primary is gem
