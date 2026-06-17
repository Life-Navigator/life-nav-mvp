# Premium Model Posture

**Date:** 2026-06-16 · **Scope:** clarifies what models are live, proven, and gated for the 20-person pilot. No premium routing is enabled in this sprint.

> **Where this is enforced:** the model registry/router/flags live in the **deployed `lifenavigator-core-api` service** (its own repo, on Fly), not in this web monorepo branch. This web PR contains **no premium-model enablement** and cannot enable one — the frontend never calls an LLM directly (the Gemini/Vertex keys are backend-only). This document is the operational posture; the kill switches below are core-api environment flags.

## What is enabled today (pilot default)

- **Advisor LLM:** Gemini (Flash-class) via the hybrid advisor (`advisor-hybrid` prompt line) behind the model-agnostic **trust spine** (number-gate validator + deterministic math verifier + advice-scope gate).
- **Deterministic health-safety net:** **ON by default** (`HEALTH_SAFETY_FALLBACK_ENABLED=true`). Urgent-care messages (chest pain, stroke, suicidal ideation, etc.) get an immediate, deterministic 911/ER/988 response _before_ any model call. This is the one always-on safety behavior.
- **Selective model router:** **OFF** (`MODEL_ROUTER_ENABLED=false`). With it off, every turn uses the single default advisor LLM — no per-domain routing, no premium selection.

## What is benchmark-proven

- **Gemini 2.5 Pro** clears the advisor quality gate (≈7.60, above the 7.5 bar). It is the intended **default advisor when enabled** (`GEMINI_PRO_ADVISOR_ENABLED`).
- **Claude Opus 4.8** is validated as best-in-class for **Finance** (≈8.82) and **Health** (≈8.88), with 0 fallbacks and acceptable latency (p50 ≈25s). It is **not** required for career/education/family.
- The trust spine is proven **model-independent** — it caught frontier-model (raw Claude) number fabrications in benchmarking. Swapping models does not weaken the safety guarantees.

## What is gated (NOT live)

- **Premium routing** (`PREMIUM_ROUTING_ENABLED=false`) and **Opus 4.8** (`CLAUDE_OPUS_4_8_ENABLED=false`) are OFF.
- **Reason it's gated:** Vertex Anthropic (Opus) auth currently relies on a short-lived gcloud access token (~1h TTL). That is **not durable enough for production**. Broad Opus routing must wait for a **Vertex service-account with automatic token refresh**.
- **Usage limits ledger** (`MODEL_USAGE_LIMITS_ENABLED=false`) — the per-plan premium-usage ledger is not enforced yet (in-memory only).

## What must be true before Opus routes go live

1. **Durable Vertex auth:** a service account with auto-refreshing credentials (no expiring gcloud token) wired into the core-api.
2. **Usage ledger enforced:** `MODEL_USAGE_LIMITS_ENABLED=true` with a DB-backed ledger, so premium spend is capped per plan.
3. **Cost guardrails confirmed:** Opus ≈ $0.15/turn vs Flash ≈ $0.003 — the daily budget cap and prepaid-credit balance must be verified before broad enablement.
4. **Then** flip, in order: `GEMINI_PRO_ADVISOR_ENABLED=true` (default advisor → Pro) → `MODEL_ROUTER_ENABLED=true` → `PREMIUM_ROUTING_ENABLED=true` + `CLAUDE_OPUS_4_8_ENABLED=true` (Opus for finance/health high-stakes only).

## Flags that control it (core-api env)

| Flag                             | Pilot default | Effect                                                       |
| -------------------------------- | ------------- | ------------------------------------------------------------ |
| `HEALTH_SAFETY_FALLBACK_ENABLED` | **true**      | deterministic urgent-care safety net before any model call   |
| `MODEL_ROUTER_ENABLED`           | false         | per-turn domain/risk/tier routing (off → single default LLM) |
| `GEMINI_PRO_ADVISOR_ENABLED`     | false         | makes Gemini 2.5 Pro the default advisor                     |
| `PREMIUM_ROUTING_ENABLED`        | false         | allows premium models for eligible tiers                     |
| `CLAUDE_OPUS_4_8_ENABLED`        | false         | enables Opus 4.8 for finance/health high-stakes              |
| `MODEL_USAGE_LIMITS_ENABLED`     | false         | enforces per-plan premium usage caps                         |

All default **off-and-safe** except the health-safety net.

## User tiers eligible for premium

- Tiers: `free`, `plus`, `premium`, `enterprise`.
- **Opus / premium routing is `premium`- and `enterprise`-only** by design (in the registry's per-role tier list). `free`/`plus` never reach a premium model even when premium routing is later enabled.

## Posture summary for the pilot

**Gemini-only, router off, health-safety on, premium gated.** This is intentional: it is the lowest-risk, lowest-cost, fully-validated configuration. Opus stays off until durable Vertex service-account auth + the usage ledger are in place. Nothing in this PR changes that.
