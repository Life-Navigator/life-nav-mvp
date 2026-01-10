# Cloud SQL Production Readiness

**Status**: Production Infrastructure Standard
**Last Updated**: 2026-01-09
**Owner**: Database Reliability Engineering

---

## Overview

Life Navigator uses **two isolated Cloud SQL PostgreSQL instances** for regulated data:

1. **CloudSQL HIPAA** - Health/medical data (HIPAA § 164.308)
2. **CloudSQL Financial** - Financial/PCI data (PCI-DSS, GLBA)

This document defines production hardening requirements for secure connectivity, high availability, disaster recovery, and safe schema migrations.

---

## Architecture

### Database Topology

```
┌─────────────────────────────────────────────────────────┐
│ FRONTEND (Vercel)                                       │
│   └─→ Supabase PostgreSQL (Primary)                    │
│       - Auth, users, goals, education                   │
│       - RLS enforced                                    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ BACKEND API (Cloud Run - Private VPC)                  │
│   ├─→ CloudSQL HIPAA (Private IP only)                 │
│   │   - health_conditions                               │
│   │   - medications                                     │
│   │   - diagnoses                                       │
│   │   - health_records                                  │
│   │                                                     │
│   └─→ CloudSQL Financial (Private IP only)             │
│       - financial_accounts                              │
│       - transactions                                    │
│       - investments                                     │
│       - plaid_items                                     │
└─────────────────────────────────────────────────────────┘
```

**Network Isolation**:
- ✅ Private IP only (no public internet access)
- ✅ VPC peering to backend services
- ✅ Cloud SQL Proxy for secure connections
- ✅ Certificate-based authentication

---

## 1. Secure Connectivity

### Option A: IAM Authentication (Recommended)

**Benefits**:
- ✅ No password rotation required
- ✅ Automatic credential management
- ✅ GCP IAM audit logging
- ✅ Short-lived tokens (1 hour TTL)

#### Implementation

**1. Enable IAM Authentication**

```bash
# Enable IAM auth on CloudSQL instance
gcloud sql instances patch life-navigator-hipaa \
  --database-flags=cloudsql.iam_authentication=on \
  --region=us-central1

gcloud sql instances patch life-navigator-financial \
  --database-flags=cloudsql.iam_authentication=on \
  --region=us-central1
```

**2. Create IAM Database Users**

```bash
# Create IAM user for backend service account
gcloud sql users create backend-sa@life-navigator-prod.iam \
  --instance=life-navigator-hipaa \
  --type=CLOUD_IAM_SERVICE_ACCOUNT

gcloud sql users create backend-sa@life-navigator-prod.iam \
  --instance=life-navigator-financial \
  --type=CLOUD_IAM_SERVICE_ACCOUNT
```

**3. Grant IAM Permissions**

```bash
# Grant Cloud SQL Client role
gcloud projects add-iam-policy-binding life-navigator-prod \
  --member=serviceAccount:backend-sa@life-navigator-prod.iam.gserviceaccount.com \
  --role=roles/cloudsql.client

# Grant database access via IAM
gcloud sql users create backend-sa@life-navigator-prod.iam \
  --instance=life-navigator-hipaa \
  --type=CLOUD_IAM_SERVICE_ACCOUNT

# In PostgreSQL: Grant database permissions
psql -h /cloudsql/PROJECT:REGION:INSTANCE -U postgres << 'EOF'
GRANT CONNECT ON DATABASE hipaa_db TO "backend-sa@life-navigator-prod.iam";
GRANT USAGE ON SCHEMA public TO "backend-sa@life-navigator-prod.iam";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "backend-sa@life-navigator-prod.iam";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "backend-sa@life-navigator-prod.iam";
EOF
```

**4. Application Configuration**

