# LIOS Tool Execution Runtime

> **Implementation planning only — no code, no runtime change, no deploy, no Gemini wiring, no beta
> change.** This doc maps the **live** deterministic calc engines to the LIOS typed Tool Execution
> runtime defined in `docs/lios-execution-architecture/TOOL_EXECUTION_MODEL.md` and the output contract in
> `docs/lios-prompt-operating-system/schemas/TOOL_EXECUTION_SCHEMA.md`. Paths are relative to
> `apps/lifenavigator-core-api/` unless noted. It answers, per component: **where it lives today · what
> owns it · what must change · what must NOT change.**
>
> Cardinal invariants (carried unchanged): the LLM never estimates a calc when a tool exists; every
> number carries a `calculation_trace`; writes only via approved writers after a precondition with a
> JWT `user_id`.

---

## 1. The real deterministic engines (where they live today)

| LIOS tool                                     | Lives today in                                                                                                                                                       | Owns                                                                                           | Result + trace shape today                                                             |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **emergency-fund / savings-rate / net-worth** | `app/services/tools.py:48 emergency_fund`, `:63 savings_rate`, `:75 net_worth` (registered via `tool(...)` deco `:39` into `REGISTRY:36`)                            | exact arithmetic + `_result(...)` `:31`                                                        | `{outputs, assumptions[], confidence, limitations[], calculation, deterministic:True}` |
| **debt-payoff**                               | `tools.py:84 debt_payoff` (avalanche/snowball amortization loop)                                                                                                     | months-to-debt-free, interest, order                                                           | same `_result` shape                                                                   |
| **retirement projection**                     | `tools.py:118 retirement_projection` (compound FV; rates from `assumptions.py` `A.value/A.cite`)                                                                     | projected assets, target nest egg, funding gap, readiness ratio                                | `assumptions=[A.cite(...)]`                                                            |
| **401(k) match**                              | `tools.py:143 k401_match`                                                                                                                                            | match capture / gap                                                                            | same                                                                                   |
| **home affordability**                        | `tools.py:157 home_affordability`                                                                                                                                    | affordability frame (price/income/DTI)                                                         | same                                                                                   |
| **rent-vs-buy**                               | `tools.py:180 rent_vs_buy`                                                                                                                                           | rent vs buy delta                                                                              | same                                                                                   |
| **offer comparison**                          | `tools.py:205 offer_comparison`                                                                                                                                      | offer A/B economics                                                                            | same                                                                                   |
| **degree / education ROI**                    | `tools.py:225 degree_roi` **and** `app/services/education_roi.py:49 EducationROIEngine.score_program` (ROI score, breakeven, income lift; evidence via `_ev` `:141`) | education ROI                                                                                  | `_result` (tools) / `ProgramScore` + evidence dicts (engine)                           |
| **compensation / market value**               | `app/services/compensation.py:79 CompensationIntelligenceEngine` (`market_value:98`, `scenario:135`, band lookup `_band:83`); `CompensationEstimate.as_evidence:61`  | comp bands → income for downstream tools                                                       | `CompensationEstimate` + `as_evidence(label)`                                          |
| **financial input resolver**                  | `app/services/financial_resolver.py:44 FinancialInputResolver` (`resolve:55`, `summary:124`, `tool_inputs:274`, `retirement_projection_card:232`)                    | gathers the user's REAL cited inputs the tools consume; `_field(...)` `:34` tags origin/source | typed input dict with provenance per field                                             |
| **the tool runner (dispatch + persistence)**  | `tools.py:243 ToolRunner` (`run:251`, `catalog:248`)                                                                                                                 | runs a registered tool, mints `tool_run_id`, persists the run                                  | returns `{tool_run_id, tool, label, **_result}`                                        |
| **decision brain (factor model)**             | `app/services/decision_brain.py:26 DecisionBrainService.build:41` (factors weighted from readiness + constraints + objectives; `tools` node list `:87`)              | explainable verdict from weighted factors                                                      | factor list each w/ `source`+`tool`                                                    |
| **decision engine (typed decisions)**         | `app/services/decision_engine.py:58 DecisionEngine.decide:65` (`_education_decision:99`, `_career_decision:127`, `_family_decision:155`)                             | domain-typed decision verdicts                                                                 | per-domain dict                                                                        |
| **scenario compare (the tool CHAIN)**         | `app/services/scenario_compare.py:108 ScenarioComparisonEngine` (`compare:168`, `_financial_inputs:120`, `_variant_tool_runs:148`)                                   | orchestrates per-variant tool runs against the user's real inputs                              | list of `{tool,label,outputs,confidence,calculation,tool_run_id}`                      |

