# 🚀 Deploy Life Navigator to Production - NOW

## Quick Start (3 Steps)

### Step 1: Log into Required Services

```bash
# Login to Vercel (REQUIRED for frontend)
vercel login

# Login to Google Cloud (optional, for backend deployment)
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

# That's it! Supabase and Stripe can be done via web dashboards
```

### Step 2: Prepare Your Database

**Option A: Use Supabase (Recommended)**
1. Go to https://supabase.com/dashboard
2. Create new project (or use existing)
3. Go to Settings → Database
4. Copy these two connection strings:
   - **Connection pooling** (for Prisma pooling) - this is your `DATABASE_URL`
   - **Direct connection** (for migrations) - this is your `DIRECT_URL`
5. Keep these handy for the deployment script

**Option B: Use other PostgreSQL provider**
- Make sure you have both pooled and direct connection URLs

### Step 3: Run the Deployment Script

```bash
./deploy-production.sh
```

The script will:
- ✅ Check you're logged into services
- ✅ Collect environment variables (you'll paste your database URLs, Stripe keys, etc.)
- ✅ Run database migrations
- ✅ Deploy frontend to Vercel
- ✅ Deploy backend to Google Cloud Run (if authenticated)
- ✅ Guide you through Stripe product setup
- ✅ Configure webhooks
- ✅ Give you your production URL!

---

## What You'll Need During Deployment

Have these ready:

### Database (from Supabase)
- `DATABASE_URL` - Connection pooling URL
- `DIRECT_URL` - Direct connection URL

### Stripe (from https://dashboard.stripe.com/apikeys)
- `STRIPE_SECRET_KEY` (starts with `sk_live_...`)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (starts with `pk_live_...`)

### Stripe Webhook Secret
You'll create this during the script - it will give you the URL to use

### Optional (can skip for now)
- Google OAuth credentials
- Plaid API keys
- Other integration keys

---

## After Deployment

The script will show you:
- ✅ Your live frontend URL
- ✅ Your backend API URL
- ✅ Next steps checklist
- ✅ Links to all dashboards

You'll then manually create Stripe products and webhook (script guides you through it).

---

## Troubleshooting

**"vercel: command not found"**
```bash
pnpm install -g vercel
# or
npm install -g vercel
```

**"gcloud: command not found"**
- Install: https://cloud.google.com/sdk/docs/install
- Or skip backend deployment for now (deploy only frontend)

**Database migration fails**
- Make sure `DIRECT_URL` is correct
- Check that database is accessible from your IP
- Supabase requires no IP whitelist usually

---

## Ready? Let's Go! 🚀

```bash
./deploy-production.sh
```

Expected time: **10-15 minutes** (including manual Stripe steps)
