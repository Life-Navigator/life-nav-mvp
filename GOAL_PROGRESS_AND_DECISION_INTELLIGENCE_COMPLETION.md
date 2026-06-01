# Goal Progress + Decision Intelligence Completion — Implementation

LifeNavigator's Decision Intelligence System is now complete. The
system can answer all six questions from the sprint brief:

| Question                                   | Where it's answered                                                                                        |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Did this recommendation work?              | `recommendation_quality_metrics`, `recommendation_accuracy`, `decision_outcomes`                           |
| How much did it move the user's root goal? | `goal_progress_snapshots`, `goal_progress_events`, `goal_progress_scores`, `goal_progress_predictions`     |
| Which domains contributed?                 | `cross_domain_impacts`, `outcome_attributions`                                                             |
| How accurate was our confidence?           | `prediction_calibration`, `advisor_accuracy` (Brier score + ECE + Confidence-Accuracy Gap)                 |
| Which pathways historically perform best?  | `goal_pathway_effectiveness` (personal + global cohort)                                                    |
| How should future recommendations improve? | `confidence_calibrated`, `historical_effectiveness`, `supporting_evidence` on every `RecommendationOutput` |

No new UI. No new dashboards. No onboarding changes. Intelligence layer only.

## What shipped

| Phase                      | Deliverable                                                            | Location                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1 Goal Progress            | 4 tables + service + 8 tests                                           | `goal_progress_{snapshots,events,scores,predictions}`, `lib/decision/goal-progress-service.ts`                                       |
| 2 Cross-Domain Attribution | 2 tables + service + 8 tests                                           | `cross_domain_impacts`, `outcome_attributions`, `lib/decision/cross-domain-attribution-service.ts`                                   |
| 3 Confidence Calibration   | 3 tables + Brier + ECE + curve + 17 tests                              | `prediction_calibration`, `recommendation_accuracy`, `advisor_accuracy`, `lib/decision/calibration-service.ts`                       |
| 4 Recommendation Quality   | 1 table + service + 7 tests                                            | `recommendation_quality_metrics`, `lib/decision/recommendation-quality-service.ts`                                                   |
| 5 Pathway Effectiveness    | 1 table + signature/label/pick + 9 tests                               | `goal_pathway_effectiveness`, same TS file as phase 4                                                                                |
| 6 GraphRAG sync            | Trigger + Rust entity types + Person→entity edges + 3 Rust tests       | `decision_intelligence.trigger_decision_intel_sync()`, `ingestion-worker/src/entities.rs`, `tests/decision_intelligence_entities.rs` |
| 7 Advisor upgrade          | `reason()` extended; 5 transparency fields populated                   | `lib/advisor/advisor-reasoning-service.ts`                                                                                           |
| 8 Transparency             | 5 new `RecommendationOutput` fields; guard expanded; 6 invariant tests | `types/advisor.ts`, `lib/decision/personal-learning-profile.ts`, `lib/decision/__tests__/protected-keys-invariants.test.ts`          |

## Verification

| Check                                               | Status                                                                 |
| --------------------------------------------------- | ---------------------------------------------------------------------- |
| Rust `cargo test`                                   | **36 / 36** (was 33; +3 `decision_intelligence_entities`)              |
| Rust `cargo fmt --check`                            | clean                                                                  |
| Rust `cargo clippy --all-targets -- -D warnings`    | clean                                                                  |
| Rust `cargo build --release --bin ingestion-worker` | clean                                                                  |
| Web `tsc --noEmit -p tsconfig.json`                 | clean                                                                  |
| Web jest                                            | **373 / 373** (was 316; +57)                                           |
| Migration 080 self-test                             | embedded DO block raises if RLS missing on any of the 11 tables        |
| `verify_080_decision_intelligence_rls.sql`          | sweeps all 11 tables + global pathway visibility + 2 write-as-B blocks |

---

## Phase 1 — Goal Progress Engine

### Tables

