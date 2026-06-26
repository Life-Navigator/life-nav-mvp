"""Hybrid Advisor Intelligence Layer — rules guide, the LLM leads, the validator gates.

These tests prove the trust contract WITHOUT a live LLM:
  * the context builder classifies facts and exposes discovery scores + the allowed-number guard,
  * the constraint envelope never scripts the question (no ask/confirm/clarify mode) and forbids persistence,
  * the validator rejects invented numbers / advice / medical-legal overreach and forces should_persist=False,
  * the orchestrator always returns the deterministic result and only *replaces the text* on a valid LLM turn,
    falling back cleanly on None / invalid / error,
  * the 6 sprint scenarios behave correctly with a deterministic fake LLM.
"""
from __future__ import annotations

from typing import Any, Optional

import pytest

from app.models.common import UserContext
from app.services.advisor_context import AdvisorContext, AdvisorContextBuilder, numbers_in
from app.services.advisor_llm import AdvisorLLM, NullAdvisorLLM, TEMPERATURE, parse_advisor_json
from app.services.advisor_orchestrator import (
    AdvisorOrchestrator,
    build_constraints,
    _compose,
    discovery_contract_violations,
)
from app.services.advisor_validator import validate


# --------------------------------------------------------------------------- #
# Test doubles
# --------------------------------------------------------------------------- #
def _ctx() -> UserContext:
    return UserContext(user_id="u-test", email="t@example.com")


class FakeSupabase:
    """Returns no rejected goals by default (override `rejected` for the goal-correction case)."""

    def __init__(self, rejected: Optional[list[dict[str, Any]]] = None) -> None:
        self._rejected = rejected or []

    async def select(self, table: str, **kwargs: Any) -> list[dict[str, Any]]:
        if table == "rejected_goals":
            return self._rejected
        return []


class FakeCoverage:
    def __init__(self, domains: Optional[list[dict[str, Any]]] = None) -> None:
        self._domains = domains if domains is not None else [
            {"domain": "retirement", "label": "Retirement", "coverage_pct": 72, "status": "partial", "missing_inputs": ["target age"]},
            {"domain": "home", "label": "Home", "coverage_pct": 41, "status": "partial", "missing_inputs": ["price", "down payment"]},
            {"domain": "estate", "label": "Estate", "coverage_pct": 18, "status": "started", "missing_inputs": ["will"]},
        ]

    async def coverage(self, ctx: UserContext) -> dict[str, Any]:
        return {"domains": self._domains, "overall_coverage_pct": 44}


class FakeRM:
    """Stand-in for the deterministic RelationshipManager — returns a fixed `base` and records the call."""

    def __init__(self, base: dict[str, Any]) -> None:
        self._base = base
        self.calls: list[tuple[Any, str, Any]] = []

    async def converse(self, ctx: UserContext, message: str, pending_key: Any = None,
                       *, focus_domains: Any = None) -> dict[str, Any]:
        self.calls.append((ctx, message, pending_key))
        self.last_focus_domains = focus_domains  # so tests can assert the orchestrator scopes the panel
        return dict(self._base)


class FakeLLM:
    """Returns a fixed dict (or None) so orchestrator behaviour is deterministic."""

    def __init__(self, out: Optional[dict[str, Any]]) -> None:
        self._out = out

    async def generate(self, context: Any, plan: dict[str, Any]) -> Optional[dict[str, Any]]:
        return self._out


class RaisingLLM:
    async def generate(self, context: Any, plan: dict[str, Any]) -> Optional[dict[str, Any]]:
        raise RuntimeError("model exploded")


def _base(
    *,
    assistant: str = "Rule-based: tell me about your vision.",
    complete: bool = False,
    candidate_goals: Optional[list[dict[str, Any]]] = None,
    panel: Optional[dict[str, Any]] = None,
    pending_key: Optional[str] = "vision",
) -> dict[str, Any]:
    return {
        "assistant_message": assistant,
        "complete": complete,
        "pending_key": pending_key,
        "candidate_goals": candidate_goals or [],
        "context_panel": panel or {
            "life_vision": "retire early and help my kids through college",
            "primary_objective": "financial independence",
            "domains_touched": ["retirement", "education"],
            "missing_areas": ["home", "estate"],
            "top_risks": [], "top_opportunities": [], "top_constraints": [],
            "discovery_completion_pct": 40,
        },
    }


