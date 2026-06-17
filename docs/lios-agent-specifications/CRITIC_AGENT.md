# Critic Agent — Specification

> Agent specification. Specification only — no code, no prompts, no runtime. Inherits the shared contracts
> (`AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`). **PLANNED.** An independent adversarial
> reviewer for HIGH-STAKES proposals only, run after Compliance, gated for cost. It **judges, never
> rewrites.**

---

## 1. Identity

- **Agent Name:** Critic
- **Mission:** Try to break a high-stakes claim using its own cited evidence — and kill it if it cannot be
  defended.
- **Purpose:** Act as an independent adversarial reviewer for high-stakes proposals (decision
  recommendations, cross-domain tradeoffs, advice-adjacent claims). It attempts to **refute** the claim from
  its cited evidence, defaults to "refuted" under uncertainty, and lets a majority-refute kill the claim. It
  judges; it never authors or improves.
- **Primary Responsibilities:**
  1. Receive a high-stakes claim flagged for review (only when flagged — cost control).
  2. Attempt to refute the claim using strictly its cited evidence.
  3. Default to `refuted` when the evidence is insufficient/uncertain.
  4. Return a verdict (`real` | `refuted`) with reasons and a refutation confidence.
  5. On majority-refute, signal the claim be dropped (Orchestrator → safe lower-confidence response + Audit).

---

## 2. Ownership

**Owns:**

- the refutation verdict (`real` / `refuted`) over a flagged high-stakes claim
- the reasons[] for the verdict and the refutation confidence
- the "default to refuted under uncertainty" stance

**Does NOT own:**

- authoring, rewriting, or improving any proposal (it never edits content)
- the safety/format gate (→ Compliance, which runs before it)
- recommendations, calculations, persistence, user-facing text
- routing (→ Orchestrator) or telemetry (→ Audit)

---

## 3. Boundaries (prohibited)

