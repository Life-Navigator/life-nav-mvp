"""UniversalReportEngine (Sprint 3) — generate_report / render_report / store_report.

Builds a typed ReportDefinition for any report type (full / financial / education / decision)
from the live domain engines, hashes it reproducibly (same inputs -> same content_hash), and
stores it in reporting.reports (+ a reporting.report_versions row when the content changes).
JSON-first: no PDF — a renderer consumes content_json later.
"""
from __future__ import annotations

import hashlib
import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..clients.supabase import SupabaseClient
from ..domains.base import DomainService
from ..domains.education import EducationService
from ..models.common import DomainViewModel, UserContext
from ..models.report import (
    AssumptionReference,
    ChartDefinition,
    EvidenceReference,
    RecommendationReference,
    ReportDefinition,
    ReportSection,
)

REPORTING = "reporting"
DECISION = "decision"
_NS = uuid.UUID("6f3b1e22-0000-4000-8000-000000000007")
_VOLATILE = {"generated_at", "observed_at", "as_of", "created_at", "updated_at", "revisit_date"}
# Any ISO-8601 datetime *value* is neutralized for the hash too, so a timestamp leaking under
# an unexpected key name can't break reproducibility (same inputs -> same hash).
_TS_RE = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}")

REPORT_TYPES = ("full", "financial", "education", "decision", "compensation", "family", "health")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _report_id(user_id: str, report_type: str) -> str:
    return str(uuid.uuid5(_NS, f"{user_id}:{report_type}"))


def _normalize(obj: Any) -> Any:
    if isinstance(obj, dict):
        return {k: _normalize(v) for k, v in sorted(obj.items()) if k not in _VOLATILE}
    if isinstance(obj, list):
        # Sort lists in the hash-only normalized form so DB row / recommendation order can't
        # affect reproducibility. The STORED content_json keeps its real (display) order.
        items = [_normalize(v) for v in obj]
        return sorted(items, key=lambda x: json.dumps(x, sort_keys=True, default=str))
    if isinstance(obj, str) and _TS_RE.match(obj):
        return "<ts>"  # neutralize any leaked ISO timestamp value
    return obj


def content_hash(definition: ReportDefinition) -> str:
    payload = json.dumps(_normalize(definition.model_dump()), sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode()).hexdigest()


def _evidence_refs(rec: Any) -> list[EvidenceReference]:
    out = []
    for e in getattr(rec, "evidence", []) or []:
        src = getattr(e, "source", None)
        out.append(EvidenceReference(
            metric_name=getattr(e, "statement", "evidence"), metric_value="",
            source_table=(getattr(src, "table", None) or "computed"),
        ))
    return out


def _rec_refs(recs: list[Any]) -> list[RecommendationReference]:
    return [RecommendationReference(id=r.id, title=r.title, priority=getattr(r, "priority", None)) for r in recs]


