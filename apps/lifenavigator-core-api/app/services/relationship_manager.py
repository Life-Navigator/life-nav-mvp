"""Relationship Manager — conversational discovery (Elite Sprint 40, corrected).

This is the PRIMARY onboarding: an advisor-led interview that collects the user's life model
conversationally and writes EVERY answer immediately to the canonical `life.*` tables + Personal
Life Graph (so GraphRAG, readiness, recommendations, scenarios, the Decision Brain, reports, and the
dashboard all hydrate from the same truth in real time). The intelligence layer both reads AND
writes Supabase here — it is not a separate after-the-fact reasoner. The old web onboarding / Plaid
persona is a secondary *setup wizard* (account connection), folded in via the LifeBridge.

Flow:  Advisor Chat → Relationship Manager Discovery → Supabase (life.*) → Life Graph → GraphRAG → Dashboard.
"""
from __future__ import annotations

import re
import uuid
from typing import Any, Optional

# Rule 2: user corrections are authoritative. When the user pushes back, we apologize + ask them to
# restate — we never re-assert a rejected interpretation.
_CORRECTION_RE = re.compile(
    r"\b(no|nope|wrong|incorrect|that'?s not( right| it)?|not what i meant|you made (that|it|them)? ?up|"
    r"you made up|i didn'?t say|i never said|don'?t (say|put|add)|not (career|family|finance|health)|"
    r"that'?s wrong|you'?re wrong|stop assuming)\b",
    re.IGNORECASE,
)
# Pull the rejected concept out of the correction so it can be persisted + suppressed forever (P0.2).
_REJECTED_PHRASE_RE = re.compile(
    r"(?:made (?:that |it |them )?up|i didn'?t say|i never said|don'?t (?:say|put|add)|not)\s+([a-z][a-z '\-]{2,48})",
    re.IGNORECASE,
)

from ..models.common import UserContext
from .life_discovery import _now, _goal_domain

LIFE = "life"

# The discovery interview. Each step writes to the canonical model the moment it's answered.
# Goal-DRIVEN flow (Rule 4/5): we capture the user's goals in their own words, then clarify THOSE goals —
# we do NOT march through family→career→finance→health asking domain questions the user never raised.
# (Career/health/family surface only if the user introduces them; analyze_statement captures them.)
FLOW: list[dict[str, Any]] = [
    {"key": "vision", "kind": "vision", "domain": "core",
     "prompt": "Let's start with the big picture — what would you most like your life to look like over the next few years?",
     "why": "Your vision anchors every recommendation we make."},
    {"key": "primary_goal", "kind": "goal", "domain": "core",
     "prompt": "In your own words, what are you working toward right now? List as many things as matter to you.",
     "why": "I capture your goals in your words first — I don't slot you into categories."},
    {"key": "priority", "kind": "context", "domain": "core",
     "prompt": "Of everything you just shared, which matters most to you right now?",
     "why": "Knowing your top priority shapes the whole plan."},
    {"key": "financial_goal", "kind": "goal", "domain": "finance",
     "prompt": "Is there anything about money — saving, debt, or a purchase — tied to those goals?",
     "why": "Money is usually the spine of the plan, but only when it's part of YOUR goals."},
    {"key": "time_horizon", "kind": "time_horizon", "domain": "core",
     "prompt": "What timeline are you targeting for the thing that matters most? (a few years, ten years, by retirement…)",
     "why": "Time horizon changes the right strategy entirely."},
    {"key": "risk", "kind": "risk", "domain": "finance",
     "prompt": "When an outcome is uncertain — say your investments dropped sharply — how do you usually react?",
     "why": "Your real instincts (not a survey) drive projections + recommendations.",
     "options": ["I'd sell to protect myself", "I'd hold steady", "I'd buy more"]},
    {"key": "constraint", "kind": "constraint", "domain": "core",
     "prompt": "What feels like the biggest thing standing in your way right now?",
     "why": "We plan around real constraints instead of pretending they don't exist."},
]
_FLOW_BY_KEY = {s["key"]: s for s in FLOW}
_RISK_MAP = {"sell": ("conservative", 30), "hold": ("moderate", 60), "buy": ("aggressive", 85)}
_GOAL_ROOT_HINT = {"family": "family_stability", "career": "career_growth", "finance": "financial_independence", "health": "health_longevity"}


