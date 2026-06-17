# Integration Security Validation

**Sprint:** Integration Completion · **Date:** 2026-06-17 · **Method:** READ-ONLY review of the
integration token surface (OAuth callbacks, email/calendar routes, integration libs, token-storage
migrations, RLS, client-bundle scan). No code changed, nothing committed. Every claim is grounded in
real source (`file:line`).

> Two items are being landed THIS sprint by a parallel workstream — a **Google token-persistence
> fix** and a **token-use audit log**. Where they are relevant below they are marked **in progress
> this sprint** and the security PRINCIPLE is validated against the code as it stands. The audit-log
> migration and its app helper are already present on disk (untracked); the Google save endpoint is
> still missing in core-api.

---

## Verdict summary

| #   | Check                                            | Verdict  |
| --- | ------------------------------------------------ | -------- |
| 1   | No token printed to console / server logs        | **PASS** |
| 2   | No token in client state / client bundle         | **PASS** |
| 3   | No token left in the URL after callback handling | **PASS** |
| 4   | No token committed to the repo                   | **PASS** |
| 5   | Encrypted storage only (BYTEA + pgp_sym_encrypt) | **PASS** |
| 6   | RLS enforced on the token store                  | **PASS** |
| 7   | Service role used only server-side               | **PASS** |

**Overall verdict: PASS — the integration token surface is secure by design.** All seven security
principles hold in the code as written. The two sprint-parallel changes (Google persistence + audit
log) extend coverage but do not gate the security posture: the audit-log helper degrades gracefully,
and the missing Google endpoint is a _functional_ gap (Google connect fails closed to an honest
error), not a token-exposure one. The only remaining BLOCKERs are operational (credential rotation,
OAuth provisioning) and are tracked in `OWNER_ACTIONS_REQUIRED.md`, not in this validation.

---

## 1. No token printed to console / in server logs — **PASS**

Grepped every `console.*` / `logger.*` call across the OAuth callbacks, the email/calendar routes,
and the integration libs. **No call passes a token, refresh token, auth code, secret, or encryption
key as an argument.**

Full inventory of log calls in the surface (only the Google callback logs at all in the OAuth path):

- `oauth/callback/google/route.ts:22` — `console.error('Google OAuth error:', error, errorDescription)`
  → logs the provider error **code** and description, not a token.
- `oauth/callback/google/route.ts:41` — `console.error('OAuth state mismatch', { received, stored })`
  → logs the CSRF **state nonce** (not a token); a deliberate security signal.
- `oauth/callback/google/route.ts:92` — `console.error('Failed to save Google tokens:', errorData)`
  → `errorData` is the **backend's JSON error response** (`saveResponse.json()`, `:91`), not the
  token being saved.
- `oauth/callback/google/route.ts:121` — `console.error('Google OAuth callback error:', err)`
  → logs the caught exception; an inline comment (`:122-123`) documents that the message is kept out
  of the redirect URL precisely because it "can contain provider tokens."
- `oauth/callback/microsoft/route.ts` — **zero** `console.*` calls; errors are swallowed and turned
  into an opaque `?error=exchange_failed` redirect (`:145-148`).
- `lib/integrations/google/oauth.ts`, `google/gmail.ts`, `google/calendar.ts`, `email-providers.ts`
  — **zero** `console.*` / `logger.*` calls.
- The only other logs in the wider integration tree are Plaid (`plaid/exchange/route.ts:61`,
  `plaid/link-token/route.ts:26`, `plaid/activate-persona/route.ts:143,165,178,197,264`) and
  `plaid/persist.ts:151` — all log error messages / counts, never the Plaid access token.

**In progress this sprint:** the audit helper `apps/web/src/lib/integrations/auditLog.ts` writes
WHO/WHAT/success to a DB table, not stdout, and runs a forbidden-key scrubber that drops any field
matching `token`, `secret`, `code`, `key`, `authorization`, `bearer`, `body`, etc.
(`auditLog.ts:61-78`, `isForbiddenKey` `:80-83`, `scrubContext` `:88-105`). It therefore upholds this
principle by construction.

## 2. No token in client state / client bundle — **PASS**

- A scan for any `NEXT_PUBLIC_*` env that exposes a secret/token to the browser returned
  **zero matches**: `grep -rniE 'NEXT_PUBLIC_[A-Z_]*(SECRET|TOKEN|SERVICE_ROLE|ENCRYPTION|CLIENT_SECRET|API_KEY|PRIVATE)' apps/web/src` → 0.
