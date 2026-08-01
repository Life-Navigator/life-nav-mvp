# Release Manifest — 5-user invite-only beta, 2026-08-02

**Produced by:** Prompt 0 (preflight) · **Updated by:** Prompt 1A (release infrastructure)
**Date:** 2026-07-31
**Status:** RELEASE INFRASTRUCTURE COMPLETE — no merge, no public deploy, no migration applied.

---

## 0. SHA taxonomy — read this before citing any SHA

Prompt 1A creates new commits, so `e8b0dac4` is **no longer the frozen candidate**. Seven distinct
identities, deliberately kept separate:

| Name                           | Value                                      | Meaning                                                                                 |
| ------------------------------ | ------------------------------------------ | --------------------------------------------------------------------------------------- |
| **Base `main` SHA**            | `91922cbdd08189737e3b1454508daafea97652e9` | What production is presumed to be running                                               |
| **Prompt 0 preflight SHA**     | `e8b0dac4e4417fe58c2dbf2ea291903ec97bbdab` | What the preflight inspected. **No longer the candidate**                               |
| **Release-infrastructure SHA** | recorded at freeze                         | Prompt 1A's code + harness commit                                                       |
| **Frozen candidate SHA**       | recorded at freeze                         | The commit gates run against. Named in the final response, the git tag, and the PR body |
| **Staging API SHA**            | pending deploy                             | Reported by `GET /version` on `lifenavigator-core-api-candidate`                        |
| **Staging web SHA**            | pending deploy                             | Reported by `GET /api/version` on the Vercel preview                                    |
| **Final production SHA**       | pending merge                              | Post-merge; must equal the frozen candidate                                             |

A commit cannot contain its own SHA, so the frozen candidate is recorded at freeze time in the final
response, an annotated git tag, and the PR body — never claimed from inside itself.

**Gates must cite the staging SHAs, and those must equal the frozen candidate.** A gate run against
an unproven SHA proves nothing — the finding that produced this entire workstream.

## 1. Candidate lineage

| Field                              | Value                                               |
| ---------------------------------- | --------------------------------------------------- |
| Candidate branch                   | `graphrag/data-contract-remediation`                |
| Base (remote default)              | `main` @ `91922cbdd08189737e3b1454508daafea97652e9` |
| Commits ahead of base at preflight | **41**                                              |
| Commits behind base                | **0**                                               |
| Working tree at preflight          | **clean**                                           |
| Preflight range                    | `91922cbd..e8b0dac4`                                |

**Expected vs actual:** 41 expected, **41 actual — confirmed by count and by full enumeration.**
The candidate is a strict fast-forward over `main`; no merge commit and no divergence.

## 2. Change inventory — 206 files

Grouped by class (directory counts, `git diff --name-only origin/main...HEAD`):

| Class                      | Areas                                                                                                                       | Files |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----- |
| **Documentation**          | `docs/beta` (26), `docs/semantic-platform/**` (58 across adrs/implementation/review/root), `docs/archive` (3), 2 root `.md` | ~89   |
| **Application — core-api** | `app/services` (8), `app/grounding/semantic` (8), `app/clients` (2), `app` (2), `scripts` (2), `evals/retrieval` (2)        | ~24   |
| **Application — web**      | `src/components/chat` (4), `src/components/chat/__tests__` (3), `src/lib/chat` (2)                                          | ~9    |
| **Application — worker**   | `apps/ingestion-worker/src` (8)                                                                                             | 8     |
| **Application — gateway**  | `apps/api-gateway` (3), `apps/api-gateway/app` (2)                                                                          | 5     |
| **Tests**                  | `apps/lifenavigator-core-api/tests` (12) + web `__tests__` (3)                                                              | 15    |
| **Infrastructure / CI**    | `.github/workflows` (3: `ci.yml`, `deploy-fly.yml`, `security-audit.yml`), `scripts/{ci,security,graphrag,beta}` (4)        | 7     |
| **Migrations**             | `supabase/migrations` (**3**)                                                                                               | 3     |
| **Artifacts**              | `artifacts/graphrag-reconciliation` (4), `artifacts/beta` (2), `artifacts/ci`                                               | ~7    |

### ⚠ Deviation from the brief

The brief named **two** migrations. The candidate adds **three**:

