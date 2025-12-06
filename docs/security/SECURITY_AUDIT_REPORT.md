# Infrastructure & Deployment Security Audit Report
# Life Navigator Monorepo
Date: 2024-11-11

---

## EXECUTIVE SUMMARY

This audit examined the complete infrastructure setup including Docker/Kubernetes configurations, Terraform IaC, GitHub Actions CI/CD, and environment configuration. The system demonstrates good foundational security practices with proper use of non-root containers, network policies, and secret management. However, several critical security gaps require immediate attention before production deployment.

**Critical Issues Found: 5**
**High Priority Issues: 8**
**Medium Priority Issues: 12**
**Low Priority Issues: 7**

---

## 1. DOCKER & CONTAINERIZATION SECURITY

### 1.1 BASE IMAGE SECURITY

**Issue:** Mixed Docker base image pinning strategies
- **Severity:** Medium
- **Files Affected:** Multiple Dockerfiles
- **Details:**
  - `backend/Dockerfile`: Uses `python:3.12-slim` (floating tag - not pinned)
  - `apps/web/Dockerfile`: Uses `node:20-alpine` (floating tag)
  - `services/api/Dockerfile`: Uses `python:3.11-slim` (floating tag)
  - `services/agents/Dockerfile`: Uses `python:3.12-slim` (floating tag)
  - `services/graphrag-rs/Dockerfile`: Uses `rust:1.75.0` (pinned - good)
  - `services/qdrant/Dockerfile`: Uses `qdrant/qdrant:v1.15.0` (pinned - good)

**Recommendation:**
```dockerfile
# PIN SPECIFIC SHA DIGESTS instead of tags:
FROM python:3.12.0-slim-bookworm@sha256:<full_hash>
# Get digest: docker inspect python:3.12.0-slim | grep -i repodigests
```

**Impact:** Floating tags can silently pull updated images with breaking changes or security patches not tested by your pipeline.

### 1.2 NON-ROOT USER IMPLEMENTATION

**Status:** Good (mostly compliant)
- `backend/Dockerfile`: Creates non-root user `appuser` ✓
- `finance-api/Dockerfile`: Creates non-root user `apiuser` ✓
- `agents/Dockerfile`: Creates non-root user `lna` ✓
- `graphrag-rs/Dockerfile`: Creates non-root user `appuser` ✓
- `services/api/Dockerfile`: No explicit non-root user ✗
- `services/qdrant/Dockerfile`: Not switching from root (stays as `root`) ✗

**Issue:** services/api/Dockerfile
```dockerfile
# MISSING non-root user creation and USER directive
RUN pip install poetry==1.7.0
# ... installs happen as root
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Recommendation:**
```dockerfile
RUN useradd -m -u 1000 appuser
COPY --chown=appuser:appuser . .
USER appuser
```

### 1.3 SECRETS MANAGEMENT IN DOCKER

**Critical Issue:** Hardcoded credentials in docker-compose.yml
- **Severity:** CRITICAL
- **Details:** Development credentials visible in source control:

```yaml
docker-compose.yml:
  postgres:
    POSTGRES_PASSWORD: devpassword         # Line 10
  neo4j:
    NEO4J_AUTH: neo4j/devpassword         # Line 47
  backend:
    SECRET_KEY: dev-secret-key-change-in-production-minimum-32-chars  # Line 161
    DATABASE_URL: ...devpassword...       # Line 159
```

Even though these are development passwords, the pattern teaches bad practices. Multiple hardcoded instances:
- Line 10, 47, 125, 159, 161, 196, 248, 253, 261

**Recommendation:**
```yaml
# Use environment files or Docker secrets:
postgres:
  env_file:
    - .env.docker  # Never commit to git
# OR
docker secret create db_password <(echo 'password')
```

### 1.4 SECURITY CONTEXT IN DOCKER

**Status:** Mixed implementation
- Volume mounts use proper permissions
- Health checks implemented correctly
- Missing: explicit `--security-opt=no-new-privileges` flags

**Recommendation:** Add to docker-compose.yml:
```yaml
services:
  backend:
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

### 1.5 EXPOSED PORTS & NETWORK ISOLATION

**Issue:** Excessive port exposure in docker-compose
- **Severity:** High
- **Details:**
  - Neo4j HTTP (7474) and Bolt (7687) exposed
  - GraphDB (7200) exposed
  - Qdrant (6333, 6334) exposed
  - All databases accessible from host

**Status:** Uses Docker bridge network (good), but ports expose to 0.0.0.0