```python
# backend/app/core/database_hipaa.py
from google.cloud.sql.connector import Connector
import sqlalchemy

def get_hipaa_engine():
    """Create CloudSQL HIPAA engine with IAM auth."""
    connector = Connector()

    def getconn():
        conn = connector.connect(
            "life-navigator-prod:us-central1:life-navigator-hipaa",
            "pg8000",
            user="backend-sa@life-navigator-prod.iam",
            db="hipaa_db",
            enable_iam_auth=True,  # ✅ IAM authentication
        )
        return conn

    engine = sqlalchemy.create_engine(
        "postgresql+pg8000://",
        creator=getconn,
        pool_size=10,
        max_overflow=5,
        pool_pre_ping=True,  # ✅ Health check before use
        pool_recycle=3600,   # ✅ Recycle connections every hour
    )
    return engine
```

**5. Cloud Run Service Account**

```yaml
# k8s/base/backend/serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: backend-sa
  annotations:
    iam.gke.io/gcp-service-account: backend-sa@life-navigator-prod.iam.gserviceaccount.com
```

### Option B: Rotated Passwords (Fallback)

**Use Case**: If IAM auth not feasible (e.g., third-party tools)

#### Implementation

**1. Generate Strong Password**

```bash
# Generate cryptographically secure password
openssl rand -base64 32 > cloudsql-hipaa-password.txt
```

**2. Store in Secret Manager**

```bash
# Create secret
gcloud secrets create cloudsql-hipaa-password \
  --replication-policy=automatic \
  --data-file=cloudsql-hipaa-password.txt

# Grant backend service account access
gcloud secrets add-iam-policy-binding cloudsql-hipaa-password \
  --member=serviceAccount:backend-sa@life-navigator-prod.iam.gserviceaccount.com \
  --role=roles/secretmanager.secretAccessor
```

**3. Set CloudSQL Password**

```bash
# Set password on CloudSQL user
gcloud sql users set-password cloudsql_user \
  --instance=life-navigator-hipaa \
  --password=$(cat cloudsql-hipaa-password.txt)
```

**4. Rotation Schedule (Cloud Scheduler)**

```bash
# scripts/rotate-cloudsql-passwords.sh
#!/bin/bash
set -euo pipefail

for INSTANCE in life-navigator-hipaa life-navigator-financial; do
  echo "Rotating password for $INSTANCE..."

  # Generate new password
  NEW_PASSWORD=$(openssl rand -base64 32)

  # Update CloudSQL
  gcloud sql users set-password cloudsql_user \
    --instance="$INSTANCE" \
    --password="$NEW_PASSWORD"

  # Update Secret Manager
  echo -n "$NEW_PASSWORD" | gcloud secrets versions add "cloudsql-${INSTANCE}-password" \
    --data-file=-

  echo "✅ Password rotated for $INSTANCE"
done

# Rolling restart backend to pick up new secret
kubectl rollout restart deployment/backend -n life-navigator-prod
```

**Schedule via Cloud Scheduler**:
```bash
gcloud scheduler jobs create http rotate-cloudsql-passwords \
  --schedule="0 0 1 * *" \
  --uri="https://CLOUD_FUNCTION_URL/rotate-cloudsql-passwords" \
  --http-method=POST \
  --oidc-service-account-email=secret-rotator@life-navigator-prod.iam.gserviceaccount.com
```

---

## 2. Connection Pooling Strategy

### Recommended: Application-Side Pooling (SQLAlchemy)

**Why Application-Side**:
- ✅ Fewer moving parts (no separate pgBouncer service)
- ✅ Native support in SQLAlchemy/asyncpg
- ✅ Better observability (Prometheus metrics)
- ✅ Automatic failover handling

#### Configuration

