# HIPAA Database Restoration Runbook

**CRITICAL: This runbook involves PHI (Protected Health Information).**

**RTO Target:** 15 minutes
**RPO Target:** 1 minute
**Classification:** SEVERITY 1 - CRITICAL

---

## Pre-Requisites

✅ **Access Required:**
- GCP Project Owner or Cloud SQL Admin role
- Kubernetes cluster admin access
- On-call Security Lead notified
- On-call Compliance Officer notified (HIPAA requirement)

✅ **Tools Required:**
- `gcloud` CLI authenticated
- `kubectl` configured for production cluster
- `psql` client installed
- Incident tracking system open (Jira, PagerDuty, etc.)

✅ **Compliance Requirements:**
- All actions must be logged for HIPAA audit
- PHI access must be documented
- Restoration time must be measured and reported

---

## Incident Declaration

```bash
# Step 1: Declare SEVERITY 1 incident
INCIDENT_ID="INC-$(date +%Y%m%d-%H%M%S)"
INCIDENT_START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "========================================="
echo "INCIDENT DECLARED: $INCIDENT_ID"
echo "TYPE: HIPAA Database Failure/Corruption"
echo "SEVERITY: 1 - CRITICAL"
echo "START TIME: $INCIDENT_START_TIME"
echo "========================================="

# Step 2: Notify stakeholders
# - Post to #incidents Slack channel
# - Page Security Lead
# - Page Compliance Officer
# - Update status page (https://status.lifenavigator.com)

# Step 3: Start incident timer (for RTO measurement)
RESTORE_START_TIME=$(date +%s)
```

---

## Diagnosis Phase (Target: < 4 minutes)

### Step 1: Confirm Database Unavailability

```bash
# Test database connectivity
gcloud sql instances describe ln-health-db-beta \
  --project=lifenav-prod \
  --format="value(state)"

# Expected: RUNNABLE
# If NOT RUNNABLE, check status:
gcloud sql operations list \
  --instance=ln-health-db-beta \
  --project=lifenav-prod \
  --limit=5

# Test query execution
gcloud sql connect ln-health-db-beta \
  --user=postgres \
  --project=lifenav-prod \
  --database=ln_health

# Run test query:
# SELECT COUNT(*) FROM health_conditions;
# If this fails, proceed to restoration
```

### Step 2: Identify Root Cause

```bash
# Check Cloud SQL logs for errors
gcloud logging read \
  "resource.type=cloudsql_database AND resource.labels.database_id=lifenav-prod:ln-health-db-beta" \
  --limit=50 \
  --format=json \
  --project=lifenav-prod

# Common failure modes:
# 1. Data corruption (malicious or accidental)
# 2. Failed upgrade/migration
# 3. Hardware failure (GCP managed, rare)
# 4. Quota exhaustion (disk full, connection limit)

# Document root cause in incident tracker
```

### Step 3: Determine Recovery Strategy

| Scenario | Strategy | Target RTO |
|----------|----------|------------|
| **Data corruption (< 1 hour ago)** | Point-in-Time Recovery (PITR) | 15 minutes |
| **Data corruption (> 1 hour ago)** | PITR to specific time | 20 minutes |
| **Instance failure** | Restore from latest backup | 30 minutes |
| **Complete data loss** | Restore from backup + rebuild | 1 hour |

```bash
# Determine last known good time
# Check monitoring dashboards: https://grafana.lifenavigator.com/d/hipaa-health

# Example: Last successful health query was at 2025-12-14 10:25:00 UTC
LAST_GOOD_TIME="2025-12-14T10:25:00Z"
echo "Recovery target: $LAST_GOOD_TIME"
```

---

## Restoration Phase (Target: < 10 minutes)

### Option A: Point-in-Time Recovery (PREFERRED)

**Use when:** Data corruption detected within last 7 days

