# VERTEX_PRODUCTION_CONFIG.md — Phase 4

## Production Fly secrets (core-api) — target state

```
MODEL_PROVIDER=vertex
VERTEX_PROJECT=gen-lang-client-0849161409
VERTEX_REGION=us-central1
VERTEX_MODEL=gemini-2.5-pro          # alias of VERTEX_GEMINI_MODEL (both accepted)
GOOGLE_APPLICATION_CREDENTIALS_JSON=<base64 SA key>   # bridged to a file at runtime
ENABLE_VERTEX_CLAUDE=false           # Opus hybrid deployed but OFF
CLAUDE_MODEL=claude-opus-4-8         # used only if/when ENABLE_VERTEX_CLAUDE=true
CLAUDE_REGION=global
CLAUDE_HIGH_STAKES_ONLY=true
```

## Guarantees this config gives

- **Advisor production uses Vertex + service-account auth only.** No AI-Studio key path for the advisor (`model_provider=vertex` selects `VertexGeminiClient`).
- **No silent fallback:** an auth/model failure → loud `advisor_model_fallback` log + deterministic safe text; `provider`/`model` on every turn.
- **Opus 4.8 hybrid present but inert** (`ENABLE_VERTEX_CLAUDE=false`) — zero Claude traffic, zero 429 exposure.

## Verify after deploy

`flyctl secrets list -a lifenavigator-core-api` shows the keys above; a live advisor turn returns `provider=vertex_gemini`, `model=gemini-2.5-pro`.
