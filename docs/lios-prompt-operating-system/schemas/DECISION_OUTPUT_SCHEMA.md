# Decision Output Schema (Layer 8)

> **Layer:** 8 (output contract) for the decision pipeline — the aggregated output across Decision Scientist
> (frame), Scenario (modeled outcomes), Tradeoff (comparison), Recommendation (minting), and Decision
> Explanation (narrative). Wraps the common envelope (`AGENT_OUTPUT_SCHEMA.md`); only the `payload` is here.
> **Source of truth:** `docs/lios-agent-specifications/DECISION_SCIENTIST_AGENT.md`, `SCENARIO_AGENT.md`,
> `TRADEOFF_AGENT.md`, `RECOMMENDATION_AGENT.md`, `DECISION_EXPLANATION_AGENT.md`, `AGENT_OUTPUT_SCHEMAS.md`,
> `DECISION_LIFECYCLE.md`.
> **Version:** decision-output-schema-1.0.

The decision pipeline **models; it never decides.** It frames the real options, simulates each with a trace,
compares them, and explains — without ever naming "the answer." Recommendations appear only if the
Recommendation Agent minted them (evidence-or-nothing).

---

## Schema

The common envelope (`AGENT_OUTPUT_SCHEMA.md`) with this `payload`:

```json
{
  "decision_frame": {
    "question": "",
    "restated_as_choice": "",
    "relevant_domains": ["finance"],
    "lifecycle_state": "framed | inputs_gathered | modeled | presented"
  },
  "options": [{ "id": "", "label": "", "description": "", "from_user_situation": true }],
  "required_inputs": [{ "field": "", "why_needed": "", "for_options": [""], "have": true }],
  "missing_inputs": [{ "field": "", "why_it_matters": "", "decisiveness": 0.0, "rank": 1 }],
  "option_outcomes": [
    {
      "option": "",
      "outcome": { "metric": "value (from the trace, never invented)" },
      "calculation_trace": {
        "tool": "",
        "inputs": {},
        "output": {},
        "steps": [],
        "assumptions": []
      }
    }
  ],
  "tradeoffs": [
    {
      "option_a": "",
      "option_b": "",
      "dimension": "",
      "a_effect": "(from option_a's trace — never invented)",
      "b_effect": "(from option_b's trace — never invented)"
    }
  ],
  "explanation": "grounded narrative — comparison, never 'the answer'",
  "recommendations": [
    {
      "rec_type": "ACTION | RISK | OPPORTUNITY | DEPENDENCY | INFORMATION",
      "title": "",
      "narrative": { "current": "", "target": "", "delta": "", "why": "" },
      "evidence": [{ "statement": "", "source_table": "" }],
      "rank_score": 0.0
    }
  ]
}
```

## Field rules

| Field                                 | Rule                                                                                                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `decision_frame`                      | the question restated as a decidable choice + the domains it touches + lifecycle state (Decision Scientist)                                            |
| `options`                             | the user's real, mutually-exclusive paths (`from_user_situation:true`) — never generic, never invented                                                 |
| `required_inputs`                     | what the model needs to simulate the options; `have` reflects real coverage                                                                            |
| `missing_inputs`                      | absent required inputs, ranked by `decisiveness`; named, never valued                                                                                  |
| `option_outcomes`                     | one per option; each `outcome` figure is drawn from its `calculation_trace` (Scenario via Tool Execution)                                              |
| `option_outcomes[].calculation_trace` | the only source of a number — produced by Tool Execution, not authored here                                                                            |
| `tradeoffs`                           | option-vs-option, per dimension; `a_effect`/`b_effect` come from the traces — no new numbers (Tradeoff)                                                |
| `explanation`                         | grounded narrative referencing the traces; frames cost/protect + names decisive missing inputs (Decision Explanation, LLM-authored → Compliance-gated) |
| `recommendations`                     | present **only** if minted by the Recommendation Agent; each evidence-backed (`≥1 {statement, source_table}`) + ranked                                 |
| `compliance` (envelope)               | set by the gate; high-stakes runs Critic + Compliance before any user-facing text                                                                      |

## Status → next

| status                | meaning / next                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `success`             | frame + traced outcomes + tradeoffs (+ explanation/recs) ready → Critic/Compliance → Composer |
| `needs_data`          | decisive required inputs missing → routed to be asked; no guessed values                      |
| `needs_confirmation`  | a candidate input/fact must be confirmed before modeling proceeds                             |
| `blocked`             | a required engine is down → deterministic fallback                                            |
| `escalated`           | a stage hands off to the next pipeline agent (via Orchestrator only)                          |
| `compliance_rejected` | LLM-authored explanation/rec failed the gate → fallback surfaced                              |

## Invariants

1. **Models, not decides** — no "the answer", no "you should choose X", no chosen option / verdict ranking.
2. **Every number carries a `calculation_trace`** — outcomes and tradeoff effects are drawn from traces; no orphan figures.
3. **Cross-domain links need a cited real edge** (citation contract) — an uncited cross-domain effect is dropped.
4. **Recommendations only via the Recommendation Agent** — evidence-or-nothing; an empty-evidence candidate mints nothing; recs never auto-become goals.
5. **High-stakes → Critic + Compliance before the user** — LLM-authored narrative is always gated.
6. Options must come from the user's real situation; missing inputs are named, never valued.
7. The user owns the choice; the pipeline frames and explains — it never prescribes.
