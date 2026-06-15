# Compliance Output Schema (Layer 8)

> **Layer:** 8 (output contract) for the Compliance Agent. **Source of truth:** `COMPLIANCE_PROMPT.md`,
> `docs/lios-agent-specifications/COMPLIANCE_AGENT.md`, `COMPLIANCE_AND_SAFETY_FLOW.md`.
> **Version:** compliance-schema-1.0.

---

## Schema

```json
{
  "status": "approved | approved_with_caveats | require_repair | blocked",
  "risk_level": "low | medium | high | regulated",
  "issues": [
    {
      "text": "<the exact offending text>",
      "rule": "<rule violated>",
      "severity": "low|medium|high"
    }
  ],
  "required_caveats": ["not financial advice", "consult a licensed CPA", "..."],
  "unsupported_claims": [
    { "text": "", "why": "no provenance / not in allowed numbers / no cited edge" }
  ],
  "unsafe_claims": [
    { "text": "", "category": "financial|investment|insurance|tax|legal|medical|privacy" }
  ],
  "sensitive_data_flags": [{ "kind": "PII|account_number|ssn|dob|cross_tenant", "where": "" }],
  "repair_instructions": "<precise, actionable; empty unless status=require_repair>",
  "confidence": 0.0
}
```

## Field rules

| Field                  | Rule                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `status`               | exactly one of the four; `blocked` ⇒ deterministic fallback is served                            |
| `risk_level`           | `regulated` for any financial/insurance/tax/legal/medical content; drives whether the Critic ran |
| `issues`               | every entry names the **exact text** + the **rule**; empty on a clean `approved`                 |
| `required_caveats`     | caveats that MUST accompany the output if approved_with_caveats                                  |
| `unsupported_claims`   | claims lacking provenance/citation/allowed-number backing (→ downgrade or repair)                |
| `unsafe_claims`        | advice/medical/legal/tax/privacy overreach (→ require_repair or blocked)                         |
| `sensitive_data_flags` | PII / cross-tenant exposure                                                                      |
| `repair_instructions`  | non-empty **only** when `status = require_repair`; precise + actionable                          |
| `confidence`           | the Compliance Agent's certainty in its verdict (components per `CONFIDENCE_RULES.md`)           |

## Status → downstream

| status                  | next                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `approved`              | → Response Composer                                               |
| `approved_with_caveats` | → Response Composer (caveats attached)                            |
| `require_repair`        | → originating agent (via Orchestrator) with `repair_instructions` |
| `blocked`               | → deterministic safe fallback + Audit flag                        |

## Invariants

1. A clean `approved` has empty `issues`/`unsupported_claims`/`unsafe_claims`/`sensitive_data_flags`.
2. Any `unsafe_claims` entry forces at least `require_repair` (or `blocked` if not repairable).
3. `repair_instructions` is empty unless `require_repair`.
4. Under uncertainty, the verdict fails safe (toward repair/blocked), never optimistic-approve.
5. Every offending entry is traceable to the exact text + rule (auditable).
