# Model Capability Class Architecture

**Date:** 2026-06-15
**Status:** Architecture spec — grounded in `EXECUTIVE_DECISION_MEMO.md` (L), `LIOS_MODEL_ROUTING_PROPOSAL.md` (H), the Claude Control Experiment, and the V2–V6 benchmark arc.
**Code seam:** `app/services/advisor_llm.py` (`AdvisorLLM` Protocol), `app/dependencies.py` (`USE_VERTEX_CLAUDE` flag).

---

## Governing principle

> **LifeNavigator must never depend on specific model names. Models are assigned to capability classes, not vice versa.**

A **capability class** is a stable, named description of _what kind of cognition a task needs_ — its quality bar, latency tolerance, cost tolerance, trust requirement, and capability profile. It is defined in terms of the _work_, never the _vendor_. A **model** is a swappable implementation that, on benchmark evidence, satisfies a class's profile well enough to be assigned to it.

The consequences of this inversion are the whole point:

- **Classes are stable.** "We need conversation/tradeoff/decision-framing cognition for the advisor turn" is true regardless of which model is best this quarter. The set of classes changes only when the _product_ changes.
- **Model assignments are swappable config.** When Sonnet is benchmarked, when Gemini-3 ships, when a price changes — we re-point a class at a different model. No call site, prompt, validator, or orchestrator changes. The only thing that moves is a registry entry.
- **The benchmark decides assignment, not reputation.** A model earns a class by passing the _identical_ 50-scenario / 5-judge harness on that class's quality bar. Until then it is `inferred`, not `benchmarked`, and that flag is carried explicitly (see the assignment table).

This is the architectural expression of the memo's one-line verdict: _model capability is a primary, swappable lever; architecture is not._ Treating models as named dependencies would re-couple us to a vendor and re-litigate every call site on each swap. Treating them as class assignments makes a model swap a config change.

---

## The six capability classes

The classes below group the advisor program's role taxonomy (Discovery, Classification, Advisor, Decision Analysis, Tradeoffs, Critic, Report Writer, Executive Review, Compliance) into six cognition profiles. Several routing roles share one class because they demand the _same_ capability profile (e.g. Decision Analysis + Tradeoffs both sit in REASONING; Report Writer + Executive Review both sit in REPORT_WRITER).

### 1. CLASSIFICATION

_intent · extraction · routing · categorization_

- **Purpose:** Deterministic-ish labeling decisions on the per-turn path — classify intent and domain, extract structured facts, compute the high-stakes/stakes-tier flag that drives Advisor escalation, run the pass/fail Compliance gate (medical/legal/tax/advice-scope), and categorize for routing.
- **Quality bar:** Correct label / correct route / clean extraction. _Not_ a scored advisor criterion — there is no actionability, insight, or framing surface for a frontier model to improve. Accuracy and recall on the label, nothing more.
- **Latency tolerance:** **Lowest.** Sits in the request path _before_ the advisor turn; any latency here is added to every turn. Must feel instant.
- **Cost tolerance:** **Lowest.** Runs on every turn, highest-frequency path. The cheapest tier is the correct home.
- **Trust requirement:** **High (gate-level).** The Compliance member of this class is a hard safety gate; a missed block is a trust failure. But it gates, it does not generate — so it carries no fabrication surface.
- **Capability profile:** Fast structured-output, reliable instruction-following on a constrained label space, cheap at high volume. Frontier reasoning is _wasted_ here.

### 2. ADVISOR

_conversation · tradeoffs · recommendations · decision-framing_

- **Purpose:** The core interactive advisor turn — lead a real discovery conversation, frame the decision, surface genuine tradeoffs, take a grounded position, ask the single highest-leverage question. This is the benchmarked task (`ADVISOR_SYSTEM` in `advisor_llm.py`).
- **Quality bar:** **The product's headline bar — ≥ 7.5** (LIOS gate criterion). Benchmarked today at 6.66 (Gemini-V6) / 7.30 (Claude-in-pipeline). The uplift is concentrated in actionability (+1.5), insight (+0.9), question quality (+0.8), personalization (+0.8), executive presence (+0.8), framing (+0.6).
- **Latency tolerance:** **Tight on the common path** (interactive chat — 12.7s is usable, ~61s is an abandoned session), **but elastic on escalation** (a flagged high-stakes turn may accept a "thinking harder" wait).
- **Cost tolerance:** **Moderate, frequency-driven.** Runs on the majority of turns, so the default must be cheap; the escalation minority can be premium. Escalation rate is the cost dial.
- **Trust requirement:** **Highest. Zero fabrication, non-negotiable.** Trust held at 8.5 across V2→V6 with 0 fabrications. The number-gate validator sits in front of _every_ model on this class and is the reason a stronger model is safe to route here (raw Claude made 3 fabrications → 0 inside the pipeline).
- **Capability profile:** Strong conversational reasoning + decision-framing + tradeoff articulation, low temperature (grounded, not creative), reliable JSON structured output, _and_ a fast/cheap option for the default path with a high-quality option for escalation. This is inherently a **two-model class** (default + escalation) — which is exactly why the class abstraction matters: both are ADVISOR, assigned to different models.

