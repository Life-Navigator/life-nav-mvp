"""The three Milestone 3 gaps closed on 2026-10-13.

1. The employer match is two numbers, and only one was ever modelled.
2. The calculation store was never handed a Supabase client, so 3.6 was dead code.
3. `ADVISOR_CALCULATORS_ENABLED` stays default-off, and the reason is now testable rather than
   merely written down.
"""
from __future__ import annotations

import inspect

import pytest

from app.services.calculators.career import uncaptured_match

from .test_advisor_calculations import _Ctx, _resolver


# ── 1. The match formula ─────────────────────────────────────────────────────────────────────────
def test_the_default_is_dollar_for_dollar_so_every_existing_caller_is_unchanged():
    """`match_percent` defaults to 100, which is this calculator's long-standing assumption. The
    fix must not silently restate figures for callers that never knew about the second number."""
    assert inspect.signature(uncaptured_match).parameters["match_percent"].default == 100.0
    r = uncaptured_match(income=200_000, current_rate=3, employer_match_rate=6)
    assert r.value == 6_000.0
    assert r.detail["full_match_annual"] == 12_000.0
    assert r.detail["assumed_dollar_for_dollar"] is True


def test_a_PARTIAL_match_is_worth_exactly_its_percentage():
    """THE BUG THIS FIXES. "50% up to 6%" is the most common formula in the market and pays half
    of what "up to 6%" pays. Every figure here was DOUBLE for anyone on such a plan — and it reads
    as plausible, because the SHAPE of the advice ("raise your contribution to 6%") stays right
    while the dollar amount is twice what they will actually receive.
    """
    full = uncaptured_match(income=200_000, current_rate=3, employer_match_rate=6)
    half = uncaptured_match(income=200_000, current_rate=3, employer_match_rate=6,
                            match_percent=50)
    assert half.value == full.value / 2 == 3_000.0
    assert half.detail["full_match_annual"] == 6_000.0
    assert half.detail["match_formula"] == "50% of the first 6% of pay"
    assert half.detail["assumed_dollar_for_dollar"] is False


def test_the_RATE_to_contribute_does_not_change_with_the_match_percentage():
    """A 50% match is still worth capturing in full, so the actionable advice is identical — only
    the amount it is worth changes."""
    full = uncaptured_match(income=200_000, current_rate=3, employer_match_rate=6)
    half = uncaptured_match(income=200_000, current_rate=3, employer_match_rate=6,
                            match_percent=50)
    assert full.detail["recommended_rate_pct"] == half.detail["recommended_rate_pct"] == 6


def test_the_stated_RETURN_tracks_the_formula():
    """"An immediate 100% return" is the most persuasive figure in the whole analysis, and quoting
    it for a 50% match overstates the single thing most likely to change behaviour."""
    half = uncaptured_match(income=200_000, current_rate=0, employer_match_rate=6,
                            match_percent=50)
    assert half.detail["immediate_return_on_contribution_pct"] == 50
    assert "not dollar-for-dollar" in half.detail["note"]
    full = uncaptured_match(income=200_000, current_rate=0, employer_match_rate=6)
    assert full.detail["immediate_return_on_contribution_pct"] == 100
    assert "100% return" in full.detail["note"]


def test_capturing_the_full_match_leaves_nothing_on_the_table_either_way():
    for pct in (100, 50, 25):
        r = uncaptured_match(income=200_000, current_rate=6, employer_match_rate=6,
                             match_percent=pct)
        assert r.value == 0.0 and r.detail["capturing_full_match"] is True


@pytest.mark.asyncio
async def test_the_dispatch_uses_the_real_match_percentage_when_the_profile_has_it():
    from app.services.advisor_calculations import AdvisorCalculationPlanner

    half = await AdvisorCalculationPlanner(_resolver(
        income=200_000, retirement_contribution_rate=3, employer_match_rate=6,
        employer_match_percent=50)).compute(_Ctx())
    full = await AdvisorCalculationPlanner(_resolver(
        income=200_000, retirement_contribution_rate=3, employer_match_rate=6)).compute(_Ctx())
    h = next(r for r in half["results"] if r["calculator"] == "career.uncaptured_match")
    f = next(r for r in full["results"] if r["calculator"] == "career.uncaptured_match")
    assert h["value"] == 3_000.0 and f["value"] == 6_000.0


@pytest.mark.asyncio
async def test_the_401k_treatment_rule_also_uses_both_halves():
    """The employer contribution feeds the 415(c) total-additions limit, so overstating it
    understates the headroom the rule reports — the error does not stay in one figure."""
    from app.services.advisor_calculations import AdvisorCalculationPlanner

    half = await AdvisorCalculationPlanner(_resolver(
        income=200_000, retirement_contribution_rate=6, employer_match_rate=6,
        employer_match_percent=50)).compute(_Ctx(), current_age=45)
    full = await AdvisorCalculationPlanner(_resolver(
        income=200_000, retirement_contribution_rate=6, employer_match_rate=6)).compute(
        _Ctx(), current_age=45)
    h = next(t for t in half["treatments"] if t["rule"] == "wrapper.k401_deferral")
    f = next(t for t in full["treatments"] if t["rule"] == "wrapper.k401_deferral")
    assert h["inputs_used"]["employer_contribution"] == 6_000.0
    assert f["inputs_used"]["employer_contribution"] == 12_000.0


