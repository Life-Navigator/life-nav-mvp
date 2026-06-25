# VERTEX_KEY_BLOCKED_DECISION.md — Production credential blocker + path forward

## What succeeded (2026-06-24)

- `gcloud auth login` + `gcloud auth application-default login` ✅ — ADC valid, token mints.
- Project `gen-lang-client-0849161409`, quota project set ✅.
- **Vertex Gemini 2.5 Pro answered live via ADC** (`VERTEX_OK`), `provider=vertex_gemini`, **no API key** ✅.
- Service account **`lifenav-model-runtime` exists** with `roles/aiplatform.user` + `roles/serviceusage.serviceUsageConsumer` ✅.

## The blocker

**SA key creation is disabled by org policy** — `constraints/iam.disableServiceAccountKeyCreation: enforced: true`. `gcloud iam service-accounts keys create` returned _"Key creation is not allowed on this service account."_ No key was created. So the **base64-SA-key → Fly secret** path (the documented Option A) **cannot be used**.

This is the org behaving correctly (no long-lived keys), consistent with the API-key prohibition.

## Two compliant paths (owner decision)

### Path 1 — Workload Identity Federation (RECOMMENDED, keyless)

Fly app gets an OIDC token → exchanged (via STS) for short-lived GCP creds that impersonate `lifenav-model-runtime`. **No key ever exists.** Setup:

1. GCP: create a Workload Identity **Pool** + **OIDC Provider** trusting Fly's issuer; grant the federated principal `roles/iam.workloadIdentityUser` on the SA. (Needs the GCP **project number** + Fly OIDC issuer/audience.)
2. Fly: enable OIDC tokens for `lifenavigator-core-api`.
3. App: an `external_account` credential config (NOT a secret) + sourcing the Fly OIDC token; `google.auth.default()` then works. (I can extend `materialize_sa_credentials()` to drop in this config.)

- Pro: fully org-compliant, nothing to rotate. Con: more setup; needs the Fly↔GCP OIDC details.

### Path 2 — Scoped org-policy exception for this one SA (FAST)

An org admin sets a per-resource exception on `constraints/iam.disableServiceAccountKeyCreation` allowing key creation **only** for `lifenav-model-runtime`. Then the existing base64-secret path (FLY_VERTEX_SECRET_SETUP.md) works immediately, code already supports it.

- Pro: fast, no new code. Con: reintroduces a long-lived key the policy was meant to prevent (against the spirit of the org rule).

## Recommendation

**Path 1 (WIF)** — it matches the org's keyless intent. Path 2 only if you need prod up today and accept a managed key with rotation.

## State

- No key material on disk (none created). Nothing to clean. `.gitignore` already blocks key patterns.
- core-api **not deployed**; advisor prod unchanged (still on the existing key path) — safe, no regression.
