# LIOS Phase 9 — Model Independence

**Status legend:** `EXISTS` (built + in the codebase today) · `PARTIAL` (built but incomplete or
default-off) · `NEW` (roadmap, not yet built).

**Headline:** This is one of the **most-complete** LIOS layers. The hard architectural commitment —
_no business logic depends on a model name_ — is already enforced in code. Adding a provider (OpenAI,
NVIDIA NIM, a local model) is a **new adapter + a registry row**, not a refactor.

---

## 1. The Requirement

> Every capability must support **cloud / local / hybrid / future** models, and **no business logic
> may depend on** `Gemini` / `Claude` / `OpenAI` / `NVIDIA` / any specific model name.

Two invariants make this true:

1. **Business logic references ROLES and capability classes, never model IDs.** The orchestrator,
   validator, repair loop, prompt composer, and domain services ask for _"the model for
   `finance_high_stakes`"_ — they never name Gemini or Claude.
2. **A single swap point** (the model registry) maps `ROLE → model`, and a single uniform interface
   (`AdvisorLLM` Protocol) makes every model interchangeable to callers.

---

## 2. What Already Exists

### 2.1 `AdvisorLLM` Protocol — the uniform model interface · `EXISTS`

`apps/lifenavigator-core-api/app/services/advisor_llm.py`

```python
class AdvisorLLM(Protocol):
    async def generate(self, context: Any, plan: dict[str, Any]) -> Optional[dict[str, Any]]: ...
```

One method. Every model implements exactly this. Callers depend on the Protocol, not the
implementation. Two live implementations and one null implementation exist today:

| Implementation           | Provider                | Transport               | Status                                 |
| ------------------------ | ----------------------- | ----------------------- | -------------------------------------- |
| `GeminiAdvisorLLM`       | Google AI Studio        | existing `GeminiClient` | `EXISTS` (default)                     |
| `VertexClaudeAdvisorLLM` | Anthropic via Vertex AI | `httpx` rawPredict      | `EXISTS` (flagged `USE_VERTEX_CLAUDE`) |
| `NullAdvisorLLM`         | none                    | n/a — returns `None`    | `EXISTS` (deterministic-only mode)     |

Critical proof of independence: `VertexClaudeAdvisorLLM` uses the **identical** `ADVISOR_SYSTEM`
prompt, identical user-prompt construction, and identical `parse_advisor_json` as the Gemini path
(see the class docstring at `advisor_llm.py:246`). _"Nothing else in the pipeline changes — the
orchestrator, validator, repair, compose, and the prompt are untouched — so a benchmark delta is
attributable to the MODEL alone."_ That is the literal definition of model independence, and it is
already wired.

Every adapter shares the same failure contract: **never raises** → returns `None` → orchestrator
falls back to the deterministic rule-based response. This is provider-agnostic too.

### 2.2 Model Registry — the single swap point · `EXISTS`

`apps/lifenavigator-core-api/app/services/model_registry.py`

The registry is the **single source of truth** mapping ROLES → models, with provider-agnostic
metadata, kill switches, and plan limits. From its module docstring:

> _"Business logic must reference ROLES (e.g. `finance_high_stakes`), never raw model names."_

- **`MODELS`** — per-model metadata keyed by an opaque registry key (`gemini_flash`,
  `claude_opus_4_8`, `health_safety_fallback`, …). Each row carries `provider`, `model_id`,
  `enabled_flag`, `cost_estimate`, `latency_budget_ms`, `tiers`, `benchmark_score`, `trust_score`,
  `last_evaluated`. **None of this is provider-specific in shape** — a future OpenAI/NVIDIA/local row
  has the exact same fields.
- **`ROLES`** — `{role: {primary, fallback}}`. Business code names the _role_; the registry resolves
  it to a model key. Roles in code today: `classification`, `advisor_general`, `finance_high_stakes`,
  `health_high_stakes`, `career`, `education`, `family`, `report_writer`, `executive_review`,
  `critic` (defined but disabled — benchmark pending).
- **Kill switches** (`flag()`, `model_enabled()`, `is_role_enabled()`) — every premium route and the
  router itself default **OFF**, so with no env set production keeps its existing single-model path.

To swap the model serving `finance_high_stakes` from Claude to a local model, you change **one
string** in `ROLES["finance_high_stakes"]["primary"]` (or set it via env) — **zero** business-logic
edits.

### 2.3 Capability Router — role selection + graceful fallback · `EXISTS` (default-off) → `PARTIAL`

`apps/lifenavigator-core-api/app/services/model_router.py`

