"""Explainable confidence (Elite Sprint 24).

Confidence is never an opaque number. It is built from named, signed components so a user can see
exactly why the platform is 72% (not 95%) confident — and what would raise it. Positive components
come from data coverage + reference-data quality; penalties come from missing inputs, projection
uncertainty (horizon × volatility), and scenario complexity (chained, compounding decisions).
"""
from __future__ import annotations

from typing import Any


def build(*, document_coverage: float, reference_quality: float, missing_inputs: int = 0,
          projection_years: int = 0, volatility: float = 0.0, scenario_depth: int = 0) -> dict[str, Any]:
    """document_coverage / reference_quality in 0..1. Returns overall % + signed components."""
    dc = round(max(0.0, min(1.0, document_coverage)) * 100)
    rq = round(max(0.0, min(1.0, reference_quality)) * 100)
    missing_pen = min(40, missing_inputs * 8)                       # each missing critical input costs ~8 pts
    proj_pen = round(min(30, projection_years * volatility * 12))   # longer horizon × more volatility = less certain
    complexity_pen = min(24, max(0, scenario_depth - 1) * 8)        # each chained decision compounds uncertainty

    components = [
        {"label": "Document coverage", "value": round(dc * 0.5), "kind": "positive",
         "why": f"{dc}% of the documents this projection wants are on file."},
        {"label": "Reference data quality", "value": round(rq * 0.4), "kind": "positive",
         "why": f"{rq}% — strength of the cited reference data (e.g. BLS/Scorecard vs estimates)."},
        {"label": "Missing information", "value": -missing_pen, "kind": "penalty",
         "why": f"{missing_inputs} critical input(s) missing." if missing_inputs else "No critical inputs missing."},
        {"label": "Projection uncertainty", "value": -proj_pen, "kind": "penalty",
         "why": f"~{projection_years}-year horizon at {round(volatility * 100)}% volatility." if projection_years else "Short/no projection horizon."},
        {"label": "Scenario complexity", "value": -complexity_pen, "kind": "penalty",
         "why": f"{scenario_depth} chained decisions compound uncertainty." if scenario_depth > 1 else "Single decision."},
    ]
    vals: list[int] = [int(c["value"]) for c in components]  # type: ignore[call-overload]
    overall = max(0, min(100, sum(vals)))
    improvers = [c["label"] for c, v in zip(components, vals) if c["kind"] == "penalty" and v < 0]
    return {"overall": overall, "overall_fraction": round(overall / 100, 2), "components": components,
            "what_would_improve": ("Upload missing documents and reduce assumptions to raise confidence."
                                   if improvers else "Confidence is strong — well-grounded in your data.")}
