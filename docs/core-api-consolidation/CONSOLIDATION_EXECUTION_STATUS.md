# Consolidation Execution Status

**Date:** 2026-06-16 · **Branch:** `platform/main-consolidation` (pushed). Source-of-truth consolidation — executed up to the production-cutover gate.

## Done (safe, reversible)

| Step                                                                 | Result                                                                                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Branch from `origin/main` → fast-forward to **production truth**     | `platform/main-consolidation` = advisor stack + discovery fix + 6 migrations (tip was `cbd6954`)                                                       |
| Layer **Arcana streaming** (cherry-pick `f98a21f`)                   | clean, commit `68cad15`                                                                                                                                |
| Layer **P0 pilot blockers** (cherry-pick `a1b25da`, stale-main base) | resolved 4 conflicts by hand, commit `8753aff`                                                                                                         |
| **DB migrations**                                                    | verified present in prod (read-only): `analytics.advisor_turns`, `analytics.model_usage`, `analytics.pilot_feedback`, `life.candidate_goals` all EXIST |

### Conflict resolutions (P0 cherry-pick)

- `roadmap/chat/page.tsx` → took the P0 redirect.
- `Sidebar.tsx` → kept HEAD (the advisor branch already replaced the off-brand promo with a proper account footer; P0's removal was already done, better). `ArrowRightIcon` correctly absent.
- `chat/page.tsx` → kept **both** `StreamingText` and the `AdviceDisclaimer` import + mount.
- `advisor/page.tsx` → kept the **streaming** version (structurally current) **and** re-added the `AdviceDisclaimer` mount below the message scroll. Both features now coexist.

> `platform/pilot-p0-blockers` was **not merged** (it's 69 commits behind on stale main; a merge would have deleted the entire advisor stack — 546 files / −101,711). Only its single P0 commit was cherry-picked.

## Verification

- **core-api:** `pytest` → **449 passed** (incl. the 7 discovery-mode tests).
- **web:** `jest` → **1444 passed**; 10 failures in 4 **pre-existing** suites (`proxy`, `auth-flows`, `LoginForm`, `RegisterForm`) that fail identically on clean `main` — **zero new failures**.
- **tsc:** 15 errors, all pre-existing in untouched files (finance/investments, lifeGraph/\*, MotionSection) — **zero introduced**.

## The cutover gate (NOT done — needs your go)

The remaining steps are user-facing and hard-to-reverse, so they are gated:

1. **Open a PR** for `platform/main-consolidation` → Vercel auto-builds a **preview** (this is the "staging/preview" step). Smoke the web on the preview: onboarding (conversational), Arcana streaming, `/conversation` + roadmap redirects, CTA fixes, advice disclaimer.
2. **Merge to `main`.** ⚠️ This triggers a **Vercel production web deploy** (streaming UX + P0 web changes + redirects go live to users). It also makes `main` deployable for core-api.
3. **Set Fly core-api deploy source to `main`** and deploy from `main` (core-api content already equals live v115, so this is behavior-neutral for the API) — retires the off-`main` deploy practice.

### Why gated

Merging to `main` auto-deploys the **frontend** to production via Vercel. The web changes (streaming, P0 blockers, redirects) have unit-test coverage but have **not** been smoke-tested in a live browser. Recommend smoking the **PR preview** first, then merging.

## Status

**CONSOLIDATION_READY — MAIN_CUTOVER_GATED.** The branch is built, fully tested, and DB-verified. Awaiting go for the PR-preview smoke → merge-to-main → Fly-source switch. Rollback for the eventual merge: revert the merge commit (frontend) + redeploy v114 image (core-api) if needed.
