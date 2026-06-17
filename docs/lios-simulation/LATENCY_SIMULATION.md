# LIOS Latency Simulation

> **Phase 5 — simulation/evaluation only. No code, no orchestration, no deploy, no Vertex, no Claude, no
> beta change. Do not modify other files.** This simulates p50/p95/p99 wall-clock for four architecture
> variants across three query tiers, using the **LLM-call latency model** (parallel = max over group; serial
> = sum; deterministic ≈ free). It shows the math per variant, names the bottleneck (the serial decision
> tail; `llm_generate` ≈ 76%), and shows how the merge hypotheses move LIOS-full's ~40–90s complex down to
> LIOS-minimal's ~15–25s.
>
> **Honesty up front:** built on **ONE measured turn** (`LATENCY_MODEL.md` §1). Per-tier/per-variant figures
> are projections that assume each agent = one ~7–8s model call. Ranges, not precise numbers.

---

## 1. Grounding facts (verbatim — used everywhere below)

| Fact                         | Value                                     | Assumption stated                                  |
| ---------------------------- | ----------------------------------------- | -------------------------------------------------- |
| One LLM call                 | **≈ 7–8s avg** (p95 ~10–12s, p99 ~13–14s) | the simulation unit; ≈ 76% of a turn               |
| Tokens per call              | ~3,110                                    | drives per-call time                               |
| Current single advisor turn  | **avg ~9–10s · p50 ~9.2s · p95 ~13–16s**  | live eval (`advisor_turn_metrics`)                 |
| `llm_generate` share         | **~76% of the turn**                      | parsed `stages_ms`                                 |
| Fixed deterministic overhead | **~2–2.5s/turn**                          | context build + det turn + validate + compose      |
| TTFB (streamed ack)          | **~1.3s**                                 | deterministic ack emitted first — **already live** |

**Latency arithmetic (from `PARALLELIZATION_MODEL.md` §4):**

```
latency(parallel group) = max( member_i )       # concurrent → slowest wins
latency(serial chain)   = Σ stage_j             # sequential → stacks
turn ≈ fixed_overhead + Σ(serial LLM stages) + (each parallel group counted once at its max)
```

Deterministic stages (tool exec, graph retrieval, compliance gate, audit, det domain summaries under H3) ≈
free relative to a 7–8s call. **The model call is the wall; nothing else is close.**

**Per-call planning values used below:** p50 = 7.5s · p95 = 11s · p99 = 13.5s, + 2.25s fixed overhead/turn.

---

## 2. The four variants (LLM-call counts per tier)

| Tier     | **Current** | **LIOS-minimal** (H1–H5)                                                 | **LIOS-moderate** (partial merge)                                     | **LIOS-full** (as-designed)                                                               |
| -------- | ----------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| SIMPLE   | 1 serial    | 1 serial                                                                 | 1 serial                                                              | 1 serial (+ optional intent)                                                              |
| MODERATE | 1 serial    | 1 parallel-domain (det) + 1 decision = 1 serial reasoning                | 2 serial (domains det + Decision Scientist + 1 collapsed)             | 1 parallel group + 2 serial (Decision Scientist + Tradeoff)                               |
| COMPLEX  | 1 serial    | 1 reasoning (domains det, tail 4→1) + Critic if high-stakes = 1–2 serial | domains det + 3 serial (Scientist→Scenario+Tradeoff collapsed→Critic) | 1 parallel group(max) + 5 serial tail (Scientist→Scenario→Tradeoff→Recommendation→Critic) |

- **Current:** today's single governed turn — does not run a decision tail.
- **LIOS-minimal:** H3 makes domains deterministic (no LLM call, runs ≈ free), H2 collapses the 4-call tail
  to **1** reasoning call, H4 gates the Critic. Complex = 1–2 serial LLM calls.
- **LIOS-moderate:** partial merge — domains deterministic, but the tail is collapsed only to **3** serial
  reasoning calls (the `LATENCY_MODEL.md` §5 "tail 5→3" mitigation), Critic kept for high-stakes.
