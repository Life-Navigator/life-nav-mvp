# Life Navigator - Operational Runbook

**Version:** 1.0.0
**Last Updated:** 2025-01-09
**Owner:** Platform Team

## Table of Contents

1. [Overview](#overview)
2. [Service Architecture](#service-architecture)
3. [Common Operations](#common-operations)
4. [Health Checks & Monitoring](#health-checks--monitoring)
5. [Incident Response](#incident-response)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Performance Tuning](#performance-tuning)
8. [Disaster Recovery](#disaster-recovery)
9. [Maintenance Windows](#maintenance-windows)
10. [Escalation Procedures](#escalation-procedures)

---

## Overview

This runbook provides operational procedures for the Life Navigator platform running on Google Kubernetes Engine (GKE). The platform consists of 4 microservices, 5 databases, and supporting infrastructure.

### Architecture Summary

- **Cluster:** GKE Standard with GPU nodes (NVIDIA T4)
- **Services:** 4 microservices (Backend, Finance API, Agents, MCP Server)
- **Databases:** PostgreSQL, Redis, Neo4j, Qdrant, GraphDB
- **Monitoring:** Prometheus + Grafana
- **Logging:** Cloud Logging (GCP)
- **Alerting:** Alertmanager + PagerDuty

---

## Service Architecture

### Core Services

#### 1. Backend API (Port 8000)
- **Purpose:** Main API for all 6 domains (users, goals, health, finance, career, education)
- **Resources:** 500m-2000m CPU, 1-4Gi RAM
- **Autoscaling:** 2-10 replicas based on CPU (70%)
- **Dependencies:** PostgreSQL, Redis, Maverick LLM
- **Health Check:** `GET /health`

#### 2. Finance API (Port 8001)
- **Purpose:** Financial planning and document OCR processing
- **Resources:** 2-4 CPU, 4-8Gi RAM, 1x NVIDIA T4 GPU
- **Autoscaling:** 2-10 replicas based on CPU (70%)
- **Dependencies:** PostgreSQL, Redis, OCR models (PaddleOCR, DeepSeek)
- **Health Check:** `GET /health`

#### 3. Agents Service (Port 8080)
- **Purpose:** Multi-agent system for all life domains
- **Resources:** 2-4 CPU, 8-16Gi RAM, 1x NVIDIA T4 GPU
- **Autoscaling:** 2-8 replicas based on CPU/memory (70%/80%)
- **Dependencies:** PostgreSQL, Redis, Neo4j, Qdrant, GraphDB, GraphRAG
- **Health Check:** `GET /health`

#### 4. MCP Server (Port 8090)
- **Purpose:** Model Context Protocol server for agent tools and context
- **Resources:** 1-2 CPU, 2-4Gi RAM
- **Autoscaling:** 2-6 replicas based on CPU/memory (70%/80%)
- **Dependencies:** PostgreSQL, Redis, Neo4j, Qdrant, GraphDB
- **Health Check:** `GET /health`

### Supporting Services

#### PostgreSQL (Port 5432)
- **Purpose:** Primary relational database
- **Version:** 15.x
- **Replication:** Primary + 1 read replica
- **Backup:** Daily automated backups (7-day retention)
- **Monitoring:** Connection count, query performance, replication lag

#### Redis (Port 6379)
- **Purpose:** Caching, session management, pub/sub
- **Version:** 7.0.x
- **Mode:** Standalone (development) / Sentinel (production)
- **Persistence:** RDB + AOF
- **Monitoring:** Memory usage, hit rate, eviction rate

#### Neo4j (Port 7687)
- **Purpose:** Knowledge graph for relationships and entities
- **Version:** 5.x
- **Deployment:** Single instance (development) / Cluster (production)
- **Backup:** Daily graph backups
- **Monitoring:** Heap usage, query performance, transaction rate

#### Qdrant (Port 6333)
- **Purpose:** Vector database for embeddings and semantic search
- **Version:** Latest
- **Resources:** 2 CPU, 4Gi RAM
- **Storage:** 100Gi persistent volume
- **Monitoring:** Index size, query latency, memory usage

#### GraphDB (Port 7200)
- **Purpose:** RDF triplestore for ontologies and semantic data
- **Version:** 10.x
- **Resources:** 2 CPU, 4Gi RAM
- **Storage:** 50Gi persistent volume
- **Monitoring:** Query performance, repository size

---

## Common Operations

### Scaling Services

#### Manual Scaling

```bash
# Scale Backend API to 5 replicas
kubectl scale deployment backend --replicas=5 -n life-navigator

# Scale Finance API to 3 replicas
kubectl scale deployment finance-api --replicas=3 -n life-navigator

# Scale Agents Service to 4 replicas
kubectl scale deployment agents --replicas=4 -n life-navigator

# Scale MCP Server to 3 replicas
kubectl scale deployment mcp-server --replicas=3 -n life-navigator
```

#### Update Autoscaling

```bash
# Update HPA target CPU to 80%
kubectl patch hpa backend-hpa -n life-navigator -p '{"spec":{"metrics":[{"type":"Resource","resource":{"name":"cpu","target":{"type":"Utilization","averageUtilization":80}}}]}}'

# Update max replicas to 15
kubectl patch hpa backend-hpa -n life-navigator -p '{"spec":{"maxReplicas":15}}'
```

### Viewing Logs

```bash
# Backend API logs
kubectl logs -f deployment/backend -n life-navigator

# Finance API logs (last 100 lines)
kubectl logs --tail=100 deployment/finance-api -n life-navigator

# Agents Service logs (all replicas)
kubectl logs -l app=agents -n life-navigator --all-containers=true

# MCP Server logs (specific pod)
kubectl logs mcp-server-<pod-id> -n life-navigator

# Follow logs from all Finance API pods
kubectl logs -f -l app=finance-api -n life-navigator --all-containers=true
```

### Restarting Services

```bash
# Rolling restart (zero downtime)
kubectl rollout restart deployment/backend -n life-navigator
kubectl rollout restart deployment/finance-api -n life-navigator
kubectl rollout restart deployment/agents -n life-navigator
kubectl rollout restart deployment/mcp-server -n life-navigator

# Check rollout status
kubectl rollout status deployment/backend -n life-navigator

# Rollback if issues detected
kubectl rollout undo deployment/backend -n life-navigator
```

### Database Operations

#### PostgreSQL Backup

```bash
# Manual backup
kubectl exec -it postgres-0 -n life-navigator -- \
  pg_dump -U lifenavigator -d lifenavigator > backup-$(date +%Y%m%d).sql

# Restore from backup
kubectl exec -i postgres-0 -n life-navigator -- \
  psql -U lifenavigator -d lifenavigator < backup-20250109.sql
```

#### Redis Operations

```bash
# Connect to Redis CLI
kubectl exec -it redis-0 -n life-navigator -- redis-cli

# Check memory usage
kubectl exec -it redis-0 -n life-navigator -- redis-cli INFO memory

# Clear specific cache
kubectl exec -it redis-0 -n life-navigator -- redis-cli KEYS "cache:*" | xargs redis-cli DEL

# Force BGSAVE
kubectl exec -it redis-0 -n life-navigator -- redis-cli BGSAVE
```

#### Neo4j Operations

```bash
# Connect to Neo4j Cypher shell
kubectl exec -it neo4j-0 -n life-navigator -- cypher-shell -u neo4j -p <password>

# Backup Neo4j database
kubectl exec -it neo4j-0 -n life-navigator -- \
  neo4j-admin dump --database=neo4j --to=/backups/neo4j-$(date +%Y%m%d).dump

# Check database size
kubectl exec -it neo4j-0 -n life-navigator -- \
  neo4j-admin report --database=neo4j
```

### Certificate Management

```bash
# Check certificate status
kubectl get managedcertificate life-navigator-cert -n life-navigator -o yaml

# Force certificate renewal (if expired)
kubectl delete managedcertificate life-navigator-cert -n life-navigator
kubectl apply -f k8s/shared/ingress.yaml

# Check certificate provisioning status
gcloud compute ssl-certificates list --project=<project-id>
```

---

## Health Checks & Monitoring

### Service Health Endpoints

All services expose standard health check endpoints:

```bash
# Backend API
curl https://api.life-navigator.app/health
# Expected: {"status":"healthy","service":"backend","version":"1.0.0"}

# Finance API
curl https://api.life-navigator.app/api/finance/health
# Expected: {"status":"healthy","service":"finance-api","version":"1.0.0"}

# Agents Service
curl https://api.life-navigator.app/api/agents/health
# Expected: {"status":"healthy","service":"agents","version":"1.0.0"}

# MCP Server
curl https://api.life-navigator.app/api/mcp/health
# Expected: {"status":"healthy","service":"mcp-server","version":"1.0.0"}
```

### Kubernetes Probes

#### Liveness Probe
Checks if the service is running. If it fails, Kubernetes restarts the pod.

```bash
# Check liveness probe status
kubectl get pods -n life-navigator -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.status.conditions[?(@.type=="Ready")].status}{"\n"}{end}'
```

#### Readiness Probe
Checks if the service is ready to accept traffic. If it fails, pod is removed from service.

```bash
# Check readiness probe status
kubectl describe pod <pod-name> -n life-navigator | grep Readiness
```

### Prometheus Metrics

All services expose metrics at `/metrics`:

```bash
# View Backend metrics
curl https://api.life-navigator.app/metrics

# Key metrics to monitor:
# - http_requests_total - Total HTTP requests
# - http_request_duration_seconds - Request latency
# - process_cpu_seconds_total - CPU usage
# - process_resident_memory_bytes - Memory usage
# - db_connection_pool_size - Database connections
```

### Grafana Dashboards

Access Grafana: `https://grafana.life-navigator.app`

**Key Dashboards:**
1. **Service Overview** - All services health and performance
2. **Database Performance** - PostgreSQL, Redis, Neo4j metrics
3. **GPU Utilization** - Finance API and Agents GPU usage
4. **Error Rates** - 4xx and 5xx errors across all services
5. **Latency** - P50, P95, P99 response times

---

## Incident Response

### Severity Levels

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| **P0 - Critical** | Complete service outage | 15 minutes | All services down, database unavailable |
| **P1 - High** | Major functionality impaired | 1 hour | Single service down, high error rates (>10%) |
| **P2 - Medium** | Degraded performance | 4 hours | Slow responses, minor feature unavailable |
| **P3 - Low** | Minor issues | Next business day | Cosmetic issues, non-critical bugs |

### Incident Response Workflow

1. **Detection** → Alert received via PagerDuty or monitoring dashboard
2. **Acknowledge** → On-call engineer acknowledges alert within SLA
3. **Assess** → Determine severity and scope of impact
4. **Communicate** → Update status page, notify stakeholders
5. **Mitigate** → Take immediate action to restore service
6. **Resolve** → Implement permanent fix
7. **Post-Mortem** → Document incident and preventive measures

### Emergency Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-Call Engineer | PagerDuty | Primary |
| Platform Lead | [email/phone] | Secondary |
| CTO | [email/phone] | Critical (P0 only) |
| GCP Support | support.google.com | Infrastructure issues |

---

## Troubleshooting Guide

### Common Issues

#### 1. Service Pod Crashing (CrashLoopBackOff)

**Symptoms:**
```bash
$ kubectl get pods -n life-navigator
NAME                          READY   STATUS             RESTARTS
backend-5d4f8c9b7d-abc12      0/1     CrashLoopBackOff   5
```

**Diagnosis:**
```bash
# Check pod logs
kubectl logs backend-5d4f8c9b7d-abc12 -n life-navigator --previous

# Check pod events
kubectl describe pod backend-5d4f8c9b7d-abc12 -n life-navigator

# Common causes:
# - Database connection failure
# - Missing environment variables
# - Invalid configuration
# - OOM (out of memory)
```

**Resolution:**
```bash
# Fix 1: Check database connectivity
kubectl exec -it postgres-0 -n life-navigator -- psql -U lifenavigator -d lifenavigator -c "SELECT 1"

# Fix 2: Verify secrets
kubectl get secret backend-secrets -n life-navigator -o yaml

# Fix 3: Increase memory limits
kubectl patch deployment backend -n life-navigator -p '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"8Gi"}}}]}}}}'

# Fix 4: Check recent changes
kubectl rollout history deployment/backend -n life-navigator
kubectl rollout undo deployment/backend -n life-navigator
```

#### 2. High Error Rates (5xx Errors)

**Symptoms:**
- Grafana dashboard shows >5% 5xx errors
- Alert: "High error rate detected"

**Diagnosis:**
```bash
# Check application logs
kubectl logs -l app=backend -n life-navigator --tail=200 | grep ERROR

# Check database connections
kubectl exec -it postgres-0 -n life-navigator -- \
  psql -U lifenavigator -d lifenavigator -c "SELECT count(*) FROM pg_stat_activity"

# Check Redis memory
kubectl exec -it redis-0 -n life-navigator -- redis-cli INFO memory | grep used_memory_human
```

**Resolution:**
```bash
# Fix 1: Scale up if under high load
kubectl scale deployment backend --replicas=10 -n life-navigator

# Fix 2: Restart service if memory leak suspected
kubectl rollout restart deployment/backend -n life-navigator

# Fix 3: Clear Redis cache if stale data
kubectl exec -it redis-0 -n life-navigator -- redis-cli FLUSHDB

# Fix 4: Check database slow queries
kubectl exec -it postgres-0 -n life-navigator -- \
  psql -U lifenavigator -d lifenavigator -c "SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state = 'active' ORDER BY duration DESC LIMIT 10"
```

#### 3. GPU Not Available (Finance API / Agents)

**Symptoms:**
- Finance API OCR requests failing
- Error: "CUDA not available" or "No GPU detected"

**Diagnosis:**
```bash
# Check GPU node exists
kubectl get nodes -l cloud.google.com/gke-nodepool=gpu-t4-pool

# Check GPU resources available
kubectl describe node <gpu-node-name> | grep nvidia.com/gpu

# Check pod GPU allocation
kubectl describe pod finance-api-<pod-id> -n life-navigator | grep nvidia.com/gpu
```

**Resolution:**
```bash
# Fix 1: Verify GPU drivers installed
kubectl get daemonset nvidia-gpu-device-plugin -n kube-system

# Fix 2: Check node pool has GPU
gcloud container node-pools describe gpu-t4-pool \
  --cluster=life-navigator-cluster \
  --region=us-central1

# Fix 3: Recreate pod to get GPU allocation
kubectl delete pod finance-api-<pod-id> -n life-navigator

# Fix 4: Scale GPU node pool if all GPUs allocated
gcloud container clusters resize life-navigator-cluster \
  --node-pool=gpu-t4-pool \
  --num-nodes=3 \
  --region=us-central1
```

#### 4. Database Connection Pool Exhausted

**Symptoms:**
- Errors: "connection pool exhausted" or "too many connections"
- Slow database queries

**Diagnosis:**
```bash
# Check active connections
kubectl exec -it postgres-0 -n life-navigator -- \
  psql -U lifenavigator -d lifenavigator -c "SELECT count(*) FROM pg_stat_activity"

# Check max connections limit
kubectl exec -it postgres-0 -n life-navigator -- \
  psql -U lifenavigator -d lifenavigator -c "SHOW max_connections"

# Identify connection source
kubectl exec -it postgres-0 -n life-navigator -- \
  psql -U lifenavigator -d lifenavigator -c "SELECT application_name, count(*) FROM pg_stat_activity GROUP BY application_name"
```

**Resolution:**
```bash
# Fix 1: Increase max_connections (PostgreSQL)
kubectl exec -it postgres-0 -n life-navigator -- \
  psql -U lifenavigator -d lifenavigator -c "ALTER SYSTEM SET max_connections = 200"
kubectl exec -it postgres-0 -n life-navigator -- pg_ctl reload

# Fix 2: Increase connection pool size (application)
# Edit ConfigMap and restart
kubectl edit configmap backend-config -n life-navigator
# Set DB_POOL_SIZE=20, DB_MAX_OVERFLOW=10
kubectl rollout restart deployment/backend -n life-navigator

# Fix 3: Kill idle connections
kubectl exec -it postgres-0 -n life-navigator -- \
  psql -U lifenavigator -d lifenavigator -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle' AND query_start < now() - interval '10 minutes'"
```

#### 5. Ingress / Load Balancer Issues

**Symptoms:**
- 502 Bad Gateway errors
- Connection timeouts
- SSL certificate errors

**Diagnosis:**
```bash
# Check Ingress status
kubectl get ingress life-navigator -n life-navigator -o yaml

# Check backend service health
kubectl get endpoints -n life-navigator

# Check GCP Load Balancer
gcloud compute forwarding-rules list
gcloud compute backend-services list

# Check certificate status
kubectl get managedcertificate -n life-navigator
```

**Resolution:**
```bash
# Fix 1: Verify backends are healthy
kubectl get pods -n life-navigator -l app=backend -o wide

# Fix 2: Check service selector matches pods
kubectl get service backend -n life-navigator -o yaml | grep selector
kubectl get pods -l app=backend -n life-navigator --show-labels

# Fix 3: Recreate Ingress if misconfigured
kubectl delete ingress life-navigator -n life-navigator
kubectl apply -f k8s/shared/ingress.yaml

# Fix 4: Force certificate renewal
kubectl annotate managedcertificate life-navigator-cert -n life-navigator "cert-renew=true" --overwrite
```

#### 6. High Memory Usage / OOMKilled

**Symptoms:**
- Pods showing "OOMKilled" status
- Frequent pod restarts

**Diagnosis:**
```bash
# Check pod memory usage
kubectl top pods -n life-navigator

# Check memory limits
kubectl describe pod <pod-name> -n life-navigator | grep -A 5 "Limits"

# Check node memory
kubectl top nodes

# View OOMKill events
kubectl get events -n life-navigator --field-selector reason=OOMKilling
```

**Resolution:**
```bash
# Fix 1: Increase memory limits
kubectl patch deployment finance-api -n life-navigator -p '{"spec":{"template":{"spec":{"containers":[{"name":"finance-api","resources":{"limits":{"memory":"16Gi"}}}]}}}}'

# Fix 2: Add memory requests to trigger autoscaling
kubectl patch deployment finance-api -n life-navigator -p '{"spec":{"template":{"spec":{"containers":[{"name":"finance-api","resources":{"requests":{"memory":"8Gi"}}}]}}}}'

# Fix 3: Scale horizontally instead of vertically
kubectl scale deployment finance-api --replicas=5 -n life-navigator

# Fix 4: Investigate memory leaks
kubectl exec -it finance-api-<pod-id> -n life-navigator -- python -m memory_profiler
```

---

## Performance Tuning

### Database Optimization

#### PostgreSQL

```sql
-- Analyze slow queries
SELECT query, calls, total_time, mean_time, max_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;

-- Create missing indexes
CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY idx_goals_user_id ON goals(user_id);

-- Vacuum and analyze
VACUUM ANALYZE;

-- Update statistics
ANALYZE VERBOSE;
```

#### Redis

```bash
# Check memory fragmentation
redis-cli INFO memory | grep mem_fragmentation_ratio

# Defragment if ratio > 1.5
redis-cli MEMORY PURGE

# Adjust maxmemory policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru
redis-cli CONFIG SET maxmemory 4gb
```

### Application Optimization

#### Increase Worker Processes

```yaml
# For CPU-bound workloads
spec:
  template:
    spec:
      containers:
      - name: backend
        env:
        - name: WORKERS
          value: "4"  # 2x CPU cores
```

#### Enable HTTP/2

```yaml
# In Ingress annotations
metadata:
  annotations:
    cloud.google.com/neg: '{"ingress": true}'
    networking.gke.io/http2: "true"
```

#### Connection Pooling

```python
# Optimize database pool
DB_POOL_SIZE = 20  # Min connections
DB_MAX_OVERFLOW = 10  # Additional connections
DB_POOL_TIMEOUT = 30  # Seconds
DB_POOL_RECYCLE = 3600  # Recycle every hour
```

---

## Disaster Recovery

### Backup Strategy

#### PostgreSQL
- **Frequency:** Daily at 02:00 UTC
- **Retention:** 7 days (rolling), 4 weekly, 12 monthly
- **Location:** GCS bucket `gs://life-navigator-backups/postgres/`
- **Recovery Time Objective (RTO):** 1 hour
- **Recovery Point Objective (RPO):** 24 hours

#### Neo4j
- **Frequency:** Daily at 03:00 UTC
- **Retention:** 7 days
- **Location:** GCS bucket `gs://life-navigator-backups/neo4j/`
- **RTO:** 2 hours
- **RPO:** 24 hours

#### Qdrant
- **Frequency:** Weekly on Sundays
- **Retention:** 4 weeks
- **Location:** GCS bucket `gs://life-navigator-backups/qdrant/`
- **RTO:** 4 hours
- **RPO:** 7 days

### Disaster Recovery Procedures

#### Complete Cluster Failure

1. **Create new GKE cluster:**
```bash
terraform apply -target=module.gke_cluster -var="env=dr"
```

2. **Restore databases:**
```bash
# PostgreSQL
gsutil cp gs://life-navigator-backups/postgres/latest.sql .
kubectl exec -i postgres-0 -n life-navigator -- psql -U lifenavigator < latest.sql

# Neo4j
gsutil cp gs://life-navigator-backups/neo4j/latest.dump .
kubectl exec -i neo4j-0 -n life-navigator -- neo4j-admin load --from=/tmp/latest.dump

# Qdrant (snapshots)
gsutil -m rsync -r gs://life-navigator-backups/qdrant/latest/ /var/lib/qdrant/storage/
```

3. **Deploy services:**
```bash
kubectl apply -k k8s/overlays/production/
```

4. **Verify health:**
```bash
kubectl get pods -n life-navigator
curl https://api.life-navigator.app/health
```

#### Regional Outage

1. **Switch to DR region:**
```bash
gcloud container clusters get-credentials life-navigator-dr-cluster --region=us-east1
```

2. **Update DNS to point to DR load balancer:**
```bash
gcloud dns record-sets transaction start --zone=life-navigator-zone
gcloud dns record-sets transaction add <DR_IP> --name=api.life-navigator.app --ttl=60 --type=A --zone=life-navigator-zone
gcloud dns record-sets transaction execute --zone=life-navigator-zone
```

---

## Maintenance Windows

### Scheduled Maintenance

**Window:** Sundays 02:00-06:00 UTC
**Frequency:** Bi-weekly
**Notification:** 72 hours advance notice

### Pre-Maintenance Checklist

- [ ] Notify users via status page
- [ ] Create database backups
- [ ] Scale up services to handle potential issues
- [ ] Verify rollback procedures
- [ ] Update runbook with any new procedures

### Post-Maintenance Checklist

- [ ] Verify all services healthy
- [ ] Check metrics for anomalies
- [ ] Monitor error rates for 2 hours
- [ ] Update status page (maintenance complete)
- [ ] Document any issues encountered

---

## Escalation Procedures

### Level 1: On-Call Engineer
- **Scope:** Handle P2/P3 incidents
- **Response:** Within 1 hour
- **Actions:** Investigate, mitigate, escalate if needed

### Level 2: Platform Lead
- **Scope:** P1 incidents, complex P2 issues
- **Response:** Within 30 minutes
- **Actions:** Coordinate response, make architecture decisions

### Level 3: CTO
- **Scope:** P0 incidents only
- **Response:** Immediate
- **Actions:** Business decisions, external communication

### External Escalation

- **GCP Support:** For infrastructure issues (open ticket via console)
- **Anthropic Support:** For Claude API issues (support@anthropic.com)
- **Database Vendor:** For critical database bugs

---

## Appendix

### Useful Commands Cheat Sheet

```bash
# Quick pod restart
kubectl delete pod <pod-name> -n life-navigator

# Port forward for debugging
kubectl port-forward svc/backend 8000:8000 -n life-navigator

# Copy files from pod
kubectl cp life-navigator/<pod-name>:/app/logs/error.log ./error.log

# Execute command in all pods
kubectl exec -it deployment/backend -n life-navigator -- env | grep DATABASE

# Watch pod status
watch kubectl get pods -n life-navigator

# Get pod resource usage
kubectl top pods -n life-navigator --containers

# Describe all resources
kubectl get all -n life-navigator

# View ConfigMap
kubectl get configmap backend-config -n life-navigator -o yaml

# Edit Secret
kubectl edit secret backend-secrets -n life-navigator
```

### Monitoring Queries

**Prometheus:**
```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# Latency P95
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# CPU usage
rate(process_cpu_seconds_total[5m])

# Memory usage
process_resident_memory_bytes / 1024 / 1024  # MB
```

---

**Document Revision History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2025-01-09 | Claude Code | Initial creation |

**Next Review:** 2025-02-09
