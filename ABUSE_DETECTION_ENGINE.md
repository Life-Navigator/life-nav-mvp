# Abuse Detection Engine

Sprint O.0.2 deliverable.

## Position

The abuse detector is the LAST line of defense before the platform
budget feels real damage. Rate limits + quotas stop the first
egregious patterns; the abuse detector catches the more subtle ones:

- Many small calls that don't trip a rate limit but burn budget over
  time.
- Scripts that retry the same request as if it failed.
- Users who burn tokens efficiently — high tokens-per-call without
  flooding requests.
- Genuine automation traffic.

## Seven detection categories

| Kind              | Threshold                                         | Action   | Severity |
| ----------------- | ------------------------------------------------- | -------- | -------- |
| `prompt_flooding` | ≥ 60 chat messages / hour                         | THROTTLE | HIGH     |
| `upload_flooding` | ≥ 20 uploads / hour                               | THROTTLE | HIGH     |
| `cost_farming`    | ≥ $1.00 / hour cost                               | BLOCK    | HIGH     |
| `automation`      | ≥ 100 distinct requests / hour OR bot_score ≥ 0.8 | REVIEW   | MODERATE |
| `retry_abuse`     | ≥ 10 retries of the same request_id in 5 min      | WARN     | MODERATE |
| `token_burn`      | ≥ 500 000 tokens / hour                           | THROTTLE | HIGH     |
| `api_abuse`       | ≥ $10 / day cost                                  | BLOCK    | CRITICAL |

Actions are AT-LEAST guarantees. A user hitting multiple categories
sees the WORST action across them.

## How the signal is gathered

`gatherSignals(supabase, user_id)` reads from three tables:

- `economic.usage_events` — cost in last 1h / 24h, tokens, distinct
  request_ids, retry counts (same request_id in last 5min).
- `ingestion.files` — uploads in last 1h / 24h.
- `analytics.user_events` — chat-message proxy (we treat
  `recommendation_generated` as the chat signal).

The function is pure-await — every read is wrapped in try/catch and
returns 0 on failure (fail-open at the read; the BudgetManager is the
fallback).

## Scoring

`scoreAbuse(signal)` returns ALL findings that fire (not just the
first). Callers pick the worst action via:

```ts
const findings = scoreAbuse(signal);
const worst = findings.reduce(
  (a, f) => (SEVERITY[f.severity] > SEVERITY[a.severity] ? f : a),
  findings[0]
);
```

Each finding carries its evidence — the specific counters that
fired — so the audit row in `economic.abuse_events` is
self-explanatory.

## Persistence

Every finding writes a row to `economic.abuse_events` via
`persistAbuseFindings`. Row contents:

```sql
CREATE TABLE economic.abuse_events (
  id            UUID,
  user_id       UUID,
  tenant_id     UUID,
  kind          TEXT,   -- one of the 7 categories
  action_taken  TEXT,   -- WARN | THROTTLE | BLOCK | REVIEW
  signal        JSONB,  -- which counters fired
  feature       TEXT,
  severity      TEXT,   -- LOW | MODERATE | HIGH | CRITICAL
  resolved_at   TIMESTAMPTZ,
  metadata      JSONB,
  created_at    TIMESTAMPTZ
);
```

RLS: owner-read (user can see their own findings), service-role-write.

## Operator workflow

The Economic Governance Dashboard (`/api/ops/economic-dashboard`)
surfaces `active_throttles` and `active_blocks` counts. Drilling
down (out of scope for this sprint) would let an operator:

1. See the top abuse-event rows in the last hour.
2. Review the underlying signal.
3. Resolve the event (set `resolved_at`) after triaging.
4. Optionally raise the user's budget (operator override) if it was a
   legitimate burst.

## Why these thresholds

The numbers are calibrated against the internal-beta cost target:

- `prompt_flooding` 60/hr — well above the rate-limit's 30/hr (the
  rate limit already enforces). The abuse detector exists to catch
  USERS WHO ROUTE AROUND the rate limit (multiple sessions, etc.).
- `cost_farming` $1/hr — a heavy user might legitimately spend $0.10/hr;
  $1/hr sustained is 10× too high.
- `api_abuse` $10/day — a user that hits this is on track to single-
  handedly exhaust 2% of the platform monthly cap in a day. Block,
  audit, ask.
- `token_burn` 500k — a sustained ~140 tokens/sec; effectively a
  programmatic loop.

## Test coverage

13 tests in `abuse-detector.spec.ts`:

- Each of the 7 categories fires at threshold + doesn't fire below.
- Severity + action assignments correct.
- Composite signals produce multiple findings.

## What the detector does NOT do

Listed transparently:

- **Cross-user collusion detection.** Two users coordinating an
  attack wouldn't trigger an individual-user threshold. Mitigation:
  the platform-budget gate catches the aggregate damage even if no
  single user looks abusive.
- **IP / fingerprint correlation.** Abuse signals are per-user. A
  user account opened to abuse the platform would still hit the
  individual-account threshold.
- **Live blocking decisions.** The detector PRODUCES findings + a
  recommended action; runtime callers must consult the recommendation
  and take the action. Today the upload pipeline doesn't yet read
  abuse-event rows (Closed Beta task) — the BudgetManager + rate
  limiter cover the front-line defense.

## Wiring roadmap

Today:

- `gatherSignals` + `scoreAbuse` + `persistAbuseFindings` exist as
  helpers.
- No runtime path actively scores abuse on every request — that
  would add an N-query round-trip to every call.

Closed Beta:

- A background job runs `gatherSignals + scoreAbuse` every 5 minutes
  for users with non-trivial recent activity, and persists findings.
- The BudgetManager reads `economic.abuse_events.resolved_at IS NULL`
  for each user as an additional gate (a user with an unresolved
  BLOCK-action finding is automatically denied).

Until then, the detector is documented and unit-tested but not in
the hot path — and the rate limiter + budget manager carry the
defense.
