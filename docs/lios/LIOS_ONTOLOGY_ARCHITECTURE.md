# LIOS — Ontology Architecture (Phase 1)

**LIOS** = the durable **Life Intelligence Operating System**. The thesis: _models are
replaceable workers; the data, the ontology, the memory, and the life model are durable and
**are** the moat._ This document is the canonical entity model. It is **not** an aspirational
redesign — it is a faithful map of what already exists in the repo, with each entity marked:

- **EXISTS** — a backing table/module/enum variant is live; the citation points at it.
- **PARTIAL** — represented today but incompletely (e.g. a JSON sub-shape, a sibling concept
  reused, or no first-class table yet).
- **NEW** — named in the LIOS vision but not yet modeled; listed so the gap is explicit, never faked.

The single rule that governs all of this (and is _enforced in code today_): **nothing enters the
graph that isn't backed by a real row, and nothing is asserted to the user that isn't grounded.**
See `apps/ingestion-worker/src/ontology.rs` (no faked edges) and
`apps/lifenavigator-core-api/app/services/advisor_validator.py` (no invented numbers / ungrounded
relationships).

---

## 1. The three-store substrate

Every personalized entity is one logical record projected into three physical stores. The
projection is deterministic and idempotent.

| Store                   | Role                                                                                                                                                                                                         | Backing code                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| **Supabase (Postgres)** | **Canonical source of truth.** Per-domain schemas (`finance`, `health`, `career`, `education`, `family`, `decision`, `documents`, `life`, `recommendations`), all 116-RLS, all `user_id`/`tenant_id` scoped. | `supabase/migrations/*` (138 migrations)                                          |
| **Neo4j (Aura)**        | **Typed relationship graph.** One node per canonical record, label = PascalCase of `entity_type`; typed edges from the ontology registry.                                                                    | `apps/ingestion-worker/src/neo4j_client.rs` (`merge_cypher_for`, Query API v2)    |
| **Qdrant**              | **Semantic vector index** over each record's `summary`, with sensitivity-aware payload filters.                                                                                                              | `apps/ingestion-worker/src/entities.rs` (`qdrant_point_uuid`, `SensitivityLevel`) |

The object that crosses all three is `CanonicalGraphObject` (`entities.rs:758`). Every node carries
the durable identity + governance columns:

```
tenant_id (== user_id), user_id, entity_id, entity_type, domain,
source_table, title, summary, attributes, relationships,
sensitivity_level, created_at, updated_at
```

**Flow** (the durable spine — models plug in as workers along it):
`Supabase row → graphrag.sync_queue → ingestion-worker (normalizer + ontology registry) → Neo4j node+edges & Qdrant point`.
The conversational writer (`relationship_manager.py`) writes the canonical `life.*` rows that seed
this; the advisor/recommendation/decision services _read_ the three stores back.

---

## 2. Canonical-ID strategy

| Concern                | Rule                                                                                                                                                                                                      | Source                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------------------------------- | --------------------------------------- |
| **Node identity**      | A node is `MERGE`d on `{ tenant_id, entity_id }` — never just `entity_id`. There is no codepath that writes/reads a node without a `tenant_id` filter, so identity is tenant-local by construction.       | `neo4j_client.rs:110` (`merge_cypher_for`), module doc |
| **Vector point id**    | `UUIDv5(NAMESPACE_URL, "{tenant}                                                                                                                                                                          | {entity_type}                                          | {entity_id}")` — deterministic so re-runs upsert/delete the same point. | `entities.rs:794` (`qdrant_point_uuid`) |
| **Derived/child rows** | Deterministic `uuid5` from a natural key, e.g. candidate goals `uuid5(DNS, "{user}:cand:{norm}")`, rejected goals `…:rej:{phrase}`, constraints `…:rm:{label}`. Re-deriving the same input is idempotent. | `relationship_manager.py:117,248,303`                  |
| **Recommendations**    | `uuid5(_NS, "{user}:{source_module}:{title}")` — same finding from the same module is one row, not a duplicate.                                                                                           | `recommendations_os.py:36` (`_rid`)                    |
| **Tenant safety**      | Edge targets are `MERGE`d under the _same_ `tenant_id` as the source; a cross-tenant edge is structurally impossible.                                                                                     | `ontology.rs:19-22`                                    |

**EXISTS.** No `entity_id` strategy is NEW.

---

