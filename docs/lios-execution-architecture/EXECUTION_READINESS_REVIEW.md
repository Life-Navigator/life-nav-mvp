# LIOS Execution Readiness Review

> The honest gate before any orchestration is built. No optimism, no future-state claims, no implementation.
> This review synthesizes the architecture, agent specs, prompt OS, and this execution-architecture set
> against the **live system as it actually is today**.

---

## 1. Verdict

**Is LIOS ready for orchestration? — NO. The _design_ is ready; the _system_ is not.**

The blueprint is complete and internally consistent (architecture → lifecycle → agent specs → interaction
contracts → prompt OS → execution architecture). But **zero execution code exists**. The live system is a
**single-agent advisor**, not a multi-agent orchestrator. "Ready for orchestration" means _ready to begin
implementing it against a sound, accepted design_ — and that, yes. Orchestrating today — no.

Be precise about the gap between design and reality, because the rest of this doc depends on it.

## 2. What is actually LIVE today (not designed — running)

| Capability            | Reality                                                                                                                            |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Single advisor turn   | LIVE — `AdvisorOrchestrator.converse`/`converse_stream` (deterministic turn → context → one LLM call → validate → compose → audit) |
| Compliance gate       | LIVE — deterministic `advisor_validator` (accept/repair/reject); proven 0 trust violations in eval                                 |
| Memory/Context        | LIVE — `AdvisorContextBuilder` (bounded context, allowed numbers, real edges)                                                      |
| Recommendation engine | LIVE — `RecommendationOS` evidence-or-nothing                                                                                      |
| GraphRAG              | LIVE — 3-store + citation contract (but fresh-user evals only exercise the abstain path)                                           |
| Telemetry             | LIVE — `analytics.advisor_turns` + `advisor_turn_metrics` + `/v1/admin/advisor-metrics`                                            |
| Decision math         | LIVE — decision brain / scenario compare emit `calculation_trace`                                                                  |
| Domain summaries      | LIVE — finance/family/career/education/health summary services                                                                     |
| Model                 | LIVE — Gemini 2.5 Flash via AI Studio, **Fly backend only**                                                                        |

## 3. What is DESIGN-ONLY (does not exist in code)

Everything this Phase-3 set describes is **a specification**, not a running system:

- The **Orchestrator as a multi-domain router** (today it is discovery-scoped, single-agent).
- **Intent detection**, **agent selection engine**, **parallel execution**, **conflict resolution**,
  **response assembly across multiple agents** — none implemented.
- The **decision pipeline as orchestrated agents** (Decision Scientist → Scenario → Tradeoff →
  Recommendation → Decision Explanation) — the underlying _math_ exists; the _agent orchestration_ does not.
- The **Critic** — does not exist at all.
- **Goal Discovery / Goal Conflict / Missing Data / Tool Execution / Audit** as _standalone agents_ — their
  _behavior_ lives embedded in current services; they are not separable agents yet.
- The **execution state machine**, **workflow library**, **multi-agent patterns** — design artifacts.
- The **prompt OS** (57 assets) — assets on disk; nothing composes or runs them yet.

## 4. The hard risks (brutal)

1. **Latency is already a problem at N=1.** A single advisor turn measures ~9–10s avg, p95 ~13–16s
   (Gemini-bound). Multi-agent fan-out **multiplies** this. A "complex" query (Finance ∥ Career ∥ Family →
   Decision Scientist → Scenario → Tradeoff → Recommendation → Critic → Compliance) is potentially
   **many LLM calls**. Parallelization helps the independent stage, but the serial tail (conflict →
   recommendation → critic → compliance → compose) stacks. **Without aggressive parallelism, caching, and
   model-latency work, complex queries could take 30–60s+.** This is the single biggest execution risk and
   is not yet mitigated anywhere.
2. **Cost multiplies too.** One turn is ~3k tokens. Multi-agent turns are several× that. The **$4/day Gemini
   cap** and the **prepay-credit/billing posture** are real constraints; a 20-user beta running multi-agent
   complex queries needs a cost model that does not exist yet.
3. **The Critic is a named safety layer that doesn't exist.** High-stakes turns currently rely on the
   deterministic Compliance gate alone. The design assumes the Critic; the system has no Critic.
4. **Coverage is unmeasured.** Evals prove trust + empty-state correctness, **not** the quality/quantity of
   guidance for a data-rich user. Multi-agent value is unproven on real, populated data.
5. **No golden sets, no confidence calibration.** Confidence formulas are specified but never validated
   against outcomes; "confidence 0.82" has no empirical backing yet.