```bash
# Step 1: Generate recovery instance name
RECOVERY_INSTANCE="ln-health-db-recovery-$(date +%Y%m%d-%H%M)"
echo "Recovery instance: $RECOVERY_INSTANCE"

# Step 2: Create pre-recovery backup (safety measure)
echo "Creating safety backup before recovery..."
gcloud sql backups create \
  --instance=ln-health-db-beta \
  --project=lifenav-prod \
  --description="Pre-recovery backup $INCIDENT_ID"

# Wait for backup to complete (~ 2 minutes)
gcloud sql operations list \
  --instance=ln-health-db-beta \
  --project=lifenav-prod \
  --filter="operationType=BACKUP" \
  --limit=1

# Step 3: Clone instance with PITR
echo "Starting PITR to $LAST_GOOD_TIME..."
PITR_START=$(date +%s)

gcloud sql instances clone ln-health-db-beta $RECOVERY_INSTANCE \
  --point-in-time=$LAST_GOOD_TIME \
  --project=lifenav-prod

# This operation takes 5-10 minutes
# Monitor progress:
gcloud sql operations list \
  --instance=$RECOVERY_INSTANCE \
  --project=lifenav-prod \
  --limit=1

# Wait for instance to become RUNNABLE
while true; do
    STATE=$(gcloud sql instances describe $RECOVERY_INSTANCE \
        --project=lifenav-prod \
        --format="value(state)")

    if [ "$STATE" = "RUNNABLE" ]; then
        echo "Recovery instance is RUNNABLE"
        break
    fi

    echo "Instance state: $STATE (waiting...)"
    sleep 10
done

PITR_END=$(date +%s)
PITR_DURATION=$((PITR_END - PITR_START))
echo "PITR completed in ${PITR_DURATION} seconds"
```

### Option B: Restore from Latest Backup

**Use when:** Instance completely failed or PITR not available

```bash
# Step 1: List available backups
echo "Listing available backups..."
gcloud sql backups list \
  --instance=ln-health-db-beta \
  --project=lifenav-prod \
  --format="table(id,windowStartTime,status)"

# Step 2: Select most recent successful backup
BACKUP_ID=$(gcloud sql backups list \
  --instance=ln-health-db-beta \
  --project=lifenav-prod \
  --limit=1 \
  --filter="status=SUCCESSFUL" \
  --format="value(id)")

echo "Restoring from backup ID: $BACKUP_ID"

# Step 3: Restore to new instance
RECOVERY_INSTANCE="ln-health-db-recovery-$(date +%Y%m%d-%H%M)"

gcloud sql backups restore $BACKUP_ID \
  --backup-instance=ln-health-db-beta \
  --restore-instance=$RECOVERY_INSTANCE \
  --project=lifenav-prod

# Wait for restore to complete (5-15 minutes)
while true; do
    STATE=$(gcloud sql instances describe $RECOVERY_INSTANCE \
        --project=lifenav-prod \
        --format="value(state)" 2>/dev/null)

    if [ "$STATE" = "RUNNABLE" ]; then
        echo "Restore completed successfully"
        break
    fi

    echo "Restore in progress... (state: $STATE)"
    sleep 15
done
```

---

## Validation Phase (Target: < 3 minutes)

### Step 1: PHI Data Integrity Check

```bash
# Connect to recovery instance
echo "Validating PHI data integrity..."
gcloud sql connect $RECOVERY_INSTANCE \
  --user=postgres \
  --project=lifenav-prod \
  --database=ln_health
```

```sql
-- Run these validation queries:

-- 1. Check record counts
SELECT 'health_conditions' AS table_name, COUNT(*) AS count FROM health_conditions WHERE deleted_at IS NULL
UNION ALL
SELECT 'medications', COUNT(*) FROM medications WHERE deleted_at IS NULL
UNION ALL
SELECT 'diagnoses', COUNT(*) FROM diagnoses WHERE deleted_at IS NULL
UNION ALL
SELECT 'health_records', COUNT(*) FROM health_records WHERE deleted_at IS NULL;

-- Expected counts (adjust based on your monitoring):
-- health_conditions: ~500
-- medications: ~800
-- diagnoses: ~600
-- health_records: ~1500

-- 2. Check for data corruption
SELECT COUNT(*) AS corrupted_records
FROM health_conditions
WHERE name IS NULL OR name = '' OR user_id IS NULL;

-- Expected: 0

-- 3. Check timestamp ranges (ensure data is recent)
SELECT
    MAX(created_at) AS latest_record,
    MAX(updated_at) AS latest_update,
    NOW() - MAX(updated_at) AS data_age
FROM health_conditions;

-- Data age should be < 1 hour (if recovery is recent)

-- 4. Verify tenant isolation (RLS check)
SELECT COUNT(DISTINCT tenant_id) AS tenant_count FROM health_conditions;

-- Expected: ~10-50 tenants

-- 5. Check encryption is intact (sample check)
SELECT COUNT(*) FROM health_conditions
WHERE encrypted_diagnosis IS NOT NULL
  AND encrypted_diagnosis NOT LIKE 'encrypted:%';

-- Expected: 0 (all encrypted fields should have prefix)
```

### Step 2: Sample PHI Validation

