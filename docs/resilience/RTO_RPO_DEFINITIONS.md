# RTO/RPO Definitions and Business Justification

**Rule: Every subsystem must have measured, achievable RTO/RPO targets based on business impact.**

---

## Executive Summary

| Subsystem | RTO | RPO | Business Impact of Outage | Annual Cost of Downtime (Estimated) |
|-----------|-----|-----|---------------------------|--------------------------------------|
| **API Backend** | 15 minutes | 5 minutes | CRITICAL: All user operations blocked | $2.5M (100 users × $25K ARR ÷ 365 × 24 hours × 4 users/min) |
| **Main Database (Supabase)** | 30 minutes | 5 minutes | CRITICAL: User data unavailable | $1.25M |
| **HIPAA Database** | 15 minutes | 1 minute | CRITICAL: HIPAA violation risk, PHI unavailable | $5M (includes regulatory penalties) |
| **Financial Database** | 30 minutes | 5 minutes | HIGH: Financial data unavailable | $500K |
| **GraphRAG Service** | 1 hour | 1 hour | MEDIUM: AI features degraded, app still functional | $100K |
| **Neo4j Knowledge Graph** | 2 hours | 1 hour | MEDIUM: Knowledge graph queries fail | $75K |
| **Qdrant Vector DB** | 2 hours | 1 hour | MEDIUM: Semantic search degraded | $50K |
| **Redis Cache** | 5 minutes | N/A | LOW: Performance degradation, not data loss | $25K (warm cache rebuild) |
| **Frontend (Next.js)** | 5 minutes | N/A | HIGH: User interface unavailable | $500K |
| **Authentication** | 10 minutes | 5 minutes | CRITICAL: No user can access system | $2M |

---

## Detailed Subsystem Analysis

### 1. API Backend (FastAPI)

**Current Architecture:**
- Kubernetes deployment with 2+ replicas
- Stateless application (all state in databases/cache)
- Rolling updates with zero-downtime deployment

**RTO: 15 minutes**

**Justification:**
- **Time to detect:** 2 minutes (Prometheus alerts)
- **Time to diagnose:** 3 minutes (Grafana dashboards + logs)
- **Time to mitigate:** 10 minutes (rollback deployment or scale new pods)
- **Acceptable business impact:** Users tolerate brief API unavailability during maintenance windows

**RPO: 5 minutes**

**Justification:**
- API is stateless; no data loss risk
- In-flight requests may fail but can be retried by client
- 5-minute RPO represents max time for transaction logs to flush to database

**Recovery Procedures:**

```bash
# Scenario 1: Pod crash loop
kubectl get pods -n life-navigator -l app=backend
kubectl logs -n life-navigator <pod-name> --tail=100
kubectl rollout undo deployment/backend -n life-navigator

# Scenario 2: Deployment failure
kubectl rollout status deployment/backend -n life-navigator
kubectl rollout history deployment/backend -n life-navigator
kubectl rollout undo deployment/backend -n life-navigator --to-revision=<GOOD_REVISION>

# Scenario 3: Complete cluster failure
# Deploy to standby GKE cluster (multi-region DR)
kubectl config use-context gke_lifenav-prod_us-east1_ln-dr-cluster
kubectl apply -k k8s/overlays/production
```

**Testing Requirements:**
- Monthly: Deliberate pod termination (kill random pod)
- Quarterly: Full deployment rollback drill
- Annually: Complete cluster failover test

---

### 2. Main Database (Supabase - PostgreSQL)

**Current Architecture:**
- Supabase hosted PostgreSQL
- Handles: Auth, Users, Career, Education, Goals, Relationships
- Backup: Daily automated backups (7-day retention)
- PITR: Enabled with 7-day transaction log retention

**RTO: 30 minutes**

**Justification:**
- **Time to detect:** 2 minutes (database health check failures)
- **Time to provision new instance:** 10 minutes (Supabase restore from backup)
- **Time to validate data integrity:** 8 minutes (sample queries + row counts)
- **Time to update connection strings:** 5 minutes (update ConfigMap + restart pods)
- **Time for DNS propagation:** 5 minutes (if using connection pooler)

