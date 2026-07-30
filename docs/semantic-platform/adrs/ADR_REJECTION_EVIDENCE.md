# ADR Rejection Evidence

**Date:** 2026-07-30 · **Purpose:** the question for the review is not _"do we like this decision?"_ but
**"what evidence would cause us to reject it?"**

A decision no evidence could overturn is not a decision; it is a preference. Each record below states
the observation that kills it, who can produce that observation, and what replaces the decision if the
observation appears. **If a reviewer cannot name the disproving evidence, the ADR is not ready.**

---

| ADR                   | Evidence that would REJECT the decision                                                                                                                                         | Producible by                        | Falls back to                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **001** Transactions  | An advisor query class **requires** 1-hop `user → transaction` and cannot be re-pointed without quality loss (OQ-11); **or** golden-set financial categories regress at depth 2 | ADR-004 golden set + query inventory | Option 1 (status quo) pending a different aggregation design                                       |
| **002** Provenance    | Plaid sync proves **heterogeneous per edge** (OQ-2) — batch provenance would then be a lie about shared origin                                                                  | Worker queue + one live ingest trace | Option 3: per-edge relational assertions (storage argument weakens, correctness holds)             |
| **003** Authorization | Personal advisor does **not** resolve to exactly 119 relationship types after migration — proves the export is not faithful                                                     | Migration regression test            | Halt; re-derive the export until parity is exact                                                   |
| **004** Evaluation    | Synthetic personas cannot yield ≥100 queries across all six categories (OQ-4); **or** known-absent queries prove unconstructible because absence cannot be verified             | Persona entity census                | Seed more synthetic personas. **Never** substitute real tenant data                                |
| **005** Vector trust  | Filtering during search measurably degrades known-present retrieval; **or** propagation SLO proves unachievable, making dangerous drift routine rather than exceptional         | Golden set + drift telemetry         | Option 3 (separate collections) — accepting lifecycle cost to remove the projection                |
| **006** Identity      | `entity_id` is **already** business-key-derived (OQ-6) — most of the ADR reduces to documenting existing behaviour                                                              | Read `normalizer.rs` id construction | Document existing behaviour; keep only the alias table and merge-eligibility rules                 |
| **007** Credentials   | A legitimate consumer cannot function under least-privilege scoping                                                                                                             | Consumer inventory (step 4)          | Widen that scope **explicitly and documented** — never silently                                    |
| **008** Traversal     | **Zero non-seed paths** across all test tenants — traversal contributes nothing on the current graph                                                                            | Phase A trace artifact               | Defer all reasoning work; redirect to graph enrichment. **This is a valid outcome, not a failure** |
| **009** Gateway       | `central` Neo4j contains live content or has an active writer (OQ-7); **or** any legitimate traffic in 7 days; **or** any `410` hit during the shim release                     | Central inventory + access logs      | Re-open Option 2 (harvest, then retire)                                                            |
| **010** Confidence    | The three components correlate **> 0.9** — they are not independent and the model should collapse; **or** entity resolution yields no numeric signal (OQ-8)                     | Calibration run                      | Two components plus a boolean; or a single justified scalar if all three collapse                  |
| **011** Superclass    | Cross-domain queries show **no measured improvement** with expansion enabled                                                                                                    | ADR-004 cross-domain category        | Do not ship. The justification rule applied honestly                                               |

---

## Cross-cutting rejection triggers

These would force re-opening **multiple** records at once:

| Trigger                                                             | Rejects                                                  | Why                                                                                                                          |
| ------------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **OQ-9 bucket 5** — a tenant deleted in one store but not the other | ADR-007 closure claim, ADR-002 cascade design            | Proves prior deletions did not span stores; deletion proof is unfounded and must be redesigned before anything depends on it |
| **OQ-9 buckets 2/3/7** — ingest or identity defects                 | ADR-002, ADR-006, all quality gates                      | Store divergence is systematic, not benign; measurement baselines are unreliable                                             |
| **OQ-12** — an exposed credential was **used** during its window    | ADR-007 status; potentially the whole programme sequence | Converts an exposure into a breach with an unknown blast radius                                                              |
| Manifest v3 loader cannot reject v2 cleanly                         | ADR-003 **and** ADR-011                                  | The combined bump is the premise of CONFLICT-3's resolution                                                                  |

---

## Formal status rule — binding

> **No ADR may move from `Proposed` to `Accepted` while any material rejection trigger lacks:**
> **an accountable owner · a measurement method · a review date · an escalation path.**

All four, per trigger. An owner with no method cannot produce the observation; a method with no date
never runs; a date with no escalation path produces a finding nobody acts on. A trigger missing any of
the four is decorative, and an ADR resting on decorative triggers is advocacy, not a decision.

Enforced at the review gate (`ADR_REVIEW_AGENDA.md`) and recorded per record in
`artifacts/semantic-platform/adrs/adr_metadata.json`.

---

## Decisions that are NOT falsifiable by evidence

Stated explicitly so the review does not mistake them for empirical claims. **Each still carries a
reconsideration trigger** — "not empirically falsifiable" must never become "permanent and
unquestionable."

| Decision                                        | Basis                                                       | **Reconsideration trigger**                                                                                            |
| ----------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Do not rewrite git history (ADR-007)            | Judgement on cost vs benefit; rotation renders values inert | A **legally validated erasure requirement** that cannot be satisfied by any other means                                |
| Tenant-local identity by default (ADR-006)      | Security posture, not measurement                           | A **real cross-tenant entity-sharing use case** with a stated business need — not a hypothetical                       |
| No Bayesian combination yet (ADR-010)           | Absence of calibration data                                 | **Two calibrated, provably independent signals exist** (independence established via the ADR-002 provenance graph)     |
| Provider-context retrieval unresolved (ADR-003) | Deliberately out of scope                                   | **Must be revisited before the first provider-facing principal is deployed** — this one is a deadline, not a condition |

The provider trigger is the only one with a hard sequencing obligation: deploying a provider principal
without resolving it would be exactly the inheritance failure ADR-003 exists to prevent.

---

## The single question for each session

> _"What would we have to observe to conclude this decision is wrong — and is anyone actually looking
> for it?"_

The second clause matters more than the first. Every rejection trigger above must have a **named owner**
and a **date**, or the falsification criterion is decorative. Owners are assigned in
`ADR_REVIEW_AGENDA.md`; unowned triggers block the corresponding ADR from reaching `Accepted`.
