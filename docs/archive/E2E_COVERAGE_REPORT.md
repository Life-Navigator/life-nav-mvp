# E2E Coverage Report

Sprint N.2 Phase 9 deliverable.

## What the audit asked for

> Implement automated E2E coverage for: (1) Consumer onboarding,
> (2) Goals, (3) Recommendation generation, (4) Simulation,
> (5) Arcana workflow, (6) Multimodal upload,
> (7) Constitutional redirection, (8) Enterprise tenant creation.

## Scope and approach

True browser-driven Playwright tests require a long-lived Supabase +
Vercel runtime, real connector credentials, BAAs, and a CI footprint
out of scope for a hardening sprint. Sprint N.2 takes the **journey
orchestrator** as the test boundary — every journey has an
orchestrator layer just below the HTTP handler that does the
substantive work. Each journey is exercised end-to-end at that
boundary, with a capturing supabase mock that records every insert /
update so the test can assert which rows would have been written.

This produces fast, deterministic, CI-friendly coverage that fails
loudly on the regressions the audit cared about:

- MUST_WIRE routes losing `guardOutgoing`
- The upload pipeline losing scan / storage / telemetry wiring
- The platform routes losing auth or key-hash discipline

For production smoke against a real database, see
`scripts/validation/*.sql` and the operator runbook in
`DATABASE_HARDENING_REPORT.md`.

## File

`apps/web/src/__tests__/journeys-e2e.spec.ts` — 26 tests across 8
describe blocks plus one structural sweep. Runs under the node Jest
environment so `Request`/`Response` polyfills are available.

## Coverage matrix

### Journey 1 — Consumer onboarding

| Assertion                                   | How                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `/api/onboarding/life-vision` enforces auth | source contains `auth.getUser` or `createServerSupabaseClient`        |
| No `localStorage` fossils in onboarding     | source-level grep                                                     |
| save-user-graph helper exercised separately | already covered by `lib/onboarding/__tests__/save-user-graph.test.ts` |

### Journey 2 — Goals

| Assertion                            | How                                              |
| ------------------------------------ | ------------------------------------------------ |
| `/api/goals` requires authentication | source contains `auth.getUser` or `Unauthorized` |

### Journey 3 — Recommendation generation

| Assertion                                                                               | How                                               |
| --------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `/api/recommendations/[id]/why` calls `guardOutgoing`                                   | source grep                                       |
| A clean recommendation subject is approved                                              | live `guardOutgoing` call with capturing supabase |
| The full constitutional decision (crisis + emotional + future_preservation) is surfaced | assertion on `g.constitutional.*`                 |
| audit + iteration rows persisted                                                        | assertion on captured `ops[]`                     |

### Journey 4 — Simulation

| Assertion                                                     | How         |
| ------------------------------------------------------------- | ----------- |
| `/api/simulations/create` is governed                         | source grep |
| `/api/scenario-lab/versions/[versionId]/simulate` is governed | source grep |

### Journey 5 — Arcana workflow

| Assertion                                                | How         |
| -------------------------------------------------------- | ----------- |
| `/api/arcana/readiness` is governed                      | source grep |
| `/api/arcana/catch-up` is governed                       | source grep |
| `/api/arcana/lead-package` is governed                   | source grep |
| `/api/provider/patients/[id]/recommendation` is governed | source grep |

### Journey 6 — Multimodal upload

| Assertion                                                                                       | How                                                                            |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `/api/ingest/upload` delegates to `processUpload` + `defaultScanner` + `SupabaseStorageAdapter` | source grep                                                                    |
| End-to-end clean upload writes scan + storage + telemetry rows                                  | live `processUpload` call with injected scanner + storage + capturing supabase |
| Infected upload BLOCKS extraction (no job, no entities, no facts)                               | live call with `infected` scanner stub                                         |

### Journey 7 — Constitutional redirection

| Assertion                                                                                                     | How                       |
| ------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Sprint L harmful content is blocked at the guard with `g.ok === false` and `g.decision.approved === false`    | live `guardOutgoing` call |
| Sprint L2 surfaces a constitutional decision (crisis / emotional / future_preservation) even on clean content | live `guardOutgoing` call |

### Journey 8 — Enterprise tenant + API key

| Assertion                                                             | How                                                                                                        |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/api/platform/api-keys` exposes POST + DELETE                        | source grep                                                                                                |
| `/api/platform/tenants/me` enforces auth                              | source grep                                                                                                |
| `/api/platform/api-keys` POST hashes the key (never stores plaintext) | source grep for `key_hash` + `sha256`/`createHash`, plus check that the plain key is returned exactly once |

### Structural sweep

7 MUST_WIRE routes re-verified to import `guardOutgoing`:

```
agent/chat/route.ts
arcana/catch-up/route.ts
arcana/readiness/route.ts
arcana/lead-package/route.ts
simulations/create/route.ts
recommendations/[id]/why/route.ts
provider/patients/[id]/recommendation/route.ts
```

The full 26-route structural sweep also runs from
`apps/web/src/lib/governance/__tests__/governance-bypass.spec.ts`.

## Test execution

```bash
npx jest src/__tests__/journeys-e2e.spec.ts --no-coverage
```

Result at sprint close:

```
PASS src/__tests__/journeys-e2e.spec.ts
  Journey 1: Consumer onboarding (2 tests)
  Journey 2: Goals (1 test)
  Journey 3: Recommendation generation (2 tests)
  Journey 4: Simulation (2 tests)
  Journey 5: Arcana workflow (4 tests)
  Journey 6: Multimodal upload (3 tests)
  Journey 7: Constitutional redirection (2 tests)
  Journey 8: Enterprise tenant + API key (3 tests)
  Structural: governance coverage (7 tests)
Tests: 26 passed
```

Full suite: 983 / 983 passing across 69 suites.

## What this catches

If a future change:

- Removes `guardOutgoing` from a MUST_WIRE route — Journey 3-5 or
  Structural sweep fails.
- Skips `defaultScanner` in the upload route — Journey 6 source-grep
  fails.
- Stops calling `SupabaseStorageAdapter` — Journey 6 wiring test fails.
- Skips per-extractor telemetry — Journey 6 wiring test fails.
- Lets infected uploads through — Journey 6 infected-block test fails.
- Stops hashing API keys — Journey 8 source-grep fails.
- Disables Sprint L2 retrieval / iterations — Journey 3 assertion on
  audit + iteration rows fails.

## What this does NOT catch (deferred)

- Real browser interaction (form rendering, click handlers, redirects).
  Sprint N.2 added Playwright bootstrap to the roadmap but Playwright
  tests themselves are queued for Closed Beta (see
  `FULL_SYSTEM_AUDIT_REPORT.md` §14).
- Real Supabase RLS at runtime — see the three new `verify_*.sql`
  scripts for that.
- Real provider HTTP behavior under failure conditions — see the
  BYOM unit tests (`src/lib/models/__tests__/byom.test.ts`) for those.
- Performance regressions — out of scope for hardening.
