# Google Cloud BAA Execution Checklist

**Document Type:** Pre-Signature and Post-Signature Checklists
**BAA Type:** Business Associate Agreement with Google Cloud
**Covered Entity:** LifeNavigator, Inc.
**Business Associate:** Google LLC
**Effective Date:** [TO BE COMPLETED UPON SIGNATURE]
**Compliance Officer:** [NAME]

---

## Pre-Signature Checklist

**Complete ALL items before signing BAA with Google Cloud.**

### Phase 1: Business Requirements (Week 1)

- [ ] **1.1** Identify all GCP services that will process ePHI
  - **Owner:** Compliance Officer + CTO
  - **Artifact:** `GCP_EPHI_SERVICE_INVENTORY.md` (Section 1)
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **1.2** Verify each service is HIPAA-eligible
  - **Owner:** Compliance Officer
  - **Verification Source:** https://cloud.google.com/security/compliance/hipaa
  - **Artifact:** Screenshot of Google HIPAA page dated [DATE]
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **1.3** Document ePHI data flow through each service
  - **Owner:** Security Architect
  - **Artifact:** Data flow diagram in `GCP_EPHI_SERVICE_INVENTORY.md` (Section 2)
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **1.4** Identify non-HIPAA services that MUST NOT process ePHI
  - **Owner:** Compliance Officer
  - **Artifact:** `HIPAA_SERVICE_POLICY.md` (Section 3 - Denied Services)
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

---

### Phase 2: Technical Controls Implementation (Week 2-4)

#### 2.1 Encryption Controls

- [ ] **2.1.1** Enable CMEK for Cloud SQL HIPAA instance
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Create Cloud KMS keyring: `hipaa-keyring` in `us-central1`
    2. Create encryption key: `health-db-key` with 90-day rotation
    3. Grant Cloud SQL service account `cloudkms.cryptoKeyEncrypterDecrypter` role
    4. Configure Cloud SQL instance to use CMEK
    5. Verify encryption: `gcloud sql instances describe ln-health-db-beta --format=json | jq '.settings.encryption'`
  - **Artifact:** Screenshot of CMEK configuration
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.1.2** Enable CMEK for Cloud Storage health documents bucket
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Create encryption key: `health-storage-key` with 90-day rotation
    2. Grant Cloud Storage service account `cloudkms.cryptoKeyEncrypterDecrypter` role
    3. Configure bucket to use CMEK: `gsutil encryption set -k projects/lifenav-prod/locations/us-central1/keyRings/hipaa-keyring/cryptoKeys/health-storage-key gs://lifenav-prod-health-documents`
    4. Verify encryption: `gsutil encryption get gs://lifenav-prod-health-documents`
  - **Artifact:** Screenshot of bucket encryption settings
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.1.3** Enforce TLS 1.2+ on Cloud SQL
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Configure Cloud SQL: `gcloud sql instances patch ln-health-db-beta --require-ssl`
    2. Verify SSL requirement: `gcloud sql instances describe ln-health-db-beta --format=json | jq '.settings.ipConfiguration.requireSsl'`
  - **Artifact:** Screenshot showing `requireSsl: true`
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.1.4** Enforce TLS 1.2+ on Cloud Load Balancer
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Create SSL policy: `gcloud compute ssl-policies create hipaa-ssl-policy --profile=MODERN --min-tls-version=1.2`
    2. Attach to HTTPS proxy: `gcloud compute target-https-proxies update hipaa-https-proxy --ssl-policy=hipaa-ssl-policy`
    3. Verify: `gcloud compute ssl-policies describe hipaa-ssl-policy`
  - **Artifact:** Screenshot of SSL policy with `minTlsVersion: TLS_1_2`
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

#### 2.2 Access Controls