## 3. The registry pattern (the executable ontology)

The ontology is **data, not control flow**. `ontology.rs` is "the single source of truth, in code,
for which typed Neo4j relationships each entity emits" — a registry of declared rules rather than a
growing `match` in the normalizer. This is the pattern LIOS extends.

- An `IncomingEdge` (`ontology.rs:60`) declares `{ rel_type, from, required, version }`.
- `EdgeFrom::UserAnchor` → `(:UserProfile)-[rel]->(:ThisEntity)` (always available, `required`).
- `EdgeFrom::PayloadFk { from_label, field }` → `(:Other {id=fk})-[rel]->(:ThisEntity)`, emitted
  **only when the FK is present** — never a fabricated link.
- `incoming_edges(et)` (`ontology.rs:261`) returns the declared edges; `is_registry_mapped` /
  `domain_of` drive quality gates. A registry-mapped entity **can never fall back to `RELATED_TO`**
  (enforced by the `#[test]`s at `ontology.rs:428-578`).

**Versioning.** Each `IncomingEdge` carries an explicit `version: u32` (currently `1`). The
`Domain` enum (`ontology.rs:31`) gives per-domain ownership for gates and future enable flags. New
domains add **rows** to the registry, not edits to the worker core — this is the durable extension
seam. The Rust `EntityType` enum (`entities.rs:38`) uses the **enum-before-trigger** discipline:
the worker learns a type _before_ a migration enqueues it, so a new type never deserializes to
`:Unknown`.

> **LIOS mandate:** the registry today declares only _incoming/ownership_ edges (user→entity, FK→entity).
> The richer _cross-entity semantic_ edges of Phase 2 (`supports`, `conflicts_with`, …) live in the
> Core-API relationship layer (`advisor_context.py` / `relationship_manager.py`). LIOS unifies these
> two halves under one registry — see `LIOS_RELATIONSHIP_MODEL.md`.

---

## 4. Canonical entity model

Legend: **D** = owning domain. Marker = EXISTS / PARTIAL / NEW with backing.

### 4.1 Identity & Household (D: Root / Family)

| Entity            | Definition                                                             | Marker · Backing                                                                                                                                                                          |
| ----------------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Person**        | The tenant; the root anchor every other entity hangs off.              | **EXISTS** — `EntityType::UserProfile` (`entities.rs:39`); anchor label `USER_PROFILE` (`ontology.rs:27`); all RLS keyed on `auth.uid()`.                                                 |
| **Household**     | The user's family/financial unit.                                      | **PARTIAL** — represented by `EntityType::FamilyProfile` (`HAS_FAMILY`, `ontology.rs:225`) + `family` schema; no distinct `Household` table — the FamilyProfile _is_ the household today. |
| **Family Member** | A non-dependent member (spouse/partner) of the household.              | **EXISTS** — `EntityType::SpouseProfile` (`HAS_SPOUSE`); legacy `EntityType::FamilyMember` (lifestyle).                                                                                   |
| **Dependent**     | A minor/dependent in the household; protection & guardianship subject. | **EXISTS** — `EntityType::Dependent` (`HAS_DEPENDENT`, + FK `COVERS_DEPENDENT` from `GuardianshipPlan`, `ontology.rs:226`); sensitivity **High**.                                         |
| **Pet**           | A household pet (care/estate consideration).                           | **NEW** — not modeled; no enum variant or table.                                                                                                                                          |

### 4.2 Goals & Intent (D: core / life)

| Entity          | Definition                                                           | Marker · Backing                                                                                                                                                                                 |
| --------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Goal**        | A thing the user is working toward, captured in their own words.     | **EXISTS** — `EntityType::Goal`/`FinancialGoal`/`HealthGoal`/`CareerGoal`/`EducationGoal`/`EducationGoal`; `life.candidate_goals` accumulates every stated goal (`relationship_manager.py:106`). |
| **Objective**   | A normalized/structured goal the engine derived from a surface goal. | **EXISTS** — `life.life_objectives` (written by `LifeDiscoveryService.discover_goal`, `relationship_manager.py:225`); "Life Objective" is a primary graph node type (`advisor_context.py:36`).   |
| **Constraint**  | A real limit the plan must work around.                              | **EXISTS** — `EntityType::Constraint`; `life.constraints` (`relationship_manager.py:248`).                                                                                                       |
| **Risk**        | A threat to an objective.                                            | **EXISTS** — `life.risks` (`recommendations_os.py:390`); rendered as graph node type `risk` (`life_graph_workspace.py:24`); RecommendationOS `RISK` type.                                        |
| **Opportunity** | A favorable, un-acted-on lever.                                      | **EXISTS** — RecommendationOS `OPPORTUNITY` type (`recommendations_os.py:28`); graph node type `opportunity`.                                                                                    |
| **Milestone**   | A checkpoint along an objective.                                     | **PARTIAL** — `EntityType::GoalMilestone`/`HealthMilestone` exist as variants; no dedicated registry edge yet.                                                                                   |

