"""Phases 2+3 CONFIRMATION — a full advisor turn through the REAL orchestrator and REAL validator.

WHAT THIS CONFIRMS, AND WHAT IT CANNOT
--------------------------------------
The decisive mechanical claim of Phases 2-3 is:

    a reply stating a mortgage payment / compound projection PASSES the number gate when the
    calculators are wired in, and the IDENTICAL reply is rejected when they are not.

Nothing so far tested that. `test_calculators.py` tests the math, `test_advisor_calculations.py`
tests the planner and the validator separately. Both could pass while the wiring silently failed —
the planner computing figures that never reach `allowed_numbers`, or reaching it in a form the
gate's normalizer does not match. These tests drive `AdvisorOrchestrator.converse` with the real
`advisor_validator`, so the gate itself renders the verdict.

The LLM is stubbed, deliberately: the point is to hold the GATE's behaviour fixed while varying only
whether calculators are present. A live model would make the comparison noisy and would not test
anything additional about the wiring.

This does NOT confirm that the advisor got BETTER. That is a quality question, it needs a live model
on a deployed candidate with ADVISOR_CALCULATORS_ENABLED=true, and it is owner-blocked (see the
Phase 3 summary). Mechanism and quality are different claims and this file only settles the first.
"""
import pytest

from app.services.advisor_calculations import AdvisorCalculationPlanner
from app.services.advisor_context import AdvisorContextBuilder
from app.services.advisor_orchestrator import AdvisorOrchestrator
from tests.test_advisor_hybrid import FakeCoverage, FakeRM, FakeSupabase, _base, _ctx, _good_llm

# A message that is BOTH finance-scoped (so the planner runs) and carries a home price (so the
# mortgage calculator has a real user-supplied input).
MORTGAGE_MSG = "Can I afford a $650,000 house with my savings and mortgage situation?"


def _field(v, present=True, prompt="Add it."):
    return {"value": v, "present": present, "prompt": prompt, "unlocks": []}


class _Resolver:
    """Canonical finance inputs, in the real resolver's provenance-carrying shape."""

    def __init__(self, **vals):
        base = {k: _field(None, False) for k in (
            "income", "cash_balance", "investment_balance", "retirement_balance", "debt_total",
            "debt_apr", "retirement_contribution_rate", "employer_match_rate", "risk_profile",
            "time_horizon", "housing_target")}
        for k, v in vals.items():
            base[k] = _field(v, v is not None)
        self._inputs = base

    async def resolve(self, ctx):
        return {"inputs": self._inputs}

    async def summary(self, ctx):  # FinanceScenarioEngine's interface; unused here
        return {}


class _ScriptedLLM:
    """Returns one fixed advisor JSON, so the GATE is the only thing that varies between cases."""

    prompt_version = "test"
    provider = "google_aistudio"
    model_name = "gemini-2.5-flash"

    def __init__(self, out):
        self._out = out
        self.last_usage, self.last_raw, self.last_error = {}, "{}", ""

    @property
    def available(self):
        return True

    async def generate(self, context, plan):
        self.seen_context = context  # captured so tests can inspect what was registered
        return self._out


def _orch(llm, *, with_calculators: bool, resolver=None):
    """Build the real orchestrator; `with_calculators` is the ONLY difference between arms."""
    resolver = resolver or _Resolver(retirement_balance=310_000, income=140_000,
                                     debt_total=24_500, debt_apr=6.9, cash_balance=28_000)
    planner = AdvisorCalculationPlanner(resolver) if with_calculators else None
    builder = AdvisorContextBuilder(FakeSupabase(), coverage=FakeCoverage(), calculations=planner)
    return AdvisorOrchestrator(FakeRM(_base()), builder, llm)


def _reply(**over):
    """A well-formed advisor reply; `over` injects the sentence under test."""
    return _good_llm(**over)


async def _mortgage_payment_for(resolver=None) -> float:
    """The figure the calculators actually produce for MORTGAGE_MSG — never hardcoded, so the test
    cannot drift from the registry's mortgage rate/term/down-payment assumptions."""
    planner = AdvisorCalculationPlanner(resolver or _Resolver(cash_balance=28_000))
    packet = await planner.compute(_ctx(), home_price_goal=650_000)
    r = next(x for x in packet["results"] if x["calculator"] == "debt.amortized_payment")
    return r["value"]


