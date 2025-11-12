# GPU Infrastructure Deployment Guide
## Life Navigator - GCP with NVIDIA T4 GPUs

**Date:** 2025-11-12
**Status:** Ready for Deployment
**Architecture:** Hybrid (Vercel Frontend + GCP Backend with GPU)

---

## Executive Summary

This guide documents the configuration of NVIDIA T4 GPU support for the Life Navigator platform. All critical security issues have been resolved, and the infrastructure is now configured to run:

- **Frontend**: Next.js on Vercel ($20/month)
- **Backend API**: FastAPI on GKE with standard nodes
- **Finance API**: Python with OCR on GPU T4 nodes (NVIDIA Tesla T4)
- **Agents Service**: Multi-agent AI system on GPU T4 nodes (NVIDIA Tesla T4)
- **Mobile**: React Native for iOS/Android

**Estimated Monthly Cost**: $420-850/month (GCP only) + $20/month (Vercel)

---

## Changes Implemented

### 1. GKE Cluster Configuration ✅ COMPLETED

**File Modified**: `terraform/gcp/environments/dev/main.tf:369-385`

**Change**: Switched from Autopilot cluster to GPU-enabled cluster

**Before:**
```terraform
module "gke_cluster" {
  source = "../../modules/gke-cluster"  # Autopilot, no GPU support

  enable_autopilot = true
  enable_private_cluster = false
  enable_private_nodes = true
  # ... other Autopilot configs
}
```

**After:**
```terraform
module "gke_cluster" {
  source = "../../modules/gke-gpu-cluster"  # GPU-enabled Standard cluster

  project_id = var.project_id
  region     = var.region
  env        = "dev"

  cluster_name = "life-navigator-gpu"
  network      = module.vpc.network_name
  subnetwork   = module.vpc.subnet_names["private-subnet"]

  labels = {
    environment = "dev"
    managed_by  = "terraform"
    cost_center = "development"
  }
}
```

**Impact**:
- Enables NVIDIA T4 GPU support
- Creates 3 node pools: CPU, GPU T4, High-Memory
- Automatic GPU driver installation
- Cluster must be recreated (destructive change)

---

### 2. VPC Firewall Rules ✅ COMPLETED

**File Modified**: `terraform/gcp/modules/vpc/main.tf:98-175`

**Change**: Restricted overly permissive firewall rules from ALL TCP ports to specific services only

**Security Issue**: Allowed ports 0-65535 (ALL TCP PORTS!)

**Fix Applied**: Specific port allowances only:
- 8000, 8001, 8080, 8090 (Application APIs)
- 5432 (PostgreSQL)
- 6379 (Redis)
- 7687, 7474 (Neo4j)
- 6333, 6334 (Qdrant)
- 7200 (GraphDB)
- 50051 (GraphRAG gRPC)
- 443 (HTTPS)
- 53/UDP (DNS)
- 15021 (Istio health checks)

**Added**: Firewall logging for security auditing
```terraform
log_config {
  metadata = "INCLUDE_ALL_METADATA"
}
```

---

### 3. Kubernetes Network Policies ✅ COMPLETED

**Files Modified**:
- `k8s/base/backend/networkpolicy.yaml:43-58, 78-82`
- `k8s/base/finance-api/networkpolicy.yaml:53`
- `k8s/base/agents/networkpolicy.yaml:87`
- `k8s/base/mcp-server/networkpolicy.yaml:84`

**Security Issue**: Empty namespace selectors (`namespaceSelector: {}`) allowing traffic from ALL namespaces

**Fix Applied**:
1. Specific namespace labels for internal services (databases namespace)
2. Removed selectors entirely for internet egress (HTTPS)

**Example Fix:**
```yaml
# BEFORE (UNSAFE)
- to:
  - namespaceSelector: {}  # Allows ALL namespaces
  ports:
  - protocol: TCP
    port: 5432

# AFTER (SAFE)
- to:
  - namespaceSelector:
      matchLabels:
        name: databases
  ports:
  - protocol: TCP
    port: 5432
```

---

### 4. CORS Configuration ✅ COMPLETED

**Files Modified**:
- `k8s/base/backend/configmap.yaml:14-16`
- `k8s/overlays/prod/kustomization.yaml:77-79`