### 4.3 Decision & Scenario (D: decision)

| Entity       | Definition                                                                                | Marker · Backing                                                                                                                                                                                                |
| ------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Decision** | A cross-domain life question resolved into scenarios + evidence + tradeoffs + a boundary. | **EXISTS** — `decision.decisions` (`134_decision_schema.sql`); `EntityType::LifeDecision` (`HAS_DECISION`, `ontology.rs:247`); also `DecisionGraphService` composes the explainable view (`decision_graph.py`). |
| **Scenario** | A worst/expected/best projection within a decision.                                       | **EXISTS** — `decision.decisions.scenarios_json` + `EntityType::DecisionScenario` (`HAS_SCENARIO` via `decision_id` FK, `ontology.rs:248`).                                                                     |
| **Tradeoff** | A cost-vs-benefit pairing surfaced by a decision/recommendation.                          | **EXISTS** — `EntityType::Tradeoff` (`HAS_TRADEOFF`, `ontology.rs:133`); `tradeoffs_json`; graph `tradeoff` nodes (`decision_graph.py:130`).                                                                    |

### 4.4 Finance (D: finance)

| Entity         | Definition                                  | Marker · Backing                                                                                                                                                                                                                                         |
| -------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Income**     | A recurring income stream.                  | **EXISTS** — `EntityType::IncomeSource` (`HAS_INCOME_SOURCE`, `ontology.rs:111`).                                                                                                                                                                        |
| **Expense**    | A spending category / outflow.              | **EXISTS** — `EntityType::ExpenseCategory` (`HAS_EXPENSE_CATEGORY`); `BudgetCategory` (`HAS_BUDGET_CATEGORY`); `TransactionSummary`.                                                                                                                     |
| **Asset**      | Something the user owns of value.           | **EXISTS** — `EntityType::Asset` (`HAS_ASSET`, `ontology.rs:97`); plus `FinancialAccount` (`OWNS_ACCOUNT`), `NetWorthSnapshot`, `CashFlowSnapshot`.                                                                                                      |
| **Liability**  | A debt/obligation.                          | **EXISTS** — `EntityType::Liability` (`HAS_LIABILITY`) + legacy `Debt` (`HAS_DEBT`, `ontology.rs:98,107`).                                                                                                                                               |
| **Investment** | A held security/position.                   | **EXISTS** — `EntityType::InvestmentHolding` (`HAS_HOLDING` + FK to account, `ontology.rs:99`); `RetirementPlan` (`CONTRIBUTES_TO`).                                                                                                                     |
| **Insurance**  | A coverage policy (life/disability/health). | **PARTIAL** — `EntityType::InsuranceProfile` (family, `HAS_INSURANCE_PROFILE`) + `HealthInsurancePlan` (`HAS_INSURANCE_PLAN`); analysis of coverage gaps is real (`recommendations_os.py:275`); no unified `Insurance` policy entity across domains yet. |

### 4.5 Estate (D: family / estate)

| Entity                | Definition                                               | Marker · Backing                                                                                                                                           |
| --------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Estate**            | The user's estate plan (will/POA/beneficiary readiness). | **EXISTS** — `EntityType::EstatePlan` (`HAS_ESTATE_PLAN`, `ontology.rs:236`); legacy `EstateProfile`; estate-readiness recs (`recommendations_os.py:295`). |
| **Trust**             | A legal trust instrument.                                | **NEW** — referenced in copy ("trust suitability review") but no `Trust` entity/table.                                                                     |
| **Beneficiary**       | A designated recipient.                                  | **PARTIAL** — `EntityType::EstateBeneficiary` variant exists (`entities.rs`); no registry edge or first-class table yet.                                   |
| **Guardianship Plan** | Who cares for dependents.                                | **EXISTS** — `EntityType::GuardianshipPlan` (`HAS_GUARDIANSHIP_PLAN`); covers Dependents via FK.                                                           |

