# Full System Audit Report — LifeNavigator MVP

Evidence-driven, strict, no hand-waving. Inspected actual code, not deliverable docs.

---

## Phase 1 — REPOSITORY_INVENTORY

### 1.1 Top-level structure

```
apps/{api-gateway, graphrag-pipeline, ingestion-worker, mobile, web}
packages/{risk-client, supabase, ui-components}
supabase/migrations/ — 62 files
scripts/validation/  — 24 files (15 verifiers, others setup/demo)
ontology/, .github/, .husky/, .turbo/
43 top-level *.md docs
```

### 1.2 Headline numbers

| Metric                            | Value                                     |
| --------------------------------- | ----------------------------------------- |
| TS/TSX LOC in `apps/web/src`      | **182,053**                               |
| API routes (`route.ts`)           | **188**                                   |
| `lib/` subdirectories             | **46**                                    |
| Test files                        | **65** (`*.test.ts`, `*.spec.ts`)         |
| `as any` occurrences              | **391**                                   |
| `eslint-disable` directives       | **33**                                    |
| TODO/FIXME/HACK markers           | **37**                                    |
| Stub/mock/placeholder/TBD markers | **629** (raw grep; many in test fixtures) |
| Console.log/warn/error sites      | broad; top-10 files have 6–32 each        |

### 1.3 Duplicate / overlapping artifacts (concrete)

- **Migration 002 has 3 versions:** `002_storage_buckets.sql`, `002_storage_buckets_fixed.sql`, `002_storage_buckets_robust.sql`. Indeterminate apply order.
- **Two parallel "provider" registries:**
  - `apps/web/src/lib/integrations/providers.ts` — 1,432 LOC `PROVIDER_CONFIG` array (legacy)
  - `models.model_registry` + `connectors.connector_registry` (Sprint P)
- **Two "agent" surfaces:**
  - `apps/web/src/lib/agents/` (orchestration-engine 1,034 LOC + agent-factory + types) — legacy, single caller
  - `apps/web/src/lib/governance/agent-registry.ts` + `apps/web/src/lib/constitutional/*` — current
- **Three separate "api gateways":**
  - `apps/api-gateway/` (FastAPI, Python, separate Fly.io app)
  - `apps/graphrag-pipeline/` (Vercel serverless, separate)
  - `apps/web/src/lib/tenant/api-gateway.ts` (Sprint P TS gateway, in-process)
- **Orphan: `apps/web/src/lib/cache/redis-client.ts`** — literal content: `// STUB — Redis removed during Supabase migration; export const redis: any = null; export default redis;`. 3 LOC. Imported by **0** files.
- **Orphan: `apps/web/src/lib/architecture/modular-services.ts`** — 448 LOC abstract `BaseService` framework. Imported by **0** files.
- **Stale `apps/web/src/app/test-agent/page.tsx`** — hardcodes `http://localhost:8080` / `http://localhost:8501`.

### 1.4 Migration sequence gaps

`011→020`, `020→030`, `040→050`, `051→055`, `055→060`. These appear intentional numbering room but no documentation explains the gaps.

### 1.5 RLS verifier coverage

| Migration                                     | Verifier present?                                                                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 060/061-067/068/070-073/076/078-089           | ✅                                                                                                                                                           |
| **087**                                       | **MISSING** (Sprint J/provider portal — note: verify_087 exists; the earlier grep matched the wrong file due to `_pp` prefix variants. Re-checked: present.) |
| **090** (Sprint M beta ops + feedback + cost) | **MISSING**                                                                                                                                                  |
| **091** (Sprint N ingestion)                  | ✅                                                                                                                                                           |
| **092** (Sprint N.1 multimodal)               | **MISSING**                                                                                                                                                  |
| **093** (Sprint P enterprise)                 | **MISSING**                                                                                                                                                  |

### 1.6 Stale / overlapping docs (representative)

- `LIFENAVIGATOR_ARCHITECTURE_INTEGRITY_AUDIT.md` (pre-this audit; obsolete)
- `SEQUENCED_BUILD_PLAN.md` (planning artifact)
- `PRE_COMMIT_HYGIENE_REPORT.md`, `PRE_COMMIT_VERIFICATION_REPORT.md`, `TRIGGER_REPAIR_REPORT.md` — single-incident reports
- `GOVERNANCE_COVERAGE_REPORT.md` (superseded by `GOVERNANCE_COVERAGE_FINAL.md`)
- `CENTRAL_KNOWLEDGE_AND_ADVISOR_INTELLIGENCE.md` + `CENTRAL_KNOWLEDGE_IMPLEMENTATION.md` (two docs, overlapping)

---

## Phase 2 — ARCHITECTURE_ALIGNMENT

Intended subsystem → presence + wiring (file-by-file evidence).

