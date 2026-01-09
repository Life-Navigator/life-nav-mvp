# HIPAA Service Policy - Allowed and Denied GCP Services

**Policy Number:** HIPAA-POL-001
**Effective Date:** 2026-01-09
**Last Updated:** 2026-01-09
**Policy Owner:** Compliance Officer
**Approved By:** CEO, Legal Counsel
**Review Frequency:** Quarterly

---

## 1. Policy Statement

This policy defines which Google Cloud Platform (GCP) services are **PERMITTED** and **PROHIBITED** for processing electronic Protected Health Information (ePHI) at LifeNavigator. All services used for ePHI must be covered under the Business Associate Agreement (BAA) with Google Cloud.

**Enforcement:** Violation of this policy may result in HIPAA breach, regulatory fines, and disciplinary action up to termination.

---

## 2. HIPAA Allowed Services (WHITELIST)

The following GCP services are **EXPLICITLY PERMITTED** to process, store, or transmit ePHI:

### 2.1 Compute Services

| Service | GCP API | Use Case | BAA Required | Restrictions |
|---------|---------|----------|--------------|--------------|
| **Google Kubernetes Engine (GKE)** | `container.googleapis.com` | Backend API pods processing ePHI | ✅ YES | MUST use private cluster, Workload Identity, Shielded Nodes |
| **Compute Engine** | `compute.googleapis.com` | Bastion host for admin access (if needed) | ✅ YES | MUST use private IP only, no public IP allowed |

**PROHIBITED Compute Services:**
- ❌ App Engine (not HIPAA-eligible as of 2026-01-09)
- ❌ Cloud Run (conditionally eligible, but NOT used for ePHI at LifeNavigator)
- ❌ Cloud Functions (not used for ePHI processing)

---

### 2.2 Database Services

| Service | GCP API | Use Case | BAA Required | Restrictions |
|---------|---------|----------|--------------|--------------|
| **Cloud SQL for PostgreSQL** | `sqladmin.googleapis.com` | HIPAA database storing health records | ✅ YES | MUST use CMEK, private IP, SSL enforcement, regional HA |
| **Cloud Memorystore (Redis)** | `redis.googleapis.com` | Session cache (if contains ePHI identifiers) | ✅ YES | MUST use private IP, in-transit encryption |

**PROHIBITED Database Services:**
- ❌ Cloud Spanner (not used, but eligible if needed)
- ❌ Firestore (NOT HIPAA-eligible for ePHI)
- ❌ Bigtable (NOT HIPAA-eligible for ePHI)
- ❌ Firebase Realtime Database (NOT HIPAA-eligible)

---

### 2.3 Storage Services

| Service | GCP API | Use Case | BAA Required | Restrictions |
|---------|---------|----------|--------------|--------------|
| **Cloud Storage** | `storage.googleapis.com` | Health document uploads (PDFs, images) | ✅ YES | MUST use CMEK, uniform bucket-level access, 7-year retention, private access |

**PROHIBITED Storage Services:**
- ❌ Persistent Disk (eligible, but not directly used for ePHI - only as GKE node storage)
- ❌ Filestore (not used)

---

### 2.4 Encryption & Key Management

| Service | GCP API | Use Case | BAA Required | Restrictions |
|---------|---------|----------|--------------|--------------|
| **Cloud KMS** | `cloudkms.googleapis.com` | CMEK for Cloud SQL, Cloud Storage, field-level encryption | ✅ YES | MUST use 90-day key rotation, HSM-backed keys (recommended) |
| **Secret Manager** | `secretmanager.googleapis.com` | Database credentials, API keys for health integrations | ✅ YES | MUST use IAM restrictions, automatic rotation |

---

### 2.5 Networking Services

| Service | GCP API | Use Case | BAA Required | Restrictions |
|---------|---------|----------|--------------|--------------|
| **Virtual Private Cloud (VPC)** | `compute.googleapis.com` | Private network for ePHI-processing resources | ✅ YES | MUST enable Private Google Access, VPC Flow Logs |
| **Cloud Load Balancing (HTTPS)** | `compute.googleapis.com` | TLS termination for user requests | ✅ YES | MUST enforce TLS 1.2+ minimum, enable access logging |
| **Cloud Armor** | `compute.googleapis.com` | WAF for DDoS protection | ✅ YES | MUST attach to Load Balancer backend |
| **Cloud NAT** | `compute.googleapis.com` | Outbound internet for GKE nodes | ✅ YES | MUST use for private GKE nodes |
| **Cloud VPN / Cloud Interconnect** | `compute.googleapis.com` | Secure admin access to VPC | ✅ YES | MUST use for administrator SSH/kubectl access |

