# LIOS Multi-Agent Execution Patterns

> **Design/spec only — Phase 3.** No code, no Gemini wiring, no runtime, no Vertex, no beta change, no deploy.
> These are the reusable shapes the Orchestrator composes; each `WORKFLOW_LIBRARY.md` workflow is an instance
> of one (or two) of these patterns. Nothing here invents an agent responsibility or lets any agent bypass
> Compliance.
>
> **Derived from:** `EXECUTION_ARCHITECTURE.md`, `ORCHESTRATION_ENGINE.md`,
> `docs/lios-agent-specifications/AGENT_INTERACTION_CONTRACTS.md`, `DECISION_LIFECYCLE.md`, and the eleven task
> prompts in `docs/lios-prompt-operating-system/tasks/*.md`.

---

## 0. What a "pattern" is and the rules every pattern obeys

A pattern is a **reusable agent shape** — a deterministic DAG fragment the Orchestrator selects by rule
(`ORCHESTRATION_ENGINE.md` §3). Every pattern, regardless of shape, obeys:

- **Deterministic turn first.** The Relationship Manager runs before any LLM agent — the trust floor. A safe
  response exists even if every LLM fails (`EXECUTION_ARCHITECTURE.md` §1).
- **Single entry/exit = the Orchestrator.** Agents never call each other; they return `escalated{to, reason,
blocking}` and the Orchestrator routes (`AGENT_INTERACTION_CONTRACTS.md` §1).
- **Acyclic + hop-bounded.** No self-loops, no cycles; the Orchestrator rejects a route revisiting an agent on
  the chain; over-cap → deterministic fallback (`ORCHESTRATION_ENGINE.md` §6).
- **Compliance before the user.** No LLM-authored text reaches the user without passing the Compliance gate;
  only the Response Composer (post-Compliance) emits user-facing text.
- **Numbers from tools with a trace; no rec without evidence; models-not-decides.**
- **Audit at every stage** (omitted from diagrams for brevity; it bookends every pattern).

**Notation:** `∥` = parallel group · `→` = serial dependency · `[X?]` = conditional stage · `det` = the
deterministic turn.

**Pattern → status at a glance:**

| Pattern        | Status                                                           | Backbone           |
| -------------- | ---------------------------------------------------------------- | ------------------ |
| Advisor        | **LIVE** today (generalized from `AdvisorOrchestrator.converse`) | conversation turn  |
| Analysis       | **PLANNED** (parallel multi-domain)                              | read-heavy fan-out |
| Recommendation | **PARTIAL** (decision brain live; full chain planned)            | decision pipeline  |
| Monitoring     | **PLANNED** (re-model-on-change from the lifecycles)             | triggered delta    |
| Discovery      | **PARTIAL** (discovery live; candidate-only persistence planned) | onboarding + gaps  |

---

## 1. Advisor Pattern — conversation-driven

**Intent.** Answer a conversational / discovery turn with a single, governed reply; **single-question
discovery** (ask the one most-decisive thing, never a battery of questions).

**Agent shape.**

```
det ─▶ intent(discovery) ─▶ Memory(+GraphRAG read) ─▶ Advisor ─▶ Compliance ─▶ [Critic?] ─▶ Response Composer
                                                          │
                                                          └─▶ Missing Data (highest-value gap)
```

- **When to use.** Any conversational/discovery intent — open questions, reflections, "what should I think
  about," follow-ups. The default path when no decision or multi-domain analysis is implicated
  (`ORCHESTRATION_ENGINE.md` §3, "Advisor runs for any conversational/discovery intent").
- **Parallel vs serial.** Almost entirely **serial** — the Advisor consumes Memory's bounded context, then
  Compliance, then Composer. Memory's GraphRAG/Doc-Intel reads may be parallel-safe internally; the user-facing
  chain is serial.
- **Compliance touchpoint.** Mandatory after the Advisor, before the Composer. Critic runs only if a
  high-stakes claim surfaces (rare on a pure conversation turn).
