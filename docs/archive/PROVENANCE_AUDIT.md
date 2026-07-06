# Provenance Audit

Current state of provenance tracking across the persisted truth entities, the source that generates each,
whether provenance is tracked, and where the UI presents inferred data as confirmed fact. Companion to
[USER_TRUTH_MODEL.md](./USER_TRUTH_MODEL.md).

## 1–3. What is persisted, its source, and provenance coverage

| Entity (table)                                      | Created by                               | source                           | confidence                 | created/updated | provenance_type                                         |
| --------------------------------------------------- | ---------------------------------------- | -------------------------------- | -------------------------- | --------------- | ------------------------------------------------------- |
| Life objectives (`life.life_objectives`)            | `life_discovery.discover_goal` (advisor) | ❌ (implicit advisor)            | ✅                         | ✅ / ✅         | derived: `advisor_inferred` until confirmed             |
| Life vision (`life.life_vision`)                    | `save_vision` (advisor) / persona bridge | ✅ `prompts.source`              | ❌                         | ✅ / ✅         | derived: `user_stated` vs `assumption` (persona_bridge) |
| Candidate goals (`life.candidate_goals`)            | `relationship_manager` (advisor turns)   | turn id                          | ✅                         | ✅ / ✅         | `user_stated`                                           |
| Rejected goals (`life.rejected_goals`)              | advisor correction                       | quote + reason                   | n/a                        | ✅              | terminal suppression                                    |
| Goals (`public.goals` via `/api/goals`)             | explicit user `POST /api/goals`          | ❌                               | ❌                         | ✅ / ❌         | `user_stated` (user-entered) — **no columns**           |
| Recommendations (`recommendations.recommendations`) | Recommendation OS                        | ✅ `source_module`               | ✅                         | ✅ / ✅         | `recommendation_generated` (+ evidence + assumptions)   |
| Risks (`life.risks`)                                | ~~archetype~~ → now evidence only        | ❌                               | ❌                         | ✅ / ❌         | (archetype creation removed)                            |
| Opportunities (`life.opportunities`)                | ~~archetype~~ → now evidence only        | ❌                               | ❌                         | ✅ / ❌         | (archetype creation removed)                            |
| Dependencies (`life.dependencies`)                  | `discover_goal` (objective requirements) | ❌                               | ❌ (`satisfied` tri-state) | ✅ / ❌         | unknowns to confirm (gated off dashboard)               |
| Constraints (`life.constraints`)                    | user statement via `analyze()`           | ❌                               | ❌                         | ✅ / ❌         | `user_stated`                                           |
| Career profile (`career.career_profiles`)           | form / document                          | ✅                               | ✅                         | ✅ / ✅         | source-typed                                            |
| Family insurance (`family.insurance_profiles`)      | form / document                          | ✅                               | ✅                         | ✅ / ✅         | source-typed                                            |
| Financial accounts (`finance.financial_accounts`)   | Plaid / manual                           | ❌ (implicit `plaid_account_id`) | ❌                         | ✅ / ✅         | `connected_account` vs manual                           |
| Net worth (`finance.net_worth_snapshots`)           | computed from accounts                   | ❌                               | ❌                         | ✅ / ❌         | `system_calculated`                                     |
| Document fields (`documents.document_fields`)       | extraction                               | via doc FK                       | ✅                         | ✅ / ❌         | `document_extracted`                                    |
| Documents (`documents.documents`)                   | upload                                   | ✅ `source_name`                 | ✅                         | ✅ / ✅         | `document_extracted`                                    |
| Life Graph edges                                    | `personal_graph` + advisor relation core | ✅ `provenance` + citation       | ✅                         | n/a             | persisted_edge / computed_connection / shared_node      |

**Takeaway:** provenance is tracked _partially and inconsistently_ — strong on recommendations / documents /
career / graph edges; weak/absent on `public.goals`, `life.risks/opportunities/dependencies/constraints`,
and `finance.*`. There is no single `provenance_type` column; today it is **derived in the API layer**.

## 4. UI: is inferred data shown as confirmed fact?

| Surface                                                             | Before                                           | Status                                                                                                                     |
| ------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| North-star / primary objective (ExecutiveSummary, LifeIntelligence) | shown declaratively                              | **FIXED** — shows "still forming"/"inferred" + confidence + source when not user-authored/confident                        |
| Dashboard risks/opportunities (ExecutiveSummary)                    | archetype templates shown as personalized        | **FIXED** — grounded (recommendation engine) only; archetype removed at source; honest empty state                         |
| Dependencies ("Healthcare plan for retirement", …)                  | shown as dashboard "Priorities"                  | **FIXED** — gated off the dashboard; kept only as decision-brain unknowns                                                  |
| Recommendations                                                     | already carry source_module/evidence/assumptions | OK — details panel shows evidence + assumptions; labeled as suggestions                                                    |
| Goals list (`/api/goals`)                                           | title + status only, no provenance               | **follow-on** — user-entered (`user_stated`), but no badge yet                                                             |
| Domain cards (career/family/finance)                                | now read canonical summaries (career fix)        | partial — show data + (career) confidence; no per-item badge yet                                                           |
| `/api/life/my-life` feed                                            | no per-element provenance                        | **ADDRESSED THIS SPRINT** — now returns a `provenance` block per life-model element + `<ProvenanceBadge>` on the objective |

## 5. The five fix-rules — status

1. **Inferred objectives must not display as confirmed** — ✅ `vision_confirmed`/`objective_inferred` in
   `my_life`; ExecutiveSummary + LifeIntelligence render "still forming / inferred".
2. **Inferred risks must not display as confirmed** — ✅ archetype risks removed at the source
   (`discover_goal`); remaining risks are `recommendation_generated` (evidence-backed) only.
3. **Assumptions must not display as facts** — ✅ recommendation `assumptions` render in their own
   "Assumptions" section (NodeDetailsPanel / recommendations); the new ProvenanceBadge labels `assumption`.
4. **Recommendations must not become goals automatically** — ✅ verified: goals are created only by explicit
   user action (`goalsService.createGoal` from `POST /api/goals`) or the user's discovered surface-goal. No
   code path converts a recommendation into a goal.
5. **Rejected goals must never reappear** — ✅ `life.rejected_goals` + `relationship_manager._rejected_norms`
   (suppress forever) + `advisor_validator` (drops rejected candidates).

## 6. Remaining trust risks (tracked follow-on)

- `public.goals`, `life.risks/opportunities/dependencies/constraints`, `finance.*` lack `source`/`confidence`
  columns — provenance is derived, not stored. A migration adding a uniform `provenance_type` + `source` +
  `confidence` + `updated_at` to these tables would make provenance first-class (vs derived).
- `<ProvenanceBadge>` is applied to the my-life objective this sprint; extending it to every dashboard item
  (goals list, each domain card, each risk/opportunity/recommendation row) is the remaining UI work for the
  full "click any item → see its provenance" DoD.
- `document_fields` don't expose the parent document name/type in the API (only via FK) — surface it for
  field-level provenance.