1. `20260728000000_advisor_turns_sources.sql` — **not named in the brief**
2. `20260731000000_advisor_response_reports.sql`
3. `20260731010000_response_report_review.sql`

All three are reviewed in `migration-review.md`. All three are additive. This is reported, not
silently absorbed.

## 3. CI workflows

| Workflow             | Purpose                                                                                                               | Triggers                                       |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `ci.yml`             | lint, typecheck, unit tests, build, e2e, invariants, secrets scan, migrations, ontology, governance, dependency audit | PR + push                                      |
| `deploy-fly.yml`     | test + deploy the 3 Fly apps                                                                                          | **push to `main` only**, path-filtered per app |
| `security-audit.yml` | scheduled security audit                                                                                              | schedule + dispatch                            |
| `advisor-eval.yml`   | advisor evaluation harness                                                                                            | dispatch                                       |
| `stale.yml`          | issue hygiene                                                                                                         | schedule                                       |

### Required checks (exact names — from `artifacts/ci/required_checks.json`)

1. `Architectural Invariants`
2. `Secrets Scan`
3. `Validate Migrations`
4. `Validate Ontology`
5. `Verify Governance Coverage`
6. `Lint`
7. `Type Check`
8. `Unit Tests`
9. `Dependency Audit`
10. `Build`

Deliberately **not** required (documented rationale): `Test core-api`, `Check ingestion-worker`
(both path-filtered — a required check that can skip creates an ambiguous merge state), `E2E Tests`
(needs secrets; would block fork PRs).

## 4. Branch protection

**`branch_protection_active: false`.** Blocker recorded as **B-17 — requires repository-admin
permission, not claimable from the repository.** Cannot be read or set in this preflight: no GitHub
token is present in the environment (`GH_TOKEN` / `GITHUB_TOKEN` unset).

Consequence: **`main` is currently force-pushable and directly writable, and no check is enforced at
merge time.** This is a Prompt 1 obligation.

## 5. Release and rollback workflows

**No rollback workflow exists.** `grep -rln "rollback" .github/workflows/ scripts/` returns nothing.
Deployment is forward-only via `deploy-fly.yml`. See `rollback-plan.md` for the manual procedure that
must exist before any production change.

## 6. Feature flags and defaults

| Flag                                  | Default     | Source                                    | Beta requirement                                                          |
| ------------------------------------- | ----------- | ----------------------------------------- | ------------------------------------------------------------------------- |
| `GRAPH_GROUNDING_ENABLED`             | **`false`** | `apps/lifenavigator-core-api/fly.toml:43` | **MUST remain false**                                                     |
| `GRAPH_RETRIEVAL_V2`                  | `true`      | `fly.toml`                                | inert while grounding is off (retriever is `None`, `dependencies.py:335`) |
| `PRIVATE_BETA_ENABLED`                | env-set     | core-api + web                            | must be **true** at launch                                                |
| `PRIVATE_BETA_ALLOWED_EMAILS`         | env-set     | core-api + web                            | must contain **only** synthetic users at deploy time                      |
| `PRIVATE_BETA_ALLOW_SYNTHETIC_DOMAIN` | env-set     | core-api                                  | enables synthetic probe accounts                                          |
| `PRIVATE_BETA_ADMIN_EMAILS`           | env-set     | core-api                                  | reviewer capability                                                       |
| `PRIVATE_BETA_BLOCK`                  | env-set     | core-api                                  | kill switch                                                               |

Runtime flag store: `ops.feature_flags`, `ops.user_feature_flag_overrides`, `ops.beta_invites`,
`ops.cohorts`, `ops.user_cohorts`, `ops.llm_usage_meter` (migration 090).

## 7. Production SHA — ~~NOT PROVABLE~~ **RESOLVED by Prompt 1A**

> **UPDATE 2026-07-31.** Both tiers now expose release identity: core-api `GET /version`, web
> `GET /api/version` (+ `X-LifeNavigator-Commit`). The SHA is injected at build time, a runtime git
> read is forbidden and test-enforced, and a missing SHA returns **503** in staging/production rather
> than a silent "unknown". `/api/version` was also made publicly reachable — it was returning 401
> through the proxy, which would have shipped an identity endpoint no auditor could read.
> See `release-identity-contract.md`. **28 tests + 1 proxy regression test.**
>
> The findings below describe the state _before_ that change and are retained as the record of why
> it was made. They remain true of the currently-deployed production build, which predates it.