**Security Issue**: Wildcard CORS allowed all origins (`["*"]`)

**Fix Applied**:

**Development** (k8s/base/backend/configmap.yaml):
```yaml
CORS_ORIGINS: '["http://localhost:3000","http://localhost:3001","http://localhost:19006"]'
```

**Production** (k8s/overlays/prod/kustomization.yaml):
```yaml
- op: replace
  path: /data/CORS_ORIGINS
  value: '["https://app.life-navigator.vercel.app","https://life-navigator.vercel.app"]'
```

**Note**: Update these URLs once you have your actual Vercel deployment URL.

---

## GPU Configuration Details

### GPU Node Pool Specifications

The `gke-gpu-cluster` module (terraform/gcp/modules/gke-gpu-cluster/main.tf) provides:

**GPU T4 Node Pool** (lines 229-302):
- **Machine Type**: n1-standard-8 (8 vCPU, 30 GB RAM)
- **GPU**: NVIDIA Tesla T4 (1 GPU per node)
- **Disk**: 200 GB pd-ssd
- **Autoscaling**: Min 1-2 nodes (dev/prod), Max 3-5 nodes
- **GPU Drivers**: Automatically installed (DEFAULT version)
- **Taint**: `nvidia.com/gpu=present:NoSchedule`

**Why Taints?**
Ensures only GPU workloads (Finance API, Agents) run on expensive GPU nodes. CPU-only workloads run on cheaper CPU node pool.

### Kubernetes Deployments with GPU

Both Finance API and Agents services are already configured for GPU:

**Finance API** (k8s/base/finance-api/deployment.yaml:24-31, 103-111):
```yaml
nodeSelector:
  cloud.google.com/gke-nodepool: gpu-t4-pool

tolerations:
- key: nvidia.com/gpu
  operator: Equal
  value: present
  effect: NoSchedule

resources:
  requests:
    cpu: 2000m
    memory: 4Gi
    nvidia.com/gpu: 1
  limits:
    cpu: 4000m
    memory: 8Gi
    nvidia.com/gpu: 1
```

**Agents** (k8s/base/agents/deployment.yaml:24-31, 123-131):
```yaml
nodeSelector:
  cloud.google.com/gke-nodepool: gpu-t4-pool

tolerations:
- key: nvidia.com/gpu
  operator: Equal
  value: present
  effect: NoSchedule

resources:
  requests:
    cpu: 2000m
    memory: 8Gi
    nvidia.com/gpu: 1
  limits:
    cpu: 4000m
    memory: 16Gi
    nvidia.com/gpu: 1
```

---

## Deployment Steps

### Prerequisites

1. GCP project with billing enabled
2. Terraform >= 1.5.0 installed
3. kubectl configured
4. gcloud CLI authenticated

### Step 1: Deploy Terraform Infrastructure

```bash
cd terraform/gcp/environments/dev

# Initialize Terraform (first time)
terraform init

# Review planned changes
terraform plan

# IMPORTANT: This will DESTROY and RECREATE the GKE cluster
# Backup any data and drain nodes before applying
terraform apply
```

**Expected Output:**
- New GKE cluster `life-navigator-gpu` created
- 3 node pools: cpu-pool, gpu-t4-pool, highmem-pool
- VPC firewall rules restricted to specific ports
- All other resources remain unchanged

**Time Estimate**: 15-20 minutes for cluster creation

---

### Step 2: Verify GPU Node Pool

```bash
# Get cluster credentials
gcloud container clusters get-credentials life-navigator-gpu \
  --region us-central1 \
  --project YOUR_PROJECT_ID

# Verify node pools exist
kubectl get nodes -L cloud.google.com/gke-nodepool

# Check for GPU nodes
kubectl get nodes -L nvidia.com/gpu

# Verify GPU availability
kubectl describe nodes -l cloud.google.com/gke-nodepool=gpu-t4-pool | grep nvidia.com/gpu
```

**Expected Output:**
```
Capacity:
  nvidia.com/gpu:     1
Allocatable:
  nvidia.com/gpu:     1
```

---

### Step 3: Deploy Kubernetes Manifests

