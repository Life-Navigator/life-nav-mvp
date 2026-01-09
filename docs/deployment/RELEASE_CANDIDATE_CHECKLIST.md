# Production Release Candidate Checklist

**Repository:** LifeNavigator Monorepo
**Target:** Production Deployment
**Last Updated:** 2026-01-09

---

## How to Use This Checklist

1. **Copy this template** for each release (e.g., `RELEASE_2026-01-15.md`)
2. **Check each item** before promoting to production
3. **Document evidence** (links to CI runs, test reports, screenshots)
4. **Get sign-off** from Security Officer + Platform Lead
5. **Archive** completed checklists in `docs/deployment/releases/`

**CRITICAL**: All items marked 🔴 **MUST** pass before production deployment.

---

## Release Information

| Field | Value |
|-------|-------|
| **Release Date** | _________________ |
| **Release Version** | _________________ |
| **Release Manager** | _________________ |
| **Git Commit SHA** | _________________ |
| **Deployment Branch** | `main` |
| **Deployment Target** | GCP Cloud Run + Vercel |

---

## 1. CI/CD Security Checks 🔴 CRITICAL

### Container Scanning (Trivy)

- [ ] **All Docker images scanned** (5 images: web, backend, api-gateway, agents, graphrag)
  - Evidence: GitHub Actions → Workflow → Trivy results
  - Expected: 0 CRITICAL vulnerabilities, < 5 HIGH vulnerabilities

- [ ] **Scan results uploaded to GitHub Security tab**
  - Navigate to: Security → Code scanning
  - Expected: 5 Trivy scan results (one per container)

- [ ] **All CRITICAL vulnerabilities remediated or documented**
  - If any CRITICAL found: Create GitHub issue + risk acceptance document
  - Link to issues: _________________

### SAST (Semgrep)

- [ ] **Semgrep scan completed without blocking issues**
  - Evidence: GitHub Actions → SAST job → Semgrep results
  - Expected: 0 CRITICAL, < 10 HIGH severity findings

- [ ] **SARIF results uploaded to GitHub Security**
  - Navigate to: Security → Code scanning → Semgrep
  - Expected: Recent scan (< 24 hours old)

- [ ] **All HIGH severity findings reviewed**
  - False positives: Document in `.semgrepignore` with justification
  - Real issues: Fix or create remediation ticket
  - Documentation: _________________

### Secrets Scanning

- [ ] **No secrets detected in codebase**
  - Evidence: GitHub Actions → secrets-scan job → PASS
  - Command: `detect-secrets scan --all-files --baseline .secrets.baseline`
  - Expected: Exit code 0 (no secrets found)

- [ ] **Pre-commit hooks installed and passing**
  - Command: `pre-commit run --all-files`
  - Expected: All hooks pass

- [ ] **No hardcoded credentials in environment files**
  - Manually check: `backend/.env`, `apps/web/.env.local`
  - All values should be placeholders or refer to GCP Secret Manager
  - Verified by: _________________ (initials)

### CodeQL Analysis

- [ ] **CodeQL weekly scan completed**
  - Evidence: Security → Code scanning → CodeQL
  - Expected: 0 CRITICAL, < 5 HIGH for JavaScript/TypeScript and Python

- [ ] **All security alerts triaged**
  - Open alerts: _________________ (count)
  - All alerts either: Fixed, dismissed with reason, or ticketed for later
  - Documentation: _________________

---

## 2. Application Security 🔴 CRITICAL

### Input Validation

- [ ] **All API endpoints use Pydantic validation schemas**
  - Audit completed: _________________ (date)
  - Non-compliant endpoints: _________________ (count)
  - Evidence: `backend/app/schemas/validation.py` imported in all endpoint files

- [ ] **Healthcare-specific validation in place**
  - MRN format: `^MRN\d{6,10}$`
  - ICD-10 codes: `^[A-Z]\d{2}(\.\d{1,4})?$`
  - SSN format: `^\d{3}-\d{2}-\d{4}$`
  - Test command: `pytest tests/api/test_input_validation.py -v`
  - Expected: All tests pass (100+ tests)

- [ ] **SQL injection tests passing**
  - Test command: `pytest tests/api/test_input_validation.py::TestSQLInjectionPrevention -v`
  - Expected: All malicious inputs blocked

- [ ] **XSS prevention tests passing**
  - Test command: `pytest tests/api/test_input_validation.py::TestXSSPrevention -v`
  - Expected: All script tags, event handlers blocked

### CSRF Protection

