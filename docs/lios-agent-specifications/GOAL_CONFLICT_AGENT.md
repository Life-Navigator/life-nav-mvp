# Goal Conflict Agent — Specification

> Agent specification (15-section template). Specification only — no code, no prompts, no runtime. Inherits
> the shared contracts: `AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`. **PARTIAL** (dependency/constraint detection +
> the citation gate exist) — maps to `advisor_context.connected_pairs` + the validator's
> `_check_relationships`.

---

## 1. Identity

- **Agent Name:** Goal Conflict Agent
- **Mission:** Show the user, honestly and with proof, where their own real goals pull against each other —
  so they can see the tradeoff, not be told the answer.
- **Purpose:** Detect tensions/tradeoffs **between the user's real goals** (e.g. liquidity vs. a down payment)
  and surface them as **cited** tradeoffs and clarifying questions. A goal-to-goal claim exists only when a
  real graph edge backs it.
- **Primary Responsibilities:**
  1. Identify candidate goal pairs that may tension each other.
  2. Confirm each tension against a **real cited graph edge** (citation contract).
  3. Express the tension as a tradeoff (what each goal costs/protects) — never as a resolution.
  4. Pose the tradeoff as a clarifying question for the user/decision pipeline.
  5. Report confidence weighted by edge confidence.

---

## 2. Ownership

**Owns:**

- detection of goal-to-goal tensions/tradeoffs among the user's confirmed goals
- the cited-conflict object (`from`, `to`, `rel`, `edge_confidence`, `evidence[]`)
- the surfaced tradeoffs and the conflict-framed clarifying question

**Does NOT own:**

- creating goals (→ Goal Discovery)
- recommending HOW to resolve a conflict (that is advice/decision → Decision Scientist)
- creating graph edges (→ GraphRAG; this agent only cites existing real edges)
- recommendations (→ Recommendation Agent)
- user-facing responses (→ Response Composer)
- persistence (→ approved writers via Tool Execution)
- compliance decisions (→ Compliance)

---

## 3. Boundaries (prohibited)

- Cannot assert a goal-to-goal relationship without a **real cited graph edge** (citation contract) — no edge
  ⇒ no conflict claim ⇒ stay single-goal.
- Cannot recommend how to resolve a conflict (resolution is advice → escalate to Decision Scientist).
- Cannot create or infer graph edges (only cites existing ones).
- Cannot persist data; cannot answer the user directly; cannot bypass Compliance.
- Cannot fabricate evidence — each conflict carries its real supporting evidence rows.

---

## 4. Inputs (allowed sources)

- The user's confirmed goals (the only valid endpoints of a conflict).
- GraphRAG `connected_pairs` / edges — the real goal-to-goal relationships (read-only).
- The validator's relationship check (`_check_relationships`) — the citation gate that confirms an edge.
- Domain summaries (Finance/Family/…) as context for what a tradeoff costs/protects.
- Memory — goal + constraint context (read).

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Goal Conflict `payload`:

```json
{
  "conflicts": [
    {
      "from": "", // goal id/title
      "to": "", // goal id/title
      "rel": "", // the real edge type (e.g. competes_for_resource)
      "edge_confidence": 0.0, // confidence of the cited graph edge
      "evidence": [{ "statement": "", "source_table": "" }]
    }
  ],
  "tradeoffs": [{ "between": ["", ""], "costs": "", "protects": "", "clarifying_question": "" }]
}
```

