# Final Internal Beta Launch Readiness Report

**Date:** 2026-06-01
**Branch:** `mvp` (clean against origin)
**Scope:** Can we let real internal-beta users onto this system today?
**Method:** Direct verification — ran the production build, ran the test suite, traced the runtime pipeline composition, audited deployment configs. No claim is reported unless it was observed at this commit.

---

## Final Verdict

```
NOT_READY
```

This verdict is forced by **three independent launch blockers**, any one of which alone would justify it:

1. **The production build fails.** `pnpm build` (Turbopack) hits a syntax error in `apps/web/src/app/api/arcana/lead-package/route.ts:26` — a misplaced `import` statement inside another `import type {…}` block. The frontend cannot ship to Vercel until this is fixed.
2. **`?stream=true` on the advisor chat bypasses the entire safety stack.** The non-streaming branch goes through `guardOutgoing()` (injection + constitutional + character). The streaming branch pipes the Supabase Edge Function SSE directly to the client with **no governance, no character review, no injection scan, no audit row**. Internal beta users will discover this URL parameter, intentionally or otherwise.
3. **Economic governance is not wired into the decision pipeline.** The Sprint O.0.2 budget / quota / rate-limit / circuit-breaker library exists in `apps/web/src/lib/economic/` but **no decision-generating route imports or invokes it**. The only consumer is Scenario Lab's local rate limiter. The platform has no enforcement against runaway model spend on the user-facing path.

Section-level findings follow. Where I observed something, I cite the file. Where I could not verify, I say so.

---

## Section 1 — Infrastructure Readiness

| System                           | Status                                 | Evidence                                                                                                                                                                                     |
| -------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vercel project config            | **PARTIAL**                            | `apps/web/vercel.json` is well-formed (sfo1, security headers, health rewrite). No Vercel project linkage verified in this repo. **Build itself FAILS** — see blocker #1.                    |
| Vercel env vars                  | **MISSING**                            | `apps/web/.env.example` has Supabase, OAuth, Plaid, Stripe. **No AI provider keys** (`GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`). All OAuth redirects hardcoded to `localhost`. |
| Fly.io — `apps/api-gateway`      | **CONFIGURED**                         | Real FastAPI app. Dockerfile + fly.toml present. iad region. Health at `/healthz`. Listed secrets in fly.toml comments.                                                                      |
| Fly.io — `apps/ingestion-worker` | **CONFIGURED**                         | Real Rust binary. Two-stage Dockerfile. Long-running worker with SIGTERM handling.                                                                                                           |
| Supabase DB                      | **PARTIAL**                            | `supabase/config.toml` present, 104 migrations present. **Not verified against a real cloud project** in this audit.                                                                         |
| Supabase Storage                 | **PARTIAL**                            | Buckets created via migration 002. RLS for storage objects defined per-bucket.                                                                                                               |
| Supabase Auth                    | **PARTIAL**                            | Config enables Google + Azure OAuth, JWT expiry set. No verification that the production keys are provisioned.                                                                               |
| Supabase RLS                     | **ENABLED**                            | Sampled tables across migrations 089/093/100/102/103/104 all have RLS + policies. Cross-tenant `platform.is_tenant_member` SECURITY DEFINER is in use.                                       |
| Supabase backups                 | **UNVERIFIED**                         | Policy documented in `DISASTER_RECOVERY.md`. Not verifiable from repo whether PITR is enabled on the actual project.                                                                         |
| Neo4j                            | **CONFIGURED IN CODE / UNPROVISIONED** | Driver wired in `apps/api-gateway` with mandatory `$tenant_id` parameter. No production instance reachability verified. No `CREATE CONSTRAINT`/`CREATE INDEX` bootstrap script located.      |
| Qdrant                           | **CONFIGURED IN CODE / UNPROVISIONED** | Client present; collection names parameterized. No reachability verified. No snapshot strategy documented.                                                                                   |
| Gemini                           | **CONFIG SLOT EXISTS**                 | `GEMINI_GENERATION_MODEL` referenced in fly.toml. Quotas not verifiable from repo.                                                                                                           |
| Plaid                            | **PARTIAL**                            | `.env.example` has `PLAID_ENV=sandbox`. Sandbox path documented. Production toggle not gated.                                                                                                |
| Secrets inventory                | **MISSING**                            | No central secret inventory file. Migration 103 created `enterprise.secret_rotation_schedule` table — table is empty.                                                                        |
| Secret rotation                  | **DOCUMENTED, NOT EXECUTED**           | Policies in `ACCESS_CONTROL.md` and `CHANGE_MANAGEMENT.md`. Schedule rows not populated.                                                                                                     |

