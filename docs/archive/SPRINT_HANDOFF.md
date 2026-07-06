# SPRINT HANDOFF — Working App Full Path (finish tomorrow)

**As of:** 2026-06-06 (late). **Branch:** `main` @ `0eca0e6` (pushed). **Verdict right now:** `READY_WITH_P0_FIXES` — blocked only on graph-store creds + the live smoke.

## Morning runbook (do this first)

```bash
# 1. Fill the TWO missing cred sets in ~/.config/lifenav-sprint.env:
#       QDRANT_URL, QDRANT_API_KEY      (from Fly worker secrets / Qdrant console)
#       NEO4J_PASSWORD                  (Aura instance 4f61c985)
#    Everything else in that file is already set and working.

# 2. Run the resume script (idempotent; re-runnable):
bash resume_sprint.sh
```

`resume_sprint.sh` re-verifies all the done work, then runs the remaining
graph checks + the `:Unknown` relabel automatically once the creds are present,
and prints a PASS/FAIL/PEND summary + a verdict candidate.

## What is DONE and verified (live prod)

| #   | Item                                                 | Evidence                                                                                                                                                             |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Commits pushed to `origin/main`                      | `…→0eca0e6`                                                                                                                                                          |
| 2   | **Gemini key restaged + worker redeployed**          | new key digest `1533956b…` (was broken `6b4d7e1d…`); worker on new image; embeds 200, no 401                                                                         |
| 3   | Migrations **111 + 112** applied                     | chat schema/tables/indexes/views/RLS/grants; goals+risk triggers; backfill (0 rows)                                                                                  |
| 3b  | **SECURITY: cross-user RLS leak closed** (113 + 114) | 43 user-scoped public views had no `security_invoker` → any user could read everyone's budgets/feedback/analytics/etc. Fixed + verified: non-owner=0, owner sees own |
| 4   | Failed jobs reset + reprocessed                      | 826 reset                                                                                                                                                            |
| 5a  | Queue drained                                        | **completed=1028, failed=0, pending=0**                                                                                                                              |
| 7   | Edge fn `graphrag-query` deployed                    | empty-CENTRAL_CONTEXT strip live                                                                                                                                     |
| 8a  | Chat persistence RLS                                 | non-owner=0 / owner≥1 (rollback-tested)                                                                                                                              |
| —   | `ARCHITECTURE_BOUNDARIES.md`                         | committed                                                                                                                                                            |

## What REMAINS (all in resume_sprint.sh)

| #     | Item                                                                                             | Needs                                                                    |
| ----- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| 5b/12 | Qdrant `life_navigator ≥ 1000` points                                                            | `QDRANT_URL` + `QDRANT_API_KEY`                                          |
| 6/12  | Neo4j `:TransactionSummary ≥ 700`; relabel `:Unknown`→`:TransactionSummary` (was 233)            | `NEO4J_PASSWORD`                                                         |
| 9     | Live 12-step smoke (chat answers net worth + categories from real data; persists across refresh) | a signed-in test user — path (a) programmatic or (b) browser, see script |
| 10    | Author 4 final reports + verdict                                                                 | after the above pass                                                     |

## Key facts / gotchas discovered

- **Gemini model migration was already done.** Worker `config.rs` _default_ is the retired `text-embedding-004`, but `fly.toml [env]` sets `GEMINI_EMBEDDING_MODEL=gemini-embedding-001` (3072-dim). Worker + Edge query-embedder both use `gemini-embedding-001` with no `outputDimensionality` → 3072-dim, and the `life_navigator` collection matched (canary upserts succeeded). The old failures were pure **401 auth** on the dead key, not model 404.
- **The 50 `60e90d28` Neo4j DNS failures were a transient rolling-deploy artifact** (the briefly-stale stopped machine `48e4644…`), NOT a routing bug. `sync_queue` has no `access_scope` column; routing is single-host. Re-reset → all 50 succeeded against `4f61c985`. If `failed` is >5 again in the morning, check the error sample the script prints.
- **`GEMINI_API_KEY` must NEVER be on Vercel** (it isn't). LLM calls are Fly-backend + Edge only — see `ARCHITECTURE_BOUNDARIES.md`.
- **DB access** is via the Vercel→Supabase integration `POSTGRES_URL` (already captured as `PROD_PG_DIRECT` in the env file). Migrations were applied by **direct psql**, not `supabase db push --include-all`, to avoid replaying the unapplied 105–110 drift.
- **Migration drift to flag (out of scope):** local migrations **105–110 are NOT applied to prod** (e.g. `public.persona_event` absent). 111–114 depend on none of them. Decide later whether to apply or retire.
- **20 "review" views** (RLS, no `user_id` — tenant/global config) were intentionally NOT touched by 114; classify before any further security_invoker changes.

## Verdict rule (do not violate)

Do **not** stamp `WORKING_APP_READY_FOR_20_USER_BETA` until: Qdrant ≥1000, Neo4j `:TransactionSummary` ≥700, `:Unknown`=0, AND the live smoke (chat answers real data + persists across refresh) passes. Otherwise stay `READY_WITH_P0_FIXES`.

## Do NOT (this sprint)

Build Health/Career/Education/Family · expose hidden sidebar items · add marketing pages · UI polish. Next-domain order (after beta is live): **Health & Wellness → Career → Education → Family.**
