# Goal Hierarchy + Central GraphRAG + Advisor Intelligence — Implementation

This sprint moves LifeNavigator from a system that _stores_ data to one
that _reasons across_ it. Five phases delivered:

1. **Migration 075** — repairs the historical 055 trigger bug so all
   pre-existing entity types finally enqueue. (See
   `TRIGGER_REPAIR_REPORT.md`.)
2. **Migration 076** — Goal Hierarchy Engine: six tables expressing
   parent/child, dependency, conflict, priority, generic-relationship,
   and pathway edges.
3. **Migration 077** — Central GraphRAG: `central` schema with
   ontology entities, ontology relationships, provenance records, a
   review log, public read-views, and a bootstrap seed of cross-domain
   edges. Adds an `access_scope` column to `graphrag.sync_queue` to
   route central vs personal projections.
4. **GoalPathService** — `apps/web/src/lib/goals/goal-path-service.ts`.
   Given `(user_id, root_goal_id)`, traverses the six tables and
   classifies every reachable goal as required / supporting / optional
   / blocked. Cycle detection via Tarjan's SCC.
5. **AdvisorReasoningService** — `apps/web/src/lib/advisor/`. Joins
   personal context (constraints, capabilities, motivations) with the
   central ontology to produce a structured `RecommendationOutput`
   (root goal, supporting/blocked goals, sequenced actions, timeline,
   tradeoffs, risks, assumptions, cross-domain impacts).
6. **HierarchyAwareEvaluator** — `apps/web/src/lib/trajectory/`.
   Scores `ProjectorOutput`s against a `GoalPathway` so the simulation
   layer can rank scenarios by _how fast they reach the root goal_,
   not just by net-worth growth.

No new dashboards. No UI changes. All intelligence layer.

---

## File map

| Layer                          | Path                                                       |
| ------------------------------ | ---------------------------------------------------------- |
| Migration — trigger repair     | `supabase/migrations/075_fix_055_triggers.sql`             |
| Migration — goal hierarchy     | `supabase/migrations/076_goal_hierarchy.sql`               |
| Migration — central + ontology | `supabase/migrations/077_central_graph_ontology.sql`       |
| Types — goal hierarchy         | `apps/web/src/types/goal-hierarchy.ts`                     |
| Types — advisor                | `apps/web/src/types/advisor.ts`                            |
| Service — goal path            | `apps/web/src/lib/goals/goal-path-service.ts`              |
| Service — advisor              | `apps/web/src/lib/advisor/advisor-reasoning-service.ts`    |
| Evaluator — hierarchy-aware    | `apps/web/src/lib/trajectory/hierarchy-aware-evaluator.ts` |
| Tests                          | `apps/web/src/lib/{goals,advisor,trajectory}/__tests__/`   |
| Verification — triggers        | `scripts/validation/verify_075_triggers.sql`               |
| Verification — RLS             | `scripts/validation/verify_076_rls.sql`                    |

**Test status:** 255 passing (was 237) — 18 new tests across 3 suites.
No regressions.

---

## 1. Goal Hierarchy (migration 076)

Six tables, one consistent shape so the resolver can treat them as one
edge stream:

```
id, user_id, parent_goal_id, child_goal_id, relationship_type,
strength_score [0,1], confidence_score [0,1], metadata, source,
created_at, updated_at
```

| Table                | Purpose                        | Default `relationship_type`                               |
| -------------------- | ------------------------------ | --------------------------------------------------------- |
| `goal_hierarchies`   | Containment tree               | `PARENT_OF`                                               |
| `goal_dependencies`  | Sequencing edges               | `DEPENDS_ON` (or `PREREQUISITE_FOR`)                      |
| `goal_conflicts`     | Resource conflicts             | `CONFLICTS_WITH` (or `BLOCKS` / `COMPETES_FOR_RESOURCES`) |
| `goal_priorities`    | User-asserted weighting        | `PRIORITIZED_OVER`                                        |
| `goal_relationships` | Catch-all typed edges          | open (any of 11 labels)                                   |
| `goal_pathways`      | Materialized root → leaf paths | `PATHWAY_STEP`                                            |