- **Failure / escalation.** LLM unavailable → deterministic turn already produced safe text (the floor).
  Advisor returns `needs_data` → route to Missing Data for the single decisive gap. Advisor `escalated` (e.g.
  the turn is actually a decision) → Orchestrator re-routes to the Recommendation Pattern.
- **Example.** "I've been thinking about whether I'm doing okay financially." → det turn grounds the panel;
  Memory loads bounded context; Advisor reflects + asks the _one_ most-decisive question; Compliance passes;
  Composer renders. (Canonical pipeline, `AGENT_INTERACTION_CONTRACTS.md` §5, "Conversation/discovery turn.")
- **Status: LIVE** — generalizes the live `AdvisorOrchestrator.converse`/`converse_stream` path.

---

## 2. Analysis Pattern — multi-domain, read-heavy

**Intent.** Assemble a grounded cross-domain picture by running independent domain agents in parallel, then
reconciling disagreements into framed tradeoffs. Read-heavy; no decision verdict.

**Agent shape.**

```
                    ┌ Finance ─┐
det ─▶ intent ─▶    │ Family   │  (∥ — independent domain agents)
    [graph_plan ∥   │ Career   │
     tool_plan]     │ Education│
                    │ Health   │
                    └────┬─────┘
                         ▼
              Conflict Resolution ─▶ Compliance ─▶ [Critic?] ─▶ Response Composer
```

- **When to use.** Intent implicates ≥2 domains but is **not** a decision (e.g. "give me a picture of where I
  stand"). Each domain agent runs IFF (domain ∈ implicated) AND (has data OR the intent needs its
  missing-data list) (`ORCHESTRATION_ENGINE.md` §3).
- **Parallel vs serial.** **Parallel** across independent domain agents and across `graph_plan ∥ tool_plan`
  (`ORCHESTRATION_ENGINE.md` §5). **Serial** for Conflict Resolution (needs all domain outputs), Compliance,
  and the Composer. Tool chains _within_ a domain that have data dependencies are serial.
- **Compliance touchpoint.** After Conflict Resolution, before the Composer. Critic runs if risk is
  high/regulated or a cross-domain claim is asserted (`ORCHESTRATION_ENGINE.md` §3).
- **Failure / escalation.** A domain agent `blocked` → that branch degrades, the rest proceed (deterministic
  floor still answers). Domains conflict → Conflict Resolution down-weights confidence and surfaces an **open
  tradeoff, not an error** (`EXECUTION_ARCHITECTURE.md` §3, stage 6). A cross-domain claim asserted without a
  cited real edge → dropped (citation contract).
- **Example.** "How does my career situation affect my finances?" → Finance ∥ Career run; Conflict Resolution
  frames where they pull against each other (only via a cited edge); Compliance gates; Composer renders.
- **Status: PLANNED** — the parallel multi-domain fan-out is the design target; today's path is sequential.

---

## 3. Recommendation Pattern — decision-focused, evidence-or-nothing

**Intent.** Model a decision from the user's real data and frame the tradeoffs; mint an evidence-backed
recommendation only when warranted. **Models, never decides.**

**Agent shape.**

```
det ─▶ intent(decision) ─▶ ┌ Domain agent(s) ─┐ (∥ where independent)
                           └────────┬──────────┘
                                    ▼
   Decision Scientist ─▶ Scenario ─▶ Tradeoff ─▶ [Recommendation?] ─▶ [Critic?] ─▶ Compliance ─▶ Response Composer
```

- **When to use.** Intent = decision OR ≥2 domains conflict (`ORCHESTRATION_ENGINE.md` §3). Drives Home
  Purchase, Retirement, Education ROI, Career Change, Debt Payoff (`WORKFLOW_LIBRARY.md` §§2–4,7,8).
- **Parallel vs serial.** Domain agents may run **parallel**; the decision spine is **strictly serial** — a
  recommendation cannot precede the evidence it cites; Compliance cannot precede the content it gates
  (`ORCHESTRATION_ENGINE.md` §4). Tool chains are serial when data-dependent (affordability → mortgage →
  cash-flow).
