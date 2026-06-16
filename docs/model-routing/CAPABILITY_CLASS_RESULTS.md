# Capability Class Results

Per-class model results for the 12 capability classes from the sprint.

**Evidence policy:** Each class is tagged **MEASURED** (real scores from the 50-scenario `advisor-hybrid-6.0.0` rubric) or **NOT BENCHMARKED** (recommendation is **INFERRED** from measured data + model traits, with the methodology to confirm). Never treat an inferred recommendation as a measured result.

**Field tested (reachable + enabled):** Gemini Flash, Gemini 2.5 Pro, Claude Opus 4.1. Raw Claude is an **offline reference only** (no pipeline, 3 fabrications — not deployable). Flash-Lite is reachable but **NOT TESTED**. Sonnet 4.5, Opus 4.5/4.6/4.7/4.8, GPT-class, Nemotron, Llama are **NOT TESTED** (not enabled / no credentials / no access).

**Trust spine note (MEASURED):** validator + number-gate + compliance are model-agnostic — every in-pipeline model scored 0 fabrications; raw Claude's 3 were caught when run in-pipeline. Model choice is quality/latency/cost, not safety.

---

## Class 1 — Classification & Routing

**Status: NOT BENCHMARKED**

Not exercised by the advisor rubric (which measures conversational quality, not routing accuracy on a labeled set).

- **Recommended (INFERRED): Gemini Flash-Lite, fall back to Flash.** Routing is a high-volume, low-token, latency-sensitive classify step. Flash is already the cheapest (~$0.003/turn) and fastest (12.7s p50 on full advisor turns; classification prompts are far shorter). Flash-Lite is reachable and should be cheaper/faster still. Quality ceiling matters little when the output is a label, not counsel — and the trust spine downstream protects the user regardless.
- **Methodology to confirm:** build a labeled routing set (utterance → correct domain/agent), run Flash-Lite and Flash, measure top-1 accuracy, p50/p95 latency, and cost/1k routes. Require accuracy ≥ agreed threshold before promoting Flash-Lite over Flash.

---

## Class 2 — Advisor

**Status: MEASURED** (overall 50-scenario rubric)

| Model                         | Overall /10 | Trust | Fab | Latency p50 | Cost/turn |
| ----------------------------- | ----------- | ----- | --- | ----------- | --------- |
| Gemini Flash                  | 6.66        | 8.5   | 0   | 12.7s       | ~$0.003   |
| **Gemini 2.5 Pro**            | **7.60**    | 8.7   | 0   | 26.5s       | ~$0.011   |
| Claude Opus 4.1               | 7.30        | 8.2   | 0   | 61s         | ~$0.15    |
| Claude raw (ref, no pipeline) | 8.00        | 8.2   | 3   | —           | —         |

**Winner: Gemini 2.5 Pro.** Only in-pipeline model to clear the 7.5 gate; best overall and best trust (8.7). Opus 4.1 is slower (61s) and ~14x the cost without beating Pro. Flash is below gate. Raw Claude's 8.00 is reference-only and unsafe.

---

## Class 3 — Finance

**Status: MEASURED** (per-domain)

| Model               | /10      |
| ------------------- | -------- |
| Gemini Flash        | 6.47     |
| Gemini 2.5 Pro      | 6.73     |
| **Claude Opus 4.1** | **6.99** |
| Claude raw (ref)    | 7.99     |

**In-pipeline winner: Claude Opus 4.1** (edges Pro by 0.26). **Why:** Opus's reasoning depth helps on finance's quantitative, multi-constraint counsel. Caveat: ~14x Pro's cost and ~2.3x its latency for a small delta — route to Opus only if the finance-quality premium is worth it; otherwise Pro is the economical default. Raw Claude (7.99) shows the ceiling but is offline/unsafe.

---

## Class 4 — Family

**Status: MEASURED** (per-domain)

| Model               | /10      |
| ------------------- | -------- |
| Gemini Flash        | 6.31     |
| Gemini 2.5 Pro      | 8.14     |
| **Claude Opus 4.1** | **8.22** |
| Claude raw (ref)    | 7.43     |

