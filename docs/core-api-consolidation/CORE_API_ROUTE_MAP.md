# CORE_API_ROUTE_MAP.md — Frontend → Core-API route map (deployed branch)

**Evidence-only. No code changed.**

- Backend = `origin/advisor/p0-upgrade-2.3.0` (tip `9d25180`), read via `git show`.
- Frontend = working tree `apps/web/src/app/api/**/route.ts`. Base URL var is `CORE_API` (92 uses) / `CORE_API_URL` (36 uses), resolved in `apps/web/src/app/api/_helper.ts`.
- **43** frontend `route.ts` files proxy to `CORE_API` (`grep -rln 'CORE_API' … --include=route.ts`).
- Every proxy forwards only the user's Supabase JWT (`Authorization: Bearer <t>`); the Gemini/Neo4j/Qdrant/Supabase-service creds stay server-side on Fly.

---

## ⭐ Discovery chat — the load-bearing divergence

### Frontend

`apps/web/src/app/api/life/discovery-chat/route.ts:8`

```
const r = await fetch(`${CORE_API}/v1/life/discovery/chat`, { method: 'POST', … body: JSON.stringify(body) });
```

Local route: `POST /api/life/discovery-chat` → remote `POST /v1/life/discovery/chat`. Body passed through (`message`, `pending_key`, `conversation_id`, `trace`). **Production dependency: YES** — this is the conversational onboarding ("the advisor IS the onboarding").

### Backend handler — DEPLOYED branch (`routers/life.py:84-98`)

```python
@router.post("/discovery/chat")
async def discovery_chat(user: AuthenticatedUser = Depends(authenticated), svc=Depends(get_advisor_orchestrator),
                         message: str = Body(default="", embed=True), pending_key: str = Body(default="", embed=True),
                         conversation_id: str = Body(default="", embed=True), trace: bool = Body(default=False, embed=True)):
    """Chat-native hybrid advisor: one turn. The deterministic engine handles persistence + safety and
    guarantees a fallback; the LLM leads the conversation within those guardrails …"""
    import os
    trace_ok = trace and os.environ.get("ADVISOR_TRACE_ENABLED", "").lower() in ("1", "true", "yes")
    return await svc.converse(_ctx(user), message, pending_key or None,
                              conversation_id=conversation_id or None, trace=trace_ok)
```

→ `svc = get_advisor_orchestrator` → **`AdvisorOrchestrator.converse()`** (hybrid: rules guardrail + LLM leads + validator gate; `advisor_orchestrator.py`).

### Backend handler — origin/main (`git show origin/main:.../routers/life.py`)

```python
@router.post("/discovery/chat")
async def discovery_chat(user: AuthenticatedUser = Depends(authenticated), svc: RelationshipManager = Depends(get_relationship_manager),
                         message: str = Body(default="", embed=True), pending_key: str = Body(default="", embed=True)):
    """Chat-native Relationship Manager: one advisor turn — answer the pending question (if any),
    show what updated, reflect, and ask the next. The advisor IS the onboarding."""
    return await svc.converse(_ctx(user), message, pending_key or None)
```

→ `svc = get_relationship_manager` → **`RelationshipManager.converse()`** (pure deterministic rules; **no LLM, no validator, no `conversation_id`/`trace`**).

**Conclusion:** the same `/v1/life/discovery/chat` URL is a _different advisor_ depending on branch. The Fly app deploys the orchestrator (hybrid LLM) version; main would serve the rules-only version. This is the single biggest reason main must not be deployed.

### Streaming twin — DEPLOYED ONLY (`routers/life.py:100-117`)

```python
@router.post("/discovery/chat/stream")
async def discovery_chat_stream(… svc=Depends(get_advisor_orchestrator) …):
    …
    async for evt in svc.converse_stream(…):
        yield f"data: {_json.dumps(evt, default=str)}\n\n"
    return StreamingResponse(event_stream(), media_type="text/event-stream", …)
```

SSE: fast deterministic `ack` then validated `final`. **Does not exist on origin/main.** **No frontend proxy reaches it** (`grep 'discovery/chat/stream'` over `apps/web/src/app/api` → empty) — so it is deployed but currently **unused by the web app**. Production dependency: NO (today).

---

## Full proxy → endpoint table (43 proxies)

Format: frontend file:line · local route · remote `/v1` endpoint · backend handler (deployed) file:line · response (brief) · prod-dep.

### Life / discovery (10 proxies → `routers/life.py`)