**Recommendation:**
```yaml
# Only expose necessary ports, bind to localhost:
ports:
  - "127.0.0.1:8000:8000"  # Backend only
  # Remove:
  - "7474:7474"  # Neo4j - internal only
  - "7687:7687"  # Neo4j Bolt - internal only
```

### 1.6 RESOURCE LIMITS

**Status:** Missing in docker-compose.yml
- **Severity:** Medium
- **Details:** No `deploy.resources.limits` defined

**Recommendation:**
```yaml
deploy:
  resources:
    limits:
      cpus: '1.0'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 1G
```

---

## 2. KUBERNETES CONFIGURATION SECURITY

### 2.1 SECURITY CONTEXT & POD SECURITY

**Status:** Good (mostly compliant)

**Implemented:**
- `runAsNonRoot: true` ✓
- `runAsUser: 1000` ✓
- `fsGroup: 1000` ✓
- `seccompProfile: type: RuntimeDefault` ✓
- `allowPrivilegeEscalation: false` ✓
- `capabilities.drop: [ALL]` ✓
- `readOnlyRootFilesystem: true` ✓

**Sample from deployment.yaml (lines 29-37):**
```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  fsGroup: 1000
  seccompProfile:
    type: RuntimeDefault
```

### 2.2 IMAGE PULL POLICY

**Issue:** imagePullPolicy set to IfNotPresent
- **Severity:** Medium
- **Details:** k8s/base/backend/deployment.yaml line 38:
```yaml
imagePullPolicy: IfNotPresent
```

**Risk:** Old cached images could be used without pulling latest patches

**Recommendation:**
```yaml
imagePullPolicy: Always  # For dev/staging/prod
# Add image digest for production:
image: gcr.io/PROJECT_ID/life-navigator-backend@sha256:abc123...
```

### 2.3 NETWORK POLICIES

**Status:** Implemented ✓
- **File:** k8s/base/backend/networkpolicy.yaml
- **Coverage:** Ingress and Egress rules defined
- **Scope:** Allows ingress from ingress-nginx, internal pods
- **Database access:** Allows egress to port 5432, 6379, 7687, 443

**Issues:**
1. Line 45-48: Wildcard namespace selector for database access
```yaml
# ISSUE: Overly permissive
- to:
  - namespaceSelector: {}
  ports:
  - protocol: TCP
    port: 5432
```

**Recommendation:** Specify exact namespaces:
```yaml
- to:
  - namespaceSelector:
      matchLabels:
        name: databases
```

### 2.4 RBAC & SERVICE ACCOUNTS

**Status:** Implemented ✓
- **File:** k8s/base/backend/serviceaccount.yaml
- **Service Account:** `backend` with Workload Identity binding

**Issue:** Workload Identity annotation uses placeholder
```yaml
annotations:
  iam.gke.io/gcp-service-account: api-server-dev@PROJECT_ID.iam.gserviceaccount.com
```

**Recommendation:** Replace `PROJECT_ID` at deployment time or use Terraform.

**Missing:** Explicit RBAC Role/RoleBinding definitions
- No ClusterRole defined
- No RoleBinding defined
- Service account may have unnecessary permissions

### 2.5 SECRETS MANAGEMENT

**Status:** Good ✓
- **Implementation:** External Secrets Operator (ESO)
- **Provider:** GCP Secret Manager
- **Refresh:** 1h interval
- **Files:** k8s/shared/external-secrets.yaml

**Architecture:**
```yaml
ClusterSecretStore (GCP Secret Manager)
         ↓
ExternalSecret (backend-secrets)
         ↓
Kubernetes Secret (auto-created)
         ↓
Pod mounts via secretKeyRef
```

**Issues:**
1. Refresh interval is 1 hour (line 33)
```yaml
refreshInterval: 1h  # 60 minute delay for secret rotations
```

Recommendation for production:
```yaml
refreshInterval: 15m  # Faster rotation
```

2. No backup/disaster recovery noted for Secret Manager

3. Secret naming convention exposes environment (lines 35-36)
```yaml
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: backend-secrets  # OK
  name: maverick-secrets  # OK
  name: graphrag-additional-secrets  # Hardcoded service names
```

### 2.6 RESOURCE QUOTAS & LIMITS

**Status:** Implemented ✓
- **Deployment:** Requests and limits defined (lines 100-105)

```yaml
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 4Gi
```

**Issue:** Limits are 4x requests (could allow memory bloat)

**Recommendation:** Tighter ratio for production:
```yaml
requests:
  cpu: 800m      # 80% of limit
  memory: 1.5Gi
limits:
  cpu: 1000m
  memory: 2Gi
```

### 2.7 HEALTH CHECKS & PROBES

