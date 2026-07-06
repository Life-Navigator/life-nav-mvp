# MY_LIFE_TOP_LEVEL_TRACE.md — Phase 1

## Before this sprint

`/v1/life/my-life` = 2.5s (after the prior `assess()` parallelization, down from 4.3s). The residual came from `my_life()` running its top-level reads **serially**:

```
snap   = await life.snapshot(ctx)
health = await life.discovery_health(ctx)
pri    = await os.prioritize(ctx, top=6)
r      = await readiness.assess(ctx)        # itself already parallelized internally
recent = await _recent_intelligence(ctx)
canon  = await canonical_goals(ctx)
```

Six sequential awaits, each independent (ctx-only). Total ≈ the **sum**.

## The change

Replaced the six serial awaits with one `asyncio.gather` (identical calls, concurrent). Total ≈ the **slowest single call** instead of the sum. `_timeline_passthrough` (needs `snap`) stays serial after the gather.

## After (measured live, prod, warmed avg of 3, data-rich user)

|                   | Before | After           |
| ----------------- | ------ | --------------- |
| `/my-life`        | 2.5s   | **1.8s**        |
| (vs sprint-start) | 4.3s   | **1.8s (−58%)** |

## Where the remaining 1.8s goes

The gather collapses to the **slowest single read** — `snapshot` and `assess` are the longest (~1.5–1.8s each). To go below ~1.5s you'd optimize those individual calls or serve readiness from `life.readiness_snapshots` (the documented snapshot-cache option). The serial-stacking is now gone.
</content>