> All of these are **pure deterministic** and already emit a trace-equivalent (`calculation`,
> `assumptions`, `confidence`, `limitations`). No LLM runs in any of them. This is the property LIOS
> must preserve.

---

## 2. How a tool is invoked today vs. the LIOS typed request

**Today (untyped-ish):** a caller invokes `ToolRunner.run(ctx, name, inputs, *, scenario_id, objective_id)`
(`tools.py:251`). `name` is matched against `REGISTRY`; an unknown name raises `ValueError` (`:252-253`).
Inputs are a free `dict` assembled by `FinancialInputResolver.tool_inputs` / `scenario_compare._financial_inputs`.

**LIOS target (additive wrapper, no rewrite):** a new `services/lios/tool_runtime.py` (proposed in
`TARGET_RUNTIME_ARCHITECTURE.md` §4) accepts a **typed tool request** — `{tool_name, inputs (bounded/typed),
user_context, scenario_id?, objective_id?}` — validates the name against `ToolRunner.catalog()`
(`tools.py:248`) and the inputs against the tool's declared `inputs` list (already in `REGISTRY[name]["inputs"]`),
then **delegates to `ToolRunner.run`**. Tool Execution is purely deterministic and authors no language
(`TOOL_EXECUTION_MODEL.md` §1; `TOOL_EXECUTION_SCHEMA.md` invariant 7).

- **What must change:** add the typed request/response envelope and name+input validation in front of
  `ToolRunner.run`; map the existing `_result` keys to the schema (`calculation` → `calculation_trace.steps`,
  `assumptions` → `calculation_trace.assumptions[{label,value}]`, `outputs` → `calculation_trace.output`,
  raw `inputs` → `calculation_trace.inputs`, `tool` name → `calculation_trace.tool`).
- **What must NOT change:** the engines themselves, their arithmetic, or the `_result` (`tools.py:31`)
  contents. The trace is a _projection_ of what `ToolRunner.run` already returns; the deterministic
  result is the source of truth (`TOOL_EXECUTION_SCHEMA.md` invariant 1; `CURRENT_STATE_AUDIT.md` row
  "Tool Execution: must NOT change the deterministic results + traces").
- **No-estimate rule (enforced upstream):** a domain agent may only _request_ a tool; if a tool exists for
  a number, the LLM may never produce that number in prose. The validator already rejects unsupported
  financial numbers (`advisor_validator.py:82 _financial_numbers`, gated against `allowed_numbers`),
  which is the live enforcement point of this invariant.

---

## 3. How the result + `calculation_trace` are returned

`ToolRunner.run` (`tools.py:251-265`) already returns the deterministic outputs plus `assumptions`,
`confidence`, `limitations`, `calculation`, and a fresh `tool_run_id` (`uuid4`, `:255`). The LIOS runtime
wraps this into payload **A** of `TOOL_EXECUTION_SCHEMA.md`:

```
result            ← res["outputs"]                       (typed deterministic output)
calculation_trace ← { tool: name,
                      inputs: <the typed inputs passed in>,
                      output: res["outputs"],
                      steps:  [res["calculation"]]        (the human-auditable formula string today)
                      assumptions: res["assumptions"] }   (already [{label,value}])
confidence        ← res["confidence"]  (reports input quality, NOT the arithmetic — §6)
```

Confidence already follows the schema's intent: e.g. `retirement_projection` returns `0.7` only when
income **and** assets/contrib are present, else `0.4` (`tools.py:137`) — exactly "exact math, thin inputs ⇒
lower confidence" (`TOOL_EXECUTION_MODEL.md` §6). Assumptions are always surfaced (e.g. the three
`A.cite(...)` rate citations, `tools.py:136`), satisfying "an unstated assumption is a hidden fabrication
risk" (`TOOL_EXECUTION_SCHEMA.md` invariant 4).

---

## 4. How traces are STORED (tie to telemetry / a trace store)

**Today:** every run is persisted by `ToolRunner.run` into the `tool_runs` table
(`tools.py:262`, schema `TOOLS_SCHEMA`) with `{tool_run_id, user_id, tenant_id, tool, scenario_id,
objective_id, inputs, outputs, assumptions, confidence, limitations, created_at}`. The insert is
best-effort — a persistence failure **never blocks the calculation** (`tools.py:263-264` bare `except`).
This `tool_runs` row **is the live trace store**.

