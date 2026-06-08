"""EducationROIEngine — cited, scenario-based program scoring.

Scores a candidate program against the user's Career (current market value, target),
Finance (debt context), and Education (program facts) inputs, producing seven explainable
0-100 scores + worst/expected/best scenarios. EVERY ROI figure is cited (program earnings
from Scorecard, current value from OEWS) — no uncited ROI. Missing inputs lower confidence
and are listed, never fabricated.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

_PART_TIME_FORGONE = 0.5  # documented assumption: half of current income forgone while enrolled


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _num(v: Any) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def _clamp(x: float) -> float:
    return max(0.0, min(100.0, x))


@dataclass
class ProgramScore:
    program_id: str
    program_name: str
    school_name: Optional[str]
    net_cost: Optional[float]
    opportunity_cost: Optional[float]
    income_lift: Optional[float]
    breakeven_months: Optional[float]
    scenarios: dict[str, Any]
    scores: dict[str, float]
    evidence: list[dict[str, Any]] = field(default_factory=list)
    assumptions: list[dict[str, Any]] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)


class EducationROIEngine:
    def score_program(
        self,
        program: dict[str, Any],
        *,
        current_median: Optional[float],
        current_source: Optional[str],
        target_role: Optional[str],
        total_debt: Optional[float],
        family_obligations: Optional[dict[str, Any]] = None,
    ) -> ProgramScore:
        pid = str(program.get("id"))
        name = str(program.get("name") or "Program")
        tuition = _num(program.get("tuition"))
        duration_m = _num(program.get("duration_months"))
        grad_rate = _num(program.get("graduation_rate"))
        median_salary = _num(program.get("median_salary"))  # Scorecard program earnings
        src = str(program.get("source") or "College Scorecard")

        missing: list[str] = []
        if tuition is None:
            missing.append("program_tuition")
        if median_salary is None:
            missing.append("program_median_salary")
        if current_median is None:
            missing.append("current_market_value")

        net_cost = tuition
        duration_yrs = (duration_m / 12.0) if duration_m else None
        opportunity_cost = (
            round(current_median * duration_yrs * _PART_TIME_FORGONE, 0)
            if (current_median is not None and duration_yrs is not None) else None
        )
        income_lift = (
            round(median_salary - current_median, 0)
            if (median_salary is not None and current_median is not None) else None
        )
        total_invest = None
        if net_cost is not None and opportunity_cost is not None:
            total_invest = net_cost + opportunity_cost
        completion = grad_rate if grad_rate is not None else 0.7
        breakeven_months = None
        if income_lift is not None and income_lift > 0 and total_invest is not None:
            breakeven_months = round(total_invest / (income_lift / 12.0), 0)

        # Scenarios — the income-lift band (risk-adjusted by completion probability), cited.
        scenarios = {
            "worst": _scn(income_lift, 0.6 * completion),
            "expected": _scn(income_lift, completion),
            "best": _scn(income_lift, 1.3),
        }

        # Evidence — every number cited.
        evidence: list[dict[str, Any]] = []
        if median_salary is not None:
            evidence.append(_ev("program_median_salary", median_salary, "education.programs", 0.8, f"{src} median earnings"))
        if current_median is not None:
            evidence.append(_ev("current_market_value", current_median, "ln_central.compensation_bands", 0.8, f"{current_source or 'OEWS'} median for current role"))
        if income_lift is not None:
            evidence.append(_ev("income_lift", income_lift, "education.programs", 0.7, "program earnings minus current market value"))
        if net_cost is not None:
            evidence.append(_ev("net_cost", net_cost, "education.programs", 0.8, "program tuition"))
        if opportunity_cost is not None:
            evidence.append(_ev("opportunity_cost", opportunity_cost, "computed", 0.6, f"current income forgone × {duration_yrs}y × {_PART_TIME_FORGONE} (part-time)"))
        if breakeven_months is not None:
            evidence.append(_ev("breakeven_months", breakeven_months, "computed", 0.6, "total investment ÷ monthly income lift"))
        if grad_rate is not None:
            evidence.append(_ev("graduation_rate", grad_rate, "education.programs", 0.8, f"{src} completion"))

        assumptions = [
            {"assumption_text": f"{_PART_TIME_FORGONE:.0%} of current income forgone while enrolled (part-time)", "confidence": 0.6, "user_confirmed": False, "source": "model"},
            {"assumption_text": "Scorecard program earnings are cohort-level, lagged, and Title-IV-selected — a median band, not a personal guarantee", "confidence": 0.7, "user_confirmed": False, "source": "policy"},
            {"assumption_text": f"completion probability ≈ {completion:.0%}", "confidence": 0.6, "user_confirmed": False, "source": "model"},
        ]

        scores = {
            "fit": _fit_score(program, target_role),
            "roi": _roi_score(breakeven_months, income_lift),
            "career": _career_score(income_lift),
            "family": _family_score(net_cost, total_debt, family_obligations, missing),
            "risk": _risk_score(grad_rate, program.get("accreditation_status") or (program.get("metadata") or {}).get("accreditation_status"), net_cost, current_median),
            "time": _time_score(duration_m),
            "confidence": _confidence_score(tuition, median_salary, current_median, grad_rate),
        }
        return ProgramScore(
            program_id=pid, program_name=name, school_name=program.get("_school_name"),
            net_cost=net_cost, opportunity_cost=opportunity_cost, income_lift=income_lift,
            breakeven_months=breakeven_months, scenarios=scenarios, scores=scores,
            evidence=evidence, assumptions=assumptions, missing=missing,
        )


def _ev(name: str, value: Any, table: str, conf: float, expl: str) -> dict[str, Any]:
    return {"metric_name": name, "metric_value": value, "source_table": table, "observed_at": _now(), "confidence": conf, "explanation": expl}


def _scn(income_lift: Optional[float], factor: float) -> dict[str, Any]:
    if income_lift is None:
        return {"annual_income_lift": None}
    return {"annual_income_lift": round(income_lift * factor, 0)}


def _fit_score(program: dict[str, Any], target_role: Optional[str]) -> float:
    base = 55.0
    major = str(program.get("major") or "").lower()
    if target_role and any(w in major for w in ("computer", "engineer", "data", "science")):
        base += 25
    if program.get("modality"):
        base += 10
    return _clamp(base)


def _roi_score(breakeven_months: Optional[float], income_lift: Optional[float]) -> float:
    if breakeven_months is None or income_lift is None or income_lift <= 0:
        return 25.0
    if breakeven_months <= 24:
        return 92.0
    if breakeven_months <= 48:
        return 78.0
    if breakeven_months <= 84:
        return 62.0
    if breakeven_months <= 120:
        return 45.0
    return 30.0


def _career_score(income_lift: Optional[float]) -> float:
    if income_lift is None:
        return 40.0
    if income_lift > 30000:
        return 90.0
    if income_lift > 15000:
        return 72.0
    if income_lift > 0:
        return 55.0
    return 30.0


def _family_score(net_cost: Optional[float], total_debt: Optional[float], obligations: Optional[dict], missing: list[str]) -> float:
    if obligations is None:
        missing.append("family_obligations")
        return 60.0  # neutral when Family domain data is unavailable
    cushion = _num(obligations.get("monthly_cushion"))
    if cushion is None:
        return 60.0
    return _clamp(40 + min(cushion / 100.0, 50))


def _risk_score(grad_rate: Optional[float], accreditation: Optional[str], net_cost: Optional[float], current_median: Optional[float]) -> float:
    score = 50.0
    if grad_rate is not None:
        score = 30 + grad_rate * 60  # higher completion -> lower risk -> higher score
    if accreditation and "accredit" in str(accreditation).lower():
        score += 10
    if net_cost is not None and current_median:
        if net_cost > current_median:  # debt > a year of income -> riskier
            score -= 15
    return _clamp(score)


def _time_score(duration_m: Optional[float]) -> float:
    if duration_m is None:
        return 50.0
    if duration_m <= 12:
        return 90.0
    if duration_m <= 24:
        return 75.0
    if duration_m <= 36:
        return 60.0
    if duration_m <= 48:
        return 45.0
    return 30.0


def _confidence_score(tuition: Optional[float], median_salary: Optional[float], current_median: Optional[float], grad_rate: Optional[float]) -> float:
    present = sum(1 for v in (tuition, median_salary, current_median, grad_rate) if v is not None)
    return _clamp(present / 4.0 * 100.0)
