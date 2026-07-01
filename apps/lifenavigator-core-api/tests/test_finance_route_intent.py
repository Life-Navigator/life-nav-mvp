"""Finance intent split: low-risk education → fast path; personalized planning/calculation/high-risk → deep
supervised. Deterministic + conservative — ambiguous defaults supervised. Validator runs on both (same pipeline)."""
from app.services.advisor_orchestrator import select_route_path, _is_finance_education

FIN = ["finance"]

# --- education → fast (route_path 'standard' → the fast model in _route) ---
EDUCATION = [
    "What is a 529?",
    "What is PMI?",
    "What does emergency fund mean?",
    "Explain debt snowball vs debt avalanche.",
    "What is a Roth IRA?",
    "What is a HYSA?",
    "What does net worth mean?",
    "Explain down payment in simple terms.",
    "What is a mortgage preapproval?",
    "What does cash flow mean?",
]

# --- personalized / calculation / high-risk → supervised (deep model) ---
SUPERVISED = [
    "What should my emergency fund target be?",
    "Can I afford a $500K house?",
    "Should I buy before the wedding or after promotion?",
    "How much should my down payment be?",
    "Should I pay off debt or invest?",
    "How should I allocate my portfolio?",
    "Should I use my bonus for debt or down payment?",
    "What should I do with my 401(k)?",
    "What is the best tax strategy?",
    "How much life insurance do I need?",
]


def test_finance_education_routes_fast():
    for q in EDUCATION:
        assert _is_finance_education(q, {"finance"}) is True, f"should be education: {q}"
        assert select_route_path(q, FIN) in ("fast", "standard"), f"should be fast-path: {q}"


def test_personalized_finance_stays_supervised():
    for q in SUPERVISED:
        assert _is_finance_education(q, {"finance"}) is False, f"should NOT be education: {q}"
        assert select_route_path(q, FIN) == "supervised", f"should be supervised: {q}"


def test_uncertain_finance_defaults_supervised():
    # no educational opener + finance domain → supervised
    assert select_route_path("thinking about the house situation and money stuff", FIN) == "supervised"
    # a dollar amount kills the fast path even with an educational opener
    assert select_route_path("What is a good down payment on a $500k home?", FIN) == "supervised"


def test_health_education_is_never_fast():
    # health stays supervised even for a definitional question (clinical safety)
    assert select_route_path("What is hypertension?", ["health"]) == "supervised"
    assert _is_finance_education("What is hypertension?", {"health"}) is False


def test_non_finance_education_not_misrouted_as_finance():
    # a general 'what is X' that isn't finance and has no finance concept → not finance-education (falls through)
    assert _is_finance_education("What is photosynthesis?", set()) is False