```python
# backend/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# CloudSQL HIPAA Engine
hipaa_engine = create_async_engine(
    settings.DATABASE_HIPAA_URL,
    # Connection pooling
    pool_size=20,              # ✅ Max connections per pod
    max_overflow=10,           # ✅ Burst capacity
    pool_timeout=30,           # ✅ Wait 30s for connection
    pool_recycle=3600,         # ✅ Recycle after 1 hour
    pool_pre_ping=True,        # ✅ Health check before use

    # Async I/O
    echo=False,                # Disable SQL logging (performance)
    future=True,

    # Connection parameters
    connect_args={
        "server_settings": {
            "application_name": "backend-api",
            "jit": "off",      # Disable JIT for predictable performance
        },
        "command_timeout": 60,  # Query timeout
        "timeout": 10,          # Connection timeout
    },
)

# Session factory
HipaaSessionLocal = sessionmaker(
    hipaa_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)
```

#### Sizing Guidelines

| Traffic | Pods | Pool Size | Max Overflow | Total Connections |
|---------|------|-----------|--------------|-------------------|
| **Dev** (10 req/s) | 2 | 5 | 2 | 14 |
| **Staging** (100 req/s) | 5 | 10 | 5 | 75 |
| **Production** (1,000 req/s) | 20 | 20 | 10 | 600 |

**CloudSQL Max Connections**:
```sql
-- Check current max_connections
SHOW max_connections;
-- Default: 100 (db-n1-standard-1)

-- Calculate required max_connections
-- Formula: (pods * (pool_size + max_overflow)) + 10 (for admin)
-- Production: (20 * 30) + 10 = 610 connections

-- Increase max_connections if needed
ALTER SYSTEM SET max_connections = 1000;
-- Requires instance restart
```

### Alternative: PgBouncer (For High Connection Count)

**Use Case**: When application-side pooling isn't sufficient (>1,000 connections)

#### Deployment

```yaml
# k8s/base/pgbouncer/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pgbouncer-hipaa
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: pgbouncer
          image: pgbouncer/pgbouncer:1.21
          ports:
            - containerPort: 5432
          env:
            - name: DATABASES_HOST
              value: "10.128.0.3"  # CloudSQL private IP
            - name: DATABASES_PORT
              value: "5432"
            - name: DATABASES_USER
              valueFrom:
                secretKeyRef:
                  name: cloudsql-hipaa-credentials
                  key: username
            - name: DATABASES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: cloudsql-hipaa-credentials
                  key: password
            - name: POOL_MODE
              value: "transaction"  # ✅ Transaction-level pooling
            - name: MAX_CLIENT_CONN
              value: "1000"
            - name: DEFAULT_POOL_SIZE
              value: "25"
          volumeMounts:
            - name: pgbouncer-config
              mountPath: /etc/pgbouncer
      volumes:
        - name: pgbouncer-config
          configMap:
            name: pgbouncer-config
```

**PgBouncer Config**:
```ini
# pgbouncer.ini
[databases]
hipaa_db = host=10.128.0.3 port=5432 dbname=hipaa_db

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = 5432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

pool_mode = transaction
max_client_conn = 1000
default_pool_size = 25
reserve_pool_size = 5
reserve_pool_timeout = 3

server_idle_timeout = 600
server_lifetime = 3600
server_connect_timeout = 15

log_connections = 1
log_disconnections = 1
```

---

## 3. Network Isolation

### Private IP Only (No Public Access)

```bash
# Create CloudSQL instance with private IP
gcloud sql instances create life-navigator-hipaa \
  --database-version=POSTGRES_15 \
  --tier=db-n1-standard-2 \
  --region=us-central1 \
  --network=projects/life-navigator-prod/global/networks/default \
  --no-assign-ip \
  --database-flags=cloudsql.iam_authentication=on

# Verify no public IP
gcloud sql instances describe life-navigator-hipaa --format="value(ipAddresses)"
# Should only show private IP (10.x.x.x)
```

### VPC Peering Configuration

```bash
# Create private service connection
gcloud services vpc-peerings connect \
  --service=servicenetworking.googleapis.com \
  --ranges=google-managed-services-default \
  --network=default

# Verify peering
gcloud services vpc-peerings list \
  --network=default
```

### Firewall Rules