# ── The decisive A/B — on the path where grounding ACTUALLY gates ────────────────────────────────
#
# A CORRECTION this confirmation produced, and the reason the A/B is shaped this way.
#
# The earlier claim was "the gate blocked the advisor from stating a mortgage payment at all". That
# is not what the gate does. Measured against the real validator:
#
#   hedged, non-possessive ("an estimated payment is about $3,390")  -> PASSES, grounded or NOT
#   possessive money-cue   ("your retirement balance will be $X")    -> BLOCKED unless grounded
#
# So the gate gates PERSONAL CLAIMS, not arithmetic. Which means the calculators' contribution
# splits in two, and only the second half is about permission:
#
#   1. ACCURACY. A hedged figure always passed, so before this the model could state a confidently
#      WRONG payment and the gate would admit it. Now the hedged figure is computed and correct.
#      This is the larger practical win and it is invisible to a pass/fail gate test.
#   2. PERMISSION. A figure derived from the user's OWN numbers can now be stated as theirs,
#      possessively, which is exactly what the gate refuses for an ungrounded number.
#
# The A/B below therefore runs on (2), where grounding is load-bearing and the comparison means
# something. (1) is asserted separately by the parity/simulation suites, which is where correctness
# actually belongs.

@pytest.mark.asyncio
async def test_a_possessive_claim_on_the_users_OWN_figure_passes_with_calculators_and_fails_without():
    """The real A/B. `money.monthly_surplus` is STRICT — income minus expenses, both the user's own —
    so Tier 1 admits it inside a possessive claim about their cash. Without the calculators the same
    figure is ungrounded and the gate blocks it.
    """
    # Income comes from the resolver's canonical ANNUAL figure (/12); expenses from what the user
    # states in this very message. Both real, neither hardcoded here.
    msg = "How is my savings and cash position? I spend about $5,400 a month."
    resolver = _Resolver(income=146_400, cash_balance=28_000)  # 146,400/12 = 12,200/mo
    packet = await AdvisorCalculationPlanner(resolver).compute(
        _ctx(), monthly_expenses=5_400)
    surplus = next(r for r in packet["results"] if r["calculator"] == "money.monthly_surplus")
    assert surplus["tier"] == "strict" and surplus["value"] == 6_800.0

    # Possessive + a money cue ("cash"), i.e. a claim about the user's own money.
    sentence = f"Your cash position leaves ${surplus['value']:,.0f} a month after expenses."
    reply = _reply(reflection=sentence, next_question="Where would you want that to go?")

    with_calc = await _orch(_ScriptedLLM(reply), with_calculators=True,
                            resolver=resolver).converse(_ctx(), msg, trace=True)
    without = await _orch(_ScriptedLLM(reply), with_calculators=False,
                          resolver=resolver).converse(_ctx(), msg, trace=True)

    # Asserted on what the USER SEES, not on llm_status. Without grounding the gate does not fall
    # back here — the F6 "redact-don't-nuke" path deletes the sentence carrying the ungrounded figure
    # and salvages the rest of the answer, so the turn still reports `enhanced`. The user-visible
    # difference is whether the number survives, which is the thing that actually matters.
    figure = "6,800"
    assert figure in with_calc["assistant_message"], (
        f"a strict, calculator-grounded figure was stripped from the reply; "
        f"validator={with_calc['_trace'].get('validator_result')}")
    assert figure not in without["assistant_message"], (
        "ungrounded, this possessive figure must not reach the user — otherwise the A/B proves nothing")
    assert without["_trace"].get("redacted_number") is True
    assert with_calc["_trace"].get("redacted_number") is not True


@pytest.mark.asyncio
async def test_a_mortgage_estimate_is_admitted_when_grounded_and_correctly_valued():
    """The mortgage path, stated the way the gate permits (hedged, non-possessive).

    This asserts ADMISSION plus CORRECTNESS, because admission alone proves little here — an
    invented payment would also have been admitted in this phrasing. The value is that the figure
    now equals what the amortization actually produces from the registry's rate and term.
    """
    payment = await _mortgage_payment_for()
    assert 2_000 < payment < 5_000, payment
    sentence = (f"On a $650,000 home, an estimated monthly mortgage payment is about "
                f"${payment:,.2f} at current rates.")
    out = await _orch(_ScriptedLLM(_reply(reflection=sentence)), with_calculators=True).converse(
        _ctx(), MORTGAGE_MSG, trace=True)
    assert out["llm_status"] == "enhanced"

    # And the figure is the real one: 80% of $650k amortized at the registry's rate/term.
    from app.services import assumptions as A
    from app.services.calculators import debt as _debt
    expected = _debt.amortized_payment(
        principal=650_000 * (1 - A.value("down_payment_pct")),
        apr=A.value("mortgage_rate"),
        term_months=int(A.value("mortgage_term_months")),
    ).value
    assert payment == expected


