# Gateway Privilege Reduction — Supabase Service-Role Removal

**Date:** 2026-07-29 · **Service:** `apps/api-gateway` (Fly app `lifenavigator-api-gateway`)
**Scope:** remove an unused Supabase service-role grant. **Gateway not retired. Retrieval behavior
unchanged. Neo4j / Qdrant / Gemini access untouched.**
**Status:** ✅ **Code + configuration complete.** ⚠️ **Runtime secret removal is an owner action (§5).**

---

## 1. Evidence That Supabase Is Unused

Ten independent checks. All negative for Supabase _usage_; the only Supabase value the service needs is the
**JWT secret**, which it uses to _verify_ tokens Supabase Auth already issued — it never calls Supabase.

### 1.1 Config-field read analysis — the decisive check

```
$ for f in supabase_url supabase_anon_key supabase_service_role_key supabase_jwt_secret; do
    grep -rn "settings\.$f" app/ --include=*.py | grep -v config.py
  done

  supabase_url               : 0 read site(s)
  supabase_anon_key          : 0 read site(s)
  supabase_service_role_key  : 0 read site(s)
  supabase_jwt_secret        : 1 read site  → app/auth.py:108
```

`app/auth.py:108` is the sole consumer:

```python
return verify_jwt(token, settings.supabase_jwt_secret)
```

**Three fields were declared and never read.** One of them bypasses every Row-Level Security policy in the
project.

### 1.2 Full-text scan

`grep -rn -i "supabase"` across the entire service returns **only**: the JWT-verification code
(`app/auth.py`), the four config declarations, docstrings/comments, deployment templates, and a test
fixture. **No client construction, no HTTP call, no import.**

### 1.3 HTTP clients constructed

Three, all non-Supabase:

| Client         | File                           | Purpose                 |
| -------------- | ------------------------------ | ----------------------- |
| `QdrantClient` | `app/services/qdrant.py`       | vector search           |
| `GeminiClient` | `app/services/gemini.py`       | embeddings + generation |
| `Neo4jClient`  | `app/services/neo4j_client.py` | graph queries           |

### 1.4 Dependency factories (`app/deps.py`)

`_gemini_singleton`, `_qdrant_singleton`, `_neo4j_singleton`, `authenticated`. **No Supabase factory
exists**, so no route can receive a Supabase client through DI.

### 1.5 Route-by-route runtime requirements (objective 2)

| Router               | Prefix                   | Runtime dependencies                                    | Needs Supabase? |
| -------------------- | ------------------------ | ------------------------------------------------------- | --------------- |
| `graphrag`           | `/api/graphrag`          | `current_user`, `get_gemini`, `get_qdrant`, `get_neo4j` | ❌ No           |
| `recommendations`    | `/api/recommendations`   | `current_user`                                          | ❌ No           |
| `simulations`        | `/api/simulations`       | `current_user`                                          | ❌ No           |
| `optimizer`          | `/api/optimizer`         | `current_user`                                          | ❌ No           |
| `compliance`         | `/api/compliance`        | `current_user`                                          | ❌ No           |
| `arcana`             | `/api/arcana`            | `current_user`                                          | ❌ No           |
| `health_monitoring`  | `/api/health-monitoring` | `current_user`                                          | ❌ No           |
| `healthz` / `readyz` | —                        | none                                                    | ❌ No           |

Aggregate dependency census across all routers:

```
8 × Depends(current_user)   2 × Depends(get_qdrant)
2 × Depends(get_neo4j)      2 × Depends(get_gemini)   2 × Depends(current_user)
```

**Zero Supabase dependencies on any of the 16 routes.**

`app/routes/arcana.py` documents the intent explicitly — the user_id _"will be looked up from Supabase"_ in
a future design, and `app/services/arcana_lead_package.py:66` states _"we don't read Supabase from here."_
The credential was provisioned for a capability that was never built.

### 1.6–1.10 Remaining checks

| Check                      | Command                                        | Result                                                |
| -------------------------- | ---------------------------------------------- | ----------------------------------------------------- |
| Startup / shutdown hooks   | `grep "on_event\|lifespan\|startup\|shutdown"` | **None** (only a `getattr` on the logging module)     |
| Background tasks           | `grep "BackgroundTasks\|create_task"`          | **None**                                              |
| Dynamic / indirect imports | `grep "importlib\|__import__"`                 | **None**                                              |
| Direct env-var consumers   | `grep "os.environ\|os.getenv"`                 | **None** — all config flows through `Settings`        |
| Test utilities             | `tests/conftest.py`                            | Passed three unused fields to `Settings`; now removed |