### 3. REASONING

_complex decisions · scenario analysis · cross-domain · optimization_

- **Purpose:** Deliberate, high-stakes analytical work invoked on demand — Decision Analysis, Tradeoff discovery, scenario/optimization reasoning, cross-domain synthesis. The user enters a decision flow and expects a _considered_ answer.
- **Quality bar:** **Highest reasoning depth.** This is where decision-framing (6.7→7.3→8.4) and insight (6.1→7.0) separate models most. The deliverable's quality _is_ the reasoning quality.
- **Latency tolerance:** **High.** Low-frequency, deliberately invoked, not on every keystroke. ~61s is acceptable inside an analysis panel.
- **Cost tolerance:** **High per call, low volume.** Premium model justified because it runs only when the user enters a deliberate decision flow.
- **Trust requirement:** **Highest.** Same zero-fabrication spine as ADVISOR; the validator stays in front. A wrong number in a decision analysis is worse than in a chat turn.
- **Capability profile:** Best-available multi-step reasoning, scenario/tradeoff exploration, cross-domain synthesis, large-enough context to hold the decision's facts. Latency and cost are explicitly traded _for_ reasoning depth.

### 4. CRITIC

_review · challenge · validation · risk-detection_

- **Purpose:** A red-team / adversarial pass over a drafted recommendation or deliverable — catch weak logic, surface gaps, challenge assumptions, detect risk the author missed. Runs once per deliverable, off the interactive path.
- **Quality bar:** **High — find the flaw.** Maps to the insight uplift (+0.9): the criterion where a stronger model separates is exactly a critic's job (seeing what the first pass missed).
- **Latency tolerance:** **Fully async — never user-blocking.** Runs as a background pass after a draft exists.
- **Cost tolerance:** **Premium, very low volume** (one pass per generated deliverable).
- **Trust requirement:** **High.** A critic that hallucinates a flaw is worse than no critic. Its claims must be grounded in the draft it reviews. (Inferred class — no critic role in the benchmark yet.)
- **Capability profile:** Strongest reasoning + skepticism + gap-detection; ability to hold both the draft and its grounding context and find the contradiction. Reasoning-heavy, latency-irrelevant.

### 5. REPORT_WRITER

_executive · family-office · estate · retirement reports_

- **Purpose:** Long-form synthesis into a finished artifact — executive summaries, family-office reports, estate/retirement plans — plus the final Executive Review ("would a top advisor sign off"). Generated rarely, read carefully.
- **Quality bar:** **Highest writing + executive presence.** This is where the two largest model margins compound: executive presence (6.5→7.3→8.4) and actionability (4.7→6.2→8.5). Quality >> speed.
- **Latency tolerance:** **High.** ~61s+ acceptable; can stream or run in the background and notify. Reports are not chat turns.
- **Cost tolerance:** **Premium, low volume, high per-artifact value.** A carefully-read report justifies the best model per call.
- **Trust requirement:** **Highest.** A persisted, shareable, professionally-formatted document carrying a wrong number is the most damaging fabrication surface in the product. Validator + Executive Review gate both apply.
- **Capability profile:** Best long-form synthesis, executive tone/presence, structure and actionability, large context to hold the full domain picture; speed irrelevant.

### 6. RESEARCH

_document synthesis · large-context · knowledge discovery_

