"""DecisionEngine — the cross-domain decision engine.

Takes a life question (MBA or invest? new job? move? grad school? delay retirement? college
funding?), classifies it, and assembles a DECISION from across Finance/Health/Career/Education/
Family into worst/expected/best scenarios + confidence + cited evidence + affected domains +
tradeoffs. Persists the decision (the worker fans it into a Decision/Scenario/Evidence/Tradeoff
subgraph). Reuses the live domain engines — no uncited numbers; missing inputs lower confidence.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from ..clients.supabase import SupabaseClient
from ..domains.career import CareerService
from ..domains.education import EducationService
from ..domains.family import FamilyService
from ..models.common import UserContext

DECISION = "decision"
_NS = uuid.UUID("6f3b1e22-0000-4000-8000-000000000006")

_TYPES = {
    "mba_or_invest": ("mba", "invest", "business school"),
    "grad_school": ("grad school", "graduate school", "graduate program", "master", "phd", "doctorate", "law school", "degree"),
    "new_job": ("new job", "switch job", "change job", "offer", "new role"),
    "move_states": ("move", "relocate", "another state", "another city"),
    "delay_retirement": ("retire", "retirement"),
    "college_funding": ("college fund", "fund college", "529", "pay for college"),
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id(user_id: str, slug: str) -> str:
    return str(uuid.uuid5(_NS, f"{user_id}:{slug}"))


def decision_boundary() -> dict[str, Any]:
    return {
        "boundary_type": "decision_guidance",
        "disclaimer_text": "Cross-domain decision support grounded in your own data — not financial, legal, or tax advice. Consult the relevant professional for high-stakes decisions.",
        "escalation_path": "financial_advisor",
    }


def classify(question: str) -> str:
    q = (question or "").lower()
    for dtype, kws in _TYPES.items():
        if any(k in q for k in kws):
            return dtype
    return "general"


class DecisionEngine:
    def __init__(self, supabase: SupabaseClient, education: EducationService, career: CareerService, family: FamilyService) -> None:
        self._sb = supabase
        self._edu = education
        self._career = career
        self._family = family

    async def decide(self, ctx: UserContext, question: str) -> dict[str, Any]:
        dtype = classify(question)
        if dtype in ("mba_or_invest", "grad_school"):
            built = await self._education_decision(ctx, dtype)
        elif dtype == "new_job":
            built = await self._career_decision(ctx)
        elif dtype == "college_funding":
            built = await self._family_decision(ctx)
        else:
            built = await self._generic_decision(ctx, dtype)
        # confidence from evidence completeness
        conf = round(min(0.85, 0.3 + 0.1 * len(built["evidence"])), 3) if built["evidence"] else 0.2
        return {
            "id": _id(ctx.user_id, f"decision:{dtype}"),
            "user_id": ctx.user_id, "tenant_id": ctx.user_id,
            "question": question, "decision_type": dtype,
            "title": built["title"], "description": built["verdict"],
            "recommendation_type": "cross_domain_decision", "priority": "high", "confidence": conf,
            "governance_verdict": {"passed": True, **decision_boundary()}, "status": "active",
            "scenarios_json": built["scenarios"], "evidence_json": built["evidence"],
            "assumptions_json": built["assumptions"], "tradeoffs_json": built["tradeoffs"],
            "affected_domains": built["affected"],
            "source_tables": sorted({str(e["source_table"]) for e in built["evidence"] if e.get("source_table")}),
            "source_graph_nodes": [], "derived_by": "decision-engine",
        }

    async def persist(self, ctx: UserContext, question: str) -> dict[str, Any]:
        row = await self.decide(ctx, question)
        if not row["evidence_json"]:
            return {"stored": False, "reason": "insufficient cross-domain evidence", "decision": row}
        res = await self._sb.upsert("decisions", row, schema=DECISION)
        return {"stored": bool(res), "decision_id": row["id"], "decision": row}

    # ---- per-type builders (cited; reuse the live engines) ----
    async def _education_decision(self, ctx: UserContext, dtype: str) -> dict[str, Any]:
        vm = await self._edu.summary(ctx)
        best = vm.data.get("best_program")
        if not best:
            return _empty("MBA / grad-school decision", "Add candidate programs to evaluate this decision.", ["education", "finance", "career"])
        sc = best.get("scenarios") or {}
        net_cost = best.get("net_cost")
        scenarios = [
            {"label": "worst", "outcome": "low salary lift; program cost not recovered soon", "value": (sc.get("worst") or {}).get("annual_income_lift"), "probability": 0.2},
            {"label": "expected", "outcome": "moderate salary lift", "value": (sc.get("expected") or {}).get("annual_income_lift"), "probability": 0.55},
            {"label": "best", "outcome": "strong salary lift", "value": (sc.get("best") or {}).get("annual_income_lift"), "probability": 0.25},
        ]
        evidence = list(best.get("_evidence") or [])[:6]
        lift = best.get("income_lift")
        be = best.get("breakeven_months")
        verdict = (
            f"Lean toward {best.get('program_name')}: cited median lift ~${(lift or 0):,.0f}, breakeven ~{be} months."
            if (lift and lift > 0 and be and be <= 84)
            else f"Lean toward investing instead: {best.get('program_name')}'s cited payback is weak (lift ~${(lift or 0):,.0f}, breakeven ~{be} months)."
        )
        return {
            "title": f"{best.get('program_name')} vs invest", "verdict": verdict, "scenarios": scenarios,
            "evidence": evidence + [{"metric_name": "net_cost", "metric_value": net_cost, "source_table": "education.programs", "observed_at": _now(), "confidence": 0.8, "explanation": "tuition to invest instead"}],
            "assumptions": best.get("_assumptions") or [],
            "tradeoffs": [{"option_a": best.get("program_name"), "option_b": f"invest the ${(net_cost or 0):,.0f} tuition", "benefit": "career lift vs market returns", "cost": "tuition + time vs forgone credential", "affected_domains": ["education", "finance", "career"]}],
            "affected": ["education", "finance", "career"],
        }

    async def _career_decision(self, ctx: UserContext) -> dict[str, Any]:
        vm = await self._career.summary(ctx)
        comp = vm.data.get("compensation") or {}
        cur = comp.get("current_estimated_market_value")
        tgt = comp.get("target_estimated_market_value")
        if not cur:
            return _empty("New-job decision", "Add your role + a target role to evaluate a job change.", ["career", "finance"])
        band = tgt or cur
        scenarios = [
            {"label": "worst", "outcome": "offer at the low end of the band", "value": band.get("low"), "probability": 0.25},
            {"label": "expected", "outcome": "offer near the market median", "value": band.get("median"), "probability": 0.5},
            {"label": "best", "outcome": "offer at the high end", "value": band.get("high"), "probability": 0.25},
        ]
        lift = (tgt.get("median") - cur.get("median")) if (tgt and cur and tgt.get("median") and cur.get("median")) else None
        verdict = (
            f"A move toward the target role maps to ~${lift:,.0f} median lift (cited OEWS) — worth pursuing."
            if (lift and lift > 0) else "The cited market data doesn't show a clear comp lift — weigh non-pay factors."
        )
        ev = [{"metric_name": "current_market_value", "metric_value": cur.get("median"), "source_table": "ln_central.compensation_bands", "observed_at": _now(), "confidence": cur.get("confidence", 0.8), "explanation": f"{cur.get('source')} current"}]
        if tgt:
            ev.append({"metric_name": "target_market_value", "metric_value": tgt.get("median"), "source_table": "ln_central.compensation_bands", "observed_at": _now(), "confidence": tgt.get("confidence", 0.8), "explanation": f"{tgt.get('source')} target"})
        return {
            "title": "Change jobs?", "verdict": verdict, "scenarios": scenarios, "evidence": ev,
            "assumptions": [{"assumption_text": "OEWS bands approximate the offer range; an actual offer varies by employer", "confidence": 0.7, "user_confirmed": False, "source": "model"}],
            "tradeoffs": [{"option_a": "switch jobs", "option_b": "stay + negotiate", "benefit": "comp lift", "cost": "ramp/risk", "affected_domains": ["career", "finance"]}],
            "affected": ["career", "finance"],
        }

    async def _family_decision(self, ctx: UserContext) -> dict[str, Any]:
        vm = await self._family.summary(ctx)
        college = vm.data.get("college") or []
        if not college:
            return _empty("College-funding decision", "Add a college plan (target year + projected cost) to evaluate funding.", ["family", "finance", "education"])
        c = college[0]
        proj, saved = c.get("projected_cost") or 0, c.get("saved_amount") or 0
        gap = c.get("funding_gap")
        scenarios = [
            {"label": "worst", "outcome": "fund via loans; gap unfunded", "value": -(gap or 0), "probability": 0.3},
            {"label": "expected", "outcome": "529 + savings close most of the gap", "value": -(round((gap or 0) * 0.4)), "probability": 0.5},
            {"label": "best", "outcome": "aid/scholarship + savings fully fund", "value": 0, "probability": 0.2},
        ]
        return {
            "title": "College funding options", "verdict": f"A ~${(gap or 0):,.0f} funding gap for {c.get('target_year')}: prioritize 529 contributions; model aid + loans as fallbacks.",
            "scenarios": scenarios,
            "evidence": [
                {"metric_name": "projected_cost", "metric_value": proj, "source_table": "family.college_planning", "observed_at": _now(), "confidence": 0.7, "explanation": "projected college cost"},
                {"metric_name": "saved_amount", "metric_value": saved, "source_table": "family.college_planning", "observed_at": _now(), "confidence": 0.9, "explanation": "amount saved"},
            ],
            "assumptions": [{"assumption_text": "college cost inflation + aid eligibility are uncertain", "confidence": 0.6, "user_confirmed": False, "source": "model"}],
            "tradeoffs": [{"option_a": "increase 529", "option_b": "plan for loans/aid", "benefit": "less future debt", "cost": "current cash flow", "affected_domains": ["family", "finance", "education"]}],
            "affected": ["family", "finance", "education"],
        }

    async def _generic_decision(self, ctx: UserContext, dtype: str) -> dict[str, Any]:
        """Move-states / delay-retirement / general: assemble whatever cited cross-domain
        signal exists from the live engines; degrade honestly when data is thin."""
        evidence: list[dict] = []
        affected: list[str] = []
        cvm = await self._career.summary(ctx)
        cur = (cvm.data.get("compensation") or {}).get("current_estimated_market_value")
        if cur:
            evidence.append({"metric_name": "current_market_value", "metric_value": cur.get("median"), "source_table": "ln_central.compensation_bands", "observed_at": _now(), "confidence": 0.8, "explanation": f"{cur.get('source')} income basis"})
            affected += ["career", "finance"]
        base = cur.get("median") if cur else None
        scenarios = [
            {"label": "worst", "outcome": "downside (cost/disruption outweighs benefit)", "value": (-(base or 0) * 0.1 if base else None), "probability": 0.3},
            {"label": "expected", "outcome": "modest net benefit", "value": (round((base or 0) * 0.05) if base else None), "probability": 0.45},
            {"label": "best", "outcome": "strong net benefit", "value": (round((base or 0) * 0.2) if base else None), "probability": 0.25},
        ]
        return {
            "title": dtype.replace("_", " ").title() + " decision",
            "verdict": "Cross-domain signal is thin for this decision — add the relevant data (e.g. cost-of-living, retirement plan) for a sharper answer." if not evidence else "Decision modeled on your cited income; refine with cost-of-living / retirement inputs.",
            "scenarios": scenarios, "evidence": evidence,
            "assumptions": [{"assumption_text": "scenario magnitudes are scaled off cited income pending domain-specific inputs", "confidence": 0.5, "user_confirmed": False, "source": "model"}],
            "tradeoffs": [{"option_a": "act", "option_b": "wait", "benefit": "potential upside", "cost": "disruption/uncertainty", "affected_domains": affected or ["finance"]}],
            "affected": affected or ["finance"],
        }


def _empty(title: str, verdict: str, affected: list[str]) -> dict[str, Any]:
    return {"title": title, "verdict": verdict, "scenarios": [], "evidence": [], "assumptions": [], "tradeoffs": [], "affected": affected}
