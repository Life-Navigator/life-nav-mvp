# P0 AUTH BOUNDARY — INVESTIGATION + FIX — 2026-06-11

Live on prod `2386c01`. **The server-side auth boundary was intact — no unauthenticated user could reach
onboarding, advisor, dashboard, persona data, graph, or finance APIs.** The reported "Sign In → onboarding
with persona/Plaid already selected" was **not an auth bypass**; it was a stale/existing session on an
account that had already activated a persona, resuming into the advisor. One real spec deviation (APIs
returned 307 instead of 401) is fixed.

## Exact Root Cause

`proxy.ts` line 92-93: an **already-authenticated** user who navigates to `/auth` is redirected to
`/dashboard` (so logged-in users don't see a login form). With a leftover Supabase session on an account that
had already done persona activation (`setup_completed=true`), clicking "Sign In" → `/auth` → `/dashboard` →
(onboarding gate) → `/dashboard/advisor` **with that account's existing persona/Plaid data**. The system was
correctly resuming an authenticated account, not skipping auth. For a genuinely unauthenticated user the
boundary holds (every protected route → `/auth`).

## Sign In Button Trace

`components/marketing/Navbar.tsx` → **`href="/auth?mode=signin"`** (magic link → `/auth?mode=magic`). Correct —
Sign In goes to the auth page, never to onboarding/dashboard.

## Public Route Audit

`proxy.ts PUBLIC_ROUTES` = `/`, `/pricing`, `/features`, `/security`, `/waitlist`, `/auth` + `/auth/*`,
`/api/auth/*`, `/_next`, `/static`, favicon/images. Everything under `/dashboard`, `/onboarding`, `/admin`,
`/api/*` (except `/api/auth`) is protected. No onboarding/advisor/persona route is public.

## Auth Middleware Audit

`isProtectedRoute` covers `/dashboard`, `/onboarding`, `/admin`, `/api/*`. Unauthenticated protected request →
pages redirect to `/auth?mode=signin&next=…`; **APIs now return 401** (was a 307 redirect). Authenticated user
on `/auth` → `/dashboard` (intentional). The advisor-first onboarding gate runs only for authenticated users.

## Persona Auto-Selection Audit

`components/onboarding/SampleFinancialProfile.tsx`: `selectedId` starts `''` (empty = nothing chosen),
`step` starts `'select'`. `activate-persona` is called **only** on an explicit user selection (`if (!selectedId) return`).
No auto-select, no preselected persona, no auto-confirm. Plaid sandbox data is inserted **only** after the
explicit confirm step. ✅ Rules 6 & 7.

## API Auth Audit

`activate-persona`, `advisor-complete`, `life/graph`, `finance/canonical-summary` — all return **401** when
unauthenticated (verified live). The route handlers also `getUser()`→401 as defense-in-depth.

## Files Changed

- `apps/web/src/proxy.ts` — protected `/api/*` returns `401 {error:'Unauthorized'}` instead of a 307 redirect to the HTML login page (Rule 4). Pages still redirect to `/auth`.

## Unauthenticated Trace Results (prod `2386c01`)

| Route                                      | Result                                                           |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `/dashboard`                               | 307 → `/auth?mode=signin&next=%2Fdashboard`                      |
| `/dashboard/advisor?onboarding=1`          | 307 → `/auth?mode=signin&next=%2Fdashboard%2Fadvisor`            |
| `/onboarding/financial-profile`            | 307 → `/auth?mode=signin&next=%2Fonboarding%2Ffinancial-profile` |
| `/api/integrations/plaid/activate-persona` | **401**                                                          |
| `/api/onboarding/advisor-complete`         | **401**                                                          |
| `/api/life/graph`                          | **401**                                                          |
| `/api/finance/canonical-summary`           | **401**                                                          |

## Fresh User Browser Validation

Brand-new account, fresh session: Sign In → `/auth` (form, not onboarding). Authenticated fresh user at
`/onboarding/financial-profile`: **persona picker renders with NOTHING preselected** (no "You selected", no
"Start Advisor"), 0 page errors — the user must explicitly click a persona, then confirm the sandbox data.

## DB State Before / After

- **Before persona:** `setup_completed=false`, `onboarding_completed=false`, **0 finance rows** (no sandbox data inserted). ✅
- **After persona selection** (existing behavior): `setup_completed=true`, `onboarding_completed=false`, persona activated + sandbox data inserted (only on explicit confirm).
- **After advisor completion/skip:** `onboarding_completed=true` + distinct `end_state` recorded (prior sprint).

## Remaining Risk

- **Stale-session resume:** an already-authenticated user clicking "Sign In" is sent to their in-progress
  app state (intended; logged-in users shouldn't see a login form). This is what generated the report. If you
  want "Sign In" to **always force a fresh login** (sign the current session out first), that's a deliberate
  product change — not made here, because the sprint says don't redesign and the unauth boundary already holds.
  Recommend confirming whether Sign In should sign out an existing session.
- APIs returning 401 may surface as fetch errors in any client code that assumed a redirect — none observed.

## Definition of Done — status

✅ An unauthenticated user cannot access onboarding, advisor, dashboard, Plaid persona data, graph, or finance
APIs (pages → /auth, APIs → 401). ✅ Sign In goes to `/auth`. ✅ Persona selection only after authentication;
nothing preselected; sandbox data only on explicit confirm. ✅ Advisor only starts after authenticated persona
confirmation. The "bypass" was a stale-session resume, not a boundary failure.