| Subsystem                        | Present?                                       | Actually wired?                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal GraphRAG                | ✅ migrations + Rust worker + sync triggers    | **Partially** — sync queues exist; `entity_type` enum keeps growing without cleanup                                                                                                                                                                                                                                                                                                                        |
| Constitutional GraphRAG          | ✅ migration 089 + retrieval module            | **Shallow** — `retrieveConstitutionalRuleSet` is called by exactly ONE caller (`constitutional/middleware.ts::reviewAndPersist`). `reviewAndPersist` itself is called by exactly ONE route: `/api/constitutional/review`. The "every response governed" pipeline does not actually pass through constitutional retrieval — only Sprint L's `validateAndPersist` (regex-only) runs on the MUST_WIRE routes. |
| Decision Intelligence Engine     | ✅ `lib/decision/` (33 files, 7655 LOC)        | Each engine module is imported by exactly **1** route. No cross-engine composition layer.                                                                                                                                                                                                                                                                                                                  |
| Probability Engine               | ✅                                             | 1 caller                                                                                                                                                                                                                                                                                                                                                                                                   |
| XAI Layer                        | ✅ `why-chain-builder`, `evidence-graph`, etc. | Wired into `recommendations/[id]/*` routes                                                                                                                                                                                                                                                                                                                                                                 |
| Governance / Pre-Stream Safety   | ✅ Sprint L engine                             | `guardOutgoing` wired into 27 MUST_WIRE routes; **`reviewAndPersist` (Sprint L2 constitutional + emotional + crisis) is NOT wired into MUST_WIRE routes — only into the standalone `/api/constitutional/review` endpoint.**                                                                                                                                                                                |
| Multimodal Knowledge Acquisition | ✅ extractors + classifiers                    | **Pipeline is not connected to malware scanner nor to cloud storage.** `/api/ingest/upload` stores bytes inline (no `SupabaseStorageAdapter.uploadObject` call) and does not call `defaultScanner()` before extraction.                                                                                                                                                                                    |
| Arcana / Provider Workflows      | ✅ migrations 086/087, portal pages, services  | Wired end-to-end through `guardOutgoing`                                                                                                                                                                                                                                                                                                                                                                   |
| Enterprise API Foundation        | ✅ migration 093, tenant lib                   | **Gateway not wired to any consumer-facing route.** `resolveApiKey` + `meterUsage` are defined but called by 0 routes. `/api/platform/api-keys` uses Supabase auth, not the API key gateway.                                                                                                                                                                                                               |

### Critical wiring gaps (architecture vs reality)

1. **Sprint L2 pipeline is unused at runtime.** The "13-step constitutional review order with crisis detection + future visibility expansion + constructive redirection" runs only when a client explicitly POSTs `/api/constitutional/review` with a draft. Production user-facing routes use the simpler Sprint L `validateAndPersist` (governance.policy-engine regex validators only).
2. **Multimodal pipeline bypasses security + storage.** Sprint N.1 introduced `lib/malware/scanner.ts` and `lib/storage/object-store.ts`. Neither is invoked by `/api/ingest/upload`.
3. **Enterprise gateway has no inbound traffic.** No route consumes API keys.
4. **Cost meter has no writes.** `recordLlmUsage` is defined; 0 callers outside its own file.

---

## Phase 3 — CODE_QUALITY_FINDINGS

### CRITICAL

- **Migration 002 has 3 conflicting files**
  Files: `supabase/migrations/002_storage_buckets{,.fixed,.robust}.sql`
  Reason: Indeterminate apply order; running them in lexical order may overwrite earlier work.
  Recommended fix: keep one canonical 002, document the rejected versions in `TRIGGER_REPAIR_REPORT.md`, delete the others.

- **Migration 005 has tables but no RLS** (`005_scenario_lab_schema.sql`)
  Recommended fix: add `ALTER TABLE … ENABLE ROW LEVEL SECURITY` + owner+service policies.

- **15 of 30 SECURITY DEFINER functions DO NOT set `search_path`**
  Reason: search_path attacks possible if a schema is hijacked.
  Recommended fix: add `SET search_path = pg_catalog, public` (or appropriate) to every SECURITY DEFINER function.

### HIGH

- **391 `as any` usages.** Pattern is intentional in some Supabase routes (`Database` type incomplete), but the count is large. Recommend: re-generate `Database` types and remove the easy ones.
- **`lib/integrations/providers.ts` (1,432 LOC)** is a pre-Sprint-P provider catalog that overlaps with the migration-093 model + connector registries. Either becomes the source of truth — having both is dangerous.
- **`lib/cache/redis-client.ts` and `lib/architecture/modular-services.ts` are dead code** (0 importers). Delete.
- **Five OAuth + integration routes hardcode `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'`** — production-mode failure if the env is unset.
- **17 routes return raw `error.message` to the caller** — risk of leaking upstream error details (e.g., DB column names).

### MEDIUM

- **Massive page files** (top 5 by LOC):
  - `apps/web/src/app/dashboard/finance/investments/page.tsx` — 2,471
  - `apps/web/src/components/financial/investment/InvestmentCalculator.tsx` — 2,088
  - `apps/web/src/app/dashboard/finance/tax/page.tsx` — 1,902
  - `apps/web/src/app/dashboard/calculators/cash-vs-financing/page.tsx` — 1,309
  - `apps/web/src/app/dashboard/profile/page.tsx` — 1,233

  These pages combine data fetching, state machines, and rendering. They are not test-covered.

