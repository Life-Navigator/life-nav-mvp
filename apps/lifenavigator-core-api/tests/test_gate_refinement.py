"""Finance 3-tier number policy + health medical-regex refinement (Advisor Quality sprint)."""
from __future__ import annotations

from app.services.advisor_validator import _ADVICE, _fabricated_personal_numbers


def blocked(text, allowed=None):
    return _fabricated_personal_numbers(text, set(allowed or []))


# ── Finance: Tier 1 — fabricated PERSONAL holdings stay blocked ──────────────────────────────────────────
def test_block_fabricated_net_worth():
    assert "1200000" in blocked("Your net worth is $1,200,000.")


def test_block_personal_total_even_when_hedged():
    # "about" must NOT excuse a (wrong/ungrounded) claim about the user's actual assets.
    assert "150000" in blocked("Your liquid assets total about $150,000.")


def test_block_fabricated_readiness_probability():
    assert "85" in blocked("Your retirement success probability is 85%.")


def test_block_invented_price_user_never_gave():
    assert "450000" in blocked("Can you afford the $450,000 home?")


# ── Finance: Tier 2 — industry benchmarks always allowed ─────────────────────────────────────────────────
def test_allow_benchmark_down_payment():
    # 500000 is user-stated (grounded); the $100,000 is a conventional-benchmark illustration → allowed.
    assert blocked("A conventional 20% down payment to avoid PMI is $100,000.", allowed=["500000"]) == set()


def test_allow_benchmark_percentages():
    assert blocked("Closing costs are often 2-5% and a typical 401k match is ~4%.") == set()


def test_allow_emergency_fund_benchmark():
    assert blocked("A common rule of thumb is a 3-6 month emergency fund.") == set()


# ── Finance: Tier 3 — labeled scenarios/estimates allowed ────────────────────────────────────────────────
def test_allow_labeled_estimate_dollar():
    assert blocked("An estimated mortgage payment would be about $2,400 a month.") == set()


def test_allow_example_scenario():
    assert blocked("For example, a $300,000 mortgage at current rates is one scenario to model.") == set()


# ── Health: medical regex must NOT block coaching ────────────────────────────────────────────────────────
def test_health_coaching_passes():
    for s in [
        "Do 3 sets of 8-12 reps, 3x per week, with progressive overload.",
        "Aim for ~2,000 kcal and 150g protein; magnesium before bed can help recovery.",
        "For body recomposition, prioritize hypertrophy and conditioning, plus mobility work.",
        "Continue your TRT under your doctor's supervision while we build the training plan.",
        "A HIIT and swimming program 4x per week supports fat loss.",
    ]:
        assert not _ADVICE.search(s), f"over-blocked: {s}"


# ── Health: true clinical directives still blocked ───────────────────────────────────────────────────────
def test_health_clinical_blocked():
    for s in [
        "I will diagnose you with hypothyroidism.",
        "You should start a prescription antibiotic at 500 mg.",
        "I'd prescribe metformin for this.",
        "Adjust your medication dosage to twice daily.",
    ]:
        assert _ADVICE.search(s), f"should block: {s}"


# ── Phase 4: derivation verifier — benchmark/scenario math (two-tier) ─────────────────────────────────────
from app.services.advisor_math import verify_derivations


def _verify(expr, value, label, allowed):
    return verify_derivations([{"label": label, "expression": expr, "value": value}], allowed)


def test_scenario_down_payment_verifies():
    strict, scen, kept = _verify("500000 * 20 / 100", "100000", "20% down payment scenario", ["500000"])
    assert "100000" in scen and "100000" not in strict and kept and kept[0]["tier"] == "scenario"


def test_scenario_closing_cost_verifies():
    _, scen, _ = _verify("500000 * 3 / 100", "15000", "estimated closing costs", ["500000"])
    assert "15000" in scen


def test_scenario_emergency_fund_months():
    _, scen, _ = _verify("8000 * 6", "48000", "6-month emergency reserve", ["8000"])
    assert "48000" in scen


def test_strict_personal_math_is_strict_tier():
    strict, scen, _ = _verify("95000 + 40000", "135000", "your liquid assets", ["95000", "40000"])
    assert "135000" in strict and "135000" not in scen  # all-user operands → bypasses everything


def test_scenario_requires_label():
    # benchmark factor (20) with a user base but NO scenario/estimate label → rejected entirely
    strict, scen, kept = _verify("500000 * 20 / 100", "100000", "result", ["500000"])
    assert "100000" not in strict and "100000" not in scen and kept == []


def test_scenario_requires_user_base():
    # no user number in allowed → the whole figure is fabricated → rejected
    strict, scen, _ = _verify("1000000 * 20 / 100", "200000", "down payment scenario", [])
    assert "200000" not in strict and "200000" not in scen


def test_scenario_wrong_math_rejected():
    _, scen, _ = _verify("500000 * 20 / 100", "90000", "down payment scenario", ["500000"])
    assert "90000" not in scen  # computed 100000 != claimed 90000


def test_scenario_factor_over_100_rejected():
    # can't fabricate a large standalone via a >100 "factor"
    _, scen, _ = _verify("500000 * 200 / 100", "1000000", "scenario", ["500000"])
    assert "1000000" not in scen


# ── Phase 4: end-to-end — scenario value allowed in prose, blocked in possessive claim ───────────────────
def test_scenario_value_allowed_in_neutral_prose():
    # benchmark-marker path (a benchmark word present)
    assert blocked("A conventional 20% down payment would be $100,000.", allowed=["500000"]) == set()
    # scenario-set path (no benchmark word, but the value was derivation-verified)
    assert _fabricated_personal_numbers("That down payment figure is $100,000.", set(), {"100000"}) == set()


def test_scenario_value_still_blocked_as_personal_claim():
    # even a verified scenario value cannot be asserted as the user's actual tax bill
    assert "18200" in _fabricated_personal_numbers("Your tax bill will be $18,200.", set(), {"18200"})
