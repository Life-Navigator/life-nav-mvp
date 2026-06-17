# Life Brief V2

**Date:** 2026-06-16 · Status: **BUILT + LIVE** (core-api v121). Pure surfacing of the existing Life Model — no new infra/model/agent.

## What changed from V1

V1 reflected situation → tension → stakes → next move. V2 adds the two things a real advisor always closes with: **what they're keeping an eye on**, and **what would make them change the plan**. Both are grounded only — they render only when real dependency/constraint/risk rows exist.

## New fields on `life_brief` (returned by `GET /v1/life/my-life`)

| Field          | Meaning                      | Source (existing data)                                                                                                                                                            |
| -------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `watching`     | "What Arcana is watching"    | `snapshot.open_dependencies[].label` + `snapshot.active_constraints[].label` (deduped, max 5)                                                                                     |
| `could_change` | "What could change the plan" | remaining `snapshot.top_risks[1:]` (the first risk is already the `stakes` line); falls back to an explicit deadline note **only** when the `urgency` emotional signal is present |

Implementation: `apps/lifenavigator-core-api/app/services/life_discovery.py` → `life_brief()`. Honest: when there are no dependencies/constraints, `watching == []`; when there are no further risks, `could_change == []`. Nothing is fabricated (test `test_life_brief_v2_empty_when_no_grounding`).

## Companion: `narrative_explanation` (the "why")

Also shipped in v121 — `narrative_explanation(narrative, portfolio)` composes the **"Why Arcana believes this"** rationale (why this narrative, contributing goals, evidence signals, confidence label) from the existing narrative dict. Exposed on both `snapshot` and `/v1/life/my-life`. See NARRATIVE_EXPLAINABILITY.md.

## Frontend

`apps/web/src/components/dashboard/LifeBrief.tsx` renders V2: the hero now shows side-by-side **"What Arcana is watching"** and **"What could change the plan"** sections (each only when non-empty), plus a sibling **WhyArcanaBelieves** card from `narrative_explanation`.

## Full V2 shape

```
life_brief: {
  ready, headline, narrative_key, body,
  situation, tension, stakes, next_move, readiness_line,
  goals_held[], watching[], could_change[],     // ← V2
  confidence_pct, source
}
```

## Honest residuals

- **"What changed recently"** is intentionally NOT in the brief — there is no snapshot-diff source yet. Adding it would require fabrication, so it is deferred (P2: derive from the existing recent-intelligence feed / snapshot history).
- The engine remains deterministic/heuristic (LLM-free) — by design, so the brief cannot hallucinate.

## Tests

4 V2/explanation tests in `tests/test_discovery_intelligence.py` (`test_narrative_explanation_*`, `test_life_brief_v2_*`); full core-api suite **493 passing**.