- [ ] **CSRF middleware enabled**
  - Check: `backend/app/main.py` includes `app.add_middleware(CSRFMiddleware, ...)`
  - Configuration verified: `cookie_secure=True`, `cookie_httponly=True`

- [ ] **CSRF tests passing**
  - Test command: `pytest tests/test_csrf.py -v`
  - Expected: 30+ tests pass

- [ ] **Frontend includes CSRF tokens in requests**
  - Check: `apps/web/src/lib/api-client.ts` includes `X-CSRF-Token` header
  - Manual test: POST request without token → 403 Forbidden

### Security Headers

- [ ] **CSP headers configured**
  - Check: `apps/web/next.config.ts` includes security headers
  - Test: `curl -I https://lifenavigator.com | grep -i content-security-policy`
  - Expected: CSP header present with strict policy

- [ ] **HSTS header present**
  - Test: `curl -I https://lifenavigator.com | grep -i strict-transport-security`
  - Expected: `max-age=63072000; includeSubDomains; preload`

- [ ] **Security headers score A or A+**
  - Test: https://securityheaders.com/?q=https://lifenavigator.com
  - Expected: Grade A or A+
  - Screenshot: _________________

### Rate Limiting

- [ ] **Rate limiting active on auth endpoints**
  - Endpoints: `/api/v1/auth/login`, `/api/v1/auth/register`
  - Limit: 5 requests/minute
  - Test: `for i in {1..10}; do curl http://api/auth/login; done`
  - Expected: 429 Too Many Requests after 5 requests

- [ ] **Rate limiting active on PHI endpoints**
  - Endpoints: `/api/v1/health/*`, `/api/v1/patients/*`
  - Limit: 100 requests/minute
  - Test in staging: Burst 150 requests
  - Expected: 429 after 100 requests

---

## 3. Infrastructure Wiring 🔴 CRITICAL

### Vercel Configuration

- [ ] **Vercel routes ONLY to approved GCP endpoints**
  - Check: `apps/web/vercel.json` rewrites
  - Expected: No direct database URLs, only Cloud Run services
  - Verified URLs: _________________

- [ ] **Environment variables correct**
  - Staging: `NEXT_PUBLIC_API_URL` points to staging Cloud Run
  - Production: `NEXT_PUBLIC_API_URL` points to production Cloud Run
  - No hardcoded credentials in Vercel dashboard
  - Screenshot: _________________

- [ ] **Build succeeds on Vercel**
  - Evidence: Vercel deployment log
  - Expected: Build time < 5 minutes, no errors
  - Deployment URL: _________________

### GCP Cloud Run

- [ ] **All services deployed successfully**
  - Services: api-gateway, agent-orchestrator, graphrag-api (optional)
  - Command: `gcloud run services list --region=us-central1`
  - Expected: All services status "Ready"

- [ ] **Services use VPC connector (private networking)**
  - Command: `gcloud run services describe ln-api-gateway --region=us-central1 --format='value(spec.template.spec.containers[0].vpcConnector)'`
  - Expected: `ln-vpc-connector-beta` or `ln-vpc-connector-prod`

- [ ] **Services have correct IAM bindings**
  - Command: `gcloud run services get-iam-policy ln-api-gateway --region=us-central1`
  - Expected: Service account `ln-api-gateway-{env}@project.iam.gserviceaccount.com`
  - No `allUsers` or overly permissive bindings

### Cloud SQL

- [ ] **No public IPs on databases**
  - Command: `gcloud sql instances list --format="table(name,ipAddresses[0].ipAddress,settings.ipConfiguration.ipv4Enabled)"`
  - Expected: `ipv4Enabled: false` for all instances
  - Verified: _________________

- [ ] **Private networking only**
  - Check: All Cloud SQL connections via Private Service Connect
  - No `35.x.x.x` (public GCP) IPs in connection strings
  - Verified by: _________________ (initials)

- [ ] **Database encryption at rest (CMEK)**
  - Command: `gcloud sql instances describe lifenav-db-hipaa --format='value(diskEncryptionConfiguration.kmsKeyName)'`
  - Expected: KMS key name present (not empty)
  - Key: _________________

### Supabase

- [ ] **Row-Level Security (RLS) enabled**
  - Command: `psql $SUPABASE_DB_URL -c "\d+ patients"`
  - Expected: "Policies (forced row security enabled)"
  - Screenshot: _________________

- [ ] **Service role key rotated (if applicable)**
  - Last rotation: _________________ (date)
  - Next rotation due: _________________ (date)
  - Documentation: _________________

