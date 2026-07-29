"""Elite guardrail matrix — the number gate's block/allow contract (advisor_validator).

This locks the TRUST-CRITICAL behavior so the WS-B relaxation can't silently regress fabrication: a
possessive personal figure the user never gave must stay blocked; the user's own numbers, grounded
derivations, and hedged benchmarks must pass. Cases marked WS-B are the known over-blocks we intend to
relax — pinned with xfail so they're documented and will flip to `allow` when WS-B lands."""
import pytest
from app.services.advisor_validator import _fabricated_personal_numbers as gate


def blocked(text, allowed=()):
    return gate(text, set(allowed))


# ---- MUST STAY BLOCKED (fabricated personal figures — the trust core) ----
@pytest.mark.parametrize("text,allowed", [
    ("Your net worth is $250,000.", []),                       # possessive, not given
    ("Your tax bill will be $18,200 this year.", []),          # possessive computed, no derivation
    ("You should invest $999,999 right now.", []),             # invented advice figure
    ("You can put down $90,000 on the house.", []),            # invented decision figure
])
def test_fabricated_personal_number_is_blocked(text, allowed):
    assert blocked(text, allowed), f"should block: {text}"


# ---- MUST STAY ALLOWED (the user's own + grounded + hedged) ----
@pytest.mark.parametrize("text,allowed", [
    ("You have $250,000 saved and $40,000 in debt.", ["250000", "40000"]),   # their own numbers
    ("A common rule of thumb is a 3-6 month emergency fund.", []),           # coaching range (no $)
    ("A 20% down payment on a $500,000 home would be about $100,000.", ["500000"]),  # labeled scenario, hedged
    ("Roughly $2,000 for the deposit is typical.", []),                      # hedged benchmark
    ("Estate attorneys often charge $1,500 to $3,000.", []),                 # general price WITH a benchmark cue
])
def test_grounded_or_hedged_number_is_allowed(text, allowed):
    assert not blocked(text, allowed), f"should allow: {text} -> blocked {blocked(text, allowed)}"


# ---- WS-B/F2 LANDED: a non-possessive general price ("an inspection runs $400") is no longer over-blocked,
#      while invented DECISION figures (afford/put-down/invest above) stay blocked. ----
@pytest.mark.parametrize("text", [
    "A home inspection runs $400 to $600.",
    "Real-estate agents charge $12,000 in commission on a sale like that.",
    "There's usually a $500 origination fee.",
])
def test_general_price_verb_is_allowed_wsb(text):
    assert not blocked(text), f"WS-B/F2: {text} -> {blocked(text)}"


# ---- F2 REGRESSION LOCK: the price verbs must NOT un-gate a possessive claim about the user's money. ----
# The first F2 landing folded runs/charges/fees straight into _BENCHMARK_MARK, betting that the possessive
# `you`+money-cue check would still catch these. It didn't — _MONEY_CUE has no payment/fee/cost/charge entry,
# so every sentence below flipped from BLOCKED to allowed, including the monthly-payment case the trust spine
# exists to stop. The counterfactual-user rule: these numbers change per user, so they are PERSONAL and must
# be sourced; the cases above don't, so they're market prices and pass.
@pytest.mark.parametrize("text", [
    "Your monthly payment runs $3,200.",          # the exact unsupported_monthly_payment case
    "Your closing costs run $9,500.",
    "You'll pay $18,200 in fees.",
    "Your attorney charges $12,000.",
    "Your student loan fees total $45,000.",
])
def test_price_verb_does_not_ungate_possessive_personal_figure(text):
    assert blocked(text), f"F2 regression: possessive personal figure must stay blocked: {text}"


def test_possessive_price_verb_is_fine_once_grounded():
    """The gate is about PROVENANCE, not phrasing — the same sentence passes when the number is the user's."""
    assert not blocked("Your monthly payment runs $3,200.", ["3200"])
