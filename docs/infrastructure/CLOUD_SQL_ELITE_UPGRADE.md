# Cloud SQL Elite Security Upgrade Plan

## Current State Assessment

### Instances
- `ln-health-db-beta` - HIPAA database (lifenavigator_health)
- `ln-finance-db-beta` - Financial database (lifenavigator_finance)
- `ln-core-db-beta` - Core database

### Security Gaps Identified
1. 🔴 **Public IP enabled** - Exposes databases to internet
2. 🔴 **No CMEK** - Using Google-managed encryption keys
3. 🟡 **No pgaudit** - Missing compliance audit logging
4. 🟡 **7-day backups** - HIPAA requires 7-year retention capability
5. 🟡 **ZONAL deployment** - No high availability
6. 🟡 **No Query Insights** - Missing for audit trail

---

## Phase 1: Critical Security Fixes (Do First)

### 1.1 Disable Public IP Access

```bash
# Disable public IP on HIPAA instance
gcloud sql instances patch ln-health-db-beta \
  --project=lifenav-prod \
  --no-assign-ip

# Disable public IP on Financial instance
gcloud sql instances patch ln-finance-db-beta \
  --project=lifenav-prod \
  --no-assign-ip

# Disable public IP on Core instance
gcloud sql instances patch ln-core-db-beta \
  --project=lifenav-prod \
  --no-assign-ip
```

**⚠️ WARNING**: Before disabling public IP, ensure:
- All applications connect via private IP or Cloud SQL Proxy
- VPC connector is configured for Cloud Run
- No direct connections from local development

### 1.2 Remove Authorized Networks (External IPs)

```bash
# Clear authorized networks
gcloud sql instances patch ln-health-db-beta \
  --project=lifenav-prod \
  --clear-authorized-networks

gcloud sql instances patch ln-finance-db-beta \
  --project=lifenav-prod \
  --clear-authorized-networks

gcloud sql instances patch ln-core-db-beta \
  --project=lifenav-prod \
  --clear-authorized-networks
```

---

## Phase 2: CMEK Encryption Setup

### 2.1 Create KMS Keyring and Keys

```bash
# Create keyring
gcloud kms keyrings create life-navigator-db-keys \
  --location=us-central1 \
  --project=lifenav-prod

# Create key for HIPAA database (HSM-protected for production)
gcloud kms keys create hipaa-db-key \
  --keyring=life-navigator-db-keys \
  --location=us-central1 \
  --purpose=encryption \
  --protection-level=software \
  --rotation-period=7776000s \
  --project=lifenav-prod

# Create key for Financial database
gcloud kms keys create financial-db-key \
  --keyring=life-navigator-db-keys \
  --location=us-central1 \
  --purpose=encryption \
  --protection-level=software \
  --rotation-period=7776000s \
  --project=lifenav-prod

# Create key for Core database
gcloud kms keys create core-db-key \
  --keyring=life-navigator-db-keys \
  --location=us-central1 \
  --purpose=encryption \
  --protection-level=software \
  --rotation-period=7776000s \
  --project=lifenav-prod
```

### 2.2 Grant Cloud SQL Access to KMS Keys

```bash
# Get Cloud SQL service account
PROJECT_NUMBER=$(gcloud projects describe lifenav-prod --format='value(projectNumber)')
SQL_SA="serviceAccount:service-${PROJECT_NUMBER}@gcp-sa-cloud-sql.iam.gserviceaccount.com"

# Grant access for HIPAA key
gcloud kms keys add-iam-policy-binding hipaa-db-key \
  --keyring=life-navigator-db-keys \
  --location=us-central1 \
  --member="$SQL_SA" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" \
  --project=lifenav-prod

# Grant access for Financial key
gcloud kms keys add-iam-policy-binding financial-db-key \
  --keyring=life-navigator-db-keys \
  --location=us-central1 \
  --member="$SQL_SA" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" \
  --project=lifenav-prod

# Grant access for Core key
gcloud kms keys add-iam-policy-binding core-db-key \
  --keyring=life-navigator-db-keys \
  --location=us-central1 \
  --member="$SQL_SA" \
  --role="roles/cloudkms.cryptoKeyEncrypterDecrypter" \
  --project=lifenav-prod
```

### 2.3 Create New CMEK-Encrypted Instances

**Note**: CMEK cannot be added to existing instances. Must create new instances and migrate data.

```bash
# Create new HIPAA instance with CMEK
gcloud sql instances create ln-health-db-beta-cmek \
  --project=lifenav-prod \
  --database-version=POSTGRES_15 \
  --tier=db-g1-small \
  --region=us-central1 \
  --availability-type=REGIONAL \
  --network=projects/lifenav-prod/global/networks/life-navigator-vpc-beta \
  --no-assign-ip \
  --require-ssl \
  --disk-encryption-key=projects/lifenav-prod/locations/us-central1/keyRings/life-navigator-db-keys/cryptoKeys/hipaa-db-key \
  --enable-point-in-time-recovery \
  --backup-start-time=03:00 \
  --retained-backups-count=30 \
  --database-flags=cloudsql.enable_pgaudit=on,log_checkpoints=on,log_connections=on,log_disconnections=on,log_statement=all \
  --labels=environment=beta,compliance=hipaa,managed_by=terraform,encryption=cmek

# Similar for Financial and Core instances...
```

### 2.4 Data Migration Steps

```bash
# 1. Export from old instance
gcloud sql export sql ln-health-db-beta \
  gs://lifenav-prod-backups/migration/health-db-export.sql \
  --database=lifenavigator_health \
  --project=lifenav-prod

# 2. Create database on new instance
gcloud sql databases create lifenavigator_health \
  --instance=ln-health-db-beta-cmek \
  --project=lifenav-prod

# 3. Import to new instance
gcloud sql import sql ln-health-db-beta-cmek \
  gs://lifenav-prod-backups/migration/health-db-export.sql \
  --database=lifenavigator_health \
  --project=lifenav-prod

# 4. Update application connection strings
# 5. Verify data integrity
# 6. Delete old instance
```

