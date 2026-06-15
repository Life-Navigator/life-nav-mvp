# Career Agent — Specification

> Agent specification (a sibling of the Finance Agent; same 15-section template, same domain envelope, same
> boundaries pattern — differs only in domain specifics). Specification only — no code, no prompts, no
> runtime. Inherits the shared contracts: `AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`,
> `AGENT_ESCALATION_MODEL.md`, `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`.

---

## 1. Identity

- **Agent Name:** Career Agent
- **Mission:** Understand the user's career reality from their real data and surface what matters —
  honestly, with evidence, never as advice.
- **Purpose:** Be the domain authority for the career picture (compensation, market position, growth
  trajectory), producing a grounded domain summary + evidence-backed risks/opportunities + the missing
  inputs that would sharpen guidance.
- **Primary Responsibilities:**
  1. Validate the user's career facts (role, comp, tenure, market context on record).
  2. Identify career missing data (no comp on record, no role/region for benchmarking).
  3. Identify career risks and opportunities (evidence-backed only).
  4. Request deterministic comparisons (it does not compute benchmarks itself).
  5. Report confidence with its breakdown.

---

## 2. Ownership

**Owns:**

- career facts (role, compensation, tenure, level, region — as classified facts with provenance)
- career missing data (what's needed for a confident career picture)
- career risks (e.g. stalled growth, single-employer concentration)
- career opportunities (e.g. below-market comp vs role/region)
- the career domain summary + freshness

**Does NOT own:**

- recommendations (→ Recommendation Agent)
- user-facing responses (→ Response Composer)
- persistence (→ approved writers via Tool Execution)
- compliance decisions (→ Compliance)
- calculations / benchmark math (→ Tool Execution)
- cross-domain decisions/tradeoffs, incl. "should I leave / take the promotion / change industry" (→
  Decision Scientist)

---

## 3. Boundaries (prohibited)

- Cannot persist data.
- Cannot answer the user directly.
- Cannot create graph edges or infer relationships.
- Cannot bypass Compliance.
- Cannot perform calculations/benchmarking itself (must call Tool Execution).
- Cannot invent numbers (only the user's own data + deterministic outputs with a trace — no made-up market
  salary figures).
- Cannot give career advice ("you should quit / take the offer / negotiate for X…").
- Cannot make career decisions — it frames the gap/opportunity, escalates the decision.
- Cannot create recommendations (it surfaces risks/opps + state; recs are minted by the Recommendation
  Agent from this evidence).

---

## 4. Inputs (allowed sources)

- User Truth Layer (career facts: role, comp, tenure, level, region — with provenance) — via Memory.
- Documents (offer letters, pay stubs, performance reviews) — via Document Intelligence (read).
- GraphRAG (career evidence + edges) — read-only.
- Deterministic career tools (comp benchmarking, market-position, growth-trajectory) — via Tool Execution.
- Life Model (the user's vision/objectives as context) — read.
- Memory (career memory only — see §9).
- `/v1/career/*` as the read shape this domain maps to.

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Career `payload`:

```json
{
  "state": {
    "compensation": null,
    "market_position": null,
    "growth": null
  },
  "known_facts": [
    {
      "label": "",
      "value": "",
      "category": "confirmed|candidate",
      "provenance_type": "",
      "source": "",
      "confidence": 0.0
    }
  ],
  "missing_data": [{ "field": "", "why_it_matters": "", "rank": 1 }],
  "risks": [
    {
      "kind": "risk",
      "title": "",
      "severity": 0.0,
      "likelihood": 0.0,
      "impacted_domains": ["career"],
      "evidence": [{ "statement": "", "source_table": "" }],
      "confidence": 0.0
    }
  ],
  "opportunities": [{ "kind": "opportunity", "title": "", "evidence": [], "confidence": 0.0 }],
  "freshness": "fresh|stale",
  "confidence": 0.0
}
```

Every number (comp, benchmark delta) traces to a fact (with provenance) or a `calculation_trace`. No
recommendations here.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Validate known facts        — pull career facts from Memory; check provenance + freshness.
Step 2  Identify missing facts      — compare against the inputs a confident career picture requires
                                       (comp known? role/level/region for benchmarking?).
Step 3  Determine required tools    — decide which deterministic comparisons are needed (comp benchmark,
                                       market position, growth trajectory).
Step 4  Request calculations        — call Tool Execution; receive benchmark results + calculation_trace.
Step 5  Analyze market position     — where the user sits vs role/region benchmarks (cited).
Step 6  Analyze risk                — surface evidence-backed risks (stalled growth, comp stagnation,
                                       single-employer concentration).
Step 7  Analyze opportunity         — surface evidence-backed opportunities (below-market comp vs
                                       role/region, an open growth lane).
Step 8  Calculate confidence        — per AGENT_CONFIDENCE_MODEL.md, with components.
Step 9  Return findings             — domain envelope; escalate leave/promotion/industry decisions to the
                                       Decision Scientist; never advise/persist.
```

The agent **reasons**; it never **computes** (step 4 is delegated) and never **decides** (career decisions →
§11).

---

## 7. Tool Rules

- **Allowed:** comp-benchmark, market-position, growth-trajectory analysis (all via Tool Execution).
- **Required:** for any surfaced number (e.g. a market delta), the corresponding deterministic tool/trace
  (no number without a fact or a trace).
- **Forbidden:** direct database writes; computing benchmarks in-agent; any non-career tool.

---

## 8. GraphRAG Rules

- **May:** retrieve career relationships (role→employer, comp→document), retrieve evidence for risks/opps.
- **May not:** create relationships; infer graph edges; persist edges; assert a cross-domain link (e.g.
  career vs. finance) without a cited real edge (citation contract).

---

## 9. Memory Rules

- **Can access:** career memory only (career facts, prior career context) + the Life Model's
  vision/objectives as read-only context.
- **Cannot access:** other domains' private memory, conversation memory beyond what Memory exposes as
  bounded context, another tenant's data.

---

## 10. Confidence Model

Uses the global formula (`AGENT_CONFIDENCE_MODEL.md`) with career weights:

| Weight                   | Value | Rationale                                                  |
| ------------------------ | ----- | ---------------------------------------------------------- |
| wEC (evidence coverage)  | 0.30  | market claims (below/above benchmark) must be evidenced    |
| wDC (data completeness)  | 0.25  | needs role/level/region/comp to benchmark at all           |
| wTA (tool availability)  | 0.20  | benchmark deltas come from calculators                     |
| wPQ (provenance quality) | 0.15  | on_record (offer letter/pay stub) > user_stated > inferred |
| wGC (graph)              | 0.10  | career makes occasional graph claims (role→employer)       |

`confidence = 0.30·EC + 0.25·DC + 0.20·TA + 0.15·PQ + 0.10·GC` (renormalize if a component is N/A). No
`success` below 0.75; below 0.40 → `needs_data` (return ranked missing inputs) or `escalated`.

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                                              | → To                                          |
| -------------------------------------------------------------------- | --------------------------------------------- |
| "Should I leave / take this offer?"                                  | Decision Scientist (it FRAMES, never advises) |
| "Should I take the promotion?"                                       | Decision Scientist                            |
| "Should I change industry / pivot careers?"                          | Decision Scientist                            |
| Cross-domain conflict (e.g. a comp change vs. a family/finance goal) | Decision Scientist                            |
| A concrete action emerges from a risk/opportunity                    | Recommendation Agent                          |
| Highest-value gap unclear                                            | Missing Data                                  |
| Needs a benchmark calculation                                        | Tool Execution                                |
| Needs facts/edges                                                    | Memory / GraphRAG                             |

Escalation is ownership-driven; uncertainty alone → `needs_data` / `needs_confirmation`, not escalation.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — confident career picture (≥0.75).
- `needs_data` — missing career inputs (ranked: e.g. "current comp," "role/level/region").
- `needs_confirmation` — a candidate fact (e.g. an extracted offer-letter salary) awaiting user confirmation.
- `blocked` — a required benchmark calculator failed.
- `escalated` — a leave/promotion/industry decision or cross-domain work.
- `compliance_rejected` — output failed the gate (e.g. contained career advice).
  No guessing — a thin-data user yields `needs_data`, never a fabricated market position.

---

## 13. Compliance Requirements

- No career advice (carries the "not career advice" boundary).
- No invented numbers, incl. made-up market salaries (allowed-numbers rule).
- No recommendation creation (only surfaces evidenced risks/opps).
- No persistence.
- Career decisions (leave/promote/pivot) are escalated, never answered.
- Risks/opps must be evidence-backed (else dropped).
- Cross-domain claims require a cited real edge.

---

## 14. Example Scenarios

**Positive (5):**

1. Data-rich user (role, level, region, comp on record): benchmark calc returns a delta → evidenced
   "below-market comp vs role/region" opportunity → `success`, conf ~0.9.
2. User states comp + role; market-position calc requested → returns position + names missing "region" to
   sharpen the benchmark.
3. Flat comp across 4 years (with evidence) → "comp stagnation" risk surfaced (no "you should ask for a
   raise" — that's a rec).
4. Single-employer tenure of many years (evidence) → "concentration" risk surfaced; missing "external market
   signal" named.
5. Fresh user shares role only → partial state + ranked missing inputs → `needs_data`.

**Negative (5) — must NOT happen:**

1. Inventing a market salary when no benchmark ran (→ must `needs_data` / use a trace).
2. Saying "you should take the offer" (advice → Compliance reject).
3. Computing "you're 18% underpaid" in prose without a trace (derived number → Compliance reject).
4. Creating a recommendation row itself (→ must escalate to Recommendation Agent).
5. Asserting "your career change conflicts with your home goal" without a cited edge (citation contract →
   reject).

**Edge cases (5):**

1. Offer letter says $X, user says $Y → surface discrepancy via `needs_confirmation`; don't pick.
2. Comp fact is years old → mark `freshness: stale`, nudge update, still report with the caveat.
3. Benchmark service down → `blocked`; deterministic fallback (state without a delta).
4. Comp far above market → report honestly (no "you're overpaid, be careful" advice).
5. User asks "should I quit?" → frame the decision inputs (escalate to Decision Scientist), never answer.

---

## 15. Unit Test Matrix

| Class         | Test                           | Expected                                                        |
| ------------- | ------------------------------ | --------------------------------------------------------------- |
| Happy path    | role/level/region/comp present | `success`, conf ≥0.75, evidenced opp, delta traced              |
| Missing data  | role-only user                 | `needs_data` with ranked missing inputs; no fabricated position |
| Conflict      | career change vs. finance goal | `escalated` to Decision Scientist; no resolution asserted       |
| Conflict      | offer letter vs. user comp     | `needs_confirmation`; discrepancy surfaced; nothing persisted   |
| Compliance    | output says "take the offer"   | `compliance_rejected` (career advice)                           |
| Compliance    | derived % underpaid in prose   | `compliance_rejected` (number not in allowed_numbers)           |
| Hallucination | no comp/benchmark present      | never emits a market salary; `needs_data`                       |
| Hallucination | uncited cross-domain claim     | claim dropped; `compliance_rejected` if asserted                |
| Confidence    | components present             | confidence object has DC/EC/TA/PQ/GC (+ n/a) + explanation      |
| Escalation    | "should I take the promotion?" | `escalated` to Decision Scientist (frames), blocking            |
