"""Career and education reaching the COMPUTED path (2026-10-13).

The advisor could already DESCRIBE a user's degree and goals — `advisor_facts` reads the career and
education tables with provenance (Phase 8). What it could not do was compute anything about them:
the resolver read thirteen tables and every one was finance, so all three education calculators
asked the user to type figures that `education.programs` had held all along. That is the same defect
as the employer-match columns sitting unread since migration 062, at domain scale.
"""
from __future__ import annotations

import pytest

from app.models.common import UserContext
from app.services.advisor_calculations import AdvisorCalculationPlanner
from app.services.financial_resolver import FinancialInputResolver

from .conftest import FakeSupabase

U = "11111111-1111-1111-1111-111111111111"
CTX = UserContext(user_id=U)

PROGRAMS = [
    {"user_id": U, "name": "State MBA", "level": "masters", "duration_months": 24,
     "tuition": 62_000, "median_salary": 138_000, "graduation_rate": 0.91, "source": "IPEDS"},
    {"user_id": U, "name": "Top-20 MBA", "level": "masters", "duration_months": 24,
     "tuition": 168_000, "median_salary": 175_000, "graduation_rate": 0.95, "source": "IPEDS"},
]
COMP = [{"user_id": U, "role": "Analyst", "base": 95_000, "bonus": 12_000,
         "effective_date": "2026-01-01"},
        {"user_id": U, "role": "Analyst", "base": 88_000, "effective_date": "2024-01-01"}]
TARGETS = [{"user_id": U, "role_title": "Product Manager", "target_comp_median": 150_000,
            "created_at": "2026-06-01"}]


# Keys are SCHEMA-QUALIFIED on purpose. The fake now enforces them, so asking for
# `programs` in the wrong schema returns nothing and these tests fail — which is how a
# resolver pointed at the wrong schema should surface, rather than silently in production.
_SCHEMA_OF = {"compensation_records": "career", "job_targets": "career",
              "programs": "education", "financial_accounts": "finance"}


def _sb(**tables):
    return FakeSupabase({f"{_SCHEMA_OF.get(k, 'finance')}.{k}": v for k, v in tables.items()})


async def _resolve(**tables):
    return await FinancialInputResolver(_sb(**tables)).resolve(CTX)


async def _packet(turn=None, **tables):
    return await AdvisorCalculationPlanner(
        FinancialInputResolver(_sb(**tables))).compute(CTX, turn=turn)


def _edu(packet, calc):
    return [r for r in packet["results"] if r["calculator"] == calc]


# ── The inputs resolve from storage ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_salary_before_is_BASE_pay_and_the_latest_record_wins():
    """Base, not total comp. The figure measures earnings forgone while studying, and a bonus is
    contingent while equity is neither guaranteed nor cash — counting them would overstate the cost
    of studying and so understate every degree's value."""
    r = await _resolve(compensation_records=COMP)
    f = r["inputs"]["salary_before"]
    assert f["present"] is True and f["value"] == 95_000, "the 2026 record, not the 2024 one"
    assert "compensation_records" in f["origin"]
    assert r["caveats"]["salary_before_excludes"] == ["bonus", "equity"]


@pytest.mark.asyncio
async def test_programs_resolve_with_their_tuition_duration_and_median():
    r = await _resolve(programs=PROGRAMS)
    progs = r["inputs"]["education_programs"]["value"]
    assert len(progs) == 2
    assert progs[0]["tuition_total"] == 62_000
    assert progs[0]["years_in_school"] == 2.0, "24 months becomes 2 years"
    assert progs[0]["median_salary"] == 138_000
    assert progs[0]["graduation_rate"] == 0.91


@pytest.mark.asyncio
async def test_an_UNPRICED_program_is_excluded_and_named_rather_than_treated_as_free():
    r = await _resolve(programs=PROGRAMS + [
        {"user_id": U, "name": "Unpriced certificate", "level": "certificate"}])
    assert len(r["inputs"]["education_programs"]["value"]) == 2
    assert r["caveats"]["education_programs_incomplete"] == ["Unpriced certificate"]


