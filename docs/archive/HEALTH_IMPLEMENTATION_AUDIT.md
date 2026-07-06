# HEALTH IMPLEMENTATION AUDIT (H1 Phase 0)

State of Health in the repo/DB before the H1 foundation. Audit only.

## What exists

- **`health_meta` schema** (legacy partial health): `health_metrics`, `health_records`,
  `basic_records`, `appointments`, `insurance_cards`, `wearable_connections` — **with GraphRAG
  triggers** already attached. A separate, older surface.
- **`public.activity_logs`** (legacy) — distinct from the planned `health.activity_logs`.
- **Frontend health surface (extensive, legacy):** `dashboard/healthcare/*` (overview,
  records, appointments, wellness, settings, add), `onboarding/sections/health`,
  `api/health-monitoring/*`, `api/onboarding/health-*`, `api/scenario-lab/health`.
- **Worker enum (already present):** `HealthProfile, NutritionLog, SupplementLog, WorkoutLog,
HealthInsurancePlan, ArcanaProfile` (+ `HealthMetric, BodyMeasurement, LabRecord,
MedicationLog, FitnessProfile` from older work).
- **Core API:** `routers/health.py` is **liveness/readiness only** (not the domain). Registry
  `KNOWN_DOMAINS` includes `"health"` but it is **not live** — it only appears in
  `unavailable()` (roadmap metadata, no data). No `HealthService`.
- **Ontology registry:** no Health mappings (finance only).

## What is missing (to build in H1)

- **`health` schema** (new — does not exist) + the v1 foundation tables.
- **11 worker enum variants:** `HealthGoal, WellnessHabit, ActivityLog, SleepLog, Vital,
LabMarker, BodyMetric, HealthSpendingAccount, MedicalExpense, BenefitDeadline,
HealthRecommendation`.
- **Health ontology registry mappings** (user-anchor + benefits FK edges + recommendation
  evidence fan-out).
- **`HealthService`** (DomainService) + `/v1/health/*` router + Health `DomainViewModel`.
- **Medical safety gate** (`MedicalBoundary`/`EscalationRule`).
- **Sleep recommendation family** (evidence-graph).
- **Health triggers** (after worker deploy — enum-before-trigger).

## What must be preserved (do NOT touch)

- The entire **`health_meta` schema + its triggers** (legacy data + its GraphRAG wiring).
- **`public.activity_logs`** and all legacy `dashboard/healthcare/*` + `api/health-monitoring/*`
  frontend (separate surface; not modified in H1).
- Existing worker enum variants (`HealthMetric`, `BodyMeasurement`, etc.) — kept; the new
  framework-aligned variants are added alongside.

## What must NOT be exposed yet

- The new `health` domain stays **`unavailable()`** in the `DomainRegistry` (no live tiles).
- No production navigation entry for the new Health backend.
- No new frontend (the legacy healthcare UI is unchanged and not wired to this backend).
- Naming: the new Health domain router is `routers/health_domain.py` (mounted `/v1/health`) so
  it never collides with the `routers/health.py` liveness router.

## Implications for H1

- New `health` schema is **isolated** from `health_meta` (no migration touches the legacy
  schema or its triggers).
- New tables use **fresh names** (`health.activity_logs` ≠ `public.activity_logs`); the schema
  qualifier keeps them distinct.
- Arcana placeholder tables/enums (`care_plan_snapshots`, `protocol_items`, `adherence_logs`,
  `outcome_measurements`) are **deferred** — only `arcana_profiles` is cleanly pre-existing;
  the rest are not architected, so H1 omits them (per "only if already architected cleanly").
