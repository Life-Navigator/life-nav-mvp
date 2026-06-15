# LIOS Latency Model

> **Implementation planning only — no code, no runtime change, no deploy, no Gemini wiring, no beta change.**
> Projects wall-clock latency per query tier from the **measured live baseline**
> (`CURRENT_STATE_AUDIT.md` §6) using the parallel/serial structure in `PARALLELIZATION_MODEL.md` and the
> per-tier agent DAGs in `AGENT_SELECTION_ENGINE.md` §4. Targets from
> `EXECUTION_EVALUATION_FRAMEWORK.md` §2.1.
>
> **This is an ESTIMATE** built on one measured number (the live single turn). Per-tier figures are
> projections and are given as ranges.

---

## 1. Measured live baseline (LIVE)

| Metric                  | Live value           | Source                            |
| ----------------------- | -------------------- | --------------------------------- |
| Full turn latency (avg) | **~9–10s**           | `analytics.advisor_turn_metrics`  |
| Full turn latency (p95) | **~13–16s**          | same                              |
| `llm_generate` share    | **~76% of the turn** | `stages_ms.llm_generate`          |
| TTFB (streaming ack)    | **~1.3s**            | deterministic `ack` emitted first |

Stage breakdown (`stages_ms`): `deterministic_turn, context_build, plan, llm_generate, validate, compose`.
`llm_generate` dominates; everything else (deterministic turn, context build, validate, compose) sums to
~24% (~2.2–2.4s at a ~9.5s turn). **The single LLM call is the latency.**

**Targets** (`EXECUTION_EVALUATION_FRAMEWORK.md` §2.1, graded not gated): TTFB <~2s (live ~1.3s ✅);
full avg <4s (live ~9–10s ❌ model-bound); p95 <6s (live ~13–16s ❌). The live miss is acknowledged and
model-bound — the mitigation that already shipped is streaming the ack first (TTFB target is met).

### 1.1 The unit: one LLM call

At ~76% of a ~9.5s turn, **one `gemini-2.5-flash` call ≈ 7–8s** (p95 ~10–12s). We carry **one LLM call =
~7–8s avg / ~12s p95** as the planning unit. Non-LLM stages (context build, deterministic turn, validate,
compose) ≈ **~2–2.5s** of fixed serial overhead per turn.

---

## 2. The arithmetic (from `PARALLELIZATION_MODEL.md` §4)

```
latency(parallel group) = max( latency(member_i) )        # concurrent → slowest wins
latency(serial chain)   = Σ latency(stage_j)              # sequential → stacks
turn latency ≈ fixed_overhead + Σ(serial LLM stages) + (each parallel group counted once at its max)
```

The decisive fact: **parallel groups cost one call's time; serial chains cost the sum.** Domain agents
parallelize (Finance ∥ Career ∥ Family); the **decision tail is strictly serial** (Decision Scientist →
Scenario → Tradeoff → Recommendation → Critic → Compliance → Compose) and each link stacks another ~7–8s.

---

## 3. Per-tier projection (PLANNED)

Using ~7–8s/LLM call, ~2–2.5s fixed overhead, and the DAGs in `AGENT_SELECTION_ENGINE.md` §4. LLM-issuing
agents only (Tool Execution / GraphRAG retrieval / deterministic Compliance / Audit are non-LLM).

### 3.1 SIMPLE — "What is my net worth?" — ~1 LLM call

```
det_turn → [graph_plan(skip) ∥ tool_plan] → Finance(LLM) → Tool Exec(det) → Compliance(det) → Compose
```

- Structure: **1 LLM call**, no domain join. ≈ today's path.
- **Est: ~8–11s avg, ~12–16s p95.** Essentially the live baseline (plus a possible Flash-Lite intent
  classify, +~0.5–1s if not sampled).
- Meets the live experience; still over the <4s target (model-bound, same as today).

### 3.2 MODERATE — "Can I afford this house?" — parallel domains + short serial tail

```
[ Finance ∥ Family ]  →  JOIN  →  Decision Scientist  →  Tool Exec(serial calc)  →  Compliance → Compose
   max(~8s)                          ~7–8s                 ~1–2s (deterministic)
```

- Parallel group `[finance, family]` = **max(Finance, Family) ≈ 8s** (NOT 16s — this is the parallelism
  win). Then a serial Decision-Scientist call ≈ 7–8s.
- **Math:** 2.5 (overhead) + 8 (domain group) + 8 (decision) + ~2 (det tools+gate) ≈ **~20s avg**, p95
  **~26–30s**.
- Range: **~16–22s avg / ~26–32s p95.** A single LLM call's worth of domain time + one decision call is
  the cost; the parallel group saved ~8s vs running domains serially.

### 3.3 COMPLEX — "Move to Texas + new job + buy a house?" — parallel domains + long serial tail

```
[ Finance ∥ Career ∥ Family ] → JOIN → Decision Scientist → Scenario → Tradeoff → Recommendation → Critic → Compliance → Compose
        max(~8s)                          ~8s         ~8s        ~8s         ~8s          ~8s        det        det
```

