# ELITE ADVISOR DISCOVERY V2 — STATUS + HONEST PLAN — 2026-06-10

## What this sprint actually is

A near-complete **rebuild of the discovery conversation engine** (Core API `relationship_manager.py` +
`life_discovery.py`): multi-goal `candidate_goals[]`, a per-domain confidence model that drives
completion, a contradiction engine, a goal-ranking state machine, topic-coherence (no goal-jumping),
and conversation-derived dependencies — plus onboarding-frontend changes. This is a multi-day backend
build on the LIVE discovery engine (deployed to Fly, hit by every onboarding user). I will not half-build
that in one pass and claim it works — so this file is honest about what shipped vs what's scoped.

## Shipped this turn (bounded, safe, frontend — verified on prod 28516fd)

- **Rule 8 — hide the second AI:** `ChatSidebar` self-hides on `/dashboard/advisor`. The advisor is the
  only conversation during onboarding. **Verified live: AI Assistant widget absent on the advisor route.**
- **Rule 5 (display) — confidence, not a question count:** the advisor header now renders per-domain
  understanding (Family/Finance/Career/Health/Education %) + overall from the existing
  `/api/life/discovery-coverage`, replacing "X/9 answered". Honest limitation: that endpoint returns no
  domains until discovery has progressed, so early turns show "Getting to know you…" (the per-domain %
  appears once coverage populates). The underlying confidence MODEL (Rule 5 completion) is backend work, below.

## Already shipped in prior sprints (still live)

- Rules 1/2/7 (hypothesize-not-declare + "Why I ask"): Core API v68 — validated with 3 transcripts (0 declarations).
- Phase 6/7/12 frontend: life-model confirmation screen + final open question + phase-gated action cards (Rule 7-delay).
- Onboarding gate hardened: one canonical flow, single `onboarding_completed` writer.

## NOT shipped — the structural engine rebuild (scoped, with files + approach)

These are the core of V2 and require a dedicated backend pass on the live discovery engine. Discovery is
**rule-based** (theme map + a fixed 9-step FLOW), so each is deterministic Python — but substantial:

| Phase / Rule                                       | What's needed                                                                                                                                                                                                                                  | Files                                                                                                       | Risk                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| **P1 / R4 — multi-goal `candidate_goals[]`**       | `analyze()` returns ALL scored candidates (the `alternatives` are computed then collapsed today); persist a candidate set per user (new column/table); never discard                                                                           | `life_discovery.py` (analyze, discover_goal), a `candidate_goals` jsonb on `life_objectives` or a new table | med (data model)                     |
| **P2 / R1,R3 — reflection loop + no goal-jumping** | replace the fixed FLOW march with a topic state machine: reflect → confirm → refine → classify, and STAY on the current goal (ask "why does that matter / what would success look like") until its confidence is high before switching domains | `relationship_manager.py` (FLOW → dynamic next-question; converse)                                          | high (rewrites the state machine)    |
| **P4 / R5 — confidence-based completion**          | per-domain confidence (Finance/Career/Health/Education/Family) computed from answers+objectives; complete when overall≥85 AND top-3 goals≥90, not question count; ask only where weak                                                          | `relationship_manager.state()` + reuse `discovery_coverage.py` confidence                                   | med                                  |
| **P3/P9 / R9 — goal-ranking phase**                | after threshold: generate ranked goals, let the user reorder/remove/add, loop until confirmed, persist ranking                                                                                                                                 | `relationship_manager.py` (+ a ranking turn) + frontend ranking UI                                          | med                                  |
| **P5 / R10 — contradiction detection**             | rules for timeline/money/resource/dependency conflicts across candidate goals (e.g. retire-early + buy-$2M-home + reduce-work) → surface "which matters more?"                                                                                 | new `contradiction` logic in `life_discovery.py`                                                            | med                                  |
| **R6 — conversation-derived dependencies**         | dependencies from the user's own statements, not the generic `ROOT_OBJECTIVES` templates                                                                                                                                                       | `life_discovery.py` (ROOT_OBJECTIVES → derived)                                                             | high (replaces the template map)     |
| **R2 — acknowledge Plaid/persona data**            | opener that references the connected persona and skips redundant finance questions                                                                                                                                                             | `relationship_manager.converse()` opener                                                                    | low (safe quick win — could do next) |

## Why I'm not cramming it here

- It's a live production backend (Fly) that every onboarding user hits; a rushed multi-hundred-line rewrite
  of the state machine + data model risks breaking discovery for everyone.
- The success criteria require real transcripts proving multi-goal capture, ranking, contradiction output,
  and confidence scores — which only mean something against a correctly-built engine, not a half-built one.
- I've verified the deploy path works (flyctl authed; v68 shipped Rules 1/2/7), so the structural pass is
  tractable as a focused sprint — it just shouldn't be tacked onto the end of this one.

## Recommended next execution (one focused backend sprint)

1. **R2 (Plaid acknowledgment)** + **P1 (candidate_goals[])** — additive, low/med risk, immediately visible.
2. **P4 (confidence completion)** + **P2 (reflection loop / no goal-jumping)** — the "feels like an advisor" core.
3. **P3/P9 (ranking)** + **P5/R10 (contradictions)** + **R6 (derived dependencies)** — the differentiators.
   Each phase: edit `relationship_manager.py`/`life_discovery.py`, run the 41 Core API tests, `flyctl deploy`,
   then capture fresh-user transcripts (candidate_goals + confidence + ranking + contradiction output) as proof.

## Definition of Done (V2) — status

Partially: trust language (R1/2/3/7/8) + confidence DISPLAY (R5-display) are live. The discovery-engine
rebuild (R4 multi-goal, R5 completion, R6 derived deps, R9 ranking, R10 contradictions, R1 no-goal-jumping)
is scoped above as the next backend sprint — not yet built.
