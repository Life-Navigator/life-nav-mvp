# ADR Reviewer Packets

**Date:** 2026-07-30. One packet per ADR, ~2 pages each. Packets for Session-1 ADRs are full; packets
for `Needs Revision` / `Deferred` ADRs are short by design — a full packet for an undecidable decision
invites deciding it.

Rating scale: 1 (poor/high-cost) … 5 (excellent/low-cost). **HB = hard blocker.**

---

# PACKET · ADR-003 — Principal- and Context-Aware Traversal Authorization

**Session 1, Block C · 45 min · Owner: Security · Recommended: ACCEPT**

## Executive summary

**Problem.** The Rust catalog declares per-relationship `permitted_contexts` and `permitted_principals`
in 150 places. The exported manifest carries **zero** of them. The serving planner reads one boolean
meaning _personal-advisor-traversable_.
**Decision.** Export the full context × principal matrix in manifest v3; the planner evaluates
`is_traversable_in(rel, context, principal)` with the same fail-closed semantics as Rust.
**Why now.** Safe today with one principal. **The day a second agent ships it becomes a breach**, because
there is no field in which to say "no". Fixing it before the second principal exists costs one schema
change; after, it is a live authorization defect.
**Impact.** Unblocks ADR-008, ADR-011, and all multi-agent work. No production behaviour change expected
— proven by the 119-parity test.

## Evidence

**Supporting (measured, commit `da8c7428`):**

- `permitted_contexts` in catalog: **150** · in manifest: **0**
- `planner.py:169` reads `row.get("traversable")` only
- `relationship_coverage.json`: `personal_advisor: 119`; `provider_advisor`, `organization_administrator`,
  `internal_audit`, `central_knowledge` = **null**; `provider_b2b: 19`; `sensitive: 25`
- `live_but_undeclared: 0` — the catalog covers every live relationship type

**Opposing / mitigating:** the risk is **latent, not active** — one principal exists today, and the
flattened boolean is correct for it. The team already recorded provider-context retrieval as an open
policy question, so this is not unrecognised risk. A reviewer may reasonably argue it is not urgent.

**Assumptions.** That a second principal will exist within the planning horizon. That the Rust
`is_traversable_in` predicate is itself correct (it is the source being faithfully exported).

**Unknowns.** Whether the four `null` contexts are _undefined_ or merely _uncomputed_. Does not change
the decision — both require the export to carry the field.

**Open questions.** **None blocking.** Unique among the eleven.

## Alternatives

| Alternative                        | Rejected because                                                                         | Would be revived by                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Keep boolean `traversable`         | **HB** — agent #2 inherits agent #1's rights                                             | Evidence that no second principal will ever exist                                |
| Context-only                       | Cannot distinguish two agents in one context                                             | A principal model proving redundant                                              |
| Principal-only                     | Cannot vary by query purpose (e.g. diagnostics)                                          | Contexts proving unnecessary                                                     |
| External policy engine (OPA/Cedar) | Disproportionate: new runtime + deploy surface for a matrix the catalog already declares | Policy complexity outgrowing static data — e.g. per-instance or time-based rules |
| Hardcoded per-agent policy         | **HB** — duplicated policy diverges (`verify_jwt` precedent)                             | Nothing                                                                          |

## Risks

**If accepted:** a migration bug denies legitimate access (outage) or grants illegitimate access
(breach). Mitigated by dual-emit, the 119-parity gate, and revert-to-boolean rollback.
**If rejected:** the second agent inherits full personal-advisor traversal. Not gradual — a step change.
**If deferred:** the cost is unchanged _until_ a second principal is proposed, at which point this
becomes an emergency on someone else's critical path.

## Decision matrix

| Dimension            | Rating | Note                                                     |
| -------------------- | ------ | -------------------------------------------------------- |
| Security             | **5**  | Closes the inheritance vector before it can be exercised |
| Scalability          | 5      | Static data, cached                                      |
| Complexity           | 4      | Mostly serialization; policy already exists              |
| Operational impact   | 4      | One CI gate; no runtime dependency                       |
| Migration cost       | 4      | Dual-emit, one release                                   |
| Reversibility        | 4      | Revert loader; manifest superset stays valid             |
| **Evidence quality** | **5**  | Every claim reproducible by a one-line command           |
| Unknown risk         | 4      | Low; the main unknown does not affect the decision       |

## Required vote

- **Accept** if: reviewers agree the export must carry every declared policy field, **and** the
  119-parity test is adopted as a hard gate.
- **Reject** if: reviewers judge the boolean sufficient and commit to no second principal.
- **Needs Revision** if: the principal taxonomy is judged wrong (note: taxonomy is catalog data, so this
  is weak grounds).