def _good_llm(**over: Any) -> dict[str, Any]:
    out = {
        "reflection": "You want to retire early while helping your kids through college.",
        "next_question": "If resources got tight, which of those would you protect first?",
        "why_this_question": "Knowing the priority shapes every tradeoff we model later.",
        "summary": "",
        "confirmed_facts": [{"label": "vision", "value": "retire early", "source": "user_message"}],
        "candidate_facts": [],
        "assumptions": [],
        "candidate_goals": [],
        "missing_data": [{"field": "risk_tolerance", "why_it_matters": "drives the plan"}],
        "warnings": [],
        "should_persist": False,
    }
    out.update(over)
    return out


async def _build_ctx(message: str, base: dict[str, Any], *, rejected=None, coverage=None) -> AdvisorContext:
    builder = AdvisorContextBuilder(FakeSupabase(rejected=rejected), coverage=coverage or FakeCoverage())
    return await builder.build(_ctx(), message, base)


# --------------------------------------------------------------------------- #
# numbers_in / allowed-number guard
# --------------------------------------------------------------------------- #
def test_numbers_in_normalises_currency_and_percent():
    got = numbers_in("I make $120,000 and want 15% saved", "house is 450000")
    assert "120000" in got and "15" in got and "450000" in got


# --------------------------------------------------------------------------- #
# Context builder — fact classification + discovery scores + priorities
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_context_classifies_confirmed_facts_and_scores():
    ctx = await _build_ctx("we want to retire at 60", _base())
    labels = {f["label"] for f in ctx.confirmed_facts}
    assert "life_vision" in labels and "primary_objective" in labels  # known truths, not candidates
    assert ctx.assumptions == []  # the deterministic engine never assumes
    # discovery scores come straight from the coverage service, lowest-coverage domain first
    assert [d["domain"] for d in ctx.discovery_scores] == ["retirement", "home", "estate"]
    assert ctx.domain_priorities[0] == "estate"  # 18% — highest leverage next question


@pytest.mark.asyncio
async def test_context_prompt_dict_keeps_categories_separate():
    ctx = await _build_ctx("retire at 60", _base())
    d = ctx.prompt_dict()
    for key in ("confirmed_facts", "candidate_facts", "assumptions", "areas_missing_data",
                "discovery_scores_by_domain", "domain_priorities_lowest_coverage_first", "safety_constraints"):
        assert key in d
    assert d["candidate_facts"] == []  # deterministic engine asserts none; the LLM may propose


@pytest.mark.asyncio
async def test_context_allowed_numbers_from_message():
    ctx = await _build_ctx("I have $50,000 saved", _base())
    assert "50000" in ctx.allowed_numbers


# --------------------------------------------------------------------------- #
# Constraint envelope — guardrails, never a script
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_constraints_do_not_script_the_question():
    ctx = await _build_ctx("retire at 60", _base())
    c = build_constraints(_base(), ctx)
    # The envelope provides constraints/permissions — NOT an ask/confirm/clarify "mode".
    assert "mode" not in c
    assert c["intent"] == "discovery"
    assert c["max_questions"] == 1
    assert c["persistence_allowed"] is False
    assert c["must_classify_facts"] is True
    assert "specific product recommendations" in c["disallowed_topics"]


@pytest.mark.asyncio
async def test_constraints_intent_is_summary_when_complete():
    base = _base(complete=True)
    ctx = await _build_ctx("that's everything", base)
    c = build_constraints(base, ctx)
    assert c["intent"] == "summary" and c["may_summarise"] is True


def test_temperature_table_is_low_and_grounded():
    assert TEMPERATURE["discovery"] == 0.40
    assert TEMPERATURE["goal_extraction"] == 0.10
    assert TEMPERATURE["structured"] == 0.00


# --------------------------------------------------------------------------- #
# Validator — the trust gate
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_validator_accepts_clean_output_and_forces_no_persist():
    ctx = await _build_ctx("retire at 60", _base())
    ok, safe, reasons = validate(_good_llm(should_persist=True), ctx)
    assert ok and not reasons
    assert safe["should_persist"] is False  # the LLM can never flip this on


@pytest.mark.asyncio
async def test_validator_rejects_invented_financial_number():
    ctx = await _build_ctx("I want to buy a house", _base())  # no numbers in context
    ok, _, reasons = validate(_good_llm(next_question="Can you afford the $450,000 home?"), ctx)
    assert not ok and any("invented numbers" in r for r in reasons)


@pytest.mark.asyncio
async def test_validator_allows_number_present_in_context():
    ctx = await _build_ctx("the house is $450,000", _base())  # 450000 now allowed
    ok, _, reasons = validate(_good_llm(reflection="You're looking at the $450,000 home."), ctx)
    assert ok, reasons


