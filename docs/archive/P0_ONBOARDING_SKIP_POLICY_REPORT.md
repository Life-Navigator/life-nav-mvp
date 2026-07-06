# P0 ONBOARDING SKIP-POLICY HARDENING — 2026-06-11

Live on prod `601bfc9`. The advisor skip is no longer a one-click bypass — it's intentional, warned,
persisted, and traceable. No routing/middleware/advisor-intelligence/GraphRAG changes (UX + policy only).

## Policy Change

A brand-new user can no longer accidentally skip the advisor. The skip CTA is renamed and now opens an
explicit warning modal; the recorded reason distinguishes an early skip (minimum discovery not met) from a
deliberate post-minimum / post-review skip. Dashboard is still reachable by explicit choice, clearly framed
as a "limited dashboard."

## Files Changed

- `apps/web/src/app/dashboard/advisor/page.tsx` — renamed CTA, added warning modal + `requestSkip`/`confirmLimitedSkip`, discovery-progress line, richer `finishOnboarding(skip, reason)` payload.
- `apps/web/src/app/api/onboarding/advisor-complete/route.ts` — accepts `reason` + telemetry; records distinct end-states.

## Skip State Model

- **`confirmation_completed`** — user reviewed the life model and confirmed (Looks right).
- **`explicit_skip_after_minimum`** — skip after ≥ 3 discovery answers, or skip from the review screen (deliberate).
- **`early_skip_confirmed`** — skip with < 3 answers, only after explicitly confirming the warning modal.
  Minimum-discovery signal = `userAnswers >= 3` (simplest existing state; the advisor's user-message count).

## Advisor UI Changes

- CTA: **"Skip for now and go to my dashboard" → "Continue with limited dashboard"** (verified: old text gone).
- Discovery progress: **"Your Life Model is X% complete · N areas still need context"** (from `discovery_completion_pct` + coverage).
- Clicking the skip CTA opens a modal (it no longer skips directly):
  - Title: **"Your dashboard will be limited"**
  - Body: "LifeNavigator works best after advisor discovery. If you continue now, your dashboard may be incomplete, recommendations may be less useful, and your Life Graph may be sparse."
  - Buttons: **Continue Advisor Discovery** (closes) · **Continue with Limited Dashboard** (confirms the skip).

## advisor-complete Payload Changes

Request now carries `{ skip, confirmed, reason, discovery_answer_count, coverage_at_skip, graph_integrity_at_skip }`.
The endpoint validates `reason` ∈ {confirmation_completed, explicit_skip_after_minimum, early_skip_confirmed},
sets `onboarding_completed=true` (unchanged gate), and records a `onboarding_completed` user-event with
`{ explicit_skip, end_state, skip_reason, skipped_at, discovery_answer_count, graph_integrity_at_skip,
coverage_at_skip, limited_dashboard }`. Response returns `end_state`.

## Fresh User Validation (prod `601bfc9`, persona-done user on the advisor)

- CTA renamed (no "Skip for now"); "Continue with limited dashboard" present ✅
- Progress line "Your Life Model is … % complete" present ✅
- Clicking the CTA → warning modal ("Your dashboard will be limited" + "Continue Advisor Discovery") ✅;
  the click does **not** navigate/bypass (still on /dashboard/advisor) ✅; 0 page errors ✅
- `POST advisor-complete {skip, reason: early_skip_confirmed, …}` → response `end_state: early_skip_confirmed`, `skipped: true` ✅

## DB State After Early Skip

`profiles.onboarding_completed = true` (only after the explicit modal confirmation). User-event recorded:
`end_state=early_skip_confirmed`, `explicit_skip=true`, `skipped_at`, `discovery_answer_count=0`,
`coverage_at_skip`, `graph_integrity_at_skip`, `limited_dashboard=true`.

## DB State After Normal Completion

`profiles.onboarding_completed = true`; user-event `end_state=confirmation_completed`, `explicit_skip=false`,
`limited_dashboard=false`, with the discovery/coverage telemetry. (Same gate; distinct, traceable end-state.)

## Remaining Risks

- `explicit_skip` + the metrics live in the user-event metadata (traceable), not a `profiles.explicit_skip`
  column — no schema change made (kept minimal). If you want it queryable on `profiles`, that's a small migration.
- The review-screen "Skip for now" routes straight to `explicit_skip_after_minimum` (no extra modal) since it
  is already post-review — intentional. The early-conversation skip is the one gated by the modal.

## Definition of Done — status

✅ A brand-new user can no longer accidentally bypass onboarding by clicking an easy skip button. ✅ Any skip
is intentional (modal), warned, persisted (event), and traceable (distinct end-state + telemetry). ✅ The
dashboard remains reachable by explicit choice, labeled "limited." Live-validated.
