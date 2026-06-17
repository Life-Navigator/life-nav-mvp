# Integration Security Report

**Sprint:** MCP, Data Submission, Email & Calendar Integration
**Type:** Security audit of the OAuth / token integration surface. Grounded in real code (file:line).
**Method:** READ-ONLY review of OAuth routes, token-storage migrations, encryption helpers, RLS, and a
client-bundle secret scan. No code changed, nothing committed.

---

## Verdict summary

| #   | Item                                                                | Verdict                                |
| --- | ------------------------------------------------------------------- | -------------------------------------- |
| 1   | OAuth client secrets kept server-side only (no `NEXT_PUBLIC_` leak) | **PASS**                               |
| 2   | Provider access/refresh tokens encrypted at rest                    | **PASS**                               |
| 3   | RLS scopes tokens to the owning user / least privilege              | **PASS (service-role-only model)**     |
| 4   | Audit logs for token use                                            | **BLOCKED (missing)**                  |
| 5   | Rotate chat-exposed Supabase PAT + service-role + anon keys         | **BLOCKED (operational, not in repo)** |
| 6   | Google token-save backend endpoint exists                           | **BLOCKED (endpoint not implemented)** |

Overall: **the code is clean and the crypto/secret hygiene is genuinely good.** Two real blockers remain
(credential rotation, missing audit log) plus one functional gap (Google save path). Details below.

---

## 1. OAuth client secrets — server-side only — **PASS**

**Finding:** No client secret, service-role key, or encryption key is exposed to the browser bundle. A scan for
`NEXT_PUBLIC_*SECRET`, `NEXT_PUBLIC_*SERVICE_ROLE`, `NEXT_PUBLIC_*ENCRYPTION` across `apps/web/src` returned
**zero matches**.

Secrets are read only inside server-side route handlers / server libs via `process.env`:

- `GOOGLE_CLIENT_SECRET` — `apps/web/src/lib/integrations/google/oauth.ts:148,318`,
  `apps/web/src/app/api/integrations/oauth/google/route.ts:86,161`.
- `MICROSOFT_CLIENT_SECRET` + `INTEGRATION_ENCRYPTION_KEY` —
  `apps/web/src/app/api/integrations/oauth/callback/microsoft/route.ts:57,62`.
- `SUPABASE_SERVICE_ROLE_KEY` — `oauth/callback/microsoft/route.ts:16` (admin client built server-side only,
  `:14-21`).

The client secret is sent only server→Google in the token-exchange POST body
(`google/oauth.ts:196-202`, `:230-235`) and server→Microsoft (`callback/microsoft/route.ts:74-80`). The browser
never sees it: the hook only opens the auth URL in a popup and listens for a postMessage
(`apps/web/src/hooks/useIntegration.ts:13-50`), with a strict same-origin check
(`useIntegration.ts:29`).

**Residual note (low):** error redirects were hardened to avoid leaking internals — the Google callback
deliberately does NOT put the raw error into the URL (`callback/google/route.ts:122-126`), and Microsoft does
the same (`callback/microsoft/route.ts:145-148`). Good. One inconsistency: provider-supplied
`error_description` IS reflected into the redirect URL on the _authorization-error_ branch
(`callback/google/route.ts:23-28`, `callback/microsoft/route.ts:30-37`) — low risk (it's Google/MS text, not our
secrets) but worth keeping an eye on.

---

## 2. Tokens encrypted at rest — **PASS**

**Finding:** Access and refresh tokens are stored encrypted, not in plaintext.

- Table columns are `BYTEA` ciphertext, not text:
  `access_token_encrypted BYTEA NOT NULL`, `refresh_token_encrypted BYTEA`
  (`supabase/migrations/011_mvp_integrations_auth.sql:15-16`).
- Encryption is AES-256 via pgcrypto `pgp_sym_encrypt(..., 'cipher-algo=aes256, compress-algo=1')`
  (`supabase/migrations/009_mvp_ingestion_pipeline.sql:34`); pgcrypto is installed
  (`009:10`, also `001:10`, `010:10`).
- Encrypt happens inside the write RPC, never client-side:
  `core.upsert_integration_token` calls `core.encrypt_text(p_access_token, v_key)` and conditionally the refresh
  token (`011:108-109`).