@pytest.mark.asyncio
async def test_validator_allows_grounded_strategic_advice():
    # V4 (signed-off relaxation): a grounded strategic / personal-finance recommendation is now ALLOWED.
    ctx = await _build_ctx("pay debt or invest", _base())
    out = _good_llm(recommendation="Given your situation, prioritizing the high-interest debt before "
                    "investing makes sense, since that return is hard to beat; this can shift once we know "
                    "your employer match.")
    ok, _, reasons = validate(out, ctx)
    assert ok and not reasons


@pytest.mark.asyncio
async def test_validator_rejects_medical_advice():
    ctx = await _build_ctx("I have chest pain", _base())
    ok, _, reasons = validate(_good_llm(reflection="I diagnose you with a heart condition."), ctx)
    assert not ok


@pytest.mark.asyncio
async def test_validator_repairs_multiple_questions_instead_of_rejecting():
    # P0.3: a multi-question turn is REPAIRED (trimmed to the first question) and ACCEPTED, not rejected.
    # This is the fix for the 17% fallback rate (all "more than one question").
    ctx = await _build_ctx("retire at 60", _base())
    ok, safe, reasons = validate(_good_llm(next_question="What is your income? And your age?"), ctx)
    assert ok and not reasons
    assert safe["next_question"] == "What is your income?"  # trimmed to the first question
    assert "multi_question_trimmed" in safe.get("_repairs", [])


@pytest.mark.asyncio
async def test_validator_keeps_single_choice_question_untouched():
    # A single question offering choices has ONE "?" — it must pass unchanged (no spurious repair).
    ctx = await _build_ctx("buy a home", _base())
    q = "What matters most: buying sooner, preserving liquidity, or maximizing long-term wealth?"
    ok, safe, reasons = validate(_good_llm(next_question=q), ctx)
    assert ok and not reasons
    assert safe["next_question"] == q
    assert "multi_question_trimmed" not in safe.get("_repairs", [])


@pytest.mark.asyncio
async def test_validator_allows_reflecting_users_own_should_question():
    # The advisor reflecting the user's own "how much should I put down" is NOT advice (false-positive fix).
    ctx = await _build_ctx("How much should I put down on a house?", _base())
    out = _good_llm(reflection="You're looking to understand how much you should put down on a house.",
                    next_question="What price range are the homes you're considering?")
    ok, _, reasons = validate(out, ctx)
    assert ok and not reasons


@pytest.mark.asyncio
async def test_validator_still_blocks_legal_tax_product_advice():
    # V4 keeps MEDICAL / LEGAL / TAX / specific-PRODUCT advice hard-blocked even though strategic advice is now allowed.
    ctx = await _build_ctx("what do I do", _base())
    blocked = [
        "Legally you must title the house as joint tenants.",   # legal directive
        "For tax purposes you should claim the home-office deduction.",  # tax directive
        "You should buy VTSAX with the cash.",                  # specific security/product by name
        "You should buy shares of your employer.",              # specific security
    ]
    for phrase in blocked:
        ok, _, reasons = validate(_good_llm(recommendation=phrase), ctx)
        assert not ok and any("advice" in r for r in reasons), f"should block: {phrase}"


@pytest.mark.asyncio
async def test_validator_allows_connecting_topic_to_vision_without_edges():
    # Generic "connects to your broader vision/goals" is discovery talk, not a fabricated goal-to-goal edge.
    ctx = await _build_ctx("I want to become a manager", _base())  # fresh user → no graph edges
    out = _good_llm(reflection="Becoming a manager connects to your broader life vision and your goals.",
                    why_this_question="It helps relate this to your future and your priorities.")
    ok, _, reasons = validate(out, ctx)
    assert ok and not reasons


@pytest.mark.asyncio
async def test_validator_allows_single_goal_discovery_language():
    # The real false positive from the live eval: "tied to this significant goal" is benign (one goal).
    ctx = await _build_ctx("I am a veteran and want to buy a home", _base())  # no edges
    out = _good_llm(why_this_question="This helps us understand the needs and aspirations tied to this significant goal.")
    ok, _, reasons = validate(out, ctx)
    assert ok and not reasons


@pytest.mark.asyncio
async def test_validator_still_rejects_two_entity_relationship_without_edge():
    ctx = await _build_ctx("retire and fund college", _base())  # no edges
    out = _good_llm(reflection="There's a connection between your retirement and your education funding.")
    ok, _, reasons = validate(out, ctx)
    assert not ok and any("relationship" in r for r in reasons)


@pytest.mark.asyncio
async def test_validator_rejects_two_named_goals_linked_without_edge():
    # A single-target phrase that names TWO of the user's own goals IS a goal-to-goal claim → needs an edge.
    base = _base(candidate_goals=[{"goal": "retirement"}, {"goal": "college funding"}])
    ctx = await _build_ctx("retire and fund college", base)  # no edges
    out = _good_llm(reflection="Your retirement is connected to your college funding.")
    ok, _, reasons = validate(out, ctx)
    assert not ok and any("relationship" in r for r in reasons)


