# Agent Output Schema (Layer 8) — the common envelope

> **Layer:** 8 (output contract) — the GENERIC agent output every LIOS agent returns. This is the canonical
> Prompt-OS reference for the envelope; the five specialized schemas in this directory specialize the
> `payload` and inherit everything here.
> **Source of truth:** `docs/lios-agent-specifications/AGENT_OUTPUT_SCHEMAS.md`,
> `AGENT_FAILURE_BEHAVIOR.md` (the 6 states), `AGENT_CONFIDENCE_MODEL.md` (the confidence object).
> **Version:** agent-output-schema-1.0.

---

## Schema

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
    "explanation": "one line: which components dragged the score and why"
  },
  "payload": {},
  "missing_data": [{ "field": "", "why_it_matters": "", "rank": 1 }],
  "candidates": [],
  "escalation": null,
  "provenance": [{ "ref": "", "provenance_type": "", "source": "", "confidence": 0.0 }],
  "evidence": [{ "statement": "", "source_table": "" }],
  "citations": [{ "from": "", "to": "", "rel": "", "edge_confidence": 0.0 }],
  "compliance": { "result": "n/a | accepted | repaired | rejected", "reasons": [], "repairs": [] },
  "notes": ""
}
```

`payload` is the only part that differs per agent (specialized in the sibling schema docs and each agent
spec §5). Everything outside `payload` is identical for every agent.

## Field rules

| Field                      | Rule                                                                                                                                        |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `agent`, `version`         | always present; identify the producer + its schema version                                                                                  |
| `status`                   | exactly one of the six states (`AGENT_FAILURE_BEHAVIOR.md`); always present; mutually exclusive                                             |
| `confidence`               | always present; MUST carry `components` + `weights` + `explanation` (`AGENT_CONFIDENCE_MODEL.md`); a score without its breakdown is invalid |
| `confidence.na_components` | components that don't apply (marked `"n/a"`, not `0`); remaining weights renormalize to 1.0                                                 |
| `payload`                  | present on `success` / `needs_confirmation`; agent-specific shape                                                                           |
| `missing_data`             | required + **ranked** on `needs_data`; names absent fields, never a guessed value                                                           |
| `candidates`               | present on `needs_confirmation`; candidate facts/goals to confirm — never persisted, never shown as confirmed                               |
| `escalation`               | required (`{to, reason, payload}`) on `escalated`; routes through the Orchestrator only                                                     |
| `provenance`               | provenance of every fact used/produced (type + source + confidence per the PQ ladder)                                                       |
| `evidence`                 | every claim in `payload` cites ≥1 `{statement, source_table}` (evidence-or-nothing)                                                         |
| `citations`                | every relationship referenced is a real, cited edge (citation contract); real edges only                                                    |
| `compliance`               | set by the Compliance gate, NOT the agent; agents leave it `n/a`                                                                            |
| `notes`                    | optional non-load-bearing annotation                                                                                                        |

## Status → next (see `AGENT_FAILURE_BEHAVIOR.md`)

| status                | Orchestrator's next move                                      |
| --------------------- | ------------------------------------------------------------- |
| `success`             | continue the pipeline                                         |
| `needs_data`          | route to Missing Data / Advisor to ask, or honest empty state |
| `needs_confirmation`  | surface candidates for confirmation; never persist yet        |
| `blocked`             | stop safely; deterministic fallback; log                      |
| `escalated`           | hand off via Orchestrator to `escalation.to`                  |
| `compliance_rejected` | deterministic fallback; log as a quality signal               |

## Invariants

1. Every agent returns this envelope; only `payload` differs (this is the base all schemas specialize).
2. `status` is exactly one of the six; `success` is forbidden below confidence 0.75.
3. `confidence` always includes its components + weights + explanation; N/A components are marked, not zeroed.
4. Claims in `payload` are backed by `evidence`/`citations`; **numbers must be the user's** — nothing is invented.
5. `recommendation` objects exist **only** from the Recommendation Agent (evidence-or-nothing).
6. `calculation_trace` exists **only** from Tool Execution (the trace is the number's license).
7. Domain agents emit risks/opportunities + state — **not** recommendations and **not** user-facing text.
8. `compliance` is owned by the Compliance gate; an agent never self-approves.
9. No state ever yields fabricated data, a silent partial write, or an unhandled exception to the user.
