# Production Deployment - Step by Step

## Prerequisites - Please Run These Commands First

### 1. Login to Vercel
```bash
vercel login
```

### 2. Login to Google Cloud (for backend)
```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

### 3. Login to Supabase (if you have CLI installed)
```bash
# Install if needed:
# brew install supabase/tap/supabase

supabase login
```

### 4. Login to Stripe (optional, for webhook testing)
```bash
# Install if needed:
# brew install stripe/stripe-cli/stripe

stripe login
```

---

## What Will Be Deployed

1. **Frontend (Next.js)** → Vercel
   - Location: `apps/web`
   - Automatic HTTPS, CDN, Edge functions
   - Environment variables configured in Vercel dashboard

2. **Backend (FastAPI)** → Google Cloud Run
   - Location: `backend`
   - Auto-scaling, managed containers
   - Connected to PostgreSQL database

3. **Database** → Supabase PostgreSQL
   - Managed PostgreSQL with pooling
   - Automatic backups
   - Connection pooling for Prisma

4. **Stripe** → Products & Webhooks
   - Create credit pack products
   - Configure webhook endpoint
   - Test mode first, then production

---

## After You Log In

Once you've logged into all services above, respond with "ready" and I will:

1. ✅ Create Vercel project and deploy frontend
2. ✅ Set up Supabase database and run migrations
3. ✅ Deploy backend to Google Cloud Run
4. ✅ Create Stripe products for credit packs
5. ✅ Configure all environment variables
6. ✅ Set up webhook endpoints
7. ✅ Test the full deployment
8. ✅ Provide you with production URLs

---

## Manual Steps (I'll guide you through these)

Some things require dashboard access that I can't automate:
- Creating Stripe products (you'll need to confirm Price IDs)
- OAuth credentials (Google, Plaid, etc.)
- Vercel team settings (if applicable)

---

Let me know once you're logged in!
