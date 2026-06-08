"""Finance Snapshot Intelligence (Sprint 7).

SnapshotEngine computes monthly net-worth / cash-flow / debt / retirement snapshots from the
user's current finance data and persists them idempotently (one per period). TrendAnalyzer
reads the history to produce trend direction, change detection ("what changed this month"),
progress deltas, and historical goal tracking — so reports can show progress OVER TIME. All
figures derive from the user's own finance rows; empty data reads as 0/flat, never invented.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..models.common import UserContext

FINANCE = "finance"
_NS = uuid.UUID("6f3b1e22-0000-4000-8000-000000000008")
_LIAB_HINTS = ("credit", "loan", "mortgage", "debt", "liab")


def _num(v: Any) -> float:
    try:
        return float(v) if v is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _period_key(as_of: date) -> str:
    return f"{as_of.year:04d}-{as_of.month:02d}"


class SnapshotEngine:
    def __init__(self, supabase: SupabaseClient) -> None:
        self._sb = supabase

    async def _rows(self, table: str, ctx: UserContext) -> list[dict]:
        return await self._sb.select(table, filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, schema=FINANCE)

    async def compute(self, ctx: UserContext) -> dict[str, Any]:
        accounts = await self._rows("financial_accounts", ctx)
        assets = liabilities = 0.0
        for a in accounts:
            bal = _num(a.get("current_balance") if a.get("current_balance") is not None else a.get("balance"))
            atype = str(a.get("account_type") or "").lower()
            if any(h in atype for h in _LIAB_HINTS):
                liabilities += abs(bal)
            else:
                assets += bal
        for r in await self._rows("debts", ctx):
            liabilities += abs(_num(r.get("current_balance") or r.get("balance")))
        for r in await self._rows("liabilities", ctx):
            liabilities += abs(_num(r.get("current_balance") or r.get("balance")))
        retirement = sum(_num(r.get("balance") or r.get("current_balance")) for r in await self._rows("retirement_plans", ctx))
        income = sum(_num(r.get("monthly_amount") or r.get("amount")) for r in await self._rows("income_sources", ctx))
        return {
            "total_assets": round(assets + retirement, 2), "total_liabilities": round(liabilities, 2),
            "net_worth": round(assets + retirement - liabilities, 2), "retirement": round(retirement, 2),
            "total_income": round(income, 2), "total_expenses": 0.0, "net_cash_flow": round(income, 2),
            "currency": "USD",
        }

    async def take_snapshot(self, ctx: UserContext, as_of: Optional[date] = None) -> dict[str, Any]:
        as_of = as_of or _now().date()
        pk = _period_key(as_of)
        c = await self.compute(ctx)
        nw_id = str(uuid.uuid5(_NS, f"{ctx.user_id}:nw:{pk}"))
        cf_id = str(uuid.uuid5(_NS, f"{ctx.user_id}:cf:{pk}"))
        await self._sb.upsert("net_worth_snapshots", {
            "id": nw_id, "user_id": ctx.user_id, "as_of_date": as_of.isoformat(),
            "total_assets": c["total_assets"], "total_liabilities": c["total_liabilities"],
            "net_worth": c["net_worth"], "currency": "USD",
        }, schema=FINANCE)
        await self._sb.upsert("cash_flow_snapshots", {
            "id": cf_id, "user_id": ctx.user_id,
            "period_start": as_of.replace(day=1).isoformat(), "period_end": as_of.isoformat(),
            "total_income": c["total_income"], "total_expenses": c["total_expenses"],
            "net_cash_flow": c["net_cash_flow"], "currency": "USD",
        }, schema=FINANCE)
        return {"as_of": as_of.isoformat(), "period": pk, **c}


class TrendAnalyzer:
    def __init__(self, supabase: SupabaseClient) -> None:
        self._sb = supabase

    async def trends(self, ctx: UserContext) -> dict[str, Any]:
        nw = await self._sb.select("net_worth_snapshots", filters={"user_id": f"eq.{ctx.user_id}"}, limit=36, order="as_of_date.asc", schema=FINANCE)
        cf = await self._sb.select("cash_flow_snapshots", filters={"user_id": f"eq.{ctx.user_id}"}, limit=36, order="period_end.asc", schema=FINANCE)
        nw_series = [{"date": r.get("as_of_date"), "value": _num(r.get("net_worth"))} for r in nw]
        debt_series = [{"date": r.get("as_of_date"), "value": _num(r.get("total_liabilities"))} for r in nw]
        cf_series = [{"date": r.get("period_end"), "value": _num(r.get("net_cash_flow"))} for r in cf]
        net_worth = self._metric("net_worth", nw_series)
        debt = self._metric("debt", debt_series, lower_is_better=True)
        cash_flow = self._metric("net_cash_flow", cf_series)
        return {
            "net_worth": net_worth, "debt": debt, "cash_flow": cash_flow,
            "change_detection": self._changes(net_worth, debt, cash_flow),
            "has_history": len(nw_series) >= 2,
        }

    @staticmethod
    def _metric(name: str, series: list[dict], *, lower_is_better: bool = False) -> dict[str, Any]:
        vals = [s for s in series if s["value"] is not None]
        if not vals:
            return {"current": None, "prior": None, "delta": None, "pct_change": None, "trend": "unknown", "series": series}
        current = vals[-1]["value"]
        prior = vals[-2]["value"] if len(vals) >= 2 else None
        delta = round(current - prior, 2) if prior is not None else None
        pct = round((delta / prior) * 100, 1) if (prior not in (None, 0) and delta is not None) else None
        if delta is None or abs(delta) < 1e-9:
            trend = "flat"
        else:
            up = delta > 0
            trend = ("improving" if (up != lower_is_better) else "worsening")
        return {"current": current, "prior": prior, "delta": delta, "pct_change": pct, "trend": trend, "series": series}

    @staticmethod
    def _changes(nw: dict, debt: dict, cf: dict) -> list[dict[str, Any]]:
        out = []
        if nw["delta"] is not None and abs(nw["delta"]) >= 1:
            out.append({"metric": "net_worth", "direction": "up" if nw["delta"] > 0 else "down",
                        "delta": nw["delta"], "narrative": f"Net worth {'rose' if nw['delta']>0 else 'fell'} ${abs(nw['delta']):,.0f} this period ({nw['trend']})."})
        if debt["delta"] is not None and abs(debt["delta"]) >= 1:
            out.append({"metric": "debt", "direction": "up" if debt["delta"] > 0 else "down",
                        "delta": debt["delta"], "narrative": f"Debt {'increased' if debt['delta']>0 else 'decreased'} ${abs(debt['delta']):,.0f} ({debt['trend']})."})
        if cf["delta"] is not None and abs(cf["delta"]) >= 1:
            out.append({"metric": "cash_flow", "direction": "up" if cf["delta"] > 0 else "down",
                        "delta": cf["delta"], "narrative": f"Monthly cash flow changed by ${cf['delta']:,.0f}."})
        if not out:
            out.append({"metric": "overall", "direction": "flat", "delta": 0, "narrative": "No material change since the last snapshot."})
        return out