**Section verdict:** Cloud-deployable infrastructure exists in code; cloud projects + credentials are not provisioned or are unverified from the repo. **NOT READY** for Vercel deploy because the build fails regardless.

---

## Section 2 — Migration Verification

- **104 numbered migrations** in `supabase/migrations/`, IDs `001 → 104` plus `_archived/`.
- Two earlier variants of `002` are correctly moved into `_archived/`; only one active.
- No obvious gaps (gaps between `011 → 020`, `040 → 050`, etc. are intentional namespace gaps, not missing files).
- Spot-checked migration ordering on dependencies (e.g. `093_enterprise_foundation.sql` precedes `103_enterprise_readiness.sql` precedes `104_enterprise_projections.sql` — correct).
- `003_cleanup_and_reset.sql` performs `DROP IF EXISTS` deletions — destructive but idempotent and applies before content migrations.
- Migrations were **not actually applied against a fresh Postgres in this audit.** A clean-DB replay was not part of this verification.

```
Migration Integrity Score: 82 / 100
```

Deduction reasons:

- Clean-DB replay not executed against a real Postgres in this audit (-10).
- `enterprise.secret_rotation_schedule` is seeded as schema only (rows missing) (-5).
- No automated migration-deploy verification in CI (the CI workflow validates syntax but does not apply migrations) (-3).

---

## Section 3 — Security Verification

| Check                               | Status                             | Evidence                                                                                                  |
| ----------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Cross-user RLS isolation            | **ENFORCED**                       | Owner-read on user-scoped tables; `auth.uid()` policies present on each migration.                        |
| Cross-tenant RLS isolation          | **ENFORCED**                       | `platform.is_tenant_member` SECURITY DEFINER used uniformly across Sprint P/O/R/S tables.                 |
| No committed secrets                | **PASSED**                         | `.env.example` files only carry placeholders. No real keys observed. CI has trufflesecurity scan.         |
| No hardcoded credentials            | **PASSED**                         | None observed in repo grep.                                                                               |
| ClamAV path                         | **CODE PRESENT**                   | `lib/ingestion/security/...` exists. Actual ClamAV service not verifiable.                                |
| VirusTotal path                     | **CODE PRESENT**                   | Threat-intel path under `lib/security/`. API key required at runtime.                                     |
| Malware fail-closed                 | **DESIGNED CORRECTLY**             | Upload code rejects on scan-failure per Sprint N.2. Not load-tested.                                      |
| Prompt injection detection          | **ACTIVE on `guardOutgoing` path** | `lib/security/injection` invoked inside `guardOutgoing()`. **Bypassed on chat streaming.**                |
| Prompt injection review/audit       | **ACTIVE on non-streaming**        | `persistInjectionFindings()` writes the audit row. Streaming SSE path skips this.                         |
| **Economic governance enforcement** | **NOT WIRED**                      | Library exists in `lib/economic/`; **zero decision routes invoke it**. Only Scenario Lab uses it locally. |
| Budgets enforced                    | **NO**                             | See above.                                                                                                |
| Rate limits enforced                | **PARTIAL**                        | Scenario Lab only.                                                                                        |
| Circuit breakers active             | **NO**                             | Library exists; no caller.                                                                                |

**Section verdict:** RLS is solid. Static-secret hygiene is clean. **Runtime safety stack has two structural holes** (streaming bypass + economic non-wiring) that are launch blockers.

---

## Section 4 — Constitutional Governance Verification

**Claimed pipeline:**

```
User Request → Injection → Constitutional → Character → Economic → Response
```

**Verified pipeline (via `guardOutgoing()` + `reviewAndPersist()`):**

```
1. Constitutional review (13-step Sprint L2 hard-constraint order)
2. Character review (Sprint N.3, called inside the constitutional engine)
3. Injection scan (Sprint N.2, output-side)
4. Persist content verdict + injection findings
```

