"""Calculation persistence and the answer cache (Milestone 3.6).

The tests that matter are about when the cache must REFUSE to serve. A cache that saves tokens by
occasionally answering the wrong question, or by answering this year's question with last year's
law, has traded the product's trustworthiness for a rounding error on the bill.
"""
from __future__ import annotations

from typing import Any, Optional

import pytest

from app.services.calculation_store import (
    CalculationStore,
    basis_fingerprint,
    cited_numbers,
    inputs_fingerprint,
    question_signature,
)

U = "11111111-1111-1111-1111-111111111111"
OTHER = "22222222-2222-2222-2222-222222222222"


class FakeDB:
    """Honours filters, so a cross-user or cross-fingerprint bug actually shows up.

    A fake that returned canned rows regardless of `filters` would make the isolation tests below
    pass while the real thing leaked.
    """

    def __init__(self) -> None:
        self.rows: dict[str, list[dict[str, Any]]] = {}
        self.fail_on: set[str] = set()

    async def insert(self, table: str, row: Any, *, schema: str = "public") -> list[dict]:
        if table in self.fail_on:
            raise RuntimeError("storage down")
        rows = self.rows.setdefault(table, [])
        r = dict(row)
        r.setdefault("id", f"{table}-{len(rows)}")
        r.setdefault("created_at", f"2026-10-12T00:0{len(rows)}:00Z")
        r.setdefault("hit_count", 0)
        rows.append(r)
        return [r]

    async def select(self, table: str, *, columns: str = "*",
                     filters: Optional[dict] = None, limit: Optional[int] = None,
                     order: Optional[str] = None, schema: str = "public",
                     user_jwt: Optional[str] = None) -> list[dict]:
        if table in self.fail_on:
            raise RuntimeError("storage down")
        out = list(self.rows.get(table, []))
        for key, expr in (filters or {}).items():
            want = expr.split("eq.", 1)[-1]
            out = [r for r in out if str(r.get(key)) == want]
        if order and "desc" in order:
            out = list(reversed(out))
        return out[: limit or len(out)]

    async def update(self, table: str, patch: dict, *, filters: dict,
                     schema: str = "public") -> list[dict]:
        if table in self.fail_on:
            raise RuntimeError("storage down")
        hit = []
        for r in self.rows.get(table, []):
            if all(str(r.get(k)) == v.split("eq.", 1)[-1] for k, v in filters.items()):
                r.update(patch)
                hit.append(r)
        return hit


def _field(value, present=True):
    return {"value": value, "present": present}


def _inputs(**kw):
    return {k: _field(v) for k, v in kw.items()}


def _packet(value=1000.0, table_year=2024, available=True, numbers=None):
    return {
        "available": available,
        "results": [{"calculator": "tax.federal_income_tax", "value": value,
                     "inputs_used": {"tax_year": 2026},
                     "detail": {"table_provenance": f"{table_year} table (verified)"}}],
        "treatments": [],
        "gaps": [],
        "allowed_numbers": numbers if numbers is not None else [str(int(value))],
        "scenario_numbers": [],
        "tax_year_requested": 2026,
    }


# ── Fingerprinting ───────────────────────────────────────────────────────────────────────────────
def test_the_inputs_fingerprint_ignores_dict_order_and_float_noise():
    a = inputs_fingerprint({"income": _field(100_000.0), "cash_balance": _field(5_000.0)})
    b = inputs_fingerprint({"cash_balance": _field(5_000.0000000001),
                            "income": _field(100_000.0)})
    assert a == b


def test_a_changed_fact_changes_the_fingerprint():
    a = inputs_fingerprint({"income": _field(100_000.0)})
    b = inputs_fingerprint({"income": _field(120_000.0)})
    assert a != b


def test_ABSENT_inputs_are_excluded_rather_than_hashed_as_null():
    """Otherwise adding one unrelated missing field to the resolver would invalidate every user's
    cache at once, for facts none of them had."""
    a = inputs_fingerprint({"income": _field(100_000.0)})
    b = inputs_fingerprint({"income": _field(100_000.0),
                            "expense_ratio": _field(None, present=False)})
    assert a == b


