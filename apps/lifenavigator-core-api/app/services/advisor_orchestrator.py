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
                 *, enabled: bool = True, supabase: Any = None) -> None:
        self._rm = relationship_manager
        self._ctx = context_builder
        self._llm = llm
        self._enabled = enabled
        self._sb = supabase  # best-effort advisor-turn persistence (ops.advisor_turns)
        self.prompt_version = ADVISOR_PROMPT_VERSION

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
                       history: Optional[list[dict[str, str]]] = None) -> None:
        """LLM enhancement: build context → generate → validate → compose. Mutates base + tr in place.
        Never raises — on any failure, base keeps its deterministic fallback text and llm_status is set.
        Shared by converse() and converse_stream() so both paths produce identical outcomes/telemetry."""
        try:
            context = await self._ctx.build(ctx, message, base, history or [])
            lap("context_build")
            constraints = build_constraints(base, context)
            lap("plan")
            out = await self._llm.generate(context, constraints)
            if out is None:
                # One retry: transient Gemini failures (502/timeout/truncated JSON) surface as None and
                # otherwise drop the turn to the generic deterministic opener. The retried output still
                # passes through validate() below, so this changes resilience, not the trust gate.
                out = await self._llm.generate(context, constraints)
                tr["llm_retry"] = True
            lap("llm_generate")
            usage = getattr(self._llm, "last_usage", {}) or {}
            tr["prompt_tokens"], tr["completion_tokens"], tr["total_tokens"] = (
                usage.get("prompt_tokens", 0), usage.get("completion_tokens", 0), usage.get("total_tokens", 0))
            tr["llm_response_raw"] = getattr(self._llm, "last_raw", "") or ""
            tr["graph_edges_available"] = len(getattr(context, "relationship_edges", []) or [])
            if out is None:
                base["llm_status"] = "fallback:unavailable"
                tr["fallback_used"], tr["fallback_reason"], tr["validator_result"] = True, "llm_unavailable_or_unparseable", "n/a"
                return
            ok, safe, reasons = validate(out, context)
            lap("validate")
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
        if not self._enabled:
            tr["llm_status"] = base.get("llm_status") or "disabled"
            return self._finish(ctx, base, tr, t0, trace)
        history = await self._fetch_history(ctx, conversation_id)
        lap("history_fetch")
        await self._enhance(base, ctx, message, tr, lap, history)
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
        # Fast first paint — the deterministic, trust-safe acknowledgment.
        yield {"type": "ack", "assistant_message": base.get("assistant_message") or "",
               "pending_key": base.get("pending_key") or "", "turn_id": tr["turn_id"]}
        if self._enabled:
            history = await self._fetch_history(ctx, conversation_id)
            lap("history_fetch")
            await self._enhance(base, ctx, message, tr, lap, history)
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
        if trace:
            base["_trace"] = tr
        return base

    async def _persist(self, row: dict[str, Any]) -> None:
        try:
            await self._sb.insert("advisor_turns", row, schema="analytics")
        except Exception:  # noqa: BLE001 — table may not exist yet; logging still works
            pass
