# Life Navigator - Disaster Recovery Plan

**Version:** 1.0.0
**Last Updated:** 2025-12-14
**Environment:** GCP Cloud Run + Cloud SQL
**Project:** lifenav-prod

---

## Overview

This document provides disaster recovery procedures for the Life Navigator platform deployed on Google Cloud Platform using Cloud Run and Cloud SQL.

### Current Architecture

| Component | Service | Configuration |
|-----------|---------|---------------|
| **Frontend** | Cloud Run: ln-web-frontend | Stateless |
| **API Gateway** | Cloud Run: ln-api-gateway | Stateless |
| **Core Database** | Cloud SQL: ln-core-db-beta | PostgreSQL 15, db-g1-small |
| **Health Database** | Cloud SQL: ln-health-db-beta | PostgreSQL 15, db-g1-small, HIPAA |
| **Finance Database** | Cloud SQL: ln-finance-db-beta | PostgreSQL 15, db-g1-small, PCI-DSS |
| **Cache** | Memorystore Redis | 2 instances (1GB + 2GB HA) |

### Recovery Objectives

| Database | RTO (Recovery Time) | RPO (Recovery Point) | Backup Frequency |
|----------|---------------------|----------------------|------------------|
| Core DB | 1 hour | 24 hours | Daily @ 03:00 UTC |
| Health DB (HIPAA) | 30 min | 5 min* | Daily @ 04:00 UTC |
| Finance DB (PCI) | 30 min | 5 min* | Daily @ 02:00 UTC |

*Point-in-Time Recovery enabled for Health and Finance databases

---

## Backup Configuration

### Cloud SQL Automated Backups

All databases have automated daily backups with 7-day retention:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Database           │ Backup Time │ PITR │ Retention │ Classification   │
├────────────────────┼─────────────┼──────┼───────────┼──────────────────┤
│ ln-core-db-beta    │ 03:00 UTC   │ Yes  │ 7 days    │ General          │
│ ln-health-db-beta  │ 04:00 UTC   │ Yes  │ 7 days    │ PHI (HIPAA)      │
│ ln-finance-db-beta │ 02:00 UTC   │ Yes  │ 7 days    │ Financial (PCI)  │
└─────────────────────────────────────────────────────────────────────────┘
```

### Point-in-Time Recovery (PITR)

Health and Finance databases support PITR with:
- Transaction log retention: 7 days
- Recovery granularity: Any point in time within retention window

---

## Disaster Recovery Procedures

### Procedure 1: Restore Database from Automated Backup

**Use Case:** Data corruption, accidental deletion, ransomware recovery

**Steps:**

```bash
# 1. List available backups
gcloud sql backups list \
  --instance=ln-core-db-beta \
  --project=lifenav-prod \
  --format="table(id,windowStartTime,status)"

# 2. Restore to new instance from backup
gcloud sql instances restore-backup ln-core-db-beta \
  --backup-id=<BACKUP_ID> \
  --restore-instance=ln-core-db-restored \
  --project=lifenav-prod

# 3. Verify restored database
gcloud sql connect ln-core-db-restored \
  --user=postgres \
  --project=lifenav-prod

# 4. If verified, swap instances:
# a. Update Cloud Run services to point to restored instance
# b. Delete corrupted instance after verification period
```

### Procedure 2: Point-in-Time Recovery (PITR)

**Use Case:** Recover to specific moment before incident (Health/Finance DBs only)

**Steps:**

```bash
# 1. Identify target recovery time (UTC)
# Example: Recover to 2025-12-14T10:30:00Z (before incident at 10:35)

# 2. Clone instance to specific point in time
gcloud sql instances clone ln-health-db-beta ln-health-db-pitr \
  --point-in-time=2025-12-14T10:30:00Z \
  --project=lifenav-prod

# 3. Wait for clone operation to complete
gcloud sql operations list \
  --instance=ln-health-db-beta \
  --project=lifenav-prod \
  --filter="operationType=CLONE"

# 4. Verify data integrity
gcloud sql connect ln-health-db-pitr --user=postgres --project=lifenav-prod

# 5. Update service configuration to use restored instance
gcloud run services update ln-api-gateway \
  --set-env-vars="HEALTH_DB_HOST=<NEW_INSTANCE_IP>" \
  --region=us-central1 \
  --project=lifenav-prod
```

### Procedure 3: Complete Infrastructure Recreation

**Use Case:** Regional outage, complete environment loss

**Steps:**

```bash
# 1. Ensure Terraform state is accessible (stored in GCS)
gsutil ls gs://lifenav-terraform-state/

# 2. Switch to DR region if needed
export TF_VAR_region="us-east1"

# 3. Apply infrastructure
cd terraform/gcp/environments/production
terraform init -reconfigure
terraform plan -out=dr-recovery.tfplan
terraform apply dr-recovery.tfplan

# 4. Restore databases from cross-region backup (if enabled)
# or restore from most recent available backup

# 5. Deploy Cloud Run services
gcloud run deploy ln-api-gateway \
  --image=gcr.io/lifenav-prod/api-gateway:latest \
  --region=us-east1 \
  --project=lifenav-prod

