# ADR Implementation Sequence — Proposed, Not Executed

**Date:** 2026-07-30 · **Status:** proposal for review. **Nothing here is authorized to execute.**

The brief supplied a likely sequence and instructed that it be challenged rather than assumed. It was.
**Three changes: one step deleted, two combined, one moved earlier.**

---

## 1. The proposed sequence, challenged

| Brief's step                            | Verdict                                                 | Reasoning                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 · Credential containment              | **Keep, first**                                         | Gates every write-enabled item. Cheapest, highest ROI.                                                                                                                       |
| 1 · Manifest policy fidelity            | **Keep — combine with superclass export**               | ADR-003 and ADR-011 both bump the manifest schema. Two bumps = two loader migrations for one outcome (CONFLICT-3).                                                           |
| 2 · Known-absent evaluation             | **Move earlier — parallel with step 1**                 | Independent of every other step and gates the acceptance criteria of steps 3 and 5. Serializing it behind manifest work delays the measurement everything else is judged by. |
| 3 · Safe traversal verification         | **Keep**                                                | Requires ADR-003's `evaluation` context, so it follows step 1.                                                                                                               |
| 4 · Vector trust filtering              | **Keep**                                                | Independent; can run parallel once ADR-007 permits payload writes.                                                                                                           |
| 5 · Transaction emission correction     | **Keep**                                                | Needs step 2's golden set for its no-regression gate.                                                                                                                        |
| 6 · Provenance schema + forward writes  | **Keep**                                                | Cheaper after step 5 (fewer transaction edges to attribute).                                                                                                                 |
| 7 · Identity contracts                  | **Keep**                                                | Mostly declaration work; can start earlier but lands with 6.                                                                                                                 |
| 8 · Historical migrations and backfills | **Keep, last of the write work**                        | All gated on ADR-007 closure.                                                                                                                                                |
| 9 · Gateway retirement                  | **Keep — but move the credential revocation to step 0** | Revoking the gateway's service-role key is independent of retirement and reduces service-role holders 2→1 immediately.                                                       |
| 10 · Broader evaluation and rollout     | **Keep as a separate decision**                         | Requires its own ADR; not in this package.                                                                                                                                   |

**Deleted:** nothing was deleted outright, but **ADR-009's original "harvest" phase is eliminated** —
`fusion.py:81` proves RRF already exists in the serving tier and `ln_central` is empty, so the harvest
list evaluates to nothing. That deletes a workstream from the prior roadmap (SP-046).

---

## 2. Revised sequence

### Stage 0 — Containment (no approval required; already authorized)

- Shred session secret material _(done)_
- Revoke exposed Fly org token and Qdrant key **(owner action)**
- Revoke the api-gateway `SUPABASE_SERVICE_ROLE_KEY` — independent of ADR-009, reduces holders 2→1
- Rotate Supabase DB password + Management PAT; **prove old credentials rejected**
- Close incident residuals R-1, R-3

**Gate:** ADR-007 acceptance criteria met. **No write-enabled work proceeds until this gate is green.**

### Stage 1 — Measurement and contract (parallel, no production writes)

- **1a** ADR-004 golden set incl. known-absent, temporal, cross-tenant, poisoned categories
- **1b** ADR-003 + ADR-011 → **single manifest v3 bump** (policy fidelity + superclass), dual-emit,
  CI fidelity gate, planner reads matrix. Regression: personal advisor resolves to exactly **119** types
- **1c** ADR-006 identity declarations (specification only, detection report-only)

**Gate:** golden set committed with a baseline; manifest fidelity gate green; personal-advisor
behaviour provably unchanged.

### Stage 2 — Verification (read-only production)

- ADR-008 Phase A out-of-band traversal verification under the `evaluation` context
- ADR-008 Phase B shadow, only if Phase A finds non-seed paths

**Gate:** ≥1 non-seed path on ≥3 tenants, 0 cross-tenant nodes, trace artifact committed.
**If zero paths are found, stop and reconsider — that is a valid outcome.**

### Stage 3 — Trust plumbing (payload writes only)

- ADR-005 payload fields + indexes; backfill (dry-run first); filters flag-off then read paths
- ADR-010 confidence fields defined with the ADR-002 schema

**Gate:** all 2,218 points classified; poisoned-document scenarios blocked; no known-present regression.

### Stage 4 — Emission correction

- ADR-001 step 1–3 only: inventory read dependencies, deprecate the user-anchored emitter, observe

**Gate:** zero read dependencies evidenced; no golden-set regression on financial categories.

### Stage 5 — Provenance forward writes

- ADR-002 schema, writer, type-system gate; forward-only

**Gate:** 0 dangling references; type-system gate demonstrably rejects a bare edge write.

### Stage 6 — Historical migrations (first true production mutations)

- ADR-001 step 4 (remove historical user-anchored edges, bounded batches)
- ADR-002 replay backfill; `unknown_legacy` classification
- `RELATED_TO` → `HAS_PERSONA` (SP-030)

**Gate:** every migration idempotent on a second dry run; reconciliation clean.

### Stage 7 — Retirement and rollout decision

- ADR-009 retirement protocol (7-day traffic, route inventory, `central` inventory, `410` shim)
- Grounding rollout decision — **separate ADR, not in this package**

---

## 3. What this sequence deliberately does not do

- Does not enable `GRAPH_GROUNDING_ENABLED` at any stage
- Does not mutate production before Stage 6, and not at all before ADR-007 closure
- Does not retire the gateway before its four gates
- Does not write provenance data during design
- Does not treat unexplained store divergence (ANOM-1) as deletable

## 4. Critical path

`Stage 0 → 1b → 2 → 4 → 5 → 6`. Stage 1a runs parallel and gates Stages 2 and 4 acceptance.
**Stage 0 is the whole programme's blocker**; it is also the cheapest stage.
