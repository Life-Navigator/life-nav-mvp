"""Sprint 34 Deliverable 10 — Discovery Quality Evaluation Suite. >=90% objective accuracy required."""
from __future__ import annotations


from app.models.common import UserContext
from app.services.life_discovery import LifeDiscoveryService
from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")

# (surface, why, expected_objective)  — the audit's required matrix + the Sprint 33 failures
CASES = [
    ("buy a house", ["we want children"], "family_stability"),                 # House -> Family
    ("buy a house", ["rental income and build equity"], "financial_independence"),  # House -> Investment
    ("buy a house", ["we found a new city we love, a fresh start"], "career_growth"),  # House -> Relocation
    ("buy a house", ["a better school district for our kids"], "family_stability"),    # House -> School District
    ("get an MBA", ["I want to change careers"], "career_growth"),              # MBA -> Career Change
    ("get an MBA", ["I want to start a business"], "career_growth"),            # MBA -> Entrepreneurship
    ("lose weight", ["I want to feel healthy and have more energy"], "health_longevity"),  # Weight -> Health
    ("lose weight", ["more energy for my kids"], "health_longevity"),          # Weight -> Family Energy (THE FIX)
    ("get life insurance", ["my wife is pregnant"], "family_stability"),       # Insurance -> Pregnancy (THE FIX)
    ("get life insurance", ["leave something for my heirs"], "family_stability"),  # Insurance -> Estate
    ("retire at 45", ["I have no savings"], "financial_independence"),         # Retire early + no savings
    ("move cities", ["to be closer to family before we have kids"], "family_stability"),  # Move + Family Support
    ("get a new job", ["my current one is burning me out"], "career_growth"),  # Career + Burnout
    ("get a new job", ["I want to be paid more"], "career_growth"),            # Career + Compensation
    ("get a new job", ["I want more purpose"], "career_growth"),               # Career + Purpose
]


def test_objective_accuracy_meets_90pct():
    svc = LifeDiscoveryService(FakeSupabase({}))
    correct, results = 0, []
    for surface, why, expected in CASES:
        a = svc.analyze(surface_goal=surface, why_chain=[{"q": "why", "a": w} for w in why])
        got = a.get("primary_objective")
        ok = got == expected
        correct += ok
        results.append(f"{'OK ' if ok else 'XX '}{surface} / {why[0][:30]} -> {got} (want {expected})")
    accuracy = correct / len(CASES)
    assert accuracy >= 0.90, f"objective accuracy {accuracy:.0%} < 90%\n" + "\n".join(results)


def test_no_why_chain_probes_not_invents():
    svc = LifeDiscoveryService(FakeSupabase({}))
    a = svc.analyze(surface_goal="buy a house", why_chain=[])
    assert a["needs_followup"] is True and a["primary_objective"] is None
    assert a.get("followup_question") and a.get("followup_options")


def test_impossible_goal_flags_constraint():
    svc = LifeDiscoveryService(FakeSupabase({}))
    a = svc.analyze(surface_goal="retire at 45", why_chain=[{"a": "I have no savings and want a $2M house"}])
    assert a["constraints"] and any("savings" in c["label"].lower() or "timeline" in c["label"].lower() for c in a["constraints"])


def test_terminal_goal_ignores_motivation_keyword():
    svc = LifeDiscoveryService(FakeSupabase({}))
    # "lose weight" + "kids" must NOT become family_stability (Sprint 33 overfit bug)
    a = svc.analyze(surface_goal="lose weight", why_chain=[{"a": "energy for my kids"}])
    assert a["primary_objective"] == "health_longevity"