**PROHIBITED Networking Services:**
- ❌ Public IPs on GKE nodes (MUST use private IPs only)
- ❌ Cloud CDN (not used for ePHI; static assets only)

---

### 2.6 Logging & Monitoring

| Service | GCP API | Use Case | BAA Required | Restrictions |
|---------|---------|----------|--------------|--------------|
| **Cloud Logging** | `logging.googleapis.com` | Audit logs for ePHI access | ✅ YES | MUST export to 7-year retention bucket, Bucket Lock enabled |
| **Cloud Monitoring** | `monitoring.googleapis.com` | Performance metrics for HIPAA resources | ✅ YES | MUST restrict access via IAM |
| **Cloud Trace** | `cloudtrace.googleapis.com` | Distributed tracing (if ePHI in traces) | ✅ YES | MUST sanitize ePHI from trace data |

**PROHIBITED Logging/Monitoring Services:**
- ❌ Error Reporting (use Sentry with PHI sanitization instead)
- ❌ Cloud Debugger (NOT HIPAA-eligible - do not use on ePHI workloads)

---

### 2.7 Identity & Access Management

| Service | GCP API | Use Case | BAA Required | Restrictions |
|---------|---------|----------|--------------|--------------|
| **IAM** | `iam.googleapis.com` | Access control for all GCP resources | ✅ YES | MUST follow principle of least privilege |
| **Workload Identity** | `iam.googleapis.com` | Service account identity for GKE pods | ✅ YES | MUST use for all pods accessing ePHI |

---

### 2.8 Security Services

| Service | GCP API | Use Case | BAA Required | Restrictions |
|---------|---------|----------|--------------|--------------|
| **Security Command Center** | `securitycenter.googleapis.com` | Vulnerability scanning, threat detection | ✅ YES | MUST enable for HIPAA project |
| **Binary Authorization** | `binaryauthorization.googleapis.com` | Container image verification | ✅ YES | MUST enable for GKE cluster |
| **VPC Service Controls** | `accesscontextmanager.googleapis.com` | Data exfiltration prevention | ✅ YES | MUST configure perimeter around HIPAA resources |

---

## 3. HIPAA Denied Services (BLACKLIST)

The following GCP services are **EXPLICITLY PROHIBITED** from processing ePHI:

### 3.1 Compute Services (Denied)

| Service | Reason for Prohibition |
|---------|------------------------|
| **App Engine** | Not HIPAA-eligible (as of 2026-01-09) |
| **Cloud Run** | HIPAA-eligible but not used for ePHI at LifeNavigator (policy decision to reduce attack surface) |
| **Cloud Functions** | Used for non-ePHI workloads only (email notifications, analytics) |

**Enforcement:** Infrastructure-as-Code (Terraform) MUST NOT provision these services in the `lifenav-prod` project for ePHI workloads.

---

### 3.2 Database Services (Denied)

| Service | Reason for Prohibition |
|---------|------------------------|
| **Firestore** | NOT HIPAA-eligible for ePHI storage |
| **Firebase Realtime Database** | NOT HIPAA-eligible for ePHI storage |
| **Bigtable** | NOT HIPAA-eligible for ePHI storage |
| **Datastore** | Legacy service, NOT HIPAA-eligible |

**Permitted Use:** These services MAY be used for non-ePHI data (e.g., user preferences, analytics) in separate GCP projects.

---

### 3.3 Analytics & AI Services (Denied for ePHI)

| Service | Reason for Prohibition |
|---------|------------------------|
| **BigQuery** | Permitted for anonymized data ONLY; ePHI MUST be de-identified before loading |
| **Vertex AI** | Permitted for non-health ML models ONLY; ePHI training data PROHIBITED |
| **Cloud AutoML** | NOT HIPAA-eligible for ePHI |
| **Dialogflow** | NOT HIPAA-eligible for ePHI |
| **Speech-to-Text** | NOT HIPAA-eligible for ePHI (audio recordings of health info) |
| **Natural Language API** | NOT HIPAA-eligible for ePHI |

**Enforcement:** Data pipelines MUST de-identify ePHI before loading into BigQuery or training ML models.

---

### 3.4 Messaging & Integration Services (Denied for ePHI)

