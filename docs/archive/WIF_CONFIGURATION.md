# WIF_CONFIGURATION.md — Phase 3

Keyless federation: Fly Machine OIDC → GCP STS → SA impersonation. No keys.

## Created

- **Pool:** `lifenav-fly` (location `global`).
- **Provider:** `fly-oidc` (OIDC).
  - issuer-uri: `https://oidc.fly.io/personal` → corrected to **`https://oidc.fly.io/timothy-riffe`** (the actual token issuer).
  - allowed-audiences: `lifenav-vertex-prod`.
  - attribute-mapping: `google.subject=assertion.sub, attribute.app_name=assertion.app_name, attribute.org_id=assertion.org_id`.
  - attribute-condition: `assertion.app_name == 'lifenavigator-core-api'` (only our app's tokens accepted).
- **Audience (full):** `//iam.googleapis.com/projects/763004283556/locations/global/workloadIdentityPools/lifenav-fly/providers/fly-oidc`.

## Trust chain (verified live in the prod machine)

Fly Machine `POST /.fly/api → /v1/tokens/oidc {aud: lifenav-vertex-prod}` → JWT (iss `…/timothy-riffe`, app_name `lifenavigator-core-api`) → STS token exchange → impersonate `lifenav-model-runtime` → Vertex Gemini 2.5 Pro → **`VERTEX_OK`**.

## Gotcha recorded

The Fly org _slug_ is `personal`, but the OIDC token `iss` is `https://oidc.fly.io/timothy-riffe` (org-name slug). The provider issuer-uri MUST match the token `iss`, not the slug. Discovered via the STS `invalid_grant` error and fixed.
