# API_READ_PATH_AUDIT — life-model read paths

Sprint: "Data Flow & Rendering Integrity". Scope: document what each read endpoint returns
(tables/fields), and what is dropped / renamed / duplicated on the way to the frontend.
core-api was read **read-only** (another agent owns the backend). All file:line refs are real.

---

## 1. `GET /v1/life/my-life`

Router: `apps/lifenavigator-core-api/app/routers/life.py:127`
Service: `apps/lifenavigator-core-api/app/services/my_life.py:92` (`MyLifeService.my_life`)
Web pass-through: `apps/web/src/app/api/life/my-life/route.ts:4` (verbatim proxy, no reshape)

Composed from `LifeDiscoveryService.snapshot()` (`life_discovery.py:868`), `ReadinessEngine.assess`,
`RecommendationOS.prioritize`, `discovery_health`, and `CanonicalGoalsService`.

Top-level fields returned today (`my_life.py:225-234`):

| Field                   | Source tables / computation                                                                                                 | Notes                                                                                                                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `life_brief`            | `life_discovery.life_brief()` over snapshot `dominant_narrative` + `goal_portfolio` + `top_risks` + next action + readiness | dict: `ready, headline, narrative_key, body, situation, tension, stakes, next_move, readiness_line, goals_held[], watching[], could_change[], confidence_pct, source` (`life_discovery.py:498-513`) |
| `canonical_goals`       | `CanonicalGoalsService.canonical_goals` (deduped join across goal stores)                                                   | array; `title, status, progress, domain, confidence, confirmation_status, source_store`                                                                                                             |
| `narrative_explanation` | `snapshot.narrative_explanation` (`life_discovery.py:535`)                                                                  | dict or **null**: `narrative, why, contributing_goals[], evidence_signals[], confidence_pct, confidence_label, source`                                                                              |
| `life_vision`           | `life_vision` table + primary objective                                                                                     | `life_vision, vision_authored, vision_confirmed, primary_objective, objective_inferred, confidence_pct, discovery_completion_pct, source, provenance{}`                                             |
| `what_matters_most`     | objectives + `risks`/`opportunities`/`constraints`/`dependencies` tables + Recommendation OS                                | `primary_objective, reasoning, depends_on[], risks[], constraints[], opportunities[], supporting_objectives[], source` (`my_life.py:157-167`)                                                       |
| `life_readiness`        | Readiness Engine                                                                                                            | `overall, status, domains[]{domain,progress,status,gap}, source`                                                                                                                                    |
| `next_best_action`      | Recommendation OS prioritize                                                                                                | `kind(action/priority_issue/insufficient), label, title, why, recommended_action, expected_benefit, confidence_pct, quantified_impact, needed_to_act, rec_type, source`                             |
| `constraints`           | `active_constraints` + readiness gaps + missing discovery areas                                                             | top-6 `{label, detail, source}` (`my_life.py:201-208,231`)                                                                                                                                          |
| `recent_intelligence`   | `life_objectives` / `recommendations` / `tool_runs`                                                                         | feed `{type, label, when}`                                                                                                                                                                          |
| `has_discovery`         | `bool(snapshot.objectives)`                                                                                                 |                                                                                                                                                                                                     |
| `note`                  | static                                                                                                                      |                                                                                                                                                                                                     |

**Available in snapshot but NOT surfaced at the my-life top level** (this sprint's gap — these are the
fields the backend agent is adding as `narrative_summary`, `motivations`/`emotional_signals`, `timeline`,
`coverage`, `missing_context`):

- `snapshot.emotional_signals` (`life_discovery.py:899`) — emotional/motivation signal list. Currently only
  echoed inside `narrative_explanation.evidence_signals` in humanized form; the raw signal list is dropped.
- `snapshot.user_priority` / `snapshot.narrative` (`life_discovery.py:906-907`) — the user's own words; dropped.
- `snapshot.candidate_objectives`, `snapshot.top_themes` — dropped at the my-life layer.
- `narrative_summary`, `timeline`, `coverage`, `missing_context` — **not yet present** in the payload
  (being added by the backend agent). Frontend reads them DEFENSIVELY so they render the moment they appear.

**Renamed across the boundary**: snapshot `dominant_narrative.label` → `life_brief.headline`;
`dominant_narrative.summary` → `life_brief.situation`/`body`. `active_constraints[].label` appears in BOTH
`what_matters_most.constraints` (as bare strings, `my_life.py:163`) AND top-level `constraints` (as
`{label,detail}`, `my_life.py:202`) — a duplication the frontend must not double-render.

**Duplication risk**: `what_matters_most.primary_objective` == `life_vision.primary_objective` ==
`next_best_action` may all echo the same objective title. Goals appear in `canonical_goals` AND
`life_brief.goals_held` (the latter is narrative phrasing, the former is the tracked list).

---

## 2. `GET /v1/life/goals` (canonical goals)

Router: `life.py:139`. Service: `MyLifeService.canonical_goals` (`my_life.py:25`) → `CanonicalGoalsService`.
Returns `{goals[], count, empty_message, source}`. Each goal: `title, status, progress, domain,
confidence, confirmation_status, source_store`. This is the ONE deduped source; the dashboard
(`ExecutiveSummary.tsx:163`) and report (`report_engine.py:257`) both read it. Web proxy: `/api/goals`.
**No fields dropped** — but note `confirmation_status` is consumed by ExecutiveSummary's `Goal` type
(`ExecutiveSummary.tsx:70`) yet never RENDERED (see RENDERING_SURFACE_MAP).

