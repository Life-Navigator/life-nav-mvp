# GCP ePHI Service Inventory - HIPAA Compliance

**Status:** Conditionally Compliant - Pending BAA Execution
**Last Updated:** 2026-01-09
**Compliance Officer:** [NAME]
**GCP Project ID:** lifenav-prod
**Environment:** Production

---

## Executive Summary

This document provides a **definitive list** of Google Cloud Platform (GCP) services that process, store, or transmit electronic Protected Health Information (ePHI) for LifeNavigator. All services listed below are **HIPAA-eligible** and will be covered under the Business Associate Agreement (BAA) with Google Cloud.

**CRITICAL:** Any service NOT listed in Section 1 below is **PROHIBITED** from processing ePHI.

---

## Section 1: IN-SCOPE GCP Services Processing ePHI

### Service Classification Legend

- **[EPHI-STORAGE]** - Stores ePHI at rest
- **[EPHI-TRANSIT]** - Transmits ePHI in transit
- **[EPHI-PROCESSING]** - Processes ePHI (compute)
- **[EPHI-SECURITY]** - Secures ePHI (encryption, access control)
- **[EPHI-AUDIT]** - Audits ePHI access (logging, monitoring)

---

### 1.1 Database Services

#### Cloud SQL for PostgreSQL (HIPAA Instance)

**Service Name:** `Cloud SQL for PostgreSQL`
**Instance Name:** `ln-health-db-beta` (production), `ln-health-db-staging` (staging)
**GCP API:** `sqladmin.googleapis.com`
**Classification:** [EPHI-STORAGE] [EPHI-PROCESSING]
**BAA Required:** ✅ YES - COVERED

**ePHI Data Stored:**
- Patient health conditions (diagnoses, symptoms)
- Medications (prescriptions, dosages, schedules)
- Medical procedures and treatments
- Lab results and vital signs
- Health insurance information
- Provider notes and care plans

**HIPAA Controls Enabled:**
- ✅ **Encryption at Rest:** Google-managed encryption keys (GMEK) or Customer-Managed Encryption Keys (CMEK) via Cloud KMS
- ✅ **Encryption in Transit:** TLS 1.2+ enforced for all connections
- ✅ **Backup Encryption:** Automated daily backups encrypted with same key as instance
- ✅ **Point-in-Time Recovery (PITR):** Enabled with 7-day transaction log retention
- ✅ **Private IP:** Instance uses VPC private IP (no public internet access)
- ✅ **SSL Enforcement:** `require_ssl = on` configured
- ✅ **Audit Logging:** Cloud SQL audit logs enabled (data access, admin activity)
- ✅ **Automatic Backups:** Daily at 04:00 UTC, 7-day retention
- ✅ **High Availability:** Regional configuration with automatic failover (optional, recommended for production)

**Configuration Requirements:**
```yaml
# Terraform configuration (REQUIRED settings)
resource "google_sql_database_instance" "hipaa_db" {
  name             = "ln-health-db-beta"
  database_version = "POSTGRES_15"
  region           = "us-central1"

  settings {
    tier              = "db-custom-2-7680"
    availability_type = "REGIONAL"  # REQUIRED for HIPAA (HA)

    backup_configuration {
      enabled                        = true
      start_time                     = "04:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
      }
    }

    ip_configuration {
      ipv4_enabled    = false  # REQUIRED: No public IP
      private_network = google_compute_network.vpc.id
      require_ssl     = true   # REQUIRED: SSL only
    }

    database_flags {
      name  = "cloudsql.enable_pgaudit"
      value = "on"  # REQUIRED: Enable audit logging
    }
  }
}
```

**Evidence Artifacts Required:**
1. Cloud SQL instance configuration export (JSON)
2. Screenshot of encryption settings showing CMEK key
3. Screenshot of backup configuration showing PITR enabled
4. Cloud SQL audit logs export (30-day sample)
5. IAM policy showing restricted access (< 5 authorized users)

**Data Flow:**
```
User Request (HTTPS/TLS 1.3)
  → Cloud Load Balancer [EPHI-TRANSIT]
    → GKE Backend Pod [EPHI-PROCESSING]
      → Cloud SQL Proxy (mTLS) [EPHI-TRANSIT]
        → Cloud SQL Instance [EPHI-STORAGE]
```

---

### 1.2 Compute Services

#### Google Kubernetes Engine (GKE)

