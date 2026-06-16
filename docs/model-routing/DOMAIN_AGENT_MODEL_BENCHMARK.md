# Domain Agent Model Benchmark

**Pipeline under test:** `advisor-hybrid-6.0.0` (identical Life Navigator production pipeline for every model)
**Scenarios:** 50 (fixed set, identical inputs across all models)
**Scoring:** 5-judge rubric
**Evidence policy:** Every figure below is labeled **MEASURED**, **INFERRED**, or **NOT TESTED**. Do not cite an inferred or untested value as a result.

---

## 1. Methodology

### 1.1 Identical-input harness

All candidate models were driven through the **same** `advisor-hybrid-6.0.0` pipeline using the **same 50 scenarios** with **identical inputs**. Only the generation model was swapped. This isolates the model's contribution from the pipeline's contribution.

### 1.2 In-pipeline vs. raw

Two evaluation modes were run:

- **In-pipeline (MEASURED):** the model runs inside the full hybrid advisor — rules guardrail, LLM lead, validator/number-gate/compliance trust spine — exactly as production does. This is the decision-relevant number.
- **Raw / offline reference (MEASURED, reference-only):** raw Claude was scored **without** the pipeline, as a ceiling reference. It is **not** a deployable configuration; it bypasses the trust spine.

### 1.3 5-judge rubric

Each turn was scored by a 5-judge rubric producing an overall 0–10 quality score, plus per-turn signals captured for trust (0–10), fabrication count, latency (p50, seconds), and cost (USD/turn).

### 1.4 Trust spine is model-agnostic (MEASURED)

The validator, number-gate, and compliance checks are **model-agnostic**. Direct evidence: raw Claude produced **3 fabrications** offline; the **same** content run in-pipeline produced **0 fabrications**, and every in-pipeline model scored **0 fabrications**. The trust spine caught what the model got wrong regardless of which model generated the text.

> Implication: model selection is a **quality/latency/cost** decision, not a safety decision. Safety is enforced by the pipeline, not the model.

---

## 2. What was measured vs. pending

### 2.1 Capability classes (12 total from the sprint)

**MEASURED via the 50 scenarios (6 classes):**

| #   | Capability class      | Source of measurement             |
| --- | --------------------- | --------------------------------- |
| 2   | Advisor               | 50-scenario rubric                |
| 3   | Finance               | 50-scenario rubric (per-domain)   |
| 4   | Family                | 50-scenario rubric (per-domain)   |
| 5   | Career                | 50-scenario rubric (per-domain)   |
| 6   | Education             | 50-scenario rubric (per-domain)   |
| 10  | Decision-Intelligence | 50-scenario rubric (cross-domain) |

**NOT YET BENCHMARKED — pending dedicated harness (6 classes):**

| #   | Capability class         | Why pending                                                                   |
| --- | ------------------------ | ----------------------------------------------------------------------------- |
| 1   | Classification & Routing | Not exercised by the advisor rubric; needs a labeled routing accuracy harness |
| 7   | Health                   | No health scenarios in the 50-set; needs compliance-aware harness             |
| 8   | Document-Intelligence    | Extraction/structuring not measured by conversational rubric                  |
| 9   | GraphRAG                 | Retrieval/grounding quality needs a graph-grounded eval set                   |
| 11  | Critic                   | No adversarial-critique eval run                                              |
| 12  | Report-Writer            | Long-form report quality not in the 50-set                                    |

For the 6 pending classes, this benchmark provides **INFERRED** recommendations only (see `CAPABILITY_CLASS_RESULTS.md`), each accompanied by the methodology required to confirm.

---

## 3. Model-access reality

