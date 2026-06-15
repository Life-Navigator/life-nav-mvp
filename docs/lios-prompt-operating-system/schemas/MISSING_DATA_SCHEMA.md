# Missing Data Schema (Layer 8)

> **Layer:** 8 (output contract) for the Missing Data Agent — the ranked highest-value missing inputs for the
> current context. Wraps the common envelope (`AGENT_OUTPUT_SCHEMA.md`); only the `payload` is defined here.
> **Source of truth:** `docs/lios-agent-specifications/MISSING_DATA_AGENT.md`, `AGENT_OUTPUT_SCHEMAS.md`,
> `AGENT_CONFIDENCE_MODEL.md`.
> **Version:** missing-data-schema-1.0.

The agent measures **absence** and ranks it by value-of-information; it never supplies a value and never
phrases the user-facing question (Advisor/Onboarding ask). Its confidence reflects coverage-data quality:
weights wDC 0.50, wPQ 0.30, wEC 0.20 (TA, GC dropped/renormalized).

---

## Schema

The common envelope (`AGENT_OUTPUT_SCHEMA.md`) with this `payload`:

```json
{
  "missing_data": [
    {
      "field": "",
      "why_it_matters": "",
      "rank": 1,
      "domain": "finance | family | career | education | health | cross_domain"
    }
  ]
}
```

Only absences appear, ordered by value-of-information (`rank` 1 = highest). No field carries a guessed value;
a present + fresh field never appears here.

## Field rules

| Field                   | Rule                                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `field`                 | the absent input, named only — never valued                                                                          |
| `why_it_matters`        | value-of-information rationale grounded in THIS context (not generic filler)                                         |
| `rank`                  | 1 = highest value; deterministic stable tiebreak on ties                                                             |
| `domain`                | the domain the gap belongs to (drives where it's routed to be asked)                                                 |
| `status` (envelope)     | normally drives a `needs_data` outcome upstream; `success` only when the coverage read itself is trustworthy (≥0.75) |
| `confidence` (envelope) | reflects coverage-DATA quality, not an assertion; carries DC/PQ/EC (+ TA, GC n/a) + explanation                      |

## Status → next

| status                | meaning / next                                                                  |
| --------------------- | ------------------------------------------------------------------------------- |
| `success`             | confident ranked gap list → Orchestrator routes it to Advisor/Onboarding to ask |
| `needs_data`          | the coverage map itself is too thin to rank reliably (rare meta-gap)            |
| `needs_confirmation`  | a gap maps to a candidate fact that should be confirmed rather than re-asked    |
| `blocked`             | DiscoveryCoverageService unavailable → deterministic fallback                   |
| `escalated`           | ranked list handed to Advisor / Onboarding / owning Domain to actually ask      |
| `compliance_rejected` | a fabricated value or a false "missing" claim leaked → gate rejects             |

## Invariants

1. **Ranked** — every returned gap carries a value-of-information `rank` + a context-grounded `why_it_matters`; no bare "need more data."
2. **No fabricated values** — it names absence only; never supplies or guesses a field's value.
3. **status needs_data driver** — its product normally drives a `needs_data` outcome; it does not answer the user.
4. **Never persists** — it reads coverage only; it creates no facts, goals, recommendations, or edges.
5. A present + fresh field is never listed as missing (every gap reflects real coverage data).
6. It never phrases the user-facing question (Advisor/Onboarding own asking).
7. Makes no graph claim — it only notes whether a graph-derived input is present/absent.