- Tokens are handled **only inside server route handlers / server libs** via `process.env` and the
  service-role admin client. The email and calendar routes decrypt the token server-side and return
  a curated, token-free shape:
  - `api/email/messages/route.ts` — `SafeEmailMessage` is "the ONLY shape sent to the client. No
    tokens, no raw provider message IDs" (`:30-41`); even the provider message id is replaced by a
    non-reversible `opaqueRef` sha256 (`:55-58`). The decrypted `access_token` (`:178`) is used only
    in `fetchGoogle`/`fetchMicrosoft` (`:68-133`) and never serialized into the response (`:189`).
  - `api/calendar/events/route.ts` — documented SECURITY INVARIANT: tokens "are read server-side
    ONLY ... and are NEVER returned to the client" (`:7-10`); `SafeCalendarEvent` carries only
    display fields (`:47-60`), attendee **emails are dropped** in favour of names (`:56-57`,
    `localName` `:127-130`).
- The browser side of OAuth only opens the provider auth URL in a popup and listens for a
  same-origin `postMessage`; it never receives a token (`hooks/useIntegration.ts`, per the
  integrations-sprint audit `INTEGRATION_SECURITY_REPORT.md §1`).

## 3. No token left in the URL after callback handling — **PASS**

Both callbacks redirect to a **freshly constructed** URL that carries only a success/error flag — the
inbound `?code=...&state=...` are query params on the _callback request_ URL and are **not** copied
into the redirect target:

- Google success → `new URL(\`${redirectPath}?success=google_connected\`, request.url)`
(`callback/google/route.ts:113-115`); the state cookie is then deleted (`:117`).
- Microsoft success → `new URL(\`${redirectPath}?success=microsoft_connected\`, request.url)`
(`callback/microsoft/route.ts:140-142`); state cookie deleted (`:143`).
- Error branches redirect to opaque codes only — `?error=missing_code`, `?error=invalid_state`,
  `?error=save_failed`, `?error=exchange_failed`, `?error=oauth_not_configured` — never the auth
  code or a token (Google `:33,43,69,93-98,124-126`; Microsoft `:40,46-47,65-67,146-148`).
- A targeted grep for any redirect that reflects `code` / `access_token` / `refresh_token` /
  `?token=` into a URL across `oauth/callback/**` returned **zero matches**.
- Internal exception messages are deliberately kept out of the URL (Google `:121-126` with explicit
  comment; Microsoft `:145-148`). One low-risk reflection remains: the provider-supplied
  `error_description` on the _authorization-error_ branch (Google `:25`, Microsoft `:33`) — this is
  Google/MS text, never our token, and was flagged (not a token leak) in the prior sprint report.

## 4. No token committed to the repo — **PASS**

- Repo-wide tracked-file scan for real secret shapes
  (`git grep -nE 'sbp_[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{30,}|sk-[A-Za-z0-9]{20,}'`, excluding `.md`)
  returned **zero matches**.
- The only tracked `.env*` files are `*.env.example` placeholders plus `apps/mobile/ios/.xcode.env`
  (which holds only `export NODE_BINARY=$(command -v node)`); a scan of those for real values found
  none.
- This corroborates `docs/finish-line/SECURITY_CLEARANCE_REPORT.md §1`, which independently found
  the repository clean and confirmed the exposed Supabase PAT (`sbp_…`) "appeared only in the chat
  transcript, never committed." **Code: CLEAR.** (Operational rotation of the chat-exposed PAT is a
  separate owner action — see `OWNER_ACTIONS_REQUIRED.md`.)

## 5. Encrypted storage only — **PASS**

- Token columns are ciphertext, not text:
  `access_token_encrypted BYTEA NOT NULL`, `refresh_token_encrypted BYTEA`
  (`supabase/migrations/011_mvp_integrations_auth.sql:15-16`).
- Encryption is AES-256 via pgcrypto:
  `pgp_sym_encrypt(p_plaintext, p_key, 'cipher-algo=aes256, compress-algo=1')`
  (`009_mvp_ingestion_pipeline.sql:34`); `pgcrypto` is installed (`009:10`).
- Encrypt/decrypt happen only inside SECURITY DEFINER RPCs:
  - write: `core.upsert_integration_token` calls `core.encrypt_text` (`011:92` insert,
    helper `009:23-34`).
  - read: `core.get_integration_token` calls `core.decrypt_text(t.access_token_encrypted, v_key)`
    (`051_token_retrieval.sql:40-41`, helper `009:38-49`).
