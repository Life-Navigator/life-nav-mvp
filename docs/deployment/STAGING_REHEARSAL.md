# Staging Rehearsal Guide

**Purpose**: Validate production-readiness before public launch

**Owner**: Engineering Lead
**Last Updated**: 2026-01-09
**Status**: ✅ Ready for Execution

---

## Overview

This guide walks through the complete staging rehearsal process, from deployment to smoke tests to manual user flow validation.

**Why Staging Rehearsal Matters**:
- Catches integration issues before production
- Validates security controls in deployed environment
- Tests real database connections, secret management, and external services
- Provides confidence for production launch

---

## Prerequisites

### Required Tools

```bash
# Install gcloud CLI
# https://cloud.google.com/sdk/docs/install

# Install Vercel CLI
npm install -g vercel

# Optional but recommended
npm install -g jq  # For JSON formatting in tests
```

### Required Access

- ✅ GCP project access (`life-navigator-staging`)
- ✅ Vercel account linked to repository
- ✅ GitHub repository access
- ✅ GCP Secret Manager permissions

### Required Secrets

Create these in GCP Secret Manager **before** deployment:

```bash
# Set your project
export GCP_PROJECT=life-navigator-staging

# Core secrets
echo -n "$(openssl rand -hex 32)" | gcloud secrets create SECRET_KEY --data-file=- --project=$GCP_PROJECT
echo -n "$(openssl rand -hex 32)" | gcloud secrets create ENCRYPTION_KEY --data-file=- --project=$GCP_PROJECT

# Database URLs (replace with your actual CloudSQL/Supabase URLs)
echo -n "postgresql+asyncpg://..." | gcloud secrets create DATABASE_HIPAA_URL --data-file=- --project=$GCP_PROJECT
echo -n "postgresql+asyncpg://..." | gcloud secrets create DATABASE_FINANCIAL_URL --data-file=- --project=$GCP_PROJECT

# Grant access to Cloud Run service account
SERVICE_ACCOUNT="backend@${GCP_PROJECT}.iam.gserviceaccount.com"

for secret in SECRET_KEY ENCRYPTION_KEY DATABASE_HIPAA_URL DATABASE_FINANCIAL_URL; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor" \
    --project=$GCP_PROJECT
done
```

---

## Deployment Process

### Step 1: Pre-Deployment Validation (5 min)

Run launch readiness checks:

```bash
cd /path/to/life-navigator-monorepo

# Run validation
./scripts/launch-readiness-check.sh
```

**Expected Output**:
```
✅ PASS: No forbidden .env files
✅ PASS: No OpenAI imports in production code
✅ PASS: Data boundary tests passing
✅ PASS: Production config loader exists
... (all checks pass)

🎉 All critical checks passed!
```

**If any checks fail**: Stop and fix before deploying.

---

### Step 2: Deploy to Staging (10 min)

```bash
# Deploy both backend and frontend
./scripts/deploy-staging.sh
```

**What This Does**:
1. Verifies all prerequisites (gcloud auth, secrets, etc.)
2. Runs launch readiness checks
3. Deploys backend to Cloud Run with staging environment variables
4. Deploys frontend to Vercel (preview deployment)
5. Runs initial health checks
6. Tests data boundary enforcement

**Expected Output**:
```
╔══════════════════════════════════════════════════════════════╗
║            STAGING DEPLOYMENT COMPLETE 🚀                    ║
╚══════════════════════════════════════════════════════════════╝

📍 Deployment URLs:
   Backend:  https://life-navigator-backend-staging-abc123.run.app
   Frontend: https://life-navigator-xyz.vercel.app

✅ Deployment successful!
```

**Save these URLs** - you'll need them for testing.

---

### Step 3: Automated Smoke Tests (5 min)

Run comprehensive smoke tests:

```bash
# Auto-detect URLs (if deployed via deploy-staging.sh)
./scripts/smoke-test-staging.sh

# OR provide URLs explicitly
./scripts/smoke-test-staging.sh \
  https://backend-staging.run.app \
  https://frontend-staging.vercel.app
```

**Test Coverage**:
- ✅ Backend health & infrastructure (4 tests)
- ✅ Security & compliance (4 tests)
- ✅ Frontend (4 tests)
- ✅ API endpoints (3 tests)
- ✅ Performance & reliability (3 tests)

**Expected Output**:
```
╔══════════════════════════════════════════════════════════════╗
║              ✅ ALL TESTS PASSED                             ║
╚══════════════════════════════════════════════════════════════╝

   Total Tests:  18
   Passed:       17
   Failed:       0
   Skipped:      1

   Success Rate: 94%

🎉 Staging deployment is healthy!
```

