# Cross-Service Tenant Isolation & Authorization Audit

**Date:** 2026-07-29 · **Scope:** complete runtime topology per `API_RUNTIME_AND_OWNERSHIP_MAP.md`
**Phase:** audit and target design only. **No code modified.**
**Method:** source inspection of every tier, datastore client, worker, edge function, and scheduled job;
migration/RLS-policy reading; live endpoint probing.

**Data at risk:** financial accounts (Plaid), health records (`LabRecord`, `MedicationLog`,
`BodyMeasurement`), estate/legal documents, dependants and family members.

---

## 0. Executive Summary

Tenant isolation in LifeNavigator is **inconsistently enforced by mechanism and consistently enforced by
convention.** The codebase contains, simultaneously, the **best structural tenant enforcement I have seen in
a project this size** and **the weakest possible enforcement of the same property** — often for the same
datastore, in two different services.

| Enforcement quality                      | Where                                                | Mechanism                                                                                                      |
| ---------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Excellent — structural, fails closed** | api-gateway (orphaned), ingestion-worker             | Cypher refuses to run without `$tenant_id`; tenant is part of the graph MERGE key; params cannot be overridden |
| **Good — structural**                    | Qdrant clients (both Python tiers)                   | `build_personal_filter` refuses empty `user_id`, filters on 2–3 keys                                           |
| **Weak — convention only**               | core-api Supabase access (117 sites), core-api Neo4j | Docstring rule; service-role bypasses RLS; **caller params can override the tenant**                           |
| **Mixed — one route saved only by RLS**  | web `/api/platform/**`                               | One route authorizes, a sibling does not                                                                       |

**Six material findings.** Two are new and were not in any prior report.

| ID      | Finding                                                                                                                                                   | Severity                       |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| **T-1** | core-api `Neo4jClient.query_personal` — **caller parameters can override the authenticated tenant**, and **no statement guard** exists                    | **HIGH**                       |
| **T-2** | `/api/platform/usage` performs **no authorization**; identical sibling route does. **Saved only by RLS**                                                  | **HIGH** (contained by RLS)    |
| **T-3** | Edge function `graphrag-query` accepts `x-worker-secret` → **impersonate any user via `body.user_id`**; bearer secret with no integrity binding or expiry | **HIGH**                       |
| **T-4** | Two service-role holders; core-api bypasses RLS across 117 read sites                                                                                     | **HIGH** (known, re-confirmed) |
| **T-5** | `verify_jwt = false` on `process-ingestion` and `sync-user-to-backend` edge functions                                                                     | **MEDIUM**                     |
| **T-6** | Four incompatible tenant-identity derivations; no service-to-service authentication anywhere except the shared worker secret                              | **MEDIUM**                     |

**The single most instructive finding is T-2.** An application-layer authorization check was omitted, and
**Row-Level Security caught it** — because that route uses the user-session client. The _identical_ omission
on any core-api route would be a live cross-tenant breach, because core-api uses service-role and RLS is
inert there. This is the empirical case for the layered model recommended in §6.

---

## 1. Tier-by-Tier Request-Path Analysis

### 1.1 `apps/web` (Next.js 16, Vercel) — PUBLIC

| Question                                           | Answer                                                                                                                                                                            |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Where does authentication occur?                   | `src/proxy.ts` (edge) via `supabase.auth.getUser()`; again per-route                                                                                                              |
| Where does JWT validation occur?                   | Delegated to Supabase SSR (`@supabase/ssr`)                                                                                                                                       |
| Where is tenant identity derived?                  | `user.id` from the session cookie; **or** `tenant_id` from an `lnk_*` API key (`lib/tenant/api-gateway.ts`); **or** `tenant_id` from **request body/query** on `/api/platform/**` |
| Can tenant identity be replaced downstream?        | **Yes** on the platform plane — `tenant_id` is a request parameter                                                                                                                |
| Is `user_id`/`tenant_id` accepted from user input? | **YES** — `platform/usage/route.ts:20` (query string), `platform/api-keys/route.ts:34` (body), `api/models/route.ts:35` (body)                                                    |
| Credentials used                                   | Supabase **anon key + user session** (RLS **enforced**)                                                                                                                           |
| Service-role bypass?                               | **No** — this is the only tier that consistently runs under RLS                                                                                                                   |
| Downstream revalidation?                           | core-api independently re-verifies the JWT ✅                                                                                                                                     |
| Service-to-service identity?                       | **None** — web→core-api forwards the _user's_ JWT (acceptable: user context, not service identity)                                                                                |
| Authorization duplicated?                          | Yes — edge gating + per-route checks + RLS                                                                                                                                        |
| Same endpoint differs across tiers?                | Yes — `/api/platform/**` (web) vs `/v1/platform` (core-api)                                                                                                                       |

