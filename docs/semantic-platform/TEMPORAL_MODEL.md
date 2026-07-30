# Temporal Model

**Status:** Designed · **Date:** 2026-07-30 · Parent: `SEMANTIC_PLATFORM_ARCHITECTURE.md`

Covers brief Phase 3.

---

## 1. Starting point

Nodes carry `created_at` / `updated_at`. Relationships carry nothing (0/3,208). There is no notion of
_when a fact was true_ as distinct from _when we recorded it_, and no way to answer a question as of a
past date.

This is the single most consequential gap for a life-advisory platform, because nearly every
financial, health, career, and estate fact is **an interval, not an instant** — a salary, an insurance
policy, a guardianship arrangement, a debt. Modelling them as current-state-only means the graph
silently overwrites history and cannot answer "what did we advise, and on what basis, in March?"

---

## 2. Bitemporal core

Two independent axes. Conflating them is the classic error and produces unauditable systems.

**Valid time** — when the fact was true _in the world_: `effective_from`, `effective_to`.
**Transaction time** — when the system _knew_ it: `observed_at`, `created_at`, `updated_at`, `expired_at`.

A salary raise effective 1 March but discovered from a payslip on 12 April has
`effective_from = Mar 1`, `observed_at = Apr 12`. Both questions are then answerable:
_"what was their salary in March?"_ (valid time) and _"what did we believe in March?"_ (transaction
time). The second is the one auditors and regulators ask, and it is unanswerable in the current model.

### 2.1 Temporal behavior classes

Every node class and relationship declares one (`SEMANTIC_DATA_MODEL.md` §2, §3):

| Class      | Semantics                                        | Examples                                                    |
| ---------- | ------------------------------------------------ | ----------------------------------------------------------- |
| `Instant`  | true at a point; no interval                     | `TransactionSummary`, `BodyMetric`, `SleepLog`              |
| `Interval` | true over a span; may be open-ended              | `CompensationRecord`, `InsuranceProfile`, `EducationRecord` |
| `Eternal`  | timeless once true                               | `HAS_SPOUSE` (historical marriage fact), birth facts        |
| `Current`  | only the latest holds; prior versions superseded | `HAS_HEALTH_GOAL`, net-worth snapshot chains                |
| `Future`   | asserted about a time not yet reached            | planned events, obligations, `EstatePlan` triggers          |

**`Future` is a first-class class, not an edge case.** The brief requires distinguishing _future
obligations_ and _planned events_ from current facts. A guardianship plan, a college start date, a
loan maturity — these must never be retrieved as present-tense facts. The advisor stating "you have a
$40k tuition expense" when the fact is `effective_from = 2029` is a fabrication of exactly the kind
the number gate exists to prevent, and no amount of prompt engineering fixes it if the graph itself
cannot tell the difference.

---

## 3. Supersession

`superseded_by` forms an explicit chain rather than a destructive update:

```
(:Assertion {status:"superseded", superseded_by: A2}) ──► (:Assertion A2 {status:"active"})
```

Retrieval defaults to `status = active AND valid_at(as_of)`. History remains queryable. Nothing is
overwritten.

**Interaction with entity consolidation.** Merges (`GRAPH_EVOLUTION_STRATEGY.md` §4) create supersession
chains, never deletions — which is what makes the brief's "merge provenance recorded; reversal
demonstrated" requirement satisfiable. A merge is reversible precisely because the superseded
assertions still exist.

---

## 4. Point-in-time reasoning

Every retrieval accepts an optional `as_of`; default is `now`. The `as_of` value is **pinned into the
answer trace**, so a reproduced answer reconstructs the same temporal slice
(`PROVENANCE_MODEL.md` §6).

```cypher
MATCH (u:UserProfile {tenant_id:$tenant})-[r]->(n)
WHERE r.assertion_id IS NOT NULL
  AND a.effective_from <= $as_of
  AND (a.effective_to IS NULL OR a.effective_to > $as_of)
  AND a.observed_at <= $as_of          // transaction-time cut: what we knew then
  AND a.assertion_status = 'active'
```

The `observed_at <= $as_of` clause is what distinguishes point-in-time reasoning from mere history
filtering. Without it you reconstruct _today's understanding of March_, not _March's understanding of
March_ — and only the latter defends a past recommendation.

### 4.1 Counterfactual evaluation

"What changes if…" (brief Phase 7) is a temporal operation: overlay a hypothetical assertion set onto a
pinned `as_of` slice, run the same deterministic retrieval, diff the results.

Requirements: overlays are **never persisted**; they carry `inference_status = hypothetical`; and they
are excluded from citation by policy. A counterfactual that can leak into the durable graph is a data
integrity incident, so the overlay lives in request scope only.

---

## 5. Decay and reinforcement

Feeds long-term memory (`brief Phase 13`). Temporal distance modulates **retrieval weight**, never
truth. An old fact is not false; it is less likely to be what the user means now.

```
effective_weight = catalog_weight
                 × recency_factor(age, half_life[temporal_class])
                 × reinforcement_factor(observation_count)
```

Half-lives are catalog data per relationship (I-9), not constants in code:
`HAS_TRANSACTION` decays fast; `HAS_CERTIFICATION` barely at all; `HAS_SPOUSE` not at all.

**Reinforcement** — repeated independent observation raises weight, capped. This is what makes a
consistently-restated user goal outrank a one-off document mention without hardcoding priority.

---

## 6. Migration

Additive and non-breaking. Existing nodes have `created_at`; treat as `observed_at`, leave
`effective_from` **null and explicitly unknown** rather than defaulting it to `created_at` — that
default would silently assert that every historical fact became true the moment we recorded it, which
is false for essentially all document-derived data.

| Step | Action                                                                 | Rollback        |
| ---- | ---------------------------------------------------------------------- | --------------- |
| 1    | Add temporal fields to `Assertion`; new writes populate                | stop populating |
| 2    | Declare `temporal_behavior` per catalog row; regenerate manifest       | revert manifest |
| 3    | Retrieval accepts `as_of`, defaults `now`, flag `TEMPORAL_FILTERING`   | disable flag    |
| 4    | Backfill `effective_*` only where a source record states it            | leave null      |
| 5    | Enable decay weighting behind `TEMPORAL_DECAY`, measured on golden set | disable flag    |

_Risk:_ Step 3 changes result sets. It must ship flag-off and be measured against the retrieval
baseline before enablement — otherwise it is an unfalsifiable change to the thing everything else is
measured by.

---

## 7. Evaluation

| Metric                    | Gate                                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ------- |
| Temporal completeness     | % assertions with a declared temporal class — target 100% (class, not values)                  |
| Valid-time coverage       | % interval assertions with `effective_from` — measured, not gated (many are genuinely unknown) |
| Point-in-time correctness | replay of a past answer reproduces its evidence set — 100%, CI                                 |
| Future-fact leakage       | count of `Future` assertions surfaced as present tense — **0, hard gate**                      |
| Expired-fact leakage      | count of `effective_to < now` assertions cited as current — **0, hard gate**                   |
| Anachronism               | assertions with `observed_at < effective_from` where class forbids it                          | flagged |

The two hard gates are stated as zero because both are fabrication vectors, and the platform's
fabrication tolerance is already established at zero.
