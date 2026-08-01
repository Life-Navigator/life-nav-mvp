# Credential Revocation Checklist — **DUE 2026-08-02**

**Every credential issued for this beta-readiness effort is temporary and must be revoked on
2026-08-02.** This checklist names environment variables. **It contains no values and never may.**

The operator created these deliberately as short-lived, narrowly scoped credentials for this
exercise. That was the right call — the obligation it creates is that they actually get revoked.

---

## 1. Revoke — platform tokens

| #   | Variable name           | Where to revoke                                              | Done |
| --- | ----------------------- | ------------------------------------------------------------ | ---- |
| 1   | `FLY_API_TOKEN`         | Fly.io → Account → Access Tokens                             | ☐    |
| 2   | `VERCEL_TOKEN`          | Vercel → Settings → Tokens                                   | ☐    |
| 3   | `SUPABASE_ACCESS_TOKEN` | Supabase → Account → Access Tokens                           | ☐    |
| 4   | `GH_TOKEN`              | GitHub → Settings → Developer settings → Fine-grained tokens | ☐    |
| 5   | `QDRANT_API_KEY`        | Qdrant Cloud → Cluster → API Keys                            | ☐    |

## 2. Revoke — data-plane credentials

| #   | Variable name               | Action                                                               | Done |
| --- | --------------------------- | -------------------------------------------------------------------- | ---- |
| 6   | `SUPABASE_SERVICE_ROLE_KEY` | Rotate **only if** it was exposed or used outside the server runtime | ☐    |
| 7   | `SUPABASE_DB_URL`           | Rotate the database password; update Fly secrets                     | ☐    |
| 8   | `NEO4J_PASSWORD`            | Rotate if a read-only audit credential was issued                    | ☐    |

## 3. Retire synthetic beta accounts

| #   | Item                                                   | Action                                                                      | Done |
| --- | ------------------------------------------------------ | --------------------------------------------------------------------------- | ---- |
| 9   | `BETA_SYNTHETIC_A_EMAIL` / `BETA_SYNTHETIC_A_PASSWORD` | Revoke invite; remove from `PRIVATE_BETA_ALLOWED_EMAILS`                    | ☐    |
| 10  | `BETA_SYNTHETIC_B_EMAIL` / `BETA_SYNTHETIC_B_PASSWORD` | Same                                                                        | ☐    |
| 11  | Synthetic rows                                         | Run `scripts/beta/cleanup_and_verify_first5.sql` scoped to the two user ids | ☐    |
| 12  | Synthetic graph/vector data                            | Delete Neo4j nodes and Qdrant points by `tenant_id`                         | ☐    |

## 4. Destroy temporary infrastructure

| #   | Item                                                       | Action                                                                 | Done |
| --- | ---------------------------------------------------------- | ---------------------------------------------------------------------- | ---- |
| 13  | Fly app `lifenavigator-core-api-candidate`                 | `scripts/beta/deploy_candidate.sh --env staging --sha <sha> --destroy` | ☐    |
| 14  | Vercel preview deployments                                 | Expire naturally, or delete explicitly                                 | ☐    |
| 15  | GitHub Actions secrets used only by `deploy-candidate.yml` | Remove if not needed by `deploy-fly.yml`                               | ☐    |

## 5. ⛔ Mandatory regardless of outcome — LN-SEC-2026-0731-01

Four production credentials were transmitted through the chat channel on 2026-07-31 and are present
in that transcript. **They are compromised by exposure, not by use.**

| #   | Variable name           | Status                                                 | Done |
| --- | ----------------------- | ------------------------------------------------------ | ---- |
| 16  | `FLY_API_TOKEN`         | **ROTATE — exposed**                                   | ☐    |
| 17  | `VERCEL_TOKEN`          | **ROTATE — exposed**                                   | ☐    |
| 18  | `SUPABASE_ACCESS_TOKEN` | **ROTATE — exposed**                                   | ☐    |
| 19  | `QDRANT_API_KEY`        | **ROTATE — exposed** (carried read-write `access:"m"`) | ☐    |

They were **not** stored, written to disk, exported, or used, and no artifact in this repository
contains them — verified by secret scan on every generated file. Rotation is required anyway.

**Prior incidents:** LN-SEC-2026-0729-02 (production DB password) — confirm that rotation completed.

## 6. Verify revocation actually took effect

Do not tick these from intent. Confirm each token is **rejected**:

| #   | Check                                    | Expected                        | Done |
| --- | ---------------------------------------- | ------------------------------- | ---- |
| 20  | `flyctl apps list` with the old token    | auth failure                    | ☐    |
| 21  | `vercel ls` with the old token           | auth failure                    | ☐    |
| 22  | Supabase Management API with the old PAT | 401                             | ☐    |
| 23  | GitHub API with the old token            | 401                             | ☐    |
| 24  | Qdrant with the old key                  | 401/403                         | ☐    |
| 25  | Synthetic account login                  | rejected — not on the allowlist | ☐    |

## 7. Post-revocation state

| #   | Confirm                                                            | Done |
| --- | ------------------------------------------------------------------ | ---- |
| 26  | Production still healthy: `/readyz` all four dependencies true     | ☐    |
| 27  | Production still healthy: `/version` returns the expected SHA      | ☐    |
| 28  | `deploy-fly.yml` still holds valid GitHub secrets for real deploys | ☐    |
| 29  | No `.env` / `.env.local` remains on the operator workstation       | ☐    |
| 30  | Revocation completion recorded in `evidence-index.md`              | ☐    |

---

**Owner:** _(unassigned — this is R-4, still open)_
**Due:** **2026-08-02**
**Rule:** revocation is not complete until section 6 is ticked from observed failures, not intent.