**RPO: 5 minutes**

**Justification:**
- PITR enabled with continuous transaction log shipping
- Can recover to any point within last 7 days
- 5-minute RPO represents acceptable data loss for non-PHI data
- Trade-off: More frequent backups increase cost without proportional benefit

**Data Criticality Matrix:**

| Data Type | Records | Impact of Loss | Justification for 5-min RPO |
|-----------|---------|----------------|------------------------------|
| User profiles | ~1000 | HIGH | Profile changes are infrequent |
| Career goals | ~5000 | HIGH | Users expect to re-enter if necessary |
| Educational history | ~2000 | MEDIUM | Historical data, rarely modified |
| Session tokens | ~500 active | LOW | Users can re-authenticate |

**Recovery Procedures:**

```bash
# Scenario 1: Data corruption detected
# Step 1: Identify corruption timeline
psql $SUPABASE_URL -c "SELECT MAX(updated_at) FROM users;"
# If users table shows future dates or nulls → corruption

# Step 2: Initiate PITR (via Supabase Dashboard)
# Navigate to: Database > Backups > Point-in-Time Recovery
# Select time: 10 minutes before corruption detected
# Create recovery database: ln-main-db-recovery-$(date +%Y%m%d-%H%M)

# Step 3: Validate recovered data
psql $RECOVERY_DB_URL -c "SELECT COUNT(*) FROM users;"
psql $RECOVERY_DB_URL -c "SELECT MAX(updated_at) FROM users;"
# Compare with expected counts from monitoring

# Step 4: Switch to recovered database
# Update DATABASE_URL in k8s secrets
kubectl create secret generic backend-secrets \
  --from-literal=DATABASE_URL=$RECOVERY_DB_URL \
  --dry-run=client -o yaml | kubectl apply -f -

# Step 5: Restart backend pods
kubectl rollout restart deployment/backend -n life-navigator

# Step 6: Monitor for errors
kubectl logs -n life-navigator -l app=backend -f | grep ERROR
```

**Backup Verification Tests:**
- Weekly: Automated backup restoration to staging environment
- Monthly: Full data integrity validation (row counts, checksums)
- Quarterly: Disaster recovery drill with production data

---

### 3. HIPAA Database (Cloud SQL - PostgreSQL)

**Current Architecture:**
- Cloud SQL PostgreSQL 15 (db-custom-2-7680)
- Handles: Health conditions, medications, diagnoses, treatments, health records
- Backup: Daily automated backups (7-day retention)
- PITR: Enabled with 7-day transaction log retention
- Compliance: HIPAA BAA signed with Google Cloud

**RTO: 15 minutes**

**Justification:**
- **HIPAA requirement:** PHI must be recoverable within "reasonable timeframe"
- **Business impact:** Health data unavailability prevents care coordination
- **Regulatory risk:** Extended downtime may require breach notification
- **Time breakdown:**
  - Detection: 1 minute (critical alert for health DB)
  - Diagnosis: 4 minutes (runbook-guided investigation)
  - Restoration: 8 minutes (PITR to new instance)
  - Validation: 2 minutes (PHI integrity checks)

**RPO: 1 minute**

**Justification:**
- **HIPAA requirement:** PHI loss must be minimized
- **Patient safety:** Recent health records critical for care decisions
- **Continuous PITR:** Transaction logs streamed every 30 seconds
- **1-minute RPO means:** Maximum 1 minute of health record updates lost
- **Acceptable loss:** ~0.1 health records per incident (based on 6 updates/hour)

**Data Criticality Matrix:**

| Data Type | Records | Impact of Loss | Regulatory Requirement |
|-----------|---------|----------------|------------------------|
| Health conditions (current) | ~500 | CRITICAL | HIPAA - immediate access required |
| Medications (active) | ~800 | CRITICAL | Patient safety - drug interactions |
| Diagnoses | ~600 | HIGH | Clinical decision support |
| Treatment history | ~1500 | MEDIUM | Historical, less time-sensitive |
| Lab results | ~400 | HIGH | Trend analysis for care |

