# MODEL_BRANCH_DEPLOYMENT_PLAN.md — Phase 7

## The branch reality (from project memory + this sprint)

- **Current working branch:** `fix/dashboard-advisor-mode-and-floating-chat` — holds all this sprint's work (advisor intelligence fixes, finance fixes, model-auth/ADC) across commits `2081f50`, `2cdc138`, plus the audit docs.
- **Production advisor deploy branch (referenced):** `advisor/p0-upgrade-2.3.0`. Per memory ([[core-api-branch-divergence]]), the live core-api has historically deployed from this branch, and `origin/main` was ~66 commits behind and lacked the advisor stack — so deploying core-api from `main` was a landmine.
- **`main` is the production source of truth** and should become the single deploy source.

## Risk

Deploying the model-auth fix from an old branch, or to a `main` that lacks the advisor stack, reintroduces drift: the runtime could run a different model/auth than what was tested here. That is exactly the "drifted into a weaker fallback" failure this sprint exists to kill.

## Plan (no deploy without explicit approval)

1. **Do not deploy from `advisor/p0-upgrade-2.3.0`.** Treat it as legacy.
2. **Reconcile to `main`:** open a PR from `fix/dashboard-advisor-mode-and-floating-chat` → `main` containing the three sprints (advisor intelligence, finance rendering, model-auth/ADC). Confirm `main` already contains the advisor stack (`advisor_orchestrator/llm/validator/context`); if not, this PR must bring the full, current stack so `main` is complete.
3. **Verify diff vs the live branch:** `git diff advisor/p0-upgrade-2.3.0..HEAD -- apps/lifenavigator-core-api/app/services/advisor_*` to confirm no live-only changes are lost in the reconciliation.
4. **Deploy core-api from `main`** after the merge, with the Vertex env set (`MODEL_PROVIDER=vertex`, `VERTEX_PROJECT`, region, SA). Confirm `requirements.txt` (now incl. `google-auth`, `requests`) is what the Fly image builds.
5. **Post-deploy proof:** one advisor call → response shows `provider=vertex_gemini`, `model=gemini-2.5-pro`; `flyctl logs` shows no `advisor_model_fallback` warnings. (Phase 8.)
6. **Retire** `advisor/p0-upgrade-2.3.0` once `main` is confirmed live and ahead.

## Approvals required before any deploy

- Owner confirms `main` is the intended deploy source and the reconciliation PR is acceptable.
- Owner has completed the ADC step and granted the deploy SA `roles/aiplatform.user`.

## Status: planned, NOT executed (no deploy performed; no branch deleted).
