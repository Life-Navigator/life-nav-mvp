# XAI + Trust Layer — Implementation

LifeNavigator now answers all five trust questions **deterministically**.
No LLM mediates the answer path. Same inputs → same answers, every time.

| Question                                  | API                                                             | Backed by                                                     |
| ----------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| **Why?**                                  | `GET /api/recommendations/[id]/why`                             | `WhyChainBuilder` (pure)                                      |
| **Why is that important?**                | same chain, walk `because → supported_by → in_context_of` edges | `WhyChainBuilder`                                             |
| **What evidence supports this?**          | `GET /api/recommendations/[id]/evidence`                        | `buildEvidenceGraph` (pure)                                   |
| **What assumptions are you making?**      | `GET /api/recommendations/[id]/assumptions`                     | `AssumptionEngine` (severity classifier + sensitivity ranker) |
| **What would change the recommendation?** | `POST /api/recommendations/[id]/counterfactuals`                | `CounterfactualEngine` (re-runs engines under perturbations)  |

Plus a 6th read for full audit:

|                                  | API                                         |                                                       |
| -------------------------------- | ------------------------------------------- | ----------------------------------------------------- |
| Full deterministic trust surface | `GET /api/recommendations/[id]/audit-trail` | All four pure services + `recommendation_audit_trail` |

No new dashboards. No onboarding changes.

## Verification snapshot

| Check                                            | Result                                        |
| ------------------------------------------------ | --------------------------------------------- |
| Rust `cargo test`                                | **42 / 42** (was 39; +3 `xai_entities.rs`)    |
| Rust `cargo fmt --check`                         | clean                                         |
| Rust `cargo clippy --all-targets -- -D warnings` | clean                                         |
| Web strict `tsc --noEmit -p tsconfig.json`       | clean                                         |
| Web jest                                         | **473 / 473** (was 438; +35)                  |
| Migration 082 self-test                          | raises if any of 5 tables lacks RLS           |
| `verify_082_xai_rls.sql`                         | per-table A↔B isolation + 2 write-as-B blocks |

---

## The determinism contract

Every engine in this sprint is a **pure function** with no walltime
inputs (except an optional `computed_at` parameter that defaults to
the unix epoch). The KEY tests are:

```ts
test('SAME input produces BYTE-IDENTICAL chain (the trust contract)', () => {
  const a = buildWhyChain({ kind: 'recommendation_output', value: rec() }, { user_id: 'u1' });
  const b = buildWhyChain({ kind: 'recommendation_output', value: rec() }, { user_id: 'u1' });
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
});

test('same input → byte-identical evidence graph (determinism)', () => { ... });

test('same DecisionImpact inputs → identical counterfactual list', () => { ... });

test('output is deterministic for identical inputs', () => { ... });
```

This is what makes the five trust questions answerable: the user gets
the same answer for the same recommendation, every time. An LLM
phrasing layer may rephrase the structured payload at the route
handler, but **the structure itself is the source of truth**.

---

## Schema (migration 082)

Five tables, all in the existing `decision_intelligence` schema,
strict owner-only RLS, sync-triggered through the existing
`trigger_decision_intel_sync()` extended in 082.

