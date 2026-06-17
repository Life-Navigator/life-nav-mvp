# Prompt Composition Engine

> Implementation planning only — no code, no runtime change, no deploy, no Gemini wiring, no beta change.
> This describes how the 10 Prompt OS layers become one runtime prompt, and how that factors today's
> hand-assembled `ADVISOR_SYSTEM` + `AdvisorContext.prompt_dict`. Builds on `CURRENT_STATE_AUDIT.md`,
> `TARGET_RUNTIME_ARCHITECTURE.md`, and `docs/lios-prompt-operating-system/README.md` (the 10-layer model).
> Module names under `services/lios/` are the **proposed** target (see Target doc §4) — illustrative, not built.

---

## 1. The core idea: today is a hand-assembled composition; the engine factors it

The live advisor already composes a layered prompt — it is just hardcoded in two places:

- **`app/services/advisor_llm.py:34` `ADVISOR_SYSTEM`** is a single string that hand-bakes Layers 1–6
  together (identity/Constitution, safety HARD RULES, provenance "use ONLY supplied context", the advisor
  subsystem role, finance/decision domain rules, and the discovery task loop) **plus** the Layer 8 output
  schema (the literal JSON shape at the tail of the string, `advisor_llm.py:148`).
- **`app/services/advisor_context.py:193` `AdvisorContext.prompt_dict()`** is the Layer 7 runtime context
  contract — the bounded, anti-fabrication context object (`allowed_numbers`, `relationship_edges`,
  classified facts, discovery scores, safety_constraints).
- **`app/services/advisor_llm.py:163` `GeminiAdvisorLLM.generate`** stitches them: `ADVISOR_SYSTEM` is the
  system instruction; the user message is `json.dumps({"guardrails": context.prompt_dict(), "constraints":
plan})` wrapped in `GUARDRAILS_AND_CONSTRAINTS:\n…`.

The **Prompt Composition Engine** does not invent a new prompt model. It pulls those layers out of the
string into versioned assets (`docs/lios-prompt-operating-system/*`) and assembles them deterministically,
so every agent — not just the advisor — gets a correct, ordered, auditable prompt.

```
ADVISOR_SYSTEM (one string)  ─────────────►  composed from Layers 1–6 + 9 + 10 assets
prompt_dict()  (Layer 7)     ─────────────►  UNCHANGED — the only LLM-visible context
output schema (tail of str)  ─────────────►  Layer 8 schema asset
```

## 2. The 10 layers and where each lives

