# LIFE_FACTS_BACKFILL_VALIDATION.md — Phase 4

Validates the backfilled `life.facts` against the surfacing contract. Prod `diwkyyahglnqmyledsey`.

## Checks

| Check                               | Method                                                                                                                     | Result                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Reader gate returns facts           | `SELECT … WHERE confirmation_status IN ('confirmed','inferred') AND value IS NOT NULL` (the exact `LifeFactsService` gate) | **58** across 3 users (52/5/1) ✅ |
| `advisor_facts` will read them      | same gate as the advisor reader (`a9f3d70`) — confirmed/inferred only                                                      | ✅ identical gate; 58 surface     |
| Inferred shows pending confirmation | all 58 `inferred` → reader sets `needsConfirmation=true` → UI "pending your confirmation"                                  | ✅                                |
| Provenance links resolve            | `EXISTS(documents.documents WHERE id = provenance.document_id)`                                                            | **58/58 resolve** ✅              |
| Rejected facts excluded             | none rejected in source; none written                                                                                      | ✅ (n/a, 0)                       |
| No candidate promotion              | `count WHERE confirmation_status='candidate'`                                                                              | **0** ✅                          |
| Number-gate eligibility             | extracted figures (185000, 1000000, …) now in `numbers_in_facts`                                                           | ✅ (values present)               |

## Pending live-path checks (require deploy — Phase 7/8)

- `GET /v1/life/facts` returns populated facts — **endpoint not deployed yet** (core-api runs `c50ccff`, which lacks it). Validated at the data + unit level (`test_life_facts.py`); live call pending the core-api deploy.
- Dashboard `RecentlyLearned` strip renders — pending web deploy + a logged-in session (Phase 7 visual).

## Verdict

**Backfill is correct and surfaceable.** The data the advisor + dashboard will render now exists, gated and provenance-complete. The remaining gap is purely deployment: the read endpoint isn't live yet (Phase 8). Best demo account: `0a291b09…1158ca` (52 facts — offer letter + life insurance + labs).
</content>