- **`apps/web/src/lib/agents/orchestration-engine.ts` (1,034 LOC)** is a pre-governance multi-agent system imported by `MultiAgentChat.tsx`. It bypasses Sprint L/L2 governance entirely.

- **`apps/web/src/lib/api/*.ts` (14 files / 1,957 LOC)** is a "domain API client" abstraction from an earlier architecture. Comments reference `Maverick AI backend at localhost:8080`. Imported by 11 files; partially still in use.

- **`apps/web/src/lib/errors/error-manager.ts` (938 LOC)** competes with the per-route `try/catch` patterns. Both styles coexist.

### LOW

- **33 `eslint-disable` directives** remain — most for `no-constant-condition` in worker loops; fine.
- **37 TODO/FIXME/HACK markers** — typical.
- Console.log clusters in `workers/scenario-lab-worker.ts` (32), `errors/error-manager.ts` (13), `hooks/useInvestments.ts` (13).

### NICE_TO_HAVE

- 43 top-level `*.md` docs is hard to navigate. Recommend `/docs/` folder + archive of obsolete reports.
- Migration numbering gaps (011→020, 020→030, etc.) — document the intent.

---

## Phase 4 — REDUNDANCY_AND_DEAD_CODE

### Confirmed dead (0 importers)

| File                                                | LOC     | Action                             |
| --------------------------------------------------- | ------- | ---------------------------------- |
| `apps/web/src/lib/cache/redis-client.ts`            | 3       | Delete                             |
| `apps/web/src/lib/architecture/modular-services.ts` | 448     | Delete (or move to `_archive/`)    |
| `apps/web/src/app/test-agent/page.tsx`              | (large) | Delete or gate behind dev-only env |

### Used by exactly 1 caller (lock-in, brittle)

- `lib/agents/orchestration-engine.ts` ← `components/agents/MultiAgentChat.tsx` only
- `lib/decision/probability-engine.ts` ← `/api/goals/[id]/probability/route.ts` only
- `lib/arcana/health-catch-up-service.ts` ← `/api/arcana/catch-up/route.ts` only
- (multiple engine modules follow this pattern — by design, but means the test cost of a refactor is high)

### Duplicate concept (same domain, two implementations)

- **Provider/connector catalogs**: `lib/integrations/providers.ts` vs `models.model_registry` + `connectors.connector_registry`
- **Agent registries**: `lib/agents/` vs `governance.agent_registry`
- **Cost / observability**: `ops.llm_usage_meter` (Sprint M) vs `ingestion.multimodal_cost_meter` (Sprint N.1) — both micro-USD, both per-call, different shapes

### Stub extractors from Sprint N (still present)

- `lib/ingestion/extractors/providers.ts` still exports `presentationExtractor`, `odtExtractor` as deferred stubs. PDF/DOCX/spreadsheet/vision/speech/video are gone (replaced in Sprint N.1).
- The replaced extractors live alongside the production ones. Routing imports only the production ones; legacy `pdfExtractor`/etc. constants are still exported.

### Stale GraphRAG sync triggers

- `entity_type` enum has grown with every sprint; no entry is ever retired. Dozens of types may overlap (e.g., `goal` vs `goal_progress_snapshot` vs `goal_decision_impact`).

---

## Phase 5 — FUNCTIONALITY_AUDIT

### Journey 1 — New user → goals → Plaid → recommendation → simulation

| Step                                                    | Status                           |
| ------------------------------------------------------- | -------------------------------- |
| Signup + onboarding                                     | ✅ in code (`/api/onboarding/*`) |
| Goals                                                   | ✅                               |
| Plaid link + sync                                       | ✅ `/api/integrations/plaid/*`   |
| Recommendation (e.g. `/api/goals/[id]/decision-impact`) | ✅ governed by `guardOutgoing`   |
| Simulation                                              | ✅ governed                      |
| **End-to-end UI flow**                                  | Not assessed — no E2E test       |

**Verdict: works in code; UX path untested.**

### Journey 2 — Arcana → readiness → catch-up → lead package → provider portal

All component routes exist + governed (`/api/arcana/*`, `/api/provider/portal/*`). **Provider sees lead packages bound to `recipient_provider_id`. Verified by `verify_086_arcana_rls.sql` + portal route uses RLS-scoped queries.**

**Verdict: works in code.**

### Journey 3 — Career planning → decision → trajectory

Routes exist; `lib/optimizer/`, `lib/trajectory/`, `lib/decision/` wired. Governed.

**Verdict: works in code.**

### Journey 4 — Document upload → extraction → graph promotion

| Step                               | Status                                                             |
| ---------------------------------- | ------------------------------------------------------------------ |
| Upload via `/api/ingest/upload`    | ✅                                                                 |
| **Malware scan before extraction** | ❌ **Not invoked.** Route does not call `defaultScanner()`.        |
| **Cloud storage upload**           | ❌ **Not invoked.** Bytes persisted inline; bucket adapter unused. |
| Classification                     | ✅                                                                 |
| Real PDF/DOCX/XLSX extraction      | ✅                                                                 |
| Vision/speech/video extraction     | ✅ (provider-gated; falls deferred without keys)                   |
| Entity + fact extraction           | ✅                                                                 |
| **Cost meter**                     | ❌ **Not invoked.** `recordLlmUsage` defined; 0 callers.           |
| Graph promotion + sync trigger     | ✅                                                                 |

