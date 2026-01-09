# HIPAA Security Rule Risk Analysis 2026

**Regulation:** 45 CFR § 164.308(a)(1)(ii)(A) - Security Management Process - Risk Analysis

**Analysis Period:** January 1, 2026 - December 31, 2026
**Analysis Date:** January 9, 2026
**Next Analysis Due:** January 9, 2027

---

## Executive Summary

### Purpose

This risk analysis identifies and evaluates potential risks and vulnerabilities to the confidentiality, integrity, and availability of electronic Protected Health Information (ePHI) processed, stored, or transmitted by LifeNavigator. This analysis satisfies the HIPAA Security Rule requirement for an "accurate and thorough assessment of the potential risks and vulnerabilities to the confidentiality, integrity, and availability of ePHI."

### Scope

**In-Scope Systems:**
- Cloud SQL HIPAA database (ln-health-db-beta) - ePHI storage
- Google Kubernetes Engine (GKE) backend - ePHI processing
- Cloud Storage health documents bucket - ePHI storage
- FastAPI backend services - ePHI processing
- Cloud KMS encryption keys - ePHI protection
- Cloud Logging/Monitoring - ePHI audit trails

**Out-of-Scope Systems:**
- Vercel frontend (Next.js) - NO ePHI by design
- Supabase main database - NO ePHI by design
- Third-party services (Sentry, SendGrid, Stripe, Mixpanel) - NO ePHI by design

### Methodology

This risk analysis follows the NIST SP 800-30 Rev. 1 risk assessment framework:
1. **Asset Identification** - Catalog all systems processing ePHI
2. **Threat Identification** - Identify threat sources and events
3. **Vulnerability Identification** - Identify system weaknesses
4. **Likelihood Assessment** - Estimate probability of threat exploitation
5. **Impact Assessment** - Estimate magnitude of harm
6. **Risk Determination** - Calculate risk level (Likelihood × Impact)
7. **Control Recommendation** - Identify safeguards to mitigate risk
8. **Residual Risk Calculation** - Estimate remaining risk after controls

### Risk Rating Scale

**Likelihood:**
- **Very High (5):** Expected to occur multiple times per year (> 10 times/year)
- **High (4):** Likely to occur once or more per year (1-10 times/year)
- **Moderate (3):** May occur once every few years (once per 2-5 years)
- **Low (2):** Unlikely to occur (once per 5-10 years)
- **Very Low (1):** Highly unlikely to occur (< once per 10 years)

**Impact:**
- **Very High (5):** Catastrophic - Mass ePHI breach (> 500 patients), severe regulatory penalties, business closure
- **High (4):** Major - Significant ePHI breach (50-500 patients), regulatory investigation, major financial loss
- **Moderate (3):** Moderate - Limited ePHI breach (< 50 patients), compliance violations, moderate financial loss
- **Low (2):** Minor - No ePHI breach, minor compliance issues, minimal financial impact
- **Very Low (1):** Negligible - No ePHI impact, no compliance issues

**Risk Level (Likelihood × Impact):**
- **Critical (20-25):** Immediate action required, executive escalation
- **High (12-19):** Remediation within 30 days
- **Moderate (6-11):** Remediation within 90 days
- **Low (3-5):** Remediation within 180 days
- **Very Low (1-2):** Accept risk or remediate as resources allow

### Summary of Findings

**Total Risks Identified:** 24
**Critical Risks:** 2
**High Risks:** 5
**Moderate Risks:** 9
**Low Risks:** 6
**Very Low Risks:** 2

**Top 3 Risks:**
1. **SQL Injection in Health Records API** (Risk Score: 20 - Critical)
2. **Cloud SQL Database Publicly Accessible** (Risk Score: 20 - Critical)
3. **Insufficient Access Controls on ePHI** (Risk Score: 16 - High)

**Overall Risk Posture:** MODERATE
**Trend vs. 2025:** N/A (First year of operation)

---

## Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| **Security Officer** | [Name] | ________________ | __________ |
| **Privacy Officer** | [Name] | ________________ | __________ |
| **Compliance Officer** | [Name] | ________________ | __________ |
| **Chief Technology Officer** | [Name] | ________________ | __________ |
| **Chief Executive Officer** | [Name] | ________________ | __________ |

---

## Table of Contents

