# Fly API Gateway Deployment — Fix Report

**Date:** 2026-06-02
**Repository:** `life-nav-mvp`
**Target Fly app:** `lifenavigator-api-gateway`
**Working directory for Fly commands:** `apps/api-gateway/`
**Fly config:** `apps/api-gateway/fly.toml` (already committed)
**Dockerfile:** `apps/api-gateway/Dockerfile` (already committed)

---

## Executive answer

| Question                                   | Answer                                                                                                                                                                                                                                                                         |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Local git state safe to deploy?            | **YES**                                                                                                                                                                                                                                                                        |
| Current branch                             | `mvp`                                                                                                                                                                                                                                                                          |
| Current commit (= `origin/mvp` tip)        | `df73bda08c8957deec5719302673bb5a8936278e` (`df73bda`)                                                                                                                                                                                                                         |
| Is the commit `≥ df73bda`?                 | **YES** — it IS `df73bda`                                                                                                                                                                                                                                                      |
| Fly org slug                               | **UNKNOWN from this machine** — `fly` CLI not installed here; you must run `fly orgs list` from a machine with authenticated flyctl                                                                                                                                            |
| App `lifenavigator-api-gateway` exists?    | **UNKNOWN from this machine** — must run `fly apps list`                                                                                                                                                                                                                       |
| App creation result                        | **NOT RUN YET** — pending org slug                                                                                                                                                                                                                                             |
| Is the app pinned to old commit `42eee30`? | The Fly _app_ is not pinned to a commit — Fly apps are commit-agnostic. The _deploy trigger_ is what selected `42eee30`. See "GitHub integration risk" below.                                                                                                                  |
| Deploy method recommended                  | **Manual `fly deploy --remote-only` from local `apps/api-gateway/`**, NOT the Fly + GitHub integration that produced the failed log                                                                                                                                            |
| GitHub integration safe to use?            | **NOT until you reconfigure it to track branch `mvp` (HEAD) and not a specific SHA.** The failed deploy log used the May commit `42eee30`, which proves the integration was either targeting a stale SHA or running against an old triggered build before your `df73bda` push. |
| Exact next command                         | See "Next command to run" at the bottom of this report                                                                                                                                                                                                                         |

---

## Task 1 — Local git state ✓

Verified directly:

```
current branch        : mvp
current commit        : df73bda08c8957deec5719302673bb5a8936278e
origin/mvp commit     : df73bda08c8957deec5719302673bb5a8936278e
local working tree    : clean (0 uncommitted entries)
```

Local and remote are aligned. No staging step required.

## Task 2 — Correct deployable commit ✓

```
$ git log -1 --format='%h %s' df73bda
df73bda Sprints O / O.0 / O.0.1 / O.0.2 / N.2 / N.3 / Q / R / S / T — bundle for internal beta
```

`df73bda` is the Sprint T bundle. It includes:

- The fix for the malformed import in `arcana/lead-package/route.ts` (without this the build fails)
- `createGovernedHandler`, the verifier, and the migrated chat route
- Migrations 099–104
- All Sprint O / O.0.2 / Q / R / S libraries the factory depends on

The earlier failed deploy used `42eee30` (Sprint M, May 2026) — a 7-month-old snapshot that lacks every change above. That commit must not be deployed.

**Note for the api-gateway specifically:** the api-gateway is FastAPI (Python). Sprint T mostly modified the web frontend. The api-gateway's commit-to-commit diff between `42eee30` and `df73bda` is smaller — but it still includes Sprints N.2 / N.3 / O / R changes that touch the FastAPI side. Deploy from `df73bda` regardless.

## Task 3 — Fly org slug ⏸ requires user

`fly` CLI is **not installed** in this environment. Run from your laptop or a machine with authenticated flyctl:

```bash
fly orgs list
```

You will see something like:

```
  Name                Slug                Type
  Timothy Riffe       personal            PERSONAL
  Life Navigator      life-navigator      ORGANIZATION
```