**If tests fail**: Review `/tmp/smoke-test-results-*.log` and investigate.

---

### Step 4: Manual User Flow Testing (20 min)

Test critical user journeys manually:

#### **Flow 1: Authentication** (5 min)

1. Open frontend URL in incognito window
2. Click "Sign Up" or "Login"
3. Create account with test email
4. Verify email (if email service configured)
5. Log in successfully

**Expected**: User dashboard loads

#### **Flow 2: Create Scenario** (5 min)

1. Navigate to "Scenarios" or "New Scenario"
2. Fill in scenario details:
   - Name: "Test Emergency Fund"
   - Type: Financial planning
   - Initial conditions: Age 30, Income $75k
3. Save scenario

**Expected**: Scenario created and visible in list

#### **Flow 3: Upload Document** (5 min)

1. Navigate to "Documents" or "Upload"
2. Upload a test file (PDF, image, or text)
3. Verify upload completes
4. Check file appears in document list

**Expected**: File uploaded and accessible

#### **Flow 4: Run Simulation** (Optional - if risk-engine deployed)

1. Open scenario
2. Click "Run Simulation" or equivalent
3. Watch progress indicator
4. View results

**Expected**: Simulation completes without errors

#### **Flow 5: Risk Snapshot** (Optional - if risk-engine deployed)

1. Navigate to risk dashboard
2. Request risk snapshot
3. Verify data loads

**Expected**: Risk metrics displayed

---

## Success Criteria

Staging deployment is **READY FOR PRODUCTION** if:

- ✅ All automated smoke tests pass (or only expected skips)
- ✅ Manual user flows complete without errors
- ✅ Security headers present (CSP, HSTS, XFO)
- ✅ Data boundary enforcement working (blocks SSN, PHI, PCI)
- ✅ No .env files in production runtime
- ✅ No OpenAI API calls
- ✅ Response times < 2s (p95)
- ✅ No errors in logs for 30 minutes
- ✅ Database connections stable

---

## Common Issues & Fixes

### Issue 1: Backend Health Check Fails

**Symptoms**: `curl $BACKEND_URL/health` returns 500 or timeout

**Debug**:
```bash
# Check logs
gcloud run logs read life-navigator-backend-staging \
  --project=life-navigator-staging \
  --region=us-central1 \
  --tail=50

# Check recent errors
gcloud run logs read life-navigator-backend-staging \
  --project=life-navigator-staging \
  --region=us-central1 \
  --tail=100 | grep ERROR
```

**Common Causes**:
- Secret not accessible (check IAM permissions)
- Database connection string invalid
- Python dependency missing (check build logs)

**Fix**:
```bash
# Verify secrets
gcloud secrets describe SECRET_KEY --project=life-navigator-staging

# Check service account permissions
gcloud secrets get-iam-policy SECRET_KEY --project=life-navigator-staging
```

---

### Issue 2: Database Health Check Fails

**Symptoms**: `/health` passes but `/health/db` returns 503

**Debug**:
```bash
# Test database connection manually
gcloud secrets versions access latest --secret=DATABASE_HIPAA_URL

# Verify CloudSQL instance is running
gcloud sql instances list
```

**Common Causes**:
- CloudSQL instance not started
- Incorrect connection string
- IP allowlist blocking Cloud Run
- SSL/TLS certificate issue

**Fix**:
- Enable Cloud SQL Admin API
- Add Cloud Run as authorized network
- Use unix socket connection if same region

---

### Issue 3: Data Boundary Not Enforcing

**Symptoms**: `POST /api/v1/internal/risk-engine/compute` with SSN returns 200 (should be 400)

**Debug**:
```bash
# Check if middleware is registered
grep -n "data_boundary_validator_middleware" backend/app/main.py

# Test locally
ENVIRONMENT=staging SECRET_KEY=test-key-32-chars-minimum \
  poetry run uvicorn app.main:app --reload

curl -X POST http://localhost:8000/api/v1/internal/risk-engine/compute \
  -H "Content-Type: application/json" \
  -d '{"ssn": "123-45-6789"}'
```

**Common Causes**:
- Middleware not registered in `main.py`
- Wrong environment (middleware only runs in `is_deployed`)
- Route pattern doesn't match

**Fix**:
- Verify `backend/app/main.py` has middleware registered
- Ensure `ENVIRONMENT=staging` set in Cloud Run

---

### Issue 4: Frontend Can't Reach Backend

**Symptoms**: Frontend loads but API calls fail with CORS errors

**Debug**:
```bash
# Check CORS configuration
curl -I $BACKEND_URL/health \
  -H "Origin: https://your-frontend.vercel.app" \
  -H "Access-Control-Request-Method: POST"

# Should see: Access-Control-Allow-Origin header
```

