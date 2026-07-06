# GEMINI_BASELINE_DEPLOY_PLAN.md — Phase 2

## 🚧 The one hard prerequisite: a production service account

Prod core-api today authenticates Gemini via **`GEMINI_API_KEY`** (AI Studio) — verified in Fly secrets. There is **no GCP service account / `GOOGLE_APPLICATION_CREDENTIALS`** on the app. My local ADC is a **user login** that does NOT exist in the Fly container.

**Therefore: deploying with `MODEL_PROVIDER=vertex` right now would break the advisor** — `VertexGeminiClient` would raise `VertexAuthError` on every turn → loud fallback to deterministic text. That's worse than today.

### To deploy the Vertex path, first provision (owner action — I can't create SA keys):

1. Create a GCP service account in `gen-lang-client-0849161409` with role **`roles/aiplatform.user`**.
2. Generate a JSON key.
3. Add it to Fly so google-auth can read it. Fly secrets are env vars, not files, so either:
   - `flyctl secrets set GOOGLE_APPLICATION_CREDENTIALS_JSON="$(cat key.json)"` + a tiny entrypoint that writes it to `/tmp/sa.json` and exports `GOOGLE_APPLICATION_CREDENTIALS=/tmp/sa.json`, **or**
   - bake a startup step that materializes the key (small Dockerfile/entrypoint change).
4. Then set `MODEL_PROVIDER=vertex`, `VERTEX_PROJECT=gen-lang-client-0849161409`, `VERTEX_REGION=us-central1`, `VERTEX_GEMINI_MODEL=gemini-2.5-pro`.

## Two deploy options

### Option 1 — Ship quality NOW on the existing (working) key path

Merge to main + deploy core-api **keeping `MODEL_PROVIDER=ai_studio`** (the current `GEMINI_API_KEY`). This ships **all the quality wins** (3-tier finance gate, health policy, answer-first, derivation verifier, finance rendering, loud fallback, provider/model metadata) on auth that already works — **no SA needed, zero regression risk**. The org "no API keys" migration is deferred to Option 2.

- ⚠️ Note: also bump `gemini_generation_model` to `gemini-2.5-pro` — but on the AI-Studio path that means the `GEMINI_API_KEY`'s project must have `gemini-2.5-pro` enabled (verify, or keep `gemini-2.5-flash` on this path until Vertex).

### Option 2 — Full Vertex (org-compliant, no key) — needs the SA above

Provision the SA, then deploy `MODEL_PROVIDER=vertex`. This is the org-policy-correct end state.

## Recommendation

If the goal is **org-policy compliance (no keys)** → do **Option 2** (provision SA first; I'll wire + deploy after). If the goal is **ship quality fast** → **Option 1** today, Option 2 as the follow-up. This is your call — both are safe; the unsafe path is "deploy Vertex without the SA," which I will not do.

## Included in the merge (per mission)

Vertex ADC path · Gemini 2.5 Pro provider · loud fallback · provider/model metadata · finance gate refinement · health policy · answer-first · derivation verifier · docs/tests. **Excluded/off:** Opus hybrid (flag-gated, default off), no GraphRAG/Qdrant/Neo4j changes.
