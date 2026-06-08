"""EducationService — the flagship Education Intelligence DomainService.

Ranks candidate programs against the user's Career (cited market value + target), Finance
(debt context), and Education (program facts) inputs via the EducationROIEngine — seven
explainable scores + worst/expected/best scenarios, all cited (no uncited ROI). Emits
evidence-backed recommendations with an education_guidance governance boundary; persists to
education_recommendations (graph fan-out already live). Education is NOT registered live until
its gates pass + approval.
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
from ..services.education_roi import EducationROIEngine, ProgramScore
from .base import DomainService

EDUCATION = "education"
FINANCE = "finance"
CAREER = "career"
_REC_NS = uuid.UUID("6f3b1e22-0000-4000-8000-000000000004")

# Composite weights (config, not code) — explainable ranking, scaled by confidence.
_W = {"roi": 0.25, "career": 0.20, "fit": 0.15, "risk": 0.15, "time": 0.10, "family": 0.10}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _src(table: str) -> SourceRef:
    return SourceRef(system="supabase", table=f"education.{table}", as_of=_now())


def _rec_id(user_id: str, slug: str) -> str:
    return str(uuid.uuid5(_REC_NS, f"{user_id}:{slug}"))


def _num(v: Any) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


def education_boundary(escalate: bool = False) -> dict[str, Any]:
    return {
        "boundary_type": "education_guidance",
        "disclaimer_text": (
            "Decision support, not admissions, financial, or legal advice. Consult a "
            "professional for high-debt or licensure-gated paths."
        ),
        "escalation_path": "financial_advisor" if escalate else "admissions_counselor",
    }


def _composite(scores: dict[str, float]) -> float:
    base = sum(_W[k] * scores.get(k, 0.0) for k in _W)
    return round(base * (scores.get("confidence", 100.0) / 100.0), 1)


class EducationService(DomainService):
    domain = EDUCATION
    entity_types = [
        "education_profile", "education_goal", "learning_path", "school", "program",
        "program_comparison", "education_recommendation",
    ]

    def __init__(self, supabase: SupabaseClient, comp: CompensationIntelligenceEngine) -> None:
        self._sb = supabase
        self._comp = comp
        self._roi = EducationROIEngine()

    async def _rows(self, table: str, ctx: UserContext, *, schema: str = EDUCATION, limit: int = 200, order: Optional[str] = None) -> list[dict]:
        return await self._sb.select(table, columns="*", filters={"user_id": f"eq.{ctx.user_id}"}, limit=limit, order=order, schema=schema)

    async def _context(self, ctx: UserContext) -> dict[str, Any]:
        """Cross-domain inputs: Career current value + target, Finance debt."""
        career_profiles = await self._rows("career_profiles", ctx, schema=CAREER, limit=1, order="updated_at.desc")
        cp = career_profiles[0] if career_profiles else {}
        goals = await self._rows("education_goals", ctx, limit=1, order="updated_at.desc")
        goal = goals[0] if goals else {}
        cur = await self._comp.market_value(
            role_title=cp.get("current_title"), seniority=cp.get("seniority_level") or "mid",
            geography=cp.get("location") or "US",
        )
        debts = await self._rows("debts", ctx, schema=FINANCE, limit=200)
        total_debt = sum(d for r in debts if (d := _num(r.get("current_balance") or r.get("balance"))) is not None) or None
        return {
            "current_median": cur.median if cur else None,
            "current_source": cur.source if cur else None,
            "target_role": goal.get("target_role"),
            "total_debt": total_debt,
            "goal": goal,
        }

    async def _scored_programs(self, ctx: UserContext) -> tuple[list[ProgramScore], dict[str, Any]]:
        programs = await self._rows("programs", ctx, limit=50, order="updated_at.desc")
        schools = {str(s["id"]): s for s in await self._rows("schools", ctx, limit=50)}
        cx = await self._context(ctx)
        scored: list[ProgramScore] = []
        for p in programs:
            p = dict(p)
            p["_school_name"] = (schools.get(str(p.get("school_id"))) or {}).get("name")
            scored.append(self._roi.score_program(
                p, current_median=cx["current_median"], current_source=cx["current_source"],
                target_role=cx["target_role"], total_debt=cx["total_debt"],
            ))
        scored.sort(key=lambda s: _composite(s.scores), reverse=True)
        return scored, cx

    # ----------------------------------------------------------------- reads
    async def summary(self, ctx: UserContext) -> DomainViewModel:
        scored, cx = await self._scored_programs(ctx)
        missing: list[str] = []
        if not scored:
            missing.append("programs")
        if cx["current_median"] is None:
            missing.append("career_profiles")
        data: dict[str, Any] = {
            "programs": [_score_dict(s) for s in scored],
            "best_program": _score_dict(scored[0]) if scored else None,
            "comparison": {
                "ranked_by": "composite (roi/career/fit/risk/time/family × confidence)",
                "weights": _W,
                "count": len(scored),
            },
            "career_context": {"current_market_value": cx["current_median"], "target_role": cx["target_role"]},
            "safety_boundaries": [education_boundary()],
        }
        data["missing_data_prompts"] = missing
        recs = await self.recommendations(ctx)
        has_any = bool(scored)
        return DomainViewModel(
            domain=EDUCATION, user_id=ctx.user_id, generated_at=_now(),
            freshness=Freshness(as_of=_now(), stale=not has_any, sources=[_src("programs"), _src("schools")]),
            confidence=Confidence(score=0.6 if has_any else 0.0, basis="partial" if has_any else "missing", missing_fields=missing),
            data=data, recommendations=recs, missing=missing,
        )

    async def list_view(self, ctx: UserContext, table: str, key: str) -> DomainViewModel:
        rows = await self._rows(table, ctx, limit=200)
        missing = [] if rows else [table]
        return DomainViewModel(
            domain=EDUCATION, user_id=ctx.user_id, generated_at=_now(),
            freshness=Freshness(as_of=_now(), sources=[_src(table)]),
            confidence=Confidence(score=0.6 if rows else 0.0, basis="partial" if rows else "missing"),
            data={key: rows}, missing=missing,
        )

    async def chat_context(self, ctx: UserContext) -> DomainChatContext:
        scored, cx = await self._scored_programs(ctx)
        facts: list[dict] = []
        if scored:
            best = scored[0]
            facts.append({"fact": "best-ranked program", "value": f"{best.program_name} (composite {_composite(best.scores)})"})
            if best.income_lift is not None:
                facts.append({"fact": "estimated income lift", "value": f"{best.income_lift} (program earnings vs current market value)"})
            if best.breakeven_months is not None:
                facts.append({"fact": "breakeven", "value": f"{best.breakeven_months} months"})
        missing = [] if scored else ["programs"]
        return DomainChatContext(
            domain=EDUCATION, authoritative_facts=facts, missing_facts=missing,
            freshness=Freshness(as_of=_now(), sources=[_src("programs")]),
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
                action_steps=[ActionStep(step="See the comparison details", effort="medium", impact="high")],
                risks=["Program outcomes are cohort-level cited bands, not a personal guarantee"],
                revisit_date=_now(), generated_by="education.agent",
                governance_verdict=GovernanceVerdict(passed=True),
            ))
        return out

    def _erow(self, ctx: UserContext, *, slug: str, rtype: str, title: str, description: str,
              evidence: list[dict], assumptions: list[dict], tradeoffs: list[dict], affected: list[str],
              priority: str = "medium", confidence: float = 0.6, escalate: bool = False) -> dict[str, Any]:
        return {
            "id": _rec_id(ctx.user_id, slug), "user_id": ctx.user_id, "tenant_id": ctx.user_id,
            "title": title, "description": description, "recommendation_type": rtype,
            "priority": priority, "confidence": confidence,
            "governance_verdict": {"passed": True, **education_boundary(escalate=escalate)}, "status": "active",
            "evidence_json": evidence, "assumptions_json": assumptions, "tradeoffs_json": tradeoffs,
            "source_tables": sorted({str(e["source_table"]) for e in evidence}),
            "source_graph_nodes": [], "affected_domains": affected, "derived_by": "education-recommendation-engine",
        }

    async def _compute_rows(self, ctx: UserContext) -> list[dict[str, Any]]:
        scored, cx = await self._scored_programs(ctx)
        if not scored:
            return []
        rows: list[dict[str, Any]] = []
        best = scored[0]
        base_assumptions = best.assumptions

        def score_ev(s: ProgramScore) -> list[dict]:
            return [*s.evidence, {"metric_name": "composite_score", "metric_value": _composite(s.scores), "source_table": "computed", "observed_at": _now(), "confidence": s.scores["confidence"] / 100.0, "explanation": "weighted ROI/career/fit/risk/time/family × confidence"}]

        # 1. best_program_match — the top-ranked program (always fires when programs exist)
        rows.append(self._erow(
            ctx, slug="best-program-match", rtype="best_program_match", priority="high", confidence=round(best.scores["confidence"] / 100.0, 2),
            title=f"Best match: {best.program_name}",
            description=f"{best.program_name} ranks highest on your goals (composite {_composite(best.scores)}). Decision support, not admissions or financial advice.",
            evidence=score_ev(best), assumptions=base_assumptions,
            tradeoffs=[{"option_a": best.program_name, "option_b": "a lower-cost alternative", "benefit": "best overall fit", "cost": "may not be cheapest", "affected_domains": ["education", "finance", "career"]}],
            affected=["education", "finance", "career"]))

        # 2. high_debt_warning — net cost exceeds ~1 year of current income (or known debt is high)
        if best.net_cost is not None and cx["current_median"] and best.net_cost > cx["current_median"]:
            ev = [e for e in best.evidence if e["metric_name"] in ("net_cost", "current_market_value")]
            if cx["total_debt"]:
                ev.append({"metric_name": "existing_debt", "metric_value": cx["total_debt"], "source_table": "finance.debts", "observed_at": _now(), "confidence": 0.8, "explanation": "current total debt"})
            rows.append(self._erow(
                ctx, slug="high-debt-warning", rtype="high_debt_warning", priority="high", confidence=0.7, escalate=True,
                title="This path carries meaningful debt — review before committing",
                description=f"{best.program_name}'s net cost (~${best.net_cost:,.0f}) exceeds a year of your current market value. Weigh the debt against the cited income lift; consult a financial advisor.",
                evidence=ev, assumptions=base_assumptions,
                tradeoffs=[{"option_a": "proceed", "option_b": "delay/save or lower-cost path", "benefit": "earlier credential", "cost": "higher debt + cash-flow strain", "affected_domains": ["education", "finance"]}],
                affected=["education", "finance"]))

        # 3. lower_cost_alternative / better_roi_path — when a cheaper or higher-ROI option exists
        if len(scored) >= 2:
            cheapest = min(scored, key=lambda s: (s.net_cost if s.net_cost is not None else float("inf")))
            if cheapest.program_id != best.program_id and cheapest.net_cost is not None and best.net_cost is not None and cheapest.net_cost < best.net_cost:
                rows.append(self._erow(
                    ctx, slug="lower-cost-alternative", rtype="lower_cost_alternative", priority="medium", confidence=round(cheapest.scores["confidence"] / 100.0, 2),
                    title=f"Lower-cost alternative: {cheapest.program_name}",
                    description=f"{cheapest.program_name} costs ~${cheapest.net_cost:,.0f} vs ~${best.net_cost:,.0f} with a comparable career score. Decision support, not financial advice.",
                    evidence=score_ev(cheapest),
                    assumptions=cheapest.assumptions,
                    tradeoffs=[{"option_a": cheapest.program_name, "option_b": best.program_name, "benefit": "lower debt", "cost": "possibly lower prestige/outcomes", "affected_domains": ["education", "finance"]}],
                    affected=["education", "finance"]))
            best_roi = max(scored, key=lambda s: s.scores["roi"])
            if best_roi.program_id != best.program_id and best_roi.scores["roi"] > best.scores["roi"]:
                rows.append(self._erow(
                    ctx, slug="better-roi-path", rtype="better_roi_path", priority="medium", confidence=round(best_roi.scores["confidence"] / 100.0, 2),
                    title=f"Higher-ROI path: {best_roi.program_name}",
                    description=f"{best_roi.program_name} has a stronger ROI score ({best_roi.scores['roi']:.0f}) than the top overall match — worth weighing if cost/time matter most.",
                    evidence=score_ev(best_roi), assumptions=best_roi.assumptions,
                    tradeoffs=[{"option_a": best_roi.program_name, "option_b": best.program_name, "benefit": "faster payback", "cost": "lower overall fit", "affected_domains": ["education", "finance", "career"]}],
                    affected=["education", "finance", "career"]))

        # 4. career_alignment_gap — best program does not align to the target role
        if cx["target_role"] and best.scores["career"] < 50:
            rows.append(self._erow(
                ctx, slug="career-alignment-gap", rtype="career_alignment_gap", priority="medium", confidence=0.6,
                title="Your top program may not lift you toward your target role",
                description=f"None of your programs map to a strong income lift toward {cx['target_role']}. Re-check the target or program choice.",
                evidence=[e for e in best.evidence if e["metric_name"] in ("income_lift", "current_market_value")] or [{"metric_name": "career_score", "metric_value": best.scores["career"], "source_table": "computed", "observed_at": _now(), "confidence": 0.6, "explanation": "low career-impact score"}],
                assumptions=base_assumptions,
                tradeoffs=[{"option_a": "change target", "option_b": "change program", "benefit": "better alignment", "cost": "re-planning", "affected_domains": ["education", "career"]}],
                affected=["education", "career"]))
        return rows

    async def persist_recommendations(self, ctx: UserContext) -> list[dict[str, Any]]:
        persisted: list[dict[str, Any]] = []
        for row in await self._compute_rows(ctx):
            if not row["evidence_json"]:
                continue
            res = await self._sb.upsert("education_recommendations", row, schema=EDUCATION)
            if res:
                persisted.append(res[0])
        return persisted

    async def write(self, ctx: UserContext, table: str, payload: dict[str, Any]) -> WriteResult:
        row = {k: v for k, v in payload.items() if k not in ("user_id", "tenant_id")}
        row["user_id"] = ctx.user_id
        row["tenant_id"] = ctx.user_id
        res = await self._sb.insert(table, row, schema=EDUCATION)
        return WriteResult(ok=bool(res), entity_id=(res[0].get("id") if res else None))


def _score_dict(s: ProgramScore) -> dict[str, Any]:
    return {
        "program_id": s.program_id, "program_name": s.program_name, "school": s.school_name,
        "net_cost": s.net_cost, "opportunity_cost": s.opportunity_cost, "income_lift": s.income_lift,
        "breakeven_months": s.breakeven_months, "scenarios": s.scenarios, "scores": s.scores,
        "composite": _composite(s.scores), "missing": s.missing,
    }