**Recovery Procedures:**

```bash
# Scenario 1: HIPAA Database Corruption (CRITICAL)
# This is a HIGH-PRIORITY incident - follow strictly

# Step 1: IMMEDIATE - Declare incident
# Notify: SRE Lead, Security Lead, Compliance Officer
# Start incident timer (for regulatory reporting)
INCIDENT_START_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "Incident started: $INCIDENT_START_TIME"

# Step 2: Identify last known good state (< 2 minutes)
gcloud sql operations list \
  --instance=ln-health-db-beta \
  --project=lifenav-prod \
  --filter="operationType=BACKUP" \
  --limit=10

# Step 3: Perform PITR to 5 minutes before corruption
TARGET_TIME="2025-12-14T10:25:00Z"  # Replace with actual time
gcloud sql backups create \
  --instance=ln-health-db-beta \
  --project=lifenav-prod \
  --description="Pre-recovery backup $(date +%Y%m%d-%H%M)"

gcloud sql instances clone ln-health-db-beta \
  ln-health-db-recovery-$(date +%Y%m%d-%H%M) \
  --point-in-time=$TARGET_TIME \
  --project=lifenav-prod

# Step 4: Validate PHI integrity (< 2 minutes)
# Connect to recovery instance
gcloud sql connect ln-health-db-recovery-$(date +%Y%m%d-%H%M) \
  --user=postgres \
  --project=lifenav-prod

# Run validation queries
psql -c "SELECT COUNT(*) FROM health_conditions WHERE deleted_at IS NULL;"
psql -c "SELECT COUNT(*) FROM medications WHERE status = 'active';"
psql -c "SELECT MAX(created_at), MAX(updated_at) FROM health_conditions;"

# Compare with expected values from monitoring
# Expected: ~500 active conditions, ~800 active medications

# Step 5: Switch connection string (< 5 minutes)
# Get connection string for recovery instance
gcloud sql instances describe ln-health-db-recovery-$(date +%Y%m%d-%H%M) \
  --project=lifenav-prod \
  --format="value(connectionName)"

# Update Kubernetes secret
kubectl create secret generic backend-secrets \
  --from-literal=DATABASE_HIPAA_URL="postgresql://..." \
  --dry-run=client -o yaml | kubectl apply -f -

# Step 6: Restart backend pods to pick up new connection
kubectl rollout restart deployment/backend -n life-navigator
kubectl rollout status deployment/backend -n life-navigator

# Step 7: Verify health data accessible
# Make test API call
curl -H "Authorization: Bearer $TEST_TOKEN" \
  https://api.lifenavigator.com/api/v1/health/conditions

# Step 8: Document incident (REQUIRED for HIPAA)
INCIDENT_END_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
echo "Incident resolved: $INCIDENT_END_TIME"
echo "PHI exposure duration: <calculate duration>"
echo "Records affected: <count from validation>"

# Create incident report: docs/incidents/YYYYMMDD-health-db-corruption.md
```

**Backup Verification Tests:**
- **Daily:** Automated restoration to isolated test environment with PHI validation
- **Weekly:** Full integrity check with row counts and checksum validation
- **Monthly:** Simulated PHI breach drill with compliance officer involvement
- **Quarterly:** Full disaster recovery exercise with regulatory reporting practice

**Compliance Requirements:**
- All PHI access during DR must be logged (audit trail)
- Restoration time must be documented for HIPAA reporting
- If RPO exceeded (> 1 minute loss), breach analysis required
- Annual DR test results must be provided to compliance auditors

---

### 4. Financial Database (Cloud SQL - PostgreSQL)