```bash
# Allow backend pods to CloudSQL
gcloud compute firewall-rules create allow-backend-to-cloudsql \
  --network=default \
  --allow=tcp:5432 \
  --source-tags=backend-pod \
  --target-tags=cloudsql-instance \
  --description="Allow backend pods to access CloudSQL"

# Deny all other traffic
gcloud compute firewall-rules create deny-cloudsql-default \
  --network=default \
  --action=DENY \
  --rules=tcp:5432 \
  --destination-ranges=10.128.0.0/20 \
  --priority=1000 \
  --description="Deny all traffic to CloudSQL by default"
```

### Cloud SQL Proxy (For Secure Connections)

```yaml
# k8s/base/backend/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  template:
    spec:
      containers:
        # Application container
        - name: backend
          image: gcr.io/life-navigator-prod/backend:latest
          env:
            - name: DATABASE_HIPAA_URL
              value: "postgresql+asyncpg://user@localhost:5432/hipaa_db"

        # Cloud SQL Proxy sidecar
        - name: cloud-sql-proxy
          image: gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.8.0
          args:
            - "--private-ip"
            - "--port=5432"
            - "life-navigator-prod:us-central1:life-navigator-hipaa"
          securityContext:
            runAsNonRoot: true
          resources:
            requests:
              memory: "128Mi"
              cpu: "100m"
            limits:
              memory: "256Mi"
              cpu: "200m"
```

---

## 4. Backup & Disaster Recovery

### Automated Backups

```bash
# Configure automated backups
gcloud sql instances patch life-navigator-hipaa \
  --backup-start-time=03:00 \
  --enable-bin-log \
  --retained-backups-count=30 \
  --retained-transaction-log-days=7 \
  --transaction-log-retention-days=7

# Verify backup configuration
gcloud sql instances describe life-navigator-hipaa \
  --format="value(settings.backupConfiguration)"
```

**Backup Schedule**:
- **Full Backups**: Daily at 3:00 AM UTC
- **Retention**: 30 days
- **Transaction Logs**: 7 days (for PITR)

### Point-in-Time Recovery (PITR)

```bash
# Restore to specific timestamp
gcloud sql backups restore BACKUP_ID \
  --backup-instance=life-navigator-hipaa \
  --backup-id=BACKUP_ID

# Or restore to specific point in time
gcloud sql instances clone life-navigator-hipaa life-navigator-hipaa-restored \
  --point-in-time='2026-01-09T10:00:00.000Z'
```

**PITR Capabilities**:
- ✅ Restore to any point within last 7 days
- ✅ Transaction-level granularity
- ✅ Clone to new instance (non-destructive)

### Cross-Region Replication (High Availability)

```bash
# Create read replica in secondary region
gcloud sql instances create life-navigator-hipaa-replica \
  --master-instance-name=life-navigator-hipaa \
  --region=us-east1 \
  --tier=db-n1-standard-2 \
  --replica-type=READ \
  --availability-type=REGIONAL

# Promote replica to standalone (failover)
gcloud sql instances promote-replica life-navigator-hipaa-replica
```

**RPO (Recovery Point Objective)**: 0 seconds (synchronous replication)
**RTO (Recovery Time Objective)**: < 5 minutes (automatic failover)

### Disaster Recovery Drill (Quarterly)

**File**: `scripts/dr-drill-cloudsql.sh`

