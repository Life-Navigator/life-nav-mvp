# EXPENSIVE_READ_AUDIT.md — Phase 2

What is recomputed on every page load, and what should be cached / event-driven. Grounded in the measured latencies (ARCANA_PERFORMANCE_REPORT.md) + the service code.

## Expensive reads (measured)

| Read                          | Cost  | What it recomputes                                                           | Recommendation                                                                                                                                                                                                                                                                                            |
| ----------------------------- | ----- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/v1/recommendations/roadmap` | 3.8s  | calls `readiness.assess()` + collects across all domain modules on every GET | **Serve cached** `recommendations` rows on GET (already persisted in the registry); recompute only on the background **sync** (already triggered) or on data-change events. The page now renders cached-first (stale-while-revalidate) — the backend should match: GET = read registry, don't re-collect. |
| `/v1/life/my-life`            | 4.3s  | composes life model + readiness + recs each load                             | **Precompute / cache readiness** (`life.readiness_snapshots` already exists) and read it instead of re-assessing; the snapshots are written by the web readiness scorers.                                                                                                                                 |
| `/v1/life/advisor/chat`       | 22.2s | retrieval + multi-domain fact packets + LLM                                  | **Parallelize** the per-domain fact-packet fetches; **stream** the LLM tokens (first token < 2s). LLM time itself is the floor.                                                                                                                                                                           |

## The shared pattern

**`readiness.assess()` is the common expensive call** — recomputed on roadmap, my-life, and indirectly elsewhere. It already has a cache target (`life.readiness_snapshots`, migration 163). The fix class:

- **On read:** serve the latest snapshot (fast).
- **On write (document upload / onboarding / advisor action):** recompute + upsert the snapshot.

This converts readiness from on-demand-recompute to **event-driven precompute** — the single highest-leverage backend perf change.

## Should X be cached / event-driven? (answers)

- Readiness → **precompute** on data change, read the snapshot. (Already has the table.)
- Recommendations roadmap → **cache** the registry; recompute on the existing sync trigger, not every GET.
- Dashboard my-life → **cache** the composed view or at least the readiness portion.
- Family/Health → already fast (1.0s / 0.2s); leave as on-demand.

## Status

Audit complete; the page-side mitigations (stale-while-revalidate, step progress) are **shipped**. The backend read-side caching (serve snapshots/registry on GET) is **specified, not yet built** — it's the next perf increment and would take roadmap 3.8s → sub-second and dashboard 4.3s → ~1s.
</content>