1. [Asset Inventory](#asset-inventory)
2. [System Data Flow Analysis](#system-data-flow-analysis)
3. [Threat Analysis](#threat-analysis)
4. [Vulnerability Analysis](#vulnerability-analysis)
5. [Risk Assessment Matrix](#risk-assessment-matrix)
6. [Detailed Risk Analysis](#detailed-risk-analysis)
7. [Control Recommendations](#control-recommendations)
8. [Residual Risk Assessment](#residual-risk-assessment)
9. [Risk Treatment Plan](#risk-treatment-plan)
10. [Quarterly Review Schedule](#quarterly-review-schedule)

---

## Asset Inventory

### HIPAA-Regulated Assets (ePHI Processing)

#### 1. Cloud SQL HIPAA Database

| Attribute | Value |
|-----------|-------|
| **Asset ID** | ASSET-001 |
| **Asset Name** | Cloud SQL HIPAA Database (ln-health-db-beta) |
| **Description** | PostgreSQL database storing ePHI including patient diagnoses, treatment notes, medications, lab results |
| **Location** | GCP us-central1 region |
| **ePHI Stored** | YES - Diagnosis, treatment notes, medications, lab results, patient demographics |
| **Data Classification** | RESTRICTED - ePHI |
| **Criticality** | CRITICAL |
| **Owner** | SRE Lead |
| **Business Impact (RTO)** | 15 minutes |
| **Data Loss Tolerance (RPO)** | 1 minute |
| **Current Controls** | CMEK encryption at rest, SSL/TLS in transit, private IP only, PITR backups, audit logging |
| **Compliance Requirements** | HIPAA Security Rule §164.312(a)(2)(iv), §164.312(e)(2)(ii) |

#### 2. GKE Backend Cluster

| Attribute | Value |
|-----------|-------|
| **Asset ID** | ASSET-002 |
| **Asset Name** | Google Kubernetes Engine Cluster (ln-prod-cluster) |
| **Description** | Kubernetes cluster running FastAPI backend services that process ePHI |
| **Location** | GCP us-central1 region |
| **ePHI Stored** | NO - Transient processing only (memory) |
| **ePHI Processed** | YES - API requests containing ePHI |
| **Data Classification** | RESTRICTED - ePHI processing |
| **Criticality** | CRITICAL |
| **Owner** | SRE Lead |
| **Business Impact (RTO)** | 15 minutes |
| **Current Controls** | Private cluster, Workload Identity, Shielded Nodes, Binary Authorization, network policies |
| **Compliance Requirements** | HIPAA Security Rule §164.312(a)(1), §164.312(e)(1) |

#### 3. Cloud Storage Health Documents Bucket

| Attribute | Value |
|-----------|-------|
| **Asset ID** | ASSET-003 |
| **Asset Name** | Cloud Storage Bucket (lifenav-prod-health-documents) |
| **Description** | Object storage for encrypted ePHI documents (PDFs, images) |
| **Location** | GCP us-central1 region |
| **ePHI Stored** | YES - Encrypted health documents, lab results PDFs, medical images |
| **Data Classification** | RESTRICTED - ePHI |
| **Criticality** | HIGH |
| **Owner** | SRE Lead |
| **Business Impact (RTO)** | 1 hour |
| **Data Loss Tolerance (RPO)** | 1 hour |
| **Current Controls** | CMEK encryption, uniform bucket-level access, private (no public access), versioning enabled |
| **Compliance Requirements** | HIPAA Security Rule §164.312(a)(2)(iv) |

#### 4. Cloud KMS Encryption Keys

| Attribute | Value |
|-----------|-------|
| **Asset ID** | ASSET-004 |
| **Asset Name** | Cloud KMS HIPAA Keyring |
| **Description** | Customer-managed encryption keys for ePHI encryption (health-db-key, health-storage-key, field-encryption-key) |
| **Location** | GCP us-central1 region |
| **ePHI Stored** | NO - Encryption keys only |
| **Data Classification** | RESTRICTED - Cryptographic material |
| **Criticality** | CRITICAL |
| **Owner** | Security Lead |
| **Business Impact** | Loss of keys = permanent data loss |
| **Current Controls** | IAM restrictions, 90-day rotation, audit logging, HSM-backed (optional) |
| **Compliance Requirements** | HIPAA Security Rule §164.308(b)(2) - Key Management |

#### 5. FastAPI Backend Services

| Attribute | Value |
|-----------|-------|
| **Asset ID** | ASSET-005 |
| **Asset Name** | FastAPI Backend Application |
| **Description** | Python API services that query/modify ePHI in Cloud SQL |
| **Location** | GKE pods (us-central1) |
| **ePHI Stored** | NO - Stateless |
| **ePHI Processed** | YES - All health-related API endpoints |
| **Data Classification** | RESTRICTED - ePHI processing |
| **Criticality** | CRITICAL |
| **Owner** | Engineering Lead |
| **Current Controls** | Input validation, SQL injection prevention, authentication/authorization, ePHI redaction before frontend, audit logging |
| **Compliance Requirements** | HIPAA Security Rule §164.312(a)(1) |

#### 6. Cloud Logging (Audit Logs)

| Attribute | Value |
|-----------|-------|
| **Asset ID** | ASSET-006 |
| **Asset Name** | Cloud Logging Audit Logs |
| **Description** | 7-year retention audit logs for all ePHI access |
| **Location** | GCP us-central1 + gs://lifenav-prod-hipaa-audit-logs |
| **ePHI Stored** | POTENTIALLY - May contain ePHI in log messages if not properly scrubbed |
| **Data Classification** | RESTRICTED |
| **Criticality** | HIGH |
| **Owner** | SRE Lead |
| **Business Impact (RTO)** | 4 hours (for investigations) |
| **Current Controls** | 7-year retention lock, encryption, access controls, PHI scrubbing in application logs |
| **Compliance Requirements** | HIPAA Security Rule §164.312(b) |

#### 7. Cloud Load Balancer (HTTPS)

| Attribute | Value |
|-----------|-------|
| **Asset ID** | ASSET-007 |
| **Asset Name** | Cloud Load Balancer (HTTPS) |
| **Description** | Entry point for all API requests, terminates TLS |
| **Location** | GCP global (anycast) |
| **ePHI Stored** | NO |
| **ePHI Processed** | YES - ePHI in transit |
| **Data Classification** | RESTRICTED |
| **Criticality** | CRITICAL |
| **Owner** | SRE Lead |
| **Current Controls** | TLS 1.2+ only, modern cipher suites, DDoS protection (Cloud Armor) |
| **Compliance Requirements** | HIPAA Security Rule §164.312(e)(2)(ii) |

### Non-HIPAA Assets (No ePHI)

#### 8. Vercel Frontend

| Attribute | Value |
|-----------|-------|
| **Asset ID** | ASSET-008 |
| **Asset Name** | Vercel Frontend (Next.js) |
| **ePHI Stored** | NO - By design, ePHI is redacted by backend before sending to frontend |
| **Data Classification** | INTERNAL |
| **Criticality** | HIGH |
| **Owner** | Engineering Lead |

#### 9. Supabase Main Database

| Attribute | Value |
|-----------|-------|
| **Asset ID** | ASSET-009 |
| **Asset Name** | Supabase PostgreSQL Database |
| **ePHI Stored** | NO - Non-health data only (user preferences, app settings) |
| **Data Classification** | INTERNAL |
| **Criticality** | HIGH |
| **Owner** | Engineering Lead |

#### 10. Third-Party Services

| Attribute | Value |
|-----------|-------|
| **Asset ID** | ASSET-010 |
| **Asset Name** | Third-Party Services (Sentry, SendGrid, Stripe, Mixpanel) |
| **ePHI Stored** | NO - PHI scrubbing enforced |
| **Data Classification** | INTERNAL |
| **Criticality** | MEDIUM |
| **Owner** | Engineering Lead |

---

## System Data Flow Analysis

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         EXTERNAL USERS                                   │
│                    (Patients, Clinicians, Admins)                        │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ HTTPS (TLS 1.3)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   VERCEL FRONTEND (Non-PHI Zone)                         │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │  Next.js Application (Hosted on Vercel)                         │    │
│  │  - React UI components                                          │    │
│  │  - Client-side state management                                 │    │
│  │  - NO ePHI stored (redacted by backend)                         │    │
│  │  - Auth tokens in encrypted httpOnly cookies                    │    │
│  │  - Auto-logout after 15 min inactivity                          │    │
│  └────────────────────────────────────────────────────────────────┘    │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ HTTPS API Requests (TLS 1.3)
                                 │ Authorization: Bearer <JWT>
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│              GCP TRUST BOUNDARY (HIPAA BAA-Covered)                      │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │       Cloud Load Balancer (HTTPS)                                 │  │
│  │       - TLS termination (TLS 1.2+ only)                           │  │
│  │       - DDoS protection (Cloud Armor)                             │  │
│  │       - SSL policy: MODERN profile                                │  │
│  └────────────────────────────┬─────────────────────────────────────┘  │
│                                │                                         │
│                                │ Internal HTTP (within VPC)              │
│                                ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  GKE Backend Cluster (ln-prod-cluster)                            │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │  FastAPI Backend Pods (HIPAA-Regulated Zone)                │  │  │
│  │  │                                                              │  │  │
│  │  │  Flow:                                                       │  │  │
│  │  │  1. JWT validation (Auth0)                                  │  │  │
│  │  │  2. Authorization check (RBAC)                              │  │  │
│  │  │  3. Query Cloud SQL for ePHI                                │  │  │
│  │  │  4. Redact ePHI before sending to frontend                  │  │  │
│  │  │  5. Audit log all ePHI access                               │  │  │
│  │  │                                                              │  │  │
│  │  │  Endpoints:                                                  │  │  │
│  │  │  - GET /health-records/{patient_id}                         │  │  │
│  │  │  - POST /health-records                                     │  │  │
│  │  │  - PUT /health-records/{id}                                 │  │  │
│  │  │  - GET /medications/{patient_id}                            │  │  │
│  │  │  - POST /lab-results                                        │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  │                                │                                   │  │
│  │                                │ Cloud SQL Proxy (mTLS)            │  │
│  │                                ▼                                   │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │  Cloud SQL (ln-health-db-beta)                             │  │  │
│  │  │  - PostgreSQL 15                                           │  │  │
│  │  │  - CMEK encryption (health-db-key)                         │  │  │
│  │  │  - Private IP only (10.128.0.5)                            │  │  │
│  │  │  - SSL required                                            │  │  │
│  │  │  - Daily backups + PITR                                    │  │  │
│  │  │                                                             │  │  │
│  │  │  Tables:                                                    │  │  │
│  │  │  - health_records (diagnosis, treatment_notes)             │  │  │
│  │  │  - medications (drug_name, dosage, prescriber)             │  │  │
│  │  │  - lab_results (test_name, result_value, normal_range)     │  │  │
│  │  │  - patient_demographics (name, dob, ssn, address)          │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │  Cloud Storage (lifenav-prod-health-documents)             │  │  │
│  │  │  - Encrypted PDFs (lab reports, medical images)            │  │  │
│  │  │  - CMEK encryption (health-storage-key)                    │  │  │
│  │  │  - Uniform bucket-level access (IAM only)                  │  │  │
│  │  │  - Versioning enabled                                      │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │  Cloud KMS (hipaa-keyring)                                 │  │  │
│  │  │  - health-db-key (Cloud SQL encryption)                    │  │  │
│  │  │  - health-storage-key (Cloud Storage encryption)           │  │  │
│  │  │  - field-encryption-key (Application-level encryption)     │  │  │
│  │  │  - 90-day rotation policy                                  │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Logging and Monitoring (HIPAA-Compliant)                         │  │
│  │                                                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │  Cloud Logging                                             │  │  │
│  │  │  - Cloud SQL access logs (7-year retention)               │  │  │
│  │  │  - GKE audit logs (7-year retention)                      │  │  │
│  │  │  - Cloud Storage data access logs (7-year retention)      │  │  │
│  │  │  - Cloud KMS key usage logs (7-year retention)            │  │  │
│  │  │  - Application logs (PHI scrubbed)                        │  │  │
│  │  │  - Retention lock (cannot be deleted)                     │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  │                                                                    │  │
│  │  ┌────────────────────────────────────────────────────────────┐  │  │
│  │  │  Cloud Monitoring (Prometheus/Grafana)                     │  │  │
│  │  │  - HIPAA-specific alerts (ePHI leak detection)            │  │  │
│  │  │  - Database connection pool saturation                    │  │  │
│  │  │  - API error rate spikes                                  │  │  │
│  │  │  - Unauthorized database access attempts                  │  │  │
│  │  └────────────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ ePHI Flow Control Boundary
                                 │ (ePHI MUST NOT cross this line)
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                NON-HIPAA ZONE (No BAA, No ePHI)                          │
│                                                                           │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐            │
│  │    Supabase    │  │     Sentry     │  │   SendGrid     │            │
│  │  (Non-PHI DB)  │  │ (Error Track)  │  │    (Email)     │            │
│  │                │  │ PHI SCRUBBED   │  │  PHI BLOCKED   │            │
│  └────────────────┘  └────────────────┘  └────────────────┘            │
│                                                                           │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐            │
│  │   Mixpanel     │  │     Stripe     │  │     Auth0      │            │
│  │  (Analytics)   │  │   (Payments)   │  │    (OAuth)     │            │
│  │ DE-IDENTIFIED  │  │   NO HEALTH    │  │  NO HEALTH     │            │
│  └────────────────┘  └────────────────┘  └────────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Descriptions

#### Data Flow 1: Patient Accessing Health Records

**Flow:** User → Vercel → Load Balancer → GKE → Cloud SQL → GKE → Load Balancer → Vercel → User

**Steps:**
1. Patient logs into Next.js app hosted on Vercel
2. Authentication via Auth0 (OAuth2), JWT token received
3. User clicks "View Health Records"
4. Frontend sends HTTPS request: `GET /health-records/12345` with JWT in Authorization header
5. Request routed through Cloudflare → Cloud Load Balancer → GKE backend pod
6. Backend validates JWT, checks authorization (patient can only access own records)
7. Backend queries Cloud SQL via Cloud SQL Proxy (mTLS): `SELECT * FROM health_records WHERE patient_id = '12345'`
8. Cloud SQL returns ePHI: `{ diagnosis: "Type 2 Diabetes", treatment_notes: "Patient prescribed metformin", medications: [...] }`
9. **CRITICAL CONTROL:** Backend redacts ePHI before sending to frontend:
   - FULL ePHI stays server-side
   - Frontend receives summary only: `{ has_active_treatment: true, medication_count: 2, last_visit_date: "2026-01-05" }`
10. Backend logs audit trail: `log_phi_access(user_id, action="read", patient_id="12345", fields=["diagnosis", "treatment_notes"])`
11. Frontend displays safe summary (no ePHI shown directly)

**ePHI Transit Protection:**
- External (User → Cloud LB): TLS 1.3 with perfect forward secrecy
- Internal (GKE → Cloud SQL): Cloud SQL Proxy with mTLS
- At rest: AES-256 CMEK encryption

#### Data Flow 2: Clinician Creating Lab Result

**Flow:** Clinician → Vercel → Load Balancer → GKE → Cloud SQL + Cloud Storage

**Steps:**
1. Clinician logs in (MFA required for clinician role)
2. Uploads lab result PDF via form
3. Frontend sends multipart/form-data: `POST /lab-results` with file + metadata
4. Backend validates file (PDF only, max 10MB, virus scan)
5. Backend encrypts PDF with `field-encryption-key` (application-level encryption)
6. Encrypted PDF uploaded to Cloud Storage: `gs://lifenav-prod-health-documents/lab-results/{patient_id}/{uuid}.pdf.enc`
7. Backend inserts metadata into Cloud SQL: `INSERT INTO lab_results (patient_id, test_name, result_value, file_url, uploaded_by, uploaded_at)`
8. Backend logs audit trail: `log_phi_access(user_id, action="create", resource="lab_result", patient_id="12345")`
9. Response to frontend: `{ success: true, lab_result_id: "67890" }` (no ePHI in response)

**ePHI Protection:**
- PDF encrypted twice: Application-level + Cloud Storage CMEK
- Metadata in Cloud SQL: CMEK encrypted at rest
- Audit log: Who uploaded, when, for which patient

#### Data Flow 3: Background Job - Backup Verification

**Flow:** Cloud Scheduler → GKE → Cloud SQL (read replica)

**Steps:**
1. Cloud Scheduler triggers weekly backup verification job
2. GKE pod runs pytest: `test_backup_verification.py`
3. Test creates Cloud SQL read replica from latest backup
4. Test queries replica to verify data integrity
5. Test deletes replica after verification
6. Test results uploaded to GCS: `gs://lifenav-prod-compliance-evidence/hipaa/test-results/weekly/`
7. No ePHI leaves HIPAA trust zone (replica deleted immediately)

#### Data Flow 4: Error Reporting (Non-ePHI)

**Flow:** GKE → Sentry (PHI Scrubbed)

**Steps:**
1. Exception occurs in FastAPI backend
2. Sentry SDK captures exception context
3. **CRITICAL CONTROL:** `before_send()` hook scrubs ePHI BEFORE sending to Sentry
4. PHI fields redacted: `diagnosis="[REDACTED-PHI]"`, `ssn="[REDACTED-PHI]"`
5. Safe context sent to Sentry: `{ error_type: "DatabaseError", patient_id: "[REDACTED]" }`
6. ePHI NEVER leaves HIPAA trust zone

#### Data Flow 5: Email Notification (Non-ePHI)

**Flow:** GKE → SendGrid (PHI Blocked)

**Steps:**
1. Backend attempts to send appointment reminder email
2. **CRITICAL CONTROL:** `send_email()` function checks for PHI content
3. Safe email: "You have an appointment on Jan 15 at 2 PM" → ALLOWED
4. Unsafe email: "Your glucose level is 145 mg/dL" → BLOCKED with exception
5. Only safe emails sent via SendGrid
6. ePHI NEVER sent to SendGrid

---

## Threat Analysis

### Threat Sources

#### 1. External Threats

| Threat Source | Description | Motivation | Capability |
|---------------|-------------|------------|------------|
| **Cybercriminals** | Organized crime groups targeting healthcare data | Financial gain (sell ePHI on dark web, ransomware) | HIGH - Sophisticated tools, zero-day exploits |
| **Nation-State Actors** | State-sponsored APT groups | Espionage, disruption | VERY HIGH - Advanced persistent threats |
| **Hacktivists** | Politically motivated attackers | Ideological, reputational damage | MODERATE - DDoS, defacement |
| **Script Kiddies** | Unskilled attackers using automated tools | Notoriety, curiosity | LOW - Automated scanners |

#### 2. Internal Threats

| Threat Source | Description | Motivation | Capability |
|---------------|-------------|------------|------------|
| **Malicious Insiders** | Employees intentionally stealing ePHI | Financial gain, revenge | HIGH - Legitimate access |
| **Negligent Employees** | Unintentional data exposure (email to wrong person) | None (accidental) | MODERATE - Human error |
| **Contractors/Vendors** | Third-party with temporary access | Financial gain, espionage | MODERATE - Limited access |

#### 3. Environmental Threats

| Threat Source | Description | Impact |
|---------------|-------------|--------|
| **Natural Disasters** | Earthquakes, floods, fires | Data center outage, data loss |
| **Power Outages** | Utility failures | Service disruption |
| **Hardware Failures** | Disk failures, network failures | Data loss, downtime |

### Threat Events

| Threat ID | Threat Event | Threat Source | Affected Assets |
|-----------|--------------|---------------|-----------------|
| **T-001** | SQL injection attack on health records API | External cybercriminals | ASSET-001 (Cloud SQL), ASSET-005 (FastAPI) |
| **T-002** | Unauthorized access to Cloud SQL database | External attackers, malicious insiders | ASSET-001 (Cloud SQL) |
| **T-003** | Ransomware encrypting ePHI | External cybercriminals | ASSET-001 (Cloud SQL), ASSET-003 (Cloud Storage) |
| **T-004** | DDoS attack on API endpoints | External hacktivists | ASSET-002 (GKE), ASSET-007 (Load Balancer) |
| **T-005** | Insider exfiltration of ePHI | Malicious insiders | ASSET-001 (Cloud SQL) |
| **T-006** | Phishing attack compromising employee credentials | External cybercriminals | ASSET-001, ASSET-002, ASSET-005 |
| **T-007** | Man-in-the-middle attack intercepting ePHI in transit | External attackers | ASSET-007 (Load Balancer) |
| **T-008** | Cloud KMS key compromise | External attackers, malicious insiders | ASSET-004 (Cloud KMS) |
| **T-009** | ePHI leaked to Sentry error logs | Negligent developers | ASSET-005 (FastAPI), ASSET-010 (Sentry) |
| **T-010** | ePHI sent via email (SendGrid) | Negligent developers | ASSET-005 (FastAPI), ASSET-010 (SendGrid) |
| **T-011** | Cloud SQL database publicly exposed | Configuration error | ASSET-001 (Cloud SQL) |
| **T-012** | GKE cluster with public nodes | Configuration error | ASSET-002 (GKE) |
| **T-013** | Cloud Storage bucket made public | Configuration error | ASSET-003 (Cloud Storage) |
| **T-014** | Backup failure (data loss) | Hardware failure, software bug | ASSET-001 (Cloud SQL) |
| **T-015** | Audit log deletion | Malicious insiders, attackers | ASSET-006 (Cloud Logging) |
| **T-016** | Privilege escalation | External attackers, malicious insiders | ASSET-002 (GKE), ASSET-005 (FastAPI) |
| **T-017** | Supply chain attack (compromised dependency) | Nation-state actors, cybercriminals | ASSET-005 (FastAPI) |
| **T-018** | Regional outage (GCP us-central1) | Natural disaster, GCP incident | All assets |
| **T-019** | Weak TLS configuration | Configuration error | ASSET-007 (Load Balancer) |
| **T-020** | Unpatched vulnerabilities | Negligence | All assets |
| **T-021** | API authentication bypass | External attackers | ASSET-005 (FastAPI) |
| **T-022** | Cross-site scripting (XSS) in frontend | External attackers | ASSET-008 (Vercel Frontend) |
| **T-023** | Session hijacking | External attackers | ASSET-008 (Vercel Frontend), ASSET-005 (FastAPI) |
| **T-024** | Insufficient logging/monitoring | None (weakness) | ASSET-006 (Cloud Logging) |

---

## Vulnerability Analysis

| Vuln ID | Vulnerability | Affected Asset | Severity | Discovery Method |
|---------|---------------|----------------|----------|------------------|
| **V-001** | Lack of input validation on health records API | ASSET-005 (FastAPI) | CRITICAL | Code review |
| **V-002** | Cloud SQL database has public IP enabled | ASSET-001 (Cloud SQL) | CRITICAL | Config audit |
| **V-003** | Overly permissive IAM roles on Cloud SQL | ASSET-001 (Cloud SQL) | HIGH | IAM audit |
| **V-004** | No rate limiting on authentication endpoints | ASSET-005 (FastAPI) | HIGH | Penetration test |
| **V-005** | Sentry PHI scrubber not tested | ASSET-010 (Sentry) | HIGH | Compliance review |
| **V-006** | No MFA enforcement for all users | ASSET-005 (FastAPI) | HIGH | Policy review |
| **V-007** | Weak session timeout (30 minutes instead of 15) | ASSET-008 (Vercel), ASSET-005 (FastAPI) | MODERATE | Code review |
| **V-008** | Audit logs not monitored for anomalies | ASSET-006 (Cloud Logging) | MODERATE | Process review |
| **V-009** | No encryption at application layer for extra-sensitive fields | ASSET-001 (Cloud SQL) | MODERATE | Design review |
| **V-010** | Backup restoration not tested monthly | ASSET-001 (Cloud SQL) | MODERATE | Process review |
| **V-011** | No DDoS protection on API endpoints | ASSET-007 (Load Balancer) | MODERATE | Pen test |
| **V-012** | Outdated Python dependencies | ASSET-005 (FastAPI) | MODERATE | Dependency scan |
| **V-013** | No web application firewall (WAF) rules | ASSET-007 (Load Balancer) | LOW | Security review |
| **V-014** | No container image scanning | ASSET-002 (GKE) | LOW | Process review |
| **V-015** | Verbose error messages exposing system details | ASSET-005 (FastAPI) | LOW | Pen test |

---

## Risk Assessment Matrix

### Risk Matrix Heat Map

```
                    IMPACT
           │ Very Low │  Low  │ Moderate │  High  │ Very High │
           │    (1)   │  (2)  │    (3)   │  (4)   │    (5)    │
═══════════╪══════════╪═══════╪══════════╪════════╪═══════════╡
Very High  │          │       │          │  R-004 │  R-001    │
   (5)     │          │       │          │        │  R-002    │
───────────┼──────────┼───────┼──────────┼────────┼───────────┤
High       │          │       │  R-010   │  R-003 │           │
   (4)     │          │       │  R-011   │  R-005 │           │
           │          │       │          │  R-006 │           │
───────────┼──────────┼───────┼──────────┼────────┼───────────┤
Moderate   │          │ R-015 │  R-007   │  R-008 │           │
   (3)     │          │ R-016 │  R-012   │  R-009 │           │
           │          │       │  R-013   │        │           │
           │          │       │  R-014   │        │           │
───────────┼──────────┼───────┼──────────┼────────┼───────────┤
Low        │          │ R-018 │  R-017   │        │           │
   (2)     │          │ R-019 │          │        │           │
           │          │ R-020 │          │        │           │
───────────┼──────────┼───────┼──────────┼────────┼───────────┤
Very Low   │          │ R-021 │          │        │           │
   (1)     │          │ R-022 │          │        │           │
           │          │       │          │        │           │
═══════════╧══════════╧═══════╧══════════╧════════╧═══════════╡
         LIKELIHOOD
```

---

## Detailed Risk Analysis

### CRITICAL RISKS (20-25)

#### R-001: SQL Injection in Health Records API

| Field | Value |
|-------|-------|
| **Risk ID** | R-001 |
| **Risk Title** | SQL Injection in Health Records API |
| **Threat** | T-001 (SQL injection attack) |
| **Vulnerability** | V-001 (Lack of input validation) |
| **Affected Assets** | ASSET-001 (Cloud SQL), ASSET-005 (FastAPI) |
| **Likelihood** | Very High (5) - Common attack vector, automated scanners |
| **Impact** | Very High (5) - Full database compromise, mass ePHI breach (> 500 patients) |
| **Risk Score** | 25 (CRITICAL) |
| **Current Controls** | None - ORM (SQLAlchemy) provides some protection but not validated |
| **Residual Risk (after controls)** | LOW (6) - Parameterized queries + input validation |
| **Control Recommendations** | 1. Implement strict input validation (whitelisting)<br>2. Use parameterized queries exclusively<br>3. Deploy WAF with SQL injection detection<br>4. Automated SQL injection testing in CI/CD |
| **Owner** | Engineering Lead |
| **Due Date** | 2026-02-01 (HIGH PRIORITY) |
| **Status** | OPEN |

**Detailed Analysis:**

SQL injection is the #1 OWASP vulnerability. If an attacker can inject SQL commands into API parameters (e.g., `GET /health-records?patient_id=12345' OR '1'='1`), they could:
- Extract entire ePHI database: `SELECT * FROM health_records`
- Modify records: `UPDATE health_records SET diagnosis='...'`
- Delete records: `DROP TABLE health_records`
- Escalate privileges: Create admin users

**Scenario:**
```python
# VULNERABLE CODE (hypothetical):
patient_id = request.query_params.get("patient_id")
query = f"SELECT * FROM health_records WHERE patient_id = '{patient_id}'"  # DANGER!
results = db.execute(query)

# Attacker sends: patient_id=12345' OR '1'='1' --
# Executed query: SELECT * FROM health_records WHERE patient_id = '12345' OR '1'='1' --'
# Result: Returns ALL patient records!
```

**Business Impact:**
- HIPAA breach affecting > 500 patients → HHS notification, media notification
- $50,000+ per patient in damages (class action lawsuit)
- OCR fines: $100,000 - $1.5M
- Reputational damage, customer churn

---

#### R-002: Cloud SQL Database Publicly Accessible

| Field | Value |
|-------|-------|
| **Risk ID** | R-002 |
| **Risk Title** | Cloud SQL Database Publicly Accessible (Public IP) |
| **Threat** | T-011 (Database publicly exposed via configuration error) |
| **Vulnerability** | V-002 (Public IP enabled on Cloud SQL instance) |
| **Affected Assets** | ASSET-001 (Cloud SQL) |
| **Likelihood** | Very High (5) - Common misconfiguration, defaults to public IP |
| **Impact** | Very High (5) - Direct database access, mass ePHI breach |
| **Risk Score** | 25 (CRITICAL) |
| **Current Controls** | Firewall rules MAY restrict access, but public IP exists |
| **Residual Risk (after controls)** | VERY LOW (2) - Private IP only + VPC peering |
| **Control Recommendations** | 1. Disable public IP on Cloud SQL instance<br>2. Use private IP with VPC peering<br>3. Organization Policy: Deny public IPs<br>4. Weekly automated compliance scan |
| **Owner** | SRE Lead |
| **Due Date** | 2026-01-15 (IMMEDIATE) |
| **Status** | OPEN |

**Detailed Analysis:**

If Cloud SQL has a public IP (even with firewall rules), it's exposed to the internet. Risks:
- Brute-force attacks on database password
- Exploitation of PostgreSQL vulnerabilities
- Credential stuffing (reused passwords from other breaches)
- Zero-day exploits

**Scenario:**
- Attacker scans GCP IP ranges for open PostgreSQL ports (5432)
- Finds Cloud SQL instance with public IP: `35.x.x.x:5432`
- Attempts to connect: `psql -h 35.x.x.x -U postgres -d health_db`
- Brute-forces weak password or exploits CVE-XXXX-XXXX
- Gains full database access

**Business Impact:**
- Same as R-001: Mass breach, HHS notification, OCR fines, lawsuits

---

### HIGH RISKS (12-19)

#### R-003: Insufficient Access Controls on ePHI

| Field | Value |
|-------|-------|
| **Risk ID** | R-003 |
| **Risk Title** | Insufficient Access Controls on ePHI (Overly Permissive IAM) |
| **Threat** | T-002 (Unauthorized access), T-005 (Insider exfiltration) |
| **Vulnerability** | V-003 (Overly permissive IAM roles) |
| **Affected Assets** | ASSET-001 (Cloud SQL), ASSET-003 (Cloud Storage) |
| **Likelihood** | High (4) - Common in early-stage startups |
| **Impact** | High (4) - Significant ePHI breach (50-500 patients) |
| **Risk Score** | 16 (HIGH) |
| **Current Controls** | Basic IAM roles, but no least-privilege enforcement |
| **Residual Risk (after controls)** | MODERATE (9) - Least-privilege IAM + quarterly access reviews |
| **Control Recommendations** | 1. Implement least-privilege IAM (roles, not individual permissions)<br>2. Quarterly access reviews (who has access to Cloud SQL?)<br>3. MFA required for all Cloud SQL access<br>4. Just-in-time (JIT) access for SRE team |
| **Owner** | Security Lead |
| **Due Date** | 2026-02-28 |
| **Status** | OPEN |

**Scenario:**
- SRE team has `roles/cloudsql.admin` on production database
- Marketing intern accidentally added to SRE group
- Intern explores GCP console, opens Cloud SQL
- Exports entire database to CSV, downloads to laptop
- Laptop stolen → ePHI breach

**Business Impact:**
- Breach affecting 50-500 patients
- OCR investigation, potential fines ($10,000 - $100,000)
- Customer trust erosion

---

#### R-004: DDoS Attack on API Endpoints

| Field | Value |
|-------|-------|
| **Risk ID** | R-004 |
| **Risk Title** | DDoS Attack Causing Service Outage |
| **Threat** | T-004 (DDoS attack) |
| **Vulnerability** | V-011 (No DDoS protection beyond basic Cloud Armor) |
| **Affected Assets** | ASSET-002 (GKE), ASSET-007 (Load Balancer) |
| **Likelihood** | Very High (5) - Healthcare is targeted sector |
| **Impact** | Moderate (3) - Service outage, no ePHI breach but HIPAA availability violation |
| **Risk Score** | 15 (HIGH) |
| **Current Controls** | Cloud Armor with basic rate limiting |
| **Residual Risk (after controls)** | LOW (5) - Advanced DDoS protection |
| **Control Recommendations** | 1. Configure Cloud Armor advanced rules<br>2. Deploy rate limiting at application layer<br>3. Auto-scaling for GKE (HPA)<br>4. DDoS response playbook |
| **Owner** | SRE Lead |
| **Due Date** | 2026-03-31 |
| **Status** | OPEN |

---

#### R-005: Phishing Attack Compromising Employee Credentials

| Field | Value |
|-------|-------|
| **Risk ID** | R-005 |
| **Risk Title** | Phishing Attack Compromising Employee Credentials |
| **Threat** | T-006 (Phishing attack) |
| **Vulnerability** | V-006 (No MFA enforcement for all users) |
| **Affected Assets** | All HIPAA assets |
| **Likelihood** | High (4) - Phishing is most common attack |
| **Impact** | High (4) - Unauthorized ePHI access via compromised account |
| **Risk Score** | 16 (HIGH) |
| **Current Controls** | MFA available but not enforced for all users |
| **Residual Risk (after controls)** | MODERATE (9) - Mandatory MFA + phishing training |
| **Control Recommendations** | 1. Enforce MFA for all users (Google Workspace, GCP, GitHub)<br>2. Deploy phishing-resistant MFA (WebAuthn/FIDO2)<br>3. Quarterly phishing simulation training<br>4. Email security (DMARC, SPF, DKIM) |
| **Owner** | Security Lead |
| **Due Date** | 2026-02-15 |
| **Status** | OPEN |

---

#### R-006: ePHI Leaked to Sentry Error Logs

| Field | Value |
|-------|-------|
| **Risk ID** | R-006 |
| **Risk Title** | ePHI Leaked to Sentry Error Logs (Non-HIPAA Service) |
| **Threat** | T-009 (ePHI leaked to Sentry) |
| **Vulnerability** | V-005 (Sentry PHI scrubber not tested) |
| **Affected Assets** | ASSET-005 (FastAPI), ASSET-010 (Sentry) |
| **Likelihood** | High (4) - Developers may not be aware of PHI scrubbing |
| **Impact** | High (4) - ePHI sent to non-BAA service = HIPAA violation |
| **Risk Score** | 16 (HIGH) |
| **Current Controls** | Sentry `before_send()` hook with PHI scrubbing (not tested) |
| **Residual Risk (after controls)** | LOW (6) - Tested PHI scrubber + CI/CD validation |
| **Control Recommendations** | 1. Automated tests for Sentry PHI scrubbing (`test_sentry_error_does_not_contain_phi`)<br>2. CI/CD check: Fail build if Sentry event contains PHI patterns<br>3. Developer training on PHI scrubbing<br>4. Monthly audit of Sentry events for PHI leakage |
| **Owner** | Engineering Lead |
| **Due Date** | 2026-02-15 |
| **Status** | OPEN |

---

### MODERATE RISKS (6-11)

#### R-007: Weak Session Timeout

| Field | Value |
|-------|-------|
| **Risk ID** | R-007 |
| **Risk Title** | Weak Session Timeout (30 min instead of 15 min) |
| **Threat** | T-023 (Session hijacking) |
| **Vulnerability** | V-007 (Weak session timeout) |
| **Affected Assets** | ASSET-008 (Vercel Frontend), ASSET-005 (FastAPI) |
| **Likelihood** | Moderate (3) - Requires physical access or XSS |
| **Impact** | Moderate (3) - Unauthorized access to single patient record |
| **Risk Score** | 9 (MODERATE) |
| **Current Controls** | 30-minute session timeout |
| **Residual Risk (after controls)** | LOW (3) - 15-minute timeout |
| **Control Recommendations** | 1. Reduce session timeout to 15 minutes (HIPAA best practice)<br>2. Implement auto-logout on inactivity<br>3. Clear session on browser close |
| **Owner** | Engineering Lead |
| **Due Date** | 2026-03-15 |
| **Status** | OPEN |

---

#### R-008: Cloud KMS Key Compromise

| Field | Value |
|-------|-------|
| **Risk ID** | R-008 |
| **Risk Title** | Cloud KMS Encryption Key Compromise |
| **Threat** | T-008 (Cloud KMS key compromise) |
| **Vulnerability** | None identified (low likelihood) |
| **Affected Assets** | ASSET-004 (Cloud KMS), ASSET-001 (Cloud SQL), ASSET-003 (Cloud Storage) |
| **Likelihood** | Moderate (3) - Requires GCP account compromise |
| **Impact** | High (4) - All ePHI decryptable if key stolen |
| **Risk Score** | 12 (MODERATE) |
| **Current Controls** | IAM restrictions, audit logging, 90-day rotation |
| **Residual Risk (after controls)** | LOW (6) - HSM-backed keys + key access monitoring |
| **Control Recommendations** | 1. Upgrade to HSM-backed keys (FIPS 140-2 Level 3)<br>2. Alert on any Cloud KMS key access<br>3. Implement key access approval workflow<br>4. Test key rotation procedure |
| **Owner** | Security Lead |
| **Due Date** | 2026-04-30 |
| **Status** | OPEN |

---

#### R-009: Ransomware Encrypting ePHI

| Field | Value |
|-------|-------|
| **Risk ID** | R-009 |
| **Risk Title** | Ransomware Encrypting ePHI |
| **Threat** | T-003 (Ransomware) |
| **Vulnerability** | None identified (assumes multiple security failures) |
| **Affected Assets** | ASSET-001 (Cloud SQL), ASSET-003 (Cloud Storage) |
| **Likelihood** | Moderate (3) - Healthcare is targeted |
| **Impact** | High (4) - Data unavailability, potential data loss |
| **Risk Score** | 12 (MODERATE) |
| **Current Controls** | Daily backups with PITR, immutable backups (retention lock) |
| **Residual Risk (after controls)** | LOW (4) - Offline backups + tested restoration |
| **Control Recommendations** | 1. Test backup restoration monthly (already planned)<br>2. Implement offline backup copies (air-gapped)<br>3. Deploy endpoint detection and response (EDR)<br>4. Ransomware response playbook |
| **Owner** | SRE Lead + Security Lead |
| **Due Date** | 2026-05-31 |
| **Status** | OPEN |

---

(Remaining risks R-010 through R-024 follow similar format, documenting Moderate/Low/Very Low risks)

---

## Control Recommendations

### Administrative Controls (HIPAA § 164.308)

| Control ID | Control Description | Addresses Risks | Implementation Status |
|------------|---------------------|-----------------|----------------------|
| **AC-001** | Mandatory MFA for all users | R-005 (Phishing), R-003 (Unauthorized access) | PARTIAL - MFA available but not enforced |
| **AC-002** | Quarterly access reviews | R-003 (Excessive permissions) | NOT IMPLEMENTED |
| **AC-003** | Security awareness training (annual) | R-005 (Phishing), R-006 (PHI leaks) | NOT IMPLEMENTED |
| **AC-004** | Workforce sanctions policy | All insider threats | NOT IMPLEMENTED |
| **AC-005** | Incident response plan | All threats | PARTIAL - Runbooks exist |

### Physical Controls (HIPAA § 164.310)

| Control ID | Control Description | Addresses Risks | Implementation Status |
|------------|---------------------|-----------------|----------------------|
| **PC-001** | Data center physical security (GCP responsibility) | T-018 (Regional outage) | IMPLEMENTED (GCP) |
| **PC-002** | Workstation encryption | R-005 (Stolen laptop) | PARTIAL - Not all workstations encrypted |
| **PC-003** | Secure media disposal | ePHI on decommissioned hardware | NOT IMPLEMENTED |

### Technical Controls (HIPAA § 164.312)

| Control ID | Control Description | Addresses Risks | Implementation Status |
|------------|---------------------|-----------------|----------------------|
| **TC-001** | Input validation (whitelisting) | R-001 (SQL injection) | NOT IMPLEMENTED |
| **TC-002** | Parameterized queries | R-001 (SQL injection) | PARTIAL - Used but not validated |
| **TC-003** | WAF with SQL injection detection | R-001 (SQL injection) | NOT IMPLEMENTED |
| **TC-004** | Cloud SQL private IP only | R-002 (Public database) | NOT IMPLEMENTED (PUBLIC IP EXISTS) |
| **TC-005** | Organization Policy: Deny public IPs | R-002 (Public database), R-012 (Public GKE) | NOT IMPLEMENTED |
| **TC-006** | Least-privilege IAM | R-003 (Excessive permissions) | PARTIAL |
| **TC-007** | DDoS protection (Cloud Armor advanced) | R-004 (DDoS) | PARTIAL - Basic rules only |
| **TC-008** | Rate limiting (application layer) | R-004 (DDoS) | NOT IMPLEMENTED |
| **TC-009** | Sentry PHI scrubber testing | R-006 (PHI leak to Sentry) | NOT IMPLEMENTED |
| **TC-010** | SendGrid PHI detection | R-010 (PHI via email) | NOT IMPLEMENTED |
| **TC-011** | 15-minute session timeout | R-007 (Session hijacking) | PARTIAL - 30 min currently |
| **TC-012** | HSM-backed Cloud KMS keys | R-008 (Key compromise) | NOT IMPLEMENTED |
| **TC-013** | Audit log monitoring (anomaly detection) | R-015 (Audit log deletion) | NOT IMPLEMENTED |
| **TC-014** | Container image scanning | R-017 (Supply chain attack) | NOT IMPLEMENTED |
| **TC-015** | Dependency vulnerability scanning | R-012 (Outdated dependencies) | PARTIAL - Dependabot enabled |

---

## Residual Risk Assessment

After implementing all recommended controls:

| Risk Level | Inherent Risk Count | Residual Risk Count | Risk Reduction |
|------------|---------------------|---------------------|----------------|
| **Critical** | 2 | 0 | 100% |
| **High** | 5 | 0 | 100% |
| **Moderate** | 9 | 4 | 56% |
| **Low** | 6 | 14 | +133% (risks downgraded) |
| **Very Low** | 2 | 6 | +200% (risks downgraded) |

**Overall Residual Risk Posture:** LOW (acceptable)

---

## Risk Treatment Plan

### Immediate Actions (< 30 days)

| Risk ID | Action | Owner | Due Date | Priority |
|---------|--------|-------|----------|----------|
| **R-002** | Disable public IP on Cloud SQL | SRE Lead | 2026-01-15 | P0 - CRITICAL |
| **R-001** | Implement input validation + WAF | Engineering Lead | 2026-02-01 | P0 - CRITICAL |
| **R-005** | Enforce MFA for all users | Security Lead | 2026-02-15 | P1 - HIGH |
| **R-006** | Implement Sentry PHI scrubber tests | Engineering Lead | 2026-02-15 | P1 - HIGH |

### Short-Term Actions (30-90 days)

| Risk ID | Action | Owner | Due Date | Priority |
|---------|--------|-------|----------|----------|
| **R-003** | Implement least-privilege IAM + quarterly reviews | Security Lead | 2026-02-28 | P1 - HIGH |
| **R-004** | Configure Cloud Armor advanced DDoS protection | SRE Lead | 2026-03-31 | P1 - HIGH |
| **R-007** | Reduce session timeout to 15 minutes | Engineering Lead | 2026-03-15 | P2 - MODERATE |

### Long-Term Actions (90-180 days)

| Risk ID | Action | Owner | Due Date | Priority |
|---------|--------|-------|----------|----------|
| **R-008** | Upgrade to HSM-backed Cloud KMS keys | Security Lead | 2026-04-30 | P2 - MODERATE |
| **R-009** | Implement offline backup copies | SRE Lead | 2026-05-31 | P2 - MODERATE |

---

## Quarterly Review Schedule

### Q1 2026 (Jan-Mar)

- **Review Date:** January 9, 2026 (INITIAL)
- **Focus:** Critical and High risks
- **Activities:**
  - Execute immediate actions (R-001, R-002, R-005, R-006)
  - Quarterly access review (first run)
  - Validate control effectiveness

### Q2 2026 (Apr-Jun)

- **Review Date:** April 10, 2026
- **Focus:** Residual risks, new threats
- **Activities:**
  - Reassess risks after Q1 controls implemented
  - Identify new risks from system changes
  - Quarterly access review
  - Update risk register

### Q3 2026 (Jul-Sep)

- **Review Date:** July 10, 2026
- **Focus:** Moderate and Low risks
- **Activities:**
  - Progress check on long-term actions
  - Quarterly access review
  - Penetration test findings review

### Q4 2026 (Oct-Dec)

- **Review Date:** October 10, 2026
- **Focus:** Annual preparation
- **Activities:**
  - Full risk reassessment (prep for 2027 analysis)
  - Quarterly access review
  - Risk trend analysis (vs. Q1-Q3)
  - Prepare annual sign-off

---

## Annual Sign-Off Workflow

### Step 1: Preparation (December)

**Owner:** Security Officer

**Tasks:**
1. Collect all quarterly risk register updates
2. Compile risk treatment evidence:
   - Closed risks with proof of remediation
   - Open risks with justification for acceptance
   - New risks identified during the year
3. Update asset inventory
4. Update threat landscape analysis
5. Review incident reports for risk materialization

### Step 2: Review Meeting (January)

**Attendees:** Security Officer, Privacy Officer, Compliance Officer, CTO, CEO

**Agenda:**
1. Present risk analysis findings (30 min)
2. Review top 10 risks and remediation status (45 min)
3. Discuss residual risks and acceptance (15 min)
4. Approve risk treatment plan for next year (15 min)
5. Q&A (15 min)

### Step 3: Executive Sign-Off (January)

**Signatories:**
- Security Officer
- Privacy Officer
- Compliance Officer
- Chief Technology Officer
- Chief Executive Officer

**Deliverables:**
- `docs/compliance/risk_analysis/RISK_ANALYSIS_2026.md` (signed PDF)
- `docs/compliance/risk_analysis/RISK_REGISTER_2026.csv` (Excel with signatures)

### Step 4: Evidence Archival (January)

**Storage Location:** `gs://lifenav-prod-compliance-evidence/risk-analysis/2026/`

**Files:**
- `RISK_ANALYSIS_2026.md` (this document)
- `RISK_REGISTER_2026.csv` (detailed risk register)
- `RISK_TREATMENT_PLAN_2026.pdf` (remediation tracking)
- `QUARTERLY_REVIEWS_2026/` (Q1-Q4 meeting notes)
- `SIGN_OFF_SIGNATURES_2026.pdf` (executive signatures)

**Retention:** 7 years (HIPAA requirement)

---

## Appendices

### Appendix A: Risk Register Export

See: `docs/compliance/risk_analysis/RISK_REGISTER_2026.csv`

### Appendix B: Asset Inventory Detailed

See: `docs/compliance/risk_analysis/ASSET_INVENTORY_2026.xlsx`

### Appendix C: Threat Intelligence Sources

- CISA Cybersecurity Alerts (https://www.cisa.gov/uscert/ncas/alerts)
- OWASP Top 10 (https://owasp.org/www-project-top-ten/)
- NIST National Vulnerability Database (https://nvd.nist.gov/)
- HHS OCR Breach Portal (https://ocrportal.hhs.gov/ocr/breach/breach_report.jsf)

### Appendix D: References

- NIST SP 800-30 Rev. 1: Guide for Conducting Risk Assessments
- NIST SP 800-66 Rev. 1: Implementing the HIPAA Security Rule
- 45 CFR § 164.308(a)(1)(ii)(A): HIPAA Security Rule - Risk Analysis
- HITRUST CSF v11: Risk Analysis Requirements

---

**Document Version:** 1.0
**Last Updated:** 2026-01-09
**Next Update Due:** 2027-01-09
**Classification:** RESTRICTED - COMPLIANCE EVIDENCE
**Retention:** 7 years

**Evidence Location:**
- Primary: `gs://lifenav-prod-compliance-evidence/risk-analysis/2026/RISK_ANALYSIS_2026.md`
- Secondary: Legal DMS: `Legal/Compliance/HIPAA/Risk Analysis/2026/`
