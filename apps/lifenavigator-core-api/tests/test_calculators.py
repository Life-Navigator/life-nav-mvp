"""Phase 2 — the calculator registry.

HOW THESE TESTS ESTABLISH CORRECTNESS
-------------------------------------
Mostly by SIMULATION, not by restating the formula. Asserting
`amortized_payment(...) == P*r/(1-(1+r)**-n)` would only prove the test and the implementation
contain the same expression — including the same mistake. So instead the closed-form answer is fed
into a month-by-month loop (accrue interest, apply payment) and the loan is required to land at
zero. That is a genuinely independent check: a wrong formula leaves a balance behind or overpays.

The same approach covers future value, the contribution-for-target solve, and payoff months.
A handful of published reference figures (e.g. $300k at 6% over 30 years ≈ $1,798.65/mo) anchor the
absolute scale, since a self-consistent-but-misscaled model could otherwise pass every simulation.
"""
import json
import pathlib

import pytest

from app.services import calculators as C
from app.services.calculators import debt, money, retirement
from app.services.calculators.base import CalculatorError

TOL = 0.02  # two cents — these are rounded-to-cent money values


# ── Independent simulators (deliberately NOT the closed forms under test) ─────────────────────────
def simulate_loan(principal: float, apr: float, payment: float, months: int) -> float:
    """Month-by-month: accrue interest at apr/12, then pay. Returns the remaining balance."""
    bal = principal
    r = apr / 12.0
    for _ in range(months):
        bal += bal * r
        bal -= payment
    return bal


def simulate_growth(pv: float, monthly_contribution: float, annual_return: float, months: int) -> float:
    """Month-by-month: add the contribution, then grow. Ordinary annuity, matching projector.ts."""
    i = (1.0 + annual_return) ** (1.0 / 12.0) - 1.0
    bal = pv
    for _ in range(months):
        bal += monthly_contribution
        bal *= 1.0 + i
    return bal


# ── debt.amortized_payment ────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("principal,apr,months", [
    (300_000, 0.06, 360),
    (250_000, 0.055, 360),
    (30_000, 0.0749, 60),
    (12_000, 0.199, 36),
    (500_000, 0.0325, 180),
])
def test_amortized_payment_actually_retires_the_loan(principal, apr, months):
    """The independent check: run the computed payment through a month-by-month loan and require the
    balance to land at zero. A wrong exponent or a nominal/effective mix-up cannot survive this."""
    r = debt.amortized_payment(principal=principal, apr=apr, term_months=months)
    remaining = simulate_loan(principal, apr, r.value, months)
    # Within one cent per month of rounding the payment to the cent.
    assert abs(remaining) < months * 0.01 + 0.5, f"left {remaining:,.2f} outstanding"


def test_amortized_payment_matches_a_published_reference_figure():
    """Anchors absolute scale: $300,000 at 6% over 30 years is a canonical ~$1,798.65/mo."""
    r = debt.amortized_payment(principal=300_000, apr=0.06, term_months=360)
    assert abs(r.value - 1798.65) < 0.5


def test_amortized_payment_uses_the_LENDER_rate_not_the_effective_one():
    """apr/12, not (1+apr)^(1/12)-1. The effective rate is lower, so it would understate the payment
    — a figure no lender would recognise, on the single most consequential number in the module."""
    r = debt.amortized_payment(principal=300_000, apr=0.06, term_months=360)
    nominal_i = C.nominal_monthly_rate(0.06)
    effective_i = C.effective_monthly_rate(0.06)
    assert effective_i < nominal_i
    expected_effective = (300_000 * effective_i) / (1 - (1 + effective_i) ** -360)
    assert abs(r.value - expected_effective) > 10, "payment appears to use the effective rate"


