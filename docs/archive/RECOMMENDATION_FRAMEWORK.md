# RECOMMENDATION FRAMEWORK

The reusable recommendation+evidence machinery every domain inherits. A domain supplies
**generators** (compute the recommendation from its data); the framework supplies
**persistence, graph fan-out, governance, replay, and chat retrieval**. Extracted from the
shipped Finance implementation. Design spec — no code change in this pass.

## Base types

### `RecommendationBase`

| Field                                                                | Type                                              | Required | Notes                                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| `id`                                                                 | uuid                                              | ✓        | **deterministic** = uuid5(NS, `"{user_id}:{slug}"`) → idempotent upsert + stable graph node id |
| `user_id` / `tenant_id`                                              | uuid                                              | ✓        | from verified JWT, never the body                                                              |
| `title`                                                              | text                                              | ✓        | one line                                                                                       |
| `description`                                                        | text                                              | ✓        | the "why"                                                                                      |
| `recommendation_type`                                                | text                                              | ✓        | domain enum (`emergency_fund`, `improve_sleep`, …)                                             |
| `priority`                                                           | high\|medium\|low                                 | ✓        |                                                                                                |
| `confidence`                                                         | numeric(4,3)                                      | ✓        | 0–1                                                                                            |
| `governance_verdict`                                                 | jsonb                                             | ✓        | `{passed, boundary_type, disclaimer_text, requires_human_review, escalation_path}`             |
| `status`                                                             | active\|accepted\|rejected\|dismissed\|superseded | ✓        | lifecycle                                                                                      |
| `evidence_json` / `assumptions_json` / `tradeoffs_json`              | jsonb[]                                           | ✓        | structured children (below)                                                                    |
| `source_tables` / `source_graph_nodes`                               | text[]                                            | ✓        | provenance                                                                                     |
| `derived_by`                                                         | text                                              | ✓        | engine id, for replay/audit                                                                    |
| `created_at`/`updated_at`/`accepted_at`/`rejected_at`/`dismissed_at` | timestamptz                                       | ✓/opt    | lifecycle stamps                                                                               |

### `EvidenceBase` (one per supporting fact)

`metric_name` ✓ · `metric_value` ✓ · `source_table` ✓ (the **fact's** origin) · `source_entity_id` opt · `observed_at` ✓ · `confidence` ✓ (0–1) · `explanation` ✓.

### `AssumptionBase`

`assumption_text` ✓ · `confidence` ✓ · `expires_at` opt · `user_confirmed` ✓ (bool) · `source` ✓ (`model`\|`user`\|`default`).

### `TradeoffBase`

`option_a` ✓ · `option_b` ✓ · `benefit` ✓ · `cost` ✓ · `affected_domains` ✓ (list).

### `AdviceBoundaryBase`

`boundary_type` ✓ (`financial_planning`\|`medical`\|`legal`\|`tax`\|…) · `disclaimer_text` ✓ · `requires_human_review` ✓ (bool) · `escalation_path` ✓ (`licensed_advisor`\|`physician`\|`arcana_referral`\|…).

## Lifecycle

```
generate() ──▶ persist (upsert, deterministic id) ──▶ trigger enqueues ──▶ worker fan-out
   │                                                                            │
   └─ no inputs → nothing; no evidence → not persisted (never fabricate)        ▼
status: active ──(user)──▶ accepted | rejected | dismissed   |  (re-generate)──▶ superseded
```

- **Generation:** deterministic from domain data; identity from JWT.
- **Idempotent persistence:** uuid5 id + PostgREST `resolution=merge-duplicates`; repeated `generate` updates in place (no duplicates).
- **No recommendation without evidence**, and **no recommendation without required inputs** (returns a missing-data prompt instead).

## Persistence

`finance.financial_recommendations` is the per-domain table (identical columns). Service-role
writes only (`SupabaseClient.upsert(schema=<domain>)`), owner-scoped RLS, `security_invoker`
read view for the frontend/chat.

## Graph behavior (worker fan-out — domain-agnostic)

Processing a `*_recommendation` row creates:

```
(:UserProfile)-[:HAS_RECOMMENDATION]->(:DomainRecommendation)
(:DomainRecommendation)-[:HAS_EVIDENCE]->(:Evidence)         // one per evidence_json item
(:DomainRecommendation)-[:HAS_ASSUMPTION]->(:Assumption)
(:DomainRecommendation)-[:HAS_TRADEOFF]->(:Tradeoff)
(:DomainRecommendation)-[:REQUIRES_REVIEW]->(:AdviceBoundary) // when governance carries a boundary
```

Child `entity_id` = `{rec_id}::{type}::{idx}` (deterministic → MERGE idempotent). Children
inherit the parent's tenant/user (no cross-tenant). Evidence node keeps the **fact's**
`source_table`. `Evidence/Assumption/Tradeoff/AdviceBoundary` are worker-created from JSON —
NOT Supabase tables, so they have **no triggers**. (`normalizer::expand_children`.)

## Governance

Every recommendation carries a `governance_verdict`; when it includes `boundary_type`/
`disclaimer_text`, the worker materializes an `:AdviceBoundary` node + `REQUIRES_REVIEW`
edge. Domains set their own boundary types + escalation (Finance: `financial_planning` →
`licensed_advisor`; Health: `medical` → `physician`/`arcana_referral` — see HEALTH_GOVERNANCE).

## Replay

Recommendations are data, not transient text: the persisted row (with `derived_by`,
`evidence_json`, `source_tables`) survives model changes and can be re-rendered or
re-grounded. Re-running the engine MERGEs the same ids — deterministic replay.

## Acceptance / rejection

`POST .../recommendations/{id}/{accept|reject|dismiss}` sets `status` + the matching
timestamp (owner-scoped). A re-generated recommendation whose inputs changed is marked
`superseded`. Status is on the `security_invoker` view for the UI.

## Chat retrieval

`Retriever.recommendation_evidence(ctx)` traverses the user's recommendation subgraph
(tenant-scoped Cypher) → authoritative facts (`evidence`, `assumption`, `governance`).
`ContextBuilder` injects them so "why are you recommending this?" is answered strictly from
graph evidence; **no recommendation → missing-data path** (the anti-hallucination gate).
Verified live in Finance.

## What a domain supplies vs inherits

- **Inherits (this framework):** the 5 base types, the table shape, RLS/trigger pattern,
  worker fan-out, persistence lifecycle, governance materialization, chat retrieval.
- **Supplies:** `recommendation_type` enum values, the **generators** (`persist_recommendations`
  body) that compute evidence/assumptions/tradeoffs from the domain's data, and the domain's
  boundary types/escalation.
