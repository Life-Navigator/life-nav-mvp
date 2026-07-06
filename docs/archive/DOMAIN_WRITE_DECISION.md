# DOMAIN_WRITE_DECISION.md — Phase 4

## Question

For the pilot, should approved Advisor actions write **only** `life.facts`, or **also** write domain tables so readiness/recommendations move?

## Decision: **Option A — keep `life.facts`-only for the pilot.** (with a fast-follow for one action)

### Why (grounded in the gap audit)

The premise behind Option B/C — "the domain endpoints already exist, just call them after apply" — does **not hold** (see DOMAIN_WRITE_GAP_AUDIT.md):

- The two actions with ready endpoints (**Home Purchase**, **Health Goal**) write to tables the readiness engine **doesn't read** (`finance.assets`/`asset_loans` and `health.health_goals`), so they would **still not move readiness**. Wiring them = effort with **zero honest payoff**.
- The actions that _would_ move readiness (**New Child**→`dependents`, **Promotion**→`career_profiles`/`compensation_records`, **Degree**→`education_records`) have **no write endpoint** — each is net-new backend.
- Forcing Home Purchase to move net worth means writing `financial_accounts` or summing `finance.assets` into `summary()` — directly re-opening the **net-worth double-count bug** the code was patched to prevent (`finance.py:151-153`). High correctness risk on the single number investors scrutinize most.

### Criteria scorecard

| Criterion            | Option A (facts-only)                        | Option B (1–2 actions)                                    | Option C (all 5)                        |
| -------------------- | -------------------------------------------- | --------------------------------------------------------- | --------------------------------------- |
| Investor demo impact | Med (real life-model growth, no number jump) | Med-High **if** the action truly moves a number           | High in theory                          |
| User trust           | **High** (nothing fabricated)                | High **only if** delta is real, not faked                 | High only if all real                   |
| Engineering risk     | **Low** (shipped)                            | Med (1 new endpoint)                                      | High (3 new endpoints + scorer changes) |
| Correctness risk     | **None**                                     | Low for New Child; **High** for Home Purchase/Health Goal | High                                    |
| Schema confidence    | **High**                                     | High for `dependents`; lower for compensation_records     | Mixed                                   |
| RLS safety           | **Proven** (ingestion tenant-enforced)       | Good (mirror `user_id`-from-JWT inserts)                  | Good but 3× surface                     |
| Time to build        | **0**                                        | ~0.5–1 day (New Child)                                    | ~3–5 days                               |
| Rollback complexity  | n/a                                          | Low (feature-flag one endpoint)                           | Higher                                  |

### What ships for the pilot (Option A)

- All 5 actions write `life.facts` (confirmed, provenance-stamped, advisor-citable).
- The Impact Summary Card shows **real facts + real impact _areas_** — no fabricated readiness/recommendation delta. This is honest and already demo-tested.
- Advisor cites the new facts on the next turn; dashboard "Recently learned" strip shows them on next read.

### Recommended fast-follow (post-decision, optional pre-pilot if time allows)

**Single, low-risk upgrade: New Child → `family.dependents`.**

- It is the **only** action whose readiness-read table is also a trivial owner-scoped insert.
- Build `POST /v1/family/dependent` (mirror `finance.create_goal` pattern: `user_id` from JWT), call it from `advisor_actions.apply()` **in addition to** the `life.facts` write, behind a flag.
- Then `family` readiness moves for real → the Impact Card can show a **true** before/after for that one action, and you can demo it honestly.
- Est. 0.5–1 day, isolated, flag-gated, trivial rollback.

**Explicitly NOT recommended pre-pilot:** Home Purchase and Health Goal domain writes — they either don't move the metric or require touching the net-worth math / fabricating logs. Promotion and Degree are deferrable (new endpoints, more schema surface).

## TL;DR

Ship Option A. The demo is honest and compelling on **life-model growth**, not on a faked number. If you want one _real_ numeric delta for the demo, do exactly one thing: New Child → `family.dependents` behind a flag. Everything else is post-pilot.
