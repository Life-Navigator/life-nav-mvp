# lifenavigator-core-api — Deployment & Environment (F3)

## 1. Frontend → Core API (env)

Set on **Vercel** (frontend project), server-side only:

| Var            | Value                                    | Notes                                                                                |
| -------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| `CORE_API_URL` | `https://lifenavigator-core-api.fly.dev` | Enables the thin proxy in `/api/financial`. **Unset = proxy off** (legacy behavior). |

**Auth headers (frontend → Core API):** the Vercel route forwards the signed-in user's Supabase JWT as `Authorization: Bearer <access_token>` (obtained from `supabase.auth.getSession()`). The browser never calls the Core API directly; **no service-role or Gemini key is ever sent from Vercel.**

**Auth headers (any caller → Core API):** `Authorization: Bearer <supabase-user-jwt>` (HS256, `aud=authenticated`). The Core API verifies it with `SUPABASE_JWT_SECRET` and derives `user_id` from `sub`.

## 2. Fly secrets (Core API)

Reuse the **same values already on `lifenavigator-api-gateway`**:

```bash
fly apps create lifenavigator-core-api

fly secrets set -a lifenavigator-core-api \
  SUPABASE_URL=...            SUPABASE_ANON_KEY=... \
  SUPABASE_JWT_SECRET=...     SUPABASE_SERVICE_ROLE_KEY=... \
  GEMINI_API_KEY=... \
  QDRANT_URL=...              QDRANT_API_KEY=... \
  QDRANT_PERSONAL_COLLECTION=life_navigator  QDRANT_CENTRAL_COLLECTION=ln_central \
  NEO4J_URI=...               NEO4J_USERNAME=...  NEO4J_PASSWORD=... \
  NEO4J_PERSONAL_DATABASE=... ALLOWED_ORIGINS=https://lifenavigator.tech
```

`GEMINI_EMBEDDING_MODEL` / `GEMINI_GENERATION_MODEL` are set in `fly.toml [env]`. Never put `GEMINI_API_KEY` on Vercel.

## 3. Local dev vars

`cp .env.example .env`, fill values (or leave blank → endpoints return premium missing-data states). Then:

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
uvicorn app.main:app --reload --port 8080
pytest && ruff check app tests && mypy app
```

## 4. Deploy

```bash
cd apps/lifenavigator-core-api
fly deploy            # builds Dockerfile (python:3.12-slim), app="lifenavigator-core-api"
```

`Dockerfile` confirmed: installs `requirements.txt`, copies `app/`, runs as non-root, `CMD uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 2`. `fly.toml` confirmed: `app = "lifenavigator-core-api"`, `internal_port = 8080`, `/healthz` check, `min_machines_running = 1` (suspend).

## 5. Post-deploy smoke

```bash
BASE=https://lifenavigator-core-api.fly.dev
curl -fsS $BASE/healthz                 # {"status":"ok"}
curl -fsS $BASE/readyz                   # {"status":"ok|degraded","services":{...}}

# With a real Supabase user JWT (mint via admin generate_link → verify, as in the smoke runbook):
TOK="<supabase access_token>"
curl -fsS -H "Authorization: Bearer $TOK" $BASE/v1/finance/summary    # DomainViewModel (real net worth or missing-data state)
curl -fsS -H "Authorization: Bearer $TOK" $BASE/v1/life-profile       # LifeProfile incl. finance; missing_domains lists the rest
curl -s  $BASE/v1/finance/summary                                     # expect 401 (no auth)
```

## 6. Validation checklist

- [ ] `/healthz` 200, `/readyz` shape.
- [ ] Authenticated smoke user → `/v1/finance/summary` returns real data (or honest missing-data state).
- [ ] `/v1/life-profile` includes `domains.finance` + `summaries.finance`; `missing_domains` lists health/career/family/education (metadata only, no fake data).
- [ ] No unfinished domain appears in `domains`/`summaries`.
- [ ] No 5xx on missing optional data (every GET returns < 500).
- [ ] Frontend: `CORE_API_URL` set → `/api/financial` proxies (user JWT only); no Gemini/service-role key in any browser path.
- [ ] No RLS regression (Core API reads filter `user_id`; writes stamp `user_id` from JWT).
