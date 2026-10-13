"""The B2 treatment rules reaching the advisor (Milestone 3.1).

Eleven rules were built in Phase B2 and none of them reached a user. The tests that matter most
here are not that a rule computes — `test_tax_treatment.py` already proves that — but that the
VERDICT survives the trip: its authority, the test that decided it, and the trap it trails. A
determination reduced to its dollar figure is no longer advice.
"""
from __future__ import annotations

import pytest

from app.services.advisor_calculations import AdvisorCalculationPlanner
from app.services.advisor_calc_coverage import TREATMENT_REACH
from app.services.advisor_treatments import TreatmentPlanner
from app.services.calculators import treatment as T

from .test_advisor_calculations import _Ctx, _resolver

# A profile complete enough for every stored-fact rule to fire.
FULL = dict(
    income=180_000, filing_status="married_jointly", adjusted_gross_income=180_000,
    retirement_contribution_rate=6, employer_match_rate=4, debt_apr=0.065,
    itemized_components={"state_local_taxes": 25_000, "mortgage_interest": 20_000},
    health_coverage_tier="family", hdhp_annual_deductible=3_500,
    hdhp_out_of_pocket_max=9_000, hsa_annual_contribution=8_000, hsa_through_payroll=True,
    fsa_type="limited_purpose", covered_by_workplace_plan=True, student_loan_interest=2_400,
    debt_minimum_payments=[
        {"label": "mortgage", "balance": 450_000, "apr": 0.065,
         "minimum_payment": 2_900, "loan_type": "mortgage"},
        {"label": "heloc", "balance": 60_000, "apr": 0.079,
         "minimum_payment": 400, "loan_type": "heloc"},
        {"label": "card", "balance": 20_000, "apr": 0.22,
         "minimum_payment": 600, "loan_type": "credit_card"},
    ],
)
# The facts that arrive per turn because they describe a decision, not a person.
TURN = {"ira_contribution": 7_000, "heloc_proceeds_used_for": "home_improvement",
        "heloc_annual_interest": 3_000, "margin_annual_interest": 4_000,
        "net_investment_income": 9_000, "business_annual_interest": 12_000,
        "adjusted_taxable_income": 300_000, "gross_receipts": 2_000_000}


async def _packet(turn=None, **over):
    kw = {**FULL, **over}
    return await AdvisorCalculationPlanner(_resolver(**kw)).compute(
        _Ctx(), current_age=45, turn=turn if turn is not None else TURN)


def _rule(packet, rule_id):
    return next((t for t in packet["treatments"] if t["rule"] == rule_id), None)


# ── The inventory must match reality ─────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_ALL_ELEVEN_treatment_rules_reach_the_advisor():
    """The headline of Milestone 3.1: it was 0 of 11. A rule that is built, tested and unreachable
    is indistinguishable from one that does not exist."""
    p = await _packet()
    fired = {t["rule"] for t in p["treatments"]}
    gapped = {g.get("rule") for g in p["treatment_gaps"]}
    unaccounted = set(T.available_rules()) - fired - gapped
    assert not unaccounted, f"neither fired nor gapped: {sorted(unaccounted)}"
    assert len(fired) == len(T.available_rules()), sorted(set(T.available_rules()) - fired)


@pytest.mark.asyncio
async def test_the_coverage_inventory_lists_every_registered_rule():
    """So a new rule cannot be added without a decision about how it reaches the advisor."""
    assert set(TREATMENT_REACH) == set(T.available_rules())


# ── What must survive the trip ───────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_every_determination_arrives_with_its_AUTHORITY():
    """A determination without a citation is an opinion, and the citation is what separates this
    engine from a model guessing at tax law."""
    p = await _packet()
    assert p["treatments"]
    for t in p["treatments"]:
        assert t["authority"].strip(), t["rule"]
        assert t["determination"] in T.DETERMINATIONS


@pytest.mark.asyncio
async def test_every_determination_arrives_with_the_TEST_that_decided_it():
    p = await _packet()
    for t in p["treatments"]:
        assert t["tests"], t["rule"]
        assert all(x["why"].strip() for x in t["tests"]), t["rule"]