```bash
cd k8s/overlays/dev

# Apply all manifests
kubectl apply -k .

# Wait for pods to be ready
kubectl get pods -n life-navigator-dev -w
```

**Verify Finance API on GPU**:
```bash
kubectl describe pod -n life-navigator-dev -l app=finance-api | grep -A 5 "Limits:\|Node:"
```

**Expected Output:**
```
Node:         gke-life-navigator-gpu-gpu-t4-pool-xxxxx/10.x.x.x
Limits:
  cpu:           4
  memory:        8Gi
  nvidia.com/gpu:  1
```

**Verify Agents on GPU**:
```bash
kubectl describe pod -n life-navigator-dev -l app=agents | grep -A 5 "Limits:\|Node:"
```

**Expected Output:**
```
Node:         gke-life-navigator-gpu-gpu-t4-pool-xxxxx/10.x.x.x
Limits:
  cpu:           4
  memory:        16Gi
  nvidia.com/gpu:  1
```

---

### Step 4: Verify CORS Configuration

```bash
# Check development CORS
kubectl get configmap backend-config -n life-navigator-dev -o yaml | grep CORS_ORIGINS

# Should output:
# CORS_ORIGINS: '["http://localhost:3000","http://localhost:3001","http://localhost:19006"]'
```

For production:
```bash
cd k8s/overlays/prod
kubectl apply -k .

kubectl get configmap backend-config -n life-navigator-prod -o yaml | grep CORS_ORIGINS

# Should output:
# CORS_ORIGINS: '["https://app.life-navigator.vercel.app","https://life-navigator.vercel.app"]'
```

---

### Step 5: Verify Network Policies

```bash
# Check backend network policy
kubectl describe networkpolicy backend-netpol -n life-navigator-dev

# Verify it has specific namespace selectors, not empty ones
```

**Good Output** (should see):
```yaml
Egress Rules:
  To:
    NamespaceSelector:
      MatchLabels:
        name: databases
  Ports:
    Protocol: TCP
    Port: 5432
```

**Bad Output** (should NOT see):
```yaml
  To:
    NamespaceSelector: <none>  # Empty selector - allows all namespaces!
```

---

### Step 6: Verify Firewall Rules

```bash
gcloud compute firewall-rules describe life-navigator-vpc-dev-allow-internal \
  --project YOUR_PROJECT_ID \
  --format="table(allowed[].ports)"
```

**Expected Output** (specific ports only):
```
PORTS
8000,8001,8080,8090
5432
6379
7687,7474
6333,6334
7200
50051
443
53/udp
15021
```

**Should NOT see**: `0-65535`

---

## Testing GPU Workloads

### Test Finance API OCR Processing

```bash
# Port forward to Finance API
kubectl port-forward -n life-navigator-dev svc/finance-api 8001:8001

# Test OCR endpoint
curl -X POST http://localhost:8001/api/v1/ocr/process \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test-receipt.jpg"
```

**Check GPU Utilization**:
```bash
# SSH into GPU node
kubectl exec -it -n life-navigator-dev \
  $(kubectl get pod -n life-navigator-dev -l app=finance-api -o name | head -1) \
  -- nvidia-smi

# Should show GPU memory usage > 0
```

### Test Agents Service

```bash
# Port forward to Agents
kubectl port-forward -n life-navigator-dev svc/agents 8080:8080

# Test agent endpoint
curl -X POST http://localhost:8080/api/v1/agents/invoke \
  -H "Content-Type: application/json" \
  -d '{"query": "Analyze my spending patterns", "user_id": "test-user"}'
```

---

## Cost Optimization

### Current Configuration Costs (Monthly)

**GKE Cluster**:
- Control plane (standard): $73/month
- CPU node pool (2 nodes, n2-standard-4): ~$140/month
- GPU T4 node pool (1-2 nodes, n1-standard-8 + T4): ~$160-320/month
- High-memory pool (1 node, n2-highmem-4): ~$80/month
- **Subtotal GKE**: ~$453-613/month

**Managed Services**:
- Cloud SQL (db-custom-2-7680): ~$120/month
- Memorystore Redis (1GB BASIC): ~$35/month
- **Subtotal Services**: ~$155/month

