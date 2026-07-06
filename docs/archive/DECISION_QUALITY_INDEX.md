# Decision Quality Index

Sprint O deliverable.

## What it measures

The Decision Quality Index (DQI) is a per-user composite in [0, 1]
that answers: **across the window, how good were the decisions this
user made with the platform's help?**

DQI is NOT user satisfaction. It is NOT acceptance rate. It is a
composite that requires recommendations to be safety-compliant,
accepted at a healthy clip, completed at a healthy clip, NOT
reversed, attributed to actual goal progress, character-quality, and
non-destructive to future opportunities.

## Composition

```
DQI = w₁·acceptance_rate
    + w₂·completion_rate
    − w₃·reversal_rate              (subtracted)
    + w₄·avg_effectiveness
    + w₅·avg_character_score
    + w₆·future_preservation_score
```

Default weights (`DQI_WEIGHTS` in `decision-quality-index.ts`):

| Component                 | Weight          | Meaning                                                                            |
| ------------------------- | --------------- | ---------------------------------------------------------------------------------- |
| acceptance_rate           | 0.20            | fraction of recs the user accepted or completed                                    |
| completion_rate           | 0.20            | fraction of recs the user actually completed                                       |
| reversal_rate             | 0.15 (negative) | fraction the user later regretted (dismissed after acceptance OR feedback "worse") |
| avg_effectiveness         | 0.20            | mean per-rec effectiveness score                                                   |
| avg_character_score       | 0.15            | mean character overall score on the rec                                            |
| future_preservation_score | 0.10            | 1 − 0.25·(harming_axes count), averaged                                            |

Total positive weight: 0.85. Reversal subtracts up to 0.15. DQI is
clamped to [0, 1].

## Sub-rates

### Acceptance rate

```
accepted = # of recs in {accepted, completed}
acceptance_rate = accepted / N
```

A user who never accepts a recommendation has acceptance_rate = 0.
A user who accepts everything has acceptance_rate = 1.

### Completion rate

```
completed = # of recs in state 'completed'
completion_rate = completed / N
```

Catches the difference between users who say yes-and-do versus
users who say yes-and-walk-away. Completion is the harder signal.

### Reversal rate

```
reversed = # of recs (dismissed AFTER accept/complete) OR (feedback outcome = 'worse')
reversal_rate = reversed / N
```

The platform doesn't optimize for short-term yeses. A high reversal
rate is evidence that the recommendations are appealing in the
moment but harmful in retrospect — DQI subtracts it.

### Avg effectiveness

The per-recommendation effectiveness score (described in
`OUTCOME_INTELLIGENCE_ARCHITECTURE.md`) is averaged across the
window's recs. Catches small consistent wins that the other rates
miss.

### Avg character score

Average of `character_score_overall` for the user's recs in the
window. A user whose recs consistently meet character-quality
thresholds has a higher DQI than one whose recs barely pass.

### Future preservation score

```
preservation = 1 − 0.25 × |harming_axes|   (clamped to 0)
average = mean(preservation across recs)
```

If 4+ recs harmed any axis on average, preservation goes to 0. The
intent: the platform pays a price (in its own quality score) for
recommendations that close the user's future doors.

## Safety contract

Every input row is filtered through the safety gate FIRST:

```ts
const { dqi, included, excluded_unsafe } = computeDqiSafe({
  user_id,
  window_days,
  rows,
});
```

`excluded_unsafe` is exposed so the operator can audit whether
unsafe recommendations are reaching the user (a non-zero count is a
governance gap worth investigating).

## Worked examples

### Example 1: ideal user

```
20 safe recs over 30 days
18 completed, 2 accepted (90% acceptance, 90% completion)
0 reversed
avg_effectiveness     = 0.75
avg_character_score   = 0.92
future_preservation   = 1.0

DQI = 0.20·0.90 + 0.20·0.90 − 0.15·0 + 0.20·0.75 + 0.15·0.92 + 0.10·1.00
    = 0.18 + 0.18 − 0 + 0.15 + 0.138 + 0.10
    = 0.748 → rounded to 0.748
```

