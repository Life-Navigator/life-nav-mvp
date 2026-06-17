# LIOS Execution Evaluation Framework

> **Design/spec only — no code, no Gemini wiring, no runtime, no Vertex, no beta change.** Derived from
> `LIOS_EVALUATION_FRAMEWORK.md` (the dimensions, gates, harnesses, golden sets, cadence — this **extends**
> it to the execution layer, it does not duplicate it), `EXECUTION_ARCHITECTURE.md` (the staged lifecycle),
> `EXECUTION_STATE_MACHINE.md` (turn/agent states), `docs/lios-agent-specifications/AUDIT_AGENT.md`, and the
> companion `OBSERVABILITY_MODEL.md` (the signals these metrics consume).

> **The parent framework owns the entity-level evaluation (Fact/Risk/Recommendation/Relationship/Decision).
> This doc owns how the _execution layer_ — orchestration, agent runs, retrieval, tools, compliance, critic,
> assembly — is measured for quality.** Read `LIOS_EVALUATION_FRAMEWORK.md` first; this only adds the
> execution lens.

---

## 1. Principle (inherited, restated)

- **Trust is a hard gate (zero tolerance); quality and latency are graded vs targets**
  (`LIOS_EVALUATION_FRAMEWORK.md` §1–§2).
- **Observability is itself a gate** (must be on) and is _how_ these metrics are produced — fed by the live
  `analytics.advisor_turns` + `analytics.advisor_turn_metrics` + `GET /v1/admin/advisor-metrics` and the
  PLANNED extensions in `OBSERVABILITY_MODEL.md`.
- **Measurement never fabricates.** Subjective quality is human/judge-sampled, never machine-invented; a
  metric we cannot honestly produce is listed as a **gap**, not faked.

---

## 2. Execution-layer metrics

Each: **definition · how measured · gate-vs-graded · live-vs-planned.**

### 2.1 Latency (avg / p95, per-stage) — GRADED vs targets

- **Definition:** wall-clock per turn (avg + p95) and per-stage attribution (`stages_ms`).
- **How measured:** `stages_ms`/p95 in `analytics.advisor_turn_metrics`; driven live by `advisor-eval.mjs`
  and `advisor-decisions-probe.mjs`.
- **Targets** (`LIOS_EVALUATION_FRAMEWORK.md` §5): TTFB < ~2s (live ~1.3s); full avg < 4s (live ~9–10s,
  model-bound); p95 < 6s (live ~13–16s); `llm_generate` should dominate (~76%).
- **LIVE.** New stages (intent/route/graph/tool/conflict/critic/compose) must each appear in `stages_ms`
  (PLANNED per-stage breakout for the new stages).

### 2.2 Recommendation quality — GRADED

- **Definition:** are recs evidence-backed, assumptions explicit, expert (CFP/CPA)-survivable.
- **How measured:** trust gate (no rec without evidence) deterministically; _richness_ via the PLANNED
  recommendation golden set + sampled human review.
- **LIVE:** structural evidence-or-nothing check. **PLANNED:** coverage/quality scoring vs golden set.

### 2.3 Hallucination rate — **GATE = 0**

- **Definition:** any invented goal/risk/opportunity/rec, fabricated number outside allowed-numbers,
  ungrounded relationship claim, candidate-shown-as-confirmed, rejected-goal resurrection.
- **How measured:** deterministic trust checks in `advisor-eval.mjs` / `fresh-user-e2e.mjs`; cross-checked
  against the `compliance` event and `validator_result` in the metrics view.
- **Gate.** Any non-zero is a release blocker (`LIOS_EVALUATION_FRAMEWORK.md` §2). **LIVE — runs show 0.**

### 2.4 Compliance pass rate — GRADED (within a GATE)

- **Definition:** validation failure rate (% LLM outputs rejected) and repair rate (% repaired).
- **How measured:** `validator_result` + `repairs[]` rolled up in `analytics.advisor_turn_metrics`; the
  `compliance` event in `OBSERVABILITY_MODEL.md`.
- **Note:** lower failure rate is better, **but never by weakening safety** — the gate (§2.3) is sacrosanct.
- **LIVE** (validation failure rate ~0%, fallback rate live 0%, target < 5%).

### 2.5 Confidence calibration — GRADED

