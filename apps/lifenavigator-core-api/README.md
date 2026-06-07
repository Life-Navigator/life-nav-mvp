# lifenavigator-core-api

The **orchestration tier** (Phase F1 skeleton). FastAPI on Fly.io.

> Frontend displays · **Core API orchestrates** · Supabase stores · Worker syncs · GraphRAG grounds · Gemini reasons.

Holds Supabase/Gemini/Qdrant/Neo4j credentials **server-side only** — the Vercel frontend never holds a Gemini key (`ARCHITECTURE_BOUNDARIES.md`). Identity comes only from the verified Supabase JWT.

## Endpoints (F1)

- `GET /healthz` — liveness.
- `GET /readyz` — readiness shape (`{status, services:{supabase,qdrant,neo4j,gemini}}`).
- `GET /v1/finance/summary` — complete finance view-model (JWT-protected). Real Supabase-backed when reachable; honest typed placeholder otherwise (never a fake `$0`).
- `POST /v1/chat/context` — per-domain grounding (G contract; finance only in F1).

## Local dev

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env   # fill values (or leave blank for placeholder mode)
uvicorn app.main:app --reload --port 8080
pytest          # tests
ruff check app  # lint
mypy app        # types
```

## Deploy (Fly)

```bash
fly apps create lifenavigator-core-api
fly secrets set ...   # reuse the lifenavigator-api-gateway secret set
fly deploy
```

## Layout

`app/config.py` settings · `app/auth.py` JWT · `app/dependencies.py` DI · `app/clients/*` Supabase/Qdrant/Neo4j/Gemini · `app/domains/{base,finance}.py` DomainService · `app/routers/*` HTTP · `app/services/{trust_safety,cost_meter}.py` · `app/models/common.py` contracts.

Next: **F2** — finance through the Core API end-to-end (grounding port + recommendations + chat). See `IMPLEMENTATION_SEQUENCE_TO_10_10.md`.
