# Central Knowledge + Advisor Intelligence — Implementation

This sprint turns the Central Graph from a 23-entity bootstrap into a
**curated institutional knowledge system** and wires up an
**AdvisorConversationAgent** that uses Gemini _only_ for explanation
while keeping the reasoning core deterministic and auditable.

No new UI. No new dashboards. Intelligence layer only.

## Phases

| Phase | Goal                            | Deliverable                                                                                                      |
| ----- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1     | Worker access_scope routing     | `apps/ingestion-worker/{queue,config,qdrant_client,neo4j_client,processor,main}.rs` + `tests/central_routing.rs` |
| 2     | Curated knowledge for 6 domains | `supabase/migrations/078_central_curated_knowledge.sql` + `scripts/validation/verify_078_central_seed.sql`       |
| 3     | Advisor conversation agent      | `apps/web/src/lib/advisor/advisor-conversation-agent.ts` + `apps/web/src/types/conversation.ts` + tests          |

## Verification snapshot

| Component                                           | Status                                                                      |
| --------------------------------------------------- | --------------------------------------------------------------------------- |
| Rust `cargo test`                                   | **33 passed / 33** (was 25; +8 central_routing)                             |
| Rust `cargo fmt --check`                            | clean                                                                       |
| Rust `cargo clippy --all-targets -- -D warnings`    | clean                                                                       |
| Rust `cargo build --release --bin ingestion-worker` | clean                                                                       |
| Web `tsc --noEmit -p tsconfig.check.json`           | 0 errors                                                                    |
| Web `jest`                                          | **280 passed / 280** (was 255; +25 conversation-agent)                      |
| Migration 078 self-test                             | embedded `DO $$ ... $$` raises if any domain < 6 approved entities          |
| `scripts/validation/verify_078_central_seed.sql`    | reports per-domain counts + provenance integrity + cross-domain spot-checks |

---

## Phase 1 — Worker access_scope routing

### What changed

Before: the Rust ingestion worker hard-coded `access_scope: "personal"`
in `qdrant_client.rs` and addressed a single Qdrant collection / Neo4j
database. Personal vs central was a TODO.

Now: every `SyncQueueJob` carries `access_scope: AccessScope`
(`Personal | Central`), and the processor holds **four** clients —
two Qdrant, two Neo4j — picked per job.

```
SyncQueueJob { access_scope = Personal }
    → QdrantClient(personal_collection)  +  Neo4jClient(personal_database)

SyncQueueJob { access_scope = Central }
    → QdrantClient(central_collection)   +  Neo4jClient(central_database)
```

### Files touched