```
decision_intelligence.
  goal_progress_snapshots     -- point-in-time {score, confidence, source, inputs}
  goal_progress_events        -- {event_type, delta, decision_id?, outcome_id?, reason}
  goal_progress_scores        -- period rollup {period, period_start, score, delta, events_count}
  goal_progress_predictions   -- {target_date, predicted_score, confidence, model_version}
                                 + post-hoc validated_at / validation_score / validation_error
```

All four tables have strict owner-only RLS + service_role escape + a
public read-view + an `updated_at` trigger. The schema mirrors the
sprint's stated chain:

```
Goal → Decision → Outcome → Goal Progress
                              │
                              ▼
                    snapshot + event + score + prediction
```

### Service — `GoalProgressService`

```ts
scoreGoalProgress({ previous_score, decisions, outcomes, supporting_goals?, required_clear_fraction? })
  → { goal_progress_delta, goal_progress_score, confidence, reasoning }
```

Update rule (pure, no I/O):

```
contribution_outcomes = mean(sign(delta_pct) × accuracy_score)     // directional & weighted
contribution_supports = min(0.4, sum(cumulative_strength) / n)     // capped to avoid double-count
contribution_required = 0.3 × required_clear_fraction

new_score = clamp01( previous_score
                   + 0.4 × contribution_outcomes
                   + contribution_supports
                   + contribution_required )
```

Persistence helpers: `recordSnapshot`, `recordEvent`, `rollUpScore`
(UPSERT on `(user_id, goal_id, period, period_start)`),
`recordPrediction`, `validatePrediction` (sets `validated_at`,
`validation_score`, `validation_error = |actual − predicted|`).

**Tests (8):** clamp invariants, no-input baseline, positive vs negative
outcome direction, supporting-goal cap at 0.4, required clearance cap at
0.3, clamping to `[0,1]`, multi-line reasoning, confidence grows with
more signals.

---

## Phase 2 — Cross-Domain Outcome Attribution

### Tables

```
cross_domain_impacts   -- (source_domain, target_domain, label, strength, confidence, evidence)
                         label ∈ {CONTRIBUTED_TO, INFLUENCED, ACCELERATED,
                                   DELAYED, BLOCKED, SUPPORTED}
outcome_attributions   -- (outcome_id, attributed_to_decision_id?, attributed_to_action_id?,
                          attribution_share, confidence, reasoning)
```

`is_attribution_label()` CHECK enforces the 6-label enum. Supported
domains (per spec): `financial · career · education · health ·
insurance · benefits · estate · entrepreneurship · family ·
cross_domain`.

### Service — `CrossDomainAttributionService`

```ts
recordCrossDomainImpact(supabase, {source_domain, target_domain, label, strength, confidence, ...})
recordOutcomeAttribution(supabase, {outcome_id, attributed_to_action_id?, attribution_share, ...})
normalizeAttributionShares(attributions)            // pure — scales total to ≤ 1
traverseImpactChain({start_domain, ...}, edges, {max_depth?})  // BFS, depth-limited
```

The chain traversal returns `{ nodes, edges, max_depth_reached }`,
where each node carries `cumulative_strength` (product of edge
strengths along the best path) and `via_labels[]`. Example:

```
Health → Career (CONTRIBUTED_TO, 0.6) → Financial (INFLUENCED, 0.7)
   cumulative_strength on Financial = 0.42, via [CONTRIBUTED_TO, INFLUENCED]
```

**Tests (8):** normalization for empty / sum≤1 / sum>1; classic 3-hop
traversal; depth limit respected; multi-path picks stronger
cumulative_strength; BLOCKED edges still traverse so the caller can
warn.

---

## Phase 3 — Confidence Calibration

### Tables

```
prediction_calibration  -- (predicted_confidence, predicted_value?,
                            actual_correct?, actual_value?, bucket, source_*, validated_at)
recommendation_accuracy -- per-action: (predicted_strength, predicted_confidence,
                                         observed_outcome_quality, accuracy_score)
advisor_accuracy        -- per-advisor-run: (total_actions, mean_predicted_confidence,
                                              mean_observed_outcome_quality, brier_score,
                                              calibration_error, confidence_accuracy_gap)
```