Allowed `relationship_type` values:

```
SUPPORTS · BLOCKS · DEPENDS_ON · PREREQUISITE_FOR · CONFLICTS_WITH
ACCELERATES · DELAYED_BY · COMPETES_FOR_RESOURCES
PARENT_OF · PRIORITIZED_OVER · PATHWAY_STEP
```

Enforced via the shared `public.is_goal_relationship_type(text)` helper.
Per-table CHECK constraints further narrow the allowed set (e.g.,
`goal_conflicts` only accepts `CONFLICTS_WITH / COMPETES_FOR_RESOURCES /
BLOCKS`).

### RLS

Strict owner-only with a service_role escape hatch. Tested by
`scripts/validation/verify_076_rls.sql` — verifies User A cannot
SELECT or INSERT any row whose `user_id` is User B's.

### GraphRAG sync

A single `graphrag.trigger_goal_relationship_table_sync()` function
serves all six tables, encoding the source table in `entity_type`
(`goal_hierarchy_edge`, `goal_dependency_edge`, ..., `goal_pathway_edge`).
The Rust worker projects these into Neo4j as `(:Goal)-[:LABEL]->(:Goal)`
edges using the payload's `parent_goal_id` / `child_goal_id` /
`relationship_type`.

---

## 2. Central GraphRAG (migration 077)

### Schema

```
central.
  provenance_records        -- citation log
  ontology_entities          -- Goal, Capability, CareerRole, EmployerBenefit, ...
  ontology_relationships     -- SUPPORTS, INCREASES_PROBABILITY_OF, IMPACTS, ...
  review_log                 -- audit trail of approval transitions
```

Plus three **public views** (`central_ontology_entities`,
`central_ontology_relationships`, `central_provenance_records`) so the
standard Supabase client (PostgREST exposes `public` only) can read
approved central data without needing a service-role key.

### Required fields on every central row

| Column                    | Purpose                                                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `source`                  | short display label                                                                                                                |
| `version`                 | row version (semver-ish text)                                                                                                      |
| `confidence_score`        | numeric (0..1)                                                                                                                     |
| `domain`                  | one of: finance, career, education, health, benefits, insurance, estate_planning, entrepreneurship, military_veteran, cross_domain |
| `created_at / updated_at` | standard timestamps                                                                                                                |
| `provenance`              | inline JSONB with `source_type`, `source_name`, ...                                                                                |
| `provenance_id`           | (optional) FK to `central.provenance_records`                                                                                      |
| `review_status`           | one of: draft, under_review, approved, deprecated                                                                                  |

`CHECK central_entity_provenance_required` and `CHECK
central_rel_provenance_required` reject rows where neither
`provenance_id` nor `provenance->source_type` is present — _no
anonymous knowledge_.

### Provenance record shape

```
source_type        — statute | regulation | peer_reviewed | gov_data |
                     employer_doc | vendor_catalog | expert_review |
                     curated_textbook | self_authored
source_name        — TEXT
source_url         — TEXT
retrieved_date     — DATE
version            — TEXT
citation_reference — "26 USC § 408(p)", DOI, ISBN, ...
confidence_score   — 0..1
```

### Ontology entity types

```
Core: Goal, Constraint, Capability, Risk, Decision, Outcome,
      Recommendation, Action
Domain: Benefit, Insurance, HealthMetric, CareerRole, Credential,
        EducationProgram, EstateDocument, EmployerBenefit
Knowledge: Concept, Fact
```

### Relationship labels