| Table                        | Purpose                                                                                                                                                                                  |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recommendation_audit_trail` | One row per recommendation generation. Carries `input_snapshot` + `engine_versions` + `intermediate` + `output_summary`. Unique per `(user_id, advisor_run_id, target_kind, target_id)`. |
| `why_chains`                 | Stored DAG: `nodes JSONB` (claim + depth + grounded_in + confidence) and `edges JSONB` (parent → child + label).                                                                         |
| `evidence_links`             | Per-target evidence rows linking to central_ontology / personal_history / pathway_effectiveness / etc., with citation_reference + weight.                                                |
| `counterfactual_scenarios`   | Pre-computed perturbations with `expected_outcome ∈ {no_change, reranked, flipped, timeline_shifted, confidence_changed}` and a `sensitivity` score.                                     |
| `recommendation_assumptions` | First-class indexed assumption storage with `severity ∈ {informational, load_bearing, critical}` and a `sensitivity` score.                                                              |

Domain enums enforced via CHECK predicate functions
(`is_audit_target_kind`, `is_evidence_source_kind`,
`is_assumption_severity`, `is_counterfactual_outcome`).

---

## Engine architecture

```
                ┌──────────────────────────────────────────────────┐
                │  AdvisorReasoningService / DecisionImpactEngine /│
                │  ProbabilityEngine / CatchUpEngine / etc.        │
                └──────────────────────┬───────────────────────────┘
                                        │
                                        ▼
                          ╔═══════════════════════════╗
                          ║   recommendation_audit_   ║
                          ║         trail             ║   (frozen snapshot)
                          ╚═════════════╦═════════════╝
                                        │
                ┌───────────────────────┼───────────────────────┐
                │                       │                       │
                ▼                       ▼                       ▼
       ┌─────────────────┐   ┌───────────────────┐   ┌──────────────────┐
       │ WhyChainBuilder │   │ EvidenceGraph     │   │ AssumptionEngine │
       │  (pure)         │   │  Builder (pure)   │   │  (pure)          │
       └────────┬────────┘   └─────────┬─────────┘   └─────────┬────────┘
                │                      │                       │
                ▼                      ▼                       ▼
       ┌─────────────────┐   ┌───────────────────┐   ┌──────────────────┐
       │  why_chains     │   │  evidence_links   │   │ recommendation_  │
       │                 │   │                   │   │  assumptions     │
       └─────────────────┘   └───────────────────┘   └──────────────────┘
                                        │
                                        ▼
                          ┌──────────────────────────┐
                          │   CounterfactualEngine   │  (pure, re-runs
                          │                          │   the engines under
                          │                          │   perturbations)
                          └────────────┬─────────────┘
                                        ▼
                          ┌──────────────────────────┐
                          │ counterfactual_scenarios │
                          └──────────────────────────┘
```

Every box is a **pure function** of its input. The ones with sides
talk to Supabase only for persistence — they read nothing dynamic
that could change the answer.

---

## WhyChainBuilder

`apps/web/src/lib/decision/why-chain-builder.ts`

```ts
buildWhyChain(target, { user_id, max_depth?, computed_at? }) → WhyChain
```

- `target` is one of six discriminated-union shapes: `recommendation_output`,
  `goal_decision_impact`, `goal_probability_distribution`,
  `catch_up_plan`, `ahead_of_plan_plan`, `marginal_impact_ranking`.
- Returns `{ nodes, edges, max_depth, computed_at }`.
- Each node = `{ id, depth, claim, grounded_in?, confidence }`.
- Each edge = `{ parent_node_id, child_node_id, label }` where label ∈
  `because | supported_by | requires | depends_on | in_context_of`.

Recursion is capped at `max_depth` (default 5). With `max_depth=1`,
every node's `depth ≤ 1`.

For a recommendation, the chain assembles:

```
[root]   Recommendation aims to advance: Financial Independence
  ├─ because   Top required action: Build emergency fund
  │             └─ supported_by   Rationale: reserve
  ├─ in_context_of   Pathway: Income Growth First
  │                    └─ supported_by   Historical effectiveness: n=42, success_rate=0.71 (cohort)
  ├─ supported_by   Calibrated confidence 55% based on your historical accuracy.
  ├─ supported_by   Evidence (central_ontology): CFA Charter
  ├─ supported_by   Evidence (pathway_effectiveness): Income Growth First (n=42)
  ├─ supported_by   Evidence (personal_history): Recent completed actions
  └─ depends_on   1 goal(s) currently block this; addressing them lifts the ceiling.
