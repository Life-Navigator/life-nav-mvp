"""Sprint 7 — Finance Snapshot Intelligence: snapshot engine + trend/change analysis."""
from __future__ import annotations

from datetime import date

import pytest

from app.models.common import UserContext
from app.services.snapshots import SnapshotEngine, TrendAnalyzer

from .conftest import FakeSupabase

CTX = UserContext(user_id="11111111-1111-1111-1111-111111111111")
ACCOUNTS = [
    {"id": "a1", "account_type": "depository", "current_balance": 20000},
    {"id": "a2", "account_type": "investment", "current_balance": 50000},
    {"id": "a3", "account_type": "credit_card", "current_balance": 5000},
]
NW_HISTORY = [
    {"id": "n1", "user_id": CTX.user_id, "as_of_date": "2026-04-30", "net_worth": 60000, "total_liabilities": 5000},
    {"id": "n2", "user_id": CTX.user_id, "as_of_date": "2026-05-31", "net_worth": 63000, "total_liabilities": 4500},
]
CF_HISTORY = [
    {"id": "c1", "user_id": CTX.user_id, "period_end": "2026-04-30", "net_cash_flow": 2000},
    {"id": "c2", "user_id": CTX.user_id, "period_end": "2026-05-31", "net_cash_flow": 2500},
]


@pytest.mark.asyncio
async def test_compute_net_worth_from_accounts():
    eng = SnapshotEngine(FakeSupabase({"financial_accounts": ACCOUNTS}))
    c = await eng.compute(CTX)
    assert c["total_assets"] == 70000  # 20k + 50k
    assert c["total_liabilities"] == 5000  # credit card
    assert c["net_worth"] == 65000


@pytest.mark.asyncio
async def test_take_snapshot_persists_idempotently():
    sb = FakeSupabase({"financial_accounts": ACCOUNTS})
    eng = SnapshotEngine(sb)
    s1 = await eng.take_snapshot(CTX, as_of=date(2026, 6, 30))
    await eng.take_snapshot(CTX, as_of=date(2026, 6, 30))  # same period -> upsert in place
    nw = await sb.select("net_worth_snapshots", filters={"user_id": f"eq.{CTX.user_id}"}, schema="finance")
    assert s1["net_worth"] == 65000
    assert len(nw) == 1  # idempotent per period


@pytest.mark.asyncio
async def test_trends_compute_delta_and_direction():
    sb = FakeSupabase({"net_worth_snapshots": NW_HISTORY, "cash_flow_snapshots": CF_HISTORY})
    t = await TrendAnalyzer(sb).trends(CTX)
    assert t["has_history"] is True
    assert t["net_worth"]["current"] == 63000 and t["net_worth"]["delta"] == 3000
    assert t["net_worth"]["trend"] == "improving"
    assert t["debt"]["delta"] == -500 and t["debt"]["trend"] == "improving"  # debt down = improving


@pytest.mark.asyncio
async def test_change_detection_narrates_what_changed():
    sb = FakeSupabase({"net_worth_snapshots": NW_HISTORY, "cash_flow_snapshots": CF_HISTORY})
    t = await TrendAnalyzer(sb).trends(CTX)
    metrics = {c["metric"] for c in t["change_detection"]}
    assert "net_worth" in metrics
    nw_change = next(c for c in t["change_detection"] if c["metric"] == "net_worth")
    assert nw_change["direction"] == "up" and "rose" in nw_change["narrative"]


@pytest.mark.asyncio
async def test_no_history_is_flat_not_fabricated():
    t = await TrendAnalyzer(FakeSupabase({})).trends(CTX)
    assert t["has_history"] is False
    assert t["net_worth"]["current"] is None and t["net_worth"]["trend"] == "unknown"
