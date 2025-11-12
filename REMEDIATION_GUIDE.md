# Security Remediation Guide
## Life Navigator Infrastructure

This guide provides step-by-step instructions to remediate the security findings from the audit.

---

## CRITICAL ISSUES (Immediate Action Required)

### 1. Remove Exposed Credentials from Git History

**Issue:** Real credentials (JWT_SECRET, database passwords) are committed to the repository.

**Action Items:**
- Rotate all exposed secrets
- Remove .env files from git history using git filter-branch
- Update team with new credentials
- Document secret rotation process

See SECURITY_AUDIT_REPORT.md for detailed steps.

### 2. Pin Docker Base Images to SHA256 Digests

**Issue:** Floating image tags allow unexpected updates and supply chain attacks.

**Action Items:**
```bash
# Get digest for python:3.12-slim
docker pull python:3.12.0-slim-bookworm
docker inspect --format='{{index .RepoDigests 0}}' python:3.12.0-slim-bookworm

# Update all Dockerfiles to use format:
# FROM python:3.12.0-slim-bookworm@sha256:abc123...
```

**Affected Files:**
- backend/Dockerfile
- apps/web/Dockerfile
- services/api/Dockerfile
- services/agents/Dockerfile

### 3. Add Container Image Scanning to CI/CD

**Issue:** No Trivy or equivalent vulnerability scanning in pipelines.

**Action Items:**
- Add Trivy step to .github/workflows/backend.yml
- Add Trivy step to .github/workflows/ci.yml
- Set exit-code: '1' to fail builds on vulnerabilities
- Configure severity: HIGH,CRITICAL

```yaml
- name: Scan Docker image with Trivy
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: ${{ env.GCR_REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
    severity: HIGH,CRITICAL
    exit-code: '1'
```

### 4. Fix Non-Root Users in Dockerfiles

**Issue:** services/api and services/qdrant run as root.

**Action Items:**
```dockerfile
# Add to services/api/Dockerfile
RUN useradd -m -u 1000 appuser
COPY --chown=appuser:appuser . .
USER appuser

# Add to services/qdrant/Dockerfile
RUN useradd -m -u 1000 qdrant || true
USER qdrant
```

### 5. Secure Terraform State

**Issue:** State bucket not encrypted, no versioning, exposed to public.

**Action Items:**
- Create KMS key for encryption
- Enable versioning on GCS bucket
- Enable access logging
- Restrict IAM permissions to service account only
- Use CMEK for encryption

See detailed Terraform code in SECURITY_AUDIT_REPORT.md section 3.6

---

## HIGH PRIORITY ISSUES (Week 1)

### 6. Pin Docker Base Images

**Priority:** Week 1 (after critical)

### 7. Fix Internal Firewall Rules

**Current:** Allows all TCP ports (0-65535)
**Fix:** Restrict to: 5432, 6379, 7687, 443, 50051

### 8. Fix Network Policies

**Current:** Wildcard namespace selectors
**Fix:** Use specific namespace labels

```yaml
- to:
  - namespaceSelector:
      matchLabels:
        name: databases
```

### 9. Implement Secret Rotation

**Action:** Create Cloud Scheduler jobs for:
- JWT secret (90 days)
- Database passwords (90 days)
- API keys (90 days)
- Encryption keys (yearly)

### 10. Lower Dependency Check CVSS

**Current:** CVSS 7 (only critical)
**Fix:** CVSS 5 (medium and above)

### 11. Fix CORS Configuration

**Current:** CORS_ORIGINS: ["*"]
**Fix:** Specify exact allowed domains

### 12. Update CI/CD Permissions

**Action:** Add explicit permissions to all GitHub Actions workflows

```yaml
permissions:
  contents: read
  pull-requests: read
```

---

## MEDIUM PRIORITY ISSUES (Ongoing)

### 13. Implement CMEK Encryption

- Cloud SQL
- Cloud Storage buckets
- Cloud KMS
- Terraform state

### 14. Add Security Monitoring Alerts

- Unauthorized access attempts
- Failed authentication
- Certificate expiration
- Cloud Armor blocks
- Firewall violations

