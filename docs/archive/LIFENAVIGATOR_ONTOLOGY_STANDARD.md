# LIFENAVIGATOR ONTOLOGY STANDARD

The canonical semantic model for LifeNavigator's Neo4j knowledge graph. The
executable form of this document is `apps/ingestion-worker/src/ontology.rs`. Every
domain MUST conform before it unlocks (see `GRAPH_QUALITY_GATES.md`).

**Direction convention.** The worker's `merge_cypher_for` emits `(target)-[rel]->(node)`.
In this standard, relationships are written **source → REL → target** in their natural
reading direction; the worker registry encodes them as _incoming edges_ on the node.

**Tenant rule.** Every node and edge is scoped to one `tenant_id` (== `user_id` for
personal data). No edge may cross tenants. Central/benchmark knowledge lives in the
separate `ln_central` graph and is never linked into a personal node by user id.

---

## A. Core node taxonomy

### Root

`UserProfile` · `Household` · `PersonaProfile`

### Finance

`FinancialAccount` · `TransactionSummary` · `Asset` · `Liability` · `Debt` ·
`InvestmentHolding` · `RetirementAccount` · `FinancialGoal` · `CashFlowSnapshot` ·
`NetWorthSnapshot` · `BudgetCategory` · `IncomeSource` · `ExpenseCategory` ·
`InsurancePolicy` · `InsuranceNeed` · `EstateDocument` · `LegacyGoal` ·
`FinancialRecommendation`

### Health

`HealthProfile` · `HealthGoal` · `WellnessHabit` · `ActivityLog` · `SleepLog` ·
`NutritionLog` · `SupplementLog` · `Vital` · `LabMarker` · `BodyMetric` ·
`WorkoutLog` · `Trainer` · `HealthInsurancePlan` · `HealthSpendingAccount` ·
`MedicalExpense` · `BenefitDeadline` · `ArcanaProfile` · `CarePlanSnapshot` ·
`ProtocolItem` · `AdherenceLog` · `OutcomeMeasurement` · `WellnessRecommendation`

### Career

`CareerProfile` · `Skill` · `Experience` · `CareerGoal` · `CompensationRecord` ·
`JobTarget` · `Credential` · `Certification` · `CourseCompletion` · `License` ·
`Degree` · `LearningPath` · `Company` · `EmployerProfile` · `JobPost` ·
`JobRequirement` · `JobMatch` · `Application` · `CareerRecommendation`

### Family

`Household` · `FamilyMember` · `Dependent` · `FamilyGoal` · `ProtectionItem` ·
`InsuranceNeed` · `EstateReadinessItem` · `FamilyRecommendation`

### Education

`EducationProfile` · `EducationGoal` · `Course` · `Certification` · `Degree` ·
`Program` · `TuitionCost` · `EducationROIModel` · `EducationRecommendation`

### Decision Intelligence (cross-cutting)

`Goal` · `GoalMilestone` · `RiskAssessment` · `LifeScenario` · `LifeScenarioVersion` ·
`LifeScenarioOutput` · `Decision` · `LifeTrajectorySnapshot` · `Recommendation` ·
`Evidence` · `Assumption` · `Constraint` · `Preference` · `Tradeoff` · `Opportunity` ·
`Warning` · `AdviceBoundary` · `GovernanceRule`

**Naming rule:** PascalCase, singular. `RetirementAccount` is the canonical label;
the worker's `RetirementPlan` enum maps to it (reconcile in a future pass). Shared
labels used by multiple domains (`Household`, `Certification`, `Degree`,
`InsuranceNeed`) are defined once and owned by the listed primary domain.

---

## B. Relationship vocabulary

### Ownership / structure

