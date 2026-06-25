# FINAL_DEMO_READINESS_REPORT.md — 2026-06-25

## Go / No-Go: **CONDITIONAL GO — fix email auth, then invite 5 (not 20)**

The app itself is in good shape: build is clean, all surfaces load authenticated, data is honest (no fabrication), the crash is fixed, and finance is consistent. The **one true launch blocker is magic-link email delivery** — beta users cannot self-onboard without it, and (per your own rule) a broken login is the worst first impression. Everything else is polish that can happen during the beta.

## What was hardened this sprint

| Priority              | Result                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1 — Build/type safety | **0 tsc errors** (was 18, fixed properly, no `any`/suppressions); eslint 0 errors; `next build` passes with full typecheck   |
| 2 — Finance routing   | `/dashboard/finance` → `/dashboard/finance/overview` verified live; nav points direct; legacy estate untouched               |
| 3 — Logged-in smoke   | All surfaces load; profile crash fixed; 3 global console errors (theme/400/404) fixed; finance validated empty AND with data |
| 4 — Email auth        | App side correct (PKCE `/auth/confirm`); **server side blocked** — needs Supabase SMTP→Resend (see below)                    |
| 5 — Punch list        | below                                                                                                                        |

## Commits (all on `main`)

- `9d75034` clean all 18 tsc errors
- `d1af04a` theme/profile/Header/route fixes from the smoke
- (earlier this session) finance redirect, domain-scoped advisor CTA, finance-dashboard liability/label fixes, supervised advisor loop

## Punch list

### A — MUST fix before inviting beta users

1. **Magic-link email delivery.** App requests `signInWithOtp → /auth/confirm` correctly; emails are sent by **Supabase Auth SMTP**, which I cannot read/set without credentials. Provide **(a) Supabase Management API PAT** and/or **(b) Resend API key + confirmation `lifenavigator.tech` sender domain is verified**, and I will: set custom SMTP to Resend, add prod redirect URLs (`/auth/confirm`, `/auth/callback`, `/auth/password-reset`) to the allow-list, and test delivery to two non-founder inboxes.
2. **Onboarding-complete reliability.** The founder account had real data but `onboarding_completed=false`, so it was trapped redirecting to `/onboarding/financial-profile`. Confirm the persona→advisor→dashboard flow reliably sets the flag, or beta users get stuck in an onboarding loop. (`/api/onboarding/advisor-complete` is the only writer.)
3. **Advisor answers, not just intake.** In the web chat, a fresh-context user's first turn returned the discovery/vision opener instead of a direct answer (the supervised answer-first path validated in-machine uses `mode="advisor"`). Verify beta users get counsel, not a deflecting question, on substantive asks.

### B — Should fix during beta

- **Enable typecheck in CI:** `next.config` has `typescript.ignoreBuildErrors: !!process.env.CI` → Vercel currently skips typechecking. Now that main is at 0 errors, flip it off so regressions can't ship silently.
- `403 /api/scenario-lab/pins` dashboard widget (RLS/grant).
- Dashboard greets with raw email; set/display `display_name`.

### C — Can wait

- Investment Performance time-series (no source yet — copy already honest).
- 50 eslint `exhaustive-deps`/`no-head-element` warnings.
- `force-dark-mode.js` vs `theme-script.ts` coordination.

## Recommended path

Fix email (A1) → smoke a real magic-link login end-to-end → invite **5** seeded users (founder, family, finance-heavy, education/career, sparse) → fix what they surface → invite the next 15.