6. **Retrieval-set logging is counts-only.** We log how many edges were available, not which were used —
   so a multi-agent turn's grounding is not fully auditable today.
7. **Provenance columns are partly derived, not stored.** The truth layer's provenance is computed in the
   API in places; multi-agent provenance propagation assumes first-class columns that aren't all there.

## 5. Is the design sound enough to build on? — Yes, with the documented gaps

The design has no contradictions, no ownership conflicts, no cycles, all escalation/confidence/failure paths
defined (validated in the agent-spec + prompt-OS conflict audits). The execution contracts conform to the
specs. So implementation is not blocked by _design_ — it is blocked by _unbuilt runtime + unmitigated
latency/cost + missing safety (Critic) + unmeasured coverage_.

## 6. What is required BEFORE Gemini routing (the first build step)

Minimum to route real queries through an Orchestrator (still behind a flag, advisor untouched):

1. **Intent detection + agent selection** implemented as deterministic code (with the LLM classifier +
   deterministic fallback) per `ORCHESTRATION_ENGINE.md`.
2. **A route-plan executor** that runs the existing single-agent advisor as the first "agent" under the new
   Orchestrator — i.e. wrap, don't replace. Prove the wrapper is behavior-identical to today.
3. **Telemetry extended** to emit the new events (intent, route_plan) alongside the live `advisor_turn`.
4. **Cost + latency budget** per turn defined and enforced (a hard ceiling; the $4/day cap respected).
5. **The Gemini billing/prepay-credit posture resolved** for the expected volume.
6. **A kill switch / flag** so routing can be disabled instantly without touching the live advisor.

## 7. What is required BEFORE multi-agent execution

On top of §6:

1. **Parallel execution runtime** with the join/degrade semantics from `PARALLELIZATION_MODEL.md` +
   `EXECUTION_STATE_MACHINE.md`.
2. **The domain agents as separable agents** (today they're summary services) returning the common envelope.
3. **Conflict resolution + confidence propagation** implemented per their models.
4. **The decision pipeline orchestrated** (the math exists; the agent sequencing does not).
5. **The Critic built** (no high-stakes multi-agent output should ship without it, per the design).
6. **Response assembly across agents** (today the composer merges one advisor output).
7. **Latency mitigation proven** on a complex query within the budget — this is a go/no-go, not a nicety.
8. **Coverage eval on data-rich + seeded-graph personas** — prove multi-agent actually produces better,
   grounded guidance, not just more LLM calls.
9. **Per-turn retrieval-set logging** so multi-agent grounding is auditable.

## 8. What is required BEFORE Vertex migration

Vertex is **not** a prerequisite for any of the above and should not be attempted first.

1. **A working, evaluated multi-agent system on the current stack (Gemini AI Studio on Fly) first.** Migrate
   a _working_ thing, never a _hoped-for_ thing.
2. **A model-provider abstraction** so the orchestrator is provider-agnostic (Gemini today; Vertex/others
   behind one interface).
3. **Eval parity harness** to prove a provider swap doesn't regress trust/quality/latency.
4. **A concrete reason** Vertex is needed (quota, latency, data residency, enterprise controls) — today
   everything runs on AI Studio + Fly and there is no demonstrated requirement. Migrating without a driver
   is cost without benefit.
5. **Cost model under Vertex pricing** vs current.

## 9. Recommended sequencing (honest, incremental)

```
NOW (done):  design complete + accepted? (this review gates it)
NEXT:        wrap the live advisor under a flagged Orchestrator (behavior-identical) + intent/selection +
             extended telemetry + cost ceiling.  [Gemini routing, single-agent under orchestration]
THEN:        add ONE parallel domain path (e.g. Finance) + conflict/confidence + measure latency/coverage.
THEN:        the decision pipeline + Critic + response assembly; prove complex-query latency in budget.
LATER:       provider abstraction + eval parity; only then consider Vertex IF a driver exists.
```

Each step is flag-gated, eval-gated, and leaves the live advisor working.

## 10. Bottom line

The architecture is complete and trustworthy on paper. The system is a solid single-agent advisor with a
deterministic trust spine. **Between here and "LIOS orchestrating" stands real, unbuilt runtime; an
unmitigated latency/cost problem that multi-agent makes worse; a safety layer (Critic) that doesn't exist;
and coverage that's never been measured.** None of that is hidden by the design — and none of it should be
glossed when the build begins. Build incrementally, behind flags, measured at every step, with the live
advisor never at risk. Do not start Gemini routing until §6 is funded and planned; do not touch Vertex until
§8 is real.
