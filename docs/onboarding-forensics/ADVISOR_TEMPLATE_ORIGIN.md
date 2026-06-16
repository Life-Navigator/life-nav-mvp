# Advisor Template Origin (Phase 2 + Phase 6)

**Evidence-only.** Fingerprints the observed response structure and traces benchmark contamination. `EXTERNAL` = provably not in this repo.

## Phase 2 — Section-by-section origin

The observed message contained: a tradeoffs block, a "What we know" block, a "My read" block, a "What would change this" block, a bolded question, an italic sub-note, and an italic disclaimer.

| Section (verbatim header)                                                                                                                         | Prompt origin                         | Code origin                                                                                                                                                                                                                                               | Template origin | Post-proc origin | Validator origin |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- | ---------------- | ---------------- |
| `**The tradeoffs:**`                                                                                                                              | `EXTERNAL`                            | **absent from repo** — grep `"The tradeoffs:"` = 0                                                                                                                                                                                                        | `EXTERNAL`      | `EXTERNAL`       | `EXTERNAL`       |
| `**What we know:**`                                                                                                                               | `EXTERNAL`                            | **absent from repo** — grep `"What we know:"` = 0; the 5 `"What we know"` matches are unrelated finance/decision UI (`finance/page.tsx`, `finance/retirement`, `finance/investments`, `domain/framework/DomainOverview.tsx`, `domain/framework/types.ts`) | `EXTERNAL`      | `EXTERNAL`       | `EXTERNAL`       |
| `**My read:**`                                                                                                                                    | `EXTERNAL`                            | **absent from repo** — grep `"My read"` = 0                                                                                                                                                                                                               | `EXTERNAL`      | `EXTERNAL`       | `EXTERNAL`       |
| `**What would change this:**`                                                                                                                     | `EXTERNAL`                            | **absent from repo** — grep `"What would change this:"` = 0; the 1 `"What would change this"` match is `lib/decision/counterfactual-engine.ts` (decision UI, not discovery)                                                                               | `EXTERNAL`      | `EXTERNAL`       | `EXTERNAL`       |
| Disclaimer block ("…general planning guidance…not personalized financial, legal, or tax advice — confirm specifics with a licensed professional") | `EXTERNAL`                            | **absent from repo** — grep `"general planning guidance"`, `"confirm specifics with a licensed professional"`, `"not personalized financial"` = 0. NOT the frontend's (`lib/advice/disclosure.ts` is a different string and unmerged)                     | `EXTERNAL`      | `EXTERNAL`       | `EXTERNAL`       |
| Question block ("When you imagine having reached financial independence, what specific changes…")                                                 | `EXTERNAL` (LLM-generated, free-form) | the in-repo question bank (`relationship_manager.py:42-61`) does **not** contain this question; the in-repo flow asks fixed questions                                                                                                                     | `EXTERNAL`      | `EXTERNAL`       | `EXTERNAL`       |

**Multiple contributing layers:** the structure (sections + disclaimer + question) is consistent with a model output passed through a formatting/compliance step. All of those layers are `EXTERNAL` — none are in this repo (Phase 1).

## Why this is an "advisor" template, not a "discovery" one

The in-repo discovery output is a single reflection + a single question (`relationship_manager.py:341`). The observed output is the **multi-section decision-analysis format**. That format is the signature of the advisor-benchmark line of work (out-of-repo context: the "advisor-hybrid" 6-section "Understand → Reframe → Tradeoffs → … → Next question" framing). That work's artifacts are **not in this repo** (Phase 6), so the template's source code cannot be cited here — only its absence and its non-discovery character can be.

## Phase 6 — Benchmark contamination audit

Searched this repo for the benchmark/advisor artifacts:

| Searched                                                                                            | Result in this repo                                                                                    |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `docs/advisor-benchmark/`                                                                           | **ABSENT** (`ls` = not present)                                                                        |
| `advisor_orchestrator` / `AdvisorOrchestrator`                                                      | **ABSENT** (file-not-found in `apps/lifenavigator-core-api/app/services`)                              |
| `advisor_validator` / number-gate                                                                   | **ABSENT**                                                                                             |
| `advisor_llm` / `VertexClaude`                                                                      | **ABSENT**                                                                                             |
| `advisor-hybrid`                                                                                    | only in `docs/pilot-p0/PREMIUM_MODEL_POSTURE.md` (a doc written this session), not in any runtime code |
| V2 / V3 / V4 / V5 / V6 advisor prompts                                                              | **ABSENT**                                                                                             |
| the 4 section headers / single-question rule / recommendation templates driving the observed format | **ABSENT** (E5)                                                                                        |

**Finding:** none of the benchmark-optimized advisor code or prompts exist in this repository. The in-repo discovery (`RelationshipManager`) contains no benchmark format. Therefore:

- Which benchmark changes remain active in onboarding? — `UNKNOWN / EXTERNAL` (the active code is the deployed service; not in this repo).
- Which affect discovery / advisor / both? — `UNKNOWN / EXTERNAL`.
- What IS provable: the observed onboarding format is the **advisor/benchmark** format, **not** the in-repo discovery format; the contamination, if any, is in the **deployed** core-api, not here.

## Bottom line

Every observed section and the disclaimer are **absent from this repository**. Their origin is the deployed core-api (`EXTERNAL`). The only same-named strings in this repo belong to unrelated finance/decision dashboard UI, not the onboarding/advisor path.
