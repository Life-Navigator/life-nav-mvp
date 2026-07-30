# ADR-008 — Safe Production Traversal Verification

**Status:** Proposed · **Date:** 2026-07-30 · **Decision deadline:** after ADR-003, ADR-004
**Owners:** AI/Retrieval · **Reviewers:** Security, Graph Platform, Privacy
**Related findings:** debt D-6 (High) · Depends on ADR-003 (authorization), ADR-004 (measurement)

---

## Context

Traversal code exists and has never executed against production data. `GRAPH_GROUNDING_ENABLED=false`
(`apps/lifenavigator-core-api/fly.toml:43`). Its correctness is therefore assumed, not known.

## Measured evidence

_Measured facts._ `fly.toml:43` → `GRAPH_GROUNDING_ENABLED = "false"`; surrounding comments (lines
32–42) document `GRAPH_RETRIEVAL_V2` as the engine selector and note the staging-first intent.
`advisor_context.py:281` confirms graph evidence is additive and _"never a fabrication source"_.

_Measured facts (traversal safety, `traversal.py:106-112`, commit `da8c7428`):_

```
MATCH (a {tenant_id: $user_id}) WHERE a.entity_id IN $frontier
MATCH (a)-[r:{rels}]-(b {tenant_id: $user_id})
WHERE b.entity_id IS NOT NULL AND NOT b.entity_id IN $visited
```

Both endpoints are tenant-bound; module header (lines 18–21) states the client _"refuses any statement
lacking `$user_id` and refuses to let a caller override the bound tenant."_

_Measured fact._ Prior defect on record: `query_personal` returned Aura positional rows read by name,
raising `AttributeError` swallowed by a hop-level `except` → zero expansion, indistinguishable from a
sparse graph. `query_personal_dicts` was added to fix it. **That fix has never been exercised against
production.**

_Design inference._ Graph shape (avg degree 2.56; 60.8% of edges one type) means non-seed paths may be
rare. A verification that only proves "no crash" would be worthless; it must prove _paths are found_.

## Problem statement

We cannot distinguish "traversal works and the graph is sparse" from "traversal silently returns
nothing" — the exact ambiguity that hid the original defect for months.

## Forces and constraints

Diagnostic output must never influence an advisor response · `GRAPH_GROUNDING_ENABLED` must stay unset ·
tenant isolation must be provable, not assumed · read-only.

## Decision drivers

Isolation from user-facing responses · realism of the data · tenant safety · reversibility.

## Options considered

1. Enable globally.
2. Enable for one user-facing cohort.
3. Direct read-only diagnostic query (out-of-band).
4. Shadow retrieval inside the production service (computed, logged, discarded).
5. Production-data replica.
6. Synthetic production tenant.

## Comparative decision matrix

| Criterion            | 1 Global | 2 Cohort | 3 Diagnostic | 4 Shadow | 5 Replica | 6 Synthetic |
| -------------------- | -------- | -------- | ------------ | -------- | --------- | ----------- |
| Correctness          | 5        | 5        | 4            | 5        | 4         | 2           |
| Security             | **1 HB** | 2        | 5            | 4        | 3         | 5           |
| Privacy              | 1        | 2        | 4            | 4        | 2         | 5           |
| Tenant safety        | 2        | 3        | 5            | 4        | 3         | 5           |
| Semantic fidelity    | 5        | 5        | 4            | 5        | 4         | **2 HB**    |
| Impl. complexity     | 5        | 4        | 5            | 3        | 2         | 3           |
| Migration complexity | 5        | 4        | 5            | 4        | 1         | 3           |
| Ops complexity       | 3        | 3        | 5            | 4        | 1         | 4           |
| Scalability          | 3        | 4        | 5            | 4        | 2         | 5           |
| Reversibility        | 2        | 3        | 5            | 5        | 4         | 5           |
| Observability        | 3        | 4        | 5            | 5        | 3         | 4           |
| Cost                 | 3        | 4        | 5            | 4        | 1         | 4           |
| Maintainability      | 3        | 3        | 4            | 4        | 2         | 4           |

**Hard blockers.** Option 1: enabling globally to find out whether it works inverts the entire
evaluation discipline. Option 6: a synthetic tenant cannot falsify the hypothesis — the defect being
tested for (Aura row-shape handling against real data at real scale) is precisely what synthetic data
would not reproduce. Option 5 is disqualified on cost/ops for a 2,506-node graph.

## Decision

**Adopt Option 3 first, then Option 4.**

**Phase A — out-of-band read-only diagnostic.** Execute the real traversal functions inside the
production service via `flyctl ssh console`, against consenting/synthetic-persona tenants, with results
written only to a trace artifact. No request path touches it. This is the cheapest way to falsify the
"traversal returns nothing" hypothesis.

