# SEMANTIC ONTOLOGY IMPLEMENTATION PLAN

**Date:** 2026-06-07 · **Status:** DESIGN ONLY. The unified node + relationship ontology across all 10 domains, and how it is implemented in the existing worker/Neo4j/Qdrant pipeline.

---

## 1. Ontology principles

1. **One node per (tenant_id, entity_type, entity_id).** Stable identity → idempotent upsert (Qdrant point = uuidv5(tenant|type|id); Neo4j MERGE on {tenant_id, entity_id}).
2. **Label = PascalCase(entity_type).** The worker derives it; no separate map. So the ontology IS the `EntityType` enum + the relationship vocabulary.
3. **tenant_id == user_id on every personal node.** Central/methodology nodes live in `ln_central` (no tenant). Personal and central never mix.
4. **Relationships are directional, vocabularied, and typed by source+target labels.** New edge types are added to the worker's relationship emitter (normalizer `relationships[]`), not invented ad-hoc.
5. **Cross-domain edges are first-class** — they are what makes this "decision intelligence," not 10 silos.

---

## 2. Core node taxonomy (by domain)

```
Root:        :UserProfile  (the person; tenant anchor)
Persona:     :PersonaProfile
Finance:     :FinancialAccount :TransactionSummary :Asset :Debt/:Liability :InvestmentHolding
             :RetirementAccount :FinancialGoal :CashFlowSnapshot :NetWorthSnapshot
             :BudgetCategory :IncomeSource :ExpenseCategory :FinancialRecommendation
Health:      :HealthProfile :HealthGoal :WellnessHabit :SleepLog :WorkoutLog :NutritionLog
             :SupplementLog :Vital :LabMarker :WellnessRecommendation
Career:      :CareerProfile :Skill :Experience :CareerGoal :CompensationRecord :JobTarget :CareerRecommendation
Family:      :Household :FamilyMember :Dependent :FamilyGoal :ProtectionItem :InsuranceNeed
             :EstateReadinessItem :FamilyRecommendation
Education:   :EducationProfile :EducationGoal :Course :Certification :Degree :Program :TuitionCost
             :EducationROIModel :EducationRecommendation
Goals:       :Goal :GoalMilestone :GoalDependency  (+ probability/progress nodes)
Risk:        :RiskAssessment  (+ category/recommendation if promoted)
Scenarios:   :LifeScenario :LifeScenarioVersion :LifeScenarioOutput :Decision :LifeTrajectorySnapshot
Calendar:    :CalendarEvent
```

## 3. Relationship vocabulary

**Ownership/structure:** `OWNS_ACCOUNT, HAS_TRANSACTION, HAS_ASSET, HAS_LIABILITY, HAS_DEBT, HAS_HOLDING, CONTRIBUTES_TO, HAS_CAREER, HAS_SKILL, HAS_EXPERIENCE, HAS_WELLNESS, LOGGED, HEADS, INCLUDES, HAS_EDUCATION, PURSUING, HAS_FAMILY_MEMBER`.

**Goal/decision linkage (cross-domain spine):** `SUPPORTS_GOAL, BLOCKS_GOAL, FUNDED_BY, PRIORITIZES, TARGETS, TARGETS_ROLE, GAP_FOR, CLOSES, ADDRESSES, IMPACTS, EVALUATES`.

**Derived/analytic:** `AFFECTS_CASHFLOW, AFFECTS_NET_WORTH, HAS_RECOMMENDATION, NEEDS, HAS_PROTECTION, HAS_RISK_PROFILE, RELATES_TO`.

### Cross-domain edges (the differentiator)

```
(:Asset|:IncomeSource)-[:SUPPORTS_GOAL]->(:FinancialGoal)
(:Debt)-[:BLOCKS_GOAL]->(:FinancialGoal)
(:FamilyGoal)-[:FUNDED_BY]->(:FinancialGoal)
(:EducationGoal)-[:FUNDED_BY]->(:FinancialGoal)
(:Certification)-[:CLOSES]->(:Skill)              # Education → Career
(:Skill)-[:GAP_FOR]->(:JobTarget)                 # Career internal
(:RiskAssessment)-[:CONSTRAINS]->(:FinancialGoal) # Risk → Finance
(:LifeScenario)-[:PROJECTS]->(:NetWorthSnapshot)  # Scenario → Finance
(:Recommendation)-[:ADDRESSES]->(:Goal|:Debt|:Skill|:InsuranceNeed)
```

These edges let the orchestrator answer cross-domain questions ("can I afford this program AND stay on track for retirement?") by traversal, not by stitching JSON in the app.

---

## 4. Qdrant payload schema (every point)

```
{ tenant_id, user_id, entity_id, entity_type, domain, source_table, title,
  sensitivity_level, created_at, updated_at }
```

Vector = embedding of the normalizer's dense `summary`. Retrieval filters `tenant_id` + optional `entity_type`/`domain`. **Dimension lock:** gemini-embedding-001 @ 3072 (worker + query side).

## 5. Implementation in the existing pipeline (no new infra)

The ontology is realized entirely through three existing extension points:

1. **Worker `EntityType` enum** (`entities.rs`) — add node types (the enum-before-trigger gate).
2. **Worker normalizer** (`normalizer.rs`) — `build_summary` (vector quality) + `relationships[]` (edge emission).
3. **Postgres triggers** — emit `enqueue_sync(user_id, entity_type, entity_id, source_table, op, payload)`; the payload's foreign keys become the `relationships[]` the normalizer maps to edges.

So "implementing the ontology" = per domain: add enum variants + summary/relationship cases + triggers, in that order. No Neo4j schema migration (labels/edges are schemaless MERGE).

## 6. Governance ontology (central, Phase 8)

`ln_central` holds methodology + compliance nodes (e.g. `:PlanningMethod`, `:ComplianceRule`, `:Disclaimer`) with edges `GROUNDS`/`REQUIRES_DISCLAIMER` to domain entity _types_ (not user data). The Trust/Safety Agent traverses these to attach the right disclaimer/escalation to each recommendation.

## 7. Validation

- **`:Unknown` = 0** across all labels (the ontology-integrity check; run in-container per `FLY_SECRET_AUDIT.md`).
- Every relationship endpoint label is a known node type.
- Every Qdrant point has `entity_type` + `tenant_id` (filterable).
- Cross-domain edges resolve (no dangling targets) — periodic Neo4j consistency sweep.
