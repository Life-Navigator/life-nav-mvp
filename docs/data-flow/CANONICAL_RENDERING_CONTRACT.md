# CANONICAL_RENDERING_CONTRACT

The canonical contract for `GET /v1/life/my-life` (router life.py:127 → `MyLifeService.my_life`,
my_life.py:92). One call, source-labeled, no fabrication. "Status" = before this sprint.

| Field                   | Type                                     | Source (file:line)                                                        | Status                                    |
| ----------------------- | ---------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------- |
| `life_brief`            | obj                                      | `life_brief()` (life_discovery.py:416)                                    | existed                                   |
| `dominant_narrative`    | obj\|null                                | `snapshot.dominant_narrative` (life_discovery.py:285/895)                 | **ADDED** (was only inside life_brief)    |
| `narrative_summary`     | str\|null                                | `dominant_narrative.summary`                                              | **ADDED**                                 |
| `narrative_explanation` | obj\|null                                | `narrative_explanation()` (life_discovery.py:535)                         | existed                                   |
| `life_vision`           | obj                                      | `snapshot` + provenance gating (my_life.py:121)                           | existed                                   |
| `goal_portfolio`        | list                                     | `snapshot.goal_portfolio` (life_discovery.py:891)                         | **ADDED** to aggregate                    |
| `canonical_goals`       | list                                     | `CanonicalGoalsService` (my_life.py:220)                                  | existed                                   |
| `constraints`           | list                                     | `snapshot.active_constraints` + readiness + missing (my_life.py:201)      | existed                                   |
| `what_matters_most`     | obj (risks/opportunities/depends_on/...) | Recommendation OS + snapshot (my_life.py:157)                             | existed                                   |
| `next_best_action`      | obj                                      | Recommendation OS prioritize (my_life.py:182)                             | existed                                   |
| `motivations`           | list                                     | `_motivations_from_signals(emotional_signals)` (my_life.py)               | **ADDED** (inferred from signals)         |
| `emotional_signals`     | list[str]                                | `snapshot.emotional_signals`                                              | **ADDED**                                 |
| `timeline`              | obj                                      | `_timeline_passthrough` (my_life.py) — `time_horizon` text + future_goals | **ADDED** (pass-through, no parsed dates) |
| `coverage`              | obj                                      | `discovery_health()` (life_discovery.py:987)                              | **ADDED** to aggregate                    |
| `missing_context`       | list                                     | `discovery_health.missing_areas` reshaped (my_life.py)                    | **ADDED**                                 |
| `life_readiness`        | obj                                      | Life Readiness Engine (my_life.py:170)                                    | existed                                   |
| `recent_intelligence`   | list                                     | `_recent_intelligence` (my_life.py:236)                                   | existed                                   |
| `has_discovery`         | bool                                     | `bool(snapshot.objectives)`                                               | existed                                   |

### Provenance summary semantics

- `life_vision.provenance.provenance_type` ∈ {`user_confirmed`,`user_stated`,`advisor_inferred`,`assumption`} (my_life.py:129). Inferred never claimed as confirmed.
- `motivations[].provenance_type` = always `advisor_inferred` (derived from how the user spoke; never a confirmed fact).
- `timeline.structured` = `false` (honest: no parsed dates exist).
- `coverage` / `missing_context` are honest empties — they report what discovery is still missing, never backfilled.

### Trust invariants the contract preserves

- Candidate/inferred goals stay candidate; only an explicit user priority promotes ONE objective to `confirmed`.
- No risks invented by discovery; `what_matters_most.risks` only from grounded Recommendation OS + non-generic snapshot risks.
- No date parsing, no synthetic motivations, no multi-constraint fabrication (documented residuals).