---

## 4. Monitoring & Alerting 🟡 HIGH PRIORITY

### Logging

- [ ] **Structured logging enabled**
  - Check: `backend/app/core/logging.py` uses `structlog`
  - Log format: JSON in production, pretty in dev
  - Test: Check Cloud Logging for JSON logs

- [ ] **Security events logged**
  - Events: AUTH_FAILURE, AUTH_SUCCESS, DATA_ACCESS_PHI, PRIVILEGE_ESCALATION_ATTEMPT
  - Test: Trigger failed login → Check logs
  - Evidence: _________________

- [ ] **Audit logs immutable**
  - Check: `backend/alembic/versions/*_audit_log_immutability.py`
  - Database trigger prevents UPDATE/DELETE on audit tables
  - Test command: `psql $DB_URL -c "DELETE FROM audit_log WHERE id = 1;"`
  - Expected: ERROR (trigger prevents deletion)

### Metrics

- [ ] **Prometheus metrics endpoint active**
  - URL: `https://api.lifenavigator.com/metrics`
  - Expected: 200 OK, Prometheus format output

- [ ] **Key metrics tracked**
  - Metrics: `http_requests_total`, `http_request_duration_seconds`, `db_connection_pool_size`
  - Test: `curl https://api/metrics | grep http_requests_total`
  - Expected: Metrics present

### Alerts

- [ ] **Critical alerts configured**
  - Alerts: High error rate (>5%), Database connection failures, Pod crash loops
  - Channel: PagerDuty or Slack #alerts
  - Test: Trigger test alert
  - Verified: _________________

- [ ] **Break-glass alerts configured**
  - Alert: Emergency access granted (BREAK_GLASS_ACTIVATED)
  - Recipient: security@lifenavigator.com
  - Test: Simulate break-glass request
  - Verified: _________________

---

## 5. Data Protection 🔴 CRITICAL

### Encryption

- [ ] **Field-level encryption active**
  - Check: `backend/app/core/encryption.py` used for ePHI
  - Fields encrypted: SSN, diagnosis notes, health records
  - Test: Query database directly → Verify encrypted blob
  - Evidence: _________________

- [ ] **Encryption keys rotated (if due)**
  - Last rotation: _________________ (date)
  - Rotation frequency: 90 days
  - Next rotation due: _________________ (date)
  - GCP KMS key: _________________

- [ ] **Crypto shredding tested**
  - Test: Delete user → Key destroyed → Data unrecoverable
  - Verified in staging: _________________ (date)
  - Evidence: _________________

### Backups

- [ ] **Automated backups running**
  - Frequency: Daily (Cloud SQL automatic backups)
  - Retention: 7 days
  - Command: `gcloud sql backups list --instance=lifenav-db-hipaa`
  - Expected: Recent backup (< 24 hours)

- [ ] **Backup restore tested (within 90 days)**
  - Last test: _________________ (date)
  - RTO achieved: _________________ (minutes)
  - RPO achieved: _________________ (data loss in minutes)
  - Documentation: `docs/disaster_recovery/RESTORE_RUNBOOK_CLOUDSQL.md`

---

## 6. Compliance 🟡 HIGH PRIORITY

### HIPAA

- [ ] **HIPAA compliance tests passing**
  - Test command: `pytest tests/compliance/hipaa/ -v`
  - Expected: 40+ tests pass (access control, audit logging, data security)

- [ ] **BAA executed with all subprocessors**
  - Subprocessors: GCP, Vercel, Supabase, Plaid, Stripe
  - All BAAs signed and current (< 1 year old)
  - Documentation: `docs/compliance/baa/`

- [ ] **Data retention policies enforced**
  - Health records: 7 years
  - Audit logs: 7 years
  - Check: Automated deletion job running
  - Evidence: _________________

### Security Policies

- [ ] **Security awareness training current**
  - All workforce members completed training within 30 days
  - Training platform: BambooHR + KnowBe4
  - Completion rate: _________________%

- [ ] **Workforce clearance current**
  - Background checks completed for all Tier 4+ users
  - Quarterly access reviews completed
  - Last review: _________________ (date)

---

## 7. Testing 🟡 HIGH PRIORITY

### Unit Tests

- [ ] **Backend unit tests passing**
  - Test command: `pytest backend/tests/ -v --cov=app --cov-report=term`
  - Expected: Coverage > 80%, all tests pass
  - Coverage: _________________%

