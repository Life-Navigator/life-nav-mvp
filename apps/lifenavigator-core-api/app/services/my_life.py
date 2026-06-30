"""My Life — the flagship Life-OS aggregator (Elite Sprint 44).

One call assembles the six sections of the user's life operating system from the canonical model:
Life Vision, What Matters Most, Life Readiness, Next Best Action, Constraints, and Recent
Intelligence — each tagged with its source (Advisor Discovery / Life Graph / Deterministic tool /
Recommendation OS) so the platform explains where everything came from. No new intelligence — it
composes what already exists into one coherent destination.
"""
from __future__ import annotations

import asyncio
from typing import Any, Optional

from ..models.common import UserContext
from .life_discovery import GENERIC_DEPENDENCY_LABELS, GENERIC_RISK_OPP_LABELS, life_brief


class MyLifeService:
    def __init__(self, life: Any, readiness: Any, reco_os: Any, supabase: Any, resolver: Any = None) -> None:
        self._life = life
        self._readiness = readiness
        self._os = reco_os
        self._sb = supabase
        self._resolver = resolver

    async def canonical_goals(self, ctx: UserContext) -> dict[str, Any]:
        """One deduped, source-prioritized goal view across all goal stores (read-path join).
        Honest empty state when nothing is grounded — never backfills fake goals."""
        from .canonical_goals import CanonicalGoalsService
        goals = await CanonicalGoalsService(self._life, self._sb).canonical_goals(ctx)
        return {"goals": goals, "count": len(goals),
                "empty_message": None if goals else "Arcana is still learning your goals.",
                "source": "Canonical goal read-path (deduped across stores)"}

    async def attention(self, ctx: UserContext) -> dict[str, Any]:
        """The DISCIPLINED dashboard feed: exactly one next best action + up to 3 'needs your
        attention' alerts (urgent recs, missing inputs, incomplete discovery, document issues) — the
        full list lives on /dashboard/recommendations. Same canonical source as everything else."""
        ml = await self.my_life(ctx)
        next_action = ml.get("next_best_action")
        alerts: list[dict[str, Any]] = []

        # urgent risk recommendations (severity high). NOTE: active() returns a LIST of rec rows, and the
        # type field is `rec_type` (not `classification`) — the prior `.get("recommendations")`/`classification`
        # combo raised AttributeError that the except swallowed, so RISK alerts silently never surfaced.
        try:
            active = await self._os.active(ctx)
            for r in (active or []):
                if str(r.get("rec_type") or "").upper() == "RISK" and r.get("title"):
                    alerts.append({"title": r.get("title"), "severity": "high", "source": "Recommendation OS",
                                   "detail": r.get("description") or r.get("recommended_action"), "cta": "/dashboard/recommendations"})
        except Exception:  # noqa: BLE001
            pass

        # missing financial inputs (severity medium) — only the high-leverage ones
        if self._resolver is not None:
            try:
                res = await self._resolver.resolve(ctx)
                for m in (res.get("missing") or []):
                    unlocks = m.get("unlocks") or []
                    if unlocks:
                        alerts.append({"title": f"Missing {m['input'].replace('_', ' ')}", "severity": "medium",
                                       "source": "Financial resolver", "detail": f"Affects {', '.join(unlocks[:2])}",
                                       "cta": "/dashboard/finance/retirement"})
            except Exception:  # noqa: BLE001
                pass

        # incomplete discovery (severity low)
        try:
            health = await self._life.discovery_health(ctx)
            for area in (health.get("missing_areas") or []):
                alerts.append({"title": f"Complete {area} discovery", "severity": "low", "source": "Discovery health",
                               "detail": "Sharpens your plan + unlocks more recommendations.", "cta": "/dashboard/advisor"})
        except Exception:  # noqa: BLE001
            pass

        # document issues (severity medium)
        try:
            docs = await self._sb.select("documents", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema="documents")
            for d in docs:
                if d.get("status") == "needs_review":
                    alerts.append({"title": f"Document needs attention: {d.get('title') or d.get('doc_type')}",
                                   "severity": "medium", "source": "Documents", "detail": d.get("status_reason") or "Upload a digital PDF or paste the text.",
                                   "cta": "/dashboard/documents"})
        except Exception:  # noqa: BLE001
            pass

        rank = {"high": 0, "medium": 1, "low": 2}
        alerts.sort(key=lambda a: rank.get(a["severity"], 3))
        return {"next_best_action": next_action, "alerts": alerts[:3], "alert_count": len(alerts),
                "view_all": "/dashboard/recommendations", "life_vision": ml["life_vision"]}

    async def my_life(self, ctx: UserContext) -> dict[str, Any]:
        # All six top-level reads take only ctx and are INDEPENDENT — fetch them concurrently instead of
        # serially (the residual /my-life latency). snapshot + recent_intelligence stay un-wrapped (a
        # failure fails the endpoint, as before); the rest keep their existing fallbacks. Identical values
        # + error behavior — pure latency win.
        from .canonical_goals import CanonicalGoalsService

        async def _opt(coro: Any, fallback: Any) -> Any:
            try:
                return await coro
            except Exception:  # noqa: BLE001
                return fallback

        snap, health, pri, r_assess, recent, canonical = await asyncio.gather(
            self._life.snapshot(ctx),
            _opt(self._life.discovery_health(ctx), {}),
            _opt(self._os.prioritize(ctx, top=6), {}),
            _opt(self._readiness.assess(ctx), None),
            self._recent_intelligence(ctx),
            _opt(CanonicalGoalsService(self._life, self._sb).canonical_goals(ctx), []),
        )
        po = snap.get("primary_objective") or {}

        # Grounded risks/opportunities ONLY (Dashboard Trust Fix). Source from the recommendation engine
        # (evidence-backed) — archetype objective-template labels (GENERIC_RISK_OPP_LABELS) are NOT surfaced
        # as personalized dashboard risks/opps without real grounding. They still live in the Life Graph.
        ranked: list[dict[str, Any]] = (pri or {}).get("top_actions") or []

        def _typ(x: dict[str, Any]) -> str:
            return str(x.get("rec_type") or x.get("classification") or "").upper()

        grounded_risks = [x["title"] for x in ranked if _typ(x) == "RISK" and x.get("title")]
        grounded_opps = [x["title"] for x in ranked if _typ(x) == "OPPORTUNITY" and x.get("title")]
        # Keep any genuinely user-specific (non-archetype) snapshot risks/opps; drop the generic templates.
        extra_risks = [r for r in (snap.get("top_risks") or []) if str(r).strip().lower() not in GENERIC_RISK_OPP_LABELS]
        extra_opps = [o for o in (snap.get("top_opportunities") or []) if str(o).strip().lower() not in GENERIC_RISK_OPP_LABELS]
        risks_out = list(dict.fromkeys([*grounded_risks, *extra_risks]))[:5]
        opps_out = list(dict.fromkeys([*grounded_opps, *extra_opps]))[:5]

        # Section 1 — Life Vision (the north star). Only a USER-AUTHORED, high-confidence vision is treated
        # as a confirmed north star; otherwise the model is "still forming" and the objective is inferred.
        discovery_pct = round((health.get("model_quality") or 0) * 100)
        obj_conf_pct = round((po.get("confidence") or 0) * 100)
        authored = bool(snap.get("vision_authored"))
        vision_confirmed = authored and obj_conf_pct >= 60 and discovery_pct >= 40
        # Provenance (User Truth Model): confirmed > stated > inferred > assumed. The objective is an
        # advisor INFERENCE until the user authors/confirms a high-confidence vision.
        if vision_confirmed:
            prov_type, prov_source = "user_confirmed", "Advisor Discovery"
        elif authored:
            prov_type, prov_source = "user_stated", "Advisor Discovery"
        elif po.get("title"):
            prov_type, prov_source = "advisor_inferred", "Inferred from onboarding"
        else:
            prov_type, prov_source = "assumption", "Not yet established"
        vision = {
            "life_vision": snap.get("life_vision"),
            "vision_authored": authored,
            "vision_confirmed": vision_confirmed,
            "primary_objective": po.get("title"),
            "objective_inferred": bool(po.get("title")) and not authored,
            "confidence_pct": obj_conf_pct,
            "discovery_completion_pct": discovery_pct,
            "source": prov_source,
            # Per-item provenance the UI surfaces (where it came from / type / confidence / when).
            "provenance": {
                "provenance_type": prov_type,
                "source": prov_source,
                "confidence": (po.get("confidence") if po.get("confidence") is not None else None),
                "updated_at": po.get("updated_at"),
            },
        }

        # Section 2 — What Matters Most (grounded risks/opportunities only). depends_on also drops
        # archetype dependency labels (legacy rows) — objectives no longer create them.
        what_matters = {
            "primary_objective": po.get("title"),
            "reasoning": po.get("reasoning"),
            "depends_on": [d["label"] for d in snap.get("open_dependencies", [])
                           if str(d.get("label", "")).strip().lower() not in GENERIC_DEPENDENCY_LABELS],
            "risks": risks_out,
            "constraints": [c["label"] for c in snap.get("active_constraints", [])],
            "opportunities": opps_out,
            "supporting_objectives": [o["title"] for o in snap.get("objectives", [])[1:]],
            "source": "Recommendation OS + Advisor Discovery",
        }

        # Section 3 — Life Readiness snapshot (cross-domain; missing surfaced honestly). r_assess is
        # prefetched above (None if the assess() call failed — same fallback as the prior try/except).
        if r_assess:
            domains = [{"domain": d["domain"], "progress": d["progress"], "status": d["status"],
                        "gap": d.get("gap")} for d in r_assess.get("domains", [])]
            readiness = {"overall": r_assess["index"]["score"], "status": r_assess["index"]["status"],
                         "domains": domains, "source": "Life Readiness Engine"}
        else:
            readiness = {"overall": None, "domains": [], "source": "Life Readiness Engine"}

        # Section 4 — Next Best Action OR Highest Priority Issue (P4). Prefer the top ACTION/OPPORTUNITY
        # (something the user can DO). If only RISK/DEPENDENCY recs exist, reframe as the highest-priority
        # issue. If NOTHING is grounded, say so honestly + list the inputs needed — never invent an issue.
        action = next((x for x in ranked if _typ(x) in ("ACTION", "OPPORTUNITY")), None)
        if action:
            next_action = {"kind": "action", "label": "Your next best action", "title": action["title"],
                           "why": action.get("why"), "recommended_action": action.get("recommended_action"),
                           "expected_benefit": action.get("expected_benefit"), "confidence_pct": round((action.get("confidence") or 0) * 100),
                           "quantified_impact": action.get("quantified_impact"), "rec_type": action.get("rec_type", "ACTION"),
                           "source": "Recommendation OS"}
        elif ranked:
            issue = ranked[0]
            next_action = {"kind": "priority_issue", "label": "Highest priority issue", "title": issue["title"],
                           "why": issue.get("why"), "priority": "high", "rec_type": issue.get("rec_type", "RISK"),
                           "needed_to_act": "Add your income, savings rate, and retirement details so we can turn this into a concrete recommendation.",
                           "confidence_pct": round((issue.get("confidence") or 0) * 100), "source": "Recommendation OS"}
        else:
            # No grounded Recommendation-OS action yet — but DO NOT say "not enough information" if the platform
            # already knows the user's foundation. When family-foundation goals (wedding / home / family) and
            # finance facts both exist, the genuine highest-priority move is the financial SEQUENCING decision.
            next_action = self._financial_sequencing_move(canonical, readiness) or {
                "kind": "insufficient", "label": "Highest priority issue",
                "title": "Not enough information to identify a highest-priority issue yet.",
                "needed_to_act": "Add income, savings rate, major debts, retirement target, and family obligations so LifeNavigator can identify your highest-priority issue.",
                "source": "Recommendation OS"}

        # Section 5 — Current Constraints (what's blocking progress)
        constraints = [{"label": c["label"], "detail": c.get("detail"), "source": "Advisor Discovery"}
                       for c in snap.get("active_constraints", [])]
        for d in (readiness.get("domains") or []):
            if d.get("status") in ("red", "orange") and d.get("gap") and "On track" not in str(d.get("gap")):
                constraints.append({"label": d["gap"], "detail": f"{d['domain'].capitalize()} readiness {d['progress']}%", "source": "Life Readiness Engine"})
        # FACT-GATE the "Missing X discovery" blockers: a domain that already has facts (readiness floored ≥30
        # by the shared domain_summary) must NEVER show "Missing career/family discovery" — that contradicts the
        # dashboard cards. Only surface a discovery gap for domains the platform genuinely knows nothing about.
        domains_with_facts = {str(d.get("domain")) for d in (readiness.get("domains") or []) if int(d.get("progress") or 0) >= 30}
        _AREA_DOMAIN = [("financ", "finance"), ("family", "family"), ("career", "career"), ("health", "health"), ("edu", "education")]
        for area in (health.get("missing_areas") or []):
            dom = next((d for frag, d in _AREA_DOMAIN if frag in str(area).lower()), None)
            if dom and dom in domains_with_facts:
                continue  # the platform already has facts for this domain — not a discovery gap
            constraints.append({"label": f"Missing {area} discovery", "detail": "Completing this sharpens your plan.", "source": "Discovery health"})

        # Section 6 — Recent Intelligence (the platform feels alive) — prefetched in the gather above.

        # Life Brief — the narrative the user reads first ("this understands me"). Pure surfacing of the
        # already-computed Life Model (snapshot narrative + goals + grounded risk + Recommendation OS action).
        brief = life_brief(snap, next_action=next_action, readiness=readiness)

        # Canonical goals — ONE deduped goal view across all four goal stores (read-path join), prefetched
        # in the gather above. The dashboard/report reads THIS, never a single raw store, so users never
        # see duplicate goals.

        # ── Canonical Rendering Contract (Data Flow & Rendering Integrity) ──────────────────────────
        # Surface what discovery ALREADY understands but never exposed on this aggregate — uniformly,
        # with honest residuals. NO new intelligence: pure read/compose of the snapshot. No fabrication.
        narrative = snap.get("dominant_narrative") or {}
        narrative_summary = narrative.get("summary")
        # Motivations: discovery never writes life.motivations rows (documented residual). The motivational
        # signal IS already captured as emotional_signals on the narrative — surface THAT as motivations
        # rather than building a new extractor. Each is labeled inferred-from-discovery (never a confirmed fact).
        emotional = list(snap.get("emotional_signals") or [])
        motivations = self._motivations_from_signals(emotional)
        # Timeline: pass-through ONLY — discovery stores time_horizon as free text + goal status (active/
        # future_goal). We DO NOT parse or fabricate dates. Surface the raw horizon text + any future-tagged
        # goals so the UI can render "what the user said" without us inventing a structured schedule.
        timeline = await self._timeline_passthrough(ctx, snap)
        # Coverage / missing_context: which discovery areas are still empty — honest, from discovery_health.
        coverage = {
            "model_quality_pct": discovery_pct,
            "covered_areas": health.get("covered_areas") or [],
            "missing_areas": health.get("missing_areas") or [],
            "average_confidence": health.get("average_confidence"),
            "source": "Discovery health",
        }
        missing_context = [
            {"area": area, "why_it_matters": "Completing this sharpens your plan and unlocks recommendations.",
             "cta": "/dashboard/advisor"}
            for area in (health.get("missing_areas") or [])
        ]

        return {
            "life_brief": brief,
            "canonical_goals": canonical,
            # "Why Arcana believes this" — explainability for the dominant narrative (None until one exists).
            "narrative_explanation": snap.get("narrative_explanation"),
            # Canonical narrative fields surfaced uniformly (the UI no longer has to reach into life_brief).
            "dominant_narrative": narrative or None,
            "narrative_summary": narrative_summary,
            "life_vision": vision, "what_matters_most": what_matters, "life_readiness": readiness,
            "next_best_action": next_action, "constraints": constraints[:6], "recent_intelligence": recent,
            # Understood-but-previously-unexposed blocks (honest residuals; inferred stays inferred).
            "goal_portfolio": snap.get("goal_portfolio") or [],
            "motivations": motivations,
            "emotional_signals": emotional,
            "timeline": timeline,
            "coverage": coverage,
            "missing_context": missing_context,
            "has_discovery": bool(snap.get("objectives")),
            "note": "Your life operating system — organized around your life, not our architecture.",
        }

    # Human phrasing for the deterministic emotional signals (mirrors life_discovery._SIGNAL_PHRASES but
    # framed as a motivation/driver). Surfacing-only: these are INFERRED from how the user spoke, never
    # presented as confirmed facts. Signals with no clear motivational reading are omitted (honest).
    _MOTIVATION_PHRASES: dict[str, str] = {
        "distress": "Relieving the pressure you're under right now",
        "money_stress": "Easing financial strain",
        "burnout": "Protecting your health and time after a stretch of overwork",
        "money_fine": "Building on a stable financial base",
        "ambition": "A strong drive to advance and achieve",
        "family": "Providing for and being present with your family",
        "legacy": "Building something lasting and meaningful",
        "urgency": "Acting on a near-term deadline",
    }

    def _financial_sequencing_move(self, canonical: Any, readiness: dict[str, Any]) -> Optional[dict[str, Any]]:
        """When the platform already knows a family-foundation plan (wedding / first home / starting a family)
        AND finance facts exist, the real highest-priority move is the financial ORDER OF OPERATIONS — not a
        generic "add your income" prompt and certainly not "not enough information". Grounded in the user's own
        captured goals + the finance readiness signal; returns None if those preconditions aren't met."""
        goals = canonical.get("goals") if isinstance(canonical, dict) else (canonical or [])
        texts = " ".join(
            str(g.get("goal_text") or g.get("title") or g.get("goal") or "").lower()
            for g in (goals or []) if isinstance(g, dict)
        )
        domains = {str(g.get("domain") or "").lower() for g in (goals or []) if isinstance(g, dict)}
        foundation = any(k in texts for k in (
            "wedding", "married", "marriage", "home", "house", "down payment", "down-payment",
            "first home", "family", "child", "baby", "kids",
        )) or bool({"family", "finance"} & domains)
        fin = next((d for d in (readiness.get("domains") or []) if d.get("domain") == "finance"), None)
        finance_known = bool(fin and int(fin.get("progress") or 0) >= 30)
        if not (foundation and finance_known):
            return None
        return {
            "kind": "action", "label": "Your next best move",
            "title": "Define the financial foundation for the next 12 months.",
            "why": ("You have a clear family-foundation plan: wedding, first-home down payment, and starting a "
                    "family. The next decision is the financial order of operations — emergency reserve, "
                    "wedding/honeymoon budget, down-payment target, and a monthly savings target."),
            "recommended_action": ("Set your emergency fund target, wedding/honeymoon budget, down-payment "
                                   "target, and monthly savings goal."),
            "expected_benefit": "A clear, sequenced plan that turns your goals into monthly targets.",
            "rec_type": "ACTION", "confidence_pct": 75,
            "source": "Life Model (your captured goals + finance facts)",
        }

    def _motivations_from_signals(self, signals: list[str]) -> list[dict[str, Any]]:
        """Expose the already-computed emotional_signals as motivations (inferred), rather than building a
        new extractor or reading the never-written life.motivations table. Honest provenance + no fabrication."""
        out: list[dict[str, Any]] = []
        for s in signals:
            phrase = self._MOTIVATION_PHRASES.get(s)
            if phrase:
                out.append({"text": phrase, "signal": s, "provenance_type": "advisor_inferred",
                            "source": "Inferred from how you described things (emotional signals)"})
        return out

    async def _timeline_passthrough(self, ctx: UserContext, snap: dict[str, Any]) -> dict[str, Any]:
        """Pass-through timeline view — NO date parsing, NO fabrication. Surfaces the free-text time_horizon
        the user gave + any goals discovery tagged future_goal. The UI renders what the user said; we never
        invent a structured schedule (documented residual gap)."""
        horizon_text = None
        try:
            vis = await self._sb.select("life_vision", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, schema="life")
            if vis:
                horizon_text = (vis[0].get("prompts") or {}).get("time_horizon")
        except Exception:  # noqa: BLE001
            horizon_text = None
        future_goals = [g.get("goal") for g in (snap.get("goal_portfolio") or [])
                        if str(g.get("status") or "") == "future_goal" and g.get("goal")]
        return {
            "time_horizon_text": horizon_text,   # raw free text exactly as stated (never parsed)
            "future_goals": future_goals,        # goals the user framed as later (status=future_goal)
            "structured": False,                 # honest: no parsed/structured dates exist
            "source": "Advisor Discovery (free text — not parsed into dates)",
        }

    async def _recent_intelligence(self, ctx: UserContext) -> list[dict[str, Any]]:
        feed: list[dict[str, Any]] = []
        # STATED goals (the user's own words) outrank inferred objectives — lead with normalized candidate
        # goals as "Goal captured", concise (no raw paragraphs). These are what the user actually said.
        try:
            cgs = await self._sb.select("candidate_goals", filters={"user_id": f"eq.{ctx.user_id}"}, limit=6, order="created_at.desc", schema="life")
            for g in cgs:
                text = str(g.get("goal_text") or "").strip()
                if not text or len(text) > 120 or len(text.split()) > 18:
                    continue  # never surface a raw paragraph as a captured goal
                feed.append({"type": "goal", "label": f"Goal captured: {text}", "when": g.get("created_at")})
        except Exception:  # noqa: BLE001
            pass
        try:
            objs = await self._sb.select("life_objectives", filters={"user_id": f"eq.{ctx.user_id}"}, limit=3, order="created_at.desc", schema="life")
            for o in objs:
                # Inferred / persona-seeded objectives are labeled as INFERRED THEMES — never presented as a
                # stated objective ("Objective discovered: Reach financial independence" was the trust bug).
                confirmed = bool(o.get("confirmed")) and str(o.get("origin") or "") != "persona_bridge"
                if confirmed:
                    feed.append({"type": "objective", "label": f"Goal: {o['title']}", "when": o.get("created_at")})
                else:
                    feed.append({"type": "inferred_theme", "label": f"Inferred theme: {o['title']}", "when": o.get("created_at")})
        except Exception:  # noqa: BLE001
            pass
        try:
            recs = await self._sb.select("recommendations", filters={"user_id": f"eq.{ctx.user_id}"}, limit=3, order="updated_at.desc", schema="recommendations")
            feed += [{"type": "recommendation", "label": f"Recommendation: {r['title']}", "when": r.get("updated_at")} for r in recs]
        except Exception:  # noqa: BLE001
            pass
        try:
            runs = await self._sb.select("tool_runs", filters={"user_id": f"eq.{ctx.user_id}"}, limit=2, order="created_at.desc", schema="tools")
            feed += [{"type": "calculation", "label": f"Tool calculation: {r['tool']}", "when": r.get("created_at")} for r in runs]
        except Exception:  # noqa: BLE001
            pass
        feed.sort(key=lambda x: str(x.get("when") or ""), reverse=True)
        return feed[:8]