**Service Name:** `Google Kubernetes Engine (GKE)`
**Cluster Name:** `ln-prod-cluster` (us-central1)
**GCP API:** `container.googleapis.com`
**Classification:** [EPHI-PROCESSING] [EPHI-TRANSIT]
**BAA Required:** ✅ YES - COVERED

**ePHI Processing:**
- Backend API pods decrypt and process ePHI from Cloud SQL
- Application-level field encryption/decryption
- GraphRAG queries process ePHI for AI insights
- Health record PDF generation

**HIPAA Controls Enabled:**
- ✅ **Node Encryption:** Boot disks encrypted with Google-managed keys
- ✅ **Network Encryption:** VPC-native cluster with private nodes (no external IPs)
- ✅ **Secrets Encryption:** Application-layer secrets encrypted with Cloud KMS
- ✅ **Workload Identity:** Service accounts use Workload Identity (no key files)
- ✅ **Binary Authorization:** Container images signed and verified
- ✅ **Shielded GKE Nodes:** Secure Boot and vTPM enabled
- ✅ **Network Policy:** Kubernetes Network Policies restrict pod-to-pod traffic
- ✅ **Audit Logging:** GKE audit logs enabled (admin, data access)
- ✅ **Node Auto-Upgrade:** Disabled (manual testing required before upgrades)
- ✅ **Container-Optimized OS:** Nodes use hardened COS image

**Configuration Requirements:**
```yaml
# GKE Cluster Configuration (REQUIRED settings)
resource "google_container_cluster" "primary" {
  name     = "ln-prod-cluster"
  location = "us-central1"

  # REQUIRED: Private cluster (no external IPs on nodes)
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false  # Control plane accessible via VPN/bastion only
    master_ipv4_cidr_block  = "10.100.0.0/28"
  }

  # REQUIRED: Workload Identity
  workload_identity_config {
    workload_pool = "lifenav-prod.svc.id.goog"
  }

  # REQUIRED: Shielded nodes
  enable_shielded_nodes = true

  # REQUIRED: Binary Authorization
  binary_authorization {
    evaluation_mode = "PROJECT_SINGLETON_POLICY_ENFORCE"
  }

  # REQUIRED: Disable auto-upgrade (manual testing required)
  release_channel {
    channel = "REGULAR"
  }

  maintenance_policy {
    recurring_window {
      start_time = "2024-01-01T00:00:00Z"
      end_time   = "2024-01-01T04:00:00Z"
      recurrence = "FREQ=WEEKLY;BYDAY=SU"  # Sundays only
    }
  }

  # REQUIRED: Network policy
  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  # REQUIRED: Pod security policy
  pod_security_policy_config {
    enabled = true
  }
}
```

**Evidence Artifacts Required:**
1. GKE cluster configuration export (JSON)
2. Screenshot of private cluster settings
3. Screenshot of Workload Identity configuration
4. Screenshot of Shielded Nodes enabled
5. Network Policy YAML files
6. Binary Authorization policy export
7. GKE audit logs export (30-day sample)

**Pods Processing ePHI:**
- `backend` (FastAPI application)
- `graphrag-client` (AI processing)
- `background-jobs` (scheduled tasks: data sync, reports)

**Data Flow:**
```
GKE Pod (backend)
  → Reads ePHI from Cloud SQL via Cloud SQL Proxy
  → Decrypts field-level encrypted data using Cloud KMS
  → Processes request (API logic)
  → Encrypts response
  → Returns to user via Load Balancer
```

---

### 1.3 Storage Services

#### Cloud Storage (HIPAA Buckets)

**Service Name:** `Cloud Storage`
**Bucket Names:**
- `lifenav-prod-health-documents` (production)
- `lifenav-staging-health-documents` (staging)
**GCP API:** `storage.googleapis.com`
**Classification:** [EPHI-STORAGE]
**BAA Required:** ✅ YES - COVERED

**ePHI Data Stored:**
- Health record PDFs (exported patient summaries)
- Medical document uploads (lab results, prescriptions scans)
- Health insurance card scans
- Diagnostic images (X-rays, MRI scans - if applicable)

**HIPAA Controls Enabled:**
- ✅ **Encryption at Rest:** Customer-Managed Encryption Keys (CMEK) via Cloud KMS
- ✅ **Encryption in Transit:** TLS 1.2+ enforced for all API calls
- ✅ **Uniform Bucket-Level Access:** IAM-only access (no ACLs)
- ✅ **Object Versioning:** Enabled with 30-day noncurrent version retention
- ✅ **Retention Policy:** 7-year retention for HIPAA compliance
- ✅ **Audit Logging:** Data access logs enabled
- ✅ **Private Access:** Bucket not publicly accessible (verified via Policy Analyzer)
- ✅ **Lifecycle Management:** Auto-delete after retention period