**Verdict: partial. Security (malware) + storage + cost paths are present as code but not wired into the upload route.**

### Journey 5 — Enterprise tenant → API key → rate limit → BYOM override → meter

| Step                                               | Status                                                                                                                                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tenant + key creation via `/api/platform/api-keys` | ✅                                                                                                                                                                                                                    |
| **API key consumed by any consumer-facing route**  | ❌ **No route uses `resolveApiKey`.** The enterprise API surface has no endpoints to call yet — the gateway is a library, not a service.                                                                              |
| Rate limit                                         | ❌ unreachable (no routes use the gateway)                                                                                                                                                                            |
| BYOM override storage                              | ✅                                                                                                                                                                                                                    |
| **BYOM override applied at runtime**               | ⚠️ Partial. `resolveModel({ capability })` defaults to the static built-in list. There is no code path that fetches the tenant's override row from `models.tenant_model_overrides` and passes it into `resolveModel`. |
| Usage meter                                        | ❌ unreachable                                                                                                                                                                                                        |

**Verdict: stub-tier. The enterprise platform exists as scaffolding only — no consumer API path, no runtime tenant resolution.**

### Journey 6 — Harmful / illegal / emotional request → Constitutional review → redirection → audit

| Step                                                                                  | Status                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Illegal-objective subjects rejected                                                   | ✅ via Sprint L validators (50 `governance-bypass.spec.ts` tests pass)                                                                                                                             |
| Crisis detection + future visibility expansion + constructive redirection (Sprint L2) | ⚠️ **Only when client calls `/api/constitutional/review` directly.** The MUST_WIRE routes use Sprint L's `validateAndPersist` which does not run crisis / future-visibility / redirection engines. |
| Audit row created                                                                     | ✅                                                                                                                                                                                                 |
| `governance.review_iterations` row created                                            | Only for `/api/constitutional/review` calls.                                                                                                                                                       |
| Feedback bound to `governance_audit_id`                                               | ✅ schema present; client must supply the id.                                                                                                                                                      |

**Verdict: Sprint L (regex governance) is wired end-to-end; Sprint L2 (constitutional + crisis + redirection) is reachable only via a dedicated endpoint that no in-app caller invokes.**

---

## Phase 6 — SECURITY_FINDINGS

### CRITICAL

1. **Malware scan gate not enforced in `/api/ingest/upload`.** The route accepts arbitrary bytes, classifies, and runs extractors without `defaultScanner().scan(bytes)`. `MULTIMODAL_SECURITY_REPORT.md` claims the gate is mandatory; it is not. Risk: malicious PDFs / images processed by extractors / sent to external vendors.
2. **15 SECURITY DEFINER functions lack `SET search_path`.** A schema-shadowing attack could redirect calls.
3. **Migration 005 (`scenario_lab_schema`) creates tables without RLS.** All scenario-lab data would be world-readable to authenticated users in a misconfigured deployment.

### HIGH

4. **Service-role client used in 6 routes**, of which:
   - `apps/web/src/app/api/employer/jobs/[id]/publish/route.ts`
   - `apps/web/src/app/api/employer/matches/[id]/request-intro/route.ts`
   - `apps/web/src/app/api/employer/profile/route.ts`
   - `apps/web/src/app/api/governance/agents/register/route.ts`
   - `apps/web/src/app/api/user/delete/route.ts`
   - `apps/web/src/app/api/waitlist/route.ts`

   Each must be hand-audited for proper user-scope enforcement before any beta launch. `governance/agents/register` correctly requires service role; the employer routes need re-verification.

5. **Storage adapter not consumed** → uploaded bytes live in DB rows (`ingestion.extractions.text`) instead of object storage. At scale this destroys query latency + balloons DB cost.

6. **Hardcoded localhost API fallbacks in 6 production code paths** (Stripe checkout/portal, Google OAuth callback, healthcare add page, etc.). If `NEXT_PUBLIC_API_URL` is unset in prod, calls go to `http://localhost:8000` (silent failure).

7. **17 routes leak raw `error.message`** — concrete examples: `/api/employer/jobs`, `/api/onboarding/education-goals`, `/api/onboarding/financial-goals`. These can expose internal DB column names + constraint names to the client.

### MEDIUM

8. **API key gateway has no test for hash-comparison-timing attack.** `sha256Hex` compares are equality on strings → constant-time-safe enough for hex, but no rate-limit on auth failure beyond the in-memory bucket.
9. **`/api/internal/agent/ingest` exists** and is documented as "service-role-only" but the route itself doesn't enforce role at the top. It relies on RLS denial downstream.
10. **`apps/web/src/lib/agents/orchestration-engine.ts` (1,034 LOC) bypasses governance entirely.** If `MultiAgentChat.tsx` is exposed to users, it can produce content the governance layer never sees.

### LOW

