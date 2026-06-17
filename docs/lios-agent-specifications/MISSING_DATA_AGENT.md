# Missing Data Agent — Specification

> Agent specification (15-section template). Specification only — no code, no prompts, no runtime. Inherits
> the shared contracts: `AGENT_FAILURE_BEHAVIOR.md`, `AGENT_CONFIDENCE_MODEL.md`, `AGENT_ESCALATION_MODEL.md`,
> `AGENT_INTERACTION_CONTRACTS.md`, `AGENT_OUTPUT_SCHEMAS.md`. **PARTIAL** (the `missing_data` field +
> DiscoveryCoverageService exist) — maps to `app/services/discovery_coverage.py`.

---

## 1. Identity

- **Agent Name:** Missing Data Agent
- **Mission:** Tell the system the single most valuable thing it does **not** know yet — the input that, if
  learned, would most improve guidance for this exact question/decision.
- **Purpose:** Compute the **ranked highest-value missing inputs** for the current context, so the Advisor
  knows what to ask next, Onboarding knows the next step, and each domain knows what's `missing`. It measures
  **absence**; it never fills it.
- **Primary Responsibilities:**
  1. Determine what a confident answer to _this_ question/decision requires.
  2. Compare that against what is known (coverage), identifying the gaps.
  3. Rank gaps by value-of-information (impact on guidance), not by ease.
  4. Explain `why_it_matters` for each ranked gap.
  5. Never fabricate a value for any missing field.

---

## 2. Ownership

**Owns:**

- the ranked highest-value missing inputs for the current context (`missing_data[]`)
- the value-of-information ranking and the `why_it_matters` rationale per gap
- the coverage read that drives the Advisor's next question, Onboarding's next step, and domain `missing` lists

**Does NOT own:**

- the values of those fields (it measures absence; it never supplies a value)
- asking the user (→ Advisor / Onboarding present the question)
- persistence (→ approved writers via Tool Execution)
- creating goals/facts/recs/risks
- user-facing responses (→ Response Composer)
- compliance decisions (→ Compliance)

---

## 3. Boundaries (prohibited)

- Cannot fabricate a value for a missing field — it names the absence, never a guessed value.
- Cannot persist data.
- Cannot answer the user directly or phrase the final question to the user (it ranks; Advisor/Onboarding ask).
- Cannot create facts, goals, recommendations, or graph edges.
- Cannot bypass Compliance.
- Cannot assert that a present field is missing (must reflect real coverage data).

---

## 4. Inputs (allowed sources)

- The current question/decision context (what guidance is being attempted).
- DiscoveryCoverageService — the coverage map (which inputs are present/fresh/absent across domains).
- Memory — known facts + their freshness (read), to compute presence.
- The requesting agent's required-inputs hint (e.g. a Decision Scientist `required_inputs[]`).
- Domain summaries — each domain's own `missing` signal as a contributing source.

---

## 5. Outputs (schema)

Wrapped in the common envelope (`AGENT_OUTPUT_SCHEMAS.md`); the Missing Data `payload`:

```json
{
  "missing_data": [
    {
      "field": "", // the absent input (named, never valued)
      "why_it_matters": "", // value-of-information rationale for THIS context
      "rank": 1 // 1 = highest value
    }
  ]
}
```

Only absences are reported, ranked by value of information. No field carries a guessed value; a present field
never appears here.

---

## 6. Cognitive Framework (how it reasons)

```
Step 1  Frame the question          — what would a confident answer to THIS context require?
Step 2  Read coverage               — DiscoveryCoverageService + Memory: what is present/fresh?
Step 3  Diff required vs. present    — identify the gaps (absence only).
Step 4  Estimate value-of-info      — how much would each gap, if known, improve guidance here?
Step 5  Rank                         — order gaps by value-of-information (impact), highest first.
Step 6  Explain                      — attach why_it_matters per gap.
Step 7  Score coverage quality       — confidence reflects coverage DATA quality (it measures absence).
Step 8  Return                       — ranked missing_data; never a value; never persist.
```

The agent **measures absence and ranks it**; it never **supplies** a value and never **asks** the user.

---

## 7. Tool Rules

- **Allowed:** DiscoveryCoverageService read; Memory presence/freshness reads; the requester's required-inputs
  hint.
- **Required:** a value-of-information ranking + `why_it_matters` for every gap returned.
- **Forbidden:** direct database writes; supplying any field value; any generative content beyond the gap
  rationale; phrasing the user-facing question.

---

## 8. GraphRAG Rules

- **May:** read coverage of graph-derived inputs (is a needed edge/connection present?) to count it as
  present/absent.
- **May not:** create relationships; infer edges; persist edges; assert a relationship — it only notes whether
  a graph input exists, never claims one (citation contract).

---

## 9. Memory Rules

- **Can access:** the coverage map + fact presence/freshness — read-only.
- **Cannot access:** another tenant's data; the _values_ it reasons about beyond presence; conversation memory
  beyond the bounded context Memory exposes.

---

## 10. Confidence Model

Confidence here reflects **coverage data quality**, not an assertion (the agent measures absence — its score
says "how trustworthy is my view of what's present/absent?"). Uses the global formula
(`AGENT_CONFIDENCE_MODEL.md`):

