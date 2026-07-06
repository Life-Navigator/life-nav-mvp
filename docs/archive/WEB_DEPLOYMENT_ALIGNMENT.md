# WEB_DEPLOYMENT_ALIGNMENT.md — Phase 2 (partial)

- Push to `main` triggers Vercel's production build (web auto-deploys from main).
- Live checks: `https://lifenavigator.tech` → **200**; `/dashboard` + `/dashboard/advisor` → **307** redirect to `/auth` (correct auth gating). Playwright confirmed the landing renders (title "LifeNavigator — Decision Intelligence for Life").
- **Not verified:** the exact Vercel-deployed git SHA (no Vercel API token available here). The HTML exposes only asset hashes, not a git marker. Confirm in the Vercel dashboard that the latest production deployment == `5e816e4` and is green.
- Env/target: web routes to core-api (Fly) which is healthy on Vertex WIF (Phase 3).

Status: web is up + correctly gated; deployed-SHA confirmation is a dashboard check for the owner.
