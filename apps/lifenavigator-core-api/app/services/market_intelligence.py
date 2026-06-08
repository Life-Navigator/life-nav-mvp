"""Job-Market Intelligence — the ln_central reference service layer + market position.

Central reference data (occupations, roles, skills_reference, compensation_bands,
market_demand_snapshots) is NON-tenant and cited BY VALUE into per-user evidence —
never linked cross-tenant (JOB_MARKET_INTELLIGENCE_ARCHITECTURE). This sprint builds the
service layer + MarketPositionAnalyzer; full BLS/O*NET ingestion is a later sprint.

Missing reference data -> an honest "unknown/insufficient data" position, never invented.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from .compensation import soc_for

CENTRAL = "ln_central"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _num(v: Any) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _level(value: Optional[float], lo: float, hi: float) -> str:
    if value is None:
        return "unknown"
    if value >= hi:
        return "high"
    if value <= lo:
        return "low"
    return "moderate"


class MarketPositionAnalyzer:
    """Reads ln_central.market_demand_snapshots and reports a cited market position."""

    def __init__(self, supabase: SupabaseClient) -> None:
        self._sb = supabase

    async def position(self, *, role_title: Optional[str], geography: Optional[str] = "US") -> dict[str, Any]:
        occ = soc_for(role_title)
        if not occ:
            return self._unknown("no occupation mapping for role")
        snap = None
        for geo in (geography or "US", "US"):
            rows = await self._sb.select(
                "market_demand_snapshots",
                filters={"occupation_code": f"eq.{occ}", "geography": f"eq.{geo}"},
                limit=1,
                order="as_of_date.desc",
                schema=CENTRAL,
            )
            if rows:
                snap = rows[0]
                break
        if not snap:
            return self._unknown("no market_demand_snapshot for occupation/geography")
        growth = _num(snap.get("growth_rate"))
        saturation = _num(snap.get("saturation"))
        return {
            "occupation_code": occ,
            "geography": snap.get("geography"),
            "demand_level": _level(growth, 0.0, 0.05),          # growth as a demand proxy
            "supply_level": _level(saturation, 0.4, 0.8),
            "growth_outlook": growth,
            "regional_outlook": snap.get("geography"),
            "competition_level": _level(saturation, 0.4, 0.8),  # higher saturation = more competition
            "openings": snap.get("openings"),
            "source": snap.get("source_name"),
            "as_of": snap.get("as_of_date"),
            "confidence": _num(snap.get("confidence")) or 0.6,
            "missing": [],
        }

    @staticmethod
    def _unknown(reason: str) -> dict[str, Any]:
        return {
            "demand_level": "unknown", "supply_level": "unknown", "growth_outlook": None,
            "regional_outlook": None, "competition_level": "unknown", "source": None,
            "as_of": None, "confidence": 0.0, "missing": ["market_demand_snapshot"], "reason": reason,
        }