**Actual runtime mismatches with the claim:**

- **Economic step is absent.** No call site.
- **Order is constitutional-then-injection**, not injection-then-constitutional. Output-side injection scan is correct for our threat model (LLM-emitted artifacts), but does not match the section diagram.
- **Per-route hand-roll.** Each route must remember to call `guardOutgoing()`. There is no Next.js middleware enforcing this. A new route author can forget without CI catching it.

**Confirmed routes using the full (non-economic) stack** (sample):

- `/api/agent/chat` — non-streaming branch only
- `/api/recommendations/[id]/{evidence,why,counterfactuals,audit-trail,assumptions,view}`
- `/api/goals/[id]/ahead-of-plan`, `/api/goals/[id]/catch-up`
- `/api/explainers/probability`, `/api/explainers/tradeoff`
- `/api/risk-assessment`
- `/api/provider/patients/[id]/recommendation`
- `/api/governance/validate`

**Confirmed bypass routes** (LLM output without the full stack):

- `/api/agent/chat?stream=true` — **critical bypass**, no governance
- `/api/provider/portal/recommendations` — older Sprint L `validateAndPersist`, no L2 constitutional
- `/api/scenario-lab/reports/generate`, `/api/scenario-lab/versions/[versionId]/{plan,simulate}` — no governance

| Sub-claim                       | Status                                       |
| ------------------------------- | -------------------------------------------- |
| Family Table Test active        | **YES**, inside character engine             |
| Trusted Advisor Test active     | **YES**, inside character engine             |
| Future Preservation active      | **YES**, step 10 of L2 constitutional engine |
| Constructive Redirection active | **YES**, in style-guard / redirect logic     |

**Section verdict:** Governance + character are real and load-bearing on the non-streaming path. **The streaming bypass invalidates the safety claim for the headline chat surface.**

---

## Section 5 — Character Certification Verification

| Metric         | Target | Observed at this commit                                                     |
| -------------- | ------ | --------------------------------------------------------------------------- |
| Accuracy       | ≥ 0.90 | **PASS** — Sprint Q certification suite is part of the 1,365-test green run |
| False negative | ≤ 0.10 | **PASS**                                                                    |
| False positive | ≤ 0.20 | **PASS**                                                                    |

```
$ npx jest --silent
Test Suites: 95 passed, 95 total
Tests:       1365 passed, 1365 total
```

No regressions versus Sprint Q certification. The certification covers the **engine**; it does not certify a route that bypasses the engine (see Section 4 streaming bypass).

---

## Section 6 — Outcome Intelligence Verification

| Capability                     | Status                                                                                                                                                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recommendation lifecycle       | **WIRED** — `decision_outcomes` state machine, Sprint O tests pass                                                                                                                                                                                                                  |
| Attribution engine             | **WIRED** — `outcome.attribution_links`, MAX_LAG_DAYS test passes                                                                                                                                                                                                                   |
| Decision Quality Index         | **WIRED** — `outcome.decision_quality_index` table + builder                                                                                                                                                                                                                        |
| Life Progress                  | **WIRED** — `outcome.life_progress_snapshots`                                                                                                                                                                                                                                       |
| Enterprise reporting           | **WIRED** — `outcome.tenant_reports` + `computeTenantReport`                                                                                                                                                                                                                        |
| Safety gate cannot be bypassed | **WIRED in lib** — `checkSafety()` filters acceptance + completion. Tenant report assertion passes. **Caveat: depends on `governance_audit_id` being populated upstream**, which depends on the decision having gone through `guardOutgoing()` — which the streaming chat does not. |

**Section verdict:** Outcome layer is correct internally. Its safety guarantee inherits from the upstream pipeline, which has the streaming hole.

---

## Section 7 — Economic Governance Verification

| Claim                                  | Reality                                                                          |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| User daily / weekly / monthly budgets  | **Library exists, not invoked** by any decision route                            |
| Platform $500/month ceiling            | **Constant defined**, not enforced at any callsite outside Scenario Lab          |
| Circuit breakers at 75 / 90 / 95 / 100 | **State machine exists**, not driven by real cost events                         |
| Cost routing                           | **Not verified** — no central LLM call site routes through a cost-aware selector |

