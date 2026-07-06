# Rate Limiting & Quotas

Sprint O.0.2 deliverable.

## Two complementary mechanisms

LifeNavigator's economic-governance layer ships **two** gating
mechanisms, deliberately distinct:

- **RateLimiter** — counts ACTIONS per time. Token-bucket per
  `(scope, owner)`. Enforces "30 chat requests per hour, 100 per
  day". Persisted in `economic.rate_limit_buckets`.
- **QuotaEngine** — enforces SIZE and DURATION caps. "PDF ≤ 50 MB",
  "video ≤ 5 minutes", "500 MB/day total upload". Pure function +
  one query for the daily aggregate.

Both are checked BEFORE the call/upload runs. Both fail closed.

## Internal-beta default policy

### RateLimiter (`BETA_RATE_LIMITS`)

| Scope               | Bucket capacity | Refill / min | Daily cap   | Enabled by default |
| ------------------- | --------------- | ------------ | ----------- | ------------------ |
| `chat`              | 30              | 1            | 100         | ✓                  |
| `upload`            | 5               | 1            | 20          | ✓                  |
| `simulation`        | 5               | 1            | 20          | ✓                  |
| `arcana`            | 5               | 1            | 20          | ✓                  |
| `governance_review` | 60              | 2            | (unbounded) | ✓                  |
| `enterprise_api`    | 50              | 5            | 500         | **disabled**       |

- Bucket capacity is the burst limit per hour.
- Refill replenishes 1 token/minute (60 tokens/hour, equal to capacity).
- The daily cap is a separate counter that resets at midnight UTC.
- `enterprise_api` ships disabled by default — internal beta does NOT
  expose the API platform externally.

### QuotaEngine (`BETA_FILE_LIMITS`)

| Kind                               | Max size | Max pages | Max duration |
| ---------------------------------- | -------- | --------- | ------------ |
| PDF                                | 50 MB    | 250       | —            |
| DOCX                               | 25 MB    | —         | —            |
| XLSX / CSV                         | 25 MB    | —         | —            |
| Audio (mp3/wav/m4a/flac/ogg)       | 100 MB   | —         | 15 min       |
| Video (mp4/mov/webm/avi/mkv)       | 250 MB   | —         | 5 min        |
| Image (png/jpg/jpeg/webp/gif/tiff) | 25 MB    | —         | —            |
| Text (txt/rtf/md/html/json/xml)    | 10 MB    | —         | —            |

Per-user daily upload budget: **500 MB**.

## Where they run

```
/api/ingest/upload  → processUpload(...)
                       ↓
  QuotaEngine.checkFile(file_kind, size, pages, duration)
                       ↓
  QuotaEngine.checkDailyUploadBudget(user, +size)
                       ↓
  RateLimiter.consume('upload', user_id)
                       ↓
  [malware scan / storage / extract / etc]
```

For chat / simulation / arcana the limiter is invoked by the route
handler before the orchestrator runs. Today only the upload path is
wired (Sprint O.0.2 priority); other surfaces have the helper available
and the wiring is queued for the next sprint's Closed-Beta hardening.

## Decisions

```ts
interface ConsumeResult {
  verdict: 'ALLOW' | 'RATE_LIMITED' | 'DAILY_CAP';
  tokens_remaining: number;
  daily_remaining: number | null;
  reset_at: string;
  capacity: number;
  refill_per_minute: number;
}
```

```ts
type QuotaVerdict =
  | { allowed: true }
  | { allowed: false; reason_code: string; client_message: string };
```

The client message is always sanitized (no Postgres internals, no
stack traces).

## Token-bucket math

```
refilled_tokens = min(capacity, current_tokens + elapsed_minutes * refill_per_minute)
```

```
on consume(cost):
  if daily_used + cost > daily_capacity → DAILY_CAP
  elif tokens_remaining < cost          → RATE_LIMITED
  else                                  → ALLOW
                                         tokens_remaining -= cost
                                         daily_used       += cost
```

DAILY_CAP is checked BEFORE the token check — a user who has burned
their entire day's quota gets the more meaningful error code.

## Reset semantics

- Bucket tokens refill continuously at `refill_per_minute`.
- The daily window resets at UTC midnight; the row's
  `daily_window_start` field is rolled forward on the next refill.
- `reset_at` in the consume result is the earliest future time the
  bucket would allow `cost` tokens — useful for client back-off
  display.

## Test coverage

### RateLimiter (15 tests)

- `refillBucket`: refill rate, capacity ceiling, daily window roll.
- `consumeBucket`: ALLOW / RATE_LIMITED / DAILY_CAP including
  daily-cap-before-token-check precedence.
- Async `consume()`: lazy bucket creation, enterprise_api disabled
  by default, exhausted bucket, per-scope capacity differences.

### QuotaEngine (20 tests)

- Per-file size at boundary, above, and below cap for every kind.
- PDF page-count cap.
- Audio + video duration caps.
- Unknown file kinds pass through (the upstream validator gates).
- Daily upload budget: empty history, partial history, exceeded.
- `costDimensionForKind` mapping for every modality.

## Auditability

Every rate-limit denial is observable via the bucket row's
`daily_used` / `tokens_remaining` fields. Per-event audit rows are
not currently written (the volume would be very high); the
AbuseDetector reads the bucket state + recent activity to fire
`prompt_flooding` / `upload_flooding` audit rows when patterns are
abusive.

## Adjustment workflow

Raising or lowering a limit is a two-step process:

1. Update `BETA_RATE_LIMITS` or `BETA_FILE_LIMITS` in
   `lib/economic/types.ts` / `lib/economic/quota-engine.ts`.
2. Update the corresponding test assertion(s).

PR review verifies the change is intentional (test assertion forces
the author to look at the actual number). No DB migration needed
because policy is in code; existing bucket rows are reconciled on the
next refill.

## What this prevents

| Attack                        | Defense                                                |
| ----------------------------- | ------------------------------------------------------ |
| Burst chat requests           | 30/hour token cap; 100/day daily cap                   |
| Bulk uploads                  | 5/hour bucket; 20/day daily cap; 500 MB/day            |
| Oversized media               | Per-kind size cap; per-kind duration cap               |
| Long-form video to drive cost | 5-minute video cap                                     |
| Long audio transcription      | 15-minute audio cap                                    |
| Enterprise-API enumeration    | Disabled by default; explicit operator enable required |

What this does NOT prevent (by itself):

- Co-ordinated attack across N users — see `AbuseDetector` +
  `CircuitBreaker`.
- High-cost small payloads — see `BudgetManager`.
