# Life Navigator Beta Deployment Plan

## Current Status (as of Dec 7, 2025)

### What's Working
- **Frontend**: Deployed to Cloud Run at `https://ln-web-frontend-qcws22vbba-uc.a.run.app`
- **Infrastructure**: VPC connector, Cloud SQL (PostgreSQL), Secret Manager configured
- **CI/CD Workflows**: GitHub Actions configured for both frontend and backend

### What's In Progress
- **Backend API Gateway**: Deployment workflow running (may have completed by tomorrow)
- Last fix pushed: Dockerfile changes for Cloud Run compatibility

### Known Issues Fixed Today
1. Pydantic validation errors (added defaults for DATABASE_URL, SECRET_KEY)
2. OpenTelemetry import errors (made imports conditional)
3. ENVIRONMENT="beta" not valid (added to allowed values)
4. Dockerfile hardcoded ENVIRONMENT=production (removed)
5. Multi-worker startup too slow (changed to single worker)

---

## Tomorrow's Deployment Checklist

### Phase 1: Check Current Deployment Status (5 min)

```bash
# Check if last night's workflow succeeded
gh run list --workflow=backend-cloudrun.yml --limit 3

# If failed, check the error
gh run view <run-id> --log-failed | tail -50
```

### Phase 2: Verify Backend API Gateway (10 min)

If deployment succeeded:
```bash
# Get the service URL
gcloud run services describe ln-api-gateway --region us-central1 --format 'value(status.url)'

# Test health endpoint
curl https://<api-url>/health

# Test root endpoint
curl https://<api-url>/
```

If deployment failed:
- Check Cloud Run logs in GCP Console
- Look for Python/startup errors
- May need additional config fixes

### Phase 3: Connect Frontend to Backend (15 min)

1. Update frontend environment to point to backend API:
```bash
# In frontend workflow or Cloud Run config, set:
NEXT_PUBLIC_API_URL=https://ln-api-gateway-<hash>-uc.a.run.app
```

2. Redeploy frontend with correct API URL

3. Test frontend-to-backend connection:
   - Open frontend URL in browser
   - Check browser console for API errors
   - Verify CORS is working

### Phase 4: Database Setup (20 min)

1. Run database migrations:
```bash
# Option A: From Cloud Shell with VPC access
gcloud run jobs create run-migrations \
  --image <api-gateway-image> \
  --region us-central1 \
  --vpc-connector ln-vpc-connector-beta \
  --set-secrets DATABASE_URL=database-url-beta:latest \
  --command "alembic upgrade head"

# Option B: Add migration step to deployment workflow
```

2. Verify database tables created:
```bash
# Connect to Cloud SQL via proxy or Cloud Shell
psql $DATABASE_URL -c "\dt"
```

### Phase 5: Full Integration Testing (30 min)

1. **Health Checks**:
   - `GET /health` - Should return `{"status": "healthy"}`
   - `GET /health/db` - Should return `{"status": "healthy", "database": "connected"}`

2. **API Endpoints**:
   - `GET /api/v1/` - Test API router is mounted
   - Check Swagger docs at `/docs` (if enabled for beta)

3. **Frontend Integration**:
   - Load frontend in browser
   - Test any API-dependent features
   - Check network tab for successful API calls

---

## Potential Issues to Watch For

### Issue 1: Database Connection Timeout
**Symptom**: `/health/db` fails, API errors about database
**Fix**: Ensure VPC connector is working, check Cloud SQL instance is running

### Issue 2: CORS Errors
**Symptom**: Browser console shows CORS blocked
**Fix**: Update `CORS_ORIGINS` env var in Cloud Run to include frontend URL

### Issue 3: Secret Access Denied
**Symptom**: Container fails to start with permission error
**Fix**: Grant Secret Manager access to service account:
```bash
gcloud secrets add-iam-policy-binding database-url-beta \
  --member="serviceAccount:ln-api-gateway-beta@PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Issue 4: Memory/CPU Limits
**Symptom**: Container OOM killed or slow
**Fix**: Increase limits in workflow:
```yaml
--memory 1Gi \
--cpu 2 \
```

---

## Services Overview

| Service | URL | Status |
|---------|-----|--------|
| Frontend | https://ln-web-frontend-qcws22vbba-uc.a.run.app | Deployed |
| API Gateway | https://ln-api-gateway-xxx-uc.a.run.app | Pending |
| Agent Orchestrator | Not deployed | Needs Neo4j/Qdrant |
| GraphRAG API | Not deployed | Needs Neo4j/Qdrant |

---

## Commands Reference

```bash
# Check all Cloud Run services
gcloud run services list --region us-central1

# View service logs
gcloud logging read 'resource.type="cloud_run_revision"' --limit 50

# Manually trigger backend deployment
gh workflow run backend-cloudrun.yml -f service=api-gateway -f environment=beta

# Check secrets
gcloud secrets list

# Update a Cloud Run env var
gcloud run services update ln-api-gateway \
  --region us-central1 \
  --set-env-vars "KEY=value"
```

---

## After Successful Deployment

1. **Document the URLs** in README or internal wiki
2. **Set up monitoring alerts** in GCP
3. **Configure domain** (if ready for custom domain)
4. **Enable HTTPS redirect** (should be automatic on Cloud Run)
5. **Test with real users** in beta group