**Critical inconsistency — T-2:**

```ts
// platform/api-keys/route.ts — CORRECT
const role = await sb.rpc('is_tenant_member', {
  p_tenant_id: body.tenant_id,
  p_user_id: user.id,
  p_min_role: 'admin',
});
if (!role.data) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
```

```ts
// platform/usage/route.ts — NO AUTHORIZATION, despite the docstring "Tenant admin only."
const tenant_id = url.searchParams.get('tenant_id');
let q = sb.from('platform_tenant_api_usage').select('*').eq('tenant_id', tenant_id) …
```

**Why it is not currently exploitable** — `093_enterprise_foundation.sql:307-309`:

```sql
ALTER TABLE platform.tenant_api_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY tau_admin_select ON platform.tenant_api_usage
  FOR SELECT USING (platform.is_tenant_member(tenant_id, auth.uid(), 'admin'));
```

The route uses the **user-session** client, so RLS applies and a non-member gets zero rows. **The database
caught an application bug.**

**Additional:** edge auth **fails open** — `proxy.ts:65-68`, missing Supabase env → all requests pass.

### 1.2 `apps/lifenavigator-core-api` (FastAPI, Fly) — PUBLIC, AUTHORITATIVE

| Question                     | Answer                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Authentication               | Per-route `Depends(authenticated)`. **No auth middleware** — an unprotected route is unprotected by omission |
| JWT validation               | `app/auth.py::verify_jwt` — HS256 pinned, `aud=authenticated`, `require:["exp","sub"]` ✅                    |
| Tenant derivation            | `sub` → `UserContext.user_id` ✅ never from body                                                             |
| Replaceable downstream?      | **YES for Neo4j** — see T-1                                                                                  |
| `user_id` from user input?   | Not at the HTTP boundary ✅                                                                                  |
| Credentials                  | **Supabase SERVICE-ROLE** (default), Neo4j basic auth, Qdrant api-key, Gemini/Vertex, Plaid                  |
| Service-role bypasses RLS?   | **YES — 117 `.select(` sites, 0 pass a user JWT**                                                            |
| Downstream revalidation?     | N/A — it is the terminal tier                                                                                |
| Service-to-service identity? | **None**                                                                                                     |
| Authorization                | **None beyond authentication.** `role` parsed, never consulted                                               |
| Endpoint divergence          | `/v1/recommendations` also exists as gateway `/api/recommendations`                                          |

**T-1 — two structural gaps in `clients/neo4j.py:46-61`:**

```python
async def query_personal(self, statement: str, *, user_id: str, parameters: dict | None = None):
    """The caller's statement MUST filter ``tenant_id = $user_id``; we always bind it."""
    if not user_id:
        raise ValueError("query_personal requires a non-empty user_id")
    params = {"user_id": user_id, **(parameters or {})}   # ← spread comes SECOND
```

1. **Tenant override.** `parameters` is spread _after_ `user_id`, so `parameters={"user_id": "<victim>"}`
   **silently replaces the authenticated tenant.** The gateway explicitly refuses this
   (`raise ValueError("cannot override tenant_id in personal params")`).
2. **No statement guard.** The docstring says the statement "MUST filter `tenant_id = $user_id`" — nothing
   verifies it. A statement omitting the filter returns **all tenants' nodes**. The gateway refuses to run
   such a statement.

**Current reachability:** only two call sites (`retriever.py:79`, `:139`), both passing hard-coded Cypher
and no user-controlled `parameters`. **Not exploitable today — a latent defect, one careless call site from
becoming a breach.** It is precisely the class of defect Phase 5B/5C (query planning, traversal) will
introduce call sites for.

### 1.3 `apps/api-gateway` (FastAPI, Fly) — PUBLIC, LIVE, **ZERO CALLERS**

| Question                | Answer                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Authentication          | `app/auth.py::verify_jwt` — **functional duplicate** of core-api's                                           |
| Tenant derivation       | `sub` → `AuthenticatedUser.user_id`; `retrieve_personal(*, user_id, …)` makes tenant a **required kwarg** ✅ |
| Replaceable downstream? | **NO — structurally refused** ✅                                                                             |
| `user_id` from input?   | **No** — explicitly documented and enforced ✅                                                               |
| Credentials             | Holds `supabase_service_role_key` (**unused — no Supabase call sites found**), Neo4j, Qdrant, Gemini         |
| Service-role bypass?    | Holds the key; no usage found. **Revoke immediately**                                                        |
| Authorization           | None beyond authentication                                                                                   |
| Live?                   | **Yes** — `/healthz` 200, `/api/graphrag/query` 401                                                          |

**Best-in-repo enforcement** (`services/neo4j_client.py`):

