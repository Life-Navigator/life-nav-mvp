# RENDERING_SURFACE_MAP — expected vs actually-rendered

For each life-model surface: what the canonical payload offers, what the surface actually renders,
and the concrete gap (missing / duplicate / stale / wrong-label / wrong-render). file:line refs are real.
Source payload contract: see API_READ_PATH_AUDIT.md §1.

---

## A. End-of-Discovery Reveal — `apps/web/src/components/onboarding/DiscoveryReveal.tsx`

Reads `/api/life/my-life` → `life_brief`, `what_matters_most`, `narrative_explanation` (types `:35-68`).

| Canonical field                                                  | Rendered? | Where           | Gap                                                                                                                                 |
| ---------------------------------------------------------------- | --------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| narrative (`narrative.narrative`/`brief.situation`/`brief.body`) | yes       | `:175-208` hero | ok                                                                                                                                  |
| goals (`brief.goals_held`)                                       | yes       | `:210-226`      | ok                                                                                                                                  |
| tension (`brief.tension`/`wm.reasoning`)                         | yes       | `:243-250`      | ok                                                                                                                                  |
| opportunity (`wm.opportunities[0]`)                              | yes       | `:251-258`      | only the FIRST opportunity                                                                                                          |
| risk (`brief.stakes`/`wm.risks[0]`)                              | yes       | `:259-266`      | only the FIRST risk                                                                                                                 |
| next move (`brief.next_move`)                                    | yes       | `:267-274`      | ok                                                                                                                                  |
| confidence (`brief`/`narrative.confidence_pct`)                  | yes       | `:228-236`      | ok                                                                                                                                  |
| **constraints (`wm.constraints`)**                               | **NO**    | —               | **MISSING** — never read or rendered                                                                                                |
| **motivations / emotional signals**                              | **NO**    | —               | **MISSING** — `narrative_explanation.evidence_signals` exists, not shown; raw `motivations`/`emotional_signals` (incoming) not read |

Verdict: reveal omits the two fields the sprint asks for (constraints + motivations). Otherwise consistent
with the canonical source. **Fix: add a defensive Constraints card + a Motivations/"what's driving you" line.**

---

## B. My Life dashboard — `apps/web/src/app/dashboard/page.tsx` + `ExecutiveSummary.tsx` + `MissionControl`

`ExecutiveSummary` reads `/api/life/my-life` (`life_vision`, `what_matters_most`, `life_readiness`,
`next_best_action`, `constraints`, `has_discovery`) + `/api/goals`.

| Canonical field                                                 | Rendered? | Where                              | Gap                                                               |
| --------------------------------------------------------------- | --------- | ---------------------------------- | ----------------------------------------------------------------- |
| vision / primary objective / provenance                         | yes       | `:218-279`                         | ok (confirmation state handled via `vision_confirmed`)            |
| next_best_action (all kinds)                                    | yes       | `:282-339`                         | ok                                                                |
| risks (`wm.risks`)                                              | yes       | `:365-379`                         | ok                                                                |
| opportunities (`wm.opportunities`)                              | yes       | `:381-395`                         | ok                                                                |
| priorities (`wm.supporting_objectives` + `depends_on`)          | yes       | `:343-363`                         | ok                                                                |
| readiness ring + domains                                        | yes       | `:218-279,453-483`                 | ok                                                                |
| goals (canonical, deduped)                                      | yes       | `:410-451`                         | reads `canonical_goals` first (`:163`) → **no duplicate goals** ✓ |
| **`what_matters_most.constraints` / top-level `constraints[]`** | **NO**    | type'd at `:56` but never rendered | **MISSING** — the dashboard never shows constraints               |
| **goal `confirmation_status`**                                  | **NO**    | type'd `:70`, not shown            | **MISSING** — confirmed vs candidate goal indistinguishable       |
| **motivations / emotional context**                             | **NO**    | —                                  | **MISSING**                                                       |

`LifeBrief.tsx` (the hero above ExecutiveSummary) DOES render `watching`/`could_change`
(`LifeBrief.tsx:151-182`) and "Why Arcana believes this" from `narrative_explanation`
(`:207-268`). So watching/constraints partially appear in LifeBrief but NOT in the structured
ExecutiveSummary cards. The "what Arcana is watching" requirement is met by LifeBrief; constraints +
motivations are the remaining gaps.

Verdict: **Fix ExecutiveSummary** — add a Constraints card (reads `constraints[]`/`wm.constraints`
defensively, dedup) and render goal `confirmation_status` as a small badge; add a defensive motivations line.

---

## C. Life Brief — `apps/web/src/components/dashboard/LifeBrief.tsx`

Reads `life_brief` + `narrative_explanation`.

