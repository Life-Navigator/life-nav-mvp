# Security Implementation Quick Start Guide

**For:** Developers, DevOps, Security Team
**Last Updated:** 2026-01-09

---

## 🚀 New Developer Setup (15 minutes)

### Step 1: Run Automated Setup

```bash
cd /home/riffe007/Documents/projects/life-navigator-monorepo

# One command to set up everything
./scripts/setup-dev-env.sh
```

This script will:
- ✅ Install pre-commit hooks (blocks secrets, enforces linting)
- ✅ Install detect-secrets (scans for API keys)
- ✅ Generate secrets baseline
- ✅ Install Node dependencies (pnpm)
- ✅ Install Python dependencies (Poetry)
- ✅ Create `.env` files from templates

### Step 2: Verify Setup

```bash
# Check pre-commit is working
pre-commit --version

# Run all hooks manually (should pass)
pre-commit run --all-files

# Test secret detection (should BLOCK)
echo "export AWS_KEY=AKIAIOSFODNN7EXAMPLE" > test.sh
git add test.sh
git commit -m "test"  # Should fail ✅

# Clean up
rm test.sh
git reset HEAD
```

### Step 3: Start Development

```bash
# Start backend
cd backend
poetry run uvicorn app.main:app --reload

# Start frontend (separate terminal)
cd apps/web
pnpm dev
```

---

## 🔒 Security Controls Overview

### 1. Container Scanning (Trivy)

**What it does:** Scans all Docker images for vulnerabilities before deployment

**Affected images:**
- Web app
- Backend API
- API Gateway (Cloud Run)
- Agent Orchestrator (Cloud Run)
- GraphRAG API (Cloud Run)

**When it runs:** Every git push, automatic in CI

**How to test locally:**
```bash
# Build image
docker build -t test-image:latest ./backend

# Scan for vulnerabilities
trivy image test-image:latest --severity CRITICAL,HIGH --exit-code 1

# Expected: Exit code 0 (no vulnerabilities)
```

**If build fails:** Check GitHub Actions → Trivy results → Fix vulnerabilities or document exceptions

---

### 2. SAST (Static Analysis)

**What it does:** Scans code for security vulnerabilities (SQL injection, XSS, etc.)

**Tools:** Semgrep + CodeQL

**When it runs:** Every git push, weekly

**How to test locally:**
```bash
# Install Semgrep
pip install semgrep

# Scan backend
semgrep --config "p/security-audit" backend/app/

# Scan frontend
semgrep --config "p/typescript" apps/web/src/
```

**If findings appear:** Review GitHub Security → Code scanning → Fix or dismiss with justification

---

### 3. Secrets Scanning

**What it does:** Prevents committing API keys, passwords, tokens to Git

**When it runs:** Pre-commit hook (every `git commit`)

**What's detected:**
- AWS keys (`AKIA...`)
- API keys (high entropy strings)
- Private keys (RSA, SSH)
- Database URLs with passwords
- GitHub tokens, Stripe keys, etc.

**If commit is blocked:**
```bash
# Option 1: Remove the secret
vim <file-with-secret>
# Replace with environment variable: ${API_KEY}

# Option 2: Add to baseline (if false positive)
detect-secrets scan --baseline .secrets.baseline
detect-secrets audit .secrets.baseline
# Mark as false positive in interactive mode
```

**Manual scan:**
```bash
detect-secrets scan --all-files --baseline .secrets.baseline
```

---

### 4. Input Validation

**What it does:** Validates all API inputs to prevent injection attacks

**Location:** `backend/app/schemas/validation.py`

**Key validators:**

| Use Case | Validator | Example |
|----------|-----------|---------|
| Patient names | `StrictPatientName` | `{"first_name": "John", "last_name": "Doe"}` |
| Medical Record # | `MedicalRecordNumber` | `{"mrn": "MRN1234567"}` |
| Diagnosis codes | `DiagnosisCode` | `{"code": "E11.9", "description": "..."}` |
| Search queries | `SafeSearchQuery` | `{"query": "diabetes treatment"}` |
| File uploads | `SafeFileUpload` | `{"filename": "report.pdf", "size_bytes": 1024}` |

