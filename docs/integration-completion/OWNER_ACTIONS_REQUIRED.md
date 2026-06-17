# Owner Actions Required — Integration Completion

**For:** Timothy (credential owner) · **Date:** 2026-06-17 · **Status:** the integration code is
secure and built (see `INTEGRATION_SECURITY_VALIDATION.md`). What remains are **operational actions
only you can perform** — none of these are code changes, and none can be done from inside the repo.

**Do them in order.** Rotation (1–3) and provisioning (4–6) MUST precede applying migrations (7),
because the migrations are gated on the new `INTEGRATION_ENCRYPTION_KEY` / rotated credentials being
live.

Cross-references: `docs/finish-line/SECURITY_CLEARANCE_REPORT.md` (the standing pilot gate),
`docs/integrations-sprint/INTEGRATION_SECURITY_REPORT.md` and
`docs/integrations-sprint/EXECUTIVE_SUMMARY.md` (the full integration audit).

---

## The checklist

- [ ] **1. Rotate the exposed Supabase Personal Access Token (PAT)**
- [ ] **2. Rotate the Supabase service-role key**
- [ ] **3. Rotate the Supabase anon key** (precautionary, alongside service-role)
- [ ] **4. Provision the Google OAuth app** (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` + redirect URIs)
- [ ] **5. Provision the Microsoft OAuth app** (`MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT_ID` + redirect URI)
- [ ] **6. Set all production env vars** (incl. a fresh `INTEGRATION_ENCRYPTION_KEY`) on Vercel + Fly
- [ ] **7. Apply the gated migrations** (`20260616160000_mcp_ingestion.sql` + `20260617120000_integration_audit.sql`) AFTER 1–6, then redeploy

---

## 1. Rotate the exposed Supabase PAT (`sbp_…`)

- **WHY:** the PAT was pasted into a chat session (never committed — repo is clean per
  `SECURITY_CLEARANCE_REPORT.md §1`). A Supabase PAT has **full Management API** access to your
  account/projects.
- **HOW:** Supabase Dashboard → Account → Access Tokens → revoke the exposed token; issue a new one
  only if a tool still needs it. Verify the old token returns **401** on a Management API call.
- **BLAST RADIUS IF SKIPPED:** anyone with the leaked PAT can manage your projects (create/delete
  databases, read config, rotate other keys). **Hard pilot blocker** — no external invites until
  done (`SECURITY_CLEARANCE_REPORT.md §2,§4`).

## 2. Rotate the Supabase service-role key

- **WHY:** high-privilege key that **bypasses RLS** — it is the entire trust boundary for the token
  store (`INTEGRATION_SECURITY_VALIDATION.md` Check 7). Precautionary rotation after the session
  exposure.
- **HOW:** Supabase Dashboard → Project → API → rotate the `service_role` key. Then update the
  `SUPABASE_SERVICE_ROLE_KEY` secret on **both** Fly (core-api) and Vercel (web). Redeploy both.
- **BLAST RADIUS IF SKIPPED:** a compromised service-role key can read/decrypt **every user's
  integration tokens** (it satisfies the only RLS policy, `011:29-31`) and all other tables.

## 3. Rotate the Supabase anon key

- **WHY:** precautionary rotation alongside the service-role key
  (`SECURITY_CLEARANCE_REPORT.md §2`).
- **HOW:** Supabase Dashboard → Project → API → rotate the anon/public key; update
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and any Fly equivalent) and redeploy.
- **BLAST RADIUS IF SKIPPED:** lower (the anon key is RLS-bound and public by design), but rotating
  it closes the loop on the session exposure cleanly.

## 4. Provision the Google OAuth app

- **WHY:** the Google connect flow reads `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` at runtime
  (`lib/integrations/google/oauth.ts`, used by `calendar/events/route.ts:169-170`); without them the
  flow returns honest disconnected states, never fabricated data.
- **HOW:** Google Cloud Console → APIs & Services → Credentials → create an OAuth 2.0 Client (Web).
  Add the **authorized redirect URI**
  `https://<prod-domain>/api/integrations/oauth/callback/google`. Enable the Gmail API and Google
  Calendar API. Copy the client id/secret into env (step 6).
- **BLAST RADIUS IF SKIPPED:** Google email + calendar connect is non-functional; the pages show
  "not connected." No security risk (it fails closed).

## 5. Provision the Microsoft OAuth app

- **WHY:** the Microsoft callback reads `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` /
  `MICROSOFT_TENANT_ID` and **redirects to `?error=oauth_not_configured` if any is missing**
  (`callback/microsoft/route.ts:56-68`). Microsoft is the end-to-end-working provider once creds
  exist.
- **HOW:** Microsoft Entra ID (Azure AD) → App registrations → new registration. Add redirect URI
  `https://<prod-domain>/api/integrations/oauth/callback/microsoft`. Grant delegated Graph scopes
  `Mail.Read`, `Mail.Send`, `Calendars.Read`. Create a client secret. Note the tenant id (or use
  `common`). Copy into env (step 6).
- **BLAST RADIUS IF SKIPPED:** Microsoft email + calendar connect is non-functional. No security
  risk (fails closed).

## 6. Set all production env vars (incl. `INTEGRATION_ENCRYPTION_KEY`)

- **WHY:** tokens are encrypted with `INTEGRATION_ENCRYPTION_KEY`, which is **never stored in the DB**
  and is supplied per-call from env (`callback/microsoft/route.ts:62`, `email/messages/route.ts:155`,
  `calendar/events/route.ts:369`). The token RPCs **hard-fail without it**. Generate a fresh key now
  (do not reuse anything that touched the chat session).
- **HOW:** set on the correct host per the deployment topology (auto-memory `deployment-topology`,
  `gemini-key-fly-backend-only`):
  - **Vercel (web):** `INTEGRATION_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
    `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`, `MICROSOFT_REDIRECT_URI`
    (or rely on `NEXT_PUBLIC_APP_URL`), `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_API_URL`.
  - **Fly (core-api):** the rotated `SUPABASE_SERVICE_ROLE_KEY` and any service config; **do NOT** add
    `GEMINI_API_KEY` to Vercel (LLM is Fly-backend only).
  - Generate the encryption key e.g. `openssl rand -base64 32`. Use the **same** value everywhere it
    decrypts, or existing tokens become unreadable.
  - Redeploy web (Vercel) + core-api (`flyctl deploy`) so new values take effect.
- **BLAST RADIUS IF SKIPPED:** missing encryption key → all token reads/writes fail closed (no
  plaintext fallback, by design); missing OAuth creds → connect flows disabled. If a _wrong/rotated_
  key is set without re-consent, previously stored tokens can't be decrypted (users must reconnect).

## 7. Apply the gated migrations (AFTER 1–6) and redeploy

- **WHY:** two additive migrations are intentionally **held from auto-apply until rotation is done**:
  - `supabase/migrations/20260616160000_mcp_ingestion.sql` — activates live MCP structured-data
    writes (`life.facts`, `life.relationships`, provenance columns + RLS).
  - `supabase/migrations/20260617120000_integration_audit.sql` — the **token-use audit log**
    (`core.integration_audit_log` + `core.log_integration_event` RPC). It stores **no token/secret/
    code/body** (`:13-16`) and the app helper degrades gracefully if the table is absent
    (`lib/integrations/auditLog.ts`), so applying it cannot break working flows.
- **HOW:** after credentials are rotated and live, apply both via your migration path (Supabase CLI
  / dashboard SQL). Confirm `core.integration_audit_log` exists with RLS enabled and
  `core.log_integration_event` is `service_role`-only. Then redeploy web + core-api.
- **BLAST RADIUS IF SKIPPED:** MCP writes stay inert; **token decryptions/uses remain unaudited** —
  a key/service-role compromise would leave no trail to investigate. Applying _before_ rotation would
  encrypt new data under a key you are about to retire.

---

## Definition of done (pilot gate clears when all true)

- [ ] Old `sbp_…` PAT returns **401** on the Management API.
- [ ] Service-role + anon keys rotated; Fly + Vercel secrets updated; both redeployed; `/healthz` 200; login works.
- [ ] Google + Microsoft OAuth apps registered with correct prod redirect URIs; client id/secret in env.
- [ ] Fresh `INTEGRATION_ENCRYPTION_KEY` set on web (and any decrypt host); a test connect → list email/events succeeds.
- [ ] Both gated migrations applied; audit log records a connect/use event; owner-SELECT RLS verified.
- [ ] Google token-persistence fix landed (parallel workstream) so Google connect no longer hits a missing endpoint.
- [ ] Dependabot alerts on the default branch triaged (`SECURITY_CLEARANCE_REPORT.md §3`).