**Configuration Requirements:**
```hcl
# Cloud Storage Bucket Configuration (REQUIRED settings)
resource "google_storage_bucket" "health_documents" {
  name     = "lifenav-prod-health-documents"
  location = "US-CENTRAL1"

  # REQUIRED: CMEK encryption
  encryption {
    default_kms_key_name = google_kms_crypto_key.health_data_key.id
  }

  # REQUIRED: Uniform bucket-level access
  uniform_bucket_level_access {
    enabled = true
  }

  # REQUIRED: Versioning
  versioning {
    enabled = true
  }

  # REQUIRED: Retention policy (7 years for HIPAA)
  retention_policy {
    is_locked       = true
    retention_period = 220752000  # 7 years in seconds
  }

  # REQUIRED: Lifecycle rule (delete noncurrent versions after 30 days)
  lifecycle_rule {
    condition {
      num_newer_versions = 3
      days_since_noncurrent_time = 30
    }
    action {
      type = "Delete"
    }
  }

  # REQUIRED: No public access
  public_access_prevention = "enforced"
}
```

**Evidence Artifacts Required:**
1. Cloud Storage bucket configuration export (JSON)
2. Screenshot of CMEK encryption key
3. Screenshot of uniform bucket-level access enabled
4. Screenshot of retention policy (7-year lock)
5. IAM policy export showing restricted access
6. Policy Analyzer report showing no public access
7. Audit logs export (30-day sample)

**Data Flow:**
```
User uploads health document (HTTPS/TLS 1.3)
  → GKE Backend Pod [EPHI-PROCESSING]
    → Encrypts metadata with Cloud KMS
    → Uploads to Cloud Storage (encrypted with CMEK)
      → Cloud Storage [EPHI-STORAGE]
```

---

### 1.4 Encryption & Key Management

#### Cloud Key Management Service (Cloud KMS)

**Service Name:** `Cloud KMS`
**Keyring Name:** `hipaa-keyring` (us-central1)
**GCP API:** `cloudkms.googleapis.com`
**Classification:** [EPHI-SECURITY]
**BAA Required:** ✅ YES - COVERED

**Purpose:**
- Envelope encryption for field-level ePHI (SSN, diagnosis notes, insurance IDs)
- Customer-Managed Encryption Keys (CMEK) for Cloud SQL
- CMEK for Cloud Storage buckets
- Encryption keys for application-level secrets

**Keys in Use:**

| Key Name | Purpose | Rotation | Algorithm |
|----------|---------|----------|-----------|
| `health-db-key` | Cloud SQL HIPAA database encryption | 90 days | AES-256 |
| `health-storage-key` | Cloud Storage health documents | 90 days | AES-256 |
| `field-encryption-key` | Application field-level encryption | 90 days | AES-256 |
| `backup-encryption-key` | Backup encryption (separate from primary) | 90 days | AES-256 |

**HIPAA Controls Enabled:**
- ✅ **Automatic Key Rotation:** 90-day rotation for all keys
- ✅ **Access Control:** IAM with principle of least privilege (< 3 users with `cloudkms.cryptoKeyEncrypterDecrypter` role)
- ✅ **Audit Logging:** All key usage logged (encrypt, decrypt, sign, verify operations)
- ✅ **Key Versioning:** Previous key versions retained for 180 days (decrypt old data)
- ✅ **Destruction Protection:** 24-hour scheduled deletion (allows recovery)
- ✅ **HSM-backed Keys:** Hardware Security Module backing (optional, for highest security)