| Service | Reason for Prohibition |
|---------|------------------------|
| **Cloud Pub/Sub** | Permitted for event notifications ONLY if ePHI is NOT included in message payload |
| **Cloud Tasks** | Permitted for background jobs ONLY if task payload does NOT contain ePHI |
| **Workflows** | NOT HIPAA-eligible for ePHI orchestration |

**Permitted Use:** Pub/Sub and Tasks may be used for triggering actions (e.g., "new health record created, send notification") but MUST NOT include ePHI in the message (only record IDs).

---

### 3.5 Developer & Debugging Services (Denied for ePHI)

| Service | Reason for Prohibition |
|---------|------------------------|
| **Cloud Debugger** | NOT HIPAA-eligible; snapshots may capture ePHI in memory |
| **Error Reporting** | NOT HIPAA-eligible; use third-party (Sentry) with PHI sanitization instead |
| **Cloud Profiler** | NOT HIPAA-eligible; may capture ePHI in memory profiles |

**Enforcement:** Disable Cloud Debugger API (`clouddebugger.googleapis.com`) in `lifenav-prod` project.

---

### 3.6 Third-Party Services (Denied for Direct ePHI Access)

| Service | Reason for Prohibition |
|---------|------------------------|
| **Firebase** (Analytics, Crashlytics, Remote Config) | NOT HIPAA-eligible; used for mobile analytics ONLY (no ePHI) |
| **Google Analytics** | NOT HIPAA-eligible; used for web analytics ONLY (no ePHI) |
| **Sentry (Error Monitoring)** | NOT covered by Google BAA; use with PHI sanitization (scrub ePHI before sending errors) |
| **SendGrid (Email)** | NOT covered by Google BAA; emails MUST NOT contain ePHI (use "You have a new message" instead of medical details) |

---

## 4. Guardrails & Enforcement Mechanisms

### 4.1 GCP Organization Policy Constraints

**Enforce via Organization Policies:**

```yaml
# Example: Deny public IP on Compute Engine instances
constraints/compute.vmExternalIpAccess:
  enforcementMode: ENFORCE
  rules:
    - values:
        deniedValues:
          - "*"

# Example: Require CMEK for Cloud SQL
constraints/sql.restrictAuthorizedNetworks:
  enforcementMode: ENFORCE

# Example: Deny non-HIPAA services in lifenav-prod project
constraints/serviceuser.services:
  enforcementMode: ENFORCE
  rules:
    - values:
        deniedValues:
          - "firestore.googleapis.com"
          - "firebase.googleapis.com"
          - "bigtable.googleapis.com"
          - "clouddebugger.googleapis.com"
          - "dialogflow.googleapis.com"
```

**Implementation:**
- Deploy Organization Policies via Terraform in `terraform/gcp/organization-policies/`
- Policies apply to `lifenav-prod` folder (production environment)
- Exceptions require written approval from Compliance Officer

---

### 4.2 Terraform Policy-as-Code (Sentinel / OPA)

**Enforce via Terraform validation:**

```hcl
# Example: Deny Cloud SQL without CMEK
data "google_sql_database_instance" "hipaa_validation" {
  name = "ln-health-db-beta"

  lifecycle {
    precondition {
      condition     = self.settings.encryption.kms_key_name != null
      error_message = "HIPAA database MUST use CMEK (Customer-Managed Encryption Keys)"
    }
  }
}

# Example: Deny public Cloud Storage buckets
resource "google_storage_bucket" "health_documents" {
  name = "lifenav-prod-health-documents"

  lifecycle {
    precondition {
      condition     = self.public_access_prevention == "enforced"
      error_message = "HIPAA bucket MUST enforce public access prevention"
    }
  }
}
```

**Implementation:**
- Add preconditions to all Terraform resources processing ePHI
- Run `terraform plan` in CI/CD pipeline
- Block deployment if HIPAA controls are missing

---

### 4.3 CI/CD Pipeline Checks

**GitHub Actions workflow:**

```yaml
name: HIPAA Compliance Check

on: [push, pull_request]

jobs:
  hipaa_compliance:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Check for prohibited GCP services
        run: |
          # Scan Terraform files for prohibited services
          PROHIBITED_SERVICES=(
            "google_firestore_database"
            "google_firebase_project"
            "google_bigtable_instance"
            "google_clouddebugger_"
          )

          for service in "${PROHIBITED_SERVICES[@]}"; do
            if grep -r "$service" terraform/; then
              echo "ERROR: Prohibited service $service found in Terraform files"
              exit 1
            fi
          done

      - name: Verify CMEK on Cloud SQL
        run: |
          if ! grep -r "kms_key_name" terraform/gcp/modules/cloud-sql/; then
            echo "ERROR: Cloud SQL MUST use CMEK (kms_key_name not found)"
            exit 1
          fi

      - name: Verify private GKE cluster
        run: |
          if ! grep -r "enable_private_nodes.*true" terraform/gcp/modules/gke-cluster/; then
            echo "ERROR: GKE cluster MUST be private (enable_private_nodes not found)"
            exit 1
          fi
```