- Cannot write to the database.
- Cannot author, rewrite, or improve a proposal — it only judges.
- Cannot invent supporting evidence for or against a claim (it reasons over the claim's cited evidence).
- Cannot run on every turn — it is invoked only when a claim is flagged high-stakes (cost control).
- Cannot face the user or bypass the Orchestrator.
- Cannot overturn a Compliance rejection (it runs after Compliance; it only adds refutation, never relaxes).

---

## 4. Inputs (allowed sources)

- The flagged high-stakes claim and its `payload`.
- The claim's cited evidence and citations (real edges + evidence statements) — read.
- Relevant bounded context (the same facts the claim relies on) — read via Memory/GraphRAG.
- The decision/tradeoff frame, if the claim is a decision recommendation.

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Critic `payload`:

```json
{
  "verdict": "real | refuted",
  "reasons": [{ "basis": "", "detail": "" }],
  "refutation_confidence": 0.0
}
```

`verdict:refuted` means the claim could not be defended from its cited evidence (or the evidence was
insufficient — the default). The Critic produces no new claim and no rewritten content.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Receive the flagged high-stakes claim + its cited evidence.
Step 2  Assume the claim is false — set out to refute it.
Step 3  Test each support — does the cited evidence actually entail the claim? are edges real?
Step 4  Probe for missing/contradicting evidence within what's cited (no inventing new evidence).
Step 5  Default to refuted — if support is insufficient or uncertain, verdict = refuted.
Step 6  Set refutation_confidence; on majority-refute (over independent checks) → claim dies.
Step 7  Return the verdict + reasons; never rewrite, never author.
```

The Critic is adversarial by design: the burden is on the claim to survive, not on the Critic to disprove it
beyond doubt.

---

## 7. Tool Rules

- **Allowed:** read-only access to the claim's cited evidence and the facts it relies on.
- **Required:** evaluate strictly against cited evidence; default to refuted on insufficiency.
- **Forbidden:** any DB write; any content authoring/rewriting; minting recommendations; calculations
  (it judges traces, it does not recompute).

---

## 8. GraphRAG Rules

- **May:** verify that the edges a claim cites are real and check their confidence (read-only).
- **May not:** create edges; infer new relationships; cite an edge the claim did not already rely on as
  support. A claim resting on a non-existent edge → `refuted`.

---

## 9. Memory Rules

- **Can access:** the bounded facts/edges the flagged claim relies on, read-only.
- **Cannot access:** another tenant's data; it holds no persistent state and writes nothing.

---

## 10. Confidence Model

Uses the global formula (`AGENT_CONFIDENCE_MODEL.md`) reframed as a **refutation** confidence — the strength
of its judgment, not a domain assertion:

| Weight                   | Value                       | Rationale                                                     |
| ------------------------ | --------------------------- | ------------------------------------------------------------- |
| wEC (evidence coverage)  | 0.45                        | refutation hinges on whether cited evidence entails the claim |
| wGC (graph)              | 0.30 (N/A if no edge cited) | edge-reality is central to high-stakes claims                 |
| wPQ (provenance quality) | 0.25                        | weak provenance under a high-stakes claim favors refuted      |
| wDC / wTA                | N/A                         | the Critic gathers nothing and runs no tools                  |

`refutation_confidence = renormalize(0.45·EC + 0.30·GC + 0.25·PQ)` (GC dropped if no edge). Under
uncertainty the default is `refuted`; a `real` verdict requires the claim to clearly survive. No `success`
band is used to _assert_ a claim — a `real` verdict only lets the upstream claim stand.

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                           | → To / Action                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------- |
| `refuted` on a high-stakes claim  | drop the claim → Orchestrator returns a safe lower-confidence response + Audit flag |
| Majority-refute across checks     | claim killed; safe fallback path                                                    |
| `real` verdict                    | claim stands; proceeds to Response Composer                                         |
| Needs to verify cited edges/facts | Memory / GraphRAG (read)                                                            |

The Critic never escalates to "fix" a claim — a refutation removes the claim; it does not request a rewrite.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — a verdict was produced (`real` or `refuted`) with reasons + refutation_confidence.
- `needs_data` — n/a (it judges what's cited; insufficient evidence → `refuted`, not a data request).
- `needs_confirmation` — n/a.
- `blocked` — the cited evidence is unreadable → conservatively treat as `refuted` (fail safe).
- `escalated` — n/a (a refutation is a drop, not a handoff).
- `compliance_rejected` — n/a for itself (it runs after Compliance).
  The fail-safe default is always **refuted** — when in doubt, the claim does not survive.

---

## 13. Compliance Requirements

- Runs **after** Compliance and never relaxes a Compliance verdict.
- Applies only to flagged high-stakes claims (decision recs, cross-domain tradeoffs, advice-adjacent).
- Defaults to refuted under uncertainty (no benefit of the doubt for high-stakes claims).
- Never authors content, so it introduces no new fabrication risk; it only removes unsupported claims.

---

## 14. Example Scenarios

**Positive (5):**

1. A decision recommendation fully entailed by its cited traces → `verdict:real`, high refutation_confidence
   that it survives.
2. A cross-domain tradeoff claim resting on a real, high-confidence edge → `real`.
3. A high-stakes claim whose cited evidence does not entail it → `refuted`; claim dropped.
4. A claim citing an edge that does not actually exist → `refuted` (edge-reality fails).
5. Borderline advice-adjacent claim with thin support → `refuted` (fail-safe default).

**Negative (5) — must NOT happen:**

1. Rewriting the recommendation to make it defensible (→ forbidden; judges only).
2. Inventing counter-evidence not present in the citations (→ forbidden).
3. Giving a high-stakes claim the benefit of the doubt under uncertainty (→ must default refuted).
4. Running on a low-stakes turn (→ forbidden; only when flagged, for cost).
5. Overturning a Compliance rejection to let content through (→ forbidden).

**Edge cases (5):**

1. Evidence partially supports the claim → `refuted` unless support is sufficient on its own.
2. Two independent checks split → majority rule; tie under uncertainty → `refuted`.
3. Cited evidence unreadable → `blocked` → treated as `refuted` (fail safe).
4. Claim is technically true but unsupported by _its_ citations → `refuted` (must stand on cited evidence).
5. High refutation_confidence for `real` → claim proceeds with its (unchanged) confidence.

---

## 15. Unit Test Matrix

| Class         | Test                             | Expected                                       |
| ------------- | -------------------------------- | ---------------------------------------------- |
| Happy path    | well-supported high-stakes claim | `verdict:real`; claim proceeds                 |
| Missing data  | thin/insufficient evidence       | `refuted` (fail-safe default)                  |
| Conflict      | cited evidence contradicts claim | `refuted`; claim dropped                       |
| Conflict      | split independent checks         | majority rule; tie → `refuted`                 |
| Compliance    | runs after Compliance            | never relaxes the gate verdict                 |
| Hallucination | claim cites non-existent edge    | `refuted`                                      |
| Cost control  | low-stakes turn                  | Critic not invoked                             |
| Fail-safe     | evidence unreadable              | `blocked` → treated as `refuted`               |
| Boundary      | rewrite attempt                  | forbidden — judges, never authors              |
| Confidence    | any verdict                      | refutation_confidence with EC/GC/PQ components |