```
Projected Monthly Cost  : N/A — no metering at the user-facing path
Expected Monthly Cost   : N/A — same
Worst Case Monthly Cost : UNBOUNDED — no enforced ceiling on /api/agent/chat
```

**Section verdict:** This is a real launch blocker on its own. An internal beta with no enforced spend ceiling on Gemini calls can produce a five-figure bill in days under adversarial use.

---

## Section 8 — Enterprise Readiness Verification

| Item                      | Status                                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vendor registry           | **PRESENT** — `enterprise.vendors` seeded with 7 named vendors                                                                                                       |
| Secret rotation schedule  | **TABLE EXISTS, EMPTY**                                                                                                                                              |
| Access review schedule    | **CODE PRESENT** — `nextFourQuarters`, `coverageReport`                                                                                                              |
| Incident tracking         | **TABLE PRESENT** — `enterprise.incidents`                                                                                                                           |
| Vulnerability tracking    | **TABLE PRESENT** — `enterprise.vulnerabilities`                                                                                                                     |
| Readiness dashboard       | **LIB PRESENT** — `lib/enterprise/*` rollups; UI not verified live                                                                                                   |
| SOC 2 readiness artifacts | **PRESENT** as docs — `SOC2_READINESS_REPORT.md`, `SECURITY_PROGRAM_MANUAL.md`, `VENDOR_MANAGEMENT_PROGRAM.md`, `SOC2_EVIDENCE_COLLECTION.md`, and the 5 policy docs |

**Section verdict:** Documented and data-modeled. Live signals are not actually flowing yet (no rotation rows, no incidents, no access-review history). Sufficient for an _internal_ beta if it shipped; not sufficient for a Type II audit.

---

## Section 9 — Multimodal Verification

Code paths exist for:

| Modality     | Code path                               | Live test in this audit                                   |
| ------------ | --------------------------------------- | --------------------------------------------------------- |
| PDF          | `lib/ingestion/extractors/pdf`          | Unit tests pass; not exercised against real cloud storage |
| DOCX         | extractor present                       | unit only                                                 |
| XLSX         | extractor present                       | unit only                                                 |
| Images       | OCR + provenance                        | unit only                                                 |
| Audio        | transcript + provenance                 | unit only                                                 |
| Video        | frame-extract + transcript              | unit only                                                 |
| Provenance   | `lib/ingestion/provenance`              | wired into all extractors                                 |
| Attribution  | wired into entity-extraction primitives | unit only                                                 |
| Malware scan | `lib/ingestion/security`                | fail-closed in code; not load-tested                      |

**Section verdict:** Code is structurally complete. End-to-end ingestion against a real Supabase Storage bucket + worker queue was **not** exercised in this audit.

---

## Section 10 — Beta Operations Verification

| Item                | Status                                                                     |
| ------------------- | -------------------------------------------------------------------------- |
| Invite flow         | Routes exist (`/api/beta/invite`); not exercised in this audit             |
| Feature flags       | Migration 090 `beta_ops_feedback_meter.sql` defines tables; resolver wired |
| Cohorts             | Defined in migration 098 instrumentation                                   |
| Feedback collection | Tables exist                                                               |
| NPS collection      | Tables exist                                                               |
| Bug reporting       | No dedicated UI verified; falls back to feedback table                     |

**Section verdict:** Tables exist; the UI surface for these was not exercised live in this audit.

---

## Section 11 — Observability Verification

| Dashboard  | Code/data path                              | Live status                               |
| ---------- | ------------------------------------------- | ----------------------------------------- |
| Governance | `decision_governance_audit` table + queries | Data path ready; no Grafana board in repo |
| Character  | character audit columns on governance audit | Same                                      |
| Outcome    | `outcome.*` tables + tenant_reports         | Same                                      |
| Cost       | `economic.cost_events` table                | Empty — no live writes                    |
| Security   | `security.*` injection audit tables         | Data path ready                           |
| Operations | enterprise readiness rollups                | Data path ready                           |

| Alert               | Status                                  |
| ------------------- | --------------------------------------- |
| Budget alerts       | **NOT FIRING** — no cost events         |
| Incident alerts     | Manual today — no Slack webhook in repo |
| Error alerts        | Manual today                            |
| Extraction failures | Worker logs only                        |
| Governance failures | Audit row only — no alert               |

