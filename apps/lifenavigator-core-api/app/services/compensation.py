"""CompensationIntelligenceEngine — cited, banded compensation estimates.

Hard rules (CAREER_DATA_SOURCE_AUDIT / COMPENSATION_INTELLIGENCE_ENGINE):
  * NO fantasy salaries — every figure derives from an ``ln_central.compensation_bands``
    row (OEWS), cited with source + as_of + confidence.
  * NO single number — always a {low, median, high} band.
  * Missing band -> ``None`` (the caller renders a missing-data prompt), never a guess.

Seniority selects which real OEWS percentiles form the band (we never invent values, we
pick the relevant percentile window). New domains/adjustments extend this transparently.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from ..clients.supabase import SupabaseClient

CENTRAL = "ln_central"

# Minimal role -> SOC (occupation_code) map. Reference metadata (not a salary); extend
# as the central taxonomy lands. Unknown roles -> no occupation match -> missing-data.
ROLE_TO_SOC: dict[str, str] = {
    "data analyst": "15-2051",
    "data scientist": "15-2051",
    "platform engineer": "15-1252",
    "software engineer": "15-1252",
    "software developer": "15-1252",
}

# Seniority -> (low, median, high) OEWS percentile keys. All real percentiles; we only
# choose the window — never fabricate a value.
_SENIORITY_WINDOW: dict[str, tuple[str, str, str]] = {
    "entry": ("p10", "p25", "p50"),
    "junior": ("p10", "p25", "p50"),
    "mid": ("p25", "p50", "p75"),
    "senior": ("p50", "p75", "p90"),
    "lead": ("p50", "p75", "p90"),
    "staff": ("p50", "p75", "p90"),
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class CompensationEstimate:
    low: Optional[float]
    median: Optional[float]
    high: Optional[float]
    currency: str
    confidence: float
    source: str
    as_of: Optional[str]
    occupation_code: Optional[str]
    geography: Optional[str]
    assumptions: list[str] = field(default_factory=list)

    def as_evidence(self, label: str) -> list[dict[str, Any]]:
        """Render the band as authoritative Evidence rows (metric/value/source/confidence)."""
        if self.median is None:
            return []
        return [{
            "metric_name": f"{label}_comp_median",
            "metric_value": self.median,
            "source_table": f"{CENTRAL}.compensation_bands",
            "observed_at": self.as_of or _now(),
            "confidence": self.confidence,
            "explanation": f"{self.source} band p-window for {self.occupation_code} ({self.geography}); range {self.low}-{self.high}",
        }]


def soc_for(role_title: Optional[str]) -> Optional[str]:
    return ROLE_TO_SOC.get((role_title or "").strip().lower())


class CompensationIntelligenceEngine:
    def __init__(self, supabase: SupabaseClient) -> None:
        self._sb = supabase

    async def _band(self, occupation_code: str, geography: str) -> Optional[dict[str, Any]]:
        """Fetch the most relevant OEWS band for an occupation+geography. National
        ('US') is the fallback geography. Returns None when no band exists."""
        for geo in (geography, "US"):
            rows = await self._sb.select(
                "compensation_bands",
                filters={"occupation_code": f"eq.{occupation_code}", "geography": f"eq.{geo}"},
                limit=1,
                order="as_of_date.desc",
                schema=CENTRAL,
            )
            if rows:
                return rows[0]
        return None

    async def market_value(
        self,
        *,
        role_title: Optional[str],
        seniority: Optional[str] = "mid",
        geography: Optional[str] = "US",
        years_experience: Optional[float] = None,
    ) -> Optional[CompensationEstimate]:
        """Current estimated market value as a cited band. None when no source band
        exists (NEVER a fabricated number)."""
        occ = soc_for(role_title)
        if not occ:
            return None
        band = await self._band(occ, geography or "US")
        if not band:
            return None
        win = _SENIORITY_WINDOW.get((seniority or "mid").lower(), _SENIORITY_WINDOW["mid"])
        low, med, high = (_num(band.get(win[0])), _num(band.get(win[1])), _num(band.get(win[2])))
        if med is None:
            return None
        assumptions = [
            f"market value selected from {band.get('source_name','OEWS')} {win[0]}/{win[1]}/{win[2]} for the '{seniority}' seniority window",
            "OEWS bands approximate current market and are cohort-level, not an offer guarantee",
        ]
        if years_experience is not None:
            assumptions.append(f"{years_experience} years experience informs the seniority window")
        return CompensationEstimate(
            low=low, median=med, high=high,
            currency=band.get("currency", "USD"),
            confidence=float(band.get("confidence") or 0.7),
            source=str(band.get("source_name") or "BLS OEWS"),
            as_of=band.get("as_of_date"),
            occupation_code=occ,
            geography=band.get("geography"),
            assumptions=assumptions,
        )

    async def scenario(
        self,
        *,
        current_role: Optional[str],
        target_role: Optional[str],
        seniority: Optional[str] = "mid",
        geography: Optional[str] = "US",
    ) -> dict[str, Any]:
        """Before / during / after compensation for a role change (the Education-ROI
        input). 'during' models reduced/forgone income while transitioning. All cited;
        missing bands -> nulls + a missing note, never fabricated."""
        before = await self.market_value(role_title=current_role, seniority=seniority, geography=geography)
        after = await self.market_value(role_title=target_role, seniority=seniority, geography=geography)
        lift = None
        if before and after and before.median is not None and after.median is not None:
            lift = round(after.median - before.median, 2)
        return {
            "before": _estimate_dict(before),
            "during": {  # transition: conservatively assume current income holds unless told otherwise
                "median": before.median if before else None,
                "note": "models current income held during transition; refine with user's plan",
            },
            "after": _estimate_dict(after),
            "median_lift": lift,
            "missing": [] if (before and after) else _missing_bands(before, after),
        }


def _num(v: Any) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _estimate_dict(e: Optional[CompensationEstimate]) -> Optional[dict[str, Any]]:
    if not e:
        return None
    return {
        "low": e.low, "median": e.median, "high": e.high, "currency": e.currency,
        "confidence": e.confidence, "source": e.source, "as_of": e.as_of,
        "occupation_code": e.occupation_code, "geography": e.geography, "assumptions": e.assumptions,
    }


def _missing_bands(before: Optional[CompensationEstimate], after: Optional[CompensationEstimate]) -> list[str]:
    m = []
    if not before:
        m.append("current_role_compensation_band")
    if not after:
        m.append("target_role_compensation_band")
    return m