### Service — `CalibrationService`

```ts
brierScore(predictions)                       → number ∈ [0,1]
computeCalibrationCurve(predictions, bins=10) → { brier_score, calibration_error,
                                                  confidence_accuracy_gap, bins[], n }
calibrateConfidence(predicted, curve, {min_support?=5}) → number
buildCurveFromHistory(validated_history)      → CalibrationCurve

recordCalibration(supabase, ...)              → PredictionCalibration
snapshotAdvisorAccuracy(supabase, ...)        → AdvisorAccuracy
```

**Math:**

- Brier = `mean((predicted − actual)²)`. 0 perfect, 1 worst.
- Expected Calibration Error = `sum_i (n_i / N) · |mean_pred_i − mean_actual_i|` (weighted by bin size).
- Confidence-Accuracy Gap = `mean(predicted) − mean(actual)`; positive = overconfident.
- `calibrateConfidence` looks up the bin matching the input; if the
  bin has ≥ `min_support` observations it uses `bin.mean_actual`,
  otherwise falls back to subtracting the global gap (clamped to `[0,1]`).

**Tests (17):** Brier perfect / 0.5 / worst / empty; ECE near 0 for
calibrated, > 0.3 for overconfident, negative gap for underconfident;
bucket label format; `p=1.0` lands in last bin; `calibrateConfidence`
honors `min_support`, uses bin mean when supported, falls back to gap
subtraction, clamps to `[0,1]`; `buildCurveFromHistory` excludes
unvalidated rows.

---

## Phase 4 — Recommendation Quality Engine

### Table

```
recommendation_quality_metrics
  (period, period_start, recommendation_type, domain, root_goal_id, advisor_run_id,
   total, accepted, rejected, modified, deferred, completed, abandoned,
   success_rate, completion_rate, mean_outcome_quality, mean_user_satisfaction)
```

Unique per `(user_id, period, period_start, recommendation_type, domain, root_goal_id)`.

### Service — `RecommendationQualityService`

```ts
aggregateRecommendationQuality(rows, { period, period_window_start, recommendation_type, domain, root_goal_id?, advisor_run_id? })
  → QualityAggregate
persistRecommendationQuality(supabase, userId, agg) → RecommendationQualityMetric
```

Pure aggregation:

```
success_rate    = completed / (accepted + completed + abandoned + modified)
completion_rate = completed / max(1, total)
mean_outcome_quality / mean_user_satisfaction = mean over completed rows only
```

**Tests (4 in `recommendation-quality-service.test.ts`):** empty input;
success_rate uses accepted-family denominator; completion_rate uses
total denominator; means computed only over completed rows.

---

## Phase 5 — Goal Pathway Effectiveness

### Table

```
goal_pathway_effectiveness
  (user_id NULL = cohort,
   root_goal_concept, pathway_signature, pathway_label, pathway_edges,
   sample_size, success_count, success_rate, completion_rate,
   mean_duration_months, confidence)
```

RLS: owner sees own + everyone sees `user_id IS NULL` (global cohort) +
service_role full access.

### Service — `PathwayEffectivenessService`

```ts
pathwaySignature(pathway)        → sha1(label:target | ...).slice(0,16)
pathwayLabelFor(pathway)         → "Supports + Prerequisite For pathway"
persistPathwayEffectiveness(...)
loadPathwayEffectiveness(user_id, root_goal_concept, signature?)
pickBestEffectiveness(rows)      → personal preferred; within personal, highest success_rate
```

**Tests (5 in same file):** signature stability + order-sensitivity;
empty pathway has deterministic signature; label includes top labels;
`pickBestEffectiveness` prefers personal over global; within personal
picks highest success_rate.

---

## Phase 6 — GraphRAG Integration

Migration 080 wires a single `decision_intelligence.trigger_decision_intel_sync()`
trigger function across all eleven tables. The function:

