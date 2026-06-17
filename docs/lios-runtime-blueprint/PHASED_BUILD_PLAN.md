# LIOS Phased Build Plan (10 Phases)

> Implementation **planning only** — no code, no runtime change, no deploy, no Gemini wiring, no beta change.
> The engineering build plan mirroring the ten phases in `ORCHESTRATOR_IMPLEMENTATION_PLAN.md`. For each phase:
> the new module(s) (`app/services/lios/*` under `apps/lifenavigator-core-api/`), the acceptance test, the eval
> gate, the controlling flag (`FEATURE_FLAG_STRATEGY.md`), and the dependency on prior phases. Builds on
> `CURRENT_STATE_AUDIT.md` (what must NOT change) and `EXECUTION_READINESS_REVIEW.md` (the gaps).

## Cross-cutting rules (apply to every phase)

1. **Reversible.** Each phase has a flag; `LIOS_ENABLED=false` returns to baseline (`AdvisorOrchestrator`).
2. **Behavior-preserving until proven.** New paths are observe-only or dev-flagged until eval-gated.
3. **Telemetry-first.** Each phase adds its `advisor_turns` events _before_ it acts on anything; logs stay
   metadata-only, non-blocking, service-role.
4. **No rewrite of the deterministic spine.** RelationshipManager persistence, `advisor_validator`,
   `RecommendationOS` evidence-or-nothing, the citation contract — wrapped and reused, never replaced.
