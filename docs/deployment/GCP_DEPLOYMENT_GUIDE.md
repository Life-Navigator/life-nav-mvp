# GCP Infrastructure Deployment Guide - Life Navigator

Complete guide for deploying Life Navigator infrastructure on Google Cloud Platform (GCP) using Terraform.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [GCP Project Setup](#gcp-project-setup)
4. [Terraform Configuration](#terraform-configuration)
5. [Infrastructure Components](#infrastructure-components)
6. [Deployment Steps](#deployment-steps)
7. [Service Deployment](#service-deployment)
8. [Post-Deployment](#post-deployment)
9. [Monitoring & Operations](#monitoring--operations)
10. [Troubleshooting](#troubleshooting)

---

## Overview

### Architecture

Life Navigator on GCP uses the following architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                         Cloud CDN                            │
│                  Cloud Load Balancer (HTTPS)                 │
└───────────┬──────────────────────────────┬──────────────────┘
            │                               │
    ┌───────▼────────┐             ┌────────▼─────────┐
    │  GKE Cluster   │             │   Cloud Run      │
    │  (Backend APIs)│             │  (Serverless)    │
    └───────┬────────┘             └──────────────────┘
            │
    ┌───────▼──────────────────────────────────────────┐
    │              Managed Services                     │
    ├──────────────┬──────────────┬────────────────────┤
    │  Cloud SQL   │ Memorystore  │  Cloud Storage     │
    │ (PostgreSQL) │   (Redis)    │   (GCS Buckets)    │
    └──────────────┴──────────────┴────────────────────┘
            │
    ┌───────▼──────────────────────────────────────────┐
    │         Neo4j (Compute Engine)                    │
    │         GraphDB (Compute Engine)                  │
    │         Qdrant (GKE or Compute Engine)           │
    └───────────────────────────────────────────────────┘
```

### Services Deployed

- **GKE (Google Kubernetes Engine)**: Backend FastAPI services, GraphRAG Rust service
- **Cloud SQL**: PostgreSQL database (HIPAA-compliant)
- **Memorystore**: Redis cache for sessions and agent state
- **Cloud Storage**: Document storage, model artifacts, ontology files
- **Cloud Load Balancing**: HTTPS ingress with SSL termination
- **Cloud CDN**: Asset caching and global distribution
- **Cloud Armor**: DDoS protection and WAF
- **Secret Manager**: Secure secret storage
- **Cloud Logging**: Centralized logging
- **Cloud Monitoring**: Metrics and alerting
- **Compute Engine**: Neo4j, GraphDB (self-managed)

### Cost Estimates

**Development Environment**: ~$150-200/month
- GKE: 3 e2-medium nodes (~$80)
- Cloud SQL: db-f1-micro (~$15)
- Memorystore: 1GB (~$40)
- Storage & networking (~$20-45)

**Production Environment**: ~$800-1,200/month
- GKE: 3-6 n2-standard-4 nodes (~$400-800)
- Cloud SQL: db-custom-4-16384 HA (~$300)
- Memorystore: 4GB HA (~$150)
- Storage, networking, egress (~$150-250)

---

## Prerequisites

### Required Tools

Install the following tools on your local machine:

```bash
# Google Cloud SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# Terraform (v1.5+)
# On macOS:
brew tap hashicorp/tap
brew install hashicorp/tap/terraform

# On Linux:
wget -O- https://apt.releases.hashicorp.com/gpg | sudo gpg --dearmor -o /usr/share/keyrings/hashicorp-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/hashicorp-archive-keyring.gpg] https://apt.releases.hashicorp.com $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/hashicorp.list
sudo apt update && sudo apt install terraform

# Kubectl
gcloud components install kubectl

# Helm (for Kubernetes package management)
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# Docker (for building containers)
# Follow instructions at https://docs.docker.com/get-docker/
```

### GCP Account Requirements

- **Billing Account**: Active GCP billing account
- **Organization** (recommended): For production deployments
- **IAM Permissions**: Owner or Editor role, plus:
  - `roles/compute.admin`
  - `roles/container.admin`
  - `roles/iam.serviceAccountAdmin`
  - `roles/resourcemanager.projectCreator`

---

## GCP Project Setup

### 1. Create GCP Project

```bash
# Set project variables
export PROJECT_ID="life-navigator-prod"
export PROJECT_NAME="Life Navigator Production"
export BILLING_ACCOUNT_ID="YOUR-BILLING-ACCOUNT-ID"
export REGION="us-central1"
export ZONE="us-central1-a"

# Create project
gcloud projects create $PROJECT_ID \
  --name="$PROJECT_NAME" \
  --set-as-default

# Link billing account
gcloud billing projects link $PROJECT_ID \
  --billing-account=$BILLING_ACCOUNT_ID

# Verify project
gcloud config set project $PROJECT_ID
```

### 2. Enable Required APIs

```bash
# Enable all required GCP APIs
gcloud services enable \
  compute.googleapis.com \
  container.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage-api.googleapis.com \
  storage-component.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com \
  secretmanager.googleapis.com \
  servicenetworking.googleapis.com \
  cloudkms.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  cloudtrace.googleapis.com \
  cloudprofiler.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  vpcaccess.googleapis.com
```

### 3. Create Service Account for Terraform

```bash
# Create service account
gcloud iam service-accounts create terraform-sa \
  --display-name="Terraform Service Account" \
  --description="Service account for Terraform infrastructure deployment"

# Grant necessary roles
for role in \
  roles/compute.admin \
  roles/container.admin \
  roles/iam.serviceAccountAdmin \
  roles/resourcemanager.projectIamAdmin \
  roles/storage.admin \
  roles/cloudsql.admin \
  roles/redis.admin \
  roles/secretmanager.admin
do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:terraform-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="$role"
done

# Create and download key
gcloud iam service-accounts keys create ~/terraform-sa-key.json \
  --iam-account=terraform-sa@${PROJECT_ID}.iam.gserviceaccount.com

# Set environment variable
export GOOGLE_APPLICATION_CREDENTIALS=~/terraform-sa-key.json
```

⚠️ **Security**: Store the service account key securely. Never commit to git.

### 4. Create GCS Bucket for Terraform State

```bash
# Create bucket for Terraform state
gsutil mb -p $PROJECT_ID -l $REGION gs://${PROJECT_ID}-terraform-state

# Enable versioning
gsutil versioning set on gs://${PROJECT_ID}-terraform-state

# Set lifecycle policy to keep last 10 versions
cat > /tmp/lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "numNewerVersions": 10,
          "isLive": false
        }
      }
    ]
  }
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://${PROJECT_ID}-terraform-state
```

---

## Terraform Configuration

### 1. Configure Terraform Backend

Edit `terraform/gcp/environments/prod/backend.tf`:

```hcl
terraform {
  backend "gcs" {
    bucket  = "life-navigator-prod-terraform-state"
    prefix  = "terraform/state"
  }
}
```

### 2. Configure Variables

Create `terraform/gcp/environments/prod/terraform.tfvars`:

```hcl
# Project Configuration
project_id  = "life-navigator-prod"
region      = "us-central1"
zone        = "us-central1-a"
environment = "production"

# Network Configuration
vpc_name           = "life-navigator-vpc"
subnet_cidr_ranges = {
  "us-central1" = "10.0.0.0/24"
}

# GKE Configuration
gke_cluster_name    = "life-navigator-cluster"
gke_node_count      = 3
gke_machine_type    = "n2-standard-4"  # 4 vCPU, 16GB RAM
gke_disk_size_gb    = 100
gke_min_nodes       = 3
gke_max_nodes       = 10
gke_enable_autopilot = false

# Cloud SQL Configuration
db_name              = "lifenavigator"
db_tier              = "db-custom-4-16384"  # 4 vCPU, 16GB RAM
db_availability_type = "REGIONAL"           # Multi-zone HA
db_disk_size         = 100                  # GB
db_backup_enabled    = true
db_backup_start_time = "03:00"

# Memorystore Redis Configuration
redis_memory_size_gb = 4
redis_tier           = "STANDARD_HA"  # High availability

# Cloud Storage Configuration
gcs_bucket_documents = "life-navigator-prod-documents"
gcs_bucket_models    = "life-navigator-prod-models"
gcs_bucket_ontology  = "life-navigator-prod-ontology"

# Security
enable_cloud_armor = true
enable_ssl         = true
ssl_policy         = "MODERN"  # TLS 1.2+

# Monitoring
enable_logging         = true
enable_monitoring      = true
log_retention_days     = 30
metric_retention_days  = 90

# HIPAA Compliance
enable_audit_logging   = true
require_encryption     = true
data_retention_days    = 2555  # 7 years

# Tags
labels = {
  environment = "production"
  managed_by  = "terraform"
  project     = "life-navigator"
  compliance  = "hipaa"
}
```

### 3. Initialize Terraform

```bash
cd terraform/gcp/environments/prod

# Initialize Terraform
terraform init

# Validate configuration
terraform validate

# Format configuration
terraform fmt -recursive
```

---

## Infrastructure Components

### VPC Network

**Module**: `terraform/gcp/modules/vpc`

Creates:
- VPC with custom subnets
- Cloud NAT for egress
- Firewall rules
- Private Google Access

```bash
# Preview VPC changes
terraform plan -target=module.vpc
```

### GKE Cluster

**Module**: `terraform/gcp/modules/gke-cluster`

Creates:
- GKE cluster with node pools
- Workload Identity
- Network policies
- Pod security policies

```bash
# Preview GKE changes
terraform plan -target=module.gke
```

### Cloud SQL

**Module**: `terraform/gcp/modules/cloud-sql`

Creates:
- PostgreSQL instance (HIPAA-compliant)
- Automated backups
- Point-in-time recovery
- Private IP connection

```bash
# Preview Cloud SQL changes
terraform plan -target=module.cloud_sql
```

### Memorystore Redis

**Module**: `terraform/gcp/modules/memorystore`

Creates:
- Redis instance
- VPC peering
- High availability (if enabled)

```bash
# Preview Memorystore changes
terraform plan -target=module.memorystore
```

---

## Deployment Steps

### Phase 1: Core Infrastructure

Deploy VPC, networking, and security first:

```bash
cd terraform/gcp/environments/prod

# Deploy networking
terraform apply -target=module.vpc -auto-approve

# Deploy Cloud NAT
terraform apply -target=module.cloud_nat -auto-approve

# Deploy firewall rules
terraform apply -target=module.firewall -auto-approve
```

**Verification**:
```bash
# Verify VPC
gcloud compute networks list

# Verify subnets
gcloud compute networks subnets list --network=life-navigator-vpc

# Verify NAT
gcloud compute routers list
```

### Phase 2: Managed Services

Deploy databases and caching:

```bash
# Deploy Cloud SQL
terraform apply -target=module.cloud_sql -auto-approve

# Deploy Memorystore Redis
terraform apply -target=module.memorystore -auto-approve

# Deploy Cloud Storage buckets
terraform apply -target=module.gcs -auto-approve
```

**Wait for provisioning**: Cloud SQL can take 10-15 minutes.

**Verification**:
```bash
# Verify Cloud SQL
gcloud sql instances list

# Verify Memorystore
gcloud redis instances list --region=$REGION

# Verify buckets
gsutil ls -p $PROJECT_ID
```

### Phase 3: GKE Cluster

Deploy Kubernetes cluster:

```bash
# Deploy GKE
terraform apply -target=module.gke -auto-approve
```

**Wait for provisioning**: GKE can take 5-10 minutes.

**Verification**:
```bash
# Get cluster credentials
gcloud container clusters get-credentials life-navigator-cluster \
  --region=$REGION

# Verify nodes
kubectl get nodes

# Verify node pools
gcloud container node-pools list \
  --cluster=life-navigator-cluster \
  --region=$REGION
```

### Phase 4: Kubernetes Addons

Deploy essential Kubernetes components:

```bash
# Install cert-manager for SSL
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Install External Secrets Operator
terraform apply -target=module.external_secrets_operator -auto-approve

# Install NGINX Ingress Controller
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update
helm install ingress-nginx ingress-nginx/ingress-nginx \
  --namespace ingress-nginx \
  --create-namespace \
  --set controller.service.type=LoadBalancer

# Wait for LoadBalancer IP
kubectl get service ingress-nginx-controller \
  -n ingress-nginx \
  --watch
```

### Phase 5: Complete Infrastructure

Deploy remaining components:

```bash
# Deploy everything else
terraform apply -auto-approve

# Review outputs
terraform output
```

**Expected outputs**:
```
gke_cluster_name = "life-navigator-cluster"
cloud_sql_connection_name = "PROJECT_ID:REGION:INSTANCE"
redis_host = "10.0.1.3"
vpc_network = "life-navigator-vpc"
load_balancer_ip = "XX.XX.XX.XX"
```

---

## Service Deployment

### 1. Build Container Images

```bash
# Set up Artifact Registry
export REGION="us-central1"
export PROJECT_ID="life-navigator-prod"
export REPO="life-navigator"

# Create repository
gcloud artifacts repositories create $REPO \
  --repository-format=docker \
  --location=$REGION \
  --description="Life Navigator Docker images"

# Configure Docker
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build and push images
cd /path/to/life-navigator-monorepo

# Backend API
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:latest \
  -f backend/Dockerfile backend/
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/backend:latest

# GraphRAG Service
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/graphrag:latest \
  -f services/graphrag-rs/Dockerfile services/graphrag-rs/
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/graphrag:latest

# Finance API
docker build -t ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/finance-api:latest \
  -f services/finance-api/Dockerfile services/finance-api/
docker push ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/finance-api:latest
```

### 2. Configure Secrets

```bash
# Store secrets in Secret Manager
gcloud secrets create db-password \
  --data-file=- <<< "your-secure-db-password"

gcloud secrets create redis-password \
  --data-file=- <<< "your-secure-redis-password"

gcloud secrets create jwt-secret \
  --data-file=- <<< "$(openssl rand -hex 32)"

gcloud secrets create encryption-key \
  --data-file=- <<< "$(openssl rand -hex 32)"

# Grant GKE service account access
export GKE_SA="gke-workload-identity@${PROJECT_ID}.iam.gserviceaccount.com"

for secret in db-password redis-password jwt-secret encryption-key; do
  gcloud secrets add-iam-policy-binding $secret \
    --member="serviceAccount:${GKE_SA}" \
    --role="roles/secretmanager.secretAccessor"
done
```

### 3. Deploy to Kubernetes

Update image references in `k8s/overlays/prod/kustomization.yaml`:

```yaml
images:
  - name: backend
    newName: us-central1-docker.pkg.dev/life-navigator-prod/life-navigator/backend
    newTag: latest
  - name: graphrag
    newName: us-central1-docker.pkg.dev/life-navigator-prod/life-navigator/graphrag
    newTag: latest
```

Deploy:

```bash
# Deploy base resources
kubectl apply -k k8s/base

# Deploy production overlay
kubectl apply -k k8s/overlays/prod

# Verify deployments
kubectl get deployments -n default
kubectl get pods -n default
kubectl get services -n default
```

### 4. Configure Ingress

Create Ingress for HTTPS:

```bash
# Apply ingress configuration
kubectl apply -f k8s/overlays/prod/ingress.yaml

# Get LoadBalancer IP
export LB_IP=$(kubectl get service ingress-nginx-controller \
  -n ingress-nginx \
  -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "Configure DNS A record: api.lifenavigator.ai -> $LB_IP"
```

---

## Post-Deployment

### 1. Database Migrations

```bash
# Connect to Cloud SQL via Cloud SQL Proxy
cloud_sql_proxy -instances=PROJECT_ID:REGION:INSTANCE=tcp:5432 &

# Run migrations
cd backend
export DATABASE_URL="postgresql://user:pass@localhost:5432/lifenavigator"
alembic upgrade head

# Or use Kubernetes Job
kubectl apply -f k8s/jobs/migration-job.yaml
kubectl logs -f job/migration-job
```

### 2. Load Initial Data

```bash
# Seed essential data
kubectl exec -it deployment/backend -- python -m app.cli seed

# Load ontology to GraphDB
gsutil cp -r ontology/* gs://life-navigator-prod-ontology/

# Import to Neo4j
kubectl exec -it deployment/neo4j -- cypher-shell \
  -u neo4j -p password \
  "CREATE INDEX IF NOT EXISTS FOR (n:Entity) ON (n.id);"
```

### 3. DNS Configuration

Configure DNS records:

```
Type: A
Name: api.lifenavigator.ai
Value: <LoadBalancer IP from step 4>
TTL: 300
```

### 4. SSL Certificate

```bash
# Apply ClusterIssuer for Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@lifenavigator.ai
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF

# Update ingress to use TLS
# SSL cert will be auto-provisioned by cert-manager
```

### 5. Monitoring Setup

```bash
# Install Prometheus & Grafana
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace

# Access Grafana
kubectl port-forward -n monitoring svc/prometheus-grafana 3000:80
# Open http://localhost:3000 (admin/prom-operator)
```

---

## Monitoring & Operations

### Health Checks

```bash
# Check API health
curl https://api.lifenavigator.ai/health

# Check GraphRAG service
kubectl exec -it deployment/graphrag -- grpcurl -plaintext localhost:50051 list

# Check database
gcloud sql operations list --instance=life-navigator-db

# Check Redis
gcloud redis instances describe life-navigator-redis --region=$REGION
```

### Logs

```bash
# View backend logs
kubectl logs -f deployment/backend -n default

# View GraphRAG logs
kubectl logs -f deployment/graphrag -n default

# View Cloud SQL logs
gcloud logging read "resource.type=cloudsql_database" --limit 50

# Stream all logs
kubectl logs -f -l app=backend --all-containers=true
```

### Scaling

```bash
# Scale deployments
kubectl scale deployment/backend --replicas=5

# Scale GKE nodes
gcloud container clusters resize life-navigator-cluster \
  --num-nodes=5 \
  --region=$REGION

# Enable cluster autoscaling
gcloud container clusters update life-navigator-cluster \
  --enable-autoscaling \
  --min-nodes=3 \
  --max-nodes=10 \
  --region=$REGION
```

### Backups

```bash
# Cloud SQL backup
gcloud sql backups create \
  --instance=life-navigator-db \
  --description="Manual backup before deployment"

# List backups
gcloud sql backups list --instance=life-navigator-db

# Restore from backup
gcloud sql backups restore BACKUP_ID \
  --backup-instance=life-navigator-db \
  --backup-id=BACKUP_ID
```

---

## Troubleshooting

### Common Issues

#### 1. GKE Nodes Not Ready

```bash
# Check node status
kubectl get nodes

# Describe problematic node
kubectl describe node NODE_NAME

# Check node pool health
gcloud container node-pools describe POOL_NAME \
  --cluster=life-navigator-cluster \
  --region=$REGION

# Solution: Restart nodes
gcloud container clusters upgrade life-navigator-cluster \
  --region=$REGION \
  --node-pool=POOL_NAME
```

#### 2. Pods Crashing

```bash
# Check pod status
kubectl get pods

# View pod logs
kubectl logs POD_NAME --previous

# Describe pod for events
kubectl describe pod POD_NAME

# Common fixes:
# - Check resource limits
# - Verify secrets are accessible
# - Check database connectivity
```

#### 3. Database Connection Errors

```bash
# Verify Cloud SQL is running
gcloud sql instances describe life-navigator-db

# Check connectivity from GKE
kubectl run -it --rm debug --image=postgres:16 --restart=Never -- \
  psql -h CLOUD_SQL_PRIVATE_IP -U lifenavigator -d lifenavigator

# Verify Private Service Connection
gcloud services vpc-peerings list \
  --service=servicenetworking.googleapis.com \
  --network=life-navigator-vpc
```

#### 4. Ingress Not Working

```bash
# Check ingress status
kubectl get ingress

# Check ingress controller
kubectl get pods -n ingress-nginx

# View ingress logs
kubectl logs -n ingress-nginx deployment/ingress-nginx-controller

# Verify LoadBalancer
kubectl get service -n ingress-nginx ingress-nginx-controller
```

### Performance Issues

```bash
# Check resource usage
kubectl top nodes
kubectl top pods

# View metrics in Cloud Monitoring
gcloud monitoring dashboards list

# Check database performance
gcloud sql operations list --instance=life-navigator-db --limit=50
```

---

## Maintenance

### Regular Tasks

**Daily**:
- Monitor error rates in Cloud Logging
- Check resource utilization
- Review security alerts

**Weekly**:
- Review and update dependencies
- Check backup integrity
- Analyze cost reports

**Monthly**:
- Security audit
- Performance review
- Disaster recovery drill
- Update documentation

### Upgrade Procedures

**GKE Cluster Upgrade**:
```bash
# Check available versions
gcloud container get-server-config --region=$REGION

# Upgrade control plane
gcloud container clusters upgrade life-navigator-cluster \
  --master \
  --cluster-version=VERSION \
  --region=$REGION

# Upgrade node pools
gcloud container clusters upgrade life-navigator-cluster \
  --node-pool=POOL_NAME \
  --cluster-version=VERSION \
  --region=$REGION
```

**Cloud SQL Upgrade**:
```bash
# List available versions
gcloud sql tiers list

# Update instance
gcloud sql instances patch life-navigator-db \
  --database-version=POSTGRES_16 \
  --no-activation-policy
```

---

## Cost Optimization

### Recommendations

1. **Use Committed Use Discounts**: Save up to 57% on GKE nodes
2. **Enable GKE Autopilot**: For simpler, more cost-effective Kubernetes
3. **Use Preemptible Nodes**: For non-critical workloads (80% discount)
4. **Right-size Resources**: Monitor and adjust based on actual usage
5. **Enable Cloud CDN**: Reduce egress costs
6. **Use Cloud Storage Lifecycle**: Move old data to Nearline/Coldline storage

### Cost Monitoring

```bash
# View current costs
gcloud billing accounts list
gcloud billing projects describe $PROJECT_ID

# Set up budget alerts (via console)
# Navigation → Billing → Budgets & alerts
```

---

## Security Best Practices

1. **Enable Binary Authorization**: Ensure only signed images run
2. **Use Workload Identity**: Instead of service account keys
3. **Enable VPC Service Controls**: Restrict data exfiltration
4. **Implement Pod Security Standards**: Restrict privileged containers
5. **Rotate Secrets Regularly**: Every 90 days minimum
6. **Enable Audit Logging**: For compliance requirements
7. **Use Private GKE Cluster**: No public IP on nodes

---

## Disaster Recovery

### Backup Strategy

**RTO (Recovery Time Objective)**: 4 hours
**RPO (Recovery Point Objective)**: 1 hour

**Automated Backups**:
- Cloud SQL: Continuous backups + daily snapshots
- Persistent Volumes: Daily snapshots
- Configuration: Stored in Git + Terraform state

### Recovery Procedure

```bash
# 1. Restore Cloud SQL
gcloud sql backups restore BACKUP_ID \
  --backup-instance=life-navigator-db

# 2. Restore Kubernetes resources
kubectl apply -k k8s/overlays/prod

# 3. Restore persistent volumes
gcloud compute disks create DISK_NAME \
  --source-snapshot=SNAPSHOT_NAME

# 4. Verify services
kubectl get pods --all-namespaces
```

---

## Resources

- **GCP Documentation**: [cloud.google.com/docs](https://cloud.google.com/docs)
- **Terraform GCP Provider**: [registry.terraform.io/providers/hashicorp/google](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- **GKE Best Practices**: [cloud.google.com/kubernetes-engine/docs/best-practices](https://cloud.google.com/kubernetes-engine/docs/best-practices)
- **HIPAA on GCP**: [cloud.google.com/security/compliance/hipaa](https://cloud.google.com/security/compliance/hipaa)

---

**Last Updated**: 2025-11-06
**Document Version**: 1.0.0
**Maintained By**: Infrastructure Team
