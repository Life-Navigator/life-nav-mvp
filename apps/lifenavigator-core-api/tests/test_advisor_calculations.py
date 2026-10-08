"""Phase 3 — wiring the calculators into the advisor, and the trust boundary it must not cross.

The two properties that matter:
  1. NO INVENTED INPUTS. A calculator runs only when every input is real (canonical finance data or
     user-stated). Anything else is a named gap carrying the resolver's own prompt, so the advisor
     ASKS. A fabricated input would produce a figure the gate ADMITS, because it was computed
     server-side — which is strictly worse than a figure the gate rejects.
  2. TIERING IS LOAD-BEARING. Strict results (arithmetic on the user's own numbers) join Tier 1 and
     may be stated plainly. Scenario results (resting on an assumption) join Tier 3, where the
     validator blocks them inside a possessive personal claim. If everything landed in Tier 1, a
     25-year projection could be asserted as the user's present balance.
"""
import pytest

from app.services import assumptions as A
from app.services.advisor_calculations import AdvisorCalculationPlanner, _as_decimal_rate


class _Ctx:
    user_id = "u-1"


def _field(value, present=True, prompt="Add it."):
    return {"value": value, "present": present, "prompt": prompt, "unlocks": []}


def _resolver(**overrides):
    """A fake FinancialInputResolver carrying the real field shape (value/present/prompt)."""
    inputs = {
        "income": _field(None, False, "What's your annual income?"),
        "cash_balance": _field(None, False, "Enter your cash balance."),
        "investment_balance": _field(None, False, "Add investments."),
        "retirement_balance": _field(None, False, "No retirement balances on file."),
        "debt_total": _field(None, False, "Add your debts to optimize payoff."),
        "debt_apr": _field(None, False, "What APR are you paying on your debt?"),
        "retirement_contribution_rate": _field(None, False, "Enter your 401(k) rate."),
        "employer_match_rate": _field(None, False, "What's your match?"),
        "risk_profile": _field(None, False, "How do you handle uncertainty?"),
        "time_horizon": _field(None, False, "When do you hope to reach your goal?"),
        "housing_target": _field(None, False, "What home price are you considering?"),
    }
    for k, v in overrides.items():
        inputs[k] = _field(v, v is not None)

    class _R:
        async def resolve(self, ctx):
            return {"inputs": inputs}

    return _R()


def _by_id(packet, calc_id):
    return next((r for r in packet["results"] if r["calculator"] == calc_id), None)


def _gap_for(packet, calc_id):
    return next((g for g in packet["gaps"] if g.get("calculator") == calc_id), None)


# ── Rule 1: nothing runs on invented inputs ──────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_empty_profile_computes_nothing_and_names_every_gap():
    """A user with no finance data gets ZERO figures. The failure mode being prevented: a
    server-computed number from a defaulted input is grounded, so the gate admits it — a fabrication
    with a clean bill of health."""
    p = AdvisorCalculationPlanner(_resolver())
    out = await p.compute(_Ctx())
    assert out["available"] is False
    assert out["results"] == []
    assert out["allowed_numbers"] == []
    assert out["scenario_numbers"] == []
    assert out["gaps"], "gaps must be named, not silently empty"


@pytest.mark.asyncio
async def test_gaps_carry_the_resolvers_own_prompt_so_the_advisor_asks_the_right_question():
    p = AdvisorCalculationPlanner(_resolver())
    out = await p.compute(_Ctx())
    gap = _gap_for(out, "retirement.sustainable_income")
    assert gap is not None
    assert "retirement balances" in " ".join(gap["ask"]).lower()


@pytest.mark.asyncio
async def test_a_missing_age_is_a_gap_not_a_guessed_horizon():
    """A retirement projection is dominated by its horizon. Guessing 40-to-65 would make the single
    most consequential input invisible."""
    p = AdvisorCalculationPlanner(_resolver(retirement_balance=250_000))
    out = await p.compute(_Ctx())
    assert _by_id(out, "retirement.projected_balance") is None
    gap = _gap_for(out, "retirement.projected_balance")
    assert set(gap["needs"]) == {"current_age", "target_retirement_age"}
    assert "won't guess" in " ".join(gap["ask"]).lower()

    # Supplied, it runs.
    out2 = await p.compute(_Ctx(), current_age=40, target_retirement_age=65)
    r = _by_id(out2, "retirement.projected_balance")
    assert r is not None and r["value"] > 250_000