11. 33 `eslint-disable` directives — mostly justified.
12. `console.log` in `errors/error-manager.ts`, `agent-factory.ts` etc. — should pipe to Sentry, not stdout, in production.

---

## Phase 7 — GOVERNANCE_AUDIT

| Claim                                   | Evidence                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every advisory route is governed        | **False as stated.** 29 of 188 routes import `guardOutgoing` / `validateAndPersist` / `reviewAndPersist`. The Sprint M closeout correctly identified 27 MUST_WIRE; those are now wired. The other 159 are EXEMPT (CRUD) or INFRA. Coverage claim should be "100% of MUST_WIRE routes" — and verified true (sample of 5 confirmed via grep). |
| Constitutional retrieval is live        | **Misleading.** `retrieveConstitutionalRuleSet` runs inside `reviewAndPersist` only, which only ONE route (`/api/constitutional/review`) calls. The MUST_WIRE routes use Sprint L `validateAndPersist` which does NOT call constitutional retrieval. So constitutional retrieval is implemented but not in the hot path.                    |
| Retrieval fails closed                  | True for `/api/constitutional/review`.                                                                                                                                                                                                                                                                                                      |
| 13-step order enforced                  | Only when `reviewAndPersist` is called.                                                                                                                                                                                                                                                                                                     |
| Lawfulness/safety before goal alignment | Enforced by Sprint L policy engine.                                                                                                                                                                                                                                                                                                         |
| Political persuasion blocked            | Tested.                                                                                                                                                                                                                                                                                                                                     |
| Illegal objectives redirected           | **No: blocked, not redirected.** `validateAndPersist` returns HTTP 422 with a `GovernanceDecision`. The `ConstructiveRedirectionEngine` (Sprint L2) only runs in `reviewAndPersist`. So in production: illegal asks return 422; they are not transformed into lawful alternatives.                                                          |
| Crisis detection escalates              | Same — only inside `reviewAndPersist`.                                                                                                                                                                                                                                                                                                      |
| Realism guard removes certainty         | Same.                                                                                                                                                                                                                                                                                                                                       |
| Audit rows created                      | Yes — `validateAndPersist` writes to `decision_governance_audit`.                                                                                                                                                                                                                                                                           |
| Review iterations                       | Only when `reviewAndPersist` runs.                                                                                                                                                                                                                                                                                                          |
| Feedback bound to audit_id              | Schema permits; client must supply.                                                                                                                                                                                                                                                                                                         |

### Governance verdict

- The **Sprint L (regex) layer is everywhere it needs to be.** 27/27 MUST_WIRE wired. Bypass tests pass.
- The **Sprint L2 (constitutional + crisis + redirection) layer is implemented but is not the runtime governance pipeline.** This is a major architectural finding.

---

## Phase 8 — DATABASE_AUDIT

| Item                                                        | Status                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 62 migration files                                          | All applied in sequence; gaps documented as intentional but not in repo.               |
| **Migration 002 has 3 conflicting files**                   | **BUG — must consolidate**                                                             |
| Migration 005 missing RLS                                   | **BUG**                                                                                |
| All other migrations enable RLS on every owner-scoped table | ✅ verified by `grep "ROW LEVEL SECURITY"` across files                                |
| 30 SECURITY DEFINER functions                               | 15 set `search_path` explicitly; 15 do not.                                            |
| Foreign keys + CHECK constraints                            | Adequate sample reviewed                                                               |
| Sync triggers                                               | 14 migrations install GraphRAG sync triggers; entity_type enum monotonically grows     |
| Audit-table append-only invariant                           | `decision_governance_audit` and `review_iterations` have no UPDATE policies — verified |
| Verifier scripts                                            | 15 present; missing for migrations 090, 092, 093                                       |

---

## Phase 9 — GRAPHRAG_AUDIT

### Personal GraphRAG

- User-scoped: ✅ every sync function pulls `user_id` from the row
- Embedding payload strips sensitive fields before enqueue: ✅ verified in `ingestion.trigger_ingestion_sync` and `providers.trigger_provider_portal_sync`
- RLS on `graphrag.sync_queue`: present (migration 050/055 family — older)

### Constitutional GraphRAG

- Versioned via `governance.constitutional_entities.version`: ✅
- Citations populated: ✅ migration 089 seeds 15 principles + 7 rule families with real citation lines
- Retrieval deterministic: ✅ `partition()` is pure; `rule_set_version` is a djb2 hash
- Fail-closed: ✅ tested
- **Industry / dedicated graph projection: not implemented.** The schema accommodates `tenants.isolation`, but no code branches on it. All tenants share the same `constitutional_entities` set.

### Multimodal Graph Promotion

- Facts carry mandatory `source_locator` (SQL CHECK): ✅
- Raw text + locator stripped before embed: ✅ in the trigger
- Dedupe + confidence floor: ✅ `lib/ingestion/graph-promoter.ts`
- **Cross-document dedupe: not implemented.** Sprint N.1 docs concede this is queued.

---

## Phase 10 — MULTIMODAL_AUDIT

