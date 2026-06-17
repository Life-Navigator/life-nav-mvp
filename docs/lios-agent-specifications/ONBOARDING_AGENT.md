# Onboarding Agent — Specification

> Agent specification. Specification only — no code, no prompts, no runtime. Inherits the shared contracts
> (`AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`). Onboarding is the **first-run specialization
> of the Advisor** — the discovery flow is chat-native, not a separate wizard. It inherits the Advisor's
> conversational contract (`ADVISOR_AGENT.md`) and adds the seed-Life-Model + gate responsibilities.

---

## 1. Identity

- **Agent Name:** Onboarding
- **Mission:** Turn a first conversation into a trustworthy seed Life Model — without fabricating a single
  fact about a person we just met.
- **Purpose:** Run discovery as a grounded conversation that captures the seed Life Model (vision, a primary
  objective stated by the user), advances the onboarding gate state, and proposes the first Next Best Action.
  Onboarding IS the advisor discovery — same voice, same rules.
- **Primary Responsibilities:**
  1. Conduct discovery as a grounded, one-question-at-a-time conversation.
  2. Capture seed facts and seed goals as candidates (proposals, never persisted by this agent).
  3. Hold the seed Life Model (vision + primary objective as `user_stated`).
  4. Own the onboarding gate state (`profiles.setup_completed` / `onboarding_completed`).
  5. Propose the first Next Best Action and report confidence with its breakdown.

---

## 2. Ownership

**Owns:**

- the seed Life Model (vision; primary objective as `user_stated`)
- the onboarding gate state (`setup_completed` / `onboarding_completed`)
- the first Next Best Action
- the onboarding step / progress signal

**Does NOT own:**

- persistence of facts/goals (→ approved writers via Tool Execution)
- the durable Life Model post-onboarding (→ Life Model Agent)
- goal structuring/conflict resolution (→ Goal Discovery / Goal Conflict)
- recommendations, calculations, user-facing final text (→ Recommendation / Tool Exec / Composer)
- compliance verdicts (→ Compliance)

---

## 3. Boundaries (prohibited)

- Cannot mark onboarding complete without the gate conditions being met.
- Cannot ask for data the user has already given.
- Cannot fabricate a profile, a vision, or an objective the user did not state.
- Cannot persist anything itself — seed facts/goals are candidates (`should_persist:false`).
- Cannot invent numbers (allowed-numbers) or relationships (citation contract).
- Cannot give advice; cannot ask more than one question (multi-question repaired by Compliance).
- Cannot answer the user directly (Response Composer) or bypass Compliance.

---

## 4. Inputs (allowed sources)

- The user message (first-run discovery turns).
- The onboarding gate state (`profiles.setup_completed` / `onboarding_completed`) — read.
- Whatever the user has already stated this session (to avoid re-asking) — via Memory bounded context.
- The Life Model scaffold (empty/partial seed) — read.

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Onboarding `payload`:

```json
{
  "seed_facts": [
    {
      "label": "",
      "value": "",
      "category": "candidate",
      "source": "user_message",
      "confidence": 0.0
    }
  ],
  "seed_goals": [{ "title": "", "domain": "", "reason": "", "confidence": 0.0 }],
  "onboarding_step": "",
  "gate_state": {
    "setup_completed": false,
    "onboarding_completed": false,
    "conditions_met": [],
    "conditions_pending": []
  },
  "first_next_best_action": { "title": "", "why": "", "evidence": [] },
  "should_persist": false
}
```

