# Main Merge Report

**Date:** 2026-06-16 · Step 5 of the cutover.

## Merge

- **Source:** `platform/main-consolidation` @ `cb6b172`
- **Target:** `main` (was `4a46e8f`)
- **Merge commit:** `41cf78b05b7234fff69ca4738763feb9128edddb` (`--no-ff`, for a traceable cutover record)
- **Timestamp:** 2026-06-16 17:13:29 -0700
- **Push:** `4a46e8f..41cf78b  main -> main` (origin updated; Vercel production deploy triggered)

## Pre-merge gate (passed)

- `next build` (CI mode) succeeded — route manifest generated.
- Live API smoke 5/5 (healthz, onboarding chat + stream, advisor finance question, health-urgent safety).
- core-api 449 tests, web 1444 tests; zero new tsc errors; prod DB migrations verified present.
- `origin/main` was a strict ancestor of the consolidation branch → no content conflicts at merge.

## What this merge changes in production

- **Frontend (Vercel, on this push):** Arcana streaming UX, `/conversation` + `/dashboard/roadmap/chat` redirects to the real advisor, landing CTA → `/auth?mode=create`, context-aware advice disclaimer, health/education stub deletions + honest empty states.
- **core-api:** no behavioral change — consolidated `main` core-api equals the deployed v115 code (discovery fix already live). The Fly source switch (Step 7) is behavior-neutral.

## Verification pointers

- Web deploy verification → `PRODUCTION_WEB_VERIFICATION.md`
- core-api source switch → `CORE_API_CUTOVER_REPORT.md`