| Layer                          | What                                              | Asset path (load-from)                                                         | Today (hand-assembled)                             |
| ------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------ | -------------------------------------------------- |
| 1 Constitution                 | identity/mission, "LLM never the source of truth" | `base/LIFE_NAVIGATOR_CONSTITUTION.md` (`constitution-1.0`)                     | head of `ADVISOR_SYSTEM` (advisor_llm.py:34)       |
| 2 Governance/Safety/Provenance | governance, safety, provenance rules              | `base/GOVERNANCE_RULES.md`, `base/SAFETY_RULES.md`, `base/PROVENANCE_RULES.md` | "HARD RULES" + "Use ONLY the supplied context"     |
| 3 Subsystem role               | per-role prompt                                   | `subsystems/<ROLE>_PROMPT.md` (e.g. `ADVISOR_PROMPT.md`)                       | "YOU drive the conversation…" block                |
| 4 Agent spec                   | referenced, not duplicated                        | `docs/lios-agent-specifications/<AGENT>_AGENT.md`                              | implicit in the string                             |
| 5 Domain rules                 | when domain-scoped                                | `domains/<DOMAIN>_PROMPT.md`                                                   | finance/decision wording inline                    |
| 6 Task                         | when a task is in play                            | `tasks/<TASK>_TASK.md`                                                         | the discovery "DECISION LOOP"                      |
| 7 Runtime context              | bounded context (Memory's `prompt_dict`)          | runtime value — **not an asset**                                               | `prompt_dict()` (advisor_context.py:193)           |
| 8 Output schema                | output contract + base envelope                   | `schemas/<X>_SCHEMA.md` + `schemas/AGENT_OUTPUT_SCHEMA.md`                     | JSON tail of `ADVISOR_SYSTEM` (advisor_llm.py:148) |
| 9 Failure rules                | base failure behavior                             | `base/` + `AGENT_FAILURE_BEHAVIOR.md`                                          | scattered "return None / fall back" intent         |
| 10 Validator expectations      | what Compliance will check                        | derived from `advisor_validator.py` rules + `COMPLIANCE_AGENT.md`              | implicit (validator runs after)                    |

Cross-cutting assets threaded through several layers (per the README): `base/CONFIDENCE_RULES.md`,
`base/TOOL_USAGE_RULES.md`, `base/GRAPH_RAG_RULES.md`, `base/MEMORY_RULES.md`, `base/STYLE_GUIDE.md`.

## 3. Exact assembly order (deterministic, no LLM)

The composer (proposed `services/lios/prompt_composer.py`) produces two strings per agent invocation:

```
SYSTEM INSTRUCTION  =  Layer 1 Constitution                 (ALWAYS first, verbatim)
                    +  Layer 2 Governance + Safety + Provenance
                    +  cross-cutting (Confidence/Tool/GraphRAG/Memory/Style as the agent needs)
                    +  Layer 3 Subsystem role
                    +  Layer 4 Agent-spec pointer (id/version reference, not the full body)
                    +  Layer 5 Domain rules            (only if the route plan is domain-scoped)
                    +  Layer 6 Task instructions        (only if a task is in play)
                    +  Layer 9 Failure rules
                    +  Layer 10 Validator expectations  (so the agent self-conforms)

USER MESSAGE        =  Layer 7 bounded runtime context  (the agent's prompt_dict, verbatim)
                    +  Layer 8 output schema            (envelope + per-agent payload schema)
```

This maps onto today exactly: SYSTEM = `ADVISOR_SYSTEM`; USER = `prompt_dict()` + schema. The split
(1–6/9/10 in system, 7+8 in user) preserves the current `generate()` call shape in `advisor_llm.py:163`
(`generate_with_usage(SYSTEM, USER, temperature=…)`) — the composer just supplies SYSTEM and the schema half
of USER instead of the literal string + JSON tail. **The composer is pure/deterministic — it never calls an
LLM.** Same agent + same asset versions + same route plan ⇒ byte-identical SYSTEM string.

## 4. Where assets load from + caching

- **Source:** the asset tree under `docs/lios-prompt-operating-system/` (base/, subsystems/, domains/,
  tasks/, schemas/). Each asset is plain markdown beginning with a layer/source/version header (README §"How
  to read an asset"); the composer strips the header and emits the body.
- **Resolution:** for a given agent the registry entry (see `AGENT_RUNTIME_REGISTRY.md`) names its
  subsystem asset, domain asset(s), and schema asset; the composer resolves task assets from the route
  plan's `task` field, and the base layers are constant for all agents.
- **Caching:** assets are immutable per process. The composer loads + parses once and caches the parsed
  layer bodies keyed by `(asset_path, content_hash)`; the **composed** SYSTEM string is cached keyed by
  `(agent, asset_version_set, domain, task)` since it is independent of runtime context. Layer 7 (context)
  and the per-turn temperature are never cached. At beta the asset tree ships with the deploy, so a
  content-hash check at startup is sufficient (no hot reload required).
- **Determinism guard:** the cache key includes every contributing asset's version + content hash, so a
  changed asset produces a new key (and a new `prompt_version`) rather than serving stale text.

## 5. The composed `prompt_version` stamp

Today the stamp is one flat constant: `ADVISOR_PROMPT_VERSION = "advisor-hybrid-2.2.0"` (advisor_llm.py:20),
copied to `GeminiAdvisorLLM.prompt_version` (advisor_llm.py:151) and into the orchestrator turn record
(advisor_orchestrator.py:105/155, logged in `analytics.advisor_turns`).

The engine replaces this flat string with a **layered id** the composer computes from the actual assets it
combined, e.g.:

```
lios/advisor@constitution-1.0+safety-1.0+provenance-1.0+advisor-sub-1.1+finance-dom-1.0+home-purchase-1.0+schema-1.0
```

Properties:

- It is a deterministic function of the layer version set — the same composition always stamps the same id.
- It is fully backward compatible with the telemetry sink: it is still a single string written to the
  existing `prompt_version` field (CURRENT_STATE_AUDIT §5), so dashboards keep working. During transition
  the engine can keep emitting `advisor-hybrid-2.2.0` as an alias until the layered id is adopted.
- It makes every turn reproducible: the audit row names the exact prompt assembly that produced it.

## 6. The four mandatory questions

- **Where does it live today?** Spread across `advisor_llm.py:34` (`ADVISOR_SYSTEM`, layers 1–6/9/10 + the
  schema tail at :148), `advisor_context.py:193` (`prompt_dict`, layer 7), and `advisor_llm.py:163`
  (`generate`, the stitch). The version stamp lives at `advisor_llm.py:20`.
- **What code owns it?** `GeminiAdvisorLLM` (advisor_llm.py:148) owns building the prompt + calling Gemini;
  `AdvisorContext` (advisor_context.py:193) owns the bounded context; the orchestrator owns logging the
  stamp (advisor_orchestrator.py:105/155).
- **What must change?** **How the LLM agent gets its system prompt.** `GeminiAdvisorLLM.generate` stops
  using the literal `ADVISOR_SYSTEM` constant and instead asks the proposed `prompt_composer` for the
  composed SYSTEM string + Layer 8 schema for its registry entry; `prompt_version` becomes the layered id.
  This is additive and flag-gated (the composer can first run in shadow, asserting its output equals
  `ADVISOR_SYSTEM` byte-for-byte before it is allowed to drive a turn — the Phase-1 golden-diff discipline).
- **What must NOT change?**
  1. **`prompt_dict()` stays the ONLY LLM-visible context** (advisor_context.py:193). The composer supplies
     instructional layers; it never adds new runtime facts. No raw DB rows, no secrets — Layer 7 is
     unchanged.
  2. **The Constitution is ALWAYS first** (`base/LIFE_NAVIGATOR_CONSTITUTION.md`, inherited verbatim by
     every agent, per README and the asset header `constitution-1.0`).
  3. The `AdvisorLLM` Protocol contract + `generate()` signature (advisor_llm.py:113/148).
  4. The Gemini key staying Fly-only; the composer is deterministic and never calls an LLM.

## 7. Why this is safe to plan now

The composer is a pure function over files already in the repo. It introduces no behavior change until a
flag routes `generate()` through it, and even then the golden-diff gate (Orchestrator Plan, Phase 1)
requires the composed advisor SYSTEM to equal today's `ADVISOR_SYSTEM` before it may serve a live turn.
Every other agent in `AGENT_RUNTIME_REGISTRY.md` then composes through the same engine — one prompt model,
one Constitution, one version scheme, for all of LIOS.
