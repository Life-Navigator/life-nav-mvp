# Life Navigator - Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOUD LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────┐        ┌────────────────────────────────────────┐   │
│  │       Vercel       │        │            Supabase                     │   │
│  │   (Next.js App)    │◄──────►│  (Non-Sensitive Data)                  │   │
│  │                    │        │                                         │   │
│  │  - SSR/SSG Pages   │        │  - Auth (OAuth, Magic Link)            │   │
│  │  - API Routes      │        │  - PostgreSQL (Preferences, Goals)     │   │
│  │  - Edge Functions  │        │  - Storage (Avatars, Images)           │   │
│  │  - Static Assets   │        │  - Realtime (Notifications)            │   │
│  └─────────┬──────────┘        └────────────────────────────────────────┘   │
│            │                                                                 │
└────────────┼─────────────────────────────────────────────────────────────────┘
             │
             │ HTTPS (Secure API Proxy)
             │
┌────────────┼─────────────────────────────────────────────────────────────────┐
│            ▼                   DGX SPARK (On-Prem)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │    FastAPI      │  │   PostgreSQL    │  │      Hybrid GraphRAG        │  │
│  │   Backend       │  │  (HIPAA/PCI)    │  │                             │  │
│  │                 │  │                 │  │  ┌─────────┐ ┌───────────┐  │  │
│  │  - Auth APIs    │  │  - Financial    │  │  │  Neo4j  │ │  GraphDB  │  │  │
│  │  - HIPAA Data   │  │  - Health       │  │  │(Property│ │(RDF/SPARQL│  │  │
│  │  - PCI Data     │  │  - PII          │  │  │ Graph)  │ │ Ontology) │  │  │
│  │  - AI/LLM       │  │  - Risk Data    │  │  └─────────┘ └───────────┘  │  │
│  └─────────────────┘  └─────────────────┘  │  ┌─────────┐               │  │
│                                             │  │ Qdrant  │               │  │
│  ┌─────────────────┐  ┌─────────────────┐  │  │(Vectors)│               │  │
│  │   Maverick LLM  │  │     Redis       │  │  └─────────┘               │  │
│  │   (Llama 4)     │  │    (Cache)      │  └─────────────────────────────┘  │
│  └─────────────────┘  └─────────────────┘                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Distribution

| Data Type | Location | Reason |
|-----------|----------|--------|
| Financial accounts, transactions | DGX PostgreSQL | PCI DSS compliance |
| Health records, conditions | DGX PostgreSQL | HIPAA compliance |
| SSN, DOB, legal name | DGX PostgreSQL | PII protection |
| Risk assessments | DGX PostgreSQL | Sensitive financial data |
| Investment holdings | DGX PostgreSQL | PCI compliance |
| User preferences | Supabase | Non-sensitive |
| Goal metadata (no amounts) | Supabase | Non-sensitive |
| Achievements, XP | Supabase | Non-sensitive |
| Profile images | Supabase Storage | Non-sensitive |
| App themes, settings | Supabase | Non-sensitive |

## Step 1: Create Supabase Project

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Click "New Project"
3. Select your organization
4. Configure project:
   - Name: `life-navigator-pilot`
   - Database Password: Generate a strong password
   - Region: `us-west-1` (closest to DGX)
5. Wait for project to provision (~2 minutes)

## Step 2: Configure Supabase

### Get API Keys
1. Go to Project Settings > API
2. Copy these values to your environment:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (**server/edge only, never client**)

### Run Migrations
1. Go to SQL Editor
2. Paste contents of `supabase/migrations/001_initial_schema.sql`
3. Run the query
4. Paste contents of `supabase/migrations/002_storage_buckets.sql`
5. Run the query

### Supabase-First MVP Ingestion Setup (Required)

1. Run ingestion migrations:
   - `apps/web/supabase/migrations/009_mvp_ingestion_pipeline.sql`
   - `apps/web/supabase/migrations/010_mvp_ingestion_hardening.sql`
   - `apps/web/supabase/migrations/011_mvp_integrations_auth.sql`
2. Create private storage buckets:
   - `documents` (`public = false`)
   - `insurance-cards` (`public = false`)
3. Set Edge Function secrets:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `INGESTION_WORKER_SECRET`
   - `INTERNAL_AGENT_WEBHOOK_URL`
   - `INTERNAL_AGENT_WEBHOOK_SECRET`
4. Deploy worker:
   ```bash
   supabase functions deploy process-ingestion
   ```
5. Configure cron (every 1-2 min) to POST:
   - URL: `https://<project-ref>.supabase.co/functions/v1/process-ingestion`
   - Header: `x-worker-secret: <INGESTION_WORKER_SECRET>`
   - Body: `{"limit":25,"worker_id":"cron"}`
6. Run RLS verification script:
   - `apps/web/supabase/sql/rls_self_test.sql`

### Configure Auth
1. Go to Authentication > Providers
2. Enable Email provider (enabled by default)
3. Configure Google OAuth:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create OAuth 2.0 credentials
   - Add redirect URL: `https://<project>.supabase.co/auth/v1/callback`
4. Add redirect URLs in Authentication > URL Configuration:
   - `http://localhost:3002` (development)
   - `https://your-app.vercel.app` (production)

## Step 3: Deploy to Vercel

