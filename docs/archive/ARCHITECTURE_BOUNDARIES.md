# ARCHITECTURE BOUNDARIES

**Status:** binding rule for LifeNavigator. Violating any line below is a defect, not a preference.

---

## The mantra

```
Frontend displays.
Supabase stores.
Fly backend thinks.
Worker syncs.
GraphRAG grounds.
Gemini reasons.
```

**Gemini keys must never be exposed to browser/client code.**

---

## Where Gemini (and any LLM) is allowed to run

Gemini belongs **only** in:

- **Fly ingestion worker** (`lifenavigator-ingestion-worker`) — embeddings during sync.
- **Fly api-gateway / future core backend** (`lifenavigator-api-gateway`) — reasoning/generation.
- **Supabase Edge Function `graphrag-query`** — _only_ where it is currently used, until that path is replaced by the Fly core backend.

Gemini is **never** called from:

- the Vercel frontend,
- browser/client code,
- any `NEXT_PUBLIC_*`-reachable surface,
- thin Vercel server routes.

`GEMINI_API_KEY` is **never** set on Vercel. It is staged only on the Fly apps (and the Edge function, transitionally).

## What Vercel is allowed to do

Vercel hosts **only**:

- the frontend,
- the auth UI,
- thin server routes (no model calls),
- environment values for public app URLs and Supabase access (anon/publishable keys, `POSTGRES_URL` from the Supabase integration).

## Responsibility table

| Layer                                | Owns                                                                                                             | Must NOT                                                    |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **Frontend (Vercel)**                | Display, auth UI, thin routes, public URLs + Supabase access env                                                 | Call Gemini; hold any model key                             |
| **Supabase**                         | Storage of record (profiles, finance, goals, chat history), RLS, Edge `graphrag-query` (transitional Gemini use) | Become the long-term reasoning host                         |
| **Fly backend** (api-gateway / core) | Reasoning, generation, orchestration                                                                             | Leak keys to client                                         |
| **Fly worker**                       | Sync: Postgres → embeddings → Qdrant + Neo4j                                                                     | —                                                           |
| **GraphRAG** (Qdrant + Neo4j)        | Grounding retrieval for the model                                                                                | Be the source of personal facts of record (that's Supabase) |
| **Gemini**                           | Embeddings + reasoning, server-side only                                                                         | Be reachable from the browser                               |

---

## Enforcement checklist

- [ ] `GEMINI_API_KEY` absent from Vercel prod/preview/dev env. (Verified absent 2026-06-06.)
- [ ] `GEMINI_API_KEY` present only on `lifenavigator-ingestion-worker` + `lifenavigator-api-gateway` (+ Edge function secrets transitionally).
- [ ] No `NEXT_PUBLIC_*` variable carries a model key.
- [ ] No frontend/route code imports a Gemini client.

---

_Created 2026-06-06 during the Working App Full Path sprint._