@pytest.mark.asyncio
async def test_an_unfavourable_determination_arrives_with_its_LEVERS():
    """"Not deductible" is a dead end. "Not deductible because the proceeds paid off credit cards
    rather than improving the residence" names the lever, and comes out of the same computation."""
    p = await _packet(turn={**TURN, "heloc_proceeds_used_for": "debt_payoff"})
    heloc = _rule(p, "debt_interest.heloc")
    assert heloc is not None
    assert heloc["determination"] == T.NOT_DEDUCTIBLE
    assert heloc["what_would_change_it"], "an unfavourable verdict must carry its levers"
    levers = " ".join(heloc["what_would_change_it"]).lower()
    assert "improv" in levers or "residence" in levers
    assert any(u["rule"] == "debt_interest.heloc" for u in p["unfavourable_with_levers"])


@pytest.mark.asyncio
async def test_the_traps_are_collected_because_that_is_where_the_money_goes():
    """Each rule trails a delayed cost generic advice omits — the pro-rata rule on a backdoor Roth,
    the 20% penalty on a non-qualified HSA withdrawal. They are invisible at the moment of the
    decision, which is the whole reason to surface them."""
    p = await _packet()
    assert len(p["tax_traps"]) >= 4
    assert all(isinstance(x, str) and x.strip() for x in p["tax_traps"])


@pytest.mark.asyncio
async def test_the_packet_tells_the_model_how_to_handle_a_determination():
    p = await _packet()
    joined = " ".join(p["constraints"])
    assert "never paraphrase" in joined.lower()
    assert "what_would_change_it" in joined
    assert "traps" in joined
    assert "question to ASK" in joined


# ── The number gate ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_quantified_amounts_reach_the_number_gate():
    """An amount the gate has not been told about is indistinguishable from a fabricated one, so
    registering it IS the wiring."""
    p = await _packet()
    allnums = set(p["allowed_numbers"]) | set(p["scenario_numbers"])
    student = _rule(p, "debt_interest.student_loan")
    assert student is not None and student["amount"]
    assert str(int(student["amount"])) in allnums


@pytest.mark.asyncio
async def test_a_RATE_is_registered_as_the_PERCENT_the_model_will_write():
    """THE BUG THIS GUARDS, in two parts. `to_calc_result` rounded every amount to 2 decimals,
    which is right for dollars and destroys a rate: an after-tax cost of 0.052298 became 0.05, so
    the determination's own summary said "5.23% after tax" while the figure beside it said 5%. And
    `_citable_forms` drops anything below 1.0 on purpose, so the decimal registered nothing at all
    — the advisor was blocked from quoting the sentence the engine wrote for it.
    """
    p = await _packet()
    atc = _rule(p, "debt_interest.after_tax_cost")
    assert atc is not None
    pct = round(atc["amount"] * 100, 2)
    allnums = set(p["allowed_numbers"]) | set(p["scenario_numbers"])
    assert str(pct) in allnums, f"{pct} not citable; the summary says {atc['summary']!r}"
    # And the precision survived rather than being rounded to a whole percent.
    assert atc["amount"] != round(atc["amount"], 2) or pct == round(pct)


def test_unit_aware_rounding_keeps_a_rate_and_still_rounds_money():
    from app.services.calculators.treatment import Test, TreatmentResult
    rate = TreatmentResult(rule="x.rate", determination=T.DEDUCTIBLE, authority="IRC §1",
                           summary="s", amount=0.052298, unit="pct",
                           tests=(Test("t", True, "why"),))
    money = TreatmentResult(rule="x.money", determination=T.DEDUCTIBLE, authority="IRC §1",
                            summary="s", amount=1234.5678, unit="usd",
                            tests=(Test("t", True, "why"),))
    assert rate.to_calc_result().value == pytest.approx(0.052298)
    assert money.to_calc_result().value == 1234.57