`ModelRouter.route(...)` takes `domain / risk / tier / budget`, picks a **ROLE** (`_role_for`),
resolves it to an **enabled** model, and produces a `RoutingDecision` with a `primary_llm` and
`fallback_llm` (both `AdvisorLLM` instances). Fallback is automatic and user-invisible when a premium
model is unavailable (kill switch off, tier ineligible, budget exhausted, creds missing). Marked
`PARTIAL` only because `MODEL_ROUTER_ENABLED` defaults OFF — the code is complete and unit-testable
over fakes (it takes an injected `llm_factory`); it is simply gated for safe rollout.

### 2.4 Per-model LLM factory (DI) · `EXISTS`

`apps/lifenavigator-core-api/app/dependencies.py:310` (`_llm_factory` inside `get_advisor_orchestrator`)

```python
def _llm_factory(model_key: str) -> Any:
    spec = MODELS.get(model_key)
    if not spec: return None
    if spec["provider"] == "google_aistudio":   return GeminiAdvisorLLM(GeminiClient(...generation_model=spec["model_id"]...))
    if spec["provider"] == "vertex_anthropic":   return VertexClaudeAdvisorLLM(...model=spec["model_id"]...)
    return None
```

The factory **dispatches on `spec["provider"]`**, not on a hardcoded name. Each new provider adds one
`if` branch returning a new adapter — the router and orchestrator never change. This is the
provider-adapter pattern, already realized.

---

## 3. The Provider-Adapter Pattern

```
                business logic  ──asks for──►  ROLE (e.g. "finance_high_stakes")
                       │
                       ▼
                 model_registry  ──resolves──►  model_key (e.g. "claude_opus_4_8")
                       │                              │
                       ▼                              ▼
                  ModelRouter  ──builds via──►  _llm_factory(model_key)
                                                      │  dispatch on spec["provider"]
                       ┌──────────────┬───────────────┼───────────────┬──────────────┐
                       ▼              ▼               ▼               ▼              ▼
                GeminiAdvisorLLM  VertexClaude…  OpenAIAdvisorLLM  NimAdvisorLLM  LocalAdvisorLLM
                   EXISTS           EXISTS            NEW              NEW            NEW
                       └──────────────┴───────────────┴───────────────┴──────────────┘
                                   all implement  AdvisorLLM.generate()
```

| Adapter                  | Provider                          | Status   | Work to add                                                                                                            |
| ------------------------ | --------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------- |
| `GeminiAdvisorLLM`       | Google (Flash / Flash-Lite / Pro) | `EXISTS` | —                                                                                                                      |
| `VertexClaudeAdvisorLLM` | Anthropic Claude Opus via Vertex  | `EXISTS` | —                                                                                                                      |
| `OpenAIAdvisorLLM`       | OpenAI (GPT-class)                | `NEW`    | one class implementing `AdvisorLLM` + a `provider:"openai"` branch in `_llm_factory` + a `MODELS` row + benchmark PASS |
| `NimAdvisorLLM`          | NVIDIA NIM                        | `NEW`    | same shape                                                                                                             |
| `LocalAdvisorLLM`        | Ollama / llama.cpp                | `NEW`    | same shape (see Phase 10 / desktop)                                                                                    |

**The contract a new adapter must honor (all already demonstrated by the two live adapters):**

1. Implement `async def generate(self, context, plan) -> Optional[dict]`.
2. Use the shared `ADVISOR_SYSTEM` prompt and the shared `parse_advisor_json` — do not invent your
   own prompt.
3. **Never raise** — any failure returns `None` (the orchestrator falls back).
4. Populate `last_usage` / `last_raw` for telemetry.
5. Register a `MODELS` row + a `provider` dispatch branch in `_llm_factory`. **No other file
   changes.**

---

## 4. Benchmark-as-Enable-Gate · `PARTIAL`

**Rule: no model serves a role until a benchmark PASS earns it.** Evidence and policy live in
`docs/model-routing/` and `docs/advisor-benchmark/MULTI_MODEL_ARCHITECTURE_BLUEPRINT.md`.

This is enforced structurally in the registry today:

- Each `MODELS` row carries `benchmark_score`, `trust_score`, `last_evaluated`. Live measured values
  exist for the benchmarked models (e.g. `gemini_flash` 6.66/8.5, `gemini_2_5_pro` 7.60/8.7,
  `claude_opus_4_8` 8.84/9.3, all `last_evaluated: 2026-06-16`). Untested models read
  `benchmark_score: None, last_evaluated: "untested"`.