```python
async def run_personal(self, *, user_id, cypher, extra=None):
    if not self.cypher_filters_personal(cypher):
        raise ValueError("personal cypher must reference $tenant_id — refusing to run")
    …
def build_personal_params(self, user_id, extra=None):
    if not user_id or not isinstance(user_id, str):
        raise ValueError("personal neo4j params require a non-empty user_id")
    for k, v in (extra or {}).items():
        if k == "tenant_id":
            raise ValueError("cannot override tenant_id in personal params")
```

And `services/qdrant.py::build_personal_filter` requires **three** matching clauses —
`tenant_id`, `user_id`, **and `access_scope == "personal"`** — versus core-api's two.

### 1.4 `apps/ingestion-worker` (Rust, Fly) — INTERNAL, no HTTP ingress

| Question               | Answer                                                                                   |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Authentication         | N/A — no ingress                                                                         |
| Tenant derivation      | `job.user_id` from the **queue row** (`processor.rs:174,181`), never from the payload ✅ |
| Replaceable?           | **No** — payload cannot override the job's tenant ✅                                     |
| Credentials            | Supabase (queue + source rows), Neo4j, Qdrant, Gemini                                    |
| Structural enforcement | **Tenant is part of the graph MERGE key** ✅                                             |
| Background-job scope   | Explicit per job row                                                                     |

```rust
"MERGE (n:{label} {{ tenant_id: $tenant_id, entity_id: $entity_id }}) …
 MERGE (t:{target_label} {{ tenant_id: $tenant_id, entity_id: '{tgt}' }}) …"
// delete: MATCH (n:{label} { tenant_id: $tenant_id, entity_id: $entity_id }) DETACH DELETE n
```

A node **cannot exist outside a tenant partition**, and the ontology registry guarantees an edge's target is
MERGEd under the same `tenant_id`. Qdrant payloads carry `tenant_id`, `user_id`, `access_scope`. **This is
the correct model.**

### 1.5 Supabase Edge Functions — **FIFTH TIER**, previously unaudited

Five functions: `graphrag-query`, `graphrag-sync`, `process-ingestion`, `email-sync`, `calendar-sync`.

**T-3 — `graphrag-query` service-to-service impersonation** (`index.ts:742-776`):

```ts
const workerSecret = Deno.env.get('GRAPHRAG_WORKER_SECRET');
const providedSecret = req.headers.get('x-worker-secret');
if (workerSecret && providedSecret && constantTimeEqual(providedSecret, workerSecret)) {
  // Trusted caller — user_id must be in body
} else {
  // …Bearer JWT → supabase.auth.getUser(token) → userId = user.id
}
const body: QueryRequest = await req.json();
userId = userId || body.user_id || null;
```

**Assessment — the design is correct, the mechanism is weak:**

- ✅ On the JWT path `userId` is already set, so `body.user_id` is **ignored**. Not exploitable via JWT.
- ✅ Constant-time secret comparison.
- ✅ If `GRAPHRAG_WORKER_SECRET` is unset the branch is skipped → JWT required → **fails closed**.
- ❌ **Any holder of the shared secret can act as any user.** It is a static bearer secret with **no
  integrity binding to the request, no expiry, no audience, no per-caller identity, and no audit event.**
  A leaked secret is total, silent, cross-tenant compromise. Given a credential of exactly this shape leaked
  for 30 days (`CREDENTIAL_INCIDENT_REPORT.md`), this is not theoretical.
- ❌ The function uses **service-role** for Supabase → RLS inert → all scoping is `.eq('user_id', userId)`.

**T-5 — `supabase/config.toml`:**

```toml
[functions.process-ingestion]
verify_jwt = false
[functions.sync-user-to-backend]
verify_jwt = false
```

Two functions accept unauthenticated invocation at the platform edge. Whether they enforce their own
identity is **[UNVERIFIED]** — `process-ingestion` reads `user_id` from job/doc rows (`:224,276,333,417`),
which is the correct source, but the ingress control is disabled.

