# Life Navigator MVP Launch Plan

> **Timeline**: Saturday setup + Sunday testing = Monday launch
> **Stack**: Next.js (Vercel) + Supabase + Neo4j Aura + Qdrant Cloud + Gemini (Vertex AI)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Service Provisioning](#2-service-provisioning)
3. [Complete Secrets Reference](#3-complete-secrets-reference)
4. [Database Setup (Supabase)](#4-database-setup-supabase)
5. [Neo4j Aura Setup](#5-neo4j-aura-setup)
6. [Qdrant Cloud Setup](#6-qdrant-cloud-setup)
7. [Gemini + Vertex AI: How It Powers GraphRAG](#7-gemini--vertex-ai-how-it-powers-graphrag)
8. [Edge Functions Deployment](#8-edge-functions-deployment)
9. [GraphRAG Pipeline Deployment](#9-graphrag-pipeline-deployment)
10. [Vercel Web App Deployment](#10-vercel-web-app-deployment)
11. [End-to-End Data Flow](#11-end-to-end-data-flow)
12. [Integration Testing Checklist](#12-integration-testing-checklist)
13. [Production Readiness Checklist](#13-production-readiness-checklist)
14. [Vertex AI Migration Path](#14-vertex-ai-migration-path)

---

## 1. Architecture Overview

```
                         +-----------------+
                         |   Mobile App    |
                         |   (iOS/Swift)   |
                         +--------+--------+
                                  |
                                  v
+------------------+     +--------+--------+     +---------------------+
|  Next.js Web App | --> | Supabase        | <-- | Supabase Edge Fns   |
|  (Vercel)        |     | - Auth (JWT)    |     | - graphrag-query    |
|  Thin UI layer   |     | - PostgreSQL    |     | - graphrag-sync     |
|                  |     | - RLS policies  |     | - plaid-*           |
+------------------+     | - Storage       |     | - process-ingestion |
                         | - Realtime      |     +----------+----------+
                         +--------+--------+                |
                                  |                         |
                    +-------------+-------------+           |
                    |                           |           |
                    v                           v           v
           +-------+-------+          +--------+--------+  |
           | CDC Triggers  |          | Python GraphRAG |<-+
           | (16 entity    |          | Pipeline        |
           |  types)       |          | (Vercel)        |
           +-------+-------+          +---+----+----+---+
                   |                      |    |    |
                   v                      v    v    v
          +--------+--------+    +--------+ +--+--+ +--------+
          | graphrag.       |    | Gemini | |Neo4j| | Qdrant |
          | sync_queue      |    | API    | |Aura | | Cloud  |
          | (pending jobs)  |    +--------+ +-----+ +--------+
          +-----------------+    Embed +    Graph    Vector
                                 Generate   Store    Search
                                 NL->Cypher (768 dim)
```

**Key principle**: The Next.js app is a thin UI layer. ALL sensitive operations (Plaid, GraphRAG, token encryption) go through Supabase Edge Functions. Secrets never touch the browser.

---

## 2. Service Provisioning

Create accounts and get API keys for each service:

### 2.1 Neo4j Aura (Knowledge Graph)

| Item                 | Detail                                             |
| -------------------- | -------------------------------------------------- |
| **URL**              | [console.neo4j.io](https://console.neo4j.io)       |
| **Plan**             | Free tier or Pro                                   |
| **What to create**   | New instance (any region close to Vercel/Supabase) |
| **Secrets produced** | `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD`    |

After creation:

1. Copy the Bolt URI (e.g., `neo4j+s://xxxxx.databases.neo4j.io`)
2. Copy the HTTP URL (e.g., `https://xxxxx.databases.neo4j.io`) — used by Edge Functions
3. Save username (usually `neo4j`) and generated password
4. **IMPORTANT**: Save these immediately — Neo4j only shows the password once

### 2.2 Qdrant Cloud (Vector Search)

| Item                 | Detail                                     |
| -------------------- | ------------------------------------------ |
| **URL**              | [cloud.qdrant.io](https://cloud.qdrant.io) |
| **Plan**             | Free tier (1GB)                            |
| **What to create**   | New cluster                                |
| **Secrets produced** | `QDRANT_URL`, `QDRANT_API_KEY`             |

After creation:

1. Copy the cluster URL (e.g., `https://xxxxx-xxxxx.aws.cloud.qdrant.io:6333`)
2. Create an API key in the dashboard
3. The collection (`life_navigator`) will be created by the init script (Step 6)

### 2.3 Google AI Studio / Vertex AI (Gemini)

| Item                 | Detail                                                         |
| -------------------- | -------------------------------------------------------------- |
| **URL**              | [aistudio.google.com](https://aistudio.google.com) for API key |
| **Plan**             | Free tier (15 RPM / 1M tokens/day)                             |
| **What to create**   | API key                                                        |
| **Secrets produced** | `GEMINI_API_KEY`                                               |

**For MVP**: Use Google AI Studio API key (simplest).
**For Production**: Migrate to Vertex AI (see [Section 14](#14-vertex-ai-migration-path)).

Models used:

- **Embeddings**: `text-embedding-004` (768 dimensions)
- **Generation**: `gemini-2.0-flash` (fast, cheap, good quality)
- **NL-to-Cypher**: `gemini-2.0-flash` (structured output)

### 2.4 Google Cloud Console (OAuth)

| Item                 | Detail                                                       |
| -------------------- | ------------------------------------------------------------ |
| **URL**              | [console.cloud.google.com](https://console.cloud.google.com) |
| **What to create**   | OAuth 2.0 Client ID (Web application)                        |
| **Secrets produced** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`                   |

**Authorized redirect URIs to add**:

```
https://<your-supabase-project>.supabase.co/auth/v1/callback
https://<your-vercel-domain>/api/integrations/oauth/callback/google
http://localhost:3000/api/integrations/oauth/callback/google  (dev only)
```

**OAuth Consent Screen**:

- For beta: Set to "Testing" mode and add beta user emails
- For launch: Submit for Google verification (takes 1-4 weeks)

### 2.5 Plaid (Bank Account Linking)

| Item                 | Detail                                             |
| -------------------- | -------------------------------------------------- |
| **URL**              | [dashboard.plaid.com](https://dashboard.plaid.com) |
| **Plan**             | Sandbox (free, unlimited testing)                  |
| **What to create**   | New application                                    |
| **Secrets produced** | `PLAID_CLIENT_ID`, `PLAID_SECRET`                  |

**Environment progression**:

- `sandbox` — fake bank data, use for testing
- `development` — real banks, 100 items free (apply after beta)
- `production` — unlimited, paid per connection

**Sandbox test credentials**: `user_good` / `pass_good`

---

## 3. Complete Secrets Reference

### 3.1 Where Each Secret Lives

```
Secrets are stored in THREE places, never the browser:

┌─────────────────────────┬──────────┬──────────┬──────────────────┐
│ Secret                  │ Supabase │ Vercel   │ Pipeline (Vercel)│
│                         │ Secrets  │ Env Vars │ Env Vars         │
├─────────────────────────┼──────────┼──────────┼──────────────────┤
│ SUPABASE_URL            │          │ PUBLIC   │ YES              │
│ SUPABASE_ANON_KEY       │          │ PUBLIC   │                  │
│ SUPABASE_SERVICE_ROLE   │ AUTO     │ YES      │ YES              │
│ NEXT_PUBLIC_APP_URL     │          │ PUBLIC   │                  │
├─────────────────────────┼──────────┼──────────┼──────────────────┤
│ GEMINI_API_KEY          │ YES      │          │ YES              │
│ NEO4J_QUERY_API_URL     │ YES      │          │                  │
│ NEO4J_URI               │          │          │ YES              │
│ NEO4J_USERNAME          │ YES      │          │ YES              │
│ NEO4J_PASSWORD          │ YES      │          │ YES              │
│ QDRANT_URL              │ YES      │          │ YES              │
│ QDRANT_API_KEY          │ YES      │          │ YES              │
│ QDRANT_COLLECTION       │ YES      │          │                  │
├─────────────────────────┼──────────┼──────────┼──────────────────┤
│ GRAPHRAG_WORKER_SECRET  │ YES      │          │ YES              │
│ INTEGRATION_ENCRYPT_KEY │ YES      │          │                  │
├─────────────────────────┼──────────┼──────────┼──────────────────┤
│ GOOGLE_CLIENT_ID        │ YES      │          │                  │
│ GOOGLE_CLIENT_SECRET    │ YES      │          │                  │
│ PLAID_CLIENT_ID         │ YES      │          │                  │
│ PLAID_SECRET            │ YES      │          │                  │
│ PLAID_ENV               │ YES      │          │                  │
└─────────────────────────┴──────────┴──────────┴──────────────────┘

PUBLIC = NEXT_PUBLIC_ prefix, safe for browser
YES = Secret, server-side only
AUTO = Supabase injects its own service role key to Edge Functions
```

### 3.2 Supabase Secrets (set via CLI)

```bash
# Generate random secrets first
WORKER_SECRET=$(openssl rand -hex 32)
ENCRYPT_KEY=$(openssl rand -hex 32)

supabase secrets set \
  GEMINI_API_KEY="<from-google-ai-studio>" \
  NEO4J_QUERY_API_URL="<https://xxxxx.databases.neo4j.io>" \
  NEO4J_USERNAME="neo4j" \
  NEO4J_PASSWORD="<from-neo4j-aura>" \
  QDRANT_URL="<https://xxxxx.cloud.qdrant.io:6333>" \
  QDRANT_API_KEY="<from-qdrant-dashboard>" \
  QDRANT_COLLECTION="life_navigator" \
  GRAPHRAG_WORKER_SECRET="${WORKER_SECRET}" \
  INTEGRATION_ENCRYPTION_KEY="${ENCRYPT_KEY}" \
  GOOGLE_CLIENT_ID="<from-google-cloud-console>" \
  GOOGLE_CLIENT_SECRET="<from-google-cloud-console>" \
  PLAID_CLIENT_ID="<from-plaid-dashboard>" \
  PLAID_SECRET="<from-plaid-dashboard>" \
  PLAID_ENV="sandbox" \
  --project-ref <your-supabase-project-ref>
```

### 3.3 Vercel Environment Variables (Web App)

Set in Vercel Dashboard → Settings → Environment Variables (all environments):

| Variable                        | Value                       | Public? |
| ------------------------------- | --------------------------- | ------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | `https://xxxxx.supabase.co` | Yes     |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...`                    | Yes     |
| `SUPABASE_SERVICE_ROLE_KEY`     | `eyJ...`                    | **No**  |
| `NEXT_PUBLIC_APP_URL`           | `https://your-domain.com`   | Yes     |

That's it. The web app only needs Supabase credentials. Everything else stays server-side.

### 3.4 GraphRAG Pipeline Environment Variables (Separate Vercel Project)

Set via `vercel env add` or Vercel Dashboard:

| Variable                    | Vercel Secret Name           | Value                                |
| --------------------------- | ---------------------------- | ------------------------------------ |
| `SUPABASE_URL`              | `@supabase-url`              | `https://xxxxx.supabase.co`          |
| `SUPABASE_SERVICE_ROLE_KEY` | `@supabase-service-role-key` | `eyJ...`                             |
| `GEMINI_API_KEY`            | `@gemini-api-key`            | `AIza...`                            |
| `NEO4J_URI`                 | `@neo4j-uri`                 | `neo4j+s://xxxxx.databases.neo4j.io` |
| `NEO4J_USERNAME`            | `@neo4j-username`            | `neo4j`                              |
| `NEO4J_PASSWORD`            | `@neo4j-password`            | (from Neo4j Aura)                    |
| `QDRANT_URL`                | `@qdrant-url`                | `https://xxxxx.cloud.qdrant.io:6333` |
| `QDRANT_API_KEY`            | `@qdrant-api-key`            | (from Qdrant Cloud)                  |
| `GRAPHRAG_WORKER_SECRET`    | `@graphrag-worker-secret`    | (same as Supabase)                   |

---

## 4. Database Setup (Supabase)

### 4.1 Run Migrations

Run these **in order** via Supabase SQL Editor (Dashboard → SQL Editor → New query):

| #   | File                                     | What it creates                                    |
| --- | ---------------------------------------- | -------------------------------------------------- |
| 1   | `001_initial_schema.sql`                 | Profiles, preferences, goals, `core` schema        |
| 2   | `002_storage_buckets.sql`                | Storage buckets (avatars, documents, etc.)         |
| 3   | `003_cleanup_and_reset.sql`              | Drops legacy Prisma tables                         |
| 4   | `004_enhanced_schema.sql`                | Activity logs, habits, completions                 |
| 5   | `005_scenario_lab_schema.sql`            | Scenario lab (what-if analysis)                    |
| 6   | `006_scenario_lab_rls.sql`               | RLS policies for scenario lab                      |
| 7   | `007_scenario_lab_storage.sql`           | Storage buckets for scenario docs/reports          |
| 8   | `008_add_win_probability_fields.sql`     | Win probability on scenario results                |
| 9   | `009_mvp_ingestion_pipeline.sql`         | Document upload + ingestion jobs + encryption RPCs |
| 10  | `010_mvp_ingestion_hardening.sql`        | Ingestion retries, validation, RLS                 |
| 11  | `011_mvp_integrations_auth.sql`          | OAuth token storage + encryption                   |
| 12  | `020_auth_extended.sql`                  | Extended auth profile fields                       |
| 13  | `030_goals_risk.sql`                     | Goal benefits, reminders, risk assessments         |
| 14  | `031_finance_domain.sql`                 | Financial accounts, transactions, holdings         |
| 15  | `032_career_domain.sql`                  | Career profiles, applications, resumes             |
| 16  | `033_education_domain.sql`               | Education records, courses, study logs             |
| 17  | `034_family_domain.sql`                  | Family members, pets                               |
| 18  | `035_calendar_email.sql`                 | Calendar events, email connections                 |
| 19  | `036_social_domain.sql`                  | Social connections                                 |
| 20  | `037_documents_features.sql`             | Document metadata                                  |
| 21  | `038_health_locked.sql`                  | Health records (HIPAA-aware)                       |
| 22  | `039_compliance.sql`                     | Audit logging, compliance                          |
| 23  | `040_integration_providers_extended.sql` | Integration provider config                        |
| 24  | `050_graphrag.sql`                       | GraphRAG sync queue, query cache, RPCs             |
| 25  | `051_token_retrieval.sql`                | Token decryption RPCs for Edge Functions           |
| 26  | `055_graphrag_expanded_triggers.sql`     | CDC triggers for all 16 entity types               |
| 27  | `060_security_hardening.sql`             | RLS hardening, additional policies                 |

**Alternative** (if Supabase CLI is linked): `supabase db push --project-ref <ref>`

### 4.2 Configure Auth Providers

In Supabase Dashboard → Authentication → Providers:

1. **Email**: Enable (default)
2. **Google**: Enable → paste `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

In Authentication → URL Configuration:

- **Site URL**: `https://your-production-domain.com`
- **Redirect URLs**: `https://your-domain.com/**`, `https://*.vercel.app/**`

### 4.3 Expose Schemas for Edge Functions

In Supabase Dashboard → Settings → API → Exposed schemas, add:

- `core`
- `finance`
- `health_meta`
- `graphrag`

(These are needed for Edge Functions to call RPCs in those schemas)

---

## 5. Neo4j Aura Setup

### 5.1 Initialize Schema

After provisioning Neo4j Aura, run the schema initialization script.

**Via Neo4j Browser** (recommended):

1. Open your Neo4j Aura instance in the Browser
2. Copy-paste and run `scripts/setup/init-neo4j.cypher`

This creates:

- **17 uniqueness constraints** (one per entity type + Person)
- **25 indexes** for tenant isolation and common filters

### 5.2 Entity Types in the Graph

```
(:Person {tenant_id, user_id})
   |
   +--[:HAS_GOAL]-->(:Goal)
   +--[:HAS_ACCOUNT]-->(:FinancialAccount)
   +--[:HAS_FINANCIAL_GOAL]-->(:FinancialGoal)
   +--[:HAS_HOLDING]-->(:InvestmentHolding)
   +--[:HAS_TRANSACTION]-->(:Transaction)
   +--[:HAS_RISK_ASSESSMENT]-->(:RiskAssessment)
   +--[:HAS_CAREER_PROFILE]-->(:CareerProfile)
   +--[:HAS_APPLICATION]-->(:JobApplication)
   +--[:HAS_CONNECTION]-->(:CareerConnection)
   +--[:HAS_RESUME]-->(:Resume)
   +--[:HAS_EDUCATION]-->(:EducationRecord)
   +--[:HAS_COURSE]-->(:Course)
   +--[:HAS_FAMILY_MEMBER]-->(:FamilyMember)
   +--[:HAS_HEALTH_RECORD]-->(:HealthRecord)
   +--[:HAS_HEALTH_METRIC]-->(:HealthMetric)
   +--[:HAS_DOCUMENT]-->(:Document)

Cross-entity relationships:
   (:FinancialGoal)-[:FOR_GOAL]->(:Goal)
   (:FinancialGoal)-[:RELATED_TO_ACCOUNT]->(:FinancialAccount)
   (:Transaction)-[:IN_ACCOUNT]->(:FinancialAccount)
   (:InvestmentHolding)-[:IN_ACCOUNT]->(:FinancialAccount)
   (:Goal)-[:DEPENDS_ON]->(:Goal)
```

---

## 6. Qdrant Cloud Setup

### 6.1 Initialize Collection

After provisioning Qdrant Cloud, run the init script:

```bash
QDRANT_URL="https://xxxxx.cloud.qdrant.io:6333" \
QDRANT_API_KEY="your-api-key" \
  bash scripts/setup/init-qdrant.sh
```

This creates:

- **Collection**: `life_navigator` (768 dimensions, Cosine distance)
- **Payload indexes**: `tenant_id`, `entity_type`, `domain`, `category`, `status`, `institution`

### 6.2 Vector Schema

Each point in Qdrant stores:

```json
{
  "id": "<entity_id UUID>",
  "vector": [0.123, -0.456, ...],   // 768 floats from Gemini text-embedding-004
  "payload": {
    "tenant_id": "<user_id>",
    "entity_type": "goal",
    "domain": "goals",
    "text": "Goal: Save $50k for house down payment...",
    "title": "Save for House",
    "category": "finance",
    "status": "active"
  }
}
```

All queries are **tenant-filtered** — a user can only search their own data.

---

## 7. Gemini + Vertex AI: How It Powers GraphRAG

### 7.1 What Gemini Does in the System

Gemini serves **three distinct roles** in the GraphRAG pipeline:

```
User Question: "Should I increase my 401k contribution?"
                                |
                    +-----------+-----------+
                    |                       |
              [ROLE 1: EMBED]         [ROLE 2: NL→CYPHER]
                    |                       |
                    v                       v
         Gemini text-embedding-004   Gemini 2.0 Flash
         "Should I increase..."  →   "Given this graph schema,
         → [0.12, -0.34, ...]       generate a Cypher query..."
                    |                       |
                    v                       v
              Qdrant Search            Neo4j Query
              (vector similarity)      (structured traversal)
                    |                       |
                    +----------+------------+
                               |
                    Reciprocal Rank Fusion
                    (merge both result sets)
                               |
                               v
                      [ROLE 3: GENERATE]
                               |
                      Gemini 2.0 Flash
                      System: "You are Life Navigator..."
                      Context: [user's goals, accounts,
                                risk profile, holdings]
                      Question: "Should I increase my 401k?"
                               |
                               v
                      "Based on your current savings rate
                       of $500/mo and your goal to retire
                       at 60, increasing your 401k to 15%
                       would save you $12,400 in taxes..."
```

### 7.2 Role 1: Embeddings (text-embedding-004)

**When**: Every time a user creates/updates a goal, account, transaction, etc.

**How it works**:

1. CDC trigger fires on the source table
2. Job enters `graphrag.sync_queue`
3. Pipeline claims the job
4. `embedding_builder.py` formats the entity into readable text
5. Calls Gemini: `POST /v1beta/models/text-embedding-004:embedContent`
6. Returns 768-dimensional vector
7. Vector is stored in Qdrant with tenant metadata

**API endpoint** (current — AI Studio):

```
https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent
Header: x-goog-api-key: GEMINI_API_KEY
```

**Vertex AI equivalent** (future migration):

```
https://us-central1-aiplatform.googleapis.com/v1/projects/PROJECT/locations/REGION/publishers/google/models/text-embedding-004:predict
Header: Authorization: Bearer $(gcloud auth print-access-token)
```

### 7.3 Role 2: Natural Language to Cypher (gemini-2.0-flash)

**When**: Every user query that needs graph search.

**How it works**:

1. User asks: "What are my highest-risk investments?"
2. Gemini receives the graph schema + the question
3. Gemini outputs a Cypher query:
   ```json
   {
     "cypher": "MATCH (p:Person {tenant_id: $tenant_id})-[:HAS_HOLDING]->(h:InvestmentHolding) RETURN h.name, h.risk_level ORDER BY h.risk_level DESC LIMIT 5",
     "params": {}
   }
   ```
4. Pipeline injects `$tenant_id` and executes against Neo4j
5. Results are returned as graph search results

**System prompt includes the full graph schema** so Gemini knows what nodes/relationships exist.

### 7.4 Role 3: Response Generation (gemini-2.0-flash)

**When**: After hybrid search completes, to generate the final answer.

**How it works**:

1. Top 15 results from RRF are formatted as context
2. User's risk profile is fetched from Supabase
3. Previous conversation messages (up to 6) are included
4. Gemini generates a personalized response using all context
5. Supports streaming (SSE) for real-time typing effect

**System prompt**:

```
You are Life Navigator, a personalized AI advisor helping users
manage goals, finances, career, and personal development.

You have access to the user's ACTUAL data retrieved from their
knowledge graph. Use it to give specific, personalized, actionable
advice.

Guidelines:
- Reference the user's specific goals, accounts, and data
- Consider the user's risk tolerance when advising on finances
- Be encouraging but realistic
- Provide concrete next steps
- If data is missing, acknowledge it honestly
- Never fabricate data about the user
```

### 7.5 Current API Setup (AI Studio Key)

The current implementation uses the **Gemini REST API** with an API key:

```python
# Python pipeline (apps/graphrag-pipeline/lib/gemini_client.py)
EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
GENERATE_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

headers = {
    "Content-Type": "application/json",
    "x-goog-api-key": Config.GEMINI_API_KEY,  # AI Studio API key
}
```

```typescript
// Edge Function (supabase/functions/graphrag-query/index.ts)
const GEMINI_EMBED_URL = 'https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent';
const GEMINI_GENERATE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': apiKey,  // Same AI Studio key
}
```

Both the Python pipeline and the Edge Function inline fallback call Gemini the same way. This is intentional — the Edge Function can serve queries even if the Python pipeline is down.

---

## 8. Edge Functions Deployment

### 8.1 Functions to Deploy

| Function             | Auth                 | Purpose                                |
| -------------------- | -------------------- | -------------------------------------- |
| `graphrag-query`     | JWT or worker-secret | Hybrid search + Gemini response        |
| `graphrag-sync`      | worker-secret        | Fallback sync worker                   |
| `process-ingestion`  | worker-secret        | Document ingestion                     |
| `plaid-link-token`   | JWT                  | Create Plaid Link token                |
| `plaid-exchange`     | JWT                  | Exchange public token, encrypt + store |
| `plaid-accounts`     | JWT                  | Fetch linked bank accounts             |
| `plaid-transactions` | JWT                  | Fetch transactions                     |
| `plaid-disconnect`   | JWT                  | Remove linked bank                     |
| `email-sync`         | worker-secret        | Email sync (deferred)                  |
| `calendar-sync`      | worker-secret        | Calendar sync (deferred)               |

### 8.2 Deploy Commands

```bash
PROJECT_REF="your-supabase-project-ref"

# Core functions
supabase functions deploy graphrag-query --project-ref $PROJECT_REF
supabase functions deploy graphrag-sync --project-ref $PROJECT_REF
supabase functions deploy process-ingestion --project-ref $PROJECT_REF

# Plaid functions
supabase functions deploy plaid-link-token --project-ref $PROJECT_REF
supabase functions deploy plaid-exchange --project-ref $PROJECT_REF
supabase functions deploy plaid-accounts --project-ref $PROJECT_REF
supabase functions deploy plaid-transactions --project-ref $PROJECT_REF
supabase functions deploy plaid-disconnect --project-ref $PROJECT_REF

# Deferred (deploy but not activated for MVP)
supabase functions deploy email-sync --project-ref $PROJECT_REF
supabase functions deploy calendar-sync --project-ref $PROJECT_REF
```

### 8.3 Secrets Each Function Needs

```
graphrag-query:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)
  GEMINI_API_KEY, NEO4J_QUERY_API_URL, NEO4J_USERNAME, NEO4J_PASSWORD
  QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION
  GRAPHRAG_WORKER_SECRET, GRAPHRAG_PIPELINE_URL (optional)

graphrag-sync:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  GEMINI_API_KEY, NEO4J_QUERY_API_URL, NEO4J_USERNAME, NEO4J_PASSWORD
  QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION
  GRAPHRAG_WORKER_SECRET

plaid-*:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV

process-ingestion:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  INGESTION_WORKER_SECRET (optional)
```

All secrets are set once via `supabase secrets set` — Edge Functions read them via `Deno.env.get()`.

---

## 9. GraphRAG Pipeline Deployment

The Python pipeline runs as a **separate Vercel project** (`apps/graphrag-pipeline`).

### 9.1 Create Vercel Project

```bash
cd apps/graphrag-pipeline
vercel link  # or create via Vercel dashboard
```

### 9.2 Set Environment Variables

```bash
vercel env add SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add GEMINI_API_KEY production
vercel env add NEO4J_URI production
vercel env add NEO4J_USERNAME production
vercel env add NEO4J_PASSWORD production
vercel env add QDRANT_URL production
vercel env add QDRANT_API_KEY production
vercel env add GRAPHRAG_WORKER_SECRET production
```

### 9.3 Deploy and Verify

```bash
vercel --prod
```

**Verify health**:

```bash
# Quick check (env vars only)
curl https://graphrag-pipeline.vercel.app/api/health?quick=1

# Deep check (pings all services)
curl https://graphrag-pipeline.vercel.app/api/health
```

Expected deep health response:

```json
{
  "status": "healthy",
  "service": "graphrag-pipeline",
  "version": "1.0.0",
  "services": {
    "supabase": { "status": "ok" },
    "qdrant": { "status": "ok" },
    "neo4j": { "status": "ok" },
    "gemini": { "status": "ok" }
  }
}
```

### 9.4 Load Ontology (one-time)

```bash
curl -X POST https://graphrag-pipeline.vercel.app/api/ontology \
  -H "x-worker-secret: <GRAPHRAG_WORKER_SECRET>"
```

This loads TTL ontology files into Neo4j via n10s (Neosemantics).

### 9.5 Pipeline API Endpoints

| Endpoint        | Method | Auth          | Purpose                       |
| --------------- | ------ | ------------- | ----------------------------- |
| `/api/health`   | GET    | None          | Health check                  |
| `/api/sync`     | POST   | worker-secret | Process pending sync jobs     |
| `/api/query`    | POST   | worker-secret | Hybrid search + Gemini answer |
| `/api/reindex`  | POST   | worker-secret | Bulk re-index a table         |
| `/api/ontology` | POST   | worker-secret | Load ontology into Neo4j      |

---

## 10. Vercel Web App Deployment

### 10.1 Environment Variables

Only 4 env vars needed (set in Vercel Dashboard):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 10.2 Deploy

Push to `main` branch or trigger manual deploy in Vercel Dashboard.

### 10.3 Feature Flags

Optional feature flags (set as Vercel env vars):

```
NEXT_PUBLIC_ENABLE_HEALTH_CONNECT=true
NEXT_PUBLIC_ENABLE_FINANCE=true
NEXT_PUBLIC_ENABLE_GOOGLE_INTEGRATIONS=true
NEXT_PUBLIC_ENABLE_MICROSOFT_INTEGRATIONS=false  (deferred)
```

---

## 11. End-to-End Data Flow

### 11.1 User Creates a Goal (Sync Flow)

```
1. User clicks "Add Goal: Save $50k for house"
   └─> Next.js form → supabase.from('goals').insert({...})

2. Supabase PostgreSQL INSERT triggers CDC
   └─> Trigger function: graphrag.enqueue_sync(
         user_id, 'goal', goal_id, 'public.goals', 'upsert', {title, category, ...}
       )
   └─> Row added to graphrag.sync_queue (status='pending')

3. Cron job / manual trigger calls Python pipeline
   └─> POST /api/sync (x-worker-secret header)
   └─> Pipeline calls graphrag.claim_sync_jobs(50) — claims up to 50 pending jobs

4. For each job, pipeline runs entity_mapper.sync_entity():
   a. Build text: "Goal: Save $50k for house. Category: Finance. Status: Active..."
   b. Embed text → Gemini text-embedding-004 → 768-dim vector
   c. Upsert Neo4j:
      - MERGE (p:Person {tenant_id}) → ensure person node
      - MERGE (g:Goal {entity_id, tenant_id}) SET g += {title, category, ...}
      - MERGE (p)-[:HAS_GOAL]->(g)
   d. Upsert Qdrant:
      - PUT point {id: goal_id, vector: [0.12, ...], payload: {tenant_id, entity_type, ...}}
   e. Mark job complete → graphrag.complete_sync_job(job_id)

5. Goal is now searchable in both Neo4j (graph traversal) and Qdrant (vector similarity)
```

### 11.2 User Asks a Question (Query Flow)

```
1. User types: "How am I doing on my savings goals?"
   └─> Frontend: supabase.functions.invoke('graphrag-query', {
         body: { query: "How am I doing...", stream: true }
       })

2. Edge Function (graphrag-query):
   a. Authenticate via JWT (extract user_id from token)
   b. Check query cache (graphrag.query_cache) — if hit, return cached
   c. Try Python pipeline proxy:
      └─> POST /api/query → x-worker-secret auth
      └─> If 200: stream response back to user
      └─> If fails: fall through to inline logic

3. Python Pipeline (or inline fallback):
   a. Embed query → Gemini → 768-dim vector
   b. PARALLEL:
      - Vector search: Qdrant top-10 results (tenant-filtered, score > 0.3)
      - Graph search: Gemini NL→Cypher → Neo4j execute (tenant-filtered)
   c. Reciprocal Rank Fusion: merge both rankings
      RRF_score = 1 / (60 + rank + 1)
   d. Build context: top 15 results formatted as text
   e. Fetch risk profile from Supabase for personalization
   f. Build messages: system prompt + context + previous conversation + question
   g. Generate response: Gemini 2.0 Flash (streaming SSE)

4. Response streams back to user:
   data: {"text": "Based on your savings goal of $50k"}
   data: {"text": " and your current balance of $12,300"}
   data: {"text": " in your Chase Savings account..."}
   data: [DONE]

5. Cache response (fire-and-forget, 1-hour TTL)
```

### 11.3 Plaid Bank Linking Flow

```
1. User clicks "Link Bank Account"
   └─> Frontend: supabase.functions.invoke('plaid-link-token')
   └─> Edge Function creates Plaid Link token
   └─> Returns token to frontend

2. Plaid Link UI opens (Plaid's hosted UI)
   └─> User selects bank, enters credentials
   └─> Plaid returns public_token to frontend

3. Frontend sends public_token to Edge Function
   └─> supabase.functions.invoke('plaid-exchange', { body: { public_token } })

4. Edge Function (plaid-exchange):
   a. Exchange public_token → access_token via Plaid API
   b. Encrypt access_token: core.encrypt_text(access_token, encryption_key)
   c. Store in finance.plaid_items (encrypted)
   d. Fetch accounts from Plaid → insert into finance.financial_accounts
   e. CDC triggers fire → goals enqueued for GraphRAG sync
   f. Return sanitized account list (no tokens)

5. User sees linked accounts in dashboard
```

---

## 12. Integration Testing Checklist

### Day 2 Morning

#### Auth Testing

- [ ] Sign up with email → verify email confirmation
- [ ] Sign in with Google OAuth → verify redirect and session
- [ ] Visit protected routes → verify middleware redirects to login
- [ ] Complete onboarding flow → verify data persists in Supabase
- [ ] Sign out → verify session cleared

#### Plaid Testing (Sandbox)

- [ ] Click "Link Bank Account" → Plaid Link UI opens
- [ ] Use sandbox credentials: `user_good` / `pass_good`
- [ ] Select any sandbox bank → Link completes
- [ ] Verify account appears in finance dashboard
- [ ] Verify transactions appear
- [ ] Disconnect account → verify cleanup

#### GraphRAG Pipeline Testing

- [ ] Create a goal → check `graphrag.sync_queue` has pending job
- [ ] Trigger sync: `POST /api/sync` with worker-secret header
- [ ] Verify sync completes (job status = 'completed')
- [ ] Check Neo4j Browser → goal node exists with Person relationship
- [ ] Check Qdrant dashboard → vector point exists for the goal
- [ ] Ask a question about the goal → verify AI response references it
- [ ] Ask a follow-up question → verify conversation context works
- [ ] Verify streaming works (SSE response)

#### Health Check

- [ ] `GET /api/health` returns all services "ok"
- [ ] All Edge Functions respond (test via curl or dashboard)

---

## 13. Production Readiness Checklist

- [ ] All Supabase secrets set (`supabase secrets list` shows all keys)
- [ ] All Vercel env vars set (production environment)
- [ ] Supabase Auth providers configured with production redirect URIs
- [ ] Google OAuth consent screen: add beta testers (Testing mode) or submit for verification
- [ ] Plaid in `sandbox` mode (upgrade to `development` when approved)
- [ ] Neo4j Aura instance running, schema initialized
- [ ] Qdrant Cloud cluster running, collection initialized
- [ ] GraphRAG pipeline health check returns 200 (all services green)
- [ ] Branch protection active on `main`
- [ ] CI pipeline passing (lint, type-check, build, tests)
- [ ] Vercel deployment successful (no build errors)
- [ ] Supabase daily backups enabled (Pro plan)
- [ ] Logs dashboards accessible (Vercel + Supabase)

---

## 14. Vertex AI Migration Path

### Why Migrate from AI Studio to Vertex AI?

| Factor          | AI Studio (Current) | Vertex AI (Future)                   |
| --------------- | ------------------- | ------------------------------------ |
| **Auth**        | API key (simple)    | Service Account / OAuth (enterprise) |
| **Rate limits** | 15 RPM free tier    | Custom quotas, autoscaling           |
| **SLA**         | None                | 99.9% uptime SLA                     |
| **Compliance**  | Consumer            | SOC2, HIPAA, ISO 27001               |
| **Pricing**     | Pay-per-token       | Same + committed use discounts       |
| **VPC**         | Public only         | VPC Service Controls                 |
| **Region**      | Auto                | Choose region (data residency)       |

**Recommendation**: Use AI Studio API key for MVP. Migrate to Vertex AI when you need enterprise SLA, higher rate limits, or compliance certifications.

### Migration Steps (When Ready)

#### Step 1: Enable Vertex AI API

```bash
gcloud services enable aiplatform.googleapis.com --project=YOUR_PROJECT
```

#### Step 2: Create Service Account

```bash
gcloud iam service-accounts create life-navigator-vertex \
  --display-name="Life Navigator Vertex AI" \
  --project=YOUR_PROJECT

gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member="serviceAccount:life-navigator-vertex@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud iam service-accounts keys create vertex-sa-key.json \
  --iam-account=life-navigator-vertex@YOUR_PROJECT.iam.gserviceaccount.com
```

#### Step 3: Update Python Pipeline

Change `gemini_client.py` from:

```python
# AI Studio (current)
EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent"
headers = {"x-goog-api-key": Config.GEMINI_API_KEY}
```

To:

```python
# Vertex AI (future)
PROJECT = os.environ.get("GCP_PROJECT_ID")
REGION = os.environ.get("GCP_REGION", "us-central1")

EMBED_URL = f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{REGION}/publishers/google/models/text-embedding-004:predict"
GENERATE_URL = f"https://{REGION}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{REGION}/publishers/google/models/gemini-2.0-flash:generateContent"

# Use google-auth library for automatic token refresh
from google.auth import default as google_auth_default
from google.auth.transport.requests import Request as GoogleAuthRequest

credentials, project = google_auth_default()
credentials.refresh(GoogleAuthRequest())

headers = {
    "Authorization": f"Bearer {credentials.token}",
    "Content-Type": "application/json",
}
```

**Request body format changes**:

Embeddings:

```python
# AI Studio
{"model": "models/text-embedding-004", "content": {"parts": [{"text": text}]}}

# Vertex AI
{"instances": [{"content": text}]}

# Response changes too:
# AI Studio: data["embedding"]["values"]
# Vertex AI: data["predictions"][0]["embeddings"]["values"]
```

Generation:

```python
# AI Studio — same format works with Vertex AI generateContent endpoint
# Just change the URL and auth header (API key → Bearer token)
```

#### Step 4: Update Edge Function

Change `graphrag-query/index.ts` from:

```typescript
headers: { 'x-goog-api-key': apiKey }
```

To:

```typescript
// Vertex AI requires OAuth2 access token
// Option A: Use google-auth-library in Deno
// Option B: Proxy through Python pipeline (recommended — pipeline already has auth)
```

**Recommended approach**: When migrating to Vertex AI, route ALL Gemini calls through the Python pipeline (remove the inline fallback in the Edge Function). The Python pipeline handles Vertex AI auth natively, and you get a single place to manage credentials.

#### Step 5: Update Secrets

Replace `GEMINI_API_KEY` with:

```bash
# Supabase secrets
supabase secrets set \
  GCP_PROJECT_ID="your-project-id" \
  GCP_REGION="us-central1" \
  GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account",...}'

# Pipeline env vars
vercel env add GCP_PROJECT_ID production
vercel env add GCP_REGION production
vercel env add GOOGLE_APPLICATION_CREDENTIALS_JSON production
```

#### Step 6: Update requirements.txt

```
google-auth>=2.0.0          # Add: OAuth2 token management
google-cloud-aiplatform>=1.0 # Add: Vertex AI SDK (optional)
```

### Timeline

- **MVP (now)**: AI Studio API key — works immediately, no GCP project setup needed
- **Post-launch**: Migrate to Vertex AI when rate limits or SLA become a concern
- **The migration is ~2 hours of work** — URL changes + auth header swap + request format adjustment

---

## Deferred (Not MVP)

| Feature                            | Why Deferred                         | When to Add              |
| ---------------------------------- | ------------------------------------ | ------------------------ |
| Microsoft OAuth (Outlook/Calendar) | No `MICROSOFT_CLIENT_ID` provisioned | After beta feedback      |
| Stripe billing                     | Free for beta users                  | When ready for paid tier |
| Custom domain                      | Using `*.vercel.app`                 | Before public launch     |
| E2E test suite                     | Manual testing for beta              | Before scaling           |
| Vertex AI migration                | AI Studio works for MVP scale        | When hitting rate limits |
| LinkedIn integration               | OAuth approval needed                | After beta               |
| Health Connect (wearables)         | Complex setup                        | After core is stable     |

---

## Quick Reference: Day-of Execution Order

```
SATURDAY (Setup)
  1. [ ] Provision services (Neo4j, Qdrant, AI Studio, Google OAuth, Plaid)
  2. [ ] Run all 27 Supabase migrations in order
  3. [ ] Configure Supabase Auth (Google provider, redirect URLs)
  4. [ ] Expose schemas (core, finance, health_meta, graphrag)
  5. [ ] Set Supabase secrets (supabase secrets set ...)
  6. [ ] Set Vercel env vars (4 variables)
  7. [ ] Initialize Neo4j schema (run init-neo4j.cypher)
  8. [ ] Initialize Qdrant collection (run init-qdrant.sh)
  9. [ ] Deploy all 10 Edge Functions
  10. [ ] Deploy GraphRAG pipeline to separate Vercel project
  11. [ ] Verify health check (all services green)
  12. [ ] Load ontology (POST /api/ontology)
  13. [ ] Redeploy web app

SUNDAY (Testing)
  14. [ ] Test auth flow (email signup, Google OAuth, onboarding)
  15. [ ] Test Plaid (sandbox link, accounts, transactions, disconnect)
  16. [ ] Test GraphRAG (create goal → sync → query → AI response)
  17. [ ] Fix issues found in testing
  18. [ ] Production readiness checklist
  19. [ ] Add beta user emails to Google OAuth test users

MONDAY (Launch)
  20. [ ] Share production URL with beta users
  21. [ ] Monitor logs (Vercel + Supabase dashboards)
```
