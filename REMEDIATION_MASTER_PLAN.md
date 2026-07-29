# LifeNavigator — Remediation Master Plan (Revision 2)

**Owner:** Lead Principal Engineer
**Revision:** 2 · **Date:** 2026-07-29 · _(Rev 1: 2026-07-28)_
**Supersedes:** Revision 1 in full.
**Inputs:** `TECHNICAL_DUE_DILIGENCE.md`, `SECURITY_AUDIT.md`, `ARCHITECTURE_REVIEW.md`,
`AI_SYSTEMS_REVIEW.md`, `API_RUNTIME_AND_OWNERSHIP_MAP.md`, `CREDENTIAL_INCIDENT_REPORT.md`
**Mandate:** incremental hardening of a working system. **Not a rewrite.**

---

## Conclusion Tagging

Every material conclusion in this document carries one tag:

| Tag              | Meaning                                                                               |
| ---------------- | ------------------------------------------------------------------------------------- |
| **[CONFIRMED]**  | Held true in Rev 1 and re-verified in Rev 2                                           |
| **[CORRECTED]**  | Rev 1 stated this incorrectly; the corrected statement follows                        |
| **[NEW]**        | Discovered after Rev 1, during the runtime/ownership audit or the credential incident |
| **[UNVERIFIED]** | Asserted but not yet proven; may not be acted upon                                    |

---

## What Changed in Revision 2

1. **A credential incident occurred, was contained, and is recorded as Phase -1.** **[NEW]**
2. **`apps/api-gateway` was materially misclassified in Rev 1.** It is not scaffolding — it is a live,
   internet-reachable, JWT-enforcing production service with the **best retrieval code in the repository**
   and **zero callers**. **[CORRECTED]**
3. **The GraphRAG picture inverted.** Rev 1 said no fusion/reranking exists anywhere. RRF fusion and a
   central knowledge layer _do_ exist — in the orphaned tier. **[CORRECTED]**
4. **A formal architectural decision gate (Phase 5A) now blocks all GraphRAG reconstruction.** **[NEW]**
5. **Phase 5 is split into 5A–5D.** **[NEW]**
6. **Phases 1, 2, 3, 4 are widened** to cover every runtime, not the single service Rev 1 assumed. **[NEW]**
7. **Two Rev-1 unverified items are resolved as confirmed findings** (CORS, gateway duplication). **[NEW]**

---

## Phase -1 — Credential Incident (✅ COMPLETE, with residuals)

**Status: CONTAINED 2026-07-29.** Full detail: `CREDENTIAL_INCIDENT_REPORT.md` (LN-SEC-2026-0729-01).

**Problem.** A shared password for five synthetic beta accounts was committed as a **hardcoded default to
an environment lookup** in `scripts/beta/verify_synthetic_accounts.py`, and separately quoted in
`docs/beta/FIRST5_GO_NOGO.md`. It authenticated against the live production Supabase project. **[NEW]**

**Scope.** 5 synthetic accounts (no real user data). Live ~30 days (2026-06-29 → 2026-07-29). Present in
`origin/main` and ~30 branches via commits `7b01a413` and `829c6a1f`. **[CONFIRMED]**

**Root cause of control failure.** CI ran TruffleHog with `--only-verified`, which reports a secret **only
when it can be verified against a provider API**. A generic application password for our own project has no
verifier and was invisible by design. The control worked exactly as configured and still missed a live
credential for a month. **[NEW]**

**Completed actions.**

- ✅ 15-category exposure sweep (tracked, untracked, ignored, index, history, stashes, reflog ×687 commits,
  patches, logs, fixtures, deploy config, docs, artifacts)
- ✅ Rotated all 5 accounts — **unique** 28-char CSPRNG secret each (not a shared secret)
- ✅ **Verified containment by live test**: old credential `REJECTED (400)` ×5; new credentials
  `AUTHENTICATED` ×5 (proving rotation, not lockout)
- ✅ Redacted 5 files; working tree occurrences = 0
- ✅ Script now fails closed (no default)
- ✅ Preventive controls: `.gitleaks.toml`, pre-commit hook, Gitleaks CI job **alongside** TruffleHog,
  `.gitignore` credential patterns

**Residuals — owner action required.**

| ID      | Residual                                                                                                          | Severity          | Blocks                  |
| ------- | ----------------------------------------------------------------------------------------------------------------- | ----------------- | ----------------------- |
| **R-1** | Pre-existing sessions not provably revoked (GoTrue admin endpoint returned 404)                                   | Medium            | Phase 0 exit            |
| **R-2** | Value remains in shared git history (~30 branches). **Inert post-rotation.**                                      | Low               | Nothing — decision only |
| **R-3** | Unknown whether the credential was _used_ during the 30-day window; auth logs unreviewed                          | **Unknown**       | Phase 0 exit            |
| **R-5** | `gitleaks` not installed locally → pre-commit warns, does not block                                               | Medium            | Phase 11                |
| **R-6** | 8 credential-named vars in `apps/web/env-values/prod.env.example` — shape analysis found no provider-format match | Low               | Phase 0                 |
| **R-7** | Rotation not reflected in verification tooling (script assumes one shared password)                               | Low (operational) | Beta readiness          |

**Git-history remediation: NOT PERFORMED, PENDING DECISION.** Recommendation stands — **do not rewrite**.
Rotation neutralized the credential; a rewrite removes a string, not a risk, and costs ~30 branches, every
clone, every open PR, and every commit SHA referenced in docs and telemetry. Plan in
`CREDENTIAL_INCIDENT_REPORT.md` §6 if overridden. **No force-push without explicit approval.** **[CONFIRMED]**

**Lesson folded into this plan.** Every security control must be **tested against the threat it claims to
cover**. A planted benign fake secret in CI would have exposed the TruffleHog gap on day one. This becomes
an exit criterion in Phase 11. **[NEW]**

---

## Corrections to Revision 1

### C-A. `apps/api-gateway` — every prior claim of emptiness is withdrawn **[CORRECTED]**

Rev 1, `TECHNICAL_DUE_DILIGENCE.md`, and `ARCHITECTURE_REVIEW.md` variously described it as _"essentially no
source"_, _"vestigial"_, _"a deployable unit with no meaningful source"_, and _"delete or build"_. All of
these are **wrong**. They came from counting `.ts`/`.rs` files in a **Python** service.

**Verified actual state:**

| Attribute  | Reality                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Source     | **1,508 LOC Python**, 7 routers, 8 service modules, 6 test files, own `pytest.ini`                                              |
| Deployment | Fly `lifenavigator-api-gateway`, `min_machines_running = 1`, live                                                               |
| Liveness   | `GET /healthz` → **200**; `POST /api/graphrag/query` → **401** (auth enforced)                                                  |
| CI         | **Has its own pytest job** in `deploy-fly.yml` (path-filtered)                                                                  |
| Callers    | **ZERO** in any application source. Only `docs/archive/` references                                                             |
| History    | `docs/archive/SOURCE_OF_TRUTH_VERIFICATION.md:15` — _"web calls **api-gateway**, not core-api"_. It **was** the system of entry |

**Correct classification: LEGACY / ORPHANED-BUT-LIVE.** Superseded by core-api, never retired.

### C-B. The best retrieval implementation is in the orphaned tier **[CORRECTED]**

`AI_SYSTEMS_REVIEW.md` stated there is "no reciprocal rank fusion, no score normalization, no reranking"
and no central knowledge layer. **True of core-api. False of api-gateway**, which has:

- `graphrag_personal.py::rrf_fuse` — real Reciprocal Rank Fusion (k=60) over vector + graph channels
- `graphrag_central.py::retrieve_central` — **central/shared knowledge** via Qdrant `ln_central`
- `neo4j_central_database = "central"` — a second Neo4j database core-api does not know exists
- Recency ordering: `ORDER BY coalesce(n.updated_at, n.created_at) DESC`
- A Neo4j helper that **refuses Cypher lacking `$tenant_id`** — a guard core-api does not have
- `response_model` validation — stricter than core-api's raw dicts
- `retrieve_personal(*, user_id, …)` — tenant as a **required kwarg**, so omission is a static error