class UniversalReportEngine:
    def __init__(self, domains: dict[str, DomainService], education: EducationService, supabase: SupabaseClient, trends: Any = None, comp_benefits: Any = None, reco_os: Any = None, readiness: Any = None) -> None:
        self._domains = domains
        self._edu = education
        self._sb = supabase
        self._trends = trends  # optional TrendAnalyzer — adds a finance progress-over-time section
        self._comp = comp_benefits  # optional CompensationBenefitsEngine — the compensation report
        self._os = reco_os  # the Recommendation OS — reports show the SAME recommendations as the dashboard
        self._readiness = readiness  # optional LifeReadinessEngine — the advisor-briefing readiness score

    # ---- build (generate_report) ----
    async def build(self, ctx: UserContext, report_type: str) -> ReportDefinition:
        definition = await self._build(ctx, report_type)
        # P4 — advisor-grade reports lead with an executive briefing (readiness, goals, recommendations
        # + full explainability, risks, opportunities, 90-day plan, appendix). All real; honest empties.
        if report_type in ("full", "financial"):
            try:
                definition.sections.insert(0, await self._advisor_executive_section(ctx, 0))
            except Exception:  # noqa: BLE001 — the briefing never breaks report generation
                pass
        # Sprint 36: lead with the user's life model (vision/objective/themes/constraints/tradeoffs).
        life_sec = await self._life_model_section(ctx, 0)
        if life_sec:
            definition.sections.insert(0, life_sec)
            for i, s in enumerate(definition.sections):
                s.ord = i + 1
        # Sprint 26: every report's recommendations come from the ONE Recommendation OS.
        if self._os is not None:
            sec = await self._os_recommendations_section(ctx, len(definition.sections) + 1)
            if sec:
                definition.sections.append(sec)
        # Sprint 39: surface the deterministic tool calculations behind the numbers.
        tool_sec = await self._tool_calculations_section(ctx, len(definition.sections) + 1)
        if tool_sec:
            definition.sections.append(tool_sec)
        return definition

    async def _tool_calculations_section(self, ctx: UserContext, ord_n: int) -> Optional[ReportSection]:
        """Every number in this report that came from a deterministic tool, with its calculation."""
        try:
            runs = await self._sb.select("tool_runs", filters={"user_id": f"eq.{ctx.user_id}"}, limit=20, order="created_at.desc", schema="tools")
        except Exception:  # noqa: BLE001
            return None
        if not runs:
            return None
        seen, items = set(), []
        for r in runs:  # most-recent run per tool
            t = r.get("tool")
            if t in seen:
                continue
            seen.add(t)
            items.append({"tool": t, "confidence": r.get("confidence"),
                          "outputs": r.get("outputs"), "assumptions": r.get("assumptions"),
                          "limitations": r.get("limitations"), "tool_run_id": r.get("tool_run_id")})
        return ReportSection(key="tool_calculations", title="Deterministic Calculations", ord=ord_n,
                             body={"note": "Every figure below is computed by a deterministic tool (same input → same output), not estimated.",
                                   "calculations": items[:10]})

    async def _life_model_section(self, ctx: UserContext, ord_n: int) -> Optional[ReportSection]:
        """Advisor-grade life-model section: vision, primary objective, themes, constraints, tradeoffs."""
        try:
            from .life_discovery import LifeDiscoveryService
            life = LifeDiscoveryService(self._sb)
            snap = await life.snapshot(ctx)
            if not snap.get("objectives"):
                return None
            plan = await life.objectives_plan(ctx)
        except Exception:  # noqa: BLE001
            return None
        po = snap.get("primary_objective") or {}
        return ReportSection(
            key="life_model", title="Your Life Model", ord=ord_n,
            body={"life_vision": snap.get("life_vision"),
                  "primary_objective": {"title": po.get("title"), "confidence": po.get("confidence"), "reasoning": po.get("reasoning")},
                  "themes": snap.get("top_themes"),
                  "constraints": snap.get("active_constraints"),
                  "opportunities": snap.get("top_opportunities"),
                  "tradeoffs": [{"between": c["between"], "reason": c["reason"], "focus": c["suggested_focus"]} for c in plan.get("conflicts", [])],
                  "discovery_note": "Recommendations in this report are evaluated against these objectives + constraints."})

    async def _build(self, ctx: UserContext, report_type: str) -> ReportDefinition:
        if report_type == "financial":
            return await self._domain_report(ctx, "finance", "Financial Report")
        if report_type == "family":
            return await self._domain_report(ctx, "family", "Family & Protection Report")
        if report_type == "health":
            return await self._domain_report(ctx, "health", "Health & Wellness Report")
        if report_type == "education":
            return await self._education_report(ctx)
        if report_type == "decision":
            return await self._decision_report(ctx)
        if report_type == "full":
            return await self._full_report(ctx)
        if report_type == "compensation":
            return await self._compensation_report(ctx)
        raise ValueError(f"unknown report_type {report_type}")

    async def _os_recommendations_section(self, ctx: UserContext, ord_n: int) -> Optional[ReportSection]:
        try:
            pri = await self._os.prioritize(ctx, top=5)
        except Exception:  # noqa: BLE001
            return None
        actions = pri.get("top_actions") or []
        if not actions:
            return None
        return ReportSection(
            key="prioritized_recommendations", title="Your Prioritized Next Steps", ord=ord_n,
            body={"recommendations": [{"title": a["title"], "why": a.get("why"), "action": a.get("recommended_action"),
                                       "priority": a.get("priority"), "confidence": a.get("confidence"),
                                       "expected_benefit": a.get("expected_benefit"), "source": a.get("source_module")}
                                      for a in actions]},
            recommendations=[RecommendationReference(id=a["id"], title=a["title"], priority=a.get("priority")) for a in actions],
            evidence=[EvidenceReference(metric_name=a["title"], metric_value="", source_table=a.get("source_module", "recommendation_os")) for a in actions])

    async def _advisor_executive_section(self, ctx: UserContext, ord_n: int) -> ReportSection:
        """Advisor-grade executive briefing — readiness, goals, recommendations + full explainability,
        risks, opportunities, 90-day plan, appendix. 100% real data; honest empties where absent."""
        readiness: dict[str, Any] = {}
        try:
            if self._readiness is not None:
                r = await self._readiness.assess(ctx)
                readiness = {"overall": r["index"]["score"], "status": r["index"]["status"],
                             "domains": [{"domain": d["domain"], "progress": d["progress"], "status": d["status"], "gap": d.get("gap")}
                                         for d in r.get("domains", [])]}
        except Exception:  # noqa: BLE001
            readiness = {}

        snap: dict[str, Any] = {}
        try:
            from .life_discovery import LifeDiscoveryService
            snap = await LifeDiscoveryService(self._sb).snapshot(ctx)
        except Exception:  # noqa: BLE001
            snap = {}
        po = snap.get("primary_objective") or {}

        recs: list[dict[str, Any]] = []
        plan: dict[str, Any] = {}
        nba: Optional[dict[str, Any]] = None
        try:
            rd = await self._os.roadmap(ctx) if self._os is not None else {}
            actions = (rd.get("now") or []) + (rd.get("next") or []) + (rd.get("later") or [])
            for a in actions[:8]:
                qi = a.get("quantified_impact") or {}
                bits = []
                if qi.get("financial_impact_annual"):
                    bits.append(f"+${float(qi['financial_impact_annual']):,.0f}/yr")
                # The OS writes before/after as *_before_pct/*_after_pct (retirement_success, protection_adequacy),
                # not readiness_before/after — read the real keys so the strongest computed outcome shows.
                for metric, label in (("retirement_success", "retirement success"),
                                      ("protection_adequacy", "protection")):
                    b, af = qi.get(f"{metric}_before_pct"), qi.get(f"{metric}_after_pct")
                    if b is not None and af is not None:
                        bits.append(f"{label} {b}% → {af}%")
                if a.get("expected_benefit"):
                    bits.append(str(a["expected_benefit"]))
                recs.append({
                    "title": a.get("title"), "priority": a.get("priority"), "rec_type": a.get("rec_type"),
                    "why": (a.get("narrative") or {}).get("why") or a.get("why"),
                    "confidence": a.get("confidence"), "expected_impact": " · ".join(bits) or None,
                    "domains": a.get("impacted_domains") or [],
                    "evidence": [{"statement": e.get("statement"), "source": e.get("source_table")}
                                 for e in (a.get("evidence") or []) if e and (e.get("statement") or e.get("source_table"))],
                    "assumptions": [x for x in (a.get("assumptions") or []) if x and (x.get("label") or x.get("value"))],
                    "unlocks": qi.get("unlocked_capabilities") or [],
                    "updated_at": a.get("updated_at"),
                })
            nba = next((x for x in recs if x.get("rec_type") in ("ACTION", "OPPORTUNITY")), recs[0] if recs else None)
            plan = {"now": [a.get("title") for a in (rd.get("now") or [])],
                    "next": [a.get("title") for a in (rd.get("next") or [])],
                    "later": [a.get("title") for a in (rd.get("later") or [])],
                    "blocked": [{"title": b.get("title"), "why": b.get("why")} for b in (rd.get("blocked_by") or [])]}
        except Exception:  # noqa: BLE001
            recs, plan, nba = [], {}, None

        # Goals — read the CANONICAL view (deduped across stores, candidate-protected) so the report shows
        # the SAME goals as the dashboard and never lists persona/duplicate goals as tracked (Report Truth D2).
        goals: list[dict[str, Any]] = []
        try:
            from .canonical_goals import CanonicalGoalsService
            from .life_discovery import LifeDiscoveryService as _LDS
            cg = await CanonicalGoalsService(_LDS(self._sb), self._sb).canonical_goals(ctx)
            goals = [{"title": g.get("title"), "status": g.get("status"), "progress": g.get("progress"),
                      "category": g.get("domain"), "confirmation_status": g.get("confirmation_status"),
                      "source_store": g.get("source_store")} for g in cg]
        except Exception:  # noqa: BLE001
            goals = []

        confs = [r["confidence"] for r in recs if r.get("confidence") is not None]
        missing = sorted({u for r in recs for u in (r.get("unlocks") or [])})
        # Narrative LEAD — the report must open with the SAME dominant narrative the dashboard shows
        # (narrative-consistency fix). Compose the Life Brief from the same snapshot + next best action;
        # honest empty when discovery is still forming. Pure surfacing, no new data.
        try:
            from .life_discovery import life_brief as _life_brief
            brief = _life_brief(snap, next_action=nba, readiness=readiness or None)
        except Exception:  # noqa: BLE001
            brief = None
        payload = {
            "cover": {"readiness": readiness.get("overall"), "objective": po.get("title"),
                      "confidence_pct": round((po.get("confidence") or 0) * 100) if po.get("confidence") is not None else None},
            "life_brief": brief,
            "dominant_narrative": snap.get("dominant_narrative"),
            "narrative_explanation": snap.get("narrative_explanation"),
            "vision": snap.get("life_vision"),
            "primary_objective": {"title": po.get("title"), "reasoning": po.get("reasoning")},
            "readiness": readiness,
            "goals": goals,
            "recommendations": recs,
            "next_best_action": nba,
            "risks": snap.get("top_risks") or [],
            "opportunities": snap.get("top_opportunities") or [],
            "missing_data": missing,
            "plan_90": plan,
            "appendix": {"evidence_count": sum(len(r.get("evidence") or []) for r in recs),
                         "recommendation_count": len(recs), "goal_count": len(goals),
                         "avg_confidence_pct": round(sum(confs) / len(confs) * 100) if confs else None},
        }
        return ReportSection(key="advisor_executive", title="Executive Briefing", ord=ord_n, body=payload)

    async def _compensation_report(self, ctx: UserContext) -> ReportDefinition:
        if self._comp is None:
            return ReportDefinition(report_type="compensation", title="Compensation & Benefits Report",
                                    sections=[ReportSection(key="unavailable", title="Not available", ord=1, body={"reason": "engine not wired"})])
        a = await self._comp.analyze(ctx)
        tc = a["total_compensation"]
        sections = [
            ReportSection(key="1_total_compensation", title="Total Compensation", ord=1, body=tc),
            ReportSection(key="2_five_year_value", title="Five-Year Value", ord=2, body=a["five_year_value"]),
            ReportSection(key="3_benefit_valuation", title="Benefit Valuation", ord=3, body={"benefits": a["benefit_valuation"]}),
            ReportSection(key="4_retirement_impact", title="Retirement Impact", ord=4, body=a["retirement_impact"]),
            ReportSection(key="5_insurance_impact", title="Insurance Impact", ord=5, body=a["insurance_impact"]),
            ReportSection(key="6_fsa_hsa_optimization", title="FSA / HSA Optimization", ord=6, body=a["fsa_hsa"]),
            ReportSection(key="7_evidence", title="Evidence & Assumptions", ord=7,
                          body={"missing_documents": a["missing_documents"]},
                          evidence=[EvidenceReference(metric_name=e.get("statement", "evidence"), metric_value="", source_table=e.get("source_table", "documents.documents")) for e in a.get("evidence", [])],
                          assumptions=[AssumptionReference(text=x.get("assumption_text", str(x)), confidence=x.get("confidence")) for x in a.get("assumptions", [])]),
        ]
        charts = [ChartDefinition(key="five_year_value", type="bar", title="Five-Year Total Comp",
                                  series=[{"label": f"Yr {y['year']}", "value": y["total"]} for y in a["five_year_value"]["by_year"]],
                                  source="documents.documents")]
        return ReportDefinition(report_type="compensation", title="Compensation & Benefits Report",
                                sections=sections, charts=charts, citations=self._citations(sections),
                                confidence=a.get("confidence"), governance=a.get("boundary"),
                                metadata={"source_documents": a.get("source_documents", [])})

    async def _domain_report(self, ctx: UserContext, domain: str, title: str) -> ReportDefinition:
        svc = self._domains.get(domain)
        if not svc:
            return ReportDefinition(report_type=domain, title=title, sections=[
                ReportSection(key="unavailable", title="Not available", ord=1, body={"reason": f"{domain} not live"})
            ])
        vm: DomainViewModel = await svc.summary(ctx)
        sections = self._sections_from_vm(vm)
        charts: list[ChartDefinition] = []
        if domain == "finance" and self._trends is not None:
            sec, ch = await self._trend_section(ctx, ord_n=len(sections) + 1)
            if sec:
                sections.append(sec)
                charts += ch
        return ReportDefinition(
            report_type="financial" if domain == "finance" else domain, title=title,
            sections=sections, charts=charts, citations=self._citations(sections),
            confidence=vm.confidence.model_dump(), governance=_boundary(vm),
            metadata={"domain": domain, "missing": vm.missing},
        )

    async def _trend_section(self, ctx: UserContext, ord_n: int) -> tuple[Optional[ReportSection], list[ChartDefinition]]:
        t = await self._trends.trends(ctx)
        if not t.get("has_history"):
            return None, []
        nw = t.get("net_worth", {})
        charts = [ChartDefinition(key="net_worth_trend", type="line", title="Net Worth Over Time",
                                  series=[{"label": str(p.get("date"))[:7], "value": p.get("value")} for p in nw.get("series", [])],
                                  source="finance.net_worth_snapshots")]
        section = ReportSection(
            key="finance_trend", title="Progress Over Time", ord=ord_n,
            body={"net_worth": {k: nw.get(k) for k in ("current", "prior", "delta", "pct_change", "trend")},
                  "debt": {k: t.get("debt", {}).get(k) for k in ("current", "delta", "trend")},
                  "cash_flow": {k: t.get("cash_flow", {}).get(k) for k in ("current", "delta", "trend")},
                  "changes": t.get("change_detection", [])},
            evidence=[EvidenceReference(metric_name="net_worth_delta", metric_value=nw.get("delta"),
                                        source_table="finance.net_worth_snapshots", explanation="month-over-month change")] if nw.get("delta") is not None else [],
            charts=["net_worth_trend"],
        )
        return section, charts

    def _sections_from_vm(self, vm: DomainViewModel, *, ord_base: int = 1) -> list[ReportSection]:
        overview = ReportSection(key=f"{vm.domain}_overview", title=f"{vm.domain.capitalize()} Overview", ord=ord_base,
                                 body={k: v for k, v in vm.data.items() if not k.startswith("_")})
        recs = vm.recommendations
        rec_section = ReportSection(
            key=f"{vm.domain}_recommendations", title=f"{vm.domain.capitalize()} Recommendations", ord=ord_base + 1,
            recommendations=_rec_refs(recs),
            evidence=[e for r in recs for e in _evidence_refs(r)],
            assumptions=[AssumptionReference(text=a) for r in recs for a in (getattr(r, "assumptions", []) or [])],
        )
        return [overview, rec_section]

    async def _education_report(self, ctx: UserContext) -> ReportDefinition:
        rpt = await self._edu.build_report(ctx)  # E3 builder (9 sections + chart specs)
        sections: list[ReportSection] = []
        for i, (key, sec) in enumerate(sorted((rpt.get("sections") or {}).items()), start=1):
            ev = sec.get("evidence") if key == "9_evidence_appendix" else None
            sections.append(ReportSection(
                key=key, title=str(sec.get("title") or key), ord=i,
                body={k: v for k, v in sec.items() if k not in ("title", "evidence", "assumptions")},
                evidence=[EvidenceReference(metric_name=e.get("metric_name", "evidence"), metric_value=e.get("metric_value"),
                                            source_table=e.get("source_table", "computed"), confidence=e.get("confidence"),
                                            explanation=e.get("explanation")) for e in (ev or [])],
                assumptions=[AssumptionReference(text=a.get("assumption_text", str(a)) if isinstance(a, dict) else str(a),
                                                 confidence=(a.get("confidence") if isinstance(a, dict) else None))
                             for a in (sec.get("assumptions") or [])] if key == "9_evidence_appendix" else [],
            ))
        charts = [ChartDefinition(key=k, type=str(c.get("type", "bar")), title=k.replace("_", " ").title(),
                                  series=c.get("series", []), source=c.get("source"), spec=c)
                  for k, c in (rpt.get("charts") or {}).items()]
        return ReportDefinition(
            report_type="education", title=str(rpt.get("title") or "Education Report"),
            sections=sections, charts=charts, citations=list(rpt.get("citations") or []),
            confidence=rpt.get("confidence"), governance=rpt.get("safety"),
            metadata={"missing": rpt.get("missing", [])},
        )

    async def _decision_report(self, ctx: UserContext) -> ReportDefinition:
        rows = await self._sb.select("decisions", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, order="updated_at.desc", schema=DECISION)
        sections: list[ReportSection] = []
        charts: list[ChartDefinition] = []
        for i, d in enumerate(rows, start=1):
            sc = d.get("scenarios_json") or []
            charts.append(ChartDefinition(key=f"decision_{i}_scenarios", type="scenario", title=str(d.get("title")),
                                          series=[{"label": s.get("label"), "value": s.get("value"), "probability": s.get("probability")} for s in sc],
                                          source="decision.decisions"))
            sections.append(ReportSection(
                key=f"decision_{i}", title=str(d.get("title") or d.get("decision_type")), ord=i,
                body={"question": d.get("question"), "verdict": d.get("description"), "decision_type": d.get("decision_type"),
                      "affected_domains": d.get("affected_domains"), "scenarios": sc, "confidence": d.get("confidence")},
                evidence=[EvidenceReference(metric_name=e.get("metric_name", "evidence"), metric_value=e.get("metric_value"),
                                            source_table=e.get("source_table", "computed"), confidence=e.get("confidence"),
                                            explanation=e.get("explanation")) for e in (d.get("evidence_json") or [])],
                assumptions=[AssumptionReference(text=a.get("assumption_text", str(a)), confidence=a.get("confidence")) for a in (d.get("assumptions_json") or []) if isinstance(a, dict)],
                charts=[f"decision_{i}_scenarios"],
            ))
        if not sections:
            sections = [ReportSection(key="no_decisions", title="No decisions yet", ord=1, body={"prompt": "Ask a 'Should I…?' question to generate a decision."})]
        return ReportDefinition(report_type="decision", title="Decision Report", sections=sections, charts=charts,
                                citations=sorted({e.source_table for s in sections for e in s.evidence}),
                                governance={"boundary_type": "decision_guidance"}, metadata={"count": len(rows)})

    async def _full_report(self, ctx: UserContext) -> ReportDefinition:
        sections: list[ReportSection] = [ReportSection(key="executive_summary", title="Executive Summary", ord=0,
                                                       body={"domains_live": sorted(self._domains.keys()), "generated_for": ctx.user_id})]
        ordn = 1
        for domain, svc in sorted(self._domains.items()):
            try:
                vm = await svc.summary(ctx)
            except Exception:  # noqa: BLE001 — one domain failing never breaks the full report
                continue
            for sec in self._sections_from_vm(vm, ord_base=ordn):
                sections.append(sec)
                ordn += 1
        # fold in education + decisions
        edu = await self._education_report(ctx)
        for sec in edu.sections[:3]:  # exec/recommended/alternatives
            sec.ord = ordn
            ordn += 1
            sections.append(sec)
        dec = await self._decision_report(ctx)
        for sec in dec.sections[:5]:
            sec.ord = ordn
            ordn += 1
            sections.append(sec)
        # finance progress-over-time (if snapshot history exists)
        trend_charts: list[ChartDefinition] = []
        if self._trends is not None:
            tsec, tch = await self._trend_section(ctx, ord_n=ordn)
            if tsec:
                sections.append(tsec)
                trend_charts = tch
        return ReportDefinition(report_type="full", title="Life Report", sections=sections,
                                charts=edu.charts + dec.charts + trend_charts, citations=self._citations(sections),
                                governance={"boundary_type": "mixed", "disclaimer_text": "Decision support across domains — not financial, medical, legal, or tax advice."},
                                metadata={"domains": sorted(self._domains.keys())})

    @staticmethod
    def _citations(sections: list[ReportSection]) -> list[str]:
        return sorted({e.source_table for s in sections for e in s.evidence if e.source_table})

    def content_hash(self, definition: ReportDefinition) -> str:
        return content_hash(definition)

    # ---- store_report ----
    async def store(self, ctx: UserContext, definition: ReportDefinition) -> dict[str, Any]:
        digest = content_hash(definition)
        rid = _report_id(ctx.user_id, definition.report_type)
        existing = await self._sb.select("reports", filters={"id": f"eq.{rid}"}, limit=1, schema=REPORTING)
        prev = existing[0] if existing else None
        version = (prev.get("version", 0) + 1) if (prev and prev.get("content_hash") != digest) else (prev.get("version", 1) if prev else 1)
        definition.version = version
        row = {
            "id": rid, "user_id": ctx.user_id, "tenant_id": ctx.user_id,
            "report_type": definition.report_type, "title": definition.title, "version": version,
            "status": "generated", "content_json": definition.model_dump(), "content_hash": digest,
        }
        await self._sb.upsert("reports", row, schema=REPORTING)
        # history row only when content changed (or first time)
        if not prev or prev.get("content_hash") != digest:
            await self._sb.insert("report_versions", {
                "id": str(uuid.uuid5(_NS, f"{rid}:{version}")), "report_id": rid, "user_id": ctx.user_id,
                "tenant_id": ctx.user_id, "version": version, "content_json": definition.model_dump(), "content_hash": digest,
            }, schema=REPORTING)
        return {"report_id": rid, "version": version, "content_hash": digest}

    # ---- generate_report (build + store) ----
    async def generate(self, ctx: UserContext, report_type: str) -> dict[str, Any]:
        definition = await self.build(ctx, report_type)
        stored = await self.store(ctx, definition)
        return {**stored, "definition": definition.model_dump()}

    # ---- render_report (JSON-first; renderer is a later sprint) ----
    def render(self, definition: ReportDefinition, fmt: str = "json") -> dict[str, Any]:
        """JSON renderer — returns the definition as the renderable artifact. PDF/HTML
        renderers (later) implement the same interface over content_json."""
        return {"format": "json", "report": definition.model_dump()}


def _boundary(vm: DomainViewModel) -> Optional[dict[str, Any]]:
    sb = (vm.data or {}).get("safety_boundaries")
    return sb[0] if isinstance(sb, list) and sb else None