---

### 4.4 Runtime Monitoring & Alerts

**Cloud Monitoring alerts:**

```yaml
# Alert if Cloud SQL becomes publicly accessible
alert: cloud_sql_public_ip_enabled
condition: |
  resource.type="cloudsql_database"
  AND protoPayload.methodName="cloudsql.instances.patch"
  AND protoPayload.request.settings.ipConfiguration.ipv4Enabled=true
severity: CRITICAL
notification: security@lifenavigator.com

# Alert if Cloud Storage bucket becomes public
alert: cloud_storage_public_access
condition: |
  resource.type="gcs_bucket"
  AND protoPayload.methodName="storage.setIamPermissions"
  AND protoPayload.request.policy.bindings.members="allUsers"
severity: CRITICAL
notification: security@lifenavigator.com

# Alert if non-HIPAA service is enabled
alert: prohibited_service_enabled
condition: |
  protoPayload.serviceName="firestore.googleapis.com"
  OR protoPayload.serviceName="firebase.googleapis.com"
  OR protoPayload.serviceName="clouddebugger.googleapis.com"
severity: CRITICAL
notification: compliance@lifenavigator.com
```

---

### 4.5 Quarterly Access Review

**Process:**

1. **Compliance Officer** exports IAM policies for all HIPAA resources
   ```bash
   gcloud projects get-iam-policy lifenav-prod --format=json > iam_policy_YYYYMMDD.json
   ```

2. **Review for unauthorized access:**
   - Users with `roles/owner` or `roles/editor` (should be < 3 people)
   - Service accounts with excessive permissions
   - External users (non-@lifenavigator.com email)

3. **Revoke unauthorized access immediately:**
   ```bash
   gcloud projects remove-iam-policy-binding lifenav-prod \
     --member="user:unauthorized@example.com" \
     --role="roles/viewer"
   ```

4. **Document review in:** `docs/compliance/hipaa/access-reviews/YYYY-QX-access-review.md`

---

## 5. Exception Request Process

If a GCP service NOT listed in the HIPAA Allowed Services whitelist is needed for ePHI processing:

### 5.1 Exception Request Form

Submit to: compliance@lifenavigator.com

