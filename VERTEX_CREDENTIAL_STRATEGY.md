# VERTEX_CREDENTIAL_STRATEGY.md — Phase 2

## Preferred long-term: Workload Identity Federation (no key)

Bind Fly's OIDC identity to the SA via WIF so no long-lived JSON key exists. Best security posture; eliminates rotation. Defer for the pilot (Fly WIF setup is more involved) but adopt before GA. The runtime already supports it: `materialize_sa_credentials()` is a no-op when `GOOGLE_APPLICATION_CREDENTIALS` is provided by a WIF/mounted mechanism, and `google.auth.default()` picks up the federated creds.

## Short-term (pilot): SA JSON key as a Fly secret — ONLY if org policy allows key creation

- Generate the key (Phase 3), store it **only** as a Fly secret (base64), never in git, never printed, deleted locally immediately after upload.
- The app decodes it to `/tmp/gcp-sa.json` (0600) at runtime via `materialize_sa_credentials()` — the key lives only in the container's ephemeral tmpfs + Fly's encrypted secret store.

## Guardrails (enforced)

- `.gitignore` blocks `*-sa.json`, `gcp-sa.json`, `lifenav-model-runtime*.json`, `*.b64`.
- The materializer validates `type==service_account` and **never logs the secret** (only project_id).
- No AI-Studio key path for the advisor in production (`MODEL_PROVIDER=vertex`).

## Rotation

- Key rotation every 90 days (or on suspected exposure): create a new key, update the Fly secret, `flyctl deploy`, then delete the old key in IAM. With WIF, rotation is unnecessary — another reason to migrate.