def test_the_basis_fingerprint_tracks_the_TABLE_year_actually_used_not_the_one_requested():
    """THE SUBTLE HALF. Every tax figure currently falls back to the newest VERIFIED year, which is
    2024, while the request says 2026. Hashing the request would make the cache blind to the
    verification that changes every number in the engine.
    """
    on_2024 = _packet(table_year=2024)
    on_2026 = _packet(table_year=2026)
    assert on_2024["tax_year_requested"] == on_2026["tax_year_requested"] == 2026
    assert basis_fingerprint(on_2024) != basis_fingerprint(on_2026)


def test_the_basis_fingerprint_tracks_treatment_parameter_verification():
    base = _packet()
    unverified = {**base, "treatments": [
        {"rule": "wrapper.hsa_contribution", "parameter_year": 2026,
         "parameters_verified": False}]}
    verified = {**base, "treatments": [
        {"rule": "wrapper.hsa_contribution", "parameter_year": 2026,
         "parameters_verified": True}]}
    assert basis_fingerprint(unverified) != basis_fingerprint(verified)


# ── Question signatures: exact, never fuzzy ──────────────────────────────────────────────────────
def test_the_same_question_phrased_with_filler_matches():
    a = question_signature("Can you tell me how much tax I will owe this year?")
    b = question_signature("how much tax I will owe this year")
    assert a is not None and a == b


def test_punctuation_and_case_do_not_change_the_signature():
    assert question_signature("How much TAX will I owe?!") == \
        question_signature("how much tax will i owe")


def test_DIFFERENT_questions_get_different_signatures():
    """The whole safety property. A collision serves the answer to another question."""
    sigs = {
        question_signature("how much tax will I owe this year"),
        question_signature("how much tax did I owe last year"),
        question_signature("should I itemize or take the standard deduction"),
        question_signature("when should I claim social security"),
    }
    assert len(sigs) == 4


def test_a_question_too_short_to_be_distinct_is_not_cacheable():
    """"what now?" would collide across wildly different contexts, and a miss only costs tokens
    while a collision costs trust."""
    for q in ("", "what now?", "and?", "ok thanks"):
        assert question_signature(q) is None


# ── Serving, and refusing to serve ───────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_an_identical_question_on_identical_facts_is_served_from_cache():
    db, store = FakeDB(), None
    store = CalculationStore(db)
    q, inputs, packet = "how much tax will I owe this year", _inputs(income=100_000.0), _packet()
    assert await store.save_answer(U, q, "You will owe about 1000.", packet, inputs) is True
    hit = await store.lookup_answer(U, q, packet, inputs)
    assert hit is not None
    assert hit.answer == "You will owe about 1000."
    assert hit.as_dict()["served_from"] == "answer_cache"


@pytest.mark.asyncio
async def test_a_CHANGED_FACT_refuses_the_cache():
    store = CalculationStore(FakeDB())
    q = "how much tax will I owe this year"
    await store.save_answer(U, q, "About 1000.", _packet(), _inputs(income=100_000.0))
    assert await store.lookup_answer(U, q, _packet(2000.0),
                                     _inputs(income=150_000.0)) is None


@pytest.mark.asyncio
async def test_CHANGED_LAW_refuses_the_cache_even_when_the_users_facts_are_identical():
    """THE CASE AN INPUTS-ONLY CACHE GETS WRONG, and it is not hypothetical: it happens the moment
    the 2026 tables are verified. Nothing in the user's data changes, so an inputs-only fingerprint
    sees no reason to refresh — and the user is answered with last year's law.
    """
    store = CalculationStore(FakeDB())
    q, inputs = "how much tax will I owe this year", _inputs(income=100_000.0)
    await store.save_answer(U, q, "About 1000.", _packet(table_year=2024), inputs)
    assert await store.lookup_answer(U, q, _packet(table_year=2024), inputs) is not None
    assert await store.lookup_answer(U, q, _packet(table_year=2026), inputs) is None


@pytest.mark.asyncio
async def test_an_answer_citing_a_figure_the_engine_no_longer_computes_is_refused():
    """The belt to the fingerprint's braces. If a cited number is not one the gate would now allow,
    the answer is stale whatever the fingerprints say."""
    store = CalculationStore(FakeDB())
    q, inputs = "how much tax will I owe this year", _inputs(income=100_000.0)
    await store.save_answer(U, q, "You will owe about 1000.", _packet(), inputs)
    # Same facts, same basis, but the engine no longer produces 1000.
    stale = _packet()
    stale["allowed_numbers"] = ["4242"]
    assert await store.lookup_answer(U, q, stale, inputs) is None