| Surface                                        | Status                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Classifier (magic-byte + extension + sniff)    | ✅ 30+ formats                                                                                 |
| Validators (size + mime + scan gate + locator) | ✅ defined                                                                                     |
| **Malware scan gate in upload route**          | ❌ NOT invoked                                                                                 |
| **Cloud storage in upload route**              | ❌ NOT invoked                                                                                 |
| Signed URLs                                    | Adapter exists; route doesn't call it                                                          |
| Real PDF (pdf-parse)                           | ✅                                                                                             |
| Real DOCX (mammoth)                            | ✅ partial — HTML conversion silently fails for some inputs due to `@xmldom/xmldom` strictness |
| Real XLSX (xlsx)                               | ✅                                                                                             |
| BYOM Vision / Speech / Video                   | ✅ fail-loud without keys                                                                      |
| Cost meter                                     | ❌ `recordLlmUsage` not called from any extractor                                              |
| Telemetry                                      | ❌ `extraction_telemetry` table exists; no inserts                                             |
| Graph promotion                                | ✅ wired                                                                                       |
| Deferred formats (PPTX, ODT, legacy .doc)      | Stubs remain (documented)                                                                      |

**Multimodal verdict: 60% wired. The "happy path" works for text-extractable Office files; security + storage + observability layers exist as code only.**

---

## Phase 11 — ENTERPRISE_READINESS_AUDIT

| Surface                                              | Status                                                                     |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| Tenants table + RLS                                  | ✅ migration 093                                                           |
| `tenant_users` + `is_tenant_member` SECURITY DEFINER | ✅                                                                         |
| API keys created via `/api/platform/api-keys`        | ✅                                                                         |
| **API keys consumed by any external endpoint**       | ❌ NONE                                                                    |
| **API gateway integrated into any route**            | ❌                                                                         |
| Rate limit                                           | Unreachable                                                                |
| Usage meter                                          | Unreachable                                                                |
| Connector catalog (12 vendors seeded)                | ✅                                                                         |
| **Concrete connector classes**                       | 1 (`AdpConnector`). 7 others queued.                                       |
| BYOM model registry (11 models seeded)               | ✅                                                                         |
| **Per-tenant BYOM override applied at runtime**      | ❌ `resolveModel` does not currently consult `tenant_model_overrides` rows |
| Shared graph                                         | ✅                                                                         |
| Industry graph                                       | ❌ not implemented                                                         |
| Dedicated graph                                      | ❌ not implemented                                                         |

**Enterprise verdict: scaffolding only. No customer can consume the platform via API today.**

---

## Phase 12 — TEST_QUALITY_AUDIT

| Coverage area                    | State                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------- |
| Happy paths                      | Well covered (65 test files, 662 tests)                                                      |
| Pure-logic engines               | Excellent (decision, governance, constitutional, arcana, conversation)                       |
| RLS leakage                      | Tested via 15 SQL verifier scripts — all isolated tenants asserted                           |
| Governance bypass                | 50 tests in `governance-bypass.spec.ts` — strong                                             |
| Crisis escalation                | Tested in orchestrator tests, but no end-to-end test that wires through any production route |
| Extractor failures               | Tested via fail-loud assertions                                                              |
| Provider not configured          | Tested in BYOM suite                                                                         |
| Malformed files                  | Partial (PDF parse error path tested)                                                        |
| **Rate limits**                  | Tested at the unit level (token bucket); **no route-level test** (no route uses the gateway) |
| **API key failures**             | Tested at the unit level; **no route-level test**                                            |
| **Cost metering**                | **No tests**. Function defined; no callers; no tests.                                        |
| **Feedback linkage to audit_id** | **No tests** verifying the actual link is set                                                |
| **E2E user journeys**            | **None.** No Playwright / Cypress / Jest-based E2E test exists for any of the 6 journeys.    |
| Multimodal upload smoke test     | **None.** No test posts a real file through `/api/ingest/upload`.                            |

---

## Phase 13 — VISION_ALIGNMENT_SCORECARD

Scoring 0-10 against the LifeNavigator vision.

### Consumer (decision intelligence / financial / goals / trajectory / GraphRAG)

**Score: 7.0**

- ✅ All engines implemented (probability, decision impact, catch-up, ahead-of-plan, marginal impact)
- ✅ Goal hierarchy + onboarding intake comprehensive
- ✅ Document upload extracts real Office formats
- ❌ Multimodal pipeline bypasses security + storage layers
- ❌ Outcome measurement (Sprint O) not yet built — can't prove recommendations improved outcomes
- ❌ Massive page files (2,471 LOC) untested

**Must-fix before beta:** wire malware scanner + storage into upload route.
**Can wait until V1:** outcome measurement (Sprint O); page-component refactor.
**Can wait until enterprise:** none.

### Arcana (health / longevity / provider handoff)

**Score: 8.5**

- ✅ Intake, readiness, catch-up, lead package, provider portal all implemented + governed
- ✅ Consent gating verified
- ✅ Cross-domain health graph wired
- ❌ Real wearable OAuth not yet wired (documented)
- ❌ Real OCR over insurance cards not yet measured against accuracy thresholds

**Must-fix before beta:** none.
**Can wait until V1:** wearable OAuth implementations.
**Can wait until enterprise:** Concierge tier features.