@pytest.mark.asyncio
async def test_validator_drops_rejected_goal_and_nonuser_facts():
    rejected = [{"rejected_goal": "advance my career"}]
    ctx = await _build_ctx("retire at 60", _base(), rejected=rejected)
    out = _good_llm(
        candidate_goals=[{"title": "advance my career", "domain": "career"}, {"title": "buy a home", "domain": "home"}],
        candidate_facts=[{"label": "salary", "value": "x", "source": "model_guess"}],
    )
    ok, safe, _ = validate(out, ctx)
    assert ok
    assert [g["title"] for g in safe["candidate_goals"]] == ["buy a home"]  # rejected goal never resurrected
    assert safe["candidate_facts"] == []  # non-user-sourced fact dropped


# --------------------------------------------------------------------------- #
# Orchestrator — rules persist, LLM leads the text, clean fallback
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_orchestrator_enhances_text_on_valid_llm():
    base = _base()
    rm = FakeRM(base)
    orch = AdvisorOrchestrator(rm, AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), FakeLLM(_good_llm()))
    out = await orch.converse(_ctx(), "we want to retire at 60")
    assert out["llm_status"] == "enhanced"
    assert "protect first" in out["assistant_message"]  # the LLM's chosen question (conversational)
    # Conversational contract: no six-section report headers leak into the chat message.
    assert "**My read:**" not in out["assistant_message"]
    assert "**The tradeoffs:**" not in out["assistant_message"]
    assert out["pending_key"] == base["pending_key"]  # deterministic outcome preserved


@pytest.mark.asyncio
async def test_orchestrator_falls_back_when_llm_unavailable():
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), FakeLLM(None))
    out = await orch.converse(_ctx(), "hi")
    # A3 + RELEASE_HARDENING: cause-aware fallback (provider/infra), NOT the discovery opener.
    assert out["assistant_message"] != base["assistant_message"]
    assert out["llm_status"] == "fallback:unavailable"
    assert out.get("provider_called") is True  # we attempted the provider (observable)
    assert "reasoning engine" in out["assistant_message"]  # provider/infra cause copy


@pytest.mark.asyncio
async def test_orchestrator_falls_back_on_invalid_llm():
    base = _base()
    bad = _good_llm(next_question="You should invest $999,999 now, right?")  # advice + invented number
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), FakeLLM(bad))
    out = await orch.converse(_ctx(), "what should I do")
    # Counsel-framed fallback; critically the rejected invented number never leaks, and it's not the opener.
    assert "999999" not in out["assistant_message"]
    assert out["assistant_message"] != base["assistant_message"]
    assert out["llm_status"].startswith("fallback:")


@pytest.mark.asyncio
async def test_orchestrator_falls_back_on_llm_exception():
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), RaisingLLM())
    out = await orch.converse(_ctx(), "hi")
    assert out["assistant_message"] == base["assistant_message"]
    assert out["llm_status"] == "fallback:error"


@pytest.mark.asyncio
async def test_orchestrator_disabled_returns_rule_based_untouched():
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), FakeLLM(_good_llm()), enabled=False)
    out = await orch.converse(_ctx(), "hi")
    # Disabled → rule-based MESSAGE untouched (no LLM enhancement); response may carry observability metadata.
    assert out["assistant_message"] == base["assistant_message"]
    assert out.get("llm_status", "") in ("", "disabled")


@pytest.mark.asyncio
async def test_null_llm_always_falls_back():
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), NullAdvisorLLM())
    out = await orch.converse(_ctx(), "hi")
    assert out["llm_status"] == "fallback:unavailable"


