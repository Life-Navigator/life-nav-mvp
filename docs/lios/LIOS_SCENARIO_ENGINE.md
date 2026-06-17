# LIOS Scenario Engine (Phase 6)

**Status legend:** `EXISTS` = shipped and live · `PARTIAL` = some of it exists, gaps named · `NEW` = does not exist yet.

**Honest framing.** The advisor _frames_ decisions; it does **not** run multi-scenario projections inside a turn. So a full scenario engine — best/expected/worst/user-defined/cross-domain, each tracking assumptions, dependencies, impacts, confidence, evidence, all attached to a Decision — is **mostly NEW**. But it is _not_ greenfield: the building blocks already exist (a branching scenario tree, a competing-futures comparator, deterministic calculators, an assumptions registry, a confidence model, and the worker fan-out into the graph). Phase 6 is mostly **assembly + first-class records**, not invention.

### The hard constraint (state it up front)

The advisor number-gate (`advisor_validator` + `advisor_math`) **forbids the model from writing any projected/future/growth number** — it has no user operand for inflation, returns, appreciation, or "20% down", so any such figure is rejected and the whole turn discarded. **Therefore scenario math MUST come from deterministic engines/tools, never from the model.** This is already the discipline in the codebase: `ScenarioComparisonEngine` notes _"scenario numbers come from deterministic tools"_, and `ScenarioTreeService` _"every financial delta is DERIVED from the user's real documents … never a hardcoded number."_ The model may _narrate_ a scenario; it may not _compute_ one. Phase 6 keeps that wall intact.

---

## Scenario types (target) and where each stands

| Type                                         | Status  | Grounding                                                                                                                                                                   |
| -------------------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Best / Expected / Worst**                  | EXISTS  | `decision_engine` builds `worst/expected/best` with `value` + `probability` per type; `decision.decisions.scenarios_json`.                                                  |
| **Branching (decision tree)**                | EXISTS  | `scenario_tree.ScenarioTreeService.build()` — multi-decision tree, each path yields readiness/net-worth/retirement/confidence with full lineage.                            |
| **Competing futures (cross-domain compare)** | EXISTS  | `scenario_compare.ScenarioComparisonEngine.compare()` — variants scored against the user's _active objectives_, improves/worsens matrix, tool-traceable numbers.            |
| **User-defined**                             | NEW     | No path lets a user define an arbitrary scenario (custom inputs/branches). Today scenarios come from fixed `SCENARIO_SETS` / `DECISION_LABEL` presets.                      |
| **Cross-domain**                             | PARTIAL | Compare/tree already span Finance/Career/Education/Family via domain engines + objective influence; a _unified cross-domain scenario record_ attached to a Decision is NEW. |

---

## The Scenario Record (schema)

**Mandate: every scenario tracks assumptions, dependencies, impacts, confidence, evidence.** Most of these fields are already emitted by the existing engines (cited below); the NEW work is a **first-class, persisted `scenario` record keyed to a `decision_id`** that unifies them.

### Fields and their grounding today

```
scenario_id            -- EXISTS: scenario_compare "buy_now"/"retire_55"; scenario_tree node id "root>mba:yes"
decision_id            -- NEW: explicit FK to the Decision this scenario serves
name / label           -- EXISTS: variant.name / node.label
kind                   -- NEW: best | expected | worst | user_defined (decision_engine has best/expected/worst as scenarios_json labels, not a typed field)

assumptions[]          -- EXISTS: A.cite(<key>) from assumptions.py registry
                       --         (tuition_inflation, mortgage_rate, investment_return, withdrawal_rate, ...)
dependencies[]         -- PARTIAL: scenario_compare.needs / variant.needs (missing docs lower confidence);
                       --          life.dependencies exist per objective — NOT yet modeled as scenario edges
impacts[]              -- EXISTS: scenario_compare objective_impacts {objective, root, score, is_primary};
                       --         scenario_tree readiness deltas; tradeoffs improves/worsens
confidence             -- EXISTS: blended base_conf + deterministic tool confidence (scenario_compare);
                       --          confidence.py C.build(document_coverage, reference_quality, missing_inputs)
confidence_breakdown   -- EXISTS: scenario_tree node.confidence_breakdown
evidence[]             -- EXISTS: scenario_tree lineage.evidence {statement, source}; tool_runs.outputs+calculation
tool_calculations[]    -- EXISTS: scenario_compare.tool_calculations -> tools.tool_runs (auditable run ids)
missing_inputs[]       -- EXISTS: scenario_compare.missing_inputs; tree lineage.missing ("Upload X to improve")
outcome                -- EXISTS: scenario_tree {readiness_index, net_worth(+_known), retirement_ratio, confidence}
```

### What's NEW

- A **persisted `scenario` table** (today scenarios live inside `decisions.scenarios_json` or are computed on the fly by compare/tree — there is no standalone, queryable scenario row keyed to a decision).
- A typed **`kind`** (best/expected/worst/user_defined) as a first-class field.
- **User-defined scenarios** (custom inputs/branches beyond the presets).
- **Dependencies as explicit edges** between scenarios and the things they rely on.

---

## How scenarios reuse the graph + deterministic calculators

### Dependencies / impacts as edges — PARTIAL → NEW