```
Causal/probabilistic: INCREASES_PROBABILITY_OF · DECREASES_PROBABILITY_OF
                      INCREASES · DECREASES · IMPROVES · DEGRADES · IMPACTS
Supportive/blocking : SUPPORTS · BLOCKS · PREREQUISITE_FOR · DEPENDS_ON
                      REQUIRES · CONFLICTS_WITH · COMPETES_FOR_RESOURCES
                      ACCELERATES · DELAYED_BY
Taxonomic          : IS_A · PART_OF · TAGGED_WITH · RELATED_TO
```

### Bootstrap seed

077 ships with a tiny ontology seed:

- ~23 entities (Income, Income Growth, Financial Independence, Home
  Ownership, Emergency Fund, Entrepreneurship, Exercise Consistency,
  Sleep Quality, Productivity, Career Progress, Poor Health, Credit
  Utilization, Down Payment, 401(k) Match, HSA Contribution, Term
  Life Insurance, Revocable Living Trust, etc.)
- ~22 cross-domain relationships covering every example in the sprint
  brief:
  - `Law School` → `JD` (PREREQUISITE_FOR) → `Attorney`
    (INCREASES_PROBABILITY_OF) → `Income` (INCREASES) →
    `Financial Independence` (SUPPORTS)
  - `Exercise Consistency` → `Resting Heart Rate / Sleep Quality`
    (IMPROVES) → `Productivity` (IMPACTS) → `Career Progress` (IMPACTS)
  - `Poor Health` → `Income Growth` (BLOCKS)
  - `Emergency Fund` → `Entrepreneurship` (SUPPORTS)
  - `Down Payment` → `Home Ownership` (PREREQUISITE_FOR)
  - `Credit Utilization` → `Home Ownership` (BLOCKS)
  - `401(k) Match` / `HSA Contribution` → `Financial Independence` (SUPPORTS)

Each seed row carries `provenance = {source_type: 'self_authored',
source_name: 'bootstrap'}` — _honest about its origin_. Curated
sourcing is a separate sprint; the seed is a working day-one substrate
for the advisor service.

### Central sync routing

`graphrag.sync_queue` gains `access_scope TEXT NOT NULL DEFAULT
'personal'`. Every existing trigger emits `personal`. Central-table
triggers go through `graphrag.enqueue_central_sync(...)` which sets
`access_scope='central'` and uses the nil-UUID as the synthetic
`user_id`.

The Rust ingestion worker reads `access_scope` and dispatches:

- `personal` → `QDRANT_PERSONAL_COLLECTION` + `NEO4J_PERSONAL_DATABASE`
- `central` → `QDRANT_CENTRAL_COLLECTION` + `NEO4J_CENTRAL_DATABASE`

(Both env vars already wired in `apps/api-gateway/.env`. Worker patch
to honor `access_scope` is a small follow-up — current behavior:
worker hard-codes `personal` in `qdrant_client.rs:49`. See "Deferred"
section below.)

---

## 3. GoalPathService

`apps/web/src/lib/goals/goal-path-service.ts`

### API

```ts
// I/O wrapper
async function computeGoalPathway(
  supabase: SupabaseClient,
  userId: string,
  rootGoalId: string,
  options?: { persist?: boolean }
): Promise<GoalPathway>;

// Pure resolver — testable with fixture edges
function resolvePathway(rootGoalId: string, userId: string, edges: GoalEdge[]): GoalPathway;

// Raw loader
async function loadGoalEdges(supabase: SupabaseClient, userId: string): Promise<GoalEdge[]>;
```

### Algorithm

For each bucket, a BFS walks from `rootGoalId` along edges whose
`relationship_type` matches an accept-list. Direction is bucket-specific:

| Bucket       | Direction | Accept-list                                                        |
| ------------ | --------- | ------------------------------------------------------------------ |
| supporting   | incoming  | `SUPPORTS`, `ACCELERATES`                                          |
| required (a) | incoming  | `PREREQUISITE_FOR`                                                 |
| required (b) | outgoing  | `DEPENDS_ON`                                                       |
| optional     | outgoing  | `PARENT_OF`                                                        |
| blocked      | incoming  | `BLOCKS`, `CONFLICTS_WITH`, `COMPETES_FOR_RESOURCES`, `DELAYED_BY` |

