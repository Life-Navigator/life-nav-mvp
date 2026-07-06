# BETA_USER_JOURNEY_REPORT.md — Part 5

**Date:** 2026-06-04
**Method:** 10 completely fresh users, one per persona, each run through the full beta journey against
production via `apps/web/beta-journey.mjs` (real auth, real activation, real recs, real grounded chat).
Throwaway users deleted after each run.

---

## VERDICT: ✅ 10/10 — FULL JOURNEY PASSES FOR EVERY PERSONA

Every one of the 8 steps succeeded for all 10 personas. This is the first end-to-end proof that a brand-new
invited user can go from a link to a working, grounded chat — exercising every fix from this session
(magic-link auth, persona activation, the $4 budget, and two-layer grounded chat) in one real run.

| Step                       | What it verifies                                                              | Result    |
| -------------------------- | ----------------------------------------------------------------------------- | --------- |
| 1. **invite**              | Supabase invite link → session cookies established                            | **10/10** |
| 2. **onboarding redirect** | new user lands in `/onboarding`                                               | **10/10** |
| 3. **activate persona**    | `POST /api/integrations/plaid/activate-persona` → 200, sets `setup_completed` | **10/10** |
| 4. **dashboard**           | onboarded user reaches `/dashboard` (not bounced)                             | **10/10** |
| 5. **recommendations**     | `GET /api/recommendations` returns ≥1 rec                                     | **10/10** |
| 6. **chat (grounded)**     | `POST /api/agent/chat` returns a real answer (not the fallback)               | **10/10** |
| 7. **logout gate**         | without a session, `/dashboard` bounces to auth                               | **10/10** |
| 8. **return login**        | a fresh magic link re-establishes the session                                 | **10/10** |

**FULL JOURNEY (all 8 steps): 10/10.**

Sample grounded chat (young*professional): *"Here's a summary of your current account balances:
**Assets:** Everyday Checking …"\_ — the activation → grounding chain works end to end (the chat reads the
freshly-activated accounts from the system of record).

---

## Issue found & fixed during the run

**Returning onboarded users landed on `/onboarding`** instead of `/dashboard` (their magic link carried
`next=/onboarding`). Fixed server-side: `/auth/confirm` now sends an already-onboarded user to `/dashboard`
even when `next` points at onboarding (commit `bef99d8`). **Re-verified on the new deploy: still 10/10, and
return login now lands on `/dashboard`** (sample: _"You currently have $3,200.00 in your Everyday
Checking… $4,800.00 \[savings]"_ → `/dashboard`).

---

## No dead ends / blank screens / orphans (Part 3 cross-check)

- **No dead ends:** every step returns a 200 or a _correct_ redirect; the auth gate (step 7) and onboarding
  gate (step 2/4) both behave.
- **No orphaned users:** activation sets `setup_completed=true` atomically with persona data; a user can't
  reach the dashboard half-activated, and a non-activated user is held in onboarding (not lost).
- **No silent chat failure:** chat returns a grounded answer for all 10; the deterministic finance read
  means even if graph promotion lags, balances are still grounded (never a blank or invented answer).

## Notes / non-blocking

- **Activation latency:** persona activation provisions sandbox accounts + persona metadata; it's the
  slowest step (~seconds). Fine for onboarding, worth a progress indicator (Part 7 item).
- **Chat latency** p50 ~6s (the grounded pipeline). Acceptable; streaming would improve perceived speed.
- **Email rate-limit** (no SMTP) is the only thing between this and self-serve signups at scale — covered by
  manual invite for the 20-user beta (see `AUTH_MAGIC_LINK_BETA_REPORT.md`).