**Phase B — shadow retrieval.** Only if Phase A passes: compute traversal inside real request handling,
log the trace, **discard the result**. Proves behaviour under production concurrency and latency without
any response influence.

## Detailed design

- **Tenant selection:** synthetic personas first; any real tenant requires recorded approval.
- **Context:** runs under the dedicated `evaluation` principal/context from ADR-003 — **never** the
  `personal_advisor` context, so a diagnostic can never borrow advisor permissions.
- **Bounds:** max depth 3, max breadth per hop 25, node budget 500, query timeout 5s.
- **Allowed relationships:** exactly the manifest set for the `evaluation` context.
- **Expected non-seed path:** the success criterion is ≥1 path whose terminal node was **not** in the
  seed set — proving expansion actually occurred, not merely that seeds were echoed back.
- **Failure behaviour:** any exception is recorded and classified `integrity_failure`, never swallowed.
- **Trace artifact:** `artifacts/graphrag-reconciliation/traversal_verification.json` — hashed tenants,
  per-hop counts, paths found, timings, errors.
- **No response influence:** Phase A is out-of-band by construction; Phase B discards results, verified
  by a test asserting the advisor context packet is byte-identical with shadow on and off.

## Security implications

Runs in-service; no credential extraction. Bounded resources prevent a diagnostic from degrading
production.

## Privacy implications

Traces record structure and hashed identifiers, never content.

## Tenant-isolation implications

The verification **produces** the isolation proof: every returned path must have all nodes in one
tenant. Any cross-tenant node halts the run immediately.

## Data-model / Scalability / Cost implications

None; read-only, bounded, negligible cost.

## Operational implications

Requires an authenticated interactive session (ADR-007 human-diagnostic class).

## Developer-experience implications

Converts traversal from _Implemented_ to _Live-store tested_ — the first honest status upgrade.

## Migration plan

1. ADR-003 lands (`evaluation` context exists).
2. Phase A on synthetic personas; produce trace artifact.
3. Review; if paths found and isolation holds, Phase B shadow for one release.
4. Report; feed ADR-004 measurement.

## Backfill plan

N/A.

## Compatibility strategy

No production behaviour changes at any step.

## Rollback strategy

Phase A: stop running. Phase B: disable the shadow flag. Neither has persistent effect.

## Observability requirements

Per-hop expansion counts · paths found vs seeds only · latency p50/p95 · error classification.

## Evaluation plan

Feeds ADR-004. The ablation (vector-only vs vector+graph) is computed from these traces.

## Falsification criteria

If zero non-seed paths are found across all test tenants, traversal provides no value on the current
graph shape — a **valid and important result** that would defer reasoning work and redirect effort to
graph enrichment.

## Acceptance criteria

≥1 non-seed path on ≥3 tenants · 0 cross-tenant nodes in any path · 0 unclassified exceptions · p95
within budget · trace artifact committed.

## Non-goals

Not enabling grounding. Not measuring answer quality. Not changing traversal logic.

## Risks accepted

Synthetic personas may have sparser graphs than real tenants, understating traversal value. Mitigated by
including approved real tenants in Phase B.

## Residual uncertainty

Whether the positional-row fix is correct under all Aura response shapes — this verification is exactly
what resolves it.

## Consequences

`GRAPH_GROUNDING_ENABLED` remains unset regardless of outcome; enablement is a **separate** rollout
decision requiring its own ADR.

**The rollout standard is not "traversal executed successfully."** It is: _traversal improved a defined
query category without unacceptable precision, latency, security, or fabrication regressions._ The
rollout ADR must choose among six legitimate outcomes rather than a binary:

| Outcome                                         | When                                                     |
| ----------------------------------------------- | -------------------------------------------------------- |
| Enable for specific query classes               | measured gain confined to certain categories             |
| Keep shadow-only                                | traces valuable, quality gain unproven                   |
| Defer until graph enrichment                    | traversal sound but the graph too shallow to exercise it |
| Disable indefinitely                            | no gain, or precision/latency cost exceeds benefit       |
| Use only for explainability                     | paths improve citations without improving retrieval      |
| Use only for deterministic relationship queries | gain confined to structural lookups, not semantic search |

This is evidence-based channel selection, not retreat. The catalog's value — semantic authority,
ingestion validation, lifecycle, agent policy, explainability structure — does not depend on graph
retrieval being enabled in user-facing answers.

## Follow-up work

Grounding rollout ADR (not in this package).

## Superseded documents

Supersedes `SEMANTIC_PLATFORM_ROADMAP.md` §4 step 2 sequencing detail.

## Approval record

| Reviewer  | Role         | Verdict | Date |
| --------- | ------------ | ------- | ---- |
| _pending_ | AI/Retrieval | —       | —    |
| _pending_ | Security     | —       | —    |