### 4.6 Health (D: health)

| Entity                | Definition                                                                     | Marker · Backing                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Healthcare Plan**   | Coverage + spending accounts for health.                                       | **EXISTS** — `EntityType::HealthInsurancePlan`, `HealthSpendingAccount` (`HAS_SPENDING_ACCOUNT`), `BenefitDeadline` (`ontology.rs:160-163`).                                                                                                           |
| **Health Event**      | A logged health occurrence (workout/sleep/activity/nutrition/medical expense). | **EXISTS** — `ActivityLog`/`SleepLog`/`NutritionLog`/`SupplementLog`/`WorkoutLog`/`MedicalExpense` (`LOGGED`, `ontology.rs:152-162`); `HealthAlertEvent`.                                                                                              |
| **Medical Condition** | A diagnosed condition.                                                         | **PARTIAL** — `EntityType::Injury` + lab/vital markers (`Vital`, `LabMarker`, `BodyMetric` → `TRACKS_METRIC`) carry health facts; no first-class `Condition` entity — and the advisor is **hard-blocked from diagnosing** (`advisor_validator.py:68`). |

### 4.7 Education (D: education)

| Entity                | Definition                               | Marker · Backing                                                                                                                                             |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Education Program** | A school program under consideration.    | **EXISTS** — `EntityType::Program` (`EVALUATES_PROGRAM` + FK `OFFERS` from `School`, `ontology.rs:211`); `School` (`CONSIDERS_SCHOOL`), `ProgramComparison`. |
| **Degree**            | An attained/target academic degree.      | **EXISTS** — `EntityType::Degree` (`HAS_DEGREE`, `ontology.rs:184`).                                                                                         |
| **Certification**     | A professional certification/credential. | **EXISTS** — `EntityType::Certification` (`HAS_CERTIFICATION`), `Credential` (`HAS_CREDENTIAL`) — shared Career/Education.                                   |

### 4.8 Career (D: career)

| Entity                   | Definition                      | Marker · Backing                                                                                                                                                                |
| ------------------------ | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Employer**             | An employing organization.      | **PARTIAL** — `EntityType::EmployerProfile`/`EmployerBenefit` variants + `CareerProfile` (`HAS_CAREER`) hold employer facts; no registry edge to a first-class `Employer` node. |
| **Position**             | A role (current or target).     | **EXISTS** — `EntityType::JobTarget` (`TARGETS_ROLE`), `ExperienceRecord` (`HAS_EXPERIENCE`), `JobApplication`/`Interview`.                                                     |
| **Compensation Package** | Pay/equity/benefits for a role. | **EXISTS** — `EntityType::CompensationRecord` (`HAS_COMPENSATION`), `CompensationProjection`; comp analysis in `decision_graph.py:70`.                                          |

### 4.9 Documents (D: documents) — the data-acquisition layer

| Entity                 | Definition                                                                                                                                                                          | Marker · Backing                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Document**           | An uploaded source document the user owns.                                                                                                                                          | **EXISTS** — `documents.documents` (`143_documents_platform.sql`); `EntityType::Document` (`HAS_DOCUMENT`, `ontology.rs:252`).                                                  |
| **(26-type taxonomy)** | `doc_type` (offer_letter / 401k_statement / life_insurance_policy / dd214 / …) + `category` (employment / benefits / insurance / financial / education / family_office / military). | **EXISTS** — columns `doc_type`, `category`, `affects_domains` (`143_documents_platform.sql:10-19`); label map `decision_graph.py:24`.                                          |
| **Document Field**     | A single extracted structured fact (evidence) from a Document.                                                                                                                      | **EXISTS** — `documents.document_fields` (`field_key/value/type/confidence/unit`); `EntityType::DocumentField` (`HAS_EXTRACTED_FIELD` via `document_id` FK, `ontology.rs:253`). |

### 4.10 Advisors & Professional Relationships (D: provider)

| Entity                        | Definition                             | Marker · Backing                                                                                                                                                            |
| ----------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Advisor**                   | A human/professional advisor entity.   | **PARTIAL** — `EntityType::ProviderProfile` + `provider` schema model external providers; the _in-app_ advisor is a service (`advisor_orchestrator.py`), not an entity row. |
| **Professional Relationship** | The user's engagement with a provider. | **PARTIAL** — `EntityType::ProviderEngagement`/`ProviderConsentScope` variants; no registry edge yet.                                                                       |