- **Definition:** does stated confidence match realized outcomes (adoption/correctness)?
- **How measured:** the `confidence` components in the turn record vs an outcome/feedback loop.
- **PLANNED** — requires the recommendation feedback loop (`LIOS_EVALUATION_FRAMEWORK.md` §11 gap #3).

### 2.6 Tool utilization — GRADED

- **Definition:** % decision/number turns that actually ran a deterministic tool (vs asserting a number);
  tool latency; tool failure → `blocked`-branch rate.
- **How measured:** the PLANNED `tool_plan` event (tool, inputs-hash, `calculation_trace` ref, latency)
  rolled into the metrics view.
- **PLANNED** (depends on `tool_plan` logging).

### 2.7 Graph utilization — GRADED

- **Definition:** % relationship claims backed by a cited edge; retrieval-set precision (fetched ids that
  were actually used); abstain-vs-cite balance.
- **How measured:** **LIVE today only as counts** (`graph_edges_available`, `relationships_referenced`);
  **PLANNED** the full retrieval-set ids (`OBSERVABILITY_MODEL.md` §7, the named gap) + a seeded-graph
  persona to exercise the cite path, not just the abstain path.
- **LIVE (counts) / PLANNED (retrieval-set precision + coverage).**

### 2.8 User satisfaction — GRADED

- **Definition:** perceived usefulness / non-evasiveness (e.g. decision evasiveness ~19% vision-deflection,
  context-use rate) and any explicit feedback.
- **How measured:** `advisor-decisions-probe.mjs` (evasiveness, context use) live; explicit satisfaction
  signal is PLANNED (needs a feedback surface).
- **LIVE (proxy metrics) / PLANNED (explicit signal).**

---

## 3. Gates vs graded (the execution scorecard)

| Metric                                   | Type     | Target                       | Live?                   |
| ---------------------------------------- | -------- | ---------------------------- | ----------------------- |
| Hallucination / trust invariants         | **GATE** | **0**                        | LIVE (0)                |
| Final financial/legal/medical/tax advice | **GATE** | **0**                        | LIVE (0)                |
| LLM-initiated writes                     | **GATE** | **0**                        | LIVE (0)                |
| Observability on (every turn recorded)   | **GATE** | on                           | LIVE                    |
| Fallback rate                            | graded   | < 5%                         | LIVE (0%)               |
| Validation failure rate                  | graded   | low, never via weaker safety | LIVE (~0%)              |
| Latency avg / p95 / per-stage            | graded   | <4s / <6s / attributed       | LIVE (model-bound miss) |
| Recommendation quality / coverage        | graded   | golden-set scored            | PLANNED                 |
| Confidence calibration                   | graded   | stated≈realized              | PLANNED                 |
| Tool utilization                         | graded   | tool-backed numbers          | PLANNED                 |
| Graph utilization (retrieval precision)  | graded   | cite path exercised          | PLANNED                 |
| User satisfaction                        | graded   | non-evasive, useful          | partial                 |

**Hard rule (inherited):** no change near a safety boundary ships without a test proving the gate still
holds; loosening a gate to cut false positives must be surgical and tested.

---

## 4. Harnesses + the metrics view (how each metric is produced)

| Metric                                                       | Live harness / view                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------- |
| Latency, fallback rate, trust checks                         | `apps/web/advisor-eval.mjs` + `analytics.advisor_turn_metrics`       |
| Decision quality, evasiveness, context use, decision latency | `apps/web/advisor-decisions-probe.mjs`                               |
| Journey health, honest empty states, 0 errors                | `apps/web/fresh-user-e2e.mjs`                                        |
| Validation failure rate, repair rate, p95, stages_ms, tokens | `analytics.advisor_turn_metrics` via `GET /v1/admin/advisor-metrics` |

All harnesses mint + clean their own synthetic users, hit the live backend, and run **deterministic** trust
checks (`LIOS_EVALUATION_FRAMEWORK.md` §7). **Planned harness additions** (execution-layer): data-rich +
seeded-graph personas (coverage / graph utilization), a decision golden set (tradeoff quality), a tool-trace
probe (tool utilization), and an adversarial Critic panel (high-stakes refutation) — each blocked on its
underlying capability.

---

## 5. Cadence & gates

| When                                        | What runs                                                     | Gate                                              |
| ------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| Per change (prompt/validator/orchestration) | the relevant harness + validator unit tests                   | trust = 0; fallback not worse; safety tests pass  |
| Pre-deploy                                  | `advisor-eval` + `advisor-decisions-probe` + `fresh-user-e2e` | trust gate; latency/UX within targets             |
| Post-deploy (live)                          | re-run harnesses + read `advisor_turn_metrics`                | no regression on real traffic                     |
| Continuous                                  | `analytics.advisor_turn_metrics`                              | watch fallback rate, validation failure rate, p95 |

(Identical cadence to `LIOS_EVALUATION_FRAMEWORK.md` §9 — restated here so the execution layer is checkable
without cross-referencing.)

---

## 6. Honest measurement-gap backlog (execution layer)

Inherited from `LIOS_EVALUATION_FRAMEWORK.md` §11, scoped to execution. None of these is faked; each is a
known gap with a named unblocker.

1. **Coverage unmeasured** — fresh-user evals only test the empty state; need data-rich + seeded-graph
   personas to measure recommendation/domain/graph richness.
2. **No golden sets yet** — recommendation/decision/relationship golden sets are PLANNED; quality regression
   relies on deterministic checks + sampled human review until then.
3. **Confidence calibration** — needs the recommendation feedback loop (adoption/outcome).
4. **Per-turn retrieval-set logging** — only counts today; the node/edge/doc-id set is the named gap that
   gates graph-utilization precision (`OBSERVABILITY_MODEL.md` §7).
5. **Critic** — the adversarial high-stakes check is not built, so its metric (refutation verdict rate) has
   no producer; its eval does not yet exist.
6. **Tool-trace probe** — tool utilization depends on the PLANNED `tool_plan` event.

---

## 7. Definition of done (this doc)

A new engineer can, for the execution layer, name every metric, say whether it is a **gate (trust=0)** or
**graded vs target**, point to the **live harness or metrics view** that produces it (or mark it PLANNED with
its unblocker), state the **cadence** that runs it, and list the **measurement gaps** the build phase must
close — without duplicating the entity-level framework in `LIOS_EVALUATION_FRAMEWORK.md`.
