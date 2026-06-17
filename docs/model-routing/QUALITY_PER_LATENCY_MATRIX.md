# Quality-per-Latency Matrix

**Pipeline under test:** `advisor-hybrid-6.0.0` (identical Life Navigator production pipeline for every model)
**Scenarios:** 50 (fixed set, identical inputs across all models)
**Scoring:** 5-judge rubric (overall 0–10); latency captured as p50 wall-clock seconds per turn
**Companion docs:** `DOMAIN_AGENT_MODEL_BENCHMARK.md` (source figures), `QUALITY_PER_DOLLAR_MATRIX.md`

---

## 0. Evidence policy (read first)

Every figure is labeled **MEASURED**, **ESTIMATE**, or **UNTESTED**. Do not cite an estimate or untested row as a result.

- **Quality — MEASURED** from the 50-scenario in-pipeline run (5-judge rubric).
- **Latency (p50 seconds) — MEASURED** wall-clock, in-pipeline, on the same harness.
- **Cost** is an estimate and is **not** the subject of this doc — see `QUALITY_PER_DOLLAR_MATRIX.md`.
- **Flash-Lite** is reachable but **UNTESTED** — no measured quality and only an **estimated** latency (~8s); it may not be quoted as a result. **Sonnet** is **UNTESTED** and not enabled in Vertex Model Garden; latency is unmeasured.

---

## 1. Definitions

| Term                 | Definition                                                        |
| -------------------- | ----------------------------------------------------------------- |
| `QUALITY_SCORE`      | In-pipeline overall quality, 0–10 (MEASURED)                      |
| `LATENCY_P50`        | Median wall-clock seconds per turn, in-pipeline (MEASURED)        |
| `QUALITY_PER_SECOND` | `QUALITY_SCORE / LATENCY_P50` — quality points per second of wait |
| **Gate**             | The 7.5 quality gate for the advisor turn.                        |

---

## 2. The matrix (ranked by QUALITY_PER_SECOND)

| Rank | Model                         | QUALITY_SCORE | LATENCY_P50 (s) | QUALITY_PER_SECOND | 7.5 gate   | Evidence                   |
| ---- | ----------------------------- | ------------- | --------------- | ------------------ | ---------- | -------------------------- |
| 1    | Gemini Flash                  | 6.66          | 12.7            | **0.52**           | below      | quality + latency MEASURED |
| 2    | **Gemini 2.5 Pro**            | **7.60**      | 26.5            | **0.29**           | **CLEARS** | quality + latency MEASURED |
| 3    | Claude Opus 4.1 (in-pipeline) | 7.30          | 61              | **0.12**           | below      | quality + latency MEASURED |
| —    | Gemini Flash-Lite             | n/a           | ~8 (est)        | **UNTESTED**       | unknown    | reachable, **UNTESTED**    |
| —    | Claude Sonnet                 | n/a           | unmeasured      | **UNTESTED**       | unknown    | not enabled, **UNTESTED**  |

Arithmetic (so the ranking is auditable):

- Flash: 6.66 / 12.7 = **0.52** q/s.
- Pro: 7.60 / 26.5 = **0.29** q/s.
- Opus 4.1: 7.30 / 61 = **0.12** q/s.

> Raw Claude is excluded: it ran offline with no in-pipeline latency captured and is not a deployable configuration.

---

## 3. Interactive-UX implications

The advisor is an **interactive** surface — a human is waiting on each turn. Quality-per-second ranks throughput, but the **absolute** p50 is what the user feels.

| Model              | p50   | UX read                                                                                                                                                                                                                                                                                       | Where it fits                                                                                   |
| ------------------ | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| **Flash**          | 12.7s | **Fastest.** Best quality-per-second by ~1.8× over Pro. Sub-13s feels responsive with a streaming ack.                                                                                                                                                                                        | **Low-stakes / non-gated** paths — quick classification, lightweight replies, fan-out subtasks. |
| **Gemini 2.5 Pro** | 26.5s | **Acceptable but high** for an interactive turn. 26.5s is a long wait; mitigated by a **streaming acknowledgement** (early "thinking…" / partial token stream) so the user isn't staring at a blank screen. The only gate-clearing model, so the advisor turn pays this latency by necessity. | **The advisor turn** — accept the latency, mask it with a streaming ack.                        |
| **Opus 4.1**       | 61s   | **Too slow for interactive.** A one-minute median wait is outside any reasonable synchronous-UX budget, and it doesn't even clear the gate in-pipeline.                                                                                                                                       | **Offline only** — batch/async enrichment, never a live advisor turn.                           |

**Headline:** Flash is the fastest (low-stakes use); Pro is acceptable for the advisor turn though its 26.5s p50 is high — a streaming acknowledgement mitigates the wait; Opus 4.1 at 61s is too slow for interactive use and should be **offline only**.

---

## 4. Recommended latency budgets per role

| Role / surface                              | Interactivity                 | p50 budget               | Recommended model          | Rationale                                                                             |
| ------------------------------------------- | ----------------------------- | ------------------------ | -------------------------- | ------------------------------------------------------------------------------------- |
| Advisor turn (gated)                        | Synchronous, human waiting    | ≤ 30s with streaming ack | **Gemini 2.5 Pro**         | Only gate-clearer; 26.5s fits the budget when masked by a streaming ack.              |
| Low-stakes reply / classification / routing | Synchronous                   | ≤ 15s                    | **Gemini Flash**           | 12.7s, highest q/s; gate does not apply here.                                         |
| Fan-out subtasks / parallel helpers         | Synchronous, parallel         | ≤ 15s each               | **Gemini Flash**           | Throughput-optimal; parallelism hides individual latency.                             |
| Batch / async enrichment, overnight jobs    | Asynchronous                  | no live budget           | **Opus 4.1** (or Pro)      | 61s is fine when nobody is waiting; use only if a measured quality edge justifies it. |
| Anything requiring a sub-10s feel           | Synchronous, latency-critical | ≤ 10s                    | **Flash-Lite** _(pending)_ | Est ~8s but **UNTESTED** — must benchmark quality before routing.                     |

> Budgets assume a streaming acknowledgement on every synchronous surface; without one, shave the budgets by ~5–10s, which would push Pro's 26.5s into uncomfortable territory and make the ack non-optional for the advisor turn.

---

## 5. Bottom line

- **Latency is measured; quality is measured.** Both axes here are real run data (cost is not — see the dollar matrix).
- **Quality-per-second ordering: Flash (0.52) > Pro (0.29) > Opus 4.1 (0.12).**
- **Flash = fast & low-stakes; Pro = the advisor turn (acceptable at 26.5s with a streaming ack); Opus 4.1 = offline only (61s too slow).**
- **Flash-Lite and Sonnet rows are UNTESTED** — run them through the same 50-scenario harness before assigning any latency-budgeted role.