---

## Phase 3: Enable Compliance Logging

### 3.1 Enable pgaudit Extension

```bash
# Enable pgaudit on all instances
gcloud sql instances patch ln-health-db-beta \
  --project=lifenav-prod \
  --database-flags=cloudsql.enable_pgaudit=on,pgaudit.log=all,log_checkpoints=on,log_connections=on,log_disconnections=on,log_statement=all

gcloud sql instances patch ln-finance-db-beta \
  --project=lifenav-prod \
  --database-flags=cloudsql.enable_pgaudit=on,pgaudit.log=all,log_checkpoints=on,log_connections=on,log_disconnections=on,log_statement=all
```

### 3.2 Enable Query Insights

```bash
gcloud sql instances patch ln-health-db-beta \
  --project=lifenav-prod \
  --insights-config-query-insights-enabled \
  --insights-config-query-plans-per-minute=5 \
  --insights-config-query-string-length=1024 \
  --insights-config-record-application-tags \
  --insights-config-record-client-address
```

### 3.3 Configure Log Export to Cloud Logging

```bash
# Create log sink for HIPAA audit logs
gcloud logging sinks create hipaa-db-audit-sink \
  bigquery.googleapis.com/projects/lifenav-prod/datasets/hipaa_audit_logs \
  --log-filter='resource.type="cloudsql_database" AND resource.labels.database_id="lifenav-prod:ln-health-db-beta"' \
  --project=lifenav-prod
```

---

## Phase 4: Increase Backup Retention

### 4.1 Update Backup Configuration

```bash
# HIPAA requires 7-year retention capability
# Set to maximum Cloud SQL allows (365 backups)
gcloud sql instances patch ln-health-db-beta \
  --project=lifenav-prod \
  --backup-start-time=03:00 \
  --retained-backups-count=365 \
  --enable-point-in-time-recovery \
  --retained-transaction-log-days=7

# For true 7-year retention, export to GCS with lifecycle rules
```

### 4.2 Set Up Long-Term Backup Archive

```bash
# Create backup bucket with lifecycle rules
gsutil mb -p lifenav-prod -l us-central1 gs://lifenav-hipaa-backups-archive

# Set lifecycle rule for 7-year retention
cat > lifecycle.json << 'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "SetStorageClass", "storageClass": "COLDLINE"},
        "condition": {"age": 90}
      },
      {
        "action": {"type": "SetStorageClass", "storageClass": "ARCHIVE"},
        "condition": {"age": 365}
      },
      {
        "action": {"type": "Delete"},
        "condition": {"age": 2555}
      }
    ]
  }
}
EOF

gsutil lifecycle set lifecycle.json gs://lifenav-hipaa-backups-archive
```

---

## Phase 5: Run Database Migrations

### 5.1 Connect via Cloud SQL Proxy

```bash
# Install Cloud SQL Proxy if needed
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.1/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# Start proxy for HIPAA database
./cloud-sql-proxy lifenav-prod:us-central1:ln-health-db-beta --port=5432 &

# Start proxy for Financial database (different port)
./cloud-sql-proxy lifenav-prod:us-central1:ln-finance-db-beta --port=5433 &
```

### 5.2 Run Migrations

```bash
# HIPAA Database
export PGPASSWORD=$(gcloud secrets versions access latest --secret=health-database-password-beta)
psql -h localhost -p 5432 -U lifenavigator -d lifenavigator_health -f backend/app/db/migrations/hipaa/001_create_health_schema.sql
psql -h localhost -p 5432 -U lifenavigator -d lifenavigator_health -f backend/app/db/migrations/005_encryption_functions.sql

# Financial Database
export PGPASSWORD=$(gcloud secrets versions access latest --secret=finance-database-password-beta)
psql -h localhost -p 5433 -U lifenavigator -d lifenavigator_finance -f backend/app/db/migrations/financial/001_create_finance_schema.sql
psql -h localhost -p 5433 -U lifenavigator -d lifenavigator_finance -f backend/app/db/migrations/005_encryption_functions.sql
```

---

## Verification Checklist

After completing all phases, verify:

- [ ] Public IPs disabled on all instances
- [ ] CMEK encryption enabled (check `diskEncryptionConfiguration`)
- [ ] pgaudit extension enabled
- [ ] SSL mode is `TRUSTED_CLIENT_CERTIFICATE_REQUIRED`
- [ ] Query Insights enabled
- [ ] Backup retention set appropriately
- [ ] Log export configured
- [ ] All migrations applied
- [ ] Application connectivity verified

```bash
# Verification commands
gcloud sql instances describe ln-health-db-beta --project=lifenav-prod \
  --format="yaml(settings.ipConfiguration,diskEncryptionConfiguration,settings.databaseFlags)"
```

---

## Timeline Estimate

| Phase | Description | Effort | Risk |
|-------|-------------|--------|------|
| Phase 1 | Disable public IP | 30 min | Medium (connectivity) |
| Phase 2 | CMEK setup + migration | 2-4 hours | High (data migration) |
| Phase 3 | Enable audit logging | 30 min | Low |
| Phase 4 | Backup retention | 1 hour | Low |
| Phase 5 | Run migrations | 1 hour | Low |

**Total: ~5-7 hours with testing**

---

## Rollback Plan

If issues occur:
1. Keep old instances until new ones verified
2. Maintain backup of connection strings
3. Test connectivity before switching production traffic