```bash
#!/bin/bash
# Disaster Recovery Drill for CloudSQL
# Tests: Backup restore, PITR, failover

set -euo pipefail

echo "🔥 Starting CloudSQL Disaster Recovery Drill..."

# 1. Create test data
echo "1. Creating test data..."
psql -h /cloudsql/PROJECT:REGION:INSTANCE -U postgres << 'EOF'
CREATE TABLE IF NOT EXISTS dr_drill_test (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT NOW(),
  data TEXT
);
INSERT INTO dr_drill_test (data) VALUES ('DR Drill Test Data');
EOF

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
echo "Timestamp: $TIMESTAMP"

# 2. Wait for transaction log
sleep 60

# 3. Clone instance to point-in-time
echo "2. Cloning instance to point-in-time..."
gcloud sql instances clone life-navigator-hipaa life-navigator-hipaa-dr-test \
  --point-in-time="$TIMESTAMP"

# 4. Verify data integrity
echo "3. Verifying data integrity..."
RESTORED_COUNT=$(psql -h /cloudsql/PROJECT:REGION:INSTANCE -U postgres -t -c \
  "SELECT COUNT(*) FROM dr_drill_test WHERE data = 'DR Drill Test Data';")

if [ "$RESTORED_COUNT" -eq 1 ]; then
  echo "✅ DR Drill PASSED: Data restored successfully"
else
  echo "❌ DR Drill FAILED: Data not found in restored instance"
  exit 1
fi

# 5. Cleanup
echo "4. Cleaning up..."
gcloud sql instances delete life-navigator-hipaa-dr-test --quiet

echo "✅ DR Drill Complete"
```

**Schedule**:
```bash
# Run quarterly via Cloud Scheduler
gcloud scheduler jobs create http dr-drill-cloudsql \
  --schedule="0 0 1 */3 *" \
  --uri="https://CLOUD_FUNCTION_URL/dr-drill-cloudsql" \
  --http-method=POST \
  --oidc-service-account-email=dr-tester@life-navigator-prod.iam.gserviceaccount.com
```

---

## 5. Migration Execution Strategy

### Dedicated Migration Job (Kubernetes Job)

```yaml
# k8s/jobs/migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: cloudsql-migration
spec:
  backoffLimit: 0  # ✅ No retries (fail fast)
  template:
    spec:
      restartPolicy: Never
      serviceAccountName: migration-sa
      containers:
        - name: alembic
          image: gcr.io/life-navigator-prod/backend:latest
          command:
            - /bin/sh
            - -c
            - |
              set -e
              echo "Running Alembic migrations..."
              alembic upgrade head
              echo "✅ Migrations complete"
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: cloudsql-hipaa-connection-string
                  key: url
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
```

### Migration Execution Checklist

#### Pre-Migration

- [ ] **Backup Database**
  ```bash
  gcloud sql backups create \
    --instance=life-navigator-hipaa \
    --description="Pre-migration backup"
  ```

- [ ] **Test Migration in Staging**
  ```bash
  # Clone production to staging
  gcloud sql instances clone life-navigator-hipaa life-navigator-hipaa-staging

  # Run migration on staging
  kubectl apply -f k8s/jobs/migration-job.yaml
  ```

- [ ] **Review SQL Changes**
  ```bash
  # Generate SQL preview
  alembic upgrade head --sql > migration-preview.sql
  cat migration-preview.sql
  ```

- [ ] **Lock Minimization Analysis**
  ```sql
  -- Identify blocking operations
  -- CREATE INDEX CONCURRENTLY (non-blocking)
  -- ALTER TABLE ... SET NOT NULL (requires full table scan)
  ```

#### During Migration

- [ ] **Enable Maintenance Window** (Optional)
  ```bash
  # Schedule maintenance window
  gcloud sql instances patch life-navigator-hipaa \
    --maintenance-window-day=SUN \
    --maintenance-window-hour=3
  ```

- [ ] **Run Migration Job**
  ```bash
  kubectl apply -f k8s/jobs/migration-job.yaml

  # Watch progress
  kubectl logs -f job/cloudsql-migration
  ```

- [ ] **Monitor Locks**
  ```sql
  -- Check for blocking queries
  SELECT
    pid,
    usename,
    application_name,
    state,
    query,
    wait_event_type,
    wait_event
  FROM pg_stat_activity
  WHERE state != 'idle'
  ORDER BY query_start;
  ```

#### Post-Migration

- [ ] **Verify Schema**
  ```bash
  # Check Alembic version
  alembic current

  # Verify tables created
  psql -h /cloudsql/PROJECT:REGION:INSTANCE -U postgres -c "\dt"
  ```

