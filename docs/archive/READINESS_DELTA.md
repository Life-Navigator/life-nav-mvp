# READINESS_DELTA.md — Phase 4 (HONEST: not real yet)

## Finding (verified live)

A `life.facts` write does **NOT** change the readiness index: measured **69 → 69** after writing a health-goal fact. `LifeReadinessEngine.assess()` computes from **domain tables** (finance._, career._, health._, family._, education.\*) + their summaries — it does not read `life.facts`.

## Therefore

A "Family Readiness 42 → 58" delta after an action would be **fabricated**. I did not build it. The Impact Card shows the impact _areas_ (qualitative, true) instead of a fake numeric jump.

## What it would take (documented, not built)

For an action to truly move readiness, it must also write the **domain table** readiness reads. E.g. the new_child action would need to write `family.dependents`; home_purchase → `finance.assets` + `finance.asset_loans`; degree → `education_records`; health_goal → `health.health_goals`. Then `assess()` (already on-read) would reflect it, and a real before/after delta could be shown.

This is the **single remaining gap** to the full "instant readiness payoff." It's a per-domain mapping (5 write paths, all of which already exist as endpoints — see the write audit), deliberately out of scope for this polish sprint to avoid shipping a fabricated number.
