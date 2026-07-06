# Beta AI Model Activation — Vertex AI (2026-06-12)

Goal: safely activate the model router for the 20-user beta, lowest risk. Vertex AI only; Gemini stays
the fallback; Opus stays off. This documents what is activated, the exact env, the verification needed,
validation results, and the **honest end-to-end status** (a real blocker the sprint's status flagged).

## What is activated (router config — validated)

The router now encodes the beta policy. ONLY three agents route to Claude Sonnet on Vertex; everything
else stays Gemini, even with Claude enabled:

| Agent                                                                                                                                                           | Route (Claude on)      | Fallback      |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | ------------- |
| `onboarding_advisor`                                                                                                                                            | Claude Sonnet (Vertex) | Gemini        |
| `report_writer`                                                                                                                                                 | Claude Sonnet (Vertex) | Gemini        |
| `recommendation_critic`                                                                                                                                         | Claude Sonnet (Vertex) | Gemini (deep) |
| decision_engine, scenario_lab, recommendation_generator, explainability_builder, graph_retrieval_planner, finance_explainer, document_extractor, classifiers, … | **Gemini (unchanged)** | —             |

Opus stays disabled (a high-stakes critic does NOT escalate to Opus in beta). `pdf_narrative_writer`
(report narrative) and `health_intake` (feature gated OFF) also map to Claude in the registry but are not
beta-live — the only Claude-reachable surfaces for beta are the 3 above.

## Environment variables (set in the BACKEND env — Fly — that owns LLM calls; NOT NEXT_PUBLIC)

```
AI_PROVIDER=vertex
AI_MODEL_ROUTER_ENABLED=true
AI_ENABLE_CLAUDE=true            # enable Claude for the 3 agents
AI_ENABLE_CLAUDE_OPUS=false      # Opus stays OFF for beta
AI_VERTEX_LOCATION=us-east5      # Claude on Vertex is region-limited — us-east5 (or europe-west1)
AI_CLAUDE_SONNET_MODEL=<verified Vertex id, e.g. claude-sonnet-4-5@YYYYMMDD>
AI_DEFAULT_MODEL=gemini-3.5-flash   # VERIFY GA; else gemini-2.5-flash
AI_CHEAP_MODEL=gemini-2.5-flash-lite
AI_REASONING_MODEL=gemini-2.5-pro
```

`AI_VERTEX_LOCATION` matters: Gemini is commonly served in `us-central1`, but Claude on Vertex is NOT —
the router's region guard will silently fall back to Gemini if the location has no Claude (validated).

## Verify the actual Vertex Claude model id (do before flipping the flag)

In Vertex AI Model Garden (console) or CLI, confirm the publisher-scoped, versioned id + region:

```
gcloud ai model-garden models list --region=us-east5 | grep -i claude
# expected form: publishers/anthropic/models/claude-sonnet-4-5@<YYYYMMDD>
```

Set `AI_CLAUDE_SONNET_MODEL` to the verified id. `lib/ai/providers/vertexClaude.ts:claudePublisherModel()`
already builds the `publishers/anthropic/...` path; the registry tracks the regions.

## Validation results (21 tests pass — `lib/ai/__tests__/`)

- **Onboarding Advisor / Report Writer / Recommendation Critic** → `vertex-claude` / `claude-sonnet-4-5`
  when Claude is on + region=us-east5. ✓
- **Everything else stays Gemini** even with Claude enabled (decision engine, scenario lab, recommendation
  generation, explainability, graph planner, finance explainer, classifiers). ✓
- **Fallback** — each Claude route carries a Gemini fallback so a Claude failure never breaks UX. ✓
- **Opus disabled** — a regulated/high-stakes critic stays Sonnet, never Opus. ✓
- **Gemini-only mode** (`AI_ENABLE_CLAUDE=false`) — all three fall back to Gemini; the platform still
  works. ✓
- **Region guard** — Claude enabled but `AI_VERTEX_LOCATION=us-central1` (no Claude) → falls back to
  Gemini with a logged reason. ✓

## Metrics / logging

`lib/ai/auditLog.ts` already emits, per routed call: requestId, agent, domain, provider, model,
`fallbackUsed` + reason, riskLevel, latencyTier, costTier, promptVersion (no raw user content unless
`AI_AUDIT_DEV_CONTENT=true`). Fallback rate = `fallbackUsed` over the audit stream. Product metrics
(onboarding completion, report generation/downloads, recommendation/graph engagement) are already captured
via `analytics_user_events` / `recordUserEvent`; wire `setAuditSink()` to your log pipeline to join
model-usage with those.

## HONEST end-to-end status (the real blocker)

The router config is **activation-ready and validated**, but it is **not yet invoked in the production
call path**, for three structural reasons in the current codebase:

1. The backend LLM client (`apps/lifenavigator-core-api/app/clients/gemini.py`) calls the **AI Studio API**
   (`generativelanguage.googleapis.com` + `GEMINI_API_KEY`), **not Vertex AI**. There is no Vertex client
   (ADC) for Gemini or Claude on the backend.
2. The **advisor is rule-based** (`relationship_manager.py` makes no LLM call), and there is **no
   `report_writer` / `recommendation_critic` LLM agent** — reports are templated (WeasyPrint) and
   recommendations are deterministic (`recommendations_os`).
3. The router is **TypeScript** (`apps/web/src/lib/ai`) and is not wired into the Python backend.

So flipping `AI_ENABLE_CLAUDE=true` today changes the router's **decision** but no production code consumes
that decision — "Onboarding/Reports/Critic use Claude" is **not yet true end-to-end**. Making it true
requires backend work the sprint explicitly scopes out ("Do NOT redesign architecture"; advisor/report/
critic must "remain exactly as they are"): a backend Vertex client (ADC) for Gemini+Claude, invoking
`routeAndAudit()` at those call sites, and making those three agents LLM-capable.

**Recommendation for the beta:** keep `AI_ENABLE_CLAUDE=false` in production until the backend Vertex
invocation exists. This is the lowest-risk posture (the sprint's #1 goal): the router is proven, the flag
is ready, and no brand-new production LLM path is introduced for 20 users. The moment the backend client +
call-site wiring land, flipping the flag activates Claude for exactly the 3 agents with Gemini fallback —
no further router changes needed.

## Remaining TODOs (backend, gated by "no architecture redesign")

1. Backend Vertex client (ADC, no keys) for Gemini + Claude; migrate `gemini.py` off AI Studio to Vertex.
2. Port the routing decision to the backend (or have the backend call an internal route) and invoke
   `routeAndAudit()` before each LLM call.
3. Make `onboarding_advisor` / `report_writer` / `recommendation_critic` LLM-capable (a product decision —
   the advisor is intentionally rule-based today).
4. Confirm the exact `claude-sonnet-4-5@<version>` id + region in Model Garden, then set the env + flip
   the flag.

## Files changed

- `apps/web/src/lib/ai/__tests__/betaActivation.test.ts` — locks the beta routing contract (6 tests).
- (No router-config change needed — `agentProfiles.ts` already routes the 3 agents to Claude Sonnet with
  Gemini fallback, everything else Gemini.)