**Current Architecture:**
- Cloud SQL PostgreSQL 15 (db-custom-2-7680)
- Handles: Financial accounts, transactions, investments, tax documents, Plaid connections
- Backup: Daily automated backups (7-day retention)
- PITR: Enabled with 7-day transaction log retention
- Compliance: PCI-DSS Level 2 (for stored payment data)

**RTO: 30 minutes**

**Justification:**
- **Business impact:** Financial transactions blocked, budget tracking unavailable
- **Regulatory risk:** PCI-DSS requires "timely recovery" but no specific SLA
- **User tolerance:** Financial data queries are less frequent than PHI access
- **Time breakdown:**
  - Detection: 2 minutes
  - Diagnosis: 5 minutes
  - Restoration: 15 minutes (PITR + validation)
  - Connection update: 5 minutes
  - Warm-up period: 3 minutes (query cache rebuild)

**RPO: 5 minutes**

**Justification:**
- **Transaction frequency:** ~10 transactions/minute during peak
- **Acceptable loss:** Max 50 transactions (users can re-sync via Plaid)
- **Cost-benefit:** 1-minute RPO would require higher-tier Cloud SQL (4x cost)
- **Plaid sync:** Most financial data auto-syncs daily, so 5-min loss is recoverable

**Data Criticality Matrix:**

| Data Type | Records | Impact of Loss | Recovery Method |
|-----------|---------|----------------|-----------------|
| Account balances | ~2000 | HIGH | Re-sync via Plaid API |
| Recent transactions (< 1 day) | ~500 | HIGH | Re-sync via Plaid API |
| Historical transactions (> 30 days) | ~50,000 | MEDIUM | Restore from backup |
| Budget allocations | ~1000 | MEDIUM | User can re-enter |
| Investment portfolios | ~300 | HIGH | Re-sync via Plaid/broker API |
| Tax documents | ~200 | LOW | Rarely modified, backed up externally |

**Recovery Procedures:**

```bash
# Scenario 1: Financial Database Data Loss
# Step 1: Quantify data loss
LAST_GOOD_BACKUP=$(gcloud sql backups list \
  --instance=ln-finance-db-beta \
  --project=lifenav-prod \
  --limit=1 \
  --format="value(windowStartTime)")

echo "Last good backup: $LAST_GOOD_BACKUP"
echo "Current time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Potential data loss window: <calculate>"

# Step 2: Restore to point before data loss
TARGET_TIME="2025-12-14T10:20:00Z"
gcloud sql instances clone ln-finance-db-beta \
  ln-finance-db-recovery-$(date +%Y%m%d-%H%M) \
  --point-in-time=$TARGET_TIME \
  --project=lifenav-prod

# Step 3: Validate financial data integrity
gcloud sql connect ln-finance-db-recovery-$(date +%Y%m%d-%H%M) \
  --user=postgres \
  --project=lifenav-prod

# Validation queries
psql -c "SELECT COUNT(*) FROM financial_accounts WHERE deleted_at IS NULL;"
psql -c "SELECT COUNT(*) FROM transactions WHERE DATE(created_at) = CURRENT_DATE;"
psql -c "SELECT SUM(amount) FROM transactions WHERE created_at > NOW() - INTERVAL '1 hour';"

# Step 4: Trigger Plaid re-sync for recent data
# Call Plaid API to refresh transactions for all accounts
curl -X POST https://api.lifenavigator.com/api/v1/financial/sync-all \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Step 5: Switch to recovered database
# Update connection string and restart
kubectl create secret generic backend-secrets \
  --from-literal=DATABASE_FINANCIAL_URL="postgresql://..." \
  --dry-run=client -o yaml | kubectl apply -f -

kubectl rollout restart deployment/backend -n life-navigator

# Step 6: Verify financial API endpoints
curl -H "Authorization: Bearer $TEST_TOKEN" \
  https://api.lifenavigator.com/api/v1/financial/accounts

# Step 7: Notify affected users (if data loss > 1 hour)
# Send email: "We experienced a technical issue and are re-syncing your financial data"
```