**Conclusion: the gateway holds a project-wide, RLS-bypassing credential with no code path that can use it.**

---

## 2. Secrets Removed

| Location            | Change                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `app/config.py`     | Deleted `supabase_url`, `supabase_anon_key`, `supabase_service_role_key`. **Kept `supabase_jwt_secret`** (required for auth) |
| `.env.example`      | Removed all three; documented why, with a pointer to this file                                                               |
| `deploy.sh`         | Removed from `REQUIRED=(…)` and from the `fly secrets set` invocation                                                        |
| `fly.toml`          | Removed from the provisioning comment block                                                                                  |
| `tests/conftest.py` | Removed the three fixture values                                                                                             |
| `app/main.py`       | Added a startup warning if the platform still injects them (§5)                                                              |

**Verification — no residual references except intentional guards/comments:**

```
$ grep -rn "SERVICE_ROLE|supabase_service_role|supabase_url|supabase_anon" \
       .env.example deploy.sh fly.toml tests/ app/
  deploy.sh:12       # (…removed 2026-07-29 — unused here)      ← comment
  app/config.py:20   # …were declared here                       ← comment
  app/config.py:57   _FORBIDDEN_SETTINGS = (…)                    ← the guard
  app/main.py:42,49  residual-credential warning                  ← the detector
  .env.example:11    # REMOVED 2026-07-29 …                       ← comment
```

### Fail-closed guard (objective 6)

`app/config.py` — re-adding a read site now raises immediately with an explanation, instead of a bare
`AttributeError` whose obvious "fix" is to put the field back and silently re-grant the privilege:

```python
_FORBIDDEN_SETTINGS = ("supabase_service_role_key", "supabase_url", "supabase_anon_key")

def _forbidden_attr(self, name):
    if name in _FORBIDDEN_SETTINGS:
        raise AttributeError(
            f"{name!r} was deliberately removed from the api-gateway … "
            "If you now need Supabase here, do NOT re-add this field: request a scoped credential "
            "and a security review. Re-adding it re-grants a key that bypasses all Row-Level Security.")
    raise AttributeError(name)

Settings.__getattr__ = _forbidden_attr
```

---

## 3. Credentials Revoked

**None. Revocation is deliberately NOT performed — see §5.**

| Credential                  | Distinct to gateway?           | Action                                                    |
| --------------------------- | ------------------------------ | --------------------------------------------------------- |
| Supabase `service_role` key | ❌ **Shared project-wide**     | **Grant removed from this service. Key NOT revoked** (§5) |
| Supabase `anon` key         | ❌ Shared project-wide         | Grant removed. Not revoked                                |
| `SUPABASE_URL`              | ❌ Not a secret                | Removed                                                   |
| `SUPABASE_JWT_SECRET`       | ❌ Shared (project JWT secret) | **Retained — required**                                   |

---

## 4. Test Commands and Results

All run from `apps/api-gateway` unless noted. **Every command below was executed; results are verbatim.**

