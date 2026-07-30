# ADR-007 — Secret Management and Credential Incident Closure

**Status:** Proposed · **Date:** 2026-07-30 · **Decision deadline:** immediate (containment already due)
**Owners:** Security · **Reviewers:** Platform Ops, Engineering Lead
**Related findings:** debt D-1 (Critical) · Blocks every write-enabled item in the program

> **Containment is independently authorized and must not wait for approval of this ADR.**
> This ADR documents the permanent operating model and the closure criteria.

---

## Context

Two prior incidents plus one new exposure. `CREDENTIAL_INCIDENT_REPORT.md` (LN-SEC-2026-0729-01) records
a shared synthetic-account password committed as a hardcoded default, contained by rotation on
2026-07-29 with residuals R-1 (sessions not provably revoked) and R-3 (auth logs unreviewed) still open.
A second record (LN-SEC-2026-0729-02) covers a public production DB password with rotation still owed.

## Measured evidence

_Measured facts (this session, 2026-07-30)._

| Credential                  | Delivery             | Scope                                          | State                               |
| --------------------------- | -------------------- | ---------------------------------------------- | ----------------------------------- |
| Fly API token               | **pasted into chat** | **organization-wide** (`/aaa/v1` path, `fm2_`) | **live, exposed**                   |
| Qdrant API key              | **pasted into chat** | `"access":"m"` (manage)                        | **live, exposed**                   |
| Supabase DB password        | repo history         | production                                     | rotation owed (LN-SEC-2026-0729-02) |
| Supabase Management PAT     | —                    | account-wide                                   | rotation owed                       |
| Synthetic account passwords | repo history         | 5 test accounts                                | rotated 2026-07-29; R-1/R-3 open    |

_Measured fact._ `flyctl secrets list -a lifenavigator-core-api` returns 31 secret names including
`SUPABASE_SERVICE_ROLE_KEY`, `NEO4J_PASSWORD`, `GEMINI_API_KEY`, `PLAID_CLIENT_SECRET`. The exposed
**org-scoped Fly token can read all of them**, in every app in the organization.

_Measured fact._ The Qdrant JWT decodes to `{"access":"m", "exp":1786042163}` — manage scope, i.e.
capable of collection deletion, not merely read.

_Design inference._ The Fly token's blast radius is the union of every secret in every Fly app. It
therefore transitively exposes the Supabase service-role key, which is the credential the operating
rules specifically require never to leave the trusted service environment.

_Measured fact (containment performed this session)._ Session credentials were written only to
`<scratchpad>/.secrets/env.sh`, mode `0600`, outside the repository. Verified not repo-relative:
`realpath --relative-to=<repo>` → `../…`. Never echoed to stdout, never written to a repo file, never
committed. Shredded at task end (see Migration plan step 0).

## Problem statement

Credentials are being delivered through channels that create permanent records (chat transcripts, repo
history), and at least one is organization-scoped where a task-scoped credential would suffice.

## Forces and constraints

Containment cannot wait for design approval · revocation must be provable, not assumed · replacement
must not itself be delivered through an exposing channel · legitimate consumers must not break.

## Decision drivers

Blast-radius reduction · provable revocation · least privilege · repeatable rotation.

## Options considered

1. Rotate only the newly exposed credentials.
2. **Rotate all exposed credentials + adopt scoped, short-lived tokens + secret-store delivery.**
3. Rotate and additionally rewrite git history.
4. Accept risk on inert historical values; rotate live ones only.

## Comparative decision matrix

| Criterion            | 1 Minimal | 2 Full + scoping | 3 + history rewrite | 4 Accept |
| -------------------- | --------- | ---------------- | ------------------- | -------- |
| Correctness          | 3         | 5                | 5                   | 2        |
| Security             | 3         | 5                | 5                   | **1 HB** |
| Privacy              | 3         | 5                | 5                   | 2        |
| Tenant safety        | 4         | 5                | 5                   | 3        |
| Semantic fidelity    | —         | —                | —                   | —        |
| Impl. complexity     | 5         | 4                | 1                   | 5        |
| Migration complexity | 5         | 4                | **1 HB**            | 5        |
| Ops complexity       | 5         | 4                | 1                   | 5        |
| Scalability          | 4         | 5                | 3                   | 3        |
| Reversibility        | 5         | 4                | 1                   | 5        |
| Observability        | 2         | 5                | 3                   | 1        |
| Cost                 | 5         | 4                | 1                   | 5        |
| Maintainability      | 2         | 5                | 2                   | 1        |

**Hard blockers.** Option 4: leaving a live org-scoped token exposed is not a risk decision, it is an
open door. Option 3: history rewrite across ~30 branches, every clone, every open PR, and every commit
SHA referenced in docs and telemetry — for values that rotation renders **inert**. It removes a string,
not a risk. The standing recommendation not to rewrite is reaffirmed.

## Decision

**Adopt Option 2.** Rotate everything exposed; replace org-scoped with least-privilege, short-lived
credentials; deliver exclusively through secret stores; never through chat, files, or commit messages.

## Detailed design

**Credential classification:**

| Class             | Example                                       | Delivery                                                                    | Rotation          |
| ----------------- | --------------------------------------------- | --------------------------------------------------------------------------- | ----------------- |
| Service runtime   | `SUPABASE_SERVICE_ROLE_KEY`, `NEO4J_PASSWORD` | Fly secrets only; never extracted                                           | 90d + on incident |
| Deploy automation | `FLY_API_TOKEN`                               | GitHub Actions secret; **deploy-scoped, per-app**                           | 90d               |
| Human diagnostic  | interactive session                           | `flyctl auth login` by the human; **no long-lived token issued to tooling** | per session       |
| Third-party API   | Qdrant, Gemini, Plaid                         | Fly secrets; read-scoped where the provider supports it                     | 90d               |