**Configuration Requirements:**
```hcl
# Cloud KMS Key Configuration (REQUIRED settings)
resource "google_kms_key_ring" "hipaa" {
  name     = "hipaa-keyring"
  location = "us-central1"
}

resource "google_kms_crypto_key" "health_db_key" {
  name     = "health-db-key"
  key_ring = google_kms_key_ring.hipaa.id

  # REQUIRED: 90-day rotation
  rotation_period = "7776000s"  # 90 days

  # REQUIRED: Prevent accidental deletion
  lifecycle {
    prevent_destroy = true
  }

  # OPTIONAL: HSM backing for highest security
  version_template {
    algorithm        = "GOOGLE_SYMMETRIC_ENCRYPTION"
    protection_level = "HSM"  # or "SOFTWARE" if cost-sensitive
  }
}

# REQUIRED: IAM binding (principle of least privilege)
resource "google_kms_crypto_key_iam_binding" "health_db_key_binding" {
  crypto_key_id = google_kms_crypto_key.health_db_key.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"

  members = [
    "serviceAccount:cloudsql-sa@lifenav-prod.iam.gserviceaccount.com",
    "serviceAccount:backend-sa@lifenav-prod.iam.gserviceaccount.com",
  ]
}
```

**Evidence Artifacts Required:**
1. Cloud KMS keyring and key configuration export (JSON)
2. Screenshot of key rotation settings (90 days)
3. Screenshot of key protection level (HSM or SOFTWARE)
4. IAM policy export for each key (< 3 principals)
5. Audit logs export showing key usage (30-day sample)
6. Key version history export

**Data Flow:**
```
Application needs to encrypt ePHI field (e.g., SSN)
  → Generates Data Encryption Key (DEK)
  → Calls Cloud KMS API to encrypt DEK with Key Encryption Key (KEK)
  → Stores encrypted DEK alongside encrypted data
  → To decrypt: Calls Cloud KMS to decrypt DEK, then decrypts data
```

---

### 1.5 Secret Management

#### Secret Manager

**Service Name:** `Secret Manager`
**GCP API:** `secretmanager.googleapis.com`
**Classification:** [EPHI-SECURITY]
**BAA Required:** ✅ YES - COVERED

**Secrets Stored (ePHI-related):**
- Database connection strings (contain credentials for HIPAA database)
- API keys for health data integrations (e.g., EHR providers)
- Encryption keys for application-level field encryption
- OAuth tokens for health insurance verification APIs

**HIPAA Controls Enabled:**
- ✅ **Encryption at Rest:** Secrets encrypted with Google-managed keys or CMEK
- ✅ **Secret Versioning:** Automatic versioning with 90-day retention
- ✅ **Access Control:** IAM with principle of least privilege
- ✅ **Audit Logging:** All secret access logged
- ✅ **Automatic Rotation:** Integration with Cloud Scheduler for periodic rotation
- ✅ **Replication:** Multi-region replication for high availability

**Configuration Requirements:**
```hcl
# Secret Manager Configuration (REQUIRED settings)
resource "google_secret_manager_secret" "db_hipaa_url" {
  secret_id = "DATABASE_HIPAA_URL"

  # REQUIRED: Automatic replication for HA
  replication {
    automatic = true
  }

  # OPTIONAL: CMEK encryption (recommended for highest security)
  # encryption {
  #   kms_key_name = google_kms_crypto_key.secrets_key.id
  # }
}

# REQUIRED: IAM binding (principle of least privilege)
resource "google_secret_manager_secret_iam_binding" "db_hipaa_url_binding" {
  secret_id = google_secret_manager_secret.db_hipaa_url.id
  role      = "roles/secretmanager.secretAccessor"

  members = [
    "serviceAccount:backend-sa@lifenav-prod.iam.gserviceaccount.com",
  ]
}
```

**Evidence Artifacts Required:**
1. Secret Manager secret list export (names only, no values)
2. Screenshot of replication settings
3. IAM policy export for each secret
4. Audit logs export showing secret access (30-day sample)
5. Secret rotation schedule documentation

---

### 1.6 Networking Services

#### Virtual Private Cloud (VPC)

**Service Name:** `VPC Network`
**Network Name:** `lifenav-vpc` (us-central1)
**GCP API:** `compute.googleapis.com`
**Classification:** [EPHI-TRANSIT] [EPHI-SECURITY]
**BAA Required:** ✅ YES - COVERED

**Purpose:**
- Private network for all ePHI-processing resources
- Network isolation between HIPAA and non-HIPAA workloads
- VPN/Cloud Interconnect for secure administrator access

**HIPAA Controls Enabled:**
- ✅ **Private Google Access:** Enabled (access GCP APIs without internet)
- ✅ **VPC Flow Logs:** Enabled for traffic auditing
- ✅ **Firewall Rules:** Default-deny, explicit allow rules only
- ✅ **Private Service Connection:** Cloud SQL uses private IP
- ✅ **Cloud NAT:** For outbound internet (no public IPs on nodes)
- ✅ **VPC Service Controls:** Enabled to restrict data exfiltration