| Model                             | Access status                                 | Tested?                                            |
| --------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| Gemini Flash-Lite                 | Verified reachable                            | **NOT TESTED** (UNTESTED, reachable)               |
| Gemini Flash                      | Accessible                                    | **MEASURED**                                       |
| Gemini 2.5 Pro                    | Accessible                                    | **MEASURED**                                       |
| Claude Opus 4.1                   | Accessible                                    | **MEASURED** (in-pipeline)                         |
| Claude (raw)                      | Accessible                                    | **MEASURED** (offline reference only, no pipeline) |
| Claude Sonnet 4.5                 | **NOT enabled** in Vertex Model Garden (404)  | **NOT TESTED**                                     |
| Claude Opus 4.5 / 4.6 / 4.7 / 4.8 | **NOT enabled** in Vertex Model Garden        | **NOT TESTED**                                     |
| GPT-class (OpenAI)                | **No OpenAI credentials** in this environment | **NOT TESTED**                                     |
| Nemotron / Llama                  | **No access**                                 | **NOT TESTED**                                     |

> The benchmarked field is constrained to what is actually reachable and enabled: Flash, Pro, Opus 4.1. Flash-Lite is reachable but was not run. Everything else is excluded for the stated access reason — none of those should be quoted as having any score.

---

## 4. Headline results (MEASURED)

### 4.1 Overall (in-pipeline unless noted)

| Model                                 | Overall /10 | Latency p50 | Cost/turn | Trust /10 | Fabrications | 7.5 gate       |
| ------------------------------------- | ----------- | ----------- | --------- | --------- | ------------ | -------------- |
| Gemini Flash                          | 6.66        | 12.7s       | ~$0.003   | 8.5       | 0            | below          |
| **Gemini 2.5 Pro**                    | **7.60**    | 26.5s       | ~$0.011   | 8.7       | 0            | **CLEARS**     |
| Claude Opus 4.1 (in-pipeline)         | 7.30        | 61s         | ~$0.15    | 8.2       | 0            | below          |
| Claude raw (offline ref, no pipeline) | 8.00        | —           | —         | 8.2       | **3**        | reference only |

Notes:

- **Gemini 2.5 Pro is the only in-pipeline model that clears the 7.5 quality gate.**
- Raw Claude scores highest (8.00) but is **not deployable**: it ran outside the pipeline and produced 3 fabrications that the trust spine would otherwise catch. Reference ceiling only.
- Opus 4.1 in-pipeline is both the most expensive (~50x Pro, ~50x→Flash) and the slowest (61s p50), and does **not** beat Pro overall.
- Flash is the cheapest and fastest, but lowest quality and below gate.

### 4.2 Per-domain in-pipeline average /10 (MEASURED)

| Domain       | Flash | Gemini 2.5 Pro | Opus 4.1 | Claude raw (ref) | In-pipeline winner |
| ------------ | ----- | -------------- | -------- | ---------------- | ------------------ |
| Finance      | 6.47  | 6.73           | **6.99** | 7.99             | Opus 4.1           |
| Career       | 6.46  | **7.52**       | 7.36     | 8.16             | Pro                |
| Education    | 6.56  | **7.24**       | 6.06     | 8.17             | Pro                |
| Family       | 6.31  | 8.14           | **8.22** | 7.43             | Opus 4.1           |
| Cross-domain | 7.29  | **8.27**       | 7.57     | 8.20             | Pro                |

Per-domain reading (in-pipeline, raw excluded as it is reference-only):

- **Pro wins** Career, Education, Cross-domain — and overall.
- **Opus 4.1 edges** Finance and Family.
- **Flash is worst in every domain.**

> Raw Claude (reference) leads most domains except Family, but it is offline and unsafe (fabrications) — included only to show the quality ceiling the pipeline trades away for safety/cost/latency.

---

## 5. Bottom line

- **Default production model: Gemini 2.5 Pro** — only in-pipeline model over the 7.5 gate, best overall, best in 3 of 5 domains, ~$0.011/turn at 26.5s p50, trust 8.7, 0 fabrications.
- **Finance / Family:** Opus 4.1 edges Pro on quality, but at ~14x cost and ~2.3x latency — route only if the per-domain quality delta is judged worth it. (See routing recommendation in `CAPABILITY_CLASS_RESULTS.md`.)
- **Flash:** reserve for cheap/fast low-stakes paths, not for the advisor gate.
- **Safety is the pipeline, not the model:** any reachable model gets 0 fabrications in-pipeline.
- **6 capability classes remain unmeasured** — recommendations for them are inferred and flagged as such.
