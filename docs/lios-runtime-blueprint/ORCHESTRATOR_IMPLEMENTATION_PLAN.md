# Orchestrator Implementation Plan

> Implementation planning only — no code/runtime/deploy. The phased path from today's single advisor to the
> full LIOS orchestrator, each phase **flag-gated, behavior-preserving, and individually shippable**. Anchored
> to `advisor_orchestrator.py` + `dependencies.py:268` (`get_advisor_orchestrator`). Builds on
> `CURRENT_STATE_AUDIT.md` + `TARGET_RUNTIME_ARCHITECTURE.md`.

Guiding rule: **every phase leaves the live advisor working and is reversible by one flag.** No phase ships
a behavior change to the live path until the prior phase is proven equivalent + evaluated.

---

## Phase 1 — Wrap (observe-only, zero behavior change)

- Introduce `LiosOrchestrator.run` that, with `LIOS_ENABLED` on, **calls the existing
  `AdvisorOrchestrator.converse`/`converse_stream` and returns its output unchanged.** It only _observes_:
  it records a route-plan stub + timing around the existing call.
- `dependencies.py:get_advisor_orchestrator` returns the wrapper when `LIOS_ENABLED`, else the existing
  orchestrator (default off).
- **Acceptance:** golden-diff test — for a fixed set of inputs, wrapper output == today's output, byte for
  byte (same `assistant_message`, `llm_status`, structured outcomes). Telemetry shows the new wrapper events
  alongside the unchanged `advisor_turn`.
- **Risk:** ~none (pass-through). **Flag:** `LIOS_ENABLED`.

```
Advisor (existing)  →  LiosOrchestrator wrapper  →  Advisor (existing)   [output identical]
```

## Phase 2 — Intent classification (still one agent, observe-only)

- Add `intent.py`: classify intent (LLM + deterministic fallback to `discovery`). **Log the intent; do not
  act on it.** The advisor still runs exactly as today.
- **Acceptance:** intent recorded on every turn; output still identical; intent classifier has a measured
  accuracy on a labeled sample (offline), and the deterministic fallback path is exercised.
- **Risk:** low (extra read-only LLM call — adds latency/cost; measure it; can be sampled, not every turn).
  **Flag:** `ORCHESTRATOR_ENABLED` (gates intent+selection observation).

## Phase 3 — Agent selection (still one execution path, observe-only)

- Add `selection.py`: the deterministic rule table → a route plan (which agents _would_ run). **Log the plan;
  still execute only the advisor.**
- **Acceptance:** route plans logged + reviewed against `AGENT_SELECTION_ENGINE.md` expectations on the eval
  personas; output still identical.
- **Risk:** low (pure computation). **Flag:** `ORCHESTRATOR_ENABLED`.

## Phase 4 — First domain agent invocation (flagged, additive)

- Wrap ONE domain (Finance) as a registry agent returning the common envelope (reusing the finance summary
  service + `RecommendationOS`). For an intent the selection routes to Finance, run it **in addition to** the
  advisor, but **only surface its output behind `DOMAIN_AGENTS_ENABLED`** (off in prod; on in dev/eval).
- Compliance gates the domain output before it can ever reach a user.
- **Acceptance:** with the flag off, output identical to today; with the flag on (dev), the finance path
  produces a gated, grounded result; latency/cost measured; coverage measured on data-rich personas.
- **Risk:** medium (first real new path) — contained by the flag + Compliance. **Flag:** `DOMAIN_AGENTS_ENABLED`.

## Phase 5 — Parallel domain execution

- Run independent domain agents concurrently (Finance ∥ Family ∥ Career …) per `PARALLELIZATION_MODEL.md`,
  with the join/degrade semantics from `EXECUTION_STATE_MACHINE.md`.
- **Acceptance:** group latency ≈ slowest member (not sum); a blocked member degrades its branch only;
  cost/latency within budget. **Flag:** `MULTI_AGENT_ENABLED`.

## Phase 6 — Conflict resolution + confidence propagation

- Add conflict detection/ranking + the confidence aggregation formulas. Outputs become framed tradeoffs.
- **Acceptance:** the Texas/job/house example produces a framed tradeoff (never a verdict); confidence
  carries components. **Flag:** `MULTI_AGENT_ENABLED`.

## Phase 7 — Decision pipeline orchestrated

- Sequence Decision Scientist → Scenario → Tradeoff → Recommendation → Decision Explanation over the existing
  decision/scenario engines (math reused; agent sequencing new). Numbers stay tool-sourced with traces.
- **Acceptance:** decision turns return modeled tradeoffs + missing inputs, never "the answer." **Flag:** `MULTI_AGENT_ENABLED`.

## Phase 8 — Critic (high-stakes only)

- Add `critic.py`: runs only on high-stakes/regulated/decision-recommendation turns (cost control). Refutes;
  never rewrites. **Flag:** `CRITIC_ENABLED`.
- **Acceptance:** high-stakes claims pass the Critic before Compliance; refuted claims drop to safe.

## Phase 9 — Compliance Agent (LLM-assist, augmenting the deterministic gate)

- Add the optional LLM-assisted compliance review _in front of_ the authoritative deterministic validator
  (which never changes). Deterministic wins on any hard rule. **Flag:** `COMPLIANCE_AGENT_ENABLED`.
- **Acceptance:** zero trust regressions vs the deterministic-only baseline; the LLM-assist only ever
  _tightens_.

## Phase 10 — Full LIOS

- All flags on for the relevant intents; the advisor is one agent among many; the live single-agent path
  remains as the fallback floor.
- **Acceptance:** the full execution evaluation framework passes its gates (trust = 0; latency/cost in
  budget; coverage measured).

---

## Cross-cutting rules for every phase

1. **Reversible:** each phase has a flag; `LIOS_ENABLED=false` returns to baseline.
2. **Behavior-preserving until proven:** new paths are observe-only or dev-flagged until eval-gated.
3. **Eval gate per phase:** re-run `advisor-eval.mjs` + `advisor-decisions-probe.mjs` + the relevant new
   tests; **trust must stay at 0 violations**; latency/cost recorded and within the per-turn ceiling.
4. **Telemetry first:** each phase adds its observability events before it acts on anything.
5. **No rewrite of the deterministic spine** — wrap and reuse.

## Sequencing summary

Phases 1–3 are observe-only (no behavior change, lowest risk). Phase 4 is the first real new path (flagged,
dev-only). Phases 5–10 expand multi-agent capability, each gated by `MULTI_AGENT_ENABLED`/`CRITIC_ENABLED`/
`COMPLIANCE_AGENT_ENABLED` and each blocked on a passing eval + a latency/cost check (see `COST_MODEL.md`,
`LATENCY_MODEL.md`, `PHASED_BUILD_PLAN.md`).
