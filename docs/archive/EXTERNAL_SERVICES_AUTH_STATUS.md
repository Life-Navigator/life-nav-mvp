# External Services — CLI / Auth Status

**Date:** 2026-06-02
**Session host:** `riffe007` machine, Linux arm64

The Fly deploy is blocked on a credit card; that's the immediate blocker. In parallel, the rest of the external-service auth chain needs to be wired up. This is the truth at this point in the session.

---

## TL;DR per service

| Service          | CLI exists?           | Installed?                                             | Authenticated?                      | Action you must take                                               |
| ---------------- | --------------------- | ------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------ |
| **Fly.io**       | yes (`flyctl`)        | yes (`~/.fly/bin/flyctl v0.4.57`)                      | **YES** (`techavenger83@gmail.com`) | add credit card at https://fly.io/trial                            |
| **Vercel**       | yes (`vercel`)        | yes (`v48.10.6` at `~/.local/share/pnpm/vercel`)       | NO                                  | `vercel login` (interactive picker → email/GitHub)                 |
| **Supabase**     | yes (`supabase`)      | yes (`v2.104.0` at `~/.npm-global/bin/supabase`)       | NO                                  | `supabase login` (browser)                                         |
| **GCP (gcloud)** | yes (`gcloud`)        | yes (`SDK 552.0.0` at `~/google-cloud-sdk/bin/gcloud`) | NO                                  | `gcloud auth login` (browser)                                      |
| **Qdrant Cloud** | **no management CLI** | n/a                                                    | n/a                                 | provision via https://cloud.qdrant.io → grab cluster URL + API key |
| **Neo4j Aura**   | **no management CLI** | n/a                                                    | n/a                                 | provision via https://console.neo4j.io → grab Bolt URI + password  |

---

## Service-by-service

### 1. Fly.io (`flyctl`)

State at this point in the session:

```
$ ~/.fly/bin/flyctl auth whoami
techavenger83@gmail.com
```

Authenticated. The Fly deploy is blocked NOT on auth but on the trial limit — `Trial machine stopping. To run for longer than 5m0s, add a credit card.` Add the card at https://fly.io/trial and the apps will stop being killed at 5 minutes.

### 2. Vercel

The CLI ships through pnpm. Status now:

```
$ vercel whoami
Error: No existing credentials found. Please run `vercel login`
```

Authenticate from your terminal:

```bash
vercel login
# pick "Continue with GitHub" or "Continue with Email"
# follow the browser/email flow
```

After login:

```bash
vercel whoami                                          # confirm
vercel projects ls                                      # see if life-nav-mvp project exists
```

If the Vercel project does not exist, you can link the repo from inside the web app dir:

```bash
cd apps/web
vercel link                                             # interactive — pick the right scope (your personal team)
```

Or link non-interactively once you know the project ID:

```bash
vercel link --yes --project <project-id> --scope <team>
```

### 3. Supabase

Installed via npm:

```
$ supabase --version
2.104.0
```

Authenticate:

```bash
supabase login
# opens browser at supabase.com/dashboard for token approval
```

After login the access token is stored at `~/.supabase/access-token`. Test:

```bash
supabase projects list                                  # see all your Supabase projects
```

To link this repo to a specific Supabase project:

```bash
cd /home/riffe007/Documents/projects/life-nav-mvp
supabase link --project-ref <YOUR_PROJECT_REF>
# project ref is the 20-char id in your Supabase URL: https://<ref>.supabase.co
```

Then for the migrations:

```bash
supabase db push                                        # applies migrations 001–104 to the linked project
supabase functions deploy graphrag-query                # deploys the Edge Function
supabase functions deploy graphrag-sync
supabase functions deploy process-ingestion
# email-sync and calendar-sync are optional for first cohort
```

### 4. Google Cloud SDK (`gcloud`) — for Gemini API key + Secret Manager

Installed at `~/google-cloud-sdk/bin/gcloud`. PATH persisted in `~/.bashrc`. Status:

```
$ gcloud auth list
No credentialed accounts.
```

Authenticate:

```bash
gcloud auth login
# prints a URL → open in browser → paste verification code back
```

Pick the GCP project you'll use for Gemini:

```bash
gcloud projects list                                    # find your project ID
gcloud config set project <PROJECT_ID>
```

Enable the Generative Language API (Gemini):

```bash
gcloud services enable generativelanguage.googleapis.com
```

Create an API key for Gemini:

```bash
gcloud alpha services api-keys create \
  --display-name="LifeNavigator Gemini (internal beta)" \
  --api-target=service=generativelanguage.googleapis.com
# Capture the `keyString` from the output — that's GEMINI_API_KEY.
```

(Optional, future) GCP Secret Manager for inventory:

```bash
gcloud services enable secretmanager.googleapis.com
# Then create one secret per env key for audit:
gcloud secrets create lifenav-gemini-api-key --replication-policy=automatic
echo -n "<value>" | gcloud secrets versions add lifenav-gemini-api-key --data-file=-
```

The committed apps don't read from Secret Manager today — Fly + Vercel + Supabase secret stores are the runtime sources. GCP Secret Manager is your audit ledger.

### 5. Qdrant Cloud — NO CLI

Qdrant Cloud has no install-and-login management CLI. You provision and inspect clusters in the web console.