- Parallel group `[finance, career, family]` = **max ≈ 8s** (three calls for the price of one in time).
- **Serial decision tail = 5 LLM calls** (Decision Scientist, Scenario, Tradeoff, Recommendation, Critic),
  each ~7–8s, **stacked** because each consumes its predecessor (`PARALLELIZATION_MODEL.md` §5.3).
- **Math:** 2.5 (overhead) + 8 (domain group) + 5×8 (serial tail) + ~2 (det tools+gate) ≈ **~52s avg**.
  p95 with ~12s calls: 2.5 + 12 + 5×12 + 2 ≈ **~76s**.
- **Range: ~40–55s avg / ~60–90s p95.**

**Headline finding:** an unmitigated complex query is **~30–60s+** — a single serial chain of 6 LLM calls.
The parallel domain group is cheap (one call's time); the killer is the **serial decision→critic→compliance
→compose tail**, where every link adds another ~8s. Complex latency is dominated by serial depth, not by
domain fan-out.

---

## 4. Bottlenecks

1. **`llm_generate` is ~76% of every call** — the model is the wall. Nothing else is close.
2. **Serial tail depth (complex).** 5 sequential reasoning calls = ~40s of unavoidable stacking under the
   current "one model call per agent" assumption. This is the dominant complex-tier cost.
3. **Fixed per-turn overhead (~2–2.5s)** is paid once and is fine; not a bottleneck.
4. **Domain fan-out is NOT a bottleneck** once parallelized — it collapses to one call's time.

---

## 5. Mitigation strategies (in impact order)

1. **Stream the ack first — ALREADY LIVE.** `converse_stream` emits a deterministic `ack` (~1.3s TTFB) then
   the validated `final`. The user is never staring at a blank screen even on a 50s complex turn. Keep this
   for every tier and extend it to **progressive/partial rendering** of the serial tail (stream each stage's
   result as it lands).
2. **Parallelize domains — PLANNED (Phase 5, `MULTI_AGENT_ENABLED`).** Turns moderate/complex domain time
   from a sum into a max; saves ~8s (moderate) / ~16s (complex).
3. **Skip the Critic when low-risk — design default (R8).** The Critic is gated to high/regulated/
   cross-domain. Every turn that legitimately skips it drops ~8s off the tail.
4. **Faster classification model.** Intent classify via `gemini-2.5-flash-lite` keeps the routing call
   sub-second-ish and off the critical path of the answer (and can be sampled).
5. **Cache context.** Reusing the cached system prompt + grounding across a conversation's turns shaves
   input-processing time per call.
6. **Trim prompts.** Smaller input (~85% of tokens) means faster generation per call — helps every tier
   linearly.
7. **Collapse the tail where correctness allows.** If Scenario + Tradeoff can be one structured call for
   simpler decisions (escalate to the full chain only when option-modeling is needed,
   `AGENT_ESCALATION_MODEL.md`), the serial depth drops from 5 to 3 — the single biggest complex-tier win
   after parallelization.

### 5.1 Projected latency with mitigations

| Tier     | Unmitigated | With ack-stream + parallel domains + tail-collapse + Critic-skip-when-safe |
| -------- | ----------- | -------------------------------------------------------------------------- |
| Simple   | ~8–11s      | TTFB ~1.3s; full ~8–11s (model-bound floor)                                |
| Moderate | ~16–22s     | TTFB ~1.3s; full ~14–18s (parallel domains already counted)                |
| Complex  | ~40–55s     | TTFB ~1.3s; full ~24–35s (tail 5→3 calls, Critic only when required)       |

Even fully mitigated, a genuine high-stakes complex turn is **~25–35s** because the serial reasoning chain
is irreducible without a faster model — but the user sees an instant ack and progressive results, so
_perceived_ latency is far lower. Honest projection: **unmitigated complex = 30–60s+; mitigated, perceived
= near-instant first token + progressive fill.**

---

## 6. LIVE vs PLANNED

- **LIVE:** the single-turn baseline (~9–10s avg / ~13–16s p95), `stages_ms` per-stage timing, the streamed
  ack (TTFB ~1.3s), `llm_generate` 76% attribution.
- **PLANNED:** all multi-agent tiers, parallel domain execution (Phase 5), the Critic call (Critic not
  built), per-new-stage `stages_ms` breakout (intent/route/graph/tool/conflict/critic/compose —
  `EXECUTION_EVALUATION_FRAMEWORK.md` §2.1), tail-collapse, context caching, and progressive rendering.

## 7. Honesty note

Only the single live turn is measured; every per-tier figure is a projection that assumes each agent =
one ~7–8s model call. Re-derive from real `advisor_turn_metrics` (per-stage `stages_ms` by tier) before
any phase that adds calls ships. The two assumptions that move the answer most are **serial-tail depth**
(number of stacked reasoning calls) and **per-call latency** (model speed / prompt size).
