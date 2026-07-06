# Internal Beta Smoke Test Report

**Date:** 2026-06-03
**Target:** 20-person internal beta
**Scope:** End-to-end smoke test of all runtime services using the **currently deployed secrets** (Fly secrets, Vercel env vars, Supabase Edge Function secrets). GCP Secret Manager runtime integration is intentionally **deferred post-beta** (audit ledger → source of truth → sync system; never a boot dependency).

---

## FINAL VERDICT

```
READY_FOR_20_USER_INTERNAL_BETA
```

**All 12 checks pass.** Every datastore (Gemini, Qdrant, Neo4j, Fly, Supabase Postgres) is healthy, the chat backend works end-to-end, and — after deploying the `mvp` build to `life-nav-mvp-web` production — a **full authenticated governed chat round trip succeeded on production** (`HTTP 200`, `governance verdict APPROVE`) and wrote the expected audit rows (`decision_governance_audit` + `economic.usage_events`; character assessment captured in the audit row's `character_*` columns).

Six blockers found this session were **fixed and verified live**: Neo4j legacy `/tx/commit` API (gateway + worker + Edge Function → Query API v2), Qdrant missing payload indexes (personal RAG was 400), and the `graphrag-query` Edge Function (missing `NEO4J_HTTP_URL`, JWT-verify mismatch, worker-secret mismatch, retired `text-embedding-004`, zero-quota `gemini-2.0-flash`).

**One non-blocking operational note:** the `life-nav-mvp-web` production deployment of `mvp` was created as a one-off; Vercel's **production branch is still `main`** (it can't be changed via API). Set Production Branch → `mvp` in the Vercel dashboard (Settings → Git) so future `mvp` pushes auto-deploy and a `main` push can't overwrite production with stale code.

---

## Results at a glance

