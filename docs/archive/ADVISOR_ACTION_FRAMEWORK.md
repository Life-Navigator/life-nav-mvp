# ADVISOR_ACTION_FRAMEWORK.md — Sprint A

How Arcana turns a natural-language life change into a structured, impact-analyzed, _proposed_ action (Advisor OS steps 1–3). Read-only until approval.

## 1. Intent classification

Every advisor turn is classified into one of:

- **question** — "what's my retirement readiness?" → reason over the fact packet, no write proposed.
- **life_change** — "I got promoted" → enter the action loop (this doc).
- **intake_gap** — the message references a life area the model doesn't yet have → route to/strengthen Discovery (do not improvise a write).

Classification is grounded: the advisor already has the cited fact packet (`advisor_facts`, incl. `life.facts`), so it knows what it does/doesn't already know.

## 2. Change extraction → a typed ProposedAction

A life_change yields one or more `ProposedAction` objects (the LLM proposes; nothing executes):

```
ProposedAction {
  tool: 'submit_life_fact'|'submit_life_goal'|'submit_constraint'|'submit_risk'|
        'submit_opportunity'|'submit_narrative'|'submit_relationship',
  domain: finance|family|health|education|career|core,
  payload: { ...tool-specific... },          // e.g. {fact_type:'career.title', value:'Director'}
  confidence: 0-1,
  reasoning: 'why Arcana believes this change',
  affects: [ImpactItem...]                     // computed in step 3
}
```

The seven tools mirror `IngestionService` exactly — the framework cannot propose a write that has no sanctioned tool.

## 3. Impact analysis (read-only traversal)

For each proposed change, compute `affects[]` by traversing what already exists — no new engine:

- **Goal portfolio** (`life.candidate_goals` / canonical goals): which goals reference the changed entity (e.g. wedding date → "save for wedding", "buy a house").
- **Relationships** (`life.relationships`): edges of type supports/conflicts/blocks/accelerates/depends_on touching the entity.
- **Recommendations** (`*.recommendations` + Recommendation OS): which active recs are premised on the old value (e.g. savings-target rec premised on a September wedding).
- **Readiness** (`life.readiness_snapshots`): which domain scores are downstream.
- **Cross-domain** via the existing `affected_domains` arrays already on recommendations.

Each becomes an `ImpactItem { entity, current_state, projected_effect, domain, confidence }`.

## Worked example — "We moved our wedding from September to March"

Extraction → `ProposedAction{tool: submit_life_fact, domain: family, payload:{fact_type:'family.wedding_date', value:'March'}, confidence:0.9}`.
Impact traversal finds:

- **Wedding timeline** (the fact itself) — change date Sept→March.
- **Home purchase timing** (goal referencing wedding) — accelerate/re-sequence.
- **Family planning timeline** (relationship: wedding → family planning) — shift.
- **Savings targets** (recommendation premised on Sept) — recompute target date.

Arcana then renders: _"This impacts: wedding timeline · home purchase timing · family planning timeline · savings targets. Update your plan? [Review] [Approve]"_ — exactly the spec example, generated from real graph traversal.

## Trust rules

- **Confidence floor:** below the floor, propose a _clarifying question_, not a write ("Did you mean the ceremony date, or the whole planning timeline?"). Reuses the validator's fallback-on-ambiguity behavior.
- **One change at a time is explicit:** multi-entity utterances produce multiple ProposedActions, each separately approvable.
- **No fabricated impacts:** an `affects[]` item must trace to a real goal/relationship/rec/snapshot row — never an invented downstream effect. (Same no-fabrication gate as the fact packet.)
- **Never writes here:** this framework only _produces_ ProposedActions; execution is APPROVAL_AND_CHANGE_SYSTEM + MCP_ADVISOR_INTEGRATION.
  </content>