**Least privilege now:** the Fly token must be **deploy-scoped per app**, not organization-wide.
The Qdrant key must be **read-scoped** for diagnostics; `manage` is reserved for migrations and issued
per-operation.

**Privileged execution rule (reaffirmed):** run reconciliation _inside_ the trusted service
(`flyctl ssh console`), so service-role material stays in process memory. This session complied — the
Neo4j baseline ran in-service and no service-role value was ever read, printed, or stored.

**Revocation proof:** an old credential is closed only when a live authentication attempt is **rejected**
and the result recorded — the standard already set by LN-SEC-2026-0729-01 (`REJECTED (400)` ×5).
Assumed revocation is not revocation.

**Closure sequence — all eight steps, in order, per credential.** Cleanup of local copies is
containment, not closure; only this sequence closes an exposure.

| #   | Step                                                       | Evidence required                       |
| --- | ---------------------------------------------------------- | --------------------------------------- |
| 1   | Revoke the old credential                                  | provider-side confirmation              |
| 2   | Attempt an authenticated operation with the old credential | command + timestamp                     |
| 3   | **Confirm rejection**                                      | recorded rejection response             |
| 4   | Issue a replacement with **reduced scope**                 | scope declaration (per-app / read-only) |
| 5   | Update legitimate consumers via secret stores              | consumer list + change refs             |
| 6   | **Verify each consumer still functions**                   | health/deploy check per consumer        |
| 7   | Inventory logs and other exposure locations                | sweep result, hashed                    |
| 8   | Record closure evidence                                    | signed closure entry                    |

Step 3 is the one that converts belief into fact, and step 6 is the one that prevents a security fix
from becoming an outage. Neither may be skipped.

**CI scanning:** gitleaks runs as a binary (the action never executed); a **canary secret** proves the
scanner detects an unverifiable application credential — the LN-SEC-2026-0729-01 lesson, since
TruffleHog `--only-verified` was blind to exactly that class by design.

**Log and shell-history controls:** credentials never in command arguments; sourced from `0600` files
outside the repo; scratchpad shredded at session end; reports use hashed/redacted identifiers.

## Security implications

Reduces blast radius from organization-wide to per-app-per-purpose.

## Privacy implications

The exposed Fly token transitively reached production personal data via service-role. Rotation is a
privacy obligation, not only a security one.

## Tenant-isolation implications

Indirect but total: service-role bypasses RLS, so its exposure is an isolation failure.

## Data-model / Scalability implications

None.

## Operational implications

Human diagnostics require interactive `flyctl auth login` rather than a shared token. Slight friction,
correct trade.

## Cost implications

None.

## Developer-experience implications

Slower ad-hoc access; a documented emergency-rotation path compensates.

## Migration plan

0. **Immediate containment (authorized, not gated on approval):** shred the scratchpad secret file;
   confirm zero repo occurrences.
1. **Revoke** the exposed Fly org token and Qdrant key (owner-side console/CLI).
2. **Rotate** the Supabase DB password and Management PAT (residual from LN-SEC-2026-0729-02).
3. **Prove** each old credential is rejected; record the evidence.
4. **Inventory** legitimate consumers before issuing replacements.
5. **Issue** least-privilege replacements via secret stores only.
6. **Close** residuals R-1 (session revocation) and R-3 (auth-log review).

## Backfill plan

N/A.

## Compatibility strategy

Inventory consumers (step 4) before revoking anything a running service depends on; the org token is
used by `deploy-fly.yml` and must be replaced there in the same change.

## Rollback strategy

None for revocation — it is intentionally irreversible. Mitigation is the consumer inventory.

## Observability requirements

Credential age dashboard · failed-auth alerting after rotation · CI scanner canary result per run.

## Evaluation plan

Post-incident review; canary test proves scanning works; quarterly rotation drill.

## Falsification criteria

If a legitimate consumer cannot function under least-privilege scoping, the scope model is wrong and
must be widened **explicitly and documented**, never silently.

## Acceptance criteria

All five credential classes rotated · **old credentials proven rejected by live test** · zero
credentials in repo, logs, or shell history · consumer inventory complete · R-1 and R-3 closed ·
canary secret detected by CI.

## Non-goals

Not rewriting git history. Not rotating unrelated credentials.

## Risks accepted

Historical values remain in git history, inert after rotation. Documented and accepted, consistent with
the standing recommendation.

## Residual uncertainty

R-3 — whether any exposed credential was **used** during its exposure window remains unknown until auth
logs are reviewed. This is the largest open question in the incident and cannot be closed by rotation.

## Consequences

Unblocks every write-enabled item in the program. Until closed, no production mutation may proceed.

## Follow-up work

Quarterly rotation drill; secret-store ownership documentation (`docs/deploy/SECRETS.md`).

## Superseded documents

Extends `CREDENTIAL_INCIDENT_REPORT.md`; supersedes the ad-hoc credential handling used in this session.

## Approval record

| Reviewer  | Role         | Verdict | Date |
| --------- | ------------ | ------- | ---- |
| _pending_ | Security     | —       | —    |
| _pending_ | Platform Ops | —       | —    |