# --------------------------------------------------------------------------- #
# JSON parsing tolerance
# --------------------------------------------------------------------------- #
def test_parse_advisor_json_strips_fences():
    assert parse_advisor_json('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_advisor_json('noise {"a": 2} trailing') == {"a": 2}
    assert parse_advisor_json("not json") is None


# --------------------------------------------------------------------------- #
# P0.1 — token capture (telemetry) flows from Gemini → GeminiAdvisorLLM.last_usage
# --------------------------------------------------------------------------- #
class _UsageGemini:
    configured = True

    async def generate_with_usage(self, system, user, temperature=None):
        import json as _json
        return _json.dumps(_good_llm()), {"prompt_tokens": 120, "completion_tokens": 45, "total_tokens": 165}


@pytest.mark.asyncio
async def test_gemini_advisor_llm_captures_token_usage():
    from app.services.advisor_llm import GeminiAdvisorLLM
    ctx = await _build_ctx("retire at 60", _base())
    llm = GeminiAdvisorLLM(_UsageGemini())
    out = await llm.generate(ctx, {"intent": "discovery"})
    assert out is not None
    assert llm.last_usage == {"prompt_tokens": 120, "completion_tokens": 45, "total_tokens": 165}
    assert llm.last_raw  # raw text retained for the trace / llm_response_raw


@pytest.mark.asyncio
async def test_orchestrator_stream_emits_ack_then_final():
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), FakeLLM(_good_llm()))
    events = [e async for e in orch.converse_stream(_ctx(), "what should I do")]
    assert [e["type"] for e in events] == ["ack", "final"]
    # ack is the fast deterministic text; final is the LLM-enhanced answer
    assert events[0]["assistant_message"] == base["assistant_message"]
    assert events[1]["llm_status"] == "enhanced"
    assert events[1]["assistant_message"] and events[1]["assistant_message"] != base["assistant_message"]


@pytest.mark.asyncio
async def test_orchestrator_stream_falls_back_to_ack_on_llm_failure():
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), RaisingLLM())
    events = [e async for e in orch.converse_stream(_ctx(), "hi")]
    assert [e["type"] for e in events] == ["ack", "final"]
    assert events[1]["llm_status"] == "fallback:error"
    assert events[1]["assistant_message"] == base["assistant_message"]  # deterministic text preserved


@pytest.mark.asyncio
async def test_orchestrator_trace_mode_returns_diagnostics():
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()), FakeLLM(_good_llm()))
    out = await orch.converse(_ctx(), "what should I do", trace=True)
    tr = out.get("_trace")
    assert tr and tr["llm_status"] == "enhanced"
    assert tr["validator_result"] in ("accepted", "repaired")
    assert "llm_generate" in tr["stages_ms"] and tr["latency_ms"] >= 0
    # default (no trace) must NOT leak diagnostics to the client
    out2 = await orch.converse(_ctx(), "what should I do")
    assert "_trace" not in out2


# --------------------------------------------------------------------------- #
# The 6 sprint scenarios — deterministic fake LLM, full orchestrator path
# --------------------------------------------------------------------------- #
async def _run(message: str, llm_out: Optional[dict[str, Any]], *, base: Optional[dict[str, Any]] = None, rejected=None):
    b = base or _base()
    orch = AdvisorOrchestrator(
        FakeRM(b),
        AdvisorContextBuilder(FakeSupabase(rejected=rejected), coverage=FakeCoverage()),
        FakeLLM(llm_out),
    )
    return await orch.converse(_ctx(), message)


@pytest.mark.asyncio
async def test_case1_fresh_user_asks_one_grounded_question():
    out = await _run("Hi, I'm new here", _good_llm(
        reflection="Welcome — let's start with what matters most to you.",
        next_question="When you picture life going well in ten years, what stands out first?",
        why_this_question="Your vision anchors every recommendation we build.",
    ))
    assert out["llm_status"] == "enhanced"
    assert out["assistant_message"].count("?") == 1  # exactly one question


@pytest.mark.asyncio
async def test_case2_house_and_cashflow_does_not_recommend():
    # "should I buy" must NOT trigger advice — the validator would reject it; a good turn gathers inputs.
    out = await _run("Can I afford a house with my cash flow?", _good_llm(
        reflection="You're weighing a home purchase against your monthly cash flow.",
        next_question="If you bought in the next year, how much cash would you want left afterward?",
        why_this_question="Your comfort buffer sets the real affordability ceiling.",
        missing_data=[{"field": "purchase_price", "why_it_matters": "needed to size the payment"}],
    ))
    assert out["llm_status"] == "enhanced"
    assert out.get("missing_data")  # surfaces missing inputs instead of answering


@pytest.mark.asyncio
async def test_case3_retire_and_college_priority_tradeoff():
    out = await _run("I want to retire at 60 and pay for my kids' college", _good_llm(
        reflection="Retiring at 60 and funding college are both on your mind.",
        next_question="If you had to protect one, would it be retiring at 60 or fully funding college?",
        why_this_question="The priority decides how we split savings between the two.",
    ))
    assert out["llm_status"] == "enhanced"
    assert "protect one" in out["assistant_message"]


@pytest.mark.asyncio
async def test_case4_goal_correction_never_resurrects_rejected():
    rejected = [{"rejected_goal": "advance my career"}]
    out = await _run(
        "No, I never said anything about my career",
        _good_llm(candidate_goals=[{"title": "advance my career", "domain": "career"}]),
        rejected=rejected,
    )
    # Even if the LLM proposes it again, the validator strips the rejected goal before it can surface.
    assert out["llm_status"] == "enhanced"
    assert all("career" not in (g.get("title") or "").lower() for g in out.get("candidate_goals", []))