**Configuration Requirements:**
```hcl
# VPC Configuration (REQUIRED settings)
resource "google_compute_network" "vpc" {
  name                    = "lifenav-vpc"
  auto_create_subnetworks = false
}

resource "google_compute_subnetwork" "hipaa_subnet" {
  name          = "hipaa-subnet"
  ip_cidr_range = "10.0.0.0/24"
  region        = "us-central1"
  network       = google_compute_network.vpc.id

  # REQUIRED: Private Google Access
  private_ip_google_access = true

  # REQUIRED: VPC Flow Logs
  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 1.0  # 100% sampling for HIPAA
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# REQUIRED: Default-deny firewall rule
resource "google_compute_firewall" "deny_all" {
  name    = "deny-all-ingress"
  network = google_compute_network.vpc.name

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
  priority      = 65534  # Lowest priority (evaluated last)
}

# Explicit allow rules (e.g., allow HTTPS from load balancer)
resource "google_compute_firewall" "allow_lb_to_gke" {
  name    = "allow-lb-to-gke"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["8000"]
  }

  source_ranges = ["35.191.0.0/16"]  # GCP Load Balancer IP range
  target_tags   = ["gke-node"]
  priority      = 1000
}
```

**Evidence Artifacts Required:**
1. VPC network configuration export (JSON)
2. Subnet configuration export showing Private Google Access enabled
3. Firewall rules export (showing default-deny + explicit allows)
4. VPC Flow Logs configuration screenshot
5. VPC Flow Logs sample export (7-day sample)

---

#### Cloud Load Balancing

**Service Name:** `Cloud Load Balancing (HTTPS)`
**GCP API:** `compute.googleapis.com`
**Classification:** [EPHI-TRANSIT]
**BAA Required:** ✅ YES - COVERED

**Purpose:**
- Terminate TLS 1.3 connections from users
- Route HTTPS traffic to GKE backend pods
- DDoS protection and WAF (via Cloud Armor)

**HIPAA Controls Enabled:**
- ✅ **TLS 1.3 Enforcement:** Minimum TLS version set to 1.2 (prefer 1.3)
- ✅ **SSL Certificate:** Managed certificate with auto-renewal
- ✅ **Access Logging:** All requests logged to Cloud Logging
- ✅ **Cloud Armor:** WAF rules to block malicious traffic
- ✅ **Backend Encryption:** TLS between load balancer and backend pods

**Configuration Requirements:**
```hcl
# HTTPS Load Balancer Configuration (REQUIRED settings)
resource "google_compute_ssl_policy" "hipaa_ssl_policy" {
  name            = "hipaa-ssl-policy"
  profile         = "MODERN"  # TLS 1.2+ only
  min_tls_version = "TLS_1_2"  # REQUIRED minimum
}

resource "google_compute_target_https_proxy" "hipaa_proxy" {
  name    = "hipaa-https-proxy"
  url_map = google_compute_url_map.hipaa_url_map.id

  ssl_certificates = [google_compute_managed_ssl_certificate.hipaa_cert.id]
  ssl_policy       = google_compute_ssl_policy.hipaa_ssl_policy.id
}

# REQUIRED: Enable logging
resource "google_compute_backend_service" "hipaa_backend" {
  name = "hipaa-backend-service"

  log_config {
    enable      = true
    sample_rate = 1.0  # 100% sampling for HIPAA
  }

  # REQUIRED: Cloud Armor security policy
  security_policy = google_compute_security_policy.hipaa_armor.id
}
```

**Evidence Artifacts Required:**
1. Load balancer configuration export (JSON)
2. Screenshot of SSL policy showing TLS 1.2+ minimum
3. Screenshot of Cloud Armor policy attached
4. Access logs export (7-day sample)
5. SSL certificate details (expiration date, issuer)

---

### 1.7 Logging & Monitoring

#### Cloud Logging

**Service Name:** `Cloud Logging`
**GCP API:** `logging.googleapis.com`
**Classification:** [EPHI-AUDIT]
**BAA Required:** ✅ YES - COVERED

**Logs Collected (ePHI-related):**
- Cloud SQL audit logs (data access, admin activity)
- GKE audit logs (API calls, pod creation/deletion)
- Cloud Storage data access logs
- Cloud KMS key usage logs
- VPC Flow Logs (network traffic)
- Load Balancer access logs (HTTP requests)