**In-pipeline winner: Claude Opus 4.1** (edges Pro by 0.08 — effectively a tie). **Why:** family counsel rewards empathetic, nuanced multi-party reasoning where Opus is strong; notably this is the one domain where in-pipeline Pro/Opus **beat** raw Claude (7.43), suggesting the pipeline's structure helps family responses. Given the near-tie, **Pro is the better default on cost/latency**; reserve Opus for high-stakes family cases.

---

## Class 5 — Career

**Status: MEASURED** (per-domain)

| Model              | /10      |
| ------------------ | -------- |
| Gemini Flash       | 6.46     |
| **Gemini 2.5 Pro** | **7.52** |
| Claude Opus 4.1    | 7.36     |
| Claude raw (ref)   | 8.16     |

**In-pipeline winner: Gemini 2.5 Pro** (beats Opus by 0.16, clears 7.5). **Why:** career planning needs structured, options-with-tradeoffs counsel where Pro excels; it wins on quality _and_ on cost/latency vs Opus. Clear Pro call.

---

## Class 6 — Education

**Status: MEASURED** (per-domain)

| Model              | /10      |
| ------------------ | -------- |
| Gemini Flash       | 6.56     |
| **Gemini 2.5 Pro** | **7.24** |
| Claude Opus 4.1    | 6.06     |
| Claude raw (ref)   | 8.17     |

**In-pipeline winner: Gemini 2.5 Pro** by a wide margin (Opus 4.1 collapses to 6.06 here — worst non-Flash result in any domain). **Why:** Pro handles the planning/sequencing of education pathways well; Opus underperforms badly in-pipeline. Strong Pro call; do **not** route Education to Opus.

---

## Class 7 — Health

**Status: NOT BENCHMARKED**

No health scenarios in the 50-set.

- **Recommended (INFERRED): Gemini 2.5 Pro, with compliance gating enforced.** Health is an advisor-style domain; Pro is the proven default across the measured advisor domains (Career/Education/Cross-domain wins, overall gate-clearer) and carries the best in-pipeline trust (8.7). Health additionally demands strict compliance/no-medical-advice guardrails — which the model-agnostic trust spine already provides.
- **Methodology to confirm:** assemble a health-domain scenario set with explicit compliance cases (scope-of-advice, disclaimers, escalation-to-professional), score on the 5-judge rubric plus a dedicated compliance/refusal-correctness metric, and verify 0 fabrications and 0 compliance violations in-pipeline before launch.

---

## Class 8 — Document-Intelligence

**Status: NOT BENCHMARKED**

Extraction/structuring is not measured by a conversational rubric.

- **Recommended (INFERRED): Gemini 2.5 Pro for accuracy-critical extraction; Flash for high-volume/low-stakes pages.** This is a structured-extraction task (fields, taxonomy), distinct from counsel. Pro's reasoning supports complex/ambiguous documents; Flash's cost/speed suits bulk simple pages. Long-context handling favors the Gemini family.
- **Methodology to confirm:** build a gold-labeled document set across the 26-type taxonomy; measure field-level precision/recall/F1, schema-conformance rate, and cost/page for Flash vs Pro; pick per document-type by accuracy floor then cost.

---

## Class 9 — GraphRAG

**Status: NOT BENCHMARKED**

Retrieval grounding quality needs a graph-grounded eval set (not in the 50-set).

- **Recommended (INFERRED): Gemini 2.5 Pro.** GraphRAG synthesis over retrieved subgraphs resembles the cross-domain reasoning Pro won (8.27 cross-domain, the highest in-pipeline). Faithful grounding to retrieved evidence and the model-agnostic trust spine together suppress fabrication.
- **Methodology to confirm:** create a graph-grounded QA set with known supporting nodes/edges; measure answer correctness, citation/grounding faithfulness (claims traceable to retrieved evidence), and hallucination rate for Flash vs Pro; require grounding faithfulness above threshold.

---