---

## 3. `GET /v1/recommendations/roadmap` + `prioritize`

Router: `apps/lifenavigator-core-api/app/routers/recommendations.py`. Web proxy: `/api/recommendations`.
Roadmap returns `{now[], next[], later[], blocked_by[], conflicts[], why_now, note}`. Each action:
`id, title, rec_type, source_module, confidence, current_state, target_state, delta, quantified_impact{},
why, recommended_action, expected_benefit, finding, formula{}, merged_from[], impacted_domains[],
priority, evidence[], assumptions[], narrative{}, updated_at`.
Frontend (`dashboard/recommendations/page.tsx`) renders nearly all of these. **Dropped at UI**:
`narrative.target`/`narrative.current` (only `narrative.why`/`narrative.delta` shown); `category`.
No missing/renamed fields of concern. `prioritize.top_actions` feeds `my_life` risks/opps/next-action.

---

## 4. Report preview — `GET /v1/reports/{type}/preview`

Router: `apps/lifenavigator-core-api/app/routers/reports.py`. Engine: `report_engine.py:93` (`build`).
Web proxy: `apps/web/src/app/api/reports/[type]/preview/route.ts` (verbatim). Viewer: `dashboard/reports/[type]/page.tsx`.

Two relevant sections in the `full` report:

- **`advisor_executive`** (`report_engine.py:196`, body at `:274-293`): `cover{}, life_brief, dominant_narrative,
narrative_explanation, vision, primary_objective{title,reasoning}, readiness, goals[] (canonical, with
confirmation_status+source_store, `:258-260`), recommendations[], next_best_action, risks[], opportunities[],
missing_data[], plan_90{}, appendix{}`.
- **`life_model`** (`report_engine.py:140`, body at `:153-160`): `life_vision, primary_objective{}, themes[],
constraints (← `snapshot.active_constraints`, list of **{label,detail} OBJECTS**), opportunities[], tradeoffs[]`.

**Frontend gaps (consumed vs dropped)** — viewer types at `page.tsx:44-81`:

- `advisor_executive.dominant_narrative` and `advisor_executive.narrative_explanation` are returned by the
  engine but the viewer NEVER reads them (no "Why Arcana believes this" in the report). **Dropped.**
- `life_model.constraints` are **{label,detail} objects** but the viewer types `constraints` as `string[]`
  (`page.tsx:79,254`) and renders `JSON.stringify(c)` (`page.tsx:441`) → renders `{"label":...}` raw. **Wrong-render bug.**
- `goals[].confirmation_status` returned (`report_engine.py:259`) but not in the viewer `goals` type → **dropped**.
- `narrative_summary`/`motivations`/`timeline`/`coverage` — not yet in the report body.

---

## 5. Dashboard API routes

- `/api/life/my-life` → §1 (verbatim proxy). Consumed by `LifeBrief.tsx`, `ExecutiveSummary.tsx`,
  `DiscoveryReveal.tsx`, `LifeIntelligence.tsx`, `MissionControl.tsx`.
- `/api/goals` → §2.
- `/api/life/attention` (`life.py:133`) → `{next_best_action, alerts[], alert_count, view_all, life_vision}`.
  Same canonical source; used by the alerts feed.
- Dashboard SSR page (`dashboard/page.tsx`) ALSO reads finance recommendations directly from Supabase
  (`getRecommendations`) for "Today's brief" — a SEPARATE source from `my_life.next_best_action`. These can
  diverge (finance-only vs cross-domain). Documented; not in scope to merge.

---

## 6. Graph API routes

- `GET /api/life-graph` (`apps/web/src/app/api/life-graph/route.ts`) fans out to `/v1/life/graph`,
  `/v1/recommendations/roadmap`, `/v1/life/my-life`, then `transformLifeGraph`. From my-life it reads ONLY
  `readiness.overall` — but my-life returns `life_readiness.overall`, not `readiness.overall`
  (`route.ts:60-63`). The `myLife?.readiness?.overall` path is **stale/wrong key** → readiness center-node
  falls through to `graph.graph_integrity.score`. Minor; documented (graph not a priority surface this sprint).
- `/api/life-graph/workspace`, `/api/life-graph/query-focus` — separate workspace endpoints, not life-model reads.

---

## 7. Advisor context read path

`life_context` (`life_discovery.py:929`) builds the GraphRAG/advisor memory: `has_discovery, life_vision,
primary_objective, objectives[], themes[], risks[], opportunities[], constraints[], open_dependencies[]`.
This is a DIFFERENT projection than my-life (no narrative/brief, constraints as bare label strings). Consistent
source tables, so no divergence of fact — only of shape. Not rendered directly; feeds the advisor LLM.

---

## Cross-cutting findings

1. **Constraints are computed but invisible on the dashboard hero.** `what_matters_most.constraints` +
   top-level `constraints[]` both exist; `ExecutiveSummary` renders neither (only depends_on/supporting).
2. **`narrative_explanation` is rendered on the dashboard (LifeBrief) but NOT in the report viewer**, even
   though the report engine includes it — inconsistent explainability across surfaces.
3. **Report `life_model.constraints` are objects rendered as JSON** — a concrete wrong-render bug.
4. **Motivations/emotional signals** are computed (`snapshot.emotional_signals`) but never surfaced on ANY
   read surface. The backend is promoting them this sprint; frontend should read defensively.
5. **Goal `confirmation_status`** flows to the dashboard + report but is never shown — users can't tell a
   confirmed goal from a persona-seeded candidate.
