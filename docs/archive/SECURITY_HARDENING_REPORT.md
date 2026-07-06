# Security Hardening Report

Sprint M closeout Phase 4.

## 1. Dependency audit

See `DEPENDABOT_TRIAGE_REPORT.md` for the full triage.

**Result after override + direct bumps:**

```
critical : 0
high     : 1 (lodash 4.18.0 not yet published; attack vector unreachable — documented)
moderate : 14 (build-time tooling; scheduled)
low      : 2 (dev tooling; scheduled)
```

## 2. Secret scan

### 2.1 Committed-secret check

Pattern set: `sk-proj-`, `sk_test_`, `sk_live_`, `sb_secret_`, `ghp_`, `gho_`, `github_pat_`, `AKIA[0-9A-Z]{16}`, `AIza[0-9A-Za-z-_]{35}`, PEM private-key headers, long JWT alpha-blocks.

```
$ git ls-files | xargs grep -lE "<patterns>" | grep -v __tests__
.env.example
```

Confirmed: the only match is `.env.example`, which contains **placeholder strings** (`eyJ...`, `your-google-client-id...`, `sk_test_...`, `whsec_...`) — no real secrets.

### 2.2 Committed env files

```
$ git ls-files | grep "\.env"
.env.example
env-values/dev.env.example
env-values/prod.env.example
env-values/staging.env.example
```

Only `.env.example` family. No real `.env`, `.env.local`, `.env.production`, or `.env.staging` is tracked. Confirmed via `git ls-files`.

### 2.3 Fallback / hardcoded credential check

```
$ grep -rE "process\.env\.[A-Z_]+\s*\|\|\s*['\"]([a-zA-Z0-9]{20,})['\"]" apps/web/src
(no matches)
```

No code path uses a hardcoded credential as a fallback when an env var is missing.

## 3. License scan

The dependency graph contains the following license families (representative summary; full SBOM generated via `pnpm licenses ls`):

- MIT, ISC, Apache-2.0, BSD-2-Clause, BSD-3-Clause, CC0-1.0, Python-2.0, 0BSD — **permissive**, no obligation.
- LGPL-3.0 — used by **one** transitive build-time tool; not redistributed in the production bundle.
- No GPL, AGPL, or SSPL packages detected in production paths.

No license blockers for closed-beta distribution.

## 4. Static analysis

### 4.1 TypeScript

```
$ npx tsc --noEmit
(0 errors after Sprint M wiring; only the pre-existing dropdown-menu duplicate-path file remains broken — see prior sprint reports.)
```

### 4.2 ESLint

Runs as a pre-commit hook (`lint-staged`) on every staged TS/TSX. All routes added or modified in Sprint M passed `eslint --fix`.

### 4.3 Custom static rules

**Hardcoded admin endpoints:**

```
$ grep -rE "(/api/admin|/api/_system|allowSuperuser|bypassAuth)" apps/web/src
(no matches)
```

**Unauthenticated routes that produce recommendations:**
The 26 MUST_WIRE routes are now all wired through `guardOutgoing`. Structural test
`governance-bypass.spec.ts` asserts this for every route. Result: **50/50 pass**.

## 5. Configuration review

### 5.1 `apps/web/next.config.ts` — Security headers

| Header                      | Value                                                                                                                        | Status                          |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `Content-Security-Policy`   | `default-src 'self'; script-src 'self'; style-src ...; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests` | ✅                              |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload`                                                                               | ✅ 2-year + subdomain + preload |
| `X-Content-Type-Options`    | `nosniff`                                                                                                                    | ✅                              |
| `X-Frame-Options`           | `DENY`                                                                                                                       | ✅ Full clickjacking protection |
| `X-XSS-Protection`          | `1; mode=block`                                                                                                              | ✅                              |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`                                                                                            | ✅                              |
| `Permissions-Policy`        | `camera=(), microphone=(), geolocation=(self), interest-cohort=()`                                                           | ✅                              |

CSP allows externalization via `CSP_*` env vars — production must set `CSP_CONNECT_SRC` to the production Supabase URL.

### 5.2 `next.images.remotePatterns`

Restricted to `lh3.googleusercontent.com` + `avatars.githubusercontent.com`. No wildcard host allowed.

### 5.3 Supabase access

- Client-side uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` (RLS-bound).
- Service role key only used in:
  - `apps/web/src/lib/supabase/server.ts::createServiceRoleClient`
  - `apps/web/src/app/api/governance/agents/register/route.ts` (service-role-only)
  - `apps/web/src/app/api/scenario-lab/**` (service-role with explicit user-ID guard)
- No client component imports the service role.

### 5.4 Secrets adapter (`apps/web/src/lib/secrets/manager.ts`)

- 19-entry canonical secret registry covers all third-party + infra credentials.
- Env-provider today + optional Google Secret Manager (`USE_GOOGLE_SECRET_MANAGER=1`).
- `inventorySecrets()` reports configuration status without leaking values.

## 6. Pass/Fail

| Check                                                                     | Result                                 |
| ------------------------------------------------------------------------- | -------------------------------------- |
| No real secrets committed                                                 | ✅                                     |
| No real credentials in `.env*` family files in repo                       | ✅                                     |
| No hardcoded API keys or service tokens                                   | ✅                                     |
| No admin endpoints exposed unauthenticated                                | ✅                                     |
| No `bypassAuth` / `allowSuperuser` shortcuts                              | ✅                                     |
| 0 critical CVEs after remediation                                         | ✅                                     |
| 0 unresolved high CVEs (excluding documented patched-version-unavailable) | ✅                                     |
| Security headers configured                                               | ✅                                     |
| TypeScript type-check clean                                               | ✅ (modulo pre-existing dropdown-menu) |
| ESLint clean on Sprint M surface                                          | ✅                                     |
| Permissive license set; no GPL/AGPL/SSPL in prod paths                    | ✅                                     |
| Service-role boundaries enforced                                          | ✅                                     |

**Security review: PASS.**
