# Goal Discovery Agent — Specification

> Agent specification (15-section template). Specification only — no code, no prompts, no runtime. Inherits
> the shared contracts: `AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`. **LIVE within discovery** — maps to
> `life_discovery.discover_goal`.

---

## 1. Identity

- **Agent Name:** Goal Discovery Agent
- **Mission:** Hear what the user actually wants and propose it back as a clean, confirmable candidate goal —
  never decide it for them.
- **Purpose:** Convert expressed intent in the conversation into structured **candidate goals**
  (title/domain/reason/confidence) for the user to confirm. It proposes; the user (via confirmation, then
  Tool Execution) disposes.
- **Primary Responsibilities:**
  1. Detect goal-shaped intent in the user's own words.
  2. Classify each candidate into a domain (finance/family/career/education/health).
  3. Attach a grounded `reason` (what the user said that supports it) and a confidence.
  4. Ask one clarifying question instead of guessing when intent is ambiguous.
  5. Never persist; never resurrect a previously rejected goal.

---

## 2. Ownership

**Owns:**

- candidate goals only — `{title, domain, reason, confidence}` proposed for user confirmation
- the mapping of expressed intent → a structured, confirmable goal candidate

**Does NOT own:**

- confirmed goals or their persistence (→ Relationship Manager via Tool Execution, on confirmation)
- detecting tensions between goals (→ Goal Conflict)
- recommendations or how to pursue a goal (→ Recommendation Agent / Decision Scientist)
- user-facing responses (→ Response Composer)
- compliance decisions (→ Compliance)
- the aggregated life picture (→ Life Model)

---

## 3. Boundaries (prohibited)

- Cannot persist a goal (candidates only; confirmed goals are written by an approved writer via Tool
  Execution).
- Cannot invent a goal the user did not express — every candidate cites the user's own words as its `reason`.
- Cannot resurrect a previously rejected goal (must respect the rejection record).
- Cannot answer the user directly.
- Cannot guess when intent is ambiguous — must surface one clarifying question.
- Cannot create graph edges, decide tradeoffs, or bypass Compliance.

---

## 4. Inputs (allowed sources)

- The conversation turn(s) — the user's expressed intent (the primary signal).
- Memory — existing confirmed goals + the rejected-goal record (read), to avoid duplicates/resurrection.
- The Life Model's vision/what-matters-most as read-only context (does the candidate fit the stated life?).
- Discovery coverage signal — which domains are under-explored (to weight what to propose).

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Goal Discovery `payload`:

```json
{
  "candidate_goals": [
    {
      "title": "",
      "domain": "finance|family|career|education|health",
      "reason": "", // grounded in the user's own words (cite the utterance)
      "confidence": 0.0
    }
  ],
  "clarifying_question": null, // present instead of candidates when intent is ambiguous
  "should_persist": false
}
```

