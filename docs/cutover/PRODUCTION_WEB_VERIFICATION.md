# Production Web Verification

**Date:** 2026-06-16 · Step 6 — verify the Vercel production web deploy after merging to `main`.

## Deploy trigger

Pushing `main` (`4a46e8f..41cf78b`) triggered the Vercel production build for `life-nav-mvp-web` via the GitHub integration.

## Verification — NEW build confirmed live

| Marker           | Before merge (old build) | After deploy (now)             | Meaning                                                                                                   |
| ---------------- | ------------------------ | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `/conversation`  | `200` (scripted chat)    | **`307 → /dashboard/advisor`** | the P0 redirect is live — **definitive proof** the new build is serving                                   |
| Landing CTA href | only `auth?mode=magic`   | `auth?mode=create` present     | the P0 CTA fix is live (a legitimate `mode=magic` link remains elsewhere — the magic-link sign-in option) |
| homepage `/`     | 200                      | **200**                        | site healthy                                                                                              |

A background poll detected the new build live within the deploy window (exit 0 on CTA flip).

## Programmatic smoke (API behavior, live)

- Onboarding `/v1/life/discovery/chat` "Reach financial independence" → conversational (`discovery`), 0 violations.
- Onboarding stream → `ack`+`final`, `discovery`.
- Advisor finance question → handled, no advisor-template contamination.
- Health-urgent → `safety_fallback` (911/ER).

## Honest scope / not covered

- **Human browser smoke not performed** (no Vercel auth, no browser in this environment): visual streaming animation, homepage render fidelity, CTA click-through, graph mouse-navigation, and report-generation UI were **not** clicked through. They are covered by: successful `next build`, 1444 passing web unit tests, and the route-level markers above. **Recommended:** a human 5-minute click-through of production (onboarding → advisor streaming → graph → a report) with Vercel instant-rollback ready.
- **Rollback:** Vercel dashboard → promote previous production deployment (instant), or `git revert 41cf78b` + push.

## Status

Production web deploy **succeeded and is serving the new build** (redirect + CTA markers confirm). Backend behavior verified via API smoke. Visual/browser pass deferred to a human with rollback armed.