### Original finding (pre-Prompt 1A)

| Target                                       | Result                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| API `/version`, `/__version`, `/api/version` | **404 — no version endpoint exists**                                                            |
| API `/healthz`                               | `{"status":"ok"}` — carries no SHA                                                              |
| Web response headers                         | `server: Vercel`, `x-vercel-cache: HIT`, `x-vercel-id: sfo1::dcmd6-…` — **no SHA, no build id** |
| Web `age` header                             | `620116`s ≈ **7.2 days** since that edge object was generated                                   |

**The deployed SHA cannot currently be proven from unauthenticated inspection.** This is a declared
stop condition. Two independent fixes are required:

- **Short term (Prompt 2 blocker):** read it from the platforms — needs `FLY_API_TOKEN` and
  `VERCEL_TOKEN` present as environment variables.
- **Structural (should land in this release or the next):** the API must expose a
  `/version` endpoint returning the build SHA, and the web app must surface `VERCEL_GIT_COMMIT_SHA`.
  Without it, "deployment confidence" (Gate H) is permanently unverifiable by anyone, including an
  external auditor. **Recommended as a P1 addition to this candidate.**

`origin/main` is `91922cbd`, and the deploy workflow fires only on push to `main`, so `91922cbd` is
the _presumed_ deployed SHA — but presumption is exactly what this programme forbids.

## 8. ~~Critical architectural constraint~~ **RESOLVED by Prompt 1A**

> **UPDATE 2026-07-31.** Option (a) was implemented. A candidate can now be deployed to a separate,
> disposable target **without merging to `main`**:
>
> - `.github/workflows/deploy-candidate.yml` — `workflow_dispatch` only, never on push
> - `scripts/beta/deploy_candidate.sh` — local equivalent, dry-runnable without credentials
>
> Both take an explicit 40-character SHA, refuse production outright, and never pass `--prod`.
> Targets: Fly app `lifenavigator-core-api-candidate` and a Vercel preview.
> **Verified by execution:** 8 distinct refusal paths all exit 1.
> See `candidate-deployment-plan.md`.
>
> **Compute is now isolated; the data plane is not** — see `staging-data-strategy.md`. The
> consequence is that migrations still cannot be rehearsed separately from production.

### Original constraint (pre-Prompt 1A)

`deploy-fly.yml` deploys **only on `push` to `refs/heads/main`**. There is **no staging app, no
`workflow_dispatch` deploy path, and no environment separation.**

Therefore **merging to `main` _is_ deploying to production.** Prompt 2's preferred order (dedicated
staging → protected preview + staging API → invite-locked production) cannot be satisfied for the
**API** as the repository stands. The options are:

- **(a)** Deploy the API to a **new temporary Fly staging app** from the candidate SHA using
  `flyctl deploy --app <staging>` outside the workflow — preserves "don't merge to deploy". Requires
  `FLY_API_TOKEN` and a staging Postgres/Supabase target.
- **(b)** Accept invite-locked production as the deployment target, with the allowlist closed and
  zero external users — which then **forces the merge before R-1 can run against the candidate**,
  directly conflicting with non-negotiable rule 5.

**(a) is the only option that satisfies both rule 5 and Prompt 2.** This limitation must be resolved
before Prompt 2 executes; it is not a detail.

## 9. Test totals (locally verified at candidate SHA, 2026-07-31)

| Suite                  | Result                                         | Duration |
| ---------------------- | ---------------------------------------------- | -------- |
| core-api pytest        | **1,066 passed / 0 failed**                    | 6.01s    |
| web jest               | **1,769 passed / 0 failed**, 154 suites        | 2.28s    |
| ingestion-worker cargo | **129 passed / 0 failed**                      | ~0.1s    |
| **Total**              | **2,964 passed / 0 failed**                    | —        |
| root `pnpm test`       | 4 tasks successful                             | 3.9s     |
| mobile `tsc --noEmit`  | 2 errors (non-blocking, app not in beta scope) | —        |

**Caveat carried forward:** the whole suite runs in under 10 seconds and touches no real dependency.
It cannot evidence deployed behavior. `@life-navigator/mobile#test` is an `exit 0` stub (B-21).
