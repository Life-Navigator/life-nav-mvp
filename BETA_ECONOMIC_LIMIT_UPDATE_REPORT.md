# BETA_ECONOMIC_LIMIT_UPDATE_REPORT.md — Part 2: Per-User Daily Cap $1 → $4

**Date:** 2026-06-04
**Commit:** `f85271d`
**Status:** ✅ Implemented + unit-verified. Deploying to production.

---

## The change

`apps/web/src/lib/economic/types.ts` — `BETA_USER_BUDGET_DEFAULTS`:

| Window               | Before   | After                | Rationale                                                                                                                                                                                      |
| -------------------- | -------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **daily**            | $1       | **$4**               | At the corrected ~$0.00035/turn, $4/day = **~11,400 turns/day** of headroom — a heavy beta session never hits a premature 429.                                                                 |
| weekly               | $5       | **$20**              | Preserves the original **1:5:20** daily:weekly:monthly ratio so the _daily_ cap stays the binding per-session limit (a $4/day with a $5/week cap would have made the daily raise nearly moot). |
| monthly              | $20      | **$80**              | Same ratio.                                                                                                                                                                                    |
| **platform / month** | **$500** | **$500 (unchanged)** | The true backstop. `BETA_PLATFORM_BUDGET_DEFAULT.monthly_cap_micros` untouched.                                                                                                                |

---

## Requirements checklist

| Requirement                                 | Status | Note                                                                                                                        |
| ------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------- |
| Apply to internal beta users                | ✅     | `BETA_USER_BUDGET_DEFAULTS` is the lazy-create default for every new `economic_user_budgets` row (`budget-manager.ts:161`). |
| Do not change the $500 platform monthly cap | ✅     | `BETA_PLATFORM_BUDGET_DEFAULT` unchanged.                                                                                   |
| Do not weaken circuit breakers              | ✅     | `circuit-breaker.ts` / `evaluateBreaker` untouched.                                                                         |
| Do not remove per-user limits               | ✅     | Daily/weekly/monthly caps all still enforced; only the _values_ rose.                                                       |
| Do not allow unlimited usage                | ✅     | New `budget-manager.spec` test asserts a user **at** the $4 cap still gets `BLOCK`/`HARD_STOP`.                             |
| Update tests and docs                       | ✅     | See below.                                                                                                                  |

---

## Tests updated (the cap change rippled into 3 specs)

- **`usage-meter.spec.ts`** + **`budget-manager.spec.ts`** — the percentage-threshold cases (70/80/95/100%)
  were pinned to the $1 default via `SAMPLE_ROW`/`USER_BASE`. Decoupled them to **explicit literal caps
  (1M/5M/20M)** so they test the threshold _logic_, not the business value — stable across future cap
  changes.
- **`cost-estimator.spec.ts`** — regression test now asserts the per-turn cost facts against **both** the
  old $1 and new $4 caps (the alias, not the cap, was the bug).
- **New policy-lock test** (`budget-manager.spec.ts` → "beta cap policy"): asserts the defaults are exactly
  **$4 / $20 / $80**, that the ratio keeps daily binding (weekly > daily, monthly > weekly), and that
  **$4/day still BLOCKs at cap**. **123/123 economic tests pass.**

---

## ⚠️ Operational caveat — existing budget rows are NOT auto-migrated

`BETA_USER_BUDGET_DEFAULTS` only sets the cap for **newly lazy-created** `economic_user_budgets` rows.
**Existing users keep whatever `daily_budget_micros` their row was created with** (the 10 test fixtures
still carry the old $1 cap in their rows). For the beta cohort this means: either (a) the existing rows
must be `UPDATE`d to the new caps, or (b) accept that only users onboarded after this deploy get $4/day.
This was applied to the test fixtures during verification by direct `PATCH` of `daily_budget_micros`.
**Action for launch:** run a one-time `UPDATE economic_user_budgets SET daily_budget_micros = 4000000,
weekly_budget_micros = 20000000, monthly_budget_micros = 80000000` for the real beta cohort, or rely on
lazy-create for fresh signups. (Tracked in `TOP_REMAINING_ECONOMIC_RISKS.md`.)
