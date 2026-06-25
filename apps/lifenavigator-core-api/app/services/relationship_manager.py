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

import json
import logging
import re
import uuid
from typing import Any, Optional

log = logging.getLogger("core.relationship_manager")

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
from .life_discovery import (
    _now, _goal_domain, dominant_narrative, narrative_question, narrative_step_prompt,
)

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
    def __init__(self, supabase: Any, life: Any, bridge: Any = None, gemini: Any = None) -> None:
        self._sb = supabase
        self._life = life          # LifeDiscoveryService — canonical writer
        self._bridge = bridge      # LifeBridge — folds in setup-wizard/persona data
        self._gemini = gemini      # onboarding interpreter LLM (optional; fail-safe to a SAFE clarification)
        self._interpret_status = ""  # last _interpret_plan outcome: ok|no_llm|skipped_short|llm_failed|parse_failed|empty
        from app.services.domain_projection import DomainProjectionService
        self._projection = DomainProjectionService(supabase)  # discovery goals → domain tables

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

    # Money framed as the ENABLER/LIMIT that protects what's already built is a
    # constraint, NOT a "reach financial independence" goal. Without this, any
    # answer to the finance step was forced into the financial_independence
    # archetype (+ generic retirement dependencies), mis-reading the user.
    _CONSTRAINT_SIGNALS = (
        "constraint", "not the goal", "not a goal", "without weakening",
        "set up properly", "the means", "enabler", "handle all",
        "protect the", "protect our", "protect my", "protect what",
        "the security i", "the security we", "make sure we can",
    )

    @classmethod
    def _is_financial_constraint(cls, text: str) -> bool:
        t = (text or "").lower()
        return any(s in t for s in cls._CONSTRAINT_SIGNALS)

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

    # ── Onboarding INTERPRETER (LLM) — turn a natural-language paragraph into a clean structured plan ─────
    # Converts intent into: north star, complete human-readable goals (mapped to a domain), values, an
    # explicit deprioritized list, a synthesis line, and ONE sharp prioritization question. Replaces the
    # regex clause-splitter (which produced fragments like "get my financial"). Fail-safe: returns None on
    # any error → callers fall back to the deterministic extractor. NEVER fabricates facts/numbers/goals.
    _VALID_DOMAINS = {"family", "finance", "health", "career", "education"}
    _INTERP_SYSTEM = (
        "You are LifeNavigator's onboarding interpreter. Convert the user's message into a clean, structured "
        "life plan. RULES: (1) Extract COMPLETE, human-readable goals — never sentence fragments or partial "
        "clauses (e.g. NOT 'get my financial'; YES 'Build a stronger financial foundation'). (2) Map each goal "
        "to exactly one domain from: family, finance, health, career, education. (3) Identify the north star "
        "(one sentence), the time horizon, the core values/drivers, and any domains the user EXPLICITLY "
        "deprioritized. (4) Write a warm 1-2 sentence synthesis that NAMES the north star and the pillars — do "
        "NOT echo their raw words back, and do NOT ask 'did I capture that?'. (5) Write ONE sharp prioritization "
        "question to ask next — not a generic 'what do you want', and not a premature 'which goal would you "
        "postpone'. Do NOT invent facts, numbers, names, or goals the user didn't state or clearly imply. "
        "Return STRICT JSON only — no markdown, no prose."
    )

    @staticmethod
    def _parse_json(raw: str) -> Optional[dict[str, Any]]:
        s = (raw or "").strip()
        if s.startswith("```"):
            s = re.sub(r"^```[a-zA-Z]*\n?|\n?```$", "", s).strip()
        i, j = s.find("{"), s.rfind("}")
        if i == -1 or j == -1 or j < i:
            return None
        try:
            d = json.loads(s[i:j + 1])
            return d if isinstance(d, dict) else None
        except Exception:  # noqa: BLE001
            return None

    async def _interpret_plan(self, statement: str) -> Optional[dict[str, Any]]:
        g = self._gemini
        text = (statement or "").strip()
        if not g or not getattr(g, "configured", False):
            self._interpret_status = "no_llm"
            return None
        if len(text.split()) < 6:
            self._interpret_status = "skipped_short"  # too short to be a paragraph (vague answer)
            return None
        user = (
            f'User message:\n"""{text[:1500]}"""\n\nReturn JSON exactly with this shape:\n'
            '{"north_star": str, "time_horizon": str, '
            '"goals": [{"goal": "a complete sentence", "domain": "family|finance|health|career|education", '
            '"status": "active|future", "confidence": 0.0}], '
            '"values": [str], "deprioritized_domains": ["domain"], "synthesis": str, "next_question": str}'
        )
        try:
            raw, _ = await g.generate_with_usage(self._INTERP_SYSTEM, user, temperature=0.2)
        except AttributeError:
            try:
                raw = await g.generate(self._INTERP_SYSTEM, user, temperature=0.2)
            except Exception:  # noqa: BLE001
                self._interpret_status = "llm_failed"
                return None
        except Exception:  # noqa: BLE001
            self._interpret_status = "llm_failed"
            return None
        data = self._parse_json(raw)
        if not data:
            self._interpret_status = "parse_failed"
            return None
        cand: list[dict[str, Any]] = []
        seen: set[str] = set()
        for go in (data.get("goals") or []):
            if not isinstance(go, dict):
                continue
            label = str(go.get("goal") or "").strip()
            if len(label.split()) < 2 or label.lower() in seen:
                continue
            seen.add(label.lower())
            dom = str(go.get("domain") or "").strip().lower()
            if dom in ("wellness", "fitness", "health & wellness", "health and wellness"):
                dom = "health"
            if dom not in self._VALID_DOMAINS:
                dom = _goal_domain(label)
            try:
                conf = round(min(1.0, max(0.0, float(go.get("confidence") or 0.7))), 2)
            except (TypeError, ValueError):
                conf = 0.7
            cand.append({
                "goal": label, "objective": label, "objective_key": None, "confidence": conf,
                "status": "future_goal" if str(go.get("status", "")).lower().startswith("future") else "active",
                "supporting_quotes": [text[:300]], "supporting_statements": [text[:300]],
                "dependencies": [], "domain": dom,
            })
        deprioritized = [str(d).strip().lower() for d in (data.get("deprioritized_domains") or [])
                         if str(d).strip().lower() in self._VALID_DOMAINS]
        # T3 fix: a deprioritization-only statement ("degree done, education isn't a priority") has NO goal but
        # IS a useful update — return the plan so we record the deprioritization instead of falling back to the
        # fragment extractor. Only truly empty interpretations fall back.
        if not cand and not deprioritized:
            self._interpret_status = "empty"
            return None
        self._interpret_status = "ok"
        return {
            "candidate_goals": cand,
            "north_star": str(data.get("north_star") or "").strip(),
            "time_horizon": str(data.get("time_horizon") or "").strip(),
            "values": [str(v).strip() for v in (data.get("values") or []) if str(v).strip()][:6],
            "deprioritized_domains": deprioritized,
            "synthesis": str(data.get("synthesis") or "").strip(),
            "next_question": str(data.get("next_question") or "").strip(),
        }

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
            # Make EVERY question prove we understood the user — a context-rich prompt built from their
            # narrative + goals + conflict + emotional state, not a generic template. The priority step is
            # the decisive moment; financial_goal/time_horizon/constraint are reframed around their life
            # too. (risk keeps its behavioral probe + options.)
            if nxt["key"] in ("priority", "financial_goal", "time_horizon", "constraint"):
                try:
                    vis = await self._vision_row(ctx)
                    narrative_text = str((vis.get("prompts") or {}).get("narrative") or "")
                    nar = dominant_narrative(await self._load_candidate_goals(ctx), narrative_text)
                    if nxt["key"] == "priority":
                        q = narrative_question(nar.get("key"), competing, nar.get("signals"))
                    else:
                        q = narrative_step_prompt(nxt["key"], nar.get("key"), competing, nar.get("signals"))
                    if q:
                        prompt = q
                except Exception:  # noqa: BLE001
                    pass
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
        # Prefer concrete GOALS over context/feeling statements so the tradeoff names real pursuits
        # (e.g. "a Masters in AI", not "Willing to sacrifice comfort"). Drops fragments that are clearly
        # state/feeling/context rather than something to pursue.
        _CONTEXT_RE = re.compile(r"^(i am|i'm|i make|i have|i feel|i could|i don'?t|willing to|i travel|"
                                 r"i work|financially|my comp|i make good)\b", re.IGNORECASE)
        seen, goals, context = set(), [], []
        for g in cands:
            text = str(g.get("goal_text") or g.get("goal") or "").strip()
            if not text:
                continue
            dom = _goal_domain(text)
            key = dom if dom != "core" else text.lower()
            if key in seen:
                continue
            seen.add(key)
            (context if _CONTEXT_RE.match(text) or dom == "core" else goals).append(text)
        return goals or context  # prefer real goals; fall back to context only if nothing concrete

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
        elif step["kind"] == "goal" and step["domain"] == "finance" and ans and self._is_financial_constraint(ans):
            # Money framed as a constraint/enabler protecting existing security → record it
            # as a financial constraint (NOT a new financial-independence goal). Reinforces
            # the user's real goals instead of slotting them into a retirement archetype.
            await self._sb.upsert("constraints", {"id": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"{ctx.user_id}:rm:fin:{ans[:40]}")),
                                                  "user_id": ctx.user_id, "tenant_id": ctx.user_id, "objective_id": None,
                                                  "label": ans, "kind": "financial",
                                                  "detail": "Money framed as a constraint/enabler during discovery.",
                                                  "severity": "medium"}, schema=LIFE)
            written["wrote"] = "life.constraints"
            written["constraint"] = ans
            written["is_constraint"] = True
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
            # LLM interpreter first (clean, complete goals + a north star). Fall back to the deterministic
            # clause extractor only if the LLM is unavailable or returns nothing usable.
            plan = await self._interpret_plan(ans)
            # HARDENING: NEVER fall back to the regex clause-splitter for a substantive discovery answer — a
            # failed interpreter must not corrupt goals with fragments. Goals come ONLY from the semantic plan.
            written["candidate_goals"] = plan["candidate_goals"] if plan else []
            written["llm_plan"] = plan
            # Narrative Model: preserve the user's OWN words + a multi-domain summary (the LLM north star when
            # available, else a deterministic domain rollup), stored separately so the story isn't collapsed.
            if key == "primary_goal":
                if plan and plan.get("north_star"):
                    summary = plan["north_star"]
                    if plan.get("time_horizon"):
                        summary = f"{summary} ({plan['time_horizon']})"
                else:
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

    @staticmethod
    def _scope_to_domains(detail: list[dict[str, Any]] | None, labels: list[str] | None,
                          focus_domains: Optional[list[str]]) -> list[str]:
        """Scope a risk/opportunity label list to the conversation's focused domain(s).

        Conservative by design:
          * No focus (broad/default orchestrator turn) → return the full list unchanged.
          * Focused turn → keep only rows whose domain is in the focus set, PLUS any row whose domain
            is unknown/None (we never DROP a real risk just because it carries no domain tag).
        `detail` is the domain-tagged [{label, domain}] from the snapshot (same order as `labels`); when
        it's missing we cannot scope, so we keep the full list (never fabricate a domain)."""
        full = list(labels or [])
        if not focus_domains:
            return full
        if not detail:
            return full
        focus = {str(d).lower() for d in focus_domains}
        scoped = [str(row.get("label")) for row in detail
                  if not row.get("domain") or str(row.get("domain")).lower() in focus]
        # Safety net: if scoping somehow drops everything (e.g. detail/label mismatch), fall back to the
        # full list rather than show an empty panel for a real, non-empty risk set.
        return [s for s in scoped if s] or full

    async def _context_panel(self, ctx: UserContext, focus_domains: Optional[list[str]] = None) -> dict[str, Any]:
        """The advisor's live view of the user — always reflects the current canonical model (D8).

        `focus_domains`: when this turn is routed to a specific domain (a direct Health/Finance/etc.
        advisor, or the orchestrator routed to a strict subset), the risk/opportunity chips are scoped to
        those domains so a HEALTH conversation no longer surfaces finance/career risk chips. When None
        (the broad Relationship Manager with no domain focus), the full whole-life list is kept."""
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
                "top_themes": snap.get("top_themes"),
                "top_risks": self._scope_to_domains(
                    snap.get("top_risks_detail"), snap.get("top_risks"), focus_domains),
                "top_constraints": [c["label"] for c in snap.get("active_constraints", [])],
                "top_opportunities": self._scope_to_domains(
                    snap.get("top_opportunities_detail"), snap.get("top_opportunities"), focus_domains),
                "discovery_completion_pct": round((health.get("model_quality") or 0) * 100),
                "covered_areas": health.get("covered_areas"), "missing_areas": health.get("missing_areas")}

    async def converse(self, ctx: UserContext, message: str, pending_key: Optional[str] = None,
                       *, focus_domains: Optional[list[str]] = None) -> dict[str, Any]:
        """One advisor turn. If pending_key is set, the message answers it (write canonically + show
        what updated); then reflect + ask the next question. Stateless — the caller threads pending_key.

        `focus_domains`: the conversation's routed domain(s) for this turn (set by the orchestrator from
        the answering agent). When present, the context_panel's risk/opportunity chips are scoped to those
        domains; when None (broad/default advisor) the full whole-life list is kept."""
        updates: list[str] = []
        reflection = ""
        reveal = None
        llm_plan: Optional[dict[str, Any]] = None  # set when the LLM interpreter parsed this turn's paragraph
        candidate_goals: list[dict[str, Any]] = []
        interpret_status = ""        # ok|no_llm|skipped_short|llm_failed|parse_failed|empty (this turn)
        substantive = False          # ≥6-word discovery message (a real paragraph, not a one-word answer)
        interpreter_failed = False   # the LLM interpreter errored on a substantive turn → SAFE clarification
        rejected_count = 0           # goals suppressed because the user previously rejected them
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
            panel0 = await self._context_panel(ctx, focus_domains)
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
            # ONBOARDING INTERPRETER: a goal can surface in ANY answer (incl. the vision turn). Run the LLM
            # interpreter on the message to get CLEAN, complete goals + a structured plan (north star, domains,
            # values, prioritization question) — instead of the regex clause-splitter's fragments. The plan is
            # reused below for the synthesis reflection + next question. Fail-safe: None → deterministic extract.
            if isinstance(rec, dict) and rec.get("llm_plan"):
                llm_plan, interpret_status = rec["llm_plan"], "ok"
            else:
                llm_plan = await self._interpret_plan(message)
                interpret_status = self._interpret_status
            substantive = len(message.split()) >= 6
            interpreter_failed = interpret_status in ("llm_failed", "parse_failed")
            # Persist any explicit deprioritization (merge, never clobber) so the platform can mark e.g.
            # education "deprioritized / sufficient for now" instead of "not started". (T3 fix)
            if llm_plan and llm_plan.get("deprioritized_domains"):
                try:
                    cur = await self._vision_row(ctx)
                    existing = set((cur.get("prompts") or {}).get("deprioritized_domains") or [])
                    merged = sorted(existing | set(llm_plan["deprioritized_domains"]))
                    await self._update_vision(ctx, prompt_updates={"deprioritized_domains": merged})
                except Exception:  # noqa: BLE001
                    pass
            # HARDENING: goals come ONLY from the semantic plan. The legacy regex clause-splitter is NEVER used
            # for a substantive discovery turn — a failed/empty interpreter yields NO goals (and, when it failed
            # on a substantive turn, a safe clarification below), so fragments can never re-enter persistence.
            seen_goal = {str(g.get("goal", "")).lower() for g in candidate_goals}
            extracted = llm_plan["candidate_goals"] if llm_plan else []
            for g in extracted:
                gk = str(g.get("goal", "")).lower()
                if gk and gk not in seen_goal:
                    seen_goal.add(gk)
                    candidate_goals.append(g)
            # P0.3: suppress any candidate matching a previously rejected goal (persists across sessions).
            if candidate_goals:
                rejected = await self._rejected_norms(ctx)
                if rejected:
                    kept = [
                        g for g in candidate_goals
                        if not any(
                            r in (str(g.get("goal", "")) + " " + str(g.get("objective", ""))).lower()
                            for r in rejected
                        )
                    ]
                    rejected_count = len(candidate_goals) - len(kept)
                    candidate_goals = kept
            # P0.1: persist every surviving candidate goal so it accumulates across turns (never lost).
            if candidate_goals:
                await self._persist_candidate_goals(ctx, candidate_goals)
                # Round-trip: project career/education goals + unambiguous family entities into the
                # domain tables the dashboard pages read, so captured data shows up there (the user
                # never re-enters it). Fail-soft — never breaks a discovery turn.
                try:
                    await self._projection.project(ctx, candidate_goals)
                except Exception:  # noqa: BLE001
                    pass
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
            # LLM interpreter present → SYNTHESIZE (name the north star + pillars), don't parrot the raw words
            # back or ask "did I capture that?". (llm_plan was set during extraction above.)
            if llm_plan and (llm_plan.get("candidate_goals") or llm_plan.get("deprioritized_domains")):
                cg = llm_plan.get("candidate_goals") or []
                parts = []
                if llm_plan.get("synthesis"):
                    parts.append(llm_plan["synthesis"].rstrip())
                elif llm_plan.get("north_star"):
                    parts.append(f"Got it — your north star is {llm_plan['north_star'].rstrip('.')}.")
                if cg:
                    pillars = "; ".join(f"{i + 1}) {g['goal']}" for i, g in enumerate(cg[:6]))
                    parts.append(f"I'm capturing these pillars — {pillars}.")
                if llm_plan.get("deprioritized_domains"):
                    parts.append("Deprioritized for now: " + ", ".join(llm_plan["deprioritized_domains"]) + ".")
                    # T3: deprioritization-only turn (no new goals) → refocus, don't no-op or route to intake.
                    if not cg and not llm_plan.get("synthesis"):
                        parts.append("We'll focus the plan on the areas that move the needle next.")
                reflection = " ".join(p for p in parts if p) + " "
            # Rule 3: EXTRACT first, classify later — reflect the user's OWN words (the goal text),
            # never an objective label, and ask them to confirm before any classification.
            elif len(candidate_goals) >= 2:
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
            # Recompute state AFTER candidate goals are persisted (above) so the next question is
            # narrative/conflict-aware — answer()'s own state ran before this turn's goals were saved.
            st = await self.state(ctx)
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
        # When the LLM produced a plan, ask ITS sharp prioritization question (overriding the state machine's
        # generic/premature one) and drop the generic "let's build your plan" opener — the synthesis leads.
        if llm_plan and llm_plan.get("next_question") and not st.get("complete"):
            nq = dict(nq or {})
            nq["prompt"] = llm_plan["next_question"]
            nq.setdefault("key", "primary_goal_priority")
            nq["why_it_matters"] = nq.get("why_it_matters") or "It sets the order we build your plan."
        if st.get("complete") or not nq:
            assistant = (reflection + "That's everything I need to start — let's build your life plan. "
                         "Open **My Life** to see your vision, what matters most, your readiness, and your next best action.")
        else:
            opener = "" if (pending_key or llm_plan) else (plaid_ack + "Let's build your plan together — I'll ask a few quick questions. ")
            # Rule 7: a brief (non-verbose) reason the question matters.
            why = nq.get("why_it_matters")
            why_line = f"\n\n_Why I ask: {why}_" if why else ""
            assistant = f"{reflection}{opener}{nq['prompt']}{why_line}"
        # HARDENING: the interpreter FAILED on a substantive paragraph → nothing was persisted (goals came only
        # from the semantic plan, which is empty here) and we must NOT legacy-fragment. Return a safe
        # clarification and let the user restate; re-ask the same step.
        response_pending = None if (st.get("complete") or not nq) else nq["key"]
        if interpreter_failed and substantive:
            assistant = (
                "I'm having trouble turning that into a clean plan right now, and I don't want to save it "
                "incorrectly. Let's take it one step at a time: what's the most important thing you want "
                "LifeNavigator to help you organize first — finances, health, career, family, or something else?"
            )
            reveal = None
            response_pending = pending_key  # re-ask the same step; nothing persisted from raw text
            log.warning(json.dumps({"event": "onboarding_interpreter_failed", "user": ctx.user_id,
                                    "status": interpret_status, "msg_len": len(message or "")}))
        # Response provenance for the onboarding trace (P5).
        if interpreter_failed and substantive:
            response_source = "safe_clarification"
        elif llm_plan and (llm_plan.get("candidate_goals") or llm_plan.get("deprioritized_domains")):
            response_source = "semantic"
        elif st.get("complete"):
            response_source = "complete"
        else:
            response_source = "state_machine"
        onboarding_trace = {
            "interpreter_used": interpret_status in ("ok", "llm_failed", "parse_failed", "empty"),
            "interpreter_failed": interpreter_failed,
            "interpret_status": interpret_status,
            "semantic_path_used": bool(llm_plan and (llm_plan.get("candidate_goals")
                                                     or llm_plan.get("deprioritized_domains"))),
            "legacy_fragment_path_used": False,  # the regex clause-splitter is unreachable in discovery now
            "fallback_type": ("safe_clarification" if (interpreter_failed and substantive) else ""),
            "persisted_goals_count": len(candidate_goals),
            "rejected_goals_count": rejected_count,
            "response_source": response_source,
            "reveal_source": "semantic" if reveal else "none",
            "action_unlock_source": "semantic" if candidate_goals else "none",
        }
        if pending_key and substantive:
            log.info(json.dumps({"event": "onboarding_turn", "user": ctx.user_id, **onboarding_trace}))
        panel = await self._context_panel(ctx, focus_domains)
        return {
            "assistant_message": assistant,
            "pending_key": response_pending,
            "options": (nq or {}).get("options"),
            "updates": updates,
            "reveal": reveal,  # the "magic moment" — render it prominently (D2)
            "candidate_goals": candidate_goals,  # V3: all goals heard in this turn (never collapsed)
            "progress": st.get("progress"),
            "complete": st.get("complete", False),
            "context_panel": panel,
            "onboarding_trace": onboarding_trace,
        }