```
1. IMPORT VALIDATION
   $ PYTHONPATH=. .venv/bin/python -c "import app.main, app.config, app.deps, app.auth"
   → imports OK                                                              ✅

2. STARTUP TEST
   $ PYTHONPATH=. .venv/bin/python -c "from app.main import create_app; create_app()"
   → app built: LifeNavigator API gateway
   → routes: 16                                                              ✅

3. GATEWAY TEST SUITE (includes route tests)
   $ PYTHONPATH=. .venv/bin/python -m pytest tests/ -q
   → 36 passed in 0.09s                                                      ✅

4. HEALTH CHECK
   GET /healthz → 200 {'status': 'ok'}
   GET /readyz  → 200 {'status': 'ok'}                                       ✅

5. AUTHENTICATED GRAPHRAG SMOKE  (signed HS256 JWT, aud=authenticated; store
   clients faked so no production data is touched)
   POST /api/graphrag/query → 200
     user_id echoed : 11111111-1111-1111-1111-111111111111
     personal_hits  : 1
     central_hits   : 1
     fused (RRF)    : 1   rrf_score=0.033333                                 ✅
   → RRF fusion, central retrieval, and the tenant-scoped Cypher guard all still
     execute. The fake Neo4j client asserts `$tenant_id` is present in the Cypher,
     so the structural tenant guard is exercised, not bypassed.

6. UNAUTHENTICATED REQUEST STILL REJECTED
   POST /api/graphrag/query (no Authorization) → 401                         ✅

7. FAIL-CLOSED GUARD
   Settings().supabase_service_role_key → AttributeError ✅
   Settings().supabase_url              → AttributeError ✅
   Settings().supabase_anon_key         → AttributeError ✅

8. CORE-API REGRESSION (no shared code, verified anyway)
   $ cd ../lifenavigator-core-api && .venv/bin/python -m pytest tests -q
   → 900 passed                                                              ✅

9. LIVE SERVICES UNAFFECTED (changes not yet deployed)
   lifenavigator-core-api    /healthz → 200                                  ✅
   lifenavigator-api-gateway /healthz → 200                                  ✅
```

**Objective-8 verification:**

- `/healthz` still works ✅ (local 200; live 200)
- Authenticated GraphRAG reaches identical pre-existing behavior ✅ (RRF + central + tenant guard intact;
  no retrieval file was modified)
- No Supabase credential remains attached **in code or deployment config** ✅ — **runtime store pending (§5)**
- No legitimate active service broken ✅ (36 + 900 tests; both live health checks 200)

---

## 5. ⚠️ The Credential Is Shared — Why Nothing Was Revoked

**Objective 5 applies.** The Supabase `service_role` key is **project-wide, not gateway-specific**. It is
consumed by:

```
apps/lifenavigator-core-api/app/config.py, app/clients/supabase.py   ← ACTIVE, authoritative tier
apps/ingestion-worker/src/config.rs, src/supabase_client.rs          ← ACTIVE
apps/web/src/app/api/email/{messages,status}/route.ts                ← ACTIVE
apps/web/src/app/api/integrations/linkedin/sync/route.ts             ← ACTIVE
supabase/functions/* (graphrag-query, process-ingestion, …)          ← ACTIVE
apps/api-gateway/app/config.py                                       ← REMOVED by this change
```

**Revoking it would break every active service.** Per the instruction, it was not revoked blindly, and the
prescribed "issue a separate least-privilege credential first" path is **not executable as a narrow change**:

- Supabase's classic `service_role` key is a **single project-level JWT**. There is no per-service variant
  to mint. Genuine least-privilege requires either the newer publishable/secret-key model (if this project
  supports it) or dedicated Postgres roles + PostgREST JWTs — a design task with its own migration, review,
  and rollout across five consumers.
- That work belongs in `REMEDIATION_MASTER_PLAN.md` **Phase 1**, not here.

**What this change achieves regardless:** the gateway will no longer _receive_ the key. Removing the code
path removes the grant; it does not remove the key from the platform.

### Owner actions to complete the reduction

```bash
# 1. Remove the secrets from the Fly runtime store (flyctl is installed but NOT authenticated here)
flyctl auth login
flyctl secrets unset SUPABASE_SERVICE_ROLE_KEY SUPABASE_URL SUPABASE_ANON_KEY \
       -a lifenavigator-api-gateway

# 2. Confirm removal
flyctl secrets list -a lifenavigator-api-gateway     # expect: only SUPABASE_JWT_SECRET remains, plus
                                                     # GEMINI_*, QDRANT_*, NEO4J_*, ALLOWED_ORIGINS

# 3. Verify the service still serves
curl -fsS https://lifenavigator-api-gateway.fly.dev/healthz     # expect {"status":"ok"}
```

**Until step 1 runs, privilege reduction is INCOMPLETE** — the process still holds the key in memory even
though no code reads it, so a container compromise still leaks it. `app/main.py` now emits a structured
startup warning naming the exact `flyctl secrets unset` command whenever the variables are still present,
so the residual cannot be silently forgotten:

```json
{
  "event": "residual_unused_credential",
  "service": "api-gateway",
  "variables": ["SUPABASE_SERVICE_ROLE_KEY"],
  "impact": "service_role bypasses all RLS; this service has no Supabase usage",
  "remediation": "flyctl secrets unset SUPABASE_SERVICE_ROLE_KEY -a lifenavigator-api-gateway"
}
```

