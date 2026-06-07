# GRAPHRAG ENTITY PIPELINE SPEC (D)

**Date:** 2026-06-07 · **Status:** DESIGN ONLY.

How every domain's rows become grounded graph + vector data. Grounded in the live worker (`apps/ingestion-worker`) and the `graphrag.sync_queue` mechanics.

---

## 0. The pipeline (canonical, do not deviate)

```
Postgres row write (INSERT/UPDATE/DELETE)
   └─ trigger → graphrag.enqueue_sync(user_id, entity_type, entity_id, source_table, operation, payload)
        └─ graphrag.sync_queue row (sync_status='pending')
             └─ worker claims batch → normalize() → CanonicalGraphObject
                  ├─ embed summary (gemini-embedding-001, 3072-dim)
                  ├─ Qdrant upsert: point_id = uuidv5(tenant_id|entity_type|entity_id)
                  │     payload = { tenant_id, user_id, entity_id, entity_type, domain, source_table,
                  │                 title, sensitivity_level, created_at, updated_at }
                  └─ Neo4j MERGE (n:PascalCase(entity_type) { tenant_id, entity_id }) SET props
                        + per-relationship MERGE
```

**Five invariants:**

1. **Enum-before-trigger.** A trigger MUST NOT emit an `entity_type` the worker `EntityType` enum lacks — it deserializes to `Unknown` → `:Unknown` node (the 2026-06-07 RiskAssessment incident; also the 233 `:Unknown` transaction nodes from the `transaction` alias gap).
2. **Label = `pascalize(entity_type)`.** `risk_assessment` → `:RiskAssessment`. No separate label map.
3. **Qdrant preserves `entity_type`** in payload — required for filtered retrieval. Empty summary ⇒ Qdrant skipped (Neo4j still written); so every domain needs a non-empty `build_summary` case in the normalizer.
4. **Dimension lock:** worker embed + Core API/Edge query embed BOTH use `gemini-embedding-001` @ 3072-dim. Changing one breaks retrieval.
5. **tenant_id == user_id**; every retrieval filters on it. No cross-user nodes.

**Freshness:** triggers fire on UPDATE → re-enqueue → idempotent upsert (stable point_id + MERGE) refreshes the node. Define a per-domain freshness window (below) for the `Freshness.stale` flag.
**Deletion:** trigger emits `operation='delete'` → worker deletes the Qdrant point + `DETACH DELETE` the Neo4j node. Use for hard deletes; soft-deletes re-upsert with a `status` property.

---

## 1. Per-domain entity spec

Legend: ✅ enum variant present · ➕ add variant · 🔍 verify variant/trigger alignment.

### Finance (✅ live reference)

| entity_type                                                         | enum                                 | Neo4j label         | key relationships                                             | freshness |
| ------------------------------------------------------------------- | ------------------------------------ | ------------------- | ------------------------------------------------------------- | --------- |
| `financial_account`                                                 | ✅                                   | :FinancialAccount   | (:UserProfile)-[:OWNS]->(:FinancialAccount)                   | daily     |
| `transaction` (alias) → `transaction_summary`                       | ✅ (`#[serde(alias="transaction")]`) | :TransactionSummary | (:FinancialAccount)-[:HAS_TRANSACTION]->(:TransactionSummary) | daily     |
| `financial_goal`                                                    | ✅                                   | :FinancialGoal      | (:UserProfile)-[:HAS_GOAL]->(:FinancialGoal)                  | on-change |
| `investment_holding`,`debt`,`asset`,`retirement_plan`,`tax_profile` | ✅                                   | …                   | (:UserProfile)-[:OWNS]->                                      | on-change |

### Goals (✅)

`goal`→:Goal, `goal_milestone`→:GoalMilestone, `goal_dependency`→:GoalDependency, `goal_progress_*`→… · rel: (:UserProfile)-[:PURSUES]->(:Goal)-[:HAS_MILESTONE]->(:GoalMilestone), (:Goal)-[:DEPENDS_ON]->(:Goal). Freshness: on-change.

### Risk (✅ fixed 2026-06-07)

`risk_assessment`→:RiskAssessment · summary keys: assessment_type,status,overall_risk_score,risk_tolerance · rel: (:UserProfile)-[:HAS_RISK_PROFILE]->(:RiskAssessment) · 🔍 decide if `risk_category_score`/`risk_recommendation` need their own variants+labels or fold into the assessment node. Freshness: on-change.

### Career (✅ enum, 🔍 align)

