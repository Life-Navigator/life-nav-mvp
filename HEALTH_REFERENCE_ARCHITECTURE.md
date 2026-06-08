# HEALTH REFERENCE ARCHITECTURE

Health & Wellness designed as a **fill-in** of the DOMAIN_FRAMEWORK — no new architecture.
Architecture only; **no implementation, no migrations, no code** in this pass. Read with
DOMAIN_FRAMEWORK, RECOMMENDATION_FRAMEWORK, and HEALTH_GOVERNANCE_STANDARD.

## 1. Schema layer (`health` schema)

| Table                    | Key columns                                                | Sensitivity |
| ------------------------ | ---------------------------------------------------------- | ----------- |
| `health_profile`         | dob_year, sex_at_birth, height, baseline notes             | High        |
| `health_goals`           | title, goal_type, target_metric, target_value, target_date | Medium      |
| `wellness_habits`        | name, cadence, streak                                      | Low         |
| `nutrition_logs`         | logged_at, calories, protein, carbs, fat, notes            | Medium      |
| `workout_logs`           | logged_at, modality, duration_min, intensity, load         | Medium      |
| `sleep_logs`             | night_of, total_hours, efficiency, awakenings              | Medium      |
| `supplement_logs`        | logged_at, name, dose, unit                                | Medium      |
| `lab_markers`            | observed_at, marker, value, unit, reference_range          | **High**    |
| `vitals`                 | observed_at, kind (hr/bp/spo2/temp), value                 | **High**    |
| `body_metrics`           | observed_at, weight, body_fat_pct, waist                   | Medium      |
| `health_recommendations` | (standard RECOMMENDATION_FRAMEWORK shape)                  | Medium      |

All tables: 116-RLS (owner-ALL + service-ALL), `security_invoker` views, **no triggers** in the
table migration. `lab_markers`/`vitals` carry sensitive medical data — High sensitivity, and
they are **evidence inputs only**, never the basis for diagnosis (see governance).

## 2. Worker layer (EntityType variants — enum-before-trigger)

`HealthProfile, HealthGoal, WellnessHabit, NutritionLog, WorkoutLog, SleepLog, SupplementLog,
LabMarker, Vital, BodyMetric, HealthRecommendation` (several already exist in the enum). Each
gets `as_str`, `domain()="health"`, `sensitivity()` (LabMarker/Vital = High), title + summary.

## 3. Ontology layer (`incoming_edges` additions)

```
HealthProfile      ─ user HAS_HEALTH_PROFILE
HealthGoal         ─ user HAS_HEALTH_GOAL
WellnessHabit      ─ user HAS_WELLNESS
SleepLog/WorkoutLog/NutritionLog/SupplementLog ─ user LOGGED
Vital/BodyMetric   ─ user TRACKS_METRIC
LabMarker          ─ user HAS_LAB_MARKER
HealthRecommendation ─ user HAS_RECOMMENDATION   (inherits the evidence fan-out)
```

Inter-entity (when FK present): `SleepLog -[:SUPPORTS_HEALTH_GOAL]-> HealthGoal`,
`Vital -[:TRACKS_METRIC]-> HealthGoal`. No `RELATED_TO` for mapped types.

## 4. Core API layer

`HealthService(DomainService)` — `summary` (sleep avg, activity streak, recent vitals — absent
= null, never fake 0), `chat_context`, `recommendations`, `persist_recommendations`. Router
`/v1/health/*`; register in `DomainRegistry` (live only after gates pass).

## 5. Recommendation layer — evidence graph (mapped to RECOMMENDATION_FRAMEWORK)

**Example: "Improve your sleep"**

```
(:UserProfile)-[:HAS_RECOMMENDATION]->(:HealthRecommendation {type:"improve_sleep"})
  -[:HAS_EVIDENCE]->   (:Evidence {metric_name:"avg_sleep_hours", metric_value:5.7,
                                   source_table:"health.sleep_logs", observed_at:…, confidence:0.8,
                                   explanation:"14-night average"})
  -[:HAS_EVIDENCE]->   (:Evidence {metric_name:"target_sleep_hours", metric_value:7.5,
                                   source_table:"policy", confidence:1.0})
  -[:HAS_ASSUMPTION]-> (:Assumption {assumption_text:"wearable sleep data is accurate",
                                     confidence:0.7, user_confirmed:false, source:"model"})
  -[:HAS_TRADEOFF]->   (:Tradeoff {option_a:"earlier wind-down", option_b:"keep evening screen time",
                                   benefit:"more deep sleep", cost:"less evening leisure",
                                   affected_domains:["health","career"]})
  -[:REQUIRES_REVIEW]->(:AdviceBoundary {boundary_type:"medical",
                                   disclaimer_text:"Wellness guidance, not medical advice.",
                                   requires_human_review:false, escalation_path:"physician"})
```

Same fan-out machinery as Finance — the worker creates these child nodes from the
recommendation row's `evidence_json`/`assumptions_json`/`tradeoffs_json`/`governance_verdict`.

**Candidate Health recommendation families** (each must be wellness/lifestyle, never medical):
`improve_sleep` (sleep_logs) · `increase_activity` (workout_logs) · `protein_target`
(nutrition_logs) · `hydration` · `recovery_load_balance` (workout intensity vs sleep). Each
emits evidence from logs + a `medical` AdviceBoundary.

## 6. Chat layer

Inherited verbatim: `Retriever.recommendation_evidence` traverses the Health recommendation
subgraph; "why are you recommending better sleep?" answers from `avg_sleep_hours=5.7` etc.
with the not-medical-advice disclaimer surfaced from the `:AdviceBoundary`.

## What's genuinely new for Health (vs Finance)

Only the **medical-safety governance** (HEALTH_GOVERNANCE_STANDARD): a stricter
`MedicalBoundary`, mandatory disclaimers, escalation to physician/Arcana, and a hard
prohibition on diagnosis/treatment/prescription. Everything else is the framework.