def test_zero_apr_loan_is_principal_over_term():
    """A real singularity in the closed form (the denominator collapses to zero), so it has its own
    branch rather than producing a division error or an infinity."""
    r = debt.amortized_payment(principal=12_000, apr=0.0, term_months=24)
    assert r.value == 500.0
    assert r.detail["total_interest"] == 0.0


def test_amortized_payment_is_strict_tier_with_no_assumptions():
    """Arithmetic on the user's own balance/APR/term is their data, so it needs no scenario hedge."""
    r = debt.amortized_payment(principal=200_000, apr=0.05, term_months=360)
    assert r.tier == C.STRICT
    assert r.assumptions == ()
    assert r.unit == "usd_per_month"


def test_total_interest_is_consistent_with_the_payment():
    pay = debt.amortized_payment(principal=300_000, apr=0.06, term_months=360)
    tot = debt.total_interest(principal=300_000, apr=0.06, term_months=360)
    assert abs(tot.value - (pay.value * 360 - 300_000)) < TOL
    # The number that actually changes behaviour: lifetime interest exceeds the principal here.
    assert tot.value > 300_000


# ── debt.payoff_months ────────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("balance,apr,payment", [
    (5_000, 0.22, 250),
    (22_000, 0.07, 400),
    (1_500, 0.0, 100),
    (40_000, 0.045, 600),
])
def test_payoff_months_clears_the_balance_when_simulated(balance, apr, payment):
    """Simulated for the returned number of months, the balance must be gone — and NOT already gone
    a month earlier, which would mean the answer is too large."""
    r = debt.payoff_months(balance=balance, apr=apr, monthly_payment=payment)
    n = int(r.value)
    assert simulate_loan(balance, apr, payment, n) <= 0.01, "not paid off by month n"
    if n > 1:
        assert simulate_loan(balance, apr, payment, n - 1) > 0, "would have cleared a month earlier"


def test_payoff_refuses_a_payment_that_never_clears():
    """$80/mo against $5,000 at 22% does not even cover the ~$91 first month of interest. Returning a
    big number would let that be reported as a long payoff; it is actually a balance that GROWS, and
    saying so is the most important thing the advisor could convey here."""
    with pytest.raises(CalculatorError, match="never clears"):
        debt.payoff_months(balance=5_000, apr=0.22, monthly_payment=80)


def test_payoff_refuses_a_payment_exactly_equal_to_the_interest():
    """The boundary: interest-only payments hold the balance forever."""
    interest_only = 5_000 * (0.22 / 12)
    with pytest.raises(CalculatorError):
        debt.payoff_months(balance=5_000, apr=0.22, monthly_payment=interest_only)


# ── debt.avalanche_order ──────────────────────────────────────────────────────────────────────────
def test_avalanche_orders_by_apr_descending():
    r = debt.avalanche_order(debts=[
        {"label": "student", "balance": 22_000, "apr": 0.07},
        {"label": "card", "balance": 4_500, "apr": 0.22},
        {"label": "auto", "balance": 9_000, "apr": 0.049},
    ])
    assert r.detail["order"] == ["card", "student", "auto"]
    assert r.detail["target"] == "card"
    assert r.detail["total_balance"] == 35_500.0


def test_avalanche_tie_keeps_input_order():
    """Deterministic on ties: identical-APR debts must not swap between turns and make the advice
    look unstable."""
    rows = [{"label": "a", "balance": 100, "apr": 0.1}, {"label": "b", "balance": 200, "apr": 0.1}]
    for _ in range(10):
        assert debt.avalanche_order(debts=rows).detail["order"] == ["a", "b"]


def test_avalanche_value_is_a_count_not_a_citable_dollar_figure():
    """The ordering is a list; lists cannot enter the number allowlist as figures, so the cited value
    is the count and the ordering lives in `detail`."""
    r = debt.avalanche_order(debts=[{"label": "a", "balance": 100, "apr": 0.1}])
    assert r.unit == "count"
    assert r.value == 1.0


