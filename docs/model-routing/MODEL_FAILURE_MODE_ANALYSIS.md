# Model Failure-Mode Analysis

**Date:** 2026-06-16
**Status:** Evidence-only. Every claim below traces to a benchmark raw file or a prior forensic report.
**Method:** Identical 50-scenario benchmark, identical LifeNavigator pipeline (same `ADVISOR_SYSTEM`
prompt, same validator, same composer, same number gate), only the advisor model swapped. The
LifeNavigator trust spine converts any validator rejection into a deterministic, safe generic reply
("fallback"). A fallback is therefore an observable failure event, and `llm_status` records its reason.

**Primary evidence (raw `llm_status` per record):**

- `docs/advisor-benchmark/raw/lifenavigator_v6.json` — Gemini 2.5 Flash (production)
- `docs/advisor-benchmark/raw/lifenavigator_gemini_pro.json` — Gemini 2.5 Pro
- `docs/advisor-benchmark/raw/lifenavigator_claude_v6.json` — Claude Opus (Vertex, in-pipeline)
- `docs/advisor-benchmark/raw/claude.json` — raw Claude, no pipeline (control)

**Supporting forensics:** `SUPPRESSION_ANALYSIS.md`, `NUMBER_GATE_FORENSICS.md`,
`CLAUDE_CONTROL_EXPERIMENT.md`, `ADVISOR_V5_RESULTS.md`, `ADVISOR_V6_RESULTS.md`.

---

## Headline facts (counted directly from the raw files)

| Model (in LN pipeline)   | Fallbacks / 50 | Fallback type                             | Fabrications shipped |   Latency p50 |  Overall |   Trust |
| ------------------------ | -------------: | ----------------------------------------- | -------------------: | ------------: | -------: | ------: |
| Gemini 2.5 Flash         |       **5/50** | all number-gate                           |                **0** |         12.7s |     6.66 |     8.5 |
| Gemini 2.5 Pro           |       **4/50** | all number-gate (1 generic `unavailable`) |                **0** |         26.3s | **7.60** | **8.7** |
| Claude Opus              |       **6/50** | all number-gate                           |                **0** |         60.4s |     7.30 |     8.2 |
| Raw Claude (no pipeline) |            n/a | n/a                                       |                **3** | n/a (offline) |     8.00 |     8.2 |

**The single most important cross-model fact:** in all three in-pipeline runs, **every** fallback is a
**number-gate rejection** — the model used a `$`/`%` figure that is neither in the user's input nor a
verified derivation from it (or, in one Pro case, a generic `unavailable`). No fallback in any run was a
medical/legal/tax/advice-scope block. The trust spine converted all of them to safe generic replies, so
**every in-pipeline model shipped 0 fabrications.** The only model that fabricated was **raw Claude with
no pipeline (3 fabrications)** — caught and stripped when run inside LifeNavigator.

---

## Per-model failure modes

### 1. Gemini 2.5 Flash — under-reasoning / shallow framing (quality cap)

**Failure mode.** Flash's dominant failure is not a hard error but a **quality ceiling**: it
under-reasons. Per `ADVISOR_V6_RESULTS.md`, on the production V6 pipeline Flash posts **actionability
4.7** (vs Claude reference 8.7), **insight 6.1** (vs 8.0), **framing 6.7** (vs 8.6). These were diagnosed
in V6 as "not prompt problems anymore… model-capability problems." The secondary failure is the shared
number-gate fallback when it reaches for a derived/benchmark number.

**Frequency.** 5 fallbacks / 50 (10%) — all number-gate, from `lifenavigator_v6.json`:

| id     | domain    | topic                  | reason (raw `llm_status`)                             |
| ------ | --------- | ---------------------- | ----------------------------------------------------- |
| fin-03 | Finance   | Pay off debt vs invest | `invented numbers not in context: ['2550']`           |
| fin-09 | Finance   | College savings        | `invented numbers not in context: ['54000','76000']`  |
| car-04 | Career    | Relocation for work    | `invented numbers not in context: ['205000','55000']` |
| edu-01 | Education | MBA                    | `invented numbers not in context: ['304000']`         |
| fam-02 | Family    | Divorce                | `invented numbers not in context: ['150000']`         |

**Severity.** Low-to-moderate. The under-reasoning is a quality cap, not a trust risk (trust 8.5, 0
fabrications). The fallbacks degrade UX on number-heavy turns but never produce a wrong answer.

**Mitigation (already provided by LN).** The number gate converts every ungrounded-number reach into a
safe generic reply (no false precision shipped); the trust spine holds trust at 8.5. The pipeline cannot,
however, raise Flash's reasoning ceiling — that is intrinsic to the model.