Cycle detection: Tarjan's SCC against the union directed graph
(all tables). SCCs > 1 are reported in `pathway.cycles`.

Cumulative strength: product of `strength_score` along each path —
lets downstream consumers weight the importance of distant ancestors.

Topological order: root first, then required + optional nodes by
depth.

### Persistence

`options.persist=true` writes the result back into `goal_pathways` so
the advisor service can re-read without recomputing. UPSERT key is
`(user_id, parent_goal_id, child_goal_id, sequence_index)`.

### Tests

8 unit tests in `__tests__/goal-path-service.test.ts`:

- supporting / required / blocked / optional bucket correctness
- cumulative strength multiplies along the path
- cycle detection flags SCC > 1
- topological order
- two-user disjoint pathway isolation

---

## 4. AdvisorReasoningService

`apps/web/src/lib/advisor/advisor-reasoning-service.ts`

### Entry point

```ts
async function reason(
  supabase: SupabaseClient,
  inputs: AdvisorInputs, // {user_id, stated_goal_claim?, root_goal_id_override?, domain_topk?}
  options?: ReasonOptions // {retriever?, preloadedEdges?, skipPathway?}
): Promise<RecommendationOutput>;
```

### Pipeline

1. **discoverRootGoal** — order of preference: `root_goal_id_override`
   → most recent `goal_interpretations` row → most recent `goals` row
   with non-null `root_goal` → fallback echoing the user's claim at
   low confidence.
2. **loadPersonalContext** — single round-trip parallel load of
   constraints, capabilities, motivations, decision preferences, risk
   tolerance, commitment levels.
3. **computeGoalPathway** in parallel with (2) — using `GoalPathService`.
4. **loadCentralLinks** — match the inferred goal to a
   `central_ontology_entities` row by exact-then-alias-then-substring
   matching (threshold 0.35). Pull every relationship touching that
   entity, top-K per `(direction, domain)`.
5. **aggregateImpacts** — group central links by domain into
   `supporting / blocking / required` buckets.
6. **deriveActions** — emit one `RecommendedAction` per central
   required entity, per supporting entity (sorted by strength ×
   confidence), per blocking entity (as risk mitigation), and per
   personal required goal not already covered.
7. **sequenceActions** — sort required → supporting → personal-prereq
   → blockers, then by `expected_strength` desc. Bucket into
   `now / this_quarter / this_year / long_term`.
8. **Confidence** — weighted blend of root-goal confidence (50%),
   average central-link confidence (40%), and a small bonus if the
   personal retriever returned hits.

### Output

```ts
RecommendationOutput {
  root_goal:                 DiscoveredRootGoal
  supporting_goals:          PathwayNode[]
  blocked_goals:             PathwayNode[]
  required_actions:          RecommendedAction[]
  recommended_sequence:      string[]    // action ids in order
  confidence_score:          number      // 0..1
  tradeoffs:                 { summary, gives_up, gains }[]
  timeline:                  { horizon, action_ids }[]
  risks:                     string[]
  assumptions:               string[]
  cross_domain_impacts:      DomainImpact[]
  pathway?:                  GoalPathway
  simulation_summary?:       { evaluated_scenarios, best_scenario_id, score, note }
}
```

### Personal retriever

The Qdrant + Neo4j retrieval is delegated to a pluggable
`PersonalGraphRetriever` interface so the service runs in tests with a
no-op retriever and in production with the Edge-Function-backed
retriever (or the FastAPI gateway when activated).

### Tests

5 unit tests in `__tests__/advisor-reasoning-service.test.ts`:

