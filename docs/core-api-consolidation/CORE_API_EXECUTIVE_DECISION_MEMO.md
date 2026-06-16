# Core-API Consolidation — Executive Decision Memo

**Date:** 2026-06-16 · Evidence-only audit (no changes made). Companion docs: `CORE_API_INVENTORY.md`, `CORE_API_ROUTE_MAP.md`, `CORE_API_DIVERGENCE_REPORT.md`, `ONBOARDING_REMOTE_ROOT_CAUSE.md`, `CORE_API_VALUABLE_ASSETS.md`, `CORE_API_DECOMMISSION_PLAN.md`, `CORE_API_MIGRATION_PLAN.md`.

## Correction to the prior forensic audit (intellectual honesty)

The earlier onboarding forensics concluded the advisor code was in a _"separate repo not available locally."_ **That was wrong.** Further git investigation proved the code is **in this monorepo**, on branch `origin/advisor/p0-upgrade-2.3.0`, deployed to the Fly app `lifenavigator-core-api` from this repo. `origin/main` is simply **66 commits behind**. The forensics were right that the behavior is **not** on `main`, **not** the frontend's fault, and **not** caused by the recent P0/streaming work — but the "separate repo" framing is corrected here.

## The 10 questions

1. **Is the separate core-api still needed?** There is **no separate** core-api — it is part of this monorepo and is **permanently required** (serves 43 frontend `/v1` proxies). What is "separate" is only the **deployment branch**.
2. **What valuable code exists only there?** The entire **advisor stack** (`advisor_orchestrator/llm/context/math/validator`), **model registry/router**, `pilot_service`, `life_graph_workspace`, `pdf_renderer`, the DI wiring, and **deployed-only migrations** (`160_advisor_turns.sql`, pilot routing) — all ABSENT on `main`, PRESENT on the deployed branch (`CORE_API_VALUABLE_ASSETS.md`).
3. **What harmful code exists there?** None that should be deleted. The single defect is **mis-wiring**, not bad code: `/discovery/chat[/stream]` runs the **mode-blind** advisor orchestrator, applying a consultant 6-section prompt + disclaimer to onboarding.
4. **What duplicated code exists?** The discovery brains are **divergent, not duplicated**: `relationship_manager.py` (conversational, on both, differs) vs the advisor orchestrator (deployed-only). `main.py` and `relationship_manager.py` are the only files that changed on both → PORT-on-merge.
5. **What caused the onboarding issue?** Proven, in-repo on the deployed branch: `routers/life.py:84-112` binds `/discovery/chat` + `/discovery/chat/stream` to `get_advisor_orchestrator` (`dependencies.py:268-327`); the orchestrator's `_enhance` overwrites the conversational reply (`advisor_orchestrator.py:291`) and `_compose` (`:87`, headers `:115/119/123/127`) renders the six sections from the LLM prompt (`advisor_llm.py:46-69,148-174`); a disclaimer is appended (`advisor_orchestrator.py:140-142`); the primary objective is injected as a confirmed fact with confidence dropped (`advisor_context.py:322-323`). **No discovery/onboarding mode flag exists** — the prompt is mode-blind.
6. **What should be migrated?** Bring `main` up to the deployed branch (whole core-api delta) — `CORE_API_MIGRATION_PLAN.md` P0-1/P0-2. Every diverging area classifies **B (deployed newer → migrate into main)**.
7. **What should be deleted?** Nothing at the code level now. Post-consolidation: stale/duplicate branches (P2).
8. **Can we safely retire it before pilot?** The **service** cannot be retired (it is the backend). The **off-`main` deployment** can be retired once `main` is consolidated + migrations applied + a `main` deploy is behavior-verified (`CORE_API_DECOMMISSION_PLAN.md` criteria).
9. **Safest consolidation path?** (a) apply deployed-only migrations; (b) merge `origin/advisor/p0-upgrade-2.3.0` → `main` (resolve `relationship_manager.py`/`main.py`); (c) fix the discovery-mode defect (flagged); (d) deploy core-api **from `main`** and smoke-test; (e) reconcile the tangled feature branches; (f) set deploy-from-`main` to prevent recurrence.
10. **Pilot risk if we leave it deployed as-is?** **Onboarding stays broken** (consultant wall instead of conversation; assumptions stated as fact; disclaimer during discovery) — directly damaging with the exact pilot audience. **Plus a latent landmine:** any deploy from `main` (e.g., a routine CI deploy) would **silently regress** onboarding to the rule-based path _and_ break the advisor stack (missing `advisor_turns` table). The divergence itself is a release-safety hazard.

## Final verdict

### MIGRATE_THEN_RETIRE

Precisely: **migrate** the deployed branch's core-api into `main` (it's a strict superset), **fix the discovery-mode mis-wiring**, then **retire the off-`main` deployment practice** by making `main` the single deploy source. The core-api **service itself is not retired** — it is essential. There is no standalone repo/Fly app/DNS to tear down (`CORE_API_DECOMMISSION_PLAN.md`).

> Not `RETIRE_NOW` (the service is load-bearing; nothing to tear down). Not `KEEP_TEMPORARILY` (leaving the divergence is an active onboarding defect + a deploy landmine). Not `UNKNOWN_NEEDS_ACCESS` (the code is fully present in-repo on the deployed branch; the only true UNKNOWNs are the exact live Fly commit + runtime flag values, which need `flyctl status`).

## Single highest-confidence root cause (one sentence)

Onboarding is broken because `/v1/life/discovery/chat[/stream]` on the deployed branch is wired to a **mode-blind hybrid advisor orchestrator** that overwrites the conversational `RelationshipManager` reply and renders a benchmark-optimized six-section consultant response (with disclaimer and objective-as-fact), and `origin/main` — which still wires that route to the conversational `RelationshipManager` — is 66 commits behind and not what's deployed.
