# Recommendation Outcome Tracking

Sprint O.0 Phase 6 deliverable.

## Schema

Two tables, both in `public` (deliberately — they are user-readable):

### `public.decision_outcomes`

One row per recommendation. Current state + per-state timestamps + an
operator-assigned outcome score.

```sql
CREATE TABLE public.decision_outcomes (
  id                  UUID PRIMARY KEY,
  recommendation_id   UUID UNIQUE,
  user_id             UUID REFERENCES profiles(id),
  governance_audit_id UUID,
  state               TEXT CHECK (public.is_decision_outcome_state(state)),
  generated_at        TIMESTAMPTZ,
  viewed_at           TIMESTAMPTZ,
  accepted_at         TIMESTAMPTZ,
  ignored_at          TIMESTAMPTZ,
  dismissed_at        TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  outcome_score       NUMERIC(3,2),    -- [0,1]
  user_feedback       TEXT,
  metadata            JSONB,
  updated_at          TIMESTAMPTZ
);
```

### `public.decision_outcome_events`

Append-only transition history. Every state change appends a row.

```sql
CREATE TABLE public.decision_outcome_events (
  id                  UUID PRIMARY KEY,
  decision_outcome_id UUID REFERENCES decision_outcomes(id),
  user_id             UUID REFERENCES profiles(id),
  from_state          TEXT,
  to_state            TEXT,
  metadata            JSONB,
  occurred_at         TIMESTAMPTZ
);
```

RLS: owner-read on both. Owner-update on `decision_outcomes` (for
client-side outcome scoring). Service-role write on both.

## State machine

```
generated → viewed ┬→ accepted ┐
                   ├→ ignored  ├→ completed
                   └→ dismissed┘
```

States move forward only. The helper API enforces this:

- `recordRecommendationGenerated(supabase, refs)` inserts the row with `state='generated'` AND appends the first transition event.
- `transitionOutcome(supabase, refs, 'viewed' | 'accepted' | 'ignored' | 'dismissed' | 'completed', metadata)` updates the state + timestamp + appends a history event.
- `setOutcomeScore(supabase, refs, score, user_feedback)` sets `outcome_score` (rejects `score ∉ [0,1]`).

All three are best-effort: a write failure does not throw.

## Indexes

```sql
idx_do_user_state  ON (user_id, state)
idx_do_state_time  ON (state, updated_at DESC)
idx_doe_decision   ON (decision_outcome_id, occurred_at DESC)
```

## Dashboards (SQL templates)

### Lifecycle funnel for the last 7 days

```sql
SELECT state, COUNT(*) AS n
FROM public.decision_outcomes
WHERE generated_at > NOW() - INTERVAL '7 days'
GROUP BY state
ORDER BY 1;
```

### Time-to-action (median + p95)

```sql
SELECT
  PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM accepted_at - generated_at)) / 60.0 AS median_minutes_to_accept,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM accepted_at - generated_at)) / 60.0 AS p95_minutes_to_accept
FROM public.decision_outcomes
WHERE accepted_at IS NOT NULL AND generated_at > NOW() - INTERVAL '30 days';
```

### Outcome quality

```sql
SELECT
  AVG(outcome_score) AS mean_score,
  COUNT(*) FILTER (WHERE outcome_score >= 0.8) AS high_quality,
  COUNT(*) FILTER (WHERE outcome_score < 0.4) AS low_quality,
  COUNT(*) AS scored
FROM public.decision_outcomes
WHERE outcome_score IS NOT NULL AND generated_at > NOW() - INTERVAL '30 days';
```

### Acceptance rate by emitter

```sql
SELECT
  audit.emitter_agent_name,
  COUNT(*) FILTER (WHERE outcome.state IN ('accepted','completed')) * 1.0 / COUNT(*) AS acceptance_rate,
  COUNT(*) AS total
FROM public.decision_outcomes outcome
JOIN governance.decision_governance_audit audit ON audit.id = outcome.governance_audit_id
WHERE outcome.generated_at > NOW() - INTERVAL '30 days'
GROUP BY audit.emitter_agent_name
ORDER BY acceptance_rate DESC;
```

## How outcomes connect to other systems

```
recommendation route
  ↓
guardOutgoing       → decision_governance_audit (id = G)
  ↓
recordRecommendationGenerated(rec_id, G)
  ↓
decision_outcomes (state=generated, governance_audit_id=G)
  ↓
[client emits view event]
  ↓
recordUserEvent(recommendation_viewed) + transitionOutcome → 'viewed'
  ↓
[user submits feedback]
  ↓
POST /api/feedback/recommendation/quality
  ↓
feedback.recommendation_quality
  + transitionOutcome → 'accepted' | 'dismissed' | 'completed'
  + recordUserEvent
```

The audit chain is now end-to-end: a recommendation's governance
audit row joins to its decision outcome which joins to its feedback
row — one full trace from generation to user-reported outcome.

## Why the lifecycle matters

The original full-system audit scored "Operational" at 4.5 because the
platform had no way to measure whether recommendations actually
improved outcomes. After Sprint O.0:

- Every recommendation has a measurable lifecycle.
- Every state transition is timestamped + auditable.
- Feedback feeds back into the state machine.
- The operator dashboard surfaces the funnel + acceptance rate +
  outcome score distribution in one view (`/api/ops/dashboard`).

This is the foundation the Sprint Q+ outcome-intelligence engine will
build on.