**How to use:**
```python
from app.schemas.validation import StrictPatientName, SafeSearchQuery

@router.post("/patients")
async def create_patient(patient: StrictPatientName):
    # Input already validated - safe to use
    # patient.first_name is guaranteed to:
    # - Not contain SQL injection
    # - Not contain XSS
    # - Match allowed pattern
    ...
```

**Testing:**
```bash
cd backend
pytest tests/api/test_input_validation.py -v

# Expected: 100+ tests pass
```

---

### 5. CSRF Protection

**What it does:** Prevents Cross-Site Request Forgery attacks on state-changing operations

**Protected methods:** POST, PUT, DELETE, PATCH

**Exempt methods:** GET, HEAD, OPTIONS (safe methods)

**How it works:**
1. Frontend requests CSRF token: `GET /api/csrf-token`
2. Token stored in cookie (HttpOnly, SameSite)
3. Frontend includes token in header: `X-CSRF-Token: <token>`
4. Backend validates token matches cookie + has valid signature

**Frontend integration:**
```typescript
// 1. Get CSRF token
const response = await fetch('/api/csrf-token')
const { csrf_token } = await response.json()

// 2. Include in POST/PUT/DELETE requests
fetch('/api/v1/patients', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-CSRF-Token': csrf_token  // Required!
  },
  body: JSON.stringify(patientData)
})
```

**Testing:**
```bash
cd backend
pytest tests/test_csrf.py -v

# Expected: 30+ tests pass
```

**Troubleshooting:**
```bash
# If getting 403 errors on POST:
# 1. Check token is in header: X-CSRF-Token
# 2. Check cookie is sent with request
# 3. Check token matches cookie
# 4. Check endpoint is not in exempt list
```

---

## 📋 Production Deployment Checklist

### Before Deploying

1. **Run full test suite:**
```bash
# Backend tests
cd backend
pytest tests/ -v --cov=app

# Frontend tests
cd apps/web
pnpm test

# Expected: All tests pass, coverage > 80%
```

2. **Verify CI is green:**
- GitHub Actions → All workflows passing
- Security → Code scanning → No CRITICAL alerts

3. **Complete release checklist:**
```bash
# Copy template
cp docs/deployment/RELEASE_CANDIDATE_CHECKLIST.md \
   docs/deployment/releases/RELEASE_$(date +%Y-%m-%d).md

# Fill in all items marked 🔴 CRITICAL
# Document evidence (links, screenshots)
# Get required sign-offs
```

4. **Verify security controls:**
```bash
# Container scanning
# Check: GitHub Actions → Trivy results → 0 CRITICAL

# Secrets scanning
detect-secrets scan --all-files --baseline .secrets.baseline
# Expected: Exit code 0

# SAST
# Check: GitHub Security → Code scanning → Semgrep/CodeQL results

# Input validation
pytest tests/api/test_input_validation.py -v
# Expected: All pass

# CSRF
pytest tests/test_csrf.py -v
# Expected: All pass
```

### Post-Deployment

5. **Smoke tests:**
```bash
# Health check
curl https://api.lifenavigator.com/health
# Expected: {"status": "healthy"}

# Auth flow
curl -X POST https://api.lifenavigator.com/api/v1/auth/login \
  -d '{"email": "test@example.com", "password": "testpass"}'
# Expected: 200 OK with token

# Protected endpoint (with CSRF)
TOKEN=$(curl -s https://api.lifenavigator.com/csrf-token | jq -r '.csrf_token')
curl -X POST https://api.lifenavigator.com/api/v1/patients \
  -H "X-CSRF-Token: $TOKEN" \
  -d '{"first_name": "John", "last_name": "Doe"}'
# Expected: 201 Created
```