**Section verdict:** The data warehouse for observability exists in Postgres. The _signal-to-human_ loop (dashboards, on-call paging) is not wired.

---

## Section 12 — Production Data Protection

| Item                           | Status                                                                |
| ------------------------------ | --------------------------------------------------------------------- |
| Backup strategy                | Documented in `DISASTER_RECOVERY.md` (Supabase PITR, RPO 1h / RTO 4h) |
| Recovery strategy              | Same doc                                                              |
| DR procedure                   | Same doc                                                              |
| BC procedure                   | `BUSINESS_CONTINUITY.md`                                              |
| RPO / RTO targets documented   | **YES** (1h / 4h)                                                     |
| RPO / RTO targets **verified** | **NO** — never test-restored                                          |

---

## Section 13 — User Journey Verification

End-to-end journeys were **not** executed against a running stack in this audit. The build does not produce a deployable bundle. Tests cover unit + integration of individual libraries; they do not validate a real onboarding-to-recommendation flow against Supabase Auth + Edge Functions + Worker + Neo4j + Qdrant.

| Journey                   | Code path exists | Verified end-to-end in this audit |
| ------------------------- | ---------------- | --------------------------------- |
| User onboarding           | Yes              | No                                |
| Goal creation             | Yes              | No                                |
| Document upload           | Yes              | No                                |
| Recommendation generation | Yes              | No                                |
| Recommendation acceptance | Yes              | No                                |
| Outcome tracking          | Yes              | No                                |
| Provider referral         | Yes              | No                                |
| Enterprise reporting      | Yes              | No                                |

This is the most important "we don't actually know" line in the report. **Tests passing is not the same as the product working.**

---

## Section 14 — Technical Debt Verification

Repository-wide markers, scoped to `apps/` + `services/`, excluding `node_modules`, `.next/`, and `__tests__/`:

| Marker                                           | Count   |
| ------------------------------------------------ | ------- |
| TODO / FIXME / HACK / XXX (combined)             | **367** |
| stub / mock / placeholder / temporary (combined) | **618** |

A large fraction of the 618 are legitimate (`XXX-XX-####` SSN masking, `temporary` as an employment type enum). Real action items in `apps/web/src/lib/`: **only 4 TODOs**, all minor (e.g., `jwt.ts` re-export migration).

Classification:

| Bucket              | Count | Notes                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Launch blocking** | **3** | Build syntax error in lead-package route, streaming chat bypass, economic governance not wired                                                                                                                                                                                                                                          |
| **Post-beta**       | ~12   | Lint cleanup (142 errors), test live ingestion path, restore-from-backup drill, populate secret rotation table, populate access-review history, Slack alert webhook, deployment runbook, OAuth production URIs, Neo4j/Qdrant production provisioning, cost-event live writer, observability dashboards, vendor sub-processor automation |
| **Future roadmap**  | ~6    | SOC 2 Type II observation window, per-vendor incremental sync cursors, aggregator routing for retail Fidelity/Vanguard, materialized tenant_report roll-ups, formal monitoring SLO commitments, ATO equivalence study                                                                                                                   |

---

## Section 15 — Brutal Honesty Review

### What could break tomorrow?

The build. It is broken right now. Anyone deploying from `mvp` today fails at Vercel build, before a user can touch it.

### What would embarrass us in front of users?

A beta user appending `?stream=true` to `/api/agent/chat` and getting unfiltered model output — no constitutional review, no character review, no injection scan, no audit row. This will be discovered. Internal users will share the link.

### What would embarrass us in front of an enterprise customer?

Asking a Sprint S projection-aware question and receiving a perfectly aligned answer — then realizing we have no metering or per-tenant cost cap on that answer. The enterprise will ask "what did this cost us this month?" and we will not be able to answer because the cost event writer is not wired.

Also: a customer asking "show me your access-review history" and being shown an empty table backed by a documented quarterly process that has never run.

### What would prevent scale?

The hand-rolled `guardOutgoing()` pattern. Adding a 50th LLM-touching route means 50 places to remember to call it. Without a middleware wrapper or a typed handler factory, the streaming bypass is the first of many.

### What would prevent SOC 2 Type II?

