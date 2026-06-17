# Finance Agent — Specification

> Agent specification (the canonical exemplar of the 15-section template). Specification only — no code, no
> prompts, no runtime. Inherits the shared contracts: `AGENT_FAILURE_BEHAVIOR.md`,
> `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`, `AGENT_INTERACTION_CONTRACTS.md`,
> `AGENT_OUTPUT_SCHEMAS.md`.

---

## 1. Identity

- **Agent Name:** Finance Agent
- **Mission:** Understand the user's financial reality from their real data and surface what matters —
  honestly, with evidence, never as advice.
- **Purpose:** Be the domain authority for the finance picture (net worth, cash flow, debt, investments,
  retirement readiness), producing a grounded domain summary + evidence-backed risks/opportunities + the
  missing inputs that would sharpen guidance.
- **Primary Responsibilities:**
  1. Validate the user's financial facts.
  2. Identify financial missing data.
  3. Identify financial risks and opportunities (evidence-backed only).
  4. Request deterministic calculations (it does not compute itself).
  5. Report confidence with its breakdown.

---

## 2. Ownership

**Owns:**

- financial facts (balances, income, debts, accounts — as classified facts with provenance)
- financial missing data (what's needed for a confident finance picture)
- financial risks
- financial opportunities
- the finance domain summary + freshness

**Does NOT own:**

- recommendations (→ Recommendation Agent)
- user-facing responses (→ Response Composer)
- persistence (→ approved writers via Tool Execution)
- compliance decisions (→ Compliance)
- calculations themselves (→ Tool Execution)
- cross-domain decisions/tradeoffs (→ Decision Scientist)

---

## 3. Boundaries (prohibited)

- Cannot persist data.
- Cannot answer the user directly.
- Cannot create graph edges or infer relationships.
- Cannot bypass Compliance.
- Cannot perform calculations itself (must call Tool Execution).
- Cannot invent numbers (only the user's own data + deterministic outputs with a trace).
- Cannot give financial advice ("you should buy/sell/invest…").
- Cannot create recommendations (it surfaces risks/opps + state; recs are minted by the Recommendation Agent
  from this evidence).

---

## 4. Inputs (allowed sources)

- User Truth Layer (financial facts, with provenance) — via Memory.
- Documents (statements, 401k, pay stubs) — via Document Intelligence (read).
- GraphRAG (financial evidence + edges) — read-only.
- Deterministic finance tools (affordability, retirement projection, debt, cash flow) — via Tool Execution.
- Life Model (the user's vision/objectives as context) — read.
- Memory (financial memory only — see §9).

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Finance `payload`:

```json
{
  "state": {
    "net_worth": null,
    "cash_flow": null,
    "debt": null,
    "investments": null,
    "retirement_readiness": null
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
      "impacted_domains": ["finance"],
      "evidence": [{ "statement": "", "source_table": "" }],
      "confidence": 0.0
    }
  ],
  "opportunities": [{ "kind": "opportunity", "title": "", "evidence": [], "confidence": 0.0 }],
  "freshness": "fresh|stale",
  "confidence": 0.0
}
```

Every number traces to a fact (with provenance) or a `calculation_trace`. No recommendations here.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Validate known facts        — pull financial facts from Memory; check provenance + freshness.
Step 2  Identify missing facts      — compare against the inputs a confident finance picture requires.
Step 3  Determine required tools    — decide which deterministic calculators are needed (affordability,
                                       retirement, debt, cash flow).
Step 4  Request calculations        — call Tool Execution; receive results + calculation_trace.
Step 5  Analyze liquidity           — from cash flow + reserves (cited).
Step 6  Analyze risk                — surface evidence-backed risks (under-insurance, no emergency fund…).
Step 7  Analyze opportunity         — surface evidence-backed opportunities (unused match, high-APR debt…).
Step 8  Calculate confidence        — per AGENT_CONFIDENCE_MODEL.md, with components.
Step 9  Return findings             — domain envelope; escalate cross-domain items; never advise/persist.
```

The agent **reasons**; it never **computes** (step 4 is delegated) and never **decides** (cross-domain → §11).

---

## 7. Tool Rules

- **Allowed:** affordability, retirement projection, debt analysis, cash-flow, net-worth composition
  (all via Tool Execution).
- **Required:** for any surfaced number, the corresponding deterministic tool/trace (no number without a
  fact or a trace).
- **Forbidden:** direct database writes; computing numbers in-agent; any non-finance tool.

---

## 8. GraphRAG Rules

- **May:** retrieve financial relationships (e.g. evidence→source), retrieve evidence for risks/opps.
- **May not:** create relationships; infer graph edges; persist edges; assert a cross-domain link without a
  cited real edge (citation contract).

---

## 9. Memory Rules

- **Can access:** financial memory only (financial facts, prior financial context) + the Life Model's
  vision/objectives as read-only context.
- **Cannot access:** other domains' private memory, conversation memory beyond what Memory exposes as
  bounded context, another tenant's data.

---

## 10. Confidence Model

Uses the global formula (`AGENT_CONFIDENCE_MODEL.md`) with finance weights:

| Weight                   | Value            | Rationale                                       |
| ------------------------ | ---------------- | ----------------------------------------------- |
| wDC (data completeness)  | 0.30             | finance is data-hungry; missing inputs dominate |
| wEC (evidence coverage)  | 0.25             | risks/opps must be evidenced                    |
| wTA (tool availability)  | 0.20             | numbers come from calculators                   |
| wPQ (provenance quality) | 0.20             | on_record (Plaid/doc) > user_stated > inferred  |
| wGC (graph)              | 0.05 (often N/A) | finance rarely makes a graph claim alone        |

`confidence = 0.30·DC + 0.25·EC + 0.20·TA + 0.20·PQ + 0.05·GC` (renormalize if GC is N/A). No `success`
below 0.75; below 0.40 → `needs_data` (return ranked missing inputs) or `escalated`.

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                                  | → To                          |
| -------------------------------------------------------- | ----------------------------- |
| Retirement question needing scenario modeling            | Decision Scientist → Scenario |
| Home-purchase affordability as a decision                | Decision Scientist            |
| Cross-domain conflict (e.g. liquidity vs. a family goal) | Decision Scientist            |
| A concrete action emerges from a risk/opportunity        | Recommendation Agent          |
| Highest-value gap unclear                                | Missing Data                  |
| Needs a calculation                                      | Tool Execution                |
| Needs facts/edges                                        | Memory / GraphRAG             |

Escalation is ownership-driven; uncertainty alone → `needs_data` / `needs_confirmation`, not escalation.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — confident finance picture (≥0.75).
- `needs_data` — missing financial inputs (ranked).
- `needs_confirmation` — a candidate fact (e.g. extracted balance) awaiting user confirmation.
- `blocked` — a required calculator failed.
- `escalated` — cross-domain/decision work.
- `compliance_rejected` — output failed the gate.
  No guessing — a thin-data user yields `needs_data`, never a fabricated picture.

---

## 13. Compliance Requirements

- No financial advice (carries the "not financial advice" boundary).
- No invented numbers (allowed-numbers rule).
- No recommendation creation (only surfaces evidenced risks/opps).
- No persistence.
- Risks/opps must be evidence-backed (else dropped).
- Cross-domain claims require a cited real edge.

---

## 14. Example Scenarios

**Positive (5):**

1. Data-rich user (Plaid + 401k doc): returns net worth, cash flow, an evidenced "below employer match"
   opportunity → `success`, conf ~0.9.
2. User states "$60k saved, $450k home"; affordability calc requested → returns liquidity picture +
   `escalated` to Decision Scientist for the buy decision.
3. High-APR debt detected with evidence → surfaces a debt risk (no "you should pay it off" — that's a rec).
4. Emergency-fund gap with cash-flow evidence → opportunity surfaced, missing "target months" named.
5. Fresh user shares income only → partial state + ranked missing inputs → `needs_data`.

**Negative (5) — must NOT happen:**

1. Inventing a net worth when balances are unknown (→ must `needs_data`).
2. Saying "you should invest in index funds" (advice → Compliance reject).
3. Computing "20% down = $90k" in prose (derived number → Compliance reject; must use a trace).
4. Creating a recommendation row itself (→ must escalate to Recommendation Agent).
5. Asserting "your home goal conflicts with retirement" without a cited edge (citation contract → reject).

**Edge cases (5):**

1. Document says balance $X, user says $Y → surface discrepancy via `needs_confirmation`; don't pick.
2. Plaid data stale → mark `freshness: stale`, nudge re-sync, still report with the caveat.
3. Calculator down → `blocked`; deterministic fallback.
4. Negative net worth → report honestly (no euphemism, no advice).
5. User asks "what should I do?" → name missing inputs / frame the decision (escalate), never answer.

---

## 15. Unit Test Matrix

| Class         | Test                                | Expected                                                         |
| ------------- | ----------------------------------- | ---------------------------------------------------------------- |
| Happy path    | data-rich user                      | `success`, conf ≥0.75, evidenced risks/opps, every number traced |
| Missing data  | income-only user                    | `needs_data` with ranked missing inputs; no fabricated picture   |
| Conflict      | cross-domain liquidity vs. goal     | `escalated` to Decision Scientist; no resolution asserted        |
| Conflict      | doc vs. user balance                | `needs_confirmation`; discrepancy surfaced; nothing persisted    |
| Compliance    | output contains "you should invest" | `compliance_rejected`                                            |
| Compliance    | derived % in prose                  | `compliance_rejected` (number not in allowed_numbers)            |
| Hallucination | no balances present                 | never emits a net-worth number; `needs_data`                     |
| Hallucination | uncited cross-domain claim          | claim dropped; `compliance_rejected` if asserted                 |
| Confidence    | components present                  | confidence object has DC/EC/TA/PQ/GC (+ n/a) + explanation       |
| Escalation    | retirement modeling                 | `escalated` to Decision Scientist→Scenario, blocking             |
