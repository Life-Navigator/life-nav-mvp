# FLY_VERTEX_SECRET_SETUP.md — Phase 3

The app already bridges a JSON secret to the file google.auth needs (`materialize_sa_credentials()` in `app/clients/vertex_auth.py`) — so **Option A (base64 secret) works with no further code**.

## Owner steps (after the SA exists)

```bash
SA="lifenav-model-runtime@gen-lang-client-0849161409.iam.gserviceaccount.com"

# 1) create key (only if org policy permits key creation)
gcloud iam service-accounts keys create /tmp/lifenav-model-runtime.json --iam-account="$SA"

# 2) base64 (no newlines) and set as a Fly secret + the Vertex config in ONE atomic set
base64 -w 0 /tmp/lifenav-model-runtime.json > /tmp/lifenav-model-runtime.b64
fly secrets set -a lifenavigator-core-api \
  GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat /tmp/lifenav-model-runtime.b64)" \
  MODEL_PROVIDER=vertex \
  VERTEX_PROJECT=gen-lang-client-0849161409 \
  VERTEX_REGION=us-central1 \
  VERTEX_MODEL=gemini-2.5-pro \
  ENABLE_VERTEX_CLAUDE=false

# 3) shred local copies IMMEDIATELY (Phase 8)
shred -u /tmp/lifenav-model-runtime.json /tmp/lifenav-model-runtime.b64 2>/dev/null || rm -f /tmp/lifenav-model-runtime.json /tmp/lifenav-model-runtime.b64
```

## How the app consumes it (already implemented)

On first Vertex call, `materialize_sa_credentials()`: base64-decodes `GOOGLE_APPLICATION_CREDENTIALS_JSON` → writes `/tmp/gcp-sa.json` (0600) → sets `GOOGLE_APPLICATION_CREDENTIALS` → `google.auth.default()` authenticates. Raw (non-base64) JSON is also accepted. Failure raises `VertexAuthError` (loud), never a silent key-path fallback.

## Note on `GEMINI_API_KEY`

Leave it set or unset — with `MODEL_PROVIDER=vertex` the advisor path never reads it. (Other non-advisor code may still use it for embeddings; out of scope this sprint.)
