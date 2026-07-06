# Circuit Breaker Architecture

Sprint O.0.2 deliverable.

## What a circuit breaker is

A circuit breaker is a state machine per FEATURE that decides whether
to let calls through. It has three states:

```
       ┌─────────────────────────────────────┐
       │  CLOSED   (normal — calls pass)     │
       └──────┬──────────────────────────────┘
              │ failure_count ≥ threshold
              ▼
       ┌──────────────────────────────────────┐
       │  OPEN     (degraded — calls are     │
       │            queued / disabled /      │
       │            redirected per feature)  │
       └──────┬──────────────────────────────┘
              │ retry_at elapsed
              ▼
       ┌──────────────────────────────────────┐
       │  HALF_OPEN (one trial call allowed) │
       └──────┬──────────────────────────────┘
              │ trial succeeds        trial fails
              ▼                       ▼
            CLOSED                  OPEN
```

## Why we need them

Without breakers, a transient outage in a downstream provider (Gemini
returning 503s, OpenAI rate-limiting us, network blip to Anthropic)
becomes a budget-burning event — every call retries, every retry
counts as a cost, every cost row triggers more budget gates.

With breakers, after N failures the breaker opens; subsequent calls
are short-circuited to a non-cost-incurring path (degrade /
queue / disable) until the downstream comes back.

## Per-feature default action

When the breaker is OPEN, the verdict depends on the feature:

| Feature              | Open action | Why                                                                                                                                                                     |
| -------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `provider.gemini`    | DEGRADE     | Try the next provider in the BYOM resolution chain.                                                                                                                     |
| `provider.openai`    | DEGRADE     | Same.                                                                                                                                                                   |
| `provider.anthropic` | DEGRADE     | Same.                                                                                                                                                                   |
| `upload.vision`      | DISABLED    | OCR is non-critical; surface "Try again later."                                                                                                                         |
| `upload.speech`      | DISABLED    | Same.                                                                                                                                                                   |
| `upload.video`       | DISABLED    | Same.                                                                                                                                                                   |
| `chat`               | QUEUE       | Hold the user's message in client-side draft state; retry on next interaction.                                                                                          |
| `enterprise_api`     | DISABLED    | API customers get a 503 — better than burning their budget on a known-broken provider.                                                                                  |
| `governance_review`  | **PASS**    | Governance MUST NEVER break. Even if the underlying retrieval is failing, we proceed with `retrieval_ok = false` and the deterministic engine still produces a verdict. |

## Triggers

A breaker can be opened in three ways:

1. **Automatic failure count.** Every `recordOutcome('failure')` call
   increments `failure_count`. When it hits the threshold (default 5)
   the breaker opens.
2. **Force-open by AbuseDetector.** A CRITICAL `api_abuse` finding
   calls `forceOpen('provider.<x>', 'api_abuse', 'DISABLED')`.
3. **Force-open by BudgetManager.** Platform-budget HARD_STOP opens
   `provider.gemini` / `provider.openai` / `provider.anthropic` to
   stop the bleeding.

## Recovery

Recovery is automatic via the half-open trial:

1. The breaker is OPEN with `retry_at = now + retry_ms`.
2. After `retry_at` elapses, the next `evaluate()` call transitions
   the breaker to HALF_OPEN and lets the call through.
3. The call's outcome is recorded:
   - Success → breaker closes, `failure_count` resets to 0.
   - Failure → breaker re-opens with a fresh `retry_at`.

Default `retry_ms = 60_000` (1 minute). Operators can override per
feature via the `retry_ms` parameter of `recordOutcome` or via
`forceOpen`.

## Storage

`economic.circuit_breakers` — one row per feature.

```sql
CREATE TABLE economic.circuit_breakers (
  id                  UUID,
  feature             TEXT UNIQUE,
  state               TEXT,                -- CLOSED | HALF_OPEN | OPEN
  trigger_reason      TEXT,
  failure_count       INT,
  failure_threshold   INT DEFAULT 5,
  opened_at           TIMESTAMPTZ,
  retry_at            TIMESTAMPTZ,
  open_action         TEXT,                -- degrade | queue | disabled | shutdown
  operator_override   BOOLEAN,
  metadata            JSONB,
  updated_at          TIMESTAMPTZ
);
```

RLS: service-role only. Operators inspect via the dashboard.

## Operator override

`operator_override = TRUE` keeps the breaker open even if the
auto-recovery wants to close it. Used for manually disabling a
feature for maintenance.

The override does NOT bypass the breaker — it pins the state. To
re-enable, the operator sets `operator_override = FALSE` and either
calls `reset()` or waits for the next half-open trial.

## API

```ts
// Pre-call gate:
const { verdict, state } = await evaluateBreaker({ supabase, feature: 'provider.gemini' });
if (verdict === 'DEGRADE') return tryNextProvider();
if (verdict === 'DISABLED') return safeApiError({ code: 'upstream_unavailable' });
// PASS or QUEUE → proceed
```

```ts
// Post-call outcome recording:
try {
  const r = await provider.callChat({ messages });
  await recordOutcome({ supabase, feature: 'provider.gemini', outcome: 'success' });
} catch (e) {
  await recordOutcome({
    supabase,
    feature: 'provider.gemini',
    outcome: 'failure',
    reason: String(e),
  });
  throw e;
}
```

## Test coverage

11 tests in `circuit-breaker.spec.ts`:

- CLOSED returns PASS.
- OPEN with future retry_at returns the correct per-feature action.
- OPEN past retry_at transitions to HALF_OPEN + PASS.
- upload.vision OPEN → DISABLED.
- governance_review OPEN → PASS (the invariant).
- 4 failures stay CLOSED; 5th failure OPENs.
- Success in HALF_OPEN closes; reset clears.
- `forceOpen` flips state immediately.

## Composition with other layers

```
Request arrives
  ↓
RateLimiter.consume    → DENY if RATE_LIMITED
  ↓
QuotaEngine.checkFile  → DENY if file too large
  ↓
CircuitBreaker.evaluate(feature)
   PASS  → continue
   DEGRADE  → fallback provider
   QUEUE    → queue + 202 to client
   DISABLED → 503 + safe message
  ↓
BudgetManager.evaluate(estimated cost)
   ALLOW    → continue
   WARN     → continue + flag
   THROTTLE → 429
   BLOCK    → 402 (payment-required equivalent)
   HARD_STOP→ 503 + alert
  ↓
ProviderCall
  ↓
recordOutcome → recordUsage (or recordOutcome failure)
```

## What this does NOT do

- **Per-tenant breakers.** Today the feature key is global. A bad
  Gemini incident affects every tenant. Per-tenant breakers (e.g.
  one tenant's BYOM credential is rate-limited) are queued for
  Sprint Q+.
- **Cascading breakers.** When `provider.gemini` opens, `chat` does
  not automatically also open. Each breaker is independent.
- **Provider-specific failure differentiation.** A 429 (rate limited)
  and a 503 (server down) both count as a failure today. The detector
  could be more discriminating — out of scope this sprint.