```sql
-- Randomly sample 5 health records for manual validation
SELECT
    id,
    user_id,
    name,
    diagnosis_date,
    status,
    created_at
FROM health_conditions
WHERE deleted_at IS NULL
ORDER BY RANDOM()
LIMIT 5;

-- Manually verify:
-- ✓ Names are readable (not corrupted)
-- ✓ Dates are valid (not future dates)
-- ✓ Status values are valid enums
-- ✓ user_id exists in users table (FK integrity)
```

### Step 3: Calculate RPO (Data Loss)

```sql
-- Find latest record timestamp in recovered database
SELECT MAX(created_at) AS latest_recovered_record FROM health_conditions;

-- Compare with current time to determine data loss window
-- RPO target: 1 minute
-- If data loss > 1 minute, escalate to compliance officer
```

```bash
# Document data loss
LATEST_RECORD=$(psql $RECOVERY_DB_URL -tAc "SELECT MAX(created_at) FROM health_conditions")
CURRENT_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "Latest recovered record: $LATEST_RECORD"
echo "Current time: $CURRENT_TIME"
echo "Data loss window: <calculate duration>"

# If RPO exceeded, this may trigger HIPAA breach notification requirement
```

---

## Switchover Phase (Target: < 4 minutes)

### Step 1: Update Connection String

```bash
# Get connection name for recovery instance
RECOVERY_CONNECTION=$(gcloud sql instances describe $RECOVERY_INSTANCE \
  --project=lifenav-prod \
  --format="value(connectionName)")

echo "Recovery instance connection: $RECOVERY_CONNECTION"

# Construct new DATABASE_HIPAA_URL
# Format: postgresql+asyncpg://USER:PASSWORD@/DATABASE?host=/cloudsql/CONNECTION_NAME
NEW_DB_URL="postgresql+asyncpg://ln_health_user:PASSWORD@/ln_health?host=/cloudsql/$RECOVERY_CONNECTION"

echo "New DATABASE_HIPAA_URL: $NEW_DB_URL"
```

### Step 2: Update Kubernetes Secret

```bash
# Update backend-secrets with new DATABASE_HIPAA_URL
kubectl create secret generic backend-secrets \
  --from-literal=DATABASE_HIPAA_URL="$NEW_DB_URL" \
  --namespace=life-navigator \
  --dry-run=client -o yaml | kubectl apply -f -

# Verify secret updated
kubectl get secret backend-secrets -n life-navigator -o jsonpath='{.data.DATABASE_HIPAA_URL}' | base64 -d
```

### Step 3: Restart Backend Pods

```bash
# Rolling restart to pick up new database connection
kubectl rollout restart deployment/backend -n life-navigator

# Monitor rollout
kubectl rollout status deployment/backend -n life-navigator -w

# Expected: "deployment "backend" successfully rolled out"

# Check pod logs for database connection errors
kubectl logs -n life-navigator -l app=backend --tail=20 | grep -i "database\|hipaa\|error"
```

### Step 4: Test Health Data API

```bash
# Generate test token (or use existing admin token)
TEST_TOKEN="<admin-or-test-user-token>"

# Test health conditions endpoint
curl -X GET \
  https://api.lifenavigator.com/api/v1/health/conditions \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json"

# Expected: 200 OK with health conditions array

# Test health record creation (write test)
curl -X POST \
  https://api.lifenavigator.com/api/v1/health/conditions \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Condition - Restore Validation",
    "diagnosis_date": "2025-12-14",
    "status": "active"
  }'

# Expected: 201 Created

# Delete test record
curl -X DELETE \
  https://api.lifenavigator.com/api/v1/health/conditions/<id> \
  -H "Authorization: Bearer $TEST_TOKEN"
```

---

## Post-Restoration Phase

### Step 1: Monitor for Errors (15 minutes)

```bash
# Watch backend logs for database errors
kubectl logs -n life-navigator -l app=backend -f | grep -i "error\|exception\|database"

# Monitor error rate in Grafana
open https://grafana.lifenavigator.com/d/api-health

# Check Sentry for new exceptions
open https://sentry.io/organizations/lifenavigator/issues/
```

### Step 2: Notify Users (if RPO > 5 minutes)

```bash
# If data loss exceeds acceptable threshold:
# 1. Update status page with incident details
# 2. Send email to affected users
# 3. Document data loss in incident report

# Example status update:
echo "We experienced a brief technical issue with health data.
Health records created between $LAST_GOOD_TIME and $CURRENT_TIME
may need to be re-entered. We apologize for the inconvenience."
```

### Step 3: Decommission Failed Instance