@pytest.mark.asyncio
async def test_the_target_role_and_pay_resolve_from_job_targets():
    r = await _resolve(job_targets=TARGETS)
    assert r["inputs"]["target_compensation"]["value"] == 150_000
    assert r["inputs"]["target_role"]["value"] == "Product Manager"


# ── The calculators run per program ──────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_the_degree_calculators_run_PER_PROGRAM():
    """More than one candidate is a COMPARISON, not an ambiguity — and comparing them is the
    question the user actually has. Same pattern as the after-tax cost of debt per instrument."""
    p = await _packet(compensation_records=COMP, programs=PROGRAMS)
    assert len(_edu(p, "education.degree_total_cost")) == 2
    assert len(_edu(p, "education.degree_payback_years")) == 2
    assert len(_edu(p, "education.degree_lifetime_value")) == 2
    names = [e["program"] for e in p["education_programs_compared"]]
    assert names == ["State MBA", "Top-20 MBA"]


@pytest.mark.asyncio
async def test_the_figures_are_hand_checkable_and_include_forgone_earnings():
    """Total cost is tuition PLUS the years not working: $62,000 + 2 x $95,000 = $252,000, and
    $168,000 + $190,000 = $358,000. A degree priced on tuition alone understates it by the larger
    of the two numbers."""
    p = await _packet(compensation_records=COMP, programs=PROGRAMS)
    costs = sorted(r["value"] for r in _edu(p, "education.degree_total_cost"))
    assert costs == [252_000.0, 358_000.0]
    paybacks = sorted(r["value"] for r in _edu(p, "education.degree_payback_years"))
    # 358,000 / (175,000-95,000) = 4.475 ; 252,000 / (138,000-95,000) = 5.86
    assert paybacks == pytest.approx([4.5, 5.9], abs=0.05)


@pytest.mark.asyncio
async def test_the_more_expensive_program_can_pay_back_SOONER():
    """The finding this comparison exists to surface, and the one a tuition-only view inverts: the
    Top-20 programme costs $106,000 more and pays back 1.4 years earlier, because the uplift is
    nearly double."""
    p = await _packet(compensation_records=COMP, programs=PROGRAMS)
    by_tuition = {r["inputs_used"]["tuition_total"]: r["value"]
                  for r in _edu(p, "education.degree_payback_years")}
    assert by_tuition[168_000] < by_tuition[62_000]
    pv = {r["inputs_used"]["tuition_total"]: r["value"]
          for r in _edu(p, "education.degree_lifetime_value")}
    assert pv[168_000] > 2 * pv[62_000]


@pytest.mark.asyncio
async def test_salary_after_falls_back_to_the_users_TARGET_and_says_so():
    """A target is what they are aiming at, not what the programme delivers, so the distinction is
    recorded rather than blurred into one number."""
    unpaid = [{**PROGRAMS[0], "median_salary": None}]
    p = await _packet(compensation_records=COMP, programs=unpaid, job_targets=TARGETS)
    e = p["education_programs_compared"][0]
    assert e["salary_after"] == 150_000
    assert e["salary_after_source"] == "your stated target"


@pytest.mark.asyncio
async def test_no_salary_after_anywhere_prices_the_degree_but_REFUSES_the_payback():
    """Pricing a degree is honest without an outcome estimate; claiming it pays back is not."""
    unpaid = [{**PROGRAMS[0], "median_salary": None}]
    p = await _packet(compensation_records=COMP, programs=unpaid)
    assert len(_edu(p, "education.degree_total_cost")) == 1
    assert _edu(p, "education.degree_payback_years") == []
    gap = next(g for g in p["gaps"]
               if g.get("calculator") == "education.degree_payback_years")
    assert "State MBA" in " ".join(gap["ask"])