```
1. Open https://cloud.qdrant.io
2. Sign in (or sign up).
3. Create a cluster:
   - Region: aws-us-east-1 or aws-us-west-1 (match Fly region for latency)
   - Tier: Free is fine for internal beta
4. Once running:
   - Copy the cluster URL → QDRANT_URL  (looks like https://<id>.us-east-0-1.aws.cloud.qdrant.io:6333)
   - Cluster details → API Keys → "Create API key"
     → copy → QDRANT_API_KEY
5. Create the two collections (your worker fails loud if they're missing):

   # life_navigator — per-user personal collection
   curl -X PUT "$QDRANT_URL/collections/life_navigator" \
        -H "api-key: $QDRANT_API_KEY" \
        -H 'Content-Type: application/json' \
        -d '{"vectors":{"size":768,"distance":"Cosine"}}'

   # ln_central — read-only shared collection
   curl -X PUT "$QDRANT_URL/collections/ln_central" \
        -H "api-key: $QDRANT_API_KEY" \
        -H 'Content-Type: application/json' \
        -d '{"vectors":{"size":768,"distance":"Cosine"}}'
```

768 dims match `text-embedding-004` which is the committed `GEMINI_EMBEDDING_MODEL`.

The Python `qdrant-client` library is what the api-gateway uses at runtime; it's not a management CLI.

### 6. Neo4j Aura — NO CLI

Neo4j Aura has no install-and-login management CLI. You provision the database in the web console.

```
1. Open https://console.neo4j.io
2. Sign in (Google / GitHub / email).
3. Create a database:
   - Tier: AuraDB Free is fine for internal beta
   - Region: closest to your Fly region (us-east is common)
   - Name: lifenav-personal (or similar)
4. Aura shows the credentials EXACTLY ONCE. Save them.
   - URI    : NEO4J_URI       (looks like neo4j+s://<id>.databases.neo4j.io)
   - User   : neo4j  (NEO4J_USERNAME)
   - Pass   : <generated>      (NEO4J_PASSWORD)
   - DB     : neo4j  (NEO4J_PERSONAL_DATABASE)
5. (Optional, second DB)
   Create a second database for the central knowledge graph:
   - Name: lifenav-central
   - DB   : central  (NEO4J_CENTRAL_DATABASE)
```

For ad-hoc cypher queries against the live db, install `cypher-shell` (not currently installed):

```bash
# Debian/Ubuntu:
wget -q https://debian.neo4j.com/neotechnology.gpg.key -O - | sudo apt-key add -
echo 'deb https://debian.neo4j.com stable latest' | sudo tee /etc/apt/sources.list.d/neo4j.list
sudo apt update && sudo apt install -y cypher-shell

# Then:
cypher-shell -a "$NEO4J_URI" -u "$NEO4J_USERNAME" -p "$NEO4J_PASSWORD" -d "$NEO4J_PERSONAL_DATABASE"
```

The api-gateway connects via the Neo4j Python driver — that's already in the deployed container.

After both databases exist, run the bootstrap constraints (any cypher shell, console, or `cypher-shell` works):

```cypher
CREATE CONSTRAINT user_id_required IF NOT EXISTS
  FOR (n:User) REQUIRE n.user_id IS NOT NULL;

CREATE INDEX entity_user_id IF NOT EXISTS
  FOR (n:Entity) ON (n.user_id);
```

---

## Recommended order to authenticate + provision

1. **Add the Fly credit card** — without this every Fly deploy dies at 5 min. https://fly.io/trial
2. **`gcloud auth login`** → enable Gemini API → create API key. Capture `GEMINI_API_KEY`.
3. **Provision Qdrant cluster** via https://cloud.qdrant.io. Capture `QDRANT_URL` + `QDRANT_API_KEY`. Create both collections.
4. **Provision Neo4j Aura DB(s)** via https://console.neo4j.io. Capture URI/user/pass for personal + central.
5. **`supabase login`** → `supabase projects list` → `supabase link --project-ref <ref>` → `supabase db push`. The migrations and Edge Functions need to be on the Supabase side before anything else can talk to it.
6. **`vercel login`** → `cd apps/web && vercel link` → set the Vercel env vars (the 7 listed in DEPLOYMENT_SEQUENCE.md Phase 2).
7. **Back to Fly:** stage the 15 api-gateway secrets and the 10 worker secrets (the values you collected in steps 2–4 + the Supabase project URL + keys from step 5).
8. **`fly deploy`** the gateway, then the worker.

Steps 1–6 can be done in parallel (each requires only the credentials of that service). Steps 7–8 are the consolidation point.

---

## What I cannot do from this session

- I cannot click "Add card" on the Fly page. You must.
- I cannot complete OAuth in your browser for Vercel / Supabase / gcloud — I can run the CLI to print the URL, but the browser flow has to happen on a machine you control.
- I cannot click "Create cluster" in Qdrant or "Create database" in Neo4j Aura. Both consoles are web-only.
- I CAN, once you have the credentials, run `supabase db push` / `supabase link` / migrations / connection tests / Qdrant collection-create curls from this session, because those are non-interactive once the auth token is loaded.

So the model is: you authenticate on your machine (browser flows), I do the heavy lifting once tokens or keys land.

Send me the output of `vercel whoami` / `supabase projects list` / `gcloud auth list` once you've logged in to each, and I'll keep going from there.