- **Compliance touchpoint.** After Recommendation/Critic, before the Composer. Critic runs if risk ∈
  {high, regulated} or the output is a decision recommendation / cross-domain claim.
- **Evidence-or-nothing.** The **Recommendation stage runs only if there is ≥1 `{statement, source_table}`
  evidence item**; otherwise it is not run and no rec is minted (`ORCHESTRATION_ENGINE.md` §3,
  `DEBT_PAYOFF_TASK.md`). Every figure is a Tool Execution `calculation_trace` (`DECISION_LIFECYCLE.md` §3).
- **Failure / escalation.** Decision Scientist reports required inputs absent → `needs_data`; the Orchestrator
  does **not** force a low-confidence decision through (`ORCHESTRATION_ENGINE.md` §7). Engine can't simulate →
  honest limitation, never a guessed outcome (`DECISION_LIFECYCLE.md` §9). User pushes "just tell me" → hold
  the advice boundary, reflect tradeoffs + the decisive gap.
- **Example.** "Should I pay off my card or invest?" → Finance → Decision Scientist frames pay-off-vs-invest →
  Scenario/Tradeoff with traces → if a 24% APR balance + reserves-on-record evidence exists, Recommendation
  mints an ACTION rec _with basis_ → Critic (regulated) → Compliance → Composer.
- **Status: PARTIAL** — the decision brain (traceable numbers, models-not-decides) is live; the full
  Decision Scientist → Scenario → Tradeoff → Recommendation → Critic chain is the design target.

---

## 4. Monitoring Pattern — ongoing / triggered updates

**Intent.** When the user's data changes (new document, connected-account update, life event, market change),
re-evaluate risks/recommendations and surface the **deltas** — the re-model-on-change path from the lifecycles.

**Agent shape.**

```
data change ─▶ det(re-evaluate) ─▶ ┌ affected domain agent(s) ─┐ (∥)
                                   └────────────┬──────────────┘
                                                ▼
              re-eval risks/recs ─▶ Decision Scientist (revisit?) ─▶ Compliance ─▶ Response Composer (deltas)
```

- **When to use.** A trigger fires — not a user message but a change event. Decisions are **revisitable**:
  inputs change → re-model; a decision can reopen (`DECISION_LIFECYCLE.md` §6, state `revisited`). Risks and
  recommendations follow their own lifecycles and re-evaluate on new truth.
- **Parallel vs serial.** Affected domain re-evaluations may run **parallel**; the re-model → revisit →
  Compliance → Composer chain is **serial**. Only changed domains run — silence is cheaper than a no-op
  (`ORCHESTRATION_ENGINE.md` §3).
- **Compliance touchpoint.** Mandatory before any surfaced delta reaches the user — a re-modeled figure is
  still LLM-adjacent output and must pass the gate; figures still come from Tool Execution with a trace.
- **Failure / escalation.** No material delta → surface nothing (avoid noise). A changed input that reopens a
  _tracked_ decision → route to the Recommendation Pattern to re-model (`any → revisited → modeled`,
  `DECISION_LIFECYCLE.md` §3). Trigger storm → debounce/coalesce at the Orchestrator (deterministic).
- **Example.** A new pay stub raises income on record → Finance re-evaluates → the affordability picture and a
  prior reserves risk are re-modeled with fresh traces → Compliance → Composer surfaces "your affordability
  picture changed because income updated," not the whole report again.
- **Status: PLANNED** — `DECISION_LIFECYCLE.md` §11 lists re-model-on-change + reopen as planned; this pattern
  is the design for that path.

---

## 5. Discovery Pattern — onboarding + missing-data collection

**Intent.** Bring a cold-start or thin-data user from nothing to a usable picture by discovering goals and
collecting the highest-value missing data — **candidate-only; never persist without explicit confirmation.**

**Agent shape.**

```
det ─▶ intent(discovery) ─▶ Onboarding/Advisor ─▶ Goal Discovery ─▶ Goal Conflict
                                  │                                      │
                                  └─▶ Missing Data (rank gaps) ──────────┤
                                                                         ▼
                                                  Compliance ─▶ Response Composer
                            (confirmable outcomes staged ONLY via the deterministic turn, on user confirm)
```

