# Goal Deduplication Policy

**Date:** 2026-06-17 · Implementation: `app/services/canonical_goals.py`.

## Source priority (deterministic; lower = more authoritative)

| Rank | Source                                                                | When                                            |
| ---- | --------------------------------------------------------------------- | ----------------------------------------------- |
| 1    | `life.life_objectives` confirmed                                      | `confirmed=true` and `origin != persona_bridge` |
| 2    | `life.goals` confirmed                                                | `status='confirmed'`                            |
| 3    | `public.goals` user / `life.goals` open / `candidate_goals` confirmed | user-created (non-persona)                      |
| 4    | `life.candidate_goals` active / objective candidate                   | discovery candidate                             |
| 5    | persona-seeded / inferred                                             | `origin=persona_bridge` or persona public goal  |

Rules: **unconfirmed persona/candidate goals never override a confirmed user goal**; a candidate never
appears beside its confirmed version (they merge).

## Merge vs cluster

- **MERGE** (one canonical goal): entries with the **same normalized title** (lowercased, punctuation
  stripped, stopwords removed). The top-priority member wins title/status/confirmation; `progress` is
  attached from any `public.goals` member; all `source_ids` retained; `is_duplicate_merge=true`.
- **CLUSTER** (group, do NOT merge): related-but-distinct goals (e.g. "Buy a house" + "Save for a down
  payment") get the same `cluster` key but remain separate goals. Conservative keyword families:
  home / debt / education / wedding / family / fitness / career / retirement.

## Do not over-dedupe

"Buy a house", "Save for a down payment", "Home purchase" are **related, not identical** — they cluster,
they don't collapse. Only exact normalized-title matches merge. When uncertain, the system groups rather
than deletes. **No goal is ever deleted** — deduplication is a read-time view, not a mutation.

## Tested

`test_confirmed_beats_candidate_and_no_duplicate`, `test_public_goal_progress_merges_into_confirmed_goal_no_dup`,
`test_persona_goal_never_overrides_user_goal`, `test_related_goals_cluster_without_merging`.