**Storage**:
- GCS buckets (models, docs, backups): ~$20/month
- Persistent volumes (OCR models): ~$10/month
- **Subtotal Storage**: ~$30/month

**Networking**:
- Load balancing: ~$20/month
- Egress (first 1TB free): ~$10/month
- **Subtotal Networking**: ~$30/month

**Total GCP**: ~$668-828/month

**Vercel** (Frontend): ~$20/month

**Grand Total**: ~$688-848/month

### Cost Optimization Strategies

1. **Schedule-based scaling** (already configured in Cloud SQL):
   ```bash
   # Start at 7 AM weekdays, stop at 7 PM
   # Saves ~40% on Cloud SQL costs in dev
   ```

2. **GPU node pool autoscaling**:
   - Min 1 node in dev (scales to 0 when idle would save more, but requires cold start tolerance)
   - Scales up to 3 nodes under load
   - Scales down after 10 minutes of no GPU requests

3. **Preemptible GPU nodes** (not recommended for production):
   ```terraform
   # In gke-gpu-cluster module, add:
   preemptible = true  # Reduces cost by 70% but nodes can be terminated
   ```

4. **Regional cluster instead of zonal** (higher availability, slight cost increase)

5. **Committed use discounts** (57% discount for 3-year commitment on GPUs)

---

## Monitoring GPU Usage

### Stackdriver Metrics

```bash
# Check GPU utilization in Cloud Console
# Monitoring > Metrics Explorer
# Metric: kubernetes.io/container/accelerator/duty_cycle
# Resource: k8s_container
# Filter: namespace_name = "life-navigator-dev"
```

### kubectl Commands

```bash
# Get GPU allocation per pod
kubectl get pods -n life-navigator-dev -o=jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[*].resources.limits.nvidia\.com/gpu}{"\n"}{end}'

# Check GPU node capacity
kubectl describe nodes -l cloud.google.com/gke-nodepool=gpu-t4-pool | grep -A 5 "Allocated resources"
```

### Prometheus Queries (if Prometheus is installed)

```promql
# GPU memory usage
container_accelerator_memory_used_bytes{namespace="life-navigator-dev"}

# GPU utilization percentage
container_accelerator_duty_cycle{namespace="life-navigator-dev"}
```

---

## Rollback Procedures

### If GPU Cluster Deployment Fails

```bash
# Switch back to Autopilot cluster
cd terraform/gcp/environments/dev

# Edit main.tf line 370
# Change: source = "../../modules/gke-gpu-cluster"
# Back to: source = "../../modules/gke-cluster"

# Restore Autopilot config
enable_autopilot = true

# Apply
terraform apply
```

### If Network Policies Block Traffic

```bash
# Temporarily disable network policies
kubectl delete networkpolicy backend-netpol -n life-navigator-dev

# Debug connectivity
kubectl run -it --rm debug --image=nicolaka/netshoot --restart=Never -- /bin/bash

# Inside debug pod, test connectivity:
nc -zv postgres.databases.svc.cluster.local 5432
nc -zv redis.databases.svc.cluster.local 6379

# Re-apply network policy after debugging
kubectl apply -f k8s/base/backend/networkpolicy.yaml
```

### If CORS Blocks Vercel Frontend

```bash
# Quick fix: Add wildcard temporarily (NOT FOR PRODUCTION)
kubectl set env deployment/backend CORS_ORIGINS='["*"]' -n life-navigator-prod

# Proper fix: Add actual Vercel URL
kubectl set env deployment/backend CORS_ORIGINS='["https://your-actual-vercel-url.vercel.app"]' -n life-navigator-prod
```

---

## Security Checklist

Before deploying to production, verify:

- [ ] Firewall rules restrict to specific ports (no 0-65535)
- [ ] Network policies use specific namespace selectors (no empty `{}`)
- [ ] CORS configured with actual Vercel domain (no `*`)
- [ ] Secrets rotated (JWT_SECRET, database passwords)
- [ ] Service accounts use least-privilege IAM roles
- [ ] Private nodes enabled in production
- [ ] Workload Identity configured for all service accounts
- [ ] Network policy logging enabled
- [ ] Pod Security Standards enforced (restricted)

---

## Troubleshooting

