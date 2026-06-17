# Multi-Model Architecture Blueprint — Provider-Agnostic Model Layer

**Date:** 2026-06-16
**Status:** Design — extends the EXISTING advisor seam (`AdvisorLLM` Protocol), not a greenfield rewrite
**Goal:** Let LifeNavigator use Anthropic, Google (AI Studio + Vertex), OpenAI, NVIDIA, and future providers **without business-logic changes**. The orchestrator, validator, repair, composer, and `ADVISOR_SYSTEM` prompt never learn which provider answered.

**Grounded in what already exists:**

- `app/services/advisor_llm.py` — the `AdvisorLLM` Protocol (`generate(context, plan) -> Optional[dict]`), with `GeminiAdvisorLLM` (AI Studio) and `VertexClaudeAdvisorLLM` (Anthropic on Vertex) already implementing it. **This is the seam.** The Claude Control Experiment proved a model can be swapped here with byte-identical pipeline.
- `app/dependencies.py` — `get_advisor_orchestrator` selects the impl behind `USE_VERTEX_CLAUDE`. **This is the wiring point** the registry/router will replace.
- `app/config.py` — env-driven model selection (`gemini_generation_model`, etc.).
- `app/clients/gemini.py` — the transport client (`generate_with_usage`, retry, usage telemetry) the adapter wraps.

**Core principle (proven, not aspirational):** trust invariants are **model-agnostic**. The number-gate validator, repair, and compliance gate run in front of _every_ provider. The Claude experiment is the proof: raw Claude produced **3 fabrications**; the same prompt routed through the LN pipeline produced **0**. The platform made Claude _safer_. Any new provider inherits that spine for free — that is the whole point of keeping the seam narrow.

---

## 0. The narrow seam (why this is cheap to build)

Everything multi-model lives behind one Protocol that already exists:

```python
class AdvisorLLM(Protocol):
    async def generate(self, context: Any, plan: dict[str, Any]) -> Optional[dict[str, Any]]: ...
```

Two contracts the whole design relies on and **must not change**:

1. **`generate` returns `None` on any failure** (never raises). `None` → orchestrator runs the deterministic rule-based response. This is the existing fallback contract; the fallback _hierarchy_ (§5) is just "try the next model before returning `None`."
2. **`context.prompt_dict()` + `plan` are the only inputs.** The model sees guardrails; it never reaches into DB/services. Adapters are pure transport + JSON parse (`parse_advisor_json`). This is why a swap is attributable to the model alone.

The current `GeminiAdvisorLLM` and `VertexClaudeAdvisorLLM` are **already two adapters behind this seam.** The blueprint generalizes them, adds a registry + router in front, and keeps the seam byte-identical.

---

## 1. Provider abstraction — `ModelClient` (generalize the existing adapters)

Today the two impls mix three concerns: prompt construction (identical, duplicated), transport (provider-specific), and the `AdvisorLLM` contract. We split transport into a thin **`ModelClient`** interface and keep one shared advisor adapter on top, so the duplicated `ADVISOR_SYSTEM` + prompt-build + `parse_advisor_json` lives in exactly one place.

```python
# app/clients/model_client.py  (new — the transport interface)
class ModelClient(Protocol):
    id: str                      # registry model id, e.g. "vertex-claude-opus-4-1"
    @property
    def available(self) -> bool: ...                       # config/creds present (no token spend)
    async def complete(self, *, system: str, user: str,
                       temperature: float, max_tokens: int = 2048
                       ) -> tuple[str, dict[str, int]]:     # (raw_text, usage)
        ...
```

`usage` is the existing `{prompt_tokens, completion_tokens, total_tokens}` shape both adapters already emit — feeds `CostMeter` unchanged.