`career_profile`→:CareerProfile, `job_application`→:JobApplication, `skill`→:Skill, `certification`→:Certification · rel: (:UserProfile)-[:HAS_CAREER]->(:CareerProfile), (:CareerProfile)-[:APPLIED_TO]->(:JobApplication), (:CareerProfile)-[:HAS_SKILL]->(:Skill) · 🔍 confirm `career_connections` emits a known type (➕ `CareerConnection` if needed). Freshness: on-change.

### Education (✅ enum, 🔍 align)

`education_record`→:EducationRecord, `course`→:Course, `study_log`→:StudyLog, `education_intake`→:EducationIntake · rel: (:UserProfile)-[:STUDIED]->(:EducationRecord), (:EducationRecord)-[:INCLUDES]->(:Course) · Freshness: on-change.

### Family (✅ member; ➕ appointment)

`family_member`→:FamilyMember (✅) · ➕ `family_appointment`→:FamilyAppointment (add variant + summary case before enabling its trigger) · rel: (:UserProfile)-[:HAS_FAMILY_MEMBER]->(:FamilyMember)-[:HAS_APPOINTMENT]->(:FamilyAppointment). Freshness: on-change.

### Calendar / Events (🔍)

🔍 `calendar_event` — VERIFY enum variant exists; ➕ if absent (trigger is already wired → risk of `:Unknown`). Label :CalendarEvent · rel: (:UserProfile)-[:HAS_EVENT]->(:CalendarEvent), optional (:CalendarEvent)-[:RELATES_TO]->(:Goal). Freshness: hourly (events move). **Action: audit immediately — this is a live trigger that may be producing `:Unknown`.**

### Scenarios / Decisions (🔍 highest mismatch risk)

Enum has `life_scenario`, `life_scenario_version`, `life_scenario_decision`, `life_scenario_output`, `life_trajectory_snapshot`, `decision`, `decision_marginal_impact`, `goal_decision_impact`. 🔍 Audit each `scenario_*`/`decision_*` trigger's emitted `entity_type` against these. rel: (:UserProfile)-[:RAN]->(:LifeScenario)-[:PRODUCED]->(:LifeScenarioOutput); (:Decision)-[:IMPACTS]->(:Goal). Freshness: on-change.

### Health & Wellness (🟡 — detail in `HEALTH_WELLNESS_BACKEND_SPEC.md`)

Present: `health_profile`,`health_metric`,`health_milestone`,`health_alert_event`,`workout_log`,`nutrition_log`,`supplement_log` (✅ several in enum). ➕ likely `wellness_profile`, `sleep_log`, `exercise_session` if names differ from existing variants — **name the trigger's `entity_type` to match an existing enum variant exactly, or add the variant first.** Labels :HealthProfile, :WorkoutLog, etc. rel: (:UserProfile)-[:HAS_WELLNESS]->(:HealthProfile)-[:LOGGED]->(:WorkoutLog|:NutritionLog|:SleepLog). Sensitivity: **High** (worker already marks health entities High). Freshness: daily (logs), on-change (profile).

### Roadmap (n/a)

No entity type, no trigger — derived projection only.

---

## 2. The mandatory pre-flight audit (do before ANY new trigger)

For each domain, before enabling/relying on a trigger:

```sql
-- 1. what entity_type does the trigger emit?  (read the trigger function body)
-- 2. does the worker enum have it?
SELECT entity_type, count(*) FROM graphrag.sync_queue WHERE source_table='<schema.table>' GROUP BY 1;
-- 3. did any land as :Unknown?  (in-container Neo4j, per FLY_SECRET_AUDIT.md)
MATCH (n:Unknown) RETURN n.source_table, count(*) ORDER BY 2 DESC;
```

If `:Unknown` > 0 for a domain → the enum/trigger are misaligned: add the variant, redeploy the worker, then relabel (`SET n:X REMOVE n:Unknown`).

**Known immediate audit targets:** `calendar_event`, the `scenario_*`/`decision_*` family — both have wired triggers but unverified enum alignment. These are the next RiskAssessment-style traps.

---

## 3. Worker change recipe (per new entity type)

1. Add `EntityType::<Variant>` (serde snake_case auto-maps the string).
2. Add the `as_str()` arm.
3. Add `build_title` + `build_summary` cases (non-empty summary → Qdrant point).
4. Add `domain()` / `sensitivity()` arms if non-default (health ⇒ High).
5. Unit test mirroring `risk_assessment_round_trips` + `pascalize`.
6. `cargo test --lib` → `fly deploy` the worker.
7. ONLY THEN apply the migration that enables the trigger.
8. Insert one test row → verify `:<Label>` node + `:Unknown` unchanged (in-container).
