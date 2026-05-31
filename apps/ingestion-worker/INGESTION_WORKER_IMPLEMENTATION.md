# LifeNavigator Ingestion Worker (Rust on Fly.io)

This is Step 6 of the sequenced build plan
(`/SEQUENCED_BUILD_PLAN.md` at the repo root).

The worker drains the `graphrag.sync_queue` table that Supabase
triggers populate, normalizes each row into a canonical graph object,
generates a Gemini embedding, and upserts to **Qdrant** (vectors) and
**Neo4j** (graph nodes + relationships) — all under strict per-user
tenant isolation. It is the only process in the platform that reads
across users; it does so with the service-role key.

The crate is split as a **library + binary** so the integration tests
in `tests/` can exercise the pure layers (`normalizer`, payload
builders, sensitivity filter) without touching the network.

## Layout

```
apps/ingestion-worker/
  Cargo.toml
  Dockerfile
  fly.toml
  .env.example
  INGESTION_WORKER_IMPLEMENTATION.md           (this file)
  src/
    main.rs                bootstrap + poll loop + graceful shutdown
    lib.rs                 re-exports for integration tests
    config.rs              env → Config
    errors.rs              WorkerError + Result alias
    telemetry.rs           tracing init + SENSITIVE_FIELD_PATTERN + redactor
    queue.rs               SyncQueueJob mirror of graphrag.sync_queue
    entities.rs            EntityType enum + CanonicalGraphObject + sensitivity tier
    normalizer.rs          payload → CanonicalGraphObject (strips sensitive fields)
    supabase_client.rs     claim_sync_jobs + complete_sync_job RPCs
    gemini_client.rs       text-embedding-004 client
    qdrant_client.rs       upsert/delete + payload builder
    neo4j_client.rs        transactional Cypher (every query tenant-filtered)
    processor.rs           per-job orchestrator (normalize → embed → qdrant → neo4j)
  tests/
    tenant_isolation.rs            (3 tests)
    idempotency.rs                 (3 tests)
    retry_safety.rs                (3 tests)
    no_sensitive_field_embedding.rs (4 tests)
```

## How it runs

1. `claim_sync_jobs(p_limit=WORKER_BATCH_SIZE)` — atomically claims a
   batch via `FOR UPDATE SKIP LOCKED` (defined in
   `supabase/migrations/050_graphrag.sql`).
2. For each job:
   - `normalize(job)` → `CanonicalGraphObject` with all sensitive fields
     stripped from `summary` and `attributes`.
   - For `Upsert`:
     - `gemini.embed(canon.summary)` → `Vec<f32>` (768-dim, model
       defaults to `text-embedding-004`).
     - `qdrant.upsert(canon, vector)` → point id is the deterministic
       `tenant_id|entity_type|entity_id` (idempotent across retries).
       Payload includes `tenant_id`, `user_id`, `entity_type`,
       `entity_id`, `domain`, `source_table`, `created_at`,
       `updated_at`, `access_scope='personal'`, `sensitivity_level`.
     - `neo4j.upsert_node(canon)` → transactional Cypher. Every
       statement filters by `tenant_id: $tenant_id`. Relationships
       (`HAS_GOAL`, `HAS_CAREER_PROFILE`, etc.) merge into the user's
       Person node, also tenant-scoped.
   - For `Delete`: skip the embedding and call
     `qdrant.delete(point_id)` + `neo4j.delete_node(...)` with the
     same tenant-scoped key.
3. `complete_sync_job(job_id, neo4j_synced, qdrant_synced, error)`
   reports per-side success. The Postgres function flips the queue row
   to `completed`, `failed`, or `dead` accordingly, and the next claim
   skips it.

On `SIGINT` / `SIGTERM`, the loop finishes the current batch and
exits cleanly.

## Invariants (enforced by tests)

| Invariant                                                                                                                                   | Test                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `tenant_id == user_id` and the Qdrant payload + Neo4j param bag carry both ids                                                              | `tenant_isolation.rs::qdrant_payload_carries_tenant_and_user_ids`, `neo4j_params_carry_tenant_and_cypher_filters_by_tenant` |
| Every Cypher MERGE filters by `tenant_id: $tenant_id`                                                                                       | `tenant_isolation.rs::neo4j_params_carry_tenant_and_cypher_filters_by_tenant`                                               |
| Two users' jobs produce distinct Qdrant point ids                                                                                           | `tenant_isolation.rs::two_users_produce_distinct_point_ids`                                                                 |
| Same `(tenant_id, entity_type, entity_id)` always produces the same Qdrant point id and the same Neo4j MERGE statement (idempotent retries) | `idempotency.rs` (3 tests)                                                                                                  |
| Partial failure can be re-driven without state corruption (identical payload on retry)                                                      | `retry_safety.rs` (3 tests)                                                                                                 |
| Every known sensitive-field name is dropped from `summary` AND from `attributes` AND from the Qdrant payload AND from the Neo4j attrs bag   | `no_sensitive_field_embedding.rs` (4 tests)                                                                                 |