```

**Tests (15 in `why-chain-builder.test.ts`):** determinism contract
(byte-identical output), per-target structure (recommendation /
impact / probability / catch-up), max_depth honored, fixed default
`computed_at`.

---

## CounterfactualEngine

`apps/web/src/lib/decision/counterfactual-engine.ts`

Three pure functions, one per target kind:

```ts
counterfactualsForDecisionImpact(inputs) → CounterfactualResult[]
counterfactualsForProbability(inputs, horizon) → CounterfactualResult[]
counterfactualsForCatchUp(inputs) → CounterfactualResult[]
```

Each function enumerates a fixed set of perturbations, re-runs the
relevant engine, and ranks by sensitivity (= magnitude of output
change / magnitude of input change).

| Target                          | Perturbations                                                                                      |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| `goal_decision_impact`          | base_magnitude halved, base_magnitude doubled, reclassified as structural, peak_months pulled to 3 |
| `goal_probability_distribution` | current_progress ±10pp, supporting_goals_count +3, hard_constraint_count cleared                   |
| `catch_up_plan`                 | available_surplus doubled, commitment_hours +5, risk_tolerance raised to 0.9                       |

Each result returns:

```ts
{
  scenario_label, perturbation: { input_field, from, to, magnitude },
  expected_outcome: 'no_change' | 'reranked' | 'flipped' | 'confidence_changed' | 'timeline_shifted',
  new_top_recommendation?, new_confidence?, delta_summary, sensitivity
}
```

**Tests (5 in `counterfactual-and-assumption.test.ts`):** determinism,
structural flip changes outcome bucket, ranked by sensitivity desc,
probability-current_progress perturbation, surplus doubling improves
catch-up.

---

## AssumptionEngine

`apps/web/src/lib/decision/assumption-engine.ts`

Two-stage deterministic classifier:

1. **Severity classifier** — hand-coded regex patterns bucket each
   assumption string into `critical | load_bearing | informational`.

   | Severity        | Pattern examples                                                                                                                                      |
   | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `critical`      | `treated as structural`, `hard constraint`, `no matching pathway`, `no supporting goals`, `no user constraints/capabilities`, `structural life event` |
   | `load_bearing`  | `base magnitude`, `peak effect`, `widens/narrows`, `scenario-based estimates`, `commitment hours`, `surplus`                                          |
   | `informational` | everything else                                                                                                                                       |

2. **Sensitivity scoring** — `severity_base × (1 + structural_bonus) × confidence`.

3. **Aggregation** — dedupe by lowercase text, keep higher sensitivity
   copy, sort by `(severity, sensitivity desc, text asc)`.

**Tests (10 in `counterfactual-and-assumption.test.ts`):** severity
matrix (7 cases), sensitivity monotonicity, aggregation dedupe,
ordering, determinism, full-extraction across engine outputs.

---

## EvidenceGraph + AuditTrail

`apps/web/src/lib/decision/audit-and-evidence.ts`

```ts
buildEvidenceGraph(target, { user_id, computed_at? }) → EvidenceGraph
persistEvidenceLinks(supabase, userId, kind, id, graph, audit?) → number
recordAudit(supabase, AuditTrailEntry) → { id }
```

The graph is rooted at a `self_report` node representing the target
itself; children represent each `XAIExplanation.evidence[]` entry
plus target-specific evidence (pathway effectiveness, calibrated
confidence, central-ontology action grounding, etc.).

**Tests (3):** determinism, root node + downstream evidence
non-empty, every non-root node has an inbound edge.

---

## API surface — 5 routes

All routes interpret `[id]` as a `recommendation_audit_trail.id` and
load the row under RLS. The `output_summary` and `input_snapshot`
columns are the inputs to the pure engines.

```
GET  /api/recommendations/[id]/why                 → { chain: WhyChain }
GET  /api/recommendations/[id]/evidence            → { graph: EvidenceGraph }
GET  /api/recommendations/[id]/assumptions         → { assumptions: AssumptionItem[] }
POST /api/recommendations/[id]/counterfactuals     → { scenarios: CounterfactualResult[] }
GET  /api/recommendations/[id]/audit-trail         → { entry, why_chains, evidence_links,
                                                       assumptions, counterfactual_scenarios }
