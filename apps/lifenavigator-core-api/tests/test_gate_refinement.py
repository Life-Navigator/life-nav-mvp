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