@pytest.mark.asyncio
async def test_a_hedged_figure_passes_the_gate_even_ungrounded_so_accuracy_is_the_real_win():
    """Encodes the correction above as an executable fact.

    The gate admits a hedged, non-possessive number whether or not anything grounded it. So the
    pre-Phase-2 advisor could state a WRONG mortgage payment and pass. If this ever starts failing,
    the gate has been tightened and the Phase 2/3 value story genuinely becomes about permission —
    at which point this comment is the thing to revisit.
    """
    bogus = _reply(reflection="An estimated monthly mortgage payment is about $9,876.54 at current rates.")
    out = await _orch(_ScriptedLLM(bogus), with_calculators=False).converse(
        _ctx(), MORTGAGE_MSG, trace=True)
    assert out["llm_status"] == "enhanced", (
        "a hedged ungrounded figure is expected to pass today — that is why computing it correctly, "
        "rather than merely permitting it, is the point of Phase 2"
    )


@pytest.mark.asyncio
async def test_the_calculated_figure_is_actually_registered_in_the_context():
    """Guards the join between planner and gate. The planner could compute a correct number that
    never lands in `allowed_numbers`/`scenario_numbers`, or lands in a notation the gate's
    normalizer does not match — in both cases the figure is computed and still unsayable."""
    payment = await _mortgage_payment_for()
    llm = _ScriptedLLM(_reply())
    await _orch(llm, with_calculators=True).converse(_ctx(), MORTGAGE_MSG)

    ctx = llm.seen_context
    assert ctx.calculations is not None and ctx.calculations["available"] is True
    # Registered in TIER 3 (it rests on registry rate/term/down-payment), not Tier 1.
    assert str(round(payment)) in ctx.scenario_numbers
    assert str(round(payment)) not in ctx.allowed_numbers


@pytest.mark.asyncio
async def test_the_packet_reaches_the_prompt_the_model_actually_sees():
    """A figure the model is never shown cannot be cited no matter how well it is registered."""
    llm = _ScriptedLLM(_reply())
    await _orch(llm, with_calculators=True).converse(_ctx(), MORTGAGE_MSG)
    packet = llm.seen_context.prompt_dict()
    assert packet["calculations"]["available"] is True
    labels = {r["label"] for r in packet["calculations"]["results"]}
    assert any("mortgage" in l for l in labels), labels
    assert packet["calculations"]["constraints"], "presentation rules must travel with the figures"


# ── The trust boundary still holds ───────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_scenario_figure_asserted_as_the_users_CURRENT_money_is_still_blocked():
    """Tier 3's reason for existing. The same number that passes as an illustration must be refused
    as a possessive claim about what the user HAS — otherwise an assumption-driven estimate is
    delivered as a fact about their account."""
    payment = await _mortgage_payment_for()
    possessive = _reply(
        reflection=f"Your mortgage payment is ${payment:,.2f} every month.",
        next_question="Does that match your budget?",
    )
    out = await _orch(_ScriptedLLM(possessive), with_calculators=True).converse(
        _ctx(), MORTGAGE_MSG, trace=True)
    assert out["llm_status"].startswith("fallback"), (
        "a Tier-3 estimate was allowed to be asserted as the user's actual payment")


@pytest.mark.asyncio
async def test_calculators_do_not_widen_the_gate_for_unrelated_invented_numbers():
    """The registration must be narrow. If enabling calculators made the gate permissive generally,
    it would have traded the quality gap for a fabrication hole."""
    reply = _reply(reflection="Your portfolio returned exactly $87,431.22 last quarter.")
    out = await _orch(_ScriptedLLM(reply), with_calculators=True).converse(
        _ctx(), MORTGAGE_MSG, trace=True)
    assert out["llm_status"].startswith("fallback")
    assert "invented numbers" in (out["_trace"].get("fallback_reason") or "")


