# ADR-009 — API Gateway Retirement

**Status:** Proposed · **Date:** 2026-07-30 · **Decision deadline:** after zero-traffic evidence
**Owners:** Platform Ops · **Reviewers:** Security, AI/Retrieval, Architecture
**Related findings:** REVIEW §1.1 (withdrawn harvest claim), debt D-16 · Depends on ADR-007

---

## Context

`apps/api-gateway` is a live, internet-reachable, JWT-enforcing Fly service with zero known callers. It
was previously believed to hold the only RRF fusion and central-retrieval implementations, making
"harvest before retirement" mandatory. **That belief is now disproven.**

## Measured evidence

_Measured facts (repository, commit `da8c7428`)._

- `apps/lifenavigator-core-api/app/grounding/semantic/fusion.py:81` — `def rrf(ranked_lists, *, k=RRF_K)`
- `fusion.py:93` — `scores[key] = scores.get(key, 0.0) + 1.0 / (k + rank)`
- `fusion.py:84-85` documents the rationale: rank-based _"so it needs no score normalisation across
  channels whose scores are not comparable (cosine similarity vs a decayed graph confidence)"_
- Command: `grep -n "def rrf\|1.0 / (k + rank)" .../semantic/fusion.py`

**RRF already exists in the serving tier.** The claim in `ARCHITECTURE_REVIEW.md` /
`REMEDIATION_MASTER_PLAN.md` C-B and in `KNOWLEDGE_GRAPH_REFERENCE_ARCHITECTURE.md` §7 that RRF exists
only in the gateway is **withdrawn**.

_Measured facts (production, 2026-07-30)._

- Qdrant `ln_central`: **0 points**, 3072-dim, status green
- Fly: `lifenavigator-api-gateway` deployed, latest deploy **Jun 7 2026** (core-api: Jul 24 2026)
- `flyctl apps list` — three apps in the organization

_Design inference._ The gateway's two claimed-unique capabilities are (a) RRF — now present in
core-api, and (b) central retrieval over `ln_central` — which is **empty**, so there is no content whose
loss retirement would cause. **There is likely nothing left to harvest.**

_Unresolved assumption (OQ-7)._ **`ln_central` being empty proves only that the Qdrant central
collection has no content. It proves nothing about the `central` Neo4j database.** It does not
establish that central Neo4j is empty, that no unpublished process writes to it, that no route depends
on it, or that no operational workflow assumes the gateway remains reachable. These are four distinct
claims and none is currently evidenced.

Retirement must not proceed while an uninventoried datastore has the gateway as its only known reader.
**The likely outcome remains retirement — but this ADR must not pre-decide it before the inventory
exists.**

## Problem statement

An orphaned, unmaintained, internet-facing service holds a Supabase service-role key and duplicates
authentication logic, providing no measured value.

## Forces and constraints

Zero traffic must be **evidenced**, not assumed · a `410 Gone` shim must ship for one release before
removal · the replacement must be live in core-api · `central` Neo4j must be inventoried first.

## Decision drivers

Attack-surface reduction · service-role holder reduction (2 → 1) · maintenance burden · avoiding
capability loss.

## Options considered

1. Retain as fallback.
2. Harvest, then retire.
3. **Retire outright** (nothing to harvest).
4. Convert to a central retrieval service.
5. Keep dormant (scale to zero).

## Comparative decision matrix

| Criterion            | 1 Retain | 2 Harvest+retire | 3 Retire outright | 4 Convert | 5 Dormant |
| -------------------- | -------- | ---------------- | ----------------- | --------- | --------- |
| Correctness          | 3        | 4                | 5                 | 3         | 3         |
| Security             | **1 HB** | 4                | 5                 | 2         | 2         |
| Privacy              | 2        | 4                | 5                 | 3         | 2         |
| Tenant safety        | 2        | 4                | 5                 | 3         | 3         |
| Semantic fidelity    | 3        | 4                | 4                 | 4         | 3         |
| Impl. complexity     | 5        | 2                | 5                 | 1         | 4         |
| Migration complexity | 5        | 2                | 4                 | 1         | 5         |
| Ops complexity       | 2        | 3                | 5                 | 2         | 3         |
| Scalability          | 3        | 4                | 5                 | 3         | 4         |
| Reversibility        | 5        | 3                | 3                 | 3         | 5         |
| Observability        | 2        | 3                | 5                 | 3         | 2         |
| Cost                 | 2        | 3                | 5                 | 2         | 4         |
| Maintainability      | 1        | 3                | 5                 | 2         | 2         |