### GPU Pods Stuck in Pending

**Symptoms**:
```bash
kubectl get pods -n life-navigator-dev -l app=finance-api
# NAME                          READY   STATUS    RESTARTS   AGE
# finance-api-xxxxxxxxx-xxxxx   0/1     Pending   0          5m
```

**Check Events**:
```bash
kubectl describe pod -n life-navigator-dev finance-api-xxxxxxxxx-xxxxx

# Look for:
# "0/3 nodes are available: 3 node(s) didn't match Pod's node affinity/selector"
```

**Solutions**:
1. Verify GPU node pool exists:
   ```bash
   kubectl get nodes -L cloud.google.com/gke-nodepool | grep gpu-t4-pool
   ```

2. Check GPU node taints:
   ```bash
   kubectl describe node <gpu-node-name> | grep Taints
   # Should show: nvidia.com/gpu=present:NoSchedule
   ```

3. Verify deployment tolerations:
   ```bash
   kubectl get deployment finance-api -n life-navigator-dev -o yaml | grep -A 5 tolerations
   ```

### NVIDIA Driver Not Loaded

**Symptoms**:
```bash
kubectl exec -it -n life-navigator-dev <finance-api-pod> -- nvidia-smi
# Error: nvidia-smi: command not found
```

**Solutions**:
1. Check NVIDIA device plugin:
   ```bash
   kubectl get daemonset -n kube-system nvidia-gpu-device-plugin
   ```

2. If missing, install:
   ```bash
   kubectl apply -f https://raw.githubusercontent.com/GoogleCloudPlatform/container-engine-accelerators/master/nvidia-driver-installer/cos/daemonset-preloaded.yaml
   ```

3. Verify GPU is visible to node:
   ```bash
   kubectl debug node/<gpu-node-name> -it --image=ubuntu
   # Inside debug container:
   chroot /host
   nvidia-smi
   ```

### Finance API Can't Access Database

**Symptoms**:
```bash
kubectl logs -n life-navigator-dev -l app=finance-api
# ERROR: could not connect to PostgreSQL: connection refused
```

**Check Network Policy**:
```bash
kubectl describe networkpolicy finance-api-netpol -n life-navigator-dev

# Verify egress allows traffic to databases namespace
```

**Test Connectivity**:
```bash
kubectl run -it --rm debug -n life-navigator-dev --image=postgres:15 -- bash
# Inside pod:
psql -h postgres.databases.svc.cluster.local -U postgres -W
```

**Fix**: Ensure databases namespace is labeled:
```bash
kubectl label namespace databases name=databases
```

---

## Next Steps

### 1. Deploy to Staging

```bash
cd terraform/gcp/environments/staging
terraform init
terraform plan
terraform apply

cd ../../../k8s/overlays/staging
kubectl apply -k .
```

### 2. Deploy to Production

**Requirements before production deployment**:
- [ ] Security audit passed
- [ ] Load testing completed (GPU workloads handle expected traffic)
- [ ] Disaster recovery plan documented
- [ ] Monitoring and alerting configured
- [ ] On-call rotation established
- [ ] Secrets rotated and stored in GCP Secret Manager
- [ ] Backups verified and tested

```bash
cd terraform/gcp/environments/prod
terraform init
terraform plan  # Review carefully!
terraform apply

cd ../../../k8s/overlays/prod
kubectl apply -k .
```

### 3. Configure Monitoring

Set up alerts for:
- GPU utilization > 80% for 10 minutes
- GPU memory > 90%
- Pod restarts > 3 in 1 hour
- High error rates (4xx/5xx)
- Firewall rule violations
- Network policy denials

---

## References

- [GKE GPU Documentation](https://cloud.google.com/kubernetes-engine/docs/how-to/gpus)
- [NVIDIA T4 Specifications](https://www.nvidia.com/en-us/data-center/tesla-t4/)
- [Kubernetes Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [GCP Firewall Rules](https://cloud.google.com/vpc/docs/firewalls)
- [Terraform GKE Module](https://registry.terraform.io/providers/hashicorp/google/latest/docs/resources/container_cluster)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-12
**Authors**: Claude Code
**Review Date**: 2025-12-12 (1 month)