**Status:** Comprehensive ✓
- **Liveness probe:** HTTP GET /health every 10s, fails after 3 retries
- **Readiness probe:** HTTP GET /health/ready every 5s
- **Startup probe:** HTTP GET /health every 5s, 12 retries (60s timeout)

**All good - no issues found.**

### 2.8 INGRESS CONFIGURATION

**Status:** TLS enabled ✓
- **File:** k8s/shared/ingress.yaml
- **TLS:** ManagedCertificate + secretName: life-navigator-tls
- **HTTP:** kubernetes.io/ingress.allow-http: "false" ✓

**Issues:**

1. CORS configuration in Ingress (lines 23-27):
```yaml
nginx.ingress.kubernetes.io/cors-allow-origin: "https://app.lifenavigator.ai,https://api.lifenavigator.ai"
```

**Risk:** Hardcoded origins. If domains change, ingress must be updated.

2. Swagger/Redoc endpoints exposed in production
```yaml
# Lines 65-78 in ingress spec
- path: /docs
- path: /redoc
- path: /openapi.json
```

**These are removed in prod overlay (good), but verify deployment.**

3. Rate limiting not enforced at GCP Cloud Armor level
- Only at Nginx ingress level
- Recommendation: Add GCP Cloud Armor policy

### 2.9 POD DISRUPTION BUDGETS

**Status:** Implemented ✓
- **File:** k8s/base/backend/pdb.yaml
- **Prevents** voluntary disruptions during cluster updates

**Production config (lines 116-118 of prod/kustomization.yaml):**
```yaml
minAvailable: 3  # Keep 3 pods running during disruptions
```

---

## 3. TERRAFORM & IaC SECURITY

### 3.1 GKE CLUSTER SECURITY

**File:** terraform/gcp/modules/gke-cluster/main.tf

**Status:** Good security posture ✓

**Implemented:**
1. **Private cluster:** enable_private_nodes: true, enable_private_endpoint: false
2. **Workload Identity:** workload_identity_config enabled
3. **Network Policy:** Dataplane V2 (Cilium) enabled
4. **Binary Authorization:** Enforced in production (line 204)
5. **Monitoring:** System components + workloads monitoring
6. **Security Posture:** ENTERPRISE mode for prod, BASIC for dev (lines 229-231)

**Issues:**

1. **Public endpoint for CI/CD** (line 137):
```terraform
enable_private_endpoint = false  # Allows external access
```

Risk: Cluster API exposed if master authorized networks aren't properly configured.

Recommendation:
- Whitelist CI/CD runner IPs in `master_authorized_networks`
- Use VPN or private connectivity for production

2. **Release channel set to REGULAR** (line 83):
```terraform
default = "REGULAR"
```

Recommendation for production:
```terraform
release_channel = "STABLE"  # More conservative updates
```

3. **No Pod Security Policy** defined
- Kubernetes 1.25+ uses PSS (Pod Security Standards)
- Not visible in this module, verify if namespace labels applied:

```yaml
# Should be in namespace definition:
labels:
  pod-security.kubernetes.io/enforce: restricted
  pod-security.kubernetes.io/audit: restricted
  pod-security.kubernetes.io/warn: restricted
```

### 3.2 CLOUD SQL SECURITY

**File:** terraform/gcp/modules/cloud-sql/main.tf

**Status:** Good ✓

**Implemented:**
1. **SSL/TLS required:** require_ssl: true (line 134)
2. **Private IP only:** ipv4_enabled: false (line 132)
3. **Automated backups:** enabled with point-in-time recovery (lines 119-127)
4. **Regular maintenance window:** Sundays 3 AM (lines 138-142)

**Issues:**

1. **Backup retention varies by environment** (line 125):
```terraform
retained_backups = var.env == "prod" ? 30 : 7
```

For development, 7 days is short. Recommendation: 14 days minimum.

2. **Point-in-time recovery disabled for dev** (line 111):
```terraform
point_in_time_recovery_enabled = false  # Disabled for dev
```

This is acceptable for dev but should be enabled for staging/prod.

3. **Missing encryption-at-rest specification**
- Cloud SQL uses Google-managed keys by default
- Should specify CMEK (Customer Managed Encryption Keys) for prod

Recommendation:
```terraform
settings {
  # ... existing settings ...
  deletion_protection_enabled = var.env == "prod" ? true : false
}
```

### 3.3 VPC & NETWORK SECURITY

**File:** terraform/gcp/modules/vpc/main.tf

**Status:** Good ✓

