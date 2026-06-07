# HEALTH & WELLNESS DOMAIN SPEC (Elite buildout, Phase 2)

**Date:** 2026-06-07 · **Status:** DESIGN ONLY. Companion: `HEALTH_WELLNESS_BACKEND_SPEC.md` (medical-safety boundaries — authoritative). Build order: after Finance.

Premium wellness intelligence. **Not** diagnosis, treatment, or prescription. Self-reported lifestyle + habits in beta; labs/vitals/wearables/Arcana later.

---

## 1. Supabase tables (all ➕ missing today — health_meta has only metrics/records/insurance/wearable_connections)

| Table                                  | Purpose                                                                                                                    |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `health_meta.health_profile`           | domain root (1/user): activity_level, dietary_pattern, sleep_target, stress, conditions_self_reported jsonb, consent_flags |
| `health_meta.health_goals`             | wellness goals (metric/target/cadence)                                                                                     |
| `health_meta.wellness_habits`          | habit definitions (or reuse public.habits)                                                                                 |
| `health_meta.activity_logs`            | exercise sessions (modality/duration/intensity)                                                                            |
| `health_meta.sleep_logs`               | hours/quality/bed-wake                                                                                                     |
| `health_meta.nutrition_logs`           | meals/macros/hydration                                                                                                     |
| `health_meta.supplement_logs`          | name/dose/adherence                                                                                                        |
| `health_meta.vitals` (later)           | self-reported vitals                                                                                                       |
| `health_meta.lab_markers` (later)      | lab values — stored, NOT interpreted as diagnosis                                                                          |
| `health_meta.wellness_recommendations` | persisted recs (H contract)                                                                                                |
| `health_meta.provider_notes` (later)   | clinician-facing notes                                                                                                     |
| `health_meta.arcana_referrals` (later) | Arcana hand-off                                                                                                            |

Pattern: migration-116, **sensitivity HIGH**, consent-gated graph promotion, encrypted sensitive fields stripped from embeddings.

## 2. Worker entity types

Present: `health_profile, health_metric, health_milestone, health_alert_event, workout_log, nutrition_log, supplement_log`. **Add:** `sleep_log`, `activity_log` (if distinct from workout_log), `vital`, `lab_marker`, `wellness_recommendation`, `health_goal`. Enum-before-trigger; labels :HealthProfile/:SleepLog/:WorkoutLog/:NutritionLog/:SupplementLog/:Vital/:LabMarker/:WellnessRecommendation.
Relationships: (:UserProfile)-[:HAS_WELLNESS]->(:HealthProfile)-[:LOGGED]->(:SleepLog|:WorkoutLog|:NutritionLog); (:HealthProfile)-[:TARGETS]->(:HealthGoal); (:WellnessRecommendation)-[:ADDRESSES]->(:HealthGoal). Freshness: logs daily, profile on-change.

## 3. Backend endpoints (`domains/health.py`)

```
GET  /v1/health/summary  /goals  /habits  /activity  /sleep  /nutrition  /wellness-score  /recommendations
POST /v1/health/profile  /goal  /habit  /check-in
```

`wellness-score`: server-computed composite (sleep adherence + activity + habit streaks + nutrition logging), with `confidence.basis` reflecting data completeness.

## 4. UI surfaces

Wellness Overview (hero: wellness score, sleep trend, weekly activity, habit streaks, top risk, next move) · Goals · Habits · Sleep · Activity · Nutrition · Supplements · Risk Watch · Progress · Wellness Recommendations. Missing-data → premium intake/connect prompts.

## 5. Recommendations (lifestyle-only, gated)

sleep-hygiene, activity-cadence, hydration, habit-consistency, supplement-adherence-reminder. Every rec carries `escalation = {type:"medical", disclaimer:"general wellness info, not medical advice; consult a physician"}`.

## 6. Boundaries (enforced in `governance/trust_safety.py` — see backend spec §7)

no diagnosis · no treatment/dosing/medication · lifestyle-only recs · mandatory disclaimer + physician-review language · red-flag → emergency/physician escalation (suppress advice) · no lab interpretation as diagnosis · no medication changes · consent-gated ingestion · sensitivity HIGH · personal collection only (never `ln_central`).

## 7. Chat

"How's my sleep trending?" · "Am I hitting my activity goal?" · "What habit should I focus on?" · "What's my wellness score and why?" — all from self-reported logs, with disclaimer; red-flag inputs trigger escalation, not advice.

**Unlock:** flip sidebar "Healthcare" to live only when summary renders real data + boundary gate tests pass.