| Frontend file:line                       | Local                         | Remote                            | Handler (deployed)                                | Response                                                       | Prod    |
| ---------------------------------------- | ----------------------------- | --------------------------------- | ------------------------------------------------- | -------------------------------------------------------------- | ------- |
| `api/life/discovery-chat/route.ts:8`     | POST /api/life/discovery-chat | POST `/v1/life/discovery/chat`    | `life.py:84` → AdvisorOrchestrator.converse       | `{message, pending_key, candidate_goals, updates, reveal?, …}` | **yes** |
| `api/life/discovery-coverage/route.ts:7` | GET                           | GET `/v1/life/discovery/coverage` | `life.py:138` → DiscoveryCoverageService          | per-domain coverage %                                          | yes     |
| `api/life/attention/route.ts:7`          | GET                           | GET `/v1/life/attention`          | `life.py:129` → MyLifeService.attention           | next action + ≤3 alerts                                        | yes     |
| `api/life/my-life/route.ts:7`            | GET                           | GET `/v1/life/my-life`            | `life.py:123` → MyLifeService.my_life             | Life-OS aggregate                                              | yes     |
| `api/life/goal/route.ts:8`               | POST                          | POST `/v1/life/goal`              | `life.py:27` → LifeDiscoveryService.discover_goal | objective + graph                                              | yes     |
| `api/life/graph/route.ts:7`              | GET                           | GET `/v1/life/graph`              | `life.py:40` → personal_graph                     | nodes/edges                                                    | yes     |
| `api/life/health/route.ts:7`             | GET                           | GET `/v1/life/health`             | `life.py:51` → discovery_health                   | coverage/confidence/gaps                                       | yes     |
| `api/life/plan/route.ts:7`               | GET                           | GET `/v1/life/plan`               | `life.py:45` → objectives_plan                    | ranked objectives                                              | yes     |
| `api/life/snapshot/route.ts:7`           | GET                           | GET `/v1/life/snapshot`           | `life.py:35` → snapshot                           | snapshot blob                                                  | yes     |
| `api/life/vision/route.ts:8`             | PUT                           | PUT `/v1/life/vision`             | `life.py:21` → save_vision                        | write result                                                   | yes     |

> Not proxied (backend-only on `/v1/life`): `discovery/next`, `discovery/answer`, `bridge`, **`discovery/chat/stream`**.

### Finance (7 proxies → `routers/finance.py`)

| Frontend file:line                              | Local              | Remote                                      | Handler          | Response                    | Prod                          |
| ----------------------------------------------- | ------------------ | ------------------------------------------- | ---------------- | --------------------------- | ----------------------------- |
| `api/financial/route.ts:77`                     | GET /api/financial | GET `/v1/finance/summary`                   | `finance.py:28`  | DomainViewModel             | yes                           |
| `api/finance/canonical-summary/route.ts:15`     | GET                | GET `/v1/finance/canonical-summary`         | `finance.py:171` | canonical net-worth summary | **yes (one source of truth)** |
| `api/dashboard/summary/route.ts:93`             | GET (composite)    | GET `/v1/finance/canonical-summary`         | `finance.py:171` | net worth for dashboard     | yes                           |
| `api/investments/analytics/route.ts:72`         | GET                | GET `/v1/finance/canonical-summary`         | `finance.py:171` | investments slice           | yes                           |
| `api/finance/plan/route.ts:21`                  | GET                | GET `/v1/finance/plan`                      | `finance.py:138` | financial plan              | yes                           |
| `api/finance/resolved-inputs/route.ts:15`       | GET                | GET `/v1/finance/resolved-inputs`           | `finance.py:155` | resolved inputs             | yes                           |
| `api/finance/retirement-projection/route.ts:17` | GET                | GET `/v1/finance/retirement-projection{qs}` | `finance.py:161` | projection series           | yes                           |

### Decision (8 proxies → `routers/decision.py`)

| `api/decision/route.ts:32` | POST | POST `/v1/decision` | `decision.py:27` | decision graph | yes |
| `api/decision/workspace/route.ts:24,35` | GET/POST | `/v1/decision/workspace/types`, `/v1/decision/workspace` | `decision.py:52,58` | workspace types / result | yes |
| `api/decision/graph/route.ts:20` | POST | `/v1/decision/workspace/graph` | `decision.py:73` | graph | yes |
| `api/decision/scenarios/route.ts:24,35` | GET/POST | `/v1/decision/scenarios/decisions`, `/v1/decision/scenarios` | `decision.py:86,92` | scenarios | yes |
| `api/decision/brain-decisions/route.ts:15` | GET | `/v1/decision/brain/decisions` | `decision.py:106` | decision list | yes |
| `api/decision/brain/[decision]/route.ts:16` | GET | `/v1/decision/brain/{decision}` | `decision.py:111` | brain detail | yes |
| `api/decision/compare-sets/route.ts:15` | GET | `/v1/decision/compare/sets` | `decision.py:121` | compare sets | yes |
| `api/decision/compare/[set]/route.ts:16` | GET | `/v1/decision/compare/{set}` | `decision.py:126` | comparison | yes |

### Domains, docs, recs, reports, platform, misc