- **Purpose:** Synthesize across large bodies of source material — document intelligence, GraphRAG knowledge discovery, multi-document synthesis — to extract and surface what's relevant.
- **Quality bar:** **High recall + faithful synthesis** over a large input. Coverage and grounding matter more than rhetorical polish.
- **Latency tolerance:** **Moderate-to-high.** Often a background/ingestion-time job (e.g. discovery first-touch and document processing), not a blocking chat turn.
- **Cost tolerance:** **Cost-sensitive at volume** for high-frequency discovery/ingestion; premium acceptable for rare deep-synthesis runs. Frequency decides.
- **Trust requirement:** **High.** Synthesis must be faithful to sources — no invented findings. (Largely inferred; discovery first-touch is reasoned from the role being low-reasoning/high-frequency.)
- **Capability profile:** Large context window, faithful extraction/synthesis, strong retrieval grounding. Two sub-profiles by frequency: cheap/fast for high-volume discovery/ingestion; large-context/high-recall for rare deep synthesis.

---

## Class → required capability (the stable contract)

This table never moves on a model swap. It is the product's statement of _what each kind of work requires_.

| Class              | Quality bar                                                         | Latency tolerance                                  | Cost tolerance                                          | Trust requirement                           | Core capability profile                                                                          |
| ------------------ | ------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **CLASSIFICATION** | Correct label / route / extraction (not a quality-scored criterion) | Lowest — pre-turn path, added to every turn        | Lowest — every turn                                     | High (gate), no generation surface          | Fast cheap structured-output; reliable on constrained label space                                |
| **ADVISOR**        | ≥ 7.5 headline bar (today 6.66 / 7.30)                              | Tight default (~13s), elastic on escalation (~60s) | Moderate, frequency-driven; escalation rate is the dial | Highest — 0 fabrication, validator in front | Conversational reasoning + framing + tradeoffs; **two-model** (fast default + strong escalation) |
| **REASONING**      | Highest reasoning depth (decision-framing, insight)                 | High — deliberate, low-frequency                   | High per call, low volume                               | Highest — validator in front                | Best multi-step reasoning, scenario/cross-domain synthesis                                       |
| **CRITIC**         | High — find the flaw (insight)                                      | Fully async, never blocking                        | Premium, very low volume                                | High — grounded challenges only             | Strongest skeptical reasoning + gap/risk detection                                               |
| **REPORT_WRITER**  | Highest writing + executive presence + actionability                | High — streamable/background                       | Premium, low volume, high per-artifact value            | Highest — persisted/shareable artifact      | Long-form synthesis, executive tone, large context                                               |
| **RESEARCH**       | High recall + faithful synthesis                                    | Moderate-to-high (often background)                | Cost-sensitive at volume; premium for rare deep runs    | High — faithful to sources                  | Large context, faithful extraction/synthesis, retrieval grounding                                |

---

## Class → current best model (the swappable assignment)

This table is **config.** It changes whenever the benchmark says a different model now best satisfies a class's profile. Every assignment carries a `benchmarked` vs `inferred` flag, per the discipline that a model earns a class only by passing the identical harness on that class's bar.

| Class                         | Current best model                                                                          | Evidence flag                                 | Basis                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CLASSIFICATION**            | Gemini Flash-Lite                                                                           | **inferred**                                  | Determinism + frequency; not a scored advisor criterion. Compliance member tested _indirectly_ (~0 measurable quality impact; no medical/legal/tax blocks misfired). |
| **ADVISOR** (default path)    | Gemini Flash (2.5)                                                                          | **benchmarked**                               | V6: 6.66, trust 8.5, 0 fab, p50 12.7s. The trustworthy/fast/cheap default.                                                                                           |
| **ADVISOR** (escalation path) | Claude Opus 4.1 (Vertex) → **Sonnet pending**                                               | **benchmarked** (Opus) / **pending** (Sonnet) | Claude Control Experiment: 7.30 in-pipeline (+0.64), 0 fab, p50 ~61s. Sonnet not yet run.                                                                            |
| **REASONING**                 | Claude Opus 4.1 → **Sonnet pending**                                                        | **benchmarked (proxy)** / **pending**         | Decision-framing 6.7→7.3→8.4; tradeoff 6.5→6.9→7.0. Sub-criterion proxies from the experiment.                                                                       |
| **CRITIC**                    | Claude Opus 4.1 → **Sonnet pending**                                                        | **inferred**                                  | No critic role benchmarked; reasoned from insight uplift +0.9 (the criterion a critic exercises).                                                                    |
| **REPORT_WRITER**             | Claude Opus 4.1 → **Sonnet pending**                                                        | **benchmarked (proxy)** / **pending**         | Executive presence 6.5→7.3→8.4; actionability 4.7→6.2→8.5 — the two largest Claude margins both feed report quality.                                                 |
| **RESEARCH**                  | Gemini Flash-Lite (high-volume discovery/ingestion); large-context model for deep synthesis | **inferred**                                  | Discovery first-touch reasoned from low-reasoning/high-frequency; deep-synthesis sub-profile untested.                                                               |