def test_avalanche_needs_at_least_one_debt():
    with pytest.raises(CalculatorError):
        debt.avalanche_order(debts=[])


# ── money.future_value ───────────────────────────────────────────────────────────────────────────
@pytest.mark.parametrize("pv,contrib,ret,months", [
    (10_000, 0, 0.06, 120),
    (0, 500, 0.07, 240),
    (25_000, 750, 0.05, 360),
    (100_000, 0, 0.04, 12),
])
def test_future_value_matches_an_independent_month_by_month_simulation(pv, contrib, ret, months):
    r = money.future_value(present_value=pv, months=months, annual_return=ret,
                           monthly_contribution=contrib)
    expected = simulate_growth(pv, contrib, ret, months)
    assert abs(r.value - expected) < max(0.05, abs(expected) * 1e-9)


def test_future_value_uses_effective_compounding_so_one_year_yields_exactly_the_annual_rate():
    """The discriminating case: 12 months at 6% must return exactly 6%. With r/12 it would compound
    to ~6.17%, and that error grows with the horizon."""
    r = money.future_value(present_value=100_000, months=12, annual_return=0.06)
    assert abs(r.value - 106_000.0) < 0.01


def test_future_value_is_scenario_tier_and_carries_its_assumption():
    r = money.future_value(present_value=10_000, months=120, annual_return=0.06)
    assert r.tier == C.SCENARIO
    assert [a.key for a in r.assumptions] == ["annual_return"]


def test_future_value_without_a_rate_cites_the_CENTRAL_assumption_registry():
    """An unstated rate must come from app/services/assumptions.py, never a constant in the
    calculator module.

    That registry states the rule outright: "no projection may invent an assumption inline". The
    first cut of these calculators broke it, hardcoding a 5% "real (after-inflation)" return while
    the registry's investment_return is 6% NOMINAL — two different numbers meaning two different
    things, so the same user could get two different projections depending on which code path
    answered. The registry's `basis` text is also what the user is shown, so the rationale is the
    platform's stated reasoning rather than a sentence invented here.
    """
    from app.services import assumptions as A

    r = money.future_value(present_value=10_000, months=120)
    assert r.tier == C.SCENARIO
    assumption = r.assumptions[0]
    assert assumption.key == "investment_return"
    assert assumption.source == "registry"
    assert assumption.value == A.value("investment_return")
    assert r.inputs_used["annual_return"] == A.value("investment_return")
    # The rationale carries the registry's own basis, verbatim.
    assert A.get("investment_return").basis in assumption.rationale


def test_a_caller_supplied_rate_is_marked_as_coming_from_the_caller():
    """The registry/caller distinction has to survive into the citation, or an audit cannot tell
    whose assumption produced the number."""
    r = money.future_value(present_value=10_000, months=120, annual_return=0.08)
    assert r.assumptions[0].source == "caller"
    assert r.assumptions[0].value == 0.08


def test_no_calculator_hardcodes_a_rate_the_registry_already_owns():
    """Drift gate. A rate constant reintroduced into a calculator module would silently diverge from
    the registry and nothing else would notice."""
    import pathlib as _p
    pkg = _p.Path(money.__file__).parent
    for mod in ("money.py", "retirement.py", "debt.py"):
        src = (pkg / mod).read_text()
        for banned in ("_DEFAULT_REAL_RETURN", "_DEFAULT_WITHDRAWAL_RATE"):
            assert banned not in src, f"{mod} reintroduced {banned}; use base.from_registry instead"


def test_future_value_separates_contributions_from_growth():
    r = money.future_value(present_value=0, months=240, annual_return=0.07,
                           monthly_contribution=500)
    assert r.detail["total_contributed"] == 120_000.0
    assert r.detail["growth_earned"] > 0
    assert abs(r.value - (r.detail["total_contributed"] + r.detail["growth_earned"])) < 0.05


def test_future_value_needs_something_to_grow():
    with pytest.raises(CalculatorError):
        money.future_value(present_value=0, months=120, annual_return=0.06)