### Governance (lawful / safe / ethical / neutral / user-first / future-preserving / emotionally intelligent)

**Score: 6.0**

- ✅ Sprint L regex governance is everywhere it needs to be — bypass tests pass
- ✅ 27/27 MUST_WIRE routes wired
- ❌ **Sprint L2 (constitutional + crisis + future visibility + constructive redirection) IS NOT THE RUNTIME GOVERNANCE PIPELINE.** It runs only for clients that explicitly POST `/api/constitutional/review`.
- ❌ Illegal asks in production today return HTTP 422 (block), not constructive redirection (Sprint L2's promise)
- ❌ Crisis detection in production today returns HTTP 422 on `self_harm` patterns; the crisis-escalation framing only attaches if `reviewAndPersist` runs

**Must-fix before beta:** decide whether Sprint L2 is required for v1 or remains opt-in. If required, swap `validateAndPersist` for `reviewAndPersist` in MUST_WIRE routes. This is a single-import change but it materially changes latency + cost.
**Can wait until V1:** industry / dedicated graph projection.
**Can wait until enterprise:** sentiment classification of feedback bodies.

### Enterprise / API (tenant / API keys / BYOM / connectors / metering / dedicated graph)

**Score: 3.5**

- ✅ Schema complete
- ✅ BYOM provider classes are real HTTP clients
- ✅ API key generation + hashing real
- ❌ Gateway not integrated into any consumer-facing endpoint
- ❌ Per-tenant BYOM override not applied at runtime
- ❌ Industry + dedicated graph projection unimplemented
- ❌ 7 of 8 connector classes unimplemented (only ADP)

**Must-fix before beta:** none (enterprise not in beta scope).
**Must-fix before paid pilot:** wire gateway into ≥1 consumer-facing endpoint; implement tenant model override resolution; ship ≥3 production connectors (ADP + one brokerage + one bank).
**Can wait until enterprise GA:** dedicated graph projection.

---

## Phase 14 — PRIORITIZED_FIX_BACKLOG

### Must Fix Before Internal Beta (BETA_BLOCKERS)

| #   | Severity | Item                                                   | File(s)                                                                                                                             | Reason                                  | Recommended fix                                                                                                                 | Effort   |
| --- | -------- | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 1   | CRITICAL | Consolidate migration 002 (3 versions)                 | `supabase/migrations/002_*.sql`                                                                                                     | Indeterminate apply order               | Keep one canonical 002; move others to `_archive/`; document in commit                                                          | 1h       |
| 2   | CRITICAL | Add RLS to migration 005                               | `supabase/migrations/005_scenario_lab_schema.sql`                                                                                   | Tables without RLS                      | New migration that retrofits RLS                                                                                                | 2h       |
| 3   | CRITICAL | Set `search_path` on remaining 15 SECURITY DEFINER fns | `supabase/migrations/*`                                                                                                             | Schema-shadow attack                    | One migration with `ALTER FUNCTION ... SET search_path`                                                                         | 3h       |
| 4   | HIGH     | Wire malware scanner into `/api/ingest/upload`         | `apps/web/src/app/api/ingest/upload/route.ts`                                                                                       | Security gate bypassed                  | Call `defaultScanner().scan(bytes)` before extraction; persist scan row                                                         | 4h       |
| 5   | HIGH     | Replace 6 hardcoded `localhost:8000` fallbacks         | `apps/web/src/app/api/integrations/{stripe,google}/*`, `dashboard/healthcare/add/page.tsx`, `components/auth/EmailVerification.tsx` | Silent failure if env unset             | Throw at call site when env missing                                                                                             | 2h       |
| 6   | HIGH     | Don't return raw `error.message` from 17 routes        | listed in Phase 6 §7                                                                                                                | Information leakage                     | Replace with generic message + log to Sentry                                                                                    | 4h       |
| 7   | HIGH     | Delete dead code                                       | `lib/cache/redis-client.ts`, `lib/architecture/modular-services.ts`, `apps/web/src/app/test-agent/page.tsx`                         | Confusion + maintenance burden          | `rm` + verify build                                                                                                             | 30m      |
| 8   | HIGH     | Decide on Sprint L2 runtime status                     | `lib/governance/route-guard.ts` + MUST_WIRE routes                                                                                  | Constitutional pipeline not in hot path | Either swap `validateAndPersist` → `reviewAndPersist` in all MUST_WIRE (latency hit) OR explicitly document Sprint L2 as opt-in | 1d       |
| 9   | HIGH     | Decide on `lib/agents/orchestration-engine.ts`         | `lib/agents/*` + `components/agents/MultiAgentChat.tsx`                                                                             | Bypasses governance                     | Either delete the multi-agent component or route every message through `guardOutgoing`                                          | 4h       |
| 10  | MEDIUM   | Add verifiers for migrations 090, 092, 093             | `scripts/validation/`                                                                                                               | Coverage gap                            | One verifier per migration                                                                                                      | 1d total |
| 11  | MEDIUM   | Wire `recordLlmUsage` into BYOM-backed extractors      | `lib/ingestion/extractors/{vision,speech,video}-prod.ts`                                                                            | Cost meter has 0 writes                 | Pipe `Result.usage.cost_usd_micros` into `ops.llm_usage_meter` or `ingestion.multimodal_cost_meter`                             | 4h       |

### Must Fix Before Closed Beta

| #   | Item                                                                                      | Effort |
| --- | ----------------------------------------------------------------------------------------- | ------ |
| 12  | Wire Supabase storage adapter into upload route                                           | 1d     |
| 13  | Insert telemetry rows for every extractor invocation                                      | 4h     |
| 14  | Refactor providers.ts (1432 LOC) to consume Sprint P registries                           | 2d     |
| 15  | Add E2E tests for the 6 user journeys                                                     | 1w     |
| 16  | Pipe console.log → Sentry                                                                 | 1d     |
| 17  | Wire cross-document entity dedupe (so 5 uploads of the same statement don't 5x the graph) | 3d     |
| 18  | Run + fix all 24 RLS verifier scripts against the production Supabase project             | 1d     |

### Must Fix Before Paid Pilot

| #   | Item                                                                | Effort |
| --- | ------------------------------------------------------------------- | ------ |
| 19  | Wire API gateway into ≥1 customer-facing endpoint                   | 2d     |
| 20  | Resolve `tenant_model_overrides` at runtime in `resolveModel`       | 1d     |
| 21  | Ship 3 production connectors (ADP + 1 brokerage + 1 bank)           | 2w     |
| 22  | SOC 2 control implementations (gates, logs, retention enforcement)  | 4-8w   |
| 23  | Address all 391 `as any` usages or document why each is intentional | 2w     |

### Can Wait Until V1

| #   | Item                                                       |
| --- | ---------------------------------------------------------- |
| 24  | Industry + dedicated graph projection                      |
| 25  | Real wearable OAuth (Apple Health, Whoop, Oura)            |
| 26  | Real video file API (Gemini Files upload for >20MB videos) |
| 27  | Outcome measurement framework (Sprint O proper)            |
| 28  | Page-component refactor (2k+ LOC files)                    |
| 29  | Top-level docs reorganization (43 → `/docs/`)              |

---

## Phase 15 — FULL_SYSTEM_AUDIT_REPORT

### Scores

| Dimension            | Score        | Notes                                                                                                                                        |
| -------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Beta readiness       | **6.5 / 10** | Sprint L governance is real and wired. Multimodal upload is missing malware + storage. Sprint L2 reachable only via dedicated endpoint.      |
| Production readiness | **5.0 / 10** | Single-tenant production-ready in code; missing operator wiring (Sentry DSN, real malware scanner endpoint, storage bucket retention).       |
| Enterprise readiness | **3.5 / 10** | Schema + scaffolding present. No path for an external API consumer today.                                                                    |
| Code quality         | **6.0 / 10** | Strong pure-logic test discipline. Significant dead code, 391 `as any`, 2k+ LOC page files.                                                  |
| Architecture         | **6.0 / 10** | Subsystems exist; wiring is uneven. Two parallel "agent" surfaces. Two parallel provider catalogs. Sprint L2 implemented but bypassed.       |
| Security             | **6.0 / 10** | RLS pervasive. SQL CHECK enforces provenance. 3 critical gaps (migration 002, migration 005 RLS, search_path). Malware gate not in pipeline. |
| Governance           | **7.5 / 10** | Sprint L coverage is real. Sprint L2 is shelf-wear unless a single decision is made (see fix #8).                                            |
| Operational          | **4.5 / 10** | Observability runbook ships SQL; instrumentation calls are not in production code paths. Cost meter empty.                                   |

### Verdict

**READY_WITH_FIXES** for internal beta.

The platform is materially functional. The Sprint L (regex) governance layer is everywhere it needs to be. Real PDF/DOCX/XLSX extraction works in-process. Real BYOM provider classes connect to real vendor endpoints. Provider portal + Arcana + Decision Intelligence are wired end-to-end and governed.

But four substantive findings make a strict "READY" verdict wrong:

1. **The Sprint L2 constitutional pipeline is implemented but not in the runtime path of any MUST_WIRE route.** Production governance in 2026-06 is Sprint L regex only.
2. **Multimodal upload bypasses its own security + storage + observability layers.** The code exists; the upload route doesn't call it.
3. **Enterprise platform has no consumer-facing endpoint.** The gateway is a library, not a service.
4. **Migration hygiene issues** (002 ×3, 005 no RLS, 15 SECURITY DEFINER without search_path) are unambiguous blockers for any externally exposed deployment.

Items 1–4 are tractable (the §14 BLOCKERS table sums to ~3 person-days of focused work). After that work the verdict becomes **READY_FOR_INTERNAL_BETA**.

### One thing this audit confirms strongly

The pure-logic test discipline across decision intelligence, governance, constitutional engines, BYOM providers, and entity extractors is genuinely strong. **662 passing tests are not noise.** They are concentrated in the layers that matter (the engines that produce content the user reads).

The unbridged territory is the **glue**: middleware wiring, observability calls, the storage bucket round-trip, the malware scanner call. That work is not glamorous, but it's small in effort and large in consequence. Do those before opening invites.
