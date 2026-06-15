# Response Composer Agent — Specification

> Agent specification. Specification only — no code, no prompts, no runtime. Inherits the shared contracts
> (`AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`). **DETERMINISTIC.** Maps to the live
> `_compose`. It is the only stage whose text reaches the surface — and only after Compliance, via the
> Orchestrator.

---

## 1. Identity

- **Agent Name:** Response Composer
- **Mission:** Turn already-validated content into clear, human user-facing text — without adding, removing,
  or changing a single claim.
- **Purpose:** Deterministically assemble the final assistant message from the **already-validated** proposal,
  merging only language while preserving every deterministic outcome exactly. It renders; it never asserts.
- **Primary Responsibilities:**
  1. Assemble the final user-facing text from the validated (accepted/repaired) payload.
  2. Merge only language — never introduce a claim, number, or recommendation not already validated.
  3. Apply light, non-semantic cleanup (balance quotes, ensure a single question).
  4. Preserve deterministic outcomes (goals, panels, structured outcomes) byte-for-byte.
  5. Expose display-only fields for the surface.

---

## 2. Ownership

**Owns:**

- the final assistant message string (the only text that reaches the surface)
- the language-merge step (validated content → readable prose)
- light non-semantic cleanup (quote balancing, single-question enforcement)
- the display-only field projection

**Does NOT own:**

- any claim, number, recommendation, or relationship (those are owned upstream and already validated)
- compliance verdicts (→ Compliance, which runs before it)
- persistence (→ approved writers via Tool Execution)
- routing or telemetry (→ Orchestrator / Audit)

---

## 3. Boundaries (prohibited)

- Cannot use an LLM — it is deterministic.
- Cannot add, remove, or alter any claim/number/recommendation/relationship.
- Cannot introduce content that was not already validated by Compliance.
- Cannot change a deterministic outcome (goals/panel/structured outcomes are passed through unchanged).
- Cannot write to the database.
- Cannot run before Compliance — it only ever sees accepted/repaired content.
- Cannot face the user except via the Orchestrator.

---

## 4. Inputs (allowed sources)

- The **validated** payload (Compliance result = accepted or repaired) with its `safe_payload`.
- The deterministic structured outcomes (goals, panels) to pass through.
- Display formatting context (locale/surface hints) — non-semantic only.

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Composer `payload`:

```json
{
  "assistant_message": "",
  "display_only_fields": {
    "structured_outcomes": {},
    "single_question": "",
    "formatting": {}
  }
}
```

`assistant_message` contains only language assembled from validated content; `structured_outcomes` are the
upstream deterministic outcomes, unchanged. No `evidence`/`citations` are minted here — they are inherited.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Receive the validated (accepted/repaired) safe_payload from Compliance (via Orchestrator).
Step 2  Select the language fragments to merge (reflection, why, the single question).
Step 3  Merge into readable prose — language only; no claim added/removed/changed.
Step 4  Enforce a single question; balance quotes; non-semantic cleanup.
Step 5  Project display-only fields; pass deterministic outcomes through unchanged.
Step 6  Return the assistant_message (terminal stage; no confidence assertion).
```

It is a **renderer**, not a reasoner — every "decision" is deterministic and outcome-preserving.

---

## 7. Tool Rules

- **Allowed:** deterministic text-assembly utilities (formatting/quote-balancing).
- **Required:** operate only on the validated `safe_payload`.
- **Forbidden:** any LLM call; any DB write; any calculation; any content not already validated.

---

## 8. GraphRAG Rules

- **May:** display a relationship that was already cited and validated upstream (render only).
- **May not:** read, create, or cite edges itself. It makes no graph claim — it only renders ones already
  validated.

---

## 9. Memory Rules

- **Can access:** nothing for reasoning — it consumes only the validated payload handed to it.
- **Cannot access:** Memory, GraphRAG, or the DB. It never reads or writes truth.

---

## 10. Confidence Model

- The Composer **renders; it does not assert**, so it has **no domain confidence**. Confidence model N/A;
  `na_components` = all. It inherits and may display the upstream agent's confidence, but produces none of its
  own. (See `AGENT_CONFIDENCE_MODEL.md` — N/A components are marked, not zeroed.)

---

## 11. Escalation Rules (via Orchestrator)

- **None — terminal stage.** The Composer does not escalate. If handed nothing valid to render (no
  accepted/repaired payload), it does not improvise; the Orchestrator uses the deterministic fallback text
  instead.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`), applied to a renderer:

- `success` — assembled the final message from validated content with outcomes preserved.
- `needs_data` — n/a (it does not gather data).
- `needs_confirmation` — n/a (it does not propose).
- `blocked` — no valid content to render → Orchestrator falls back to deterministic text.
- `escalated` — n/a (terminal).
- `compliance_rejected` — n/a for itself; it only ever receives accepted/repaired content.
  It never fabricates filler to cover missing content — absence → fallback, not invention.

---

## 13. Compliance Requirements

- Operates **only** on content already validated by Compliance (accepted/repaired).
- Must preserve deterministic outcomes exactly; the language merge must be claim-neutral.
- Must not reintroduce anything Compliance dropped/repaired (e.g. a trimmed extra question, a dropped
  uncited relationship).
- Single-question and quote-balance cleanup must remain non-semantic.

---

## 14. Example Scenarios

**Positive (5):**

1. Accepted advisor payload → fluent assistant_message with the one question intact → `success`.
2. Compliance trimmed a second question → Composer renders only the first; never restores the second.
3. Deterministic goals panel present → passed through unchanged alongside the prose.
4. Unbalanced quotes in source fragments → balanced; meaning unchanged.
5. Repaired payload (filtered facts) → renders only the surviving validated facts.

**Negative (5) — must NOT happen:**

1. Calling an LLM to "improve" the message (→ forbidden; deterministic only).
2. Adding a number or claim not in the validated payload (→ forbidden).
3. Restoring a relationship Compliance dropped (→ forbidden).
4. Altering a deterministic goal/outcome (→ forbidden; pass-through).
5. Writing to the DB or facing the user without the Orchestrator (→ forbidden).

**Edge cases (5):**

1. Empty validated payload → render nothing; Orchestrator uses fallback (no invented filler).
2. Two questions survive a repair gap → enforce single-question; keep the first.
3. Long reflection → format for readability; do not summarize away a claim.
4. Mixed structured + prose outcomes → prose merged, structured passed through verbatim.
5. Locale formatting only → numbers reformatted for display, values unchanged.

---

## 15. Unit Test Matrix

| Class         | Test                              | Expected                                         |
| ------------- | --------------------------------- | ------------------------------------------------ |
| Happy path    | accepted payload                  | fluent message; one question; outcomes preserved |
| Missing data  | empty validated payload           | no render; Orchestrator fallback; no filler      |
| Conflict      | repaired payload (dropped claim)  | dropped claim not reintroduced                   |
| Compliance    | second question present           | trimmed to one; never restored                   |
| Hallucination | attempt to add unvalidated number | impossible — renders only validated content      |
| Determinism   | same input twice                  | byte-identical message                           |
| Pass-through  | structured goals/panel            | unchanged in output                              |
| Boundary      | LLM call attempted                | forbidden — no model access                      |
| Boundary      | DB write attempted                | forbidden — renders, never persists              |
| Confidence    | any turn                          | none asserted; na_components = all               |
