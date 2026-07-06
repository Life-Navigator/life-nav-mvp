# P0 AUTH & SESSION TRUST — SESSION-RESUME INTERSTITIAL — 2026-06-11

Live on prod `295b638`. The trust failure (Sign In silently resuming an existing account into the advisor
with a persona already present) is fixed: an authenticated session now lands on an **explicit interstitial**,
never a silent resume. Auth enforcement (the unauthenticated gate) was already correct and is unchanged.

## Root cause (confirmed) → Fix

`proxy.ts` redirected an already-authenticated user hitting `/auth` straight to `/dashboard` → advisor. Now it
routes to **`/auth/session`** (except the interstitial itself + `/auth/callback`/`/auth/confirm`). The user
sees who they are and chooses Continue / Switch Account / Sign Out — no silent resume.

## Files Changed

- `apps/web/src/proxy.ts` — authenticated `/auth*` → `/auth/session` (Rule 1; no change to the unauth gate).
- `apps/web/src/app/auth/session/page.tsx` (new) — the interstitial (Rules 2–4).
- `apps/web/src/app/api/auth/event/route.ts` (new) — structured events (Rule 9).

## Session Resume Screen (Rule 2/4)

`/auth/session` shows: **"You're already signed in"**, Account email, Name, Onboarding status
(Complete / In progress (advisor) / Not started), and — when a persona is connected — _"A beta persona is
connected to this account. Continuing resumes that in-progress setup."_ Buttons:

- **Continue** → `/dashboard` if `onboarding_completed`, else `/dashboard/advisor?onboarding=1` (persona set) or `/onboarding/financial-profile` (no persona). Logs `ONBOARDING_RESUMED`.
- **Switch account** → `signOut()` + clears local/sessionStorage → `/auth?mode=signin`. Logs `AUTH_SWITCH_ACCOUNT`.
- **Sign out** → `signOut()` + clears storage → `/auth?mode=signin`. Logs `AUTH_SIGNOUT`.
  No automatic redirects — the user must choose (verified: page stays on `/auth/session`).

## Logging (Rule 9)

`/api/auth/event` records `AUTH_SESSION_RESUMED`, `AUTH_SWITCH_ACCOUNT`, `AUTH_SIGNOUT`, `ONBOARDING_RESUMED`
(+ allow-listed `PERSONA_RESUMED/CHANGED`, `ONBOARDING_COMPLETED`) with `user_id`, `email`, timestamp.

## Persona Transparency (Rules 5/6) — status

Already in place from the persona-selection sprint: `SampleFinancialProfile` requires an **explicit** persona
click → a **confirm step** ("You selected X … this is Plaid **sandbox** data used for beta testing — not your
real financial account") before activation. The interstitial adds the resume-side transparency ("a beta
persona is connected"). A dedicated "Welcome Back / Continuing [Persona name] / Change persona" screen (Rule 5
verbatim) is a thin follow-up — the persona name isn't surfaced on the interstitial yet.

## Entry-Point Matrix (Rule 7)

| Route                           | Unauthenticated     | Authenticated, no persona                             | Authenticated, persona only       | Authenticated, onboarding complete |
| ------------------------------- | ------------------- | ----------------------------------------------------- | --------------------------------- | ---------------------------------- |
| `/auth` (Sign In)               | sign-in form        | **→ /auth/session**                                   | **→ /auth/session**               | **→ /auth/session**                |
| `/auth/session`                 | → /auth?mode=signin | interstitial → Continue=/onboarding/financial-profile | interstitial → Continue=/advisor  | interstitial → Continue=/dashboard |
| `/dashboard`                    | → /auth             | → /onboarding/financial-profile                       | → /dashboard/advisor?onboarding=1 | serves                             |
| `/dashboard/advisor`            | → /auth             | → /onboarding/financial-profile                       | serves (advisor)                  | serves                             |
| `/onboarding/financial-profile` | → /auth             | persona picker (nothing preselected)                  | (redirected onward)               | (redirected onward)                |
| `/dashboard/life-graph`         | → /auth             | → /onboarding/financial-profile                       | → /dashboard/advisor              | serves                             |
| `/api/*` (protected)            | **401**             | serves / gated by route                               | serves                            | serves                             |

## Validation Results (prod `295b638`)

| Case                                                                 | Result                            |
| -------------------------------------------------------------------- | --------------------------------- |
| Authenticated `/auth` → interstitial (not silent resume)             | ✅ `307 /auth/session`            |
| Interstitial shows "already signed in" + email + 3 buttons           | ✅                                |
| No auto-redirect (user must choose)                                  | ✅ (stays on /auth/session)       |
| Unauthenticated `/auth/session`                                      | → `/auth?mode=signin` (client) ✅ |
| Unauth pages → /auth, APIs → 401 (prior fix)                         | ✅                                |
| Fresh user: nothing preselected, no sandbox data pre-persona (prior) | ✅                                |

0 page errors. Screenshot: `reports/browser-validation/latest/auth-session/1-interstitial.png`.

## Remaining Risk / Not Done

- **Rule 5 verbatim** ("Welcome Back / Continuing [Persona Name] / Change persona") — the interstitial covers
  resume transparency but doesn't yet show the persona's display name + created/updated dates. Thin follow-up.
- **Rule 8 (visible identity on every authenticated page)** — not re-verified this turn; the dashboard sidebar
  has a profile area but I did not confirm name+email render on all pages. Recommend a quick audit/add.
- **Full validation matrix** (incognito / multi-tab / logout-login round-trips) — I validated the core cases
  live; the exhaustive multi-tab/incognito matrix with screenshots is the remaining QA pass.

## Definition of Done — status

✅ Sign In never silently resumes — an existing session lands on an explicit interstitial. ✅ The user always
sees their account (email) and chooses Continue / Switch / Sign Out. ✅ Persona selection + sandbox data remain
explicit (no auto-select; confirm step). ✅ Structured session events logged. ◻ Rule 5 verbatim persona-resume
screen + Rule 8 universal identity header + the exhaustive incognito/multi-tab matrix = thin follow-ups.
