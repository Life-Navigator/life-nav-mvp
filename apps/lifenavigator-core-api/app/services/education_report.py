"""EducationReportBuilder — the structured, advisor-quality EducationReportViewModel.

Builds a 9-section report (+ chart specs, confidence bands, citations, assumptions) purely
from the EducationService summary view-model, so it is REPRODUCIBLE: same inputs -> same
report. ``content_hash`` is a sha256 over the report with timestamps normalized out, so two
generations from identical data produce an identical hash. The PDF renderer is a later
sprint; this is the source-of-truth structured data + chart specs it will render.
"""
from __future__ import annotations

import hashlib
import json
from typing import Any

# Keys excluded from the reproducibility hash (they vary per generation, not per input).
_VOLATILE = {"generated_at", "observed_at", "as_of", "created_at", "updated_at", "revisit_date"}


def _normalize(obj: Any) -> Any:
    """Recursively drop volatile timestamp keys so the hash reflects inputs, not clock."""
    if isinstance(obj, dict):
        return {k: _normalize(v) for k, v in sorted(obj.items()) if k not in _VOLATILE}
    if isinstance(obj, list):
        return [_normalize(v) for v in obj]
    return obj


def content_hash(report: dict[str, Any]) -> str:
    payload = json.dumps(_normalize(report), sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode()).hexdigest()


def _bar(series: list[dict[str, Any]], *, x: str, y: str, source: str) -> dict[str, Any]:
    return {"type": "bar", "x": x, "y": y, "series": series, "source": source}


