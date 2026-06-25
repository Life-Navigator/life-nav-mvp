"""Bounded benchmark-derivation relaxation for affordability (AFFORDABILITY_GATE)."""
from app.services.advisor_validator import _fabricated_personal_numbers, _ADVICE


def blk(text, allowed):
    return _fabricated_personal_numbers(text, set(allowed))


# ── SHOULD PASS (benchmark-derived of a grounded base; figure NOT blocked) ──
def test_20pct_down():
    assert "100000" not in blk("A 20% down payment on a $500,000 home is $100,000.", ["500000"])

def test_closing_2_5pct_range():
    out = blk("Closing costs of 2-5% on a $500,000 home run $10,000 to $25,000.", ["500000"])
    assert "10000" not in out and "25000" not in out

def test_fha_3_5pct_when_fha_mentioned():
    assert "17500" not in blk("With an FHA loan, a 3.5% down payment on a $500,000 home is about $17,500.", ["500000"])

def test_six_month_reserve():
    assert "48000" not in blk("A 6-month emergency reserve on $8,000 in monthly expenses is $48,000.", ["8000"])

def test_15pct_retirement_target():
    assert "21000" not in blk("A 15% retirement savings target on a $140,000 income is $21,000 a year.", ["140000"])


# ── SHOULD FAIL (blocked) ──
def test_block_mortgage_payment():
    assert "3267" in blk("Your mortgage payment would be $3,267 a month.", ["500000", "60000"])

def test_block_dti():
    assert "28" in blk("Your DTI would be 28%.", ["140000"])

def test_block_tax_bill():
    assert "18200" in blk("Your tax bill will be $18,200.", ["140000"])

def test_block_retirement_probability():
    assert "85" in blk("Your retirement success probability is 85%.", ["140000"])

def test_block_readiness_score():
    assert "72" in blk("Your readiness score is 72%.", ["140000"])  # % is a financial-looking number; bare <100 score is dashboard-grounded

def test_block_arbitrary_pct():
    assert "135000" in blk("A 27% down payment on a $500,000 home is $135,000.", ["500000"])

def test_block_wrong_math():
    assert "90000" in blk("A 20% down payment on a $500,000 home is $90,000.", ["500000"])

def test_block_net_worth_even_if_benchmark_value():
    # 100000 == 20% of grounded 500000, BUT it's a possessive net-worth claim → personal-holding wins
    assert "100000" in blk("Your net worth is $100,000.", ["500000"])

def test_block_balance_claim():
    assert "100000" in blk("Your account balance is $100,000.", ["500000"])


# ── Affordability VERDICTS blocked by the advice gate ──
def test_block_affordability_verdicts():
    for s in ["you can afford this $500,000 home", "you qualify for a $500,000 mortgage",
              "you're approved for the loan", "you cannot afford this"]:
        assert _ADVICE.search(s), f"should block verdict: {s}"

def test_hedged_affordability_allowed():
    # V4 hedged framing must still pass (not an advice-gate hit)
    for s in ["this looks affordable on your numbers", "this looks like a stretch on your numbers"]:
        assert not _ADVICE.search(s), f"hedged framing should pass: {s}"
