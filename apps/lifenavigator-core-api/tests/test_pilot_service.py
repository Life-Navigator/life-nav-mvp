"""Pilot feedback + analytics service tests (no live DB; fake supabase)."""
from __future__ import annotations

import pytest

from app.services.pilot_service import FeedbackService, PilotAnalyticsService


class FakeSB:
    def __init__(self):
        self.inserted = []
    async def insert(self, table, row, *, schema="public"):
        self.inserted.append((schema, table, row))
        return [{"id": "fb-1", **row}]
    async def count(self, table, *, filters=None, schema="public"):
        return {"eq.enhanced": 8, "eq.safety_fallback": 2}.get((filters or {}).get("llm_status"), 10)
    async def select(self, table, *, schema="public", **kw):
        if table == "pilot_feedback_summary":
            return [{"total_feedback": 12, "thumbs_up": 9, "thumbs_down": 3, "avg_trust": 4.3,
                     "avg_usefulness": 4.1, "avg_nps": 8.2, "nps_promoters": 7, "nps_detractors": 2,
                     "nps_responses": 12}]
        return []


@pytest.mark.asyncio
async def test_feedback_valid_payload_stored():
    sb = FakeSB()
    res = await FeedbackService(sb).submit("user-1", {
        "thumbs": "up", "trust_rating": 5, "usefulness_rating": 4, "nps": 9, "comment": "great"})
    assert res["ok"] and res["stored"]
    schema, table, row = sb.inserted[0]
    assert schema == "analytics" and table == "pilot_feedback"
    assert row["user_id"] == "user-1" and row["thumbs"] == "up" and row["trust_rating"] == 5 and row["nps"] == 9


@pytest.mark.asyncio
async def test_feedback_out_of_range_dropped_not_errored():
    sb = FakeSB()
    res = await FeedbackService(sb).submit("u", {"thumbs": "up", "trust_rating": 9, "nps": 99})
    row = sb.inserted[0][2]
    assert res["ok"] and row["trust_rating"] is None and row["nps"] is None  # invalid dropped
    assert row["thumbs"] == "up"


@pytest.mark.asyncio
async def test_feedback_invalid_thumbs_dropped():
    sb = FakeSB()
    await FeedbackService(sb).submit("u", {"thumbs": "sideways", "usefulness_rating": 3})
    assert sb.inserted[0][2]["thumbs"] is None


@pytest.mark.asyncio
async def test_feedback_empty_rejected():
    sb = FakeSB()
    res = await FeedbackService(sb).submit("u", {})
    assert res["ok"] is False and res["error"] == "no_feedback_provided" and not sb.inserted


@pytest.mark.asyncio
async def test_feedback_no_supabase_accepts_without_store():
    res = await FeedbackService(None).submit("u", {"thumbs": "down"})
    assert res["ok"] and res["stored"] is False


@pytest.mark.asyncio
async def test_pilot_analytics_summary_shape():
    out = await PilotAnalyticsService(FakeSB()).summary()
    assert out["advisor"]["total_turns"] == 10 and out["advisor"]["enhanced_turns"] == 8
    assert out["advisor"]["enhanced_rate"] == 0.8
    assert out["safety"]["safety_fallback_turns"] == 2
    assert out["feedback"]["avg_trust"] == 4.3
    assert out["feedback"]["nps_score"] == round(100 * (7 - 2) / 12, 1)  # NPS computed


# --- Pilot Intelligence instruments -------------------------------------------
@pytest.mark.asyncio
async def test_feedback_accepts_instruments():
    sb = FakeSB()
    res = await FeedbackService(sb).submit("u", {
        "kind": "narrative_accuracy",
        "metrics": {"narrative_accuracy": 9, "understanding": 8, "personalization": 7},
        "insight_detected": "yes", "surprised": True,
        "context": {"narrative_key": "family_foundation"}, "comment": "spot on"})
    assert res["ok"] and res["stored"]
    row = sb.inserted[-1][2]
    assert row["kind"] == "narrative_accuracy"
    assert row["metrics"]["narrative_accuracy"] == 9 and row["metrics"]["understanding"] == 8
    assert row["insight_detected"] is True and row["surprised"] is True
    assert row["context"]["narrative_key"] == "family_foundation"


@pytest.mark.asyncio
async def test_feedback_metric_validation_drops_bad_keys_and_ranges():
    sb = FakeSB()
    await FeedbackService(sb).submit("u", {"metrics": {"narrative_accuracy": 99, "made_up": 5, "trust": 8}})
    m = sb.inserted[-1][2]["metrics"]
    assert m == {"trust": 8}                       # 99 out of range dropped; unknown key dropped


@pytest.mark.asyncio
async def test_feedback_instrument_only_signal_saves():
    sb = FakeSB()
    res = await FeedbackService(sb).submit("u", {"insight_detected": "no"})  # no legacy signal at all
    assert res["ok"] and res["stored"]             # an instrument-only response is a real signal


def test_aggregate_instruments_computes_rates():
    rows = [
        {"metrics": {"narrative_accuracy": 9, "trust": 8}, "insight_detected": True, "surprised": True},
        {"metrics": {"narrative_accuracy": 7}, "insight_detected": False, "surprised": None},
        {"metrics": {}, "insight_detected": True, "surprised": False},
    ]
    agg = PilotAnalyticsService._aggregate_instruments(rows)
    assert agg["averages"]["narrative_accuracy"] == 8.0        # (9+7)/2
    assert agg["averages"]["trust"] == 8.0
    assert agg["insight_rate"] == round(2 / 3, 3)              # 2 yes of 3
    assert agg["holy_shit_rate"] == 0.5                        # 1 yes of 2 answered
    assert agg["total_feedback_rows"] == 3