**Why a warning and not a hard startup failure:** the credential is unused, so refusing to boot would trade
a real-but-contained exposure for an outage during the migration window. The _code-requires-it_ case — the
one objective 6 targets — **does** fail closed, via `_FORBIDDEN_SETTINGS`.

---

## 6. Remaining Gateway Privileges

| Privilege                             | Retained?      | Justification                                                                                                                                         |
| ------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_JWT_SECRET`                 | ✅ **Yes**     | The only Supabase value required. Verifies HS256 JWTs locally; grants **no** access to Supabase data. Removing it makes every route unauthenticatable |
| `NEO4J_URI` / `USERNAME` / `PASSWORD` | ✅ Yes         | Explicitly out of scope. Personal + central graph reads are the service's function; `run_personal` refuses Cypher lacking `$tenant_id`                |
| `QDRANT_URL` / `API_KEY`              | ✅ Yes         | Out of scope. Vector search; `build_personal_filter` refuses an empty `user_id` and requires `tenant_id` + `user_id` + `access_scope`                 |
| `GEMINI_API_KEY`                      | ✅ Yes         | Out of scope. Query embeddings for retrieval                                                                                                          |
| `ALLOWED_ORIGINS`                     | ✅ Yes         | CORS. **Note:** defaults to `*` — a separate confirmed finding (`SECURITY_AUDIT.md` / `CROSS_SERVICE_TENANT_ISOLATION_AUDIT.md`), not addressed here  |
| **Supabase `service_role`**           | ❌ **REMOVED** | Zero read sites. Bypasses all RLS. Highest-privilege credential in the system, held by a service with no callers                                      |
| **Supabase `anon` key**               | ❌ **REMOVED** | Zero read sites                                                                                                                                       |
| **`SUPABASE_URL`**                    | ❌ **REMOVED** | Zero read sites; only meaningful alongside a removed key                                                                                              |

**Net effect:** service-role holders drop from **2 → 1** (core-api only) once §5 step 1 completes. The
gateway retains exactly the credentials its 16 routes demonstrably use.

---

## 7. Rollback Instructions

**Code rollback (fast, no data implications):**

```bash
cd apps/api-gateway
git checkout HEAD -- app/config.py app/main.py .env.example deploy.sh fly.toml tests/conftest.py
PYTHONPATH=. .venv/bin/python -m pytest tests/ -q      # expect 36 passed
```

**If the Fly secrets were already unset and must be restored:**

```bash
flyctl secrets set SUPABASE_SERVICE_ROLE_KEY="<value from the secret manager>" \
                   SUPABASE_URL="https://<project>.supabase.co" \
                   SUPABASE_ANON_KEY="<value>" \
                   -a lifenavigator-api-gateway
```

The `service_role` key is **not regenerated** by this change, so the original value remains valid and
retrievable from wherever core-api's copy is stored. **Rollback is fully reversible.**

**Rollback triggers:** (a) a route is discovered that needs Supabase — but §1 shows none exists; (b) the
`_FORBIDDEN_SETTINGS` guard blocks legitimate work — the correct response is a scoped credential and a
review, not a rollback.

**Blast radius if rolled back:** none. Retrieval, auth, and all 16 routes are byte-identical either way.

---

## 8. Scope Boundaries Observed

| Instruction                               | Compliance                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Do not retire the gateway                 | ✅ Running, deployed, all routes intact                                                                             |
| Do not modify retrieval behavior          | ✅ No file under `app/services/` or `app/routes/` changed. Smoke test proves RRF + central + tenant guard unchanged |
| Do not revoke Neo4j / Qdrant / Gemini     | ✅ Untouched                                                                                                        |
| Do not perform unrelated refactoring      | ✅ Changes confined to Supabase config removal + the guard + its detector                                           |
| Do not revoke a shared credential blindly | ✅ Not revoked; sharing documented; owner path in §5                                                                |

**Not done, deliberately:** gateway retirement, GraphRAG harvest, CORS `*` fix, the shared-credential
least-privilege redesign. Each is tracked elsewhere in `REMEDIATION_MASTER_PLAN.md`.

**Stopping here as instructed.**