class EducationReportBuilder:
    def build(self, vm: Any, rec_rows: list[dict[str, Any]] | None = None) -> dict[str, Any]:
        """`vm` is the EducationService.summary() DomainViewModel; `rec_rows` are the raw
        recommendation rows (carry recommendation_type) from _compute_rows."""
        data = vm.data
        programs: list[dict[str, Any]] = list(data.get("programs") or [])
        best: dict[str, Any] | None = data.get("best_program")
        career = data.get("career_context") or {}
        rec_by_type = {str(r.get("recommendation_type")): r for r in (rec_rows or [])}

        # Aggregate citations + assumptions across all programs (deduped, deterministic order).
        citations: list[str] = sorted({
            str(e.get("source_table")) for p in programs for e in _prog_evidence(p) if e.get("source_table")
        })
        assumptions = _dedup([a for p in programs for a in _prog_assumptions(p)])

        sections = {
            "1_executive_summary": {
                "title": "Executive Summary",
                "best_program": best.get("program_name") if best else None,
                "target_role": career.get("target_role"),
                "verdict": _verdict(best),
                "confidence": vm.confidence.model_dump() if hasattr(vm.confidence, "model_dump") else vm.confidence,
            },
            "2_recommended_path": {
                "title": "Recommended Path",
                "program": best,
                "recommendation": rec_by_type.get("best_program_match"),
            },
            "3_alternative_paths": {
                "title": "Alternative Paths",
                "programs": [p for p in programs if not best or p.get("program_id") != best.get("program_id")],
                "recommendations": [r for t, r in rec_by_type.items() if t in ("lower_cost_alternative", "better_roi_path")],
            },
            "4_roi_analysis": {
                "title": "ROI Analysis",
                "programs": [{
                    "program": p.get("program_name"), "net_cost": p.get("net_cost"),
                    "opportunity_cost": p.get("opportunity_cost"), "income_lift": p.get("income_lift"),
                    "breakeven_months": p.get("breakeven_months"), "scenarios": p.get("scenarios"),
                } for p in programs],
            },
            "5_compensation_forecast": {
                "title": "Compensation Forecast",
                "current_market_value": career.get("current_market_value"),
                "programs": [{"program": p.get("program_name"), "expected_earnings_after": _after(p), "income_lift": p.get("income_lift")} for p in programs],
                "note": "Program earnings are cohort-level Scorecard medians (lagged); current value is an OEWS band.",
            },
            "6_financial_impact": {
                "title": "Financial Impact",
                "programs": [{
                    "program": p.get("program_name"), "net_cost": p.get("net_cost"),
                    "est_monthly_payment_120mo": _monthly(p.get("net_cost")),
                    "debt_warning": rec_by_type.get("high_debt_warning") is not None,
                } for p in programs],
            },
            "7_family_impact": {
                "title": "Family Impact",
                "family_scores": [{"program": p.get("program_name"), "family_score": (p.get("scores") or {}).get("family")} for p in programs],
                "note": "Family obligations not yet modeled (Family domain pending) — scores are neutral." if any("family_obligations" in (p.get("missing") or []) for p in programs) else None,
            },
            "8_risk_analysis": {
                "title": "Risk Analysis",
                "programs": [{
                    "program": p.get("program_name"), "risk_score": (p.get("scores") or {}).get("risk"),
                    "worst_case_income_lift": (p.get("scenarios") or {}).get("worst", {}).get("annual_income_lift"),
                } for p in programs],
            },
            "9_evidence_appendix": {
                "title": "Evidence & Sources",
                "evidence": [e for p in programs for e in _prog_evidence(p)],
                "assumptions": assumptions,
                "citations": citations,
            },
        }

        charts = {
            "total_cost_comparison": _bar([{"label": p.get("program_name"), "value": p.get("net_cost")} for p in programs], x="program", y="net_cost (USD)", source="education.programs"),
            "expected_salary_uplift": _bar([{"label": p.get("program_name"), "value": p.get("income_lift")} for p in programs], x="program", y="income lift (USD)", source="ln_central.compensation_bands + education.programs"),
            "breakeven_timeline": _bar([{"label": p.get("program_name"), "value": p.get("breakeven_months")} for p in programs], x="program", y="breakeven (months)", source="computed"),
            "confidence_bands": _bar([{"label": p.get("program_name"), "value": (p.get("scores") or {}).get("confidence")} for p in programs], x="program", y="confidence (0-100)", source="computed"),
            "roi_scenario_range": {
                "type": "range", "program": best.get("program_name") if best else None,
                "worst": (best or {}).get("scenarios", {}).get("worst", {}).get("annual_income_lift"),
                "expected": (best or {}).get("scenarios", {}).get("expected", {}).get("annual_income_lift"),
                "best": (best or {}).get("scenarios", {}).get("best", {}).get("annual_income_lift"),
                "source": "computed (risk-adjusted income-lift band)",
            },
            "score_radar": {
                "type": "radar", "axes": ["fit", "roi", "career", "family", "risk", "time"],
                "values": {k: (best or {}).get("scores", {}).get(k) for k in ["fit", "roi", "career", "family", "risk", "time"]} if best else None,
                "source": "computed",
            },
        }

        return {
            "report_type": "education_comparison",
            "title": f"Education comparison — {best.get('program_name') if best else 'programs'}",
            "version": 1,
            "sections": sections,
            "charts": charts,
            "citations": citations,
            "assumptions": assumptions,
            "confidence": vm.confidence.model_dump() if hasattr(vm.confidence, "model_dump") else vm.confidence,
            "safety": {"boundary_type": "education_guidance", "disclaimer_text": "Decision support, not admissions, financial, or legal advice."},
            "missing": list(vm.missing),
        }


def _prog_evidence(p: dict[str, Any]) -> list[dict[str, Any]]:
    return p.get("_evidence") or []  # populated by the service before build (see EducationService)


def _prog_assumptions(p: dict[str, Any]) -> list[Any]:
    return p.get("_assumptions") or []


def _dedup(items: list[Any]) -> list[Any]:
    seen, out = set(), []
    for it in items:
        key = json.dumps(it, sort_keys=True, default=str) if isinstance(it, dict) else str(it)
        if key not in seen:
            seen.add(key)
            out.append(it)
    return out


def _verdict(best: dict[str, Any] | None) -> str:
    if not best:
        return "No programs to compare yet — add candidate programs."
    lift = best.get("income_lift")
    be = best.get("breakeven_months")
    if lift is None:
        return f"{best.get('program_name')} ranks highest, but outcome data is incomplete."
    if be is not None and be <= 60:
        return f"{best.get('program_name')} pays back in ~{be:.0f} months on cited estimates."
    return f"{best.get('program_name')} ranks highest, but the cited payback is long (~{be:.0f} months) — weigh the cost."


def _after(p: dict[str, Any]) -> Any:
    for e in _prog_evidence(p):
        if e.get("metric_name") == "program_median_salary":
            return e.get("metric_value")
    return None


def _monthly(net_cost: Any) -> Any:
    try:
        return round(float(net_cost) / 120.0, 0) if net_cost is not None else None
    except (TypeError, ValueError):
        return None