- **LIOS-full:** as-designed — parallel domain group (max ≈ 1 call's time) **plus the 5-call serial tail.**

---

## 3. The math, per variant per tier

Formula: **turn = 2.25 (overhead) + (parallel domain group, counted once at max) + Σ(serial LLM calls).**
Parallel domain group only adds time when domains are **LLM** (LIOS-full); under H3 (minimal/moderate) the
domain group is deterministic ≈ free.

### 3.1 SIMPLE — "What is my net worth?"

All variants = **1 serial LLM call** (the live path). LIOS adds at most a sampled Flash-Lite intent classify
(~0.5s, off the answer's critical path / sampled — treated as ~0).

| Variant       | Math (p50)                |        p50 |    p95 |    p99 |
| ------------- | ------------------------- | ---------: | -----: | -----: |
| Current       | 2.25 + 7.5                |  **~9.8s** | ~13.3s | ~15.8s |
| LIOS-minimal  | 2.25 + 7.5                |  **~9.8s** | ~13.3s | ~15.8s |
| LIOS-moderate | 2.25 + 7.5                |  **~9.8s** | ~13.3s | ~15.8s |
| LIOS-full     | 2.25 + 7.5 (+~0.5 intent) | **~10.3s** |   ~14s | ~16.5s |

Simple is **model-bound at the floor** for every variant — matches live ~9–10s avg / ~13–16s p95. No
architecture beats the single call here.

### 3.2 MODERATE — "Can I afford this house?"

| Variant       | Structure                                 | Math (p50)               |        p50 |    p95 |    p99 |
| ------------- | ----------------------------------------- | ------------------------ | ---------: | -----: | -----: |
| Current       | 1 LLM call                                | 2.25 + 7.5               |  **~9.8s** | ~13.3s | ~15.8s |
| LIOS-minimal  | domains det + 1 reasoning                 | 2.25 + 7.5               |  **~9.8s** | ~13.3s | ~15.8s |
| LIOS-moderate | domains det + 2 serial                    | 2.25 + 2×7.5             | **~17.3s** | ~24.3s | ~29.3s |
| LIOS-full     | [Fin∥Fam] max + Decision Scientist serial | 2.25 + 7.5 (group) + 7.5 | **~17.3s** | ~24.3s | ~29.3s |

> Parallelism win is visible: LIOS-full's `[Finance ∥ Family]` group costs **one** call's time (max), not
> two. But it still pays a serial Decision Scientist call on top → ~17s. LIOS-minimal collapses both the
> domain calls (H3 → deterministic) and folds the affordability reasoning into one call → back to ~9.8s.

### 3.3 COMPLEX — "Move to Texas + new job + buy a house?"

| Variant       | Structure                                                   | Math (p50)                 |            p50 |         p95 |         p99 |
| ------------- | ----------------------------------------------------------- | -------------------------- | -------------: | ----------: | ----------: |
| Current       | 1 LLM call (single governed turn)                           | 2.25 + 7.5                 |      **~9.8s** |      ~13.3s |      ~15.8s |
| LIOS-minimal  | domains det + tail 4→1 + (Critic if high)                   | 2.25 + 7.5 (+7.5 Critic)   | **~9.8–17.3s** | ~13.3–24.3s | ~15.8–29.3s |
| LIOS-moderate | domains det + 3 serial (Scientist→Scenario+Tradeoff→Critic) | 2.25 + 3×7.5               |     **~24.8s** |      ~35.3s |      ~42.8s |
| LIOS-full     | [Fin∥Career∥Fam] max + 5-call serial tail                   | 2.25 + 7.5 (group) + 5×7.5 |     **~47.3s** |      ~68.3s |      ~83.3s |

**LIOS-full math expanded (the bottleneck made explicit):**

```
p50: 2.25 overhead
   + max(Finance, Career, Family) = 7.5     ← parallel domain group: 3 calls for 1 call's time
   + Decision Scientist 7.5  ┐
   + Scenario          7.5   │
   + Tradeoff          7.5   ├─ STRICTLY SERIAL TAIL = 5 × 7.5 = 37.5s  ← the killer
   + Recommendation    7.5   │
   + Critic            7.5   ┘
   = ~47.3s p50 ;  p95 (11s/call): 2.25 + 11 + 5×11 = ~68.3s ;  p99 (13.5s/call): ~83.3s
```

> The parallel domain group is **cheap** — three domains for one call's time. The **serial decision tail is
> the entire problem**: 5 stacked reasoning calls = ~37–55s of irreducible sequence under "one model call
> per agent." This is `LATENCY_MODEL.md` §3.3's ~40–55s avg / 60–90s p95, reproduced.

---

## 4. Summary table — COMPLEX p95 (the headline metric)

| Variant         | Complex p50 | **Complex p95** | Complex p99 |  Serial LLM calls in tail |
| --------------- | ----------: | --------------: | ----------: | ------------------------: |
| Current advisor |       ~9.8s |     **~13–16s** |        ~16s |           0 (single call) |
| LIOS-minimal    |  ~9.8–17.3s |     **~13–24s** |     ~16–29s | 1 (4→1) + optional Critic |
| LIOS-moderate   |      ~24.8s |        **~35s** |        ~43s |                   3 (5→3) |
| LIOS-full       |      ~47.3s |        **~68s** |        ~83s |                         5 |

**Targets** (`EXECUTION_EVALUATION_FRAMEWORK.md` §2.1, graded not gated): TTFB <2s ✅ (live ~1.3s); full avg
<4s ❌ (model-bound for all variants); p95 <6s ❌ (model-bound). Every variant misses the full-turn target —
this is the **model speed wall**, not an architecture choice. Architecture only decides **how many** walls
you stack.

---

## 5. Bottlenecks (in impact order)

1. **The serial decision tail (LIOS-full).** 5 stacked reasoning calls = ~37s (p50) / ~55s (p95) of
   unavoidable sequence. This single factor is the difference between a ~13s complex turn and an ~68s one.
   It is the dominant complex-tier cost and the entire gap between full and minimal.
2. **`llm_generate` ≈ 76% of every call.** The model is the wall; every added LLM call adds ~7–8s. Nothing
   deterministic comes close. This is why H3 (domains deterministic) is "free" latency and H2 (collapse the
   tail) is the biggest win.
3. **Fixed per-turn overhead (~2–2.5s)** — paid once, not a bottleneck.
4. **Parallel domain fan-out is NOT a bottleneck** once parallelized — it collapses to one call's time
   (`PARALLELIZATION_MODEL.md` §4). Adding domains is cheap; adding serial reasoning steps is expensive.

---

## 6. How the merge hypotheses move complex p95 (full → minimal)

| Step             | Hypothesis                                                            | Effect on complex tail                                    | Complex p95 after |
| ---------------- | --------------------------------------------------------------------- | --------------------------------------------------------- | ----------------: |
| Start            | LIOS-full as-designed                                                 | 5-call serial tail + 3-domain LLM group                   |          **~68s** |
| Apply H3         | domains deterministic (live summary services feed 1 reasoning call)   | removes the 3-call domain group → its max (~11s p95) gone |          **~57s** |
| Apply H4         | Critic high-stakes-only                                               | drops ~1 call (~11s) from non-high-stakes turns           |          **~46s** |
| Apply partial H2 | tail 5→3 (Scenario+Tradeoff collapse) = **LIOS-moderate**             | tail 3 calls                                              |          **~35s** |
| Apply full H2    | tail 4→1 (single Decision Engine call + det tools) = **LIOS-minimal** | tail 1 call (+Critic only if high)                        |       **~13–24s** |

**The arc:** ~68s (full) → ~57s → ~46s → ~35s (moderate) → **~13–24s (minimal)**. The merge hypotheses take
LIOS-full's ~40–90s complex turn down to **~15–25s** — within striking distance of today's single-call
advisor (~13–16s), for a complex multi-domain decision. **H2 (collapse the tail) is by far the biggest mover**
(35s → 24s and below), exactly as `LIOS_SIMULATION_FRAMEWORK.md` §4 predicts.

---

## 7. Perceived vs total latency (streaming — already live)

`converse_stream` emits a deterministic **ack at ~1.3s TTFB** then the validated final — **already shipped**
(`LATENCY_MODEL.md` §5.1). This means:

- **Perceived first-token latency ≈ 1.3s for every variant and every tier** — the user never stares at a
  blank screen, even on a 68s LIOS-full complex turn.
- **It does NOT reduce total/completion latency.** A 68s turn still completes in 68s; streaming only changes
  _when the user sees the first character_, not when the full validated answer lands.
- **Progressive/partial rendering of the serial tail** (stream each stage as it lands — PLANNED) would let
  the user watch the decision build, further improving _perceived_ latency without touching total.

> Honest framing: streaming makes a slow turn _feel_ responsive but does not make it _fast_. For a genuine
> high-stakes complex decision, total latency still matters (the user is waiting for the actual answer), and
> only fewer serial LLM calls (the merge hypotheses) reduce it.

---

## 8. Findings

- **Simple is model-bound at ~9.8s p50 / ~13–16s p95 for every variant** — no architecture wins here.
- **Complex p95 is the headline:** Current ~13–16s · **LIOS-minimal ~13–24s · LIOS-moderate ~35s ·
  LIOS-full ~68s.** LIOS-full is **~4–5× slower** on complex than minimal, entirely due to the serial tail.
- **The serial decision tail is the single bottleneck.** Domain fan-out is free (parallel = max); the 5
  stacked reasoning calls are the whole cost.
- **The merge hypotheses work:** H3 + H4 + H2 take complex from ~68s to ~15–25s — confirming the framework's
  central claim that the cheap, deterministic-adjacent design is most of the value at a fraction of the
  latency.
- **Streaming (live) fixes perceived latency, not total** — keep it for every tier; do not let it mask the
  decision to keep the architecture shallow.

## 9. Honesty note

Only the single live turn is measured (~9–10s avg / ~13–16s p95, `llm_generate` 76%). Every per-tier,
per-variant figure assumes each agent = one ~7–8s model call and is given as a range. The two assumptions
that move the answer most are **serial-tail depth** (number of stacked reasoning calls) and **per-call
latency** (model speed / prompt size). Re-derive from real `advisor_turn_metrics` per-stage `stages_ms` by
tier before any phase that adds calls ships. Ranges, not false precision.