`OWNS_ACCOUNT` · `HAS_TRANSACTION` · `HAS_ASSET` · `HAS_LIABILITY` · `HAS_DEBT` ·
`HAS_HOLDING` · `CONTRIBUTES_TO` · `HAS_CAREER` · `HAS_SKILL` · `HAS_EXPERIENCE` ·
`HAS_WELLNESS` · `HAS_HEALTH_GOAL` · `HAS_FAMILY_MEMBER` · `HAS_DEPENDENT` ·
`HAS_EDUCATION` · `PURSUING` · `LOGGED` · `INCLUDES`

### Finance

`AFFECTS_CASHFLOW` · `AFFECTS_NET_WORTH` · `IN_CATEGORY` · `FUNDS` · `FUNDED_BY` ·
`SECURED_BY` · `BLOCKS_GOAL` · `SUPPORTS_GOAL` · `PRIORITIZES` · `NEEDS_INSURANCE` ·
`HAS_BENEFICIARY` · `HAS_ESTATE_DOCUMENT`

### Career

`TARGETS_ROLE` · `GAP_FOR` · `CLOSES_SKILL_GAP` · `QUALIFIES_FOR` · `REQUIRES_SKILL` ·
`REQUIRES_CREDENTIAL` · `MATCHES_JOB` · `IMPROVES_COMPENSATION` · `CREATES_OPPORTUNITY`

### Education

`BUILDS_SKILL` · `EARNS_CREDENTIAL` · `HAS_TUITION_COST` · `IMPROVES_JOB_READINESS` ·
`HAS_ROI_MODEL` · `FUNDED_BY`

### Health

`AFFECTS_HEALTH` · `SUPPORTS_HEALTH_GOAL` · `TRACKS_METRIC` · `IMPROVES_ADHERENCE` ·
`REQUIRES_MEDICAL_REVIEW` · `COVERED_BY` · `ELIGIBLE_FOR_HSA_FSA`

### Decision intelligence

`HAS_GOAL` · `HAS_RISK` · `CONSTRAINS` · `IMPACTS` · `EVALUATES` · `COMPARES` ·
`HAS_EVIDENCE` · `HAS_ASSUMPTION` · `HAS_TRADEOFF` · `HAS_RECOMMENDATION` ·
`ADDRESSES` · `REQUIRES_REVIEW` · `REQUIRES_DISCLAIMER` · `GOVERNED_BY` · `EXPLAINS` ·
`CONTRADICTS` · `DEPENDS_ON`

---

## C. Relationship rules

Each relationship is specified as a row. `Cross-domain` = endpoints may live in
different domains; `Tenant` = scoped to one tenant (always yes for personal);
`Central` = allowed in the `ln_central` benchmark graph. `Reproc.` = behavior on
re-ingest (always `MERGE`/idempotent). `Delete` = behavior when the source row is
deleted (`DETACH` removes the node + its edges).

### Implemented today (finance, live)

| Source → REL → Target                                   | Dir | Required fields | Optional | Conf. default  | Evidence source                 | Cross-dom | Tenant | Central | Delete | Reproc. |
| ------------------------------------------------------- | --- | --------------- | -------- | -------------- | ------------------------------- | --------- | ------ | ------- | ------ | ------- |
| UserProfile → OWNS_ACCOUNT → FinancialAccount           | →   | user_id         | —        | 1.0 (asserted) | finance.financial_accounts      | no        | yes    | no      | DETACH | MERGE   |
| UserProfile → HAS_TRANSACTION → TransactionSummary      | →   | user_id         | —        | 1.0            | finance.transactions            | no        | yes    | no      | DETACH | MERGE   |
| FinancialAccount → HAS_TRANSACTION → TransactionSummary | →   | account_id      | —        | 1.0            | finance.transactions.account_id | no        | yes    | no      | DETACH | MERGE   |
| UserProfile → HAS_HOLDING → InvestmentHolding           | →   | user_id         | —        | 1.0            | finance.investment_holdings     | no        | yes    | no      | DETACH | MERGE   |
| FinancialAccount → HAS_HOLDING → InvestmentHolding      | →   | account_id      | —        | 1.0            | …holdings.account_id            | no        | yes    | no      | DETACH | MERGE   |
| UserProfile → HAS_ASSET → Asset                         | →   | user_id         | —        | 1.0            | finance.assets                  | no        | yes    | no      | DETACH | MERGE   |
| UserProfile → HAS_DEBT → Debt                           | →   | user_id         | —        | 1.0            | finance.asset_loans             | no        | yes    | no      | DETACH | MERGE   |
| UserProfile → CONTRIBUTES_TO → RetirementAccount        | →   | user_id         | —        | 1.0            | finance.retirement_plans        | no        | yes    | no      | DETACH | MERGE   |
| UserProfile → HAS_GOAL → FinancialGoal                  | →   | user_id         | —        | 1.0            | finance.financial_goals         | no        | yes    | no      | DETACH | MERGE   |

