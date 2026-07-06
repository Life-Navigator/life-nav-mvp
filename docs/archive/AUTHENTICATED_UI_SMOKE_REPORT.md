# AUTHENTICATED_UI_SMOKE_REPORT.md

**Date:** 2026-06-25 · **Target:** https://lifenavigator.tech (prod) · **Auth:** real password login through the app's own `signInWithPassword` flow (sets `@supabase/ssr` cookies correctly). Admin magic-links could NOT establish an SSR session (implicit-hash flow vs cookie/PKCE) — documented as the email blocker.

## Method

Headed/headless Playwright with a real logged-in session. Captured full-page screenshots, HTTP status, final URL, and console errors for every surface, plus the finance redirect and two advisor turns.

## Account changes made for the smoke (please review)

- **Temporary password** set on `techavenger83@gmail.com` — reset it via Forgot Password when convenient (magic-link still works once email is fixed).
- **`onboarding_completed`/`setup_completed` = true** — the account had real usage but the flag was never set, so every `/dashboard/*` route was bouncing to `/onboarding/financial-profile` (see punch list).
- **Activated the `young_professional` Plaid sandbox persona** to validate finance-with-data. Your finance data now reflects that sandbox; switch/deactivate any time.

## Per-surface results (all HTTP 200, authenticated)

| Surface                                                    | Result                                                                                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Login (password)                                           | ✅ authenticates → /dashboard                                                                                                                                                  |
| Dashboard                                                  | ✅ honest empty states; domain cards use the fixed domain-scoped "Continue discovery" CTAs; greets with raw email (minor)                                                      |
| **/dashboard/finance → /dashboard/finance/overview**       | ✅ **redirect works live**                                                                                                                                                     |
| Finance Overview (no persona)                              | ✅ honest $0 + "No accounts connected yet" / "insights appear as your history grows"                                                                                           |
| Finance Overview (persona active)                          | ✅ Net Worth **−$17,640** (consistent), **liabilities render red/negative** (Student Loan −$25,000, card −$640) — validates the `bucketFor` fix; spending + cash flow populate |
| Career / Education / Health / Family                       | ✅ load; honest discovery/empty states                                                                                                                                         |
| Life Graph (/life-graph/explainable)                       | ✅ loads                                                                                                                                                                       |
| Recommendations / Reports / Documents / My Life / Settings | ✅ load                                                                                                                                                                        |
| Profile                                                    | ✅ FIXED (was crashing to ErrorBoundary on `stats?.career.title`)                                                                                                              |
| Finance Legacy (estate planning)                           | ✅ untouched, loads                                                                                                                                                            |
| Advisor chat                                               | ✅ UI works (agents, bubbles, input, disclaimer). ⚠️ first turn returned the **discovery/vision opener**, not a direct answer (see punch list)                                 |

## Console errors found → all fixed (commit d1af04a)

- `[Theme Script] Cannot read properties of null (reading 'style')` on **every** page — theme script set `document.body.style` in `<head>` where body is null. Guarded.
- `400` `profiles?select=...full_name,name...` on **every** page — Header selected non-existent columns. Now selects `display_name, avatar_url`.
- `404` `/api/email/accounts` + `/api/calendar/sources` on **every** page — Header fetched routes that didn't exist. Added honest empty-list routes (OAuth integrations pending).
- Profile page crash (`title` of undefined) — optional-chaining fix.

## Remaining console noise

- `403 /api/scenario-lab/pins` (dashboard pin widget) — RLS/grant; widget degrades gracefully. Punch list B.

No fabricated data was shown anywhere; empty states are honest. Screenshot index: `UI_SMOKE_SCREENSHOT_INDEX.md`.