- [ ] **2.2.1** Configure private GKE cluster (no public IPs)
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Terraform: Set `enable_private_nodes = true` in GKE module
    2. Terraform: Set `enable_private_endpoint = false` (control plane accessible via VPN only)
    3. Deploy: `terraform apply -target=google_container_cluster.primary`
    4. Verify no public IPs: `gcloud compute instances list --filter="name~gke-ln-prod-cluster" --format="table(name,networkInterfaces[0].accessConfigs[0].natIP)"`
  - **Artifact:** Screenshot showing empty `natIP` column (no public IPs)
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.2.2** Configure Cloud SQL private IP (no public IP)
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Terraform: Set `ipv4_enabled = false` in Cloud SQL module
    2. Terraform: Set `private_network = google_compute_network.vpc.id`
    3. Deploy: `terraform apply -target=google_sql_database_instance.hipaa_db`
    4. Verify no public IP: `gcloud sql instances describe ln-health-db-beta --format=json | jq '.ipAddresses[] | select(.type=="PUBLIC")'` (should return empty)
  - **Artifact:** Screenshot showing only private IP address
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.2.3** Enforce uniform bucket-level access on Cloud Storage
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Disable ACLs: `gsutil uniformbucketlevelaccess set on gs://lifenav-prod-health-documents`
    2. Verify: `gsutil uniformbucketlevelaccess get gs://lifenav-prod-health-documents`
  - **Artifact:** Screenshot showing `Enabled: True`
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.2.4** Configure IAM with principle of least privilege
  - **Owner:** Security Architect
  - **Steps:**
    1. Audit current IAM policies: `gcloud projects get-iam-policy lifenav-prod > iam_audit_baseline.json`
    2. Remove users with `roles/owner` or `roles/editor` (keep < 3 break-glass accounts)
    3. Grant service-specific roles only (e.g., `roles/cloudsql.client` instead of `roles/editor`)
    4. Document approved users in `docs/compliance/hipaa/iam-approved-users.md`
  - **Artifact:** IAM policy export showing < 5 users with elevated permissions
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

#### 2.3 Audit Logging

- [ ] **2.3.1** Enable Cloud SQL audit logs
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Enable `cloudsql.enable_pgaudit` flag: `gcloud sql instances patch ln-health-db-beta --database-flags=cloudsql.enable_pgaudit=on`
    2. Verify flag: `gcloud sql instances describe ln-health-db-beta --format=json | jq '.settings.databaseFlags'`
  - **Artifact:** Screenshot showing `cloudsql.enable_pgaudit: on`
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.3.2** Enable GKE audit logs
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Verify audit logging enabled: `gcloud container clusters describe ln-prod-cluster --format=json | jq '.loggingConfig'`
    2. If not enabled, update cluster: `gcloud container clusters update ln-prod-cluster --enable-cloud-logging --logging=SYSTEM,WORKLOAD`
  - **Artifact:** Screenshot showing `loggingService: logging.googleapis.com/kubernetes`
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.3.3** Enable Cloud Storage data access logs
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Enable via Console: IAM & Admin > Audit Logs > Cloud Storage > Enable DATA_READ and DATA_WRITE
    2. Verify: `gcloud projects get-iam-policy lifenav-prod --flatten=auditConfigs --format=json | jq '.[] | select(.service=="storage.googleapis.com")'`
  - **Artifact:** Screenshot of Audit Logs page showing Cloud Storage DATA_READ and DATA_WRITE enabled
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.3.4** Enable Cloud KMS key usage logs
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Enable via Console: IAM & Admin > Audit Logs > Cloud KMS > Enable ADMIN_READ, DATA_READ, DATA_WRITE
    2. Verify: `gcloud projects get-iam-policy lifenav-prod --flatten=auditConfigs --format=json | jq '.[] | select(.service=="cloudkms.googleapis.com")'`
  - **Artifact:** Screenshot of Audit Logs page showing Cloud KMS all log types enabled
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.3.5** Configure 7-year audit log retention
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Create Cloud Storage bucket for audit logs: `gs://lifenav-prod-hipaa-audit-logs`
    2. Set 7-year retention policy with Bucket Lock:
       ```bash
       gsutil retention set 220752000 gs://lifenav-prod-hipaa-audit-logs  # 7 years in seconds
       gsutil retention lock gs://lifenav-prod-hipaa-audit-logs
       ```
    3. Create log sink: `gcloud logging sinks create hipaa-audit-logs storage.googleapis.com/lifenav-prod-hipaa-audit-logs --log-filter='<FILTER>'`
    4. Verify lock: `gsutil retention get gs://lifenav-prod-hipaa-audit-logs`
  - **Artifact:** Screenshot showing `Lock: Enabled` and `Retention Period: 220752000 seconds`
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