| File                       | Change                                                                                                                                                                                           |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/queue.rs`             | New `AccessScope` enum (defaults to `Personal`); new field on `SyncQueueJob` deserialized from the queue row.                                                                                    |
| `src/config.rs`            | Adds `qdrant_central_collection` (env `QDRANT_CENTRAL_COLLECTION`, default `ln_central`) and `neo4j_central_database` (env `NEO4J_CENTRAL_DATABASE`, default `central`).                         |
| `src/qdrant_client.rs`     | `with_scope(cfg, scope)` constructor; `build_payload_with_scope` writes the scope into the payload; `upsert` honors the client's scope rather than hard-coding `"personal"`.                     |
| `src/neo4j_client.rs`      | `with_scope(cfg, scope)` constructor; per-instance `database` selection.                                                                                                                         |
| `src/processor.rs`         | Now holds `qdrant_personal`, `qdrant_central`, `neo4j_personal`, `neo4j_central`; `route(scope)` picks the pair per job. Logs `access_scope` and the chosen collection/database on every upsert. |
| `src/main.rs`              | Builds all four clients at startup and logs the routing topology once.                                                                                                                           |
| `tests/central_routing.rs` | **NEW** — 8 unit tests proving routing contract.                                                                                                                                                 |

### Routing contract — 8 tests in `tests/central_routing.rs`

```
default_access_scope_is_personal                           ✓
central_scope_string_is_central                            ✓
job_deserializes_access_scope_from_row_json                ✓
job_defaults_to_personal_when_column_missing               ✓
qdrant_payload_for_personal_scope_says_personal            ✓
qdrant_payload_for_central_scope_says_central              ✓
legacy_build_payload_still_returns_personal_for_back_compat ✓
personal_and_central_payloads_have_distinct_scope_values   ✓
```

The pre-077 default ensures jobs queued before this deploy continue
to route into the personal sinks during the rollover window.

### Retrieval-side routing

The Edge Function (`supabase/functions/graphrag-query/index.ts`) and
the FastAPI gateway (`apps/api-gateway/app/services/qdrant.py`)
already split filters by `access_scope`:

- **personal retrieval**: `must: [{tenant_id=$uid}, {user_id=$uid}, {access_scope='personal'}]`
- **central retrieval**: `must: [{access_scope='central'}]` (no tenant filter — central is global)

The worker change closes the loop: a row inserted into
`central.ontology_entities` now flows
`Postgres trigger → graphrag.enqueue_central_sync → sync_queue (access_scope='central') →`
**central Qdrant collection + central Neo4j database**, and is reachable
from the existing retrieval call paths without any code change there.

---

## Phase 2 — Central Knowledge Domains

### Migration 078 — what it adds

`supabase/migrations/078_central_curated_knowledge.sql` inserts curated,
**cited** knowledge for all six domains. Every row carries:

```
source            — short label ("central_curated_v1")
version           — "1"
confidence_score  — calibrated per source type
domain            — finance | career | education | health | estate_planning | military_veteran
provenance        — inline JSONB { source_type, source_name, source_url, citation_reference }
provenance_id     — FK to central.provenance_records (enforces "no anonymous knowledge")
review_status     — 'approved' (the worker only projects approved rows)
```

The migration ends with a `DO $$ ... $$` block that **raises** if any
domain ends up with fewer than 6 approved entities.

### Coverage by domain

| Domain              | Entities | Relationships | Top sources                                                                                                                              |
| ------------------- | -------: | ------------: | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **Finance**         |       30 |            30 | 26 USC § 401(k) / § 408 / § 223, IRS Pub 590-A / 590-B / 969, CFPB Owning a Home + Credit Score, FINRA Asset Allocation, Bogleheads Wiki |
| **Career**          |       18 |            20 | BLS OOH 2024, BLS OEWS May 2023, O\*NET 28.3, CFA Institute, PMI PMP                                                                     |
| **Education**       |       12 |            15 | NCES IPEDS 2023, Federal Student Aid, VA Post-9/11 GI Bill, IRS Pub 590-A (§127)                                                         |
| **Health**          |       18 |            19 | ACSM PAG, AHA 2024, PMID: 29073412 (sleep), DGA 2020-2025, Atomic Habits (curated)                                                       |
| **Estate Planning** |       12 |             9 | ABA RPTE, UTC, CMS Advance Directives                                                                                                    |
| **Veteran**         |        8 |            13 | VA Disability, VA Chapter 31, DOL TAP, VA Post-9/11 GI Bill                                                                              |
| **Totals**          |   **98** |       **106** | + 30 provenance records covering 9 source types                                                                                          |

Adding to the 23 bootstrap entities + 22 bootstrap relationships from
077, the central graph now has **~121 entities** and **~128
relationships** spanning all six target domains.

### Provenance — source-type confidence calibration

| `source_type`      | Typical confidence | Examples                                                    |
| ------------------ | ------------------ | ----------------------------------------------------------- |
| `statute`          | 0.90–0.95          | 26 USC § 401(k), 26 USC § 408, 26 USC § 223                 |
| `regulation`       | 0.90–0.95          | IRS Pub 590-A, IRS Pub 590-B, IRS Pub 969                   |
| `gov_data`         | 0.85–0.95          | BLS OEWS, BLS OOH, NCES IPEDS, va.gov, CFPB, studentaid.gov |
| `expert_review`    | 0.80–0.90          | ACSM PAG, AHA, FINRA, ABA RPTE                              |
| `peer_reviewed`    | 0.80–0.85          | PubMed-indexed reviews/meta-analyses                        |
| `vendor_catalog`   | 0.85–0.90          | CFA Institute, PMI                                          |
| `curated_textbook` | 0.65–0.80          | Bogleheads Wiki, Atomic Habits                              |
| `self_authored`    | 0.50–0.55          | (077 bootstrap only — flagged honestly)                     |

Confidence flows into `AdvisorReasoningService` as a multiplier on
strength, which means recommendations grounded in statute outweigh
recommendations grounded in curated frameworks — by design.

### Sample cross-domain edges (now traversable)

```
Skill: Python   ─INCREASES_PROBABILITY_OF→ Software Developer (SOC 15-1252)
                                            │
                                            └─INCREASES→ Income ─SUPPORTS→ Financial Independence

