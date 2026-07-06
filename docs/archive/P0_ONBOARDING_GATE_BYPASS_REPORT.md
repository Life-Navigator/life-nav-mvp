# P0 ONBOARDING GATE BYPASS — ROOT CAUSE + FIX — 2026-06-10

Live on production (`app.lifenavigator.tech` @ `f76f3d2`).

## Root cause

**`/api/onboarding/complete` set BOTH `setup_completed=true` AND `onboarding_completed=true`** (with a
comment: "Completing the full questionnaire also satisfies the advisor-onboarding gate"). That endpoint
is called by the **legacy** onboarding pages `/onboarding/questionnaire` (line 149) and
`/onboarding/interactive` (line 160), which are reachable via `/onboarding/hub` — and `/onboarding/*` is
**not** covered by the advisor-first gate (the gate only acts on `/dashboard` + `/admin`). So a user who
completed the legacy questionnaire had `onboarding_completed=true` and the middleware let them straight
into `/dashboard` — **skipping persona selection and the advisor entirely**. The invariant
"only the advisor unlocks the dashboard" was violated by a second writer of `onboarding_completed`.

## Exact file / condition

`apps/web/src/app/api/onboarding/complete/route.ts` line 47: `onboarding_completed: true`.
(Other writer — the legitimate one — is `apps/web/src/app/api/onboarding/advisor-complete/route.ts`.)

## What I ruled out (with proof)

- **DB defaults:** `information_schema` → `setup_completed default false`, `onboarding_completed default false`.
- **Signup trigger:** `on_auth_user_created → handle_new_user()` creates the profiles row; a freshly
  created user's row = `{setup_completed:false, onboarding_completed:false}` (queried directly).
- **Middleware not running:** it IS active on prod — unauth `/dashboard` → `/auth?...`; authed fresh user
  (`setup_completed=false`) `/dashboard` → **307 `/onboarding/financial-profile`** (raw redirect trace).
- **activate-persona:** sets `setup_completed` ONLY (not `onboarding_completed`) — verified.
- So the only way to `onboarding_completed=true` without the advisor was `/api/onboarding/complete`.

## DB state — before / after the fix (completing the legacy questionnaire)

|            | setup_completed | onboarding_completed | /dashboard result                         |
| ---------- | --------------- | -------------------- | ----------------------------------------- |
| **Before** | true            | **true**             | **served (BYPASS)**                       |
| **After**  | true            | **false**            | **307 → /dashboard/advisor?onboarding=1** |

## Fix

`/api/onboarding/complete` now sets `setup_completed` only; **`onboarding_completed` is set ONLY by
`/api/onboarding/advisor-complete`** (the advisor confirm/skip). Completing the legacy questionnaire now
counts as setup → the gate routes the user into the advisor before the dashboard unlocks.

## Files changed

- `apps/web/src/app/api/onboarding/complete/route.ts` — removed `onboarding_completed: true` (+ invariant comment).

## Browser / live validation (raw 307 redirect traces — definitive for a gate, more so than screenshots)

On prod `f76f3d2`, fresh users created via the admin API (verified email), session minted:

1. **Unauthenticated** `/dashboard` → `302/307 /auth?mode=signin&next=%2Fdashboard` ✅
2. **Fresh (setup_completed=false)** `/dashboard` → `307 /onboarding/financial-profile` ✅; `/dashboard/finance/overview` → same ✅
3. **Setup-only (setup_completed=true, onboarding_completed=false)** — the post-fix questionnaire result —
   `/dashboard` → `307 /dashboard/advisor?onboarding=1` ✅ (no longer served)
4. (`onboarding_completed=true` only via advisor confirm/skip → dashboard — verified in prior sprints.)

## Definition of Done — status

✅ A fresh user cannot reach the dashboard before persona selection AND advisor onboarding/confirm/skip.
The second, gate-bypassing writer of `onboarding_completed` is removed; the advisor is the sole unlocker.

## Remaining (defense-in-depth follow-ups — not required to close the bypass)

- The legacy `/onboarding/{questionnaire,interactive,hub,review,converse,sections}` pages still exist and
  are navigable (they no longer bypass the dashboard, but are a parallel/confusing flow). Recommend
  redirecting them to `/onboarding/financial-profile` (canonical entry).
- `/api/onboarding/complete` returns 400 on partial payloads (it validates a fuller questionnaire body);
  consider deprecating it entirely once the legacy pages are retired.
