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


# ---- WS-B/F2 LANDED: a market price is no longer over-blocked — in the FORM a market price honestly takes.
# We can't verify what an inspection costs, so a RANGE or a hedge passes and a bare point value does not
# (it claims a precision we don't have). Both honest forms are covered here; the point form is not rejected
# either, it's routed to a keep-and-rephrase repair — see test_unhedged_market_price_is_repaired_not_deleted.
@pytest.mark.parametrize("text", [
    "A home inspection runs $400 to $600.",                            # range with `to`
    "Estate attorneys charge $1,500-3,000 for a will.",                # range with a dash
    "Real-estate agents charge about $12,000 in commission on a sale like that.",   # hedged point value
    "There's usually a $500 origination fee.",                         # hedged point value
])
def test_market_price_in_honest_form_is_allowed(text):
    assert not blocked(text), f"WS-B/F2: {text} -> {blocked(text)}"


# ---- F2 REGRESSION LOCK: nothing may un-gate a possessive claim about money the user PAYS. ----
# PR #72 folded runs/charges/fees into _BENCHMARK_MARK, betting the possessive `you`+money-cue check would
# still catch these. The bet was sound; the check was broken — _MONEY_CUE covered money the user HOLDS
# (net worth, savings, mortgage) but not money they PAY (payment, cost, fee, premium, rent, tuition), so
# `personal_holding` was False for exactly these sentences and every row below shipped ALLOWED.
#
# The hedged rows matter more than the price-verb rows: they were allowed before #72 and after it, and a
# hedge is what a model reaches for by default ("your payment will be about $3,200"). A fix that only
# special-cased the price verbs would have left the wider door open.
#
# The counterfactual-user rule these are built from: would this number differ for another user? Yes ⇒
# PERSONAL, must be sourced. No ⇒ market price, passes (see the WS-B cases above).
@pytest.mark.parametrize("text", [
    "Your monthly payment runs $3,200.",          # the exact unsupported_monthly_payment case
    "Your closing costs run $9,500.",
    "You'll pay $18,200 in fees.",
    "Your attorney charges $12,000.",
    "Your student loan fees total $45,000.",
    # hedged — the wider door, open since long before #72
    "Your monthly payment will be about $3,200.",
    "Your closing costs are roughly $9,500.",
    "You'll pay approximately $18,200 in fees.",
    "Your attorney will typically cost $12,000.",
    "Your premium is around $450 a month.",
    "Your rent is typically $2,400.",
])
def test_possessive_personal_figure_stays_blocked(text):
    assert blocked(text), f"F2 regression: possessive personal figure must stay blocked: {text}"


# The relaxation must survive REAL prose, where second person is almost always somewhere nearby — a market
# price in a sentence that also addresses the user is the normal case, not an edge case.
# ---- CROSS-SECTION WINDOW BLEED ----
# Found by the integration harness, not by unit tests: the gate reads a +-70 CHARACTER window to decide what
# a number is a claim about, but it used to read it over all six sections CONCATENATED. So a word in one
# section vouched for a number in another — "a home inspection runs $400" (recommendation) was un-gated by
# the unrelated word "target" in what_we_still_need, a different sentence in a different part of the UI.
# Words that aren't near each other on screen must not be near each other in the window.
def test_a_cue_in_another_section_cannot_unblock_a_number():
    from app.services.advisor_validator import validate

    class _Ctx:
        allowed_numbers, connected_pairs, candidate_goals, primary_objective = set(), set(), [], ""
        rejected_goals, domain_facts, relationship_edges, connections = [], [], [], []

    ok, _safe, reasons = validate({
        "decision_frame": "You're deciding whether to buy this year.",
        "tradeoffs": [{"option": "Buy", "benefit": "Locks price", "cost": "Thin cushion"}],
        "recommendation": "A home inspection runs $400.",   # unhedged point price — must be caught
        "what_we_still_need": ["Your target closing month"],  # "target" is a hedge word, 30 chars away once joined
        "next_question": "When do you want to close?",
    }, _Ctx())
    assert not ok and any("invented numbers" in r for r in reasons), reasons


def test_market_price_allowed_alongside_second_person():
    assert not blocked("You mentioned you're buying in Austin. An inspection runs about $400-600.")


def test_possessive_price_verb_is_fine_once_grounded():
    """The gate is about PROVENANCE, not phrasing — the same sentence passes when the number is the user's."""
    assert not blocked("Your monthly payment runs $3,200.", ["3200"])
