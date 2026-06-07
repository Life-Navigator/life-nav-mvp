# HEALTH & WELLNESS BACKEND SPEC (I)

**Date:** 2026-06-07 · **Status:** DESIGN ONLY — next domain after finance/persona reaches 10/10.

Health & Wellness is the highest-risk domain (medical-adjacent) and the least-complete data-wise. This spec defines its schema, pipeline, contracts, agent ownership, and **non-negotiable safety boundaries**.

---

## 1. Scope & phasing

| In scope (Phase 4)                                                                | Deferred                                                                |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Wellness profile, wellness goals, habits, sleep, exercise, nutrition, supplements | Labs/vitals ingestion, wearable metric streams, deep Arcana integration |

Beta wellness is **self-reported lifestyle data + habits**, not clinical data. Clinical surfaces (labs, vitals, wearables, Arcana) are later phases with stricter handling.

---

## 2. Schema (extends `health_meta`)

**Existing:** `health_meta.{health_metrics, health_records, basic_records, appointments, insurance_cards, insurance_documents, wearable_connections}`, `public.{habits, habit_completions}`.

**New tables (Phase 4)** — all follow the standard pattern (RLS owner-read, service-write, security*invoker `public.health*\*` views, sensitivity HIGH):

```
health_meta.wellness_profile     -- domain root, 1 per user
  (id, user_id, primary_goal, activity_level, dietary_pattern, sleep_target_hours,
   stress_level, conditions_self_reported jsonb, consent_flags jsonb, created_at, updated_at)

health_meta.wellness_goals       -- wellness-specific goals (or link to public.goals with category='health')
  (id, user_id, title, metric, target_value, target_unit, cadence, status, created_at, updated_at)

health_meta.sleep_logs
  (id, user_id, date, hours, quality_score, bedtime, wake_time, source 'manual|wearable', created_at)

health_meta.exercise_sessions
  (id, user_id, date, modality, duration_min, intensity, calories_est, source, created_at)

health_meta.nutrition_logs
  (id, user_id, date, meal, calories_est, macros jsonb, hydration_ml, notes, source, created_at)

health_meta.supplement_logs
  (id, user_id, date, name, dose, unit, adherence bool, created_at)
```

`habits`/`habit_completions` (public) remain the streak/adherence engine; wellness reads them.

**RLS/views:** identical to migration-116 pattern. **Sensitivity: HIGH** across all (worker already classifies health entities High → encrypted-at-rest fields stripped from embeddings via the telemetry redaction rules).

---

## 3. GraphRAG pipeline

| Table             | entity_type                                    | enum   | label                    | rel                                              | sensitivity |
| ----------------- | ---------------------------------------------- | ------ | ------------------------ | ------------------------------------------------ | ----------- |
| wellness_profile  | `health_profile`                               | ✅     | :HealthProfile           | (:UserProfile)-[:HAS_WELLNESS]->(:HealthProfile) | High        |
| wellness_goals    | `health_milestone` or `goal` (category=health) | ✅     | :HealthMilestone / :Goal | (:HealthProfile)-[:TARGETS]->(:HealthMilestone)  | High        |
| sleep_logs        | ➕ `sleep_log`                                 | ➕ add | :SleepLog                | (:HealthProfile)-[:LOGGED]->(:SleepLog)          | High        |
| exercise_sessions | `workout_log`                                  | ✅     | :WorkoutLog              | (:HealthProfile)-[:LOGGED]->(:WorkoutLog)        | High        |
| nutrition_logs    | `nutrition_log`                                | ✅     | :NutritionLog            | (:HealthProfile)-[:LOGGED]->(:NutritionLog)      | High        |
| supplement_logs   | `supplement_log`                               | ✅     | :SupplementLog           | (:HealthProfile)-[:TAKES]->(:SupplementLog)      | High        |

**Enum-before-trigger:** `sleep_log` likely needs to be added to the worker enum + normalizer (with `build_summary` keys: date, hours, quality_score) and deployed BEFORE the sleep_logs trigger ships. Verify `workout_log`/`nutrition_log`/`supplement_log` (present in enum) match the exact emitted strings. Freshness: logs daily, profile on-change.

---

## 4. Backend endpoints (Core API `domains/health.py`)

```
GET  /v1/health/summary           → ViewModel<HealthSummary>
POST /v1/health/profile           → upsert wellness_profile (service-role; triggers ingest)
POST /v1/health/habit             → habits / habit_completions
POST /v1/health/log               → { kind: sleep|exercise|nutrition|supplement, ... }
GET  /v1/health/recommendations   → list[Recommendation]   (gated, disclaimers)
```

