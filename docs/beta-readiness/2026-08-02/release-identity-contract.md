# Release Identity Contract

**Added by Prompt 1A** to close the Prompt 0 blocker: _the deployed SHA was unprovable._

Before this, `/healthz` returned `{"status":"ok"}` with no build identity, `/version` 404'd on three
paths, and the web tier exposed no commit header. **Gate H ("deployment confidence") was therefore
unverifiable by anyone without platform credentials — which made every other gate result
provisional, because a gate passed against an unknown build proves nothing.**

---

## The contract

Both tiers expose the same shape, unauthenticated:

| Tier     | Endpoint           | Service value            |
| -------- | ------------------ | ------------------------ |
| core-api | `GET /version`     | `lifenavigator-core-api` |
| web      | `GET /api/version` | `lifenavigator-web`      |

```json
{
  "service": "lifenavigator-core-api",
  "commit_sha": "e8b0dac4e4417fe58c2dbf2ea291903ec97bbdab",
  "build_time": "2026-07-31T12:00:00Z",
  "environment": "staging",
  "version": "6.0.0"
}
```

`version` is omitted entirely when unset. `build_time` reports `"unknown"` rather than being omitted.
The web tier additionally sets `X-LifeNavigator-Commit`, so the SHA is readable from a `HEAD` request
and from proxy logs that never parse a body.

## Four rules, all load-bearing

### 1. The SHA is injected at build time, never derived at runtime

| Tier     | Mechanism                                                                             |
| -------- | ------------------------------------------------------------------------------------- |
| core-api | Dockerfile `ARG LN_COMMIT_SHA` → `ENV LN_COMMIT_SHA`                                  |
| web      | `next.config.ts` `env.NEXT_PUBLIC_LN_COMMIT_SHA`, seeded from `VERCEL_GIT_COMMIT_SHA` |

**A runtime git read is forbidden and enforced by test** (`test_sha_is_not_derived_from_a_runtime_git_directory`
asserts the module contains no `subprocess`, no `import git`, no `.git/HEAD`, no `rev-parse`).

The reason is not stylistic. The container has no `.git`; a runtime read in a container reports the
SHA of whatever tree the process happens to occupy — a lie by construction. In a dev shell it reports
the _uncommitted_ working tree, which is worse: it looks right.

### 2. Missing identity fails loudly where identity is a gate

`environment ∈ {production, staging, candidate}` with no injected SHA → **HTTP 503**, on both tiers.

An identity endpoint that answers `"unknown"` is worse than one that 404s, because `"unknown"` looks
like an answer. A build that forgets to inject the SHA must break visibly at the first health probe,
not silently degrade the audit six steps later.

Local development gets `commit_sha: "development-unbuilt"` — deliberately not 40 hex characters, so
it cannot be mistaken for a real SHA. Asserted by test.

### 3. Release identity only — never a reconnaissance surface

**Permitted:** service name, commit SHA, build time, environment name, application version.

**Forbidden, and asserted by test on both tiers:** credentials, account/project/team ids, hostnames,
deployment URLs, private URLs, database names, infrastructure identifiers, dependency status.

Dependency health stays at `/readyz` and does not move. `test_version_does_not_duplicate_readyz`
asserts `/version` carries no `services` key. The leak tests set real-looking secrets in the process
environment and assert none appear in the response.

### 4. It must be reachable without authentication

`/api/version` is added to `PUBLIC_ROUTES` handling in `apps/web/src/proxy.ts`, with a regression
test. **This was a live defect found during Prompt 1A**: the route returned 401 through the proxy,
which would have shipped an identity endpoint no auditor could read — the exact failure it exists to
prevent.

## Environment variables (names only)

| Variable                     | Tier     | Injected by                                  | Required           |
| ---------------------------- | -------- | -------------------------------------------- | ------------------ |
| `LN_COMMIT_SHA`              | core-api | Docker build-arg                             | staging/production |
| `LN_BUILD_TIME`              | core-api | Docker build-arg                             | recommended        |
| `LN_ENVIRONMENT`             | core-api | Docker build-arg / Fly env                   | yes                |
| `LN_APP_VERSION`             | core-api | Docker build-arg                             | optional           |
| `NEXT_PUBLIC_LN_COMMIT_SHA`  | web      | Vercel build env (← `VERCEL_GIT_COMMIT_SHA`) | staging/production |
| `NEXT_PUBLIC_LN_BUILD_TIME`  | web      | Vercel build env                             | recommended        |
| `NEXT_PUBLIC_LN_ENVIRONMENT` | web      | Vercel build env (← `VERCEL_ENV`)            | yes                |
| `NEXT_PUBLIC_LN_APP_VERSION` | web      | Vercel build env                             | optional           |

All four web variables are `NEXT_PUBLIC_*` and therefore **inlined into the client bundle — public by
construction.** Nothing sensitive may ever be added to `releaseIdentityEnv` in `next.config.ts`.

## Verification

```bash
CANDIDATE_SHA=<40-char sha> \
API_BASE_URL=https://lifenavigator-core-api-candidate.fly.dev \
WEB_BASE_URL=https://<preview>.vercel.app \
python3 scripts/beta/harness/verify_deployed_sha.py
```

Exit 0 only when **every** configured tier reports exactly `CANDIDATE_SHA`. A 503 is a **FAIL**, not
an unknown. A `development-unbuilt` placeholder in a deployed environment is a **FAIL**.

## Test coverage

| Suite                                                            | Tests  |
| ---------------------------------------------------------------- | ------ |
| `apps/lifenavigator-core-api/tests/test_version_endpoint.py`     | **16** |
| `apps/web/src/app/api/version/__tests__/version-route.test.ts`   | **12** |
| `apps/web/src/__tests__/proxy.test.ts` (public-route regression) | **1**  |

## Known limitation

`build_time` on the web tier defaults to build-evaluation time in `next.config.ts` when not injected
explicitly. That is accurate for a Vercel build, but a local `next build` will stamp local time.
It is metadata, not identity — `commit_sha` is the gate — but do not treat web `build_time` as
authoritative provenance.