- **Defer** if: Security cannot attend. Nothing else defers it.

---

# PACKET · ADR-007 — Secret Management and Credential Incident Closure

**Session 1, Block B · 25 min · Owner: Security · Recommended: ACCEPT**

## Executive summary

**Problem.** Credentials have been delivered through channels that create permanent records (chat, repo
history), and at least one is organization-scoped where task-scoped would suffice.
**Decision.** Rotate everything exposed; replace org-scoped with least-privilege, short-lived
credentials; deliver only through secret stores; prove revocation by observed rejection.
**Why now.** Containment is already authorized and underway. This ratifies the permanent model.
**Impact.** Gates every write-enabled item in the programme.

## Evidence

**Supporting (measured this session):** a Fly **organization-scoped** token (`fm2_`, `/aaa/v1`) and a
Qdrant key with `"access":"m"` were pasted into chat. `flyctl secrets list -a lifenavigator-core-api`
returns 31 names including `SUPABASE_SERVICE_ROLE_KEY`, `NEO4J_PASSWORD`, `PLAID_CLIENT_SECRET` — **all
readable by the exposed Fly token.** Prior incident set the rejection-proof standard.
**Opposing:** none. No reviewer is expected to argue for the status quo.
**Assumptions.** That per-app deploy-scoped Fly tokens satisfy `deploy-fly.yml`.
**Unknowns.** **OQ-12 — was any exposed credential used during its window?** Unanswerable without auth
logs. **This gates incident _closure_, not this decision.**

## Alternatives

| Alternative                  | Rejected because                                                             | Revived by                                                       |
| ---------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Rotate only newly exposed    | Leaves known-owed rotations outstanding                                      | Evidence older values are provably unreachable                   |
| Rotate + rewrite git history | Removes a string, not a risk; costs ~30 branches, every clone, every open PR | A legally validated erasure requirement satisfiable no other way |
| Accept risk                  | **HB** — a live org-scoped token is an open door                             | Nothing                                                          |

## Risks

**If accepted:** least-privilege scoping breaks a legitimate consumer → outage. Mitigated by consumer
inventory _before_ revocation.
**If rejected:** exposed credentials remain live; every write-enabled item stays blocked anyway.
**If deferred:** identical to rejected. Deferral has no upside here.

## Decision matrix

| Dimension                                                                                         | Rating |
| ------------------------------------------------------------------------------------------------- | ------ |
| Security **5** · Scalability 4 · Complexity 4 · Operational impact 3 (friction: interactive auth) |
| Migration cost 4 · **Reversibility 1 — revocation is irreversible by design**                     |
| Evidence quality **5** · Unknown risk **2 — OQ-12 unanswered**                                    |

## Required vote

- **Accept** if: the eight-step closure sequence is adopted **and** OQ-12 gets an owner today.
- **Needs Revision** if: reviewers require a documented emergency-access path before least-privilege
  scoping (legitimate concern).
- **Reject / Defer**: not credible — containment proceeds regardless.

---

# PACKET · ADR-011 — Catalog-Based Semantic Superclass Hierarchy

**Session 1, Block D · 20 min · Owner: Graph Platform · Recommended: ACCEPT (flag-off)**

## Executive summary

**Problem.** Cross-domain reasoning ("what am I working toward?") requires knowing four differently-named
classes are all objectives, without hardcoding the list.
**Decision.** Declare `superclass` in the node class spec; the planner expands at query construction.
**No graph labels, no migration, no backfill.**
**Why now.** It ships in ADR-003's manifest v3. Separately would force a second loader migration.
**Impact.** Cross-domain reasoning capability at near-zero cost.

## Evidence

**Supporting:** motivating classes total **127 nodes = 5.1%** of a 2,506-node graph. The superseded
design required a graph-wide relabel to serve them. The manifest already carries a per-relationship
`family` consumed by the planner — the mechanism is proven.
**Opposing:** the capability is **unmeasured**. Its own falsification criterion (cross-domain queries
show no improvement) requires ADR-004's golden set, which does not exist. _This is why the
recommendation is accept-flag-off, not accept-and-enable._
**Assumptions.** Single-parent suffices for all 47 live classes.
**Open questions.** None blocking. Residual: ADR-001 may reduce `TransactionSummary`'s role, weakening
the `Observation` grouping (CONFLICT-2, low impact).

## Alternatives