**Reading the flags:**

- **benchmarked** — earned the class via the identical 50-scenario / 5-judge harness on the actual task.
- **benchmarked (proxy)** — earned via a _sub-criterion_ of the advisor benchmark that directly maps to the class (e.g. decision-framing for REASONING), not a dedicated run for that class.
- **inferred** — assigned by reasoning about the class's profile vs the model tier; **not yet measured.** Carries a standing "run the test" obligation before it is trusted as load-bearing.
- **pending** — a specific optimization (Sonnet as the mid-tier) that is the _recommended_ assignment once enabled and benchmarked; until then the class runs on the proven path (Opus).

**The Sonnet mid-tier (pending across four classes):** Sonnet is the hypothesized best quality-per-dollar for every Claude-assigned class — likely recovering most of the Opus uplift at materially lower latency/cost. Decision rule (mirrors the LIOS gate): if LN+Sonnet ≥ ~7.2 at meaningfully better latency/cost than Opus, promote it into the ADVISOR-escalation, REASONING, CRITIC, and REPORT_WRITER assignments. This promotion is the canonical example of the architecture working: **four classes re-point at one new model via config; nothing in the pipeline changes.**

---

## The abstraction seam already exists

The class→model architecture is not a rewrite. The right seam is already in the code:

- **`AdvisorLLM` Protocol** (`app/services/advisor_llm.py`):

  ```python
  class AdvisorLLM(Protocol):
      async def generate(self, context: Any, plan: dict[str, Any]) -> Optional[dict[str, Any]]: ...
  ```

  Two implementations — `GeminiAdvisorLLM` and `VertexClaudeAdvisorLLM` — already satisfy this _identical_ interface with _identical_ prompt construction, JSON parsing, telemetry, and never-raise fallback contract. The Claude Control Experiment proved the seam works: swapping the implementation behind the Protocol changed _only the model_, making the +0.64 delta attributable to the model alone. **This is precisely a one-class (ADVISOR), two-model registry, today, by hand.**

- **`USE_VERTEX_CLAUDE` flag** (`app/dependencies.py`, `get_advisor_orchestrator`): the current selector is a boolean env flag choosing Gemini vs Claude for the ADVISOR class. This is the embryonic registry — it just resolves a single class to a single model via env, with model name, project, region, and token already externalized to config (`ADVISOR_MODEL`, `VERTEX_PROJECT`, `VERTEX_REGION`, `VERTEX_ACCESS_TOKEN`).

**The extension is straightforward and additive:**

1. Promote `AdvisorLLM` to a general `CapabilityClient` Protocol (the `generate` contract is already class-agnostic — context + plan in, parsed JSON out, never raises).
2. Replace the single `USE_VERTEX_CLAUDE` boolean with a **class → model registry** (config/env-sourced): each capability class resolves to a model id + transport. The `inferred`/`benchmarked` flag travels alongside for observability.
3. Resolve the model _per class at the call site_ via the registry, instead of the orchestrator hard-selecting one LLM. The two existing implementations become the first two registry entries; new transports (Sonnet on Vertex, etc.) drop in without touching callers.
4. The number-gate validator stays in front of _every_ class assignment unchanged — it is what makes any stronger model safe to route (3 raw fabrications → 0 in-pipeline). No class bypasses it.

No call site, prompt, validator, orchestrator, or composer changes when a class is re-pointed. That property — already demonstrated by the Control Experiment — _is_ the architecture.

---

## What this architecture explicitly does NOT require

Per the Executive Decision Memo and the Routing Proposal: **the capability classes are routing/assignment abstractions, not a mandate to build a multi-agent runtime (LIOS) to host them.** LIOS is gated (Advisor < 7.5; 0% attributable to architecture). The class registry captures the entire model-capability lever — the primary, proven lever — with zero LIOS scaffolding. Build the registry; do not build agents to run it.

---

### One-line verdict

**Classes are the stable contract (what the work needs); model assignments are swappable config (what satisfies it today). The `AdvisorLLM` Protocol + `USE_VERTEX_CLAUDE` flag are already the seam — extend the boolean into a class→model registry, keep the validator in front of every class, and a model swap (Sonnet, Gemini-N, anything) becomes a config edit, never a code change.**
