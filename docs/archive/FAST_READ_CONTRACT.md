# FAST_READ_CONTRACT.md — Phase 2/3 (the snapshot-cache option, documented)

This sprint achieved the latency goal via **parallelization** (READ_CACHE_PERFORMANCE_REPORT.md), so the snapshot cache below is the **further** step for sub-1s — specified, not built. Capturing it so it's ready when needed.

## Existing snapshots that CAN be served on read (no new infra)

| Store                                                                                                          | Has updated_at?   | Provenance?           | Safe to serve on GET?           |
| -------------------------------------------------------------------------------------------------------------- | ----------------- | --------------------- | ------------------------------- |
| `life.readiness_snapshots` (migration 163; per-domain career/education/life_brief scores from the web scorers) | ✅ `generated_at` | ✅ sources/components | ✅ — read latest per domain     |
| `recommendations` registry (recommendations_os)                                                                | ✅ `updated_at`   | ✅ evidence           | ✅ — already the roadmap source |
| `life.facts`                                                                                                   | ✅                | ✅ document_id        | ✅                              |
| `life.life_objectives` / canonical goals                                                                       | ✅                | ✅                    | ✅                              |

## Fast-read contract (if implemented)

- **GET prefers persisted state:** serve the latest readiness snapshot + stored recommendations; do NOT recompute on read.
- **Recompute only on:** document upload, field confirm/edit/reject, MCP write, onboarding/goal/domain update, explicit `refresh=true`, or a missing/older-than-threshold snapshot.
- **Honest freshness (required):** every cached response carries `last_computed_at`, `source: snapshot | recomputed`, and a `stale_warning` when older than the threshold. **Never present a stale value as freshly computed.**

## Why deferred

Parallelization got roadmap to 1.7s and dashboard to 2.5s with **no staleness surface**. The snapshot cache adds freshness/invalidation complexity for the last ~1.5s — worth it only if sub-1s is required for the demo. Recommended order if pursued: (1) parallelize `my_life` top-level calls (safe, →~1.5s), then (2) snapshot-serve readiness (→sub-1s) with the freshness metadata above.

## Tests to add when the cache is built

latest-snapshot selected · fallback recompute when no snapshot · stale snapshot labeled honestly · recommendations served from stored records · `refresh=true` recomputes · advisor context doesn't trigger full recompute · no candidate/inferred data promoted.
</content>
