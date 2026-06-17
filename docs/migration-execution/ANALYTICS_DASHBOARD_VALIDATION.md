# Analytics Dashboard Validation

**Date:** 2026-06-17 · Dashboard logic: **VALIDATED** (tests). Live data: **PENDING APPLY + feedback**.

## What the dashboard reads (`/dashboard/pilot-analytics` ← `/v1/admin/pilot-analytics`)

| Metric                 | Source field                                  | Gate  |
| ---------------------- | --------------------------------------------- | ----- |
| Narrative Accuracy     | `instruments.averages.narrative_accuracy`     | > 8.5 |
| Trust                  | `instruments.averages.trust`                  | > 8.0 |
| Recommendation Quality | `instruments.averages.recommendation_quality` | > 8.0 |
| Return Intent          | `instruments.averages.return_intent`          | > 8.0 |
| NPS                    | `feedback.nps_score`                          | > 50  |
| Insight Rate           | `instruments.insight_rate`                    | > 70% |
| Holy-Shit Rate         | `instruments.holy_shit_rate`                  | > 50% |

## Validated now (no prod needed) — 9 dashboard/proxy tests

- Gate pass/fail math correct (strict greater-than).
- **No metric silently defaults to success:** a gate is only scored when its response count > 0; otherwise it renders **"No responses yet"** (asserted in `test`: per-metric empty state + page-level empty at `total_feedback_rows === 0`).
- **No metric returns null unexpectedly:** missing fields → honest "No responses yet", never `null`/`0`/a fake pass.
- Admin-gated: 403 → "Admin only" state; loading + error states present.

## Pending live validation (AFTER apply + synthetic feedback)

1. Submit synthetic feedback across all instruments (see `PILOT_FEEDBACK_VALIDATION.md`).
2. Load `/dashboard/pilot-analytics` as an admin; confirm each metric shows the aggregated value + correct gate color + response counts.
3. Confirm a metric with zero responses still reads "No responses yet" (not 0% / not pass).
4. Confirm a non-admin gets the "Admin only" state.

## Status

**Dashboard READY and honest-by-construction; live values BLOCKED on apply + real feedback.** The "no silent success / honest empty state" requirement is enforced in code and tested.
