# Model-by-Domain Matrix

**Status:** Evidence-only. Every cell is labeled **[measured]** or **[inferred]**.
**Date:** 2026-06-16

This matrix routes the _single best model per life domain_ based on in-pipeline
quality scores (the model running inside the full advisor pipeline, with the
trust spine, grounding, and validator active — not a raw chat).

---

## What was measured vs. not

| Model                           | Status                                                                                    |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| Gemini Flash                    | **Measured** in-pipeline                                                                  |
| Gemini Pro                      | **Measured** in-pipeline                                                                  |
| Claude Opus                     | **Measured** in-pipeline                                                                  |
| rawClaude (Claude, no pipeline) | **Measured** as an _offline ceiling reference only_ — not a deployable in-pipeline option |
| Gemini Flash-Lite               | **NOT tested** — reachable but never benchmarked                                          |
| Claude Sonnet                   | **NOT tested** — not enabled                                                              |
| Newer Claude models             | **NOT tested** — not enabled                                                              |
| GPT (any)                       | **NOT tested** — no credentials                                                           |
| Nemotron                        | **NOT tested** — no access                                                                |

> **rawClaude caveat:** rawClaude is the model answering _without_ the production
> pipeline. It is the highest raw-quality reference (overall 8.00) but is **not a
> shipping configuration** — it bypasses grounding/validation. Use it only as a
> quality ceiling, not as a routing target.

---

## Per-domain in-pipeline scores (/10)

Scores are measured in-pipeline for Flash / Pro / Opus, with rawClaude shown as
the offline ceiling. **Flash-Lite and Sonnet columns are untested** and shown
only to make the routing decision explicit.

| Domain           | Flash _(measured)_ | Pro _(measured)_ | Opus _(measured)_ | rawClaude _(measured, ceiling)_ | Flash-Lite _(untested)_ | Sonnet _(untested)_ | **Winner (in-pipeline)** | Why (1 line)                                                  |
| ---------------- | ------------------ | ---------------- | ----------------- | ------------------------------- | ----------------------- | ------------------- | ------------------------ | ------------------------------------------------------------- |
| **Finance**      | 6.47               | 6.73             | **6.99**          | _(7.99)_                        | NOT TESTED              | NOT TESTED          | **Opus** (marginal)      | Opus edges Pro by 0.26; both well behind raw ceiling.         |
| **Family**       | 6.31               | 8.14             | **8.22**          | _(7.43)_                        | NOT TESTED              | NOT TESTED          | **Opus** (marginal)      | Opus edges Pro by 0.08; pipeline beats raw here.              |
| **Career**       | 6.46               | **7.52**         | 7.36              | _(8.16)_                        | NOT TESTED              | NOT TESTED          | **Pro**                  | Pro leads Opus by 0.16 and Flash by 1.06.                     |
| **Education**    | 6.56               | **7.24**         | 6.06              | _(8.17)_                        | NOT TESTED              | NOT TESTED          | **Pro**                  | Pro beats Opus by a wide 1.18; Opus underperforms.            |
| **Cross-domain** | 7.29               | **8.27**         | 7.57              | _(8.20)_                        | NOT TESTED              | NOT TESTED          | **Pro**                  | Pro is the top score in the whole matrix (8.27), beats raw.   |
| **Health**       | NOT BENCHMARKED    | NOT BENCHMARKED  | NOT BENCHMARKED   | NOT BENCHMARKED                 | NOT TESTED              | NOT TESTED          | **Pro** _(inferred)_     | No data; treat as an advisor domain + no-diagnosis guardrail. |

**Overall in-pipeline averages (measured):** Flash **6.66** · Pro **7.60** · Opus **7.30** · rawClaude **8.00** (ceiling).

**Win tally (in-pipeline, excluding rawClaude ceiling and the inferred Health row):**
Pro wins **3/5** (Career, Education, Cross-domain) **and** wins overall.
Opus wins **2/5** (Finance, Family) — both by thin margins (0.26 and 0.08).

