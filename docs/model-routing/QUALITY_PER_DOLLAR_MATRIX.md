# Quality-per-Dollar Matrix

**Pipeline under test:** `advisor-hybrid-6.0.0` (identical Life Navigator production pipeline for every model)
**Scenarios:** 50 (fixed set, identical inputs across all models)
**Scoring:** 5-judge rubric (overall 0–10; trust 0–10; fabrications counted)
**Companion docs:** `DOMAIN_AGENT_MODEL_BENCHMARK.md` (source figures), `QUALITY_PER_LATENCY_MATRIX.md`

---

## 0. Evidence policy (read first)

Every figure is labeled **MEASURED**, **ESTIMATE**, or **UNTESTED**. Do not cite an estimate or untested row as a result.

- **Quality / trust / fabrications — MEASURED** from the 50-scenario in-pipeline run (5-judge rubric). Raw Claude is a MEASURED offline reference only (no pipeline), not deployable.
- **Cost ($/turn) — ESTIMATE.** Cost is **not** a metered figure here. It is derived from public list pricing applied to a representative turn shape of **~3.5k input tokens / ~0.7k output tokens**. Treat every cost cell, and therefore every quality-per-dollar / trust-per-dollar value, as an **estimate**, not a billed measurement.
- **Latency** is measured but is not the subject of this doc — see `QUALITY_PER_LATENCY_MATRIX.md`.
- **Flash-Lite** is reachable but **UNTESTED** — no quality score exists; its cost is an estimate of an estimate. **Sonnet** is **UNTESTED** and not enabled in Vertex Model Garden — listed for planning only.

---

## 1. Definitions

| Term                 | Definition                                                                                               |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| `QUALITY_SCORE`      | In-pipeline overall quality, 0–10 (MEASURED)                                                             |
| `TRUST_SCORE`        | In-pipeline trust, 0–10 (MEASURED)                                                                       |
| `COST_SCORE`         | Estimated USD per turn at ~3.5k-in / ~0.7k-out (ESTIMATE)                                                |
| `QUALITY_PER_DOLLAR` | `QUALITY_SCORE / COST_SCORE` — quality points per dollar per turn                                        |
| `TRUST_PER_DOLLAR`   | `TRUST_SCORE / COST_SCORE` — trust points per dollar per turn                                            |
| **Gate**             | The 7.5 quality gate for the advisor turn. Models below 7.5 are quality-capped regardless of efficiency. |

---

## 2. The matrix (ranked by QUALITY_PER_DOLLAR)

| Rank | Model                             | QUALITY_SCORE | TRUST_SCORE | COST_SCORE ($/turn) | QUALITY_PER_DOLLAR | TRUST_PER_DOLLAR | 7.5 gate       | Evidence                                               |
| ---- | --------------------------------- | ------------- | ----------- | ------------------- | ------------------ | ---------------- | -------------- | ------------------------------------------------------ |
| 1    | Gemini Flash                      | 6.66          | 8.5         | ~$0.003             | **~2,220**         | ~2,833           | **below**      | quality MEASURED · cost ESTIMATE                       |
| 2    | **Gemini 2.5 Pro**                | **7.60**      | 8.7         | ~$0.011             | **~691**           | ~791             | **CLEARS**     | quality MEASURED · cost ESTIMATE                       |
| 3    | Claude Opus 4.1 (in-pipeline)     | 7.30          | 8.2         | ~$0.15              | **~49**            | ~55              | below          | quality MEASURED · cost ESTIMATE                       |
| —    | Gemini Flash-Lite                 | n/a           | n/a         | ~$0.001 (est)       | **UNTESTED**       | UNTESTED         | unknown        | reachable, **UNTESTED**                                |
| —    | Claude Sonnet                     | n/a           | n/a         | ~$0.021 (est)       | **UNTESTED**       | UNTESTED         | unknown        | not enabled, **UNTESTED**                              |
| ref  | Claude raw (offline, no pipeline) | 8.00          | 8.2         | —                   | n/a                | n/a              | reference only | MEASURED offline · **3 fabrications** · not deployable |