- Decrypt happens only inside the read RPC `core.get_integration_token` →
  `core.decrypt_text(t.access_token_encrypted, v_key)` (`051_token_retrieval.sql:40-41`).
- The encryption key is never stored in the DB; it is passed per-call (`p_encryption_key`) or read from
  `app.settings.encryption_key`, and the function HARD-FAILS if absent
  (`011:87-90`, `051:32-35`). The web app sources it from `INTEGRATION_ENCRYPTION_KEY`
  (`callback/microsoft/route.ts:62`).

**Caveats (honest):**

- `pgp_sym_encrypt` is symmetric — security rests entirely on `INTEGRATION_ENCRYPTION_KEY` /
  `app.settings.encryption_key`. If that key leaks, all tokens are decryptable. There is no envelope encryption /
  KMS / per-row key. Acceptable for pilot; note for hardening (auto-memory `gcp-secrets-deferred` — KMS deferred
  post-beta).
- The encrypt/decrypt helpers silently `RETURN NULL` if key or input is empty (`009:30-32, 45-47`). A missing key
  at write time is caught by the RPC guard (`011:88-90`), so this is not a silent-plaintext path — good.

---

## 3. RLS scopes tokens to the owner — **PASS (service-role-only model)**

**Finding:** RLS is enabled and the table is locked down to service-role; end users (anon/authenticated
PostgREST roles) cannot read tokens at all.

- `ALTER TABLE core.integration_tokens ENABLE ROW LEVEL SECURITY;` (`011:27`).
- The only policy grants `FOR ALL TO service_role` (`011:29-31`). There is **no** `authenticated`/`anon` policy,
  so under RLS those roles get nothing — stricter than per-user row filtering.
- Per-user scoping is enforced inside the SECURITY DEFINER RPCs by `WHERE t.user_id = p_user_id`
  (read: `051:48-49`; write upsert keyed on `UNIQUE(user_id, provider)`: `011:21,113`; disconnect:
  `011:185-187`).
- Read/write RPCs are `REVOKE ALL ... FROM PUBLIC` then `GRANT EXECUTE ... TO service_role` only
  (`011:200-206`; `051:54-55,90-91`). The crypto helpers are likewise service-role-only
  (`009:53-56`). The 051 header comment is explicit: _"Service-role only — never expose to client"_ (`051:53`).
- `ON DELETE CASCADE` from `public.profiles(id)` (`011:10`) ensures tokens are purged when a user is deleted.

**Caveat:** because everything runs as service-role, the _application server_ is the trust boundary — it must
always pass the correct `p_user_id`. The web callbacks derive `user_id` from the verified session
(Microsoft: `getUserIdFromJWT(request)` → 401 if absent, `callback/microsoft/route.ts:51-54`; Google init
requires `supabase.auth.getUser()`, `oauth/google/route.ts:19-24`). Correct today, but there is no DB-level
backstop if a future caller passes the wrong id — standard for a service-role design, noted.

---

## 4. Audit logs for token use — **BLOCKED (missing)**

**Finding:** There is **no audit log of token access or use.** `core.get_integration_token`
(`051:6-55`) decrypts and returns tokens with no record of who/when/why. Searched the migrations for a
token-specific audit/access table — none exists (audit infrastructure exists for _other_ domains, e.g.
`039_compliance.sql`, `082_xai_and_trust_layer.sql`, but nothing references `integration_tokens`).

The only timestamps are `created_at` / `updated_at` on the row and `last_sync_at` on `public.integrations`
(`011:19-20,156`), which record _writes_, not _reads/use_.

**Impact:** if the encryption key or service-role key were compromised, there would be no trail of token
decryptions to investigate.

**Remediation:**

- Add a `core.integration_token_access_log` (user_id, provider, token_id, accessed_at, caller, purpose) and
  insert one row inside `core.get_integration_token` before returning.
- Or, at minimum, structured server-side logging at every call site of the read RPC.

---

## 5. Pilot security gate — rotate chat-exposed credentials — **BLOCKED (operational)**