CFA Charter     ─INCREASES_PROBABILITY_OF→ Personal Financial Advisor ─INCREASES→ Income → FI

Sleep Duration  ─IMPACTS→ Productivity        (via PMID: 29073412)
AHA Aerobic     ─IMPROVES→ VO2max + Resting Blood Pressure
                                              │
                                              └─IMPROVES→ Productivity → Career Progress

GI Bill Ch33    ─SUPPORTS→ Bachelor's Degree ─PREREQUISITE_FOR→ Software Developer
VR&E (Ch31)     ─SUPPORTS→ Income Growth + Bachelor's Degree
VA Disability   ─INCREASES→ Cash Flow Surplus + Income (tax-free)

Conventional 30-Y Mortgage ─PREREQUISITE_FOR→ Home Ownership
DTI                        ─BLOCKS→ Conventional 30-Y Mortgage
FICO Score                 ─INCREASES_PROBABILITY_OF→ Conventional 30-Y Mortgage
Credit Utilization < 30%   ─INCREASES→ FICO Score

Healthcare FSA  ─CONFLICTS_WITH→ HSA (Health Savings Account)
Marginal Tax Bracket ─IMPACTS→ Traditional 401(k), Roth IRA, HSA
```

These are the edges that turn the advisor's recommendations from
"more emergency fund" into "more emergency fund **because** it
unlocks entrepreneurship per your stated root goal, sourced from
Bogleheads-style framework + 26 USC".

### Verification

```bash
psql "$DATABASE_URL" -f scripts/validation/verify_078_central_seed.sql
```

Reports six tables of evidence:

1. Approved entities by domain (≥6 per domain)
2. Approved relationships by domain
3. Provenance integrity — every approved row has a `provenance_id`
4. Provenance source-type distribution
5. Cross-domain spot-checks (CFA → ?, ? → Productivity, Veteran → ?)
6. `sync_queue` access_scope routing for `source_table LIKE 'central.%'`
7. Single-row verdict (PASS / FAIL)

### Sync routing for the curated data

Inserts into `central.ontology_entities` and
`central.ontology_relationships` fire the triggers defined in 077:

```
trigger_central_ontology_entity_sync      → graphrag.enqueue_central_sync(...)
trigger_central_ontology_rel_sync          → graphrag.enqueue_central_sync(...)
```

Both write to `graphrag.sync_queue` with `access_scope='central'`. The
Rust worker now picks them up via `Processor::route(AccessScope::Central)`
and projects them into the central Qdrant collection
(`QDRANT_CENTRAL_COLLECTION`) and central Neo4j database
(`NEO4J_CENTRAL_DATABASE`).

---

## Phase 3 — Advisor Conversation Agent

### Architecture

```
                  ┌──────────────────────────────────────────────────────┐
   user message   │                                                      │
       │          │   AdvisorConversationAgent                           │
       ▼          │     1. classifyIntent(message)         (deterministic)│
   classifyIntent │     2. runReasoning()  (deterministic recommendation)│
       │          │     3. loadPersonalContext()                          │
       ▼          │     4. detectMissingInfo + detectContradictions       │
   runReasoning   │     5. decideTurnKind                                 │
   (deterministic)│     6. ── optional ──> LlmExplainer.explain(...)      │
       │          │                            │ (Gemini)                 │
       ▼          │                            ▼                          │
   diagnostics    │                       sanitizeLlmOutput()             │
       │          │                            │  rejects                 │
       ▼          │                            ▼                          │
   decideTurnKind │                       cleaned text + trace            │
       │          │                                                      │
       ▼          └──────────────────────────────────────────────────────┘
   ConversationTurn { kind, intent, ask|explain|propose|acknowledge,
                      contradictions, missing_info,
                      deterministic_recommendation,
                      trace { used_llm, llm_calls, llm_rejected_mutations } }
