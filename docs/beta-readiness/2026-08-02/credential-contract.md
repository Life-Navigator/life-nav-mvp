# Credential Contract — beta readiness, 2026-08-02

**This document names variables. It contains no values and must never contain one.**

## Rules

1. Every credential is supplied as an **environment variable**, exported in the operator's shell or
   written to a gitignored `.env.local` / `.env`. Verified gitignored: `.gitignore:18 **/.env.local`,
   `apps/web/.gitignore:5 .env*.local`, `apps/lifenavigator-core-api/.gitignore:2 .env`.
2. **Secrets are never pasted into chat, a prompt, a commit message, a doc, or command output.**
3. Every harness in `scripts/beta/harness/` reads from the environment and **redacts on output**.
4. All credentials issued for this exercise are **temporary** and revoked on **2026-08-02**.

---

## ⛔ ACTIVE SECURITY INCIDENT — LN-SEC-2026-0731-01

**Four production credentials were transmitted through the chat channel on 2026-07-31 and are
present in that transcript.** They must be treated as **compromised** and rotated, independent of
whether they were ever used:

| Credential class        | Variable name           | Action               |
| ----------------------- | ----------------------- | -------------------- |
| Fly deploy token        | `FLY_API_TOKEN`         | **REVOKE + REISSUE** |
| Vercel token            | `VERCEL_TOKEN`          | **REVOKE + REISSUE** |
| Supabase management PAT | `SUPABASE_ACCESS_TOKEN` | **REVOKE + REISSUE** |
| Qdrant API key          | `QDRANT_API_KEY`        | **REVOKE + REISSUE** |

They were **not** stored, written to disk, exported, or used. No artifact in this repository contains
them. Rotation is required anyway — exposure, not use, is the trigger.

This is the second credential-exposure event on record (prior: LN-SEC-2026-0729-02, production DB
password). **Confirm that rotation is complete before supplying replacements.**

**Revocation of every credential below is due 2026-08-02 — tracked in `credential-revocation-checklist.md`.**

---

## A0. Release-identity build variables (NOT secrets)

Injected at build time; all are non-sensitive by contract. The four `NEXT_PUBLIC_*` variables are
inlined into the client bundle and are therefore public by construction — nothing sensitive may ever
be added to `releaseIdentityEnv` in `next.config.ts`.

`LN_COMMIT_SHA` · `LN_BUILD_TIME` · `LN_ENVIRONMENT` · `LN_APP_VERSION` ·
`NEXT_PUBLIC_LN_COMMIT_SHA` · `NEXT_PUBLIC_LN_BUILD_TIME` · `NEXT_PUBLIC_LN_ENVIRONMENT` ·
`NEXT_PUBLIC_LN_APP_VERSION`

See `release-identity-contract.md`.

## A. Database migration credentials

| Variable                | Purpose                                       | Environment                     | Scope                                                    |
| ----------------------- | --------------------------------------------- | ------------------------------- | -------------------------------------------------------- |
| `SUPABASE_DB_URL`       | Apply M1–M3; run verification SQL             | staging, then locked production | DDL on `analytics`, `feedback`; direct/pooler connection |
| `SUPABASE_PROJECT_REF`  | Identify the target project                   | staging + production            | identifier, not a secret                                 |
| `SUPABASE_ACCESS_TOKEN` | Management API: backup status, project config | operator local only             | management PAT — **never in CI**                         |

**Never used for synthetic-user probes.**

## B. Supabase backend secret

| Variable                        | Purpose                                                                                                            | Environment                  | Scope              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------- | ------------------ |
| `SUPABASE_SERVICE_ROLE_KEY`     | Server-side identity resolution; the only credential permitted to write `feedback.*` and `analytics.advisor_turns` | core-api server runtime only | full bypass of RLS |
| `SUPABASE_URL`                  | Project endpoint                                                                                                   | server + client              | public             |
| `NEXT_PUBLIC_SUPABASE_URL`      | Browser client endpoint                                                                                            | web build                    | public             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser anon client                                                                                                | web build                    | anon, RLS-bound    |

**`SUPABASE_SERVICE_ROLE_KEY` must never appear in `NEXT_PUBLIC_*`, in client bundles, or in any
harness that simulates a user.** Prompt 1's diff review checks for exactly this.

## C. Synthetic-user credentials

| Variable                    | Purpose           | Environment                 | Scope              |
| --------------------------- | ----------------- | --------------------------- | ------------------ |
| `BETA_SYNTHETIC_A_EMAIL`    | Tenant A identity | staging + locked production | ordinary beta user |
| `BETA_SYNTHETIC_A_PASSWORD` | Tenant A auth     | "                           | ordinary beta user |
| `BETA_SYNTHETIC_B_EMAIL`    | Tenant B identity | "                           | ordinary beta user |
| `BETA_SYNTHETIC_B_PASSWORD` | Tenant B auth     | "                           | ordinary beta user |