- **Negative evidence is honored:** `claude_opus_4_7` is _deliberately absent_ —
  _"benchmark showed it unreliable (timeouts). Do not add."_ (`model_registry.py:63`).
- **Roles disable themselves until earned:** the `critic` role is defined but
  `_ROLE_ENABLED_DEFAULT["critic"] = "false"` — _"benchmark pending — keep off until it earns it."_
- Premium models stay behind a per-model `enabled_flag` (`CLAUDE_OPUS_4_8_ENABLED`,
  `GEMINI_PRO_ADVISOR_ENABLED`) AND `PREMIUM_ROUTING_ENABLED`, both default OFF.

`PARTIAL`, not `EXISTS`, because the gate is currently a **human discipline backed by data fields +
kill switches** rather than an automated CI check. The `NEW` increment is to make it programmatic: a
helper such as `model_qualifies_for_role(model_key, role)` returning `False` when
`benchmark_score is None` or below a per-role threshold, called from `ModelRouter._resolve`, so an
unbenchmarked model **cannot** be routed even if its flag is on.

---

## 5. The Trust Spine — the Model-Agnostic Safety Floor · `EXISTS`

The trust spine runs **regardless of which model produced the output**. It treats every model as
untrusted and validates the result:

| Component                      | File                                                                                              | Role                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Output validator               | `app/services/advisor_validator.py`                                                               | Rejects/repairs fabricated numbers, ungrounded goal-relationship claims, persistence attempts, malformed JSON |
| Number gate                    | `app/services/advisor_math.py` (`verify_derivations`)                                             | Re-computes every number the model wrote from the user's own operands; mismatch → reject                      |
| Medical / health safety        | `app/services/medical_safety.py` + `model_router.detect_health_urgent` / `health_safety_response` | Deterministic, runs **before any LLM**, never depends on a model                                              |
| Compliance / trust-safety gate | `app/services/trust_safety.py`                                                                    | Advice-scope and compliance gating                                                                            |

**Proof of model-agnosticism:** the validator and number gate **caught Claude's fabrications** in the
control experiment — exactly as they catch Gemini's. The safety floor does not care who spoke; it
re-derives the math, checks for ungrounded relationship assertions (`advisor_validator.py:_RELATION`
/ `_RELATION_ASSERT`), and forces `should_persist = False`. The health-urgent detector
(`model_router.py:60`) is pure regex + a deterministic reply — it would fire identically in front of
an OpenAI, NVIDIA, or local model.

This is why adding a new provider is **safe**: a new model can only ever be _more or less good_, never
_dangerous_ — the deterministic floor is the same for all of them and is the thing business logic
actually trusts.

---

## 6. Honest Gaps (`NEW`)

| Gap                           | Today                                                                                          | To close                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Non-Google/Anthropic adapters | only `GeminiAdvisorLLM`, `VertexClaudeAdvisorLLM`                                              | add `OpenAIAdvisorLLM`, `NimAdvisorLLM`, `LocalAdvisorLLM` behind the same Protocol + factory branch |
| Local-model path              | none                                                                                           | `LocalAdvisorLLM` (Ollama/llama.cpp) — registry config change only (see Phase 10)                    |
| Benchmark gate automation     | data fields + kill-switch discipline (`PARTIAL`)                                               | programmatic `model_qualifies_for_role` enforced in `_resolve`                                       |
| Durable usage ledger          | `InMemoryUsageLedger` (`model_router.py:106`)                                                  | DB-backed, RLS-scoped ledger (migration noted in code)                                               |
| Provider-agnostic embeddings  | embeddings flow through `GeminiClient` (`gemini-embedding-001`) in the Rust worker + retriever | an embedding registry analogous to `MODELS` so local/other embedding models swap the same way        |
| Router default                | `MODEL_ROUTER_ENABLED=false`                                                                   | flip on after benchmark-gate automation + ledger land                                                |

---

## 7. Verdict

The model-independence architecture is **built and proven**, not aspirational:

- `EXISTS` — uniform `AdvisorLLM` Protocol; two live provider adapters using an identical pipeline;
  the registry as the single ROLE→model swap point; provider-dispatch factory; the model-agnostic
  trust spine (validated against two different model families).
- `PARTIAL` — capability router (complete, default-off for staged rollout); benchmark-as-gate
  (enforced by data + discipline, not yet automated).
- `NEW` — OpenAI / NVIDIA / local adapters; embedding registry; durable ledger; automated gate.

Business logic already names **roles and capabilities, never models**. The remaining work is additive
(new adapters slot behind the existing interface) — there is no architectural debt to unwind.