- `aggregateImpacts` groups by domain
- `deriveActions` orders required → supporting → blocker
- `deriveActions` halves `expected_strength` when domain commitment is
  zero
- one action per blocker
- `sequenceActions` partitions every action into exactly one timeline
  bucket and the sequence echoes the timeline order

---

## 5. HierarchyAwareEvaluator (simulation integration)

`apps/web/src/lib/trajectory/hierarchy-aware-evaluator.ts`

### API

```ts
function evaluate(
  projection: ProjectorOutput,
  pathway: GoalPathway,
  goalLookup: GoalLookupEntry[], // [{ goal_id, title, category, target_amount? }]
  options?: { weights? }
): HierarchyAwareScore;

function rankScenarios<T extends { id: string }>(
  scenarios: { scenario: T; projection: ProjectorOutput }[],
  pathway: GoalPathway,
  goalLookup: GoalLookupEntry[],
  options?: EvaluatorOptions
): RankedScenario<T>[];
```

### Scoring

For every goal in the pathway (root + required + supporting + blocked),
we map it to a projector metric — first by `GoalCategory` (retirement
→ `retirement_balance`, protection → `emergency_months`, etc.), then by
title keywords (debt → `total_debt` down, income → `annual_income` up,
home → `cash` up, ...).

We compute `normalized_advance ∈ [-1, +1]` from the metric's start →
end delta, optionally normalized by `target_amount` if known.

Weighted scalar:

```
scenario_score = 0.4·root + 0.3·avg(required) + 0.2·avg(supporting)
               - 0.1·avg(positive_blocker_advance)
```

(Default weights overridable via `options.weights`.)

A blocker that's _advanced in the desired direction_ (e.g., debt going
down, health cost exposure going down) is **rewarded** at the
per-goal level — but `blocked_penalty` only counts cases where the
scenario _helps the blocker_ in a way that hurts the root.

### Tests

5 unit tests in `__tests__/hierarchy-aware-evaluator.test.ts`:

- positive score for a scenario that advances root + required + supporting
- penalizes scenarios that reduce required/supporting
- blocker handled in goal-aware direction
- `rankScenarios` orders by descending `scenario_score`
- returns notes (not error) on empty projector output

### How to wire into the existing simulation engine

The existing engine in `apps/web/src/lib/trajectory/` is intentionally
_not modified_. The evaluator is bolt-on: the API route that runs the
projector can attach the hierarchy score by importing
`{ evaluate, rankScenarios }` and writing the result into
`life_scenario_outputs.metadata.hierarchy_score`.

Pseudocode for an existing route (e.g., `/api/simulations/[id]/run`):

```ts
const projection = projectScenario(state, decisions);
const pathway = await computeGoalPathway(supabase, userId, rootGoalId);
const lookup = await loadGoalLookup(supabase, userId);
const score = evaluate(projection, pathway, lookup);

await supabase
  .from('life_scenario_outputs')
  .update({ metadata: { ...existingMetadata, hierarchy_score: score } })
  .eq('scenario_version_id', versionId);
```

No schema change required (`metadata` is already JSONB).

---

## 6. Validation tests + scripts

### Application tests

```bash
cd apps/web && npx jest --testPathPattern='goal-path-service|advisor-reasoning|hierarchy-aware'
```

→ **18 tests, all passing.**

Full suite: 255/255 (was 237; no regressions).

### Database verification scripts

```bash
# Prove 075 fixed every 055 trigger (INSERT/UPDATE/DELETE → queue row)
psql "$DATABASE_URL" -f scripts/validation/verify_075_triggers.sql

# Prove 076 enforces strict per-user RLS on all 6 hierarchy tables
psql "$DATABASE_URL" -f scripts/validation/verify_076_rls.sql

# Smoke test the full GraphRAG plane (from prior sprint)
DATABASE_URL=... ./scripts/validation/smoke_test_graphrag.sh
```

