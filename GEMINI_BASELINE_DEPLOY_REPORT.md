# GEMINI_BASELINE_DEPLOY_REPORT.md — Phase 3

## Status: NOT DEPLOYED — awaiting an auth decision (not executed to avoid degrading prod)

### What's ready

- Branch pushed; clean fast-forward to `main` (MODEL_BRANCH_RECONCILIATION.md); 646 tests pass.
- flyctl authed (techavenger83); `lifenavigator-core-api` is the live app.

### Why I did not deploy `MODEL_PROVIDER=vertex`

Prod has **no service account** — only `GEMINI_API_KEY`. A Vertex deploy without an SA → `VertexAuthError` every turn → deterministic fallback (worse than today). Deploying that would be a self-inflicted outage. **Blocked on the SA** (GEMINI_BASELINE_DEPLOY_PLAN.md).

### The decision needed from you (one of)

- **Option 1 — ship quality now on the existing key path** (`MODEL_PROVIDER=ai_studio`): merge to main + `flyctl deploy` core-api. No SA needed; ships all the gate/policy/finance improvements; defers the no-key migration. (Verify the API key's project serves `gemini-2.5-pro`, or keep `gemini-2.5-flash` on this path.)
- **Option 2 — full Vertex (no key)**: provision the SA (4 steps in the deploy plan), then I wire `MODEL_PROVIDER=vertex` + deploy.

### What I will run once you choose (exact commands)

```
# merge (clean FF)
git checkout main && git merge --ff-only fix/dashboard-advisor-mode-and-floating-chat && git push origin main
# core-api deploy
flyctl deploy -a lifenavigator-core-api
# Option 1 env:  flyctl secrets set MODEL_PROVIDER=ai_studio   (key already present)
# Option 2 env:  flyctl secrets set MODEL_PROVIDER=vertex VERTEX_PROJECT=gen-lang-client-0849161409 \
#                  VERTEX_REGION=us-central1 VERTEX_GEMINI_MODEL=gemini-2.5-pro GOOGLE_APPLICATION_CREDENTIALS_JSON=...
```

Then Phase 4 smoke (GEMINI_BASELINE_PROD_VALIDATION.md).

**No deploy, no main merge performed this sprint** — held for your Option 1/2 call (consequential, outward-facing).