#### 2.4 Backup & Disaster Recovery

- [ ] **2.4.1** Enable automated Cloud SQL backups
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Configure backups: `gcloud sql instances patch ln-health-db-beta --backup-start-time=04:00 --enable-bin-log`
    2. Enable PITR: `gcloud sql instances patch ln-health-db-beta --enable-point-in-time-recovery --transaction-log-retention-days=7`
    3. Verify: `gcloud sql instances describe ln-health-db-beta --format=json | jq '.settings.backupConfiguration'`
  - **Artifact:** Screenshot showing `enabled: true`, `pointInTimeRecoveryEnabled: true`
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.4.2** Verify backup encryption
  - **Owner:** DevOps Lead
  - **Steps:**
    1. List recent backups: `gcloud sql backups list --instance=ln-health-db-beta`
    2. Verify backups use same CMEK as instance
    3. Test restoration: Create test instance from backup (monthly drill)
  - **Artifact:** Backup restoration test report
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.4.3** Configure Cloud Storage object versioning
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Enable versioning: `gsutil versioning set on gs://lifenav-prod-health-documents`
    2. Set lifecycle rule to retain versions for 30 days:
       ```bash
       cat > lifecycle.json <<EOF
       {"rule": [{"action": {"type": "Delete"}, "condition": {"numNewerVersions": 3, "daysSinceNoncurrentTime": 30}}]}
       EOF
       gsutil lifecycle set lifecycle.json gs://lifenav-prod-health-documents
       ```
    3. Verify: `gsutil versioning get gs://lifenav-prod-health-documents`
  - **Artifact:** Screenshot showing `Enabled: True`
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

#### 2.5 Network Security

- [ ] **2.5.1** Enable VPC Flow Logs
  - **Owner:** DevOps Lead
  - **Steps:**
    1. Terraform: Add `log_config` to subnet definition
    2. Set sampling to 100% for HIPAA subnet
    3. Deploy: `terraform apply -target=google_compute_subnetwork.hipaa_subnet`
    4. Verify: `gcloud compute networks subnets describe hipaa-subnet --region=us-central1 --format=json | jq '.logConfig'`
  - **Artifact:** Screenshot showing `enable: true`, `flowSampling: 1.0`
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.5.2** Configure VPC Service Controls perimeter
  - **Owner:** Security Architect
  - **Steps:**
    1. Create access policy: `gcloud access-context-manager policies create`
    2. Create service perimeter around HIPAA project
    3. Restrict data egress to approved services only
    4. Verify: Test data exfiltration (should be blocked)
  - **Artifact:** VPC Service Controls perimeter configuration export
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **2.5.3** Configure Cloud Armor WAF rules
  - **Owner:** Security Architect
  - **Steps:**
    1. Create security policy: `gcloud compute security-policies create hipaa-waf`
    2. Add OWASP Top 10 rules
    3. Attach to Load Balancer backend: `gcloud compute backend-services update hipaa-backend --security-policy=hipaa-waf`
    4. Verify: `gcloud compute security-policies describe hipaa-waf`
  - **Artifact:** Screenshot of Cloud Armor policy with rules
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