@pytest.mark.asyncio
async def test_case5_medical_question_is_refused_via_fallback():
    base = _base()
    out = await _run("Do I have diabetes given my symptoms?",
                     _good_llm(reflection="I diagnose you with diabetes."), base=base)
    # Medical 'diagnosis' language is rejected → a safe cause-aware fallback is shown (NO diagnosis).
    assert "diagnos" not in out["assistant_message"].lower() and "diabetes" not in out["assistant_message"].lower()
    assert out["llm_status"].startswith("fallback:")


@pytest.mark.asyncio
async def test_case6_how_much_down_gathers_inputs_not_a_number():
    base = _base()
    # An invented down-payment figure must be rejected (no number was in context).
    out = await _run("How much should I put down on a house?",
                     _good_llm(next_question="You should put down $90,000, agreed?"), base=base)
    # Fell back — cause-aware reply, and the fabricated figure is never shown.
    assert "90,000" not in out["assistant_message"] and "90000" not in out["assistant_message"]
    assert out["llm_status"].startswith("fallback:")


@pytest.mark.asyncio
async def test_validator_allows_verified_computed_number():
    # V5: a number COMPUTED from the user's own figures, recorded in derivations, passes the number gate.
    ctx = await _build_ctx("I have $95k in cash and $40k in a brokerage", _base())
    out = _good_llm(
        recommendation="Your liquid assets total about $135,000, which gives you real flexibility.",
        derivations=[{"label": "liquid assets", "expression": "95000 + 40000", "value": "135000"}],
    )
    ok, safe, reasons = validate(out, ctx)
    assert ok and not reasons
    assert safe.get("derivations")  # the verified derivation is kept


@pytest.mark.asyncio
async def test_validator_rejects_wrong_or_invented_computed_number():
    ctx = await _build_ctx("I have $95k in cash and $40k in a brokerage", _base())
    # wrong arithmetic — value does not match the expression
    bad = _good_llm(recommendation="Your liquid assets total about $150,000.",
                    derivations=[{"label": "liquid", "expression": "95000 + 40000", "value": "150000"}])
    ok, _, reasons = validate(bad, ctx)
    assert not ok and any("invented numbers" in r for r in reasons)
    # invented operand (20% the user never gave) on a $620k they never gave either
    bad2 = _good_llm(recommendation="A 20% down payment would be $124,000.",
                     derivations=[{"label": "dp", "expression": "620000 * 20/100", "value": "124000"}])
    ok2, _, reasons2 = validate(bad2, ctx)
    assert not ok2 and any("invented numbers" in r for r in reasons2)


# --------------------------------------------------------------------------- #
# Selective orchestration — health safety fallback + routing (default-off)
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_health_urgent_triggers_safety_fallback_and_skips_llm():
    # A chest-pain message must NEVER reach the LLM or the generic opener — deterministic safety reply.
    base = _base(assistant="Let's start with your vision...")
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(_good_llm()))  # if the LLM ran, status would be "enhanced"
    out = await orch.converse(_ctx(), "I've had chest pain on and off for a week, what should I do?")
    assert out["llm_status"] == "safety_fallback"
    assert "911" in out["assistant_message"] and "emergency" in out["assistant_message"].lower()
    assert "vision" not in out["assistant_message"].lower()  # not the generic deterministic opener


@pytest.mark.asyncio
async def test_router_off_by_default_uses_di_llm():
    # No MODEL_ROUTER_ENABLED → the single DI llm is used (unchanged production path).
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(_good_llm()))
    out = await orch.converse(_ctx(), "we want to retire at 60")
    assert out["llm_status"] == "enhanced"


@pytest.mark.asyncio
async def test_router_on_uses_routed_llm(monkeypatch):
    from app.services.model_router import ModelRouter
    monkeypatch.setenv("MODEL_ROUTER_ENABLED", "true")
    routed = FakeLLM(_good_llm(next_question="Routed model question?"))
    router = ModelRouter(lambda key: routed)  # factory returns our routed fake for any model
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(None), router=router)  # DI llm is None → only routed llm can enhance
    out = await orch.converse(_ctx(), "Can I afford a $620k house?")
    assert out["llm_status"] == "enhanced"
    assert "Routed model question?" in out["assistant_message"]


