# 🚀 Complete Production Deployment Guide - Go Live Tomorrow

**Target Launch:** January 20, 2026
**Estimated Time:** 2-3 hours
**Services:** GCP, Vercel, Supabase, Stripe, GitHub

---

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Supabase Database Setup](#2-supabase-database-setup)
3. [Google Cloud Platform Setup](#3-google-cloud-platform-setup)
4. [Stripe Configuration](#4-stripe-configuration)
5. [GitHub Secrets Configuration](#5-github-secrets-configuration)
6. [Vercel Frontend Deployment](#6-vercel-frontend-deployment)
7. [Database Migration](#7-database-migration)
8. [Backend Deployment to Cloud Run](#8-backend-deployment-to-cloud-run)
9. [Connect ln-core Multi-Agent System](#9-connect-ln-core-multi-agent-system)
10. [Final Testing & Verification](#10-final-testing--verification)
11. [Go-Live Checklist](#11-go-live-checklist)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Pre-Deployment Checklist

### Required Accounts (Create These First)

- [ ] **Supabase Account** - https://supabase.com/dashboard/sign-up
- [ ] **Google Cloud Account** - https://console.cloud.google.com
- [ ] **Vercel Account** - https://vercel.com/signup
- [ ] **Stripe Account** - https://dashboard.stripe.com/register
- [ ] **GitHub Access** - Admin access to life-navigator-monorepo

### Required Tools Installed

```bash
# Install required CLI tools
pnpm install -g vercel
# Or: npm install -g vercel

# Google Cloud SDK
# Download from: https://cloud.google.com/sdk/docs/install

# Stripe CLI (optional, for webhook testing)
# Download from: https://stripe.com/docs/stripe-cli
```

### Domain Setup (Optional but Recommended)

If you have a custom domain:
- [ ] Domain purchased (e.g., lifenavigator.app)
- [ ] DNS access ready
- [ ] SSL will be auto-configured by Vercel

---

## 2. Supabase Database Setup

### 2.1 Create Supabase Project

1. **Go to:** https://supabase.com/dashboard
2. **Click:** "New Project"
3. **Enter:**
   - **Name:** `life-navigator-production`
   - **Database Password:** Generate strong password (save to password manager)
   - **Region:** Choose closest to your users (e.g., `us-west-1`)
4. **Wait:** ~2 minutes for project creation

### 2.2 Get Database Connection Strings

1. **Go to:** Project Settings → Database
2. **Copy BOTH connection strings:**

   **A. Connection Pooling (Transaction Mode)** - Use for Prisma
   ```
   postgresql://postgres.xxxxx:password@aws-0-us-west-1.pooler.supabase.com:6543/postgres
   ```
   - This is your `DATABASE_URL`
   - Note: Port is `6543`

   **B. Direct Connection**
   ```
   postgresql://postgres.xxxxx:password@aws-0-us-west-1.pooler.supabase.com:5432/postgres
   ```
   - This is your `DIRECT_URL`
   - Note: Port is `5432`

3. **Save both to:** `.env.production` file (create this locally, DON'T commit):

```bash
# Create local env file for reference
cat > .env.production <<EOF
# Supabase Database
DATABASE_URL="postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
DIRECT_URL="postgresql://postgres.xxxxx:[YOUR-PASSWORD]@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
EOF
```

### 2.3 Configure Database Settings

1. **Go to:** Project Settings → Database → Connection Pooling
2. **Set Pool Mode:** `Transaction` (required for Prisma)
3. **Set Pool Size:** `15` (default is fine)

### 2.4 Enable Required Extensions

1. **Go to:** Database → Extensions
2. **Enable:**
   - `uuid-ossp` (for UUID generation)
   - `pg_trgm` (for full-text search)

---

## 3. Google Cloud Platform Setup

### 3.1 Create GCP Project

1. **Go to:** https://console.cloud.google.com
2. **Create New Project:**
   - **Name:** `life-navigator-production`
   - **Project ID:** Will be auto-generated (note this down)
3. **Enable Billing:** Link a billing account

### 3.2 Enable Required APIs

Run these commands (or use Cloud Console):

```bash
# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable required APIs
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  containerregistry.googleapis.com \
  secretmanager.googleapis.com \
  aiplatform.googleapis.com \
  cloudresourcemanager.googleapis.com
```

**Or via Cloud Console:**
1. Go to: APIs & Services → Library
2. Enable:
   - Cloud Run API
   - Cloud Build API
   - Container Registry API
   - Secret Manager API
   - Vertex AI API

### 3.3 Create Service Account for Backend

```bash
# Create service account
gcloud iam service-accounts create life-navigator-backend \
  --display-name="Life Navigator Backend Service"

# Get service account email
SA_EMAIL=$(gcloud iam service-accounts list \
  --filter="displayName:Life Navigator Backend Service" \
  --format="value(email)")

echo "Service Account: $SA_EMAIL"

# Grant required permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor"

# Create and download key (save securely!)
gcloud iam service-accounts keys create ~/gcp-service-account-key.json \
  --iam-account=$SA_EMAIL
```

**Important:** Save `gcp-service-account-key.json` securely. You'll need this for:
- GitHub Secrets
- Backend deployment
- ln-core integration

### 3.4 Create Service Account for ln-core

```bash
# Create separate service account for ln-core
gcloud iam service-accounts create life-navigator-lncore \
  --display-name="Life Navigator ln-core Service"

# Get service account email
LNCORE_SA_EMAIL=$(gcloud iam service-accounts list \
  --filter="displayName:Life Navigator ln-core Service" \
  --format="value(email)")

echo "ln-core Service Account: $LNCORE_SA_EMAIL"

# Grant permissions for Vertex AI
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:$LNCORE_SA_EMAIL" \
  --role="roles/aiplatform.user"

# Create and download key
gcloud iam service-accounts keys create ~/gcp-lncore-key.json \
  --iam-account=$LNCORE_SA_EMAIL
```

### 3.5 Store Database URL in Secret Manager

```bash
# Get your DATABASE_URL from .env.production
DATABASE_URL="your-database-url-here"

# Create secret
echo -n "$DATABASE_URL" | gcloud secrets create database-url \
  --data-file=- \
  --replication-policy="automatic"

# Grant backend service account access
gcloud secrets add-iam-policy-binding database-url \
  --member="serviceAccount:$SA_EMAIL" \
  --role="roles/secretmanager.secretAccessor"
```

### 3.6 Set GCP Region

```bash
# Set default region (choose closest to users)
gcloud config set run/region us-central1
```

---

## 4. Stripe Configuration

### 4.1 Get API Keys

1. **Go to:** https://dashboard.stripe.com/apikeys
2. **Copy:**
   - **Publishable key** (starts with `pk_live_...`)
   - **Secret key** (starts with `sk_live_...`)

3. **Add to `.env.production`:**

```bash
# Stripe
STRIPE_SECRET_KEY="sk_live_..."
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_live_..."
```

### 4.2 Create Products

**Create these products in Stripe Dashboard:**

Go to: https://dashboard.stripe.com/products → "Add product"

#### One-Time Purchases

| Product Name | Price | Type | Price ID to use in code |
|-------------|-------|------|------------------------|
| Chat Queries - Starter | $2.00 | One-time | `price_chat_10` |
| Chat Queries - Popular | $5.00 | One-time | `price_chat_30` |
| Chat Queries - Best Value | $9.00 | One-time | `price_chat_60` |
| Scenario Runs - Starter | $3.00 | One-time | `price_scenario_10` |
| Scenario Runs - Popular | $7.00 | One-time | `price_scenario_30` |
| Scenario Runs - Best Value | $12.00 | One-time | `price_scenario_60` |

**For each product:**
1. Click "Add product"
2. Enter product name (e.g., "Chat Queries - Starter")
3. Enter price ($2.00)
4. Select "One time"
5. Add metadata:
   - `credits`: `10` (or respective amount)
   - `type`: `chat_queries` (or `scenario_runs`)
6. **Copy the Price ID** (e.g., `price_1ABC123...`)
7. Save in a note file with your custom naming (e.g., `price_chat_10`)

#### Subscriptions (For Phase 2)

| Product Name | Price | Type | Price ID to use |
|-------------|-------|------|----------------|
| Pro Monthly | $25/mo | Recurring | `price_pro_monthly` |
| Pro Annual | $250/yr | Recurring | `price_pro_annual` |
| Enterprise Monthly | $99/mo | Recurring | `price_enterprise_monthly` |
| Enterprise Annual | $990/yr | Recurring | `price_enterprise_annual` |

### 4.3 Update Code with Stripe Price IDs

**After creating Stripe products, update these files:**

**File 1:** `apps/web/src/components/usage/OutOfQueriesModal.tsx`

```typescript
// Line 18-42, replace with YOUR actual Stripe Price IDs:
const CHAT_PACKS: CreditPack[] = [
  {
    id: 'chat_small',
    name: 'Starter',
    credits: 10,
    price: 2,
    priceId: 'price_1ABC123...', // YOUR ACTUAL PRICE ID
  },
  // ... update all 6 packs
];
```

**File 2:** `apps/web/src/app/pricing/page.tsx`

```typescript
// Line 81-99, replace with YOUR actual Stripe Price IDs:
const creditPacks = {
  chat: [
    { credits: 10, price: 2, priceId: 'price_1ABC123...' }, // YOUR ACTUAL PRICE ID
    // ... update all 6 packs
  ],
};
```

**Commit these changes:**

```bash
git add apps/web/src/components/usage/OutOfQueriesModal.tsx apps/web/src/app/pricing/page.tsx
git commit -m "feat(stripe): Add production Stripe Price IDs"
git push origin main
```

### 4.4 Create Webhook Endpoint (Do This AFTER Vercel Deployment)

**You'll do this in Step 6.5 after getting your Vercel URL**

---

## 5. GitHub Secrets Configuration

### 5.1 Add Repository Secrets

1. **Go to:** Your GitHub repo → Settings → Secrets and variables → Actions
2. **Click:** "New repository secret"
3. **Add each secret below:**

**Required Secrets:**

```bash
# GCP Credentials (paste contents of gcp-service-account-key.json)
GCP_SERVICE_ACCOUNT_KEY
# Value: entire contents of ~/gcp-service-account-key.json

# GCP Project ID
GCP_PROJECT_ID
# Value: your-project-id

# Database URLs
DATABASE_URL
# Value: your Supabase connection pooling URL

DIRECT_URL
# Value: your Supabase direct connection URL

# Stripe Keys
STRIPE_SECRET_KEY
# Value: sk_live_...

NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
# Value: pk_live_...

# Auth Secrets (generate these)
NEXTAUTH_SECRET
# Generate: openssl rand -base64 32

JWT_SECRET
# Generate: openssl rand -base64 32
```

**To generate secrets:**

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate JWT_SECRET
openssl rand -base64 32
```

### 5.2 Add Environment Variables (Optional)

If you want CI/CD to deploy automatically:

**Variables (not secrets):**
- `VERCEL_ORG_ID` - Get from Vercel dashboard
- `VERCEL_PROJECT_ID` - Get from Vercel dashboard
- `GCP_REGION` - `us-central1`

---

## 6. Vercel Frontend Deployment

### 6.1 Login to Vercel

```bash
vercel login
```

### 6.2 Link Project

```bash
cd apps/web
vercel link
```

**Follow prompts:**
- Link to existing project? `N`
- What's your project's name? `life-navigator`
- In which directory is your code located? `./`

### 6.3 Configure Environment Variables

**Add all environment variables to Vercel:**

```bash
# Database URLs
vercel env add DATABASE_URL production
# Paste your Supabase connection pooling URL

vercel env add DIRECT_URL production
# Paste your Supabase direct connection URL

# Auth secrets
vercel env add NEXTAUTH_SECRET production
# Paste your generated NEXTAUTH_SECRET

vercel env add JWT_SECRET production
# Paste your generated JWT_SECRET

# Stripe keys
vercel env add STRIPE_SECRET_KEY production
# Paste your sk_live_...

vercel env add NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY production
# Paste your pk_live_...

# Backend API (placeholder for now)
vercel env add NEXT_PUBLIC_API_URL production
# Value: https://api.lifenavigator.app (update later)

# Optional: OAuth
vercel env add GOOGLE_CLIENT_ID production
# Paste if you have it

vercel env add GOOGLE_CLIENT_SECRET production
# Paste if you have it
```

**Or use Vercel Dashboard:**
1. Go to: https://vercel.com/dashboard
2. Select your project → Settings → Environment Variables
3. Add all variables above

### 6.4 Deploy to Production

```bash
# From apps/web directory
vercel --prod
```

**This will:**
1. Build your Next.js app
2. Deploy to Vercel edge network
3. Return your production URL: `https://your-app.vercel.app`

**Save this URL!** You'll need it for:
- Stripe webhook
- NEXTAUTH_URL update
- CORS configuration

### 6.5 Update NEXTAUTH_URL

```bash
# Use your actual Vercel URL
vercel env add NEXTAUTH_URL production
# Value: https://your-app.vercel.app
```

### 6.6 Setup Stripe Webhook

Now that you have your Vercel URL:

1. **Go to:** https://dashboard.stripe.com/webhooks
2. **Click:** "Add endpoint"
3. **Enter:**
   - **Endpoint URL:** `https://your-app.vercel.app/api/integrations/stripe/webhook`
   - **Description:** `Life Navigator Production`
4. **Select events:**
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
5. **Click:** "Add endpoint"
6. **Copy:** Webhook signing secret (starts with `whsec_...`)

**Add to Vercel:**

```bash
vercel env add STRIPE_WEBHOOK_SECRET production
# Paste your whsec_... secret
```

### 6.7 Redeploy with New Env Vars

```bash
vercel --prod
```

---

## 7. Database Migration

### 7.1 Run Prisma Migrations

```bash
cd apps/web

# Set environment variables for this session
export DATABASE_URL="your-supabase-connection-pooling-url"
export DIRECT_URL="your-supabase-direct-connection-url"

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy
```

**Expected output:**
```
Prisma Migrate applied the following migration(s):

20240120_add_usage_tracking_and_billing

✔ Generated Prisma Client
```

### 7.2 Verify Database Schema

```bash
# Open Prisma Studio to verify
npx prisma studio
```

**Check that these tables exist:**
- `users` (with new billing and usage fields)
- `purchases`
- `query_logs`

**Or verify in Supabase:**
1. Go to: Supabase Dashboard → Database → Tables
2. Confirm: `users`, `purchases`, `query_logs` exist

### 7.3 Create Test User (Optional)

```bash
# Open Prisma Studio
npx prisma studio

# Or use SQL in Supabase:
# Go to: SQL Editor in Supabase
# Run:
```

```sql
INSERT INTO users (
  id,
  email,
  name,
  "subscriptionTier",
  "setupCompleted"
) VALUES (
  'test_user_001',
  'test@lifenavigator.app',
  'Test User',
  'freemium',
  true
);
```

---

## 8. Backend Deployment to Cloud Run

### 8.1 Prepare Backend Environment

```bash
cd backend

# Create .env file for Cloud Run
cat > .env.production <<EOF
DATABASE_URL=${DATABASE_URL}
DIRECT_URL=${DIRECT_URL}
GCP_PROJECT_ID=your-project-id
NEXTAUTH_URL=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app
EOF
```

### 8.2 Build and Deploy Backend

```bash
# Make sure you're in backend directory
cd backend

# Deploy to Cloud Run
gcloud run deploy life-navigator-api \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --service-account=$SA_EMAIL \
  --set-env-vars="DATABASE_URL=$DATABASE_URL,GCP_PROJECT_ID=$GCP_PROJECT_ID" \
  --memory 2Gi \
  --cpu 2 \
  --timeout 300 \
  --max-instances 10
```

**This will:**
1. Build Docker image
2. Push to Container Registry
3. Deploy to Cloud Run
4. Return service URL: `https://life-navigator-api-xxxxx-uc.a.run.app`

**Save this URL!**

### 8.3 Update Frontend with Backend URL

```bash
cd ../apps/web

# Update NEXT_PUBLIC_API_URL with actual backend URL
vercel env rm NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_API_URL production
# Paste your Cloud Run URL

# Redeploy frontend
vercel --prod
```

### 8.4 Configure CORS on Backend

**Edit:** `backend/app/main.py`

```python
# Update CORS origins with your Vercel URL
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-app.vercel.app",  # Your actual Vercel URL
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

**Commit and redeploy:**

```bash
git add backend/app/main.py
git commit -m "fix(backend): Update CORS for production"
git push origin main

# Redeploy backend
cd backend
gcloud run deploy life-navigator-api --source .
```

---

## 9. Connect ln-core Multi-Agent System

### 9.1 Deploy ln-core to Cloud Run

**In your ln-core repository:**

```bash
cd /path/to/ln-core

# Create Cloud Run service
gcloud run deploy life-navigator-lncore \
  --source . \
  --platform managed \
  --region us-central1 \
  --service-account=$LNCORE_SA_EMAIL \
  --set-env-vars="GCP_PROJECT_ID=$GCP_PROJECT_ID" \
  --memory 4Gi \
  --cpu 4 \
  --timeout 600 \
  --max-instances 20 \
  --no-allow-unauthenticated
```

**Note:** `--no-allow-unauthenticated` requires authentication

**Save the ln-core URL:** `https://life-navigator-lncore-xxxxx-uc.a.run.app`

### 9.2 Configure Service-to-Service Authentication

**Allow backend to call ln-core:**

```bash
# Get backend service account email
BACKEND_SA=$(gcloud run services describe life-navigator-api \
  --region us-central1 \
  --format="value(spec.template.spec.serviceAccountName)")

# Grant backend permission to invoke ln-core
gcloud run services add-iam-policy-binding life-navigator-lncore \
  --region=us-central1 \
  --member="serviceAccount:$BACKEND_SA" \
  --role="roles/run.invoker"
```

### 9.3 Update Backend with ln-core URL

**Add to backend environment:**

```bash
# Update Cloud Run service with ln-core URL
gcloud run services update life-navigator-api \
  --region us-central1 \
  --set-env-vars="LNCORE_API_URL=https://life-navigator-lncore-xxxxx-uc.a.run.app"
```

### 9.4 Test ln-core Connection

```bash
# Test from backend
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://life-navigator-lncore-xxxxx-uc.a.run.app/health
```

**Expected response:** `{"status": "healthy"}`

---

## 10. Final Testing & Verification

### 10.1 Test Frontend

**Visit:** `https://your-app.vercel.app`

**Test checklist:**
- [ ] Homepage loads
- [ ] Registration works
- [ ] Login works
- [ ] Dashboard loads
- [ ] Pricing page displays correctly

### 10.2 Test Usage System

1. **Register new account**
2. **Check query balance:**
   - Should show: 5 chat queries, 5 scenario runs
3. **Use onboarding:**
   - Should NOT consume queries
4. **Use chat:**
   - Should consume 1 query
   - Balance updates correctly
5. **Run out of queries:**
   - OutOfQueriesModal should appear
   - Credit packs display

### 10.3 Test Stripe Integration (Test Mode First)

**Use Stripe test keys first:**

1. **Switch to test mode** in Stripe Dashboard
2. **Use test card:** `4242 4242 4242 4242`
3. **Test purchase flow:**
   - Click "Purchase" in OutOfQueriesModal
   - Complete Stripe checkout
   - Verify credits added to account
4. **Check webhook:**
   - Go to: Stripe Dashboard → Webhooks
   - Verify webhook received events
   - Check: `checkout.session.completed` succeeded

**If test works, switch to live mode:**
1. Update Stripe keys in Vercel to live keys
2. Redeploy: `vercel --prod`

### 10.4 Test Backend API

```bash
# Test health endpoint
curl https://your-backend-url.run.app/health

# Test authenticated endpoint (need real JWT)
# Login to get token, then:
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://your-backend-url.run.app/api/v1/usage/balance
```

### 10.5 Test ln-core Integration

**From the frontend:**
1. Start onboarding
2. Ask a question
3. Verify agent responds
4. Check Cloud Run logs:

```bash
# View backend logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=life-navigator-api" \
  --limit 50 \
  --format json

# View ln-core logs
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=life-navigator-lncore" \
  --limit 50 \
  --format json
```

### 10.6 Check Database

**Verify data is being written:**

1. Go to: Supabase Dashboard → Database → Table Editor
2. Check `query_logs` table:
   - Should have entries for queries used
3. Check `purchases` table:
   - Should have test purchase (if you made one)

---

## 11. Go-Live Checklist

### Pre-Launch (Day Before)

- [ ] All services deployed and tested
- [ ] Stripe in live mode with live keys
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificates active (automatic with Vercel)
- [ ] Database backups configured (automatic with Supabase)
- [ ] Monitoring setup (see below)
- [ ] Error tracking enabled (see below)

### Launch Day

- [ ] Final smoke test of all features
- [ ] Verify Stripe webhook receiving events
- [ ] Check Cloud Run service health
- [ ] Monitor error rates
- [ ] Test user registration flow
- [ ] Announce launch 🎉

### Post-Launch Monitoring

**Set up these monitoring dashboards:**

1. **Vercel Analytics**
   - Go to: Vercel Dashboard → Analytics
   - Monitor: Traffic, performance, errors

2. **GCP Cloud Run Monitoring**
   - Go to: Cloud Console → Cloud Run → Metrics
   - Monitor: Request count, latency, errors

3. **Supabase Metrics**
   - Go to: Supabase Dashboard → Metrics
   - Monitor: Database connections, query performance

4. **Stripe Dashboard**
   - Monitor: Payments, failed transactions

---

## 12. Troubleshooting

### Database Connection Issues

**Problem:** `P1001: Can't reach database server`

**Solution:**
```bash
# Verify DATABASE_URL is correct
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check Supabase connection pooling settings
# Go to: Supabase → Settings → Database → Connection Pooling
# Ensure mode is "Transaction"
```

### Vercel Build Failures

**Problem:** `Prisma Client not generated`

**Solution:**
```bash
# Ensure buildCommand in vercel.json includes prisma generate
# Should be: "buildCommand": "prisma generate && next build"

# Or add to package.json:
{
  "scripts": {
    "vercel-build": "prisma generate && next build"
  }
}
```

### Cloud Run Deployment Fails

**Problem:** `ERROR: (gcloud.run.deploy) PERMISSION_DENIED`

**Solution:**
```bash
# Re-authenticate
gcloud auth login

# Verify project
gcloud config get-value project

# Check permissions
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --format="table(bindings.role)" \
  --filter="bindings.members:user:YOUR_EMAIL"
```

### Stripe Webhook Not Receiving Events

**Problem:** Webhook shows as failed in Stripe Dashboard

**Solution:**
1. **Verify URL:** Must be `https://your-app.vercel.app/api/integrations/stripe/webhook`
2. **Check webhook secret:** Must match in Vercel env vars
3. **Test webhook:**
   ```bash
   stripe listen --forward-to https://your-app.vercel.app/api/integrations/stripe/webhook
   stripe trigger checkout.session.completed
   ```
4. **Check logs:**
   ```bash
   vercel logs --prod
   ```

### Query Balance Not Updating

**Problem:** User uses query but balance doesn't decrease

**Solution:**
```bash
# Check query logs
psql $DIRECT_URL -c "SELECT * FROM query_logs ORDER BY created_at DESC LIMIT 10"

# Check user balance
psql $DIRECT_URL -c "SELECT id, email, queries_used_today, daily_chat_queries FROM users WHERE email='user@example.com'"

# Verify API is being called
vercel logs --prod | grep "usage/consume"
```

### ln-core Not Responding

**Problem:** Agent queries timeout or fail

**Solution:**
```bash
# Check ln-core service status
gcloud run services describe life-navigator-lncore --region us-central1

# Check logs for errors
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=life-navigator-lncore" \
  --limit 20

# Test direct connection
curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" \
  https://life-navigator-lncore-xxxxx-uc.a.run.app/health

# Verify Vertex AI access
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:serviceAccount:$LNCORE_SA_EMAIL"
```

---

## 13. Production URLs Reference

**Save these after deployment:**

```bash
# Frontend
FRONTEND_URL=https://your-app.vercel.app

# Backend
BACKEND_URL=https://life-navigator-api-xxxxx-uc.a.run.app

# ln-core
LNCORE_URL=https://life-navigator-lncore-xxxxx-uc.a.run.app

# Database
DATABASE_URL=your-supabase-connection-pooling-url
```

---

## 14. Security Checklist

### Before Going Live

- [ ] All API keys are in environment variables (not in code)
- [ ] GitHub Secrets properly configured
- [ ] Supabase RLS policies enabled (if using)
- [ ] CORS configured with only your domains
- [ ] Rate limiting enabled (see below)
- [ ] Webhook signature verification enabled
- [ ] Service accounts have minimum required permissions
- [ ] Database passwords are strong
- [ ] JWT secrets are cryptographically secure

### Enable Rate Limiting

**In Vercel:**
- Go to: Project Settings → Security → Rate Limiting
- Enable rate limiting on API routes

**In Cloud Run:**
- Already has automatic DDoS protection
- Consider adding Cloud Armor for advanced protection

---

## 15. Cost Optimization

### Expected Monthly Costs

**Vercel:** $0 (Hobby plan) or $20/mo (Pro)
**Supabase:** $0 (Free tier) or $25/mo (Pro) - upgrade when > 500MB
**GCP Cloud Run:** ~$10-50/mo (pay per request, very scalable)
**Stripe:** 2.9% + $0.30 per transaction
**Total:** ~$35-95/mo initial costs

### Cost Monitoring

```bash
# Set budget alerts in GCP
gcloud billing budgets create \
  --billing-account=YOUR_BILLING_ACCOUNT \
  --display-name="Life Navigator Budget" \
  --budget-amount=100USD \
  --threshold-rule=percent=50 \
  --threshold-rule=percent=90
```

---

## 16. Emergency Rollback Procedure

If something goes catastrophically wrong:

### Rollback Vercel

```bash
cd apps/web
vercel rollback
```

### Rollback Cloud Run

```bash
# List revisions
gcloud run revisions list --service life-navigator-api --region us-central1

# Rollback to previous revision
gcloud run services update-traffic life-navigator-api \
  --region us-central1 \
  --to-revisions PREVIOUS_REVISION=100
```

### Rollback Database

```bash
# Supabase has automatic backups
# Go to: Supabase Dashboard → Database → Backups
# Click "Restore" on desired backup point
```

---

## 17. Post-Launch Optimization

### Week 1 Tasks

- [ ] Monitor error rates daily
- [ ] Review user feedback
- [ ] Check conversion rates (free → paid)
- [ ] Analyze query usage patterns
- [ ] Optimize slow API endpoints

### Enable Monitoring

**Vercel:**
```bash
# Enable Web Analytics
# Go to: Vercel Dashboard → Analytics → Enable
```

**GCP:**
```bash
# Set up Cloud Monitoring dashboard
# Go to: Cloud Console → Monitoring → Dashboards
# Create dashboard with:
# - Cloud Run request count
# - Cloud Run latency
# - Error rate
```

**Sentry (Optional Error Tracking):**
```bash
pnpm add @sentry/nextjs
# Configure in next.config.js
```

---

## 🎉 Launch Summary

Once all steps are complete, you'll have:

✅ **Frontend** deployed on Vercel with automatic HTTPS and CDN
✅ **Backend** deployed on Cloud Run with auto-scaling
✅ **Database** on Supabase with automatic backups
✅ **ln-core** deployed with service-to-service auth
✅ **Stripe** configured for payments and webhooks
✅ **Monitoring** and error tracking enabled
✅ **Security** best practices implemented

**Your application will be LIVE and ready for users!** 🚀

---

## Quick Reference Commands

```bash
# Deploy frontend
cd apps/web && vercel --prod

# Deploy backend
cd backend && gcloud run deploy life-navigator-api --source .

# Deploy ln-core
cd ../ln-core && gcloud run deploy life-navigator-lncore --source .

# Run migrations
cd apps/web && npx prisma migrate deploy

# View logs
vercel logs --prod
gcloud logging read "resource.type=cloud_run_revision" --limit 50

# Check service status
gcloud run services list
```

---

**Questions?** Review the troubleshooting section or check:
- Vercel Docs: https://vercel.com/docs
- GCP Docs: https://cloud.google.com/run/docs
- Supabase Docs: https://supabase.com/docs
- Stripe Docs: https://stripe.com/docs

**Good luck with your launch! 🚀**
