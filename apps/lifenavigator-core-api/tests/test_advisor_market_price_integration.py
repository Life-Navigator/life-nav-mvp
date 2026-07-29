"""INTEGRATION: the market-price + sources feature driven through the real orchestrator pipeline.

The unit tests pin the validator's verdicts. They cannot tell us whether the pieces actually cooperate —
whether a rejected draft really produces a keep-and-hedge repair note, whether the repaired draft reaches
the user, whether a source key survives validate() and lands in the composed message, and whether the fast
route's repair exception fires. Those are the things that break in production, and every one of them lives
in the seams BETWEEN the units.

So this drives the genuine `AdvisorOrchestrator._enhance` — real validate(), real classify_issues(), real
repair-note builder, real _compose — with only the LLM and the context builder replaced by doubles. The
doubles are scripted: `_ScriptedLLM` returns draft 1, then draft 2 when a repair_note arrives, and records
the notes it was sent, so a test can assert on what the model was actually TOLD, not just the final text.
"""
from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.models.common import UserContext
from app.services.advisor_context import AdvisorContext
from app.services.advisor_orchestrator import AdvisorOrchestrator

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")


def _ctx_obj(allowed=("500000",)) -> AdvisorContext:
    return AdvisorContext(
        user_id=CTX.user_id, user_message="what will buying cost me?", current_stage="complete",
        life_vision=None, primary_objective="buy a home", candidate_goals=[], rejected_goals=[],
        risks=[], opportunities=[], constraints=[], domains_touched=["finance"], missing_areas=[],
        discovery_pct=80, allowed_numbers=set(allowed),
    )


class _CtxBuilder:
    def __init__(self, ctx_obj): self._c = ctx_obj
    async def build(self, *a, **k): return self._c


class _ScriptedLLM:
    """Returns queued drafts in order. Records every repair_note it is handed."""
    model_name, provider, last_raw, last_usage, last_error = "double", "test", "", {}, ""

    def __init__(self, *drafts: dict): self.drafts, self.notes, self.calls = list(drafts), [], 0

    async def generate(self, context, constraints):
        self.calls += 1
        if constraints.get("repair_note"):
            self.notes.append(constraints["repair_note"])
        return self.drafts.pop(0) if self.drafts else None


def _draft(**over) -> dict:
    d = {
        "decision_frame": "You're deciding whether to buy this year or wait.",
        "tradeoffs": [{"option": "Buy now", "benefit": "Locks the price", "cost": "Thinner cushion"},
                      {"option": "Wait", "benefit": "More savings", "cost": "Prices may move"}],
        "what_we_know": ["You have $500,000 budgeted."],
        "recommendation": "Waiting a year looks like the stronger play on these numbers.",
        "what_we_still_need": ["Your target closing month"],
        "next_question": "What's your target closing month?",
        "why_this_question": "It sets everything else.",
        "derivations": [], "confirmed_facts": [], "candidate_facts": [], "candidate_goals": [],
        "assumptions": [], "missing_data": [], "relationships_referenced": [], "warnings": [],
        "summary": "", "reflection": "", "should_persist": False,
    }
    d.update(over)
    return d


def _run(orch, llm, route_path="supervised") -> dict:
    base: dict[str, Any] = {"assistant_message": "deterministic fallback", "citations": []}
    tr: dict[str, Any] = {"turn_id": "t", "route_path": route_path}
    asyncio.run(orch._enhance(base, CTX, "what will buying cost me?", tr, lambda *_a, **_k: None, llm=llm))
    base["_tr"] = tr
    return base


def _orch(llm, ctx_obj=None) -> AdvisorOrchestrator:
    return AdvisorOrchestrator(None, _CtxBuilder(ctx_obj or _ctx_obj()), llm)


# ────────────────────────────────────────────────────────── market price: the full loop

def test_unhedged_market_price_is_repaired_into_a_range_and_reaches_the_user():
    """The whole point of the feature: the advisor gets to say what an inspection costs. Draft 1 states a
    point value, the loop sends a KEEP-and-hedge note, draft 2 hedges, and the number survives to the user."""
    llm = _ScriptedLLM(
        _draft(recommendation="Budget for the extras: a home inspection runs $400."),
        _draft(recommendation="Budget for the extras: a home inspection runs about $400-600.",
               sources=[{"key": "consumer_finance", "for": "inspection and closing cost ranges"}]),
    )
    out = _run(_orch(llm), llm)

    assert llm.calls == 2, "a point-value market price must trigger exactly one repair"
    note = llm.notes[0].lower()
    assert "keep" in note and "range" in note, f"repair note must say keep-and-hedge, got: {llm.notes[0]}"
    assert out["llm_status"] == "enhanced", out["llm_status"]
    assert "$400-600" in out["assistant_message"]          # the NUMBER survived — not deleted
    assert "consumerfinance.gov" in out["assistant_message"]  # and it came with somewhere to check
    assert out["_tr"].get("fallback_used") is not True  # set only on the failure path


