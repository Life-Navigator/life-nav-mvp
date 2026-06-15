# LIOS Agent Selection Engine

> **Design/spec only — no code/runtime/Gemini/Vertex/beta.** Derived from
> `EXECUTION_ARCHITECTURE.md` (stage [2] contract), `ORCHESTRATION_ENGINE.md` (§3 selection rules,
> §4 the DAG, §5 parallelization), `EXECUTION_STATE_MACHINE.md`,
> `docs/lios-agent-specifications/AGENT_INTERACTION_CONTRACTS.md` (§5 canonical pipelines),
> `docs/lios-agent-specifications/AGENT_ESCALATION_MODEL.md`, `DECISION_LIFECYCLE.md`.
> This is the routing specification for stage **[2] Agent Selection** of the master lifecycle.

---

## 1. Purpose & position

Stage [2] turns `{intent, risk_level, domains[]}` (from stage [1] Intent Detection) into a concrete
**agent set + execution DAG (order + parallel groups)**. The mapping is a **deterministic rule table**,
never an LLM choice (`ORCHESTRATION_ENGINE.md` §1). Intent may be _classified_ by an LLM, but the
_consequences_ of the intent — which agents run, in what order, what parallelizes — are rules.

Selection runs after the deterministic turn (stage [0]) has already produced the safe floor, so any
routing failure degrades to that floor rather than to the user (`EXECUTION_ARCHITECTURE.md` §2).

### Stage [2] contract (from the master's stage-contract table)

| Field               | Value                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inputs              | `intent` + `domains_implicated[]` + `risk_level`; data-availability signals (from det turn / Memory); conversation state (discovery vs. returning)                          |
| Outputs             | route plan: `selected_agents[]`, `pipeline[][]`, `parallel_groups[][]`, `graph_required`, `tools_required[]`, `critic_required`, `compliance_required`, `missing_data_path` |
| Confidence          | n/a — deterministic rules                                                                                                                                                   |
| Failure state       | no rule matches → discovery path (safest)                                                                                                                                   |
| Observability event | `route_plan`                                                                                                                                                                |

The output shape is `ORCHESTRATOR_OUTPUT_SCHEMA.md` (Prompt OS). JSON only — selection emits no prose.

---

## 2. The always-on spine (runs every turn, never selected against)

These are not "chosen"; they are structural (`ORCHESTRATION_ENGINE.md` §3, `AGENT_INTERACTION_CONTRACTS.md` §1):

```
ALWAYS, every turn:      Orchestrator · Relationship Manager (deterministic turn) · Memory/Context · Audit
ALWAYS before user text:  Compliance · Response Composer
```

The deterministic turn is first (the trust floor); Compliance is mandatory and unbypassable before any
user-facing text; Audit bookends every stage. The rules below select only the _variable_ agents that sit
between the floor and the gate.

---

## 3. The deterministic routing rule table

`D ∈ {finance, family, career, education, health}`. Rule precedence is top-to-bottom; the first set of
matching rows composes the route. (Source: `ORCHESTRATION_ENGINE.md` §3.)