@pytest.mark.asyncio
async def test_provider_failure_falls_back_to_fallback_llm(monkeypatch):
    from app.services.model_router import ModelRouter
    monkeypatch.setenv("MODEL_ROUTER_ENABLED", "true")
    good = FakeLLM(_good_llm(next_question="Fallback saved it?"))
    # factory: primary (gemini_2_5_pro) returns None; everything else returns the good fallback
    def fac(key):
        return FakeLLM(None) if key == "gemini_2_5_pro" else good
    monkeypatch.setenv("GEMINI_PRO_ADVISOR_ENABLED", "true")
    router = ModelRouter(fac)
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(None), router=router)
    out = await orch.converse(_ctx(), "Help me think about my goals", )  # general → pro primary (None) → fallback
    assert out["llm_status"] == "enhanced"
    assert "Fallback saved it?" in out["assistant_message"]


# --------------------------------------------------------------------------- #
# Discovery mode (onboarding) — must NOT run the advisor six-section template.
# Proves: discovery is conversational; advisor mode is preserved; candidate
# facts are not asserted; streaming follows the same mode; safety still wins.
# --------------------------------------------------------------------------- #
def _six_section_llm(**over: Any) -> dict[str, Any]:
    """A clean, validator-passing advisor turn that DOES populate the six sections (so we can prove
    advisor mode renders them and discovery mode does not)."""
    out = _good_llm(
        decision_frame="Here's how I see the decision.",
        tradeoffs=[{"option": "Aggressive pace", "benefit": "reach it sooner", "cost": "more risk"}],
        what_we_know=["You value financial independence"],
        recommendation="lean toward a measured pace",
        what_we_still_need=["your target timeline"],
    )
    out.update(over)
    return out


def test_discovery_contract_violations_detects_advisor_artifacts():
    bad = ("**My read:** your primary objective is financial independence.\n\n"
           "**The tradeoffs:**\n- A; but B\n\n**What we know:**\n- x\n\n"
           "**What would change this:**\n- y\n\n"
           "_This is general planning guidance ... not personalized ... licensed professional._")
    v = discovery_contract_violations(bad)
    for marker in ("**The tradeoffs:**", "**What we know:**", "**My read:**",
                   "**What would change this:**", "licensed professional", "your primary objective is"):
        assert marker in v
    # A genuine discovery turn trips nothing.
    assert discovery_contract_violations(
        "It sounds like financial independence may matter to you. When you picture it, what changes?"
    ) == []


@pytest.mark.asyncio
async def test_discovery_mode_returns_conversational_rm_output():
    # Even with an LLM that WOULD produce the six-section advisor turn, discovery mode must keep the
    # RelationshipManager's conversational reply verbatim and skip enhancement entirely.
    base = _base(assistant="It sounds like financial independence may matter to you — should I treat that as a goal?")
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(_six_section_llm()))
    out = await orch.converse(_ctx(), "Reach financial independence", mode="discovery")
    assert out["assistant_message"] == base["assistant_message"]   # untouched, conversational
    assert out["llm_status"] == "discovery"
    assert discovery_contract_violations(out["assistant_message"]) == []   # no sections / disclaimer / fact
    assert out["pending_key"] == base["pending_key"]


@pytest.mark.asyncio
async def test_advisor_mode_renders_conversational_not_six_section():
    # P0 — Conversational presentation: advisor mode now answers as a NATURAL chat reply (frame + read +
    # one question), NOT a six-section consulting memo. The reasoning still exists — as structured data.
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(_six_section_llm()))
    out = await orch.converse(_ctx(), "what should I do about retirement")
    assert out["llm_status"] == "enhanced"
    msg = out["assistant_message"]
    # The read renders as natural prose…
    assert "Here's how I see the decision." in msg          # decision frame
    assert "lean toward a measured pace" in msg             # recommendation, as a paragraph
    # …with NO report headers and NO inline disclaimer (the UI shows a persistent compliance footer).
    for banned in ("**My read:**", "**The tradeoffs:**", "**What we know:**", "**What would change this:**",
                   "licensed professional"):
        assert banned not in msg
    # The reasoning is preserved as structured data for the expandable UI drawer, not dumped in chat.
    assert out["reasoning"]["tradeoffs"][0]["option"] == "Aggressive pace"
    assert out["reasoning"]["what_we_know"] == ["You value financial independence"]
    assert out["reasoning"]["what_we_still_need"] == ["your target timeline"]
    # The conversational message is now clean of the artifacts discovery forbids.
    assert discovery_contract_violations(msg) == []


