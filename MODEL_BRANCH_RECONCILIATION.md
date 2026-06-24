# MODEL_BRANCH_RECONCILIATION.md — Phase 1

## State (verified)

- **Current branch:** `fix/dashboard-advisor-mode-and-floating-chat` — now **pushed** to origin (`5a7bcc3..4d27fcb`). The work is no longer local-only.
- **Ahead of origin/main:** 15 commits. **Behind main: 0.** → a **clean fast-forward** to main, **no conflicts**.
- **Diff vs main:** 122 files, +10,159 / −125.
- **main already has the advisor stack** (`advisor_orchestrator.py` present) — the old divergence (memory: "main 66 behind, lacked advisor stack") is **resolved**; main has caught up, and this branch builds linearly on it.
- **Deploy sources:** Vercel (web) auto-deploys from **main**; Fly (core-api) deploys **manually** via `flyctl deploy` (no auto-deploy from main).

## What's in the 15 commits (all tested, 646 pass)

Instant-impact docs · advisor root-cause audits · advisor+finance fixes · Vertex ADC path · model-auth docs · advisor policy (3-tier finance gate, health regex, answer-first) · derivation verifier upgrade · Claude benchmark + access docs · max_tokens fix · Opus hybrid (flag-gated, off).

## Rules honored

- No stale-branch deploy (nothing deployed yet).
- No commits lost (pushed to origin).
- No squash (full audit history preserved).
- main remains production source of truth — merge is a clean FF when approved.

## Recommended reconciliation

1. Open PR `fix/dashboard-advisor-mode-and-floating-chat` → `main` (clean FF). Review the 122-file diff (mostly docs + the advisor/finance code).
2. **Caution:** merging to main will trigger a **Vercel web prod deploy** (finance-rendering changes ship). That's desired but is an outward action — do it knowingly.
3. core-api (Fly) deploy is separate and **blocked on the service-account prerequisite** (GEMINI_BASELINE_DEPLOY_PLAN.md).