```

### Files

| File                                                                    | Purpose                                                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/web/src/types/conversation.ts`                                    | `ConversationTurn`, `AskBlock`, `ExplainBlock`, `ProposeBlock`, `ContradictionFlag`, `MissingInfoFlag`, `TurnIntent`, `TurnKind`     |
| `apps/web/src/lib/advisor/advisor-conversation-agent.ts`                | `respond()` entrypoint, `classifyIntent`, `detectMissingInfo`, `detectContradictions`, `sanitizeLlmOutput`, `LlmExplainer` interface |
| `apps/web/src/lib/advisor/__tests__/advisor-conversation-agent.test.ts` | 25 unit tests                                                                                                                        |

### Capabilities — 7 specified, all implemented

| Capability                       | Mechanism                                                                                                                                                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Ask intelligent follow-ups**   | `classifyIntent` → `decideTurnKind` returns `'ask'` for `discover_root_goal`, ≥ 3 missing fields, or any hard contradiction. The agent generates a deterministic `AskBlock`; Gemini (if wired) may rephrase the question — never invent a new one.                              |
| **Identify missing information** | `detectMissingInfo(personal_context)` returns flags for empty `user_constraints / capabilities / decision_preferences / commitment_levels / domain_risk_tolerance` with a `why_it_matters` line per gap.                                                                        |
| **Identify contradictions**      | `detectContradictions(recommendation, personal_context)` flags: hard money constraint vs Home Ownership goal, low entrepreneurship tolerance vs Entrepreneurship goal, zero career-hours commitment vs career goal, cycles in `goal_pathway`. Each flagged with `severity: soft | hard`. |
| **Challenge assumptions**        | Surface the deterministic `recommendation.assumptions[]` directly. The agent never invents new assumptions.                                                                                                                                                                     |
| **Explain recommendations**      | `decideTurnKind` returns `'explain'`; the agent emits an `ExplainBlock` containing the top-3 actions with central-entity citation IDs. Gemini may rephrase the `text` — citations are preserved verbatim.                                                                       |
| **Explain tradeoffs**            | Surface `recommendation.tradeoffs[]` directly.                                                                                                                                                                                                                                  |
| **Discover root goals**          | `intent='discover_root_goal'` triggers an Ask with a Socratic prompt ("What would having X actually unlock for you?") and `binds_to: 'goals.root_goal'`.                                                                                                                        |

### The Gemini bypass guard — what the LLM may and may not do

**Allowed paths** (the `sanitizeLlmOutput` whitelist):

```
ask.question      — string
ask.why           — string
explain.text      — string
propose.summary   — string
```

**Everything else is rejected**, recorded in
`trace.llm_rejected_mutations`, and replaced with the deterministic
value. In particular the LLM cannot set:

- `recommendation` or any nested field (`root_goal`, `required_actions`, `recommended_sequence`, `confidence_score`, `tradeoffs`, `cross_domain_impacts`, `pathway`)
- `citations`
- Any top-level field outside `ask | explain | propose`

Tests verify the guard rejects:

- attempts to inject a fake `recommendation` payload
- attempts to overwrite `confidence_score`
- attempts to add `citations` to `explain`
- unknown subkeys on `ask` and `explain`
- malformed types (non-string `question`, `null` `text`)

```ts
// excerpt from advisor-conversation-agent.test.ts
test('rejects attempts to set recommendation fields', () => {
  const { cleaned, rejected } = sanitizeLlmOutput({
    propose: {
      summary: 'Hi',
      recommendation: { foo: 'evil' },
      required_actions: [{ id: 'fake' }],
    },
    override_confidence: 0.99,
    mutate_root_goal: { inferred_true_goal: 'sponsor goal' },
  });
  expect(cleaned.propose).toEqual({ summary: 'Hi' });
  expect(rejected).toEqual(
    expect.arrayContaining([
      'propose.recommendation',
      'propose.required_actions',
      'override_confidence',
      'mutate_root_goal',
    ])
  );
});
```