**LIOS target:** treat `tool_runs` as the canonical Tool Execution trace store and _cross-link_ it to the
per-turn telemetry. The advisor telemetry envelope already records per-stage timing and graph metrics in
`analytics.advisor_turns` via `advisor_orchestrator.py:_finish/_persist` (`CURRENT_STATE_AUDIT.md` §5). The
plan: add the `tool_run_id`(s) used in a turn to the turn record (a new `tool_runs_referenced` field,
analogous to the existing `relationships_referenced` field, `advisor_orchestrator.py:162`) so "which traces
backed this turn" is auditable end-to-end.

- **What must change:** add `tool_runs_referenced` to the turn telemetry; keep `tool_runs` as the trace store.
- **What must NOT change:** the best-effort, non-blocking persistence (`CURRENT_STATE_AUDIT.md` §7.4); the
  trace being reproducible from stored `inputs`+`outputs`+`assumptions` (`TOOL_EXECUTION_SCHEMA.md` invariant 1).

---

## 5. How evidence is ATTACHED to a recommendation (RecommendationOS evidence with `source_table`)

The minting contract is **evidence-or-nothing** and already enforced:
`recommendations_os.py:56 RecommendationOS.write` returns `None` if `evidence` is empty
(`:67-69` `if not ev: return None`). Each evidence item is `{statement, source_table}` — e.g.
`{"statement": "Coverage $X vs $Y need (10× income)", "source_table": "documents:life_insurance_policy"}`
(`recommendations_os.py:292`; also `:252,:261,:272,:315,:333,:365`). `source_table` is load-bearing in the
ranking formula (`:78` boosts evidence strength when a `documents:` source is present) and the narrative
echoes the statements (`:73`).

**LIOS mapping:** a tool-derived recommendation attaches its `calculation_trace` as evidence. The Tool
Execution runtime hands the rec writer an evidence item whose `statement` is the engine's `calculation`
string and whose `source_table` names the originating engine/table (e.g. `"tool_runs:retirement_projection"`
plus the underlying `documents:401k_statement` / `finance:net_worth_snapshots` inputs). The Compensation
engine already models this with `CompensationEstimate.as_evidence(label)` (`compensation.py:61`), and the
Education ROI engine with `_ev(name,value,table,conf,expl)` (`education_roi.py:141`). RecommendationOS stays
the **only** writer (`CURRENT_STATE_AUDIT.md` Recommendation row).

- **What must NOT change:** the evidence-or-nothing guard (`recommendations_os.py:67-69`); the `{statement,
source_table}` evidence shape; RecommendationOS as the sole minting path.
- **What must change:** ensure every tool-backed rec carries the `calculation_trace`/`tool_run_id` as
  evidence so the gate can verify the allowed-numbers rule for _derived_ figures
  (`TOOL_EXECUTION_MODEL.md` §7).

---

## 6. Serial vs. parallel tool chains (the home-purchase ordering)

The ordering rule is the **data-dependency graph** (`TOOL_EXECUTION_MODEL.md` §3): independent calls may
parallelize; a tool that consumes another's output is serial.

**Live reference for chained runs:** `ScenarioComparisonEngine.compare` (`scenario_compare.py:168`) builds
shared real inputs once via `_financial_inputs` (`:120`, pulls income from `compensation.analyze`, assets from
`documents`/`finance.net_worth_snapshots`) and then runs per-variant tools via `_variant_tool_runs`
(`:148`), driven by the `VARIANT_TOOLS` map (`:95`, e.g. `"buy_now": [("home_affordability", {})]`). This is
the existing place where multiple deterministic engines run against one resolved input set.

**LIOS home-purchase chain (planning target):** for "Can I afford this house?" the serial chain is
**affordability → mortgage → cash-flow** (`TOOL_EXECUTION_MODEL.md` §3.1). Today the closest live engine is
`home_affordability` (`tools.py:157`); the mortgage and cash-flow steps are the gap to fill. The plan:
the LIOS tool planner emits an ordered DAG where `home_affordability`'s output (loan size/affordability
frame) feeds a mortgage step, whose monthly payment feeds a cash-flow step — and **no recommendation is
minted before all three traces exist** (`TOOL_EXECUTION_MODEL.md` §3.1 invariant; mirrors RecommendationOS's
evidence requirement). Independent reads (e.g. net-worth composition vs. a standalone debt summary) may run
in parallel.