@pytest.mark.asyncio
async def test_a_DIFFERENT_question_is_never_served_another_questions_answer():
    store = CalculationStore(FakeDB())
    inputs, packet = _inputs(income=100_000.0), _packet()
    await store.save_answer(U, "how much tax will I owe this year", "About 1000.",
                            packet, inputs)
    assert await store.lookup_answer(U, "should I itemize or take the standard deduction",
                                     packet, inputs) is None


@pytest.mark.asyncio
async def test_one_users_answer_is_NEVER_served_to_another():
    """The cache key includes the user, and the fake honours filters so a leak would surface."""
    store = CalculationStore(FakeDB())
    q, inputs, packet = "how much tax will I owe this year", _inputs(income=100_000.0), _packet()
    await store.save_answer(U, q, "About 1000.", packet, inputs)
    assert await store.lookup_answer(OTHER, q, packet, inputs) is None


@pytest.mark.asyncio
async def test_an_ungrounded_answer_is_not_cached():
    """It has no fingerprint worth keying on, so caching it would keep serving ungrounded prose
    after the grounding arrived."""
    store = CalculationStore(FakeDB())
    assert await store.save_answer(U, "how much tax will I owe this year", "I'm not sure.",
                                   _packet(available=False), _inputs()) is False


@pytest.mark.asyncio
async def test_an_empty_answer_is_not_cached():
    store = CalculationStore(FakeDB())
    assert await store.save_answer(U, "how much tax will I owe this year", "   ",
                                   _packet(), _inputs(income=1.0)) is False


@pytest.mark.asyncio
async def test_a_hit_increments_the_hit_count():
    db = FakeDB()
    store = CalculationStore(db)
    q, inputs, packet = "how much tax will I owe this year", _inputs(income=100_000.0), _packet()
    await store.save_answer(U, q, "About 1000.", packet, inputs)
    first = await store.lookup_answer(U, q, packet, inputs)
    second = await store.lookup_answer(U, q, packet, inputs)
    assert first.hit_count == 1 and second.hit_count == 2
    assert db.rows["answer_cache"][0]["last_served_at"].startswith("20")


@pytest.mark.asyncio
async def test_the_served_timestamp_is_a_real_timestamp_not_the_literal_now():
    """Checked by PARSING it, not by reading the source. PostgREST sends JSON, so the string
    "now()" would be stored verbatim as four characters and the column would never hold a date."""
    from datetime import datetime

    db = FakeDB()
    store = CalculationStore(db)
    q, inputs, packet = "how much tax will I owe this year", _inputs(income=100_000.0), _packet()
    await store.save_answer(U, q, "About 1000.", packet, inputs)
    await store.lookup_answer(U, q, packet, inputs)
    stamp = db.rows["answer_cache"][0]["last_served_at"]
    assert datetime.fromisoformat(stamp).year >= 2026


# ── Snapshots and plan-vs-actual ─────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_snapshot_records_what_was_computed_and_which_inputs_were_present():
    db = FakeDB()
    store = CalculationStore(db)
    inputs = _inputs(income=100_000.0, filing_status="single")
    assert await store.save_snapshot(U, _packet(), tax_year=2026, inputs=inputs) is not None
    row = db.rows["calculation_snapshots"][0]
    assert row["calculator_count"] == 1
    assert sorted(row["inputs_present"]) == ["filing_status", "income"]
    assert row["tax_year"] == 2026


@pytest.mark.asyncio
async def test_an_unavailable_packet_is_not_snapshotted():
    db = FakeDB()
    assert await CalculationStore(db).save_snapshot(U, _packet(available=False)) is None
    assert "calculation_snapshots" not in db.rows


@pytest.mark.asyncio
async def test_what_changed_reports_the_figures_that_MOVED_and_why():
    """A plan that moved should say why. "Your tax went up" is not advice; "it went up because you
    added your cost basis" is."""
    store = CalculationStore(FakeDB())
    old_inputs = _inputs(income=100_000.0)
    await store.save_snapshot(U, _packet(1000.0), inputs=old_inputs)
    new_inputs = _inputs(income=120_000.0, capital_gain=30_000.0)
    changed = await store.what_changed(U, _packet(1800.0), new_inputs)
    assert changed["has_history"] is True
    assert changed["moved"] == [{"calculator": "tax.federal_income_tax", "was": 1000.0,
                                 "now": 1800.0, "change": 800.0}]
    assert changed["inputs_added"] == ["capital_gain"]