5. **Eval gate per phase.** Re-run `apps/web/advisor-eval.mjs` + `apps/web/advisor-decisions-probe.mjs` (+ the
   phase's new tests); **trust = 0 violations** is non-negotiable; latency p95 + cost/day recorded and within
   the per-turn ceiling (the $4/day Gemini cap is real — `EXECUTION_READINESS_REVIEW.md` §4).

Universal eval ceiling shorthand below: **GATE = {trust=0; fallback ≤ baseline; latency p95 within budget;
cost/day within budget}**, plus the phase-specific acceptance.

---

## Phase 1 — Wrap (observe-only)

- **Module(s):** `services/lios/orchestrator.py:LiosOrchestrator.run` (+ `converse_stream` shim);
  wire in `dependencies.py:get_advisor_orchestrator` (the only edit to existing code).
- **Acceptance test:** golden-diff — wrapper output == today's output byte-for-byte for the eval persona set
  (`assistant_message`, `llm_status`, structured outcomes); wrapper telemetry appears alongside `advisor_turn`.
- **Eval gate:** GATE; wrapper adds **no** LLM call, so latency must be within ~5% of baseline.
- **Flag:** `LIOS_ENABLED`. **Depends on:** none.

## Phase 2 — Intent classification (observe-only)

- **Module(s):** `services/lios/intent.py` (LLM classifier + deterministic fallback → `discovery`).
- **Acceptance test:** intent recorded every (sampled) turn; output still identical; classifier accuracy
  measured on a labeled offline sample; deterministic fallback path exercised.
- **Eval gate:** GATE; measure the extra read-only LLM call's added latency/cost (must be sampleable).
- **Flag:** `ORCHESTRATOR_ENABLED`. **Depends on:** Phase 1.

## Phase 3 — Agent selection (observe-only)

- **Module(s):** `services/lios/selection.py` (deterministic rule table → route plan), `services/lios/registry.py`
  (agent registry skeleton — advisor registered as the first "agent").
- **Acceptance test:** route plans logged + reviewed against `AGENT_SELECTION_ENGINE.md` on eval personas;
  output still identical (only the advisor executes).
- **Eval gate:** GATE (pure computation; near-zero added cost).
- **Flag:** `ORCHESTRATOR_ENABLED`. **Depends on:** Phase 2.

## Phase 4 — First domain agent (Finance), flagged

- **Module(s):** `services/lios/agents/finance_agent.py` (wraps the finance summary service +
  `recommendations_os.py`, returns the common envelope); `services/lios/envelope.py` (the common agent result
  contract). Compliance gates output via the existing `advisor_validator.py`.
- **Acceptance test:** flag off ⇒ identical to today; flag on (dev) ⇒ Finance produces a gated, grounded
  result; `RecommendationOS` evidence-or-nothing holds.
- **Eval gate:** GATE + **coverage measured on data-rich personas** (needs the seeded-finance persona —
  `LIOS_EVALUATION_FRAMEWORK.md` §11 gap) + cost/latency additivity measured.
- **Flag:** `DOMAIN_AGENTS_ENABLED`. **Depends on:** Phase 3 (needs intent+selection to route to Finance).

## Phase 5 — Parallel domain execution

- **Module(s):** `services/lios/executor.py` (concurrent run + join/degrade per `EXECUTION_STATE_MACHINE.md` /
  `PARALLELIZATION_MODEL.md`); additional `agents/*` (Family, Career, …) as registry agents.
- **Acceptance test:** group latency ≈ slowest member (not sum); a blocked member degrades only its branch.
- **Eval gate:** GATE — **latency p95 + cost/day within budget on a complex multi-domain query** (this is the
  go/no-go risk in `EXECUTION_READINESS_REVIEW.md` §4.1).
- **Flag:** `MULTI_AGENT_ENABLED`. **Depends on:** Phase 4.

## Phase 6 — Conflict resolution + confidence propagation

- **Module(s):** `services/lios/conflict.py` (detection/ranking) + reuse `services/confidence.py` for aggregation.
- **Acceptance test:** the Texas/job/house case produces a **framed tradeoff (never a verdict)**; confidence
  carries components.
- **Eval gate:** GATE + decision-tradeoff framing checks on `advisor-decisions-probe.mjs`.
- **Flag:** `MULTI_AGENT_ENABLED`. **Depends on:** Phase 5.

## Phase 7 — Decision pipeline orchestrated

- **Module(s):** `services/lios/pipelines/decision.py` sequencing Decision Scientist → Scenario → Tradeoff →
  Recommendation → Decision Explanation over the **existing** `decision_brain.py`, `scenario_compare.py`,
  `scenario_tree.py`, `decision_graph.py` (math reused; only the sequencing is new; numbers stay tool-sourced
  with `calculation_trace`).
- **Acceptance test:** decision turns return modeled tradeoffs + named missing inputs, never "the answer."
- **Eval gate:** GATE + `advisor-decisions-probe.mjs` evasiveness/context-use not worse.
- **Flag:** `MULTI_AGENT_ENABLED`. **Depends on:** Phase 6.

## Phase 8 — Critic (high-stakes only)

- **Module(s):** `services/lios/critic.py` (runs only on high-stakes/regulated/decision-recommendation turns;
  refutes, never rewrites; refuted claims drop to safe).
- **Acceptance test:** high-stakes claims pass the Critic before Compliance; a refuted claim is downgraded.
- **Eval gate:** GATE + an adversarial Critic panel on high-stakes claims (a planned harness —
  `LIOS_EVALUATION_FRAMEWORK.md` §7). Critic must not raise fallback by over-refuting valid claims.
- **Flag:** `CRITIC_ENABLED`. **Depends on:** Phase 7 (and §92 readiness: Critic must exist before any
  high-stakes multi-agent output ships).

## Phase 9 — Compliance Agent (LLM-assist)

- **Module(s):** `services/lios/compliance_agent.py` (optional LLM-assist _in front of_ the authoritative
  deterministic `advisor_validator.py`, which never changes; deterministic wins on any hard rule).
- **Acceptance test:** zero trust regressions vs the deterministic-only baseline; the LLM-assist only ever
  _tightens_ (never loosens a hard rule).
- **Eval gate:** GATE — explicit diff vs deterministic-only: no accept that the validator would reject.
- **Flag:** `COMPLIANCE_AGENT_ENABLED`. **Depends on:** Phase 1 (independent of the multi-agent chain; the
  deterministic gate is always present).

## Phase 10 — Full LIOS

- **Module(s):** none new — composition: all flags on for the relevant intents; the advisor is one agent among
  many; the live single-agent path remains as the fallback floor.
- **Acceptance test / eval gate:** the full execution evaluation framework passes its gates
  (`LIOS_EVALUATION_FRAMEWORK.md` §2/§9): trust = 0; latency/cost in budget; coverage measured on data-rich +
  seeded-graph personas.
- **Flag:** all (per intent). **Depends on:** Phases 1–9.

---

## Dependency graph

```
P1 Wrap (LIOS_ENABLED)
 └─► P2 Intent (ORCHESTRATOR_ENABLED)
      └─► P3 Selection (ORCHESTRATOR_ENABLED)
           └─► P4 Finance agent (DOMAIN_AGENTS_ENABLED)
                └─► P5 Parallel (MULTI_AGENT_ENABLED)
                     └─► P6 Conflict+Confidence (MULTI_AGENT_ENABLED)
                          └─► P7 Decision pipeline (MULTI_AGENT_ENABLED)
                               └─► P8 Critic (CRITIC_ENABLED)
                                    └─► P10 Full LIOS
P1 ─────────────────────────────► P9 Compliance-agent (COMPLIANCE_AGENT_ENABLED) ─► P10
```

P9 branches off P1 directly (the deterministic gate is always present, so the LLM-assist does not need the
multi-agent chain). P10 requires every prior phase. The critical path to "multi-agent in budget" is
**P1 → P5** (the latency/cost go/no-go); P8 is the safety prerequisite before any high-stakes multi-agent
output reaches a user (`EXECUTION_READINESS_REVIEW.md` §7.5).

## What must NOT change across all phases (from CURRENT_STATE_AUDIT §7)

1. Live `/v1/life/discovery/chat[/stream]` behavior until LIOS is flag-proven.
2. The deterministic trust spine (RM persistence, `advisor_validator`, RecommendationOS, citation contract).
3. The "LLM never writes / never the source of truth" boundary.
4. Telemetry non-blocking + metadata-only logs.
5. The Gemini key staying Fly-only (no orchestrator code on Vercel).
