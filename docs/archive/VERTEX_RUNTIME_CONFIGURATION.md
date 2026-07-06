# VERTEX_RUNTIME_CONFIGURATION.md — Phase 5

Runtime uses `external_account` (WIF) credentials — keyless. Implemented in `app/clients/vertex_auth.py`.

## Mechanism

When `VERTEX_WIF_AUDIENCE` + `VERTEX_WIF_PROVIDER` + `VERTEX_SA_EMAIL` are set (`wif_enabled()`), `AdcTokenProvider`:

1. `materialize_external_account_config()` writes `/tmp/gcp-external-account.json` (type `external_account`, audience = the provider, `service_account_impersonation_url` for the SA, `credential_source.file = /tmp/fly-oidc-token`) and sets `GOOGLE_APPLICATION_CREDENTIALS`. **No key material** in the config.
2. Before each token refresh, `refresh_fly_oidc_token()` POSTs the Fly unix socket (`/.fly/api → /v1/tokens/oidc {aud}`) → writes the fresh 15-min JWT to `/tmp/fly-oidc-token` (0600).
3. `google.auth.default()` builds the external_account credential; `.refresh()` exchanges the JWT via STS and impersonates the SA → 1-hour access token (cached).

## Properties

- No service-account key, no API key — verified in-machine: `/tmp/gcp-sa.json` absent; external_account + fly-token present.
- Loud failure: Fly-socket/STS errors raise `VertexAuthError` → advisor falls back to deterministic text with a logged `advisor_model_fallback` (never silent).
- The Fly JWT (15 min) is minted fresh per exchange, so expiry never bites.
