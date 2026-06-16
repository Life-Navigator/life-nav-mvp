# Discovery Deployment State (Step 2)

**Date:** 2026-06-16 · Captured read-only via `flyctl` (no mutations). Source of truth for "what is actually live" before the discovery-mode fix.

## 1. Deploy source

- The Fly app **`lifenavigator-core-api`** is deployed **manually** (`fly deploy` from a local working directory). There is **no CI workflow** that deploys it (`.github/workflows/ci.yml` does not reference it; grep = 0).
- Latest release: **v114, ~4h ago**, by `techavenger83@gmail.com`. Recent history is frequent manual releases today (v108→v114 over ~6h).
- This confirms the consolidation finding: prod tracks a **local branch checkout at deploy time**, not `main` via CI.

## 2. Current commit SHA

- **UNKNOWN (exact git SHA).** The Fly image is built from the `Dockerfile` and carries **no git-SHA label** (`flyctl image show` LABELS column empty). Image: tag `deployment-01KV8V48VHKXN3ZWP52X0HHXSE`, digest `sha256:a2e67e1f1d5420a5692102d63d9f81299d06832b274e206373c89b30303c20e2`.
- **Evidenced lineage:** the live behavior (six-section onboarding output) + the branch evidence (the advisor stack exists only on `origin/advisor/p0-upgrade-2.3.0`) establish the deployed code is on that branch's lineage. The exact commit is not pinned in the image; treat as the advisor branch tip-or-near.

## 3. Runtime env flags (names only — values never viewed)

Secrets set on the app: `ALLOWED_ORIGINS`, `GEMINI_API_KEY`, `NEO4J_*`, `QDRANT_*`, `SUPABASE_*`, `ENVIRONMENT`, `ADMIN_EMAILS`. `[env]` in `fly.toml`: `LOG_LEVEL=info`, `GEMINI_EMBEDDING_MODEL=gemini-embedding-001`, `GEMINI_GENERATION_MODEL=gemini-2.5-flash`.

**Critical observation:** **none** of the advisor/model-orchestration flags are set (no `MODEL_ROUTER_ENABLED`, `GEMINI_PRO_ADVISOR_ENABLED`, `CLAUDE_OPUS_4_8_ENABLED`, `USE_VERTEX_CLAUDE`, `HEALTH_SAFETY_FALLBACK_ENABLED`, `PREMIUM_ROUTING_ENABLED`). Therefore the advisor runs on **code defaults**: model router OFF, premium OFF, Gemini Flash advisor, health-safety net at its default (on). **The hybrid advisor on `/discovery/chat` is NOT flag-gated** — it is the dependency wiring (`get_advisor_orchestrator`). So the fix must change the **route mode/wiring**, not a flag.

## 4. Do `/discovery/chat` and `/stream` hit the same advisor path?

**Yes (confirmed from code on the deployed branch).** Both bind to `get_advisor_orchestrator`:

- `apps/lifenavigator-core-api/app/routers/life.py:84-98` — `discovery_chat` → `svc.converse(...)`.
- `apps/lifenavigator-core-api/app/routers/life.py:100-112` — `discovery_chat_stream` → `svc.converse_stream(...)`.
  Both run the same `AdvisorOrchestrator`; the stream variant adds the `ack`/`final` SSE envelope. The frontend currently proxies the blocking `/discovery/chat` (`apps/web/src/app/api/life/discovery-chat/route.ts`); the `/stream` proxy exists on the streaming branch but not in the deployed-branch web app.

## Summary

Live = `lifenavigator-core-api` v114, manual deploy, advisor-branch lineage, advisor flags unset (defaults: Gemini Flash, router off). Onboarding's `/discovery/chat[/stream]` both run the mode-blind hybrid advisor by **DI wiring** (not a flag). Exact git SHA is UNKNOWN (image not git-labeled); behavior + branch evidence pin the lineage. The fix is a **route-mode change**, safe to make on `platform/discovery-mode-fix` and deploy via the same manual path.