# ── money.monthly_contribution_for_target ────────────────────────────────────────────────────────
@pytest.mark.parametrize("target,current,months,ret", [
    (100_000, 10_000, 120, 0.06),
    (50_000, 0, 60, 0.05),
    (1_000_000, 250_000, 300, 0.07),
    (20_000, 5_000, 36, 0.0),
])
def test_contribution_for_target_actually_reaches_the_target(target, current, months, ret):
    """Solve, then simulate forward with that contribution and require it to land on the target.

    When the existing balance already grows PAST the target unaided (e.g. $250k at 7% for 25 years
    reaches $1.36M on its own), the correct contribution is zero and landing exactly on the target is
    impossible — so the requirement there is "reaches at least the target", which is the real
    guarantee. Demanding exact arrival would be demanding the calculator return a NEGATIVE
    contribution.
    """
    r = money.monthly_contribution_for_target(target=target, current=current, months=months,
                                              annual_return=ret)
    landed = simulate_growth(current, r.value, ret, months)
    if r.detail["already_on_track"]:
        assert r.value == 0.0
        assert landed >= target
    else:
        assert abs(landed - target) < max(1.0, target * 1e-6), \
            f"landed at {landed:,.2f}, wanted {target:,.2f}"


def test_contribution_for_target_lands_exactly_when_saving_is_actually_required():
    """The exact-arrival guarantee, on a case that genuinely needs contributions."""
    target, current, months, ret = 1_000_000.0, 250_000.0, 120, 0.07
    r = money.monthly_contribution_for_target(target=target, current=current, months=months,
                                              annual_return=ret)
    assert r.value > 0 and r.detail["already_on_track"] is False
    assert abs(simulate_growth(current, r.value, ret, months) - target) < 1.0


def test_contribution_for_target_grows_the_existing_balance_unlike_the_typescript_version():
    """Deliberate divergence from TS `calculateMonthlyContribution`, which solves
    `(target - current) / annuity_factor` and so ignores growth on the CURRENT balance. That
    overstates the required saving. Documented here so the difference is a decision, not a drift.
    """
    target, current, months, ret = 100_000.0, 50_000.0, 120, 0.06
    ours = money.monthly_contribution_for_target(target=target, current=current, months=months,
                                                 annual_return=ret).value

    i_nominal = ret / 12.0  # the TS version also uses the nominal monthly rate
    ts_factor = ((1 + i_nominal) ** months - 1) / i_nominal
    ts_answer = (target - current) / ts_factor

    assert ours < ts_answer, "ignoring growth on the existing balance must demand MORE saving"
    # And ours is the one that actually lands on target.
    assert abs(simulate_growth(current, ours, ret, months) - target) < 1.0
    assert simulate_growth(current, ts_answer, ret, months) > target + 1_000


def test_contribution_is_zero_when_the_balance_already_gets_there():
    """A real answer — "you don't need to add anything" — not a negative contribution."""
    r = money.monthly_contribution_for_target(target=100_000, current=99_000, months=360,
                                              annual_return=0.06)
    assert r.value == 0.0
    assert r.detail["already_on_track"] is True
    assert r.detail["current_balance_grows_to"] > 100_000


# ── money.monthly_surplus ────────────────────────────────────────────────────────────────────────
def test_monthly_surplus_is_strict_and_has_no_assumptions():
    r = money.monthly_surplus(monthly_income=7_000, monthly_expenses=4_500)
    assert r.value == 2_500.0
    assert r.tier == C.STRICT
    assert r.assumptions == ()
    assert r.detail["savings_rate_pct"] == pytest.approx(35.7, abs=0.1)


def test_monthly_surplus_reports_a_deficit_rather_than_clamping_it():
    """Clamping a deficit to zero would hide the single most important fact about the budget."""
    r = money.monthly_surplus(monthly_income=4_000, monthly_expenses=5_200)
    assert r.value == -1_200.0
    assert r.detail["is_deficit"] is True


