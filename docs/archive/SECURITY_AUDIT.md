# SECURITY_AUDIT.md — Phase 10

| Check                           | Result                                                                                                                   |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| No secrets committed            | ✅ `git ls-files` shows no `*sa.json`/`*.b64`/credentials/private-key files                                              |
| No SA keys on disk              | ✅ in-machine `/tmp/gcp-sa.json` absent; local disk clean                                                                |
| No SA keys at all               | ✅ SA has **0 user-managed keys**; org policy `disableServiceAccountKeyCreation` enforced                                |
| No credentials logged           | ✅ `vertex_auth` logs only project_id/SA email/status, never token/key contents                                          |
| No API-key model path (advisor) | ✅ `MODEL_PROVIDER=vertex` → advisor uses WIF; `GEMINI_API_KEY` not read by advisor (still set for embeddings — flagged) |
| No AI Studio path (advisor)     | ✅ requests hit `aiplatform.googleapis.com` (Vertex), no `?key=`/`generativelanguage`                                    |
| WIF only                        | ✅ external_account + Fly OIDC; keyless, verified live                                                                   |
| Least privilege                 | ✅ SA: aiplatform.user + serviceUsageConsumer + workloadIdentityUser (scoped to app principalSet)                        |
| Loud fallback                   | ✅ auth failure → VertexAuthError → deterministic + `advisor_model_fallback` log                                         |
| `.gitignore`                    | ✅ blocks `*-sa.json`, `gcp-sa.json`, `*.b64`, `service-account*.json`                                                   |

Residual (low): `GEMINI_API_KEY` secret still present (used by non-advisor embeddings). Remove once embeddings migrate to Vertex. WIF token-source files live only in container tmpfs (0600), 15-min TTL.

## Verdict: keyless, least-privilege, no committed/disk secrets. PASS.

---

## Addendum 2026-06-24 — session-token exposure (disclosed + remediated)

During the UI-smoke attempt, a Playwright debug line printed the post-magic-link redirect URL, which contained the owner's **session access+refresh token** in the URL hash (own account, ~1h TTL).

- **Remediation:** immediate **global sign-out** (`POST /auth/v1/logout?scope=global` → **HTTP 204**) revoked ALL of the user's refresh tokens (incl. the leaked one). The leaked access token is a stateless JWT (cannot be server-revoked) but **expires ~1h from mint and can no longer be refreshed**.
- **Cleanup:** local link + token files shredded; login-page screenshots discarded.
- **Lesson/guard:** never log post-auth URLs/hashes; prefer an owner-provided Playwright `storageState` over admin-minted links for headless smokes. No service-role key or SA credential was exposed (those stayed in the Fly machine).