Use whichever slug owns the deployment. From the prior failed log header (`(Request ID: 01KT4W9ZV9TK4JFCRGGT8AEMBB-iad)` came back with `app not found` against `lifenavigator-api-gateway`), the org you're authenticated as does not currently own an app by that name.

> **Fill in:** ORG SLUG = `__________________`

## Task 4 — Does the app exist? ⏸ requires user

```bash
fly apps list
```

Expected: if `lifenavigator-api-gateway` is NOT in the list, this is the source of "app not found" and must be created. If it IS in the list, you're authenticated against a different org than the one that owns it — switch with `fly orgs switch` or pass `--org` explicitly.

> **Fill in:** App exists? = `YES / NO`

## Task 5 — Create the app (conditional)

If Task 4 showed the app missing:

```bash
fly apps create lifenavigator-api-gateway --org <ORG_SLUG>
```

If it already exists, skip this step.

> **Fill in:** Creation result = `created / already-existed / error: ____`

## Task 6 — Verify ⏸ requires user

```bash
fly apps list                                                  # confirm name present
fly config show -a lifenavigator-api-gateway                    # confirm fly.toml is parseable
fly status -a lifenavigator-api-gateway                          # expect: "No machines" until first deploy
```

> **Fill in:** Output of `fly status` = `__________________`

## Task 7 — Is the Fly app pinned to old commit `42eee30`?

**A Fly app cannot be pinned to a git commit.** What the failed log showed was a Fly + GitHub _trigger_ selecting commit `42eee30` to deploy. Two possible causes:

1. The Fly GitHub integration is configured to deploy from a specific branch / tag / SHA that points at `42eee30`.
2. The integration was triggered before your `df73bda` push went up, queued behind another deploy, and only ran after.

Either way the _app config_ itself carries no commit reference. Fix the trigger, not the app.

## Task 8 — GitHub integration risk

The failed deploy log shows Fly running `flyctl deploy --build-only --push -a lifenavigator-api-gateway --image-label deployment-... --config fly.toml` on a deployer machine, after the step "Create Fly.io git branch with new files". That branch was named after the _commit subject of `42eee30`_. That is the Fly + GitHub integration behavior — it spins up a deployer per pushed commit.

**Risks if you leave it on:**

1. It will re-trigger on every `mvp` push including stale ones if queued.
2. It hides which SHA is actually shipping behind the auto-generated branch names.
3. You cannot easily roll a manual fix forward if the integration is racing you.

**Recommendation:** turn it off for `lifenavigator-api-gateway` until the internal-beta cohort is established. Then re-enable with explicit `mvp`-branch tracking. To disable:

> Fly dashboard → app `lifenavigator-api-gateway` → **Settings** → **GitHub Integration** → Disconnect (or pause).

## Task 9 — Manual deploy (recommended)

Run from your local checkout, **after** Task 5 confirms the app exists:

```bash
cd apps/api-gateway
pwd                                                # must show .../apps/api-gateway
ls fly.toml Dockerfile                             # must both exist
fly deploy -a lifenavigator-api-gateway --remote-only
```

`--remote-only` runs the Docker build on Fly's remote builder, so you do not need Docker locally.

## Task 10 — Confirm `df73bda` is the shipping SHA

The manual `fly deploy` ships the contents of your current working tree, NOT a git SHA. To make the audit trail honest, confirm before deploying:

```bash
git rev-parse HEAD                                 # expect df73bda08c8957deec5719302673bb5a8936278e
git status --short                                 # expect empty
```

Both must pass before you press deploy. The deploy log won't print a SHA directly, but you can record it post-deploy:

```bash
fly releases -a lifenavigator-api-gateway          # latest release version
fly image show -a lifenavigator-api-gateway         # image digest
# Then in your runbook, log: "release vN = git df73bda"
```

## Task 11 — Do NOT run `fly launch`