- **What must change:** add the deterministic tool-plan/DAG sequencer (proposed
  `services/lios/tool_runtime.py`) and the missing mortgage + cash-flow engines as registered `tool(...)`s.
- **What must NOT change:** the rule that dependent chains are serial and complete _before_ recommendations;
  the existing per-variant run shape (`scenario_compare.py:155-156`).

---

## 7. The write path (approved writers only, precondition + JWT user_id)

A write runs only when **all** hold (`TOOL_EXECUTION_MODEL.md` §4; `TOOL_EXECUTION_SCHEMA.md` invariant 3):

1. **Approved writer only.** The sanctioned save paths today are `RecommendationOS.write`
   (`recommendations_os.py:56`, ends in `self._sb.upsert("recommendations", ...)` `:99`),
   `RelationshipManager` persistence (`relationship_manager.py:106 _persist_candidate_goals`), the domain
   writers, and `ToolRunner`'s own `tool_runs` insert (`tools.py:262`). No ad-hoc SQL; no arbitrary table.
2. **Satisfied precondition / confirmation.** The LLM never persists — it may only _request_ a write, and the
   request must clear a deterministic check (`CURRENT_STATE_AUDIT.md` §7.3 "LLM never writes"). For recs the
   precondition is the evidence guard (`:67-69`).
3. **`user_id` from the JWT.** Every writer binds tenant from the authenticated `UserContext.user_id` (RLS on
   every write) — e.g. `recommendations_os.py:86` sets `user_id`+`tenant_id` from `ctx`; `tools.py:256` does
   the same; never a body-supplied id.

The LIOS `write_receipt` (payload **B**, `TOOL_EXECUTION_SCHEMA.md`) is a projection of a successful write:
`{table, op, precondition_satisfied:true, provenance, user_id_source:"jwt", records_written}`. A failed
precondition → `blocked`; a write needing confirmation → `needs_confirmation` (nothing persisted); an
unapproved/ad-hoc path → `blocked` (rejected) (`TOOL_EXECUTION_MODEL.md` §5).

- **What must NOT change:** the "LLM never persists" boundary; approved-writer-only; JWT-sourced `user_id`
  with RLS; the evidence precondition on recs.

---

## 8. Failure → blocked (never hand-compute)

When an engine or save path is down, the live code degrades silently rather than fabricating: `ToolRunner`
raises on unknown tools (`tools.py:252`); `scenario_compare._variant_tool_runs` swallows a failed run and
continues (`:157-158`); the resolver returns honest empty/`needs_data`-style fields rather than guessing
(`financial_resolver.py` `_field` origin tagging). The LIOS runtime formalizes this as the status ladder
`success | needs_data | needs_confirmation | blocked` (`TOOL_EXECUTION_SCHEMA.md` "Status → next"). The
invariant — **never substitute a hand-computed or LLM-estimated value** — must hold (`TOOL_EXECUTION_MODEL.md`
§5; invariant 5).

---

## 9. Invariants this runtime must preserve (the must-NOT-change list)

1. **Deterministic results + traces are the source of truth** — the LIOS trace is a projection, never a
   re-computation (`tools.py:31,251`; `TOOL_EXECUTION_SCHEMA.md` invariant 1).
2. **No number without a tool + a `calculation_trace`**; the LLM never estimates a calc a tool can produce
   (enforced live at `advisor_validator.py:82`).
3. **Evidence-or-nothing recs** with `{statement, source_table}` (`recommendations_os.py:67-69`).
4. **Writes:** approved writer + satisfied precondition + JWT `user_id` + RLS; LLM never persists.
5. **Dependent tool chains are serial and complete before any recommendation**; independents may parallelize.
6. **Trace persistence is best-effort/non-blocking** (`tools.py:263-264`); telemetry stays metadata-only
   (`CURRENT_STATE_AUDIT.md` §7.4).

> Bottom line: the deterministic engines already produce trace-shaped, assumption-surfaced, confidence-aware
> results and persist them to `tool_runs`. LIOS Tool Execution is a **typed wrapper + a DAG sequencer + a
> schema projection** over `ToolRunner.run` — additive, behavior-identical to today, with the deterministic
> math and the evidence-or-nothing rule untouched.
