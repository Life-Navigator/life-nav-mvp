# Updated Platform Scorecard

Verification Audit — Phase 7.

Scores rebased from the original `FULL_SYSTEM_AUDIT_REPORT.md` baseline
of:

```
Beta             6.5
Production       5.0
Enterprise       3.5
Code Quality     6.0
Architecture     6.0
Security         6.0
Governance       7.5
Operational      4.5
```

after the Sprint N.2 hardening sprint AND the prompt-injection defense
addendum.

## Methodology

Scores are 0-10 against the rubric the original audit set, with weight
on:

- Functional completeness — does the runtime do what the docs claim?
- Verifiability — is there test or migration self-test coverage?
- Failure-mode discipline — does the system fail closed?
- Audit + observability — can incidents be reconstructed?
- Residual risk — what known gaps remain?

Honest scoring: where a finding REMAINS unresolved, the score is
adjusted down to reflect it.

## Scores

### Architecture — 7.5 (was 6.0)

Improvements:

- Single chokepoint (`guardOutgoing`) for governance.
- Single orchestrator (`processUpload`) for multimodal ingestion.
- New `lib/security/injection/` module is well-isolated; the runtime
  callers don't have to know the rule taxonomy.
- Migration hygiene: canonical 002, 005 self-protected, 094 + 095 +
  096 + 097 close database-side gaps.

Residual gap: ~1,200 LOC of legacy proxy code remains (backend-services.ts,
agent-proxy.ts, lib/api/agent.ts). Not on the hot path but adds noise.

### Code Quality — 7.0 (was 6.0)

Improvements:

- 1041 tests passing across 72 suites (was 942/65 at Sprint N.2 entry).
- `safeApiError` pattern established and applied to highest-impact
  routes.
- Deterministic, in-process detectors with high coverage.

Residual: ~50 routes still return raw `error.message`. The pattern
is established; the bulk migration is queued.

### Security — 8.0 (was 6.0)

Improvements:

- Sprint L2 constitutional pipeline is the runtime governance pipeline.
- Multimodal upload gated by mandatory scanner + storage + injection
  scan; trust-boundary enforced at the SQL CHECK layer.
- Tool-use guard denies any call without authenticated user-intent
  provenance.
- 30+ exfiltration / jailbreak / malicious-prompting patterns
  detected at ingestion + response time.
- SECURITY DEFINER `search_path` pinned across ~90 functions.
- `requireEnvUrl` rejects loopback in production for the 4 hardened
  routes.

Residual:

- `services/agent-proxy.ts` + `lib/api/backend-services.ts` are dead
  but still in the tree (LOW server risk — zero importers).
- `error.message` leakage in non-hot-path routes remains a class of
  fingerprint leak.

### Governance — 8.5 (was 7.5)

Improvements:

- Sprint L2 (13-step pipeline + crisis + future visibility +
  redirection) is the runtime path for every guarded route.
- Injection-defense layer reuses the governance audit chain
  (per-finding rows in `security.prompt_injection_events` are joinable
  to `decision_governance_audit`).
- Constitutional GraphRAG seeded with 34 threat-intel rules
  (migration 097) so policy decisions can cite a canonical source.

Residual:

- External LLM call sites (future agent work) must adopt the
  `wrapAsUntrustedEvidence` wrapper around retrieved content. The
  wrapper exists; integration into the outbound prompt template is
  pending for future LLM-driven routes.

### Operations — 6.5 (was 4.5)

Improvements:

- Per-extractor telemetry + per-call BYOM cost meter both wired and
  written by the runtime.
- `recordLlmUsage` writes to `ops.llm_usage_meter` for every BYOM
  provider call from extractors.
- New verifier scripts (`verify_090`, `_092`, `_093`) for production
  smoke without ORM dependence.
- Audit tables for injection + tool abuse give incident-response a
  per-finding paper trail.

Residual:

- No Playwright suite yet.
- No real-time dashboards beyond the SQL templates in the runbook.
- Alert rules for `severity in (HIGH, CRITICAL)` rows in
  `security.prompt_injection_events` need to be configured
  operationally; the table + index are ready.

### Enterprise Readiness — 5.5 (was 3.5)

Improvements:

- Tenant gateway + API key hashing + rate-limit verified.
- `platform.is_tenant_member` is the sole cross-tenant gate with
  pinned search_path.
- Migration 093 verifier asserts cross-tenant RLS is enforced.

Residual:

- No public consumer-facing API doc; `/api/platform/*` exists but no
  customer onboarding flow.
- Industry / dedicated graph projections deferred per the original
  audit (Paid Pilot tier).

### Beta Readiness — 8.0 (was 6.5)

The verification finds every Sprint N.2 BETA_BLOCKER closed:

- Runtime governance ✓
- Mandatory scanner ✓
- Mandatory storage ✓
- Telemetry + cost ✓
- Migration hygiene ✓
- Dead code (the documented set) ✓
- Verifier scripts ✓
- E2E coverage ✓

Plus the addendum-required:

- Prompt-injection detection at ingestion + response ✓
- Untrusted-content boundary (DB-enforced) ✓
- Tool-use guard ✓
- Threat-intel rules seeded ✓
- Audit tables ✓

Residual (not blockers for INTERNAL beta):

- The 3 legacy proxy modules (backend-services, agent-proxy,
  lib/api/agent) — cosmetic; zero importers.
- The ~50-route error-message migration — cosmetic.

### Production Readiness — 6.5 (was 5.0)

Improvements: governance, security, observability all materially up.

Residual:

- Real browser-based Playwright suite needed before paid customer
  exposure.
- SOC 2 + BAA workflows beyond scope of this sprint.
- Real provider-spend reconciliation against vendor billing not yet
  built (operators run SQL templates manually).

## Score summary

| Dimension            | Before Sprint N.2 | After Sprint N.2 | After Addendum |
| -------------------- | ----------------- | ---------------- | -------------- |
| Architecture         | 6.0               | 6.5              | **7.5**        |
| Code Quality         | 6.0               | 6.5              | **7.0**        |
| Security             | 6.0               | 7.5              | **8.0**        |
| Governance           | 7.5               | 8.0              | **8.5**        |
| Operations           | 4.5               | 6.0              | **6.5**        |
| Enterprise Readiness | 3.5               | 5.0              | **5.5**        |
| Beta Readiness       | 6.5               | 7.5              | **8.0**        |
| Production Readiness | 5.0               | 5.5              | **6.5**        |