`HealthSummary.data`: `wellness_score`, `habits[{name,streak,target,adherence}]`, `sleep{avg_hours,target,trend}`, `activity{weekly_minutes,target}`, `nutrition{logged_days,hydration}`, `supplements[]`, `disclaimers[]`, `missing[]`.

---

## 5. Chat context (G) for health

```jsonc
{
  "domain":"health",
  "authoritative_facts":[
     {"fact":"avg_sleep_hours","value":6.4,"source":{"table":"health_meta.sleep_logs"}},
     {"fact":"weekly_exercise_min","value":90,"source":{"table":"health_meta.exercise_sessions"}}
  ],
  "missing_facts":["nutrition_log_recent","wellness_profile"],
  "relevant_goals":[{"title":"Sleep 7h/night","progress_pct":55}],
  "risks":[{"type":"sleep_deficit","severity":"medium","note":"avg below 7h target"}],
  "recommendations":[/* gated, with escalation */],
  "freshness":{...},"confidence":{"basis":"partial","missing_fields":["nutrition"]}
}
```

The Health Agent receives ONLY self-reported facts + targets. It must reason about **lifestyle behavior change**, never clinical interpretation.

---

## 6. Agent ownership

- **Health Agent** (backed by `arcana.health` / `arcana.longevity`): wellness behavior coaching, habit/sleep/activity narratives, goal feasibility.
- **Trust/Safety Agent** (mandatory): every health output passes the constitutional + character + injection gate AND the medical-boundary checks below before release.
- Arcana agents (`arcana.compliance`, `arcana.provider_coordination`, `arcana.orchestrator`) remain for the later clinical/provider phase, not beta wellness.

---

## 7. MEDICAL SAFETY BOUNDARIES (hard constraints — enforced server-side, not by prompt alone)

These are **gate rules in `governance/trust_safety.py`**, applied to every health-domain output. A violation = block + safe fallback, never ship.

1. **No diagnosis.** The system must not state or imply a medical condition, disease, or clinical interpretation of symptoms/metrics. (e.g. forbidden: "you likely have sleep apnea"; allowed: "your logged sleep is below your 7h target.")
2. **No treatment instructions.** No dosing, medication, therapy, or clinical-protocol directives. Supplement _logging_ is allowed; supplement _prescribing_ is not.
3. **Lifestyle-only recommendations.** Health recommendations are limited to general wellness behavior (sleep hygiene, activity, hydration, habit cadence) framed as non-clinical, with evidence tied to the user's own logged data.
4. **Mandatory disclaimer + escalation.** Every health recommendation carries `escalation = { type:"medical", disclaimer:"This is general wellness information, not medical advice. Consult a licensed physician for diagnosis or treatment." }`.
5. **Physician-escalation triggers.** If input/context contains red-flag signals (chest pain, suicidal ideation, severe symptoms, abnormal vitals once vitals exist), the output is replaced with a **physician/emergency-escalation message** and the advisory content is suppressed. Maintain an explicit red-flag lexicon + (later) vitals thresholds.
6. **No data fabrication.** Health facts come only from `authoritative_facts`; `missing_facts` are asked about, never invented (anti-hallucination contract).
7. **Sensitivity = HIGH everywhere.** Encrypted-at-rest sensitive fields are stripped from embeddings (worker telemetry redaction); health data never enters `ln_central` (central/shared) — personal collection only.
8. **Consent-gated ingestion.** `wellness_profile.consent_flags` must permit graph promotion; without consent, store-of-record only (no Qdrant/Neo4j).

These boundaries are **tested** (governance spec suite) and **audited** (every health output writes a `governance.decision_governance_audit` row with the boundary verdict).

---

## 8. Definition of done (Health Phase 4)

- New tables + RLS + security_invoker views shipped (migration, 116-pattern).
- `sleep_log` (and any missing) enum variants in worker + deployed; trigger audit shows `:Unknown`=0 for health tables.
- `GET /v1/health/summary` returns a complete view-model; `/dashboard/health` renders it with no client-side computation.
- Chat answers a wellness question from real logged data, with disclaimer, passing the medical-boundary gate; a red-flag input triggers escalation.
- Recommendations carry evidence + assumptions + `escalation` + governance verdict.
- Sidebar "Healthcare" flips from `comingSoon` to live (the agreed unlock order).
