# P0 ONBOARDING HARDENING — One Canonical Flow — 2026-06-10

Live on production (`app.lifenavigator.tech` @ `b39a039`). Route hardening only — no GraphRAG/AI/
recommendation/finance changes.

## Legacy Route Inventory

| Route                             | Classification                         | Action              |
| --------------------------------- | -------------------------------------- | ------------------- |
| `/onboarding/financial-profile`   | **KEEP** (canonical persona selection) | unchanged — serves  |
| `/onboarding/questionnaire`       | legacy                                 | redirect (by stage) |
| `/onboarding/interactive`         | legacy                                 | redirect (by stage) |
| `/onboarding/hub`                 | legacy menu                            | redirect (by stage) |
| `/onboarding/review`              | legacy                                 | redirect (by stage) |
| `/onboarding/sections`            | legacy                                 | redirect (by stage) |
| `/onboarding/converse`            | legacy                                 | redirect (by stage) |
| `/dashboard/advisor?onboarding=1` | **KEEP** (canonical advisor)           | unchanged           |

## Routes Redirected / Removed

Implemented centrally in the middleware (`src/proxy.ts`) so it can't be bypassed client-side. The legacy
onboarding pages are folded into the canonical flow **by the user's stage**:

- no persona (`!setup_completed`) → `/onboarding/financial-profile`
- persona only (`setup_completed && !onboarding_completed`) → `/dashboard/advisor?onboarding=1`
- complete (`onboarding_completed`) → `/dashboard`

`/onboarding/financial-profile` is deliberately NOT in the legacy list (it is the canonical entry and
keeps serving). No pages were deleted (redirect keeps deep links working) — they are unreachable as a
parallel flow.

## API Deprecation Result

`/api/onboarding/complete` → **410 Gone** unless an explicit internal caller
(`x-internal-migration: 1` header OR `ALLOW_LEGACY_ONBOARDING_COMPLETE=1` env). It no longer writes
`onboarding_completed` under any path. Verified live: `POST /api/onboarding/complete` (no flag) → **410**.

## onboarding_completed Writers (full audit)

Repo-wide grep for writes to `onboarding_completed`:

- **`/api/onboarding/advisor-complete`** — the SOLE production writer (advisor confirm/skip). ✅
- `/api/onboarding/complete` — no longer writes it (was the bypass; now 410 + setup-only even internally).
- No other writer in `app/`, `components/`, or `lib/`.
  **Result: exactly one production writer of `onboarding_completed`.**

## Redirect Trace Results (prod `b39a039`, raw 307/200)

1. unauth `/dashboard` → `307 /auth?mode=signin&next=%2Fdashboard`
2. fresh `/dashboard` → `307 /onboarding/financial-profile`
3. fresh `/onboarding/questionnaire` → `307 /onboarding/financial-profile`
4. setup-only `/onboarding/questionnaire` → `307 /dashboard/advisor?onboarding=1`
5. setup-only `/dashboard` (and `/onboarding/interactive`, `/onboarding/hub`) → `307 /dashboard/advisor?onboarding=1`
6. advisor-complete `/onboarding/questionnaire` → `307 /dashboard`
7. advisor-complete `/dashboard` → `200 served`

- fresh `/onboarding/financial-profile` (canonical entry) → `200 served`
- `POST /api/onboarding/complete` (no flag) → `410`
  **All cases match the required behavior.**

## Browser Validation

The canonical flow is intact (verified in prior sprints with screenshots): persona cards → confirm →
`/dashboard/advisor?onboarding=1` → confirm/skip (`/api/onboarding/advisor-complete`) → `/dashboard`.
Attempting any legacy onboarding URL now bounces into that canonical flow at the correct stage (traces
above are the definitive gate proof). Screenshots from the persona/advisor flow:
`reports/browser-validation/latest/advisor-frontend/*`.

## Remaining Onboarding Risks

- Legacy pages are **redirected, not deleted** — they can't bypass or confuse (server-side redirect), but
  the source files remain. Deleting them is optional cleanup (kept as redirects so any external deep link
  still resolves).
- `/api/onboarding/route.ts` (`?step=…`) writes `setup_completed` only (never `onboarding_completed`) —
  not a bypass, left as-is.
- The internal `ALLOW_LEGACY_ONBOARDING_COMPLETE` / `x-internal-migration` escape hatch exists for
  migrations/tests; it must never be enabled in normal prod (it's off by default).

## Definition of Done — status

✅ One onboarding flow (persona → advisor → advisor-complete → dashboard). ✅ Legacy pages redirect into
the canonical flow and cannot bypass/confuse. ✅ `onboarding_completed` has exactly one production writer
(`/api/onboarding/advisor-complete`). ✅ `/api/onboarding/complete` is 410 (gated by an internal flag).
✅ Fresh users cannot reach the dashboard without persona + advisor completion/skip (7/7 traces).