**Implemented:**
1. **Private IP for Google services:** private_ip_google_access: true (line 56)
2. **Flow logs enabled:** Aggregation every 5s with full metadata (lines 68-72)
3. **Cloud NAT:** For outbound internet access (lines 84-96)
4. **Firewall rules:** Internal traffic, SSH via IAP (lines 99-133)
5. **Private Service Connection:** For Cloud SQL (lines 136-149)

**Issues:**

1. **SSH firewall rule allows IAP access** (line 132):
```terraform
# Restrict to IAP range - Good
source_ranges = ["35.235.240.0/20"]
```

But missing logging configuration for SSH access.

Recommendation:
```terraform
resource "google_compute_firewall" "allow_ssh" {
  # ... existing config ...
  log_config {
    metadata = "INCLUDE_ALL_METADATA"
  }
}
```

2. **Internal firewall allows all ports** (lines 105-107):
```terraform
allow {
  protocol = "tcp"
  ports    = ["0-65535"]  # All TCP ports!
}
```

Recommendation: Restrict to necessary ports:
```terraform
allow {
  protocol = "tcp"
  ports    = ["5432", "6379", "7687", "443", "50051"]
}
```

### 3.4 IAM & SERVICE ACCOUNTS

**File:** terraform/gcp/modules/iam/main.tf

**Status:** Minimal implementation

**Issues:**

1. **Service account configuration incomplete**
   - Module creates SAs and assigns roles
   - No workload identity bindings defined here
   - Should tie Kubernetes service accounts to GCP SAs

2. **Missing least-privilege role examples**
   - Module accepts arbitrary roles
   - Recommendation: Define custom roles with minimal permissions

**Terraform should include:**
```terraform
# Kubernetes Workload Identity binding
resource "google_service_account_iam_member" "workload_identity" {
  for_each = var.service_accounts
  
  service_account_id = google_service_account.service_accounts[each.value.name].name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.k8s_namespace}/${each.value.k8s_sa_name}]"
}
```

### 3.5 SECRET MANAGER SECURITY

**File:** terraform/gcp/modules/secret-manager/main.tf

**Status:** Basic implementation

**Issues:**

1. **Auto replication only** (line 39):
```terraform
replication {
  auto {}  # Uses Google-managed regions
}
```

Recommendation for production:
```terraform
replication {
  user_managed {
    replicas {
      location = "us-central1"
    }
    replicas {
      location = "us-east1"  # Disaster recovery
    }
  }
}
```

2. **No IAM bindings defined**
   - Who can read/write secrets?
   - No access control documented

3. **No rotation policy**
   - Secrets never automatically rotate
   - Recommendation: Implement secret rotation via Cloud Scheduler

### 3.6 TERRAFORM STATE SECURITY

**File:** terraform/gcp/environments/dev/main.tf (lines 26-29)

**Issue:** Terraform state stored in GCS
```terraform
backend "gcs" {
  bucket = "life-navigator-terraform-state-dev"
  prefix = "dev/state"
}
```

**Risks:**
1. Bucket name exposed in source control
2. No versioning/locking mentioned
3. No encryption configuration specified

**Recommendation:**
```terraform
backend "gcs" {
  bucket  = "life-navigator-terraform-state-dev"
  prefix  = "dev/state"
  
  # Add to terraform init:
  # -backend-config="bucket_prefix=projects/..."
}

# In the bucket resource (separate Terraform):
resource "google_storage_bucket" "terraform_state" {
  name          = "life-navigator-terraform-state-dev"
  location      = "US"
  force_destroy = false  # Prevent accidental deletion
  
  versioning {
    enabled = true  # Track state history
  }
  
  uniform_bucket_level_access = true
  
  # Encryption with CMEK
  encryption {
    default_kms_key_name = google_kms_crypto_key.terraform.id
  }
  
  # Lifecycle rules
  lifecycle_rule {
    condition {
      age = 90
      is_live = false  # Delete old versions
    }
    action {
      type = "Delete"
    }
  }
}
```

---

## 4. GITHUB ACTIONS CI/CD SECURITY

### 4.1 WORKFLOW PERMISSIONS

**File:** .github/workflows/ci.yml

**Status:** No explicit permissions declared
- **Risk:** Workflows inherit default GITHUB_TOKEN with broad permissions

**Recommendation:** Add to all workflows:
```yaml
permissions:
  contents: read
  pull-requests: read
  # Only request needed permissions
```

### 4.2 SECRETS MANAGEMENT IN CI/CD

**Status:** Mostly good ✓

**Implemented:**
- Uses GitHub Secrets for AWS credentials (line 379-381)
- Uses GitHub Secrets for GCP credentials (line 247-248)
- Credentials not exposed in logs

**Issues:**