@pytest.mark.asyncio
async def test_debt_payoff_needs_an_apr_and_a_payment_before_it_will_run():
    """finance_scenarios' own note says its payoff "excludes interest — a precise payoff needs each
    debt's APR". This is the calculator that does it properly, so it must not run without the APR."""
    p = AdvisorCalculationPlanner(_resolver(debt_total=22_000))
    out = await p.compute(_Ctx())
    assert _by_id(out, "debt.payoff_months") is None
    assert set(_gap_for(out, "debt.payoff_months")["needs"]) == {"debt_apr", "monthly_payment"}

    out2 = await AdvisorCalculationPlanner(
        _resolver(debt_total=22_000, debt_apr=0.07)
    ).compute(_Ctx(), monthly_debt_payment=400)
    r = _by_id(out2, "debt.payoff_months")
    assert r is not None and r["value"] > 0


@pytest.mark.asyncio
async def test_a_payment_that_never_clears_becomes_a_SPOKEN_refusal_not_a_silent_drop():
    """$80/mo against $22k at 22% does not cover the interest. "This balance grows" is the most
    important thing the advisor could say, so the refusal is surfaced as a gap with its reason —
    swallowing it would lose the finding entirely."""
    p = AdvisorCalculationPlanner(_resolver(debt_total=22_000, debt_apr=0.22))
    out = await p.compute(_Ctx(), monthly_debt_payment=80)
    assert _by_id(out, "debt.payoff_months") is None
    refusal = next((g for g in out["gaps"] if "refused" in g), None)
    assert refusal is not None
    assert "never clears" in refusal["refused"]


# ── Rule 2: the tiers are separated ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_strict_results_go_to_tier1_and_scenario_results_to_tier3():
    """The property that makes `tier` load-bearing. A projection in Tier 1 could be stated as the
    user's current balance; in Tier 3 the validator blocks exactly that phrasing."""
    p = AdvisorCalculationPlanner(_resolver(retirement_balance=500_000))
    out = await p.compute(_Ctx(), monthly_income=7_000, monthly_expenses=4_500)

    surplus = _by_id(out, "money.monthly_surplus")
    assert surplus["tier"] == "strict" and surplus["value"] == 2_500.0
    income = _by_id(out, "retirement.sustainable_income")
    assert income["tier"] == "scenario"

    # 2,500 is the user's own arithmetic → Tier 1. The 20,000 withdrawal is an assumption → Tier 3.
    assert "2500" in out["allowed_numbers"]
    assert "2500" not in out["scenario_numbers"]
    assert "20000" in out["scenario_numbers"]
    assert "20000" not in out["allowed_numbers"]


@pytest.mark.asyncio
async def test_no_value_appears_in_both_tiers():
    """Tier 1 bypasses every check; Tier 3 does not. A value in both would silently get Tier 1's
    permissions, making the distinction decorative."""
    p = AdvisorCalculationPlanner(_resolver(retirement_balance=500_000, income=120_000))
    out = await p.compute(_Ctx(), monthly_income=7_000, monthly_expenses=4_500)
    assert set(out["allowed_numbers"]).isdisjoint(set(out["scenario_numbers"]))


@pytest.mark.asyncio
async def test_a_mortgage_payment_built_from_registry_rates_is_a_SCENARIO_not_a_strict_fact():
    """`debt.amortized_payment` is strict about what it is handed, but here the rate, term and
    down-payment all came from the assumption registry — only the price is the user's. Tiering has to
    follow where the INPUTS came from, or an estimated payment gets stated as "your payment"."""
    p = AdvisorCalculationPlanner(_resolver())
    out = await p.compute(_Ctx(), home_price_goal=500_000)
    r = _by_id(out, "debt.amortized_payment")
    assert r is not None
    assert r["tier"] == "scenario"
    assert "estimated" in r["label"]
    cited = {a["key"] for a in r["assumptions"]}
    assert cited == {"down_payment_pct", "mortgage_rate", "mortgage_term_months"}
    assert all(a["source"] == "registry" for a in r["assumptions"])
    # 80% of $500k at the registry's rate/term — a real payment, not a round number.
    assert 2_000 < r["value"] < 4_000
    assert str(round(r["value"])) in out["scenario_numbers"]


@pytest.mark.asyncio
async def test_every_scenario_result_names_at_least_one_assumption():
    """A scenario figure with no stated assumption is indistinguishable from an invented one."""
    p = AdvisorCalculationPlanner(_resolver(retirement_balance=500_000, income=120_000))
    out = await p.compute(_Ctx(), home_price_goal=400_000, monthly_income=7_000,
                          monthly_expenses=4_500)
    for r in out["results"]:
        if r["tier"] == "scenario":
            assert r["assumptions"], f"{r['calculator']} is a scenario with no assumptions"


