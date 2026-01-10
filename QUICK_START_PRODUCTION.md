# Quick Start - Production Launch

**5-Minute Deployment Guide**

---

## Prerequisites Checklist

- [ ] GCP project created (`life-navigator-prod`)
- [ ] Vercel account linked to repo
- [ ] GitHub Actions enabled
- [ ] Supabase project configured
- [ ] CloudSQL instances created (HIPAA, Financial)

---

## Step 1: Validate (2 min)

```bash
# Run launch readiness check
./scripts/launch-readiness-check.sh

# Expected: All checks pass ✅
```

---

## Step 2: Secrets (5 min)

### GCP Secrets
```bash
# Create secrets (use real values)
echo -n "$(openssl rand -hex 32)" | gcloud secrets create SECRET_KEY --data-file=-
echo -n "$(openssl rand -hex 32)" | gcloud secrets create ENCRYPTION_KEY --data-file=-
echo -n "postgresql+asyncpg://..." | gcloud secrets create DATABASE_HIPAA_URL --data-file=-
echo -n "postgresql+asyncpg://..." | gcloud secrets create DATABASE_FINANCIAL_URL --data-file=-

# Grant access
SERVICE_ACCOUNT="backend@life-navigator-prod.iam.gserviceaccount.com"
for secret in SECRET_KEY ENCRYPTION_KEY DATABASE_HIPAA_URL DATABASE_FINANCIAL_URL; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:$SERVICE_ACCOUNT" \
    --role="roles/secretmanager.secretAccessor"
done
```

### Vercel Secrets
```bash
vercel link
vercel env add NEXT_PUBLIC_API_URL production  # https://api.life-navigator.com
vercel env add NEXTAUTH_SECRET production      # $(openssl rand -hex 32)
vercel env add NEXTAUTH_URL production         # https://app.life-navigator.com
```

### GitHub Secrets
```
Settings → Secrets → Actions → Add:
- GCP_PROJECT_ID
- GCP_SERVICE_ACCOUNT_KEY
- VERCEL_TOKEN
- VERCEL_ORG_ID
- VERCEL_PROJECT_ID
```

---

## Step 3: Deploy Backend (3 min)

```bash
cd backend

gcloud run deploy life-navigator-backend \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars=ENVIRONMENT=production,USE_GCP_SECRET_MANAGER=true,GCP_PROJECT_ID=life-navigator-prod \
  --update-secrets=SECRET_KEY=SECRET_KEY:latest,ENCRYPTION_KEY=ENCRYPTION_KEY:latest \
  --memory=2Gi \
  --cpu=2 \
  --max-instances=10

# Get URL
gcloud run services describe life-navigator-backend --region=us-central1 --format='value(status.url)'
```

---

## Step 4: Deploy Frontend (2 min)

```bash
cd apps/web
vercel --prod
```

---

## Step 5: Verify (2 min)

```bash
# Health checks
curl https://api.life-navigator.com/health
curl https://app.life-navigator.com/api/health

# Security headers
curl -I https://app.life-navigator.com | grep -E "Content-Security-Policy|Strict-Transport-Security"

# Data boundary (should return 400)
curl -X POST https://api.life-navigator.com/api/v1/internal/risk-engine/compute \
  -H "Content-Type: application/json" \
  -d '{"ssn": "123-45-6789"}'
# Expected: HTTP 400, "data_boundary_violation"
```

---

## Step 6: Monitor (Ongoing)

- **Sentry**: https://sentry.io/life-navigator
- **Grafana**: https://grafana.life-navigator.com
- **GCP Console**: https://console.cloud.google.com
- **Vercel Dashboard**: https://vercel.com/dashboard

---

## Emergency Rollback

### Frontend
```bash
vercel rollback
```

### Backend
```bash
gcloud run revisions list --service=life-navigator-backend
gcloud run services update-traffic life-navigator-backend --to-revisions=REVISION-NAME=100
```

---

## Common Issues

### "ConfigurationError: SECRET_KEY must be changed"
→ Check secret exists: `gcloud secrets describe SECRET_KEY`
→ Verify access: `gcloud secrets versions access latest --secret=SECRET_KEY`

### "CORS policy blocked"
→ Update CORS_ORIGINS: `echo -n "https://app.life-navigator.com" | gcloud secrets create CORS_ORIGINS --data-file=-`

### "Data boundary tests failing"
→ Ensure middleware registered in `backend/app/main.py`

---

## Success Metrics

- ✅ Error rate < 1%
- ✅ p99 latency < 500ms
- ✅ All health checks green
- ✅ No .env in production runtime
- ✅ No OpenAI API calls
- ✅ No data boundary violations

---

## Full Documentation

**Detailed Guide**: [docs/LAUNCH_READINESS.md](./docs/LAUNCH_READINESS.md)
**Implementation Summary**: [LAUNCH_IMPLEMENTATION_SUMMARY.md](./LAUNCH_IMPLEMENTATION_SUMMARY.md)
**Secrets Reference**: [docs/security/SECRETS_INVENTORY.md](./docs/security/SECRETS_INVENTORY.md)

---

**Ready to launch!** 🚀

Questions? See [LAUNCH_READINESS.md](./docs/LAUNCH_READINESS.md)