class RelationshipManager:
    def __init__(self, supabase: Any, life: Any, bridge: Any = None) -> None:
        self._sb = supabase
        self._life = life          # LifeDiscoveryService — canonical writer
        self._bridge = bridge      # LifeBridge — folds in setup-wizard/persona data

    async def _vision_row(self, ctx: UserContext) -> dict[str, Any]:
        rows = await self._sb.select("life_vision", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, schema=LIFE)
        return rows[0] if rows else {}

    async def _rejected_norms(self, ctx: UserContext) -> set[str]:
        """Normalized rejected goals (full phrase + significant words like 'career') to suppress forever."""
        _STOP = {"about", "build", "start", "being", "things", "would", "could", "really", "advance"}
        try:
            rows = await self._sb.select("rejected_goals", filters={"user_id": f"eq.{ctx.user_id}"}, limit=50, schema=LIFE)
        except Exception:  # noqa: BLE001
            return set()
        norms: set[str] = set()
        for r in rows:
            ph = str(r.get("normalized_goal", "")).strip()
            if len(ph) >= 4:
                norms.add(ph)
            for w in ph.split():
                if len(w) >= 5 and w not in _STOP:
                    norms.add(w)
        return norms

    @staticmethod
    def _future_status(goal: str) -> str:
        """P0.5: a goal the user framed as later ('a few years', 'someday') is a future_goal, not dropped."""
        t = (goal or "").lower()
        if any(s in t for s in ("few years", "down the road", "later", "someday", "eventually",
                                "in the future", "years away", "years from now", "one day")):
            return "future_goal"
        return "active"

    async def _persist_candidate_goals(self, ctx: UserContext, goals: list[dict[str, Any]]) -> None:
        """P0.1: accumulate every extracted goal across turns (upsert by normalized text). No goal is lost,
        none collapsed into a generic label — the final review reads from THIS, not a stale objective."""
        for g in goals:
            text = str(g.get("goal") or g.get("objective") or "").strip()
            if not text:
                continue
            norm = text.lower()
            quotes = g.get("supporting_quotes") or []
            try:
                await self._sb.upsert("candidate_goals", {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{ctx.user_id}:cand:{norm}")),
                    "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                    "goal_text": text, "normalized_goal": norm,
                    "objective_key": g.get("objective_key"),
                    "objective_label": g.get("objective") if g.get("objective") != text else None,
                    "domain": g.get("domain") or "core",
                    "confidence": g.get("confidence") or 0.5,
                    "supporting_quote": (quotes[0] if quotes else text)[:500],
                    "status": g.get("status") or self._future_status(text),
                    "updated_at": _now(),
                }, on_conflict="user_id,normalized_goal", schema=LIFE)
            except Exception:  # noqa: BLE001
                pass

    async def _load_candidate_goals(self, ctx: UserContext) -> list[dict[str, Any]]:
        """All goals heard across the whole conversation (for the final confirmation — never stale labels)."""
        try:
            rows = await self._sb.select("candidate_goals", filters={"user_id": f"eq.{ctx.user_id}"},
                                         limit=50, schema=LIFE)
        except Exception:  # noqa: BLE001
            return []
        rejected = await self._rejected_norms(ctx)
        out = []
        for r in rows:
            blob = (str(r.get("goal_text", "")) + " " + str(r.get("objective_label") or "")).lower()
            if rejected and any(x in blob for x in rejected):
                continue  # P0.3: a goal the user rejected never appears in the final model
            out.append({
                "goal": r.get("goal_text"), "objective": r.get("objective_label") or r.get("goal_text"),
                "domain": r.get("domain") or "core", "status": r.get("status") or "active",
                "supporting_quote": r.get("supporting_quote"), "confidence": r.get("confidence"),
            })
        return out

    async def _has_financial_data(self, ctx: UserContext) -> bool:
        """True when the user has connected/persona financial accounts (so we don't re-ask the numbers)."""
        try:
            rows = await self._sb.select(
                "financial_accounts", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, schema="finance"
            )
            return bool(rows)
        except Exception:  # noqa: BLE001
            return False

    async def _update_vision(self, ctx: UserContext, *, vision_text: Optional[str] = None, prompt_updates: Optional[dict] = None) -> None:
        """Read-modify-write life_vision, preserving vision_text + all prompt keys (incl. discovery state)."""
        cur = await self._vision_row(ctx)
        prompts = dict(cur.get("prompts") or {})
        prompts.update(prompt_updates or {})
        prompts.setdefault("source", "relationship_manager")
        await self._sb.upsert("life_vision", {"user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                              "vision_text": vision_text if vision_text is not None else cur.get("vision_text"),
                                              "prompts": prompts}, schema=LIFE)

    async def _mark_answered(self, ctx: UserContext, key: str) -> None:
        cur = await self._vision_row(ctx)
        answered = list((cur.get("prompts") or {}).get("discovery_answered") or [])
        if key not in answered:
            answered.append(key)
        await self._update_vision(ctx, prompt_updates={"discovery_answered": answered})

    async def _answered_keys(self, ctx: UserContext) -> set[str]:
        """Steps answered = the explicit discovery_answered list (reliable) + presence backstops."""
        cur = await self._vision_row(ctx)
        done: set[str] = set((cur.get("prompts") or {}).get("discovery_answered") or [])
        if cur.get("vision_text"):
            done.add("vision")
        if (cur.get("prompts") or {}).get("time_horizon"):
            done.add("time_horizon")
        if await self._sb.select("risk_profiles", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, schema=LIFE):
            done.add("risk")
        if await self._sb.select("constraints", filters={"user_id": f"eq.{ctx.user_id}"}, limit=1, schema=LIFE):
            done.add("constraint")
        return done

    async def state(self, ctx: UserContext) -> dict[str, Any]:
        # Fold in any setup-wizard / persona data first, so we don't re-ask what we can infer.
        if self._bridge is not None:
            try:
                await self._bridge.sync(ctx)
            except Exception:  # noqa: BLE001
                pass
        done = await self._answered_keys(ctx)
        nxt = next((s for s in FLOW if s["key"] not in done), None)
        total = len(FLOW)
        # Understanding-first selection (Discovery Intelligence): when the user has several competing goals,
        # the priority step becomes a concrete tradeoff/postpone question — selected from the conflict, not
        # from the highest-confidence objective. Derived from the user's OWN stated goals (candidate_goals).
        competing = await self._competing_goal_labels(ctx)
        nq = None
        if nxt is not None:
            prompt = nxt["prompt"]
            if nxt["key"] == "priority" and len(competing) >= 2:
                a, b = competing[0], competing[1]
                prompt = (f"You've got several big goals in motion — {a} and {b} among them. "
                          "If one needed to move more slowly so the others could succeed, "
                          "which would be easiest for you to postpone?")
            nq = {"key": nxt["key"], "prompt": prompt, "why_it_matters": nxt["why"],
                  "domain": nxt["domain"], "options": nxt.get("options"), "optional": nxt.get("optional", False),
                  "estimated_time": "~30 seconds"}
        return {
            "complete": nxt is None,
            "progress": {"answered": len(done & {s["key"] for s in FLOW}), "total": total},
            "next_question": nq,
            "competing_goals": competing,
            "answered": sorted(done),
        }

    async def _competing_goal_labels(self, ctx: UserContext) -> list[str]:
        """The user's own distinct stated goals (from candidate_goals), newest-first — used to frame a
        real tradeoff question instead of anchoring on the highest-confidence objective. Never raises."""
        try:
            cands = await self._load_candidate_goals(ctx)
        except Exception:  # noqa: BLE001
            return []
        seen, labels = set(), []
        for g in cands:
            text = str(g.get("goal_text") or g.get("goal") or "").strip()
            dom = _goal_domain(text)
            key = dom if dom != "core" else text.lower()
            if text and key not in seen:
                seen.add(key)
                labels.append(text)
        return labels

    async def answer(self, ctx: UserContext, key: str, answer_text: str) -> dict[str, Any]:
        """Record one answer → write it to the canonical Life Model immediately, then advance."""
        step = _FLOW_BY_KEY.get(key)
        if not step:
            raise ValueError(f"unknown discovery step {key}")
        written: dict[str, Any] = {"step": key, "kind": step["kind"]}
        ans = (answer_text or "").strip()

        if step["kind"] == "vision":
            await self._update_vision(ctx, vision_text=ans)
            written["wrote"] = "life.life_vision"
        elif step["kind"] == "goal" and ans:
            root_hint = _GOAL_ROOT_HINT.get(step["domain"])
            res = await self._life.discover_goal(ctx, surface_goal=ans, why_chain=[{"q": step["prompt"], "a": ans}],
                                                 root_override=root_hint if step["domain"] != "core" else None)
            written["wrote"] = "life.life_objectives + dependencies + graph edges"
            written["objective"] = res.get("root_label") or res.get("followup_question")
            written["needs_followup"] = res.get("needs_followup", False)
            # capture the full discovery for the "reveal" moment (D2)
            written["surface_goal"] = ans
            written["dependencies"] = [d["label"] for d in (res.get("dependencies") or [])]
            written["confidence"] = res.get("confidence")
            # V3 Sprint 2/8: a single answer may hold several goals — capture ALL candidates (each with
            # confidence + conversation-derived dependencies), never collapsed to one.
            written["candidate_goals"] = self._life.analyze_statement(ans)
            # Narrative Model: preserve the user's OWN words + a deterministic multi-domain summary,
            # stored separately from objectives so the story is never collapsed into one objective.
            if key == "primary_goal":
                domains = sorted({_goal_domain(g.get("goal") or "") for g in (written["candidate_goals"] or [])} - {"core"})
                horizon = "the next 1–2 years" if any(m in ans.lower() for m in
                          ("year", "month", "wedding", "soon", "promotion")) else None
                summary = ("You're building across " + ", ".join(domains) if domains
                           else "You're working toward several goals") + (f" over {horizon}" if horizon else "") + "."
                await self._update_vision(ctx, prompt_updates={"narrative": ans.strip(), "narrative_summary": summary})
                written["narrative_summary"] = summary
        elif step["kind"] == "context" and ans:
            # PRIORITY CAPTURE (was a no-op): record the user's stated priority AND let it lead ranking.
            priority_root = self._life.classify_priority(ans)
            await self._update_vision(ctx, prompt_updates={"user_priority": ans.strip(),
                                                           "user_priority_root": priority_root})
            # The user explicitly chose what matters most → CONFIRM that objective (a candidate becomes real
            # and outranks persona seeds). Bumps updated_at so recency + priority both favor it.
            if priority_root:
                await self._sb.update("life_objectives",
                                      {"confirmed": True, "origin": "user", "updated_at": _now()},
                                      filters={"user_id": f"eq.{ctx.user_id}",
                                               "root_objective_key": f"eq.{priority_root}", "status": "eq.active"},
                                      schema=LIFE)
            written["wrote"] = "life.life_vision.prompts.user_priority"
            written["priority_root"] = priority_root
        elif step["kind"] == "risk":
            label, tol = next(((lbl, t) for k, (lbl, t) in _RISK_MAP.items() if k in ans.lower()), ("moderate", 60))
            await self._sb.upsert("risk_profiles", {"user_id": ctx.user_id, "tenant_id": ctx.user_id,
                                                    "tolerance": tol, "capacity": tol, "behavior": label,
                                                    "horizon_years": 20, "loss_aversion": 100 - tol}, schema=LIFE)
            written["wrote"] = "life.risk_profiles"
            written["risk_behavior"] = label
        elif step["kind"] == "time_horizon":
            await self._update_vision(ctx, prompt_updates={"time_horizon": ans})
            written["wrote"] = "life.life_vision.prompts.time_horizon"
        elif step["kind"] == "constraint" and ans:
            await self._sb.upsert("constraints", {"id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{ctx.user_id}:rm:{ans[:40]}")),
                                                  "user_id": ctx.user_id, "tenant_id": ctx.user_id, "objective_id": None,
                                                  "label": ans, "kind": "stated", "detail": "Stated during discovery.", "severity": "medium"}, schema=LIFE)
            written["wrote"] = "life.constraints"

        await self._mark_answered(ctx, key)  # canonical step-tracking (resume across sessions)
        nxt = await self.state(ctx)
        return {"recorded": written, **nxt,
                "note": "Saved to your canonical Life Model — your dashboard, recommendations, and advisor now reflect this."}

    # ---- chat-native conversation (Sprint 41): the advisor IS the Relationship Manager ----
    _WROTE_UPDATES = {
        "life.life_vision": ["✓ Life Vision updated"],
        "life.life_objectives + dependencies + graph edges": ["✓ Objective added", "✓ Dependencies mapped", "✓ Life Graph updated"],
        "life.risk_profiles": ["✓ Risk profile updated"],
        "life.constraints": ["✓ Constraint added"],
        "life.life_vision.prompts.time_horizon": ["✓ Time horizon noted"],
    }

    async def _context_panel(self, ctx: UserContext) -> dict[str, Any]:
        """The advisor's live view of the user — always reflects the current canonical model (D8)."""
        try:
            snap = await self._life.snapshot(ctx)
            health = await self._life.discovery_health(ctx)
        except Exception:  # noqa: BLE001
            return {}
        po = snap.get("primary_objective") or {}
        nar = snap.get("dominant_narrative") or {}
        # P0.2: the confirmation renders THESE accumulated goals (the user's own words), not a stale label.
        cands = await self._load_candidate_goals(ctx)
        return {"life_vision": snap.get("life_vision"),
                # Narrative-first: the surfaced THEME is the life story, not a single objective.
                "dominant_narrative": nar.get("summary"), "narrative_theme": nar.get("label"),
                "goal_portfolio": snap.get("goal_portfolio"), "emotional_signals": snap.get("emotional_signals"),
                "primary_objective": po.get("title"),
                "candidate_goals": cands,
                "priorities_i_heard": [c["goal"] for c in cands],
                "domains_touched": sorted({c["domain"] for c in cands if c["domain"] != "core"}),
                "top_themes": snap.get("top_themes"), "top_risks": snap.get("top_risks"),
                "top_constraints": [c["label"] for c in snap.get("active_constraints", [])],
                "top_opportunities": snap.get("top_opportunities"),
                "discovery_completion_pct": round((health.get("model_quality") or 0) * 100),
                "covered_areas": health.get("covered_areas"), "missing_areas": health.get("missing_areas")}

    async def converse(self, ctx: UserContext, message: str, pending_key: Optional[str] = None) -> dict[str, Any]:
        """One advisor turn. If pending_key is set, the message answers it (write canonically + show
        what updated); then reflect + ask the next question. Stateless — the caller threads pending_key."""
        updates: list[str] = []
        reflection = ""
        reveal = None
        candidate_goals: list[dict[str, Any]] = []
        if pending_key and message.strip() and _CORRECTION_RE.search(message):
            # Rule 2: the user is correcting us — apologize, do NOT classify or advance, ask them to
            # restate in their own words. (We never re-surface the rejected interpretation.)
            # P0.2: PERSIST the rejected concept so it never resurfaces — even in a future session.
            m = _REJECTED_PHRASE_RE.search(message)
            phrase = (m.group(1).strip() if m else "").rstrip(". ")
            if phrase:
                try:
                    await self._sb.insert("rejected_goals", {
                        "id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{ctx.user_id}:rej:{phrase.lower()}")),
                        "user_id": ctx.user_id, "tenant_id": ctx.user_id,
                        "rejected_goal": phrase, "normalized_goal": phrase.lower(),
                        "reason": "user said the advisor invented/misclassified it",
                        "rejected_by_user_quote": message[:280],
                    }, schema=LIFE)
                except Exception:  # noqa: BLE001
                    pass
            nq0 = _FLOW_BY_KEY.get(pending_key) or {}
            st0 = await self.state(ctx)
            panel0 = await self._context_panel(ctx)
            return {
                "assistant_message": (
                    "You're right — I overreached, and I should only work from what you actually told me. "
                    "Tell me again, in your own words, what matters most to you — I'll capture exactly what you say."
                ),
                "pending_key": pending_key,
                "options": nq0.get("options"),
                "updates": [],
                "reveal": None,
                "candidate_goals": [],
                "progress": st0.get("progress"),
                "complete": False,
                "context_panel": panel0,
            }
        if pending_key and message.strip():
            res = await self.answer(ctx, pending_key, message)
            rec = res.get("recorded", {})
            candidate_goals = list(rec.get("candidate_goals") or [])
            # P0.5: a goal can surface in ANY answer — while answering the risk/constraint question, or
            # in a final open-ended reply ("I'm also considering going back to school"). Extract from every
            # substantive message, not just the dedicated goal turn, so no stated goal is ever dropped.
            seen_goal = {str(g.get("goal", "")).lower() for g in candidate_goals}
            for g in self._life.analyze_statement(message):
                gk = str(g.get("goal", "")).lower()
                if gk and gk not in seen_goal:
                    seen_goal.add(gk)
                    candidate_goals.append(g)
            # P0.3: suppress any candidate matching a previously rejected goal (persists across sessions).
            if candidate_goals:
                rejected = await self._rejected_norms(ctx)
                if rejected:
                    candidate_goals = [
                        g for g in candidate_goals
                        if not any(
                            r in (str(g.get("goal", "")) + " " + str(g.get("objective", ""))).lower()
                            for r in rejected
                        )
                    ]
            # P0.1: persist every surviving candidate goal so it accumulates across turns (never lost).
            if candidate_goals:
                await self._persist_candidate_goals(ctx, candidate_goals)
            updates = list(self._WROTE_UPDATES.get(rec.get("wrote", ""), []))
            if updates:
                # Rule 7: during discovery, nothing is finalized — use draft language, not "recommendations refreshed".
                updates += ["✓ Life model updated", "✓ Discovery notes updated"]
            # The "magic moment" (D2): surface goal → discovered objective → confidence. We no longer
            # fabricate archetype dependencies, so the reveal celebrates the discovered objective itself
            # (requirements/recommendations surface later from real evidence, not from the objective).
            if rec.get("objective"):
                deps_revealed = rec.get("dependencies") or []
                reveal = {
                    "you_said": rec.get("surface_goal"),
                    "we_discovered": rec["objective"],
                    "dependencies": deps_revealed,
                    "recommendations_unlocked": len(deps_revealed),
                    "confidence_pct": round((rec.get("confidence") or 0) * 100),
                }
            # Rule 3: EXTRACT first, classify later — reflect the user's OWN words (the goal text),
            # never an objective label, and ask them to confirm before any classification.
            if len(candidate_goals) >= 2:
                listed = "; ".join(f"{i + 1}) {g.get('goal') or g.get('objective')}" for i, g in enumerate(candidate_goals[:4]))
                reflection = (
                    f"I'm hearing a few priorities — {listed}. "
                    "Did I capture that correctly, or did I miss something? "
                )
            elif rec.get("objective"):
                reflection = (
                    f"What I'm hearing is that **{rec['objective']}** may be part of what's driving this — "
                    "did I understand that right, or is something else behind it? "
                )
            elif rec.get("risk_behavior"):
                reflection = (
                    f"It sounds like you'd **{rec['risk_behavior']}** — tell me if that's not quite right. "
                )
            else:
                reflection = "Thanks — got it. "
            st = res  # answer() already returns the advanced state
        else:
            st = await self.state(ctx)

        # V3 Sprint 4: if the user already has connected financial data, acknowledge it on the opening
        # turn and signal we won't re-ask the numbers (we'll ask what they MEAN instead).
        plaid_ack = ""
        if not pending_key:
            try:
                if await self._has_financial_data(ctx):
                    plaid_ack = (
                        "I can already see your financial picture from your connected persona, so I won't "
                        "re-ask about balances or income — I'd rather understand what those numbers mean to you. "
                    )
            except Exception:  # noqa: BLE001
                plaid_ack = ""

        nq = st.get("next_question")
        if st.get("complete") or not nq:
            assistant = (reflection + "That's everything I need to start — let's build your life plan. "
                         "Open **My Life** to see your vision, what matters most, your readiness, and your next best action.")
        else:
            opener = "" if pending_key else (plaid_ack + "Let's build your plan together — I'll ask a few quick questions. ")
            # Rule 7: a brief (non-verbose) reason the question matters.
            why = nq.get("why_it_matters")
            why_line = f"\n\n_Why I ask: {why}_" if why else ""
            assistant = f"{reflection}{opener}{nq['prompt']}{why_line}"
        panel = await self._context_panel(ctx)
        return {
            "assistant_message": assistant,
            "pending_key": None if (st.get("complete") or not nq) else nq["key"],
            "options": (nq or {}).get("options"),
            "updates": updates,
            "reveal": reveal,  # the "magic moment" — render it prominently (D2)
            "candidate_goals": candidate_goals,  # V3: all goals heard in this turn (never collapsed)
            "progress": st.get("progress"),
            "complete": st.get("complete", False),
            "context_panel": panel,
        }