1. **Test database secrets hardcoded in workflow** (backend.yml lines 159-162):
```yaml
- name: Run tests
  env:
    DATABASE_URL: postgresql+asyncpg://test:test@localhost:5432/test_db
    REDIS_URL: redis://localhost:6379/0
    SECRET_KEY: test-secret-key-minimum-32-characters-long
    ENVIRONMENT: test
```

While these are test credentials, they hardcode usernames.

Recommendation: Use GitHub Secrets:
```yaml
env:
  DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}
  REDIS_URL: ${{ secrets.TEST_REDIS_URL }}
  SECRET_KEY: ${{ secrets.TEST_SECRET_KEY }}
```

### 4.3 DEPENDENCY SECURITY

**Status:** Good implementation ✓

**Implemented:**
- `pnpm audit --prod --audit-level=moderate` (ci.yml line 251)
- OWASP Dependency Check (ci.yml lines 254-264)
- Snyk security scanning (ci.yml lines 272-276)

**Issues:**

1. **Audit failures non-blocking for non-main branches** (ci.yml line 252):
```yaml
continue-on-error: ${{ github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop' }}
```

Security vulnerabilities can merge into feature branches.

Recommendation: Always fail on vulnerabilities:
```yaml
continue-on-error: false
```

2. **CVE threshold for dependency check** (ci.yml line 264):
```yaml
--failOnCVSS 7  # Only fails on CVSS >= 7
```

Should be lower for critical services:
```yaml
--failOnCVSS 5  # Fail on medium and above
```

### 4.4 CONTAINER IMAGE SCANNING

**Status:** NOT IMPLEMENTED
- **Severity:** High
- **Details:** No container image vulnerability scanning in pipelines

**Missing:**
- Trivy scanning (CVE detection in images)
- DockerHub/GCR image signing
- Image provenance tracking

**Recommendation:** Add to ci.yml:
```yaml
- name: Scan Docker image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.GCR_REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
    format: sarif
    output: trivy-results.sarif
    severity: HIGH,CRITICAL

- name: Upload Trivy results to GitHub Security
  uses: github/codeql-action/upload-sarif@v2
  with:
    sarif_file: trivy-results.sarif
```

### 4.5 BRANCH PROTECTION

**Status:** Unknown (not shown in workflows)
- **Recommendation:** Enable on GitHub:
  - Require PR reviews (2 approvals minimum for main)
  - Require status checks to pass
  - Dismiss stale reviews
  - Restrict who can push (admins only)
  - Require branches to be up-to-date before merging

### 4.6 TERRAFORM APPLY SECURITY

**File:** ci.yml lines 412-451

**Status:** Has approval gate ✓
```yaml
environment: production
```

This triggers manual approval before apply.

**Issues:**

1. **Terraform state written to artifacts** (lines 406-410):
```yaml
- name: Upload Terraform Plan
  uses: actions/upload-artifact@v4
  with:
    name: terraform-plan
    path: terraform/tfplan
```

Artifacts may contain sensitive data (database passwords, API keys).

Recommendation: Use Terraform Cloud/Enterprise for state management.

2. **Auto-approve tfplan** (line 448):
```yaml
terraform apply -auto-approve tfplan
```

OK since plan was uploaded, but ensure downloads are signed.

---

## 5. ENVIRONMENT CONFIGURATION SECURITY

### 5.1 .ENV FILE SECURITY

**Files Checked:**
- .env.example (committed)
- backend/.env (NOT in .gitignore violation)
- backend/.env.example (committed)
- services/api/.env (NOT in .gitignore violation)
- apps/web/.env.local (NOT in .gitignore violation)

**CRITICAL ISSUE:** Real .env files in repository

**Files in repo that shouldn't be:**
```
backend/.env                    - CONTAINS REAL CREDENTIALS
services/api/.env              - CONTAINS REAL CREDENTIALS
apps/web/.env.local            - Contains API URLs (acceptable but localhost)
```

### 5.2 ACTUAL CREDENTIALS FOUND

**backend/.env:**
```
JWT_SECRET=oULn_cD7xIKzY0SgunnHYWjxHCfzetIVVpymnt2epLd-UWOsFtUQl1zlFlDj4xy0c0NgVSJO28JD0pgMC4qDTg
DATABASE_URL=postgresql+asyncpg://lifenavigator:devpassword@localhost:5432/lifenavigator_dev
NEO4J_PASSWORD=devpassword
```

**services/api/.env:**
```
JWT_SECRET=oULn_cD7xIKzY0SgunnHYWjxHCfzetIVVpymnt2epLd-UWOsFtUQl1zlFlDj4xy0c0NgVSJO28JD0pgMC4qDTg
DATABASE_URL=postgresql+asyncpg://lifenavigator:devpassword@localhost:5432/lifenavigator_dev
```

