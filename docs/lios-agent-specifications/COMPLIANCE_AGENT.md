# Compliance Agent — Specification

> Agent specification. Specification only — no code, no prompts, no runtime. Inherits the shared contracts
> (`AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`). **DETERMINISTIC GATE.** Maps to the live
> `advisor_validator` (`app/services/advisor_validator.py`). This is the **compliance authority for output**:
> no LLM-authored text reaches the surface without passing here.

---

## 1. Identity

- **Agent Name:** Compliance
- **Mission:** Be the unbypassable, deterministic gate that guarantees no unsafe, fabricated, or unvalidated
  content ever reaches the user.
- **Purpose:** Render an accept / repair / reject verdict over every LLM output, enforcing the advice/safety
  boundaries, allowed-numbers, the citation contract, the persistence lock, and the single-question rule —
  using **pure functions only** (no IO, no LLM, no DB).
- **Primary Responsibilities:**
  1. Validate the LLM output against every safety + anti-fabrication rule.
  2. Emit the verdict: `accept`, `repair`, or `reject`.
  3. Produce the `safe_payload` (with persistence lock + filters applied) and list reasons + repairs.
  4. Enforce the persistence lock and the single-question repair.
  5. Reject malformed or empty turns; never weaken a rule to make output pass.

---

## 2. Ownership

**Owns:**

- the accept/repair/reject verdict over every LLM output
- the `safe_payload` (the validated, locked, filtered output)
- the reasons[] and repairs[] record of what it changed and why
- the persistence lock (forcing `should_persist:false`)

**Does NOT own:**

- authoring or improving content (it judges; the Composer renders; agents author)
- recommendations, calculations, persistence, user-facing text
- routing (→ Orchestrator) or telemetry (→ Audit)
- the high-stakes refutation review (→ Critic, which runs before it on flagged claims)

---

## 3. Boundaries (prohibited)

- Cannot call the LLM.
- Cannot perform any IO or write to the database.
- Cannot weaken or skip a safety rule to make output pass.
- Cannot author, rewrite, or improve a proposal (it accepts, repairs deterministically, or rejects).
- Cannot face the user (it gates; the Composer renders post-verdict).
- Cannot allow an invented number, an uncited relationship claim, advice, or a persistence flag through.

---

## 4. Inputs (allowed sources)

- The LLM-authored output (the agent's proposed payload) for this turn.
- The `allowed_numbers` set + the set of real cited edges (from the bounded context) — to check against.
- The set of rejected goals (so it can drop matching candidate goals).
- The turn's structural expectations (envelope shape, single-question rule).

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Compliance `payload`:

```json
{
  "result": "accept | repair | reject",
  "safe_payload": {},
  "reasons": [{ "rule": "", "detail": "" }],
  "repairs": [{ "rule": "", "action": "" }]
}
```

On `accept`/`repair`, `safe_payload` is the validated output with the persistence lock + filters applied. On
`reject`, the caller uses the deterministic fallback. The envelope's `compliance` block (`result`/`reasons`/
`repairs`) is set by this agent — it is the only agent that sets it.

---

## 6. Cognitive Framework (how it reasons — pure functions only)

```
Step 1  Shape check         — envelope well-formed? not empty? else → reject (malformed / empty-turn).
Step 2  Advice boundary     — any advice/medical/legal/tax directive? (user's own "should I" is NOT advice) → reject if found.
Step 3  Allowed-numbers     — every number ∈ allowed_numbers? invented financial number → reject.
Step 4  Citation contract   — every relationship claim backed by a real edge? generic "connects to your vision/goals" is NOT a claim.
Step 5  Persistence lock    — force should_persist=false; drop candidate goals matching rejected goals; filter facts to source=user_message; keep only valid real-edge citations.
Step 6  Single-question     — more than one question? → REPAIR: trim to the first.
Step 7  Verdict             — no violations → accept; deterministic fixes applied → repair; hard violation → reject.
```

Every step is a pure function of the input — no model, no IO, no DB. Repairs are deterministic and
content-preserving except for the offending part.

---

## 7. Tool Rules

- **Allowed:** pure validation/repair functions only.
- **Required:** the persistence lock and single-question check on every LLM output.
- **Forbidden:** any LLM call; any IO; any DB write; any content authoring/rewriting beyond deterministic
  repair.

---

## 8. GraphRAG Rules

- **May:** check a relationship claim against the set of real cited edges already provided.
- **May not:** read or create edges itself, or query GraphRAG. It receives the real-edge set as input and
  drops any citation not in it.