The graph already models a decision's reasoning: `decision_graph.DecisionGraphService` builds
`Documents → Analyses → Impacts → Tradeoffs/Risks → Recommendation → Readiness Delta`,
and the worker fans a persisted decision into a graph subtree — `ontology.rs` defines `EntityType::LifeDecision` and `EntityType::DecisionScenario` (`Domain::Decision`), and `normalizer.rs` _"fans scenarios_json into"_ `DecisionScenario` nodes anchored to their decision (migrations 134 schema, 135 triggers). So **scenarios are already graph citizens.**

Phase 6 NEW: model a scenario's **dependencies** (the documents/inputs it needs — already in `missing_inputs`/`needs`) and **impacts** (the objectives it moves — already in `objective_impacts`) as explicit graph **edges** from the `DecisionScenario` node, so the graph answers "what does this future depend on, and what does it move?" in one hop. The objective targets already exist (`life.life_objectives`, `root_objective_key`); the dependency surface already exists (`life.dependencies`). The NEW part is wiring them as scenario edges.

### Numbers from deterministic calculators — EXISTS

Every scenario number traces to `tools.py` (`apps/lifenavigator-core-api/app/services/tools.py`), the pure-function deterministic tool platform — **not the model**:

- `retirement_projection` (variant overrides `retirement_age=55/65`), `home_affordability`, `debt_payoff`, `degree_roi`, `k401_match`, `rent_vs_buy`, `emergency_fund`, `savings_rate`, `net_worth`.
- Each returns `{outputs, assumptions (A.cite), confidence, limitations, calculation, deterministic: true}`.
- `ToolRunner.run()` persists every run to `tools.tool_runs` (migration 156: `inputs, outputs, assumptions, confidence, limitations`, RLS-scoped) with a `scenario_id` — so a scenario's numbers are **first-class, auditable entities**.
- `scenario_compare.VARIANT_TOOLS` maps each variant to its tools (`retire_55 → retirement_projection{retirement_age:55}`), and `_variant_tool_runs` blends the tool confidence into the scenario confidence. This is the model-free path the number-gate constraint demands.

Assumptions come from one registry — `assumptions.py` (`A.cite`, `A.value`, `A.by_category`) — so every projection cites the same, auditable assumption set rather than inventing constants.

---

## How scenarios attach to a Decision

- **Today (EXISTS):** `decision_engine` embeds `scenarios_json[]` _inside_ the decision row; the worker fans those into `DecisionScenario` graph nodes anchored to the `LifeDecision`. `decision_workspace` attaches scenario + readiness-impact to a preset decision and surfaces it via `POST /v1/decision/workspace`. `scenario_tree`/`scenario_compare` are reachable at `/v1/decision/scenarios` and `/v1/decision/compare/{set}`.
- **The gap (NEW):** scenarios are not independently addressable, not typed by `kind`, and not joined to the _advisor_ decision turn (`advisor_turns`). When the advisor frames a decision, no scenarios are computed or linked.

**Phase 6 NEW work (assembly):**

1. A persisted `scenario` row keyed by `decision_id`, with `kind`, `assumptions[]`, `dependencies[]`, `impacts[]`, `confidence(+breakdown)`, `evidence[]`, `tool_run_ids[]`, `outcome` — populated by the existing tree/compare engines, not by the model.
2. On a framed advisor decision (Phase 5), trigger the deterministic scenario engines for the classified `decision_type`, attach the resulting scenarios to the `decision_id`, and let the advisor **narrate** (never compute) the best/expected/worst it sees.
3. Scenario↔objective and scenario↔dependency **graph edges** off `DecisionScenario`.
4. **User-defined scenarios**: accept user inputs/branches, run them through the same deterministic tools, persist with the same schema. The number-gate wall holds because the user supplies the operands and tools do the math.

---

## Summary

| Capability                                                       | Status                                                 |
| ---------------------------------------------------------------- | ------------------------------------------------------ |
| Best/expected/worst scenarios                                    | EXISTS (`decision_engine`)                             |
| Branching scenario tree with lineage                             | EXISTS (`scenario_tree`)                               |
| Competing-futures comparison vs objectives                       | EXISTS (`scenario_compare`)                            |
| Deterministic, auditable scenario numbers                        | EXISTS (`tools.py` + `tool_runs`)                      |
| Assumptions registry + cited assumptions                         | EXISTS (`assumptions.py`)                              |
| Confidence model + breakdown                                     | EXISTS (`confidence.py`)                               |
| Scenarios as graph nodes                                         | EXISTS (worker `DecisionScenario`, migrations 134/135) |
| Model forbidden from projecting numbers                          | EXISTS (number-gate; constraint upheld)                |
| First-class persisted scenario record (typed, keyed to decision) | NEW                                                    |
| Scenario↔objective / ↔dependency edges                           | PARTIAL → NEW                                          |
| User-defined scenarios                                           | NEW                                                    |
| Scenarios attached to the _advisor_ decision turn                | NEW                                                    |

**Bottom line:** the engines, calculators, assumptions, confidence, and graph fan-out exist; what's NEW is a first-class scenario record, typing, user-defined scenarios, dependency edges, and binding scenarios to the advisor's framed decision — all while keeping the hard rule that **scenario numbers come from deterministic tools, never the model.**
