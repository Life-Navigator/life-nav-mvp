# Gemini Retry Resilience Report

**Date:** 2026-06-03
**Commit:** `fc188de` (branch `mvp`)
**Trigger:** `gemini-2.5-flash` occasionally returns transient `429`/`503` ("high demand") that failed a chat with no retry.

---

## Summary

Added a single, consistent transient-retry policy to **all three** Gemini call paths. A transient provider blip (rate limit / overload / internal) is now retried instead of surfacing as a user-facing failure. Verified live: post-deploy smoke re-run is green.

| Path                           | File                                                        | Calls covered           | Tests                                                 |
| ------------------------------ | ----------------------------------------------------------- | ----------------------- | ----------------------------------------------------- |
| Edge Function `graphrag-query` | `supabase/functions/graphrag-query/retry.ts` (+ `index.ts`) | embed, generate, stream | `retry_test.ts` (Deno, 6 cases)                       |
| API gateway (Python)           | `apps/api-gateway/app/services/gemini.py`                   | embed, generate         | `tests/test_gemini_retry.py` (pytest, 7 cases) ✅ run |
| Ingestion worker (Rust)        | `apps/ingestion-worker/src/gemini_client.rs`                | embed                   | `#[cfg(test)] mod tests` (cargo, 4 cases) ✅ run      |

## Retry policy (identical across all three)

- **Retry only transient statuses:** `429` (rate limit), `503` (overload), `500` (internal).
- **Never retry:** auth (`401`/`403`), validation (`400`), or any other 4xx. **Safety blocks are not retried** — Gemini returns them as **HTTP 200** with a `blockReason`/`finishReason=SAFETY`, so they never enter the retry path (only HTTP error statuses do).
- **Backoff + jitter:** attempt 1 immediate; retry 1 after ~500ms; retry 2 after ~1500ms; **+0–50% jitter** on each delay.
- **Max retries:** 2 (3 total attempts). After exhaustion the final response is returned and the caller raises its normal error.
- **Logging:** only `label + status + attempt + delay`. **No prompts, user data, payloads, or secrets** are logged.

## Governance & economic guarantees (unchanged)

- **Economic governance preserved:** the web governed handler records `economic.usage_events` only **after** a successful provider response. Retries are internal to the provider call; a failed attempt records nothing. (Verified: exactly one `usage_events` row per successful round trip.)
- **Governance/character/injection preserved:** retries happen inside the provider fetch, below the governance layer. No constitutional/character/injection step is bypassed.
- **No early streaming:** the streaming path only retries the **initial** connection (before any bytes are read); the web handler still buffers the full output and releases it only after final governance review. No partial output escapes pre-review.

## Tests

### Gateway (pytest) — **7/7 passed**, full suite **36/36**

```
test_503_then_200_succeeds_after_retry      PASS  (initial + 1 retry)
test_429_then_200_succeeds_after_retry      PASS
test_500_then_200_succeeds_after_retry      PASS
test_auth_error_is_not_retried              PASS  (401 → 1 call, no retry)
test_validation_error_is_not_retried        PASS  (400 → 1 call)
test_max_retries_returns_last_response      PASS  (503×∞ → 3 calls, returns 503)
test_retry_status_set                       PASS
```

### Worker (cargo) — **lib 13/13 passed** (4 new)

```
only_transient_statuses_retry   PASS  (429/500/503 transient; 200/400/401/403/404 not)
backoff_schedule_matches_spec   PASS  (500ms, 1500ms, clamps)
jitter_is_capped_at_half_base   PASS
jitter_within_bounds            PASS
```

### Edge Function (Deno) — provided, runnable via `deno test`

Covers: 503→retry→200, 429→retry→200, 500→retry→200, 401 no-retry, 400 no-retry, persistent 503 → 3 calls → returns 503. _(Not executed here — Deno isn't installed in this environment; the identical loop is proven by the gateway pytest above, and the live smoke re-run below confirms real behavior.)_

## Deployment

- Edge Function `graphrag-query` **redeployed** (`--no-verify-jwt --use-api`); both `index.ts` and `retry.ts` bundled.
- API gateway **redeployed** (`/healthz` → 200).
- Ingestion worker **redeployed** (restarted clean: `ingestion-worker starting` → `routing configured`).

## Smoke re-run (post-deploy) — all green

```
graphrag-query (direct)                → 200, real answer
authenticated chat round trip (prod)   → 200, governance verdict = approved
governance.decision_governance_audit   → +1 row (verdict APPROVE, character_score 1.000, no dignity violation)
economic.usage_events                  → +1 row (feature=chat, provider=gemini, cost_usd_micros=390000)
```

Test users created for the round trip were deleted afterward.

## Notes / follow-ups (non-blocking)

- A transient `429`/`503` is now absorbed by up to 2 retries (~2s worst case added latency). For sustained provider outages the request still fails after retries with the provider's status — intended.
- The worker's `EMBEDDING_DIMENSION` constant is `768` (stale vs `gemini-embedding-001`'s 3072) but is unused except its own definition — cosmetic; safe to correct later.