# ── retirement ───────────────────────────────────────────────────────────────────────────────────
def test_projected_balance_agrees_with_the_growth_simulation():
    r = retirement.projected_balance(current_balance=120_000, current_age=40, target_age=65,
                                     monthly_contribution=1_000, annual_return=0.06)
    expected = simulate_growth(120_000, 1_000, 0.06, 25 * 12)
    assert abs(r.value - expected) < 0.05
    assert r.inputs_used["years_to_target"] == 25


def test_projected_balance_is_always_scenario_tier():
    r = retirement.projected_balance(current_balance=120_000, current_age=40, target_age=65,
                                     annual_return=0.06)
    assert r.tier == C.SCENARIO
    assert r.assumptions


def test_projection_refuses_a_target_age_at_or_before_the_current_age():
    for tgt in (40, 39):
        with pytest.raises(CalculatorError, match="must be after"):
            retirement.projected_balance(current_balance=1, current_age=40, target_age=tgt)


def test_sustainable_income_defaults_to_the_four_percent_rule_and_says_so():
    r = retirement.sustainable_income(balance=1_000_000)
    assert r.value == 40_000.0
    assert r.detail["monthly"] == pytest.approx(3_333.33, abs=0.01)
    assert r.tier == C.SCENARIO
    # Cited from the central registry, whose basis names Bengen/Trinity — the hedge is part of the
    # number rather than something the prompt has to remember to add.
    from app.services import assumptions as A
    assert r.assumptions[0].key == "withdrawal_rate"
    assert r.assumptions[0].source == "registry"
    assert r.assumptions[0].value == A.value("withdrawal_rate")
    assert "4%" in r.assumptions[0].rationale


def test_balance_needed_is_the_inverse_of_sustainable_income():
    need = retirement.balance_needed(desired_annual_income=80_000)
    assert need.value == 2_000_000.0
    assert need.detail["multiple_of_income"] == 25.0
    back = retirement.sustainable_income(balance=need.value)
    assert abs(back.value - 80_000.0) < TOL


def test_withdrawal_rate_of_zero_is_refused():
    """0% would divide by zero in balance_needed and return $0 income in the other direction."""
    with pytest.raises(CalculatorError):
        retirement.balance_needed(desired_annual_income=80_000, withdrawal_rate=0.0)
    with pytest.raises(CalculatorError):
        retirement.sustainable_income(balance=1_000_000, withdrawal_rate=0.0)


# ── Contract-wide invariants ─────────────────────────────────────────────────────────────────────
def test_every_registered_calculator_is_addressable_by_its_reported_id():
    """A cited figure must be traceable to the function that produced it."""
    assert len(C.available()) == 10
    for calc_id in C.available():
        assert C.get(calc_id) is not None


def test_a_result_that_made_assumptions_cannot_claim_strict_tier():
    """The mechanical rule. A result resting on an assumed rate but labelled strict would bypass the
    hedge `advisor_validator._SCENARIO_LABEL` looks for — which is how an estimate gets read as a
    fact about the user's money."""
    from app.services.calculators.base import Assumption, CalcResult
    with pytest.raises(CalculatorError, match="must be"):
        CalcResult(calculator="x", label="l", value=1.0, unit="usd", tier=C.STRICT,
                   assumptions=(Assumption("annual_return", 0.06, "why"),))


def test_unknown_unit_is_rejected():
    from app.services.calculators.base import CalcResult
    with pytest.raises(CalculatorError, match="unknown unit"):
        CalcResult(calculator="x", label="l", value=1.0, unit="bananas", tier=C.STRICT)


