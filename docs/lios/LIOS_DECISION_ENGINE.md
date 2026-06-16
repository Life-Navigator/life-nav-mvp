# LIOS Decision Engine (Phase 5)

**Status legend:** `EXISTS` = shipped and live · `PARTIAL` = some of it exists, gaps named · `NEW` = does not exist yet.

**Thesis.** The advisor already _is_ a decision-framing kernel. The V6 advisor (`advisor-hybrid-6.0.0`) emits a six-section decision turn, the deterministic trust spine gates it (number-grounding, advice-scope, repair-not-reject), and a grounded-math verifier checks every derivation. Models are replaceable workers behind one `AdvisorLLM` interface (Gemini today, Claude-on-Vertex behind a flag — identical prompt, identical pipeline). **The durable asset is the decision framework, not the model.** Phase 5 formalizes the canonical pipeline and the _decision record_ so that every decision is explainable, auditable, and traceable — and names the two stages that are not yet first-class (`Scenarios`, explicit `Objectives`/`Confidence`).

---

## The canonical decision pipeline

```
Understand → Frame → Objectives → Constraints → Tradeoffs → Scenarios → Risks → Opportunities → Recommendation → Confidence → Next Action
```

Today the advisor collapses several of these into its six-section turn. The grounding below says, per stage, exactly what code produces it and how far along it is.

| #   | Stage          | Status  | Produced today by                                                                                                                                                                                                                                                                                                       |
| --- | -------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Understand     | EXISTS  | `advisor_context.AdvisorContext` (`prompt_dict()`), `conversation_so_far`, `numbers_you_may_reference`; "WHAT WE KNOW" section restates the user's own facts.                                                                                                                                                           |
| 2   | Frame          | EXISTS  | `advisor_llm.ADVISOR_SYSTEM` §1 `decision_frame` — names the decision, why it matters, the 2–4 key drivers. The thing a form skips.                                                                                                                                                                                     |
| 3   | Objectives     | PARTIAL | Persisted `life.life_objectives` (root key, confidence) drive `scenario_compare` and `recommendations_os`. The _advisor turn_ does not yet emit an explicit objectives block — objectives are referenced implicitly, not surfaced as a first-class field.                                                               |
| 4   | Constraints    | EXISTS  | Trust spine encodes them: advice-scope regex `advisor_validator._ADVICE` (medical/legal/tax/product hard-blocked), number gate `_FIN_NUM`, `should_persist=False`, relationship/graph constraints `_check_relationships`. The prompt's HARD RULES restate them for the model.                                           |
| 5   | Tradeoffs      | EXISTS  | `ADVISOR_SYSTEM` §2 `tradeoffs[]` ({option, benefit, cost}); structurally also `decision_engine` `tradeoffs_json` and `scenario_compare` improves/worsens matrix.                                                                                                                                                       |
| 6   | Scenarios      | PARTIAL | **The advisor turn does not run scenarios** (this is Phase 6). Out-of-band, scenario projection already exists: `decision_engine` worst/expected/best, `scenario_tree` branching tree, `scenario_compare` competing futures with tool-traceable numbers. Not yet attached to the advisor decision turn.                 |
| 7   | Risks          | EXISTS  | `recommendations_os` `RISK` rec_type with recomputed adequacy; `decision_graph` red risk nodes; advisor surfaces risk qualitatively inside frame/tradeoffs.                                                                                                                                                             |
| 8   | Opportunities  | EXISTS  | `recommendations_os` `OPPORTUNITY` rec_type (e.g. GI Bill, 401k beyond match).                                                                                                                                                                                                                                          |
| 9   | Recommendation | EXISTS  | `ADVISOR_SYSTEM` §4 `recommendation` ("My read") — a grounded, hedged position, number-gated; `recommendations_os` is the canonical machine-readable rec store (evidence-or-nothing).                                                                                                                                   |
| 10  | Confidence     | PARTIAL | Machine paths have it (`decision_engine.confidence` from evidence count; `tools` per-run confidence; `confidence.py` registry; `recommendations_os` formula). The _advisor turn_ persists a `confidence` column (`advisor_turns`) but does not yet expose a calibrated confidence to the user as a first-class section. |
| 11  | Next Action    | EXISTS  | `ADVISOR_SYSTEM` §6 `next_question` + §5 `what_we_still_need` (the highest-value missing inputs that would change the read); `recommendations_os.roadmap()` Now/Next/Later for machine recs.                                                                                                                            |

### What's PARTIAL, stated honestly