6. **Monitor for 1 hour:**
- Error rate < 1%
- Latency p95 < 500ms
- No CRITICAL alerts
- Check logs for security events

---

## 🔥 Emergency Procedures

### Rollback Deployment

```bash
# If error rate > 5% or CRITICAL security issue:
./scripts/rollback-deployment.sh --version=<previous-stable-version>

# Verify health checks
curl https://api.lifenavigator.com/health

# Notify stakeholders
# Slack: #incidents
# Email: security@lifenavigator.com

# Create post-mortem
cp docs/incident_response/POST_MORTEM_TEMPLATE.md \
   docs/incident_response/incidents/$(date +%Y-%m-%d)-incident.md
```

### Disable Security Control (Emergency)

**Trivy (if blocking builds):**
```yaml
# Edit .github/workflows/ci.yml
# Change: exit-code: '1' → exit-code: '0'
# OR add: continue-on-error: true
```

**Pre-commit hooks (if blocking commits):**
```bash
# Bypass once (use sparingly)
git commit --no-verify -m "urgent fix"

# OR disable permanently
pre-commit uninstall
```

**CSRF (if breaking API clients):**
```python
# Edit backend/app/main.py
# Comment out:
# app.add_middleware(CSRFMiddleware, ...)

# OR add paths to exempt list:
exempt_paths={"/api/client/*"}
```

**Input validation (if rejecting legitimate data):**
```python
# Edit backend/app/schemas/validation.py
# Temporarily relax specific validator
# Example: Allow all characters in names
SAFE_NAME_PATTERN = re.compile(r'^.+$')  # TEMPORARY - document why

# Redeploy backend
```

---

## 📚 Additional Resources

### Documentation
- **Full implementation guide:** `docs/security/3_DAY_SECURITY_IMPLEMENTATION_SUMMARY.md`
- **Day 1 (CI/CD):** `docs/security/DAY1_CI_SECURITY_IMPLEMENTATION.md`
- **Release checklist:** `docs/deployment/RELEASE_CANDIDATE_CHECKLIST.md`
- **Security audit:** `docs/security/ENTERPRISE_SECURITY_AUDIT_2026.md`

### Code References
- **Input validation:** `backend/app/schemas/validation.py`
- **CSRF middleware:** `backend/app/middleware/csrf.py`
- **Validation tests:** `backend/tests/api/test_input_validation.py`
- **CSRF tests:** `backend/tests/test_csrf.py`

### External Tools
- **Trivy:** https://aquasecurity.github.io/trivy/
- **Semgrep:** https://semgrep.dev/
- **detect-secrets:** https://github.com/Yelp/detect-secrets
- **CodeQL:** https://codeql.github.com/

### Support
- **Security questions:** security@lifenavigator.com
- **Incident response:** #incidents (Slack)
- **Documentation issues:** Create PR or issue in GitHub

---

## ✅ Quick Verification Checklist

Use this checklist to verify your local environment is set up correctly:

- [ ] Pre-commit hooks installed (`pre-commit --version`)
- [ ] Secrets scanning working (test by trying to commit a secret)
- [ ] Backend tests passing (`pytest tests/ -v`)
- [ ] Frontend tests passing (`pnpm test`)
- [ ] Can build Docker images locally (`docker build -t test:latest ./backend`)
- [ ] Trivy scanning works (`trivy image test:latest`)
- [ ] Environment files created (`backend/.env`, `apps/web/.env.local`)
- [ ] Backend starts successfully (`uvicorn app.main:app`)
- [ ] Frontend starts successfully (`pnpm dev`)
- [ ] Can access docs (`docs/security/SECURITY_QUICKSTART.md` - you're here!)

**All checked?** You're ready to develop securely! 🎉

---

**Questions?** Contact the security team or check the comprehensive guides in `docs/security/`.