> ### ⚠ MANDATORY
>
> **Synthetic-user probes MUST NOT use a service-role credential.**
>
> R-1 exists to prove that _the API's identity resolution_ prevents cross-tenant disclosure. A
> service-role key bypasses RLS entirely and would make every probe pass vacuously — a green result
> that is green because the check was disabled. The tenant-isolation harness authenticates as a real
> user via the public anon flow and holds **only** that user's JWT. It fails closed if
> `SUPABASE_SERVICE_ROLE_KEY` is present in its environment.
>
> This matters more here than usual: `feedback.advisor_response_reports` is `service_role`-only with
> `USING (true)` (finding M2-2), so the database provides **no** defense-in-depth. The API is the
> only guard, and the probe must therefore exercise the API as a user.

Both accounts must be seeded with **materially different** data (different persona, different
domains populated) so that leakage is detectable rather than coincidentally absent.

Requires `PRIVATE_BETA_ALLOW_SYNTHETIC_DOMAIN` and both addresses in `PRIVATE_BETA_ALLOWED_EMAILS`.

## D. Fly deployment token

| Variable        | Purpose                                                         | Environment                            | Scope                                                        |
| --------------- | --------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------ |
| `FLY_API_TOKEN` | Deploy candidate; read deployed image/SHA; set flags; read logs | operator local + GitHub Actions secret | **deploy-scoped app token**, not an org-admin personal token |

Per-app tokens preferred (`lifenavigator-core-api`, `lifenavigator-api-gateway`, worker). Memory
records the current token as a personal stopgap that must be swapped.

## E. Vercel deployment token

| Variable            | Purpose                                                  | Environment    | Scope                              |
| ------------------- | -------------------------------------------------------- | -------------- | ---------------------------------- |
| `VERCEL_TOKEN`      | Read deployment + commit SHA; create a protected preview | operator local | **project-scoped**, not team-admin |
| `VERCEL_PROJECT_ID` | Target project                                           | operator local | identifier                         |
| `VERCEL_ORG_ID`     | Target scope                                             | operator local | identifier                         |

Git-integration deploys are preferred over token deploys where possible.

## F. GitHub fine-grained token

| Variable   | Purpose                                                                         | Environment    | Scope                                                                                                       |
| ---------- | ------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------- |
| `GH_TOKEN` | Open the release PR; read check runs; **configure branch protection / ruleset** | operator local | fine-grained, this repo only: `contents:read`, `pull_requests:write`, `checks:read`, `administration:write` |

**`administration:write` is required and is the whole point** — branch protection (B-17) cannot be
set without it. **Currently absent: this is why Prompt 0 could not read branch-protection state.**

## G. Neo4j read-only credentials

| Variable         | Purpose                      | Environment    | Scope         |
| ---------------- | ---------------------------- | -------------- | ------------- |
| `NEO4J_URL`      | Aura endpoint (Query API v2) | operator local | endpoint      |
| `NEO4J_USER`     | Read-only role               | operator local | **read-only** |
| `NEO4J_PASSWORD` | Auth                         | operator local | **read-only** |

Used for ANOM-1 (17-tenant Neo4j/Qdrant divergence) and golden-set construction. **Not required for
the beta launch path.** Read-only enforces I-1 (the Rust worker is the only graph writer).

## H. Qdrant read-only credentials

| Variable         | Purpose          | Environment                       | Scope                                     |
| ---------------- | ---------------- | --------------------------------- | ----------------------------------------- |
| `QDRANT_URL`     | Cluster endpoint | operator local + core-api runtime | endpoint                                  |
| `QDRANT_API_KEY` | Auth             | operator local                    | **read-only key preferred** for audit use |

Note: the key exposed in LN-SEC-2026-0731-01 carried `"access":"m"` (read-write). The audit
replacement should be a read-only key; the runtime key is separate.

## I. Vertex ADC — owner-local only

| Mechanism                               | Purpose                                | Environment                  | Scope      |
| --------------------------------------- | -------------------------------------- | ---------------------------- | ---------- |
| `gcloud auth application-default login` | Advisor model auth for re-benchmarking | **owner's workstation only** | user ADC   |
| `GOOGLE_CLOUD_PROJECT`                  | Target project                         | owner local                  | identifier |

**Cannot be delegated.** The organisation disallows API keys, so this requires an interactive
browser login by the owner. Run it yourself with `! gcloud auth application-default login`.

**Not required for the beta launch path** — advisor re-benchmarking is quality work, not a gate.

---

## Missing right now — blocking

| Variable                                                                       | Blocks                                                       |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `GH_TOKEN`                                                                     | **Prompt 1 entirely** — branch protection, PR, check capture |
| `SUPABASE_DB_URL`, `SUPABASE_PROJECT_REF`                                      | Migration application + verification SQL                     |
| `BETA_SYNTHETIC_A_EMAIL` / `_PASSWORD`, `BETA_SYNTHETIC_B_EMAIL` / `_PASSWORD` | **R-1 and R-2**                                              |
| `FLY_API_TOKEN` (reissued)                                                     | Deployed API SHA proof; staging deploy                       |
| `VERCEL_TOKEN` (reissued)                                                      | Deployed web SHA proof                                       |

## Missing — non-blocking for beta

`NEO4J_*`, `QDRANT_*` (ANOM-1, golden set), Vertex ADC (re-benchmark).