**Hard blocker.** Option 1: retaining an unmaintained internet-facing service that holds a service-role
key, with no callers and no measured value, is an unjustifiable standing risk. Option 2 is not _wrong_ —
it is now **empty work**, since the harvest list evaluates to nothing. Option 4 fails proportionality:
building a central retrieval service for a collection with zero points is speculative.

## Decision

**Adopt Option 3 — retire outright**, gated on the compatibility protocol and the `central` Neo4j
inventory (OQ-7).

## Detailed design

**Retirement protocol (all four required before removal):**

1. Zero legitimate traffic evidenced over **7 consecutive days** of access logs.
2. Route inventory published; each route mapped to its core-api replacement or explicitly declared
   unreplaced-and-unused.
3. `410 Gone` shim shipped for **one full release** — its purpose is to make an _unknown_ caller
   diagnosable rather than seeing a connection failure.
4. `central` Neo4j database inventoried (contents, writers, freshness) and dispositioned.

**Credential action (independent of retirement, do immediately):** revoke the gateway's
`SUPABASE_SERVICE_ROLE_KEY`. It has no Supabase usage, and revocation reduces service-role holders from
**2 → 1** without waiting for any of the above.

## Security implications

Primary benefit: removes a public surface, a duplicated `verify_jwt`, and one service-role holder.

## Privacy implications

Fewer systems holding credentials that bypass RLS.

## Tenant-isolation implications

Positive: eliminates a second, independently-evolving tenant derivation.

## Data-model implications

None, provided OQ-7 confirms `central` holds nothing required.

## Scalability implications

Removes a `min_machines_running = 1` cost with zero utilization.

## Operational implications

One fewer deploy target, CI job, and secret set.

## Cost implications

Direct saving of one always-on machine.

## Developer-experience implications

Removes the single largest source of "which service owns this?" confusion.

## Migration plan

1. Revoke gateway service-role key (**now**, independent).
2. Enable and collect 7 days of access logs.
3. Publish route inventory.
4. Inventory `central` Neo4j.
5. Ship `410 Gone` shim; one release.
6. Remove the app.

## Backfill plan

N/A.

## Compatibility strategy

The `410` shim is the compatibility strategy — it converts an unknown caller's failure into a
diagnosable signal rather than a timeout.

## Rollback strategy

Steps 1–5 are individually reversible. Step 6 is reversible by redeploy from git within the rollback
window; retain the image and config for 30 days.

## Observability requirements

Per-route request counts during the 7-day window · `410` hit counts during the shim release · alert if
either is non-zero.

## Evaluation plan

Zero traffic evidenced; zero `410` hits during the shim release.

## Falsification criteria

Any legitimate traffic, or any unique capability discovered in the route inventory or `central`
inventory, halts retirement and re-opens Option 2.

## Acceptance criteria

7 days zero traffic · route inventory complete · `central` inventoried · shim shipped and unhit ·
service-role holders = 1 · app removed with image retained 30 days.

## Non-goals

Not porting gateway routes speculatively. Not building central retrieval.

## Risks accepted

An unknown caller may exist that does not appear in 7 days (e.g. monthly job). Mitigated by the `410`
shim, which makes such a caller diagnosable rather than silently broken.

## Residual uncertainty

OQ-7 (`central` Neo4j contents/writers) — **blocking**.

## Consequences

Deletes SP-046 from the roadmap in its original "harvest" form; reduces it to a protocol-driven removal.

## Follow-up work

None. This ADR closes the gateway question.

## Superseded documents

**Supersedes** `REMEDIATION_MASTER_PLAN.md` correction C-B ("the best retrieval implementation is in the
orphaned tier") and `KNOWLEDGE_GRAPH_REFERENCE_ARCHITECTURE.md` §7 harvest requirement, both of which
rest on the disproven RRF claim.

## Approval record

| Reviewer  | Role         | Verdict | Date |
| --------- | ------------ | ------- | ---- |
| _pending_ | Platform Ops | —       | —    |
| _pending_ | Security     | —       | —    |
| _pending_ | Architecture | —       | —    |
