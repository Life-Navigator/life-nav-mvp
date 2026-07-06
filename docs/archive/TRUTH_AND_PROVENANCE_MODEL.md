# LIOS — Truth & Provenance Model

> The User Truth Layer: how a statement becomes a fact, how facts are classified and proven, and the only
> ways they are persisted. Companion to `DATA_FLOW_DIAGRAM.md`. Architecture only — no code.

---

## 1. Why a truth layer exists

LifeNavigator's value is that its guidance is grounded in the user's **own, real** data — and that the user
can always see _where each fact came from_. The User Truth Layer is the contract that makes this true:

> **Every fact LifeNavigator holds about a user has (a) a category, (b) a provenance, (c) a confidence, and
> (d) a single approved path by which it was written. Nothing else is "truth."**

This prevents the two failure modes that destroy trust in an AI life platform: **fabrication** (asserting
something the user never said and no data supports) and **laundering** (an inferred or assumed value being
shown as if it were a confirmed fact).

---

## 2. Fact categories (must stay separate — never merged)

The system distinguishes categories and **never collapses them**. The advisor context keeps these in
separate buckets, and Compliance rejects output that merges them.

| Category           | Meaning                                                                 | Example                                           | May drive recommendations?             |
| ------------------ | ----------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------------- |
| **Confirmed fact** | the user stated/confirmed it, or it's on-record from a document/account | "I have two children"                             | yes                                    |
| **Candidate fact** | proposed (by the LLM or an extractor) but not yet confirmed             | extracted "401k balance: $X" pending confirmation | only as clearly-labeled candidate      |
| **Assumption**     | an explicit, surfaced placeholder the engine needs to compute           | "assume 22% marginal tax for this projection"     | yes, but always shown as an assumption |
| **Missing data**   | a known gap                                                             | "retirement target age unknown"                   | no — it triggers a question            |
| **Inference**      | derived by deterministic logic from other facts                         | net worth = assets − liabilities                  | yes, with `calculated` provenance      |

> The cardinal rule: a **candidate** or **assumption** or **inference** may never be presented as a
> **confirmed fact**. Provenance is what keeps them honest.

---

## 3. Provenance types

Every surfaced fact carries a provenance type (the system uses an 8-type vocabulary; the badge UI renders
them). The canonical ladder, strongest to weakest:

| Provenance               | Badge              | Source                                                            | Confidence implication                           |
| ------------------------ | ------------------ | ----------------------------------------------------------------- | ------------------------------------------------ |
| `user_confirmed`         | Confirmed          | the user explicitly confirmed it                                  | highest                                          |
| `user_stated`            | On-record (stated) | the user said it (own words)                                      | high                                             |
| `on_record` / `document` | On-record          | a document or connected account (Plaid, statement)                | high, traceable to source                        |
| `calculated`             | Calculated         | deterministic math over other facts (carries a calculation trace) | exact given inputs                               |
| `suggested`              | Suggested          | an evidence-backed recommendation proposal                        | medium                                           |
| `inferred`               | Inferred           | derived heuristically                                             | medium-low, must be labeled                      |
| `assumed`                | Assumed            | an explicit placeholder for a computation                         | shown as an assumption                           |
| `advisor_inferred`       | Inferred (advisor) | the advisor's reading                                             | **lowest — must never masquerade as user truth** |

