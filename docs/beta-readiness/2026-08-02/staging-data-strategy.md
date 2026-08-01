# Staging Data Strategy

**Decision required by Prompt 1A Task E. Evaluated in the prescribed order, choosing the safest
option that can actually be executed in the beta timeline with infrastructure that exists.**

---

## Options evaluated

### Option 1 — Separate Supabase staging project · **REJECTED (cannot execute in time)**

Strongest isolation: a distinct project, distinct credentials, distinct data plane. A cross-tenant
leak in staging could not touch a production row because the rows do not exist there.

**Why rejected:** no staging Supabase project exists, and creating one is not a measurement task. It
requires provisioning the project, replaying **all** migrations from `001` through `20260731010000`
(the repository holds well over 100), re-seeding reference data, re-pointing Neo4j and Qdrant, and
re-issuing every credential — with a hard revocation date of 2026-08-02. That is infrastructure
construction, and Prompt 1A explicitly forbids inventing infrastructure that does not exist.

**Recommended post-beta.** This is the correct long-term answer and should be scheduled.

### Option 2 — Temporary isolated database or schema in the existing project · **REJECTED (weaker than it looks)**

A `staging_*` schema alongside production schemas in the same Postgres instance.

**Why rejected — and this is the important reasoning:** it _appears_ isolated while sharing the one
thing that actually matters. The API resolves tenancy as `tenant_id = user_id` and reaches Supabase
through a **single service-role connection**. A schema boundary is invisible to that credential:
service-role holds `ALL` and RLS is bypassed. So a bug in the API's identity resolution — precisely
what R-1 exists to detect — would read production rows regardless of which schema the staging tables
live in.

Worse, it would **hide** such a bug: R-1 could pass against staging tables while the same code path
leaks in production. A boundary that produces false assurance is worse than no boundary.

### Option 3 — Dedicated, strongly isolated synthetic-beta tenants in the current environment · **✅ SELECTED**

Two ordinary beta users in the production data plane, isolated by the same mechanism that protects
every real user, and probed as ordinary users.

---

## Selected strategy: Option 3

### Why

1. **It tests the real boundary.** The isolation control under audit _is_ `tenant_id = user_id`
   enforced by the API. Options 1 and 2 would test a _different_ boundary (project or schema) and
   tell us nothing about the one that ships. R-1's finding is only meaningful if the probe runs
   against the mechanism production actually relies on.
2. **It is executable now** — no infrastructure invented, no migration replay, no new credentials.
3. **The blast radius is bounded and reversible**: two accounts, synthetic data only, with a cleanup
   procedure below.
4. Existing tooling already assumes it — `scripts/beta/verify_synthetic_accounts.py` and
   `scripts/beta/cleanup_and_verify_first5.sql` exist and target this model.

### Isolation boundary

| Layer        | Boundary                                                                                           | Strength                                      |
| ------------ | -------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Application  | `tenant_id = user_id`, resolved **server-side from the verified JWT**, never from the request body | **The control under test**                    |
| Postgres RLS | `ENABLE` + `FORCE` on `feedback.*` and `analytics.advisor_turns`                                   | ⚠ **service_role bypasses it** (finding M2-2) |
| Neo4j        | every node pattern binds `{tenant_id: $user_id}` — invariant **I-3**, mutation-proven in CI        | Strong, statically enforced                   |
| Qdrant       | per-tenant filter on the personal collection                                                       | Strong                                        |
| Beta gate    | `PRIVATE_BETA_ENABLED` + `PRIVATE_BETA_ALLOWED_EMAILS`                                             | Keeps everyone else out                       |

**Honest statement of the boundary: for `feedback.*` the database provides no defense-in-depth.** The
API is the only guard. That is exactly why R-1 must authenticate as an ordinary user and must never
hold a service-role credential.

### Dependency classification