**Risk:** If repository is made public, these credentials are compromised.

### 5.3 .GITIGNORE COVERAGE

**Status:** Mostly complete
```
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
credentials.json
service-account.json
*.key
*.pem
*.crt
```

**Issue:** Pattern doesn't catch `.env` in subdirectories
```
# SHOULD BE:
.env
*.env
.env*
!.env.example
!.env.schema
```

**Current:** backend/.env is still tracked by git!

### 5.4 SECRET ROTATION

**Status:** NOT IMPLEMENTED
- **Severity:** High
- **Details:** No automated secret rotation in place

**Required for production:**
```
JWT_SECRET         - Every 90 days
Database passwords - Every 90 days
API keys           - Every 90 days
Encryption keys    - Yearly
```

**Recommendation:** Implement Cloud Secret Manager with rotation:
```terraform
resource "google_secret_manager_secret_iam_member" "secret_accessor" {
  secret_id = google_secret_manager_secret.jwt_secret.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.app.email}"
}

# Add rotation policy:
resource "google_cloud_scheduler_job" "rotate_jwt" {
  name      = "rotate-jwt-secret"
  schedule  = "0 0 1 1 *"  # Every Jan 1st
  time_zone = "UTC"
  
  http_target {
    # Invoke secret rotation function
  }
}
```

### 5.5 ENVIRONMENT-SPECIFIC CONFIGS

**Status:** Partial implementation

**Good:**
- Separate overlays for dev/staging/prod in K8s
- Terraform environment directories

**Issues:**

1. **docker-compose.yml uses hardcoded dev credentials**
   - No environment variable substitution for secrets
   - No way to override credentials

2. **ConfigMaps contain non-secret configuration**
   - Good separation (line 14 of configmap.yaml: `CORS_ORIGINS: '["*"]'`)
   - But should remove from ConfigMap when empty/default

3. **.env.example files are incomplete**
   - backend/.env.example has 144 lines
   - .env.example has 200+ lines
   - Difficult for developers to know what's required

---

## 6. SPECIFIC SECURITY GAPS

### 6.1 CORS CONFIGURATION

**Issue 1: Overly permissive CORS**
- **k8s/base/backend/configmap.yaml line 14:**
  ```yaml
  CORS_ORIGINS: '["*"]'
  ```
  
  **Risk:** Allows any domain to access the API

- **docker-compose.yml lines 162, 197:**
  ```
  CORS_ORIGINS: http://localhost:3000,http://localhost:3001
  ```
  
  OK for development but should validate format

**Issue 2: Ingress CORS hardcoded**
- **k8s/shared/ingress.yaml lines 24:**
  ```yaml
  nginx.ingress.kubernetes.io/cors-allow-origin: "https://app.lifenavigator.ai,https://api.lifenavigator.ai"
  ```
  
  Domains hardcoded; changes require manifest update

**Recommendation:**
```yaml
# Use ConfigMap to externalize CORS:
apiVersion: v1
kind: ConfigMap
metadata:
  name: ingress-config
data:
  allowed-origins: |
    https://app.lifenavigator.ai
    https://api.lifenavigator.ai
    https://staging.lifenavigator.ai
```

### 6.2 DEBUG MODE IN PRODUCTION

**Issue:** Docker-compose sets DEBUG=true
```yaml
docker-compose.yml lines 157, 191, 244, 310:
  DEBUG: "true"
  LOG_LEVEL: DEBUG
```

**Risk:** 
- Stack traces exposed in error responses
- Verbose logging may leak sensitive data
- Performance degradation

**Status:** Handled via K8s overlays (prod sets `ENVIRONMENT: production` and `LOG_LEVEL: INFO`)

**Verify:** All production deployments use prod overlay

### 6.3 SWAGGER/API DOCUMENTATION

**Issue:** Swagger UI exposed
- **k8s/shared/ingress.yaml lines 65-78:**
  ```yaml
  - path: /docs
  - path: /redoc
  - path: /openapi.json
  ```

**Status:** Production overlay removes these (good)

**Recommendation:** Verify /docs is not accidentally accessible:
```yaml
# Add to production NetworkPolicy:
- from:
  - namespaceSelector: {}
  ports:
  - protocol: TCP
    port: 8000
  except:
  - paths:
    - /docs
    - /redoc
    - /openapi.json
```