- **Scenarios are not a first-class output of a decision turn.** The advisor _frames_ a decision; it does not project best/expected/worst inside that turn. The projection engines exist separately (Phase 6 wires them in).
- **Objectives are implicit.** They live in `life.life_objectives` and steer scenario/rec ranking, but the advisor does not emit an explicit "your objectives this bears on" block.
- **Confidence is computed but not surfaced.** It is persisted per turn and computed deterministically for machine recs/tools, but is not yet a calibrated user-facing section of the advisor turn.

---

## How each stage is produced — concrete grounding

### Frame · Tradeoffs · Recommendation · Next Action (the advisor turn) — EXISTS

`apps/lifenavigator-core-api/app/services/advisor_llm.py` — `ADVISOR_SYSTEM` defines the exact six-section JSON contract:

```
decision_frame · tradeoffs[] · what_we_know[] · derivations[] · recommendation
· what_we_still_need[] · next_question · why_this_question
```

The model leads inside guardrails passed as `{"guardrails": context.prompt_dict(), "constraints": plan}`. Per-task temperature (`TEMPERATURE`), tolerant JSON parse (`parse_advisor_json`). The model is swappable: `GeminiAdvisorLLM` (default) and `VertexClaudeAdvisorLLM` (flagged) share the _identical_ prompt and pipeline — a benchmark delta is attributable to the model alone.

### Constraints (the trust spine) — EXISTS

`apps/lifenavigator-core-api/app/services/advisor_validator.py` — `validate(result, context) -> (ok, safe_result, reasons)`:

1. **Advice-scope** — `_ADVICE` regex hard-blocks medical/legal/tax/named-product directives (strategic personal-finance advice is allowed).
2. **Number gate** — every financial-looking number in any _visible_ section must be in `context.allowed_numbers` **or** a verified derivation; otherwise reject.
3. **Must ask** — a discovery turn must carry a `next_question` (or be a pure summary).
4. **Graph honesty** — `_check_relationships` rejects relationship claims with no supporting real edge.

- **Repair-not-reject:** multi-question turns are trimmed to the first question (`_first_question`), fabricated-source facts dropped, only verified derivations and real-edge citations survive. `should_persist` is forced `False` — **the LLM never writes the DB.**

### Grounded math — EXISTS

`apps/lifenavigator-core-api/app/services/advisor_math.py` — `verify_derivations(derivations, allowed_numbers)`:

- Every operand must trace to a user number (`expand_money` across `$22k`/`24%`/`5,200` notations) or the unit constants `{12, 52, 365, 100}`.
- The expression is evaluated via a restricted AST walk (no `eval`), checked against the claimed value within rounding tolerance.
- Only verified values join the allowed set; a fabricated/incorrect figure is never added, so the number gate discards the whole turn if the prose cites it. **Guarantee: no number reaches the user that isn't the user's own or a verified computation from the user's own.**

### Recommendation store (machine-readable, evidence-or-nothing) — EXISTS

`apps/lifenavigator-core-api/app/services/recommendations_os.py` — the single registry every consumer reads:

- `write()` **returns `None` if `evidence` is empty** — no recommendation enters without evidence.
- Priority = `Impact × Confidence × Urgency × Evidence ÷ Effort` (stored as `formula`), aged by `_decay`, nudged down by learned behaviour.
- Typed: `ACTION / RISK / OPPORTUNITY / DEPENDENCY / INFORMATION`. `prioritize()`/`roadmap()` give one ranked answer; `audit()` enforces reviewer gates (CFP/CPA/attorney/physician/VSO).

### The reasoning, made visible — EXISTS

`apps/lifenavigator-core-api/app/services/decision_graph.py` — `DecisionGraphService.build()` composes
`Documents → Analyses → Impacts → Tradeoffs/Risks → Recommendation → Readiness Delta` as colored, clickable nodes+edges, with the OS's prioritized recs as first-class graph nodes. Nothing is invented; a node appears only when its underlying data exists, and each cites its source.

### Cross-domain decision assembly — EXISTS

`apps/lifenavigator-core-api/app/services/decision_engine.py` — `decide()`/`persist()` classify a life question and assemble worst/expected/best scenarios + cited evidence + tradeoffs from the live domain engines; `persist()` **refuses to store with no evidence**. Router: `apps/lifenavigator-core-api/app/routers/decision.py` (`POST /v1/decision`, `/preview`, `/workspace`, `/workspace/graph`, `/scenarios`, `/brain`, `/compare`).

---

## The Decision Record (schema)

**Mandate: every decision is fully explainable + auditable + traceable.** A decision record captures _what was asked, what was known, what was assumed, what evidence and tools participated, which model produced the language, and what came out_ — enough to reconstruct and defend the decision after the fact.

Today this is realized by **two complementary persisted records**, both already shipped:

### A) Advisor turn record — EXISTS (`analytics.advisor_turns`, migration 160)

One row per advisor turn — the audit trail of a _framed_ decision turn. Service-role only (holds PII: user message, response, raw LLM output).

```
turn_id, conversation_id, user_id, timestamp, prompt_version
llm_status                  -- enhanced | fallback:<reason> | disabled  (which path produced it)
validator_result            -- accepted | repaired | rejected           (the trust-spine verdict)
validator_reason, validator_repairs[]
fallback_used, fallback_reason
latency_ms, stages_ms       -- {deterministic_turn, context_build, plan, llm_generate, validate, compose}
prompt_tokens, completion_tokens, total_tokens   -- cost of the participating model
graph_edges_available, relationships_referenced[]
confidence
user_message, advisor_response, llm_response_raw -- the exact inputs/outputs
```

This is the decision record's **inputs · model+confidence · output · which tools/validators participated** for the advisor surface.

### B) Decision-graph record — EXISTS (`decision.decisions`, migration 134)

The persisted root of a cross-domain decision graph:

```
id, user_id, question, decision_type, title, description(=verdict)
confidence, governance_verdict (advice boundary), status
scenarios_json[]            -- worst|expected|best outcomes
evidence_json[]             -- cited metrics + source_table
assumptions_json[]          -- stated assumptions (+ confidence, user_confirmed)
tradeoffs_json[]            -- option_a/option_b/benefit/cost/affected_domains
affected_domains[], source_tables[], source_graph_nodes[], derived_by
```

### Canonical Decision Record (target unification) — PARTIAL → NEW

The fields the mandate requires already exist _across_ A and B; what's NEW is a **single first-class record** that unifies them per decision:

| Required field                                | Where it lives today                                                                                      | Gap                                               |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **inputs** (question + user facts/numbers)    | `advisor_turns.user_message`, `decisions.question`, `context.allowed_numbers`                             | unified key NEW                                   |
| **graph nodes used**                          | `decisions.source_graph_nodes[]`, `relationships_referenced[]`                                            | advisor turn doesn't yet stamp node IDs — PARTIAL |
| **assumptions**                               | `decisions.assumptions_json[]`, `tools.assumptions`, `assumptions.py` registry                            | EXISTS                                            |
| **evidence**                                  | `decisions.evidence_json[]`, `recommendations.evidence[]` (evidence-or-nothing)                           | EXISTS                                            |
| **model + tools that participated**           | `advisor_turns.prompt_version`/tokens, `tools.tool_runs` (per-tool inputs/outputs/confidence/limitations) | EXISTS, not cross-linked — PARTIAL                |
| **confidence**                                | `advisor_turns.confidence`, `decisions.confidence`, `tool_runs.confidence`, `confidence.py`               | EXISTS (not user-surfaced for advisor — PARTIAL)  |
| **output** (frame/recommendation/next action) | `advisor_turns.advisor_response`, `decisions.scenarios_json/tradeoffs_json`                               | EXISTS                                            |

**Phase 5 NEW work:** a `decision_record` that joins (A) the advisor turn that framed it, (B) the persisted decision graph, (C) the `tool_runs` whose numbers fed it, and (D) the scenarios (Phase 6) attached to it — keyed by a single `decision_id`, so one query reconstructs the full chain.

---

## Tie to provenance (Phase 7)

Every link in the record above is already provenance-grounded — Phase 7 makes it a first-class spine:

- **Numbers** → `advisor_math.verify_derivations` keeps the derivation `{label, expression, value}`; tool numbers carry `inputs → outputs + calculation` in `tools.tool_runs` (migration 156). Every figure is either the user's own or a checked computation with a traceable expression.
- **Evidence** → `recommendations_os.write` requires `evidence[]` with `source_table`; `decision_engine` evidence carries `source_table` + `observed_at`. Nothing is asserted without a citation.
- **Graph lineage** → `decision_graph` builds `Documents → … → Recommendation` only from data that exists, each node citing its source; the worker (`ontology.rs` `LifeDecision`/`DecisionScenario`, migrations 134/135) fans a persisted decision's JSON into a Decision/Scenario/Evidence/Tradeoff subgraph in Neo4j.
- **Audit** → `advisor_turns` records _which path produced it, what the validator did, which model and how many tokens, and the raw output_ — the model-agnostic accountability layer. Because the trust spine is deterministic and model-independent, swapping the model never weakens provenance.

**Phase 7 NEW:** promote these scattered citations into one provenance graph keyed by `decision_id`, so any field of a decision (a number, a tradeoff, a recommendation) resolves to its source document/tool-run/graph-edge in a single hop.
