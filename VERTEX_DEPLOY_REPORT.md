# VERTEX_DEPLOY_REPORT.md — Phase 5

## Status: BLOCKED — awaiting owner SA + Fly secret (no deploy performed)

Code is ready and pushed (`eca8a63`): Vertex client (ADC), SA-JSON→file bootstrap, VERTEX_MODEL alias, Opus hybrid (off), 653 tests pass. The deploy itself needs the owner to run Phases 1+3 (create SA, create key, set the Fly secret) — gcloud CLI token is expired in this environment and I will not mint SA keys.

## Exact deploy sequence (run once the Fly secret `GOOGLE_APPLICATION_CREDENTIALS_JSON` is set)

```bash
# 1) merge reconciled branch to main (clean fast-forward)
git checkout main
git merge --ff-only fix/dashboard-advisor-mode-and-floating-chat
git push origin main

# 2) deploy core-api (config from Fly secrets — Phase 4)
flyctl deploy -a lifenavigator-core-api

# 3) health
curl -fsS https://lifenavigator-core-api.fly.dev/healthz && echo OK

# 4) prove the model path (one advisor turn) — see VERTEX_PROD_SMOKE_REPORT.md
flyctl logs -a lifenavigator-core-api | grep -E "vertex_auth|advisor_model_fallback" | tail
```

Expect `vertex_auth: materialized service-account credentials …` once in logs, and **no** `advisor_model_fallback` warnings on healthy turns.

## I can run steps 1–4 for you once the secret is in place (you confirm the SA + secret exist).
