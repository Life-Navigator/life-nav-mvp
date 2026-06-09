"""Recommendation Operating System (Elite Sprint 25).

One registry every module's recommendations flow into, and the single place every consumer
(dashboard, chat, prioritization, conflicts, reports) reads from — so the platform gives ONE
answer to "what should I do next?". A central collector normalizes each module's output into the
first-class recommendation schema with evidence + confidence + readiness impact; a prioritization
engine ranks them; a conflict engine flags competing actions. No recommendation lives outside here.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..models.common import UserContext

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
        rows = [r for r in rows if r.get("status") not in ("dismissed", "completed")]
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

    async def sync(self, ctx: UserContext) -> dict[str, Any]:
        written: list[str] = []
        sources: dict[str, int] = {}

        async def emit(**kw: Any) -> None:
            rid = await self.write(ctx, **kw)
            if rid:
                written.append(rid)
                sources[kw["source_module"]] = sources.get(kw["source_module"], 0) + 1

        facts = await self._facts(ctx)
        readiness = await self._readiness.assess(ctx) if self._readiness else {"domains": []}
        prog = {d["domain"]: float(d["progress"]) for d in readiness.get("domains", [])}
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
                    fin_before = round(prog.get("finance", 50))
                    fin_after = min(100, fin_before + 5)
                    await emit(rec_type="ACTION", source_module="comp_benefits", category="finance", priority="high", confidence=0.9,
                               title=f"Increase your 401(k) from {rate:.0f}% to {match:.0f}%", finding_key="retirement_contribution", finding_label="401(k) contribution rate",
                               description=f"Your employer matches up to {match:.0f}% — you're leaving ${uncaptured:,.0f}/yr on the table.",
                               current_state=f"{rate:.0f}%", target_state=f"{match:.0f}%", delta_text=f"+{match - rate:.0f}%",
                               recommended_action=f"Raise your 401(k) contribution to {match:.0f}% to capture the full employer match.",
                               quantified_impact={"readiness_before": fin_before, "readiness_after": fin_after, "readiness_delta": fin_after - fin_before,
                                                  "financial_impact_annual": uncaptured, "description": f"+${uncaptured:,.0f}/yr captured match"},
                               estimated_benefit=f"+${uncaptured:,.0f}/yr free money", estimated_effort="low", resource="savings_dollars",
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
                       evidence=[{"statement": "Income on file but no 401(k) statement", "source_table": "documents"}], impacted_domains=["finance"])

        # === 2) Life-insurance protection gap — RISK (current -> target -> delta), quantified ===
        ins = (analysis.get("insurance_impact") or {}).get("life") or {}
        coverage = _num(ins.get("coverage"))
        need = _num(ins.get("need_10x_income"))
        gap = _num(ins.get("gap"))
        if coverage is not None and need is not None and gap and gap > 0:
            fam_before = round(prog.get("family", 50))
            await emit(rec_type="RISK", source_module="family_office", category="family", priority="high", confidence=0.7,
                       title=f"Life coverage is ${gap:,.0f} below your protection target", finding_key="protection_gap", finding_label="Life-insurance protection gap",
                       description=f"If you died today, your survivors would be ${gap:,.0f} short of replacing your income.",
                       current_state=f"${coverage:,.0f}", target_state=f"${need:,.0f}", delta_text=f"+${gap:,.0f}",
                       recommended_action=f"Increase term life coverage to ${need:,.0f} (≈10× income).",
                       quantified_impact={"coverage_gap": gap, "readiness_before": fam_before, "readiness_after": min(100, fam_before + 8), "readiness_delta": 8},
                       estimated_benefit="Closes the survivor income gap", resource="insurance",
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
                           quantified_impact={"documents_missing": len(missing)}, resource="legal_time",
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
                               evidence=[{"statement": f"{m['label']} {m['value']} {m['unit']} vs reference {m['ideal']}", "source_table": "documents:lab_report"}],
                               impacted_domains=["health"], chat_visibility=True)

        # === 5) Military — only for service-connected users (endpoint gated); actionable items only ===
        if self._mil:
            try:
                mil = await self._mil.assess(ctx)
            except Exception:  # noqa: BLE001
                mil = {}
            if mil.get("is_service_connected"):
                gi = mil.get("gi_bill_readiness") or {}
                if gi.get("eligible"):
                    await emit(rec_type="OPPORTUNITY", source_module="military", category="military", priority="medium", confidence=0.6,
                               title="Apply for your Post-9/11 GI Bill education benefit",
                               description="Your honorable service likely qualifies you for up to 36 months of tuition + housing.",
                               recommended_action="Apply at va.gov/education and check Yellow Ribbon schools.",
                               quantified_impact={"note": "up to 36 months tuition + housing"}, resource="benefits_time",
                               evidence=gi.get("evidence") or [{"statement": "GI Bill eligible (honorable discharge)", "source_table": "documents:dd214"}],
                               impacted_domains=["finance", "career"])
        # NOTE: decision-confidence / counts are METRICS — deliberately NOT emitted as recommendations.

        await self._rank(ctx)
        return {"written": len(written), "by_source": sources}

    # ---- prioritization: ONE answer, via the visible formula ----
    @staticmethod
    def _score(r: dict[str, Any]) -> float:
        # Priority = Impact × Confidence × Urgency × Evidence ÷ Effort (computed at write, stored).
        f = r.get("formula") or {}
        if "priority_score" in f:
            return float(f["priority_score"])
        return float(r.get("rank_score") or 0.0)

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

    def _rankable(self, recs: list[dict]) -> tuple[list[dict], list[dict]]:
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
        recs = await self.active(ctx)
        ranked, needs_info = self._rankable(recs)
        return {"total": len(recs), "deduped_total": len(ranked),
                "top_actions": [self._shape(r) for r in ranked[:top]],
                "why_ranking": self._why_first(ranked),
                "needs_more_information": [{"id": r["id"], "title": r["title"], "rec_type": r.get("rec_type"),
                                            "why": r.get("description") or r.get("recommended_action")} for r in needs_info[:5]],
                "conflicts": self._conflicts(ranked),
                "note": "One prioritized answer for the whole platform — the dashboard, chat, reports, and graph read this same list."}

    # ---- roadmap: Now / Next / Later (an execution sequence, not a list) ----
    async def roadmap(self, ctx: UserContext) -> dict[str, Any]:
        recs = await self.active(ctx)
        ranked, needs_info = self._rankable(recs)
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
