# VERTEX_GEMINI_SETUP.md — Phase 3

Gemini 2.5 Pro via Vertex AI with ADC — **no API key**. Implemented + unit-tested; live verification is the owner ADC step.

## What was built

- `app/clients/vertex_auth.py` — `AdcTokenProvider`: `google.auth.default()` → cached/refreshed OAuth token (scope `cloud-platform`). Missing/unauthorized creds → `VertexAuthError` (raised loudly).
- `app/clients/gemini.py` — `VertexGeminiClient`: POSTs `…:generateContent` with `Authorization: Bearer <ADC>`, **no `?key=`**. Same `generate()/generate_with_usage()/configured/ready` contract as `GeminiClient`, plus `provider="vertex_gemini"` and `model_name`.
- `app/config.py` — `model_provider`, `vertex_project`, `vertex_region`, `vertex_gemini_model`.
- `dependencies.py` — `model_provider=vertex` routes advisor generation through `VertexGeminiClient`.

## Requirements (met)

- ✅ no API key (ADC bearer only)
- ✅ project from `VERTEX_PROJECT` / `vertex_project`
- ✅ region from `VERTEX_REGION` / `vertex_region` (default `us-central1`)
- ✅ explicit model name (`vertex_gemini_model`, default `gemini-2.5-pro`)
- ✅ runtime logs expose provider/model (`advisor_orchestrator` sets `provider`/`model`; `vertex_auth` logs token mint)
- ✅ failure is loud (raises `VertexAuthError`; wrapper logs WARNING + visible fallback) — **verified live with ADC absent**

## Endpoint

`https://{region}-aiplatform.googleapis.com/v1/projects/{project}/locations/{region}/publishers/google/models/{model}:generateContent`
(`region=global` → `aiplatform.googleapis.com`). Proven: `…/projects/lifenavigator-dev/locations/us-central1/publishers/google/models/gemini-2.5-pro:generateContent`.

## Turn it on

```bash
# Owner (once): authenticate ADC
gcloud auth application-default login
gcloud auth application-default set-quota-project lifenavigator-dev   # project with Vertex AI API enabled

# core-api env
MODEL_PROVIDER=vertex
VERTEX_PROJECT=lifenavigator-dev
VERTEX_REGION=us-central1            # a region where gemini-2.5-pro is served
VERTEX_GEMINI_MODEL=gemini-2.5-pro
# (do NOT set GEMINI_API_KEY for the advisor path)
```

Deploy (Fly): attach a service account with `roles/aiplatform.user`; google-auth picks it up from the metadata server or `GOOGLE_APPLICATION_CREDENTIALS`. Prereqs: `aiplatform.googleapis.com` enabled on the project; `requests` + `google-auth` in requirements (added).

## Verify (after ADC login)

```bash
gcloud auth application-default print-access-token            # mints a token
cd apps/lifenavigator-core-api && source .venv/bin/activate
python -c "import asyncio;from app.clients.gemini import VertexGeminiClient;from app.clients.vertex_auth import AdcTokenProvider;\
print(asyncio.run(VertexGeminiClient(project='lifenavigator-dev',region='us-central1',generation_model='gemini-2.5-pro',token_provider=AdcTokenProvider()).generate('You are terse.','say OK')))"
```

Expect the model's text. A `VertexAuthError` means ADC isn't set up; a 403 means the model/region isn't enabled for the project (loud, not silent).

## Status

Code COMPLETE + tested (620 pass). Live call BLOCKED on owner ADC + Vertex API enablement.