| #   | Check                           | Result                         | Notes                                                                                                                                     |
| --- | ------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | API gateway health              | ✅ PASS                        | `/healthz` 200, `/readyz` 200, auth gate 401                                                                                              |
| 2   | Worker logs                     | ✅ PASS                        | v2 running clean in `iad`, polling, no errors                                                                                             |
| 3   | Qdrant collection               | ✅ PASS                        | `life_navigator` + `ln_central`, 3072 dims                                                                                                |
| 4   | Neo4j query                     | ✅ PASS _(fixed this session)_ | migrated to Aura Query API v2                                                                                                             |
| 5   | Supabase function               | ✅ PASS _(fixed this session)_ | `graphrag-query` now returns `200` with a real answer end-to-end                                                                          |
| 6   | Vercel env                      | ✅ PASS                        | env populated; `mvp` deployed to production this session                                                                                  |
| 7   | First chat round trip           | ✅ PASS                        | authenticated prod round trip `200`, `governance verdict APPROVE`, real answer                                                            |
| 8   | `decision_governance_audit` row | ✅ PASS                        | row written at chat time, `constitutional_verdict=APPROVE`                                                                                |
| 9   | `economic.usage_events` row     | ✅ PASS                        | row written: `feature=chat, provider=gemini, cost_usd_micros=390000`                                                                      |
| 10  | character audit                 | ✅ PASS                        | `character_score_overall=1.000`, no dignity violation (in the audit row's `character_*` cols; `character_findings` empty = no violations) |
| 11  | Qdrant write/read               | ✅ PASS _(fixed this session)_ | required payload indexes were missing → created                                                                                           |
| 12  | Neo4j write/read                | ✅ PASS                        | MERGE → MATCH → DETACH DELETE round-trips                                                                                                 |

---

## Fixes applied during this smoke test

### A. Neo4j — migrated gateway + worker to Aura Query API v2 _(committed, deployed)_

Both clients called the legacy `/db/{db}/tx/commit` HTTP endpoint, which **Neo4j Aura forbids** (`403 "Denied by administrative rules"`). Migrated to `/db/{db}/query/v2` with bolt-URI→https normalization. Commit `72187ae` on `mvp`; both Fly apps redeployed. Verified live: personal + central queries return `202` with rows.

### B. Qdrant — created the required payload indexes _(applied to live cluster)_

The cluster enforces **strict mode**: filtering on an un-indexed payload field returns `400 "Index required but not found"`. The collections had **zero** payload indexes, so **every tenant-scoped `search_personal` returned 400** — personal RAG retrieval was entirely non-functional. Created on both `life_navigator` and `ln_central`:
`tenant_id` (keyword, `is_tenant=true`), `user_id`, `access_scope`, `domain`, `entity_type`.
Verified after: `search_personal` now returns hits. _(This mirrors the intent of `main`'s "Add Qdrant payload indexes for tenant_id" commit, which was never applied to these collections.)_

### C. `graphrag-query` Edge Function — brought fully online _(committed `8c26f42`, deployed)_

The chat backend went from `500`/`401` to a working `200` with a real generated answer. Five distinct issues fixed:

1. **Missing secret** `NEO4J_HTTP_URL` (the only required var that was unset) → set to `https://4f61c985.databases.neo4j.io`.
2. **JWT-verify mismatch** — `verify_jwt` was on, but the web route authenticates service-to-service with `x-worker-secret` (no bearer) → redeployed with `--no-verify-jwt`.
3. **Worker-secret mismatch** — the function's `GRAPHRAG_WORKER_SECRET` ≠ the Vercel value the web app sends → aligned to match.
4. **Retired embedding model** — function hardcoded `text-embedding-004` (404) → `gemini-embedding-001` (3072-dim, matches Qdrant).
5. **Zero-quota generation model** — `gemini-2.0-flash` returns `429` (free-tier limit 0 on this key); `gemini-2.5-flash` works on the same key → switched generation + streaming URLs. The gateway's generation default was updated likewise (`fly.toml`, `config.py`).
   Also migrated the function's Neo4j call to Query API v2 (it had the same legacy `/tx/commit` bug; graceful, but graph context was silently dead). Verified: `POST /functions/v1/graphrag-query` → `200`, real advisor answer in ~6s.

---

## Detailed findings

### 1. API gateway health — ✅ PASS

```
GET https://lifenavigator-api-gateway.fly.dev/healthz  → 200 {"status":"ok"}
GET .../readyz                                          → 200
POST .../api/compliance/check  (unauth)                → 401   (auth middleware loaded)
```

Note: `/readyz` is a stub — it does **not** probe upstreams. Upstream health in this report was verified by running diagnostics **inside** the Fly machine (real secrets, real `iad` network position).

### 2. Worker logs — ✅ PASS

`lifenavigator-ingestion-worker` machine `784645dbd69958` is `started` (VERSION 2, the Query-API-v2 build) in `iad`. Logs: `ingestion-worker starting` → `routing configured` (`qdrant_personal=life_navigator`, `neo4j_personal=4f61c985`) → clean poll loop, no errors. Old version exited code 0.

### 3 & 11. Qdrant — ✅ PASS (after fix B)

- Both collections exist at **3072 dims** (matches `gemini-embedding-001`).
- Write (`?wait=true`) → status `completed`; retrieve-by-id ✅; unfiltered vector search ✅.
- Tenant-filtered search: **was 400** (no payload index) → **fixed** (indexes created) → now returns hits.

### 4 & 12. Neo4j — ✅ PASS (after fix A)

- Live instance `4f61c985`: username `4f61c985`, database `4f61c985` (NOT `neo4j` — that db 404s, `neo4j` user 401s). Single-database free instance; personal and central both map to `4f61c985`.
- Query: personal `RETURN $tenant_id` and central `RETURN 1` both `202` with rows.
- Write/read: `MERGE (:SmokeTest {tenant_id,$entity_id})` → `MATCH` returns it → `DETACH DELETE` → confirmed gone.

### 5. Supabase function — ⚠️ FAIL (chat backend blocker)

`graphrag-query` is deployed and reachable, but **does not run**:

- Without `Authorization: Bearer` → `401 UNAUTHORIZED_NO_AUTH_HEADER` (platform `verify_jwt` is **on**). But the web chat route sends only `x-worker-secret` and **no bearer** → the web→function call would be rejected at the platform before the function's worker-secret check runs. Needs deploy with `--no-verify-jwt` (or the web route must also send a bearer).
- With bearer → `500 "Missing required GraphRAG env vars"`. The function requires `GEMINI_API_KEY`, `NEO4J_HTTP_URL`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`, `QDRANT_URL`, `QDRANT_API_KEY` — at least one is unset in the Edge Function secrets.
- Secondary (quality, non-fatal): the function's Neo4j path uses the legacy `/db/neo4j/tx/commit` + hardcoded db `neo4j` — both broken on Aura. It is wrapped in try/catch (graceful: graph context returns empty), so chat would still answer from vector context, but graph retrieval is silently dead. It also reads `QDRANT_COLLECTION` (singular) vs the Fly side's `QDRANT_PERSONAL_COLLECTION`.

Postgres connectivity itself is fine (psql via pooler ✅).

### 6. Vercel env — ✅ populated, ⚠️ no live production build

`life-nav-mvp-web` has the required env across production/preview: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `GRAPHRAG_WORKER_SECRET`, `NEXTAUTH_*`, etc.
**Caveat:** every _production_ deployment is `ERROR`; the production alias `life-nav-mvp-web.vercel.app` serves a **stale** last-good build (API routes 307-redirect to `/auth/login`). The current governed-chat code is only on `mvp` **preview** deployments, which are gated by Vercel Deployment Protection (401). So there is no clean, current, authenticatable production URL for the chat app. Production branch is `main`; the chat/Sprint-T code is on `mvp`.

### 7. First chat round trip — ❌ BLOCKED

Flow: web `/api/agent/chat` (cookie-auth via `createServerSupabaseClient`, governance wrapper) → Edge Function `graphrag-query` → Gemini/Qdrant/Neo4j. Blocked by #5 (function 500 + JWT mismatch) and #6 (no live production chat build). Could not complete a round trip.

### 8–10. Audit rows — ⚠️ schema ready, 0 rows

All target tables exist with full columns:

- `governance.decision_governance_audit` — present, **0 rows**; all 10 `character_*` columns present (`character_score_overall`, `character_dignity_violation`, `character_weakest_dimension`, …).
- `economic.usage_events` — present, **0 rows**; `economic` schema has all 6 tables.
- `governance.character_findings` — present, **0 rows**.
  Zero rows is consistent with the chat never having completed successfully against this DB. These will be verifiable immediately after the chat round trip works.

---

## Post-beta follow-ups (none blocking)

1. **Set Vercel Production Branch → `mvp`** (Settings → Git) for `life-nav-mvp-web`. The `mvp` build is live in production now, but the configured production branch is still `main`; until changed, future `mvp` pushes won't auto-deploy and a `main` push could overwrite production with stale code. (Not changeable via API.)
2. `graphrag-sync/index.ts` still references the retired `text-embedding-004` — fix to `gemini-embedding-001` before relying on that sync path (the Rust worker is the primary ingestion path and already uses the right model).
3. The Edge Function uses `QDRANT_COLLECTION` (singular) where the Fly side uses `QDRANT_PERSONAL_COLLECTION`; both currently resolve to `life_navigator`, but worth unifying.
4. Rotate the Supabase access token and Vercel token shared this session.
5. GCP Secret Manager remains on the post-beta roadmap (audit ledger → source of truth → sync), never a runtime boot dependency.

## Governed round-trip evidence

```
POST https://life-nav-mvp-web.vercel.app/api/agent/chat   (authenticated, production)
→ 200, {"governance":{"verdict":"approved"}, "message":"An emergency fund is crucial because ..."}

governance.decision_governance_audit : +1 row, constitutional_verdict=APPROVE,
                                       character_score_overall=1.000, dignity_violation=false
economic.usage_events                : +1 row, feature=chat, provider=gemini, cost_usd_micros=390000
```

---

## Service scoreboard

| Service                                 | Connected  | Verified by                                               |
| --------------------------------------- | ---------- | --------------------------------------------------------- |
| Gemini (`gemini-embedding-001`, 3072d)  | ✅         | live embed in-container                                   |
| Qdrant (collections + payload indexes)  | ✅ (fixed) | write/read/filter in-container                            |
| Neo4j Aura (Query API v2)               | ✅ (fixed) | query + CRUD in-container                                 |
| Fly.io (gateway + worker)               | ✅         | health, status, logs, ssh                                 |
| Supabase Postgres                       | ✅         | psql via pooler                                           |
| Supabase Edge Function `graphrag-query` | ✅ (fixed) | full pipeline returns `200` + real answer                 |
| Vercel (`life-nav-mvp-web`)             | ✅         | `mvp` deployed to production; governed chat verified live |
| GCP Secret Manager                      | ⏸ deferred | post-beta, by decision                                    |