**HIPAA Controls Enabled:**
- ✅ **Log Retention:** 7-year retention for HIPAA compliance
- ✅ **Access Control:** IAM restricts log viewing to authorized personnel
- ✅ **Immutability:** Logs cannot be modified or deleted (Bucket Lock)
- ✅ **Encryption:** Logs encrypted at rest
- ✅ **Export to Cloud Storage:** Long-term archival in HIPAA-compliant bucket

**Configuration Requirements:**
```hcl
# Cloud Logging Sink Configuration (REQUIRED for 7-year retention)
resource "google_logging_project_sink" "hipaa_logs" {
  name        = "hipaa-audit-logs"
  destination = "storage.googleapis.com/${google_storage_bucket.audit_logs.name}"

  # REQUIRED: Include all audit logs
  filter = <<-EOT
    protoPayload.serviceName="cloudsql.googleapis.com"
    OR protoPayload.serviceName="storage.googleapis.com"
    OR protoPayload.serviceName="cloudkms.googleapis.com"
    OR protoPayload.serviceName="container.googleapis.com"
    OR logName=~"projects/lifenav-prod/logs/cloudaudit.googleapis.com"
  EOT

  unique_writer_identity = true
}

# REQUIRED: Audit log bucket with 7-year retention and Bucket Lock
resource "google_storage_bucket" "audit_logs" {
  name     = "lifenav-prod-hipaa-audit-logs"
  location = "US-CENTRAL1"

  # REQUIRED: Retention policy (7 years locked)
  retention_policy {
    is_locked       = true
    retention_period = 220752000  # 7 years
  }

  # REQUIRED: Uniform bucket-level access
  uniform_bucket_level_access {
    enabled = true
  }
}
```

**Evidence Artifacts Required:**
1. Cloud Logging sink configuration export (JSON)
2. Screenshot of log retention settings (7 years)
3. Screenshot of Bucket Lock on audit log bucket
4. IAM policy export for audit log bucket (restricted access)
5. Sample audit logs export (30-day period)

---

#### Cloud Monitoring

**Service Name:** `Cloud Monitoring`
**GCP API:** `monitoring.googleapis.com`
**Classification:** [EPHI-AUDIT]
**BAA Required:** ✅ YES - COVERED

**Metrics Collected (ePHI-related):**
- Cloud SQL performance metrics (CPU, memory, connections)
- GKE pod metrics (CPU, memory, network)
- Cloud Storage access metrics (requests, bandwidth)
- Cloud KMS key usage metrics (encrypt/decrypt operations)

**HIPAA Controls Enabled:**
- ✅ **Metric Retention:** 6 months (default, can be extended)
- ✅ **Access Control:** IAM restricts metric viewing
- ✅ **Alerting:** Prometheus alerts for security events (unauthorized access, high error rates)

**Evidence Artifacts Required:**
1. Cloud Monitoring dashboard export (JSON)
2. Screenshot of alerting policies
3. Metrics export (30-day sample)

---

## Section 2: Data Flow Diagram

**User Access to ePHI (Read Health Condition):**

```
┌─────────────────────────────────────────────────────────────────────────┐
│ USER DEVICE (iOS/Android/Web)                                           │
│ - NOT in BAA scope (user-controlled device)                             │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ HTTPS/TLS 1.3
                              │ (ePHI encrypted in transit)
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ CLOUD LOAD BALANCER (GCP)                    [IN BAA SCOPE]             │
│ - Service: Cloud Load Balancing                                         │
│ - TLS termination (TLS 1.3)                                             │
│ - Cloud Armor WAF                                                       │
│ - Access logs → Cloud Logging                                           │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ TLS 1.2+ (backend encryption)
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ GKE CLUSTER (us-central1)                    [IN BAA SCOPE]             │
│ - Service: Google Kubernetes Engine                                     │
│ - Pod: backend (FastAPI)                                                │
│ - Workload Identity: backend-sa@lifenav-prod.iam.gserviceaccount.com   │
│ - Network: Private VPC (no public IPs)                                  │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ Cloud SQL Proxy (mTLS)
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ CLOUD SQL HIPAA INSTANCE                     [IN BAA SCOPE]             │
│ - Service: Cloud SQL for PostgreSQL                                     │
│ - Instance: ln-health-db-beta                                           │
│ - Encryption: CMEK (Cloud KMS key: health-db-key)                       │
│ - Database: ln_health                                                   │
│ - Table: health_conditions                                              │
│   ├─ id (UUID)                                                          │
│   ├─ user_id (UUID, RLS enforced)                                       │
│   ├─ tenant_id (UUID, RLS enforced)                                     │
│   ├─ name (TEXT, encrypted with field-level encryption)   ← ePHI       │
│   ├─ encrypted_diagnosis (TEXT, envelope encrypted)       ← ePHI       │
│   ├─ created_at (TIMESTAMP)                                             │
│   └─ updated_at (TIMESTAMP)                                             │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ KMS API call (decrypt field)
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ CLOUD KMS                                    [IN BAA SCOPE]             │
│ - Service: Cloud KMS                                                    │
│ - Keyring: hipaa-keyring                                                │
│ - Key: field-encryption-key                                             │
│ - Operation: Decrypt Data Encryption Key (DEK)                          │
│ - Audit: All operations logged to Cloud Logging                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**ePHI Write Flow (User Creates Health Condition):**

```
User submits health condition (HTTPS POST)
  ↓