| Canonical field                                      | Rendered? | Where                                | Gap                                                        |
| ---------------------------------------------------- | --------- | ------------------------------------ | ---------------------------------------------------------- |
| headline / body                                      | yes       | `:123-129`                           | ok                                                         |
| goals_held                                           | yes       | `:131-147`                           | ok                                                         |
| watching                                             | yes       | `:153-166`                           | ok ("What Arcana is watching")                             |
| could_change                                         | yes       | `:167-180`                           | ok                                                         |
| readiness_line                                       | yes       | `:184-186`                           | ok                                                         |
| confidence / source                                  | yes       | `:189-196`                           | ok                                                         |
| narrative_explanation (why/goals/signals/confidence) | yes       | `:207-268`                           | ok                                                         |
| **motivations / emotional context**                  | partial   | evidence_signals shown as "evidence" | the humanized signals appear; raw motivations not surfaced |

Verdict: LifeBrief is the **best-covered** surface. Only motivations are absent. Low-priority defensive add.

---

## D. "What I Know So Far" / "What Arcana understands so far"

No standalone component by that name. The honest-empty reveal header (`DiscoveryReveal.tsx:150`) and
LifeBrief's "still forming" state (`LifeBrief.tsx:83-110`) cover this. No separate surface to fix.

---

## E. Recommendations — `apps/web/src/app/dashboard/recommendations/page.tsx`

Reads `/api/recommendations` (roadmap). Renders rec_type, title, current/target/delta, why,
recommended_action, impact chips, evidence, assumptions, confidence, formula, domains, lifecycle actions
(`:273-386`). **Coverage is thorough.** Minor drops: `narrative.current`/`narrative.target`, `category`.
No life-model canonical field missing here. **No fix needed** (not a priority surface; no divergence).

---

## F. Report viewer — `apps/web/src/app/dashboard/reports/[type]/page.tsx`

Reads `/api/reports/{type}/preview` → `advisor_executive` + `life_model` sections.

| Canonical field                                                     | Rendered? | Where                                  | Gap                                                                                            |
| ------------------------------------------------------------------- | --------- | -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| narrative lead (`life_brief.body`/`situation` → vision → reasoning) | yes       | `:239-363`                             | ok                                                                                             |
| brief tension/stakes/next_move                                      | yes       | `:341-362`                             | ok                                                                                             |
| goals (canonical)                                                   | yes       | `:366-409`                             | ok                                                                                             |
| primary objective + confidence + reasoning                          | yes       | `:367-383`                             | ok                                                                                             |
| risks                                                               | yes       | `:412-422`                             | ok                                                                                             |
| opportunities                                                       | yes       | `:425-435`                             | ok                                                                                             |
| recommendations + next_best_action                                  | yes       | `:451-471`                             | ok                                                                                             |
| tradeoffs                                                           | yes       | `:474-492`                             | ok                                                                                             |
| 90-day plan + missing_data                                          | yes       | `:495-554`                             | ok                                                                                             |
| **constraints (`life_model.constraints` = {label,detail} OBJECTS)** | **WRONG** | `:438-448` renders `JSON.stringify(c)` | **WRONG-RENDER** — shows `{"label":"…","detail":…}` raw because type is `string[]` (`:79,254`) |
| **`narrative_explanation` (why / contributing goals / evidence)**   | **NO**    | —                                      | **MISSING** — engine returns it (`report_engine.py:279`), viewer never reads it                |
| **goal `confirmation_status`**                                      | **NO**    | goals type `:49-56` lacks it           | **MISSING** — can't distinguish confirmed vs candidate                                         |

Verdict: **Fix report viewer** — (1) accept constraints as `string | {label,detail}` and render the label;
(2) add a "Why Arcana believes this" block from `advisor_executive.narrative_explanation`; (3) show goal
`confirmation_status` badge. This makes the report consistent with the dashboard's explainability + constraints.

---

## G. Graph — `/life-graph/explainable` + `apps/web/src/app/api/life-graph/route.ts`

Reads `/v1/life/graph` + roadmap + my-life. From my-life it reads `myLife?.readiness?.overall`
(`route.ts:60`) but the payload key is `life_readiness.overall` → **stale/wrong key**; readiness node falls
back to graph integrity score. Real-edges-only graph otherwise. Low priority this sprint; documented.
Optional defensive fix: also read `life_readiness.overall`.

---

## Consistency check (same narrative + goals + constraints everywhere)

- **Narrative**: reveal, dashboard LifeBrief, and report all compose from the SAME `life_brief()` over the
  SAME snapshot → consistent text. ✓
- **Goals**: dashboard + report both read `canonical_goals` (deduped) → consistent, no duplicates. ✓
  Reveal uses `goals_held` (narrative phrasing) — acceptable, same source objects.
- **Constraints**: divergent TODAY — visible only in LifeBrief watching, absent on reveal + ExecutiveSummary,
  broken in report. The fixes below make all four read the same constraint labels.
- **Confidence**: each surface reads `confidence_pct` from the same brief/narrative; consistent. ✓
