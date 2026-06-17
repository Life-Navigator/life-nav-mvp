# Narrative Consistency Report

Sprint: Finish Line · READ-ONLY AUDIT · 2026-06-16
Question: Do Current Narrative / Life Brief / Dashboard / Reports / Graph / Advisor all show the SAME dominant narrative (same `dominant_narrative` key/label)?

## Headline verdict: PARTIAL (leaning NO)

There are TWO different "theme" concepts in the codebase and the surfaces are split between them:

- **`dominant_narrative`** — the life STORY computed from the whole goal set + emotional signals (`life_discovery.dominant_narrative`, `life_discovery.py:285`). Keys like `financial_stabilization`, `health_life_balance`, `family_foundation`. This is the intended "Current Narrative."
- **`primary_objective`** — a single ranked objective (`life_discovery.snapshot` → `rank_objectives`, `life_discovery.py:884-885`). A label like "Reach financial independence." This is a DIFFERENT axis, derived independently, and can lag or contradict the narrative.

Only the dashboard Life Brief + "Why Arcana believes this" actually surface `dominant_narrative`. The Reports surface and both Advisor paths key off `primary_objective` (or the LLM's own framing) instead. So the same user can see the headline "Reclaiming health, time, and presence after overwork" on the dashboard, and a report/advisor framed around "Reach financial independence" — two different stories.

## Where each surface gets its theme

| Surface                        | Source field                                                                | Service:line                                                | Same as `dominant_narrative`?       |
| ------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------- |
| Life Brief (dashboard hero)    | `snapshot.dominant_narrative` (label/summary/signals)                       | `life_discovery.py:424` (`life_brief`) via `my_life.py:204` | ✔ canonical                         |
| "Why Arcana believes this"     | `snapshot.narrative_explanation` (built from same narrative)                | `life_discovery.py:535` via `my_life.py:209`                | ✔ canonical (same dict)             |
| Executive Summary "north star" | `primary_objective.title` (NOT the narrative)                               | `my_life.py:130`, rendered `ExecutiveSummary.tsx:227`       | ✗ different axis                    |
| "What matters most" risks/opps | derived from `prioritize()` recs, not the narrative                         | `my_life.py:92-108`                                         | n/a (recs, not theme)               |
| Reports — narrative lead       | `life_brief.body` IF present, else `vision` / `primary_objective.reasoning` | `reports/[type]/page.tsx:236-242`                           | ✗ usually falls back — see Defect 1 |
| Reports — "Your Life Model"    | `primary_objective` + `themes` (objective themes, not narrative)            | `report_engine.py:152-160`                                  | ✗ different axis                    |
| Reports — exec briefing cover  | `primary_objective.title`                                                   | `report_engine.py:263`                                      | ✗                                   |
| Advisor chat (orchestrator)    | `life_context().primary_objective` only                                     | `orchestrator.py:204-209` (`_life_block`)                   | ✗ narrative never passed            |
| Hybrid Advisor (LLM)           | `primary_objective` only; LLM frames its own decision                       | `advisor_context.py:241`                                    | ✗ + may self-derive                 |
| Graph (`/life-graph`)          | objective/goal nodes; no narrative node                                     | `life_discovery.py:1020-1024`                               | ✗ narrative not represented         |

## Defects

### Defect 1 (P0) — Reports almost never show the dominant narrative

The report viewer is written to lead with `life_brief.body` (`reports/[type]/page.tsx:235-242`):

```js
const brief = adv?.life_brief ?? null;
const narrativeBody =
  (brief && (brief.body || brief.situation)) ||
  adv?.vision ||
  lm?.life_vision ||
  adv?.primary_objective?.reasoning ||
  null;
```

…but the report engine's executive payload (`report_engine._advisor_executive_section`, `report_engine.py:262-278`) **never includes a `life_brief` key** (nor `dominant_narrative` / `narrative_explanation`). `grep dominant_narrative report_engine.py` → 0 hits. So `brief` is always null and the report falls back to `vision` / `primary_objective.reasoning`. The report's "narrative" is therefore the OBJECTIVE reasoning, not the life story — a different theme than the dashboard headline.

- Fix: add `life_brief` (and optionally `narrative_explanation`) to the exec-section payload by calling `life_discovery.life_brief(snap, ...)` server-side (the function is already imported pattern in `my_life.py:14`). Surfacing-only; the viewer already reads it.

### Defect 2 (P1) — Advisor never receives the dominant narrative

Both advisor paths inject only `primary_objective`:

- Orchestrator `_life_block` (`orchestrator.py:204`) reads `life_context()` which returns `primary_objective` but NOT `dominant_narrative` (`life_discovery.life_context`, `life_discovery.py:929-940` — no narrative field).
- Hybrid `AdvisorContext.prompt_dict` (`advisor_context.py:241`) carries `primary_objective`, no narrative.
  So when the advisor frames the user's situation, it anchors on the objective ("financial independence") rather than the story the dashboard tells them ("getting back to stable ground"). The user experiences the advisor as not knowing their own headline.
- Fix: add `dominant_narrative.label` (+ `summary`) to `life_context()` and to the advisor guardrail context as `current_narrative`, with an instruction to frame within it. Surfacing-only; reuses `snapshot`.

### Defect 3 (P1) — `primary_objective` can lag / contradict `dominant_narrative`

They are computed from different inputs in the SAME `snapshot()` call:

- `primary_objective` = top of `rank_objectives(confirmed, priority_root)` (`life_discovery.py:884`), driven by objective confidence/significance/urgency weights.
- `dominant_narrative` = `dominant_narrative(candidate_goals, narrative_text)` (`life_discovery.py:889`), driven by emotional signals (distress, burnout, money_stress) over the goal set.
  The narrative deliberately applies "stabilize-before-optimize" and "balance-after-burnout" ordering (`life_discovery.py:309-316`) that the objective ranker does not. So a burned-out user gets narrative `health_life_balance` but primary_objective `career_growth` or `financial_independence`. Because the Executive Summary headlines the OBJECTIVE as the "north star" (`ExecutiveSummary.tsx:217-227`) while the Life Brief headlines the NARRATIVE, the same dashboard shows two competing themes side by side.
- Fix (no new infra): make the Executive Summary "north star" line defer to the narrative label when a confirmed narrative exists, or relabel the objective line as "current focus" so it is not presented as the top-level theme. Alternatively surface `dominant_narrative` in `my_life.life_vision` and have the hero read it.

### Defect 4 (P2) — Graph has no narrative representation

`personal_graph` (`life_discovery.py:1009`) renders Vision / Objective / Goal / Dependency / Risk / Opportunity / Constraint nodes but no narrative node, so the "current story" is invisible on the explainability surface that is supposed to show how everything connects. Low urgency, but it means the narrative is unverifiable on the graph.

- Fix: optionally add a single Narrative node linked to the contributing goals (the data already exists in `narrative.domains`/`signals`). Surfacing-only.

## What IS consistent

- `dominant_narrative` is computed exactly once, in `snapshot()` (`life_discovery.py:889`), and both the Life Brief headline and "Why Arcana believes this" read that single dict — so those two dashboard cards are perfectly aligned (same key, label, confidence, signals).
- `narrative_explanation` is derived from the same `narrative` object (`life_discovery.py:897`), so the "why" can never disagree with the headline it explains.
- The narrative is honest: `life_brief` returns `ready:false` when there is no narrative/goals (`life_discovery.py:431`), and `narrative_explanation` returns `None` (`life_discovery.py:542`) — no fabricated theme.

## Recommended fix order (surfacing-only)

1. Defect 1 — put `life_brief` into the report exec payload (the viewer is already waiting for it).
2. Defect 2 — pass `dominant_narrative` into both advisor contexts.
3. Defect 3 — stop presenting `primary_objective` as the dashboard "north star" when a narrative exists; lead with the narrative everywhere.
4. Defect 4 — narrative node on the graph (optional).

Net: today only 2 of 6 surfaces show the canonical `dominant_narrative`; the rest show `primary_objective` or LLM-derived framing. Fixing Defects 1-3 makes the same story appear on Dashboard, Reports, and Advisor.