| #   | Condition (intent / domains / risk)                                                 | Agents added                                                    | Agents that do NOT run                      |
| --- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- |
| R1  | conversational / discovery intent                                                   | Advisor                                                         | (no domain/decision pipeline)               |
| R2  | `D ∈ domains_implicated` AND (`D` has data OR intent needs `D`'s missing-data list) | Domain agent `D`                                                | any domain not implicated                   |
| R3  | plan needs relationships/evidence                                                   | GraphRAG (graph_plan)                                           | else skipped — no relationship claims       |
| R4  | a number / projection / write is required                                           | Tool Execution (tool_plan)                                      | else skipped                                |
| R5  | any selected agent returns `needs_data` OR highest-value gap unclear                | Missing Data                                                    | else skipped                                |
| R6  | `intent = decision` OR ≥2 domains conflict                                          | Decision Scientist → Scenario → Tradeoff → Decision Explanation | else the whole decision pipeline is skipped |
| R7  | ≥1 evidenced finding exists to mint from                                            | Recommendation Agent                                            | else NOT run — **no rec without evidence**  |
| R8  | `risk_level ∈ {high, regulated}` OR output is a decision rec / cross-domain claim   | Critic                                                          | else skipped                                |

**Compliance + Response Composer are appended by the spine (§2), not by R1–R8.**

### 3.1 How selection decides which agents do NOT run

Non-selection is explicit, not accidental (`ORCHESTRATION_ENGINE.md` §3 closing rule: _"An agent does NOT
run if its ownership is irrelevant to the intent — silence is cheaper than a no-op call"_):

- A **domain agent** is excluded unless R2 holds (its domain is implicated AND it has data or the intent
  needs its missing-data list). A finance-only question never wakes Career/Family/Education/Health.
- **GraphRAG** is excluded unless a relationship/evidence fetch is needed (R3). Empty graph → abstain from
  relationship claims (master stage [3] failure state).
- **Tool Execution** is excluded unless a number/projection/write is needed (R4).
- The **decision pipeline** (Decision Scientist/Scenario/Tradeoff/Decision Explanation) is excluded unless
  R6 holds — a single-domain lookup is not a decision.
- The **Recommendation Agent** is excluded unless there is evidence to mint from (R7) — evidence-or-nothing.
- The **Critic** is excluded for low/medium-risk, non-decision, non-cross-domain outputs (R8).

The route plan records both the selected set and the _reason each excluded class was excluded_ (for the
`route_plan` event), so "why didn't Career run?" is answerable from telemetry.

---

## 4. Tiered routing — the three worked examples

All three obey the fixed dependency order (`ORCHESTRATION_ENGINE.md` §4):
`det_turn → intent → selection → [graph_plan ∥ tool_plan] → agent_execution → conflict → recommendation →
critic? → compliance (→ repair) → response_assembly → audit`. The variable part is which boxes appear.

### 4.1 SIMPLE — "What is my current net worth?"

`intent = domain_question`, `domains = {finance}`, `risk = low`. Rules fired: R2 (Finance), R4 (a number
is required → Tool Execution). R3 no (no relationship claim), R6 no (not a decision), R7 no (a factual
figure is not a minted recommendation), R8 no (low risk). **Career/Family/Education/Health do NOT run.**

```
[0] det_turn (RM)  ──────────────────────────────────────────────┐ (floor exists already)
                                                                  │
[1] intent  ──▶ [2] selection ──▶ [3 ∥ 4] graph_plan(skip) ∥ tool_plan
                                                  │
                                                  ▼
                            ┌──────────────── Finance ────────────────┐
                            │   (validates facts, requests the calc)   │
                            └───────────────────┬──────────────────────┘
                                                ▼
                                        Tool Execution  (net-worth composition + calculation_trace)
                                                │
                                                ▼
                            (conflict: skip — single agent) (recommendation: skip — no rec)
                                                │
                                                ▼
                                          Compliance ──▶ Response Composer ──▶ User
                                                │
                                                ▼  (parallel at every stage) Audit
```

Parallel groups: `[]` (graph_plan skipped, so tool_plan runs alone). Selected: `Finance, Tool Execution`

- spine.

### 4.2 MODERATE — "Can I afford this house?"

`intent = decision`, `domains = {finance, family}`, `risk = medium`. Rules fired: R2 (Finance, Family),
R4 (numbers required → Tool Execution), R6 (`intent = decision` → Decision Scientist). Scenario/Tradeoff
run only if the Decision Scientist escalates option modeling/comparison (`AGENT_ESCALATION_MODEL.md` §3);
a single-option affordability check may resolve at Decision-Scientist + Tools. R7 runs only if a concrete
action emerges; R8 runs because this is a decision recommendation if a rec is minted. **Career/Education/
Health do NOT run.**

```
[2] selection ──▶ [3 ∥ 4] graph_plan(if cross-domain edge needed) ∥ tool_plan
                                  │
                                  ▼
        ┌──── parallel group ────┐
        │   Finance  ∥   Family  │     (independent domain agents, run simultaneously)
        └─────────┬──────────────┘
                  ▼  (join when both completed/blocked)
            Decision Scientist     (frames the affordability decision; required-inputs check)
                  │
                  ▼
            Tool Execution         (Affordability → Mortgage → Cash Flow, serial; see TOOL_EXECUTION_MODEL)
                  │
                  ▼
            (Recommendation? only if a concrete action emerges, evidence-backed)
                  │
                  ▼
            Compliance ──▶ Response Composer ──▶ User        + Audit
```

Parallel groups: `[[finance, family]]`. Compliance still runs before the user. Decision Scientist never
selects the option (`DECISION_LIFECYCLE.md` §1 — models, never decides).

### 4.3 COMPLEX — "Should I move to Texas, change jobs, and buy a house?"

`intent = decision`, `domains = {finance, career, family}`, `risk = high` (multi-domain, high-stakes).
Rules fired: R2 (Finance, Career, Family), R4 (numbers), R6 (decision → full pipeline Decision Scientist →
Scenario → Tradeoff), R7 (a concrete recommendation may emerge), R8 (high risk AND cross-domain → Critic).
**Education/Health do NOT run.**

```
[2] selection ──▶ [3 ∥ 4] graph_plan (cross-domain edges, cited) ∥ tool_plan
                                  │
                                  ▼
        ┌──────── parallel group ────────┐
        │  Finance  ∥  Career  ∥  Family │   (three independent domain agents at once)
        └───────────────┬────────────────┘
                        ▼  (join: all completed/blocked)
                 Decision Scientist     (frames the multi-domain decision; required inputs)
                        │
                        ▼
                 Scenario Agent         (models the option set deterministically — via Tool Execution)
                        │
                        ▼
                 Tradeoff Agent         (reconciles disagreements into framed tradeoffs — stage [6])
                        │
                        ▼
                 Recommendation Agent   (mints evidence-backed recs — stage [7], only with evidence)
                        │
                        ▼
                 Critic                 (adversarial refutation — stage [8], required: high + cross-domain)
                        │
                        ▼
                 Compliance ──▶ Response Composer ──▶ User      + Audit
```

Parallel groups: `[[finance, career, family]]`. The decision pipeline is strictly serial after the join
(each consumes its predecessor's output — `ORCHESTRATION_ENGINE.md` §5). The Critic precedes Compliance,
and Compliance precedes the user, always (`AGENT_INTERACTION_CONTRACTS.md` §5).

---

## 5. Routing invariants (inherited; selection must preserve)

1. Selection/order/parallel grouping are **deterministic rules**; only intent classification may use the
   LLM, and it has a deterministic fallback (default → discovery).
2. Deterministic turn first; Compliance before Response Composer; Audit always.
3. The route is a **DAG** — no cycles, no self-route, hop-bounded; no agent-to-agent direct call (all
   handoffs are `escalated` and routed by the Orchestrator).
4. No domain selected unless implicated + (data or its missing-data list is needed).
5. No Recommendation Agent without ≥1 evidenced finding (no rec without evidence).
6. No user-facing text without Compliance; Critic before Compliance for high/regulated/cross-domain.
7. No rule matched → discovery path; the deterministic floor still answers.

```

```