**Finding:** This is the standing pilot blocker and it is **not a repo problem.** The repo scan in
`docs/finish-line/SECURITY_CLEARANCE_REPORT.md` found **no hardcoded secrets** in any tracked file
(`SECURITY_CLEARANCE_REPORT.md:11`) and confirmed the exposed Supabase PAT (`sbp_…`) was only ever in the chat
transcript, never committed (`SECURITY_CLEARANCE_REPORT.md:12`).

The blocker is that credentials exposed _in-session_ must be rotated in the provider dashboards before any
external user is invited (`SECURITY_CLEARANCE_REPORT.md:5,18`). Outstanding items
(`SECURITY_CLEARANCE_REPORT.md:23-26,30-31,39`):

| Credential                    | Action                                                     |
| ----------------------------- | ---------------------------------------------------------- |
| Supabase **PAT** (`sbp_…`)    | Revoke; confirm old PAT returns 401 on the Management API. |
| Supabase **service-role key** | Rotate in Supabase → API; update Fly + Vercel secrets.     |
| Supabase **anon key**         | Rotate alongside; update Vercel/Fly secrets.               |

After rotation: redeploy core-api (Fly) and web (Vercel) so new secrets take effect.
**Verdict stays BLOCKED until rotation is done and verified** (the old PAT returning 401).

---

## 6. Google token-save backend endpoint — **BLOCKED (not implemented)** (functional, found during audit)

**Finding (honest, not asked but material):** the two providers store tokens by **different paths**, and the
Google path is currently broken:

- **Microsoft** writes directly via the service-role Supabase admin client →
  `supabase.rpc('upsert_integration_token', …)` with the encryption key
  (`callback/microsoft/route.ts:105-124`). This is the correct, encrypted-at-rest path. **Works.**
- **Google** does NOT call the RPC. The callback POSTs the raw tokens to the Fly backend at
  `${NEXT_PUBLIC_API_URL}/api/v1/integrations/google/tokens`
  (`callback/google/route.ts:74-88`) — but **no such endpoint exists in core-api**. A grep of
  `apps/lifenavigator-core-api/app/routers` for `integrations` / `google/tokens` /
  `get_integration_token` / `upsert_integration_token` returns nothing.

**Impact:** Google OAuth completes (token exchange + userinfo succeed) but the save call gets a non-OK response
and the user is redirected to `?error=save_failed` (`callback/google/route.ts:90-99`). Google connect is
effectively non-functional, and there is a brief window where a raw Google access token transits in a POST body
to a non-existent endpoint.

**Remediation (sprint):** implement `POST /api/v1/integrations/google/tokens` in core-api that calls
`core.upsert_integration_token` with the server-held encryption key (mirroring the Microsoft RPC call), OR
refactor the Google callback to use the same direct service-role RPC path as Microsoft. Either way the raw token
must never touch a client and must land encrypted via migration `011`'s RPC.

---

## Top risks (ranked)

1. **No token-use audit log (Item 4).** A key/service-role compromise would be undetectable and uninvestigable.
   Highest-value cheap fix.
2. **Credential rotation outstanding (Item 5).** Hard pilot blocker; PAT + service-role + anon keys exposed in
   session must be rotated and verified before any external user.
3. **Single symmetric encryption key, no KMS (Item 2 caveat).** All tokens fall if `INTEGRATION_ENCRYPTION_KEY`
   leaks. Acceptable for pilot; plan envelope encryption / KMS post-beta.
4. **Google save path broken + raw token to a missing endpoint (Item 6).** Functional break plus a small token
   exposure surface; fix before enabling Google connect.
5. **Service-role is the whole trust boundary (Item 3 caveat).** Correct today, but any future caller passing the
   wrong `p_user_id` would cross-leak tokens with no DB-level backstop.

## What is solid (do not regress)

- Encryption at rest (AES-256, pgcrypto), key never in DB, RPC hard-fails without it.
- Strict service-role-only RLS + REVOKE-from-PUBLIC on every token RPC.
- No client-bundle secret leak; client secrets only in server route handlers.
- CSRF state nonce in httpOnly cookies; forced consent; offline access; same-origin postMessage check.
- Internal error messages kept out of redirect URLs.
