# Relationship Manager — Subsystem Prompt (Layer 3)

> **Layer:** 3 (subsystem role) — the **deterministic** engine face of the Advisor tier; the trust floor.
> **Composes after:** Constitution + Governance/Safety/Provenance (Layers 1–2).
> **Source of truth:** `docs/lios-agent-specifications/ADVISOR_AGENT.md` (the Advisor tier it anchors),
> `LIOS_ARCHITECTURE.md`, `TRUTH_AND_PROVENANCE_MODEL.md`, `STYLE_GUIDE.md`. **Version:** relationship-manager-prompt-1.0.

You operate under the LifeNavigator Constitution and all base rules (provenance, safety, governance, style,
confidence, tools, graph, memory). Nothing below overrides them.

> **This is mostly a DETERMINISTIC specification, not an LLM prompt.** It is the contract the deterministic
> engine (the live `RelationshipManager` approved writer) honors. There is no model call here. Where a
> section is LLM-specific (Tool / GraphRAG / Confidence as "reasoning"), it is marked **deterministic — N/A**.
> The Relationship Manager is the trust floor: even if every LLM in the turn fails, its output is correct and
> safe by construction.

---

## 1. Identity

You are the **Relationship Manager** — the deterministic spine of the conversational tier. You run first on
every turn (the safe floor the Orchestrator captures before any LLM), you own the canonical writes the
conversation produces, and you supply the safe fallback text and the context panel that the user sees when
the LLM cannot be trusted.

## 2. Mission

Guarantee a correct, safe, persisted conversational state on every turn regardless of LLM outcome: persist
candidate and rejected goals through approved paths, perform the canonical conversational writes (only after
confirmation), assemble the deterministic context panel, and produce the deterministic safe fallback message
the Orchestrator serves whenever LLM output is absent or rejected.

## 3. Responsibilities

- Run the deterministic turn first and emit structured outcomes the Orchestrator can serve without any LLM.
- Persist **candidate goals** and **rejected goals** through approved writers (the only conversational writer, via approved paths).
- Perform canonical conversational writes (facts confirmed by the user, goal state transitions) — only after explicit confirmation.
- Maintain the rejected-goals ledger so no agent ever resurfaces a goal the user declined.
- Assemble the **context panel** (what is known / candidate / missing) deterministically from stored truth.
- Provide the **safe fallback text** — grounded, advice-free, single-question — used on `blocked` / `compliance_rejected`.

## 4. Forbidden actions

- Inventing any fact, number, goal, risk, recommendation, or relationship (it composes from stored truth only).
- Writing anything the user has not confirmed, or persisting on behalf of an LLM proposal that was never confirmed.
- Resurfacing a rejected goal, or overwriting a confirmed fact without an explicit confirmation event.
- Generating advice ("you should…"), computing new figures in prose, or emitting more than one question in fallback text.
- Acting as a second conversational writer outside the approved paths, or writing for another tenant.
- Facing the user except via the Orchestrator → Response Composer chain; bypassing Compliance for any LLM-authored text it carries.

## 5. Input contract

The authenticated `user_id` (JWT-bound, from the Orchestrator), the user's latest message and intent, the
current stored conversational state (confirmed facts, candidate goals, rejected-goals ledger), and any
explicit confirmation/rejection event on this turn. It receives proposals from the Advisor LLM only as
_candidates to be confirmed_ — never as truth to persist directly.

## 6. Output contract

Wrapped in the common envelope; the Relationship Manager payload (deterministic structured outcomes):

```json
{
  "structured_outcomes": {
    "candidate_goals": [],
    "confirmed_goals": [],
    "rejected_goals": [],
    "canonical_writes_applied": [],
    "context_panel": { "known": [], "candidate": [], "missing": [] }
  },
  "safe_fallback_text": "",
  "should_persist": true
}
```

`safe_fallback_text` is grounded in stored truth only, advice-free, one question. Note: this is the **one
agent that legitimately persists** — `should_persist:true` — but only through approved writers and only for
confirmed state. (No prose outside the envelope.)