# ── Determinations must not contradict the figures beside them ───────────────────────────────────
@pytest.mark.asyncio
async def test_the_rules_use_the_packets_OWN_marginal_rate_and_itemizing_verdict():
    """Passed in rather than recomputed. A determination that disagreed with the number sitting
    next to it in the same packet would be worse than either alone."""
    p = await _packet()
    marginal = next((r["value"] for r in p["results"]
                     if r["calculator"] == "tax.effective_marginal_rate"), None)
    atc = _rule(p, "debt_interest.after_tax_cost")
    if marginal is not None and atc is not None:
        assert atc["inputs_used"]["marginal_rate"] == marginal


def _after_tax(packet):
    """After-tax cost results keyed by the debt they describe — one per instrument."""
    return {t["inputs_used"]["label"]: t
            for t in packet["treatments"] if t["rule"] == "debt_interest.after_tax_cost"}


@pytest.mark.asyncio
async def test_the_after_tax_cost_is_PER_INSTRUMENT_not_a_single_blended_rate():
    """THE BUG THIS GUARDS, and it was the worst of the three found in the 3.1 audit.

    This ran once on `debt_apr` — a balance-weighted blend across EVERY debt, cards included — with
    a deductible share derived only from the mortgage, HELOC and student rules that happened to
    fire. For a household with a $450,000 mortgage and a $20,000 card at 22% it produced "blended
    debt costs 6.53% after tax" with deductible_share = 1.0: the card's interest never entered the
    denominator, so the engine claimed 22% credit-card interest was fully deductible. That makes
    carrying a balance look cheap and would push someone to prepay a mortgage ahead of a card.
    """
    p = await _packet()
    costs = _after_tax(p)
    assert len(costs) >= 2, "one result per debt, not one blended result"

    card = next(v for k, v in costs.items() if "card" in k)
    assert card["inputs_used"]["deductible_share"] == 0.0, "IRC 163(h)(1) disallows personal interest"
    assert card["amount"] == pytest.approx(0.22), "a card costs its full rate after tax"

    mortgage = next(v for k, v in costs.items() if "mortgage" in k)
    assert mortgage["inputs_used"]["deductible_share"] > 0.0
    assert mortgage["amount"] < 0.065, "a deductible mortgage costs less than its stated rate"
    # And the comparison that makes the figure worth having at all.
    assert mortgage["amount"] < card["amount"]


@pytest.mark.asyncio
async def test_each_debts_share_comes_from_the_tracing_rule_that_governs_IT():
    """The HELOC's own after-tax cost must move with what the money bought, and the mortgage's must
    not — which a single blended share could never express."""
    improved = _after_tax(await _packet(
        turn={**TURN, "heloc_proceeds_used_for": "home_improvement"}))
    paid_off = _after_tax(await _packet(
        turn={**TURN, "heloc_proceeds_used_for": "debt_payoff"}))

    a = next(v for k, v in improved.items() if "heloc" in k)
    b = next(v for k, v in paid_off.items() if "heloc" in k)
    assert a["inputs_used"]["deductible_share"] > b["inputs_used"]["deductible_share"]
    assert a["amount"] < b["amount"], "deductible interest means a lower after-tax cost"

    # The mortgage is untouched by the HELOC's use.
    m1 = next(v for k, v in improved.items() if "mortgage" in k)
    m2 = next(v for k, v in paid_off.items() if "mortgage" in k)
    assert m1["amount"] == m2["amount"]


@pytest.mark.asyncio
async def test_a_debt_of_UNKNOWN_deductibility_is_a_gap_not_a_zero():
    """An unknown share is not a zero one — ranking a debt on an invented share would corrupt the
    payoff order, which is the one thing this figure exists to inform."""
    p = await _packet(turn={}, debt_minimum_payments=[
        {"label": "mystery loan", "balance": 30_000, "apr": 0.11,
         "minimum_payment": 400, "loan_type": "unknown_instrument"}])
    assert not _after_tax(p)
    gap = next(g for g in p["treatment_gaps"]
               if g.get("rule") == "debt_interest.after_tax_cost")
    assert "mystery loan" in gap["ask"]