| Frontend file:line                      | Local    | Remote                                                 | Handler                       | Prod        |
| --------------------------------------- | -------- | ------------------------------------------------------ | ----------------------------- | ----------- |
| `api/career/summary/route.ts:32`        | GET      | `/v1/career/summary`                                   | `career_domain.py:25`         | yes         |
| `api/family/summary/route.ts:26`        | GET      | `/v1/family/summary`                                   | `family_domain.py:24`         | yes         |
| `api/family/office/route.ts:21`         | GET      | `/v1/family/office`                                    | `family_domain.py:47`         | yes         |
| `api/health/summary/route.ts:35`        | GET      | `/v1/health/summary`                                   | `health_domain.py:30`         | yes         |
| `api/health/intelligence/route.ts:17`   | GET      | `/v1/health/intelligence`                              | `health_domain.py:116`        | yes         |
| `api/benefits/analysis/route.ts:21`     | GET      | `/v1/benefits/analysis`                                | `benefits.py:19`              | yes         |
| `api/military/pack/route.ts:17`         | GET      | `/v1/military/pack`                                    | `military.py:19`              | yes         |
| `api/documents/route.ts:23,34,40`       | GET/POST | `/v1/documents`, `/v1/documents/upload`                | `documents.py:69,48,32`       | yes         |
| `api/recommendations/route.ts:20,29,40` | GET/POST | `/v1/recommendations/roadmap`, `/sync`, `/{id}/status` | `recommendations.py:40,18,52` | yes         |
| `api/reports/[type]/pdf/route.ts:23`    | GET      | `/v1/reports/{type}/pdf`                               | `reports.py:53`               | yes         |
| `api/readiness/route.ts:25`             | GET      | `/v1/readiness`                                        | `readiness.py:19`             | yes         |
| `api/tools/run/route.ts:16`             | POST     | `/v1/tools/{name}/run`                                 | `tools.py:19`                 | yes         |
| `api/admin/metrics/route.ts:25`         | GET      | `/v1/admin/metrics`                                    | `analytics.py:61`             | yes (admin) |
| `api/platform/dashboard/route.ts:18`    | GET      | `/v1/platform/dashboard`                               | `platform_router.py:53`       | yes         |
| `api/platform/modules/route.ts:17`      | GET      | `/v1/platform/modules`                                 | `platform_router.py:24`       | yes         |
| `api/platform/guide/route.ts:16`        | GET      | `/v1/platform/onboarding/guide`                        | `platform_router.py:95`       | yes         |
| `api/platform/military/route.ts:21,32`  | PUT/POST | `/v1/platform/military`, `/military/skip`              | `platform_router.py:35,46`    | yes         |
| `api/platform/sample/route.ts:16`       | GET      | `/v1/platform/sample`                                  | `platform_router.py:102`      | yes         |

---

## Advisor / model / graph / analytics — explicit callouts requested

- **Advisor**: only reachable surface is `/v1/life/discovery/chat` (proxied) and `/v1/life/discovery/chat/stream` (**not proxied, unused**). Both → `get_advisor_orchestrator` on the deployed branch only. The advisor stack (`advisor_orchestrator/llm/validator/context/math`, `model_registry/router`) is **NOT on origin/main**.
- **Document**: `/v1/documents` + `/v1/documents/upload` → `documents.py` (proxied via `api/documents`). Other doc routes (catalog/confidence/timeline/recommendations) are backend-only.
- **Recommendation**: `/v1/recommendations/{roadmap,sync,{id}/status}` proxied; `prioritize/conflicts/audit/GET ""` backend-only.
- **Finance**: see table — net worth is read everywhere through **`/v1/finance/canonical-summary`** (dashboard, investments, finance widgets all converge there).
- **Graph**: `/v1/life-graph/workspace` + `/query-focus` (`life_graph.py`, NEW on deployed) have **NO frontend `/api` proxy** → backend-only / not in production navigation today. `/v1/life/graph` (different route) IS proxied.
- **Reporting**: only `/v1/reports/{type}/pdf` is proxied; `generate/preview/share/shares*` are backend-only.
- **Analytics**: only `/v1/admin/metrics` is proxied (`api/admin/metrics`). `/v1/admin/advisor-metrics`, `/v1/admin/pilot-analytics`, `/v1/events`, `/v1/feedback` have **no `/api` proxy found** → backend-only / consumed elsewhere or not yet wired.

## Registered-but-unproxied backend endpoints (no frontend `/api` caller found)

`/v1/chat` + `/v1/chat/context` (LifeOrchestrator grounded chat); `/v1/life-graph/*`; `/v1/life-profile`; `/v1/share/{token}`; `/v1/life/{discovery/next, discovery/answer, bridge, discovery/chat/stream}`; `/v1/admin/{advisor-metrics, pilot-analytics}`; `/v1/events`, `/v1/feedback`; most of `/v1/finance/*` writes (goals/manual-asset/manual-liability/refresh/snapshot/net-worth/debt/investments/retirement/transactions/cash-flow/trends), most of `/v1/career,education,family,health,documents,recommendations,reports,decision` sub-routes. These are either reached by non-`/api` server components, by api-gateway, or are dormant. Which are actually exercised in prod: **UNKNOWN** without runtime logs.
