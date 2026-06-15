# LIOS — Agent Output Schemas

> The common output envelope every agent returns, plus the per-agent payload schema index. Specification
> only — no code, no prompts, no runtime. Every agent spec's §5 defines its `payload`; this document defines
> the envelope that wraps it and the shared sub-objects.

---

## 1. The common envelope (every agent returns this)

```json
{
  "agent": "finance",
  "version": "spec-1.0",
  "status": "success | needs_data | needs_confirmation | blocked | escalated | compliance_rejected",
  "confidence": {
    "score": 0.0,
    "band": "high | medium | low",
    "components": {
      "data_completeness": 0.0,
      "evidence_coverage": 0.0,
      "tool_availability": 0.0,
      "graph_confidence": 0.0,
      "provenance_quality": 0.0
    },
    "weights": { "wDC": 0.25, "wEC": 0.25, "wPQ": 0.2, "wTA": 0.15, "wGC": 0.15 },
    "na_components": [],
    "explanation": ""
  },
  "payload": {}, // agent-specific — defined in each agent spec §5
  "missing_data": [
    // present when status = needs_data
    { "field": "", "why_it_matters": "", "rank": 1 }
  ],
  "candidates": [], // present when status = needs_confirmation (facts/goals to confirm)
  "escalation": null, // present when status = escalated  (see AGENT_ESCALATION_MODEL.md)
  "provenance": [
    // provenance of every fact used/produced
    { "ref": "", "provenance_type": "", "source": "", "confidence": 0.0 }
  ],
  "evidence": [
    // claims must cite evidence
    { "statement": "", "source_table": "" }
  ],
  "citations": [
    // graph relationships referenced (real edges only)
    { "from": "", "to": "", "rel": "", "edge_confidence": 0.0 }
  ],
  "compliance": { "result": "n/a | accepted | repaired | rejected", "reasons": [], "repairs": [] },
  "notes": ""
}
```

**Rules:**

- `status`, `confidence`, `agent`, `version` are **always** present.
- `payload` is present on `success` / `needs_confirmation`.
- `missing_data` is required and ranked on `needs_data`.
- `escalation` is required on `escalated`.
- `evidence`/`citations` must back any claim in the payload (evidence-or-nothing; citation contract).
- `compliance` is set by the Compliance gate, not the agent (agents leave it `n/a`).
- Nothing here ever contains a value the agent invented (numbers must be the user's; edges must be real).

---

## 2. Shared sub-objects

**fact**

```json
{
  "label": "",
  "value": "",
  "category": "confirmed|candidate|assumption|inference",
  "provenance_type": "",
  "source": "",
  "confidence": 0.0
}
```

**risk / opportunity** (a recommendation subtype — see `RISK_LIFECYCLE.md`)

```json
{
  "kind": "risk|opportunity",
  "title": "",
  "severity": 0.0,
  "likelihood": 0.0,
  "impacted_domains": [],
  "evidence": [{ "statement": "", "source_table": "" }],
  "confidence": 0.0
}
```

**recommendation** (only created by the Recommendation Agent / RecommendationOS)

```json
{
  "rec_type": "ACTION|RISK|OPPORTUNITY|DEPENDENCY|INFORMATION",
  "title": "",
  "narrative": { "current": "", "target": "", "delta": "", "why": "" },
  "evidence": [{ "statement": "", "source_table": "" }],
  "assumptions": [{ "label": "", "value": "" }],
  "impacted_domains": [],
  "rank_score": 0.0,
  "confidence": 0.0,
  "missing_inputs": []
}
```

**calculation_trace** (only produced by Tool Execution / deterministic engines)

```json
{ "tool": "", "inputs": {}, "output": {}, "steps": [], "assumptions": [] }
```

---

## 3. Per-agent payload index

Each agent's `payload` is defined in its spec §5. Summary of the distinctive payload of each:

| Agent                                  | Distinctive payload                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Orchestrator                           | `route_plan`, `selected_agents[]`, `turn_id` (it wraps others; emits the governed response)                                                                   |
| Advisor                                | `reflection`, `next_question`, `why_this_question`, `summary`, `candidate_facts[]`, `candidate_goals[]`, `relationships_referenced[]`, `should_persist:false` |
| Onboarding                             | `seed_facts[]`, `seed_goals[]`, `onboarding_step`, `gate_state`, `first_next_best_action`                                                                     |
| Life Model                             | `vision`, `what_matters_most[]`, `readiness`, `constraints[]`, `next_best_action`, `recent_intelligence[]` (each with provenance)                             |
| Goal Discovery                         | `candidate_goals[]` (title/domain/reason/confidence)                                                                                                          |
| Goal Conflict                          | `conflicts[]` (cited edges), `tradeoffs[]`                                                                                                                    |
| Missing Data                           | `missing_data[]` (ranked)                                                                                                                                     |
| Memory                                 | `bounded_context` (classified facts, allowed_numbers, edges, scores)                                                                                          |
| Tool Execution                         | `result`, `calculation_trace`                                                                                                                                 |
| Audit                                  | `turn_record` (telemetry envelope)                                                                                                                            |
| Critic                                 | `verdict` (real/refuted), `reasons[]`                                                                                                                         |
| Compliance                             | `result` (accept/repair/reject), `safe_payload`, `reasons[]`, `repairs[]`                                                                                     |
| Response Composer                      | `assistant_message`, display-only fields                                                                                                                      |
| Finance/Family/Career/Education/Health | domain envelope: `state`, `risks[]`, `opportunities[]`, `missing[]`, `freshness`, `confidence` (NOT recommendations — those go to the Recommendation Agent)   |
| Document Intelligence                  | `document_type`, `extracted_fields[]` (with confidence + source), `candidate_facts[]`                                                                         |
| GraphRAG                               | `edges[]`, `connections[]`, `connected_pairs[]`, `evidence[]` (read-only)                                                                                     |
| Decision Scientist                     | `decision_frame`, `options[]`, `required_inputs[]`                                                                                                            |
| Scenario                               | `option_outcomes[]` (each with calculation_trace)                                                                                                             |
| Tradeoff                               | `tradeoffs[]` (option-vs-option, what each costs/protects)                                                                                                    |
| Recommendation                         | `recommendations[]` (evidence-backed, ranked)                                                                                                                 |
| Decision Explanation                   | `explanation` (grounded narrative referencing traces; never "the answer")                                                                                     |

---

## 4. Schema governance

- Schemas are versioned (`version` field); a breaking change bumps it and is reviewed.
- Compliance validates the envelope shape + the anti-fabrication rules (numbers, evidence, citations).
- An agent that cannot satisfy its schema returns a non-`success` state — it never ships a malformed or
  partially-fabricated payload.

---

## 5. Invariants

1. Every agent returns the common envelope; only `payload` differs.
2. Claims in `payload` must be backed by `evidence`/`citations`; numbers must be the user's.
3. `confidence` always includes components (per `AGENT_CONFIDENCE_MODEL.md`).
4. `recommendation` objects exist only from the Recommendation Agent (evidence-or-nothing).
5. `calculation_trace` exists only from Tool Execution.
6. Domain agents emit risks/opportunities + state, **not** recommendations or user text.
