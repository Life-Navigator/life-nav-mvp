# Security Clearance Report

**Date:** 2026-06-16 · **Gate status: BLOCKED — operational key rotation required before pilot invitations.**

> The pilot cannot launch until this passes. The codebase itself is clean; the blocker is the rotation of credentials that were exposed **outside** the repo (in chat) and have not yet been rotated.

## 1. Repository credential scan — PASS

Scanned all tracked files for hardcoded secrets (`sbp_` PATs, `service_role`, anon/JWT bodies `eyJ…`, Gemini `AIza…`, `sk-…`, Plaid secrets).

- **No hardcoded secret values** in any tracked file. Every match is a variable name, an env reference (`process.env` / `os.environ` / `getenv` / pydantic `settings`), or a comment placeholder (e.g. `SUPABASE_SERVICE_ROLE_KEY=eyJ...` in `deploy.sh` headers).
- **The exposed Supabase PAT (`sbp_…`) is NOT in the repo** — it appeared only in the chat transcript, never committed.
- **No real `.env` is tracked.** The only tracked `.env` is `apps/mobile/ios/.xcode.env`, which contains just `export NODE_BINARY=$(command -v node)` (standard React-Native file, safe).
- Secrets are sourced correctly at runtime from Fly/Vercel/Supabase secret stores (per the deployment topology), not the repo.

## 2. Operational rotation — REQUIRED (owner: Timothy)

These credentials were exposed in the working session and MUST be rotated in the provider dashboards before any external user is invited:

| Credential                                      | Why                                           | Action                                                                        |
| ----------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------- |
| 🔴 Supabase **Personal Access Token** (`sbp_…`) | Pasted in chat; full Management API access    | Revoke in Supabase → Account → Access Tokens; issue a new one if still needed |
| 🟠 Supabase **service-role key**                | High-privilege; precautionary rotation        | Rotate in Supabase → Project → API; update Fly + Vercel secrets               |
| 🟠 Supabase **anon key**                        | Precautionary rotation alongside service-role | Rotate; update Vercel/Fly secrets                                             |

After rotation, redeploy core-api (Fly) and web (Vercel) so the new secrets take effect, and confirm the old PAT returns 401.

## 3. Verification checklist (run after rotation)

- [ ] Old `sbp_…` PAT revoked (Management API call with it returns 401).
- [ ] Service-role + anon keys rotated; Fly + Vercel secrets updated.
- [ ] core-api (`flyctl deploy`) + web (Vercel) redeployed with new secrets; `/healthz` 200; login works.
- [ ] `git log -p` / secret-scanner confirms no key was committed during this work.
- [ ] Dependabot alerts on the default branch triaged (GitHub reported 22 on push; review the 1 critical / 8 high before pilot).

## 4. Verdict

- **Code: CLEAR.** No exposed credentials in the repository.
- **Operations: BLOCKED** until the three credentials above are rotated and verified.

**This gate remains BLOCKED until Section 2 is completed by the credential owner.** No pilot invitations until then.