The Type II observation window has not started. We have:

- The policies (5 of them).
- The data models (vendors, incidents, vulnerabilities, access reviews, rotations).
- Zero operational evidence of executing them. The audit asks for _months_ of operating evidence, not the existence of the table.

### 10 highest-risk unresolved issues

| Rank | Risk                                                                       | Severity     |
| ---- | -------------------------------------------------------------------------- | ------------ |
| 1    | Production build fails (syntax error in `arcana/lead-package/route.ts`)    | **Critical** |
| 2    | `/api/agent/chat?stream=true` bypasses governance/character/injection      | **Critical** |
| 3    | Economic governance not wired into decision pipeline — unbounded LLM spend | **Critical** |
| 4    | Per-route safety composition with no middleware enforcement                | **High**     |
| 5    | Provider portal recommendations route uses pre-L2 governance               | **High**     |
| 6    | Scenario Lab content-generating routes have no governance                  | **High**     |
| 7    | OAuth redirect URIs hardcoded to localhost                                 | **High**     |
| 8    | No production Neo4j / Qdrant credentials, no init scripts                  | **High**     |
| 9    | Lint failing with 142 errors; CI lint gate would block any merge           | **High**     |
| 10   | RPO/RTO documented but never test-restored; no on-call paging wired        | **Medium**   |

---

## Section 16 — Launch Recommendation

### Readiness scores (0–100)

| Domain               | Score  | One-line basis                                                                   |
| -------------------- | ------ | -------------------------------------------------------------------------------- |
| Architecture         | 86     | 4-tier projections, RLS uniform, character + governance composed in lib          |
| Security             | 58     | Static hygiene clean; streaming bypass + economic non-enforcement are real holes |
| Governance           | 70     | Real and load-bearing — when invoked. Per-route invocation is the weakness.      |
| Character            | 92     | Sprint Q certification still green at this commit                                |
| Outcome Intelligence | 82     | Aggregation correct; depends on upstream pipeline being called                   |
| Operations           | 45     | Tables exist, signals not flowing, no alert wiring, no dashboards                |
| Observability        | 40     | Warehouse ready, no dashboards / alerts shipped                                  |
| Enterprise Readiness | 60     | Documented + modeled, not operationally exercised                                |
| Multimodal           | 70     | Code structurally complete, not end-to-end verified live                         |
| Economic Governance  | 25     | Library exists, **not enforced on the decision path**                            |
| **Overall**          | **57** |                                                                                  |

### Recommendation

The platform is closer to ready than the score suggests, because most of the gaps are _wiring_, not _invention_. The constitutional / character / outcome / projection layers are real and tested. But three specific defects make today a **NO**.

#### Minimum fix-list before re-audit

1. Repair the `arcana/lead-package/route.ts` import block; verify `pnpm build` produces a bundle.
2. Either route the streaming chat through `guardOutgoing()` (post-hoc verdict on accumulated SSE chunks), or **disable `?stream=true` for internal beta**. The second option ships today; the first is right longer-term.
3. Add an economic gate to the chat / recommendation routes. Bare minimum for beta: a per-user daily request cap enforced at the route, and a global $/day kill switch reading from `economic.cost_events`. Sophisticated routing can come later.
4. Resolve the 142 lint errors or set the CI gate explicitly to warn-only with a tracked debt ticket. Today, every PR fails lint.
5. Fix OAuth redirect URIs to environment-driven and provision the production OAuth apps.
6. Provision Neo4j (Aura) + Qdrant (Cloud), capture credentials, run the constraint/index bootstrap. Capture in a one-page DEPLOY runbook.
7. Run one real restore from a Supabase PITR snapshot into a scratch project. Document the time. Update `DISASTER_RECOVERY.md` with the observed RTO.

When 1–3 land, the verdict becomes `READY_WITH_FIXES` (i.e., ship to internal beta under tight cohorting). When 4–7 also land, the verdict becomes `READY_FOR_INTERNAL_BETA`. Items 4–7 are not safety-blocking; they are dignity-blocking.

---

## Final Verdict

```
NOT_READY
```

The platform should not accept its first internal beta user today. A rational founder, shown the build error + the streaming bypass + the absent economic ceiling, would say "no — let's spend the next session closing exactly those three."