- **When to use.** First contact, or any turn where the highest-value gap is unclear / a domain returned
  `needs_data` (`ORCHESTRATION_ENGINE.md` §3, "Missing Data runs IFF…"). Onboarding → Goal Discovery → Goal
  Conflict is the canonical referral chain (`AGENT_INTERACTION_CONTRACTS.md` §2).
- **Parallel vs serial.** **Serial** — Goal Conflict needs Goal Discovery's output; Missing Data ranks against
  the discovered goals. Discovery is a single-question flow (ask the one most-decisive gap), not a survey.
- **Compliance touchpoint.** Before the Composer, as always. Lower stakes (`risk_level: low`) but still gated —
  the system must never assert facts about the user that aren't on record.
- **Candidate-only persistence.** Discovered goals and collected data are **proposals**, not stored truth. The
  LLM never persists (`EXECUTION_ARCHITECTURE.md` §5, invariant 1); only the **deterministic turn** stages a
  confirmable outcome, and only **on explicit user confirmation** (`DECISION_LIFECYCLE.md` §6, choices are
  `user_stated` events; tracking uses confirmed goals only).
- **Failure / escalation.** Empty graph → abstain from relationship claims (`EXECUTION_ARCHITECTURE.md` §3,
  stage 3). Goal conflict detected → surface it as a tradeoff for the user to resolve, never auto-resolve. User
  declines to confirm → nothing persists; the candidate is discarded.
- **Example.** New user: "I just signed up, where do I start?" → det turn; Onboarding opens; Goal Discovery
  proposes candidate goals; Goal Conflict checks they don't collide; Missing Data ranks the single highest-value
  gap; Composer asks for it. On confirm, the deterministic turn persists the confirmed goal — not the LLM.
- **Status: PARTIAL** — discovery/goal surfacing is live; the candidate-only confirm-before-persist flow and
  formal goal tracking are the design target (`DECISION_LIFECYCLE.md` §11).

---

## 6. Pattern selection (deterministic) and composition

The Orchestrator picks a pattern by **rule**, not by model intuition (`ORCHESTRATION_ENGINE.md` §1):

| Signal                                             | Pattern            |
| -------------------------------------------------- | ------------------ |
| conversational / open / reflective intent          | **Advisor**        |
| ≥2 domains implicated, not a decision              | **Analysis**       |
| intent = decision OR ≥2 domains conflict           | **Recommendation** |
| a data-change trigger fired (not a message)        | **Monitoring**     |
| cold start / thin data / highest-value gap unclear | **Discovery**      |

**Composition.** Patterns chain via the Orchestrator only. Discovery often **precedes** Recommendation (gather
the decisive input, then model). The Advisor may **escalate** a turn it discovers is actually a decision → the
Orchestrator switches to Recommendation. Analysis may **feed** Recommendation when reconciled domains expose a
decision. All composition is acyclic and hop-bounded; no pattern lets an agent face the user before Compliance,
and no pattern mints a recommendation without evidence.

---

## 7. Invariants every pattern preserves

1. Deterministic turn first; Audit always; Compliance before the Response Composer
   (`EXECUTION_ARCHITECTURE.md` §5, `AGENT_INTERACTION_CONTRACTS.md` §6).
2. DAG only — no agent-to-agent calls, no self-loops, hop-bounded; escalate via the Orchestrator
   (`ORCHESTRATION_ENGINE.md` §6).
3. Numbers from Tool Execution with a `calculation_trace` or user data; no figure derived in prose
   (`DECISION_LIFECYCLE.md` §8).
4. No recommendation without ≥1 evidence item (`ORCHESTRATION_ENGINE.md` §3).
5. Models-not-decides on every decision; the LLM never persists and never faces the user
   (`DECISION_LIFECYCLE.md` §1).
6. Selection, ordering, parallelization, and escalation are deterministic rules; only intent classification may
   use the LLM, with a deterministic fallback (`ORCHESTRATION_ENGINE.md` §10).