### 15. Enable Audit Logging

- GKE API server logs
- Cloud SQL audit logs
- Cloud Storage access logs
- IAM activity logs

### 16. Pod Security Standards

Add labels to namespace:
```yaml
pod-security.kubernetes.io/enforce: restricted
pod-security.kubernetes.io/audit: restricted
pod-security.kubernetes.io/warn: restricted
```

### 17. Workload Identity Binding

Replace placeholders with actual binding in Terraform

### 18. Image Pull Policy

Change from `IfNotPresent` to `Always`

---

## VERIFICATION CHECKLIST

```bash
# 1. No hardcoded credentials
git grep -i "password\|secret\|api_key" -- '*.py' '*.yaml' '*.tf' | grep -v example | wc -l
# Should return: 0

# 2. All Docker images use non-root
docker run --rm backend:test id | grep -q "uid=1000" && echo "PASS" || echo "FAIL"

# 3. Images pinned to digests
grep "@sha256:" backend/Dockerfile && echo "PASS" || echo "FAIL"

# 4. Terraform state encrypted
gsutil encryption get gs://life-navigator-terraform-state-dev | grep CMEK && echo "PASS" || echo "FAIL"

# 5. Container scanning in CI/CD
grep -q "trivy" .github/workflows/backend.yml && echo "PASS" || echo "FAIL"

# 6. Firewall rules restricted
gcloud compute firewall-rules list --filter="internal" --format="table(allowed[].ports)" | grep -v "65535" && echo "PASS" || echo "FAIL"

# 7. Network policies use specific namespaces
kubectl get networkpolicies -A -o yaml | grep -q "namespaceSelector: {}" && echo "FAIL" || echo "PASS"
```

---

## TIMELINE

| Phase | Duration | Tasks | Owner |
|-------|----------|-------|-------|
| **Critical** | Week 1 | Rotate secrets, pin images, add scanning | Security/DevOps |
| **High** | Week 2-3 | Fix Dockerfiles, networks, CI/CD | DevOps |
| **Medium** | Week 4-6 | CMEK, monitoring, audit logs | Platform |
| **Verification** | Week 7 | Full testing, documentation | QA/Docs |

---

## COMPLIANCE IMPACT

### SOC2 Type II
- **Required:** Secret rotation, encryption at rest, audit logging
- **Impact:** Medium (most controls already in place)

### ISO 27001
- **Required:** Information security, incident management, supplier relationships
- **Impact:** Medium-High

### HIPAA (if handling health data)
- **Required:** Encryption, audit trails, access controls, PHI protection
- **Impact:** High (field-level encryption not yet implemented)

### GDPR/CCPA
- **Required:** Data retention, encryption, access logs, deletion procedures
- **Impact:** Medium (need to document data deletion)

---

## ESTIMATED EFFORT

| Task | Hours | Complexity |
|------|-------|------------|
| Rotate credentials | 2 | Low |
| Pin Docker images | 3 | Low |
| Add image scanning | 2 | Low |
| Fix Dockerfiles | 4 | Low |
| Secure Terraform state | 5 | Medium |
| Fix firewall/network | 6 | Medium |
| Implement CMEK | 8 | High |
| Setup secret rotation | 6 | High |
| Add monitoring/alerts | 8 | High |
| Documentation | 4 | Low |
| **Total** | **48 hours** | **3-4 weeks** |

---

## KEY CONTACTS & ESCALATION

- **Security Lead:** [Name/Email]
- **DevOps Lead:** [Name/Email]
- **Platform Lead:** [Name/Email]
- **Incident Response:** [Email/Phone]

---

## REFERENCES

- OWASP Docker Security: https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html
- Kubernetes Security: https://kubernetes.io/docs/concepts/security/
- GCP Security: https://cloud.google.com/security/best-practices
- Terraform Security: https://www.terraform.io/cloud-docs/security/secrets

---

**Document Version:** 1.0
**Last Updated:** 2024-11-11
**Next Review:** 2025-05-11 (6 months post-remediation)