**Routing implication.** Flash is the **cost floor**, suitable for cheap/low-stakes turns where shallow
framing is acceptable. It does **not** clear the 7.5 advisor gate (6.66) and should not be the
high-stakes advisor.

---

### 2. Gemini 2.5 Pro — rare derived-number fallback, otherwise clean (the sweet spot)

**Failure mode.** Pro's only material failure is the **occasional ungrounded-number reach**, identical in
kind to Flash but rarer. Otherwise it is the cleanest in-pipeline profile: highest overall (7.60), highest
trust (8.7), zero fabrications. One of its four fallbacks is a generic `unavailable` (a transient
non-content failure), not a content error.

**Frequency.** 4 fallbacks / 50 (8%) — fewest of any model — from `lifenavigator_gemini_pro.json`:

| id     | domain    | topic                       | reason (raw `llm_status`)                       |
| ------ | --------- | --------------------------- | ----------------------------------------------- |
| fin-03 | Finance   | Pay off debt vs invest      | `fallback:unavailable` (transient, non-content) |
| fin-08 | Finance   | Windfall / bonus allocation | `invented numbers not in context: ['45000']`    |
| car-09 | Career    | Equity vs salary offer      | `invented numbers not in context: ['0']`        |
| edu-01 | Education | MBA                         | `invented numbers not in context: ['300000']`   |

**Severity.** Low. Fewest fallbacks, highest trust, no fabrications. The lone `unavailable` is an
infra/transient event, gracefully handled by the spine.

**Mitigation (already provided by LN).** Same number gate; on Pro it fires least often. Latency p50 26.3s
is ~½ Opus and ~2× Flash — acceptable for an advisor turn.

**Routing implication.** **Pro is the advisor sweet spot** — the only config that clears the 7.5 gate
(7.60), with the fewest fallbacks and the highest trust, at ~1/14 Opus's cost and ~½ its latency
(`QUALITY_PER_DOLLAR_MATRIX.md`, `FRONTIER_MODEL_EXECUTIVE_DECISION_MEMO.md`). Default advisor model.

---

### 3. Claude Opus — over-assertive → benchmark/projection numbers rejected (most fallbacks); residual advice-correctness risk; high latency

**Failure mode (primary).** Claude is **more verbose and more assertive** than the Gemini models. It
volunteers quantified plans — "20% down", growth-rate projections, retirement figures, rule-of-thumb
percentages — that are **ungroundable** against the user's input. The number gate rejects each, so Claude
produces the **most fallbacks of any in-pipeline model**. This is a direct consequence of its strength
(it reaches for concrete numeric counsel) colliding with the grounding gate.

**Frequency.** 6 fallbacks / 50 (12%) — most of any model — all number-gate, from
`lifenavigator_claude_v6.json`:

| id     | domain       | topic               | reason (raw `llm_status`)                                 |
| ------ | ------------ | ------------------- | --------------------------------------------------------- |
| fin-04 | Finance      | Retirement planning | `invented numbers not in context: ['000','14','15000']`   |
| fin-07 | Finance      | Inheritance         | `invented numbers not in context: ['401']`                |
| car-02 | Career       | Job change          | `invented numbers not in context: ['24']`                 |
| edu-02 | Education    | Degree choice       | `invented numbers not in context: ['100','220','220000']` |
| edu-04 | Education    | Student loans       | `invented numbers not in context: ['10','15']`            |
| crs-03 | Cross-Domain | Leave a stable job  | `invented numbers not in context: ['120000','25']`        |

Per `CLAUDE_CONTROL_EXPERIMENT.md`, those 6 fallbacks are the **entire** gap between in-pipeline Claude
(7.30) and raw Claude (8.00): on the 44 non-fallback turns LN+Claude scores **8.08**, i.e. parity with
raw — the pipeline adds no quality drag on turns it lets through; the cost is purely the fallback count.

**Failure mode (residual — flag).** When Claude is allowed to advise, it can be **conceptually wrong even
when every number is grounded.** The number gate governs _numeric_ grounding only; it does **not** and
**cannot** validate the _correctness of non-numeric advice_. The benchmark recorded a concrete instance:
in `ADVISOR_V5_RESULTS.md` LifeNavigator earned its first-ever trust flag (fin-10) for calling mortgage
paydown "a tax-free return" — a conceptual error — and that report notes **Claude is flagged the same way,
twice.** `SUPPRESSION_ANALYSIS.md` confirms this class of error is invisible to the number gate.
**This advice-correctness risk is a genuine residual for any assertive model; it is NOT caught by the
number gate and must be monitored independently.**

**Failure mode (operational).** **High latency** — p50 60.4s in `lifenavigator_claude_v6.json`
(~5× Flash, ~2.3× Pro). Unsuitable for interactive turns at scale.