# ── APR units: the repo is genuinely inconsistent, so the planner must be defensive ──────────────
@pytest.mark.parametrize("raw,expected", [
    (0.22, 0.22),     # decimal, as migration 062 documents
    (22, 0.22),       # percent, as services/tools.py expects
    (7.5, 0.075),
    (0.0749, 0.0749),
    (1.0, 1.0),       # boundary: 100% as a decimal
])
def test_apr_is_normalized_from_either_convention(raw, expected):
    """Migration 062 documents `interest_rate` as "APR as decimal (e.g. 0.2199)"; services/tools.py
    divides by 100. Real rows may be either, and reading 22 as 2,200%/yr would produce a confidently
    absurd payoff that still passes the gate."""
    assert _as_decimal_rate(raw) == pytest.approx(expected)


@pytest.mark.parametrize("bad", [None, "", "abc", 0, -5, float("nan")])
def test_unusable_apr_is_none_so_the_calculator_simply_does_not_run(bad):
    assert _as_decimal_rate(bad) is None


# ── Assumptions come from the registry, never from this module ───────────────────────────────────
@pytest.mark.asyncio
async def test_mortgage_assumptions_track_the_registry_not_a_local_constant():
    p = AdvisorCalculationPlanner(_resolver())
    out = await p.compute(_Ctx(), home_price_goal=600_000)
    r = _by_id(out, "debt.amortized_payment")
    cited = {a["key"]: a["value"] for a in r["assumptions"]}
    assert cited["mortgage_rate"] == A.value("mortgage_rate")
    assert cited["down_payment_pct"] == A.value("down_payment_pct")
    assert cited["mortgage_term_months"] == A.value("mortgage_term_months")
    # Principal follows the registry's down-payment assumption, not a hardcoded 20%.
    assert r["inputs_used"]["principal"] == pytest.approx(600_000 * (1 - A.value("down_payment_pct")))


# ── Failure posture ──────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_resolver_failure_degrades_to_empty_and_never_raises_into_the_turn():
    """Grounding is an enhancement. A finance-data outage must cost the user figures, not an answer."""
    class _Broken:
        async def resolve(self, ctx):
            raise RuntimeError("supabase down")

    out = await AdvisorCalculationPlanner(_Broken()).compute(_Ctx())
    assert out["available"] is False
    assert out["results"] == [] and out["allowed_numbers"] == []
    assert "unavailable" in out["gaps"][0]


@pytest.mark.asyncio
async def test_packet_is_json_serializable():
    import json
    p = AdvisorCalculationPlanner(_resolver(retirement_balance=500_000, income=120_000))
    out = await p.compute(_Ctx(), home_price_goal=500_000, monthly_income=7_000,
                          monthly_expenses=4_500)
    json.dumps(out)


@pytest.mark.asyncio
async def test_packet_states_the_presentation_constraints_the_advisor_must_follow():
    p = AdvisorCalculationPlanner(_resolver(retirement_balance=500_000))
    out = await p.compute(_Ctx())
    joined = " ".join(out["constraints"]).lower()
    assert "scenario" in joined and "estimate" in joined
    assert "ask" in joined  # a gap is a question, never a number to assume


# ── Context + validator integration ──────────────────────────────────────────────────────────────
def test_advisor_context_carries_both_tiers_and_defaults_them_empty():
    """Default-empty matters: a context built without the planner must behave exactly as before."""
    from app.services.advisor_context import AdvisorContext
    c = AdvisorContext(user_id="u", user_message="hi", current_stage="discovery",
                       life_vision=None, primary_objective=None, candidate_goals=[],
                       rejected_goals=[], risks=[], opportunities=[], constraints=[],
                       domains_touched=[], missing_areas=[], discovery_pct=0,
                       allowed_numbers={"100"}, confirmed_facts=[], assumptions=[],
                       discovery_scores={}, domain_priorities=[])
    assert c.scenario_numbers == set()
    assert c.calculations is None
    assert "calculations" in c.prompt_dict()


