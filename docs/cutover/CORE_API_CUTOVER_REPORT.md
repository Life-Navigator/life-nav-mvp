# Core-API Cutover Report

**Date:** 2026-06-16 · Step 7 — switch the core-api deploy source to `main`.

## Action

- Checked out `main` (`41cf78b`) and ran `flyctl deploy -a lifenavigator-core-api --remote-only` **from `main`**.
- This establishes `main` as the deploy source (Fly deploys from the operator's checkout; deploying from `main` is the switch).

## Result

- **New release: v116** (complete, ~53s after deploy), machines reached good state, smoke checks passed, DNS verified.
- `https://lifenavigator-core-api.fly.dev/healthz` → **200** (~0.22s).
- **Behavior-neutral:** consolidated `main` core-api code == the prior v115 code (the discovery fix was already live). No routing, prompt, or behavior change.

## Post-deploy verification (from-main core-api)

- Discovery still conversational (`llm_status=discovery`, 0 contract violations).
- Advisor route functioning (200, no advisor-template contamination).
- Health-urgent safety fallback functioning (`llm_status=safety_fallback`, 911/ER text).

## Source-of-truth state

- **Before:** core-api deployed from `advisor/p0-upgrade-2.3.0` (`cbd6954`, v115).
- **After:** core-api deployed from `main` (`41cf78b`, v116).
- Rollback: `flyctl releases rollback` to v115, or redeploy from `advisor/p0-upgrade-2.3.0` (identical code).