# 6. Update DNS/Load Balancer to point to new region
```

### Procedure 4: Cloud Run Service Recovery

**Use Case:** Service deployment failure, image corruption

**Steps:**

```bash
# 1. List available revisions
gcloud run revisions list \
  --service=ln-api-gateway \
  --region=us-central1 \
  --project=lifenav-prod

# 2. Traffic rollback to previous healthy revision
gcloud run services update-traffic ln-api-gateway \
  --to-revisions=ln-api-gateway-<PREVIOUS_REVISION>=100 \
  --region=us-central1 \
  --project=lifenav-prod

# 3. Or redeploy from known good image tag
gcloud run deploy ln-api-gateway \
  --image=gcr.io/lifenav-prod/api-gateway:v1.2.3 \
  --region=us-central1 \
  --project=lifenav-prod
```

### Procedure 5: Redis Cache Recovery

**Use Case:** Cache instance failure

**Steps:**

```bash
# 1. Check instance status
gcloud redis instances describe ln-redis-cache \
  --region=us-central1 \
  --project=lifenav-prod

# 2. For BASIC tier (non-HA): Recreate instance
gcloud redis instances create ln-redis-cache-new \
  --size=1 \
  --region=us-central1 \
  --tier=BASIC_STANDARD \
  --redis-version=REDIS_7_0 \
  --project=lifenav-prod

# 3. Update Cloud Run services with new Redis IP
gcloud run services update ln-api-gateway \
  --set-env-vars="REDIS_HOST=<NEW_REDIS_IP>" \
  --region=us-central1 \
  --project=lifenav-prod

# 4. Cache will rebuild automatically from application traffic
```

---

## Verification Procedures

### Post-Recovery Health Checks

```bash
# 1. Verify Cloud Run services are healthy
for service in ln-web-frontend ln-api-gateway; do
  URL=$(gcloud run services describe $service \
    --region=us-central1 \
    --project=lifenav-prod \
    --format='value(status.url)')
  echo "Checking $service: $URL/health"
  curl -s "$URL/health" | jq .
done

# 2. Verify database connectivity
gcloud sql instances list --project=lifenav-prod

# 3. Verify database data integrity (example query)
gcloud sql connect ln-core-db-beta --user=postgres --project=lifenav-prod <<EOF
SELECT
  (SELECT count(*) FROM users) as users,
  (SELECT count(*) FROM goals) as goals;
EOF

# 4. Check Cloud Monitoring for errors
gcloud logging read \
  "resource.type=cloud_run_revision AND severity>=ERROR" \
  --project=lifenav-prod \
  --limit=10 \
  --freshness=1h
```

---

## On-Demand Backup Commands

### Create Manual Backup (Before Risky Changes)

```bash
# Create on-demand backup for all databases
for db in ln-core-db-beta ln-health-db-beta ln-finance-db-beta; do
  echo "Creating backup for $db..."
  gcloud sql backups create \
    --instance=$db \
    --project=lifenav-prod \
    --description="Manual backup before deployment $(date +%Y-%m-%d)"
done
```

### Export Database to Cloud Storage

```bash
# Export for long-term archival or cross-region storage
gcloud sql export sql ln-core-db-beta \
  gs://lifenav-backups/manual/core-$(date +%Y%m%d).sql \
  --database=lifenavigator \
  --project=lifenav-prod
```

---

## DR Testing Schedule

### Monthly Tests

| Test | Frequency | Last Tested | Next Due |
|------|-----------|-------------|----------|
| Backup verification | Monthly | - | 2025-01-14 |
| PITR test (non-prod) | Monthly | - | 2025-01-14 |
| Runbook review | Monthly | 2025-12-14 | 2025-01-14 |

### Quarterly Tests

| Test | Frequency | Last Tested | Next Due |
|------|-----------|-------------|----------|
| Full restore test | Quarterly | - | 2025-03-14 |
| Failover simulation | Quarterly | - | 2025-03-14 |

---

## Contacts and Escalation

| Role | Contact | When to Contact |
|------|---------|-----------------|
| Engineering Lead | engineering@lifenavigator.tech | All DR events |
| GCP Support | Cloud Console | Infrastructure issues |

---

## Appendix: Quick Reference Commands

```bash
# List all backups across databases
for db in ln-core-db-beta ln-health-db-beta ln-finance-db-beta; do
  echo "=== $db ==="
  gcloud sql backups list --instance=$db --project=lifenav-prod --limit=3
done

# Check PITR status
gcloud sql instances describe ln-health-db-beta \
  --project=lifenav-prod \
  --format="yaml(settings.backupConfiguration.pointInTimeRecoveryEnabled)"

# Get connection info for databases
gcloud sql instances list \
  --project=lifenav-prod \
  --format="table(name,connectionName,ipAddresses[0].ipAddress)"

# Monitor ongoing operations
gcloud sql operations list --project=lifenav-prod --filter="status!=DONE"
```

---

**Document Revision History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-12-14 | Claude Code | Initial creation for Cloud Run architecture |

**Next Review:** 2025-01-14