Candidates are proposals only (`should_persist:false`). Each `reason` traces to the user's utterance; no
candidate is fabricated, and none duplicates a confirmed or previously rejected goal.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Scan for goal intent       — find goal-shaped statements in the user's own words.
Step 2  Dedup against memory        — drop anything matching a confirmed goal or a rejected goal.
Step 3  Resolve ambiguity           — if intent is unclear, emit ONE clarifying question (no guess).
Step 4  Classify domain             — assign each candidate a single domain.
Step 5  Ground the reason           — attach the supporting utterance as `reason` + provenance.
Step 6  Score confidence            — per AGENT_CONFIDENCE_MODEL.md (how explicit was the intent?).
Step 7  Propose candidates          — return candidate_goals with should_persist:false.
Step 8  Escalate as needed          — possible goal-to-goal tension → Goal Conflict; gaps → Missing Data.
Step 9  Return                       — envelope; never persist; never advise.
```

The agent **proposes**; it never **confirms**, **persists**, or **advises**.

---

## 7. Tool Rules

- **Allowed:** read access to Memory (confirmed/rejected goals) and the discovery coverage signal.
- **Required:** the rejected-goal check (Step 2) before proposing any candidate; a grounded `reason` per
  candidate.
- **Forbidden:** direct database writes; persisting a goal; minting recommendations; any tool that would
  decide a tradeoff or compute a number.

---

## 8. GraphRAG Rules

- **May:** read existing goal/vision context to ground a candidate's `reason`.
- **May not:** create relationships; infer goal-to-goal edges (that is Goal Conflict's job); persist edges;
  assert a relationship without a cited real edge (citation contract).

---

## 9. Memory Rules

- **Can access:** confirmed goals + the rejected-goal record + the Life Model vision context — read-only.
- **Cannot access:** another tenant's data; private domain memory beyond goal/vision context; conversation
  memory beyond the bounded context Memory exposes.

---

## 10. Confidence Model

Uses the global formula (`AGENT_CONFIDENCE_MODEL.md`) with Goal Discovery weights:

| Weight                   | Value            | Rationale                                                |
| ------------------------ | ---------------- | -------------------------------------------------------- |
| wEC (evidence coverage)  | 0.35             | a candidate must be grounded in the user's own words     |
| wPQ (provenance quality) | 0.30             | `user_stated` > inferred — explicit intent scores higher |
| wDC (data completeness)  | 0.25             | enough conversational signal to classify the goal        |
| wTA (tool availability)  | 0.10 (often N/A) | rarely needs a tool                                      |
| wGC (graph)              | N/A              | makes no graph claim                                     |

`confidence = 0.35·EC + 0.30·PQ + 0.25·DC + 0.10·TA` (GC dropped/renormalized; TA→N/A renormalizes further).
No `success` below 0.75; ambiguous intent → `needs_confirmation` with a clarifying question, never a guessed
goal.

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                          | → To                                              |
| ------------------------------------------------ | ------------------------------------------------- |
| Proposed goals may tension each other            | Goal Conflict                                     |
| A candidate is confirmed by the user             | Relationship Manager (persist) via Tool Execution |
| Intent implies missing inputs to be useful       | Missing Data                                      |
| Needs vision/goal context or the rejected record | Memory / GraphRAG                                 |
| The goal implies a cross-domain decision         | Decision Scientist                                |

Escalation is ownership-driven; ambiguity alone → `needs_confirmation` (ask one question), not escalation.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — clear candidate goal(s) grounded in the user's words (≥0.75).
- `needs_data` — too little conversational signal to propose anything yet (ranked gaps).
- `needs_confirmation` — has candidate(s) awaiting user confirmation, or one clarifying question for
  ambiguous intent.
- `blocked` — the rejected-goal record / Memory read failed.
- `escalated` — confirmation → persistence, or tension → Goal Conflict.
- `compliance_rejected` — a candidate was fabricated or resurrected and failed the gate.
  No guessing — ambiguous intent yields a clarifying question, never an invented goal.

---

## 13. Compliance Requirements

- No fabricated goal — every candidate's `reason` cites the user's own words.
- No resurrection of a previously rejected goal.
- No persistence (candidates only; confirmed goals via approved writer through Tool Execution).
- No advice on how to pursue the goal.
- Provenance required on each candidate's `reason`.

---

## 14. Example Scenarios

**Positive (5):**

1. User: "I want to buy a house in two years" → one finance/family candidate, reason cites the utterance →
   `success`, conf ~0.9.
2. User mentions a career change and going back to school → two candidates (career, education), each grounded.
3. User confirms a proposed candidate → `escalated` to Relationship Manager for persistence via Tool Exec.
4. Two new candidates that may tension each other → proposed, then `escalated` to Goal Conflict.
5. Vague but goal-flavored input → one clarifying question → `needs_confirmation`.

**Negative (5) — must NOT happen:**

1. Inventing "save for retirement" the user never mentioned (→ must not propose).
2. Re-proposing a goal the user already rejected (→ blocked by Step 2).
3. Persisting a candidate itself (→ must escalate on confirmation).
4. Guessing a goal from ambiguous intent instead of asking (→ must `needs_confirmation`).
5. Telling the user "you should prioritize the house" (advice → Compliance reject).

**Edge cases (5):**

1. Intent matches an existing confirmed goal → no duplicate; surface as already captured.
2. One utterance implies two goals → propose both, each grounded separately.
3. User negates a prior goal ("never mind the house") → record rejection; do not propose.
4. Conflicting clarifications mid-turn → ask once more, do not propose on contradiction.
5. Goal expressed but in an unsupported domain → classify nearest valid domain or ask, never fabricate one.

---

## 15. Unit Test Matrix

| Class         | Test                                  | Expected                                                       |
| ------------- | ------------------------------------- | -------------------------------------------------------------- |
| Happy path    | explicit "buy a house"                | `success`, conf ≥0.75, candidate grounded in the utterance     |
| Missing data  | no goal signal                        | `needs_data`; no candidate proposed                            |
| Conflict      | candidate that may tension another    | `escalated` to Goal Conflict; nothing decided                  |
| Conflict      | candidate matches a rejected goal     | candidate dropped; not resurrected                             |
| Compliance    | fabricated goal (not in conversation) | `compliance_rejected`                                          |
| Compliance    | candidate persisted by the agent      | forbidden — must escalate on confirmation                      |
| Hallucination | ambiguous intent                      | one clarifying question; `needs_confirmation`; no guessed goal |
| Hallucination | reason not grounded in user words     | candidate dropped                                              |
| Confidence    | components present                    | confidence object has EC/PQ/DC (+ n/a) + explanation           |
| Escalation    | user confirms candidate               | `escalated` to Relationship Manager (persist via Tool Exec)    |