| Dependency       | Staging or production?                                             |
| ---------------- | ------------------------------------------------------------------ |
| Supabase         | **PRODUCTION** (synthetic tenants inside it)                       |
| Neo4j Aura       | **PRODUCTION**                                                     |
| Qdrant           | **PRODUCTION**                                                     |
| Gemini / Vertex  | **PRODUCTION**                                                     |
| core-api compute | **STAGING** — temporary Fly app `lifenavigator-core-api-candidate` |
| web compute      | **STAGING** — Vercel preview deployment                            |

**Compute is isolated. Data is not.** State that plainly in every gate result: R-1 runs against the
production data plane with synthetic tenants, not against an isolated copy.

### Migration approach

All three migrations are additive and LOW risk (see `migration-review.md`). Because the data plane is
shared, **applying them "to staging" and "to production" is the same operation.**

Consequence, stated without softening: **Prompt 1A cannot apply these migrations at all.** Rule 5
forbids production migrations, and there is no separate target. The apply must happen in a later
prompt, explicitly authorised, via:

```bash
scripts/beta/apply_migrations.sh --env production --i-am-sure-production
```

after a PITR/backup timestamp is recorded per `rollback-plan.md §0`.

Mitigating factors: all three are additive, none is destructive, none locks a large table, and old
application code remains compatible in both directions (verified — `_ADVISOR_TURNS_COLUMNS` excludes
`sources`). The risk of applying them is genuinely low; the risk of applying them _without
authorisation_ is a process violation, which is what the rule protects.

### Seeding

Service-role credentials **may** seed synthetic records, verify administrative state, and clean up.
They **must never** execute R-1 probes — a service-role key bypasses RLS and would make every
isolation check pass vacuously. `_safe.require_no_service_role()` enforces this: R-1, R-2 and R-6
exit(2) if `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL` or `SUPABASE_ACCESS_TOKEN` is present.

Both tenants must be seeded with **materially different** personas and different populated domains,
so that leakage is _detectable_ rather than coincidentally absent. Two empty tenants would produce a
green R-1 that means nothing.

### Cleanup procedure

1. Revoke both synthetic invites (`ops.beta_invites`).
2. Remove both addresses from `PRIVATE_BETA_ALLOWED_EMAILS`.
3. Delete synthetic rows via `scripts/beta/cleanup_and_verify_first5.sql`, scoped to the two user ids.
4. Delete synthetic Neo4j nodes/edges by `tenant_id`.
5. Delete synthetic Qdrant points by tenant filter.
6. Destroy the temporary Fly app: `scripts/beta/deploy_candidate.sh --env staging --sha <sha> --destroy`.
7. Let the Vercel preview expire, or delete it explicitly.
8. Record completion in `evidence-index.md`.

### Residual risk

| Risk                                                    | Severity | Mitigation                                                                                                      |
| ------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------------- |
| Synthetic data lands in the production data plane       | Medium   | Scoped to 2 accounts; cleanup procedure above; synthetic-only content                                           |
| A destructive bug during seeding touches real rows      | **High** | Service-role writes are scoped to the two user ids and reviewed before execution; PITR timestamp recorded first |
| Migrations reach production before formal authorisation | Medium   | `apply_migrations.sh` requires **two** independent flags for production                                         |
| R-1 passes because both tenants are empty               | **High** | Seed materially different personas; treat an empty-200 as a finding, not a pass                                 |
| Production LLM spend from R-6                           | Low      | 11 scenarios, `ops.llm_usage_meter` caps spend                                                                  |
| Synthetic accounts outlive the exercise                 | Medium   | Cleanup step 1–2 on 2026-08-02 alongside credential revocation                                                  |

### Required environment-variable names

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` _(seed/verify/cleanup only)_, `SUPABASE_DB_URL`,
`SUPABASE_PROJECT_REF`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`BETA_SYNTHETIC_A_EMAIL`, `BETA_SYNTHETIC_A_PASSWORD`, `BETA_SYNTHETIC_B_EMAIL`,
`BETA_SYNTHETIC_B_PASSWORD`, `PRIVATE_BETA_ENABLED`, `PRIVATE_BETA_ALLOWED_EMAILS`,
`PRIVATE_BETA_ALLOW_SYNTHETIC_DOMAIN`.