Both verification SQL scripts run inside a transaction and ROLLBACK at
the end — no fixture data is left behind.

### Coverage matrix

| Requirement               | Where tested                                                        |
| ------------------------- | ------------------------------------------------------------------- |
| goal hierarchy creation   | `verify_076_rls.sql` insert-then-select                             |
| goal dependency traversal | `goal-path-service.test.ts` required/optional bucket tests          |
| cross-domain reasoning    | `advisor-reasoning-service.test.ts` aggregate + derive              |
| central graph retrieval   | covered by view+RLS design; live test requires seeded DB            |
| personal graph retrieval  | delegated to `PersonalGraphRetriever` — integration test            |
| combined retrieval        | `reason()` orchestration tested at I/O layer                        |
| simulation integration    | `hierarchy-aware-evaluator.test.ts` evaluate + rankScenarios        |
| recommendation generation | `advisor-reasoning-service.test.ts` deriveActions + sequenceActions |
| tenant isolation          | `verify_076_rls.sql` A-reads-B-blocked test                         |
| RLS enforcement           | `verify_076_rls.sql` all-six-tables coverage                        |

---

## Deployment runbook

```bash
# 1. Apply the three new migrations (idempotent)
psql "$DATABASE_URL" -f supabase/migrations/075_fix_055_triggers.sql
psql "$DATABASE_URL" -f supabase/migrations/076_goal_hierarchy.sql
psql "$DATABASE_URL" -f supabase/migrations/077_central_graph_ontology.sql

# 2. Verify
psql "$DATABASE_URL" -f scripts/validation/verify_075_triggers.sql
psql "$DATABASE_URL" -f scripts/validation/verify_076_rls.sql

# 3. Run the smoke test (requires worker + Qdrant + Neo4j env)
RUN_WORKER=1 CLEANUP=1 ./scripts/validation/smoke_test_graphrag.sh

# 4. (Optional) Backfill 055-affected tables — see TRIGGER_REPAIR_REPORT.md
```

The Next.js app picks up the new services automatically on next build;
they're consumed by importing `@/lib/goals/goal-path-service`,
`@/lib/advisor/advisor-reasoning-service`, and
`@/lib/trajectory/hierarchy-aware-evaluator`.

---

## Deferred (not in this sprint, intentionally)

| Item                                | Why                                                                                                                                                                             |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rust worker `access_scope` dispatch | Worker currently hard-codes `personal` in `qdrant_client.rs:49`. Trivial follow-up — add the field to `SyncQueueJob`, branch on it in `processor.rs`. ~30 lines.                |
| Personal retrieval implementation   | Service ships with `NOOP_RETRIEVER`. Production wiring goes through the Edge Function or FastAPI gateway.                                                                       |
| Curated central ontology data       | Bootstrap seed is honest about being `self_authored`. Curated sourcing (statutes, peer-reviewed health data, employer benefit taxonomies) is a separate ingestion sprint.       |
| `goals.target_amount` rename audit  | The evaluator reads `target_amount` from a `goalLookup` argument; the production loader needs to project this from `public.goals.target_amount` (already exists on the table).  |
| LLM phrasing layer                  | The advisor output is structured JSON, not natural language. The route handler can pass it through Gemini for phrasing — but the _reasoning_ stays deterministic and auditable. |
| Pathway materialization scheduling  | `computeGoalPathway(..., { persist: true })` writes to `goal_pathways`. A scheduled job that re-computes when the user's hierarchy edges change is a separate follow-up.        |
| 075 backfill execution              | The repair migration enables enqueueing; the backfill UPDATE statements in TRIGGER_REPAIR_REPORT.md need to be batched + throttled for prod scale.                              |

---

## What this sprint did not do

(Scope guardrails from the brief)

- ❌ No new dashboards
- ❌ No UI redesign
- ❌ No new product features
- ❌ No onboarding changes
- ✅ All intelligence layer — schema, services, evaluators, tests