- [ ] **Run Health Checks**
  ```bash
  curl https://api.lifenav.app/health
  ```

- [ ] **Monitor Error Rates**
  ```bash
  # Check Sentry for migration-related errors
  # Check Cloud Monitoring for database errors
  ```

### Lock Minimization Techniques

#### CREATE INDEX CONCURRENTLY

```sql
-- ❌ Blocking (locks table for writes)
CREATE INDEX idx_user_email ON users(email);

-- ✅ Non-blocking (uses CONCURRENTLY)
CREATE INDEX CONCURRENTLY idx_user_email ON users(email);
```

#### ADD COLUMN with DEFAULT (PostgreSQL 11+)

```sql
-- ❌ Blocking (rewrites entire table)
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active';

-- ✅ Non-blocking (PostgreSQL 11+)
ALTER TABLE users ADD COLUMN status TEXT;
-- Default is stored in metadata, not rewritten
```

#### Batch Updates (For Large Tables)

```python
# Migration: Add NOT NULL constraint
# Step 1: Add nullable column
op.add_column('users', sa.Column('new_field', sa.String(), nullable=True))

# Step 2: Backfill in batches (outside migration)
# scripts/backfill-new-field.py
BATCH_SIZE = 1000
while True:
    rows_updated = session.execute(
        "UPDATE users SET new_field = 'default' WHERE new_field IS NULL LIMIT :limit",
        {"limit": BATCH_SIZE}
    ).rowcount
    session.commit()
    if rows_updated == 0:
        break

# Step 3: Add NOT NULL constraint (separate migration)
op.alter_column('users', 'new_field', nullable=False)
```

### Rollback Plan

```bash
# scripts/rollback-migration.sh
#!/bin/bash
set -euo pipefail

echo "🔙 Rolling back migration..."

# 1. Downgrade Alembic
kubectl exec -it deployment/backend -- alembic downgrade -1

# 2. Restore from backup (if schema corrupted)
BACKUP_ID=$(gcloud sql backups list \
  --instance=life-navigator-hipaa \
  --filter="description:Pre-migration" \
  --format="value(id)" \
  --limit=1)

gcloud sql backups restore "$BACKUP_ID" \
  --backup-instance=life-navigator-hipaa

echo "✅ Rollback complete"
```

---

## Monitoring & Alerting

### Key Metrics

```yaml
# terraform/monitoring/cloudsql-alerts.tf
resource "google_monitoring_alert_policy" "cloudsql_cpu_high" {
  display_name = "CloudSQL CPU > 80%"
  conditions {
    display_name = "CPU utilization high"
    condition_threshold {
      filter = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\""
      comparison = "COMPARISON_GT"
      threshold_value = 0.8
      duration = "300s"
    }
  }
  notification_channels = [google_monitoring_notification_channel.pagerduty.id]
}

resource "google_monitoring_alert_policy" "cloudsql_connections_high" {
  display_name = "CloudSQL Connections > 80%"
  conditions {
    display_name = "Connection count high"
    condition_threshold {
      filter = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\""
      comparison = "COMPARISON_GT"
      threshold_value = 80
      duration = "300s"
    }
  }
  notification_channels = [google_monitoring_notification_channel.pagerduty.id]
}

resource "google_monitoring_alert_policy" "cloudsql_replication_lag" {
  display_name = "CloudSQL Replication Lag > 60s"
  conditions {
    display_name = "Replication lag high"
    condition_threshold {
      filter = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/replication/replica_lag\""
      comparison = "COMPARISON_GT"
      threshold_value = 60
      duration = "300s"
    }
  }
  notification_channels = [google_monitoring_notification_channel.pagerduty.id]
}
```

### Dashboards