**Backup Verification Tests:**
- **Weekly:** Restore to staging and validate account balances
- **Monthly:** Full Plaid re-sync drill
- **Quarterly:** PCI-DSS compliance validation (backup encryption, access logs)

---

### 5. GraphRAG Service (Rust gRPC)

**Current Architecture:**
- External Rust service combining Neo4j, GraphDB, and Qdrant
- Stateless application logic (all state in underlying databases)
- Deployed as Cloud Run service with autoscaling

**RTO: 1 hour**

**Justification:**
- **Business impact:** AI-powered features unavailable, but core app remains functional
- **User tolerance:** Knowledge graph queries are "nice to have" not critical path
- **Degraded mode:** Application can operate without GraphRAG (caching layer handles recent queries)
- **Time breakdown:**
  - Detection: 5 minutes (users report AI features not working)
  - Diagnosis: 15 minutes (check Neo4j, GraphDB, Qdrant health)
  - Restoration: 30 minutes (restore slowest component)
  - Warm-up: 10 minutes (rebuild query cache)

**RPO: 1 hour**

**Justification:**
- **Graph data updates:** Knowledge graph updated every 30 minutes via background jobs
- **Vector embeddings:** Qdrant embeddings generated async, not real-time
- **Acceptable loss:** 1 hour of graph updates can be replayed from source data
- **Recovery method:** Re-run embedding pipeline on missed data

**Recovery Procedures:**

```bash
# Scenario 1: GraphRAG Service Unavailable
# Step 1: Check component health
curl https://graphrag.lifenavigator.com/health
# If 503, check individual components:

# Neo4j health
curl https://neo4j.lifenavigator.com/db/neo4j/tx/commit \
  -H "Authorization: Basic $NEO4J_AUTH"

# Qdrant health
curl https://qdrant.lifenavigator.com/health

# Step 2: Restart GraphRAG service
gcloud run services update graphrag-service \
  --region=us-central1 \
  --project=lifenav-prod \
  --revision-suffix=$(date +%Y%m%d-%H%M) \
  --no-traffic  # Deploy without traffic for testing

# Test new revision
gcloud run services update-traffic graphrag-service \
  --to-revisions=graphrag-service-$(date +%Y%m%d-%H%M)=10 \
  --region=us-central1

# If healthy, migrate 100% traffic
gcloud run services update-traffic graphrag-service \
  --to-latest \
  --region=us-central1

# Step 3: Verify GraphRAG queries work
curl -X POST https://api.lifenavigator.com/api/v1/graphrag/query \
  -H "Authorization: Bearer $TEST_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "What are my career goals?", "max_results": 5}'

# Step 4: If data loss suspected, replay embedding pipeline
# This regenerates any missing vector embeddings
kubectl create job graphrag-replay-$(date +%Y%m%d-%H%M) \
  --from=cronjob/graphrag-embedding-pipeline \
  -n life-navigator
```

**Backup Verification Tests:**
- **Monthly:** Verify Neo4j, GraphDB, Qdrant backups are restorable
- **Quarterly:** Full GraphRAG stack recovery drill

---

### 6. Redis Cache (Memorystore)

**Current Architecture:**
- GCP Memorystore Redis (2 instances: 1GB basic + 2GB HA)
- Handles: Session tokens, rate limits, query cache, token blacklist
- No persistence required (warm cache from databases on startup)

**RTO: 5 minutes**

**Justification:**
- **Business impact:** Performance degradation (cache misses), NOT data loss
- **Fail-safe design:** Application handles Redis unavailability gracefully
- **Time breakdown:**
  - Detection: 1 minute (Redis connection errors spike)
  - Mitigation: 2 minutes (Redis auto-failover for HA instance)
  - Warm-up: 2 minutes (cache rebuilds from database queries)

**RPO: N/A (No data loss)**

**Justification:**
- Redis is ephemeral cache, not source of truth
- All cached data is reconstructible from databases
- Token blacklist: Fail-secure (assumes blacklisted on Redis failure)

**Recovery Procedures:**