### Option A: Vercel CLI
```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy from apps/web directory
cd apps/web
vercel
```

### Option B: GitHub Integration
1. Push code to GitHub
2. Go to [Vercel Dashboard](https://vercel.com/new)
3. Import repository
4. Configure:
   - Framework: Next.js
   - Root Directory: `apps/web`
   - Build Command: `pnpm build`

### Configure Environment Variables
In Vercel Dashboard > Settings > Environment Variables:

```env
# Supabase (public client config)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Supabase server-only (only if a server route explicitly requires admin Supabase access)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Internal webhook auth (server-only)
INTERNAL_AGENT_WEBHOOK_SECRET=your-internal-webhook-secret

# OAuth Integrations
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-app.vercel.app/api/integrations/oauth/callback/google
MICROSOFT_CLIENT_ID=...
MICROSOFT_CLIENT_SECRET=...
MICROSOFT_TENANT_ID=common
MICROSOFT_REDIRECT_URI=https://your-app.vercel.app/api/integrations/oauth/callback/microsoft
INTEGRATION_ENCRYPTION_KEY=<32+ char random secret>

# DGX Backend (requires VPN or Cloudflare Tunnel)
NEXT_PUBLIC_API_URL=https://dgx.your-domain.com
NEXT_PUBLIC_API_BASE_URL=https://dgx.your-domain.com/api/v1

# Optional agent forwarding
AGENT_API_URL=https://your-agent-service.internal
AGENT_INTERNAL_API_KEY=your-agent-internal-key
ENABLE_AGENT_FORWARDING=false

# NextAuth
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=<generate with: openssl rand -hex 32>

# App
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Plaid (Production)
PLAID_CLIENT_ID=your-production-client-id
PLAID_SECRET=your-production-secret
PLAID_ENVIRONMENT=production
```

Important:
- Never create `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
- Do not set `INGESTION_WORKER_SECRET` in Vercel for normal MVP operation.
- `SUPABASE_SERVICE_ROLE_KEY` in Vercel should be avoided unless a server-only endpoint must bypass RLS.
- Client bundles must only use public Supabase values.

OAuth routes:
- Google start: `/api/integrations/oauth/google`
- Google callback: `/api/integrations/oauth/callback/google`
- Microsoft start: `/api/integrations/oauth/microsoft`
- Microsoft callback: `/api/integrations/oauth/callback/microsoft`

## Step 4: Connect DGX to Internet

### Option A: Cloudflare Tunnel (Recommended)
```bash
# On DGX server
cloudflared tunnel create lifenavigator

# Configure tunnel
cat > ~/.cloudflared/config.yml << EOF
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json
ingress:
  - hostname: dgx.your-domain.com
    service: http://localhost:8000
  - service: http_status:404
EOF

# Run tunnel
cloudflared tunnel run lifenavigator
```

### Option B: VPN + Static IP
1. Set up WireGuard or OpenVPN on DGX
2. Configure static IP routing
3. Update Vercel environment with VPN endpoint

## Step 5: Start GraphRAG Services

```bash
# From project root
cd /path/to/life-navigator-monorepo

# Start all GraphRAG services
docker compose up -d postgres redis neo4j qdrant graphdb

# Verify all healthy
docker ps --format "table {{.Names}}\t{{.Status}}"

# Expected output:
# ln-postgres   Up X minutes (healthy)
# ln-redis      Up X minutes (healthy)
# ln-neo4j      Up X minutes (healthy)
# ln-qdrant     Up X minutes (healthy)
# ln-graphdb    Up X minutes (healthy)
```

## Step 6: Start FastAPI Backend

```bash
# From backend directory
cd backend

# Activate virtual environment
source venv/bin/activate

# Run migrations
alembic upgrade head

# Start server
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Verification Checklist

- [ ] Supabase project created and migrations run
- [ ] Vercel deployment successful
- [ ] All GraphRAG services healthy (postgres, redis, neo4j, qdrant, graphdb)
- [ ] FastAPI backend accessible
- [ ] Cloudflare Tunnel or VPN configured
- [ ] OAuth providers configured in Supabase
- [ ] Environment variables set in Vercel
- [ ] Test login flow works end-to-end
- [ ] Test pilot access control works

## Troubleshooting

### Neo4j Won't Start
- Check password doesn't contain `/` characters
- Ensure `NEO4J_ACCEPT_LICENSE_AGREEMENT=yes` for enterprise

### Supabase Auth Errors
- Check redirect URLs match exactly
- Verify anon key is for correct project
- Check CORS settings

### DGX API Unreachable
- Verify Cloudflare Tunnel is running
- Check firewall allows port 8000
- Test with curl from Vercel

## Service Ports (Local Development)

| Service | Port | URL |
|---------|------|-----|
| Next.js | 3002 | http://localhost:3002 |
| FastAPI | 8000 | http://localhost:8000 |
| PostgreSQL | 5432 | postgresql://localhost:5432 |
| Redis | 6379 | redis://localhost:6379 |
| Neo4j HTTP | 7474 | http://localhost:7474 |
| Neo4j Bolt | 7687 | bolt://localhost:7687 |
| Qdrant | 6333 | http://localhost:6333 |
| GraphDB | 7200 | http://localhost:7200 |