**Common Causes**:
- `CORS_ORIGINS` not set in backend
- Frontend URL not in allowlist
- Preflight requests failing

**Fix**:
```bash
# Add CORS origin
echo -n "https://your-frontend.vercel.app" | \
  gcloud secrets create CORS_ORIGINS --data-file=- --project=life-navigator-staging

# Redeploy backend with updated secret
./scripts/deploy-staging.sh
```

---

### Issue 5: Slow Response Times

**Symptoms**: Health checks pass but take > 2s

**Debug**:
```bash
# Check cold start times
time curl $BACKEND_URL/health

# Check logs for slow queries
gcloud run logs read life-navigator-backend-staging \
  --project=life-navigator-staging | grep "duration"
```

**Common Causes**:
- Cold starts (first request after idle)
- Slow database queries
- Insufficient memory/CPU
- External service latency

**Fix**:
```bash
# Increase min instances (costs more but reduces cold starts)
gcloud run services update life-navigator-backend-staging \
  --min-instances=1 \
  --project=life-navigator-staging \
  --region=us-central1

# Increase memory
gcloud run services update life-navigator-backend-staging \
  --memory=4Gi \
  --project=life-navigator-staging \
  --region=us-central1
```

---

## Rollback Procedure

If staging deployment fails or tests don't pass:

### Quick Rollback

```bash
./scripts/rollback-staging.sh
```

### Manual Rollback (Backend)

```bash
# List revisions
gcloud run revisions list \
  --service=life-navigator-backend-staging \
  --project=life-navigator-staging \
  --region=us-central1 \
  --limit=5

# Route to previous revision
gcloud run services update-traffic life-navigator-backend-staging \
  --to-revisions=PREVIOUS_REVISION_NAME=100 \
  --project=life-navigator-staging \
  --region=us-central1
```

### Manual Rollback (Frontend)

```bash
cd apps/web

# List deployments
vercel ls

# Promote previous deployment
vercel promote https://previous-deployment-url.vercel.app --yes
```

---

## Monitoring During Rehearsal

Monitor these for 30 minutes after deployment:

### Backend Logs

```bash
# Tail logs
gcloud run logs tail life-navigator-backend-staging \
  --project=life-navigator-staging \
  --region=us-central1

# Watch for errors
watch -n 10 "gcloud run logs read life-navigator-backend-staging \
  --project=life-navigator-staging \
  --region=us-central1 \
  --tail=20 | grep ERROR"
```

### Metrics

Check in Cloud Console:
- Request count (should be steady, not spiking)
- Request latency (p50, p95, p99)
- Error rate (should be < 1%)
- Memory usage (should be < 80%)
- CPU usage (should be < 70%)

### Database Connections

```bash
# PostgreSQL
# Connect and check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
```

---

## After Successful Rehearsal

Once staging is stable for 30 minutes:

1. **Document any issues found** (even if resolved)
2. **Update runbooks** with lessons learned
3. **Take screenshots** of key metrics (baseline for production)
4. **Schedule production deployment** (recommend next business day)
5. **Notify team** that staging is ready

---

## Production Deployment Prep

Before deploying to production:

1. ✅ Create production GCP project (`life-navigator-prod`)
2. ✅ Create production secrets in Secret Manager
3. ✅ Set up production databases (CloudSQL with backups)
4. ✅ Configure production Vercel environment
5. ✅ Set up monitoring (Sentry, Grafana, etc.)
6. ✅ Create incident response plan
7. ✅ Schedule deployment window (low-traffic time)
8. ✅ Notify stakeholders

---

## Contacts

**If Issues During Staging**:
- Engineering Lead: [Your Name]
- DevOps/SRE: [Team Contact]
- On-Call: [PagerDuty/Slack Channel]

**Escalation**:
- Critical issues: Stop deployment, rollback immediately
- Non-critical issues: Document, continue monitoring
- Uncertain: Ask in #engineering Slack channel

---

## Appendix: Full Command Reference

```bash
# Deploy
./scripts/deploy-staging.sh

# Test
./scripts/smoke-test-staging.sh [BACKEND_URL] [FRONTEND_URL]

# Rollback
./scripts/rollback-staging.sh [--backend-only|--frontend-only]

# Logs
gcloud run logs read life-navigator-backend-staging --tail=100
gcloud run logs tail life-navigator-backend-staging

# Service info
gcloud run services describe life-navigator-backend-staging

# Revisions
gcloud run revisions list --service=life-navigator-backend-staging

# Secrets
gcloud secrets list
gcloud secrets versions access latest --secret=SECRET_KEY
```

---

**Status**: Ready for execution
**Next Step**: Run `./scripts/deploy-staging.sh`