---

### Phase 3: Documentation & Evidence Collection (Week 4)

- [ ] **3.1** Export GCP resource configurations
  - **Owner:** DevOps Lead
  - **Steps:**
    ```bash
    # Cloud SQL
    gcloud sql instances describe ln-health-db-beta --format=json > cloud_sql_hipaa_config.json

    # GKE
    gcloud container clusters describe ln-prod-cluster --format=json > gke_cluster_config.json

    # Cloud Storage
    gsutil ls -L -b gs://lifenav-prod-health-documents > cloud_storage_bucket_config.txt

    # Cloud KMS
    gcloud kms keyrings describe hipaa-keyring --location=us-central1 --format=json > cloud_kms_keyring_config.json

    # VPC
    gcloud compute networks describe lifenav-vpc --format=json > vpc_network_config.json
    ```
  - **Artifact:** All JSON/TXT exports saved to `gs://lifenav-prod-compliance-evidence/hipaa/gcp-configs/`
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **3.2** Capture screenshots of key settings
  - **Owner:** Compliance Officer
  - **Required Screenshots:**
    1. Cloud SQL encryption settings showing CMEK key
    2. Cloud SQL backup configuration showing PITR enabled
    3. GKE cluster showing private nodes enabled
    4. Cloud Storage bucket showing uniform access + retention policy
    5. Cloud KMS key rotation settings (90 days)
    6. Load Balancer SSL policy showing TLS 1.2+ minimum
    7. VPC subnet showing flow logs enabled
    8. IAM policies for each HIPAA service (< 5 users)
  - **Artifact:** Screenshots saved to `gs://lifenav-prod-compliance-evidence/hipaa/screenshots/` (PNG, dated YYYYMMDD)
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **3.3** Export audit log samples
  - **Owner:** DevOps Lead
  - **Steps:**
    ```bash
    # Cloud SQL audit logs (30 days)
    gcloud logging read "resource.type=cloudsql_database AND resource.labels.database_id=lifenav-prod:ln-health-db-beta" --limit=1000 --format=json > cloud_sql_audit_logs_30days.json

    # GKE audit logs (30 days)
    gcloud logging read "resource.type=k8s_cluster AND resource.labels.cluster_name=ln-prod-cluster AND protoPayload.serviceName=k8s.io" --limit=1000 --format=json > gke_audit_logs_30days.json

    # Cloud Storage data access logs (30 days)
    gcloud logging read "resource.type=gcs_bucket AND resource.labels.bucket_name=lifenav-prod-health-documents AND protoPayload.methodName=~'storage.objects.*'" --limit=1000 --format=json > cloud_storage_audit_logs_30days.json

    # Cloud KMS key usage logs (30 days)
    gcloud logging read "resource.type=cloudkms_cryptokey AND protoPayload.methodName=~'Decrypt|Encrypt'" --limit=1000 --format=json > cloud_kms_audit_logs_30days.json
    ```
  - **Artifact:** All JSON exports saved to `gs://lifenav-prod-compliance-evidence/hipaa/audit-logs/`
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **3.4** Export IAM policies for all HIPAA resources
  - **Owner:** Security Architect
  - **Steps:**
    ```bash
    # Project-level IAM
    gcloud projects get-iam-policy lifenav-prod --format=json > iam_policy_project.json

    # Cloud SQL IAM
    gcloud sql instances get-iam-policy ln-health-db-beta --format=json > iam_policy_cloud_sql.json

    # Cloud Storage IAM
    gsutil iam get gs://lifenav-prod-health-documents > iam_policy_cloud_storage.json

    # Cloud KMS IAM (for each key)
    gcloud kms keys get-iam-policy health-db-key --keyring=hipaa-keyring --location=us-central1 --format=json > iam_policy_cloud_kms_health_db_key.json
    ```
  - **Artifact:** All IAM policy JSON exports saved to `gs://lifenav-prod-compliance-evidence/hipaa/iam-policies/`
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **3.5** Create compliance evidence package index
  - **Owner:** Compliance Officer
  - **Steps:**
    1. Create spreadsheet listing all evidence artifacts
    2. Include: Artifact name, GCS path, Date captured, Purpose
    3. Map each artifact to HIPAA Security Rule requirement (§164.308, §164.310, §164.312)
  - **Artifact:** `docs/compliance/hipaa/EVIDENCE_ARTIFACTS.md` + Excel spreadsheet
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