```bash
# DO NOT delete failed instance immediately
# Keep for forensic analysis and compliance

# Rename failed instance
gcloud sql instances patch ln-health-db-beta \
  --project=lifenav-prod \
  --description="FAILED - $INCIDENT_ID - DO NOT DELETE"

# Add deletion protection
gcloud sql instances patch ln-health-db-beta \
  --project=lifenav-prod \
  --deletion-protection

# Promote recovery instance to primary
gcloud sql instances patch $RECOVERY_INSTANCE \
  --project=lifenav-prod \
  --description="Primary HIPAA Database (restored from $INCIDENT_ID)"

# Update Terraform state (if using Terraform)
# terraform import google_sql_database_instance.hipaa_db $RECOVERY_INSTANCE
```

### Step 4: Close Incident

```bash
INCIDENT_END_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
RESTORE_END=$(date +%s)
TOTAL_DOWNTIME=$((RESTORE_END - RESTORE_START_TIME))

echo "========================================="
echo "INCIDENT RESOLVED: $INCIDENT_ID"
echo "END TIME: $INCIDENT_END_TIME"
echo "TOTAL DOWNTIME: ${TOTAL_DOWNTIME} seconds ($((TOTAL_DOWNTIME / 60)) minutes)"
echo "RTO TARGET: 900 seconds (15 minutes)"
echo "RTO ACHIEVED: $(if [ $TOTAL_DOWNTIME -le 900 ]; then echo YES; else echo NO; fi)"
echo "========================================="

# Update incident tracker
# Mark incident as RESOLVED
# Document timeline, root cause, and lessons learned
```

---

## HIPAA Compliance Checklist

After completing restoration:

✅ **Incident Report Required:**
- [ ] Document total downtime (RTO actual vs target)
- [ ] Document data loss window (RPO actual vs target)
- [ ] List all personnel who accessed PHI during restoration
- [ ] Describe root cause and corrective actions
- [ ] File report with Compliance Officer

✅ **Breach Analysis (if RPO > 5 minutes):**
- [ ] Identify affected users/records
- [ ] Determine if breach notification required (consult legal)
- [ ] Document business associate (Google Cloud) notification
- [ ] Prepare user notification if required

✅ **Audit Log Review:**
- [ ] Verify all PHI access is logged
- [ ] Confirm no unauthorized access during incident
- [ ] Archive logs for 7 years (HIPAA requirement)

✅ **Post-Incident Actions:**
- [ ] Schedule post-mortem meeting (within 48 hours)
- [ ] Update runbooks with lessons learned
- [ ] Implement preventive measures
- [ ] Test updated procedures (within 30 days)

---

## Common Issues and Troubleshooting

### Issue 1: PITR Target Time Not Available

**Symptom:** Error: "Requested point-in-time is outside available transaction log window"

**Cause:** Transaction logs older than 7 days are purged

**Solution:**
```bash
# Use latest available backup instead
gcloud sql backups list --instance=ln-health-db-beta --project=lifenav-prod --limit=1

# Restore from latest backup (data loss will be > RPO target)
# Escalate to compliance officer for breach analysis
```

### Issue 2: Recovery Instance Won't Start

**Symptom:** Instance stuck in "MAINTENANCE" or "FAILED" state

**Cause:** Insufficient quota, corrupted backup, or GCP service issue

**Solution:**
```bash
# Check operations log
gcloud sql operations list --instance=$RECOVERY_INSTANCE --project=lifenav-prod

# If quota issue:
gcloud compute project-info describe --project=lifenav-prod

# Request quota increase (emergency process)
# Escalate to GCP support

# If backup corrupted, try previous backup:
gcloud sql backups list --instance=ln-health-db-beta --project=lifenav-prod --limit=5
```

### Issue 3: Connection String Update Doesn't Take Effect

**Symptom:** Backend still trying to connect to old database

**Cause:** Pods haven't restarted or cached connection

**Solution:**
```bash
# Force delete pods (aggressive restart)
kubectl delete pods -n life-navigator -l app=backend

# Verify new pods have correct connection
kubectl logs -n life-navigator -l app=backend --tail=5 | grep "database"
```

---

## Emergency Contacts

**On-Call SRE Lead:** PagerDuty escalation policy
**Security Lead:** security@lifenavigator.com
**Compliance Officer:** compliance@lifenavigator.com
**GCP Support (Premium):** https://console.cloud.google.com/support
**Legal (Breach Notification):** legal@lifenavigator.com

---

**Last Updated:** 2026-01-09
**Next Review:** 2026-02-09 (Monthly review required for HIPAA runbooks)
**Tested:** <DATE OF LAST DR DRILL>
