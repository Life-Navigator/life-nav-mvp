"""FamilyService — the Family Decision Intelligence DomainService.

Answers "how much insurance do I need?", "can I fund college?", "what happens if I die?",
"is my estate plan sufficient?" by combining the Family household (dependents, coverage,
estate, college) with cross-domain income (Career market value). Every recommendation is
evidence-backed with assumptions + tradeoffs + a governance boundary (legal -> attorney for
estate/guardianship; family_planning -> licensed advisor for insurance/college). Graph-
traceable via the live evidence fan-out. Family is NOT registered live until its gates pass.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..models.common import (
    ActionStep,
    Confidence,
    DomainChatContext,
    DomainViewModel,
    Evidence,
    Freshness,
    GovernanceVerdict,
    Recommendation,
    SourceRef,
    UserContext,
    WriteResult,
)
from ..services.compensation import CompensationIntelligenceEngine
from .base import DomainService

FAMILY = "family"
CAREER = "career"
FINANCE = "finance"
_REC_NS = uuid.UUID("6f3b1e22-0000-4000-8000-000000000005")
_INCOME_MULTIPLE = 10  # documented income-replacement multiple for life-insurance need


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _src(table: str) -> SourceRef:
    return SourceRef(system="supabase", table=f"family.{table}", as_of=_now())


def _rec_id(user_id: str, slug: str) -> str:
    return str(uuid.uuid5(_REC_NS, f"{user_id}:{slug}"))


def _num(v: Any) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def family_boundary(legal: bool = False) -> dict[str, Any]:
    if legal:
        return {
            "boundary_type": "legal",
            "disclaimer_text": "This is not legal advice. Consult a licensed attorney for wills, power of attorney, guardianship, and estate documents.",
            "escalation_path": "attorney",
        }
    return {
        "boundary_type": "family_planning",
        "disclaimer_text": "Planning guidance, not financial or legal advice. Consult a licensed advisor for insurance product selection.",
        "escalation_path": "licensed_advisor",
    }


class FamilyService(DomainService):
    domain = FAMILY
    entity_types = [
        "family_profile", "dependent", "spouse_profile", "guardianship_plan", "estate_plan",
        "insurance_profile", "college_planning", "family_recommendation",
    ]

    def __init__(self, supabase: SupabaseClient, comp: CompensationIntelligenceEngine) -> None:
        self._sb = supabase
        self._comp = comp

    async def _rows(self, table: str, ctx: UserContext, *, schema: str = FAMILY, limit: int = 200, order: Optional[str] = None) -> list[dict]:
        return await self._sb.select(table, columns="*", filters={"user_id": f"eq.{ctx.user_id}"}, limit=limit, order=order, schema=schema)

    async def _context(self, ctx: UserContext) -> dict[str, Any]:
        dependents = await self._rows("dependents", ctx, limit=50)
        insurance = await self._rows("insurance_profiles", ctx, limit=1, order="updated_at.desc")
        estate = await self._rows("estate_plans", ctx, limit=1, order="updated_at.desc")
        guardianship = await self._rows("guardianship_plans", ctx, limit=1, order="updated_at.desc")
        college = await self._rows("college_planning", ctx, limit=50)
        # career_profiles is in the PUBLIC schema (migration 032), not `career` — see career/education fix.
        cp = await self._rows("career_profiles", ctx, schema="public", limit=1, order="updated_at.desc")
        debts = await self._rows("debts", ctx, schema=FINANCE, limit=200)
        total_debt = sum(d for r in debts if (d := _num(r.get("current_balance") or r.get("balance"))) is not None) or 0.0
        income = await self._comp.market_value(
            role_title=(cp[0] if cp else {}).get("current_title"),
            seniority=(cp[0] if cp else {}).get("seniority_level") or "mid",
            geography=(cp[0] if cp else {}).get("location") or "US",
        )
        cov = _num((insurance[0] if insurance else {}).get("life_coverage"))
        income_med = income.median if income else None
        need = (income_med * _INCOME_MULTIPLE + total_debt) if income_med is not None else None
        return {
            "dependents": dependents, "n_dependents": len(dependents),
            "insurance": insurance[0] if insurance else None, "coverage": cov,
            "estate": estate[0] if estate else None, "guardianship": guardianship[0] if guardianship else None,
            "college": college, "income_median": income_med, "income_source": income.source if income else None,
            "total_debt": total_debt, "insurance_need": need,
        }

    # ----------------------------------------------------------------- reads
    async def summary(self, ctx: UserContext) -> DomainViewModel:
        cx = await self._context(ctx)
        missing: list[str] = []
        if not cx["dependents"] and cx["n_dependents"] == 0:
            missing.append("dependents")
        if cx["insurance"] is None:
            missing.append("insurance_profiles")
        if cx["estate"] is None:
            missing.append("estate_plans")
        if cx["income_median"] is None:
            missing.append("career_profiles")
        protection = {
            "life_coverage": cx["coverage"], "life_insurance_need": cx["insurance_need"],
            "coverage_gap": (round(cx["insurance_need"] - (cx["coverage"] or 0), 0) if cx["insurance_need"] is not None else None),
            "income_basis": cx["income_median"], "income_source": cx["income_source"],
        }
        readiness = {
            "dependents": cx["n_dependents"],
            "guardianship_status": (cx["guardianship"] or {}).get("status"),
            "estate": {k: (cx["estate"] or {}).get(k) for k in ("has_will", "has_poa", "has_beneficiaries", "status")} if cx["estate"] else None,
        }
        college = [{
            "target_year": c.get("target_year"), "projected_cost": _num(c.get("projected_cost")),
            "saved_amount": _num(c.get("saved_amount")),
            "funding_gap": (round((_num(c.get("projected_cost")) or 0) - (_num(c.get("saved_amount")) or 0), 0)),
        } for c in cx["college"]]
        data: dict[str, Any] = {
            "protection": protection, "readiness": readiness, "college": college,
            "safety_boundaries": [family_boundary(), family_boundary(legal=True)],
            "missing_data_prompts": missing,
        }
        recs = await self.recommendations(ctx)
        has_any = bool(cx["dependents"] or cx["insurance"] or cx["estate"] or cx["college"])
        return DomainViewModel(
            domain=FAMILY, user_id=ctx.user_id, generated_at=_now(),
            freshness=Freshness(as_of=_now(), stale=not has_any, sources=[_src("dependents"), _src("insurance_profiles"), _src("estate_plans")]),
            confidence=Confidence(score=0.6 if has_any else 0.0, basis="partial" if has_any else "missing", missing_fields=missing),
            data=data, recommendations=recs, missing=missing,
        )

    async def list_view(self, ctx: UserContext, table: str, key: str) -> DomainViewModel:
        rows = await self._rows(table, ctx, limit=200)
        missing = [] if rows else [table]
        return DomainViewModel(
            domain=FAMILY, user_id=ctx.user_id, generated_at=_now(),
            freshness=Freshness(as_of=_now(), sources=[_src(table)]),
            confidence=Confidence(score=0.6 if rows else 0.0, basis="partial" if rows else "missing"),
            data={key: rows}, missing=missing,
        )

    async def chat_context(self, ctx: UserContext) -> DomainChatContext:
        cx = await self._context(ctx)
        facts: list[dict] = []
        if cx["insurance_need"] is not None:
            facts.append({"fact": "estimated life-insurance need", "value": f"{round(cx['insurance_need'],0)} ({_INCOME_MULTIPLE}x income + debts; income {cx['income_median']} from {cx['income_source']})"})
        if cx["coverage"] is not None:
            facts.append({"fact": "current life coverage", "value": str(cx["coverage"])})
        if cx["estate"]:
            facts.append({"fact": "estate plan", "value": f"will={cx['estate'].get('has_will')}, poa={cx['estate'].get('has_poa')}, beneficiaries={cx['estate'].get('has_beneficiaries')}"})
        if cx["n_dependents"]:
            facts.append({"fact": "dependents", "value": str(cx["n_dependents"])})
        missing = [] if facts else ["dependents"]
        return DomainChatContext(
            domain=FAMILY, authoritative_facts=facts, missing_facts=missing,
            freshness=Freshness(as_of=_now(), sources=[_src("insurance_profiles")]),
        )

    # ------------------------------------------------- recommendation families
    async def recommendations(self, ctx: UserContext) -> list[Recommendation]:
        rows = await self._compute_rows(ctx)
        out: list[Recommendation] = []
        for r in rows:
            out.append(Recommendation(
                id=r["id"], title=r["title"], why_it_matters=r["description"],
                evidence=[
                    Evidence(statement=f"{e['metric_name']}: {e['metric_value']}",
                             source=SourceRef(system="supabase", table=e["source_table"], as_of=e.get("observed_at") or _now()))
                    for e in r["evidence_json"]
                ],
                source_tables=r["source_tables"], assumptions=[a["assumption_text"] for a in r["assumptions_json"]],
                confidence=Confidence(score=r["confidence"], basis="partial", missing_fields=[]),
                priority=r["priority"], affected_domains=r["affected_domains"],
                action_steps=[ActionStep(step="Review with the appropriate professional", effort="medium", impact="high")],
                risks=["Protection estimates use a documented multiple, not a personalized underwriting analysis"],
                revisit_date=_now(), generated_by="family.agent",
                governance_verdict=GovernanceVerdict(passed=True),
            ))
        return out

    def _frow(self, ctx: UserContext, *, slug: str, rtype: str, title: str, description: str,
              evidence: list[dict], assumptions: list[dict], tradeoffs: list[dict], affected: list[str],
              priority: str = "medium", confidence: float = 0.6, legal: bool = False) -> dict[str, Any]:
        return {
            "id": _rec_id(ctx.user_id, slug), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
            "title": title, "description": description, "recommendation_type": rtype,
            "priority": priority, "confidence": confidence,
            "governance_verdict": {"passed": True, **family_boundary(legal=legal)}, "status": "active",
            "evidence_json": evidence, "assumptions_json": assumptions, "tradeoffs_json": tradeoffs,
            "source_tables": sorted({str(e["source_table"]) for e in evidence}),
            "source_graph_nodes": [], "affected_domains": affected, "derived_by": "family-recommendation-engine",
        }

    async def _compute_rows(self, ctx: UserContext) -> list[dict[str, Any]]:
        cx = await self._context(ctx)
        observed = _now()
        rows: list[dict[str, Any]] = []
        base_assumptions = [
            {"assumption_text": f"life-insurance need = {_INCOME_MULTIPLE}x income + debts (a planning rule of thumb, not underwriting)", "confidence": 0.6, "user_confirmed": False, "source": "model"},
            {"assumption_text": "planning guidance only; product/legal selection needs a licensed professional", "confidence": 1.0, "user_confirmed": False, "source": "policy"},
        ]

        # 1. insurance_gap — coverage below the income-replacement need
        if cx["insurance_need"] is not None and cx["coverage"] is not None and cx["coverage"] < cx["insurance_need"]:
            gap = round(cx["insurance_need"] - cx["coverage"], 0)
            rows.append(self._frow(
                ctx, slug="insurance-gap", rtype="insurance_gap", priority="high", confidence=0.7,
                title="You likely have a life-insurance protection gap",
                description=f"Your coverage (~${cx['coverage']:,.0f}) is below an estimated need of ~${cx['insurance_need']:,.0f} (a ~${gap:,.0f} gap). Planning guidance — consult a licensed advisor.",
                evidence=[
                    {"metric_name": "life_coverage", "metric_value": cx["coverage"], "source_table": "family.insurance_profiles", "observed_at": observed, "confidence": 0.8, "explanation": "current life coverage"},
                    {"metric_name": "insurance_need", "metric_value": cx["insurance_need"], "source_table": "computed", "observed_at": observed, "confidence": 0.6, "explanation": f"{_INCOME_MULTIPLE}x income (${cx['income_median']}) + debts (${cx['total_debt']})"},
                    {"metric_name": "dependents", "metric_value": cx["n_dependents"], "source_table": "family.dependents", "observed_at": observed, "confidence": 1.0, "explanation": "dependent count"},
                ],
                assumptions=base_assumptions,
                tradeoffs=[{"option_a": "term life policy", "option_b": "self-insure via savings", "benefit": "protection now", "cost": "premium", "affected_domains": ["family", "finance"]}],
                affected=["family", "finance"]))

        # 2. guardianship_gap — dependents but no designated guardian
        gstatus = (cx["guardianship"] or {}).get("status")
        if cx["n_dependents"] > 0 and (cx["guardianship"] is None or gstatus in (None, "undesignated", "none")):
            rows.append(self._frow(
                ctx, slug="guardianship-gap", rtype="guardianship_gap", priority="high", confidence=0.8, legal=True,
                title="Name a legal guardian for your dependents",
                description=f"You have {cx['n_dependents']} dependent(s) but no designated guardian. This is a legal step — consult an attorney.",
                evidence=[
                    {"metric_name": "dependents", "metric_value": cx["n_dependents"], "source_table": "family.dependents", "observed_at": observed, "confidence": 1.0, "explanation": "dependent count"},
                    {"metric_name": "guardianship_status", "metric_value": gstatus or "undesignated", "source_table": "family.guardianship_plans", "observed_at": observed, "confidence": 1.0, "explanation": "current guardianship status"},
                ],
                assumptions=base_assumptions,
                tradeoffs=[{"option_a": "designate now", "option_b": "delay", "benefit": "dependents protected", "cost": "requires legal docs", "affected_domains": ["family"]}],
                affected=["family"]))

        # 3. estate_gap — missing will / POA / beneficiaries
        estate = cx["estate"]
        if estate and (not estate.get("has_will") or not estate.get("has_poa") or not estate.get("has_beneficiaries")):
            missing_docs = [d for d, k in (("will", "has_will"), ("power of attorney", "has_poa"), ("beneficiaries", "has_beneficiaries")) if not estate.get(k)]
            rows.append(self._frow(
                ctx, slug="estate-gap", rtype="estate_gap", priority="high", confidence=0.8, legal=True,
                title="Complete your estate documents",
                description=f"Your estate plan is missing: {', '.join(missing_docs)}. These are legal documents — consult an attorney.",
                evidence=[
                    {"metric_name": "has_will", "metric_value": bool(estate.get("has_will")), "source_table": "family.estate_plans", "observed_at": observed, "confidence": 1.0, "explanation": "will present"},
                    {"metric_name": "has_poa", "metric_value": bool(estate.get("has_poa")), "source_table": "family.estate_plans", "observed_at": observed, "confidence": 1.0, "explanation": "POA present"},
                    {"metric_name": "has_beneficiaries", "metric_value": bool(estate.get("has_beneficiaries")), "source_table": "family.estate_plans", "observed_at": observed, "confidence": 1.0, "explanation": "beneficiaries set"},
                ],
                assumptions=base_assumptions,
                tradeoffs=[{"option_a": "complete now", "option_b": "delay", "benefit": "wishes honored + dependents protected", "cost": "attorney time/cost", "affected_domains": ["family"]}],
                affected=["family"]))

        # 4. college_funding — projected cost exceeds savings
        for c in cx["college"]:
            proj = _num(c.get("projected_cost"))
            saved = _num(c.get("saved_amount")) or 0.0
            if proj is not None and saved < proj:
                gap = round(proj - saved, 0)
                rows.append(self._frow(
                    ctx, slug=f"college-funding-{c.get('target_year') or 'plan'}", rtype="college_funding", priority="medium", confidence=0.7,
                    title="Your college funding has a gap to close",
                    description=f"Projected cost ~${proj:,.0f} vs ~${saved:,.0f} saved (gap ~${gap:,.0f}) for {c.get('target_year')}. Planning guidance — consider a 529/savings plan.",
                    evidence=[
                        {"metric_name": "projected_cost", "metric_value": proj, "source_table": "family.college_planning", "observed_at": observed, "confidence": 0.7, "explanation": "projected college cost"},
                        {"metric_name": "saved_amount", "metric_value": saved, "source_table": "family.college_planning", "observed_at": observed, "confidence": 0.9, "explanation": "amount saved"},
                    ],
                    assumptions=base_assumptions,
                    tradeoffs=[{"option_a": "increase 529 contributions", "option_b": "plan for loans/aid", "benefit": "less future debt", "cost": "current cash flow", "affected_domains": ["family", "finance", "education"]}],
                    affected=["family", "finance", "education"]))

        # 5. survivor_scenario — "what happens if I die": income loss vs coverage + reserves
        if cx["n_dependents"] > 0 and cx["income_median"] is not None:
            shortfall = round((cx["insurance_need"] or 0) - (cx["coverage"] or 0), 0) if cx["insurance_need"] is not None else None
            rows.append(self._frow(
                ctx, slug="survivor-scenario", rtype="survivor_scenario", priority="high", confidence=0.6,
                title="If you died tomorrow, your household would face an income shortfall",
                description=f"Losing your ~${cx['income_median']:,.0f} income leaves an estimated ~${(shortfall or 0):,.0f} protection shortfall for {cx['n_dependents']} dependent(s) after current coverage. Planning guidance — review coverage + reserves with an advisor.",
                evidence=[
                    {"metric_name": "income_at_risk", "metric_value": cx["income_median"], "source_table": "ln_central.compensation_bands", "observed_at": observed, "confidence": 0.8, "explanation": f"{cx['income_source']} market value (income proxy)"},
                    {"metric_name": "life_coverage", "metric_value": cx["coverage"], "source_table": "family.insurance_profiles", "observed_at": observed, "confidence": 0.8, "explanation": "current coverage offsetting the loss"},
                    {"metric_name": "protection_shortfall", "metric_value": shortfall, "source_table": "computed", "observed_at": observed, "confidence": 0.6, "explanation": "need minus coverage"},
                ],
                assumptions=base_assumptions,
                tradeoffs=[{"option_a": "raise coverage", "option_b": "build reserves", "benefit": "survivor security", "cost": "premium / saving", "affected_domains": ["family", "finance"]}],
                affected=["family", "finance"]))
        return rows

    async def persist_recommendations(self, ctx: UserContext) -> list[dict[str, Any]]:
        persisted: list[dict[str, Any]] = []
        for row in await self._compute_rows(ctx):
            if not row["evidence_json"]:
                continue
            res = await self._sb.upsert("family_recommendations", row, schema=FAMILY)
            if res:
                persisted.append(res[0])
        return persisted

    async def write(self, ctx: UserContext, table: str, payload: dict[str, Any]) -> WriteResult:
        row = {k: v for k, v in payload.items() if k not in ("user_id", "tenant_id")}
        row["user_id"] = ctx.user_id
        row["tenant_id"] = ctx.user_id
        res = await self._sb.insert(table, row, schema=FAMILY)
        return WriteResult(ok=bool(res), entity_id=(res[0].get("id") if res else None))