@pytest.mark.asyncio
async def test_discovery_mode_does_not_state_candidate_goal_as_fact():
    # A persona-seeded / inferred objective must never be asserted as confirmed in discovery.
    base = _base(assistant="Earlier you mentioned financial independence — want me to treat that as one of your goals?")
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(_six_section_llm()))
    out = await orch.converse(_ctx(), "", mode="discovery")
    assert "your primary objective is" not in out["assistant_message"].lower()
    assert out["assistant_message"] == base["assistant_message"]


@pytest.mark.asyncio
async def test_discovery_stream_follows_mode():
    base = _base(assistant="Tell me, in your words, what matters most right now?")
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(_six_section_llm()))
    events = [e async for e in orch.converse_stream(_ctx(), "Reach financial independence", mode="discovery")]
    assert [e["type"] for e in events] == ["ack", "final"]
    final = events[-1]
    assert final["assistant_message"] == base["assistant_message"]   # conversational, not enhanced
    assert final["llm_status"] == "discovery"
    assert discovery_contract_violations(final["assistant_message"]) == []


@pytest.mark.asyncio
async def test_advisor_stream_still_enhances():
    # The streaming advisor path (default mode) still enhances — discovery mode didn't degrade it.
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(_six_section_llm()))
    events = [e async for e in orch.converse_stream(_ctx(), "what should I do")]
    final = events[-1]
    assert final["type"] == "final"
    assert final["llm_status"] == "enhanced"
    # Conversational: the read renders as prose, not a "**My read:**" header.
    assert "lean toward a measured pace" in final["assistant_message"]
    assert "**My read:**" not in final["assistant_message"]


@pytest.mark.asyncio
async def test_health_safety_wins_before_discovery_mode(monkeypatch):
    # The deterministic urgent-care net must fire BEFORE discovery mode returns the conversational reply.
    monkeypatch.setenv("HEALTH_SAFETY_FALLBACK_ENABLED", "true")
    base = _base(assistant="What would you like to focus on?")
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(_six_section_llm()))
    out = await orch.converse(_ctx(), "I'm having severe chest pain and can't breathe", mode="discovery")
    assert out["llm_status"] == "safety_fallback"
    assert out["assistant_message"] != base["assistant_message"]   # replaced by the safety response


# --------------------------------------------------------------------------- #
# Domain-advisor routing / isolation — a direct advisor hands off out-of-domain input
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_education_advisor_hands_off_finance_input():
    """Education Advisor + '$500K - $750K' must offer a Finance handoff — NOT answer as a finance advisor."""
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(_good_llm()))
    out = await orch.converse(_ctx(), "$500K - $750K", agent="education_advisor")
    assert out["llm_status"] == "handoff"
    msg = out["assistant_message"].lower()
    assert "finance" in msg and ("route" in msg or "hand it" in msg or "save it" in msg)
    assert "verified income" not in msg  # did NOT fall through to the finance number-gate fallback


@pytest.mark.asyncio
async def test_education_advisor_answers_in_domain():
    """An in-domain education question is NOT handed off."""
    base = _base()
    orch = AdvisorOrchestrator(FakeRM(base), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(_good_llm()))
    out = await orch.converse(_ctx(), "Should I pursue an MBA or a data certificate next?", agent="education_advisor")
    assert out["llm_status"] != "handoff"


# --------------------------------------------------------------------------- #
# Handoff detector — domain-aware + conservative (in-domain stays; only strong other-domain hands off)
# --------------------------------------------------------------------------- #
@pytest.mark.asyncio
async def test_health_advisor_keeps_tendon_training_context():
    """Regression: tendons/ligaments/max-effort is health — must NOT route to Family (the 'will' false hit)."""
    orch = AdvisorOrchestrator(FakeRM(_base()), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(_good_llm()))
    msg = ("It will also be starting slow enough to allow the tendons and ligaments to get strong enough since "
           "my muscles will get bigger and stronger faster, I will have to start slower than max effort for the "
           "first month or so.")
    out = await orch.converse(_ctx(), msg, agent="health_advisor")
    assert out["llm_status"] != "handoff"
    assert "Family Advisor" not in out["assistant_message"]


@pytest.mark.asyncio
async def test_health_advisor_keeps_supplements_nutrition():
    orch = AdvisorOrchestrator(FakeRM(_base()), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(_good_llm()))
    out = await orch.converse(_ctx(), "I want supplements and nutrition for testosterone, stamina, and muscle.",
                              agent="health_advisor")
    assert out["llm_status"] != "handoff"


@pytest.mark.asyncio
async def test_health_advisor_hands_off_life_insurance_for_kids():
    orch = AdvisorOrchestrator(FakeRM(_base()), AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage()),
                               FakeLLM(_good_llm()))
    out = await orch.converse(_ctx(), "I need life insurance for future kids.", agent="health_advisor")
    assert out["llm_status"] == "handoff"