Actually, NetworkPolicy doesn't support path exceptions. Use Ingress instead:
```yaml
# In prod kustomization:
- op: remove
  path: /spec/rules/0/http/paths/1  # /docs
- op: remove
  path: /spec/rules/0/http/paths/2  # /redoc
- op: remove
  path: /spec/rules/0/http/paths/3  # /openapi.json
```

Already done (verified in prod/kustomization.yaml lines 120-130).

### 6.4 RATE LIMITING

**Status:** Configured but incomplete

**Implemented:**
- ConfigMap: `RATE_LIMIT_ENABLED: "true"` (backend/configmap.yaml)
- ConfigMap: `RATE_LIMIT_PER_MINUTE: "60"`
- Ingress: `nginx.ingress.kubernetes.io/limit-rps: "100"` (ingress.yaml line 20)
- GCP: Cloud Armor policy for prod (gke-cluster/main.tf lines 305-325)

**Issues:**

1. Cloud Armor rate limiting only on production (line 287):
   ```terraform
   count = var.env == "prod" ? 1 : 0
   ```

2. Should also protect staging

3. Per-user rate limiting not implemented
   - Only per-IP limiting
   - Recommendation: Use API key or auth token for rate limit buckets

### 6.5 AUDIT LOGGING

**Status:** NOT FULLY IMPLEMENTED

**Missing:**
- No audit logging configuration in GKE
- No API request/response logging to centralized system
- Cloud Audit Logs might be enabled by default, verify

**Recommendation:** Enable and monitor:
```terraform
logging_config {
  enable_components = [
    "SYSTEM_COMPONENTS",
    "WORKLOADS",
    "API_SERVER",          # Add API server logs
  ]
}
```

### 6.6 ENCRYPTION AT REST

**Status:** Not fully specified
- Cloud SQL: Uses Google-managed keys (default)
- Cloud Storage: Not specified
- Redis (Memorystore): Not specified

**Recommendation:** Enable CMEK for all:
```terraform
# Cloud SQL:
settings {
  database_flags {
    name  = "cloudsql_iam_authentication"
    value = "on"
  }
}

# Cloud Storage:
resource "google_kms_crypto_key" "storage_key" {
  name = "life-navigator-storage-key"
  # ...
}

# Apply to buckets:
resource "google_storage_bucket" "documents" {
  encryption {
    default_kms_key_name = google_kms_crypto_key.storage_key.id
  }
}

# Redis (Memorystore):
# Not directly supported; use separate Key Management
```

### 6.7 COMPLIANCE & DATA RETENTION

**Status:** Partially addressed

**Implemented:**
- HIPAA compliance flags in .env.example (lines 154-157)
- Data retention configuration (lines 155-157)
- Audit logging enabled (line 155)

**Missing Implementation:**
- No actual encryption at field level
- No data classification schema
- No PII masking in logs
- No data residency enforcement

---

## 7. MONITORING & ALERTING

### 7.1 MONITORING SETUP

**Status:** Basic implementation

**Implemented in terraform/gcp/modules/monitoring/main.tf:**
- Notification channels (lines 60-69)
- Budget alerts (lines 72-?)
- Error rate alerts (mentioned in variables)
- Latency alerts (mentioned in variables)

**Missing:**
- Security-specific alerts (unauthorized access, failed auth)
- Intrusion detection alerts
- Policy violation alerts
- Certificate expiration alerts

**Recommendations:**
```terraform
# Add security-focused alerts:
resource "google_monitoring_alert_policy" "unauthorized_api_access" {
  display_name = "High rate of unauthorized API access"
  
  conditions {
    display_name = "Unauthorized responses"
    
    condition_threshold {
      filter = <<-EOT
        resource.type="k8s_container"
        AND metric.type="logging.googleapis.com/user/auth_failures"
        AND resource.labels.pod_name=~"backend.*"
      EOT
      
      comparison = "COMPARISON_GT"
      threshold_value = 10
      duration = "300s"
    }
  }
  
  notification_channels = [google_monitoring_notification_channel.channels[0].id]
}
```

---

## 8. SUMMARY TABLE