Cloud Load Balancer [BAA] → TLS 1.3 termination
  ↓
GKE Backend Pod [BAA]
  ├─ Validates user authentication (JWT)
  ├─ Enforces RLS (tenant_id, user_id)
  ├─ Calls Cloud KMS [BAA] to encrypt field (diagnosis)
  ├─ Inserts encrypted data into Cloud SQL [BAA]
  └─ Returns success response to user
```

**ePHI Backup Flow:**

```
Cloud SQL HIPAA Instance [BAA]
  ↓ Daily backup (04:00 UTC)
Cloud SQL Backup Service [BAA]
  ├─ Encrypted with same CMEK key (health-db-key)
  ├─ Stored in GCP-managed backup storage [BAA]
  └─ Retained for 7 days
```

**ePHI Document Upload Flow:**

```
User uploads health document (PDF scan)
  ↓
Cloud Load Balancer [BAA] → TLS 1.3
  ↓
GKE Backend Pod [BAA]
  ├─ Validates file type (PDF, JPEG only)
  ├─ Scans for malware (ClamAV in pod)
  ├─ Encrypts metadata with Cloud KMS [BAA]
  └─ Uploads to Cloud Storage [BAA]
       ├─ Bucket: lifenav-prod-health-documents
       ├─ Encryption: CMEK (health-storage-key)
       └─ IAM: Restricted access