def test_the_resolver_prefers_the_STRUCTURED_columns_over_the_ambiguous_document_field():
    """`employer_match_percent` and `employer_match_limit_percent` have existed in
    finance.user_financial_profile since migration 062 and NOTHING ever read them — only the
    document's single ambiguous `employer_match`, which every consumer then treated as a
    dollar-for-dollar cap."""
    import app.services.financial_resolver as R
    src = inspect.getsource(R.FinancialInputResolver.resolve)
    assert "employer_match_limit_percent" in src
    assert "employer_match_percent" in src


# ── 2. The store is actually constructed and consulted ──────────────────────────────────────────
def test_the_planner_is_constructed_WITH_a_store():
    """THE GAP THIS CLOSES. The store was written, tested and never handed a Supabase client, so
    nothing was ever persisted and the cache could never hit — applying the migration would have
    bought the tables and no behaviour."""
    import app.dependencies as D
    src = inspect.getsource(D)
    assert "CalculationStore(supabase)" in src
    assert "answer_cache=calc_store" in src


def test_the_orchestrator_accepts_and_consults_the_cache():
    import app.services.advisor_orchestrator as O
    assert "answer_cache" in inspect.signature(O.AdvisorOrchestrator.__init__).parameters
    src = inspect.getsource(O.AdvisorOrchestrator._enhance)
    assert "lookup_answer" in src, "a hit must be checked before the provider is called"
    assert "save_answer" in src, "a validated answer must be stored"


def test_the_cache_is_consulted_BEFORE_the_provider_and_stored_AFTER_validation():
    """Order is the whole design. Looking up before the context is built would have nothing to
    compare against; storing before validation would cache prose that never passed the gate."""
    import app.services.advisor_orchestrator as O
    src = inspect.getsource(O.AdvisorOrchestrator._enhance)
    i_build = src.index("self._ctx.build")
    i_lookup = src.index("lookup_answer")
    i_generate = src.index("await active.generate")
    i_save = src.index("save_answer")
    assert i_build < i_lookup < i_generate, "lookup sits between the context build and the call"
    assert i_save > i_generate, "store only after the model has run and the answer was accepted"


def test_a_cache_hit_sets_the_key_the_UI_actually_reads():
    """`assistant_message` carries the human-facing text; `response` is read by nothing. Setting
    the wrong one would have produced a silent blank answer on every hit."""
    import app.services.advisor_orchestrator as O
    src = inspect.getsource(O.AdvisorOrchestrator._enhance)
    hit = src[src.index("if cached is not None"):src.index("tr[\"cache_hit\"] = False")]
    assert 'base["assistant_message"] = cached.answer' in hit
    assert 'base["response"]' not in hit


def test_the_planner_attaches_the_fingerprints_to_the_packet():
    """They are computed where the resolved inputs and the turn both exist — the only place they
    do. A consumer deriving them from what it happens to hold would key every user's cache on the
    same empty fingerprint."""
    import asyncio

    from app.services.advisor_calculations import AdvisorCalculationPlanner
    p = asyncio.run(AdvisorCalculationPlanner(_resolver(income=120_000)).compute(_Ctx()))
    assert set(p["fingerprints"]) == {"inputs", "basis"}
    assert all(isinstance(v, str) and len(v) == 32 for v in p["fingerprints"].values())


def test_the_store_prefers_the_packets_fingerprints_over_rederiving_them():
    from app.services.calculation_store import packet_fingerprints
    packet = {"fingerprints": {"inputs": "a" * 32, "basis": "b" * 32}, "results": []}
    assert packet_fingerprints(packet) == ("a" * 32, "b" * 32)
    # And falls back when the planner did not attach them (a direct caller, or an older packet).
    derived = packet_fingerprints({"results": []}, {"income": {"value": 1, "present": True}})
    assert derived[0] != "a" * 32 and len(derived[0]) == 32


# ── 3. The flag stays off, and the reason is testable ───────────────────────────────────────────
def test_the_calculator_flag_remains_DEFAULT_OFF():
    """Not a code gap — a measurement gate. Flipping it changes what reaches the model on every
    finance turn AND widens what the validator admits, and the day before this was written an
    audit of that exact packet found three defects that produced actively wrong advice. All three
    were found by running it, none by review. That is the argument FOR the gate.
    """
    import app.dependencies as D
    src = inspect.getsource(D)
    assert 'os.environ.get("ADVISOR_CALCULATORS_ENABLED", "false")' in src


def test_the_dryrun_harness_exists_so_the_decision_can_be_reviewed_without_credentials():
    """It closes the half of the gate that does not need a model: what the packet ADDS, per
    profile, for free."""
    from pathlib import Path
    script = Path(__file__).resolve().parents[1] / "scripts" / "calc_packet_dryrun.py"
    assert script.exists()
    body = script.read_text()
    assert "no model call" in body.lower() or "no model" in body.lower()
    assert "PROFILES" in body


def test_the_dryrun_produces_a_packet_for_every_profile():
    """Guards the harness itself: a profile that stopped producing a packet would make the review
    artifact quietly empty."""
    import asyncio
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import calc_packet_dryrun as DR

    for name in DR.PROFILES:
        packet = asyncio.run(DR.run(name))
        assert packet["available"] is True, name
        assert packet["results"], name
        assert "fingerprints" in packet, name


def test_the_dryrun_surfaces_the_hsa_conflict_profile():
    """The audit case, kept as a profile so the conflict channel is visible in review."""
    import asyncio
    import sys
    from pathlib import Path
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import calc_packet_dryrun as DR

    p = asyncio.run(DR.run("hsa_excess_risk"))
    assert p["tax_conflicts"], "this profile exists to exercise the conflict channel"
    assert any("HSA" in c["what"] for c in p["tax_conflicts"])
