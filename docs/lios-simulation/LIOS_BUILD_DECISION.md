# LIOS Build Decision

> The decision this whole program of work exists to make. Brutally honest, evidence-only — no code, no
> orchestration. Synthesizes every simulation + the agent-effectiveness model + the risk analysis.

---

## 1. The options

- **Option A — Build exactly as designed (LIOS-full).** Per-domain LLM agents + the 4-call decision pipeline
  - separate Recommendation/Goal/Conflict LLM agents + Critic + Compliance-assist.
- **Option B — Build a simplified version (LIOS-minimal).** Merge hypotheses applied; deterministic domains;
  one Discovery Analyst; one Decision Engine; high-stakes-only Critic.
- **Option C — Build only selected portions.** The cheap, high-value additions now; defer the expensive,
  unproven fan-out indefinitely.
- **Option D — Delay implementation.** Keep today's advisor; build nothing yet.

## 2. The recommendation

> **Recommend Option C, realized as LIOS-minimal, gated on a coverage measurement — and explicitly reject
> Option A.**

In practice C and B converge: the "selected portions" worth building _are_ LIOS-minimal. The distinction
that matters is **build the cheap proven value + one carefully-scoped decision call; do NOT build the
per-domain LLM fan-out or the 4-call decision pipeline.** And before building the one expensive call, **run
the coverage measurement** — if multi-agent doesn't beat the advisor on data-rich personas, the right answer
slides toward D for the expensive part and "improve the single advisor" instead.

### Why not A

A carries the two **Critical** risks (serial-tail latency → complex p95 ~68s; a 40–90s product), breaches
the $4/day cap at ~46–100 users, costs 10–30× per complex query — all for quality gains that are **unproven**
(coverage unmeasured) and a recommendation/trust story that is **already solved deterministically**. A buys
the most cost for the least proven value. Reject.

### Why not pure D

The cheap additions (intent routing, prompt composition, ranked missing-data, telemetry, the observe-only
wrap) are near-free, reversible, and improve the _existing_ advisor's quality and maintainability with
essentially no risk. Delaying those leaves real value on the table. (But D is the correct posture for the
_expensive fan-out_ until coverage is proven.)

### Why C/B

It keeps every current strength (0 trust violations, 0% fallback, ~10s), adds the genuinely valuable cheap
capabilities, confines the only expensive LLM call (the Decision Engine) to the 47/100 multi-domain
decisions that plausibly need it, stays within latency (~13–24s complex) and cost (~178–267 user ceiling)
reach, and is fully reversible by one flag.

## 3. The answer to the final question

> _"If we had to support 10,000 users tomorrow, what is the smallest version of LIOS that delivers 80% of the
> value with 20% of the complexity?"_

**"LIOS-Lite" — the deterministic spine you already have + one composed reasoning call per turn + intent
routing.** Concretely:

**Reuse (already built, deterministic, ~free):** Relationship Manager (floor + persistence), Compliance
(`advisor_validator`), Memory/Context, Tool Execution (`tools.py`/`scenario_compare`), RecommendationOS
(evidence-or-nothing), Life Model (`MyLifeService`), Audit, Document Intelligence (offline).

**Add (cheap, high-value):**

1. **Observe-only Orchestrator wrap** + **deterministic intent detection & agent selection** (routing).
2. **Prompt Composition Engine** — the 10 Prompt OS layers → consistent, versioned prompts for the existing
   single advisor call.
3. **Discovery Analyst** (H1) — fold ranked missing-data + cited tradeoff surfacing into the advisor turn
   (no extra call).
4. **One "Decision Engine" call** (H2) — for multi-domain decisions only: pull the _deterministic_ domain
   summaries, run the existing tools (with traces), reason once. Not four calls. Not per-domain LLM agents.
5. **Critic — high-stakes only** (regulated/decision-recommendation/cross-domain).
6. **Extended telemetry** on the live `advisor_turns` sink.

**Explicitly exclude (the 80% of complexity for ~20% of value):** per-domain LLM agents, the 4-call decision
pipeline, a separate Recommendation LLM agent, separate Goal-Discovery/Goal-Conflict LLM agents, the
Compliance LLM-assist.

This is **~1–2 LLM calls for most turns and ~2–3 for complex decisions** — within today's latency/cost
envelope — while delivering routing, composition, ranked discovery, decision framing, and high-stakes safety.
At 10,000 users it is economically and operationally viable; LIOS-full is not.

## 4. Definition-of-done answers (explicit)

| Question                          | Answer                                                                                                                                                                                                                                                                       |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Which agents are essential?**   | The deterministic spine (RM, Compliance, Memory, Tool Execution, RecommendationOS, Life Model, Audit) + the single Advisor call + Document Intelligence (offline) — **mostly already built.**                                                                                |
| **Which are optional?**           | Per-domain LLM agents; Compliance LLM-assist — defer.                                                                                                                                                                                                                        |
| **Which should be merged?**       | Goal Discovery + Goal Conflict + Missing Data → Discovery Analyst (H1); Decision Scientist + Scenario + Tradeoff + Decision Explanation → one Decision Engine (H2); per-domain LLM agents → deterministic summaries feeding one call (H3).                                   |
| **Expected quality improvement?** | Real on ~47/100 multi-domain, tool-heavy decisions + onboarding's missing-data/tradeoff dimensions — **but an estimate; coverage is unmeasured and must be proven first.** No gain on ~25/100 simple turns; recommendation content **unchanged** (the guard is the quality). |
| **Expected latency penalty?**     | LIOS-minimal complex p95 ~13–24s (vs ~13–16s today). LIOS-full ~68s — rejected.                                                                                                                                                                                              |
| **Expected cost penalty?**        | LIOS-minimal ~3–6× per complex query, ceiling ~178–267 users vs the $4/day cap. LIOS-full ~10–30×, breaches at ~46–100 users — rejected.                                                                                                                                     |
| **Economically viable?**          | LIOS-minimal: yes through beta and well beyond. LIOS-full: no past ~100 users.                                                                                                                                                                                               |
| **Operationally viable?**         | LIOS-minimal: yes — phased, flag-gated, reversible, mostly reuse. LIOS-full: risky — large unbuilt runtime, missing Critic.                                                                                                                                                  |
| **Build it as designed?**         | **No.** Build LIOS-minimal (selected portions), gated on a coverage measurement.                                                                                                                                                                                             |

## 5. The single first step (and the gate)

1. **Measure coverage** — extend the eval harnesses with data-rich + seeded-graph personas and test whether
   a multi-domain reasoning step beats the single advisor. This is cheap and decisive.
2. In parallel (zero risk): the **observe-only wrap + prompt composition engine + intent/selection +
   telemetry** — these improve today's advisor regardless of the coverage result.
3. **Gate:** build the Decision Engine + multi-domain path **only if** step 1 shows a real gain. If it
   doesn't, stop at the cheap additions and invest in the single advisor instead.

## 6. One-line verdict

**Do not build LIOS as designed.** Build LIOS-Lite — the deterministic spine you already have, plus intent
routing, prompt composition, ranked discovery, and a single decision-reasoning call — and prove multi-agent
value on real data before paying for any of the expensive fan-out. That is the smallest thing that delivers
most of the value, and it is the architecture worth building.
