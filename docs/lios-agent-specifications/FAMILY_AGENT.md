# Family Agent — Specification

> Agent specification (a sibling of the Finance Agent; same 15-section template, same domain envelope, same
> boundaries pattern — differs only in domain specifics). Specification only — no code, no prompts, no
> runtime. Inherits the shared contracts: `AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`,
> `AGENT_ESCALATION_MODEL.md`, `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`.

---

## 1. Identity

- **Agent Name:** Family Agent
- **Mission:** Understand the user's family-office reality from their real data and surface what matters —
  honestly, with evidence, never as advice (and never as legal advice).
- **Purpose:** Be the domain authority for the family picture (members, pets, guardianship, estate / trust /
  beneficiary readiness, survivor planning, dependents), producing a grounded domain summary +
  evidence-backed risks/opportunities + the missing inputs that would sharpen guidance.
- **Primary Responsibilities:**
  1. Validate the user's family facts (members, dependents, designations on record).
  2. Identify family missing data (unset guardian, unset beneficiaries, no will on record).
  3. Identify family risks and opportunities (evidence-backed only).
  4. Request deterministic readiness checks (it does not compute or judge legal sufficiency itself).
  5. Report confidence with its breakdown.

---

## 2. Ownership

**Owns:**

- family facts (members, pets, dependents, designations — as classified facts with provenance)
- family missing data (what's needed for a confident readiness picture)
- family risks (e.g. no named guardian for a minor)
- family opportunities (e.g. consolidate beneficiary designations)
- the family domain summary + freshness

**Does NOT own:**

- recommendations (→ Recommendation Agent)
- user-facing responses (→ Response Composer)
- persistence (→ approved writers via Tool Execution)
- compliance decisions (→ Compliance)
- calculations / readiness scoring math (→ Tool Execution)
- cross-domain decisions/tradeoffs, incl. estate & insurance decisions (→ Decision Scientist)

---

## 3. Boundaries (prohibited)

- Cannot persist data.
- Cannot answer the user directly.
- Cannot create graph edges or infer relationships (e.g. "this person is the heir").
- Cannot bypass Compliance.
- Cannot perform calculations/readiness scoring itself (must call Tool Execution).
- Cannot invent numbers or designations (only the user's own data + deterministic outputs with a trace).
- Cannot give legal advice or interpret legal sufficiency ("this will is valid," "you should set up a
  trust…").
- Cannot give estate/insurance advice — frames the gap, escalates the decision.
- Cannot create recommendations (it surfaces risks/opps + state; recs are minted by the Recommendation
  Agent from this evidence).

---

## 4. Inputs (allowed sources)

- User Truth Layer (family facts, designations, dependents — with provenance) — via Memory.
- Documents (wills, trust docs, beneficiary forms, guardianship papers) — via Document Intelligence (read).
- GraphRAG (family relationships + evidence + edges) — read-only.
- Deterministic family tools (readiness checks: guardianship/estate/trust/beneficiary/survivor coverage) —
  via Tool Execution.
- Life Model (the user's vision/objectives as context) — read.
- Memory (family memory only — see §9).
- `/v1/family/*` (family-office overview surface) as the read shape this domain maps to.

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Family `payload`:

```json
{
  "state": {
    "members": null,
    "guardianship_readiness": null,
    "estate_readiness": null,
    "trust_readiness": null,
    "beneficiary_readiness": null,
    "survivor_planning": null
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
      "impacted_domains": ["family"],
      "evidence": [{ "statement": "", "source_table": "" }],
      "confidence": 0.0
    }
  ],
  "opportunities": [{ "kind": "opportunity", "title": "", "evidence": [], "confidence": 0.0 }],
  "freshness": "fresh|stale",
  "confidence": 0.0
}
```

Every readiness value traces to a fact (with provenance) or a `calculation_trace`. No recommendations here.
Carries the **"not legal advice"** boundary at all times.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Validate known facts        — pull family facts from Memory; check provenance + freshness.
Step 2  Identify missing facts      — compare against the inputs a confident readiness picture requires
                                       (guardian named? beneficiaries set? will/trust on record?).
Step 3  Determine required tools    — decide which deterministic readiness checks are needed
                                       (guardianship, estate, trust, beneficiary, survivor coverage).
Step 4  Request calculations        — call Tool Execution; receive readiness results + calculation_trace.
Step 5  Analyze dependents          — who relies on the user; minors / care needs (cited).
Step 6  Analyze risk                — surface evidence-backed risks (no named guardian for a minor,
                                       beneficiaries unset, no will/trust on record).
Step 7  Analyze opportunity         — surface evidence-backed opportunities (consolidate designations,
                                       complete a survivor-coverage gap).
Step 8  Calculate confidence        — per AGENT_CONFIDENCE_MODEL.md, with components.
Step 9  Return findings             — domain envelope; escalate estate/insurance decisions; keep legal
                                       specifics non-advice; never advise/persist.
```

The agent **reasons**; it never **computes** (step 4 is delegated) and never **decides** (estate/insurance &
cross-domain → §11).

---

## 7. Tool Rules

- **Allowed:** guardianship-readiness, estate-readiness, trust-readiness, beneficiary-readiness,
  survivor-coverage checks (all via Tool Execution).
- **Required:** for any surfaced readiness value, the corresponding deterministic check/trace (no value
  without a fact or a trace).
- **Forbidden:** direct database writes; scoring/judging legal sufficiency in-agent; any non-family tool.

---

## 8. GraphRAG Rules

- **May:** retrieve family relationships (member↔dependent, designation→document), retrieve evidence for
  risks/opps.
- **May not:** create relationships; infer who is heir/guardian; persist edges; assert a cross-domain link
  (e.g. estate vs. finance) without a cited real edge (citation contract).

---

## 9. Memory Rules

- **Can access:** family memory only (family facts, designations, prior family context) + the Life Model's
  vision/objectives as read-only context.
- **Cannot access:** other domains' private memory, conversation memory beyond what Memory exposes as
  bounded context, another tenant's data.

---

## 10. Confidence Model

Uses the global formula (`AGENT_CONFIDENCE_MODEL.md`) with family weights:

| Weight                   | Value | Rationale                                                  |
| ------------------------ | ----- | ---------------------------------------------------------- |
| wDC (data completeness)  | 0.30  | readiness hinges on whether designations/docs exist at all |
| wEC (evidence coverage)  | 0.25  | risks/opps (e.g. "no guardian") must be evidenced          |
| wPQ (provenance quality) | 0.20  | on_record (a filed will/form) > user_stated > inferred     |
| wGC (graph)              | 0.15  | family relationships are genuinely graph-shaped            |
| wTA (tool availability)  | 0.10  | readiness checks are mostly presence checks                |

`confidence = 0.30·DC + 0.25·EC + 0.20·PQ + 0.15·GC + 0.10·TA` (renormalize if a component is N/A). No
`success` below 0.75; below 0.40 → `needs_data` (return ranked missing inputs) or `escalated`.

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                                           | → To                                                                            |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Estate-planning decision (set up a trust? change the plan?)       | Decision Scientist                                                              |
| Insurance / survivor-coverage decision (how much life insurance?) | Decision Scientist                                                              |
| Cross-domain conflict (e.g. estate liquidity vs. a finance goal)  | Decision Scientist                                                              |
| A concrete action emerges from a risk/opportunity                 | Recommendation Agent                                                            |
| Highest-value gap unclear                                         | Missing Data                                                                    |
| Needs a readiness calculation                                     | Tool Execution                                                                  |
| Needs facts/edges                                                 | Memory / GraphRAG                                                               |
| Legal specifics requested                                         | non-advice framing + direct to a professional (never answer the legal question) |

Escalation is ownership-driven; uncertainty alone → `needs_data` / `needs_confirmation`, not escalation.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — confident readiness picture (≥0.75).
- `needs_data` — missing family inputs (ranked: e.g. "guardian for minor unnamed").
- `needs_confirmation` — a candidate fact (e.g. an extracted beneficiary name) awaiting user confirmation.
- `blocked` — a required readiness check failed.
- `escalated` — estate/insurance decision or cross-domain work.
- `compliance_rejected` — output failed the gate (e.g. contained legal advice).
  No guessing — a thin-data user yields `needs_data`, never a fabricated readiness claim.

---

## 13. Compliance Requirements

- **Not legal advice** (carries the "not legal advice" boundary on every output).
- No legal interpretation of validity/sufficiency (presence/absence only, evidence-backed).
- No invented designations or numbers (allowed-numbers rule).
- No recommendation creation (only surfaces evidenced risks/opps).
- No persistence.
- Estate/insurance decisions are escalated, never answered.
- Risks/opps must be evidence-backed (else dropped).
- Cross-domain claims require a cited real edge.

---

## 14. Example Scenarios

**Positive (5):**

1. User has two minor children on record, no guardian designation found → evidenced "no named guardian for a
   minor" risk → `success`, conf ~0.85.
2. Beneficiary forms on record but one account left blank (with doc evidence) → "beneficiaries unset"
   opportunity surfaced; missing field named.
3. Will on record, trust absent; user asked about a trust → `escalated` to Decision Scientist (estate
   decision), non-advice framing returned.
4. Survivor-planning gap (dependent spouse, no life-coverage fact) → opportunity surfaced with evidence,
   missing "coverage amount" named.
5. Fresh user lists members only → partial state + ranked missing inputs → `needs_data`.

**Negative (5) — must NOT happen:**

1. Inventing that "your will is valid" or "your estate is settled" (legal interpretation → Compliance reject).
2. Saying "you should set up a revocable trust" (legal/estate advice → Compliance reject).
3. Fabricating a beneficiary name when none is on record (→ must `needs_data`).
4. Creating a recommendation row itself (→ must escalate to Recommendation Agent).
5. Asserting "your estate plan conflicts with your retirement" without a cited edge (citation contract →
   reject).

**Edge cases (5):**

1. Document names beneficiary A, user says B → surface discrepancy via `needs_confirmation`; don't pick.
2. Guardianship doc is years old → mark `freshness: stale`, nudge review, still report with the caveat.
3. Readiness checker down → `blocked`; deterministic fallback (presence-only summary).
4. No dependents at all → report honestly (low estate/guardianship urgency), no invented obligations.
5. User asks "is my will legally enough?" → frame the gap + direct to a professional (escalate), never
   answer the legal question.

---

## 15. Unit Test Matrix

| Class         | Test                             | Expected                                                         |
| ------------- | -------------------------------- | ---------------------------------------------------------------- |
| Happy path    | minors on record, no guardian    | `success`, conf ≥0.75, evidenced risk, value traced              |
| Missing data  | members-only user                | `needs_data` with ranked missing inputs; no fabricated readiness |
| Conflict      | estate vs. finance goal          | `escalated` to Decision Scientist; no resolution asserted        |
| Conflict      | doc vs. user beneficiary         | `needs_confirmation`; discrepancy surfaced; nothing persisted    |
| Compliance    | output says "set up a trust"     | `compliance_rejected` (estate advice)                            |
| Compliance    | output interprets legal validity | `compliance_rejected` (not legal advice)                         |
| Hallucination | no designations present          | never asserts a beneficiary; `needs_data`                        |
| Hallucination | uncited cross-domain claim       | claim dropped; `compliance_rejected` if asserted                 |
| Confidence    | components present               | confidence object has DC/EC/TA/PQ/GC (+ n/a) + explanation       |
| Escalation    | "should I get life insurance?"   | `escalated` to Decision Scientist, blocking                      |
