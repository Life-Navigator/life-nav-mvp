# Rollback Plan — candidate `e8b0dac4`

**Status: NO AUTOMATED ROLLBACK EXISTS.** `grep -rln "rollback" .github/workflows/ scripts/` returns
nothing. Deployment is forward-only. Everything below is manual and must be rehearsed (R-7) before it
is needed.

---

## 0. Preconditions before any production change

| #   | Precondition                                | Verified by                                   |
| --- | ------------------------------------------- | --------------------------------------------- |
| 1   | Supabase backup / PITR timestamp recorded   | Management API; record in `evidence-index.md` |
| 2   | Current deployed API image + SHA recorded   | `flyctl status`, `flyctl image show`          |
| 3   | Current deployed web deployment id recorded | `vercel ls` / deployment inspect              |
| 4   | `GRAPH_GROUNDING_ENABLED=false` confirmed   | `flyctl secrets list` / config                |
| 5   | Allowlist contents recorded                 | env inspection                                |
| 6   | This document read by whoever is deploying  | —                                             |

**If precondition 2 or 3 cannot be satisfied, do not deploy.** You cannot roll back to a version you
cannot name.

> **Prompt 1A update:** preconditions 2 and 3 are now satisfiable without platform credentials —
> `GET /version` and `GET /api/version` report the running SHA on each tier. Record both before any
> change.

---

## 1. Fastest lever: flags, not deploys

**Always try this first.** Flag changes take effect without a rebuild and are the only genuinely fast
mitigation.

| Symptom                      | Lever                              | Command shape                                                          |
| ---------------------------- | ---------------------------------- | ---------------------------------------------------------------------- |
| Advisor producing bad output | `PRIVATE_BETA_BLOCK`               | `flyctl secrets set PRIVATE_BETA_BLOCK=true -a lifenavigator-core-api` |
| Graph evidence suspected     | `GRAPH_GROUNDING_ENABLED`          | already `false` — **verify, do not change**                            |
| Semantic engine suspected    | `GRAPH_RETRIEVAL_V2=false`         | reverts to the legacy flat retriever                                   |
| A single user affected       | `ops.user_feature_flag_overrides`  | per-user row                                                           |
| Whole cohort                 | `ops.cohorts` / `ops.beta_invites` | revoke invites                                                         |

Setting a Fly secret restarts the machine — expect a brief interruption, which at 5 users is
acceptable and is the cheapest correct action.

## 2. Application rollback — API (Fly)

```
flyctl releases -a lifenavigator-core-api            # identify the prior good release
flyctl releases rollback <version> -a lifenavigator-core-api
```

If `releases rollback` is unavailable, redeploy the prior image explicitly:

```
flyctl deploy --image <prior-image-ref> -a lifenavigator-core-api
```

**Record the prior image ref before deploying.** It is not recoverable afterwards if the release
history is pruned.

Repeat per app if `api-gateway` or `ingestion-worker` were part of the release.

## 3. Application rollback — web (Vercel)

Instant rollback via promotion of the previous production deployment:

```
vercel rollback <previous-deployment-url>      # or promote the prior deployment in the dashboard
```

Vercel keeps the prior build, so this is the single safest step in the whole plan and requires no
rebuild.

## 4. Database rollback — the asymmetric risk

**The database is where rollback stops being cheap.** All three migrations are additive, which is why
this section is short — but read it before assuming it is trivial.

### Preferred: do not roll back the schema

All three migrations are **backward-compatible with pre-candidate application code**:

- **M1** `advisor_turns.sources` — the app whitelist (`_ADVISOR_TURNS_COLUMNS`) deliberately excludes
  `sources`, so old and new code both work with the column present.
- **M2 / M3** — new tables in a new schema that pre-candidate code never references.

**Therefore: roll back the application and leave the schema in place.** This is the correct action in
essentially every scenario.

### If the schema must be reverted

Reverse dependency order (M3 → M2 → M1):

```sql
-- M3 first: FK depends on M2
DROP TABLE IF EXISTS feedback.advisor_report_events;

-- M2: ⚠ DESTROYS USER-SUBMITTED REPORTS. Export first if any exist.
--    SELECT * FROM feedback.advisor_response_reports;   -- capture before dropping
DROP TABLE IF EXISTS feedback.advisor_response_reports CASCADE;

-- M1: safe ONLY while "sources" is absent from _ADVISOR_TURNS_COLUMNS (current state)
ALTER TABLE analytics.advisor_turns DROP COLUMN IF EXISTS sources;
```

**Do not drop M2 once a real user report exists.** A user reporting a harmful answer, followed by us
destroying that report during a rollback, is worse than the failure that prompted the rollback.
Forward-fix instead.

### Partial application

If a migration fails midway: each file is a single DDL batch and Supabase runs migrations in a
transaction, so partial application should not occur. **Verify anyway** using the verification SQL in
`migration-review.md` before proceeding — do not assume.

## 5. Full-abort sequence (production incident)

```
1. flyctl secrets set PRIVATE_BETA_BLOCK=true -a lifenavigator-core-api   # stop user traffic first
2. Notify the named incident owner (R-4 — MUST exist before launch)
3. vercel rollback <prior-deployment>                                     # web to prior
4. flyctl releases rollback <prior-version> -a lifenavigator-core-api     # API to prior
5. Verify /readyz + all four dependencies true
6. LEAVE THE SCHEMA ALONE unless it is the proven cause
7. Capture evidence into evidence/incident-<timestamp>/ (redacted)
8. Post-incident note in evidence-index.md
```

**Target: steps 1–5 inside 15 minutes.** Untested — R-7 must rehearse at minimum step 1 and its
reversal.

## 6. Known rollback gaps

| Gap                                                 | Severity | Consequence                                                                                                                   |
| --------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **No automated rollback workflow**                  | High     | Every step above is manual, typed under pressure, by whoever is awake                                                         |
| ~~No deployed-SHA endpoint~~ **CLOSED (Prompt 1A)** | —        | `/version` + `/api/version` now prove what is running before and after a rollback                                             |
| **No staging DATA environment**                     | High     | Compute is now isolable (`deploy_candidate.sh`), but the data plane is shared, so a DB rollback still has nowhere to rehearse |
| **No branch protection**                            | High     | A force-push to `main` could make the "prior good commit" unreachable                                                         |
| **Rollback never rehearsed**                        | High     | R-7 addresses only the flag lever, not the deploy lever                                                                       |
| **`deploy-fly.yml` is path-filtered**               | Medium   | A rollback commit touching only one app redeploys only that app — partial-state risk if the release spanned several           |

**Recommendation:** add a `workflow_dispatch` rollback workflow taking a target SHA, and a `/version`
endpoint, to this candidate or immediately after. Both are small and both are load-bearing for every
future release.