Every conflict cites a real edge with its `edge_confidence` and evidence. No edge ⇒ the pair is omitted (no
conflict claim). No resolution/advice appears here.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Gather confirmed goals      — only real, confirmed goals are valid endpoints.
Step 2  Form candidate pairs        — pairs that plausibly compete (resource/time/risk).
Step 3  Look up the real edge       — query GraphRAG connected_pairs for an existing edge per pair.
Step 4  Run the citation gate       — _check_relationships; no edge ⇒ DROP the pair (stay single-goal).
Step 5  Quantify the tension        — from domain context, state what each goal costs/protects (cited).
Step 6  Frame the tradeoff          — express as a tradeoff + a clarifying question (never a resolution).
Step 7  Score confidence            — GC weighted heavily (edge-backed); per AGENT_CONFIDENCE_MODEL.md.
Step 8  Escalate resolution         — if "how do I resolve this?" → Decision Scientist.
Step 9  Return                       — envelope; cited conflicts only; never advise/persist.
```

The agent **detects and cites** tension; it never **resolves** it (resolution → §11) and never **invents** an
edge.

---

## 7. Tool Rules

- **Allowed:** GraphRAG read (`connected_pairs`/edges); the validator relationship check; domain-summary
  reads for tradeoff framing.
- **Required:** the citation gate (`_check_relationships`) on every conflict before it is surfaced.
- **Forbidden:** direct database writes; creating/inferring edges; resolving the conflict; any number not
  drawn from a fact or a trace.

---

## 8. GraphRAG Rules

- **May:** retrieve existing goal-to-goal edges and their `edge_confidence`; cite them as conflicts.
- **May not:** create relationships; infer an edge where none exists; persist edges; assert a conflict on a
  pair that has no real cited edge (citation contract — the core of this agent's contract).

---

## 9. Memory Rules

- **Can access:** confirmed goals, goal/constraint context, and domain summaries — read-only.
- **Cannot access:** another tenant's data; private domain memory beyond what frames the tradeoff;
  conversation memory beyond the bounded context Memory exposes.

---

## 10. Confidence Model

Uses the global formula (`AGENT_CONFIDENCE_MODEL.md`) with Goal Conflict weights (graph-dominant):

| Weight                   | Value | Rationale                                             |
| ------------------------ | ----- | ----------------------------------------------------- |
| wGC (graph confidence)   | 0.40  | a conflict IS a cited edge — its confidence dominates |
| wEC (evidence coverage)  | 0.25  | each conflict carries supporting evidence             |
| wPQ (provenance quality) | 0.20  | the endpoint goals must be real/confirmed             |
| wDC (data completeness)  | 0.15  | enough goals present to form pairs                    |
| wTA (tool availability)  | N/A   | no deterministic calculation                          |

`confidence = 0.40·GC + 0.25·EC + 0.20·PQ + 0.15·DC` (TA dropped/renormalized). No `success` below 0.75; a
weak/absent edge → drop the pair, never assert a low-confidence conflict.

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                     | → To                                     |
| ------------------------------------------- | ---------------------------------------- |
| User asks "how do I resolve this conflict?" | Decision Scientist                       |
| The tradeoff needs option modeling          | Decision Scientist → Scenario → Tradeoff |
| A goal endpoint is unconfirmed/missing      | Goal Discovery                           |
| Edge exists but evidence is thin            | Missing Data                             |
| Needs goal-to-goal edges/evidence           | Memory / GraphRAG                        |
| A concrete action emerges from the tradeoff | Recommendation Agent                     |

Escalation is ownership-driven; resolution is **always** escalated (this agent never advises).

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — one or more edge-backed, cited conflicts surfaced (≥0.75).
- `needs_data` — too few confirmed goals, or evidence too thin to cite (ranked gaps).
- `needs_confirmation` — a conflict rests on a candidate/unconfirmed goal endpoint.
- `blocked` — GraphRAG/validator unavailable; cannot run the citation gate.
- `escalated` — resolution requested → Decision Scientist.
- `compliance_rejected` — an uncited conflict or a resolution leaked and failed the gate.
  No guessing — no real edge means no conflict claim; the agent stays single-goal.

---

## 13. Compliance Requirements

- Every conflict requires a real cited edge with `edge_confidence` (citation contract); else dropped.
- No resolution/advice (resolution → Decision Scientist).
- No fabricated evidence; each conflict carries its real evidence rows.
- No persistence; no user-facing text.
- No created/inferred graph edges.

---

## 14. Example Scenarios

**Positive (5):**

1. House down-payment goal + emergency-liquidity goal with a real `competes_for_resource` edge → cited
   conflict + tradeoff question → `success`, conf ~0.85.
2. Two career/education goals with a real time-conflict edge → cited tradeoff (what each costs).
3. Edge confidence high, evidence present → surfaced; user then asks how to resolve → `escalated`.
4. Three goals; only one pair has a real edge → exactly one conflict surfaced, others omitted.
5. Conflict surfaced and a concrete action emerges → `escalated` to Recommendation Agent.

**Negative (5) — must NOT happen:**

1. Asserting "your house goal conflicts with retirement" with no cited edge (→ must omit).
2. Saying "you should delay the house" (resolution → Compliance reject; must escalate).
3. Creating a goal-to-goal edge to justify a conflict (→ forbidden; cite only real edges).
4. Inventing evidence for a tension (→ reject).
5. Reporting a conflict between a goal and a non-goal/assumption (only confirmed goals are endpoints).

**Edge cases (5):**

1. Edge exists but `edge_confidence` is low → below 0.75 → drop or `needs_data`, never a forced `success`.
2. One endpoint is a candidate goal → `needs_confirmation`; don't assert as a live conflict.
3. Two edges contradict → surface both with their confidences; do not reconcile (that's resolution).
4. GraphRAG down → `blocked`; cannot run the citation gate; deterministic fallback.
5. Pair plausibly tensions but has no edge → stay single-goal; optionally `needs_data` for an edge.

---

## 15. Unit Test Matrix

| Class         | Test                          | Expected                                                        |
| ------------- | ----------------------------- | --------------------------------------------------------------- |
| Happy path    | two goals with a real edge    | `success`, conf ≥0.75, cited conflict + tradeoff, no resolution |
| Missing data  | <2 confirmed goals            | `needs_data`; no conflict asserted                              |
| Conflict      | resolution requested          | `escalated` to Decision Scientist; no advice given              |
| Conflict      | candidate-goal endpoint       | `needs_confirmation`; not a live conflict                       |
| Compliance    | conflict with no cited edge   | `compliance_rejected` (citation contract)                       |
| Compliance    | resolution text leaked        | `compliance_rejected`                                           |
| Hallucination | fabricated edge/evidence      | claim dropped; `compliance_rejected` if asserted                |
| Hallucination | plausible-but-uncited tension | omitted; agent stays single-goal                                |
| Confidence    | components present            | confidence object has GC/EC/PQ/DC (+ n/a) + explanation         |
| Escalation    | action emerges from tradeoff  | `escalated` to Recommendation Agent                             |