## Class 10 — Decision-Intelligence (Cross-domain)

**Status: MEASURED** (cross-domain rubric)

| Model              | /10      |
| ------------------ | -------- |
| Gemini Flash       | 7.29     |
| **Gemini 2.5 Pro** | **8.27** |
| Claude Opus 4.1    | 7.57     |
| Claude raw (ref)   | 8.20     |

**In-pipeline winner: Gemini 2.5 Pro** — and its single best domain (8.27), even edging raw Claude (8.20). **Why:** cross-domain decision synthesis (integrating finance/career/family/education into one recommendation) is exactly where Pro's reasoning shows; it also beats Opus by 0.70 here. Strong Pro call.

---

## Class 11 — Critic

**Status: NOT BENCHMARKED**

No adversarial-critique eval was run.

- **Recommended (INFERRED): Claude Opus 4.1 (or Gemini 2.5 Pro as economical alternative).** A critic must find flaws, missing constraints, and weak reasoning in another agent's output — a deep-reasoning task. Opus's reasoning depth (its strength in Finance/Family) suits adversarial critique; Pro is a cheaper, faster second choice given its overall lead. The critic is offline/low-volume, so Opus's cost/latency penalty matters less.
- **Methodology to confirm:** build a set of advisor outputs with seeded defects (fabrications, missing constraints, weak tradeoffs); measure each candidate's defect-detection recall/precision and false-flag rate as a critic; pick highest recall at acceptable false-flag rate.

---

## Class 12 — Report-Writer

**Status: NOT BENCHMARKED**

Long-form report quality is not in the 50-set.

- **Recommended (INFERRED): Claude Opus (offline).** Direct supporting signal: raw Claude scored **actionability 8.5** and **executive-presence 8.4** — the qualities a polished long-form report needs. Report-writing is typically offline/batch, so Opus's latency (61s) and cost (~$0.15) are acceptable, and there is no live-turn gate to clear. Note the raw-Claude fabrication caveat: run report generation **in-pipeline** so the trust spine catches fabrications.
- **Methodology to confirm:** define a report eval set with rubric dimensions (actionability, executive presence, structure, factual grounding); score Opus vs Pro on full reports; confirm 0 fabrications when run through the trust spine before shipping.

---

## Summary routing table

| Class                      | Status          | Recommended model             | Basis                                       |
| -------------------------- | --------------- | ----------------------------- | ------------------------------------------- |
| 1 Classification & Routing | NOT BENCHMARKED | Flash-Lite → Flash            | INFERRED (cheap/fast label task)            |
| 2 Advisor                  | MEASURED        | Gemini 2.5 Pro                | only gate-clearer, best overall             |
| 3 Finance                  | MEASURED        | Opus 4.1 (else Pro)           | edges Pro 6.99 vs 6.73                      |
| 4 Family                   | MEASURED        | Opus 4.1 ≈ Pro                | tie 8.22 vs 8.14 → Pro on cost              |
| 5 Career                   | MEASURED        | Gemini 2.5 Pro                | 7.52, beats Opus                            |
| 6 Education                | MEASURED        | Gemini 2.5 Pro                | 7.24, Opus collapses to 6.06                |
| 7 Health                   | NOT BENCHMARKED | Gemini 2.5 Pro + compliance   | INFERRED (advisor-like + guardrails)        |
| 8 Document-Intelligence    | NOT BENCHMARKED | Pro (accuracy) / Flash (bulk) | INFERRED (extraction)                       |
| 9 GraphRAG                 | NOT BENCHMARKED | Gemini 2.5 Pro                | INFERRED (cross-domain synthesis)           |
| 10 Decision-Intelligence   | MEASURED        | Gemini 2.5 Pro                | best domain 8.27                            |
| 11 Critic                  | NOT BENCHMARKED | Opus 4.1 (else Pro)           | INFERRED (deep critique, offline)           |
| 12 Report-Writer           | NOT BENCHMARKED | Opus (offline, in-pipeline)   | INFERRED (raw actionability 8.5 / exec 8.4) |