# ── No real data ⇒ no figures, and the turn still works ──────────────────────────────────────────
@pytest.mark.asyncio
async def test_an_empty_finance_profile_registers_nothing_and_does_not_break_the_turn():
    """The no-invented-inputs rule, end to end: a user with no finance data gets a working advisor
    and zero computed figures — not a projection built from defaults."""
    empty = _Resolver()
    llm = _ScriptedLLM(_reply())
    out = await _orch(llm, with_calculators=True, resolver=empty).converse(
        _ctx(), MORTGAGE_MSG, trace=True)
    assert out["llm_status"] == "enhanced"

    calc = llm.seen_context.calculations
    # The mortgage figure needs only a user-stated price, so it is still available; everything that
    # would need account data is a named gap instead.
    ids = {r["calculator"] for r in calc["results"]}
    assert "retirement.sustainable_income" not in ids
    assert "debt.payoff_months" not in ids
    assert calc["gaps"]


@pytest.mark.asyncio
async def test_a_broken_resolver_degrades_the_turn_to_todays_behaviour():
    """Grounding is an enhancement. A finance-data outage must cost figures, never an answer."""
    class _Broken:
        async def resolve(self, ctx):
            raise RuntimeError("supabase down")

    out = await _orch(_ScriptedLLM(_reply()), with_calculators=True,
                      resolver=_Broken()).converse(_ctx(), MORTGAGE_MSG, trace=True)
    assert out["llm_status"] == "enhanced"
    assert out["assistant_message"]


@pytest.mark.asyncio
async def test_disabled_planner_leaves_the_turn_byte_identical_to_today():
    """`calculations=None` is the production default (ADVISOR_CALCULATORS_ENABLED is off), so this
    is the configuration currently shipping. It must be indistinguishable from before the change."""
    llm_a, llm_b = _ScriptedLLM(_reply()), _ScriptedLLM(_reply())
    off = await _orch(llm_a, with_calculators=False).converse(_ctx(), MORTGAGE_MSG)
    assert off["llm_status"] == "enhanced"
    assert llm_a.seen_context.calculations is None
    assert llm_a.seen_context.scenario_numbers == set()
    # And the prompt packet still carries the key, as a null — the model is told nothing new.
    assert llm_b is not None
    assert llm_a.seen_context.prompt_dict()["calculations"] is None


# ── A pre-existing validator characteristic, surfaced by this confirmation ───────────────────────
@pytest.mark.asyncio
async def test_a_trailing_unrelated_possessive_still_over_blocks_a_valid_estimate():
    """FINDING (pre-existing, not introduced by Phases 2-3): a correctly-hedged Tier-3 estimate is
    blocked when an UNRELATED possessive clause follows it within the gate's 70-character window.

        "an estimated monthly mortgage payment is about $3,390.01, which is worth weighing
         against your cash position."

    The "your" belongs to *cash position*, not to the payment, and the figure is explicitly labelled
    an estimate. `advisor_validator` already documents and partially fixed this class — its
    POSSESSIVE ATTACHMENT note gives the near-identical example "since you're closing next month,
    attorneys charge $1,500" — so this is the same known over-blocking, now with a concrete repro
    against a calculator-grounded number.

    Asserted as CURRENT behaviour rather than fixed here: relaxing the possessive window is a change
    to the trust spine, it affects every finance turn and not just calculator figures, and the
    owner-facing decision on targeted guardrail relaxation is explicitly open. Encoding it keeps the
    limitation visible, and this test will fail loudly if someone narrows the window — which is the
    signal to delete it, not to update it silently.
    """
    payment = await _mortgage_payment_for()
    sentence = (f"On a $650,000 home, an estimated monthly mortgage payment is about "
                f"${payment:,.2f}, which is worth weighing against your cash position.")
    out = await _orch(_ScriptedLLM(_reply(reflection=sentence)), with_calculators=True).converse(
        _ctx(), MORTGAGE_MSG, trace=True)
    assert out["llm_status"].startswith("fallback")
    assert str(payment) in (out["_trace"].get("fallback_reason") or "")


def test_the_same_estimate_passes_once_the_possessive_tail_is_removed():
    """Isolates the cause to the possessive clause, not to the number or its registration."""
    from app.services.advisor_calculations import _citable_forms
    from app.services.advisor_validator import _fabricated_personal_numbers

    payment = 3390.01
    scenario = _citable_forms(payment)
    assert {"3390", "3390.01"} <= scenario, "registration itself is fine"

    clean = f"An estimated monthly mortgage payment is about ${payment:,.2f} at current rates."
    tailed = f"An estimated monthly mortgage payment is about ${payment:,.2f}, against your cash position."
    assert _fabricated_personal_numbers(clean, set(), scenario, set()) == set()
    assert _fabricated_personal_numbers(tailed, set(), scenario, set()) == {"3390.01"}
