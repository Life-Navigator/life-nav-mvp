# ADR Consistency Matrix

**Date:** 2026-07-30 · Cross-record pass over ADR-001 … ADR-011. All ADRs are `Proposed`.

---

## 1. Dependency graph

```
ADR-007 credentials ──► gates every write-enabled item (001 step 4, 002, 005 backfill, 009)
ADR-003 authorization ──┬──► ADR-008 traversal verification (needs `evaluation` context)
                        └──► ADR-011 superclass expansion (auth applied post-expansion)
ADR-002 provenance ──┬──► ADR-007 deletion proof (cascade needs provenance)
                     ├──► ADR-010 confidence (fields live on the assertion)
                     └──► ADR-006 identity (assertion subject id)
ADR-004 evaluation ──┬──► ADR-001 acceptance (no-regression gate)
                     └──► ADR-008 ablation measurement
ADR-001 transactions ──► ADR-002 (shrinks the dominant batch-provenance class)
ADR-010 confidence ──► ADR-005 (eligibility flags derive from confidence + review state)
ADR-006 identity ──► ADR-002 (stable subject), ADR-010 (`resolution` component)
ADR-009 gateway ──► independent; gated on OQ-7
```

---

## 2. Required consistency checks (from the brief)

| #   | Check                                                           | Verdict                                    | Evidence / resolution                                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | ADR-001 aggregation aligns with ADR-002 granularity             | ✅ **Consistent**                          | ADR-001 keeps account-anchored `HAS_TRANSACTION`; ADR-002 assigns bulk-sync edges `batch_id` only. Fewer transaction edges _reduces_ provenance volume. Mutually reinforcing.                                                                                                                 |
| 2   | ADR-002 provenance supports ADR-007 deletion proof              | ✅ **Consistent**                          | ADR-002 defines source→assertion cascade and batch cascade; ADR-007 requires per-store deletion artifacts. ADR-002 is the enabling mechanism.                                                                                                                                                 |
| 3   | ADR-003 authorization enforced before ADR-008 traversal testing | ✅ **Consistent, and sequenced**           | ADR-008 Migration step 1 explicitly requires ADR-003 to land so the `evaluation` context exists. ADR-008 must never run under `personal_advisor`.                                                                                                                                             |
| 4   | ADR-004 can measure ADR-001 and ADR-008 outcomes                | ✅ **Consistent**                          | ADR-004 known-present category covers ADR-001's depth-2 no-regression gate; ADR-008 traces feed ADR-004's ablation.                                                                                                                                                                           |
| 5   | ADR-005 vector trust compatible with ADR-010 confidence         | ⚠️ **Consistent with a stated constraint** | ADR-005 payload fields (`source_trust`, `assertion_state`) **mirror** ADR-002/ADR-010 values. They are a denormalized copy in Qdrant and **can drift**. Resolved by: Qdrant payload is derived, never authoritative; a reconciliation job asserts equality. Recorded as **CONFLICT-1** below. |
| 6   | ADR-006 never uses confidence as factual truth                  | ✅ **Consistent, explicitly firewalled**   | ADR-006 "entity-resolution firewall"; ADR-010 prohibits any projection multiplying `resolution` into a truth score. Stated in both records.                                                                                                                                                   |
| 7   | ADR-009 retirement removes no undeclared dependency             | ⚠️ **Blocked on OQ-7**                     | RRF disproven as unique (`fusion.py:81`); `ln_central` empty. But `central` Neo4j is **not inventoried**. ADR-009 makes inventory a hard gate.                                                                                                                                                |
| 8   | ADR-011 expansion respects ADR-003 authorization                | ✅ **Consistent, property-tested**         | ADR-011 requires authorization evaluated _after_ expansion, with expanded results ⊆ union of individually-permitted results.                                                                                                                                                                  |
| 9   | No ADR reintroduces multiple graph writers                      | ✅ **Verified**                            | ADR-002 keeps provenance in Postgres and the graph write in the Rust worker. No ADR adds a graph writer.                                                                                                                                                                                      |
| 10  | No ADR adds raw-string relationship emission                    | ✅ **Verified**                            | ADR-001 removes an emitter; ADR-003/011 add catalog fields; none introduce string literals.                                                                                                                                                                                                   |
| 11  | No ADR requires `ln_central`                                    | ✅ **Verified**                            | ADR-009 disposes of it; no other ADR references it.                                                                                                                                                                                                                                           |
| 12  | No ADR enables GraphRAG globally                                | ✅ **Verified**                            | ADR-008 explicitly keeps `GRAPH_GROUNDING_ENABLED` unset and defers enablement to a separate ADR not in this package.                                                                                                                                                                         |

---

## 3. Unresolved conflicts

**CONFLICT-1 — Qdrant payload duplicates assertion state (ADR-005 ↔ ADR-002/010).**
`source_trust`, `assertion_state`, and the eligibility flags exist in both Postgres (authoritative) and
Qdrant payloads (for filtering during search). Two copies can disagree.

_Why not avoided:_ filtering must occur **during** vector search (ADR-005 rejects post-filtering as a
hard blocker), and Qdrant cannot join to Postgres. Denormalization is forced by the requirement.

_Resolution:_ Postgres is authoritative; Qdrant payload is a derived projection; a reconciliation job
asserts equality and reports divergence as an integrity failure. **Divergence must be a monitored
metric, not an assumption.** Assigned to ADR-005 observability requirements.

_Status:_ accepted with mitigation. Requires reviewer sign-off from Security and Data Platform.

**CONFLICT-2 — ADR-001 may re-parent `TransactionSummary` out of `Observation` (ADR-011).**
If ADR-001 reduces transaction representation, `Observation`'s membership is dominated by a class whose
role is shrinking. Low impact; noted in ADR-011 residual uncertainty. _Status:_ accept, revisit after
ADR-001 lands.

**CONFLICT-3 — ADR-003 manifest v3 and ADR-011 superclass export are the same change.**
Both modify the manifest schema. Shipping them as separate version bumps would force two loader
migrations. _Resolution:_ **combine into a single v3 bump.** Recorded in the implementation sequence.
_Status:_ resolved by sequencing.

---

## 4. Preserved architectural strengths — verification

| Strength                                      | Preserved by                                     | Verified |
| --------------------------------------------- | ------------------------------------------------ | -------- |
| Exactly one graph writer (Rust)               | ADR-002 §Decision                                | ✅       |
| Python clients read-only                      | no ADR adds a write method                       | ✅       |
| Traversal binds both endpoints by tenant      | ADR-008 evidence; no ADR modifies the pattern    | ✅       |
| Caller tenant override rejected               | untouched                                        | ✅       |
| Relationship vocabulary enumerable            | ADR-003/011 add fields to the enumerable catalog | ✅       |
| Unknown relationship fails closed             | ADR-003 extends fail-closed to principal/context | ✅       |
| Catalog→manifest drift CI-gated               | ADR-003 adds a policy-fidelity gate              | ✅       |
| Family does not itself grant traversal        | ADR-003 keeps permission independent of `family` | ✅       |
| Provider/B2B excluded from personal traversal | ADR-003 preserves the 19 non-traversable types   | ✅       |
| RRF already in serving tier                   | ADR-009 evidence; no ADR re-implements it        | ✅       |
| Graph grounding disabled                      | ADR-008 §Consequences                            | ✅       |

**No preserved strength is weakened by any ADR in this package.**
