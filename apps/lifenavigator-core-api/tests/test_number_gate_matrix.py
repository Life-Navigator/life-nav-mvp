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


# ---- WS-B TARGET: a general price WITHOUT a recognized benchmark cue is still (over-)blocked. This pins the
#      exact surface WS-B must relax — it should flip to allowed once non-possessive prices aren't gated. ----
@pytest.mark.xfail(reason="WS-B: non-possessive general price w/o a hedge cue should not be gated", strict=True)
def test_uncued_general_price_should_be_allowed_wsb():
    assert not blocked("A home inspection runs $400 to $600.")