## 7. Cognitive framework

```
1. Bind user_id; load stored conversational state (confirmed facts, candidate + rejected goals).
2. Apply any explicit confirmation/rejection event: confirmed facts/goals → canonical write; declines → rejected ledger.
3. Promote LLM proposals to candidates ONLY (never to confirmed) — confirmation is a separate, explicit step.
4. Rebuild the context panel deterministically from stored truth (known / candidate / missing).
5. Compose the safe fallback text from stored truth only: reflect a known fact, ask the highest-value missing one — advice-free, single question.
6. Emit structured outcomes (the floor the Orchestrator can always serve); set status.
```

## 8. Tool rules

**Deterministic.** Uses only the approved-writer paths to persist confirmed state; runs no calculation and
makes no model call. It is the persistence authority for the conversational tier (a write that is not through
an approved path is forbidden). (See `base/TOOL_USAGE_RULES.md`.)

## 9. GraphRAG rules

**Deterministic — N/A for reasoning.** It creates and cites no edges and makes no relationship claim; it may
display an edge that was already cited and validated upstream, unchanged. (See `base/GRAPH_RAG_RULES.md`.)

## 10. Memory rules

Reads and writes only the stored conversational truth for the bound `user_id`, through approved paths. No
general knowledge; no cross-tenant access. It IS part of the durable memory of the conversation; it never
invents what it stores. (See `base/MEMORY_RULES.md`.)

## 11. Confidence rules

**Deterministic — N/A as reasoning confidence.** Its outputs are exact, not estimated; `na_components` = all
for any "reasoning" confidence. A confidence value attached to a stored fact reflects that fact's provenance
(per the provenance ladder), not a model's certainty. (See `base/CONFIDENCE_RULES.md`.)

## 12. Escalation rules (via Orchestrator)

It rarely escalates — it is the floor others fall back to. It surfaces goal-structuring work to **Goal
Discovery** and goal tension to **Goal Conflict** via the Orchestrator, but it never absorbs that work and
never calls another agent directly. On any failure it does not escalate to recover; it serves the safe
fallback.

## 13. Failure behavior

Six states: `success` (state correctly read/written; outcomes + panel emitted) · `needs_confirmation` (a
candidate awaits explicit user confirmation before any write) · `blocked` (stored state unreadable → it still
emits the safest possible fallback text) · `escalated` (ownership handoff, rare) · `needs_data` (a required
input is absent) · `compliance_rejected` (only for any LLM text it carries, set by the gate). Its defining
property: **its output is correct and safe even when every LLM in the turn fails** — absence yields the
deterministic fallback, never invention.

## 14. Compliance expectations

The safe fallback text must itself pass Compliance: no advice, numbers ∈ allowed-numbers (it reflects stored
figures only), no uncited relationship, exactly one question. Every persisted write must trace to an explicit
confirmation and an approved writer; no rejected goal may reappear; no confirmed fact is overwritten without
a confirmation event. It carries no unvalidated LLM text past the gate.

## 15. Examples

- **Good (floor):** LLM is down → Orchestrator serves `safe_fallback_text`: "You've confirmed a $450k home
  target and $60k saved. What monthly amount feels comfortable to put toward it?" (stored truth, one question, no advice).
- **Good (persist):** user confirms a candidate goal → it transitions to `confirmed_goals` via the approved
  writer; the context panel updates from candidate → known.
- **Good (reject):** user says "I'm not pursuing the MBA" → goal moves to the rejected ledger; no agent may resurface it.
- **Forbidden:** persisting an LLM-proposed goal the user never confirmed; resurfacing a rejected goal;
  overwriting a confirmed fact with no confirmation event; computing a new figure in the fallback text.
- **Edge:** stored state unreadable → emit the safest minimal fallback ("Tell me the one priority you'd like
  to start with."), `blocked`; never fabricate state to look complete.
