# RELEASE_REGRESSION_CHECKLIST.md

Run before every deploy that touches the advisor, auth, or the Fly Dockerfile/entrypoint.

## 1. Unit (local)

- [ ] `cd apps/lifenavigator-core-api && python -m pytest tests/ -q` → all pass (currently 698 + 12).
- [ ] `cd apps/web && npx tsc --noEmit` → 0 errors; `npx eslint src/` → 0 errors.
- [ ] `( unset CI; cd apps/web && npx next build )` → succeeds (CI skips typecheck via `ignoreBuildErrors:!!CI`).

## 2. Live advisor LLM-path (CRITICAL — catches the socket/WIF/infra regression class)

- [ ] `SMOKE_EMAIL=… SMOKE_PASSWORD=… node apps/web/scripts/advisor-live-regression.mjs` → **PASS / exit 0**.
      Proves the deployed NON-ROOT worker acquires the Vertex/WIF token and the LLM actually runs
      (`provider_called=true`, model present, no infra `fallback_cause`). DO NOT trust an in-machine root SSH test.

## 3. Fallback observability

- [ ] `flyctl logs -a lifenavigator-core-api | grep advisor_turn` shows `provider_called`, `fallback_cause`,
      `route_path`, `model` on each turn.
- [ ] No turns with `fallback_cause=infrastructure_auth` in steady state.

## 4. Trust spine (must NOT regress)

- [ ] A fabricated personal $ ("your net worth is $1.2M") still blocks (test_affordability_gate).
- [ ] Medical diagnosis / lending verdict still blocks.

## 5. Auth/email (once gate closed)

- [ ] Magic link delivered to 2 non-founder inboxes; clean-browser login → /dashboard.

## 6. Onboarding loop

- [ ] A user with data but stale flags reaches /dashboard (proxy safety net) — not trapped in onboarding.

## Known release gotchas

- Running advisor LLM code in-machine as **root** writes per-uid `/tmp/gcp-*-0.json`; harmless now (per-uid
  paths) but never use a root SSH result as proof of production behavior.
- `next.config` `typescript.ignoreBuildErrors:!!CI` means Vercel skips typecheck — run tsc locally.