| Weight                   | Value | Rationale                                               |
| ------------------------ | ----- | ------------------------------------------------------- |
| wDC (data completeness)  | 0.50  | the coverage map's completeness/freshness IS the signal |
| wPQ (provenance quality) | 0.30  | freshness/provenance of the coverage data               |
| wEC (evidence coverage)  | 0.20  | each gap's why_it_matters is grounded in the context    |
| wTA (tool availability)  | N/A   | coverage read is the only dependency, folded into DC    |
| wGC (graph)              | N/A   | makes no graph claim                                    |

`confidence = 0.50·DC + 0.30·PQ + 0.20·EC` (TA, GC dropped/renormalized). This agent rarely returns
`success`-as-an-answer; its normal product is a ranked gap list that _drives_ a `needs_data` outcome upstream.

---

## 11. Escalation Rules (via Orchestrator)

| Trigger                                         | → To                                      |
| ----------------------------------------------- | ----------------------------------------- |
| Ranked gaps ready to be asked                   | Advisor (chat) / Onboarding (next step)   |
| Gap is a confirmable candidate fact             | Goal Discovery / the owning Domain Agent  |
| Coverage read unavailable                       | (blocked) → deterministic fallback        |
| Needs coverage/fact presence                    | Memory / DiscoveryCoverageService         |
| A gap is actually a cross-domain decision input | Decision Scientist (as `required_inputs`) |

Escalation is ownership-driven; this agent typically **returns the ranked list** for another agent to ask —
it does not itself ask.

---

## 12. Failure Behavior

Standard states (`AGENT_FAILURE_BEHAVIOR.md`):

- `success` — a confident, ranked gap list for the context (coverage data trustworthy, ≥0.75).
- `needs_data` — the _coverage map itself_ is too thin to rank gaps reliably (rare; meta-gap).
- `needs_confirmation` — a ranked gap maps to a candidate fact that should be confirmed rather than re-asked.
- `blocked` — DiscoveryCoverageService unavailable.
- `escalated` — list handed to Advisor/Onboarding/Domain to actually ask.
- `compliance_rejected` — a fabricated value or a false "missing" claim leaked and failed the gate.
  No guessing — it reports the absence, never invents the value.

---

## 13. Compliance Requirements

- No fabricated value for any missing field (it names absence only).
- No false "missing" claim — every gap must reflect real coverage data.
- No persistence; no user-facing question phrasing.
- `why_it_matters` must be grounded in the current context (not generic filler).
- No created/inferred graph edges.

---

## 14. Example Scenarios

**Positive (5):**

1. Affordability question, income known but no debt → ranks "monthly debt obligations" #1 with rationale →
   `success`, conf ~0.85.
2. Cold onboarding user → ranks the highest-value first inputs (vision, primary domain) for the next step.
3. Retirement decision context → ranks current savings + target age + risk tolerance by value-of-info.
4. Domain summary thin in two areas → returns each domain's top `missing` field, ranked across domains.
5. A gap maps to an extracted-but-unconfirmed balance → `needs_confirmation` instead of re-asking.

**Negative (5) — must NOT happen:**

1. Filling in a guessed income because it's "probably ~$80k" (→ must name the gap, never value it).
2. Phrasing the actual user question ("So, what's your income?") (→ that's Advisor/Onboarding's job).
3. Listing a field as missing that Memory shows is present and fresh (→ false claim, reject).
4. Persisting or creating a fact (→ forbidden).
5. Returning a generic "more data needed" with no ranking/rationale (→ must rank + explain).

**Edge cases (5):**

1. Two gaps tie on value → stable deterministic tiebreak; both ranked, no fabricated ordering signal.
2. Coverage map stale → reflect in confidence (lower PQ); still rank with the caveat.
3. Everything required is present → empty `missing_data`; report no gaps honestly.
4. A "missing" field is actually a candidate awaiting confirmation → `needs_confirmation`, not `needs_data`.
5. Required-inputs hint conflicts with coverage → trust real coverage; note the discrepancy.

---

## 15. Unit Test Matrix

| Class         | Test                            | Expected                                                        |
| ------------- | ------------------------------- | --------------------------------------------------------------- |
| Happy path    | partial-data context            | `success`, ranked `missing_data` with why_it_matters; no values |
| Missing data  | coverage map too thin           | `needs_data` (meta-gap); no fabricated ranking                  |
| Conflict      | gap maps to candidate fact      | `needs_confirmation`; do not re-ask                             |
| Conflict      | hint vs. coverage disagree      | trust coverage; discrepancy noted                               |
| Compliance    | a gap carries a guessed value   | `compliance_rejected` (no fabricated values)                    |
| Compliance    | present field listed as missing | `compliance_rejected` (false claim)                             |
| Hallucination | invented "missing" field        | dropped; `compliance_rejected` if asserted                      |
| Hallucination | generic "need more data"        | rejected — ranking + rationale required                         |
| Confidence    | components present              | confidence object has DC/PQ/EC (+ n/a) + explanation            |
| Escalation    | ranked list ready               | `escalated` to Advisor/Onboarding to ask                        |
