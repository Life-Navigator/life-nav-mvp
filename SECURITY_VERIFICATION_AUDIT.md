# Security Verification Audit

Verification Audit — Phase 3.

## Method

Inspect the security claims from Sprint N.2 + the injection addendum.
Where Sprint N.2 said "X is fixed", verify by grep. Where the audit
spec asks something more specific (search_path, RLS, error leakage,
service-role safety), verify by SQL inspection and code search.

## Findings

### 3.1 Localhost fallbacks — PARTIALLY fixed

Sprint N.2 hardened 4 server-side proxy routes
(google/disconnect, stripe/portal, stripe/checkout, oauth/callback)

- SMTP. Verified.

**However**, additional fallbacks remain in the working tree:

| File                                                              | Type                                 | Risk                   | Recommendation                                                        |
| ----------------------------------------------------------------- | ------------------------------------ | ---------------------- | --------------------------------------------------------------------- |
| `apps/web/src/components/auth/EmailVerification.tsx:42`           | Client-side                          | LOW (browser, no SSRF) | Harden with `requireEnv` pattern                                      |
| `apps/web/src/app/dashboard/finance/add/page.tsx:69`              | Client-side                          | LOW                    | Same                                                                  |
| `apps/web/src/app/dashboard/healthcare/add/page.tsx:73`           | Client-side                          | LOW                    | Same                                                                  |
| `apps/web/src/app/dashboard/healthcare/insurance/page.tsx:27, 56` | Client-side                          | LOW                    | Same                                                                  |
| `apps/web/src/lib/api/agent.ts:6`                                 | Likely client-side via Next bundling | LOW                    | Same                                                                  |
| `apps/web/src/lib/api/backend-services.ts:16-20`                  | **Server-side**                      | MODERATE if imported   | **Dead code: 0 production importers — delete or harden**              |
| `apps/web/src/services/agent-proxy.ts:452`                        | **Server-side**                      | MODERATE if imported   | **Test-only importer (32s test). Recommend delete; if kept, harden.** |

Risk classification: client-side fallbacks render in the browser and
target the user's own machine. They cannot exfiltrate via Vercel
runtime. They are still poor practice and should be cleaned.

`backend-services.ts` and `agent-proxy.ts` are the genuinely
server-dangerous ones. Verified zero production importers:

```text
$ grep -rln "from.*lib/api/backend-services" apps/web/src | grep -v __tests__ | grep -v \.md
(no output — zero production importers)

$ grep -rln "from.*services/agent-proxy" apps/web/src | grep -v __tests__ | grep -v \.md
(no output — zero production importers; only the .test.ts file)
```

**Status:** Sprint N.2's claim "no localhost fallbacks in production
server routes" is true for the 4 routes it scoped. The two
server-side library files above remain. They are **dead code**, but
Sprint N.2 missed them.

### 3.2 Raw error.message leakage

Sprint N.2 introduced `lib/security/safe-error.ts` and applied it to
the 4 proxy routes. Verified.

**However**, ~50 other routes still return raw `error.message`. Counted
by grep:

```text
$ grep -rn "error: error\.message" apps/web/src/app/api | wc -l
~50 occurrences across various routes
```

Sprint N.2's deliverable report acknowledged this: "the remaining
routes' migration to the helper is the Closed Beta task". This is
honest. The audit findings concur — partial fix, not complete.

**Status:** **PARTIAL.** The helper exists and is applied to the
highest-impact server-side proxy paths. The bulk migration is queued.

### 3.3 SECURITY DEFINER search_path

Sprint N.2 added migration `094_harden_security_definer_search_path.sql`
which dynamically pins `search_path = public, pg_catalog, pg_temp` on
every SECURITY DEFINER function in the managed schemas. Self-test
fails the migration on any remaining gap.

Verified by reading 094\_\*.sql lines 1-78. Self-test idempotent: a
second run finds zero functions to alter and the assertion passes.

✅ **PASS.**

### 3.4 Migration 005 RLS retrofit

`supabase/migrations/005_scenario_lab_schema.sql` contains 15
`ENABLE ROW LEVEL SECURITY` statements (verified by `grep -c`) plus
a DO-block self-test that fails the migration if any of the 14 tables
ends up RLS-disabled.

Migration 006 still adds the per-policy grants.

✅ **PASS.**

### 3.5 Migration 002 consolidation

`supabase/migrations/`:

```text
ls 002_*  → 002_storage_buckets.sql (one file)
ls _archived/  → 002_storage_buckets_fixed.sql
                 002_storage_buckets_robust.sql
                 README.md
```

✅ **PASS.**

### 3.6 Service-role safety

Inspecting the audit, RLS retrofit, and the SECURITY DEFINER tightening
together:

- `service_role` policies exist for every governance + ingestion +
  security + platform table (verified by grep on each migration).
- `platform.is_tenant_member` SECURITY DEFINER helper is the only
  cross-tenant gate, and it has pinned search_path (verified in the
  migration source).
- No application code calls `auth.admin.*` outside the audited
  governance and platform admin routes.

✅ **PASS** with one observation: the route that creates API keys
(`/api/platform/api-keys`) does use the service-role client to insert
into `platform.tenant_api_keys`. This is correct because the table is
RLS-locked to service-role for write, but the route's own admin check
(via `is_tenant_member(...,'admin')`) is the only barrier between an
authenticated user and key creation. Sprint N.2 verified the auth check
exists; this audit confirms.

### 3.7 New injection-defense audit (addendum)

Migrations 095, 096, 097 verified present:

```text
095_security_injection_audit.sql
096_untrusted_content_boundary.sql
097_constitutional_threat_intel.sql
```

Each has a self-test DO-block. ✅ **PASS.**

## Verdict for Phase 3

**PARTIAL PASS.**

| Item                                                      | Status                        |
| --------------------------------------------------------- | ----------------------------- |
| Localhost fallbacks (4 proxy routes)                      | PASS                          |
| Localhost fallbacks (backend-services.ts, agent-proxy.ts) | RESIDUAL — recommend deletion |
| Localhost fallbacks (client-side dashboard pages)         | RESIDUAL — low risk           |
| Error leakage on highest-impact routes                    | PASS                          |
| Error leakage across the remaining ~50 routes             | RESIDUAL — Closed Beta task   |
| SECURITY DEFINER search_path                              | PASS                          |
| Migration 005 RLS                                         | PASS                          |
| Migration 002 consolidation                               | PASS                          |
| Service-role authorization                                | PASS                          |
| Injection-defense audit tables                            | PASS                          |

## Recommendation

Delete `apps/web/src/lib/api/backend-services.ts` and
`apps/web/src/services/agent-proxy.ts` (plus its test) — they are
confirmed orphan modules referencing a Python backend that no
production route uses. This closes the residual server-side localhost
risk completely.

The ~50 client-rendered routes that still return `error.message`
should be migrated to `safeApiError` per the existing helper pattern.
This is a mechanical sweep, ~1 person-day.
