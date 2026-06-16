# Production Model Routing Proposal

**Date:** 2026-06-15
**Status:** Proposal — grounded in the V6 benchmark + Claude Control Experiment
**Sources:** `CLAUDE_CONTROL_EXPERIMENT.md`, `ADVISOR_V6_RESULTS.md` (no `MODEL_ROLE_QUALIFICATION.md` present)

---

## TL;DR

The benchmark proved one thing decisively: **model capability is the primary lever** on advisor
quality (Claude inside LifeNavigator scored 7.30 vs Gemini's 6.66, +0.64, on the identical pipeline),
and that uplift is concentrated in **actionability (+1.5), insight (+0.9), question quality (+0.8),
personalization (+0.8), executive presence (+0.8), framing (+0.6)**. It also proved the second thing:
**Claude Opus is ~5× slower (p50 61s vs 12.7s) and far more expensive per token** — a blanket Opus
swap is not viable for interactive UX.

The synthesis is **role-based routing, not a single model**:

- **Cheap/fast, deterministic-ish roles** (Classification, Compliance gate, Discovery first-touch)
  → **Gemini Flash / Flash-Lite**. Latency and cost dominate; the +0.64 quality uplift has no
  surface to land on.
- **The core interactive advisor turn** → **Gemini Flash by default, with an OPTIONAL Claude
  escalation** for turns flagged high-stakes. Blanket Opus here is 5× latency on every turn; a
  targeted escalation buys the uplift only where it pays for itself.
- **High-stakes, low-frequency, latency-tolerant roles** (Decision Analysis, Tradeoffs, Critic,
  Report Writer, Executive Review) → **Claude**. These are where the +0.64 (and the parts of it that
  the benchmark localized — actionability, insight, framing) directly moves the deliverable, and the
  user is not staring at a spinner.

**The likely sweet spot for the Claude roles is Sonnet, not Opus** — Sonnet should recover most of
the Opus quality at a fraction of the latency/cost. **This is UNTESTED.** It is pending (a) Model
Garden / Vertex enablement of a Sonnet endpoint and (b) the Sonnet economic benchmark run (same
50-scenario / 5-judge harness used for the Opus control). Until that run lands, the Claude roles
below default to Opus on the proven path with an explicit "switch to Sonnet on benchmark pass" note.

> Note on benchmarked model: the Claude Control Experiment ran on **Claude Opus 4.1 via Vertex**.
> Where this proposal says "Claude (Opus)" it means that benchmarked configuration. "Sonnet
> (pending)" is the recommended optimization, not yet measured.

---

## Why not just route everything to Claude

Two hard numbers from `CLAUDE_CONTROL_EXPERIMENT.md`:

1. **Latency:** Claude Opus p50 **61s** vs Gemini flash **12.7s** (~5×). On an interactive turn that
   is the difference between a usable advisor and an abandoned session.
2. **Quality landed only where it could:** the uplift is real (+0.64 overall) but **localized to
   reasoning-heavy criteria**. On a pure classification or a compliance pass/fail, there is no
   actionability/insight/framing to improve — so the premium buys nothing.

And one number that flips the usual safety worry: raw Claude produced **3 fabrications**; the LN
validator drove **LN+Claude to 0**. So Claude is safe to route _inside_ the existing trust spine — the
number-gate validator stays in front of every Claude call, exactly as it sits in front of Gemini today.

---

## Routing table

| Role                        | Recommended model                                       | Justification                                                                                                                                                                                                                                                                                                                                              | Benchmark evidence                                                                                                                                                                         | Cost implication                                                                                                | Latency implication                                                                                                 |
| --------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Discovery (first-touch)** | **Gemini Flash-Lite**                                   | First-touch is intake/triage — short, structured, high-volume, latency-critical. The quality uplift does not land on a greeting/intake turn; speed and cost dominate.                                                                                                                                                                                      | Inferred — needs test. (No discovery-specific cell in the benchmark; reasoned from the role being low-reasoning, high-frequency.)                                                          | Lowest. Flash-Lite is the cheapest tier; runs on the highest-frequency path.                                    | Lowest — must feel instant; first impression of the product.                                                        |
| **Classification**          | **Gemini Flash-Lite**                                   | Deterministic-ish label/route decision (intent, domain, stakes-tier). A frontier model is wasted here; this is the cheapest tier's home turf. **This role also computes the high-stakes flag** that drives Advisor escalation.                                                                                                                             | Inferred — needs test. (Classification is not a scored advisor criterion; reasoned from determinism + frequency.)                                                                          | Lowest — runs on every turn; must be cheap.                                                                     | Lowest — sits in the request path before the advisor turn; any latency here is added to every turn.                 |
| **Advisor (core turn)**     | **Gemini Flash (default) + OPTIONAL Claude escalation** | This is the benchmarked task. Gemini at 6.66 is a trustworthy default (trust 8.5, 0 fab, p50 12.7s). Claude lifts it to 7.30 but at 5× latency — too slow for _every_ turn. So: **default Gemini; escalate to Claude only on turns the Classifier flags high-stakes** (irreversible / large-dollar / emotionally weighted decisions). Hybrid, not blanket. | **Tested.** Gemini 6.66 vs Claude(LN) 7.30 (+0.64); latency 12.7s vs 61s; trust 8.5 vs 8.2; fab 0 vs 0.                                                                                    | Gemini cost on the majority of turns; Opus cost only on the flagged minority. Escalation rate is the cost dial. | 12.7s on the common path; ~61s only on escalated high-stakes turns where the user accepts a "thinking harder" wait. |
| **Decision Analysis**       | **Claude (Opus now → Sonnet on benchmark pass)**        | High-stakes, low-frequency, latency-tolerant. This is where framing (+0.6) and decision-framing quality directly shape the deliverable; the user expects a considered answer, not an instant one.                                                                                                                                                          | **Tested (proxy).** Decision framing 6.7 (Gemini) → 7.3 (Claude-LN) → 8.4 (raw Claude). Claude wins the exact sub-criterion.                                                               | Premium per call, but low call volume — runs only when the user enters a deliberate decision flow.              | ~61s tolerable; invoked deliberately, not on every keystroke.                                                       |
| **Tradeoffs**               | **Claude (Opus now → Sonnet on benchmark pass)**        | Tradeoff discovery is reasoning-heavy and rare per session. Claude leads the criterion; latency is acceptable in a structured tradeoff view.                                                                                                                                                                                                               | **Tested (proxy).** Tradeoff discovery 6.5 → 6.9 (Claude-LN) → 7.0 (raw). Smaller margin than other roles but consistently Claude-favored.                                                 | Premium, low volume.                                                                                            | Latency-tolerant — surfaced inside an analysis panel, not a chat turn.                                              |
| **Critic**                  | **Claude (Opus now → Sonnet on benchmark pass)**        | A critic/red-team pass over a drafted recommendation needs the strongest reasoning to catch weak logic and gaps. Runs once per deliverable, off the interactive path. The benchmark also shows Claude's reasoning surfaces (insight 6.1→7.0) are where it separates — exactly a critic's job.                                                              | Inferred — needs test. (No critic role in the benchmark; reasoned from insight uplift +0.9 and the role being a reasoning audit.)                                                          | Premium, very low volume (one pass per generated deliverable).                                                  | Fully async — never user-blocking.                                                                                  |
| **Report Writer**           | **Claude (Opus now → Sonnet on benchmark pass)**        | Long-form synthesis is exactly where Claude's executive presence (+0.8), actionability (+1.5), and writing quality compound. Reports are generated rarely and read carefully — quality >> speed.                                                                                                                                                           | **Tested (proxy).** Executive presence 6.5 → 7.3 → 8.4; actionability 4.7 → 6.2 → 8.5. The two largest Claude margins both feed report quality.                                            | Premium, low volume, high per-artifact value.                                                                   | ~61s+ acceptable; can stream or run in background and notify.                                                       |
| **Executive Review**        | **Claude (Opus now → Sonnet on benchmark pass)**        | The final "would a top advisor sign off on this" pass. Executive presence is a measured Claude strength; this gate is low-frequency and not user-blocking.                                                                                                                                                                                                 | **Tested (proxy).** Executive presence 6.5 → 7.3 → 8.4 (Claude clears the criterion Gemini doesn't).                                                                                       | Premium, lowest volume (one review per finalized deliverable).                                                  | Async, never blocks the user.                                                                                       |
| **Compliance (gate)**       | **Gemini Flash-Lite**                                   | A pass/fail safety gate (medical/legal/tax/advice-scope) — deterministic-ish classification, must run on every turn, must be fast and cheap. The +0.64 has no surface here; the existing LN compliance layer already cost ~0 quality and Claude's advice passed it cleanly.                                                                                | **Tested (indirect).** Per the control experiment, "Compliance (advice scope): ~0 measurable" — no medical/legal/tax/product blocks fired; the layer is a gate, not a quality contributor. | Lowest — runs on every turn; cheapest tier is correct.                                                          | Lowest — in the per-turn safety path; must add negligible latency.                                                  |

---

## The hybrid Advisor turn, concretely

```
user turn
   │
   ▼
[Classification — Gemini Flash-Lite]  →  intent, domain, STAKES-TIER flag
   │
   ├─ stakes = normal  ──────────────►  [Advisor — Gemini Flash]   (p50 12.7s)
   │
   └─ stakes = HIGH    ──────────────►  [Advisor — Claude escalation]  (~61s, "thinking harder")
                                              │
                  (both paths) ──────────────┤
                                              ▼
                              [Number-gate validator + repair]   ← unchanged trust spine; drove
                                              │                    LN+Claude fabrications to 0
                                              ▼
                              [Compliance gate — Gemini Flash-Lite]
                                              ▼
                                          response
```

- **Escalation rate is the primary cost/latency dial.** Start conservative (only clearly irreversible
  / large-dollar / high-emotion decisions escalate), measure the escalated-turn quality delta against
  the V6 benchmark, and tune.
- **The validator stays in front of every model.** It is the reason Claude is safe to route at all
  (3 raw fabrications → 0 inside LN). Do not bypass it on the Claude path.

---

## Sonnet: the untested sweet spot

Every "Claude (Opus now → Sonnet on benchmark pass)" cell above is a standing optimization. The
economics argue strongly for Sonnet on the high-stakes-but-frequent-enough roles (Decision Analysis,
Tradeoffs, the Advisor escalation): it should recover most of the Opus uplift at materially lower
latency and cost. **But we have not measured it.** Required before promoting Sonnet:

1. **Enable a Sonnet endpoint** (Model Garden / Vertex), same integration the Opus control used.
2. **Run the Sonnet economic benchmark** — identical 50-scenario set, identical 5-judge rubric,
   identical LN pipeline (same `ADVISOR_SYSTEM`, validator, repair, composer), so the result is
   directly comparable to the 6.66 / 7.30 / 8.00 three-way table.
3. **Decision rule (mirrors the LIOS gate criterion):** if LN+Sonnet ≥ ~7.2 (i.e. retains most of
   the +0.64) at meaningfully better latency/cost than Opus, promote Sonnet into the Claude roles and
   the Advisor escalation. If it regresses below the Gemini baseline on any role, do not route it
   there.

Until that run lands, the Claude roles run on the **proven** Opus-on-Vertex path.

---

## What this proposal does NOT require

Per both source documents: **LIOS (orchestrator, multi-agent runtime, agent execution) is not on the
critical path to advisor quality.** The gap decomposed into (a) model capability — addressed by this
routing — and (b) number-gate fallbacks — an engineering fix already on the V-series path. Role-based
routing captures the model-capability lever without any LIOS scaffolding. The role names above
(Discovery, Classification, Advisor, Decision Analysis, Tradeoffs, Critic, Report Writer, Executive
Review, Compliance) are **routing roles**, not a mandate to build a multi-agent runtime to host them.

```

```
