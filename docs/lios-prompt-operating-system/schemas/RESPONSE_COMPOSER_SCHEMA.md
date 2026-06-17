# Response Composer Schema (Layer 8)

> **Layer:** 8 (output contract) for the Response Composer — the terminal, DETERMINISTIC rendering stage.
> Wraps the common envelope (`AGENT_OUTPUT_SCHEMA.md`); only the `payload` is defined here.
> **Source of truth:** `docs/lios-agent-specifications/RESPONSE_COMPOSER_AGENT.md`, `AGENT_OUTPUT_SCHEMAS.md`.
> **Version:** response-composer-schema-1.0.

The Composer is the only stage whose text reaches the surface, and only after Compliance, via the
Orchestrator. It renders validated content; it never asserts. It uses no LLM and has no domain confidence
(`confidence.na_components` = all) — it inherits, and may display, upstream confidence.

---

## Schema

The common envelope (`AGENT_OUTPUT_SCHEMA.md`) with this `payload`:

```json
{
  "assistant_message": "",
  "display_only_fields": {
    "structured_outcomes": {},
    "single_question": "",
    "formatting": {},
    "missing_data": [{ "field": "", "why_it_matters": "", "rank": 1 }],
    "relationships_referenced": [{ "from": "", "to": "", "rel": "" }]
  }
}
```

`assistant_message` is language assembled only from already-validated content. `display_only_fields` are
projections for the surface — `missing_data` and `relationships_referenced` are shown only if they were
already produced + validated upstream (display-only, never minted here).

## Field rules

| Field                                          | Rule                                                                                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `assistant_message`                            | the final user-facing string; language merged from the validated `safe_payload` only — no claim/number/recommendation added, removed, or altered |
| `display_only_fields.structured_outcomes`      | upstream deterministic outcomes (goals, panels) passed through byte-for-byte                                                                     |
| `display_only_fields.single_question`          | the single enforced question (non-semantic single-question cleanup)                                                                              |
| `display_only_fields.formatting`               | non-semantic locale/surface hints; values unchanged                                                                                              |
| `display_only_fields.missing_data`             | display-only echo of an upstream `missing_data[]`; never created here                                                                            |
| `display_only_fields.relationships_referenced` | display-only echo of edges already cited + validated upstream; never read/created here                                                           |
| `evidence` / `citations` (envelope)            | inherited from upstream — **none minted here**                                                                                                   |
| `confidence` (envelope)                        | none asserted; `na_components` = all                                                                                                             |

## Status → next

| status    | meaning / next                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------- |
| `success` | assembled the final message from validated content, outcomes preserved → returned via Orchestrator |
| `blocked` | nothing valid to render → Orchestrator uses the deterministic fallback (no invented filler)        |

(`needs_data`, `needs_confirmation`, `escalated`, `compliance_rejected` are N/A — it is a terminal renderer.)

## Invariants

1. **Only validated content** — operates solely on the accepted/repaired `safe_payload` from Compliance.
2. **No new claim or number** — language merge is claim-neutral; nothing not already validated is introduced.
3. **No writes** — it renders; it never persists, never calls an LLM, never calculates.
4. **Carries no provenance/citation it wasn't given** — evidence + citations are inherited, never minted.
5. Deterministic outcomes (goals/panels) pass through unchanged; anything Compliance dropped/repaired is never reintroduced.
6. Single-question + quote-balance cleanup stays non-semantic; same input ⇒ byte-identical output.
7. Empty validated payload ⇒ render nothing → Orchestrator fallback (never fabricate filler).
8. Faces the user only via the Orchestrator.