**Required Information:**
1. **Service Name:** (e.g., Cloud Spanner)
2. **GCP API:** (e.g., `spanner.googleapis.com`)
3. **Business Justification:** Why is this service necessary for ePHI?
4. **Google BAA Verification:** Confirm service is HIPAA-eligible per [Google's HIPAA Compliance Documentation](https://cloud.google.com/security/compliance/hipaa)
5. **HIPAA Controls:** Document how service will meet HIPAA requirements (encryption, access control, audit logging)
6. **Risk Assessment:** Identify risks and mitigation strategies
7. **Approval:** Requires signature from Compliance Officer + Legal Counsel

### 5.2 Approval Criteria

Exception will be **APPROVED** only if:
- ✅ Service is explicitly listed in Google's HIPAA-eligible services
- ✅ Service is covered by signed BAA with Google Cloud
- ✅ HIPAA controls can be demonstrated (encryption, access logs, IAM)
- ✅ No alternative HIPAA-compliant solution exists
- ✅ Risk is acceptable and documented

Exception will be **DENIED** if:
- ❌ Service is NOT HIPAA-eligible per Google documentation
- ❌ HIPAA controls cannot be implemented
- ❌ Alternative solution exists (use existing HIPAA service instead)
- ❌ Risk is unacceptable

### 5.3 Exception Documentation

If approved:
1. Update `GCP_EPHI_SERVICE_INVENTORY.md` to include new service
2. Update this policy document (Section 2 - HIPAA Allowed Services)
3. Configure HIPAA controls for new service (Terraform)
4. Collect evidence artifacts (configurations, screenshots, audit logs)
5. File exception approval in `docs/compliance/hipaa/exceptions/YYYY-MM-DD-service-name.pdf`

---

## 6. Compliance Monitoring Metrics

**Track monthly:**

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Prohibited Service Usage** | 0 API calls | Cloud Logging query for denied services |
| **Public IP on HIPAA Resources** | 0 resources | Asset Inventory scan for `ipv4_enabled=true` |
| **CMEK Coverage** | 100% of HIPAA resources | Terraform state verification |
| **IAM Drift** | 0 unauthorized users | Compare IAM policy to approved list |
| **Audit Log Retention** | 100% of logs in 7-year bucket | Cloud Storage bucket size check |

**Reporting:**
- Monthly compliance dashboard: `docs/compliance/hipaa/monthly-reports/YYYY-MM-compliance-report.md`
- Quarterly board report: High-level summary for executives

---

## 7. Policy Violations & Remediation

### 7.1 Violation Categories

| Severity | Examples | Response Time | Remediation |
|----------|----------|---------------|-------------|
| **CRITICAL** | ePHI in non-HIPAA service (e.g., Firestore) | Immediate (< 1 hour) | Delete data, disable service, incident report |
| **HIGH** | Cloud SQL without CMEK | < 4 hours | Enable CMEK, rotate keys, audit who had access |
| **MEDIUM** | Missing audit logs for 1 day | < 24 hours | Enable logging, backfill if possible |
| **LOW** | Terraform drift (manual change) | < 1 week | Correct configuration, update Terraform state |

### 7.2 Incident Response

If ePHI is processed by a prohibited service:

1. **IMMEDIATE:** Disable service or delete data (within 1 hour)
   ```bash
   gcloud services disable firestore.googleapis.com --project=lifenav-prod
   ```

2. **DOCUMENT:** Create incident report (HIPAA breach analysis)
   - What ePHI was exposed?
   - How many users affected?
   - Was data encrypted?
   - Was unauthorized access detected?

3. **NOTIFY:** Compliance Officer + Legal Counsel (immediately)

4. **INVESTIGATE:** Review audit logs for unauthorized access
   ```bash
   gcloud logging read "resource.type=audited_resource AND protoPayload.serviceName=firestore.googleapis.com" --limit=1000
   ```

5. **REMEDIATE:** Migrate data to HIPAA-compliant service (Cloud SQL)

6. **REPORT:** If breach notification required (> 500 users or unauthorized access), notify HHS within 60 days

---

## 8. Training Requirements

All engineers with access to GCP `lifenav-prod` project MUST complete:

1. **HIPAA Fundamentals Training** (annually)
   - What is ePHI?
   - HIPAA Security Rule requirements
   - Consequences of violations

2. **GCP HIPAA Service Policy Training** (quarterly)
   - Review this policy document
   - Quiz on allowed vs denied services
   - Practice identifying policy violations

3. **Terraform HIPAA Controls Training** (before first deployment)
   - How to configure CMEK
   - How to verify private networking
   - How to enable audit logging

**Certification:**
- Signed acknowledgment: `docs/compliance/hipaa/training/YYYY-employee-name-certification.pdf`
- Renewal: Annually (or when policy updated)

---

## 9. Related Documents

- [GCP ePHI Service Inventory](./GCP_EPHI_SERVICE_INVENTORY.md)
- [BAA Execution Checklist](./BAA_EXECUTION_CHECKLIST.md)
- [ePHI Flow Control Verification](./EPHI_FLOW_CONTROL.md)
- [Evidence Artifact Requirements](./EVIDENCE_ARTIFACTS.md)
- [Google Cloud HIPAA Compliance](https://cloud.google.com/security/compliance/hipaa)

---

## 10. Policy Review & Updates

**Review Frequency:** Quarterly (or when Google updates HIPAA-eligible services)

**Update Process:**
1. Compliance Officer reviews Google's HIPAA compliance page
2. Identify new HIPAA-eligible services or services removed from HIPAA coverage
3. Update Section 2 (Allowed Services) or Section 3 (Denied Services)
4. Notify all engineers via email + Slack announcement
5. Update training materials
6. Require re-certification if major changes

**Version History:**

| Version | Date | Changes | Approved By |
|---------|------|---------|-------------|
| 1.0 | 2026-01-09 | Initial policy creation | [CEO, Legal] |

---

**Acknowledgment:**

I, _________________________, have read and understand this HIPAA Service Policy. I agree to comply with all provisions and will only use HIPAA-allowed services for processing ePHI.

Signature: _________________________ Date: _____________

**File in:** `docs/compliance/hipaa/training/acknowledgments/`

---

**Last Updated:** 2026-01-09
**Next Review:** 2026-04-09 (Quarterly)
**Policy Owner:** Compliance Officer