---

### Phase 4: Legal & Procurement (Week 5)

- [ ] **4.1** Request BAA from Google Cloud
  - **Owner:** Legal Counsel
  - **Steps:**
    1. Contact Google Cloud Account Manager or submit request via: https://cloud.google.com/terms/baa
    2. Provide company details:
       - Legal entity name: LifeNavigator, Inc.
       - Address: [COMPANY ADDRESS]
       - Contact: [LEGAL COUNSEL EMAIL]
       - GCP Organization ID: [ORG_ID]
       - GCP Billing Account ID: [BILLING_ID]
    3. Specify in-scope services (from `GCP_EPHI_SERVICE_INVENTORY.md` Section 1)
  - **Artifact:** Email confirmation from Google Cloud with BAA draft
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **4.2** Legal review of Google Cloud BAA
  - **Owner:** Legal Counsel
  - **Review Checklist:**
    - [ ] All in-scope GCP services are explicitly listed in Exhibit A
    - [ ] BAA covers "Business Associate" obligations under 45 CFR § 164.314(a)
    - [ ] Permitted uses and disclosures are clearly defined
    - [ ] Termination clauses allow for data retrieval
    - [ ] Indemnification and liability limits are acceptable
    - [ ] Breach notification obligations are defined (60-day timeline)
  - **Artifact:** Legal review memo with approval/redline requests
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **4.3** Negotiate BAA terms (if needed)
  - **Owner:** Legal Counsel
  - **Common Negotiation Points:**
    - Add specific service to Exhibit A if missing
    - Clarify data retention period post-termination
    - Adjust liability caps (if applicable)
  - **Artifact:** Negotiation correspondence log
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **4.4** Final BAA approval
  - **Owner:** CEO + Legal Counsel
  - **Approval Criteria:**
    - [ ] All technical controls implemented and verified (Phase 2)
    - [ ] Evidence package complete (Phase 3)
    - [ ] Legal review complete with no blocking issues
    - [ ] Budget approved for HIPAA-compliant GCP services
  - **Artifact:** Executive approval memo
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

---

### Phase 5: BAA Execution (Week 6)

