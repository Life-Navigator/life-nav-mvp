"""CareerService — the Career Intelligence DomainService.

Authoritative source for current market value, compensation growth, skill-gap analysis,
credential ROI, role targeting, promotion readiness, and career→finance impact. Every
number is cited (CompensationIntelligenceEngine / MarketPositionAnalyzer over ln_central
OEWS bands) — no fantasy salaries, no fake zeros. Recommendations follow the H contract;
each carries evidence + assumptions + tradeoffs + a career_guidance governance boundary.

Career is NOT registered live until 15/15 gates + explicit approval.
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
from ..services.market_intelligence import MarketPositionAnalyzer
from .base import DomainService

CAREER = "career"
_REC_NS = uuid.UUID("6f3b1e22-0000-4000-8000-000000000003")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _src(table: str) -> SourceRef:
    return SourceRef(system="supabase", table=f"career.{table}", as_of=_now())


def _rec_id(user_id: str, slug: str) -> str:
    return str(uuid.uuid5(_REC_NS, f"{user_id}:{slug}"))


def _num(v: Any) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def career_boundary() -> dict[str, Any]:
    return {
        "boundary_type": "career_guidance",
        "disclaimer_text": (
            "Career coaching grounded in cited market data — not a guarantee of hire or "
            "compensation. Consult a career professional for personalized advice."
        ),
        "escalation_path": "career_professional",
    }


class CareerService(DomainService):
    domain = CAREER
    entity_types = [
        "career_profile", "career_goal", "user_skill", "skill_gap", "credential",
        "certification", "degree", "job_target", "compensation_record",
        "compensation_projection", "career_recommendation",
    ]

    def __init__(
        self,
        supabase: SupabaseClient,
        comp: CompensationIntelligenceEngine,
        market: MarketPositionAnalyzer,
    ) -> None:
        self._sb = supabase
        self._comp = comp
        self._market = market

    async def _rows(self, table: str, ctx: UserContext, *, schema: str = CAREER, limit: int = 200, order: Optional[str] = None) -> list[dict]:
        return await self._sb.select(
            table, columns="*", filters={"user_id": f"eq.{ctx.user_id}"},
            limit=limit, order=order, schema=schema,
        )

    # ----------------------------------------------------------------- reads
    async def _profile(self, ctx: UserContext) -> Optional[dict]:
        # career_profiles lives in the PUBLIC schema (migration 032), NOT the career schema — reading it
        # from `career` returned nothing, so a saved current role never rendered (showed "input again").
        rows = await self._rows("career_profiles", ctx, schema="public", limit=1, order="updated_at.desc")
        return rows[0] if rows else None

    async def _primary_goal(self, ctx: UserContext) -> Optional[dict]:
        rows = await self._rows("career_goals", ctx, limit=1, order="updated_at.desc")
        return rows[0] if rows else None

    async def _primary_target(self, ctx: UserContext) -> Optional[dict]:
        rows = await self._rows("job_targets", ctx, limit=1, order="updated_at.desc")
        return rows[0] if rows else None

    async def _latest_comp(self, ctx: UserContext) -> Optional[dict]:
        rows = await self._rows("compensation_records", ctx, limit=1, order="effective_date.desc")
        return rows[0] if rows else None

    async def summary(self, ctx: UserContext) -> DomainViewModel:
        profile = await self._profile(ctx)
        goal = await self._primary_goal(ctx)
        target = await self._primary_target(ctx)
        comp_rec = await self._latest_comp(ctx)
        skill_gaps = await self._rows("skill_gaps", ctx, limit=50)

        seniority = (profile or {}).get("seniority_level") or "mid"
        geo = (profile or {}).get("location") or (target or {}).get("location") or "US"
        current_role = (profile or {}).get("current_title")
        target_role = (target or {}).get("role_title") or (goal or {}).get("target_role")

        market_value = await self._comp.market_value(role_title=current_role, seniority=seniority, geography=geo)
        target_value = await self._comp.market_value(role_title=target_role, seniority=seniority, geography=geo)
        market_pos = await self._market.position(role_title=current_role, geography=geo)

        missing: list[str] = []
        if not profile:
            missing.append("career_profiles")
        if not target and not goal:
            missing.append("job_targets")
        if not comp_rec:
            missing.append("compensation_records")
        if market_value is None and current_role:
            missing.append("compensation_bands")

        data: dict[str, Any] = {
            "current_state": {
                # Real public.career_profiles columns: current_company (not current_employer),
                # years_of_experience (not years_experience).
                "title": current_role, "employer": (profile or {}).get("current_company"),
                "industry": (profile or {}).get("industry"), "seniority": seniority,
                "years_experience": (profile or {}).get("years_of_experience"),
            } if profile else None,
            "target_state": {
                "role": target_role, "target_comp_median": (target or {}).get("target_comp_median"),
                "goal": (goal or {}).get("title"),
            } if (target or goal) else None,
            "market_position": market_pos,
            "compensation": {
                "current_estimated_market_value": _band_dict(market_value),
                "target_estimated_market_value": _band_dict(target_value),
                "recorded_comp_median": _num((comp_rec or {}).get("comp_median")),
            },
            "skill_gaps": [
                {"skill": g.get("skill_name"), "target_role": g.get("target_role"), "severity": g.get("severity")}
                for g in skill_gaps
            ],
            "safety_boundaries": [career_boundary()],
        }
        data["missing_data_prompts"] = missing
        recs = await self.recommendations(ctx)
        has_any = bool(profile or target or goal or comp_rec or skill_gaps)
        return DomainViewModel(
            domain=CAREER, user_id=ctx.user_id, generated_at=_now(),
            freshness=Freshness(as_of=_now(), stale=not has_any, sources=[_src("career_profiles"), _src("job_targets"), _src("compensation_records")]),
            confidence=Confidence(score=0.6 if has_any else 0.0, basis="partial" if has_any else "missing", missing_fields=missing),
            data=data, recommendations=recs, missing=missing,
        )

    async def list_view(self, ctx: UserContext, table: str, key: str) -> DomainViewModel:
        rows = await self._rows(table, ctx, limit=200)
        missing = [] if rows else [table]
        return DomainViewModel(
            domain=CAREER, user_id=ctx.user_id, generated_at=_now(),
            freshness=Freshness(as_of=_now(), sources=[_src(table)]),
            confidence=Confidence(score=0.6 if rows else 0.0, basis="partial" if rows else "missing"),
            data={key: rows}, missing=missing,
        )

    async def chat_context(self, ctx: UserContext) -> DomainChatContext:
        profile = await self._profile(ctx)
        target = await self._primary_target(ctx)
        comp_rec = await self._latest_comp(ctx)
        seniority = (profile or {}).get("seniority_level") or "mid"
        geo = (profile or {}).get("location") or "US"
        mv = await self._comp.market_value(role_title=(profile or {}).get("current_title"), seniority=seniority, geography=geo)
        facts: list[dict] = []
        if mv and mv.median is not None:
            facts.append({"fact": "estimated current market value (median)", "value": f"{mv.median} {mv.currency} (source {mv.source}, confidence {mv.confidence})"})
        if comp_rec and comp_rec.get("comp_median") is not None:
            facts.append({"fact": "recorded compensation (median)", "value": str(comp_rec.get("comp_median"))})
        if target:
            facts.append({"fact": "target role", "value": str(target.get("role_title"))})
        missing = [] if facts else ["career_profiles"]
        return DomainChatContext(
            domain=CAREER, authoritative_facts=facts, missing_facts=missing,
            freshness=Freshness(as_of=_now(), sources=[_src("career_profiles")]),
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
                source_tables=r["source_tables"],
                assumptions=[a["assumption_text"] for a in r["assumptions_json"]],
                confidence=Confidence(score=r["confidence"], basis="partial", missing_fields=[]),
                priority=r["priority"], affected_domains=r["affected_domains"],
                action_steps=[ActionStep(step="See details", effort="medium", impact="high")],
                risks=["Market estimates are cited bands, not a guarantee of hire or pay"],
                revisit_date=_now(), generated_by="career.agent",
                governance_verdict=GovernanceVerdict(passed=True),
            ))
        return out

    def _crow(self, ctx: UserContext, *, slug: str, rtype: str, title: str, description: str,
              evidence: list[dict], assumptions: list[dict], tradeoffs: list[dict],
              affected: list[str], priority: str = "medium", confidence: float = 0.6) -> dict[str, Any]:
        return {
            "id": _rec_id(ctx.user_id, slug), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
            "title": title, "description": description, "recommendation_type": rtype,
            "priority": priority, "confidence": confidence,
            "governance_verdict": {"passed": True, **career_boundary()}, "status": "active",
            "evidence_json": evidence, "assumptions_json": assumptions, "tradeoffs_json": tradeoffs,
            "source_tables": sorted({str(e["source_table"]) for e in evidence}),
            "source_graph_nodes": [], "affected_domains": affected, "derived_by": "career-recommendation-engine",
        }

    async def _compute_rows(self, ctx: UserContext) -> list[dict[str, Any]]:
        """The 5 X4 families. No recommendation without cited evidence."""
        profile = await self._profile(ctx)
        goal = await self._primary_goal(ctx)
        target = await self._primary_target(ctx)
        comp_rec = await self._latest_comp(ctx)
        skill_gaps = await self._rows("skill_gaps", ctx, limit=50)
        seniority = (profile or {}).get("seniority_level") or "mid"
        geo = (profile or {}).get("location") or (target or {}).get("location") or "US"
        current_role = (profile or {}).get("current_title")
        target_role = (target or {}).get("role_title") or (goal or {}).get("target_role")
        observed = _now()
        rows: list[dict[str, Any]] = []

        scenario = await self._comp.scenario(current_role=current_role, target_role=target_role, seniority=seniority, geography=geo)
        lift = scenario.get("median_lift")
        mv = await self._comp.market_value(role_title=current_role, seniority=seniority, geography=geo)

        base_assumptions = lambda extra: [  # noqa: E731
            *extra,
            {"assumption_text": "OEWS bands are cohort-level and approximate current market", "confidence": 0.7, "user_confirmed": False, "source": "model"},
            {"assumption_text": "career coaching only; not a guarantee of hire or pay", "confidence": 1.0, "user_confirmed": False, "source": "policy"},
        ]

        # 1. skill_gap_closure — needs a logged gap + (ideally) a comp lift to the target
        if skill_gaps:
            gap = skill_gaps[0]
            ev = [{"metric_name": "skill_gap", "metric_value": gap.get("skill_name"), "source_table": "career.skill_gaps", "observed_at": observed, "confidence": 0.8, "explanation": f"gap to {gap.get('target_role') or target_role}"}]
            if lift is not None:
                ev.append({"metric_name": "comp_uplift_median", "metric_value": lift, "source_table": "ln_central.compensation_bands", "observed_at": observed, "confidence": 0.7, "explanation": "median delta current->target role (OEWS)"})
            rows.append(self._crow(
                ctx, slug="skill-gap-closure", rtype="skill_gap_closure", priority="high", confidence=0.7,
                title=f"Close your {gap.get('skill_name')} skill gap",
                description=f"Closing the {gap.get('skill_name')} gap is the main step toward {gap.get('target_role') or target_role}. Career coaching, not a guarantee.",
                evidence=ev, assumptions=base_assumptions([]),
                tradeoffs=[{"option_a": "upskill now", "option_b": "target a closer role", "benefit": "higher comp ceiling + role match", "cost": "upskilling time", "affected_domains": ["career", "education"]}],
                affected=["career", "education"]))

        # 2. certification_roi — a gap exists + a comp lift justifies a credential
        if skill_gaps and lift is not None and lift > 0:
            rows.append(self._crow(
                ctx, slug="certification-roi", rtype="certification_roi", priority="medium", confidence=0.6,
                title="A targeted certification likely pays off",
                description=f"A certification closing your top gap maps to an estimated ${lift:,.0f} median uplift toward {target_role}. Coaching, not a guarantee.",
                evidence=[{"metric_name": "comp_uplift_median", "metric_value": lift, "source_table": "ln_central.compensation_bands", "observed_at": observed, "confidence": 0.7, "explanation": "median delta current->target role (OEWS)"}],
                assumptions=base_assumptions([{"assumption_text": "a credential meaningfully closes the gap", "confidence": 0.6, "user_confirmed": False, "source": "model"}]),
                tradeoffs=[{"option_a": "certification", "option_b": "degree", "benefit": "faster/cheaper", "cost": "less signal than a degree", "affected_domains": ["career", "education", "finance"]}],
                affected=["career", "education", "finance"]))

        # 3. compensation_growth — recorded comp below market median for the role
        if comp_rec and mv and mv.median is not None and _num(comp_rec.get("comp_median")) is not None:
            recorded = _num(comp_rec.get("comp_median"))
            if recorded is not None and recorded < mv.median:
                gap_amt = round(mv.median - recorded, 0)
                rows.append(self._crow(
                    ctx, slug="compensation-growth", rtype="compensation_growth", priority="high", confidence=0.7,
                    title="Your pay is below the market median for your role",
                    description=f"Your recorded comp (~${recorded:,.0f}) is below the {mv.source} median (~${mv.median:,.0f}) for {current_role} — an estimated ${gap_amt:,.0f} gap. Coaching, not a guarantee.",
                    evidence=[
                        {"metric_name": "recorded_comp_median", "metric_value": recorded, "source_table": "career.compensation_records", "observed_at": observed, "confidence": 0.8, "explanation": "user-recorded comp"},
                        {"metric_name": "market_comp_median", "metric_value": mv.median, "source_table": "ln_central.compensation_bands", "observed_at": observed, "confidence": mv.confidence, "explanation": f"{mv.source} median for {mv.occupation_code}"},
                    ],
                    assumptions=base_assumptions([]),
                    tradeoffs=[{"option_a": "negotiate now", "option_b": "switch employers", "benefit": "close the gap", "cost": "effort / risk", "affected_domains": ["career", "finance"]}],
                    affected=["career", "finance"]))

        # 4. promotion_readiness — advancement goal + sufficient tenure
        years = _num((profile or {}).get("years_of_experience"))
        if goal and (goal.get("goal_type") == "advancement") and years is not None and years >= 3:
            rows.append(self._crow(
                ctx, slug="promotion-readiness", rtype="promotion_readiness", priority="medium", confidence=0.6,
                title="You're in range for a promotion push",
                description=f"With {years:.0f} years of experience and an advancement goal, a promotion case is reasonable to build now. Coaching, not a guarantee.",
                evidence=[
                    {"metric_name": "years_experience", "metric_value": years, "source_table": "career.career_profiles", "observed_at": observed, "confidence": 0.8, "explanation": "profile tenure"},
                    {"metric_name": "goal_type", "metric_value": "advancement", "source_table": "career.career_goals", "observed_at": observed, "confidence": 1.0, "explanation": "stated goal"},
                ],
                assumptions=base_assumptions([{"assumption_text": "performance supports a promotion case", "confidence": 0.5, "user_confirmed": False, "source": "model"}]),
                tradeoffs=[{"option_a": "internal promotion", "option_b": "external move", "benefit": "continuity", "cost": "may be slower than a switch", "affected_domains": ["career"]}],
                affected=["career"]))

        # 5. role_transition — a target role with a positive cited comp lift
        if target_role and lift is not None and lift > 0:
            rows.append(self._crow(
                ctx, slug="role-transition", rtype="role_transition", priority="medium", confidence=0.65,
                title=f"Transitioning to {target_role} looks worthwhile",
                description=f"Moving from {current_role} to {target_role} maps to an estimated ${lift:,.0f} median uplift (OEWS). Coaching, not a guarantee.",
                evidence=[{"metric_name": "comp_uplift_median", "metric_value": lift, "source_table": "ln_central.compensation_bands", "observed_at": observed, "confidence": 0.7, "explanation": "median delta current->target role (OEWS)"}],
                assumptions=base_assumptions([]),
                tradeoffs=[{"option_a": "transition now", "option_b": "stay + grow", "benefit": "higher comp ceiling", "cost": "ramp/learning risk", "affected_domains": ["career", "finance"]}],
                affected=["career", "finance"]))
        return rows

    async def persist_recommendations(self, ctx: UserContext) -> list[dict[str, Any]]:
        """Persist all fired families (idempotent uuid5 ids). No row without evidence."""
        persisted: list[dict[str, Any]] = []
        for row in await self._compute_rows(ctx):
            if not row["evidence_json"]:
                continue
            res = await self._sb.upsert("career_recommendations", row, schema=CAREER)
            if res:
                persisted.append(res[0])
        return persisted

    # ---------------------------------------------------- Phase 7: report model
    async def report_model(self, ctx: UserContext) -> dict[str, Any]:
        """CareerReportViewModel — the structured report (PDF later; Education-ROI input).
        Sections only; no renderer here."""
        vm = await self.summary(ctx)
        return {
            "report_type": "career_intelligence",
            "version": 1,
            "generated_at": _now(),
            "sections": {
                "executive_summary": {
                    "current_role": (vm.data.get("current_state") or {}).get("title"),
                    "target_role": (vm.data.get("target_state") or {}).get("role"),
                    "headline": "Career intelligence grounded in cited market data.",
                },
                "current_market_value": vm.data.get("compensation", {}).get("current_estimated_market_value"),
                "target_role_analysis": {"target_state": vm.data.get("target_state"), "market_position": vm.data.get("market_position")},
                "skill_gap_analysis": vm.data.get("skill_gaps"),
                "compensation_forecast": vm.data.get("compensation"),
                "recommendations": [r.model_dump() for r in vm.recommendations],
                "evidence_appendix": [
                    {"recommendation": r.title, "evidence": [e.model_dump() for e in r.evidence], "assumptions": r.assumptions}
                    for r in vm.recommendations
                ],
            },
            "safety": career_boundary(),
            "confidence": vm.confidence.model_dump(),
            "missing": vm.missing,
        }

    # --------------------------------------------------------------- writes
    async def write(self, ctx: UserContext, table: str, payload: dict[str, Any]) -> WriteResult:
        row = {k: v for k, v in payload.items() if k not in ("user_id", "tenant_id")}
        row["user_id"] = ctx.user_id
        row["tenant_id"] = ctx.user_id
        res = await self._sb.insert(table, row, schema=CAREER)
        return WriteResult(ok=bool(res), entity_id=(res[0].get("id") if res else None))


def _band_dict(e: Any) -> Optional[dict[str, Any]]:
    if not e or e.median is None:
        return None
    return {
        "low": e.low, "median": e.median, "high": e.high, "currency": e.currency,
        "confidence": e.confidence, "source": e.source, "as_of": e.as_of,
    }
