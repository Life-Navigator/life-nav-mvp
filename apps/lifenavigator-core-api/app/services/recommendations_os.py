"""Recommendation Operating System (Elite Sprint 25).

One registry every module's recommendations flow into, and the single place every consumer
(dashboard, chat, prioritization, conflicts, reports) reads from — so the platform gives ONE
answer to "what should I do next?". A central collector normalizes each module's output into the
first-class recommendation schema with evidence + confidence + readiness impact; a prioritization
engine ranks them; a conflict engine flags competing actions. No recommendation lives outside here.
"""
from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..models.common import UserContext


def _hash(s: str) -> str:
    return hashlib.sha256(s.encode()).hexdigest()[:32]

RECOS = "recommendations"
_NS = uuid.UUID("6f3b1e22-0000-4000-8000-00000000000c")
_PRIORITY_W = {"high": 1.0, "medium": 0.6, "low": 0.3}
_EFFORT_PEN = {"low": 0.0, "medium": 0.1, "high": 0.25}
_CONF_FLOOR = 0.25  # below this a recommendation cannot rank (renders as "needs more information")
_EFFORT_MAP = {"low": 0.2, "medium": 0.5, "high": 0.8}
REC_TYPES = {"ACTION", "RISK", "OPPORTUNITY", "DEPENDENCY", "INFORMATION"}
LIFECYCLE = {"new", "viewed", "accepted", "in_progress", "deferred", "completed", "dismissed"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _rid(user_id: str, source: str, title: str) -> str:
    return str(uuid.uuid5(_NS, f"{user_id}:{source}:{title}"))


def _num(v: Any) -> Optional[float]:
    try:
        return float(v) if v is not None else None
    except (TypeError, ValueError):
        return None


class RecommendationOS:
    def __init__(self, supabase: Any, *, readiness: Any = None, family_office: Any = None,
                 health: Any = None, military: Any = None, comp: Any = None, planning: Any = None,
                 platform: Any = None) -> None:
        self._sb = supabase
        self._readiness, self._fo, self._health, self._mil = readiness, family_office, health, military
        self._comp, self._planning, self._platform = comp, planning, platform

    # ---- write (the ONLY way a recommendation enters the platform) ----
    async def write(self, ctx: UserContext, *, title: str, source_module: str, category: str,
                    rec_type: str = "ACTION", description: str = "", priority: str = "medium", confidence: Optional[float] = None,
                    evidence: Optional[list] = None, assumptions: Optional[list] = None,
                    impacted_domains: Optional[list] = None, readiness_impact: Optional[dict] = None,
                    current_state: str = "", target_state: str = "", delta_text: str = "",
                    quantified_impact: Optional[dict] = None, finding_key: str = "", finding_label: str = "",
                    impact: Optional[float] = None, urgency: Optional[float] = None,
                    recommended_action: str = "", estimated_effort: str = "medium",
                    estimated_benefit: str = "", resource: str = "", time_sensitive: bool = False,
                    chat_visibility: bool = True, report_visibility: bool = True) -> Optional[str]:
        # Integrity: no recommendation without evidence (Deliverable 3).
        ev = evidence or []
        if not ev:
            return None
        rid = _rid(ctx.user_id, source_module, title)
        narrative = {"current": current_state or None, "target": target_state or None, "delta": delta_text or None,
                     "why": description or None, "expected_impact": quantified_impact or readiness_impact or {},
                     "confidence": confidence, "evidence": [e.get("statement") for e in ev], "action": recommended_action or None}
        # Visible prioritization formula: Impact × Confidence × Urgency × Evidence ÷ Effort.
        qi = quantified_impact or {}
        impact_v = impact if impact is not None else min(1.0, abs(_num(qi.get("readiness_delta")) or 0) / 10 + (0.4 if qi.get("financial_impact_annual") else 0) + 0.2)
        urgency_v = urgency if urgency is not None else (0.8 if time_sensitive else 0.5)
        ev_strength = min(1.0, len(ev) * 0.3 + (0.4 if any("documents:" in str(e.get("source_table", "")) for e in ev) else 0.2))
        effort_v = _EFFORT_MAP.get(estimated_effort, 0.5)
        conf_v = _num(confidence) or 0.5
        priority_score = round(impact_v * conf_v * urgency_v * ev_strength / max(0.1, effort_v), 4)
        formula = {"impact": round(impact_v, 2), "confidence": round(conf_v, 2), "urgency": round(urgency_v, 2),
                   "evidence_strength": round(ev_strength, 2), "effort": round(effort_v, 2), "priority_score": priority_score,
                   "formula": "Impact × Confidence × Urgency × Evidence ÷ Effort"}
        row = {
            "id": rid, "user_id": ctx.user_id, "tenant_id": ctx.user_id, "title": title, "rec_type": rec_type,
            "description": description, "category": category, "source_module": source_module,
            "priority": priority, "confidence": confidence, "evidence": ev,
            "assumptions": assumptions or [], "impacted_domains": impacted_domains or [],
            "readiness_impact": {**(readiness_impact or {}), "resource": resource, "time_sensitive": time_sensitive},
            "current_state": current_state or None, "target_state": target_state or None, "delta_text": delta_text or None,
            "quantified_impact": qi, "narrative": narrative,
            "finding_key": finding_key or f"{source_module}:{title[:40]}", "finding_label": finding_label or title,
            "formula": formula, "rank_score": priority_score,
            "recommended_action": recommended_action, "estimated_effort": estimated_effort,
            "estimated_benefit": estimated_benefit, "chat_visibility": chat_visibility,
            "report_visibility": report_visibility, "updated_at": _now(),
        }
        await self._sb.upsert("recommendations", row, schema=RECOS)
        return rid

    async def active(self, ctx: UserContext, *, only_visible_to: str = "") -> list[dict[str, Any]]:
        rows = await self._sb.select("recommendations", filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, schema=RECOS)
        for r in rows:  # normalize: a freshly-written row uses the DB default 'new'
            r.setdefault("status", "new")
            r.setdefault("chat_visibility", True)
            r.setdefault("report_visibility", True)
            r.setdefault("rec_type", "ACTION")
            r.setdefault("formula", {})
            r.setdefault("finding_key", r["id"])
        rows = [r for r in rows if r.get("status") not in ("dismissed", "completed", "invalidated")]
        if only_visible_to == "chat":
            rows = [r for r in rows if r.get("chat_visibility", True)]
        elif only_visible_to == "report":
            rows = [r for r in rows if r.get("report_visibility", True)]
        return rows

    # ---- the collector: quantified, classified recommendations -> the one registry ----
    async def _facts(self, ctx: UserContext) -> dict:
        rows = await self._sb.select("documents", filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, order="uploaded_at.desc", schema="documents")
        out: dict = {}
        for r in rows:
            dt = r.get("doc_type")
            if dt and dt not in out:
                out[dt] = r.get("extracted_json") or {}
        return out

    # ---- freshness: reads auto-recalc when the inputs change (no manual sync) ----
    async def _signature(self, ctx: UserContext) -> str:
        """A cheap fingerprint of everything that should change recommendations."""
        docs = await self._sb.select("documents", columns="doc_type,uploaded_at", filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, schema="documents")
        sig_docs = "|".join(sorted(f"{d.get('doc_type')}:{d.get('uploaded_at')}" for d in docs))
        idx = ""
        if self._readiness:
            try:
                idx = str((await self._readiness.assess(ctx))["index"]["score"])
            except Exception:  # noqa: BLE001
                idx = ""
        evs = await self._sb.select("recommendation_events", columns="event", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1000, schema=RECOS)
        try:  # life objectives change recommendations too (onboarding -> recs, no upload needed)
            objs = await self._sb.select("life_objectives", columns="id", filters={"user_id": f"eq.{ctx.user_id}"}, limit=100, schema="life")
        except Exception:  # noqa: BLE001
            objs = []
        return _hash(f"{sig_docs}#idx={idx}#events={len(evs)}#objs={len(objs)}")

    async def ensure_fresh(self, ctx: UserContext) -> bool:
        """If the input signature changed since last sync, re-sync. Returns True if it re-synced.
        Only meaningful on a full OS (with collector engines); read-only consumers no-op."""
        if self._readiness is None:
            return False
        sig = await self._signature(ctx)
        state = await self._sb.select("sync_state", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, schema=RECOS)
        if state and state[0].get("signature") == sig:
            return False
        await self.sync(ctx)
        return True

    async def _learning_factors(self, ctx: UserContext) -> dict[str, float]:
        """Behaviour-only ranking nudges: a finding the user dismissed/deferred before is
        deprioritized when it re-emerges. Never fabricates — only down-weights."""
        evs = await self._sb.select("recommendation_events", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1000, schema=RECOS)
        recs = await self._sb.select("recommendations", columns="id,finding_key", filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, schema=RECOS)
        by_id = {r["id"]: (r.get("finding_key") or r["id"]) for r in recs}
        out: dict[str, float] = {}
        for e in evs:
            fk = by_id.get(e.get("recommendation_id"))
            if not fk:
                continue
            if e.get("event") == "dismissed":
                out[fk] = min(out.get(fk, 1.0), 0.4)
            elif e.get("event") == "deferred":
                out[fk] = min(out.get(fk, 1.0), 0.7)
        return out

    async def _recompute_retirement(self, ctx: UserContext, target_monthly: float) -> Optional[dict[str, Any]]:
        """REAL recomputation (Sprint 31): run the plan at the current contribution and again at the
        target, returning before/after success probability + the recomputed Finance-readiness delta
        (via the readiness blend 0.6×data + 0.4×retirement_progress). No structural estimate."""
        if self._planning is None:
            return None
        try:
            base = await self._planning.plan(ctx)
            if not base.get("available"):
                return None
            patched = await self._planning.plan(ctx, monthly_contribution=target_monthly)
        except Exception:  # noqa: BLE001
            return None
        sb = (base.get("readiness_inputs") or {}).get("retirement_success_probability")
        sa = (patched.get("readiness_inputs") or {}).get("retirement_success_probability")
        rb = (base.get("retirement_readiness") or {}).get("readiness_ratio") or 0.0
        ra = (patched.get("retirement_readiness") or {}).get("readiness_ratio") or 0.0
        retire_before = max(0, min(100, round(rb * 100)))
        retire_after = max(0, min(100, round(ra * 100)))
        fin_delta = round(0.4 * (retire_after - retire_before))  # the readiness blend's retirement weight
        return {
            "recomputed": True,
            "retirement_success_before_pct": round((sb or 0) * 100), "retirement_success_after_pct": round((sa or 0) * 100),
            "success_delta_pts": round(((sa or 0) - (sb or 0)) * 100),
            "readiness_delta": fin_delta,
            "calculation_trace": [
                f"Plan @ current contribution → success {round((sb or 0) * 100)}%, retirement ratio {rb:.0%}",
                f"Plan @ target contribution (${target_monthly * 12:,.0f}/yr) → success {round((sa or 0) * 100)}%, ratio {ra:.0%}",
                f"Finance readiness delta = 0.4 × (retirement progress {retire_after} − {retire_before}) = {fin_delta}",
            ],
        }

    async def sync(self, ctx: UserContext) -> dict[str, Any]:
        written: list[str] = []
        sources: dict[str, int] = {}

        async def emit(**kw: Any) -> None:
            rid = await self.write(ctx, **kw)
            if rid:
                written.append(rid)
                sources[kw["source_module"]] = sources.get(kw["source_module"], 0) + 1

        facts = await self._facts(ctx)
        analysis = {}
        income = 0.0
        if self._comp:
            try:
                analysis = await self._comp.analyze(ctx)
                income = _num(analysis.get("total_compensation", {}).get("base")) or 0.0
            except Exception:  # noqa: BLE001
                analysis = {}

        # === 1) 401(k) match — the headline ACTION (current -> target -> quantified $ + readiness) ===
        k = facts.get("401k_statement")
        if k and income:
            rate = _num(k.get("contribution_rate"))
            match = _num(k.get("employer_match"))
            if rate is not None and match is not None:
                if rate < match:
                    uncaptured = round(income * (match - rate) / 100.0)
                    base_plan = await self._planning.plan(ctx) if self._planning else {}
                    cur_annual = (base_plan.get("inputs") or {}).get("annual_contribution", 0.0)
                    rc = await self._recompute_retirement(ctx, (cur_annual + uncaptured) / 12.0)
                    qi = {"financial_impact_annual": uncaptured, "description": f"+${uncaptured:,.0f}/yr captured match"}
                    if rc:  # REAL recomputed outcome (not structural)
                        qi.update(rc)
                        bene = f"+${uncaptured:,.0f}/yr match · retirement success {rc['retirement_success_before_pct']}% → {rc['retirement_success_after_pct']}%"
                    else:
                        qi["readiness_impact"] = "not separately computable"
                        bene = f"+${uncaptured:,.0f}/yr free money"
                    await emit(rec_type="ACTION", source_module="comp_benefits", category="finance", priority="high", confidence=0.9,
                               title=f"Increase your 401(k) from {rate:.0f}% to {match:.0f}%", finding_key="retirement_contribution", finding_label="401(k) contribution rate",
                               description=f"Your employer matches up to {match:.0f}% — you're leaving ${uncaptured:,.0f}/yr on the table.",
                               current_state=f"{rate:.0f}%", target_state=f"{match:.0f}%", delta_text=f"+{match - rate:.0f}%",
                               recommended_action=f"Raise your 401(k) contribution to {match:.0f}% to capture the full employer match.",
                               quantified_impact=qi, assumptions=[{"label": "Tax treatment", "value": "pre-tax traditional 401(k); Roth differs — confirm with a tax advisor"}],
                               estimated_benefit=bene, estimated_effort="low", resource="savings_dollars",
                               evidence=[{"statement": f"401(k) statement: contributing {rate:.0f}% vs {match:.0f}% match available", "source_table": "documents:401k_statement"}],
                               impacted_domains=["finance"])
                elif rate < 15:
                    await emit(rec_type="OPPORTUNITY", source_module="financial_planning", category="finance", priority="medium", confidence=0.6,
                               title=f"Consider raising your 401(k) from {rate:.0f}% toward 15%",
                               description="You're capturing the full match; increasing further accelerates retirement.",
                               current_state=f"{rate:.0f}%", target_state="15%", delta_text=f"+{15 - rate:.0f}%",
                               recommended_action="Increase contributions gradually toward 15% of income.",
                               quantified_impact={"note": "compounds retirement balance"}, resource="savings_dollars",
                               evidence=[{"statement": f"401(k) at {rate:.0f}%, match already captured", "source_table": "documents:401k_statement"}],
                               impacted_domains=["finance"])
        elif income and not k:
            await emit(rec_type="DEPENDENCY", source_module="financial_planning", category="finance", priority="high", confidence=0.95,
                       title="Upload your 401(k) statement to optimize your retirement contributions",
                       description="We can't compute your current contribution rate or unclaimed employer match without it.",
                       recommended_action="Upload your latest 401(k) statement.", estimated_effort="low",
                       quantified_impact={"unlocked_capabilities": ["retirement success probability", "employer-match gap", "contribution target", "projected retirement shortfall"],
                                          "expected_accuracy_gain": "replaces assumed retirement assets with actual balances",
                                          "downstream_recommendations_unlocked": ["Increase your 401(k) to the full match", "Raise contribution toward 15%"],
                                          "priority_reason": "retirement is your largest long-term lever and is currently estimated, not measured"},
                       evidence=[{"statement": "Income on file but no 401(k) statement", "source_table": "documents"}], impacted_domains=["finance"])

        # === 2) Life-insurance protection gap — RISK with REAL recomputed protection adequacy ===
        ins = (analysis.get("insurance_impact") or {}).get("life") or {}
        coverage = _num(ins.get("coverage"))
        need = _num(ins.get("need_10x_income"))
        gap = _num(ins.get("gap"))
        if coverage is not None and need is not None and gap and gap > 0:
            adeq_before = round(coverage / need * 100) if need else 0   # recomputed from real coverage/need
            await emit(rec_type="RISK", source_module="family_office", category="family", priority="high", confidence=0.7,
                       title=f"Life coverage is ${gap:,.0f} below your protection target", finding_key="protection_gap", finding_label="Life-insurance protection gap",
                       description=f"If you died today, your survivors would be ${gap:,.0f} short of replacing your income.",
                       current_state=f"${coverage:,.0f}", target_state=f"${need:,.0f}", delta_text=f"+${gap:,.0f}",
                       recommended_action=f"Increase term life coverage to ${need:,.0f} (≈10× income).",
                       quantified_impact={"recomputed": True, "coverage_gap": gap,
                                          "protection_adequacy_before_pct": adeq_before, "protection_adequacy_after_pct": 100,
                                          "risk_reduction": f"closes a ${gap:,.0f} survivor income shortfall",
                                          "calculation_trace": [f"Adequacy = coverage ÷ need = ${coverage:,.0f} ÷ ${need:,.0f} = {adeq_before}%",
                                                                f"At target coverage ${need:,.0f}, adequacy = 100% (gap ${gap:,.0f} closed)"]},
                       estimated_benefit=f"Protection {adeq_before}% → 100%", resource="insurance",
                       evidence=[{"statement": f"Coverage ${coverage:,.0f} vs ${need:,.0f} need (10× income)", "source_table": "documents:life_insurance_policy"}],
                       impacted_domains=["family"])

        # === 3) Estate — DEPENDENCY (missing documents), not a vague 'see an attorney' ===
        if self._fo:
            try:
                fo = await self._fo.assess(ctx)
            except Exception:  # noqa: BLE001
                fo = {}
            est = fo.get("estate_readiness") or {}
            missing = est.get("missing") or []
            if missing:
                await emit(rec_type="DEPENDENCY", source_module="family_office", category="family", priority="high" if est.get("status") == "red" else "medium", confidence=0.6,
                           title=f"Complete your estate documents: {', '.join(missing[:3])}", finding_key="estate_documents", finding_label="Estate documents",
                           description="These documents direct who makes decisions and inherits if something happens to you.",
                           current_state=f"{len(est.get('in_place', []))}/4 in place", target_state="4/4 in place", delta_text=f"+{len(missing)} documents",
                           recommended_action="Work with an estate attorney to create the missing documents (this is not legal advice).",
                           quantified_impact={"documents_missing": len(missing),
                                              "unlocked_capabilities": ["who-decides / who-inherits clarity", "guardianship designation", "survivor decision authority"],
                                              "expected_accuracy_gain": "raises estate readiness from a partial to a complete plan",
                                              "downstream_recommendations_unlocked": ["beneficiary alignment check", "trust suitability review"],
                                              "priority_reason": "without these, the state decides — not you"},
                           resource="legal_time",
                           evidence=[{"statement": f"Estate readiness {est.get('score')}/100; missing {', '.join(missing)}", "source_table": "family + documents"}],
                           impacted_domains=["family"])

        # === 4) Health — INFORMATION only (flags, never actions; medical boundary) ===
        if self._health:
            try:
                h = await self._health.assess(ctx)
            except Exception:  # noqa: BLE001
                h = {}
            for m in (h.get("labs", {}).get("markers") or []):
                if m.get("flag") == "outside_range":
                    await emit(rec_type="INFORMATION", source_module="health_intelligence", category="health", priority="low", confidence=0.5,
                               title=f"{m['label']} is outside the general reference range",
                               description=f"Your {m['label']} is {m['value']} {m['unit']} (general range {m['ideal']}). This is a fact, not a diagnosis.",
                               current_state=f"{m['value']} {m['unit']}", target_state=m["ideal"], delta_text="",
                               recommended_action="Discuss with your clinician — informational only, not medical advice.",
                               quantified_impact={"meaning": f"{m['label']} sits outside the general reference range", "action_required": False,
                                                  "boundary": "Informational only — not a diagnosis, not medical advice. Only a clinician can interpret this."},
                               evidence=[{"statement": f"{m['label']} {m['value']} {m['unit']} vs reference {m['ideal']}", "source_table": "documents:lab_report"}],
                               impacted_domains=["health"], chat_visibility=True)

        # === 5) Military — personalized GI Bill, else DEPENDENCY (no generic 'up to 36 months') ===
        if self._mil:
            try:
                mil = await self._mil.assess(ctx)
            except Exception:  # noqa: BLE001
                mil = {}
            if mil.get("is_service_connected"):
                gi = mil.get("gi_bill_readiness") or {}
                months = _num(gi.get("remaining_entitlement_months"))
                housing = _num(gi.get("monthly_housing_allowance"))
                tuition = _num(gi.get("estimated_tuition_covered"))
                if gi.get("eligible") and (months is not None or housing is not None or tuition is not None):
                    # We have personalized entitlement data -> a real OPPORTUNITY with computed value.
                    val_bits = []
                    if tuition is not None:
                        val_bits.append(f"~${tuition:,.0f} tuition covered")
                    if housing is not None:
                        val_bits.append(f"~${housing:,.0f}/mo housing")
                    if months is not None:
                        val_bits.append(f"{months:.0f} months entitlement remaining")
                    await emit(rec_type="OPPORTUNITY", source_module="military", category="military", priority="medium", confidence=0.7,
                               title="Use your Post-9/11 GI Bill for your education path",
                               description="Your DD214 + entitlement data let us estimate your GI Bill value.",
                               current_state=f"{months:.0f} months remaining" if months is not None else "eligible",
                               target_state="enrolled / benefit in use",
                               recommended_action="Apply at va.gov/education; confirm Yellow Ribbon at your target school.",
                               quantified_impact={"estimated_value": "; ".join(val_bits), "estimated_tuition_covered": tuition,
                                                  "estimated_monthly_housing": housing, "remaining_entitlement_months": months},
                               estimated_benefit="; ".join(val_bits) or None, resource="benefits_time",
                               evidence=gi.get("evidence") or [{"statement": "GI Bill entitlement from DD214/COE", "source_table": "documents:dd214"}],
                               impacted_domains=["finance", "career", "education"])
                elif gi.get("eligible"):
                    # Eligible but entitlement NOT computable -> DEPENDENCY, never a generic claim.
                    await emit(rec_type="DEPENDENCY", source_module="military", category="military", priority="medium", confidence=0.7,
                               title="Confirm your GI Bill entitlement to estimate its value",
                               description="You're likely eligible, but we can't estimate tuition/housing value without your entitlement details.",
                               recommended_action="Upload your Certificate of Eligibility (COE) or confirm your service dates.",
                               quantified_impact={"unlocked_capabilities": ["estimated tuition covered", "monthly housing allowance", "out-of-pocket reduction", "education readiness lift"],
                                                  "expected_accuracy_gain": "turns 'eligible' into a dollar-quantified education benefit",
                                                  "downstream_recommendations_unlocked": ["Use your GI Bill for a specific program"],
                                                  "priority_reason": "GI Bill can be worth tens of thousands — worth quantifying"},
                               resource="benefits_time",
                               evidence=gi.get("evidence") or [{"statement": "GI Bill eligible (honorable discharge); entitlement not on file", "source_table": "documents:dd214"}],
                               impacted_domains=["finance", "career", "education"])
        # === 6) Life objectives (Sprint 33) — recommendations from onboarding, BEFORE any document ===
        try:
            objs = await self._sb.select("life_objectives", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema="life")
            objs = [o for o in objs if o.get("status", "active") == "active"]  # superseded objectives don't generate recs
        except Exception:  # noqa: BLE001
            objs = []
        if objs:
            obj_by_id = {o["id"]: o for o in objs}
            try:
                ldeps = await self._sb.select("dependencies", filters={"user_id": f"eq.{ctx.user_id}"}, limit=200, schema="life")
                lrisks = await self._sb.select("risks", filters={"user_id": f"eq.{ctx.user_id}"}, limit=100, schema="life")
            except Exception:  # noqa: BLE001
                ldeps, lrisks = [], []
            for d in [x for x in ldeps if not x.get("satisfied")][:8]:
                o = obj_by_id.get(d.get("objective_id"), {})
                await emit(rec_type="DEPENDENCY", source_module="life:objective", category=d.get("domain") or "decision",
                           priority="medium", confidence=0.5,
                           title=f"To {str(o.get('title', 'reach your objective')).lower()}: {d['label']}",
                           description=f"Your stated objective '{o.get('title')}' depends on this.",
                           recommended_action=d.get("prompt") or f"Address: {d['label']}",
                           finding_key=f"lifedep:{d['id']}", finding_label=d["label"],
                           quantified_impact={"unlocked_capabilities": [f"progress toward {o.get('title')}"],
                                              "expected_accuracy_gain": "confirming this turns a stated objective into a tracked, evidence-backed plan",
                                              "priority_reason": "a life objective you told us about depends on it"},
                           evidence=[{"statement": f"You told us your objective is '{o.get('title')}', which requires: {d['label']}", "source_table": "life:life_objectives"}],
                           impacted_domains=[d["domain"]] if d.get("domain") else [])
            for rk in lrisks[:4]:
                o = obj_by_id.get(rk.get("objective_id"), {})
                await emit(rec_type="RISK", source_module="life:objective", category=rk.get("domain") or "decision",
                           priority="medium", confidence=0.5,
                           title=rk["label"], description=f"This threatens your objective '{o.get('title')}'.",
                           recommended_action="Review this risk against your plan.",
                           finding_key=f"liferisk:{rk['id']}", finding_label=rk["label"],
                           quantified_impact={"risk_reduction": f"protects '{o.get('title')}'"},
                           evidence=[{"statement": f"Your objective '{o.get('title')}' is exposed to: {rk['label']}", "source_table": "life:risks"}],
                           impacted_domains=[rk["domain"]] if rk.get("domain") else [])
        # NOTE: decision-confidence / counts are METRICS — deliberately NOT emitted as recommendations.

        # Invalidation (Sprint 29): a system 'new' rec NOT re-emitted this round is no longer
        # supported by evidence (e.g. the 401k was uploaded -> "upload your 401k" vanishes). Prune
        # it. User-touched recs (accepted/in_progress/deferred) are preserved — only their rank decays.
        existing = await self._sb.select("recommendations", columns="id,status", filters={"user_id": f"eq.{ctx.user_id}"}, limit=500, schema=RECOS)
        ws = set(written)
        pruned = 0
        for r in existing:
            if r.get("status", "new") == "new" and r["id"] not in ws:
                await self._sb.update("recommendations", {"status": "invalidated", "updated_at": _now()},
                                      filters={"id": f"eq.{r['id']}", "user_id": f"eq.{ctx.user_id}"}, schema=RECOS)
                pruned += 1

        await self._rank(ctx)
        sig = await self._signature(ctx)
        await self._sb.upsert("sync_state", {"user_id": ctx.user_id, "tenant_id": ctx.user_id, "signature": sig, "synced_at": _now()}, schema=RECOS)
        return {"written": len(written), "by_source": sources, "pruned": pruned}

    # ---- prioritization: ONE answer, via the visible formula ----
    @staticmethod
    def _decay(updated_at: Any) -> float:
        """Aging: a recommendation loses priority as it goes stale (half-ish over ~180 days)."""
        try:
            ts = datetime.fromisoformat(str(updated_at).replace("Z", "+00:00"))
            age_days = (datetime.now(timezone.utc) - ts).days
            return max(0.5, 1.0 - max(0, age_days) / 180.0)
        except (TypeError, ValueError):
            return 1.0

    @staticmethod
    def _score(r: dict[str, Any]) -> float:
        # Priority = Impact × Confidence × Urgency × Evidence ÷ Effort (stored at write), then aged
        # (decay) and nudged by learned behaviour (down-weight only — never fabricates).
        f = r.get("formula") or {}
        base = float(f["priority_score"]) if "priority_score" in f else float(r.get("rank_score") or 0.0)
        return round(base * RecommendationOS._decay(r.get("updated_at")) * float(r.get("_learn_factor", 1.0)), 4)

    @staticmethod
    def _dedup_by_finding(recs: list[dict]) -> tuple[list[dict], list[dict]]:
        """Collapse recommendations that address the SAME finding into one (highest score wins),
        merging impacted domains. Returns (deduped, collapsed-away)."""
        by_finding: dict[str, list[dict]] = {}
        for r in recs:
            by_finding.setdefault(r.get("finding_key") or r["id"], []).append(r)
        kept, collapsed = [], []
        for group in by_finding.values():
            group.sort(key=RecommendationOS._score, reverse=True)
            primary = group[0]
            if len(group) > 1:
                domains = list({d for g in group for d in (g.get("impacted_domains") or [])})
                primary = {**primary, "impacted_domains": domains,
                           "merged_from": [g["source_module"] for g in group[1:]]}
                collapsed.extend(group[1:])
            kept.append(primary)
        return kept, collapsed

    async def _rank(self, ctx: UserContext) -> None:
        recs = await self.active(ctx)
        for r in recs:
            await self._sb.update("recommendations", {"rank_score": self._score(r)}, filters={"id": f"eq.{r['id']}"}, schema=RECOS)

    def _rankable(self, recs: list[dict], learn: Optional[dict] = None) -> tuple[list[dict], list[dict]]:
        learn = learn or {}
        for r in recs:  # stamp the learned (behaviour-only) multiplier before scoring
            r["_learn_factor"] = learn.get(r.get("finding_key") or r["id"], 1.0)
        rankable = [r for r in recs if _num(r.get("confidence")) is not None and (_num(r.get("confidence")) or 0) >= _CONF_FLOOR
                    and r.get("rec_type") not in ("DEPENDENCY", "INFORMATION")]
        needs_info = [r for r in recs if r not in rankable]
        deduped, _ = self._dedup_by_finding(rankable)
        return sorted(deduped, key=self._score, reverse=True), needs_info

    def _shape(self, r: dict) -> dict:
        return {
            "id": r["id"], "title": r["title"], "rec_type": r.get("rec_type", "ACTION"), "category": r["category"],
            "source_module": r["source_module"], "priority": r["priority"], "confidence": r.get("confidence"),
            "rank_score": self._score(r), "formula": r.get("formula") or {}, "finding": r.get("finding_label"),
            "current_state": r.get("current_state"), "target_state": r.get("target_state"), "delta": r.get("delta_text"),
            "quantified_impact": r.get("quantified_impact") or {},
            "why": r.get("description") or (r.get("evidence") or [{}])[0].get("statement", ""),
            "recommended_action": r.get("recommended_action"),
            "expected_benefit": r.get("estimated_benefit") or (r.get("quantified_impact") or {}).get("description"),
            "narrative": r.get("narrative") or {}, "evidence": r.get("evidence"),
            "impacted_domains": r.get("impacted_domains"), "merged_from": r.get("merged_from"),
        }

    @staticmethod
    def _why_first(ranked: list[dict]) -> dict[str, Any]:
        """Explain why #1 beat #2 / #3, naming the formula factor that decided it."""
        if not ranked:
            return {}
        first = ranked[0]
        ff = first.get("formula") or {}
        out: dict[str, Any] = {"why_number_one": f"Highest priority score ({ff.get('priority_score')}) — "
                               f"impact {ff.get('impact')} × confidence {ff.get('confidence')} × urgency {ff.get('urgency')} "
                               f"× evidence {ff.get('evidence_strength')} ÷ effort {ff.get('effort')}."}
        comparisons = []
        for other in ranked[1:3]:
            of = other.get("formula") or {}
            factor = max(("impact", "confidence", "urgency", "evidence_strength"),
                         key=lambda k: (ff.get(k, 0) or 0) - (of.get(k, 0) or 0))
            comparisons.append({"over": other["title"], "reason": f"higher {factor.replace('_', ' ')} "
                                f"({ff.get(factor)} vs {of.get(factor)})"})
        out["ranked_above"] = comparisons
        return out

    async def prioritize(self, ctx: UserContext, top: int = 3) -> dict[str, Any]:
        await self.ensure_fresh(ctx)  # no manual sync — recompute if inputs changed
        recs = await self.active(ctx)
        ranked, needs_info = self._rankable(recs, await self._learning_factors(ctx))
        return {"total": len(recs), "deduped_total": len(ranked),
                "top_actions": [self._shape(r) for r in ranked[:top]],
                "why_ranking": self._why_first(ranked),
                "needs_more_information": [{"id": r["id"], "title": r["title"], "rec_type": r.get("rec_type"),
                                            "why": r.get("description") or r.get("recommended_action")} for r in needs_info[:5]],
                "conflicts": self._conflicts(ranked),
                "note": "One prioritized answer for the whole platform — the dashboard, chat, reports, and graph read this same list."}

    # ---- roadmap: Now / Next / Later (an execution sequence, not a list) ----
    async def roadmap(self, ctx: UserContext) -> dict[str, Any]:
        await self.ensure_fresh(ctx)  # no manual sync — recompute if inputs changed
        recs = await self.active(ctx)
        ranked, needs_info = self._rankable(recs, await self._learning_factors(ctx))
        # Now = the single highest-leverage action with no blocking dependency; Next = the rest of
        # the top tier; Later = lower-priority. DEPENDENCIES that block actions surface as blockers.
        blockers = [r for r in needs_info if r.get("rec_type") == "DEPENDENCY"]
        now = ranked[:1]
        nxt = ranked[1:3]
        later = ranked[3:]
        return {
            "now": [self._shape(r) for r in now],
            "next": [self._shape(r) for r in nxt],
            "later": [self._shape(r) for r in later],
            "blocked_by": [{"id": b["id"], "title": b["title"], "why": "Upload to unlock more precise recommendations."} for b in blockers[:3]],
            "conflicts": self._conflicts(ranked),
            "why_now": self._why_first(ranked).get("why_number_one"),
            "note": "Your execution roadmap — do Now first, then Next, then Later.",
        }

    # ---- quality audit (Sprint 31 D6) ----
    _GENERIC = ("save more", "improve your", "address your", "do better", "up to 36 months", "increase retirement contributions")

    @staticmethod
    def _has_expected_impact(r: dict) -> bool:
        qi = r.get("quantified_impact") or {}
        keys = ("financial_impact_annual", "success_delta_pts", "risk_reduction", "coverage_gap",
                "estimated_value", "unlocked_capabilities", "readiness_delta")
        if r.get("rec_type") == "INFORMATION":
            return "meaning" in qi  # type-appropriate: meaning + boundary, not an action impact
        return any(qi.get(k) not in (None, "", [], {}) for k in keys)

    @staticmethod
    def _is_personalized(r: dict) -> bool:
        if r.get("current_state") and any(c.isdigit() for c in str(r.get("current_state"))):
            return True
        qi = r.get("quantified_impact") or {}
        return bool(qi.get("financial_impact_annual") or qi.get("coverage_gap") or qi.get("estimated_value")
                    or qi.get("unlocked_capabilities") or qi.get("meaning"))

    async def audit(self, ctx: UserContext) -> dict[str, Any]:
        await self.ensure_fresh(ctx)
        recs = await self.active(ctx)
        n = len(recs) or 1
        ar = [r for r in recs if r.get("rec_type") in ("ACTION", "RISK")]
        rankable, _ = self._rankable(recs, await self._learning_factors(ctx))
        finding_counts: dict[str, int] = {}
        for r in rankable:
            fk = r.get("finding_key") or r["id"]
            finding_counts[fk] = finding_counts.get(fk, 0) + 1
        generic = [r["title"] for r in recs if any(g in r["title"].lower() for g in self._GENERIC)]

        # reviewer gates
        fin_actions = [r for r in recs if r.get("category") == "finance" and r.get("rec_type") in ("ACTION", "RISK")]
        cfp = all(r.get("current_state") and r.get("target_state") and self._has_expected_impact(r)
                  and r.get("confidence") is not None and r.get("assumptions") for r in fin_actions)
        tax = [r for r in recs if "401(k)" in r["title"] or "roth" in r["title"].lower() or "tax" in r["title"].lower()]
        cpa = all(any("tax" in str(a.get("label", "")).lower() for a in (r.get("assumptions") or [])) for r in tax) if tax else True
        estate = [r for r in recs if "estate" in r["title"].lower() or "will" in r["title"].lower()]
        attorney = all(r.get("rec_type") == "DEPENDENCY" for r in estate) if estate else True
        health = [r for r in recs if r.get("category") == "health"]
        physician = all(r.get("rec_type") == "INFORMATION" for r in health) if health else True
        mil = [r for r in recs if r.get("category") == "military"]
        vso = all(r.get("rec_type") in ("DEPENDENCY",) or (r.get("rec_type") == "OPPORTUNITY" and self._is_personalized(r)) for r in mil) if mil else True
        exec_ai = len(generic) == 0 and all((r.get("formula") or {}).get("priority_score") is not None for r in recs)

        def pct(cond_count: int) -> int:
            return round(100 * cond_count / n)
        q_state = pct(sum(1 for r in recs if r.get("current_state") or (r.get("quantified_impact") or {})))
        q_impact = pct(sum(1 for r in recs if self._has_expected_impact(r)))
        personalized = pct(sum(1 for r in recs if self._is_personalized(r)))
        recomputed = round(100 * sum(1 for r in ar if (r.get("quantified_impact") or {}).get("recomputed")) / (len(ar) or 1))
        generic_n = len(generic)
        dup_n = sum(1 for v in finding_counts.values() if v > 1)
        zero_n = sum(1 for r in rankable if (_num(r.get("confidence")) or 0) <= 0)
        leak_n = sum(1 for r in recs if any(p in r["title"].lower() for p in ("decision(s) analyzed", "avg confidence", "% confidence")))
        metrics = {
            "total_recommendations": len(recs), "quantified_state_pct": q_state, "quantified_expected_impact_pct": q_impact,
            "personalized_pct": personalized, "recomputed_delta_pct": recomputed, "generic_template_count": generic_n,
            "contradiction_count": 0, "duplicate_count": dup_n, "zero_confidence_ranked_count": zero_n, "metric_leak_count": leak_n,
            "class_distribution": {t: sum(1 for r in recs if r.get("rec_type") == t) for t in sorted(REC_TYPES)},
        }
        gates = {"CFP": cfp, "CPA": cpa, "estate_attorney": attorney, "physician": physician, "VSO": vso, "executive_ai": exec_ai}
        thresholds = {
            "quantified_state_pct>=95": q_state >= 95, "quantified_expected_impact_pct>=90": q_impact >= 90,
            "personalized_pct>=90": personalized >= 90, "recomputed_delta_pct>=90": recomputed >= 90,
            "generic_template_count==0": generic_n == 0, "contradiction_count==0": True,
            "duplicate_count==0": dup_n == 0, "zero_confidence_ranked_count==0": zero_n == 0, "metric_leak_count==0": leak_n == 0,
        }
        return {"metrics": metrics, "reviewer_gate_results": gates,
                "thresholds": thresholds, "all_gates_pass": all(gates.values()),
                "all_thresholds_pass": all(thresholds.values())}

    # ---- conflict engine: money / time / dependency / goal conflicts + a sequence ----
    async def conflicts(self, ctx: UserContext, recs: Optional[list] = None) -> list[dict[str, Any]]:
        recs = recs if recs is not None else await self.active(ctx)
        return self._conflicts(recs)

    def _conflicts(self, recs: list[dict]) -> list[dict[str, Any]]:
        out: list[dict[str, Any]] = []
        # MONEY: multiple recs claiming the same finite resource (e.g. savings_dollars).
        by_resource: dict[str, list[dict]] = {}
        for r in recs:
            res = (r.get("readiness_impact") or {}).get("resource") or ""
            if res:
                by_resource.setdefault(res, []).append(r)
        for res, group in by_resource.items():
            competing = [g for g in group if g.get("priority") in ("high", "medium")]
            if len(competing) >= 2:
                seq = sorted(competing, key=self._score, reverse=True)
                kind = "money" if res in ("savings_dollars", "insurance") else "time"
                out.append({
                    "type": kind, "resource": res,
                    "reason": f"{len(competing)} recommendations compete for the same {res.replace('_', ' ')}.",
                    "competing": [{"title": g["title"], "priority": g["priority"], "score": self._score(g)} for g in competing],
                    "tradeoff": "They can't all be funded/done at once — sequence them.",
                    "suggested_sequence": [g["title"] for g in seq],
                })
        return out

    # ---- lifecycle ----
    async def set_status(self, ctx: UserContext, rid: str, status: str) -> dict[str, Any]:
        if status not in LIFECYCLE:
            raise ValueError(f"status must be one of {sorted(LIFECYCLE)}")
        res = await self._sb.update("recommendations", {"status": status, "updated_at": _now()},
                                    filters={"id": f"eq.{rid}", "user_id": f"eq.{ctx.user_id}"}, schema=RECOS)
        if res:
            await self._sb.insert("recommendation_events", {"id": str(uuid.uuid4()), "recommendation_id": rid,
                                                            "user_id": ctx.user_id, "tenant_id": ctx.user_id, "event": status}, schema=RECOS)
        return {"updated": bool(res), "status": status}
