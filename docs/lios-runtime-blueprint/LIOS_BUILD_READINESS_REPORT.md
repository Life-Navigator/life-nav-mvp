# LIOS Build Readiness Report

> The honest gate before any LIOS code is written. Implementation planning only — no code, no runtime change,
> no deploy. Synthesizes the runtime blueprint against the **live codebase as it actually is**. No optimism,
> no future-state assumptions.

---

## 1. What is ready to build now

These are **additive, behavior-preserving, flag-gated** — they can be built without touching the live
advisor's behavior at all:

1. **The wrap (Phase 1).** A `LiosOrchestrator.run` that, behind `LIOS_ENABLED`, delegates to the existing
   `AdvisorOrchestrator.converse`/`converse_stream` (`advisor_orchestrator.py:167/188`) and returns its
   output unchanged. Observe-only. Lowest-risk possible start. Acceptance = byte-identical golden diff.
2. **The flag set** (`config.py:Settings` + env, mirroring the live `ADVISOR_LLM_ENABLED`/`ADVISOR_TRACE_ENABLED`)
   with `LIOS_ENABLED` as a true kill switch (off ⇒ today's path exactly).
3. **The prompt composition engine** — factor today's hand-assembled `ADVISOR_SYSTEM` + `prompt_dict`
   (`advisor_llm.py`, `advisor_context.py:193`) into the 10 Prompt OS layers. Deterministic; output for the
   advisor can be made identical to today's prompt, then versioned.
4. **The agent runtime registry** — a declarative name→entry table that registers the existing orchestrator
   as the `advisor` entry (`wraps-existing`). No new agents activated.
5. **Telemetry extension** — add intent/route_plan child events to the live `analytics.advisor_turns` sink
   (`_finish`/`_persist`); reuse, don't rebuild.

The design itself (architecture → specs → prompt OS → execution arch) is **complete and validated** (no
ownership conflicts, no cycles, all paths defined). So nothing is blocked by _missing design_ for the items
above. The trace store even already exists: `tools.py:ToolRunner.run` persists to a `tool_runs` table.

## 2. What still needs design (be honest)

- **The GraphRAG read-path seam.** The live advisor reads the personal graph from **Supabase**
  (`life_discovery.personal_graph` over `life_graph_edges`), while Neo4j/Qdrant are **projection/ingestion-
  side**. The GraphRAG runtime must decide the actual retrieval source for execution — the "3-store
  alignment" is real for projection but the _read_ path is Supabase today. This is a concrete design gap, not
  a diagram.
- **Per-turn cost/latency budget enforcement.** The design says "hard ceiling"; the mechanism (token budget,
  early-exit, degrade-to-single-agent) is not designed in implementable detail.
- **Decision-pipeline-as-agents.** The math exists (`decision_brain.py`, `scenario_compare.py`,
  `tools.py`), but the concrete agent sequencing module + the mortgage/cash-flow tool gaps the scenario
  agent flagged need design.
- **Confidence calibration methodology + golden sets.** The formulas are specified but there is no method
  yet to validate "0.82" against outcomes, and no golden sets exist.
- **Compliance LLM-assist contents.** The deterministic gate is authoritative + stays; the optional
  LLM-assist's actual checks/knowledge source ("centralized compliance GraphRAG") are not designed.

## 3. Biggest technical risks (ranked, brutal)

1. **Latency of complex queries — the #1 risk, and it is not a "later" problem.** Measured single turn is
   ~9–10s. The latency model projects an **unmitigated complex query at ~40–55s avg / 60–90s p95** — driven
   NOT by domain fan-out (parallel ≈ one call) but by the **serial tail**: decision → scenario → tradeoff →
   recommendation → critic → compliance, 5+ stacked ~7–8s LLM calls. Even mitigated (~25–35s) this is on the
   edge of usable. **This threatens whether multi-agent is viable for complex queries at all** — it must be
   spiked and measured early, not assumed away.
2. **The serial decision tail is structural.** Parallelizing domains doesn't help it; only fewer/cheaper
   LLM calls, streaming/progressive rendering, or a faster model do. No mitigation is built.
3. **The Critic doesn't exist.** A named safety layer for high-stakes turns is currently absent; multi-agent
   high-stakes output today would rely on the deterministic gate alone.
4. **The Supabase/Neo4j read seam (§2).** Building GraphRAG runtime against the wrong store is a real
   correctness/effort risk.
5. **Coverage is unproven.** Multi-agent may add latency + cost without demonstrably beating the single
   advisor, because data-rich coverage has never been measured.

## 4. Biggest product risks

1. **A 40–90s answer is a worse product than a 10s one.** If complex queries are slow, users will prefer (or
   should be given) the fast single advisor. Multi-agent must _earn_ its latency with clearly better
   guidance — unproven.
2. **Unclear value-add.** Without coverage measurement, we cannot say multi-agent produces better answers,
   only more machinery. Risk of building complexity users don't feel.
3. **Advice-boundary under composition.** More agents + a recommendation pipeline = more surface for an
   advice-boundary slip; the deterministic gate holds the line, but the product must stay "frames + refers,"
   not "decides."
4. **Trust regression risk during migration** — mitigated by the wrap + per-phase eval gate (trust must stay
   0), but real if phases are rushed.

## 5. Biggest cost risks

1. **Complex-heavy usage blows the $4/day cap.** A complex query is ~10–30× a simple one. The cost model
   breaks the cap at ~200 turns/day with a complex-heavy (≥30%) mix (~$3.5–5.5/day); runaway-complex ≈ $12/day
   (3× over). At small beta scale the _blended_ cost is fine (~$1–1.6/day for 100 turns) — the tail is the risk.
2. **No per-turn budget enforcement exists** (see §2) — an uncapped complex turn can spend unboundedly.
3. **Pricing is an assumption.** All $ figures are projections from published gemini-2.5-flash AI Studio
   pricing (stated, to re-confirm), derived from a single measured turn. Re-derive from real
   `advisor_turn_metrics` before any phase that adds LLM calls.

## 6. The safest first implementation step

**Phase 1 wrap, observe-only, behind `LIOS_ENABLED` (default off), with a byte-identical golden-diff test +
the telemetry extension.** It adds the orchestrator seam and observability with **zero** behavior change and
a one-toggle revert. Immediately after, build the **prompt composition engine** (provably reproduce today's
advisor prompt) and the **registry** (register the existing advisor) — still zero behavior change. Then, and
only then, **spike ONE moderate query end-to-end in dev** to get _real_ cost + latency numbers before any
commitment to multi-agent.

## 7. Final recommendation (brutally honest)

**Build the wrap + composition engine + registry + flags + telemetry now — they are ready, additive, and
reversible. Do NOT build multi-agent execution until the latency question is answered with real numbers.**

The architecture is excellent and the trust spine is sound. But the blueprint reveals one hard truth the
design phase could not: **multi-agent execution has a structural latency problem (the serial decision tail)
that may make complex queries too slow to ship, and a cost tail that can breach the budget.** That is not a
reason to abandon LIOS — it is a reason to **prove the economics on one real query before building the
machine.**

Concretely:

- **Now:** Phases 1–3 (wrap → intent → selection), all observe-only, plus composition engine + registry +
  flags + telemetry. Net behavior change to users: zero.
- **Gate before Phase 4+:** a measured moderate-query spike showing latency and cost within an explicit
  per-turn budget, AND a coverage signal that multi-agent beats the single advisor on data-rich personas.
- **Critic:** build it high-stakes-only (option B) — running it every turn adds a full LLM call for no
  safety gain on discovery turns and burns the cap ~1.5× faster.
- **Vertex:** do not. Nothing in this blueprint requires it; everything runs on Gemini AI Studio + Fly.
  Revisit only if a concrete driver (quota/latency/residency) appears, and only after a working, evaluated
  multi-agent system exists on the current stack.

**One-line verdict:** the foundation is ready to _wrap_; the multi-agent machine is not ready to _build_
until a single real moderate query proves the latency and cost are survivable. Build the safe seam now;
measure before you scale.