**Consequence: the retirement decision inverts.** The gateway must be **harvested before retirement**, or
the best retrieval code and the only central-knowledge capability are destroyed. **[NEW]**

### C-C. Retrieval limitation that survives the correction **[CONFIRMED]**

Both Python tiers run `MATCH (n) WHERE n.tenant_id = $x … LIMIT $k`. **Neither traverses.** The gateway
ranks and fuses better; it is still a filtered node scan. GraphRAG-is-not-GraphRAG stands for both.

### C-D. Rev 1 unverified items now resolved **[NEW]**

| Rev 1 ID                                    | Resolution                                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **U-1** CORS permissive?                    | **CONFIRMED FINDING.** Both Python tiers: `allowed_origins: str = "*"` default, with `allow_credentials=True` |
| **U-7** gateway duplicates authz?           | **CONFIRMED.** `api-gateway/app/auth.py` is a functional duplicate of `core-api/app/auth.py`                  |
| **U-8** gateway deployed/receiving traffic? | **CONFIRMED deployed and live; ZERO traffic from any known client**                                           |

### C-E. Newly discovered, not in any Rev 1 report **[NEW]**

| ID      | Finding                                                                                                                                                                               | Evidence                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **N-1** | **Four tenant identity models**, not one: web session cookie; core-api JWT `sub`; gateway JWT `sub` (duplicate code); **`tenant_id` from `lnk_*` API keys** in web `/api/platform/**` | `lib/tenant/api-gateway.ts`, 12 platform routes |
| **N-2** | **Edge auth fails open** — missing Supabase env → all requests pass                                                                                                                   | `apps/web/src/proxy.ts:65-68`                   |
| **N-3** | **Two service-role holders** — core-api and api-gateway both carry `supabase_service_role_key`                                                                                        | both `config.py`                                |
| **N-4** | **Three public internet surfaces** accepting the same JWTs; only web has rate limiting                                                                                                | live probes                                     |
| **N-5** | Gateway config default embedding model is the **retired** `text-embedding-004` (768-dim), overridden in fly.toml to 3072-dim — same landmine as the Rust worker                       | `api-gateway/app/config.py`                     |
| **N-6** | Health checks in both tiers are **shallow** — no downstream verification; a tier with a dead datastore reports healthy                                                                | both `main.py`                                  |
| **N-7** | **Five compute surfaces**, not three: web, core-api, api-gateway, worker, **Supabase Edge Functions**                                                                                 | `ci.yml` deploy-edge-functions job              |

---

## Recalculated Findings

