# RELATED_TO Remediation

**Operation ID:** RT-INV-2026-0730-01 · **Date:** 2026-07-30 · **Commit:** `da8c7428`
**Branch:** `graphrag/data-contract-remediation`
**Mode:** read-only reconciliation against production. **Mutations performed: 0.**
**Machine-readable inventory:** `artifacts/graphrag-reconciliation/related_to_inventory.json`

`RELATED_TO` is and remains **non-traversable**. Nothing in this document makes it traversable.

---

## 1. What was measured

Read-only Cypher executed **inside** `lifenavigator-core-api` via `flyctl ssh console`, so Neo4j
credentials stayed in the service's process environment and never reached this workstation's shell
history, disk, logs, or any artifact.

| Metric                          | Value                        |
| ------------------------------- | ---------------------------- |
| Total nodes                     | 2,506                        |
| Total relationships             | 3,208                        |
| `RELATED_TO` edges              | **148** (4.61% of all edges) |
| Distinct `RELATED_TO` shapes    | **1**                        |
| Edges carrying any property     | **0**                        |
| Cross-tenant `RELATED_TO` edges | **0**                        |
| Distinct tenants (Neo4j)        | 268                          |
| Nodes missing `tenant_id`       | 0                            |

---

## 2. The finding

All 148 fallback edges are one shape:

```
(:UserProfile) -[:RELATED_TO]-> (:PersonaProfile)
```

148 distinct source tenants, 148 distinct target tenants, **exactly one edge per tenant**, zero
cross-tenant edges. This is not a scattered accumulation of junk — it is one systematic emission.

**The emitting branch is confirmed from source, not inferred from endpoint types.**
`EntityType::PersonaProfile` is classified `Domain::Root` (`ontology.rs:749`) and is **absent from
`REGISTRY`**. Unmapped entity types fall through to the `RELATED_TO` fallback documented at
`ontology.rs:383-384`. Every persona ingest therefore emits the fallback, by construction. The
registry's own tests assert that _mapped_ entities never fall back — `PersonaProfile` is simply not
among them.

**Edge-level provenance does not exist.** The relationships carry **zero properties** — no
`created_at`, no source record id, no ingestion batch, no normalizer version. Your remediation spec
asks for creation metadata and available provenance per edge; the honest answer is that the graph
cannot supply it. What survives is node-level metadata on the `PersonaProfile` endpoint
(`user_id`, `entity_id`, `tenant_id`, `metadata`, `created_at`, `updated_at`) plus the upstream
source record. Any replay must be driven from the source record, not from the edge.

---

## 3. Classification

| Category                          | Count   |
| --------------------------------- | ------- |
| Deterministically remappable      | **0**   |
| Recoverable through source replay | **148** |
| Legitimately generic              | 0       |
| Incomplete or erroneous ingestion | 0       |
| Unresolved                        | 0       |

All 148 are **recoverable through source replay**, and deliberately _not_ filed as
"deterministically remappable" despite the shape being perfectly uniform. Three reasons:

1. Your directive prohibits remapping solely from endpoint types. Shape uniformity alone is not a
   licence.
2. The edges carry no provenance, so no per-edge decision can be corroborated.
3. **The intended relationship does not exist yet.** `HAS_PERSONA` is a _candidate_, not a catalog
   member. Remapping onto a type the authoritative catalog does not define would create exactly the
   drift this whole workstream exists to eliminate.

---

## 4. Required order of operations

Per your spec, the normalizer is fixed **first**; the fallback edge is retired **last**.

1. Add `HAS_PERSONA` (family: ownership) to the authoritative catalog in `ontology.rs::REGISTRY`,
   with the drift gates regenerating `ontology_manifest.json`.
2. Map `EntityType::PersonaProfile` to that rule so future writes emit the typed relationship. The
   existing registry test — _mapped entities never fall back to `RELATED_TO`_ — then covers it.
3. Produce a dry-run migration with a preflight artifact and exact expected counts
   (**expected: 148 edges, 148 tenants, 1 per tenant**).
4. Replay only the 148 affected source records. Preserve provenance on the new edge — it is the
   replacement's job to carry what the original never had.
5. **Verify the typed edge exists on the same endpoints before retiring any fallback edge.** Never
   delete first.

**Expected post-run state:** `HAS_PERSONA` = 148, `RELATED_TO` = 0, `total_relationships` = 3,208
(unchanged — replacement, not deletion).

---

## 5. Stop conditions

Halt and reconcile if any of these hold:

- affected count ≠ 148 beyond an explicitly justified tolerance
- an unexpected tenant is affected, or any tenant receives ≠ 1 edge
- any cross-tenant `RELATED_TO` or `HAS_PERSONA` edge appears (**current: 0**)
- `total_relationships` declines without an approved deletion
- a fallback edge is retired before its typed replacement is verified present
- the migration proves non-idempotent on a second dry run
- credentials or sensitive values appear in any log or artifact

**Rollback:** re-emit `RELATED_TO` on the affected endpoints from the same source records. Because
step 5 forbids deleting before verifying, the rollback window never contains a state with neither
edge present.

---

## 6. Blockers

| Blocker                                                                                   | Effect                                                             |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `HAS_PERSONA` absent from the authoritative catalog                                       | No valid remap target exists                                       |
| Credential rotation prerequisite unmet (exposed Supabase credential + Management API PAT) | Your own directive gates **all** write-enabled remediation on this |
| Read-only baseline elected for this session                                               | No mutation authorized                                             |

**Highest status achieved for RELATED_TO remediation: Live-store tested** (inventory measured
against production). Not dry-run verified, not production migrated, not reconciled.