# ── Gaps, never defaults ─────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_HELOC_without_a_stated_USE_is_a_question_not_a_guess():
    """The most consequential question in this layer: the identical loan is deductible or not on
    what the money bought. Assuming either way is a confident wrong answer."""
    p = await _packet(turn={"heloc_annual_interest": 3_000})
    assert _rule(p, "debt_interest.heloc") is None
    gap = next(g for g in p["treatment_gaps"] if g.get("rule") == "debt_interest.heloc")
    assert "heloc_proceeds_used_for" in gap["needs"]
    assert "traces to the use" in gap["ask"]


@pytest.mark.asyncio
async def test_IRA_deductibility_is_never_assumed_uncovered():
    """"Not covered by a workplace plan" makes a traditional IRA fully deductible at ANY income, so
    a false default would hand a high earner a deduction they cannot take."""
    p = await _packet(turn={"ira_contribution": 7_000}, covered_by_workplace_plan=None)
    assert _rule(p, "wrapper.ira_deduction") is None
    gap = next(g for g in p["treatment_gaps"] if g.get("rule") == "wrapper.ira_deduction")
    assert "covered_by_workplace_plan" in gap["needs"]


@pytest.mark.asyncio
async def test_funding_an_HSA_without_confirmed_HDHP_coverage_is_flagged_loudly():
    """The expensive case: contributions made without qualifying coverage are excess contributions,
    taxable and penalised at 6% a year until withdrawn."""
    p = await _packet(turn={}, health_coverage_tier=None, hdhp_annual_deductible=None,
                      hdhp_out_of_pocket_max=None)
    gap = next(g for g in p["treatment_gaps"] if g.get("rule") == "wrapper.hdhp_qualifies")
    assert "6%" in gap["ask"]


@pytest.mark.asyncio
async def test_an_FSA_with_no_stated_TYPE_is_a_question():
    """A general-purpose FSA disqualifies an HSA for the entire plan year; a limited-purpose one
    does not. The election amount cannot tell them apart."""
    p = await _packet(turn={}, fsa_type=None, fsa_election=1_200)
    assert _rule(p, "wrapper.fsa_hsa_compatibility") is None
    gap = next(g for g in p["treatment_gaps"] if g.get("rule") == "wrapper.fsa_hsa_compatibility")
    assert "fsa_type" in gap["needs"]


@pytest.mark.asyncio
async def test_the_plain_fsa_spelling_is_accepted():
    """THE BUG THIS GUARDS. The rule's alias map knew "general" but not "general_purpose" — the
    spelling the schema stores — so the rule refused for every user whose FSA type came out of the
    database, which is the only path that supplies it.
    """
    p = await _packet(turn={}, fsa_type="general_purpose")
    r = _rule(p, "wrapper.fsa_hsa_compatibility")
    assert r is not None and r["determination"] == T.INELIGIBLE


@pytest.mark.asyncio
async def test_no_FSA_at_all_does_not_run_the_compatibility_rule():
    p = await _packet(turn={}, fsa_type="none")
    assert _rule(p, "wrapper.fsa_hsa_compatibility") is None


@pytest.mark.asyncio
async def test_mortgage_interest_must_be_the_amount_PAID_not_balance_times_rate():
    """The approximation is wrong by the whole amortization schedule, and wrong in the direction of
    overstating the deduction early in a loan's life."""
    p = await _packet(turn={}, itemized_components={"state_local_taxes": 25_000})
    assert _rule(p, "debt_interest.mortgage") is None
    gap = next(g for g in p["treatment_gaps"] if g.get("rule") == "debt_interest.mortgage")
    assert "1098" in gap["ask"]


@pytest.mark.asyncio
async def test_a_401k_deferral_without_an_age_asks_for_it():
    """The catch-up contribution changes the limit at 50, so an age is not optional."""
    p = await AdvisorCalculationPlanner(
        _resolver(income=180_000, retirement_contribution_rate=6)
    ).compute(_Ctx())
    gap = next(g for g in p["treatment_gaps"] if g.get("rule") == "wrapper.k401_deferral")
    assert "current_age" in gap["needs"]