### Documented extension points (NOT emitted — need fields/tables)

| Source → REL → Target                                               | Unblocks on                                             |
| ------------------------------------------------------------------- | ------------------------------------------------------- |
| Debt → SECURED_BY → Asset                                           | `asset_loans.asset_id` (reverse-direction edge support) |
| InvestmentHolding/RetirementAccount → SUPPORTS_GOAL → FinancialGoal | goal linkage field                                      |
| Debt → BLOCKS_GOAL → FinancialGoal                                  | goal linkage field                                      |
| FinancialGoal → FUNDED_BY → FinancialAccount/Asset/IncomeSource     | funding linkage                                         |
| TransactionSummary → IN_CATEGORY → ExpenseCategory                  | `expense_categories` table (Phase 1)                    |
| TransactionSummary → AFFECTS_CASHFLOW → CashFlowSnapshot            | `cash_flow_snapshots` table                             |
| Asset/Debt → AFFECTS_NET_WORTH → NetWorthSnapshot                   | `net_worth_snapshots` table                             |
| FinancialRecommendation → ADDRESSES/HAS_EVIDENCE/HAS_ASSUMPTION → … | recommendation graph (Part 5)                           |

**Reverse-direction note:** the worker currently emits edges that point _into_ the
processed node. `SECURED_BY` (Debt→Asset) has the processed node (`Debt`) as the
_source_, so it requires either (a) emitting it while processing the `Asset` side, or
(b) extending `merge_cypher_for` with an outgoing-edge form. Tracked, not faked.

---

## D. Relationship metadata standard

Every edge SHOULD carry the following properties where applicable (designed now,
phased in — today's finance edges carry tenant/source identity via the node, edge
properties land with the evidence-graph work):

| Property                                                 | Meaning                                              |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `tenant_id` / `user_id`                                  | owner scope (mandatory)                              |
| `source_table`                                           | Supabase origin                                      |
| `source_entity_type` / `source_entity_id`                | provenance of the edge                               |
| `confidence`                                             | 0–1; default 1.0 for user-asserted, < 1 for inferred |
| `evidence_type`                                          | `asserted` \| `derived` \| `observed` \| `benchmark` |
| `created_at` / `updated_at`                              | timestamps                                           |
| `relationship_version`                                   | schema version of the rule (from registry `version`) |
| `derived_by`                                             | which worker/agent produced it                       |
| `is_inferred` / `is_user_asserted` / `is_system_derived` | mutually-exclusive provenance flags                  |

**Principle:** an inferred edge (e.g. `BLOCKS_GOAL` derived by the recommendation
engine) must be distinguishable from a user-asserted edge (`OWNS_ACCOUNT`). This is
what lets the AI say "I assumed X" vs "you told me X."

**First-implementation scope:** keep it minimal — node-level `tenant_id`,
`source_table`, `entity_type`, `confidence` already exist on every node. Edge-level
metadata is introduced with the evidence graph (Part 5), not retrofitted onto the
high-volume ownership edges.