`fly launch` would overwrite `apps/api-gateway/fly.toml`, regenerate the Dockerfile, and re-prompt for an app name. The committed config is the source of truth. Use only `fly apps create` (one-time) and `fly deploy` (every time after).

## Task 12 — Secrets check before deploy

Even with the app created, deploy will succeed but the running container will fail readiness probes if any required secret is missing. Verify with:

```bash
fly secrets list -a lifenavigator-api-gateway
```

Expected 15 secret names (no values shown):

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_JWT_SECRET
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
QDRANT_URL
QDRANT_API_KEY
QDRANT_PERSONAL_COLLECTION
QDRANT_CENTRAL_COLLECTION
NEO4J_URI
NEO4J_USERNAME
NEO4J_PASSWORD
NEO4J_PERSONAL_DATABASE
NEO4J_CENTRAL_DATABASE
ALLOWED_ORIGINS
```

If the list is empty (it will be, on a brand-new app), stage them in a single command before `fly deploy`:

```bash
fly secrets set -a lifenavigator-api-gateway --stage \
  SUPABASE_URL="https://<project>.supabase.co" \
  SUPABASE_ANON_KEY="eyJ..." \
  SUPABASE_JWT_SECRET="<jwt-secret>" \
  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  GEMINI_API_KEY="AIza..." \
  QDRANT_URL="https://<cluster>.qdrant.io:6333" \
  QDRANT_API_KEY="<key>" \
  QDRANT_PERSONAL_COLLECTION="life_navigator" \
  QDRANT_CENTRAL_COLLECTION="ln_central" \
  NEO4J_URI="neo4j+s://<id>.databases.neo4j.io" \
  NEO4J_USERNAME="neo4j" \
  NEO4J_PASSWORD="<neo4j-password>" \
  NEO4J_PERSONAL_DATABASE="neo4j" \
  NEO4J_CENTRAL_DATABASE="central" \
  ALLOWED_ORIGINS="https://lifenavigator.app,https://*.vercel.app"
```

`--stage` defers the restart until the first deploy, so you don't waste a machine cycle.

> **The list above is the exact `fly secrets set` command you asked for at the end of Task 12.** Each placeholder must be replaced with the real value. Do not commit those values anywhere.

---

## Field-summary (fill in once you've run the Fly steps)

```
ORG SLUG                       : ___________________
APP EXISTS BEFORE FIX          : YES / NO
APP CREATION RESULT            : created / already-existed / error
BRANCH                         : mvp
COMMIT (HEAD)                  : df73bda08c8957deec5719302673bb5a8936278e
DEPLOY METHOD                  : manual `fly deploy --remote-only` from apps/api-gateway/
GITHUB INTEGRATION SAFE?       : NO until reconfigured / disconnected
MANUAL DEPLOY RECOMMENDED?     : YES
SECRETS STAGED?                : YES / NO
DEPLOY LOG SHA RECORDED?       : df73bda (record manually after `fly releases`)
```

---

## Next command to run

```bash
fly orgs list
```

That single command unblocks everything downstream. With the org slug in hand, the rest of the runbook executes in this order:

```bash
fly apps list                                              # confirm app missing
fly apps create lifenavigator-api-gateway --org <ORG>      # one-time
fly secrets set -a lifenavigator-api-gateway --stage \     # the 15 KEY=VALUE pairs above
   SUPABASE_URL=... SUPABASE_ANON_KEY=... ...
cd apps/api-gateway
fly deploy -a lifenavigator-api-gateway --remote-only
```

When `fly deploy` finishes:

```bash
curl -fsS https://lifenavigator-api-gateway.fly.dev/healthz
# expect: {"status":"ok"}
fly releases -a lifenavigator-api-gateway | head -5
# expect: latest release is just-created; matches your manual deploy time
```

If `/healthz` returns 200, the gateway is up on `df73bda` (regardless of whether the dashboard's GitHub integration is misconfigured). That is the safe path forward.