---

## Cost, latency, trust (measured, model-level)

| Model      | Latency p50 _(measured)_ | Est. $/turn _(measured/est)_ | Trust score _(measured)_ | In-pipeline fabrications _(measured)_ |
| ---------- | ------------------------ | ---------------------------- | ------------------------ | ------------------------------------- |
| Flash      | **12.7s**                | ~$0.003                      | 8.5                      | 0                                     |
| Pro        | **26.5s**                | ~$0.011                      | 8.7                      | 0                                     |
| Opus       | **61s**                  | ~$0.15                       | 8.2                      | 0                                     |
| Flash-Lite | NOT TESTED               | cheapest (untested)          | NOT TESTED               | NOT TESTED                            |

- **Cost gap:** Opus is **~14x** the per-turn cost of Pro (~$0.15 vs ~$0.011) and
  Pro is **~3.7x** Flash.
- **Latency gap:** Opus p50 **61s** is **~2.3x** Pro (26.5s) and **~4.8x** Flash (12.7s).
- **Trust is model-agnostic:** fabrications = **0** across all in-pipeline models;
  the trust spine, not the model, enforces zero-fabrication. Trust scores sit in a
  tight band (8.2–8.7), with **Pro highest (8.7)**.

---

## Recommended primary model per domain

The "winner" column is pure quality. The **recommendation** column is quality
_net of cost and latency_. Opus's wins in Finance (+0.26) and Family (+0.08) are
**marginal** and come at **~14x cost and ~2.3x latency** vs Pro.

| Domain                                        | **Primary (recommended)** | Basis    | Rationale                                                                                                                                                  |
| --------------------------------------------- | ------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Finance**                                   | **Pro**                   | measured | Opus's +0.26 edge is not worth ~14x cost / ~2.3x latency. Escalate to Opus only if marginal finance quality is independently shown to be worth it.         |
| **Family**                                    | **Pro**                   | measured | Opus's +0.08 edge is within noise; Pro at 8.14 is excellent and far cheaper/faster.                                                                        |
| **Career**                                    | **Pro**                   | measured | Pro is the outright quality winner.                                                                                                                        |
| **Education**                                 | **Pro**                   | measured | Pro beats Opus by 1.18; Opus is the weakest non-Flash option here.                                                                                         |
| **Cross-domain**                              | **Pro**                   | measured | Pro posts the top score in the matrix (8.27).                                                                                                              |
| **Health**                                    | **Pro**                   | inferred | Not benchmarked; default to the proven all-domain winner + add compliance / no-diagnosis guardrail before launch.                                          |
| _Low-stakes / high-volume turns (any domain)_ | **Flash**                 | measured | Trust 8.5, 0 fabrications, ~$0.003, 12.7s — fine where depth isn't required; **Flash-Lite** is the cheaper unverified candidate, **benchmark before use**. |

### Single-default recommendation

> **Adopt Pro as the single default model across all domains.** It wins 3/5
> measured domains, wins overall (7.60), posts the highest trust (8.7), and is
> ~14x cheaper and ~2.3x faster than Opus.
>
> **Opus only as a targeted escalation** for Finance and Family — and only if the
> marginal quality (+0.26 / +0.08) is judged worth the ~14x cost and ~2.3x latency.
> The evidence does **not** justify Opus as a default anywhere.
>
> **Flash for low-stakes / high-volume** turns; **Flash-Lite** as a cost-down
> candidate pending a benchmark.

---

## Open items (to convert inferred → measured)

- **Health:** build a Health-domain harness with compliance / no-diagnosis checks.
- **Flash-Lite:** run the in-pipeline harness to confirm it's a safe cost-down.
- **Sonnet / newer Claude:** enable and benchmark in-pipeline before any routing.
- **Finance/Family Opus escalation:** quantify whether +0.26 / +0.08 has user-visible value before paying ~14x.
