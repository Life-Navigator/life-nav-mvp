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