- The encryption key is **never stored in the DB** — it is passed per-call (`p_encryption_key`) and
  sourced server-side from `INTEGRATION_ENCRYPTION_KEY` (`callback/microsoft/route.ts:62`;
  email route `:155`; calendar route `:369`).
- **Caveat (carried, not a regression):** symmetric single-key encryption, no KMS / envelope
  encryption. Security rests on `INTEGRATION_ENCRYPTION_KEY`. Acceptable for pilot; KMS deferred
  post-beta (auto-memory `gcp-secrets-deferred`).

## 6. RLS enforced on the token store — **PASS**

- `ALTER TABLE core.integration_tokens ENABLE ROW LEVEL SECURITY` (`011:27`).
- The only table policy is service-role-only:
  `CREATE POLICY "mvp_integration_tokens_service_role" ... FOR ALL TO service_role` (`011:29-31`).
  There is **no** `anon`/`authenticated` policy, so under RLS those roles read nothing — stricter
  than per-row filtering.
- Per-user scoping is enforced inside the RPCs (`WHERE t.user_id = p_user_id`, read `051`; write
  keyed on `UNIQUE(user_id, provider)`).
- Every token RPC is `REVOKE ALL ... FROM PUBLIC` then `GRANT EXECUTE ... TO service_role` only —
  upsert/disconnect/map (`011:200-206`), get/sync-eligible (`051:54-55,90-91`), and the crypto
  helpers (`009:53-56`). Header comment: "Service-role only — never expose to client" (`051:53`).
- **In progress this sprint:** the new audit table follows the same 116-RLS pattern — RLS enabled
  (`20260617120000_integration_audit.sql:39`), owner gets **SELECT-only** on their own rows
  (`:42-45`), service_role full (`:48-51`); the insert RPC is `REVOKE ALL FROM PUBLIC` /
  `GRANT EXECUTE TO service_role` (`:92-93`). The table itself stores **no token** (`:13-16,21-32`).

## 7. Service role used only server-side — **PASS**

- The service-role admin client is built only inside server route handlers from
  `process.env.SUPABASE_SERVICE_ROLE_KEY` with `persistSession:false, autoRefreshToken:false`:
  `callback/microsoft/route.ts:14-21`, `api/email/messages/route.ts:46-53`,
  `api/calendar/events/route.ts:77-84`. None is reachable from client code (no `NEXT_PUBLIC_`
  exposure — see Check 2).
- The **application server is therefore the trust boundary**: it derives `user_id` from a verified
  session before any service-role call — Microsoft `getUserIdFromJWT(request)` → 401 if absent
  (`callback/microsoft/route.ts:51-54`); email/calendar `supabase.auth.getUser()` → `unauthorized`
  if absent (`email/messages/route.ts:139-142`, `calendar/events/route.ts:364-367`). Correct today;
  there is no DB-level backstop if a future caller passes the wrong `p_user_id` (standard for a
  service-role design — noted, not a finding).

---

## Top risks (ranked)

1. **Single symmetric encryption key, no KMS (Check 5 caveat).** If `INTEGRATION_ENCRYPTION_KEY`
   leaks, every stored token is decryptable. Acceptable for pilot; plan envelope/KMS post-beta.
2. **Service-role is the entire trust boundary (Check 7).** Correct today; a future caller passing
   the wrong `p_user_id` would cross-leak with no DB backstop. The new audit log (this sprint)
   improves _detectability_.
3. **Google token-persistence gap (functional, in progress this sprint).** `POST
/api/v1/integrations/google/tokens` is still **absent** in core-api (grep of
   `apps/lifenavigator-core-api/app` for the route / `upsert_integration_token` → 0). Google connect
   fails closed to `?error=save_failed` (`callback/google/route.ts:90-98`) — no token is exposed,
   but a raw Google token does transit a POST to a non-existent endpoint (`:74-88`) until the fix
   lands. Mirror Microsoft's direct service-role RPC path.
4. **Operational credential rotation outstanding (not a repo finding).** See
   `OWNER_ACTIONS_REQUIRED.md` and `docs/finish-line/SECURITY_CLEARANCE_REPORT.md §2`.

## What is solid (do not regress)

- AES-256 at rest, key never in DB, RPCs hard-fail / fail-closed without the key.
- Strict service-role-only RLS + REVOKE-from-PUBLIC on every token RPC.
- No client-bundle secret leak; secrets only in server route handlers.
- Auth code / tokens never carried into a redirect URL; CSRF state in httpOnly cookies; same-origin
  postMessage; internal errors kept out of redirect URLs.
- Audit helper (this sprint) is token-blind by construction and degrades gracefully if its table is
  absent.