def test_validator_treats_context_scenario_numbers_as_tier3_not_tier1():
    """End of the chain: a projection may illustrate but must not be asserted as the user's money.

    Tier 3's rule is "allowed EXCEPT inside a possessive personal claim", so the same figure passes
    as an illustration and is blocked as a possessive claim about current holdings.
    """
    from app.services.advisor_validator import _fabricated_personal_numbers

    allowed: set[str] = set()
    scenario = {"1200000"}

    illustrative = "At that pace the balance projects to roughly $1,200,000 — an estimate, not a promise."
    assert _fabricated_personal_numbers(illustrative, allowed, scenario, set()) == set()

    # And a figure in NEITHER tier is still caught, so the union did not widen the gate generally.
    assert _fabricated_personal_numbers(
        "Your retirement account currently holds $987,654.", allowed, scenario, set()
    )


# ── The allowlist must not be loosened by junk values ────────────────────────────────────────────
def test_zero_and_sub_unit_values_are_never_registered():
    """Found by inspecting a real packet: `'0'` was in the scenario set, because a nil
    `total_contributed` lands in `detail`.

    Registering "0" would license the most common token in financial prose inside any sentence,
    including a claim about the user's balance. A rate like 0.04 is worse — through the gate's own
    notation forms it also reduces to "0". Rates are cited as named assumptions, never as figures.
    """
    from app.services.advisor_calculations import _citable_forms
    for junk in (0.0, -0.0, 0.04, 0.9, -0.5, float("nan")):
        assert _citable_forms(junk) == set(), junk
    # Real figures still register, in every notation the gate normalizes against.
    assert "45000" in _citable_forms(45_000.0)
    assert _citable_forms(1.0)


@pytest.mark.asyncio
async def test_a_real_packet_contains_no_zero_in_either_tier():
    p = AdvisorCalculationPlanner(_resolver(retirement_balance=310_000, income=140_000,
                                            debt_total=24_500, debt_apr=6.9))
    out = await p.compute(_Ctx(), home_price_goal=650_000, monthly_income=8_200,
                          monthly_expenses=5_400, monthly_debt_payment=600,
                          current_age=41, target_retirement_age=65)
    assert out["available"] is True
    assert "0" not in out["allowed_numbers"]
    assert "0" not in out["scenario_numbers"]
    # And the packet is still substantive — six figures the gate previously made unsayable.
    assert len(out["results"]) >= 5


@pytest.mark.asyncio
async def test_percent_apr_from_the_database_produces_a_sane_payoff():
    """6.9 stored as a percent must become 0.069, not 690%. At 690% the payoff would be absurd (or
    refused), and either way the number would be confidently wrong."""
    p = AdvisorCalculationPlanner(_resolver(debt_total=24_500, debt_apr=6.9))
    out = await p.compute(_Ctx(), monthly_debt_payment=600)
    r = _by_id(out, "debt.payoff_months")
    assert r is not None
    assert 40 <= r["value"] <= 55, r["value"]
    assert r["inputs_used"]["apr"] == pytest.approx(0.069)


# ── Strict tier reachability (found by the Phase 2+3 confirmation pass) ──────────────────────────
@pytest.mark.asyncio
async def test_monthly_income_is_derived_from_the_resolvers_annual_income():
    """Without this the strict tier was unreachable in production.

    `advisor_context` sources cash flow from `finance_scenarios.cash_flow`, but it calls that engine
    with `home_price_goal` ONLY — so its `monthly_income` is always None, so `money.monthly_surplus`
    could never fire, so every figure the advisor received was a scenario. Deriving from the
    resolver's canonical annual income makes the strict path real rather than theoretical.
    """
    p = AdvisorCalculationPlanner(_resolver(income=146_400))
    out = await p.compute(_Ctx(), monthly_expenses=5_400)   # note: no monthly_income passed
    r = _by_id(out, "money.monthly_surplus")
    assert r is not None
    assert r["inputs_used"]["monthly_income"] == pytest.approx(12_200.0)
    assert r["value"] == 6_800.0
    assert r["tier"] == "strict"
    assert "6800" in out["allowed_numbers"]


@pytest.mark.asyncio
async def test_without_any_income_source_the_surplus_stays_an_honest_gap():
    p = AdvisorCalculationPlanner(_resolver())
    out = await p.compute(_Ctx(), monthly_expenses=5_400)
    assert _by_id(out, "money.monthly_surplus") is None
    assert _gap_for(out, "money.monthly_surplus") is not None


@pytest.mark.asyncio
async def test_an_explicit_monthly_income_still_wins_over_the_derived_one():
    """A figure the user states this turn is more current than the annual income on file."""
    p = AdvisorCalculationPlanner(_resolver(income=146_400))
    out = await p.compute(_Ctx(), monthly_income=9_000, monthly_expenses=5_400)
    assert _by_id(out, "money.monthly_surplus")["value"] == 3_600.0