1. Maps `TG_TABLE_NAME` → `entity_type` (e.g. `goal_progress_snapshots`
   → `goal_progress_snapshot`).
2. Strips `metadata`, `created_at`, `updated_at`, `user_id` from the
   payload (already on the queue row).
3. Routes `goal_pathway_effectiveness` rows with `user_id IS NULL`
   through `enqueue_central_sync()` so they land in the central
   Qdrant collection + central Neo4j database. Everything else routes
   personal.

### Rust worker — new entity coverage

Added eleven `EntityType` variants in
`apps/ingestion-worker/src/entities.rs`:

```
GoalProgressSnapshot · GoalProgressEvent · GoalProgressScore · GoalProgressPrediction
CrossDomainImpact   · OutcomeAttribution
PredictionCalibration · RecommendationAccuracy · AdvisorAccuracy · RecommendationQualityMetric
PathwayEffectiveness
```

Each gets:

- `as_str()` mapping.
- `domain()` mapping: `goal_progress`, `attribution`, `calibration`.
- `relationships_for()` Person → entity edge labels matching the
  sprint's required labels: `HAS_GOAL_PROGRESS_SNAPSHOT`,
  `GOAL_PROGRESS_EVENT`, `HAS_GOAL_PROGRESS_SCORE`,
  `PREDICTED_GOAL_PROGRESS`, `CROSS_DOMAIN_IMPACT`,
  `ATTRIBUTED_OUTCOME`, `CALIBRATION_OBSERVATION`,
  `RECOMMENDATION_ACCURACY`, `ADVISOR_ACCURACY_SNAPSHOT`,
  `RECOMMENDATION_QUALITY_METRIC`, `EFFECTIVE_PATHWAY`.
