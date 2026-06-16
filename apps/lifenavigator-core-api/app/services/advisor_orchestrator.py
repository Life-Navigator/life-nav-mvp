"""Advisor Orchestrator (Hybrid Advisor sprint).

Ties the hybrid flow together WITHOUT letting the rules script the conversation:

  user message
    → RelationshipManager.converse()   [deterministic: persistence of candidate/rejected goals, canonical
                                         writes, safety, and a guaranteed safe rule-based fallback text]
    → AdvisorContextBuilder            [real DB/API GUARDRAILS for the LLM: classified facts, discovery
                                         scores, domain priorities, safety, allowed numbers]
    → build_constraints()              [the rule ENVELOPE: persistence=off, one question max, disallowed
                                         topics, required disclaimers, coarse intent for temperature — it
                                         does NOT decide the question]
    → AdvisorLLM.generate()            [the LLM IS the advisor: it reasons within the guardrails and decides
                                         the reflection, the ONE question, why it matters, and the summary]
    → validate()                       [deterministic trust gate: no invented data, no advice, no persistence]
    → merge: the validated reflection + question REPLACES only the assistant text; everything the
      deterministic engine decided (pending_key, candidate_goals, updates, persistence) is preserved.

Rules guide; the LLM leads. If the LLM is unavailable, returns None, fails validation, or errors → the
rule-based response is returned unchanged. The user never sees an error or degraded UX; the LLM can only
make the advisor feel more human and perceptive, never fabricate or write.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from ..models.common import UserContext
from .advisor_context import AdvisorContextBuilder
from .advisor_llm import AdvisorLLM, ADVISOR_PROMPT_VERSION
from .advisor_validator import validate
from . import model_registry as reg
from .model_router import detect_health_urgent, health_safety_response

log = logging.getLogger("core.advisor")

# Strong references to in-flight best-effort turn-log writes. asyncio only keeps a weak reference to a
# fire-and-forget task, so without this the task can be garbage-collected mid-await and the insert is
# silently dropped (observed: most rows lost under load). Module scope so it survives the per-request
# orchestrator instance. Each task removes itself on completion.
_PENDING_WRITES: set = set()


def build_constraints(base: dict[str, Any], context: Any) -> dict[str, Any]:
    """The rule ENVELOPE the LLM must reason inside — constraints and permissions, NOT a scripted move.

    Deliberately does not choose ask/confirm/clarify: the LLM detects corrections, decides when to confirm
    a goal, and decides when to summarise from the guardrail context itself. The only deterministic signal
    is `intent`, a coarse hint (used for temperature + to permit a closing summary) derived purely from the
    deterministic completion flag.
    """
    intent = "summary" if base.get("complete") else "discovery"
    return {
        "intent": intent,
        "may_summarise": bool(base.get("complete")),
        "focus_candidates": context.domain_priorities or list(context.missing_areas or []),
        "objective": context.primary_objective,
        "relationships_available": context.relationships_available,
        "allowed_topics": ["discovery", "clarification", "summary", context.current_stage],
        "disallowed_topics": [
            "final financial advice", "medical advice", "legal advice", "tax advice",
            "specific product recommendations",
        ],
        "required_disclaimers": [],
        "max_questions": 1,
        "persistence_allowed": False,  # the LLM never persists; the deterministic engine already did
        "must_classify_facts": True,
        "reason": f"stage={context.current_stage}; complete={bool(base.get('complete'))}; "
                  f"priorities={context.domain_priorities[:3]}",
    }


def _is_repairable(reasons: list[str]) -> bool:
    """V6: which validator rejections are worth a single targeted repair-retry. Only grounding misses
    (ungrounded numbers / unsupported relationship claims) — NOT advice/medical/legal/tax overreach, which
    must fall back rather than be coaxed into a rephrase."""
    txt = " ".join(reasons).lower()
    if "advice" in txt or "medical" in txt or "legal" in txt:
        return False
    return ("invented numbers" in txt) or ("relationship" in txt)


def _compose(safe: dict[str, Any]) -> str:
    """Assemble the human-facing message as the V3 five-section advisor turn, exposing the reasoning the
    model already performs: Decision Frame → Tradeoffs → What We Know → What We Still Need → Best Next
    Question. Every section here was already trust-checked by validate(); we only format it. Sections are
    rendered only when present, so sparse early-discovery turns stay clean. Falls back to the legacy
    reflection/summary/question shape if a turn predates the V3 fields.
    """
    parts: list[str] = []

    frame = str(safe.get("decision_frame") or safe.get("reflection") or "").strip()
    if frame:
        parts.append(frame)

    tradeoffs = safe.get("tradeoffs") or []
    rows = []
    for t in tradeoffs:
        if not isinstance(t, dict):
            continue
        opt = str(t.get("option") or "").strip()
        ben = str(t.get("benefit") or "").strip()
        cost = str(t.get("cost") or "").strip()
        if not (opt or ben or cost):
            continue
        if ben and cost:
            rows.append(f"- **{opt}** — {ben}; but {cost}" if opt else f"- {ben}; but {cost}")
        else:
            rows.append(f"- **{opt}** — {ben or cost}" if opt else f"- {ben or cost}")
    if rows:
        parts.append("**The tradeoffs:**\n" + "\n".join(rows))

    know = [str(x).strip() for x in (safe.get("what_we_know") or []) if str(x).strip()]
    if know:
        parts.append("**What we know:**\n" + "\n".join(f"- {k}" for k in know))

    rec = str(safe.get("recommendation") or "").strip()  # V4: grounded, validator-checked recommendation
    if rec:
        parts.append("**My read:** " + rec)

    need = [str(x).strip() for x in (safe.get("what_we_still_need") or []) if str(x).strip()]
    if need:
        parts.append("**What would change this:**\n" + "\n".join(f"- {n}" for n in need))

    s = str(safe.get("summary") or "").strip()
    if s:
        parts.append(s)

    q = str(safe.get("next_question") or "").strip()
    why = str(safe.get("why_this_question") or "").strip()
    if q:
        parts.append(f"**{q}**")
        if why:
            parts.append(f"_{why}_")

    if rec:  # V4: a grounded recommendation carries a light, deterministic scope disclaimer
        parts.append("_This is general planning guidance based on what you've shared, not personalized "
                     "financial, legal, or tax advice — confirm specifics with a licensed professional._")

    return "\n\n".join(parts).strip()


class AdvisorOrchestrator:
    def __init__(self, relationship_manager: Any, context_builder: AdvisorContextBuilder, llm: AdvisorLLM,
                 *, enabled: bool = True, supabase: Any = None, router: Any = None) -> None:
        self._rm = relationship_manager
        self._ctx = context_builder
        self._llm = llm
        self._enabled = enabled
        self._sb = supabase  # best-effort advisor-turn persistence (ops.advisor_turns)
        self._router = router  # optional ModelRouter; only used when MODEL_ROUTER_ENABLED (default off)
        self.prompt_version = ADVISOR_PROMPT_VERSION

    def _health_safety_check(self, message: str, base: dict[str, Any], tr: dict[str, Any]) -> bool:
        """Deterministic urgent-care safety net (no LLM). If triggered, overwrite the reply with a safety-first
        response and return True so the caller skips the LLM entirely. Gated by HEALTH_SAFETY_FALLBACK_ENABLED
        (default ON). Fixes the observed generic-fallback-on-chest-pain failure."""
        if not reg.flag("HEALTH_SAFETY_FALLBACK_ENABLED"):
            return False
        indicator = detect_health_urgent(message)
        if not indicator:
            return False
        base["assistant_message"] = health_safety_response(indicator)
        base["llm_status"] = "safety_fallback"
        base["pending_key"] = base.get("pending_key") or ""
        tr["safety_flags"] = [indicator]
        tr["llm_status"] = "safety_fallback"
        log.info(json.dumps({"event": "advisor_safety_fallback", "turn_id": tr["turn_id"],
                             "user": tr.get("user_id"), "indicator": indicator}))
        return True

    def _route(self, ctx: UserContext, message: str, context_obj: Any, tr: dict[str, Any]) -> tuple[Any, Any]:
        """Select (primary_llm, fallback_llm) for this turn. Default (router off) → the DI-provided single LLM,
        so production behavior is unchanged. Never raises."""
        if not (reg.flag("MODEL_ROUTER_ENABLED") and self._router is not None):
            return self._llm, None
        try:
            tier = str(getattr(ctx, "plan_tier", "") or getattr(ctx, "tier", "") or "free")
            decision = self._router.route(message=message, tier=tier, tenant_id=str(getattr(ctx, "tenant_id", "") or ""),
                                          user_id=str(ctx.user_id), context=context_obj)
            tr["routing"] = decision.to_log()
            log.info(json.dumps({"event": "model_route", "turn_id": tr["turn_id"], **decision.to_log()}))
            return (decision.primary_llm or self._llm), decision.fallback_llm
        except Exception as e:  # noqa: BLE001 — routing must never break the turn
            tr["routing_error"] = type(e).__name__
            return self._llm, None

    def _init_trace(self, message: str, conversation_id: Optional[str], user_id: str) -> dict[str, Any]:
        # Per-turn telemetry (P0.1/P0.4/P0.5) — stage timings + outcome, logged + best-effort persisted.
        return {
            "turn_id": str(uuid.uuid4()), "conversation_id": conversation_id, "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(), "prompt_version": self.prompt_version,
            "llm_status": "", "validator_result": "n/a", "validator_reason": "", "validator_repairs": [],
            "fallback_used": False, "fallback_reason": "", "stages_ms": {}, "latency_ms": 0,
            "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0,
            "graph_edges_available": 0, "relationships_referenced": [], "confidence": None,
            "llm_response_raw": "", "user_message": (message or "")[:4000], "advisor_response": "",
        }

    async def _fetch_history(self, ctx: UserContext, conversation_id: Optional[str]) -> list[dict[str, str]]:
        """P0.1 cross-turn context — read the recent turns of THIS conversation from the existing telemetry
        table (analytics.advisor_turns). No new store/schema. Tenant-scoped (user_id AND conversation_id);
        best-effort (returns [] on any failure or when there's no conversation_id). Oldest-first."""
        if not conversation_id or self._sb is None:
            return []
        try:
            rows = await self._sb.select(
                "advisor_turns",
                columns="user_message,advisor_response,created_at",
                filters={"user_id": f"eq.{ctx.user_id}", "conversation_id": f"eq.{conversation_id}"},
                order="created_at.desc", limit=6, schema="analytics",
            )
            rows = list(reversed(rows or []))  # oldest-first
            return [{"user": str(r.get("user_message") or ""), "advisor": str(r.get("advisor_response") or "")}
                    for r in rows if r.get("user_message")]
        except Exception:  # noqa: BLE001 — context is an enhancement; never break the turn
            return []

    async def _enhance(self, base: dict[str, Any], ctx: UserContext, message: str, tr: dict[str, Any], lap,
                       history: Optional[list[dict[str, str]]] = None, llm: Any = None,
                       fallback_llm: Any = None) -> None:
        """LLM enhancement: build context → generate → validate → compose. Mutates base + tr in place.
        Never raises — on any failure, base keeps its deterministic fallback text and llm_status is set.
        `llm` is the routed model for this turn (defaults to the DI LLM); `fallback_llm` (if provided by the
        router) is tried once when the primary is unavailable — a provider-failure fallback that is invisible
        to the user. Shared by converse()/converse_stream() so both paths produce identical outcomes."""
        active = llm or self._llm
        try:
            context = await self._ctx.build(ctx, message, base, history or [])
            lap("context_build")
            constraints = build_constraints(base, context)
            lap("plan")
            out = await active.generate(context, constraints)
            if out is None:
                # One retry: transient provider failures (502/timeout/truncated JSON) surface as None.
                out = await active.generate(context, constraints)
                tr["llm_retry"] = True
            if out is None and fallback_llm is not None:
                # Provider-failure fallback: the routed primary is unavailable — drop to the fallback model
                # once (still re-validated below). User never sees a provider error.
                active = fallback_llm
                out = await active.generate(context, constraints)
                tr["model_fallback"] = True
            lap("llm_generate")
            usage = getattr(active, "last_usage", {}) or {}
            tr["prompt_tokens"], tr["completion_tokens"], tr["total_tokens"] = (
                usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), usage.get("total_tokens", 0))
            tr["llm_response_raw"] = getattr(active, "last_raw", "") or ""
            tr["graph_edges_available"] = len(getattr(context, "relationship_edges", []) or [])
            if out is None:
                base["llm_status"] = "fallback:unavailable"
                tr["fallback_used"], tr["fallback_reason"], tr["validator_result"] = True, "llm_unavailable_or_unparseable", "n/a"
                return
            ok, safe, reasons = validate(out, context)
            lap("validate")
            if not ok and _is_repairable(reasons):
                # V6 graceful degradation: rather than drop a near-complete, high-quality reply to the generic
                # opener over one ungrounded number, give the model ONE targeted chance to remove the specific
                # offending items and re-validate. The repaired output passes through the SAME validator — this
                # is resilience (keep the grounded counsel), not a weaker gate.
                repair_plan = dict(constraints)
                repair_plan["repair_note"] = (
                    "Your previous draft was rejected for: " + "; ".join(reasons) + ". Return the SAME "
                    "six-section answer but REMOVE every ungrounded number and every relationship claim listed "
                    "— state those points qualitatively instead (e.g. 'a larger down payment', 'several months "
                    "of expenses'), or, for a number that computes from the user's OWN figures, put it in "
                    "derivations. Change nothing else; keep all grounded content.")
                out2 = await active.generate(context, repair_plan)
                tr["repair_retry"] = True
                if out2 is not None:
                    ok2, safe2, reasons2 = validate(out2, context)
                    if ok2:
                        ok, safe, reasons = ok2, safe2, reasons2
                        tr["validator_result"] = "repaired_retry"
                lap("repair")
            if not ok:
                base["llm_status"] = "fallback:" + ("; ".join(reasons))[:140]
                tr["fallback_used"], tr["fallback_reason"], tr["validator_result"], tr["validator_reason"] = (
                    True, "; ".join(reasons), "rejected", "; ".join(reasons))
                return
            composed = _compose(safe)
            lap("compose")
            if not composed:
                base["llm_status"] = "fallback:empty"
                tr["fallback_used"], tr["fallback_reason"], tr["validator_result"] = True, "empty_composed", "accepted"
                return
            # Merge: only the human-facing text changes; all deterministic outcomes are preserved.
            base["assistant_message"] = composed
            base["llm_status"] = "enhanced"
            base["prompt_version"] = self.prompt_version
            if safe.get("missing_data"):
                base["missing_data"] = safe["missing_data"]  # advisory display only — not persisted
            if safe.get("relationships_referenced"):
                base["relationships_referenced"] = safe["relationships_referenced"]  # real cited edges
            tr["validator_result"] = "repaired" if safe.get("_repairs") else "accepted"
            tr["validator_repairs"] = safe.get("_repairs") or []
            tr["relationships_referenced"] = safe.get("relationships_referenced") or []
        except Exception as e:  # noqa: BLE001 — never break the user experience
            base["llm_status"] = "fallback:error"
            tr["fallback_used"], tr["fallback_reason"], tr["validator_result"] = True, f"error:{type(e).__name__}", "n/a"

    async def converse(self, ctx: UserContext, message: str, pending_key: Optional[str] = None,
                       *, conversation_id: Optional[str] = None, trace: bool = False) -> dict[str, Any]:
        t0 = time.perf_counter()
        tr = self._init_trace(message, conversation_id, ctx.user_id)
        mark = t0

        def lap(name: str) -> None:
            nonlocal mark
            now = time.perf_counter()
            tr["stages_ms"][name] = round((now - mark) * 1000, 1)
            mark = now

        # 1) Deterministic turn — persistence (candidate/rejected goals), canonical writes, safe fallback text.
        base = await self._rm.converse(ctx, message, pending_key)
        lap("deterministic_turn")
        # Health urgent-care safety net runs BEFORE any model (deterministic, no LLM).
        if self._health_safety_check(message, base, tr):
            return self._finish(ctx, base, tr, t0, trace)
        if not self._enabled:
            tr["llm_status"] = base.get("llm_status") or "disabled"
            return self._finish(ctx, base, tr, t0, trace)
        history = await self._fetch_history(ctx, conversation_id)
        lap("history_fetch")
        primary_llm, fallback_llm = self._route(ctx, message, None, tr)
        await self._enhance(base, ctx, message, tr, lap, history, primary_llm, fallback_llm)
        return self._finish(ctx, base, tr, t0, trace)

    async def converse_stream(self, ctx: UserContext, message: str, pending_key: Optional[str] = None,
                              *, conversation_id: Optional[str] = None, trace: bool = False):
        """Progressive variant: yield a fast deterministic ACK first (the trust-safe text we'd show on
        fallback anyway, ready in ~1s), then the fully validated enhanced answer. Same telemetry/persistence
        as converse(). The validator still gates everything the user accepts as advice — the ack only mirrors
        the deterministic engine, which never fabricates. Yields event dicts: {"type": "ack"|"final", ...}."""
        t0 = time.perf_counter()
        tr = self._init_trace(message, conversation_id, ctx.user_id)
        mark = t0

        def lap(name: str) -> None:
            nonlocal mark
            now = time.perf_counter()
            tr["stages_ms"][name] = round((now - mark) * 1000, 1)
            mark = now

        base = await self._rm.converse(ctx, message, pending_key)
        lap("deterministic_turn")
        # Health urgent-care safety net runs BEFORE the ack so an urgent message never shows the generic
        # opener first. If triggered, the safety reply IS the ack and the final.
        if self._health_safety_check(message, base, tr):
            yield {"type": "ack", "assistant_message": base["assistant_message"],
                   "pending_key": base.get("pending_key") or "", "turn_id": tr["turn_id"]}
            self._finish(ctx, base, tr, t0, trace)
            yield {"type": "final", **base}
            return
        # Fast first paint — the deterministic, trust-safe acknowledgment.
        yield {"type": "ack", "assistant_message": base.get("assistant_message") or "",
               "pending_key": base.get("pending_key") or "", "turn_id": tr["turn_id"]}
        if self._enabled:
            history = await self._fetch_history(ctx, conversation_id)
            lap("history_fetch")
            primary_llm, fallback_llm = self._route(ctx, message, None, tr)
            await self._enhance(base, ctx, message, tr, lap, history, primary_llm, fallback_llm)
        else:
            tr["llm_status"] = base.get("llm_status") or "disabled"
        self._finish(ctx, base, tr, t0, trace)  # log + best-effort persist + (optional) attach _trace
        yield {"type": "final", **base}

    def _finish(self, ctx: UserContext, base: dict[str, Any], tr: dict[str, Any], t0: float, trace: bool) -> dict[str, Any]:
        """Finalize telemetry: stamp latency/outcome, emit a metadata log line, best-effort persist, and
        attach the full trace only when explicitly requested (dev trace mode)."""
        tr["latency_ms"] = round((time.perf_counter() - t0) * 1000, 1)
        tr["llm_status"] = base.get("llm_status") or tr.get("llm_status") or ""
        tr["advisor_response"] = base.get("assistant_message") or ""
        # Metadata-only log line (no full message/response/raw → keeps PII out of logs).
        log.info(json.dumps({
            "event": "advisor_turn", "turn_id": tr["turn_id"], "user": ctx.user_id,
            "llm_status": tr["llm_status"], "validator_result": tr["validator_result"],
            "fallback": tr["fallback_used"], "fallback_reason": tr["fallback_reason"],
            "repairs": tr["validator_repairs"], "latency_ms": tr["latency_ms"], "stages_ms": tr["stages_ms"],
            "tokens": tr["total_tokens"], "edges": tr["graph_edges_available"], "msg_len": len(tr.get("user_message") or ""),
        }))
        # Best-effort durable write (analytics.advisor_turns, service-role only). Swallow if table absent.
        # jsonb columns (stages_ms / relationships_referenced / validator_repairs) are passed as native
        # dict/list — PostgREST serializes the row to JSON, so they land as jsonb objects/arrays (NOT
        # double-encoded JSON strings).
        if self._sb is not None:
            row = {**tr, "advisor_response": tr["advisor_response"][:4000],
                   "llm_response_raw": (tr["llm_response_raw"] or "")[:8000]}
            try:
                import asyncio
                task = asyncio.ensure_future(self._persist(row))
                _PENDING_WRITES.add(task)  # hold a strong ref so the task isn't GC'd before it completes
                task.add_done_callback(_PENDING_WRITES.discard)
            except Exception:  # noqa: BLE001
                pass
        # Best-effort usage ledger increment (atomic via analytics.bump_model_usage). Default OFF
        # (USAGE_TRACKING_ENABLED) and swallows errors → no behavior change until the migration is applied.
        if self._sb is not None and reg.flag("USAGE_TRACKING_ENABLED"):
            try:
                import asyncio
                t = asyncio.ensure_future(self._persist_usage(ctx, tr))
                _PENDING_WRITES.add(t)
                t.add_done_callback(_PENDING_WRITES.discard)
            except Exception:  # noqa: BLE001
                pass
        if trace:
            base["_trace"] = tr
        return base

    async def _persist(self, row: dict[str, Any]) -> None:
        try:
            await self._sb.insert("advisor_turns", row, schema="analytics")
        except Exception:  # noqa: BLE001 — table may not exist yet; logging still works
            pass

    async def _persist_usage(self, ctx: UserContext, tr: dict[str, Any]) -> None:
        """Atomic per-turn usage increment to analytics.model_usage. Premium vs standard from the routing
        decision; safety + model-fallback flags from the trace. tenant defaults to the user (single-tenant)."""
        try:
            routing = tr.get("routing") or {}
            premium = bool(routing.get("premium"))
            period = datetime.now(timezone.utc).strftime("%Y-%m")
            tenant = str(getattr(ctx, "tenant_id", "") or ctx.user_id)
            await self._sb.rpc("bump_model_usage", {
                "p_tenant": tenant, "p_user": str(ctx.user_id), "p_period": period,
                "p_premium": 1 if premium else 0, "p_standard": 0 if premium else 1,
                "p_reports": 0, "p_safety": 1 if tr.get("safety_flags") else 0,
                "p_fallbacks": 1 if tr.get("model_fallback") else 0,
                "p_cost": float(routing.get("estimated_cost") or 0),
            }, schema="analytics")
        except Exception:  # noqa: BLE001 — best-effort; table/function may be absent pre-migration
            pass