**One adapter per provider** (each ~30 lines, transport only — extract from today's classes):

| Adapter                 | Provider / surface                                | Extracted from / based on                                               |
| ----------------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| `GeminiAIStudioClient`  | Google AI Studio (`generativelanguage…`)          | wraps existing `clients/gemini.py` `generate_with_usage`                |
| `VertexAnthropicClient` | Anthropic on Vertex (`publishers/anthropic`)      | the `:rawPredict` body in `VertexClaudeAdvisorLLM`                      |
| `VertexGoogleClient`    | Gemini on Vertex (`publishers/google`)            | mirror of the Vertex transport, Google body                             |
| `OpenAIClient`          | OpenAI `/v1/chat/completions` (or Azure)          | new; system+user → `messages`, `usage.{prompt,completion}_tokens`       |
| `AnthropicDirectClient` | api.anthropic.com (non-Vertex)                    | new; same body shape as Vertex Anthropic minus `anthropic_version` host |
| `NvidiaNIMClient`       | NVIDIA NIM / build.nvidia.com (OpenAI-compatible) | reuse `OpenAIClient` body, different base URL + key                     |

Then **one** advisor adapter consumes any `ModelClient`:

```python
# app/services/advisor_llm.py  (generalized — replaces the two bespoke classes)
class ModelAdvisorLLM:                       # implements AdvisorLLM
    prompt_version = ADVISOR_PROMPT_VERSION
    def __init__(self, client: ModelClient) -> None:
        self._c = client
        self.last_usage, self.last_raw, self.last_model_id = {}, "", client.id

    @property
    def available(self) -> bool:
        return self._c.available

    async def generate(self, context, plan):
        self.last_usage, self.last_raw = {}, ""
        if not self.available:
            return None
        user = json.dumps({"guardrails": context.prompt_dict(), "constraints": plan},
                          ensure_ascii=False, default=str)
        prompt = (f"GUARDRAILS_AND_CONSTRAINTS:\n{user}\n\n"
                  "Reason within these guardrails and return the JSON object now.")
        try:
            raw, usage = await self._c.complete(system=ADVISOR_SYSTEM, user=prompt,
                                                temperature=_temperature_for(plan))
            self.last_usage, self.last_raw = usage, raw or ""
            return parse_advisor_json(raw)           # SAME tolerant parser, all providers
        except Exception:                            # SAME never-raise → None contract
            return None
```

`GeminiAdvisorLLM` / `VertexClaudeAdvisorLLM` become thin back-compat shims (or are deleted) — `ModelAdvisorLLM(GeminiAIStudioClient(...))` is byte-identical behavior to today's `GeminiAdvisorLLM`. **Migration is mechanical and the benchmark guards it.**

Provider differences (auth header, endpoint shape, response JSON path, `anthropic_version`) are confined to `*.complete()`. Business logic above the seam is untouched.

---

## 2. Model registry — declarative data, not code

A registry is a **config artifact** (JSON, loaded at startup; later a Supabase table for live edits without redeploy). Adding a model = adding a row. No code change to route to it.

Each entry carries identity, the provider+adapter to instantiate, the **capability classes** it qualifies for (§3), economics, and the **benchmark score that gated its enablement** (§7).

```jsonc
// config/model_registry.json
{
  "version": "2026-06-16",
  "default_class": "advisor.balanced",
  "models": [
    {
      "id": "gemini-2.5-flash",
      "provider": "google_ai_studio",
      "adapter": "GeminiAIStudioClient",
      "model_name": "gemini-2.5-flash", // pinned/version-managed (§6)
      "capability_classes": [
        "advisor.balanced",
        "advisor.fast",
        "classify.fast",
        "compliance.gate",
      ],
      "context_window": 1048576,
      "cost": { "input_per_mtok": 0.3, "output_per_mtok": 2.5 },
      "latency": { "p50_ms": 12700, "p95_ms": 28000 },
      "enabled": true,
      "benchmark": {
        "harness": "advisor-50x5-judge",
        "version": "v6",
        "overall": 6.66,
        "trust": 8.5,
        "actionability": 4.7,
        "fabrications": 0,
        "fallbacks": 5,
        "evaluated_at": "2026-06-15",
        "status": "PASS_DEFAULT",
      },
    },
    {
      "id": "vertex-claude-opus-4-1",
      "provider": "vertex_anthropic",
      "adapter": "VertexAnthropicClient",
      "model_name": "claude-opus-4-1@20250805", // PINNED version (§6)
      "endpoint": { "project_env": "VERTEX_PROJECT", "region": "global", "publisher": "anthropic" },
      "capability_classes": [
        "advisor.premium",
        "decision.analysis",
        "tradeoffs",
        "critic",
        "report.writer",
        "executive.review",
      ],
      "context_window": 200000,
      "cost": { "input_per_mtok": 15.0, "output_per_mtok": 75.0 },
      "latency": { "p50_ms": 61000, "p95_ms": 79000 },
      "enabled": true,
      "benchmark": {
        "harness": "advisor-50x5-judge",
        "version": "v6",
        "overall": 7.3,
        "trust": 8.2,
        "actionability": 6.2,
        "fabrications": 0,
        "fallbacks": 6,
        "evaluated_at": "2026-06-15",
        "status": "CONDITIONAL_PASS_SELECTIVE",
      },
    },
    {
      "id": "vertex-claude-sonnet",
      "provider": "vertex_anthropic",
      "adapter": "VertexAnthropicClient",
      "model_name": "claude-sonnet-4@PENDING",
      "capability_classes": [], // EMPTY until it passes the harness
      "enabled": false, // shadow-only (§8) until benchmark ≥ 7.5
      "benchmark": { "status": "UNTESTED_NOT_PROVISIONED" },
    },
    {
      "id": "openai-gpt-frontier",
      "provider": "openai",
      "adapter": "OpenAIClient",
      "model_name": "gpt-<pinned>",
      "capability_classes": [],
      "enabled": false, // must clear the harness before any class
      "benchmark": { "status": "UNTESTED" },
    },
  ],
}
```

**Registry rules (invariants):**

- A model with `enabled: false` or empty `capability_classes` is **never routable** (shadow-only).
- `benchmark.status` of `UNTESTED*` cannot be promoted to a routable class — enforces the hard rule from `MODEL_ROLE_QUALIFICATION.md`: _no model earns a role without benchmark evidence on the real harness._
- `default_class` is the safety floor the router falls back to when no signal matches.

Loaded once into a `ModelRegistry` service; `dependencies.py` builds adapters lazily from rows (lazy instantiation — the module-scope-init crash pattern noted in repo memory applies; construct clients inside the provider, not at import).

---

## 3. Capability classes — the routing target

Routing **never names a model.** It names a **capability class**; the registry resolves the class to the best enabled model. This is the indirection that makes the system provider-agnostic — swap the model behind a class and no caller changes. (See `MODEL_CAPABILITY_CLASS_ARCHITECTURE.md` for the full class taxonomy; this blueprint consumes it.)

Classes group _roles with the same quality/latency/cost profile_ (derived from `LIOS_MODEL_ROUTING_PROPOSAL.md` and `MODEL_ROLE_QUALIFICATION.md`):

| Capability class                                                                | Profile                              | Today resolves to                                     | Evidence                                 |
| ------------------------------------------------------------------------------- | ------------------------------------ | ----------------------------------------------------- | ---------------------------------------- |
| `advisor.premium`                                                               | max reasoning, latency-tolerant      | `vertex-claude-opus-4-1`                              | Claude LN 7.30 vs 6.66 (+0.64)           |
| `advisor.balanced`                                                              | default interactive turn             | `gemini-2.5-flash`                                    | trust 8.5, p50 12.7s, 0 fab              |
| `advisor.fast` / `classify.fast` / `compliance.gate`                            | cheap, deterministic-ish, every-turn | `gemini-2.5-flash` (→ Flash-Lite after it benchmarks) | quality lift has no surface here         |
| `decision.analysis`, `tradeoffs`, `critic`, `report.writer`, `executive.review` | high-stakes, low-frequency, async    | `vertex-claude-opus-4-1` (→ Sonnet on pass)           | framing/insight/actionability Claude-led |

A class resolves to the **highest-benchmark-score enabled model whose `capability_classes` contains it** (ties broken by lower cost, then lower latency). Adding Sonnet to `advisor.premium` and enabling it after it passes the harness silently promotes it ahead of Opus — zero code change.

---

## 4. Routing engine — class + signals → model

```python
# app/services/model_router.py  (new — replaces the USE_VERTEX_CLAUDE if/else)
class ModelRouter:
    def __init__(self, registry: ModelRegistry): self._reg = registry

    def select(self, capability_class: str, signals: RouteSignals) -> ModelClient:
        # 1) signals may UPGRADE the class (never silently downgrade safety)
        cls = self._apply_signals(capability_class, signals)
        # 2) registry resolves class -> enabled, benchmark-passed model
        model = self._reg.resolve(cls) or self._reg.resolve(self._reg.default_class)
        return self._reg.client_for(model)     # lazily-built adapter
```

`RouteSignals` are computed by the existing pipeline (no new infra): the `plan["intent"]`, the discovery coverage, and a **`high_stakes` flag** (irreversible / large-dollar / emotionally-weighted decision — the Classifier role computes it, `classify.fast`).

Routing rules (declarative, from the proposal):

- `advisor.balanced` + `high_stakes` → upgrade to `advisor.premium` (the hybrid escalation; **escalation rate is the cost dial**).
- `intent == "structured"` / classification / compliance → stay in the cheap class regardless of stakes (no reasoning surface to improve).
- A `repair_note` present (validator rejected the prior draft) does **not** change class — same model retries under repair, exactly as today.

The router replaces the `if use_claude: … else: …` block in `get_advisor_orchestrator`. The orchestrator receives a `ModelAdvisorLLM` chosen per-request; it can't tell which provider it got. `USE_VERTEX_CLAUDE` survives as a _coarse override_ (forces `advisor.premium`) for A/B and the existing experiment.

---

## 5. Fallback hierarchy — reuse the `None` → deterministic contract

The existing contract is "model returns `None` → deterministic rule-based response." The hierarchy generalizes it to **try cheaper classes before giving up**, ending at the deterministic floor:

```
premium  ──None/timeout──►  balanced  ──None──►  fast  ──None──►  deterministic rule-based
(Claude)                    (Gemini)            (Gemini Flash-Lite)   (NullAdvisorLLM path)
```

Implemented as a `FallbackChain(AdvisorLLM)` that wraps an ordered list of `ModelAdvisorLLM` and returns the first non-`None` — and returns `None` itself when all fail, **preserving the exact orchestrator contract** (the rule-based engine is the terminal node). The chain is itself an `AdvisorLLM`, so the orchestrator is unchanged.

Trust spine note: the **validator/repair runs after the chain returns a candidate**, and a validator rejection that survives repair is itself a `None` → next tier / deterministic. So fallback never bypasses trust. Latency budget caps the chain (e.g. premium gets one attempt before dropping to balanced on a 30s budget) so a slow premium model can't hang an interactive turn.

---

## 6. Version management — pinned versions, safe upgrades

- **Pin every model version in the registry** (`claude-opus-4-1@20250805`, `gemini-2.5-flash`, `gpt-<dated>`). Never route to a floating alias in production — a silent provider-side model update would invalidate the benchmark that gated it. (Repo memory: a `gemini-default` alias bug already caused a 429 wall — pinning prevents the class.)
- **A version is just a new registry row.** `claude-opus-4-2@<date>` is added with `enabled: false` and empty classes, benchmarked, then promoted — the _same_ process as a new provider (§8). The old version stays enabled until the new one passes, so there is always a known-good fallback.
- **Upgrade path:** new-version row → shadow → benchmark on the 50×5 harness → if `overall ≥` incumbent and `fabrications == 0`, add it to the incumbent's classes and demote the old version (move it down the fallback chain, then disable). Rollback = flip `enabled` back. No deploy needed once the registry is a table.

---

## 7. Evaluation framework — the gate every model/version must pass

**The existing 50-scenario / 5-judge benchmark is the registry-enable gate.** Nothing reaches a routable capability class without a measured score on the _real_ harness — the hard rule from `MODEL_ROLE_QUALIFICATION.md`.

Reuse, unchanged:

- `apps/web/benchmark-capture-ln.mjs` — drives the LIVE advisor (`/v1/life/discovery/chat`) with all 50 scenarios from `docs/advisor-benchmark/scenarios.json`, one fresh synthetic user each, recording verbatim output + `llm_status` + `prompt_version` + latency, with per-scenario checkpointing and cleanup. To benchmark a candidate, deploy it behind a flag (or shadow class) and point the harness at it — exactly how the Claude control ran.
- **The 5-judge rubric** scoring overall + trust, actionability, insight, framing, tradeoff, understanding, context-usage, question-quality, personalization, executive-presence, and **fabrication count**.

**Enable gate (a model joins a routable class only if all hold):**

1. `overall ≥` the model currently serving that class (or ≥ 7.5 for a _premium_ class, per the proposal's Sonnet bar).
2. `fabrications == 0` on all 50 — non-negotiable; the trust spine must hold under the new model.
3. trust score not materially below the incumbent (the Claude −0.3 trust dip was acceptable _because_ fabrications stayed 0 — score it the same way).
4. latency/cost recorded so the router's tie-break and the escalation-rate economics are grounded in measured numbers, not pricing pages.

The benchmark JSON is the provenance attached to the registry row's `benchmark` block. Re-run on every version bump (§6).

---

## 8. Model replacement / introduction process (shadow → enable → ramp → promote)

The same pipeline for a new provider, a new version, or swapping Opus→Sonnet:

```
1. ADD ROW         registry row, enabled:false, capability_classes:[]   (shadow-only, unroutable)
2. SHADOW          route a copy of live high-stakes turns to it async; capture output, latency, usage
                   (no user impact; never on the response path)
3. BENCHMARK       run benchmark-capture-ln.mjs + 5-judge on the candidate behind a flag
4. GATE            apply §7 enable gate (overall, 0 fabrications, trust, economics)
5. CANARY          add to ONE capability class; route a % (start small) via the router's
                   percentage split; watch live trust/fallback/latency telemetry
6. PROMOTE         raise % to 100 for that class; demote the prior model into the fallback chain (§5)
7. RETIRE          once the new model is stable, disable the old row (it stays as a rollback)
```

The percentage split lives in the router (a `traffic` field per (class, model)), so a canary is a registry edit, not a deploy. Rollback at any step = flip `enabled`/`traffic` back. This is the productization of exactly what the Claude Control Experiment did manually (`USE_VERTEX_CLAUDE` was step 3+5 done by hand).

---

## Trust invariants stay model-agnostic (the core guarantee)

The number-gate validator, repair loop, and compliance gate sit **above the seam, below the orchestrator** — they run on the parsed `dict` regardless of which provider produced it. This is not a hope; it is measured:

- Raw Claude (no platform): **3 fabrications, 8.00 overall.**
- Same prompt through the LN pipeline: **0 fabrications, 7.30 overall** — the validator caught all 3 (`fin-01`, `car-06`, `crs-08`).
- The platform added **no measurable quality drag** on turns it passed (enhanced-only 8.08 ≈ raw 8.00); its only cost was the number-gate fallbacks, which are recoverable engineering, not a model property.

**Therefore:** any provider added under this blueprint inherits the identical trust spine. A new model can change quality, latency, and cost; it **cannot** change whether numbers are grounded, advice is in-scope, or relationships are real — those are enforced after `generate()` returns, by code that doesn't know the provider. The router/registry/adapters are _quality+economics_ machinery; the validator/number-gate/compliance are _safety_ machinery, and they are deliberately on opposite sides of the seam. This is what made Claude safer, and it is what will make GPT/NVIDIA/the-next-frontier-model safe on day one.

---

## Component diagram

```
                          ┌─────────────────────────────────────────────────────────┐
                          │                  Business logic (UNCHANGED)              │
                          │   AdvisorOrchestrator · ContextBuilder · plan/intent     │
                          │   guardrails: context.prompt_dict()  +  plan{}           │
                          └───────────────────────────┬─────────────────────────────┘
                                                      │ AdvisorLLM.generate(context, plan)
                                                      ▼   (the EXISTING seam — narrow)
        ┌───────────────────────────────────────────────────────────────────────────────────┐
        │                              MULTI-MODEL LAYER (new, swappable)                      │
        │                                                                                     │
        │   RouteSignals (intent, coverage, high_stakes)                                      │
        │        │                                                                            │
        │        ▼                                                                            │
        │   ┌──────────────┐   class    ┌───────────────┐   model id   ┌──────────────────┐   │
        │   │ ModelRouter  │──────────► │ ModelRegistry │────────────► │ FallbackChain    │   │
        │   │ class+signals│  (target)  │ (JSON/table:  │  (resolve)   │ premium→balanced │   │
        │   │  → class     │            │  id,provider, │              │  →fast→det.      │   │
        │   └──────────────┘            │  classes,cost,│              └────────┬─────────┘   │
        │                               │  bench,enabled)│                      │ ModelAdvisorLLM
        │                               └───────────────┘                      ▼ (per provider)
        │                                              ┌──────────────────────────────────────┐│
        │                                              │  ModelClient adapters (transport only)││
        │                                              │  Gemini(AIStudio) VertexAnthropic     ││
        │                                              │  VertexGoogle  OpenAI  Anthropic NIM  ││
        │                                              └──────────────────────────────────────┘│
        └───────────────────────────────────────┬───────────────────────────────────────────┘
                                                │ returns parsed dict | None
                                                ▼
                          ┌─────────────────────────────────────────────────────────┐
                          │        TRUST SPINE (model-AGNOSTIC, UNCHANGED)            │
                          │  number-gate validator → repair → compliance gate        │
                          │  reject survives repair ⇒ None ⇒ next tier / deterministic│
                          │  (proved: raw Claude 3 fab → 0 fab inside LN)             │
                          └─────────────────────────────────────────────────────────┘
                                                ▲                         │
                  ┌─────────────────────────────┘                         ▼
                  │  EVAL GATE (offline, controls registry.enabled):   response
                  │  benchmark-capture-ln.mjs · 50 scenarios · 5 judges
                  │  must PASS (overall ≥ class incumbent, 0 fabrications) to enable
                  └────────────────────────────────────────────────────
```

---

## What changes vs. what stays

| Layer                                                          | Today                                                | After                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| Orchestrator / validator / repair / compose / `ADVISOR_SYSTEM` | —                                                    | **unchanged**                                         |
| `AdvisorLLM` Protocol + `None`→deterministic contract          | exists                                               | **unchanged** (FallbackChain is an `AdvisorLLM`)      |
| Model selection                                                | `if USE_VERTEX_CLAUDE` in `get_advisor_orchestrator` | `ModelRouter.select(class, signals)`                  |
| Provider adapters                                              | 2 bespoke classes, duplicated prompt                 | N thin `ModelClient` transports + 1 `ModelAdvisorLLM` |
| Adding a model                                                 | code change                                          | **registry row**                                      |
| Choosing a model                                               | code/env                                             | **capability class + registry resolution**            |
| Enabling a model                                               | manual flag                                          | **benchmark gate → `enabled`/`traffic`**              |

**Net:** a new provider is a ~30-line transport adapter + a registry row + a benchmark run. No business-logic change, ever — and the trust spine guarantees safety on arrival.