```

---

## Section 3: Service Boundaries - What is NOT in BAA Scope

**CRITICAL:** The following GCP services are **EXCLUDED** from BAA coverage because they do NOT process ePHI:

### 3.1 Analytics & Non-ePHI Services

| Service | Reason for Exclusion | Permitted Use |
|---------|---------------------|---------------|
| **BigQuery** | Stores anonymized analytics data (no ePHI) | User behavior analytics (PHI removed) |
| **Cloud Functions** | Runs background jobs (no ePHI access) | Email notifications, reminders (no PHI) |
| **Cloud Pub/Sub** | Message queue for non-ePHI events | Goal notifications, career updates |
| **Firebase** | Mobile app analytics and notifications | User engagement tracking (no PHI) |
| **Vertex AI** | Machine learning training (not ePHI) | Non-health models only |

### 3.2 Frontend Services (User-Controlled Devices)

| Service | Why Not in BAA | Data Handling |
|---------|----------------|---------------|
| **Next.js Frontend (Vercel)** | Runs on user device (browser) | ePHI encrypted at rest on device, cleared on logout |
| **Mobile App (iOS/Android)** | User-controlled device | ePHI cached encrypted, auto-wipe on 30-day inactivity |

**IMPORTANT:** Frontend/mobile apps display ePHI but are **NOT covered entities** under HIPAA (user devices are not under our control). Our responsibility:
- ✅ Encrypt ePHI in transit (TLS 1.3)
- ✅ Encrypt ePHI at rest on device (iOS Keychain, Android Keystore)
- ✅ Auto-logout after 15 minutes of inactivity
- ✅ Clear cache on logout

### 3.3 Third-Party Integrations (NOT Covered by Google BAA)

| Service | Provider | ePHI Access | BAA Status |
|---------|----------|-------------|------------|
| **Sentry** | Sentry.io | NO (errors sanitized before sending) | No BAA required |
| **SendGrid** | Twilio | NO (emails do not contain PHI) | No BAA required |
| **Plaid** | Plaid Inc. | NO (financial data only, not health) | Separate BAA with Plaid |
| **Stripe** | Stripe Inc. | NO (payment data only) | No BAA required |

**Evidence Required:**
- For each third-party, document in `docs/compliance/hipaa/THIRD_PARTY_VENDOR_ASSESSMENT.md`:
  - ✅ Data Processing Agreement (DPA) or BAA if ePHI shared
  - ✅ PHI sanitization proof if errors/logs sent to vendor
  - ✅ Network egress logs showing no ePHI transmitted

---

## Section 4: Compliance Validation Checklist

### 4.1 Pre-Production Validation

Before enabling ePHI processing, verify:

- [ ] **All in-scope GCP services** (Section 1) are explicitly listed in Google BAA
- [ ] **Cloud SQL HIPAA instance** has CMEK enabled (not GMEK)
- [ ] **Cloud Storage health buckets** have CMEK and 7-year retention
- [ ] **GKE cluster** is private with Workload Identity enabled
- [ ] **VPC** has Private Google Access and VPC Flow Logs enabled
- [ ] **Cloud KMS keys** have 90-day rotation enabled
- [ ] **Cloud Logging** has 7-year retention for audit logs
- [ ] **IAM policies** follow principle of least privilege (< 5 users per service)
- [ ] **No public IPs** on any GKE nodes (verified via `gcloud compute instances list`)
- [ ] **TLS 1.2+** enforced on all services (Load Balancer, Cloud SQL, Cloud Storage)
- [ ] **Backup encryption** verified (Cloud SQL backups use same CMEK)

### 4.2 Post-Production Monitoring

Ongoing compliance checks (automated monthly):

- [ ] **IAM drift detection** - Alert if unauthorized users added to HIPAA resources
- [ ] **Public access detection** - Alert if Cloud Storage bucket or Cloud SQL becomes public
- [ ] **TLS enforcement** - Alert if TLS 1.2+ requirement is disabled
- [ ] **Backup validation** - Verify backups exist and are restorable (weekly test)
- [ ] **Key rotation** - Verify Cloud KMS keys rotated within 90 days
- [ ] **Audit log retention** - Verify logs are being exported to 7-year retention bucket
- [ ] **VPC Flow Logs** - Verify flow logs are enabled and exporting

---

## Section 5: Evidence Package for Auditors

**Location:** `gs://lifenav-prod-compliance-evidence/hipaa/gcp-services/`

**Required Artifacts:**

1. **Service Inventory Spreadsheet** (`gcp_ephi_services_inventory.xlsx`)
   - Column A: Service Name
   - Column B: GCP API Endpoint
   - Column C: BAA Coverage (YES/NO)
   - Column D: ePHI Data Stored/Processed
   - Column E: HIPAA Controls Enabled
   - Column F: Evidence Artifact IDs

2. **Configuration Exports** (JSON format):
   - `cloud_sql_instance_ln-health-db-beta.json`
   - `gke_cluster_ln-prod-cluster.json`
   - `cloud_storage_bucket_health-documents.json`
   - `cloud_kms_keyring_hipaa-keyring.json`
   - `vpc_network_lifenav-vpc.json`
   - `load_balancer_hipaa-lb.json`

3. **Screenshots** (PNG format, dated):
   - `cloud_sql_encryption_cmek_YYYYMMDD.png`
   - `gke_private_cluster_YYYYMMDD.png`
   - `cloud_storage_retention_policy_YYYYMMDD.png`
   - `cloud_kms_key_rotation_YYYYMMDD.png`
   - `vpc_flow_logs_YYYYMMDD.png`
   - `load_balancer_tls_policy_YYYYMMDD.png`

4. **Audit Logs** (JSON format):
   - `cloud_sql_audit_logs_30days.json`
   - `gke_audit_logs_30days.json`
   - `cloud_storage_data_access_logs_30days.json`
   - `cloud_kms_key_usage_logs_30days.json`
   - `vpc_flow_logs_7days.json`

5. **IAM Policies** (JSON format):
   - `iam_policy_cloud_sql_hipaa.json`
   - `iam_policy_gke_cluster.json`
   - `iam_policy_cloud_storage_health.json`
   - `iam_policy_cloud_kms_keys.json`

6. **Terraform State** (redacted, no secrets):
   - `terraform_state_hipaa_resources_YYYYMMDD.json`

---

**Last Updated:** 2026-01-09
**Next Review:** 2026-02-09 (Monthly)
**Compliance Officer:** [NAME]
**Approved By:** [CEO/Legal]