- [ ] **Frontend unit tests passing**
  - Test command: `pnpm test`
  - Expected: All tests pass
  - Test count: _________________

### Integration Tests

- [ ] **API integration tests passing**
  - Test command: `pytest tests/integration/ -v`
  - Expected: All endpoints return correct responses
  - Test coverage: _________________

- [ ] **End-to-end tests passing (if applicable)**
  - Test command: `playwright test` or equivalent
  - Expected: Critical user flows work
  - Tests run: _________________

### Smoke Tests

- [ ] **Health check endpoints responding**
  - Backend: `curl https://api.lifenavigator.com/health`
  - Expected: `{"status": "healthy", "version": "..."}`

- [ ] **Authentication flow working**
  - Test: Login → Get token → Access protected endpoint
  - Expected: 200 OK responses
  - Verified: _________________

- [ ] **Database connectivity verified**
  - Test: Query database via API
  - Expected: Data returned successfully
  - Verified: _________________

---

## 8. Performance 🟢 MEDIUM PRIORITY

### Load Testing

- [ ] **API can handle expected load**
  - Tool: k6, Locust, or JMeter
  - Target: 1000 concurrent users, < 500ms p95 latency
  - Results: _________________

- [ ] **Database query performance acceptable**
  - Tool: pg_stat_statements
  - Target: No queries > 1 second
  - Slow queries identified: _________________

### Caching

- [ ] **Redis caching operational**
  - Check: Redis connection in Cloud Memorystore
  - Test: Cache hit rate > 50% for read-heavy endpoints
  - Evidence: _________________

---

## 9. Documentation 📝 MEDIUM PRIORITY

### User Documentation

- [ ] **API documentation up-to-date**
  - URL: `https://api.lifenavigator.com/docs`
  - Expected: Swagger/OpenAPI docs accurate

- [ ] **Deployment guide current**
  - File: `docs/deployment/DEPLOYMENT_GUIDE.md`
  - Last updated: _________________ (within 30 days)

### Operations Documentation

- [ ] **Incident response plan accessible**
  - File: `docs/incident_response/INCIDENT_RESPONSE.md`
  - Team trained on procedures: _________________ (date)

- [ ] **Disaster recovery runbook tested**
  - File: `docs/disaster_recovery/RESTORE_RUNBOOK_CLOUDSQL.md`
  - Last DR drill: _________________ (date)

---

## 10. Sign-Off 🔴 REQUIRED

### Technical Sign-Off

- [ ] **Platform Lead approval**
  - Name: _________________
  - Signature: _________________
  - Date: _________________

- [ ] **Security Officer approval**
  - Name: _________________
  - Signature: _________________
  - Date: _________________

### Business Sign-Off

- [ ] **Product Manager approval**
  - Name: _________________
  - Signature: _________________
  - Date: _________________

### Final Deployment Authorization

- [ ] **All CRITICAL (🔴) items completed**
- [ ] **All HIGH (🟡) items completed or documented exceptions**
- [ ] **Rollback plan documented**
  - File: `docs/deployment/ROLLBACK_PLAN.md`
  - Estimated rollback time: _________________ (minutes)

**Authorized for production deployment:** YES / NO

**Deployed by:** _________________
**Deployment timestamp:** _________________
**Deployment ticket:** _________________

---

## Post-Deployment Verification

### Immediate (T+0 hours)

- [ ] **Deployment successful (no errors)**
- [ ] **Health checks passing**
- [ ] **Smoke tests executed successfully**
- [ ] **No critical alerts triggered**

### T+1 hour

- [ ] **Error rate within baseline (< 1%)**
- [ ] **Latency within SLA (p95 < 500ms)**
- [ ] **No customer complaints**

### T+24 hours

- [ ] **System stable (no rollback required)**
- [ ] **Metrics dashboard reviewed**
- [ ] **Security logs reviewed (no suspicious activity)**
- [ ] **Post-deployment report created**

---

## Rollback Procedure (If Needed)

**Trigger conditions:**
- Error rate > 5%
- Any CRITICAL security vulnerability discovered
- Data integrity issue detected
- Customer-impacting bug

**Rollback steps:**
1. Execute: `./scripts/rollback-deployment.sh --version=<previous-version>`
2. Verify: Health checks passing
3. Notify: Stakeholders via Slack #incidents
4. Document: Incident post-mortem

**Rollback time:** _________________ (estimate)
**Previous stable version:** _________________

---

**Document Version:** 1.0
**Last Updated:** 2026-01-09
**Next Review:** Before each production deployment