- [ ] **5.1** Sign BAA with Google Cloud
  - **Owner:** CEO (or authorized signatory)
  - **Steps:**
    1. DocuSign or physical signature on BAA
    2. Return signed copy to Google Cloud
    3. Receive fully executed BAA from Google Cloud
  - **Artifact:** Signed BAA PDF (both parties' signatures)
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **5.2** Store signed BAA securely
  - **Owner:** Compliance Officer
  - **Storage Locations (REQUIRED - maintain 3 copies):**
    1. **Primary:** `gs://lifenav-prod-compliance-evidence/hipaa/baa/google-cloud-baa-executed-YYYYMMDD.pdf` (GCS bucket with 7-year retention + Bucket Lock)
    2. **Secondary:** Legal department document management system (DMS) with access control
    3. **Tertiary:** Encrypted USB drive in physical safe (disaster recovery)
  - **Access Control:** Only Compliance Officer, CEO, Legal Counsel can access
  - **Artifact:** Storage confirmation with GCS object metadata showing retention lock
  - **Due Date:** [DATE - same day as signing]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **5.3** Record BAA effective date
  - **Owner:** Compliance Officer
  - **Steps:**
    1. Update `GCP_EPHI_SERVICE_INVENTORY.md` with BAA effective date
    2. Update `HIPAA_SERVICE_POLICY.md` with BAA reference
    3. Create calendar reminder for BAA renewal (if term-limited)
  - **Artifact:** Updated compliance docs with BAA effective date
  - **Due Date:** [DATE - same day as signing]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **5.4** Notify stakeholders of BAA execution
  - **Owner:** Compliance Officer
  - **Notifications:**
    - Email to: Engineering team, Product team, Executive team
    - Subject: "Google Cloud BAA Executed - ePHI Processing Authorized"
    - Include: Effective date, in-scope services, next steps
  - **Artifact:** Email sent confirmation
  - **Due Date:** [DATE - within 24 hours of signing]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

---

## Post-Signature Checklist

**Complete ALL items after BAA is signed and effective.**

### Phase 6: ePHI Processing Authorization (Week 6)

- [ ] **6.1** Update BAA status statement
  - **Owner:** Compliance Officer
  - **Steps:**
    1. Update internal status from "Conditionally Compliant" to "Fully Compliant"
    2. Update external-facing statements (privacy policy, SOC 2 report) to reflect BAA execution
  - **Artifact:** Updated `BAA_STATUS_STATEMENT.md` with new wording
  - **Due Date:** [DATE - within 48 hours of signing]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **6.2** Enable ePHI processing in production
  - **Owner:** CTO
  - **Steps:**
    1. Remove "HIPAA Pending" banners from health features
    2. Enable health data sync from EHR integrations (if applicable)
    3. Notify users that health features are now available
  - **Artifact:** Production deployment log
  - **Due Date:** [DATE]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **6.3** Conduct ePHI flow verification test
  - **Owner:** Security Architect
  - **Test:** Verify ePHI flows ONLY through BAA-covered services
    1. Create test health record in production (with test user)
    2. Trace request through all GCP services (Cloud Logging)
    3. Verify NO ePHI appears in non-HIPAA services (BigQuery, Firebase, etc.)
    4. Delete test data after verification
  - **Artifact:** Test report with log analysis showing ePHI containment
  - **Due Date:** [DATE - within 1 week of enabling ePHI]
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

---

### Phase 7: Ongoing Compliance Monitoring (Monthly)

- [ ] **7.1** Monthly HIPAA service compliance check
  - **Owner:** Compliance Officer
  - **Frequency:** Monthly (1st day of each month)
  - **Checks:**
    - [ ] Verify no prohibited GCP services are processing ePHI (Cloud Logging query)
    - [ ] Verify CMEK encryption is still enabled on Cloud SQL and Cloud Storage
    - [ ] Verify TLS 1.2+ enforcement on Load Balancer and Cloud SQL
    - [ ] Verify audit logs are being exported to 7-year retention bucket
    - [ ] Verify IAM policies have not drifted (compare to approved baseline)
  - **Artifact:** Monthly compliance report saved to `docs/compliance/hipaa/monthly-reports/YYYY-MM-compliance-report.md`
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **7.2** Monthly backup restoration test
  - **Owner:** SRE Team
  - **Frequency:** Monthly (2nd Sunday of each month)
  - **Test:**
    1. Restore Cloud SQL HIPAA database from latest backup to test instance
    2. Verify data integrity (row counts, sample queries)
    3. Measure restoration time (should be < 15 minutes RTO)
    4. Delete test instance after verification
  - **Artifact:** Backup restoration test report
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **7.3** Quarterly access review
  - **Owner:** Compliance Officer + Security Architect
  - **Frequency:** Quarterly (Jan, Apr, Jul, Oct)
  - **Review:**
    1. Export IAM policies for all HIPAA resources
    2. Compare to approved user list
    3. Revoke access for departed employees
    4. Verify service accounts have not been granted excessive permissions
  - **Artifact:** Quarterly access review report with revocations log
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **7.4** Annual BAA review
  - **Owner:** Legal Counsel + Compliance Officer
  - **Frequency:** Annually (or when Google updates HIPAA-eligible services)
  - **Review:**
    1. Check if Google has added/removed services from HIPAA coverage
    2. Verify BAA Exhibit A includes all current in-scope services
    3. Amend BAA if new services added (e.g., Cloud Spanner)
    4. Renew BAA if term-limited
  - **Artifact:** BAA amendment or renewal confirmation
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

---

### Phase 8: Audit Preparation (Ongoing)

- [ ] **8.1** Maintain evidence package
  - **Owner:** Compliance Officer
  - **Frequency:** Continuous
  - **Tasks:**
    - Update configurations in evidence package when infrastructure changes
    - Capture new screenshots quarterly (dated)
    - Refresh audit log samples monthly
    - Keep IAM policy exports current (after each access review)
  - **Artifact:** Evidence package always up-to-date in `gs://lifenav-prod-compliance-evidence/hipaa/`
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

- [ ] **8.2** Prepare for HIPAA audit
  - **Owner:** Compliance Officer
  - **When:** Upon notification of audit (HHS OCR or internal audit)
  - **Preparation:**
    1. Export complete evidence package from GCS
    2. Generate compliance reports for last 12 months
    3. Prepare incident logs (breach analysis if applicable)
    4. Compile training records (all employees completed HIPAA training)
    5. Gather BAA with Google Cloud + any amendments
  - **Artifact:** Audit preparation binder (physical or digital)
  - **Status:** ☐ Not Started | ☐ In Progress | ☐ Complete

---

## Sign-Off

### Pre-Signature Approval

I certify that all items in the Pre-Signature Checklist (Phases 1-5) have been completed and verified.

**Compliance Officer:** _________________________ Date: _____________

**CTO:** _________________________ Date: _____________

**Legal Counsel:** _________________________ Date: _____________

**CEO:** _________________________ Date: _____________

### Post-Signature Confirmation

I certify that the Google Cloud BAA has been executed and all post-signature items are in progress or complete.

**Compliance Officer:** _________________________ Date: _____________

---

## Appendix A: Checklist Timeline

| Phase | Duration | Start Date | End Date | Status |
|-------|----------|------------|----------|--------|
| Phase 1: Business Requirements | 1 week | [DATE] | [DATE] | ☐ |
| Phase 2: Technical Controls | 3 weeks | [DATE] | [DATE] | ☐ |
| Phase 3: Documentation | 1 week | [DATE] | [DATE] | ☐ |
| Phase 4: Legal Review | 1 week | [DATE] | [DATE] | ☐ |
| Phase 5: BAA Execution | 1 week | [DATE] | [DATE] | ☐ |
| Phase 6: ePHI Authorization | 1 week | [DATE] | [DATE] | ☐ |
| Phase 7: Ongoing Monitoring | Monthly | [DATE] | Ongoing | ☐ |
| Phase 8: Audit Preparation | Ongoing | [DATE] | Ongoing | ☐ |

**Total Estimated Time:** 6-8 weeks from start to BAA signature

---

## Appendix B: Escalation Contacts

| Issue | Contact | Email | Phone |
|-------|---------|-------|-------|
| Technical implementation blocked | CTO | cto@lifenavigator.com | [PHONE] |
| Legal issue with BAA terms | Legal Counsel | legal@lifenavigator.com | [PHONE] |
| Compliance question | Compliance Officer | compliance@lifenavigator.com | [PHONE] |
| Google Cloud support | Account Manager | [GOOGLE_AM_EMAIL] | [PHONE] |
| Executive escalation | CEO | ceo@lifenavigator.com | [PHONE] |

---

**Document Control:**
- **Created:** 2026-01-09
- **Last Updated:** 2026-01-09
- **Next Review:** Upon BAA signature or quarterly
- **Version:** 1.0
