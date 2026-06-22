# READ_PATH_LATENCY_TRACE.md — Phase 1

Measured live against prod (real user JWT, warmed then averaged).

## The bottleneck (traced)

Both slow read paths funnel through `LifeReadinessEngine.assess()`:

- `/v1/life/my-life` → calls `readiness.assess()` (+ snapshot, prioritize, recent-intelligence).
- `/v1/recommendations/roadmap` → calls `readiness.assess()` (+ cross-module collectors).

**`assess()` ran a SERIAL loop:** `for domain in (finance, health, career, family): await svc.summary(ctx)` → then education summary → decision readiness → enrich-finance (planning) → goals. ~7 sequential `await`s, each ~0.4–0.9s → the latency stacked.

| Path                     | Before | DB+compute split                                                           |
| ------------------------ | ------ | -------------------------------------------------------------------------- |
| my-life                  | 4.3s   | dominated by `assess()` serial domain summaries + the my_life serial calls |
| roadmap                  | 3.8s   | dominated by `assess()` + collectors                                       |
| family/office            | 1.0s   | single service, no fan-out                                                 |
| health/intel, life.facts | 0.2s   | single read                                                                |

## The fix applied (Phase 4, this sprint)

Parallelized the **independent** calls in `assess()` with `asyncio.gather` (finance/health/career/family summaries + education + decision + goals run concurrently); `enrich_finance` still runs after (it depends on the finance result). **Same results, concurrent execution — no staleness, no cache.**

## After (measured)

| Path        | Before | After    | Δ    |
| ----------- | ------ | -------- | ---- |
| **roadmap** | 3.8s   | **1.7s** | −55% |
| **my-life** | 4.3s   | **2.5s** | −42% |

## Residual

- `my-life` at 2.5s still has serial top-level calls (snapshot + prioritize + recent-intelligence) + `enrich_finance`'s `planning.plan`. Parallelizing those too (and folding `planning.plan` into the gather) would push it toward ~1.5s.
- For sub-1s, the snapshot-cache option (EXISTING_SNAPSHOT_AUDIT / FAST_READ_CONTRACT) serves `life.readiness_snapshots` on read — deferred because parallelization captured most of the win at **zero staleness risk**.
  </content>