**Severity.** Moderate. Highest fallback rate, but still 0 fabrications shipped (the gate holds);
the advice-correctness residual is the more serious item because it bypasses the numeric gate; latency
is a hard UX/cost constraint.

**Mitigation (already provided by LN).** (a) The number gate converts Claude's over-assertive numeric
reaches into safe generic replies → 0 fabrications. (b) Critically, the gate **caught 3 fabrications raw
Claude made** that would otherwise ship: in `claude.json`/`SUPPRESSION_ANALYSIS.md` — fin-01 (invented
"~$70k reserves", "~28% DTI", "6.5% rates"), car-06 (invented "50-80% of people who accept counteroffers
leave within a year"), crs-08 (invented budget/coverage numbers). The pipeline makes Claude _safer_, not
just gated. (c) **No mitigation exists for the conceptual advice-correctness residual** — the gate is
numeric-only; this needs a separate advice-correctness check or human/critic review.

**Routing implication.** Claude is **not** the interactive advisor — Pro beats it in-pipeline (7.60 vs
7.30) at a fraction of cost and latency. Claude's assertiveness + latency tolerance fit **premium offline
roles only**: reports, executive review, critic, hardest latency-tolerant decision analysis
(`FRONTIER_MODEL_EXECUTIVE_DECISION_MEMO.md`).

---

### 4. Raw / un-piped models — fabrication + conceptual error (why the pipeline exists)

**Failure mode.** Run **without** the LifeNavigator pipeline, the frontier model fabricates. Raw Claude
(`claude.json`) shipped **3 fabrications** the in-pipeline run had **0** of:

| id     | scenario        | what raw Claude fabricated (absent from user input)                                                  |
| ------ | --------------- | ---------------------------------------------------------------------------------------------------- |
| fin-01 | Buy a house     | "~$70k reserves", "~28% DTI", "6.5% rates" — none in the user's figures                              |
| car-06 | Counteroffer    | "50-80% of people who accept counteroffers leave within a year" — invented stat presented as fact    |
| crs-08 | Layoff + family | budget/coverage numbers beyond the user's stated $40k saved / $60k spouse income / 2-month severance |

It also commits the same **conceptual** advice errors the in-pipeline run hits (e.g. mortgage-paydown
framing, `ADVISOR_V5_RESULTS.md`), which no numeric gate catches in any configuration.

**Frequency.** 3 fabricated turns / 50 for raw Claude (`SUPPRESSION_ANALYSIS.md`). Raw Gemini is the
production baseline behind the pipeline; the un-piped fabrication risk is intrinsic to assertive
generation, not specific to one vendor.

**Severity.** High. Fabricated dollar figures, DTI, rates, and external statistics presented as fact on
high-stakes financial decisions are exactly the trust-destroying failure the product cannot tolerate.

**Mitigation (already provided by LN).** The pipeline's number gate is the mitigation — it stripped all
3 raw-Claude fabrications, yielding 0 shipped while _retaining_ the grounded counsel (those turns came
back `enhanced`, not fallback). This is the empirical justification for the LifeNavigator validator
spine: **the platform is what makes a frontier model safe to ship.**

**Routing implication.** **No model is ever routed un-piped.** Every model — Flash, Pro, or Claude — must
sit behind the number gate / trust spine. The model choice is a quality/cost/latency decision; the
pipeline is non-negotiable for all of them.

---

## Synthesis

1. **One failure mode dominates across every in-pipeline model: the number-gate fallback** (ungrounded /
   derived / benchmark numbers). Flash 5/50, Pro 4/50, Claude Opus 6/50 — and 100% of fallbacks are this
   class (Pro's lone `unavailable` aside). The trust spine converts all of them to safe generic replies →
   **0 fabrications shipped by any in-pipeline model.**
2. **Model personality shifts the fallback count predictably.** Flash under-reasons (quality cap, moderate
   fallbacks). Pro is the balanced sweet spot (fewest fallbacks, highest trust 8.7, clears 7.5). Claude is
   over-assertive (reaches for ungroundable benchmark/projection numbers → most fallbacks) and slowest.
3. **The pipeline is load-bearing, not cosmetic.** Raw Claude fabricated 3 numbers and made conceptual
   errors; the gate caught the numbers (0 shipped). This is why no model runs un-piped.
4. **Residual risk the number gate does NOT cover: advice correctness.** Conceptual errors in non-numeric
   advice (e.g. "mortgage paydown = tax-free return") pass the numeric gate untouched and have been
   observed for both Claude and LifeNavigator. This is the open monitoring item, most acute for the most
   assertive models, and must be addressed outside the number gate.
5. **Routing follows from the failure modes:** Flash = cost floor for low-stakes; **Pro = default advisor
   (sweet spot)**; Claude = premium offline only (assertiveness + latency tolerance), never the
   interactive advisor.