@pytest.mark.asyncio
async def test_the_TURN_still_overrides_the_stored_programs():
    """"What if it cost $120,000 instead" is a real question, so a stated figure wins — and it
    replaces the comparison rather than joining it, because the user is asking about one thing."""
    p = await _packet(turn={"tuition_total": 120_000, "years_in_school": 1,
                            "salary_after": 160_000},
                      compensation_records=COMP, programs=PROGRAMS)
    costs = _edu(p, "education.degree_total_cost")
    assert len(costs) == 1
    assert costs[0]["value"] == 120_000 + 95_000
    assert p["education_programs_compared"][0]["program"] == "the program you described"


@pytest.mark.asyncio
async def test_completion_risk_is_CARRIED_not_applied_twice():
    """`education_roi.score_program` already risk-adjusts the income lift by graduation rate.
    Applying it here as well would compound the same haircut, so the rate travels with the result
    for the advisor to state and the adjustment stays in one place."""
    p = await _packet(compensation_records=COMP, programs=PROGRAMS)
    e = p["education_programs_compared"][0]
    assert e["graduation_rate"] == 0.91
    # The uplift used is the raw difference, NOT 0.91 x it.
    pv = next(r for r in _edu(p, "education.degree_lifetime_value")
              if r["inputs_used"]["tuition_total"] == 62_000)
    assert pv["inputs_used"]["salary_after"] == 138_000


@pytest.mark.asyncio
async def test_no_career_or_education_data_asks_rather_than_assuming():
    p = await _packet()
    assert p["education_programs_compared"] == []
    assert _edu(p, "education.degree_total_cost") == []


@pytest.mark.asyncio
async def test_the_education_figures_reach_the_number_gate():
    p = await _packet(compensation_records=COMP, programs=PROGRAMS)
    allnums = set(p["allowed_numbers"]) | set(p["scenario_numbers"])
    assert "252000" in allnums and "358000" in allnums


# ── One cost model, two enrolment modes (replication removed 2026-10-13) ────────────────────────
def test_the_forgone_salary_share_is_a_PARAMETER_not_a_hardcoded_constant():
    """THE REPLICATION THIS REMOVES. `tuition + salary x years` lived in
    `education.degree_total_cost` with the share implicitly 1.0, and again in
    `education_roi` with `_PART_TIME_FORGONE = 0.5` computed inline — two implementations of one
    formula, differing only by that constant, which could only ever drift apart.
    """
    from app.services.calculators.education import degree_total_cost
    full = degree_total_cost(tuition_total=62_000, years_in_school=2, salary_before=95_000)
    part = degree_total_cost(tuition_total=62_000, years_in_school=2, salary_before=95_000,
                             salary_forgone_share=0.5)
    assert full.value == 252_000.0 and part.value == 157_000.0
    assert full.detail["enrolment"] == "full-time"
    assert part.detail["enrolment"] == "part-time"


def test_the_default_is_full_time_so_every_prior_caller_is_unchanged():
    from app.services.calculators.education import degree_total_cost
    import inspect
    assert inspect.signature(degree_total_cost).parameters[
        "salary_forgone_share"].default == 1.0
    assert degree_total_cost(tuition_total=80_000, years_in_school=2,
                             salary_before=90_000).value == 260_000.0


def test_education_roi_now_DELEGATES_and_its_figures_are_unchanged():
    """The point of a consolidation is that nothing moves. Hand-checked: $95,000 x 2 x 0.5 is
    $95,000 of forgone earnings, and ($62,000 + $95,000) / ($43,000/12) is 43.8 months."""
    from app.services.education_roi import EducationROIEngine
    s = EducationROIEngine().score_program(
        {"name": "State MBA", "tuition": 62_000, "duration_months": 24,
         "median_salary": 138_000, "graduation_rate": 0.91},
        current_median=95_000, current_source="career.compensation_records",
        target_role="Product Manager", total_debt=30_000)
    assert s.opportunity_cost == 95_000.0
    assert s.income_lift == 43_000.0
    assert s.breakeven_months == 44.0


