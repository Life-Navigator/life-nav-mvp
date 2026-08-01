# Candidate Deployment Plan

**Closes the Prompt 0 blocker:** production deployed only on push to `main`, so the only way to see a
candidate running was to merge it first — which inverts the beta gate. R-1 must pass against the
candidate **before** it reaches `main`, and it cannot pass against something never deployed.

---

## Two mechanisms, same guarantees

| Mechanism                      | File                                     | Use                                             |
| ------------------------------ | ---------------------------------------- | ----------------------------------------------- |
| Manual GitHub Actions workflow | `.github/workflows/deploy-candidate.yml` | Auditable, reviewable, `workflow_dispatch` only |
| Local release script           | `scripts/beta/deploy_candidate.sh`       | Operator-driven, dry-runnable, no CI dependency |

Both deploy an **explicit SHA** to a **separate, disposable target**. Neither can reach production.

## Targets

| Tier     | Candidate target                               | Production target (untouched)   |
| -------- | ---------------------------------------------- | ------------------------------- |
| core-api | Fly app **`lifenavigator-core-api-candidate`** | `lifenavigator-core-api`        |
| web      | Vercel **preview** deployment                  | `lifenavigator.tech` production |

Distinguishable by name and by URL — a Prompt 1A stop condition requires exactly that.

## How it fails closed — verified, not asserted

| Refusal                        | Result                                                       |
| ------------------------------ | ------------------------------------------------------------ |
| `--env` omitted                | **exit 1** — "There is no default target"                    |
| `--env production`             | **exit 1** — "REFUSING: 'production' is a production target" |
| `--env prod` / `live`          | **exit 1**                                                   |
| short SHA (`e8b0dac4`)         | **exit 1** — "not stable identifiers"                        |
| SHA not in the repository      | **exit 1**                                                   |
| neither `--api` nor `--web`    | **exit 1**                                                   |
| missing credentials (real run) | **exit 1**, printing **variable names only**                 |
| missing credentials (dry run)  | proceeds — a dry run must be CI-runnable without secrets     |

All eight verified by execution on 2026-07-31.

**`--prod` appears nowhere in either file.** The web deployment is a preview by construction, not by
configuration — there is no flag that promotes it.

## Invariants enforced at deploy time

| Invariant                            | Enforcement                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `GRAPH_GROUNDING_ENABLED=false`      | Passed explicitly, then **re-read from the running app** via `flyctl ssh printenv` and aborted on mismatch |
| Public registration disabled         | `PRIVATE_BETA_ENABLED=true`                                                                                |
| Access limited to synthetic accounts | `PRIVATE_BETA_ALLOWED_EMAILS`                                                                              |
| SHA is provable                      | `LN_COMMIT_SHA` build-arg → `/version`                                                                     |
| No secrets in output                 | Tokens read from env, never echoed; dry-run prints the literal `$VERCEL_TOKEN`, unexpanded                 |
| No credentials in generated files    | Only deployment ids/URLs are recorded                                                                      |

The flag is verified from the deployed process, not from our own intent — asserting what we passed
would prove nothing about what is running.

## Procedure

```bash
SHA=$(git rev-parse HEAD)

# 1. dry run — no credentials required
scripts/beta/deploy_candidate.sh --env staging --sha "$SHA" --api --web --dry-run

# 2. deploy (FLY_API_TOKEN, VERCEL_TOKEN in the environment; never pasted)
scripts/beta/deploy_candidate.sh --env staging --sha "$SHA" --api --web

# 3. prove BOTH tiers report the candidate
CANDIDATE_SHA="$SHA" \
API_BASE_URL=https://lifenavigator-core-api-candidate.fly.dev \
WEB_BASE_URL=<preview-url> \
python3 scripts/beta/harness/verify_deployed_sha.py     # exit 0 required before any gate

# 4. gates: R-1 first (fatal), then R-2, R-6, R-7

# 5. teardown
scripts/beta/deploy_candidate.sh --env staging --sha "$SHA" --destroy
```

**Step 3 gates step 4.** A gate run against an unproven SHA proves nothing, which is the finding that
produced this whole workstream.

## What this plan does NOT solve

**The data plane is shared.** Compute is isolated; Supabase, Neo4j, Qdrant and Gemini are production.
See `staging-data-strategy.md` for why Option 1 (separate Supabase project) was rejected as
unexecutable in the timeline and Option 2 (schema separation) was rejected as _false assurance_.

Consequence: **the candidate deployment cannot be used to rehearse migrations**, because applying
them to "staging" is applying them to production. That authorisation belongs to a later prompt.

## Teardown and cost

`--destroy` removes the temporary Fly app. Vercel previews expire on their own. The candidate app is
a single small machine; running it for the exercise window is negligible. **Destroy it on
2026-08-02 alongside credential revocation** — see `credential-revocation-checklist.md`.