# ── Never breaks the turn ────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_an_empty_profile_yields_no_determinations_and_no_exception():
    p = await AdvisorCalculationPlanner(_resolver()).compute(_Ctx())
    assert p["treatments"] == []
    assert p["tax_traps"] == []


def test_the_planner_returns_a_shape_even_with_nothing_to_run():
    out = TreatmentPlanner().run({})
    assert out["available"] is False
    assert out["treatments"] == [] and out["amounts"] == []


@pytest.mark.asyncio
async def test_the_treatments_are_serializable():
    import json
    json.dumps(await _packet())


# ── Conflicts: a loss in progress, not a gap and not a trap ──────────────────────────────────────
@pytest.mark.asyncio
async def test_an_HSA_funded_on_a_NON_QUALIFYING_plan_reports_a_conflict_not_a_deduction():
    """THE BUG THIS GUARDS. `hdhp_ok` was computed and never consulted, so the packet carried a
    flat contradiction: "this plan does not qualify as an HDHP, so an HSA is not available" beside
    "$8,000 is deductible above the line". A model handed both will state the deduction — and the
    real outcome is an excess contribution, taxable and penalised at 6% for every year it stays in
    the account. Reporting the deduction at all is the harm.
    """
    p = await _packet(turn={}, hdhp_annual_deductible=1_000, hdhp_out_of_pocket_max=5_000)
    hdhp = _rule(p, "wrapper.hdhp_qualifies")
    assert hdhp is not None and hdhp["determination"] == T.INELIGIBLE
    assert _rule(p, "wrapper.hsa_contribution") is None, "no favourable reading of these facts"

    conflict = next(c for c in p["tax_conflicts"] if "HSA" in c["what"])
    assert conflict["amount_at_risk"] == 8_000
    assert "6%" in conflict["consequence"]
    assert "4973" in conflict["authority"]
    assert "Withdraw the excess" in conflict["what_to_do"]


@pytest.mark.asyncio
async def test_a_GENERAL_PURPOSE_FSA_also_voids_an_HSA_contribution():
    """The plan qualifies, but a general-purpose FSA disqualifies an HSA for the whole year — so
    the contribution is just as much an excess contribution."""
    p = await _packet(turn={}, fsa_type="general_purpose")
    assert _rule(p, "wrapper.hdhp_qualifies")["determination"] == T.ELIGIBLE
    assert _rule(p, "wrapper.hsa_contribution") is None
    conflict = next(c for c in p["tax_conflicts"] if "HSA" in c["what"])
    assert "general-purpose FSA" in conflict["because"]


@pytest.mark.asyncio
async def test_a_LIMITED_purpose_FSA_does_NOT_void_the_contribution():
    """The owner's own "HSA with HDHP and limited FSA" case: it works precisely because the FSA is
    limited-purpose, so the favourable determination must still be produced."""
    p = await _packet(turn={}, fsa_type="limited_purpose")
    assert p["tax_conflicts"] == []
    hsa = _rule(p, "wrapper.hsa_contribution")
    assert hsa is not None and hsa["amount"] == 8_000


@pytest.mark.asyncio
async def test_a_zero_HSA_contribution_on_a_bad_plan_is_not_a_conflict():
    """Nothing is at risk if nothing was contributed — a conflict must describe an actual loss."""
    p = await _packet(turn={}, hsa_annual_contribution=0,
                      hdhp_annual_deductible=1_000, hdhp_out_of_pocket_max=5_000)
    assert p["tax_conflicts"] == []


@pytest.mark.asyncio
async def test_the_packet_tells_the_model_a_conflict_outranks_everything():
    p = await _packet(turn={}, fsa_type="general_purpose")
    joined = " ".join(p["constraints"])
    assert "money being lost RIGHT NOW" in joined
    assert "never present the favourable reading" in joined
