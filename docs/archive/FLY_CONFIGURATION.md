# FLY_CONFIGURATION.md — Phase 6

App `lifenavigator-core-api` (no Fly login needed — already authed; no secrets to _enter_, all values are non-sensitive WIF config).

## Set (staged, then applied on deploy)

```
MODEL_PROVIDER=vertex
VERTEX_PROJECT=gen-lang-client-0849161409
VERTEX_REGION=us-central1
VERTEX_MODEL=gemini-2.5-pro
VERTEX_WIF_AUDIENCE=lifenav-vertex-prod
VERTEX_WIF_PROVIDER=projects/763004283556/locations/global/workloadIdentityPools/lifenav-fly/providers/fly-oidc
VERTEX_SA_EMAIL=lifenav-model-runtime@gen-lang-client-0849161409.iam.gserviceaccount.com
ENABLE_VERTEX_CLAUDE=false
```

None of these are secrets (no key/token). `GEMINI_API_KEY` remains set but is **not read by the advisor** under `MODEL_PROVIDER=vertex` (other non-advisor code may still use it for embeddings — out of scope).

## APIs enabled

`aiplatform.googleapis.com`, `sts.googleapis.com`, `iamcredentials.googleapis.com`.

## Deploy

`flyctl deploy -a lifenavigator-core-api` — image `deployment-01KVY5JHT5…`, rolling, both machines healthy, healthz `{"status":"ok"}`.