A user with this DQI is using the platform exceptionally well.
Operators don't intervene.

### Example 2: chronic reverser

```
20 safe recs
20 accepted, 15 reversed (acceptance 1.0, reversal 0.75)
avg_effectiveness     = 0.45
avg_character_score   = 0.85
future_preservation   = 0.9

DQI = 0.20·1.0 + 0.20·1.0 − 0.15·0.75 + 0.20·0.45 + 0.15·0.85 + 0.10·0.9
    = 0.20 + 0.20 − 0.1125 + 0.09 + 0.1275 + 0.09
    = 0.615
```

The user is enthusiastic but his decisions don't stick. The platform
should investigate WHY the reversal rate is high — likely a
mismatch between what the user thinks they want and what they
actually pursue. The character score is high (the platform isn't
being slick), so the optimizer should explore more conservative
framings.

### Example 3: passive user

```
20 recs
4 accepted, 0 completed (acceptance 0.20, completion 0)
0 reversed
avg_effectiveness = 0.30 (mostly viewed, not acted on)
avg_character_score = 0.88
future_preservation = 1.0

DQI = 0.20·0.20 + 0.20·0 − 0 + 0.20·0.30 + 0.15·0.88 + 0.10·1.0
    = 0.04 + 0 + 0.06 + 0.132 + 0.10
    = 0.332
```

The user is reading but not acting. DQI captures that. Operators
should look at whether the recommendations are too abstract or too
many to act on.

### Example 4: unsafe-filtered user

```
20 recs in the raw window, 5 excluded by safety gate
15 safe recs evaluated; rest as Example 1.

  dqi.recommendations_evaluated = 15
  excluded_unsafe               = 5  ← surfaced for operator review
```

The DQI itself is clean, but the operator sees the excluded count
and investigates why 5 unsafe recommendations reached the user
(likely a recent regression in guardOutgoing wiring).

## Persistence

```sql
CREATE TABLE outcome.decision_quality_index (
  id                          UUID PRIMARY KEY,
  user_id                     UUID,
  tenant_id                   UUID,
  window_days                 INT,
  dqi_overall                 NUMERIC(4,3),
  acceptance_rate             NUMERIC(4,3),
  completion_rate             NUMERIC(4,3),
  reversal_rate               NUMERIC(4,3),
  avg_effectiveness           NUMERIC(4,3),
  avg_character_score         NUMERIC(4,3),
  future_preservation_score   NUMERIC(4,3),
  recommendations_evaluated   INT,
  metadata                    JSONB,
  computed_at                 TIMESTAMPTZ,
  UNIQUE (user_id, window_days, computed_at)
);
```

RLS owner-read; service-role write. A nightly job computes a fresh
snapshot per active user; the API endpoint at `/api/outcomes/me`
returns the latest.

## Adjusting the weights

The weights are exposed as `DQI_WEIGHTS` for transparency. Changing
them is a code change with a test update. There is no per-tenant
DQI weight knob — DQI is a platform-level definition of what a
"high quality decision" means. Changing it changes the meaning of
the score globally.

## What the DQI does NOT measure

- **Goal completion absent the platform.** If the user makes a great
  decision without using the platform, DQI doesn't see it.
- **User satisfaction.** A user who is angry but is making
  high-quality decisions has a high DQI.
- **Engagement.** Returning to the platform daily does not affect
  DQI directly.

## What to do with the DQI

- **For users**: surface the DQI on the dashboard as one of several
  meaning-of-use indicators. Trend matters more than absolute value.
- **For operators**: identify users with falling DQI for outreach;
  identify the recommendation categories with the largest negative
  contribution.
- **For the optimizer**: input only — never reward function. The
  optimizer must consult character + governance + safety BEFORE the
  DQI, and the DQI alone is not enough to choose between two
  candidate recommendations.

## Test coverage

```
$ npx jest src/lib/outcome-intelligence/__tests__/outcome-intelligence.spec.ts -t computeDqi
PASS — 4 tests
```

Covers empty windows, ideal users, reversers, and the safety-filter
contract.