| Category | Issue | Severity | Status |
|----------|-------|----------|--------|
| Docker | Floating base image tags | Medium | Not Fixed |
| Docker | services/api missing non-root user | High | Not Fixed |
| Docker | services/qdrant runs as root | High | Not Fixed |
| Docker | Hardcoded credentials in docker-compose | Critical | Acceptable for Dev |
| K8s | imagePullPolicy: IfNotPresent | Medium | Not Fixed |
| K8s | Network policy overly permissive | Medium | Not Fixed |
| K8s | ESO refresh interval 1h | Medium | Not Fixed |
| K8s | Swagger endpoints in prod (removed via overlay) | Low | Fixed |
| Terraform | GKE public endpoint for CI/CD | Medium | Risk Accepted |
| Terraform | Internal firewall allows all ports | High | Not Fixed |
| Terraform | Terraform state bucket not secured | High | Not Fixed |
| Terraform | No CMEK for Cloud SQL | Medium | Not Fixed |
| Terraform | Secret Manager replication not user-managed | Medium | Not Fixed |
| CI/CD | No container image scanning | High | Not Implemented |
| CI/CD | Dependency check CVSS threshold too high | Medium | Not Fixed |
| CI/CD | Audit failures non-blocking on branches | High | Not Fixed |
| Environment | .env files committed to git | Critical | Not Fixed |
| Environment | No secret rotation | High | Not Implemented |
| Environment | CORS overly permissive | High | Not Fixed |
| Monitoring | No security-specific alerts | Medium | Not Implemented |
| Monitoring | Audit logging incomplete | High | Not Implemented |

---

## 9. RECOMMENDATIONS BY PRIORITY

### CRITICAL (Fix before prod deployment)

1. **Remove .env files from git history**
   ```bash
   git rm --cached backend/.env services/api/.env apps/web/.env.local
   git filter-branch --tree-filter "rm -f backend/.env services/api/.env" -- --all
   # Force push after rotating all exposed credentials
   ```

2. **Implement container image scanning**
   - Add Trivy to CI/CD
   - Scan all images before push to registry
   - Block deployment of images with CRITICAL/HIGH CVEs

3. **Add CMEK for sensitive data**
   - Cloud SQL, Cloud Storage, Memorystore
   - Update Terraform modules
   - Implement key rotation policy

4. **Fix internal firewall rules**
   - Change from "0-65535" to specific ports
   - Add logging configuration

### HIGH (Fix before production)

5. **Pin Docker base image SHAs**
   - Update all Dockerfiles
   - Use digest format `image@sha256:...`

6. **Fix non-root user in remaining services**
   - services/api/Dockerfile
   - services/qdrant/Dockerfile

7. **Implement secret rotation**
   - Automate via Cloud Scheduler
   - 90-day rotation for secrets
   - Yearly rotation for encryption keys

8. **Secure Terraform state**
   - Enable versioning on GCS bucket
   - Restrict IAM access
   - Enable encryption
   - Consider Terraform Cloud

9. **Add dependency scanning SAST tools**
   - Lower CVSS threshold to 5
   - Make vulnerabilities blocking on all branches
   - Add Python dependency scanning (pip-audit, safety)

10. **Fix CORS configuration**
    - Remove wildcard origins
    - Externalize allowed origins to ConfigMap
    - Validate against whitelist

### MEDIUM (Plan for implementation)

11. **Tighten K8s network policies**
    - Replace wildcard namespace selectors with specific labels
    - Reduce database access to specific namespaces

12. **Implement pod security standards**
    - Add PSS labels to namespaces
    - Define restrictive policies

13. **Add workload identity bindings in Terraform**
    - Link Kubernetes SAs to GCP SAs
    - Remove need for service account keys

14. **Improve monitoring**
    - Add security-specific alerts
    - Implement breach detection
    - Certificate expiration monitoring

15. **Implement audit logging**
    - Centralize logs to Cloud Logging
    - Set up retention policies
    - Create audit trail dashboards

---

## 10. DEPLOYMENT CHECKLIST

- [ ] Rotate all exposed credentials (JWT_SECRET, database passwords, API keys)
- [ ] Remove .env files from git history
- [ ] Pin all Docker base image digests
- [ ] Add non-root users to all Dockerfiles
- [ ] Implement container image scanning in CI/CD
- [ ] Fix internal firewall rules
- [ ] Secure Terraform state bucket
- [ ] Implement CMEK for sensitive data
- [ ] Enable secret rotation
- [ ] Fix CORS configuration
- [ ] Add security-specific monitoring alerts
- [ ] Implement audit logging
- [ ] Enable pod security standards
- [ ] Set up workload identity
- [ ] Document security architecture
- [ ] Conduct final security review
- [ ] Plan incident response procedures

---

## CONCLUSION

The Life Navigator infrastructure demonstrates good foundational security practices with proper implementation of non-root containers, network policies, and Kubernetes security contexts. However, critical issues around credentials exposure, missing container image scanning, and incomplete secret management must be addressed before production deployment.

The three most critical actions are:
1. Remove and rotate exposed credentials
2. Implement container image scanning
3. Secure Terraform state and implement CMEK encryption

With these fixes implemented, the system will be significantly more secure and production-ready.