A live finding worth preserving: for the user's primary objective, the system records provenance as
**`user_stated`** (the user's own words) rather than `advisor_inferred` — i.e. the platform attributes the
objective to the _user_, not to itself. That is the correct, trust-preserving default and the model should
keep it.

Every provenance record also carries: `source` (free-form pointer, e.g. `documents:401k_statement`),
`confidence` (0–1), and `updated_at`.

---

## 4. The fact lifecycle

```
        ┌──────────┐   propose    ┌──────────┐   validate   ┌──────────┐   confirm    ┌──────────┐
 input ─▶ PROPOSED ├─────────────▶│ VALIDATED ├────────────▶│ CONFIRMABLE├────────────▶│ PERSISTED │
        └────┬─────┘  (LLM/extract)└────┬─────┘ (Compliance) └────┬─────┘  (user/ rule)└────┬─────┘
             │                          │                         │                        │
             │ rejected                 │ repaired                │ declined               │ projected
             ▼                          ▼                         ▼                        ▼
         dropped                   trimmed/safe              recorded as              Neo4j edge +
                                                             rejected (never          Qdrant vector
                                                             resurrected)             (provenance kept)
```

1. **Proposed.** The Advisor, Goal Discovery, or Document Intelligence proposes a candidate fact/goal with a
   source and confidence. (LLM proposals carry `source:"user_message"`; extractions carry the source doc.)
2. **Validated.** Compliance checks it: facts must declare a real source; numbers must be the user's own;
   relationships must be real edges; `should_persist` is forced to `false`. Output is accepted, repaired, or
   rejected.
3. **Confirmable.** A validated candidate is shown to the user (or meets a deterministic rule) and can be
   confirmed. In-session, a candidate is usable as context (e.g. its numbers join `allowed_numbers`) but is
   **not yet persisted**.
4. **Persisted.** On confirmation, an **approved writer** persists it with the appropriate provenance
   (`user_confirmed` / `on_record` / `calculated`). Declined goals are recorded as **rejected** and are
   never resurrected.
5. **Projected.** The committed relational write is projected into the graph + vectors, each carrying
   provenance back to the source.

> The LLM participates only in step 1 (propose). It never advances a fact to persisted. Steps 2–5 are
> deterministic.

---

## 5. Approved write paths (the only writers)

| Writer                           | Owns                                                                      | Refuses to write when                                                 |
| -------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| **RelationshipManager**          | goals, vision, primary objective, rejected goals, discovery state         | the fact isn't user-stated/confirmed                                  |
| **RecommendationOS**             | recommendations (with evidence, assumptions, confidence, rank, narrative) | **evidence is empty** (returns null — the core anti-fabrication rule) |
| **Document Intelligence writer** | documents, document fields, doc graph nodes                               | there is no real source document                                      |
| **Domain writers**               | finance/family/etc. domain rows                                           | input is untyped/unvalidated                                          |
| **GraphRAG sync**                | Neo4j edges, Qdrant vectors                                               | there is no committed source row                                      |

Two anti-fabrication guards are already enforced in code and are load-bearing for LIOS:

- **"No recommendation without evidence"** — `RecommendationOS.write` returns `null` (writes nothing) if
  `evidence` is empty. So any surfaced risk/opportunity/recommendation is, by construction, evidence-backed.
- **Validator persistence lock** — the advisor validator forces `should_persist=false`, drops candidate
  goals matching previously rejected goals, and filters facts to `source=="user_message"`.

---

## 6. The GraphRAG citation contract

Graph reasoning is held to the same standard as facts:

> **No cited edge ⇒ no claim.** The advisor may assert a relationship between two of the user's goals/
> objectives only if that pair is a **real edge** in the user's graph, and it must cite the exact pair in
> `relationships_referenced`. If the user's graph has no edges, no relationship may be claimed at all.

Nuance (so the gate is precise, not blunt): generic discovery language ("how this connects to your broader
vision/goals") is **not** a graph claim and is allowed; a specific **goal-to-goal** link ("your retirement
goal is connected to your education goal") **is** a claim and requires a real edge. Compliance distinguishes
these (two-entity/mutual phrasing, or a single-target phrase that names ≥2 of the user's own goals, counts
as a claim).

This contract is what lets the advisor reason over relationships without ever inventing graph structure.

---

## 7. Numbers: the allowed-numbers rule

A financial-looking number may appear in a response **only if it is the user's own** — i.e. present in the
user's messages/facts (the `allowed_numbers` set built by Memory/Context). The advisor may **reflect** the
user's numbers ("with your $60k saved…") but may **not compute new ones** (no derived percentages, sums, or
projections in conversational text — those come only from deterministic Tool Execution with a calculation
trace). Compliance rejects any financial number not in `allowed_numbers`.

This is why decision math lives in deterministic engines (which emit a `calculation_trace`) and never in
free LLM text.

---

## 8. No-fabrication invariants (the trust spine)

These are enforced, not aspirational. A response that violates any of them is rejected → deterministic
fallback.

1. No invented goals, risks, opportunities, or recommendations.
2. No financial number outside the user's own data (allowed-numbers rule).
3. No relationship without a real, cited graph edge (citation contract).
4. No recommendation without evidence (RecommendationOS guard).
5. No candidate/assumption/inference shown as a confirmed fact (category separation + provenance).
6. No resurrection of a rejected goal.
7. No final financial/legal/medical/tax advice (boundary — see `COMPLIANCE_AND_SAFETY_FLOW.md`).
8. No fabricated percentage or "north star"; honest `insufficient` states when data is thin.
9. The LLM never persists; only approved writers do, only after confirmation.

---

## 9. How truth surfaces to the user

- **Dashboard / Life Model** renders each fact with a `ProvenanceBadge` (Confirmed / On-record / Calculated
  / Suggested / Inferred / Assumed) so the user always sees _why_ the system believes something.
- **Reports / executive briefings (future)** must carry the same provenance, so a CFP/CPA reviewing a
  generated recommendation can see its basis (evidence + assumptions + confidence).
- **Advisor** reflects only what's in the bounded context, with the same grounding.

---

## 10. Live vs planned

- **Live:** category separation in the advisor context; provenance on the Life Model objective
  (`user_stated`); RecommendationOS evidence-or-nothing; validator persistence lock + rejected-goal
  suppression; allowed-numbers rule; the citation contract; ProvenanceBadge.
- **Planned:** first-class `provenance_type` / `source` / `confidence` / `updated_at` **columns** on every
  truth table (today some are derived in the API rather than stored); a single typed save-path registry; an
  explicit `missing_inputs` field per recommendation; provenance carried into the future report/PDF layer.