The agent's contract — proven by tests — is:

> **The `ConversationTurn.deterministic_recommendation` field equals
> the `AdvisorReasoningService.reason()` output exactly. No LLM call
> can change it.**

### Wiring Gemini in production

The agent ships with a `NOOP_EXPLAINER` so it runs in tests and in
prod even when Gemini is unreachable. A real Gemini implementation
plugs in at the route handler:

```ts
import { respond } from '@/lib/advisor/advisor-conversation-agent';

const geminiExplainer: LlmExplainer = {
  async explain({ user_message, intent, recommendation, personal_context, history }) {
    // Call Gemini Flash with a constrained prompt that lists ONLY the
    // four allowed output paths. The sanitize step is the safety net.
    const json = await callGeminiFlash({...});
    return JSON.parse(json);
  },
};

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const inputs = await req.json();
  const turn = await respond(supabase!, inputs, { explainer: geminiExplainer });
  return Response.json(turn);
}
```

The constrained prompt + the `sanitizeLlmOutput` guard means a
prompt-injection attack on the user message can — at worst — produce
an unhelpful explanation. It cannot change which actions get
recommended.

### What we do NOT do

- The agent does not orchestrate a multi-turn dialog. It produces one
  `ConversationTurn` per `respond()` call; the caller manages history.
- The agent does not call Gemini directly. The `LlmExplainer`
  interface is injected; in production the route handler wires it.
- The agent does not write to any user table. It returns flags
  (`MissingInfoFlag`, `ContradictionFlag`); the UI/route decides what
  to persist.
- The agent does not bypass RLS — all Supabase calls use the
  authenticated client.

---

## File map

```
apps/ingestion-worker/src/queue.rs                      MODIFIED (+AccessScope, +access_scope field)
apps/ingestion-worker/src/config.rs                     MODIFIED (+central env vars)
apps/ingestion-worker/src/qdrant_client.rs              MODIFIED (with_scope, scoped payload)
apps/ingestion-worker/src/neo4j_client.rs               MODIFIED (with_scope, scoped database)
apps/ingestion-worker/src/processor.rs                  REWRITTEN (four clients, route())
apps/ingestion-worker/src/main.rs                       MODIFIED (build four clients)
apps/ingestion-worker/src/normalizer.rs                 MODIFIED (test fixture only — new field)
apps/ingestion-worker/tests/central_routing.rs          NEW
apps/ingestion-worker/tests/{retry,idemp,no_sens,...}.rs MODIFIED (new field on fixtures)

supabase/migrations/078_central_curated_knowledge.sql   NEW
scripts/validation/verify_078_central_seed.sql          NEW

apps/web/src/types/conversation.ts                      NEW
apps/web/src/lib/advisor/advisor-conversation-agent.ts  NEW
apps/web/src/lib/advisor/__tests__/advisor-conversation-agent.test.ts NEW

CENTRAL_KNOWLEDGE_AND_ADVISOR_INTELLIGENCE.md           NEW (this file)
```

## Apply + verify

```bash
# 1. Apply the migration
psql "$DATABASE_URL" -f supabase/migrations/078_central_curated_knowledge.sql

# 2. Verify counts + provenance integrity + cross-domain spot-checks
psql "$DATABASE_URL" -f scripts/validation/verify_078_central_seed.sql

# 3. Build + test the Rust worker with new routing
cd apps/ingestion-worker
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo build --release --bin ingestion-worker

# 4. Deploy worker (will now route central writes to NEO4J_CENTRAL_DATABASE
#    and QDRANT_CENTRAL_COLLECTION)
./deploy.sh

# 5. (Web) verify tests
pnpm --filter @life-navigator/web test
```

## What this round did NOT do (scope guard)

- ❌ No new UI
- ❌ No new dashboards
- ❌ No new schema tables (added rows to existing `central.*`, no DDL except for sync routing)
- ❌ No onboarding changes
- ❌ No business-logic changes outside the new advisor/conversation modules

✅ Worker now routes per access_scope
✅ Central graph now contains cited knowledge for all six target domains
✅ Conversation agent surfaces deterministic recommendations through a guarded LLM layer