**Cache discovered:** `graphrag.query_cache`, keyed `user_id` + `query_hash`, read with `.eq('user_id', userId)`
and an expiry check. **Tenant-scoped key ✅** — but under service-role, so correctness depends on the
application filter. _(This corrects the earlier reports' claim that no cache exists.)_

---

## 2. Datastore Access-Site Register

| #   | Service     | File · Function                           | Operation         | Credential         | Tenant source                      | Structural?                                   | Optional filter?        | RLS             | Cross-tenant risk                                                    | Remediation                                                       |
| --- | ----------- | ----------------------------------------- | ----------------- | ------------------ | ---------------------------------- | --------------------------------------------- | ----------------------- | --------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | core-api    | `clients/supabase.py::select` ×117        | READ              | **service-role**   | caller-supplied filter             | ❌ **No**                                     | ✅ Yes (112/117 use it) | **BYPASSED**    | **HIGH** — one omission = breach                                     | Scoped accessor + CI guard (Phase 1)                              |
| 2   | core-api    | `clients/supabase.py::insert/update`      | WRITE             | **service-role**   | caller                             | ❌ No                                         | ✅                      | **BYPASSED**    | **HIGH**                                                             | As above                                                          |
| 3   | core-api    | `clients/supabase.py::storage_upload`     | OBJECT WRITE      | **service-role**   | path `f"{ctx.user_id}/{doc_id}/…"` | ⚠️ Path convention                            | —                       | **BYPASSED**    | **MEDIUM** — path built correctly, not enforced                      | Enforce bucket policy on path prefix                              |
| 4   | core-api    | `clients/supabase.py::storage_signed_url` | OBJECT READ       | **service-role**   | caller path                        | ❌ No                                         | —                       | **BYPASSED**    | **MEDIUM** — arbitrary path ⇒ arbitrary object                       | Validate prefix == caller tenant                                  |
| 5   | core-api    | `clients/neo4j.py::query_personal`        | GRAPH READ        | basic auth         | `user_id` kwarg — **overridable**  | ❌ **No**                                     | ⚠️ statement-dependent  | N/A             | **HIGH (T-1)**                                                       | Refuse `user_id` in `parameters`; require `$user_id` in statement |
| 6   | core-api    | `clients/qdrant.py::search_personal`      | VECTOR READ       | api-key            | `build_personal_filter`            | ✅ **Yes**                                    | —                       | N/A             | **LOW**                                                              | Add `access_scope` clause (parity with gateway)                   |
| 7   | core-api    | `services/sharing.py::resolve`            | READ (unauth)     | service-role       | **share token**                    | ✅ capability                                 | —                       | BYPASSED        | **LOW** ✅                                                           | None — checks `revoked` + `expires_at`, audits every attempt      |
| 8   | api-gateway | `services/neo4j_client.py::run_personal`  | GRAPH READ        | basic auth         | required kwarg                     | ✅ **Yes — refuses unsafe Cypher & override** | —                       | N/A             | **LOW** ✅                                                           | Harvest into core-api                                             |
| 9   | api-gateway | `services/qdrant.py::search_personal`     | VECTOR READ       | api-key            | 3-clause filter                    | ✅ **Yes**                                    | —                       | N/A             | **LOW** ✅                                                           | Harvest                                                           |
| 10  | api-gateway | `services/qdrant.py::search_central`      | VECTOR READ       | api-key            | **none — by design**               | N/A                                           | domain only             | N/A             | **LOW** _if_ central truly holds no per-user data — **[UNVERIFIED]** | Verify no PII in `ln_central`                                     |
| 11  | api-gateway | `config.py::supabase_service_role_key`    | (held, unused)    | **service-role**   | —                                  | —                                             | —                       | BYPASSED        | **HIGH** — credential with no purpose                                | **Revoke now**                                                    |
| 12  | worker      | `neo4j_client.rs::merge_cypher_for`       | GRAPH WRITE       | basic auth         | `job.user_id`                      | ✅ **MERGE key**                              | —                       | N/A             | **LOW** ✅                                                           | None                                                              |
| 13  | worker      | `neo4j_client.rs` delete                  | GRAPH DELETE      | basic auth         | `job.user_id`                      | ✅ MATCH on tenant                            | —                       | N/A             | **LOW** ✅                                                           | None                                                              |
| 14  | worker      | `qdrant_client.rs` upsert                 | VECTOR WRITE      | api-key            | `canon.tenant_id`                  | ✅ payload                                    | —                       | N/A             | **LOW** ✅                                                           | None                                                              |
| 15  | worker      | `supabase_client.rs`                      | QUEUE R/W         | service-role       | queue row                          | ⚠️ job-scoped                                 | —                       | BYPASSED        | **LOW**                                                              | Audit job-claim race                                              |
| 16  | web         | SSR client (all routes)                   | R/W               | **anon + session** | `auth.uid()`                       | ✅ **RLS**                                    | —                       | **ENFORCED** ✅ | **LOW** ✅                                                           | Model to copy                                                     |
| 17  | web         | `platform/usage/route.ts`                 | READ              | anon + session     | **query string**                   | ❌ No app check                               | —                       | **ENFORCED** ✅ | **HIGH app-layer, contained by RLS (T-2)**                           | Add `is_tenant_member`                                            |
| 18  | web         | `platform/api-keys/route.ts`              | WRITE             | anon + session     | body + `is_tenant_member`          | ✅ **Yes**                                    | —                       | ENFORCED        | **LOW** ✅                                                           | Model to copy                                                     |
| 19  | edge        | `graphrag-query` Supabase                 | READ/CACHE        | **service-role**   | JWT **or worker secret + body**    | ⚠️ conditional                                | ✅ `.eq('user_id')`     | BYPASSED        | **HIGH (T-3)**                                                       | Signed, expiring service tokens                                   |
| 20  | edge        | `graphrag-query` Neo4j/Qdrant             | GRAPH+VECTOR READ | direct creds       | as above                           | ⚠️                                            | —                       | N/A             | **HIGH (T-3)**                                                       | As above                                                          |
| 21  | edge        | `graphrag-sync` Neo4j                     | GRAPH WRITE       | basic auth         | `job.user_id` → `$tid`             | ✅ tenant in MATCH/MERGE                      | —                       | N/A             | **LOW** ✅                                                           | None                                                              |
| 22  | edge        | `process-ingestion`                       | R/W               | service-role       | doc/job `user_id`                  | ⚠️ row-derived                                | —                       | BYPASSED        | **MEDIUM (T-5)** — `verify_jwt=false`                                | Verify ingress control                                            |
| 23  | edge        | `email-sync`, `calendar-sync`             | R/W               | **[UNVERIFIED]**   | **[UNVERIFIED]**                   | ?                                             | ?                       | ?               | **[UNVERIFIED]**                                                     | Audit before go-live                                              |
| 24  | all         | `graphrag.query_cache`                    | CACHE R/W         | service-role       | `user_id` + `query_hash`           | ✅ key includes tenant                        | ✅                      | BYPASSED        | **LOW**                                                              | Keep; add tenant to any future cache                              |
| 25  | core-api    | `analytics.advisor_turns`                 | LOG WRITE         | service-role       | `tr.user_id`                       | ⚠️ convention                                 | —                       | BYPASSED        | **LOW**                                                              | Include in scoped accessor                                        |

**Logs/analytics:** structured stdout in all tiers; `advisor_turns` durable. **No search index** exists.
**Queues:** the Supabase-table queue consumed by the worker — tenant on the row ✅.

---

## 3. Cross-Cutting Answers

| Question                                                    | Answer                                                                                                                                                                                                                                                                                                                 |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Where does authentication occur?**                        | Five places: web edge, web per-route, core-api per-route dependency, api-gateway per-route dependency, edge functions (JWT or worker secret). **No single trust boundary.**                                                                                                                                            |
| **Where is JWT validated?**                                 | Supabase SSR (web); `verify_jwt` (core-api); `verify_jwt` (gateway, duplicate code); `auth.getUser` (edge). **Four implementations, three codebases.**                                                                                                                                                                 |
| **Where is tenant identity derived?**                       | Four incompatible ways: session `user.id`; JWT `sub` (×2 tiers); `lnk_*` API-key `tenant_id`; **request body/query** on platform routes and the edge worker-secret path.                                                                                                                                               |
| **Can tenant identity be replaced downstream?**             | **Yes, in three places:** core-api Neo4j `parameters` override (T-1); web platform routes (T-2, contained by RLS); edge worker-secret `body.user_id` (T-3, by design).                                                                                                                                                 |
| **Is `user_id`/`tenant_id` accepted from user input?**      | **Yes** — `platform/usage`, `platform/api-keys`, `api/models`, and `graphrag-query` (worker path). Never on core-api or gateway HTTP boundaries ✅.                                                                                                                                                                    |
| **Which credentials per service?**                          | web: anon+session ✅ · core-api: **service-role** + Neo4j + Qdrant + Gemini + Plaid · gateway: **service-role (unused)** + Neo4j + Qdrant + Gemini · worker: service-role + Neo4j + Qdrant + Gemini · edge: **service-role** + Neo4j + Qdrant                                                                          |
| **Does service-role bypass RLS?**                           | **Yes — in core-api, worker, and all edge functions.** Only web runs under RLS.                                                                                                                                                                                                                                        |
| **Do downstream services revalidate?**                      | web→core-api ✅ (independent JWT verify). Everything else: **no revalidation** — no service-to-service hops exist except the edge worker secret.                                                                                                                                                                       |
| **Is service-to-service identity authenticated?**           | **Only** via the shared `x-worker-secret`. No mTLS, no signed tokens, no per-caller identity, no audit.                                                                                                                                                                                                                |
| **Is authorization duplicated?**                            | Authentication is quadruplicated; **authorization barely exists** — only API-key scopes, `is_tenant_member` (one route), and share-token capability.                                                                                                                                                                   |
| **Does the same endpoint behave differently across tiers?** | **Yes.** `/api/recommendations` (gateway) vs `/v1/recommendations` (core-api); `/api/platform/**` (web, API-key + session) vs `/v1/platform` (core-api, JWT); `/api/graphrag/query` (gateway, RRF+central) vs core-api retrieval (no fusion, flag-off) vs `graphrag-query` edge function (a **third** implementation). |

**Three GraphRAG implementations exist**, not two — core-api, api-gateway, and the `graphrag-query` edge
function, each with different tenant enforcement. **[NEW]**

---

## 4. Canonical Security Model — Invariant Compliance

| #   | Invariant                                                                  | Status         | Evidence / Gap                                                                                                                       |
| --- | -------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Authentication at a clearly defined trust boundary                         | ❌ **FAIL**    | 5 authentication points, 4 implementations, no single boundary                                                                       |
| 2   | Tenant identity only from verified claims or a narrow system context       | ❌ **FAIL**    | Body/query-supplied `tenant_id` on 3 web routes; `body.user_id` on the edge worker path                                              |
| 3   | Tenant identity immutable during the request                               | ❌ **FAIL**    | T-1 parameter override (latent); T-3 by design                                                                                       |
| 4   | Service-to-service calls carry authenticated, integrity-protected context  | ❌ **FAIL**    | Static shared bearer secret; no signature, expiry, audience, or caller identity                                                      |
| 5   | Downstream services do not trust arbitrary tenant headers                  | ⚠️ **PARTIAL** | No tenant headers are trusted — but `x-worker-secret` + body achieves the same effect                                                |
| 6   | User paths cannot obtain unrestricted datastore clients                    | ❌ **FAIL**    | 117 core-api sites use the service-role client directly                                                                              |
| 7   | Graph queries require tenant scope structurally                            | ⚠️ **SPLIT**   | ✅ gateway, worker, graphrag-sync · ❌ **core-api**                                                                                  |
| 8   | Vector searches require tenant scope structurally                          | ✅ **PASS**    | Both `build_personal_filter`s refuse empty `user_id`                                                                                 |
| 9   | Cache and storage keys tenant-scoped                                       | ⚠️ **PARTIAL** | ✅ `query_cache` key; ✅ upload path; ❌ `storage_signed_url` accepts an arbitrary path                                              |
| 10  | Background jobs declare explicit tenant scope                              | ✅ **PASS**    | Worker + graphrag-sync take tenant from the job row                                                                                  |
| 11  | Cross-tenant admin ops need a separate privileged capability + audit event | ❌ **FAIL**    | No admin plane, no RBAC, no cross-tenant audit event. The worker secret is an _undeclared_ cross-tenant capability with **no audit** |
| 12  | Missing context fails closed                                               | ⚠️ **PARTIAL** | ✅ Qdrant/Neo4j clients raise on empty tenant; ✅ edge falls back to JWT; ❌ **web edge fails OPEN** on missing config               |
| 13  | Shared-token routes are capability-scoped and cannot broaden access        | ✅ **PASS**    | 192-bit token, expiry clamped, `revoked` honoured, audience-redacted, **every attempt audited**                                      |
| 14  | Authorization behavior consistent across tiers                             | ❌ **FAIL**    | T-2: sibling routes differ; gateway/core-api have none; only web has any                                                             |
| 15  | Retired/non-authoritative routes cannot bypass the canonical path          | ❌ **FAIL**    | api-gateway is live, public, authenticating, and reaches Neo4j/Qdrant **independently of core-api**                                  |

**Score: 3 PASS · 4 PARTIAL · 8 FAIL.**

---

## 5. Adversarial Cross-Service Test Suite

Design only. **Not implemented** — these are the tests Phase 1 must make pass.

| #       | Attack                                                                          | Target                 | Expected            | Predicted today                                                                                                                    | Verdict    |
| ------- | ------------------------------------------------------------------------------- | ---------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| **A1**  | Forged tenant header (`x-tenant-id`, `x-user-id`)                               | all tiers              | Ignored             | **PASS** — no tier reads tenant headers                                                                                            | ✅         |
| **A2**  | Forged internal-service header — replay `x-worker-secret`                       | `graphrag-query`       | Reject              | **FAIL** — a valid secret grants impersonation of any `body.user_id`, unaudited                                                    | ❌ **T-3** |
| **A3**  | Direct access to an internal tier — call `api-gateway` with a valid user-A JWT  | gateway                | Ideally unreachable | **PARTIAL** — 401 without a JWT ✅, but a valid user JWT retrieves their own data from a tier outside all governance/rate limiting | ⚠️ **T-4** |
| **A4**  | Route divergence — same query via core-api vs gateway vs edge                   | all three              | Identical semantics | **FAIL** — three implementations, different fusion, different tenant rigour                                                        | ❌         |
| **A5**  | Stale/expired JWT                                                               | all tiers              | 401                 | **PASS** — `require:["exp"]` in both Python tiers; Supabase validates at the edge                                                  | ✅         |
| **A6**  | Mismatched subject vs tenant — user A JWT + `tenant_id=B`                       | `/api/platform/usage`  | 403                 | **PASS by RLS, FAIL in application** — zero rows returned; **no 403, no audit event**                                              | ⚠️ **T-2** |
| **A7**  | Service-role misuse — a request path reaching an unfiltered `select`            | core-api               | Impossible          | **FAIL** — expressible today; ~5 of 117 sites lack a visible `user_id` filter **[UNVERIFIED]**                                     | ❌ **T-4** |
| **A8**  | Cache contamination — user B reads user A's cached answer                       | `graphrag.query_cache` | Impossible          | **PASS** — key includes `user_id`, read filtered by it                                                                             | ✅         |
| **A9**  | Graph traversal across tenants — Cypher omitting the tenant filter              | core-api Neo4j         | Refused             | **FAIL** — no statement guard; **and** `parameters={"user_id": victim}` overrides the tenant                                       | ❌ **T-1** |
| **A9b** | Same attack                                                                     | gateway / worker       | Refused             | **PASS** — `run_personal` refuses; MERGE key is tenant-partitioned                                                                 | ✅         |
| **A10** | Vector retrieval across tenants — empty/forged `user_id`                        | both Qdrant clients    | Refused             | **PASS** — `build_personal_filter` raises on empty; filter is not caller-supplied                                                  | ✅         |
| **A11** | Shared-token escalation — expired/revoked token; token → broader data           | `/v1/share/{token}`    | Denied + audited    | **PASS** — `revoked` + `expires_at` checked, audience-redacted, every attempt logged                                               | ✅         |
| **A12** | Background-job scope confusion — payload carrying a foreign `user_id`           | worker, graphrag-sync  | Payload ignored     | **PASS** — tenant read from the job row, never the payload                                                                         | ✅         |
| **A13** | _(added)_ Fail-open edge — unset `NEXT_PUBLIC_SUPABASE_URL`                     | web proxy              | Deny all            | **FAIL** — allows all requests                                                                                                     | ❌         |
| **A14** | _(added)_ Signed-URL traversal — request a signed URL for another tenant's path | core-api storage       | Refused             | **FAIL** — no prefix validation                                                                                                    | ❌         |

**Result: 7 pass · 2 partial · 6 fail.**

---

## 6. Where Should Tenant Enforcement Occur?

**Recommendation: defense in depth, with a designated _primary_ mechanism per datastore.** "Enforce
everywhere" without naming a primary produces exactly today's outcome — everyone assumes another layer
covers it.

**T-2 is the empirical proof.** An application check was omitted; **RLS caught it**. The identical omission
in core-api would be a breach, because RLS is inert there. The lesson is not "add more checks" — it is
**"never remove the layer that catches your mistakes."**

### Target layered model

| Layer                         | Role                                                                                        | Enforcement                                                                         | Failure mode                              |
| ----------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------- |
| **1. Edge (web proxy)**       | Coarse gate: authenticated? beta? onboarded?                                                | **Must fail CLOSED** (fix A13)                                                      | Convenience only — never the sole control |
| **2. Service boundary**       | Verify credential; derive tenant from claims **only**; bind to an immutable request context | Shared `verify_jwt` library; tenant is a frozen value                               | Rejects forged identity                   |
| **3. Repository / client** ⭐ | **PRIMARY for Neo4j, Qdrant, storage, cache** — where RLS cannot reach                      | **Structural**: tenant a required parameter; refuse override; refuse unsafe queries | Raises — cannot be forgotten              |
| **4. Database (RLS)** ⭐      | **PRIMARY for Postgres**                                                                    | 688 existing policies, enforced by running under the **user's** credential          | Returns zero rows — catches app bugs      |
| **5. Audit**                  | Record every cross-tenant-capable operation                                                 | Structured events + alerts                                                          | Detection when 1–4 fail                   |

**Primary owner per datastore:**

| Datastore             | Primary                 | Secondary           | Rationale                                                                                           |
| --------------------- | ----------------------- | ------------------- | --------------------------------------------------------------------------------------------------- |
| **Postgres/Supabase** | **RLS (layer 4)**       | scoped accessor (3) | RLS is the only mechanism that survives an application bug. Requires ending service-role-by-default |
| **Neo4j**             | **Client (layer 3)**    | audit               | No RLS equivalent. The gateway's refuse-unsafe-Cypher pattern is correct — adopt it                 |
| **Qdrant**            | **Client (layer 3)**    | audit               | No RLS equivalent. Already correct                                                                  |
| **Object storage**    | **Bucket policy (4)**   | path validation (3) | Path convention alone is not enforcement                                                            |
| **Cache**             | **Key composition (3)** | —                   | Tenant in the key makes contamination unrepresentable                                               |
| **Queues / jobs**     | **Job row (3)**         | —                   | Already correct                                                                                     |

**Rejected alternatives:** _gateway-only_ (three tiers reach datastores directly — a gateway would not be on
the path); _every-service-identically_ (duplicated logic already diverges — T-1 vs the gateway is that
divergence); _repositories-only_ (abandons the layer that just caught T-2); _database-only_ (Neo4j, Qdrant,
storage and cache have no RLS).

### Canonical model — target state

```
Supabase Auth ──issues──► JWT (sub, aud, exp)
        │
   ┌────┴───────────────────────────────────────────────────────────┐
   │ TRUST BOUNDARY: exactly one shared verify_jwt implementation    │
   └────┬───────────────────────────────────────────────────────────┘
        ▼
   TenantContext(user_id)  — FROZEN, immutable for the request lifetime
        │
        ├─► Postgres  : user-credential client ⇒ RLS PRIMARY  + scoped accessor
        ├─► Neo4j     : client refuses untenanted Cypher / tenant override  ⇐ PRIMARY
        ├─► Qdrant    : filter builder refuses empty tenant                 ⇐ PRIMARY
        ├─► Storage   : bucket policy on {tenant}/ prefix                   ⇐ PRIMARY
        └─► Cache     : key = (tenant, …) by construction                   ⇐ PRIMARY

   Service-to-service: short-lived SIGNED token (issuer, audience, subject,
                       expiry) — never a static shared bearer secret.
                       Every cross-tenant capability emits an audit event.
```

---

## 7. Findings Summary & Priority

| ID       | Finding                                              | Severity               | Exploitable today?               | Contained by                | Invariants |
| -------- | ---------------------------------------------------- | ---------------------- | -------------------------------- | --------------------------- | ---------- |
| **T-1**  | core-api Neo4j: tenant override + no statement guard | **HIGH**               | **No** — 2 hard-coded call sites | Nothing (latent)            | 3, 7       |
| **T-2**  | `/api/platform/usage` missing authorization          | **HIGH**               | **No**                           | **RLS** ✅                  | 14         |
| **T-3**  | Worker-secret impersonation, unaudited               | **HIGH**               | Yes, with the secret             | Secret confidentiality only | 2, 4, 11   |
| **T-4**  | Service-role bypass ×117 + 2 holders                 | **HIGH**               | Latent                           | Code review                 | 6          |
| **T-5**  | `verify_jwt = false` ×2 edge functions               | **MEDIUM**             | **[UNVERIFIED]**                 | Row-derived tenant          | 1          |
| **T-6**  | 4 tenant models; no service identity                 | **MEDIUM**             | —                                | —                           | 1, 2, 4    |
| **T-7**  | Web edge fails open                                  | **MEDIUM**             | Only on misconfig                | core-api revalidates ✅     | 12         |
| **T-8**  | `storage_signed_url` accepts arbitrary paths         | **MEDIUM**             | **[UNVERIFIED]**                 | Caller discipline           | 9          |
| **T-9**  | Gateway holds an unused service-role key             | **HIGH (trivial fix)** | Only if the tier is compromised  | —                           | 6          |
| **T-10** | Three divergent GraphRAG implementations             | **MEDIUM**             | —                                | —                           | 14, 15     |

### Immediate (hours, no architectural dependency)

1. **T-9** — revoke the gateway's service-role credential. No Supabase usage exists. Halves the
   service-role blast radius.
2. **T-1** — reorder one dict spread and add a statement guard (**do not implement in this phase**; it is a
   two-line change with a large latent payoff).
3. **T-2** — add `is_tenant_member` to `/api/platform/usage` for parity with its sibling.

### Still unverified — must be closed before go-live

- `email-sync` / `calendar-sync` auth and tenant model
- Whether `ln_central` genuinely contains no per-user data (invariant for the untenanted search)
- The ~5 of 117 core-api select sites lacking a visible `user_id` filter
- Whether `process-ingestion` enforces identity despite `verify_jwt = false`
- Whether `storage_signed_url` callers ever pass an unvalidated path

---

## 8. Handoff to Remediation

This audit **replaces the Phase 1 scope statement** in `REMEDIATION_MASTER_PLAN.md` with concrete targets:
the access-site register (§2) is the enumeration Phase 1 called for; the adversarial suite (§5) is its test
plan; the invariant table (§4) supplies its exit criteria.

**Sequencing note.** T-1 sits in the Neo4j client that Phases 5B/5C will add call sites to. Fixing it
**before** retrieval work turns a latent defect into an impossible one; fixing it after means auditing every
new call site instead. **This is an argument for pulling the T-1 fix into Phase 1, not Phase 5.**

**Track separation holds:** T-1, T-2, T-3, T-9 are `sec/` work. None of them may be combined with retrieval
changes, and none require the Phase 5A ownership decision.

**Audit complete. No code modified. No remediation implemented.**