```bash
# Scenario 1: Redis Instance Failure
# Step 1: Check Redis health
redis-cli -h $REDIS_HOST -p 6379 ping
# If no response, check Memorystore status:

gcloud redis instances describe redis-cache-ha \
  --region=us-central1 \
  --project=lifenav-prod

# Step 2: If HA instance failed over, verify:
gcloud redis instances describe redis-cache-ha \
  --region=us-central1 \
  --format="value(state,currentLocationId)"
# Should show: READY, <failover-zone>

# Step 3: Monitor cache hit rate recovery
# Cache will warm up naturally as requests arrive
# Target: 70% hit rate within 5 minutes

# Step 4: If complete Redis loss, restart with new instance
# Application will create new cache entries automatically
# No manual intervention required
```

**Backup Verification Tests:**
- **Monthly:** Deliberate Redis instance termination (verify fail-secure behavior)
- **Quarterly:** Test application behavior with Redis completely unavailable

---

## Summary: RTO/RPO Decision Matrix

### Priority 1: CRITICAL (RTO < 30 min, RPO < 5 min)
- ✅ API Backend (RTO: 15min, RPO: 5min)
- ✅ HIPAA Database (RTO: 15min, RPO: 1min)
- ✅ Authentication (RTO: 10min, RPO: 5min)

**Justification:** User-facing systems with regulatory requirements.

### Priority 2: HIGH (RTO < 1 hour, RPO < 15 min)
- ✅ Main Database (RTO: 30min, RPO: 5min)
- ✅ Financial Database (RTO: 30min, RPO: 5min)
- ✅ Frontend (RTO: 5min, RPO: N/A)

**Justification:** Essential functionality but users tolerate brief disruption.

### Priority 3: MEDIUM (RTO < 4 hours, RPO < 1 hour)
- ✅ GraphRAG Service (RTO: 1hr, RPO: 1hr)
- ✅ Neo4j Knowledge Graph (RTO: 2hr, RPO: 1hr)
- ✅ Qdrant Vector DB (RTO: 2hr, RPO: 1hr)

**Justification:** AI features enhance experience but aren't critical for core workflows.

### Priority 4: LOW (RTO < 24 hours, RPO < 24 hours)
- ✅ Redis Cache (RTO: 5min, RPO: N/A)
- ✅ Monitoring/Observability (RTO: 1hr, RPO: N/A)

**Justification:** Performance optimization, not data systems.

---

## Validation and Testing

### Weekly
- ✅ Automated backup restoration for all databases
- ✅ Data integrity validation (row counts, checksums)

### Monthly
- ✅ Chaos testing: Random pod termination
- ✅ Simulated database corruption with PITR recovery
- ✅ Redis failover testing

### Quarterly
- ✅ Full disaster recovery drill (all systems)
- ✅ HIPAA compliance audit with regulatory reporting
- ✅ Multi-region failover test (if applicable)

### Annually
- ✅ Complete data center failure simulation
- ✅ Backup restore validation with production data in staging
- ✅ RTO/RPO review and adjustment based on business growth

---

## Cost-Benefit Analysis

| Investment | Annual Cost | RTO/RPO Improvement | ROI |
|------------|-------------|---------------------|-----|
| **HIPAA DB HA (Regional)** | $12,000 | RTO: 15min → 5min, RPO: 1min → 30sec | HIGH (regulatory compliance) |
| **Multi-region GKE cluster** | $50,000 | RTO: 15min → 2min (auto-failover) | MEDIUM (improved uptime) |
| **Continuous backup (vs daily)** | $3,600 | RPO: 5min → 1min | LOW (marginal improvement) |
| **GraphRAG HA deployment** | $8,000 | RTO: 1hr → 15min | LOW (non-critical feature) |

**Recommendation:** Prioritize HIPAA DB HA for regulatory compliance. Multi-region GKE only after user base reaches 10,000+ (higher uptime justification).

---

**Last Updated:** 2026-01-09
**Next Review:** 2026-04-09 (Quarterly)