def test_education_roi_imports_the_calculator_rather_than_reimplementing_it():
    import inspect

    from app.services import education_roi as R
    src = inspect.getsource(R)
    assert "from .calculators.education import degree_total_cost" in src
    # The inline formula is gone.
    assert "current_median * duration_yrs * _PART_TIME_FORGONE" not in src


def test_the_two_similarly_named_shares_mean_different_things():
    """`salary_forgone_share` is how much of the salary stops (an input); `foregone_share` is how
    much of the TOTAL COST is lost earnings (an output). Conflating them would silently rescale
    every degree."""
    from app.services.calculators.education import degree_total_cost
    r = degree_total_cost(tuition_total=62_000, years_in_school=2, salary_before=95_000,
                          salary_forgone_share=0.5)
    assert r.inputs_used["salary_forgone_share"] == 0.5
    assert r.detail["foregone_share"] == pytest.approx(95_000 / 157_000, abs=0.001)


# ── The packet must reach the agent whose job the question is ───────────────────────────────────
def test_the_EDUCATION_ADVISOR_reaches_the_calculator_packet():
    """THE DISCONNECT THIS FIXES, and it made the whole wiring above unreachable in practice.

    The packet was gated on `finance_in_scope`, so the registry's own routing decided it: "Is the
    Top-20 MBA worth it?" routes to ['education'] and the packet never ran — including for the
    EDUCATION ADVISOR, whose entire job that question is, and for Arcana, which routes the same
    way. Measured across the roster, 3 of 9 agents reached it. The packet is not finance
    grounding: it spans finance, tax, debt, housing, two `career.*` calculators and the three
    `education.degree_*` ones, so the honest gate is whether the turn touches anything it can
    compute.
    """
    from app.services.advisor_agents import get_agent, domains_for
    from app.services.advisor_context import _COMPUTED_DOMAINS

    q = "Is the Top-20 MBA worth it compared to the state program?"
    for agent_id in ("education_advisor", "career_advisor", "relationship_manager",
                     "finance_advisor", "scenario_planner"):
        doms = set(domains_for(get_agent(agent_id), q) or ())
        assert _COMPUTED_DOMAINS & doms, f"{agent_id} cannot reach the calculators"


def test_domains_with_NO_calculators_still_do_not_pay_for_the_packet():
    """Widening the gate must not mean running it for everyone — health, family and documents have
    no calculators, so building the packet for them is pure cost."""
    from app.services.advisor_agents import get_agent, domains_for
    from app.services.advisor_context import _COMPUTED_DOMAINS

    q = "How is my sleep trending this month?"
    for agent_id in ("health_advisor", "family_advisor", "document_advisor"):
        doms = set(domains_for(get_agent(agent_id), q) or ())
        assert not (_COMPUTED_DOMAINS & doms), f"{agent_id} should not build the packet"


@pytest.mark.parametrize("question", [
    "How much tax will I owe this year?",
    "What would this degree cost me?",
    "Should I itemize or take the standard deduction?",
    "Is my HELOC interest deductible?",
    "What is my VA disability benefit worth?",
])
def test_the_no_agent_keyword_fallback_covers_what_the_calculators_answer(question):
    """`_FINANCE_WORDS` missed every one of these — verified, including the plain tax question —
    so with no agent routed the packet never built. A separate predicate is used rather than
    widening that list, because it also gates `finance_scenarios`, a different engine."""
    from app.services.advisor_context import _mentions_computable
    assert _mentions_computable(question) is True


def test_the_keyword_fallback_does_not_fire_on_unrelated_turns():
    from app.services.advisor_context import _mentions_computable
    for q in ("How is my sleep trending?", "Remind me what my guardianship papers say",
              "Who are my emergency contacts?"):
        assert _mentions_computable(q) is False
