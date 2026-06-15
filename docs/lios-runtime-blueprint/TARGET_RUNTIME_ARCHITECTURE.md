# Target Runtime Architecture

> Implementation planning only — no code/runtime/deploy. Shows **Current → Transition → LIOS Runtime** with
> exact, code-anchored steps. Builds on `CURRENT_STATE_AUDIT.md`.

---

## 1. Current (today)

```
/v1/life/discovery/chat → get_advisor_orchestrator (dependencies.py:268)
                        → AdvisorOrchestrator.converse (advisor_orchestrator.py:167)
                        → RM(det) → Context → plan → GeminiAdvisorLLM → validate → compose → audit
```

One agent. One LLM call. Deterministic spine. Real telemetry. This is the baseline that must keep working.

## 2. Transition state (LIOS wraps, does not replace)

A new **LIOS Orchestrator** is introduced _above_ the existing `AdvisorOrchestrator`, which becomes the
registered **`advisor` agent**. Everything is flag-gated; with all flags off the path is byte-identical to
today.

```
/v1/life/discovery/chat
  → get_orchestrator (dependencies.py — extended)
      IF !LIOS_ENABLED  → AdvisorOrchestrator.converse   (today's path, untouched)
      IF  LIOS_ENABLED  → LiosOrchestrator.run
            → [observe] route plan (intent/selection)        ← Phase 2–3, observe-only at first
            → invoke registry["advisor"] == AdvisorOrchestrator.converse   ← same call, same output
            → Compliance (existing validator) → Composer (existing _compose)
            → Audit (existing _finish + new events)
```

Key property: in the transition, `LiosOrchestrator` _delegates to the existing orchestrator_ and returns its
output unchanged. New stages (intent, selection) run in **observe/log-only** mode — they record what they
_would_ do without changing the response.

## 3. LIOS Runtime (end state)

```
/v1/life/discovery/chat (+ new intents)
  → LiosOrchestrator.run
      → det turn (RM)                                  [unchanged authority]
      → Intent Detection  (LLM classify + det fallback)
      → Agent Selection   (deterministic rule table)   → route plan (DAG, parallel groups)
      → [Graph plan ∥ Tool plan]
      → Agent Execution   (registry: advisor / finance / family / … run; parallel where safe)
      → Conflict Resolution → Recommendation (RecommendationOS) → Critic?
      → Compliance (deterministic gate, + optional LLM-assist)
      → Response Assembly (Composer)
      → Audit (full event stream)
```

Each box is a **registry entry** (see `AGENT_RUNTIME_REGISTRY.md`) composed from Prompt OS layers (see
`PROMPT_COMPOSITION_ENGINE.md`), gated by flags (see `FEATURE_FLAG_STRATEGY.md`).

## 4. New code (what gets added — names illustrative, not built here)

| New module (proposed)               | Responsibility                        | Wraps/uses existing                                 |
| ----------------------------------- | ------------------------------------- | --------------------------------------------------- |
| `services/lios/orchestrator.py`     | the LIOS Orchestrator (`run`)         | delegates to `AdvisorOrchestrator` as `advisor`     |
| `services/lios/registry.py`         | agent runtime registry                | maps names → callables + specs                      |
| `services/lios/prompt_composer.py`  | composes the 10 Prompt OS layers      | reads `docs/lios-prompt-operating-system/*` assets  |
| `services/lios/intent.py`           | intent detection (LLM + det fallback) | `GeminiClient`                                      |
| `services/lios/selection.py`        | deterministic agent selection         | rule table                                          |
| `services/lios/tool_runtime.py`     | typed tool execution + trace storage  | `decision_brain`, `tools`, resolvers                |
| `services/lios/graphrag_runtime.py` | retrieval plans + evidence packaging  | neo4j/qdrant clients, `advisor_context` graph build |
| `services/lios/critic.py`           | adversarial high-stakes review        | `GeminiClient`                                      |
| `services/lios/flags.py`            | the LIOS flag set                     | `config.Settings`                                   |

These are **additive** modules under a new `services/lios/` package; nothing in the existing advisor files
is rewritten in early phases.

## 5. What is reused (not rebuilt)

- The deterministic spine: `RelationshipManager`, `advisor_validator`, `RecommendationOS`, `MyLifeService`.
- The LLM client + the `AdvisorLLM` Protocol.
- The telemetry sink: `_finish`/`_persist` + `analytics.advisor_turns` + the metrics view.
- The domain summary services + decision engines (wrapped, not rewritten).

## 6. Boundaries preserved end-to-end

Deterministic-first; LLM never writes; Compliance before user; DAG/no-cycles/escalate-via-Orchestrator;
numbers from tools with a trace; Gemini key Fly-only; telemetry non-blocking. The LIOS Orchestrator inherits
the existing "always return a safe response" guarantee from day one because it delegates to the proven path.

## 7. Reversibility

`LIOS_ENABLED=false` ⇒ the new orchestrator is never constructed; the request flows through today's
`AdvisorOrchestrator` exactly as now. One toggle returns to baseline. (See `FEATURE_FLAG_STRATEGY.md`.)
