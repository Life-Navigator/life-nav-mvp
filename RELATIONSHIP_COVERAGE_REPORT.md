# Relationship Coverage Report

**Generated:** 2026-07-30
**Machine-readable:** `artifacts/graphrag-reconciliation/relationship_coverage.json`
**Live snapshot:** `artifacts/graphrag-reconciliation/live_graph_snapshot.json`
**Regenerate:** `python scripts/graphrag/relationship_coverage.py --manifest <manifest> --live <snapshot> --out <out>`

Live figures were read from the production Aura instance from inside the `lifenavigator-core-api`
container, using the container's own credentials. No credential was printed, copied out, or written to
any file in this repository.

---

## Headline

| metric                                       | value    |
| -------------------------------------------- | -------- |
| Total relationships executable code can emit | **141**  |
| Total manifest relationships (incl. planned) | **147**  |
| Total currently live relationship types      | **40**   |
| **Live but undeclared**                      | **0** ✅ |
| Traversable — personal advisor               | 119      |
| Non-traversable                              | 28       |
| Implemented but currently absent from data   | 106      |
| Planned (no writer)                          | 6        |
| Deprecated                                   | 0        |
| Provider / B2B                               | 19       |
| Sensitive personal                           | 25       |

Graph totals at capture: **2,506 nodes / 3,208 relationships / 268 tenants / 47 labels**.

---

## Before and after

|                                        | before                     | after                           |
| -------------------------------------- | -------------------------- | ------------------------------- |
| Emitters the manifest generator walked | 1 of 2                     | **2 of 2** (+ special fallback) |
| Manifest relationships                 | 61                         | **147**                         |
| Emittable-but-undeclared               | **86**                     | **0**                           |
| Live-but-undeclared                    | 1 (`HAS_EDUCATION_RECORD`) | **0**                           |
| Explicit traversal-policy decisions    | 0                          | **147**                         |
| Per-context policy model               | none (implicit "all")      | 5 contexts                      |

---

## Traversable by context

| context                    | traversable | implemented |
| -------------------------- | ----------- | ----------- |
| Personal advisor           | 119         | yes         |
| Provider advisor           | —           | **no**      |
| Organization administrator | —           | **no**      |
| Internal audit             | —           | **no**      |
| Central knowledge          | —           | **no**      |

Only the personal advisor has a retrieval path. The remaining contexts are reported as `null` rather
than `0` in the artifact: "no planner exists" is a different fact from "nothing is permitted", and
reporting them as zero would overstate how much policy has actually been exercised.

## Non-traversable, by reason

| reason                                                       | count  |
| ------------------------------------------------------------ | ------ |
| Provider or B2B — requires separate authorization design     | 19     |
| Operational or provenance — not advisor-facing               | 8      |
| Compatibility fallback — carries no semantics (`RELATED_TO`) | 1      |
| **Total**                                                    | **28** |

---

## Implemented but absent from data — 106

**This is not a defect.** Support is a property of the code. These 106 relationship types have working
emitters; the corresponding domains simply have no rows in the current corpus. They are correctly
declared, correctly policied, and will be traversable the moment data arrives — which is precisely the
property that was missing before, when they would instead have become silently unreachable.

The evaluation harness reports actual availability per corpus. **The planner must never assume a
declared relationship is present in data**, and does not.

## Planned — 6

Declared for vocabulary and ranking completeness with no writer today:
`CONTRIBUTES_TO`, `HAS_APPLICATION`, `HAS_BENEFIT_DEADLINE`, `HAS_COMPENSATION_PROJECTION`,
`HAS_SKILL_GAP`, `PURSUING`.

---

## Live relationship distribution

40 types over 3,208 edges. The graph is heavily concentrated:

| relationship       | edges | share |
| ------------------ | ----- | ----- |
| `HAS_TRANSACTION`  | 1,951 | 60.8% |
| `OWNS_ACCOUNT`     | 419   | 13.1% |
| `RELATED_TO`       | 148   | 4.6%  |
| `HAS_GOAL`         | 83    | 2.6%  |
| `HAS_CAREER`       | 66    | 2.1%  |
| remaining 35 types | 541   | 16.9% |

Two observations worth carrying into the enablement decision:

- **74% of all edges are transaction-related.** Strip transactions and the graph is ~1,250 edges over
  ~1,500 nodes — largely a star of `UserProfile → domain profile` with little cross-domain connective
  tissue. Multi-hop traversal has comparatively little to traverse. The retrieval machinery is more
  sophisticated than the graph it currently reads.
- **`RELATED_TO` has 148 edges (4.6%).** That is the unmapped-entity fallback, and it is
  non-traversable by policy. Those 148 edges are effectively invisible to retrieval. They represent
  entity types that should be migrated from the legacy table into `REGISTRY` so they gain real typed
  edges.

---

## Unresolved policy decisions

| id                           | question                                                                                                                                                                 | blocks enablement                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| `provider-context-retrieval` | Provider/Arcana B2B edges are declared but traversable in no implemented context. A provider-advisor path needs its own authorization, tenancy and query-context design. | **No** — unreachable is the correct state today |

---

## Verification

```
$ cargo test -p ingestion-worker
test result: ok. 79 passed; 0 failed; 1 ignored

$ pytest tests/            # apps/lifenavigator-core-api
952 passed

$ python scripts/graphrag/relationship_coverage.py …
declared=147 live=40 traversable(personal)=119 implemented-absent=106 planned=6
OK: every live relationship type is declared
```

Gate proof — a controlled relationship added to an emitter fails CI until catalogued:

```
executable code can emit 1 relationship type(s) with no catalog row: ["ZZ_CONTROLLED_PROOF_EDGE"]
test result: FAILED. 0 passed; 1 failed
```