- A `build_summary` block that names the fields that should appear in
  the embedded text (so retrieval can match on "Brier", "calibration
  error", "success rate", "pathway label", etc.).

**Rust tests (3 in `tests/decision_intelligence_entities.rs`):**

```
✓ every_new_entity_type_parses
✓ every_new_entity_type_emits_a_named_person_edge
✓ every_new_entity_type_produces_a_non_empty_summary
```

---

## Phase 7 — Advisor Reasoning Upgrade

`AdvisorReasoningService.reason()` now augments its output by reading
the new tables via a single best-effort helper, `loadDecisionIntelligence`:

| Pulled                                                                                    | Used for                                                                |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Latest `goal_progress_snapshots` for the root goal                                        | `goal_progress_impact.score_before`                                     |
| Sum of `expected_strength` across required_actions × snap confidence × 0.05 (capped ±0.3) | projected `score_after` and `delta`                                     |
| Validated `prediction_calibration` history (last 500)                                     | `confidence_calibrated` via `calibrateConfidence(rawConfidence, curve)` |
| `goal_pathway_effectiveness` matching `(root_goal_concept, pathway_signature)`            | `historical_effectiveness` (personal preferred, otherwise cohort)       |
| Action-attached `related_central_entity_ids` + the effectiveness row                      | `supporting_evidence` array                                             |

The deterministic core (root_goal, supporting_goals, blocked_goals,
required_actions, recommended_sequence, confidence_score, tradeoffs,
timeline, risks, assumptions, cross_domain_impacts, pathway,
simulation_summary) is unchanged. All 8 new fields are optional;
existing callers see no breaking change.

---

## Phase 8 — Transparency Contract

`RecommendationOutput` now carries five new optional fields:

```ts
{
  pathway_label?: string,
  goal_progress_impact?: { score_before, score_after, delta, confidence },
  confidence_calibrated?: number,
  supporting_evidence?: Array<{
    kind: 'central_ontology' | 'personal_history' | 'pathway_effectiveness' | 'recommendation_quality',
    label: string,
    central_entity_id?: string,
    citation_reference?: string,
    confidence: number,
  }>,
  historical_effectiveness?: {
    pathway_label, sample_size, success_rate?, completion_rate?,
    mean_duration_months?, confidence?,
    scope: 'personal' | 'cohort',
  },
}
```

### Guard expansion

Both guards from the previous sprint have been extended to cover all
five new fields:

1. **`PersonalLearningProfile.applyToRecommendation`** —
   `PROTECTED_KEYS` includes:

   ```
   root_goal, supporting_goals, blocked_goals, confidence_score,
   tradeoffs, risks, assumptions, cross_domain_impacts, pathway, simulation_summary,
   pathway_label, goal_progress_impact, confidence_calibrated,
   supporting_evidence, historical_effectiveness
   ```

   Any forbidden mutation is reverted to the pre-effect snapshot and
   recorded in `rejected_mutations`.

2. **`AdvisorConversationAgent.sanitizeLlmOutput`** — the LLM whitelist
   accepts ONLY `ask.question`, `ask.why`, `explain.text`,
   `propose.summary`. The new RecommendationOutput fields are
   automatically protected because the LLM cannot emit `propose.pathway_label`
   or any other subkey of `propose`.

### Transparency-invariant tests (6 in `protected-keys-invariants.test.ts`)

```
✓ pathway_label survives apply()
✓ goal_progress_impact survives apply()
✓ confidence_calibrated survives apply()
✓ supporting_evidence survives apply()
✓ historical_effectiveness survives apply()
✓ all five new fields are byte-identical after the most aggressive learning profile
```

### Before vs After example

The sprint's worked example:

> **Before:**
>
> > "Pay off debt."
>
> **After:**
>
> > "Historically, users with a profile similar to yours achieved your
> > root goal faster by increasing income first and reducing utilization
> > below 10% before accelerating debt payoff."

is reachable today: the `historical_effectiveness` field carries the
pathway label + sample size + success rate ("Income Growth First, n=42,
71%") sourced from `goal_pathway_effectiveness`, and
`supporting_evidence` carries the central-ontology citations
(`Credit Utilization < 30% INCREASES FICO Score INCREASES_PROBABILITY_OF
Conventional 30-Year Fixed Mortgage`, all sourced from CFPB per
migration 078). The conversation agent's `LlmExplainer` is free to
phrase this into a paragraph; the structure underneath is
deterministic and surfaced verbatim in `deterministic_recommendation`.

---

## Apply + verify runbook

```bash
# 1. Apply the migration
psql "$DATABASE_URL" -f supabase/migrations/080_goal_progress_and_attribution.sql

# 2. Verify RLS isolation + write-as-other-user blocks
psql "$DATABASE_URL" -f scripts/validation/verify_080_decision_intelligence_rls.sql

# 3. Tests
pnpm --filter @life-navigator/web test \
  --testPathPattern='goal-progress|cross-domain|calibration|recommendation-quality|protected-keys-invariants|advisor-reasoning|personal-learning'

cd apps/ingestion-worker
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

Expected: migration applies cleanly, self-test passes; RLS verifier
prints `ALL PASS`; jest 373/373; cargo 36/36; fmt + clippy silent.

---

## What this sprint did NOT do

- ❌ No new dashboards (per spec).
- ❌ No new UI components (per spec).
- ❌ No new onboarding flow.
- ❌ No Arcana wiring — spec explicitly defers it: _"Do not begin
  Arcana integration until this sprint is complete and validated."_
- ❌ No automatic outcome attribution worker — the surfaces are ready
  but the attribution logic (e.g., "Income went up after the user
  finished Law School") still requires a human / cron seed. The pure
  helpers (`recordOutcomeAttribution`, `recordCrossDomainImpact`,
  `traverseImpactChain`) are in place; the policy that decides _when_
  to call them is a follow-up.
- ❌ No scheduled cohort effectiveness aggregation — global
  `goal_pathway_effectiveness` rows must be seeded by an offline job.
  The shape (`user_id IS NULL`, public read policy) is ready.

These are intentional carry-overs and are documented in the file map
above so the next sprint knows where to slot them.