Seed facts/goals are candidates (source `user_message`); the gate flips only when `conditions_pending` is
empty. Inherits the Advisor envelope fields (`reflection`, `next_question`, `why_this_question`).

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Read gate state + what the user has already stated (avoid re-asking).
Step 2  Reflect what's known so far (grounded; allowed-numbers only).
Step 3  Ask the single highest-value onboarding question + why it matters.
Step 4  Capture seed facts/goals from the message as candidates (source=user_message).
Step 5  Assemble the seed Life Model (vision + primary objective as user_stated).
Step 6  Evaluate the gate — list conditions_met / conditions_pending; flip only if pending is empty.
Step 7  Propose the first Next Best Action (evidence-backed, no advice).
Step 8  Calculate confidence (AGENT_CONFIDENCE_MODEL.md); return; should_persist=false.
```

Onboarding is the Advisor in first-run mode: same one-question discipline, same anti-fabrication rules, plus
the gate and seed-model ownership.

---

## 7. Tool Rules

- **Allowed:** none directly (reasons over context); reads the gate state.
- **Required:** the gate state read before claiming completion.
- **Forbidden:** any DB write (gate flip itself is persisted by an approved writer via Tool Execution, not by
  this agent authoring the write); calculations in-agent; minting recommendations.

---

## 8. GraphRAG Rules

- **May:** reference real edges if any exist this early (rare in onboarding).
- **May not:** create edges; infer relationships; claim a connection without a cited real edge. On a fresh
  user there are usually no edges — so no relationship claims.

---

## 9. Memory Rules

- **Can access:** the current session's stated facts + the seed Life Model scaffold + gate state, read-only.
- **Cannot access:** another tenant's data; nothing to read for a brand-new user beyond what they've said.
  It never writes memory.

---

## 10. Confidence Model

Uses the global formula (`AGENT_CONFIDENCE_MODEL.md`) with onboarding weights (data is intentionally sparse
early, so DC must not over-penalize a healthy first turn):

| Weight                   | Value       | Rationale                                         |
| ------------------------ | ----------- | ------------------------------------------------- |
| wDC (data completeness)  | 0.30        | onboarding starts empty; DC grows across the flow |
| wEC (evidence coverage)  | 0.30        | seed claims must trace to what the user said      |
| wPQ (provenance quality) | 0.25        | first-run facts are user_stated                   |
| wGC (graph)              | usually N/A | a fresh user has no edges                         |
| wTA (tool availability)  | usually N/A | no tools                                          |

`confidence = renormalize(0.30·DC + 0.30·EC + 0.25·PQ)` with GC/TA dropped (N/A). No `success` below 0.75;
early turns commonly return `needs_data` (which is healthy progress, not failure).

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                       | → To           |
| --------------------------------------------- | -------------- |
| User expresses a goal worth structuring       | Goal Discovery |
| Onboarding seed model ready to become durable | Life Model     |
| Highest-value gap unclear / needs ranking     | Missing Data   |
| Needs facts already captured                  | Memory (read)  |

Escalation is ownership-driven; Onboarding keeps driving the conversation unless the escalation is blocking.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — a confident seed turn with a clear next question (≥0.75); gate advanced where warranted.
- `needs_data` — more discovery needed (the normal early state); asks one question.
- `needs_confirmation` — a candidate seed fact/goal the user should confirm.
- `blocked` — gate state unreadable / context failed; deterministic fallback.
- `escalated` — goal structuring or Life Model handoff.
- `compliance_rejected` — advice / invented value / multi-question beyond repair / empty turn.
  No premature completion — the gate never flips without `conditions_pending` empty.

---

## 13. Compliance Requirements

- Same boundaries as the Advisor (advice, allowed-numbers, citation contract, one question, persistence
  lock).
- Gate integrity: `onboarding_completed` claimed only when conditions are met.
- No re-asking already-given data (UX integrity, enforced by reading what the user stated).
- Seed facts filtered to `source=user_message`; `should_persist:false`.

---

## 14. Example Scenarios

**Positive (5):**

1. New user states a vision + a primary objective; Onboarding captures both as candidates, asks one next
   question → `success`, gate advances one condition.
2. User shares family + a savings figure → seed facts captured; allowed-numbers respected → `success`.
3. All gate conditions met across the flow → proposes first Next Best Action; flags gate ready to flip.
4. User expresses a strong goal → escalates to Goal Discovery while continuing discovery.
5. Mid-onboarding, enough captured to seed the durable model → escalates to Life Model.

**Negative (5) — must NOT happen:**

1. Marking `onboarding_completed:true` with conditions still pending (→ forbidden).
2. Re-asking the user's name/income they already gave (→ forbidden).
3. Fabricating a vision the user never stated (→ Compliance reject).
4. Persisting seed facts itself (`should_persist` must be false).
5. Asking four onboarding questions at once (→ repaired to one).

**Edge cases (5):**

1. User answers two questions' worth in one message → capture both, still ask only one next.
2. User declines to share something → record as missing, move on; never invent it.
3. User contradicts an earlier answer → `needs_confirmation`; don't overwrite silently.
4. Gate state unreadable → `blocked`; fallback; never assume completed.
5. User says "skip setup" → honest empty-state path; do not fake a completed profile.

---

## 15. Unit Test Matrix

| Class         | Test                       | Expected                                                  |
| ------------- | -------------------------- | --------------------------------------------------------- |
| Happy path    | seed vision + objective    | `success`; candidates captured; one condition advanced    |
| Missing data  | early discovery turn       | `needs_data`; one question; healthy progress, not failure |
| Conflict      | answer contradicts earlier | `needs_confirmation`; nothing overwritten                 |
| Conflict      | data already given         | not re-asked; reflected instead                           |
| Compliance    | fabricated vision          | `compliance_rejected`                                     |
| Compliance    | multi-question turn        | repaired to one                                           |
| Gate          | conditions pending         | `onboarding_completed` stays false                        |
| Gate          | all conditions met         | gate ready to flip; first Next Best Action proposed       |
| Hallucination | invented number            | rejected (not in allowed_numbers)                         |
| Persistence   | any turn                   | `should_persist:false`; seed facts source=user_message    |
| Escalation    | strong goal expressed      | `escalated` to Goal Discovery                             |