| Alternative                | Rejected because                                                                          | Revived by                                                |
| -------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Neo4j labels               | **HB** — graph-wide migration for 5.1% of nodes; permanent dual-source consistency burden | A query requiring label-level indexing                    |
| Separate ontology graph    | Second store, second authority                                                            | —                                                         |
| Runtime hardcoded families | **HB** — policy as code; the exact defect class this programme exists to eliminate        | Nothing                                                   |
| OWL class hierarchy        | Would become a fifth vocabulary                                                           | The TTL disposition deciding to generate from the catalog |

## Risks

**If accepted (flag-off):** near zero — a metadata field nothing reads until enabled.
**If rejected:** cross-domain reasoning needs a hardcoded list — the rejected alternative.
**If deferred:** forces a second manifest bump later. This is the real cost of deferral.

## Decision matrix

Security 5 · Scalability 5 · Complexity **5** · Operational impact 5 · Migration cost **5 (none)** ·
Reversibility **5** · Evidence quality 3 (_capability unmeasured_) · Unknown risk 4

## Required vote

- **Accept (flag-off)** if: single-parent + depth ≤ 2 accepted, and enablement is gated on measurement.
- **Needs Revision** if: reviewers want multiple inheritance (no current use case).
- **Defer** only if ADR-003 is not accepted — they share the schema change.

---

# SHORT PACKETS · Needs Revision

These are deliberately brief. **The decision requested is "Needs Revision", not a merits vote.**

### ADR-002 Provenance — _Needs Revision_

Hybrid batch/per-assertion relational provenance outside Neo4j. **Blocked on OQ-2**: is a Plaid sync one
homogeneous batch? The storage argument — ~1,951 edges sharing identical provenance — **is** what OQ-2
tests. If negative, the design falls back to per-edge and the rationale weakens materially.
_Strengthened since drafting:_ Sprint 1 now automatically enforces single-writer, which ADR-002's
type-system guarantee depends on. **Minimum evidence:** worker queue semantics + one live ingest trace.
**Owner: Graph Platform.**

### ADR-001 Transactions — _Needs Revision_

Stop emitting the user-anchored `HAS_TRANSACTION`; reach transactions via `OWNS_ACCOUNT`. Evidence is
strong (1,951 of 3,208 edges = 60.8%, ~2 edges/node from `ontology.rs:93-96`). **Blocked on OQ-11**: a
single unre-pointable 1-hop reader rejects it. Also OQ-1 (granularity) for the reduction estimate.
**Minimum evidence:** read-dependency inventory. **Owner: Graph Platform.**

### ADR-005 Vector trust — _Needs Revision_

Indexed Qdrant payload trust filtered during search; asymmetric drift severity. **Blocked on CONF-A** —
an escalated architectural conflict: the Stage-3 backfill requires an authoritative Postgres record that
Stage 5 creates. **Needs a recorded ruling from Security + Graph Platform, not a design change.**
Also OQ-5. **Minimum evidence:** CONF-A ruling; payload-construction inspection.

### ADR-006 Identity — _Needs Revision_

Deterministic tenant-local business keys + alias table. **Blocked on OQ-6**: if `entity_id` is already
business-derived, most of the ADR reduces to documenting existing behaviour — a cheaper and better
outcome. **Minimum evidence:** read `normalizer.rs` id construction. **Owner: Data Platform.**

### ADR-009 Gateway — _Needs Revision_

Retire outright; RRF already exists at `fusion.py:81` and `ln_central` is empty, so the harvest list is
empty. **Blocked on OQ-7**: `ln_central` empty proves nothing about `central` **Neo4j** — different
store. _New since drafting:_ Sprint 1's single-writer scan does **not** cover `apps/api-gateway`
(RES-2), which strengthens the retirement case while OQ-7 still blocks it.
**Minimum evidence:** read-only `central` Neo4j inventory + 7-day traffic. **Owner: Platform Ops.**

---

# SHORT PACKETS · Deferred

### ADR-004 Evaluation — _Defer to Session 2_

Six-category golden set incl. known-absent. Blocked only on **OQ-4** (persona census, ~1 day) — the
cheapest unblock in the programme, and it gates the acceptance criteria of ADR-001 and ADR-008.
**Prioritise OQ-4.**

### ADR-008 Traversal verification — _Defer_

Out-of-band diagnostic then shadow. No blocking open questions; requires ADR-003 shipped for the
`evaluation` context. Decidable in Session 2. **Reviewers must confirm they will accept "traversal adds
nothing" as a valid outcome** — otherwise the evaluation is theatre.

### ADR-010 Confidence — _Defer_

Three stored components; path/answer/recommendation computed. The modelling argument is strong (only one
real confidence signal exists today), but the fields live on ADR-002's assertion schema. Decidable once
ADR-002 is decided.
