# RECOMMENDATIONS_RENDER_FIX.md — Sprint 1

## The fix (shipped)

`apps/web/src/app/dashboard/recommendations/page.tsx` — changed the load order from **"slow POST sync, then GET"** to **stale-while-revalidate**: GET the existing roadmap immediately (render it), then run the sync in the background and refresh.

```ts
// before: page awaited the slow sync before its first GET
fetch('/api/recommendations', { method: 'POST' })
  .catch(() => {})
  .finally(load);

// after: render existing roadmap instantly, sync in background
load();
fetch('/api/recommendations', { method: 'POST' })
  .catch(() => {})
  .finally(() => load());
```

Commit `716dd20`. eslint 0 errors; tsc clean for this change (1 pre-existing error at line 99, CI-ignored).

## Result (verified live, Playwright, prod)

- **User A (has recs):** at 8s the page shows the **full roadmap** (`Your Roadmap? true, building? false, recs? true`) — improved from needing ~16s before.
- The page is already **advisor-grade**: every card shows Why (priority formula), risk/objective linkage, evidence/impact, confidence, and Accept/Start/Complete/Dismiss actions — matching the Sprint-1 "no generic task cards" requirement.

## Residual (NOT fully solved here — belongs to Sprint 5)

- The roadmap **GET itself is 3.4–3.6s** (it computes readiness + collects across modules on read). So first paint is still ~5–8s, and **User B (sparse data) was still "building" at 8s**.
- This is a **backend latency** problem (same root as the advisor stall), so it is correctly Sprint 5 (Arcana performance). Candidate optimizations: serve the cached `recommendations` rows on GET and recompute only on the background sync; parallelize the per-module collectors; cache the readiness assess.

## UI requirement check (Sprint 1)

| Required per rec          | Present?                                      |
| ------------------------- | --------------------------------------------- |
| Why                       | ✅ priority formula + "why this is #1"        |
| Evidence                  | ✅ supporting datapoint + sources             |
| Impact                    | ✅ impact bits (financial/readiness/coverage) |
| Confidence                | ✅ shown                                      |
| Timeline (Now/Next/Later) | ✅ roadmap sequencing                         |
| Dependencies              | ✅ blocked-by / unlocks                       |
| Related Goal              | ✅ "threatens your objective '…'"             |
| Related Risk              | ✅ RISK-typed cards                           |

The surface already meets the advisor-grade bar; the only gap was speed.
</content>