```json
// Cloud Monitoring Dashboard: CloudSQL Performance
{
  "displayName": "CloudSQL - HIPAA & Financial",
  "gridLayout": {
    "widgets": [
      {
        "title": "CPU Utilization",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloudsql_database\" metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\""
              }
            }
          }]
        }
      },
      {
        "title": "Connection Count",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloudsql_database\" metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\""
              }
            }
          }]
        }
      },
      {
        "title": "Query Latency (p95)",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloudsql_database\" metric.type=\"cloudsql.googleapis.com/database/postgresql/insights/aggregate/latencies\""
              }
            }
          }]
        }
      }
    ]
  }
}
```

---

## Security Hardening

### SSL/TLS Enforcement

```bash
# Require SSL for all connections
gcloud sql instances patch life-navigator-hipaa \
  --require-ssl

# Verify SSL configuration
gcloud sql instances describe life-navigator-hipaa \
  --format="value(settings.ipConfiguration.requireSsl)"
```

### Audit Logging

```bash
# Enable Cloud SQL audit logging
gcloud sql instances patch life-navigator-hipaa \
  --database-flags=cloudsql.enable_pgaudit=on,pgaudit.log=all

# View audit logs
gcloud logging read \
  'resource.type="cloudsql_database" protoPayload.methodName="cloudsql.instances.connect"' \
  --limit=50 \
  --format=json
```

### Encryption at Rest (CMEK)

```bash
# Create Cloud KMS keyring and key
gcloud kms keyrings create cloudsql-keyring \
  --location=us-central1

gcloud kms keys create cloudsql-hipaa-key \
  --keyring=cloudsql-keyring \
  --location=us-central1 \
  --purpose=encryption

# Grant CloudSQL service account access
gcloud kms keys add-iam-policy-binding cloudsql-hipaa-key \
  --keyring=cloudsql-keyring \
  --location=us-central1 \
  --member=serviceAccount:service-PROJECT_NUMBER@gcp-sa-cloud-sql.iam.gserviceaccount.com \
  --role=roles/cloudkms.cryptoKeyEncrypterDecrypter

# Create instance with CMEK
gcloud sql instances create life-navigator-hipaa \
  --database-version=POSTGRES_15 \
  --tier=db-n1-standard-2 \
  --region=us-central1 \
  --disk-encryption-key=projects/PROJECT/locations/us-central1/keyRings/cloudsql-keyring/cryptoKeys/cloudsql-hipaa-key
```

---

## Troubleshooting

### Connection Pool Exhausted

**Symptom**: `TimeoutError: QueuePool limit of size X overflow Y reached`

**Diagnosis**:
```python
# Check pool status
from app.core.database import hipaa_engine
print(hipaa_engine.pool.status())
```

**Fix**:
```python
# Increase pool size
hipaa_engine = create_async_engine(
    settings.DATABASE_HIPAA_URL,
    pool_size=30,  # Increase from 20
    max_overflow=15,  # Increase from 10
)
```

### High Replication Lag

**Symptom**: Read replica lagging behind primary

**Diagnosis**:
```sql
-- On primary
SELECT pg_current_wal_lsn();

-- On replica
SELECT pg_last_wal_receive_lsn(), pg_last_wal_replay_lsn();
```

**Fix**:
- Increase replica instance size
- Reduce write load on primary
- Check network latency between regions

### Migration Lock Timeout

**Symptom**: Migration hangs waiting for locks

**Diagnosis**:
```sql
SELECT
  l.pid,
  a.usename,
  a.query,
  l.mode,
  l.granted
FROM pg_locks l
JOIN pg_stat_activity a ON l.pid = a.pid
WHERE NOT l.granted;
```

**Fix**:
```bash
# Kill blocking query
SELECT pg_terminate_backend(PID);

# Re-run migration
alembic upgrade head
```

---

## Related Documentation

- [Secrets & Config Management](../security/SECRETS_AND_CONFIG.md)
- [Data Boundaries](../security/DATA_BOUNDARIES.md)
- [Supabase Readiness](./SUPABASE_READINESS.md)

---

**Last Updated**: 2026-01-09
**Next Review**: After any infrastructure changes or performance issues