```

All routes derive `user_id` strictly from the server session — never
the request body. The persist side-effects (writing into `why_chains`,
`evidence_links`, `recommendation_assumptions`,
`counterfactual_scenarios`) are best-effort and bounded by RLS.

---

## GraphRAG sync — Rust worker extended

Migration 082 extends `trigger_decision_intel_sync()` with mappings
for the 5 new tables. The Rust worker has new `EntityType` variants
plus Person→entity edge labels matching the spec:

| Entity                       | Edge label          |
| ---------------------------- | ------------------- |
| `recommendation_audit_trail` | `AUDITED_BY`        |
| `why_chain`                  | `HAS_WHY_CHAIN`     |
| `evidence_link`              | **`SUPPORTED_BY`**  |
| `counterfactual_scenario`    | `COUNTERFACTUAL_OF` |
| `recommendation_assumption`  | `ASSUMED_BY`        |

Plus summary builders that name the key fields (`target_kind`,
`severity`, `sensitivity`, `delta_summary`, `source_kind`,
`source_label`) so phrase-match retrieval can find them.

**Rust tests (3 in `xai_entities.rs`):** parses, named edge, non-empty
summary — all 5 new variants.

---

## Validation matrix

| Spec / success criterion                             | Test                                                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| User can ask "Why?" and get a deterministic answer   | `WhyChainBuilder.test.ts` (the determinism contract test in particular)                                                         |
| User can ask "Why is that important?"                | The chain walks `because → supported_by → in_context_of`; each node has `claim` text — verified by the per-target builder tests |
| User can ask "What evidence supports this?"          | `buildEvidenceGraph` determinism + structure tests                                                                              |
| User can ask "What assumptions are you making?"      | severity classifier + aggregation + extraction tests                                                                            |
| User can ask "What would change the recommendation?" | counterfactual engine determinism + sensitivity-ranking tests                                                                   |
| Every answer is **deterministic**                    | byte-identical assertion in 4 test files                                                                                        |
| RLS enforced                                         | `verify_082_xai_rls.sql` (12 isolation + 2 write-as-B blocks)                                                                   |
| GraphRAG sync works                                  | Rust `xai_entities.rs` (3 tests) + migration self-test                                                                          |

---

## Apply + verify runbook

```bash
psql "$DATABASE_URL" -f supabase/migrations/082_xai_and_trust_layer.sql
psql "$DATABASE_URL" -f scripts/validation/verify_082_xai_rls.sql

pnpm --filter @life-navigator/web test \
  --testPathPattern='why-chain-builder|counterfactual-and-assumption'

cd apps/ingestion-worker
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

Expected:

- Migration applies cleanly + self-test passes + no destructive
  statements.
- RLS verifier prints `ALL PASS`.
- Web jest 473/473; cargo 42/42; fmt + clippy silent.

---

## What this sprint did NOT do

- ❌ No new dashboards. The 5 API routes return structured JSON; a
  future UI can consume the shapes.
- ❌ No LLM in the answer path — by design. The route handlers MAY
  pass the structured payload through Gemini for _paraphrasing_ in a
  user-facing chat, but the **answer** (chain / evidence / assumptions /
  counterfactuals) is computed deterministically.
- ❌ No central-cohort XAI. The trust layer is per-user; cohort
  patterns are a separate sprint.
- ❌ Arcana integration is still gated behind Sprint C — the user's
  XAI surface is ready, but Arcana lead packages aren't generated until
  Sprint C activates the health domain.

---

## Where this fits in the overall stack

```
   ┌────────────────────────────────────────────┐
   │ 060–067  User Graph + Onboarding           │
   │ 068      Root Goal Discovery               │
   │ 070      Dynamic Goal Optimizer            │
   │ 071      Life Trajectory Simulation        │
   │ 076      Goal Hierarchies                  │
   │ 077      Central Ontology                  │
   │ 078      Curated Central Knowledge         │
   │ 079      Decision Journal + Learning       │
   │ 080      Goal Progress + Calibration       │
   │ 081      Decision Impact + Probability     │  (Sprint F)
   │ 082      XAI + Trust Layer                 │  ◄── THIS SPRINT
   └────────────────────────────────────────────┘
```

Every output from Sprints A through F now has a deterministic answer
to all five trust questions. The user is no longer interacting with a
black box.