### 4.11 Life events & execution (D: core / recommendations)

| Entity             | Definition                                                                      | Marker · Backing                                                                                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Life Event**     | A material change in the user's life.                                           | **EXISTS** — `EntityType::LifeEvent`/`FinancialEvent` (`LOGGED`, `ontology.rs:113`).                                                                                                                             |
| **Task**           | An actionable step (Now/Next/Later execution).                                  | **PARTIAL** — modeled as RecommendationOS `ACTION` recs + the `roadmap()` Now/Next/Later sequence (`recommendations_os.py:537`); no standalone `Task` table.                                                     |
| **Recommendation** | The single first-class "what to do next", with evidence + confidence + formula. | **EXISTS** — `recommendations.recommendations` (`recommendations_os.py:85`); per-domain `*Recommendation` enum variants (`HAS_RECOMMENDATION`). The OS is the **only** way a recommendation enters the platform. |

### 4.12 Provenance & Trust primitives (D: cross-cutting) — the spine of the moat

| Entity              | Definition                                                                 | Marker · Backing                                                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Evidence**        | A cited fact backing a recommendation/finding.                             | **EXISTS** — `EntityType::Evidence` (`HAS_EVIDENCE` via `recommendation_id` FK, `ontology.rs:123`); every rec carries `evidence[]` and **no rec without evidence** (`recommendations_os.py:66`).                    |
| **Source**          | The originating table/document a fact came from.                           | **EXISTS** — `source_table` on every canonical object (`entities.rs:765`); evidence carries `source_table` (e.g. `documents:401k_statement`); graph `source`/`from_source` lineage (`life_graph_workspace.py:149`). |
| **Assumption**      | A default applied because data is missing — surfaced, never hidden.        | **EXISTS** — `EntityType::Assumption` (`HAS_ASSUMPTION`, `ontology.rs:128`); kept a _separate category_ in advisor context (`advisor_context.py:11`); rendered as `assumption` nodes.                               |
| **Confidence**      | A 0..1 trust score on a node/edge/recommendation.                          | **EXISTS** — `confidence` column across `documents`, `decisions`, `recommendations`; node + edge `confidence` in the graph workspace; `_CONF_FLOOR` gate (`recommendations_os.py:26`).                              |
| **Advice Boundary** | The liability line the advisor must not cross (medical/legal/tax/product). | **EXISTS** — `EntityType::AdviceBoundary` (`REQUIRES_REVIEW`, `ontology.rs:138`); enforced live by the `_ADVICE` gate (`advisor_validator.py:68`).                                                                  |

---

## 5. Sensitivity & governance (built into the entity)

Sensitivity is not a bolt-on — it is a property of the `EntityType` itself
(`entities.rs:626`, `SensitivityLevel::{Low,Medium,High}`):

- **High**: all Health/medical, Career identity & actual compensation, Family (dependents, spouse,
  estate, guardianship, insurance), and **Documents + DocumentFields** (carry salary/SSN/estate).
- **Medium**: money-bearing finance entities, goals/habits/recommendations across domains, decisions/scenarios.
- **Low**: labels/meta (BudgetCategory, ExpenseCategory, Assumption, Tradeoff, AdviceBoundary).

This drives Qdrant payload filters and is written onto every Neo4j node (`neo4j_client.rs:86`).
RLS (116-pattern, `USING (user_id = auth.uid())`) enforces tenant isolation at the canonical store
for every domain schema.

---

## 6. What is NEW (the honest gap list)

These are named in the LIOS vision but **not yet modeled** — listed so nobody fakes them:

- **Pet** — no entity/table.
- **Trust** — referenced in advice copy only.
- **Beneficiary**, **Medical Condition**, **Employer**, **Advisor**, **Professional Relationship**
  — sibling variants exist but lack a first-class table + registry edge.
- **Task** — exists only as a recommendation/roadmap projection.
- **Household** — folded into FamilyProfile.

The durable move is to promote each of these to (a) an `EntityType` variant, (b) a 116-RLS canonical
table, and (c) registry rows in `ontology.rs` — never a hardcoded node. Until then they are PARTIAL/NEW
by design, not by omission.