@pytest.mark.asyncio
async def test_what_changed_reports_a_LAW_change_separately_from_a_fact_change():
    """So "your number moved because the tax tables were verified" is distinguishable from "your
    number moved because your income rose" — the user did nothing in the first case."""
    store = CalculationStore(FakeDB())
    inputs = _inputs(income=100_000.0)
    await store.save_snapshot(U, _packet(1000.0, table_year=2024), inputs=inputs)
    changed = await store.what_changed(U, _packet(1100.0, table_year=2026), inputs)
    assert changed["basis_changed"] is True
    assert changed["inputs_added"] is None


@pytest.mark.asyncio
async def test_no_history_is_reported_plainly_rather_than_as_no_change():
    changed = await CalculationStore(FakeDB()).what_changed(U, _packet(), _inputs())
    assert changed == {"has_history": False}


@pytest.mark.asyncio
async def test_newly_and_no_longer_computable_figures_are_named():
    store = CalculationStore(FakeDB())
    await store.save_snapshot(U, _packet(), inputs=_inputs(income=1.0))
    grown = _packet()
    grown["results"] = grown["results"] + [
        {"calculator": "tax.itemized_deductions", "value": 42_000.0,
         "inputs_used": {}, "detail": {}}]
    changed = await store.what_changed(U, grown, _inputs(income=1.0))
    assert changed["newly_computable"] == ["tax.itemized_deductions"]
    assert changed["no_longer_computable"] == []


# ── Storage failures never cost an answer ────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_storage_failure_on_WRITE_is_swallowed():
    db = FakeDB()
    db.fail_on = {"calculation_snapshots", "answer_cache"}
    store = CalculationStore(db)
    assert await store.save_snapshot(U, _packet(), inputs=_inputs(income=1.0)) is None
    assert await store.save_answer(U, "how much tax will I owe this year", "x",
                                   _packet(), _inputs(income=1.0)) is False


@pytest.mark.asyncio
async def test_a_storage_failure_on_READ_is_a_MISS_not_an_exception():
    """A failed read costs tokens. An exception costs the user their turn."""
    db = FakeDB()
    db.fail_on = {"answer_cache", "calculation_snapshots"}
    store = CalculationStore(db)
    assert await store.lookup_answer(U, "how much tax will I owe this year",
                                     _packet(), _inputs(income=1.0)) is None
    assert await store.previous_snapshot(U) is None
    assert await store.what_changed(U, _packet(), _inputs()) == {"has_history": False}


# ── Cited numbers ────────────────────────────────────────────────────────────────────────────────
def test_cited_numbers_are_extracted_with_commas_normalized():
    assert cited_numbers("You owe $12,345 and will save 1,000.50") == ["1000.50", "12345"]


def test_cited_numbers_of_prose_with_no_figures_is_empty():
    assert cited_numbers("It depends on your filing status.") == []


# ── The planner integrates it without requiring it ───────────────────────────────────────────────
@pytest.mark.asyncio
async def test_the_planner_works_with_NO_store_at_all():
    from app.services.advisor_calculations import AdvisorCalculationPlanner

    from .test_advisor_calculations import _Ctx, _resolver
    p = await AdvisorCalculationPlanner(_resolver(income=100_000.0)).compute(_Ctx())
    assert "changes_since_last" not in p


@pytest.mark.asyncio
async def test_the_planner_stores_a_snapshot_and_reports_changes_when_given_a_store():
    from app.services.advisor_calculations import AdvisorCalculationPlanner

    from .test_advisor_calculations import _Ctx, _resolver
    db = FakeDB()
    store = CalculationStore(db)
    res = _resolver(income=100_000.0, retirement_balance=250_000.0)
    first = await AdvisorCalculationPlanner(res, store).compute(_Ctx())
    assert first["changes_since_last"] == {"has_history": False}
    assert len(db.rows["calculation_snapshots"]) == 1

    second = await AdvisorCalculationPlanner(res, store).compute(_Ctx())
    assert second["changes_since_last"]["has_history"] is True
    assert second["changes_since_last"]["moved"] == [], "nothing changed, so nothing moved"