| Dimension                | Rev 1                                      | Rev 2                                                                                                                                                                                                         | Why                       |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| **Backend completeness** | core-api 26,393 LOC                        | **27,901 LOC across two live Python services** (+1,508 gateway). More backend exists than assessed; it is also **more duplicated**                                                                            | **[CORRECTED]**           |
| **API architecture**     | "dual API topology, undocumented"          | **Three public HTTP surfaces + a fourth API-key plane + Edge Functions.** One tier is orphaned-but-live                                                                                                       | **[CORRECTED]**           |
| **GraphRAG ownership**   | "core-api owns it, flag-off"               | **No tier owns it functionally.** core-api's is disabled; the gateway's is unreachable. Two divergent implementations                                                                                         | **[CORRECTED]**           |
| **Authentication**       | "correct, one implementation"              | Verification logic still correct — but **duplicated across two Python tiers** and **fails open at the web edge**                                                                                              | **[CORRECTED]**           |
| **Authorization**        | "no RBAC"                                  | **Confirmed and worse**: `role` is parsed in _both_ tiers and consulted in _neither_. Only real authz = API-key scopes + share-token capability                                                               | **[CONFIRMED + widened]** |
| **Tenant isolation**     | "117 sites, 0 scoped, one tier"            | **Same defect, larger surface.** Plus: the _weakest_ enforcement (convention) is in the authoritative tier while the _strongest_ (required kwarg + Cypher guard) is in the orphaned one                       | **[CORRECTED]**           |
| **Production readiness** | 5.5                                        | **5.0** — an orphaned live public service holding service-role credentials, a fail-open edge, and shallow health checks are all production-readiness defects                                                  | **[CORRECTED]**           |
| **Test coverage**        | "93 python test files; core-api 900 tests" | **Slightly better than assessed** — the gateway has 6 test files **and a real CI pytest job**. But the 900-test figure is core-api only; gateway tests run separately and are not part of the headline number | **[CORRECTED]**           |
| **Deployment topology**  | "3 Fly apps + Vercel"                      | **3 Fly apps + Vercel + Supabase Edge Functions = 5 deploy targets**, of which one Fly app serves no traffic                                                                                                  | **[CORRECTED]**           |
| **Code quality**         | 6.5                                        | **6.3** — the gateway code is _good_ (arguably cleaner than core-api's retriever), but wholesale duplication of auth, clients, and retrieval across tiers is a quality defect at the system level             | **[CORRECTED]**           |
| **Maintainability**      | 5.0                                        | **4.5** — two implementations of auth and retrieval that already diverge, with no shared library and no contract                                                                                              | **[CORRECTED]**           |

---

## Reconciled Root Causes

| RC        | Root cause                                                                                | Owner phase          | Change from Rev 1                            |
| --------- | ----------------------------------------------------------------------------------------- | -------------------- | -------------------------------------------- |
| **RC-0**  | Committed credential + scanner blind to unverifiable secrets                              | **Phase -1** ✅ done | **[NEW]**                                    |
| **RC-1**  | Tenant isolation by convention; RLS bypassed                                              | **Phase 1**          | **Widened** to all tiers/jobs                |
| **RC-2**  | No prompt-injection controls on untrusted content                                         | **Phase 3**          | **Widened** to all mutation paths            |
| **RC-3**  | Governance/rate limiting at the wrong tier                                                | **Phase 1 + 9**      | **Widened** — two undefended public surfaces |
| **RC-4**  | Retrieval does not traverse; two divergent implementations; neither reachable-and-enabled | **Phase 5A→5D**      | **Restructured**                             |
| **RC-5**  | No retrieval evaluation                                                                   | **Phase 4**          | Must run against the **production path**     |
| **RC-6**  | No connection pooling                                                                     | **Phase 2**          | **Widened** to every runtime                 |
| **RC-7**  | Config drift (embedding model, migration/whitelist coupling)                              | **Phase 2**          | **Widened** — gateway has the same defect    |
| **RC-8**  | No observability; silent failure                                                          | **Phase 9**          | Unchanged                                    |
| **RC-9**  | Docs claim capabilities the code lacks                                                    | **Phase 12**         | **Widened** — now includes topology docs     |
| **RC-10** | **No single authoritative API/orchestration owner**                                       | **Phase 5A**         | **[NEW]**                                    |

---

## Track Separation — reaffirmed and tightened

**Security and retrieval changes MUST be separate pull requests and separate rollback units.** **[CONFIRMED]**

|                | Security & Integrity  | AI & Retrieval         | Architecture           |
| -------------- | --------------------- | ---------------------- | ---------------------- |
| Phases         | -1, 1, 2, 3, 9        | 4, 5B, 5C, 5D, 6, 7, 8 | **5A** (decision only) |
| Branch prefix  | `sec/`                | `ai/`                  | `arch/`                |
| Rollback unit  | per-router / per-flag | per-flag               | decision doc — no code |
| Deploy posture | ships when green      | ships flag-off         | N/A                    |

**Prohibited combinations (PR-review enforced):**

- ❌ `clients/supabase.py` **+** any retriever
- ❌ injection defenses **+** Cypher edits
- ❌ tenant scoping **+** advisor prompt
- ❌ authorization behavior **+** a feature-flag flip
- ❌ **[NEW]** gateway retirement **+** any other change
- ❌ **[NEW]** Phase 5A decision **+** Phase 5B–D implementation

---

# PHASES

## Phase 0 — Baseline and Claim Reconciliation

**Changes in Rev 2:** absorbs the Phase -1 residuals; U-1/U-7/U-8 removed (resolved); adds topology
verification.

**Problem.** No immutable baseline. 12 commits unpushed. Six audit documents untracked. Residual incident
items open. **[CONFIRMED]**

**Affected components.** Repo metadata, CI, docs. No application code.

**Proposed changes.**

1. Push the 12 commits; open a PR for the advisor work.
2. Commit all six audit documents — **credential already redacted; verify 0 occurrences before commit**.
3. Close incident residuals **R-1** (session revocation) and **R-3** (auth-log review) — both owner actions.
4. Verify remaining Rev-1 unknowns: **U-2** (enumerate 117 selects), **U-3** (share token `revoked`/`expires_at`),
   **U-4** (pagination), **U-5** (cross-store deletion), **U-6** (encryption at rest). _U-1/U-7/U-8 closed._
5. **[NEW]** Verify the fifth compute surface: inventory Supabase Edge Functions, their auth, and their
   datastore access.
6. **[NEW]** Confirm gateway caller-count = 0 with a 7-day access-log observation (feeds Phase 5A).
7. Capture baseline metrics (latency p50/p95 per route, fallback rate, validator rejection rate, test counts).
8. `docs/audit/CLAIM_REGISTER.md` — every public claim tagged SUPPORTED / PARTIAL / UNSUPPORTED.

**Tests.** None (no code change). Baseline capture must be scripted and reproducible.

**Migration concerns.** None.

**Rollback.** N/A — additive.

**Evidence required.** Verification log; baseline file; claim register; edge-function inventory; 7-day
gateway access-log sample.

**Exit criteria.**

- [ ] 12 commits pushed; CI green
- [ ] Six audit docs committed; `grep` for the credential returns 0
- [ ] R-1 and R-3 closed with evidence
- [ ] U-2…U-6 resolved to CONFIRMED or DISMISSED
- [ ] Edge Functions inventoried
- [ ] Gateway traffic = 0 over 7 days, evidenced
- [ ] Claim register complete

**Complexity.** Low (3–4 days, +7-day observation running in parallel).

**Must not combine with.** Any code change.

---

## Phase 1 — Tenant Isolation and Authorization _(widened)_

**Changes in Rev 2:** now covers **all API tiers, background jobs, and internal service calls** — not
core-api alone.

**Problem.** **[CONFIRMED]** core-api: 117 `.select(` sites, 0 with a user JWT; RLS bypassed.
**[NEW] Widened:** (a) api-gateway also holds a service-role key; (b) the worker writes to three stores with
tenant carried on queue rows; (c) web mutates Supabase directly under two different identity models; (d)
four incompatible tenant derivations exist (N-1).

**Risk. CRITICAL.** Cross-tenant breach of financial and health data. A prior 43-view RLS leak is on record.

**Affected components.** `core-api/app/clients/supabase.py` + 67 services + 22 routers;
`api-gateway/app/config.py` (credential removal); `apps/web` platform plane + SSR writes;
`ingestion-worker` tenant propagation; CI.

**Proposed changes.**

1. **Enumerate and classify all 117 core-api call sites** (user-scoped / privileged / unclear).
2. **Scoped accessor** — `SupabaseClient.for_user(ctx)` injecting the tenant filter; raw client renamed
   `_privileged_*` requiring an allowlisted import.
3. **Migrate incrementally, one router per PR**, each with cross-tenant tests.
4. **CI guard** modeled on the existing `verify-governance` job (proven pattern in this repo).
5. **[NEW] Revoke the gateway's service-role credential** — it has no Supabase usage. Reduces service-role
   holders from 2 → 1 immediately, independent of retirement.
6. **[NEW] Audit worker tenant propagation** — verify the queue row's tenant is the only source and cannot
   be overridden by payload.
7. **[NEW] Document and reconcile the four tenant models** (N-1). Reconciliation _design_ only in this
   phase; implementation deferred to Phase 5A/M9.
8. **[NEW] Fix the fail-open edge** (N-2) — missing Supabase config must fail closed.
9. **[NEW] Pin CORS origins** per environment in both tiers (C-D/U-1). Remove the `"*"` default.
10. RBAC — **design only**, no implementation.

**Tests.** Cross-tenant fixture (users A/B) per migrated router; negative test that the scoped accessor
cannot be called without a context; CI-guard self-test on a deliberately non-compliant fixture; worker test
that a payload-supplied tenant is ignored; edge test that missing config denies.

**Migration concerns.** Switching reads to user-JWT + RLS means **RLS policies must be verified per table
before that table's reads move** — a subtly wrong policy is currently inert and will start being enforced.
Analytics/admin paths that legitimately need service-role must be explicitly allowlisted.

**Rollback.** Per-router PRs, independently revertible. Scoped accessor is additive. **Tag
`pre-tenant-isolation` before the first migration.**

**Evidence required.** 117-row classification; cross-tenant suite passing; CI guard demonstrated failing;
gateway credential revocation confirmed; worker tenant test; CORS config per environment.

**Exit criteria.**

- [ ] 117/117 classified, 0 unclear
- [ ] 100% of user-scoped sites use the scoped accessor
- [ ] Privileged-import allowlist ≤ 10, each justified inline
- [ ] Cross-tenant suite covers every router with user-scoped reads
- [ ] CI guard merged and proven to fail on a violation
- [ ] **Service-role holders reduced to exactly ONE (core-api)** — documented
- [ ] **No undocumented service-role access anywhere** (grep-proven)
- [ ] Worker cannot be induced to write cross-tenant
- [ ] Edge auth fails closed
- [ ] CORS pinned in both tiers; no `"*"` default

**Complexity.** **High → Very High (4–5 weeks)** — up from Rev 1's 3–4 weeks; the surface grew.

**Must not combine with.** Retrieval, prompts, performance, RBAC implementation, gateway retirement.

---

## Phase 2 — Configuration and Connection Integrity _(widened)_

**Changes in Rev 2:** applies to **every active runtime** — core-api, api-gateway (while alive), worker, and
web's server routes — not core-api alone.

**Problem.** **[CONFIRMED]** 19 per-call `httpx.AsyncClient` constructions in core-api; no pooling.
**[NEW]** The gateway constructs its own clients; the worker has its own; the retired-embedding-model
default (`text-embedding-004`, 768-dim vs production 3072-dim) exists in **both** the Rust worker **and**
the gateway config (N-5). `_ADVISOR_TURNS_COLUMNS` remains coupled to migration state by comment.

**Risk. High.** Silent vector-index corruption; per-request TLS handshake tax on every store call.

**Affected components.** `core-api/app/clients/*`, `main.py`, `dependencies.py`;
`api-gateway/app/services/*`, `deps.py`; `ingestion-worker/src/config.rs`; `advisor_orchestrator.py`.

**Proposed changes.**

1. **Pooled clients per external service**, created at startup, closed at shutdown, in **every** Python
   runtime.
2. **Startup configuration assertions, fail-loud, in every runtime**: embedding model name **and dimension**
   consistent across core-api / gateway / worker; Qdrant collection dimension matches; required env present.
3. **Fix retired-model defaults** in `config.rs` **and** `api-gateway/app/config.py` — prefer _required_
   over _defaulted_.
4. **Replace comment-coupling** with a startup check that reads actual table columns.
5. **Split client construction from retriever construction** in `dependencies.py` so Phases 4–5 touch
   disjoint regions.

**Tests.** Client lifecycle (reuse + shutdown) per runtime; assertion tests for each mismatch class; the
full 900-test suite green; gateway's 6 test files green; concurrency smoke for descriptor exhaustion.

**Migration concerns.** Startup assertions can block a boot that previously succeeded — intentional, but a
bad config becomes an outage rather than silent corruption. Stage one app at a time; the error must name the
exact mismatch.

**Rollback.** Internal only. Assertions behind `STRICT_CONFIG_ASSERTIONS`. **Tag `pre-connection-pooling`.**

**Evidence required.** Before/after p50 & p95 on ≥3 endpoints per runtime; handshake-count reduction; proof
that a deliberately mismatched embedding config fails startup in each runtime.

**Exit criteria.**

- [ ] 0 per-call client constructions in any request path, **all runtimes**
- [ ] Measured p50 reduction on ≥3 endpoints vs Phase 0 baseline
- [ ] Startup fails specifically on: dimension mismatch, missing required var, column mismatch — **in every
      runtime**
- [ ] No retired-model default anywhere (worker **and** gateway)
- [ ] All test suites green

**Complexity.** **Low–Medium → Medium (1.5 weeks)** — up from 1 week; three runtimes instead of one.
**Still the highest leverage-to-effort item in the plan.**

**Must not combine with.** Retrieval logic; Cypher edits.

---

## Phase 3 — Untrusted-Content and Prompt-Injection Security _(widened)_

**Changes in Rev 2:** defenses must cover **every path capable of proposing or applying a persistent
mutation**, not the advisor path alone.

**Problem.** **[CONFIRMED]** No injection controls. **[NEW] Widened:** the mutation-capable surface is
larger than Rev 1 assumed —
(a) `/v1/life/advisor/action/detect` → `/apply` → `IngestionService` → `life.facts`;
(b) `/v1/documents/fields/{field_id}/review` — human-approval loop over OCR-extracted text;
(c) `/v1/documents/conflicts/scan` — conflict resolution over extracted content;
(d) web `/api/platform/**` mutations under a **different** identity model;
(e) worker ingestion, which writes graph/vector state from document-derived text.

**Risk. High.** Untested. Chain: crafted PDF → OCR → context → proposed action → user approves → persisted.

**Affected components.** `advisor_context.py`, `advisor_llm.py`, document extraction, `advisor_actions.py`,
`documents.py` router, worker normalizer, eval scenarios.

**Proposed changes.**

1. **Provenance tagging** on every context element: `user_stated | verified_db | third_party_document |
third_party_api`.
2. **Structural delimiting** of untrusted segments + a standing prompt rule that content inside is data.
3. **Pre-context screening** of document-derived text for instruction patterns; flag, quarantine, log.
4. **Privileged-sink rule:** any proposed mutation's justification must trace to `user_stated` or
   `verified_db`. Document-only justification is refused. **Applies to all five paths above.**
5. **Injection eval scenarios** in the existing harness.
6. **[NEW]** Verify the worker cannot be induced by document content to emit unintended edges.

**Tests.** ≥30-payload red-team corpus across documents, chat, merchant strings, and platform inputs; assert
no behavior change and full logging; assert document-only justification is refused on **each** mutation
path; regression on the 900-test suite and advisor quality.

**Migration concerns.** Prompt changes require a **version bump** (currently `advisor-hybrid-6.2.0`) for
telemetry attribution.

**Rollback.** Screening behind `UNTRUSTED_CONTENT_SCREENING`; prompt revertible by version pin.
**Tag `pre-injection-defense`.**

**Evidence required.** Red-team results table before/after; detection logs; per-path refusal proofs; no
advisor-quality regression.

**Exit criteria.**

- [ ] ≥30 payloads; **0** succeed
- [ ] 100% of document-derived context provenance-tagged
- [ ] **Every one of the five mutation-capable paths** refuses third-party-only justification (test-proven)
- [ ] Worker edge-emission unaffected by document content
- [ ] Injection scenarios in the eval workflow
- [ ] No advisor-quality regression vs baseline

**Complexity.** **Medium → Medium-High (2.5 weeks)** — five paths instead of one.

**Must not combine with.** Phase 1 (must land first); retrieval; Phase 7 (both touch the prompt).

---

## Phase 4 — Retrieval Evaluation Framework _(strengthened)_

**Changes in Rev 2:** the runner **must invoke the same production retrieval path a user actually reaches**
— not a test-only harness around library functions.

**Problem.** **[CONFIRMED]** No retrieval evaluation exists. **[NEW]** There are now **two** retrieval
implementations to measure, and the one users reach is **disabled**, so "the production path" must be
defined before it can be measured.

**Risk. High (as a blocker).** Without this, Phase 5 improvement claims are unfalsifiable — the exact
failure that produced the current credibility gap.

**Affected components.** New `evals/retrieval/`. **Read-only** against both retrievers.

**Proposed changes.**

1. **Golden query set** — 75–100 queries across domains, built on the 5 synthetic personas
   (**note: passwords rotated 2026-07-29; the harness must read them from the environment**).
2. **Relevance judgments**, human-labelled, versioned JSON.
3. **Metrics**: recall@k, precision@k, MRR, nDCG@10, plus per-source attribution.
4. **[NEW] Production-path invocation.** The runner calls retrieval **through the real entry point** — the
   HTTP route or the orchestrator's context-build call — with a real JWT and real tenant context. Calling
   `retrieve_personal()` directly is **prohibited**: it bypasses auth, tenant derivation, flag state, and
   context assembly, and would measure a path no user reaches.
5. **[NEW] Measure BOTH implementations** on identical inputs: core-api (flag forced on) vs api-gateway.
   This produces the evidence Phase 5A needs to choose an owner.
6. **Ablation**: vector-only / graph-only / fused.
7. **Baseline report** on both.

**Tests.** Metric correctness against hand-computed fixtures; a test that the runner fails if it detects it
is bypassing auth/tenant context.

**Migration concerns.** Requires seeded graphs for the personas. If `GRAPH_GROUNDING_ENABLED` has never run
with data, seeding is a prerequisite.

**Rollback.** N/A — additive, no production path modified.

**Evidence required.** Committed golden set + labeller notes; baselines for **both** retrievers; ablation
quantifying the graph channel's contribution (**prediction: near zero for core-api, materially positive for
the gateway's RRF — if measurement disagrees, that is an important finding**).

**Exit criteria.**

- [ ] ≥75 queries with judgments, committed and versioned
- [ ] Harness produces recall@k / MRR / nDCG reproducibly
- [ ] **Runner provably exercises the production path** (auth + tenant + flags), test-enforced
- [ ] Baselines recorded for **both** implementations
- [ ] Ablation quantifies vector vs graph contribution
- [ ] Runs in CI (report-only)

**Complexity.** Medium (2–2.5 weeks — labelling dominates).

**Must not combine with.** **Any retrieval implementation change.** The baseline must measure the system as
it exists.

---

## Phase 5A — GraphRAG Service Ownership and Contract _(NEW — DECISION GATE)_

> ## 🚧 HARD GATE
>
> **No GraphRAG reconstruction may begin — no traversal, no query planning, no fusion work, no gateway
> retirement — until Phase 5A is signed off.** Phases 5B, 5C, 5D and 6 are **BLOCKED** on it.
> **Rationale:** two divergent implementations already exist. Building a third before naming an owner
> guarantees a fourth.

**Problem.** **[NEW]** No tier owns GraphRAG functionally. core-api owns the code path (disabled by
default); api-gateway owns the superior implementation (zero callers). Rev 1 assumed a single owner existed.

**Risk. High (strategic).** Wrong ownership choice means either (a) a network hop between context assembly
and retrieval, adding latency to a p50 already ~12.7s and creating a second tenant boundary, or (b)
discarding RRF + central retrieval.

**Affected components.** Decision document only. **No code.**

**Proposed changes.** Produce `docs/architecture/GRAPHRAG_OWNERSHIP_DECISION.md` containing:

1. **The owner**, with rationale. _(Standing recommendation from `API_RUNTIME_AND_OWNERSHIP_MAP.md`:
   **core-api**, because retrieval must sit beside grounding assembly, and core-api already owns provenance,
   the validator, and citations — the consumers of retrieval.)_
2. **The retrieval contract** — request/response schema, tenant derivation, error semantics, versioned.
3. **The harvest list** — explicit, from the gateway: `rrf_fuse()`; `retrieve_central()` + `ln_central`;
   `neo4j_central_database`; the `run_personal` Cypher tenant guard; `response_model` discipline;
   `retrieve_personal`'s required-kwarg tenant signature; `/readyz`.
4. **Consolidation plan for duplicate implementations** (below).
5. **Central-knowledge disposition** — `ln_central` and the `central` Neo4j DB have no other reader.
   Inventory contents and writers; decide keep/migrate/delete.
6. **Phase-4 evidence applied** — the measured comparison of both retrievers informs, and may overturn, the
   standing recommendation.

**Tests.** None (decision artifact). The decision must cite Phase 4 numbers.

**Migration concerns.** None — no code.

**Rollback.** Revise the document. No runtime impact.

**Evidence required.** Phase 4 comparative baselines; gateway 7-day traffic log (Phase 0); central-store
inventory; sign-off by the security reviewer **and** the AI reviewer (both tracks are affected).

**Exit criteria.**

- [ ] **Exactly one** authoritative GraphRAG orchestration owner named, in writing
- [ ] Versioned retrieval contract published
- [ ] Harvest list itemized and mapped to target modules
- [ ] Duplicate-implementation consolidation plan approved
- [ ] Central-knowledge disposition decided
- [ ] Decision cites Phase 4 measurements
- [ ] Signed off by both track reviewers

**Complexity.** Low effort, **high consequence** (1 week, mostly review latency).

**Must not combine with.** Any implementation. This phase produces a document, nothing else.

### Duplicate GraphRAG implementations and routers — consolidation without breaking clients

| Duplication                                                                                      | Locations                                                                                | Consolidation                                                                            | Client impact                                                                                                                         |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Personal retrieval                                                                               | `core-api/app/grounding/retriever.py` vs `api-gateway/app/services/graphrag_personal.py` | Harvest gateway → core-api behind `GRAPH_RETRIEVAL_V2`                                   | **None** — core-api path is internal to the advisor                                                                                   |
| Central retrieval                                                                                | gateway only                                                                             | Port to core-api; new **additive** `/v1/retrieval/query`                                 | **None** — additive                                                                                                                   |
| `POST /api/graphrag/query`                                                                       | gateway                                                                                  | Superseded by `/v1/retrieval/query`. **Serve `410 Gone` for one release** before removal | **None known** (0 callers, verified) — the 410 exists to make an _unknown_ caller diagnosable rather than seeing a connection failure |
| `/api/recommendations`                                                                           | gateway                                                                                  | core-api `/v1/recommendations` already exists                                            | **None known**                                                                                                                        |
| `/api/simulations`, `/api/optimizer`, `/api/compliance`, `/api/arcana`, `/api/health-monitoring` | gateway                                                                                  | **Triage individually**: port if on the roadmap, delete if not. Do not port by default   | **None known**                                                                                                                        |
| `verify_jwt`                                                                                     | both `auth.py`                                                                           | Extract to a shared internal package; both import                                        | None (internal)                                                                                                                       |
| Neo4j/Qdrant/Gemini clients                                                                      | core-api, gateway, worker (Rust)                                                         | Unify the two Python ones; Rust stays separate                                           | None (internal)                                                                                                                       |

**Compatibility rule:** no gateway route may be deleted until (a) 0 traffic is evidenced over 7 days,
(b) a `410 Gone` shim has shipped for one release, and (c) the replacement is live in core-api.

---

## Phase 5B — Query Planning and Entity Linking _(BLOCKED on 5A)_

**Problem.** Retrieval takes the raw query string straight to embedding. No intent classification, no entity
extraction, no query decomposition, no linking of mentions to graph entities. **[NEW]**

**Risk. Medium.** Without entity linking, traversal (5C) has no reliable seed set.

**Affected components.** The owner tier's retrieval module (per 5A).

**Proposed changes.** Query intent classification (lookup / comparison / temporal / aggregation); entity
mention extraction; linking to `entity_id` via deterministic keys and vector similarity with a confidence
threshold; multi-part query decomposition; the seed set becomes traversal input for 5C.

**Tests.** Entity-linking precision/recall on a labelled set; intent-classification accuracy; **every change
measured against the Phase 4 golden set**.

**Migration concerns.** May require Neo4j indexes on linking keys.

**Rollback.** Behind `RETRIEVAL_QUERY_PLANNING`. **Tag `pre-query-planning`.**

**Exit criteria.**

- [ ] Entity-linking precision ≥ agreed threshold on labelled data
- [ ] Seed sets produced for ≥90% of golden queries
- [ ] No regression on Phase 4 baseline
- [ ] Latency budget respected

**Complexity.** Medium-High (2–3 weeks).

**Must not combine with.** 5C or 5D — each stage must be independently measurable.

---

## Phase 5C — Bounded Traversal _(BLOCKED on 5A, 5B)_

**Problem.** **[CONFIRMED]** Neither tier traverses. The ontology declares 78 edge rules and ~62 typed
relationships that retrieval never reads.

**Risk. Medium-High.** Unbounded traversal on a dense personal graph is a latency and cost incident.

**Proposed changes.** Seed from 5B's linked entities plus the user anchor; expand 1–3 hops along **typed**
edges; **hard bounds** on depth, breadth, and node budget; typed-edge weighting (`HAS_EVIDENCE` ≠
`RELATED_TO`) plus recency; return **paths**, not just nodes, so provenance can cite the path.

**Tests.** Traversal correctness on a fixture graph; **tenant-safety property tests** (traversal must never
cross `tenant_id` — this is the highest-risk regression in the phase); bound enforcement under a synthetic
dense graph; Phase 4 metrics.

**Migration concerns.** Neo4j index requirements; Aura schema change with its own rollout.

**Rollback.** Behind `GRAPH_TRAVERSAL_ENABLED`. **Tag `pre-traversal`.**

**Exit criteria.**

- [ ] Bounded traversal (depth/breadth/budget enforced, test-proven)
- [ ] Typed-edge weighting applied
- [ ] **Tenant-safety property tests pass** — no cross-tenant path, ever
- [ ] p95 traversal latency within budget
- [ ] Measurable improvement on Phase 4 recall@10 / nDCG@10 — **or an honest report that it does not help**

**Complexity.** High (3 weeks).

**Must not combine with.** 5B, 5D.

---

## Phase 5D — Hybrid Fusion and Reranking _(BLOCKED on 5A–5C)_

**Problem.** core-api concatenates channels with `score: None` on graph rows. **The gateway already solves
half of this with RRF (k=60) — this phase is substantially a harvest, not an invention.** **[CORRECTED]**

**Proposed changes.** Port `rrf_fuse` from the gateway; normalize scores across channels; add central-KB as
a third channel; cross-encoder or LLM-judge reranking of the fused candidate set; relevance thresholding so
low-scoring evidence is dropped rather than passed to the model.

**Tests.** RRF math verified against hand-computed values (**and against the gateway's output on identical
inputs — fidelity of the harvest is the key risk**); rerank quality on the golden set; threshold ablation.

**Rollback.** Behind `RETRIEVAL_FUSION_V2`. **Tag `pre-fusion-v2`.**

**Exit criteria.**

- [ ] RRF ported and **proven to reproduce gateway outputs on identical inputs**
- [ ] No `None` scores in any channel
- [ ] Reranking measurably improves nDCG@10 over fusion-only
- [ ] Threshold tuned against the golden set
- [ ] Combined 5B+5C+5D improvement over the Phase 4 baseline reported honestly

**Complexity.** Medium (2 weeks — porting is cheaper than inventing).

**Must not combine with.** 5B, 5C.

---

## Phase 6 — Central and Personal Graph Integration _(BLOCKED on 5A)_

**Changes in Rev 2:** now explicitly includes the **central knowledge stores discovered in the gateway**.

**Problem.** No entity resolution, no deduplication, no identity merging. **[NEW]** Plus: a central
knowledge layer (`ln_central`, Neo4j `central`) exists with **no reader other than the orphaned tier** and
unknown contents.

**Risk. Medium**, degrading silently over time.

**Proposed changes.**

1. **Audit `services/conflicts.py` (474 LOC) first** — establish what exists before building.
2. **[NEW] Inventory the central stores** — contents, writers, freshness. Decide keep/migrate/delete.
3. Entity resolution: deterministic keys where available; fuzzy matching with thresholds; **never auto-merge
   below confidence — queue for review**.
4. Merge precedence: verified DB > user-stated > document-extracted > inferred. Record merge provenance so
   merges are reversible.
5. Conflicts surface as user questions, not silent overwrites.
6. Graph quality metrics: orphan rate, duplicate rate, edge-type distribution, staleness.

**Tests.** ER precision/recall on labelled fixtures; merge reversibility; conflict detection; graph-quality
regression.

**Migration concerns.** **The highest-risk data migration in this plan.** Merges are destructive. Requires a
verified backup, dry-run reports, staged per-domain rollout, and recorded provenance.

**Rollback.** **The rollback IS the backup restore, which must be tested BEFORE the first merge.**
**Tag `pre-entity-resolution` + verified graph backup.**

**Exit criteria.**

- [ ] `conflicts.py` audited and documented
- [ ] Central stores inventoried and dispositioned
- [ ] ER precision ≥ threshold; no auto-merge below confidence
- [ ] Merge provenance recorded; reversal demonstrated
- [ ] Graph-quality metrics in CI with alerts
- [ ] **Backup/restore tested end-to-end before any production merge**

**Complexity.** High (3–4 weeks).

**Must not combine with.** Retrieval changes; security work.

---

## Phase 7 — Grounded Generation and Provenance

**Unchanged from Rev 1** except sequencing. **[CONFIRMED]**

**Problem.** The number gate infers meaning from characters near a figure. Three bugs from one root in a
single review session. The declared-figures contract is specified (`NUMERIC_PROVENANCE_SPEC.md`) and unbuilt.

**Proposed changes.** Per the spec's build order: slot packet → `figures` + refs behind a flag (validated,
not rendered; **compare declared kinds against the gate's verdicts on live traffic**) → renderer → flip the
invariant → delete the legacy regexes.

**Tests.** The three existing suites become the conformance suite. Step 4 needs its own numeral allowlist
matrix (dates, ages, "3–6 months", "401k").

**Rollback.** Every step flag-gated; shadow mode before enforcement. **Tag `pre-declared-figures`.**

**Exit criteria.**

- [ ] Slot packet shipped, non-breaking
- [ ] Declared-kind labelling accuracy measured ≥ threshold
- [ ] Shadow disagreement ≤ threshold, each triaged
- [ ] All existing gate tests pass on the new implementation
- [ ] Numeral allowlist has its own matrix
- [ ] Legacy regexes deleted only after a clean shadow period

**Complexity.** High (4 weeks).

**Must not combine with.** Phase 3 or Phase 5B–D (all touch the prompt or what reaches the model).

---

## Phase 8 — AI Quality and Regression Evaluation

**Changes in Rev 2:** must exercise the production path (consistent with Phase 4).

**Problem.** **[CONFIRMED]** `scripts/eval_prompt_live.py` **has never been run** (owner-blocked on expired
ADC). Prompt 6.2.0's market-price and source rules are validated only against scripted doubles.

**Proposed changes.** Restore credentials and run the live eval (**owner action — longest lead time in the
plan; trigger on day one**); merge the two harnesses under one scenario schema; expand scenarios (injection
from Phase 3, retrieval-grounded from 5B–D, figure declaration from Phase 7); define gating metrics
(fabrication **must be 0**, grounding rate, hedged-form compliance, source-key validity, fallback rate);
wire as a CI gate with a documented cost budget.

**Tests.** Unit tests for the scoring logic — a trusted-but-wrong gate is worse than none.

**Rollback.** Report-only for two weeks, then blocking.

**Exit criteria.**

- [ ] Live eval executed; results committed
- [ ] Unified harness, shared scenario schema
- [ ] Fabrication rate 0 on the full set
- [ ] **Gate proven to block a deliberately regressed prompt**
- [ ] Cost per run measured and within budget

**Complexity.** Medium (2 weeks + credential unblock).

**Must not combine with.** The AI changes it measures.

---

## Phase 9 — Reliability, Observability, and Failure Classification _(widened)_

**Changes in Rev 2:** tracing must span **all five compute surfaces**; health checks must become deep.

**Problem.** **[CONFIRMED]** No APM, tracing, error tracking, or alerting; 188 broad handlers make
integrity failures indistinguishable from empty results. **[NEW]** Health checks in both Python tiers are
shallow (N-6) — a tier with a dead datastore reports healthy. **[NEW]** There is no way to observe that the
gateway has no traffic other than manual log inspection.

**Proposed changes.** Failure taxonomy (`expected_degradation | integrity_failure | authz_failure |
dependency_failure | bug`) with the integrity/authz subset made loud; structured error events with
correlation ID and hashed tenant; **OpenTelemetry tracing across web → core-api → worker (→ gateway while
alive) → stores**; error tracking; alerts on fallback rate, validator rejection rate, retrieval degradation,
injection detection, model spend; **[NEW] deep `/readyz` in every service** verifying downstreams (port the
gateway's `/readyz` shape); SLOs.

**Tests.** Injected integrity failure produces a loud classified event; trace propagation across ≥3
services; a service with a dead datastore reports **not ready**.

**Migration concerns.** No PII/PHI in traces — extend the worker's existing `telemetry.rs` redaction
discipline rather than reinventing it.

**Rollback.** Additive; per-integration disable. **Tag `pre-observability`.**

**Exit criteria.**

- [ ] 188 handlers classified; integrity/authz emit loud events
- [ ] **Traceable request flow across service boundaries**, demonstrated end-to-end
- [ ] Alerts configured and demonstrated firing
- [ ] Deep readiness in every service
- [ ] PII/PHI absent from telemetry (audited)
- [ ] SLOs defined with measured baselines

**Complexity.** Medium → **Medium-High (3 weeks)** — more surfaces.

**Must not combine with.** Nothing strictly; sequence after Phase 2.

---

## Phase 10 — Performance and Scalability

**Changes in Rev 2:** capacity planning must account for consolidation onto core-api.

**Problem.** **[CONFIRMED]** Single 512 MB / 1 shared-CPU machine per service, single region, suspend-on-
idle, no caching, 4 `asyncio.gather` sites, **no load test — capacity is unknown**. **[NEW]** Consolidating
the gateway's responsibilities into core-api **increases** core-api's load on an already-undersized box.

**Proposed changes.** Load test **first**; caching (query embeddings, domain summaries, readiness snapshots,
context packets) with **tenant-scoped keys**; parallelize context assembly; horizontal scaling; queue model
calls; pagination audit.

**Tests.** Load at 10×/100× current concurrency; cache hit-rate and correctness — **a stale cache serving
another tenant's data is a security incident, so cache keys must include tenant and be reviewed under the
security lens**.

**Rollback.** Cache behind a flag with a kill switch. **Tag `pre-caching`.**

**Exit criteria.**

- [ ] Documented capacity at defined concurrency with acceptable p95
- [ ] Cache hit rate above threshold on hot paths
- [ ] **Tenant-scoped cache keys verified by test**
- [ ] Context assembly parallelized
- [ ] Horizontal scaling demonstrated under load
- [ ] **Capacity re-verified after any consolidation**

**Complexity.** Medium-High (3 weeks).

**Must not combine with.** Phase 1 — though Phase 1's reviewer must sign off on cache-key design.

---

## Phase 11 — Testing and CI Enforcement _(widened)_

**Changes in Rev 2:** adds the incident lesson and gateway coverage.

**Problem.** **[CONFIRMED]** No coverage gate (`jest.config.ts:31` commented out); no `cargo test`;
dependency audit at `critical` only; no SAST/DAST; thin E2E; graph validation only checks file existence.
**[NEW]** Secret scanning was configured in a way that could not detect the class of secret that leaked.

**Proposed changes.** `cargo test` + `clippy -D warnings` + `cargo audit`; coverage thresholds at current
measured levels then ratcheted; dependency audit → `high`; CodeQL + Trivy; E2E on the 5 critical paths;
graph-quality validation replacing file-existence checks; promote Phase 4 and Phase 8 evals to gating;
**[NEW] a canary secret in CI** proving the scanners actually detect an unverifiable application credential;
**[NEW]** ensure gateway tests remain gating while the service is alive.

**Tests.** **Every gate must be demonstrated failing on a deliberately bad fixture, or it is decoration.**

**Exit criteria.**

- [ ] Every gate proven to fail on a bad fixture
- [ ] **Canary secret test proves secret scanning detects an unverifiable app credential** (the Phase -1 lesson)
- [ ] Rust tested, linted, audited
- [ ] Coverage enforced and ratcheting
- [ ] Dependency audit at `high`
- [ ] E2E covers the 5 critical paths
- [ ] Graph quality validated

**Complexity.** Medium (2 weeks).

**Must not combine with.** Feature work.

---

## Phase 12 — Documentation and Public-Claim Reconciliation _(widened)_

**Changes in Rev 2:** the claim register must now include **architecture/topology claims**, which the audit
proved wrong.

### Claims unsupported by implementation

| #   | Claim                                   | Reality                                                                         | Restorable after            |
| --- | --------------------------------------- | ------------------------------------------------------------------------------- | --------------------------- |
| 1   | "GraphRAG-grounded advisor"             | Flag-off; advisor receives `[]`                                                 | 5C/5D + 8                   |
| 2   | "Graph traversal / semantic retrieval"  | No traversal in either tier                                                     | 5C                          |
| 3   | "Hybrid retrieval"                      | core-api concatenates; **gateway does RRF but is unreachable**                  | 5D                          |
| 4   | "Multi-model orchestration"             | Coded, flag-off                                                                 | When enabled + measured     |
| 5   | "Multi-agent"                           | Playbooks on one prompt                                                         | **Rephrase — do not claim** |
| 6   | "Semantic life graph" (read capability) | Write side real; read side does not traverse                                    | 5C + 6                      |
| 7   | "Enterprise-ready"                      | No RBAC, no DSR workflow, no SOC2/HIPAA posture                                 | Long-term                   |
| 8   | Prompt 6.2.0 behavior                   | Never validated live                                                            | 8                           |
| 9   | **[NEW]** Documented service topology   | `docs/archive/` says web→api-gateway; reality is web→core-api, gateway orphaned | Phase 5A + retirement       |
| 10  | **[NEW]** "Central knowledge layer"     | Exists in stores + gateway code; **no reachable reader**                        | 5A disposition              |

**Proposed changes.** Claim register as source of truth; rewrite the 50-line README; triage 1,042 docs into
`current/ archive/ design/` with dated status headers; **[NEW] publish an accurate topology diagram** (source:
`API_RUNTIME_AND_OWNERSHIP_MAP.md`); rule: **no capability claim without a linked test**.

**Exit criteria.**

- [ ] Every register claim tagged and either test-backed or removed
- [ ] README rewritten
- [ ] Docs triaged with status headers
- [ ] CI enforces claim-to-test linkage
- [ ] **Topology documentation matches deployed reality**
- [ ] Zero UNSUPPORTED claims in user-facing docs

**Complexity.** Medium (1.5–2 weeks).

**Must not combine with.** Nothing — but must not run early.

---

## Phase 13 — Final Production-Readiness Audit

**Changes in Rev 2:** adds topology and ownership verification.

**Process.** Independent re-audit on the original rubric; adversarial reproduction of the top-5 defects (a
defect is closed only when reproduction **fails**); external pen test (tenant isolation, injection, share
tokens, **and all public surfaces**); load test at target capacity; **timed restore drill**; claim audit;
**[NEW] topology audit** — enumerate every deployed service and confirm each is intentional, reachable,
and owned.

**Exit criteria.**

- [ ] Independent re-audit complete on the original rubric
- [ ] All 5 highest-risk defects fail reproduction
- [ ] Pen-test criticals/highs resolved
- [ ] Restore drill executed with measured RTO
- [ ] 100% of claims independently verified
- [ ] **No orphaned or undocumented deployed service exists**
- [ ] **Explicit written go/no-go for real user data**

**Complexity.** Medium (2 weeks + external scheduling).

---

## Cross-Phase Exit Criteria (Program-Level)

The program is **not complete** until all five hold simultaneously: **[NEW]**

1. **One authoritative public API contract** — a single documented, versioned, generated-client contract;
   no hand-maintained duplicate; every public surface accounted for.
2. **One authoritative GraphRAG orchestration contract** — exactly one owner, one implementation, one
   versioned contract; no second live implementation.
3. **No conflicting tenant-context derivation** — the four models reconciled or explicitly bounded and
   documented; no path derives tenant from anything but a verified credential.
4. **No undocumented service-role access** — exactly one holder, allowlisted call sites, CI-enforced,
   grep-provable.
5. **Traceable request flow across service boundaries** — a single correlation ID followable from browser
   through every hop to datastore and back, demonstrated end to end.

---

## Revised Highest-Risk Defects

| #     | Defect                                                                                                                                                                     | Change                         | Phase                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------- |
| **1** | **Tenant isolation by convention, across a larger-than-assessed surface** — 117 unscoped sites, two service-role holders, four tenant models, worker propagation unaudited | **Escalated** (surface grew)   | 1                         |
| **2** | **No prompt-injection defense on five mutation-capable paths**                                                                                                             | **Escalated** (1 path → 5)     | 3                         |
| **3** | **Orphaned live public service holding service-role credentials** — `api-gateway`, reachable, authenticating, unmonitored, unowned                                         | **[NEW]**                      | 1 (revoke) → 5A (dispose) |
| **4** | **No observability / silent failure**, now across five compute surfaces with shallow health checks                                                                         | **Escalated**                  | 9                         |
| **5** | **No rate limiting on two public API surfaces**; governance sits only in the web tier                                                                                      | **Escalated** (1 → 2 surfaces) | 1 / 9                     |

_Dropped from the top 5: config drift (still real, still Phase 2 — but the orphaned-service finding
outranks it)._

## Revised Highest-Leverage Improvements

| #     | Improvement                                                      | Effort    | Why                                                                                                              |
| ----- | ---------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------- |
| **1** | **Revoke the gateway's service-role credential**                 | **Hours** | Halves the service-role blast radius immediately, independent of every other decision. Highest ratio in the plan |
| **2** | **Connection pooling + startup config assertions, all runtimes** | 1.5 wks   | Latency on every request; kills a silent-corruption class in three runtimes                                      |
| **3** | **Phase 5A ownership decision**                                  | 1 wk      | Unblocks the entire AI track and prevents a third implementation                                                 |
| **4** | **Retrieval eval on the production path**                        | 2–2.5 wks | Converts the AI track from opinion to measurement; also supplies 5A's evidence                                   |
| **5** | **Scoped accessor + CI guard**                                   | 4–5 wks   | Convention → mechanism, reusing a proven in-repo pattern                                                         |

_Claim reconciliation drops to #6 — still cheap, still valuable._

## Revised Execution Sequence

```
Phase -1  Credential incident                      ✅ COMPLETE (residuals → Phase 0)
Phase 0   Baseline + claim freeze + verification    [4d + 7d observation]   ← START
          ↳ day 1: trigger `gcloud auth application-default login` (Phase 8 lead time)
          ↳ day 1: revoke gateway service-role credential (leverage #1)
Phase 2   Config + connection integrity, ALL runtimes        [1.5w]
Phase 1   Tenant isolation, ALL tiers + jobs                 [4-5w]
Phase 3   Untrusted content, ALL mutation paths              [2.5w]
Phase 9   Observability + deep readiness                     [3w]
Phase 4   Retrieval evaluation (production path, BOTH impls) [2-2.5w]
Phase 8a  Live prompt eval                                   [2d, parallel from day 1]
──────────── 🚧 GATE ────────────
Phase 5A  GraphRAG ownership + contract  ← BLOCKS 5B-D, 6    [1w]
──────────────────────────────────
Phase 5B  Query planning + entity linking                    [2-3w]
Phase 5C  Bounded traversal                                  [3w]
Phase 5D  Fusion + reranking (harvest RRF)                   [2w]
Phase 7   Declared figures                                   [4w]  (serialize vs 3, 5B-D — prompt)
Phase 6   Graph integration + ER + central disposition       [3-4w]
Phase 8   AI regression evaluation + gating                  [2w]
Phase 10  Performance + scalability                          [3w]
Phase 11  Testing + CI enforcement (+ canary secret)         [2w]
Phase 12  Documentation + claims + topology                  [1.5-2w]
Phase 13  Independent re-audit                               [2w]
```

**Total: ~36–42 weeks single-engineer** (Rev 1: 30–36). The increase is real scope discovered by the audit,
not padding: wider Phases 1/2/3/9, the new 5A gate, and 5B/5C as distinct stages.

**Security track alone (-1, 0, 2, 1, 3, 9): ~11–13 weeks** and delivers the production-readiness unblock
independently of every AI decision.

## Revised Rollback Boundaries

| Boundary                      | Tag                                     | Reversible?                                              |
| ----------------------------- | --------------------------------------- | -------------------------------------------------------- |
| Before tenant migration       | `pre-tenant-isolation`                  | ✅ per-router                                            |
| Before pooling                | `pre-connection-pooling`                | ✅ trivial                                               |
| Before injection defense      | `pre-injection-defense`                 | ✅ flag                                                  |
| Before query planning         | `pre-query-planning`                    | ✅ flag                                                  |
| Before traversal              | `pre-traversal`                         | ✅ flag                                                  |
| Before fusion v2              | `pre-fusion-v2`                         | ✅ flag                                                  |
| Before declared figures       | `pre-declared-figures`                  | ✅ shadow mode                                           |
| Before caching                | `pre-caching`                           | ✅ kill switch                                           |
| **Before gateway retirement** | `pre-gateway-retirement`                | ⚠️ **network cut ✅ / scale-zero ✅ / delete+revoke ❌** |
| **Before entity resolution**  | `pre-entity-resolution` + tested backup | ❌ **restore only**                                      |

**Two irreversible points: gateway credential revocation + deletion, and entity-resolution merges.**
Everything else is a flag or a scale command.

## Riskiest Migrations (revised)

1. **Entity-resolution merges** (Phase 6) — destructive, rollback = restore. **Test the restore first.**
2. **Gateway retirement** (post-5A) — irreversible at credential revocation. Requires 0-traffic evidence +
   410 shim + live replacement.
3. **RLS enforcement per table** (Phase 1) — dormant-and-wrong policies begin being enforced.
4. **Declared-figures invariant flip** (Phase 7 step 4) — affects innocent numerals.
5. **[NEW] Central-store disposition** (5A/6) — deleting `ln_central` or the `central` Neo4j DB is
   irreversible and their contents are currently unknown.

---

## Changes to Prior Scores

| Dimension               | Rev 1               | Rev 2   | Reason                                                                                                                                    |
| ----------------------- | ------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Architecture            | 6.5                 | **5.8** | Three public surfaces, one orphaned-but-live, duplicated auth + retrieval, four tenant models                                             |
| Code Quality            | 6.5                 | **6.3** | Gateway code is good; system-level duplication is a quality defect                                                                        |
| Security                | 5.0                 | **4.5** | Two service-role holders, two undefended public surfaces, CORS `*` confirmed, fail-open edge, plus a real (contained) credential incident |
| AI Architecture         | 6.0                 | **6.2** | RRF + central retrieval genuinely exist — better code than assessed, but orphaned                                                         |
| GraphRAG                | 4.0 (DD) / 3.0 (AI) | **3.5** | Fusion + central exist; still no traversal; still unreachable                                                                             |
| Frontend                | 6.5                 | **6.3** | Fail-open edge auth                                                                                                                       |
| Backend                 | 7.0                 | **6.8** | More backend than assessed, but duplicated                                                                                                |
| Infrastructure          | 6.0                 | **5.5** | Five deploy targets, one serving no traffic, shallow health checks                                                                        |
| Performance             | 4.5                 | **4.5** | Unchanged                                                                                                                                 |
| Developer Experience    | 5.5                 | **5.3** | Two API surfaces to reason about, no generated client                                                                                     |
| Enterprise Readiness    | 3.0                 | **3.0** | Unchanged                                                                                                                                 |
| Production Readiness    | 5.5                 | **5.0** | Orphaned live service, fail-open edge, shallow readiness                                                                                  |
| Originality             | 6.0                 | **6.0** | Unchanged                                                                                                                                 |
| Documentation           | 5.0                 | **4.5** | Topology docs actively wrong, not merely stale                                                                                            |
| Maintainability         | 5.0                 | **4.5** | Duplicated auth + retrieval already diverging                                                                                             |
| Technical Difficulty    | 7.0                 | **7.0** | Unchanged                                                                                                                                 |
| **Overall Engineering** | **6.2**             | **5.9** |                                                                                                                                           |

## Changes to Hiring and Production-Readiness Conclusions

**Hiring: UNCHANGED — Yes, at Senior; Staff arguable; not Principal.** The evidence moved in both
directions and roughly cancels:

- **Positive:** the gateway is _well-written_ — required-kwarg tenant enforcement, a Cypher guard refusing
  untenanted queries, `response_model` validation, and real RRF. In several respects it is **better** than
  the code in the authoritative tier. That is a genuine engineering signal.
- **Negative:** leaving a credentialed, internet-reachable service running with zero callers for an unknown
  period, while documentation still described it as the entry point, is an **operational-discipline** miss.
  Combined with a committed credential that lived 30 days, the pattern is _builds well, operates loosely_ —
  which is precisely the Senior-vs-Principal distinction.

**Production readiness: DOWNGRADED. Still NO-GO for real financial/health data, now with one additional
blocker.** Rev 1 listed two (RLS bypass, injection). Rev 2 adds a third: **an orphaned, live, public,
credential-holding service must be either owned or retired before go-live.** The gateway's service-role
credential should be revoked in the first week regardless of the retirement decision — it has no Supabase
usage, so revocation costs nothing and halves the service-role blast radius.

---

## Prompt / Workstream Validity

### Remain valid unchanged

- **Phase -1 credential containment** — complete; residuals tracked.
- **`ARCHITECTURE_REVIEW.md`** — scalability findings (pooling, single-box, no caching, no load test) are
  unaffected by the gateway correction and all still hold.
- **`SECURITY_AUDIT.md`** HIGH-1 (RLS), HIGH-2 (injection), HIGH-3 (rate limiting), and the "done
  correctly" section (JWT, share tokens, XSS, LLM08) — all confirmed.
- **`NUMERIC_PROVENANCE_SPEC.md`** and Phase 7 — untouched by the topology correction.
- **Phase 4 retrieval-eval design** — strengthened, not invalidated.

### Must be replaced

- **`TECHNICAL_DUE_DILIGENCE.md`** — the service inventory table (`api-gateway` "small / no source"), the
  "two parallel API surfaces" weakness, and "delete or build api-gateway" in the debt list.
- **`AI_SYSTEMS_REVIEW.md`** — §1.2 ("fusion is concatenation, not fusion" as a global claim), the "no
  central knowledge" statement, and the GraphRAG score rationale. **Reissue scoped per tier.**
- **`ARCHITECTURE_REVIEW.md`** §8 Boundaries — "`apps/api-gateway` … no meaningful source."
- **Any prompt asking "which of the two API tiers…"** — the premise is wrong; there are three plus an
  API-key plane plus Edge Functions.

### Must NOT yet be run

- **Any GraphRAG implementation work** (5B, 5C, 5D) — **blocked on the Phase 5A gate**. Running these now
  produces a third implementation.
- **Gateway retirement or deletion** — blocked on 5A harvest + 0-traffic evidence + 410 shim.
- **Git-history rewrite** — blocked on explicit owner approval; recommendation is not to.
- **Entity resolution / merges** (Phase 6) — blocked on 5A and on a _tested_ backup restore.
- **Central-store deletion** — contents unknown; blocked on the 5A inventory.
- **Phase 12 claim restoration** — blocked on the capabilities existing (5C/5D/8).
- **Enabling `GRAPH_GROUNDING_ENABLED` in production** — blocked on Phase 4 measurement.

---

## The First Thing to Do

**Phase 0**, with two day-one actions that do not wait for it:

1. **Revoke the api-gateway's Supabase service-role credential.** It has no Supabase usage. Hours of work,
   halves the service-role blast radius, independent of every architectural decision. Highest
   leverage-to-effort item in this plan.
2. **`gcloud auth application-default login`** — Phase 8's live eval is owner-blocked and has the longest
   lead time of anything here.

Then Phase 2 (fastest defensible win, now across three runtimes), then Phase 1 as the primary
risk-reduction effort. **Do not start any GraphRAG work until Phase 5A is signed off.**