The `SENSITIVE_FIELD_PATTERN` regex in `src/telemetry.rs` is the
single source of truth for what gets filtered. The covered patterns:

`*_encrypted$`, `member_id`, `group_number`, `account_number`,
`routing_number`, `ssn`, `social_security`, `notes_encrypted`,
`password*`, `api_key`, `access_token*`, `refresh_token*`.

Adding a new sensitive-field name? Update the regex AND the
`SENSITIVE_NAMES` list in `tests/no_sensitive_field_embedding.rs` in
the same PR.

## Local dev

```bash
cd apps/ingestion-worker
cp .env.example .env
# Fill in: SUPABASE_URL/SERVICE_KEY, GEMINI_API_KEY, QDRANT_URL/API_KEY,
# NEO4J_URI/USERNAME/PASSWORD.
cargo run                 # uses .env if `direnv` or `dotenv` is set up
cargo test --all-targets  # offline; no network needed for the tests
cargo build --release     # production binary
```

The crate has **zero network dependencies in its test path** — the
22 tests run in well under a second.

## Deploy to Fly.io

```bash
cd apps/ingestion-worker
fly apps create lifenavigator-ingestion-worker
fly secrets set \
  SUPABASE_URL=https://YOURPROJECT.supabase.co \
  SUPABASE_SERVICE_ROLE_KEY=... \
  GEMINI_API_KEY=... \
  QDRANT_URL=https://YOURQDRANT.qdrant.io:6333 \
  QDRANT_API_KEY=... \
  QDRANT_PERSONAL_COLLECTION=life_navigator \
  NEO4J_URI=https://YOURNEO4J.databases.neo4j.io \
  NEO4J_USERNAME=neo4j NEO4J_PASSWORD=... \
  NEO4J_PERSONAL_DATABASE=neo4j
fly deploy
```

Tune throughput via `WORKER_POLL_INTERVAL_SECONDS` and
`WORKER_BATCH_SIZE`. Defaults (5 s / 25 jobs) keep memory under 64 MB
for tens-of-thousands of jobs/hour.

## Logs

Structured JSON via `tracing`. Every line is a single JSON object with
`timestamp`, `level`, `target`, `span`, and named fields. Anything
that might contain PII is run through the redactor in
`telemetry::redact_sensitive` before it lands in a log. We never log:

- the service-role key
- the Neo4j password
- any Qdrant / Gemini API key
- any encrypted column from a source row
- any `member_id` / `group_number` / `account_number` /
  `routing_number` / `ssn`

## Verification

| Step                                           | Result                                                  |
| ---------------------------------------------- | ------------------------------------------------------- |
| `cargo check --all-targets`                    | clean (0 errors, 0 warnings)                            |
| `cargo test --all-targets`                     | **22 passed, 0 failed** (9 inline lib + 13 integration) |
| `cargo build --release --bin ingestion-worker` | clean release binary                                    |

## Intentionally deferred

- **Cross-domain relationships** beyond `HAS_*` — the normalizer
  currently emits one relationship per entity (back to the user's
  Person node). Cross-domain edges (`SUPPORTS_GOAL`, `BLOCKS_GOAL`,
  `IMPACTS`, `DEPENDS_ON`) require a richer reader that joins source
  tables; add in a follow-up.
- **Health-domain dedicated collection** — today everything goes
  into `QDRANT_PERSONAL_COLLECTION`. When the health feature unlocks
  you may want a separate collection with stricter ACLs; the worker
  already carries `domain` + `sensitivity_level` in every payload to
  support that filter later.
- **Backoff jitter** on retries — the Postgres-side `attempts`
  counter caps retries already; an in-process `backoff` crate could
  smooth thundering-herd in extreme cases.
- **Prometheus/OTLP metrics** — the tracing layer is set up but no
  metrics exporter is wired. Add `tracing-opentelemetry` when you
  start needing per-stage latency.

---

## Next step

**Step 7 — FastAPI GraphRAG / compliance backend** at
`apps/api-gateway/`. The next round will scaffold a FastAPI app with
JWT validation, personal + central GraphRAG retrieval, the compliance
module that vets recommendations, and the Arcana lead-package
preview/send flow.

**Paste this when you're ready to continue:**

> Execute Step 7 of the sequenced build plan: FastAPI GraphRAG +
> compliance backend. Create the apps/api-gateway FastAPI app with
> the layout in the plan, Dockerfile + fly.toml + requirements.txt,
> and tests for JWT, personal-retrieval filter, and compliance
> rejection paths. Don't start any other step.
