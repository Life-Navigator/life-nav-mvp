# ADVISOR_RELEASE_HARDENING_REPORT.md — 2026-06-25

## Items 1–4: DONE + deployed + verified live

### 1. Live advisor LLM-path regression (`apps/web/scripts/advisor-live-regression.mjs`)

Logs into the DEPLOYED web app, POSTs to `/api/chat/advisor`, and **hard-fails (exit 1)** if the advisor
falls back for an infrastructure reason. It would have caught the Fly-socket outage.

- HARD gates: `provider_called===true`, `model`+`provider` present, `fallback_cause` ∉
  {infrastructure_auth, provider_timeout, provider_error, malformed_output}, `llm_status !== fallback:unavailable`,
  `latency_ms>0`. Content trust-spine/policy fallbacks PASS (the LLM ran; the gate did its job).
- **Live result:** `enhanced` · provider=`vertex_gemini` · model=`gemini-2.5-pro` · provider_called=`true` ·
  fallback_cause=none · latency=44s · **PASS**.
- Run: `SMOKE_EMAIL=… SMOKE_PASSWORD=… node apps/web/scripts/advisor-live-regression.mjs`

### 2. Fallback observability (`advisor_orchestrator.classify_fallback_cause` + enriched log)

Every `advisor_turn` log now carries: `request_id`(=turn_id), `user`, `tenant_id`, `environment`,
`route_path`, `domain`, `agent`, `provider_called`, `auth_token_available`, `provider`, `model`,
`fallback_cause`, `gate_that_blocked`, `llm_last_error`, `repair_attempts`, `latency_ms`, `stages_ms`.
`advisor_llm.last_error` distinguishes auth vs timeout vs malformed. **Distinguishable causes:**
`infrastructure_auth · provider_timeout · provider_error · malformed_output · trust_spine_block ·
policy_safety_gate · unsupported_relationship · repair_loop_exhausted · safety_gate`.
(New fields are log-only; kept OUT of the persisted advisor_turns row to avoid schema drift.)

### 3. Cause-aware fallback copy

- trust-spine $ block → "I won't put an exact dollar figure on that yet — that needs your verified income,
  savings, and monthly expenses. Share those (or connect accounts) and I'll run the real math…"
- monthly-payment block → names rate+term as the missing inputs.
- safety/policy gate → "…I can lay out the considerations, a checklist, and the questions for the right
  licensed professional."
- infra/timeout → "I hit a brief issue reaching my reasoning engine… try again."
- else → forward value-first copy. The bare "grounded answer" copy is no longer the default.

### 4. Latency-aware routing tiers (`select_route_path`)

`fast` (trivial conversational) · `standard` · `supervised` (finance/health/numeric/cross-domain/legal-adjacent).
Selected deterministically, **logged** (`route_path`), and tunes ONLY the repair budget (fast skips the repair
loop; standard/supervised keep 2 attempts). **Safety/validation is identical across tiers** — high-risk turns
always run the full supervised path. Constraint honored: no safety reduction for finance/health.

## Tests

698 core-api tests + 12 new `test_release_hardening.py` (classifier + route-tier) pass. The fallback-copy
behavior-change updated 5 hybrid tests (safety properties preserved: no leaked number, no diagnosis, fallback
status intact).

## Constraints honored

Trust spine unchanged (no fabricated $); safety gates intact; routing never lowers safety; live web path
verified (not a root shell); changes summarized per commit.

## Files

advisor_orchestrator.py, advisor_llm.py, send-server.ts, tests/test_release_hardening.py,
tests/test_advisor_hybrid.py, apps/web/scripts/advisor-live-regression.mjs.
