# ADR Decision Summary

**Date:** 2026-07-30 · All records `Proposed`. One page for a reviewer with fifteen minutes.

---

## The eleven decisions

| ADR     | Decision in one sentence                                                                                                                     | Chosen because                                                                                                                              |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **001** | Transactions reach the user via `OWNS_ACCOUNT → HAS_TRANSACTION`; the user-anchored edge stops being emitted.                                | 60.8% of edges are transactions at ~2 edges/node; the user-anchored one is reconstructible by composition, so removal is safely reversible. |
| **002** | Provenance lives in Postgres, batch-granular for bulk sync and per-assertion for document/user/inferred facts; edges carry only a reference. | One Plaid sync produces ~1,951 edges with identical provenance; 1:1 in-graph doubles the graph and mandates a rebuild.                      |
| **003** | Traversal permission becomes an explicit context × principal matrix exported in manifest v3; missing field means deny.                       | 150 policy declarations in Rust, 0 in the manifest; any second agent would inherit the personal advisor's 119 types.                        |
| **004** | The golden set gains known-absent, unanswerable, contradictory, temporal-trap, cross-tenant and poisoned categories.                         | Every current query is answerable by construction, so the eval measures ranking and is blind to fabrication.                                |
| **005** | Trust and review state become indexed Qdrant payload fields, filtered **during** search.                                                     | Post-filtering lets untrusted points consume top-k slots and silently starve legitimate evidence.                                           |
| **006** | Every node class declares a deterministic, tenant-local business key, or `None` (which blocks auto-merge).                                   | Duplicate detection is undecidable without a declared key; global identity would create a cross-tenant join path.                           |
| **007** | Rotate every exposed credential, replace org-scoped tokens with least-privilege ones, deliver only via secret stores.                        | An org-scoped Fly token can read every secret in every app, transitively exposing the service-role key.                                     |
| **008** | Verify traversal out-of-band under a dedicated `evaluation` principal, then shadow; grounding stays off.                                     | Traversal has never run against production; "works but sparse" is indistinguishable from "silently returns nothing."                        |
| **009** | Retire the gateway outright — there is nothing left to harvest.                                                                              | RRF exists at `fusion.py:81`; `ln_central` is empty. Gated on inventorying the `central` Neo4j DB.                                          |
| **010** | Store three confidence components (`source`, `extractor`, `resolution`); compute the rest per request.                                       | Only one real confidence signal exists today; path/answer/recommendation are request-scoped, not object properties.                         |
| **011** | Declare `superclass` as catalog metadata; the planner expands at query time.                                                                 | The label-hierarchy alternative is a graph-wide migration serving 127 nodes (5.1% of the graph).                                            |

---

## What this package overturns

Four prior conclusions are withdrawn on evidence:

1. **"RRF exists only in the orphaned gateway."** False — `fusion.py:81`, rank-based, correctly
   documented. Deletes the harvest workstream.
2. **"Provenance should be a parallel in-graph assertion graph."** Mine, and wrong at scale.
3. **"Confidence needs seven components with Bayesian combination."** Mine, and unnecessary.
4. **"Class hierarchy needs Neo4j labels."** Mine, and disproportionate.

---

## Hard blockers recorded in the decision matrices

| Option rejected              | ADR | Why it was disqualifying                                                |
| ---------------------------- | --- | ----------------------------------------------------------------------- |
| Keep transaction edges as-is | 001 | Unbounded growth of the dominant edge class                             |
| In-graph 1:1 assertions      | 002 | Doubles the graph; mandates a future rebuild                            |
| Event-log-only provenance    | 002 | Cannot satisfy deletion proof — you cannot delete from an immutable log |
| Boolean `traversable`        | 003 | Agent #2 inherits agent #1's rights                                     |
| Hardcoded per-agent policy   | 003 | Divergent policy = breach with an audit trail claiming authorization    |
| Template-only evaluation     | 004 | Cannot measure abstention                                               |
| Production trace sampling    | 004 | Moves real personal data into a test artifact                           |
| Post-filtering vectors       | 005 | Untrusted points consume top-k slots invisibly                          |
| Never embed unreviewed docs  | 005 | Destroys the review loop and document intelligence                      |
| Global canonical identity    | 006 | Creates a cross-tenant join path                                        |
| Accept credential risk       | 007 | A live org-scoped token is an open door, not a risk decision            |
| Git history rewrite          | 007 | Removes a string, not a risk; rotation renders values inert             |
| Enable grounding to test it  | 008 | Inverts the entire evaluation discipline                                |
| Synthetic-only verification  | 008 | Cannot reproduce the defect being tested for                            |
| Retain the gateway           | 009 | Unmaintained public service holding a service-role key                  |
| Single confidence scalar     | 010 | Destroys the ability to explain _why_ uncertain                         |
| Full Bayesian model          | 010 | Unfalsifiable machinery with no calibration data                        |
| Neo4j label hierarchy        | 011 | Graph-wide migration for 5.1% of nodes                                  |
| Runtime hardcoded families   | 011 | The exact defect class the programme exists to eliminate                |

---

## Risk posture

- **8 of 12 open questions are blocking.** OQ-7 (`central` Neo4j) and OQ-9 (ANOM-1 tenant divergence)
  are the two that could change decisions rather than merely refine them.
- **One unresolved conflict:** CONFLICT-1 — Qdrant payload necessarily duplicates authoritative
  assertion state. Mitigated by a reconciliation job; requires Security + Data Platform sign-off.
- **Zero preserved strengths are weakened** by any record.
- **No record enables GraphRAG, mutates production, or retires anything** during this task.

## What a reviewer should challenge hardest

1. **ADR-002's batch tier** rests on OQ-2 (batch homogeneity). If wrong, the design reduces to
   per-assertion and the storage argument weakens considerably.
2. **ADR-001's 30% reduction estimate** rests on OQ-1 (summary granularity, unverified).
3. **ADR-008's falsification criterion** — are we genuinely prepared to accept "traversal adds nothing"
   as an outcome? If not, the evaluation is theatre.
4. **CONFLICT-1** — is a reconciliation job sufficient, or does denormalized trust state need a
   stronger guarantee?