# ── P0 audit fixes: the cache must refuse on a flipped verdict or a changed turn ─────────────────
def _with_det(determination, amount=3000.0):
    return {**_packet(1000.0), "treatments": [
        {"rule": "debt_interest.heloc", "determination": determination, "amount": amount,
         "parameter_year": 2026, "parameters_verified": False}]}


@pytest.mark.asyncio
async def test_a_FLIPPED_DETERMINATION_refuses_the_cache():
    """THE WORST THING A CACHE CAN DO, and it did it. `basis_fingerprint` hashed only
    (rule, parameter_year, parameters_verified), so a verdict that flipped left it unchanged:
    verified live, the cache served "Yes — it is deductible" after the engine had decided the same
    HELOC interest was NOT deductible. Inverting tax advice, to save tokens.
    """
    store = CalculationStore(FakeDB())
    q, inputs = "is my heloc interest deductible this year", _inputs(income=150_000.0)
    await store.save_answer(U, q, "Yes — it is deductible, worth about 1000.",
                            _with_det("deductible"), inputs,
                            turn={"heloc_proceeds_used_for": "home_improvement"})
    assert await store.lookup_answer(
        U, q, _with_det("not_deductible", 0.0), inputs,
        turn={"heloc_proceeds_used_for": "debt_payoff"}) is None
    # ...and still serves a genuine repeat, so the fix did not simply disable the cache.
    assert await store.lookup_answer(
        U, q, _with_det("deductible"), inputs,
        turn={"heloc_proceeds_used_for": "home_improvement"}) is not None


@pytest.mark.asyncio
async def test_a_CHANGED_TURN_FACT_refuses_the_cache():
    """The turn is part of the facts. "When can I retire?" asked at 45 must not be answered again
    at 55 from cache, and age arrives per turn rather than from storage."""
    store = CalculationStore(FakeDB())
    q, inputs = "when can I afford to retire", _inputs(income=150_000.0)
    await store.save_answer(U, q, "You can retire at about 1000.", _packet(), inputs,
                            turn={"current_age": 45})
    assert await store.lookup_answer(U, q, _packet(), inputs,
                                     turn={"current_age": 55}) is None
    assert await store.lookup_answer(U, q, _packet(), inputs,
                                     turn={"current_age": 45}) is not None


@pytest.mark.asyncio
async def test_an_answer_given_during_a_CONFLICT_is_never_cached():
    """The remedy is time-sensitive — an excess HSA contribution has to come out before the return
    is due — so this answer must be regenerated, with today's urgency, every time it is asked."""
    store = CalculationStore(FakeDB())
    conflicted = {**_packet(), "tax_conflicts": [
        {"what": "excess HSA contributions", "because": "no HDHP", "amount_at_risk": 8_000}]}
    assert await store.save_answer(U, "should I keep funding my hsa", "Yes, about 1000.",
                                   conflicted, _inputs(income=1.0)) is False


@pytest.mark.asyncio
async def test_a_NEW_CONFLICT_refuses_a_previously_cached_answer():
    store = CalculationStore(FakeDB())
    q, inputs = "how much tax will I owe this year", _inputs(income=100_000.0)
    await store.save_answer(U, q, "About 1000.", _packet(), inputs)
    now_conflicted = {**_packet(), "tax_conflicts": [
        {"what": "excess HSA contributions", "because": "no HDHP", "amount_at_risk": 8_000}]}
    assert await store.lookup_answer(U, q, now_conflicted, inputs) is None


@pytest.mark.asyncio
async def test_what_changed_reports_a_FLIPPED_DETERMINATION():
    """Usually the most important thing that happened, and comparing only `results` reported
    nothing when a deduction became a non-deduction."""
    store = CalculationStore(FakeDB())
    inputs = _inputs(income=150_000.0)
    await store.save_snapshot(U, _with_det("deductible"), inputs=inputs)
    changed = await store.what_changed(U, _with_det("not_deductible", 0.0), inputs)
    assert changed["determinations_flipped"] == [
        {"rule": "debt_interest.heloc", "was": "deductible", "now": "not_deductible"}]