def test_a_correctly_hedged_first_draft_costs_no_repair():
    """Latency guard: the common case must not pay for the safety net."""
    llm = _ScriptedLLM(_draft(recommendation="An inspection runs about $400-600 in most metros."))
    out = _run(_orch(llm), llm)
    assert llm.calls == 1 and llm.notes == []
    assert out["llm_status"] == "enhanced"
    assert "$400-600" in out["assistant_message"]


def test_fast_route_still_repairs_a_market_price_instead_of_deleting_the_sentence():
    """The fast route sets _MAX_REPAIRS = 0, so before the exception this fell through to redaction and the
    user lost the price entirely. Form defects earn a repair on every route."""
    llm = _ScriptedLLM(
        _draft(recommendation="One more thing: the appraisal costs $650."),
        _draft(recommendation="One more thing: the appraisal usually costs about $600-700."),
    )
    out = _run(_orch(llm), llm, route_path="fast")
    assert llm.calls == 2, "fast route must still repair a market-price FORM defect"
    assert "$600-700" in out["assistant_message"]


def test_fast_route_does_not_repair_a_fabricated_personal_figure():
    """The exception is scoped to form. A fabricated personal number on a fast turn keeps the old behaviour
    (no repair — redact or fall back); widening it would quietly buy latency cost for every bad turn."""
    llm = _ScriptedLLM(_draft(recommendation="Your net worth is $1,250,000, so waiting is fine."))
    out = _run(_orch(llm), llm, route_path="fast")
    assert llm.calls == 1, "fast route must not spend a repair on a fabricated personal figure"
    assert "1,250,000" not in out["assistant_message"]


# ────────────────────────────────────────────────────────── trust spine, end to end

def test_fabricated_personal_figure_never_reaches_the_user_even_after_repair():
    """Two bad drafts. The gate is the supervisor for EVERY draft, including repaired ones — the loop must
    not become a way to launder a number by asking twice."""
    llm = _ScriptedLLM(
        _draft(recommendation="Your monthly payment will be $3,200."),
        _draft(recommendation="Your monthly payment will be about $3,200."),  # hedged ≠ sourced
    )
    out = _run(_orch(llm), llm)
    assert "3,200" not in out["assistant_message"]
    assert out["_tr"].get("fallback_used") is True or out["_tr"].get("redacted_number") is True


def test_the_users_own_number_passes_through_untouched():
    llm = _ScriptedLLM(_draft(what_we_know=["You have $500,000 budgeted."],
                              recommendation="With $500,000 on the table, waiting a year is affordable."))
    out = _run(_orch(llm), llm)
    assert llm.calls == 1
    assert "$500,000" in out["assistant_message"]


# ────────────────────────────────────────────────────────── sources through the pipeline

def test_invented_source_key_is_dropped_without_failing_the_turn():
    """A bad key must not cost the user their answer — the answer is fine without the link."""
    llm = _ScriptedLLM(_draft(sources=[{"key": "bankrate_dot_com", "for": "rates"}]))
    out = _run(_orch(llm), llm)
    assert out["llm_status"] == "enhanced"
    assert "bankrate" not in out["assistant_message"].lower()
    assert "Check current numbers" not in out["assistant_message"]


def test_a_url_written_into_source_for_text_is_not_rendered_as_a_link():
    """`for` is prose, not an href. The model must not be able to smuggle a link through it."""
    llm = _ScriptedLLM(_draft(sources=[{"key": "irs", "for": "see https://totally-fake-tax-site.example"}]))
    out = _run(_orch(llm), llm)
    msg = out["assistant_message"]
    assert "](https://totally-fake-tax-site.example)" not in msg  # never a markdown link
    assert "irs.gov" in msg                                        # the real, server-owned URL is


def test_fabricated_number_hidden_in_source_for_text_is_gated():
    """`for` is rendered next to an authoritative link. It passes the same number gate as any visible field."""
    llm = _ScriptedLLM(
        _draft(sources=[{"key": "consumer_finance", "for": "your $9,500 closing costs"}]),
        _draft(sources=[{"key": "consumer_finance", "for": "closing cost ranges"}]),
    )
    out = _run(_orch(llm), llm)
    assert "9,500" not in out["assistant_message"]


@pytest.mark.parametrize("bad", [
    [{"key": "consumer_finance"}, {"key": "consumer_finance"}],   # duplicate
    [{"key": ""}, {"key": "irs"}],                                # empty + valid
])
def test_source_list_is_normalised_before_render(bad):
    llm = _ScriptedLLM(_draft(sources=bad))
    msg = _run(_orch(llm), llm)["assistant_message"]
    assert msg.count("Check current numbers") <= 1
    assert msg.count("consumerfinance.gov") <= 1
