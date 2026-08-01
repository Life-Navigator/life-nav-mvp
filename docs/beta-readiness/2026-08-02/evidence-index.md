# Evidence Index — beta readiness 2026-08-02

**Candidate SHA:** `e8b0dac4e4417fe58c2dbf2ea291903ec97bbdab`
**Preflight run:** 2026-07-31 (Prompt 0)

Every artifact is written by `scripts/beta/harness/_safe.py::emit()`, which redacts recursively and
**deletes the artifact** if a secret shape survives the pass.

---

## Evidence produced (real, executed)

| Artifact                               | Gate  | Produced   | Result                                                                                          |
| -------------------------------------- | ----- | ---------- | ----------------------------------------------------------------------------------------------- |
| `evidence/smoke/deployed-smoke.json`   | SMOKE | 2026-07-31 | **all four dependencies healthy** — supabase, qdrant, neo4j, gemini true                        |
| `evidence/r5-sha-proof/sha-proof.json` | R-5   | 2026-07-31 | **BLOCKED** — `endpoint_mode_provable: false`; `/version`, `/__version`, `/api/version` all 404 |

## Evidence pending (harness ready, not executed)

| `evidence/r5-sha-proof/sha-proof.json` (rerun) | R-5 | 2026-07-31 | **FAIL against current production** — core-api 404 (no `/version` deployed yet), web 401. Correct behaviour: production predates the release-identity work |

## Prompt 1A additions

| Item                                     | Status                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `release-identity-contract.md`           | ✅ core-api `/version` + web `/api/version`, build-time injection, 503 on missing SHA |
| `candidate-deployment-plan.md`           | ✅ deploy without merging; 8 refusal paths verified                                   |
| `staging-data-strategy.md`               | ✅ Option 3 selected; shared data plane stated plainly                                |
| `credential-revocation-checklist.md`     | ✅ 30 items, due 2026-08-02, names only                                               |
| `scripts/beta/deploy_candidate.sh`       | ✅ dry-run verified, production refused                                               |
| `scripts/beta/apply_migrations.sh`       | ✅ dry-run verified, two flags required for production                                |
| `.github/workflows/deploy-candidate.yml` | ✅ `workflow_dispatch` only, action pinned to SHA                                     |

| Path                            | Gate          | Blocked on                                                     |
| ------------------------------- | ------------- | -------------------------------------------------------------- |
| `evidence/r1-tenant-isolation/` | R-1 **FATAL** | `BETA_SYNTHETIC_{A,B}_{EMAIL,PASSWORD}`, deployed candidate    |
| `evidence/r2-journey/`          | R-2           | synthetic credentials + **a human driver**                     |
| `evidence/r3-reporting/`        | R-3           | migrations M2/M3 applied + deployed candidate                  |
| `evidence/r4-incident-owner/`   | R-4           | **owner decision — not an engineering task**                   |
| `evidence/r6-safety-scenarios/` | R-6           | synthetic credentials + **owner sign-off on the scenario set** |
| `evidence/r7-flag-toggle/`      | R-7           | synthetic credentials + deployed candidate                     |
| `evidence/branch-protection/`   | BP            | `GH_TOKEN` with `administration:write`                         |
| `evidence/allowlist/`           | ALLOW         | `FLY_API_TOKEN`                                                |
| `evidence/flag-state/`          | FLAG          | `FLY_API_TOKEN`                                                |

## Harnesses

| Script                                        | Gate                                  | Runs without credentials               |
| --------------------------------------------- | ------------------------------------- | -------------------------------------- |
| `scripts/beta/harness/_safe.py`               | shared redaction + fail-closed guards | n/a (verified against 7 secret shapes) |
| `scripts/beta/harness/smoke_deployed.py`      | SMOKE                                 | ✅ **yes — executed**                  |
| `scripts/beta/harness/verify_deployed_sha.py` | R-5                                   | ✅ **yes — executed**                  |
| `scripts/beta/harness/r1_tenant_isolation.py` | R-1                                   | ❌                                     |
| `scripts/beta/harness/r2_journey_capture.py`  | R-2                                   | ❌                                     |
| `scripts/beta/harness/r6_safety_scenarios.py` | R-6                                   | ❌                                     |
| `scripts/beta/harness/r7_flag_toggle.py`      | R-7                                   | ❌                                     |

### Safety properties verified 2026-07-31

- `redact()` neutralises: JWTs, `sbp_*`, `vcp_*`, `FlyV1 fm2_*`, `gh[pousr]_*`, postgres URLs,
  `neo4j`/`bolt` URLs, and `authorization|api-key|password|secret|token|cookie` assignments.
- `Authorization` / `Cookie` / `Set-Cookie` / `x-api-key` headers are replaced wholesale, never
  pattern-matched.
- `emit()` re-scans the written file and **deletes it** if any secret shape survived.
- `require_no_service_role()` makes R-1, R-2 and R-6 **exit(2)** if `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_DB_URL` or `SUPABASE_ACCESS_TOKEN` is present — a service-role key would make every
  isolation probe pass vacuously.
- `require_env()` reports **missing names only**, never values.

## Backup / restore points

| Item                                      | Value | Recorded                              |
| ----------------------------------------- | ----- | ------------------------------------- |
| Supabase PITR timestamp before migrations | —     | ❌ **must be captured before M1–M3**  |
| Fly prior release version / image ref     | —     | ❌ **must be captured before deploy** |
| Vercel prior production deployment id     | —     | ❌ **must be captured before deploy** |

**These three are preconditions in `rollback-plan.md §0`. All three are currently unrecorded, and
two of them cannot be recorded without platform tokens.**

## Security incidents referenced

| ID                      | Summary                                                                                                                                   | Status                                                                                                        |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **LN-SEC-2026-0731-01** | 4 production credentials transmitted through chat 2026-07-31 (`FLY_API_TOKEN`, `VERCEL_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `QDRANT_API_KEY`) | **OPEN — rotation required.** Not stored, not written to disk, not used. No repository artifact contains them |
| LN-SEC-2026-0729-02     | production DB password exposed                                                                                                            | rotation previously owed                                                                                      |

## Chain of custody

1. Preflight facts collected from the working tree at `e8b0dac4`, tree clean.
2. Deployment facts collected by unauthenticated HTTP only. **No authenticated request was made. No
   customer data was accessed. No cross-tenant probe was run.**
3. No migration applied. No deploy. No merge. No production change of any kind.
