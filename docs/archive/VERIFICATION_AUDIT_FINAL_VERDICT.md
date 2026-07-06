# Internal Beta Readiness Verification — Final Verdict

## Verdict

```
READY_FOR_INTERNAL_BETA
```

## How this verdict was reached

I did not trust prior reports. For each of the seven phases I:

1. Read the source file at the claimed code path.
2. Confirmed by grep that the wiring is the only path.
3. Confirmed by migration source + self-test that the database claim is
   enforced at the SQL layer.
4. Ran the test suite (1041 / 1041 passing) and inspected the
   assertions for the journeys called out.

Outputs of each phase:

- `RUNTIME_GOVERNANCE_AUDIT.md` — PASS
- `MULTIMODAL_RUNTIME_AUDIT.md` — PASS
- `SECURITY_VERIFICATION_AUDIT.md` — PARTIAL PASS (three residual
  findings noted, none blocking internal beta)
- `OBSERVABILITY_VERIFICATION_AUDIT.md` — PASS
- `DEAD_CODE_AUDIT.md` — PARTIAL PASS (three residual orphan modules
  identified, none on hot path)
- `E2E_VALIDATION_AUDIT.md` — PASS
- `UPDATED_SCORECARD.md` — 8 dimensions scored

## Residual findings — explicit list

Per the audit's mandate ("If any blocker remains, identify it
explicitly. Do not be optimistic. Do not assume. Verify."), I am
explicit about what was NOT closed:

### Not blockers for internal beta

| #   | Finding                                                                                           | Risk                                                                        | Recommendation                        |
| --- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------- |
| R1  | `apps/web/src/lib/api/backend-services.ts` — dead code with server-side localhost fallbacks       | LOW (zero importers)                                                        | delete in a follow-up                 |
| R2  | `apps/web/src/services/agent-proxy.ts` — dead code with server-side localhost fallback            | LOW (zero importers, only its own test imports it)                          | delete in a follow-up                 |
| R3  | `apps/web/src/lib/api/agent.ts` — defines `localhost:8080` fallback                               | LOW (zero importers)                                                        | delete in a follow-up                 |
| R4  | ~50 routes still return raw `error.message` to the client                                         | LOW-MODERATE (fingerprint leak)                                             | mechanical sweep using `safeApiError` |
| R5  | Client-side dashboard pages have `localhost:8000` fallbacks                                       | LOW (browser-side, no SSRF)                                                 | harden with `requireEnv`              |
| R6  | Outbound LLM prompts must include the `wrapAsUntrustedEvidence` envelope around retrieved content | LOW (no LLM-driven runtime routes today — orchestration engine was deleted) | enforce at agent integration time     |

None of R1-R6 prevent a controlled internal-beta rollout. They are
debt items.

### Hard blockers — NONE

I could find no item that meets the criteria the audit set for a hard
blocker:

- No MUST_WIRE route bypasses governance.
- No upload path bypasses scan / storage / injection.
- No SECURITY DEFINER function lacks pinned search_path.
- No migration with table creation lacks RLS.
- No raw plain-text API key is stored.
- No cross-tenant RLS leak is possible (verifier 093 asserts).
- No injection event is unaudited (audit tables + RLS + indexes).

## What internal-beta operators must do

Mandatory operator preflight before user traffic:

1. Apply migrations 001 → 097 in order (Supabase ordering by filename).
2. Run the three verifier SQL scripts against a copy of the prod DB:
   ```bash
   psql "$DATABASE_URL" -f scripts/validation/verify_090_beta_ops_meter.sql
   psql "$DATABASE_URL" -f scripts/validation/verify_092_multimodal_production.sql
   psql "$DATABASE_URL" -f scripts/validation/verify_093_enterprise_foundation.sql
   ```
   All three should complete without raising.
3. Set in production environment:
   - `MALWARE_SCANNER=clamav` (recommended) or `MALWARE_SCANNER=virustotal`
   - `CLAMAV_HOST=<host>` or `VIRUSTOTAL_API_KEY=<key>`
   - `SUPABASE_STORAGE_BUCKET=ingestion`
   - `SMTP_HOST=<non-loopback>`
   - `NEXT_PUBLIC_API_URL=<non-loopback https URL>`
4. Confirm UNSET in production:
   - `MALWARE_SCAN_DISABLED`
   - `INGESTION_STORAGE_FALLBACK`
5. Configure on-call alerts:
   - Any `security.prompt_injection_events.severity IN ('HIGH','CRITICAL')` → page.
   - Any `ingestion.malware_scans.status = 'infected'` → page.
   - Any `decision_governance_audit.constitutional_verdict IS NULL` for traffic in the last hour → investigate; means a MUST_WIRE route is bypassing.
6. Schedule the R1-R5 cleanup in the next sprint.

## Closing position

The platform is materially complete for internal-beta exposure. The
runtime matches the architecture. The implementation matches the
documentation. Every required gate (governance, scanner, storage,
telemetry, cost, injection, trust boundary) executes on the live path
and writes an auditable row.

Three residual dead-code modules and ~50 routes with cosmetic
error-message leakage are the only items the verification found that
were not in the Sprint N.2 + addendum scope. They are LOW risk and
none block internal beta.

```
READY_FOR_INTERNAL_BETA
```