Arithmetic (so the ranking is auditable):

- Flash: 6.66 / 0.003 ≈ **2,220** pts/$ ; trust 8.5 / 0.003 ≈ 2,833.
- Pro: 7.60 / 0.011 ≈ **691** pts/$ ; trust 8.7 / 0.011 ≈ 791.
- Opus 4.1: 7.30 / 0.15 ≈ **48.7** pts/$ ; trust 8.2 / 0.15 ≈ 54.7.

> Raw Claude has no deployable cost-per-turn (it ran outside the pipeline and produced 3 fabrications the trust spine would otherwise catch), so no quality-per-dollar is computed for it. It is the quality ceiling, not a routable option.

---

## 3. Headline

- **Flash has the best raw points-per-dollar (~2,220 pts/$) but is quality-capped** — its 6.66 sits **below the 7.5 gate**, so its efficiency cannot be spent on the advisor turn. Cheap, but not good enough where the gate applies.
- **Among gate-clearing models, Gemini 2.5 Pro is the best points-per-dollar: ~691 pts/$ vs Opus 4.1 ~49 pts/$ — roughly 14× better** _while scoring higher in-pipeline_ (7.60 > 7.30). Pro is simultaneously cheaper, more efficient, and higher-quality than Opus 4.1 inside the pipeline.
- **Opus 4.1 is the worst points-per-dollar of the tested field (~49 pts/$)** and does not clear the gate in-pipeline. Its only quality advantage is offline/raw (8.00) — a premium-offline ceiling, not an in-pipeline result.
- **Trust-per-dollar tracks the same ordering** (Flash > Pro > Opus 4.1); Pro's trust (8.7) is the highest of any deployed model and its trust-per-dollar (~791) beats Opus 4.1's (~55) by ~14×.

---

## 4. Per-domain points-per-dollar note

Per-domain in-pipeline quality (from `DOMAIN_AGENT_MODEL_BENCHMARK.md` §4.2) divided by the same per-turn cost estimate preserves the overall ranking in **every** domain — the ~14× cost gap between Pro (~$0.011) and Opus 4.1 (~$0.15) dwarfs any per-domain quality delta:

| Domain       | Pro quality | Opus 4.1 quality | Pro pts/$ (~÷0.011) | Opus pts/$ (~÷0.15) | Pts/$ winner   |
| ------------ | ----------- | ---------------- | ------------------- | ------------------- | -------------- |
| Finance      | 6.73        | **6.99**         | ~612                | ~47                 | **Pro (~13×)** |
| Career       | **7.52**    | 7.36             | ~684                | ~49                 | **Pro (~14×)** |
| Education    | **7.24**    | 6.06             | ~658                | ~40                 | **Pro (~16×)** |
| Family       | 8.14        | **8.22**         | ~740                | ~55                 | **Pro (~13×)** |
| Cross-domain | **8.27**    | 7.57             | ~752                | ~50                 | **Pro (~15×)** |

> **Pro dominates points-per-dollar in all five domains.** Even in Finance and Family — the two domains where Opus 4.1 edges Pro on raw quality (by 0.26 and 0.08 points) — Pro still delivers ~13× more quality per dollar, because the cost gap is ~14× and the quality gap is under 4%. There is no domain where Opus 4.1's quality premium justifies its cost on a per-dollar basis.

---

## 5. Bottom line

- **Cost is an estimate; quality and trust are measured.** Do not present the dollar figures as billed costs.
- **Default the advisor turn to Gemini 2.5 Pro** — the only gate-clearing model and the best quality-per-dollar among gate-clearers (~14× Opus 4.1, higher quality too).
- **Use Flash only on low-stakes paths** where the 7.5 gate does not apply — there its ~2,220 pts/$ is genuinely usable.
- **Opus 4.1 is premium-offline only** on a cost basis: worst pts/$, below gate in-pipeline; reserve for cases where a measured per-domain quality edge is judged worth ~14× the spend.
- **Flash-Lite and Sonnet rows are UNTESTED** — they may not be quoted as results; run them through the same 50-scenario harness before routing.