@pytest.mark.parametrize("bad_rate", [7, 22, 100, 6.5])
def test_a_percent_passed_where_a_decimal_belongs_is_rejected_loudly(bad_rate):
    """`annualReturn / 12 / 100` in the TS goals helper vs a decimal in projector.ts is a live
    inconsistency in the existing code. Silently accepting 7 as 700%/yr would produce a confidently
    absurd projection, so one convention is admitted and the other is an error."""
    with pytest.raises(CalculatorError, match="looks like a percent"):
        money.future_value(present_value=1_000, months=12, annual_return=bad_rate)


def test_nan_and_infinity_are_rejected_before_they_can_be_cited():
    """NaN propagates silently through arithmetic and would surface to the user as "nan"."""
    for bad in (float("nan"), float("inf"), float("-inf")):
        with pytest.raises(CalculatorError, match="finite"):
            money.monthly_surplus(monthly_income=bad, monthly_expenses=0)


def test_negative_money_is_rejected():
    with pytest.raises(CalculatorError, match="negative"):
        debt.amortized_payment(principal=-1, apr=0.05, term_months=360)


def test_results_are_json_serializable_for_the_context_packet():
    """Phase 3 puts these in the advisor prompt, which is JSON-serialized. A dataclass or tuple
    leaking through would fail at request time, not here."""
    r = retirement.projected_balance(current_balance=120_000, current_age=40, target_age=65,
                                     monthly_contribution=1_000)
    json.dumps(r.as_dict())
    cited = r.as_dict()["assumptions"][0]
    assert cited["key"] == "investment_return"
    assert cited["source"] == "registry"


def test_every_calculator_is_deterministic():
    """Same inputs → byte-identical output. A figure that moved between turns would make the advisor
    look like it was guessing."""
    cases = [
        (debt.amortized_payment, {"principal": 300_000, "apr": 0.06, "term_months": 360}),
        (money.future_value, {"present_value": 10_000, "months": 120, "annual_return": 0.06}),
        (money.monthly_contribution_for_target,
         {"target": 100_000, "current": 10_000, "months": 120, "annual_return": 0.06}),
        (retirement.sustainable_income, {"balance": 1_000_000}),
    ]
    for fn, kwargs in cases:
        first = fn(**kwargs).as_dict()
        for _ in range(5):
            assert fn(**kwargs).as_dict() == first


# ── Cross-language parity fixture ────────────────────────────────────────────────────────────────
_FIXTURE = pathlib.Path(__file__).resolve().parents[3] / "fixtures" / "financial-parity.json"


def test_parity_fixture_exists_and_this_engine_matches_it():
    """The shared golden fixture both engines read.

    Financial math now lives in Python (this module, reachable by the advisor) and in TypeScript
    (`trajectory/projector.ts`, used by the UI). Two engines WILL diverge unless something forces
    them to agree, and this repo already carries the scars of duplicated sources of truth. The
    fixture is that forcing function: a matching test on the TS side reads the same file, so a change
    to either engine's primitives breaks a test rather than quietly producing two different answers
    to the same question.
    """
    assert _FIXTURE.exists(), f"missing parity fixture at {_FIXTURE}"
    spec = json.loads(_FIXTURE.read_text())

    for case in spec["amortized_payment"]:
        got = debt.amortized_payment(principal=case["principal"], apr=case["apr"],
                                     term_months=case["term_months"]).value
        assert abs(got - case["expected_monthly_payment"]) < TOL, case

    for case in spec["effective_monthly_rate"]:
        got = C.effective_monthly_rate(case["annual_rate"])
        assert abs(got - case["expected"]) < 1e-12, case

    for case in spec["nominal_monthly_rate"]:
        got = C.nominal_monthly_rate(case["annual_rate"])
        assert abs(got - case["expected"]) < 1e-12, case

    for case in spec["future_value"]:
        got = money.future_value(present_value=case["present_value"], months=case["months"],
                                 annual_return=case["annual_return"],
                                 monthly_contribution=case["monthly_contribution"]).value
        assert abs(got - case["expected"]) < TOL, case