---

## 9. Memory Rules

- **Can access:** only the inputs handed to it (allowed_numbers, real-edge set, rejected-goal set). It is
  stateless and pure.
- **Cannot access:** Memory, GraphRAG, or the DB directly. It holds no state across turns.

---

## 10. Confidence Model

- Compliance returns a **deterministic verdict**, not a probabilistic assertion — confidence model is **N/A**
  (`na_components` = all). It does not produce a `confidence.score`; it produces accept/repair/reject. (See
  `AGENT_CONFIDENCE_MODEL.md` — deterministic gates do not assert confidence.)

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                      | → To / Action                                                               |
| ---------------------------- | --------------------------------------------------------------------------- |
| `reject` verdict             | caller uses the deterministic fallback (no escalation to "fix" the content) |
| Repeated rejects (pattern)   | Audit — logged as a quality signal                                          |
| High-stakes claim (pre-gate) | (Critic runs before Compliance; Compliance gates Critic's surviving output) |

Compliance does not hand work to another agent to make output pass — a rejection is a safe stop, not a
referral. It never weakens a rule to avoid a reject.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`), applied to the gate:

- `success` — verdict produced (accept or repair) with a valid `safe_payload`.
- `needs_data` — n/a (it validates, it does not gather).
- `needs_confirmation` — n/a (it does not propose candidates).
- `blocked` — n/a (it is pure; it always produces a verdict).
- `escalated` — n/a (a reject is a stop, not a handoff).
- `compliance_rejected` — its `reject` verdict maps directly to this state for the turn → deterministic
  fallback.
  It always returns a verdict; it never throws, never passes unsafe content, never weakens a rule.

---

## 13. Compliance Requirements

This agent **is** the output-compliance authority. It enforces:

- advice / medical / legal / tax boundary (reflecting the user's own "should I" is allowed)
- allowed-numbers (no invented financial number)
- citation contract (goal-to-goal claim needs a real edge; generic connection phrasing is not a claim)
- persistence lock (`should_persist:false`; drop rejected-matching goals; filter facts to `user_message`;
  keep only valid real-edge citations)
- single-question repair; malformed-output reject; empty-turn reject
  It may never relax these to let output pass.

---

## 14. Example Scenarios

**Positive (5):**

1. Clean advisor output (one question, user's numbers, no relationship claim) → `accept`.
2. Output with a second question → `repair` (trim to first); reasons/repairs recorded.
3. Output asserting a relationship that IS a real edge → citation kept → `accept`.
4. Output with a candidate fact sourced from a document mid-conversation → filtered to user_message → `repair`.
5. Output reflecting the user's own "how much should I save?" → not advice → `accept`.

**Negative (5) — must NOT happen:**

1. Letting "you should buy this stock" through (→ must `reject`).
2. Letting a net-worth number not in allowed_numbers through (→ must `reject`).
3. Keeping an uncited goal-to-goal relationship claim (→ must drop/`reject`).
4. Letting `should_persist:true` through (→ must force false).
5. Weakening the advice rule to accept borderline advice (→ forbidden).

**Edge cases (5):**

1. Empty/blank turn → `reject` (empty-turn).
2. Malformed envelope → `reject` (malformed).
3. Generic "this connects to your vision" with no edge → not a claim → no edge required → `accept`.
4. Candidate goal matches a previously rejected goal → dropped in `safe_payload`.
5. Multiple violations at once → `reject` with all reasons listed.

---

## 15. Unit Test Matrix

| Class           | Test                          | Expected                                          |
| --------------- | ----------------------------- | ------------------------------------------------- |
| Happy path      | clean output                  | `accept`; safe_payload = input with lock applied  |
| Missing data    | n/a (gate)                    | not applicable; always returns a verdict          |
| Conflict        | doc-sourced fact mid-chat     | `repair`; facts filtered to user_message          |
| Compliance      | advice present                | `reject`                                          |
| Compliance      | number not in allowed_numbers | `reject`                                          |
| Compliance      | uncited goal-to-goal claim    | claim dropped; `reject` if load-bearing           |
| Compliance      | should_persist:true           | forced to false                                   |
| Compliance      | second question               | `repair` (trim to first)                          |
| Hallucination   | invented relationship         | dropped; not in safe_payload                      |
| Empty/malformed | blank or bad envelope         | `reject`                                          |
| Boundary        | LLM/IO/DB attempted           | forbidden — pure functions only                   |
| Confidence      | any verdict                   | none asserted; deterministic; na_components = all |
