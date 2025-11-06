# Life Navigator GCP Infrastructure

Comprehensive Terraform modules and environments for deploying Life Navigator infrastructure on Google Cloud Platform with GKE.

## Architecture Overview

```
Life Navigator GCP Infrastructure
├── VPC Network (10.0.0.0/24)
│   ├── Primary subnet (10.0.0.0/24)
│   ├── Pods secondary range (10.1.0.0/16)
│   └── Services secondary range (10.2.0.0/16)
├── GKE Autopilot Cluster
│   ├── External Secrets Operator
│   ├── Backend API (FastAPI)
│   └── GraphRAG Service (Rust)
├── Cloud SQL PostgreSQL
│   ├── Private IP
│   └── Automated backups
├── Memorystore Redis
│   └── Private IP
├── Cloud Storage
│   ├── Models bucket
│   ├── Documents bucket
│   └── Backups bucket
└── Secret Manager
    └── All sensitive credentials
```

## Directory Structure

```
terraform/gcp/
├── modules/                           # Reusable Terraform modules
│   ├── vpc/                          # VPC and networking
│   ├── cloud-sql/                    # PostgreSQL database
│   ├── memorystore/                  # Redis cache
│   ├── storage/                      # Cloud Storage buckets
│   ├── secret-manager/               # Secret Manager
│   ├── iam/                          # IAM service accounts
│   ├── monitoring/                   # Monitoring and alerting
│   ├── gke-cluster/                  # GKE Autopilot cluster ⭐ NEW
│   ├── external-secrets-operator/    # External Secrets Operator ⭐ NEW
│   ├── neo4j/                        # Neo4j (optional)
│   ├── qdrant/                       # Qdrant (optional)
│   ├── graphdb/                      # GraphDB (optional)
│   └── graphrag-service/             # GraphRAG service
└── environments/                      # Environment configurations
    └── dev/                          # Development environment
        ├── main.tf                   # Main configuration (UPDATED with GKE)
        ├── variables.tf              # Variable definitions
        └── terraform.tfvars          # Variable values (gitignored)
```

## Modules

### Core Infrastructure

#### VPC Module (`modules/vpc/`)
- VPC network with custom subnets
- **Secondary IP ranges for GKE pods and services** ⭐ NEW
- Cloud NAT for outbound internet
- Private Google Access enabled
- Firewall rules
- VPC peering for Cloud SQL

**New Feature**: Support for GKE secondary IP ranges
```hcl
secondary_ip_ranges = [
  {
    range_name    = "pods"
    ip_cidr_range = "10.1.0.0/16"
  },
  {
    range_name    = "services"
    ip_cidr_range = "10.2.0.0/16"
  }
]
```

#### Cloud SQL Module (`modules/cloud-sql/`)
- PostgreSQL 15 database
- Private IP only
- Automated backups
- Point-in-time recovery (prod)
- High availability (prod)
- Scheduled start/stop (dev)

#### Memorystore Module (`modules/memorystore/`)
- Redis 7.0 instance
- Private IP only
- HA replica (prod)
- Automatic failover (prod)
- LRU eviction policy

#### Storage Module (`modules/storage/`)
- Cloud Storage buckets
- Lifecycle policies
- Versioning enabled
- Object encryption
- IAM bindings

#### Secret Manager Module (`modules/secret-manager/`)
- Secret definitions
- Automatic replication
- IAM bindings
- Versioning

#### IAM Module (`modules/iam/`)
- Service accounts
- Role bindings
- Workload Identity
- Least privilege access

#### Monitoring Module (`modules/monitoring/`)
- Budget alerts
- Error rate alerts
- Latency alerts
- Log-based metrics
- Notification channels

### Kubernetes Infrastructure ⭐ NEW

#### GKE Cluster Module (`modules/gke-cluster/`)
**Comprehensive GKE Autopilot cluster with enterprise features**

Features:
- **Autopilot Mode**: Fully managed Kubernetes with automatic node provisioning
- **Workload Identity**: Secure access to GCP services from pods
- **Private Cluster**: Nodes without public IP addresses
- **VPC-Native Networking**: IP aliasing for pods and services
- **Dataplane V2**: Advanced networking with Cilium
- **Managed Prometheus**: Integrated monitoring
- **Config Connector**: Manage GCP resources from Kubernetes
- **Binary Authorization**: Enforce deployment policies (prod only)
- **Cloud Armor**: DDoS protection and WAF (prod only)
- **Network Policy**: Pod-to-pod communication control
- **Maintenance Windows**: Automated upgrades during scheduled windows

Configuration:
```hcl
module "gke_cluster" {
  source = "../../modules/gke-cluster"

  project_id = var.project_id
  region     = var.region
  env        = "dev"

  cluster_name = "life-navigator-gke"
  network      = module.vpc.network_name
  subnetwork   = module.vpc.subnet_names["private-subnet"]

  enable_autopilot = true
  enable_private_nodes = true
  release_channel = "REGULAR"
}
```

#### External Secrets Operator Module (`modules/external-secrets-operator/`) ⭐ NEW
**Secure secret management with GCP Secret Manager integration**

Features:
- Helm installation of External Secrets Operator
- ClusterSecretStore for GCP Secret Manager
- Workload Identity integration (no service account keys!)
- High availability configuration
- Security hardened (non-root, read-only filesystem)
- Automatic secret synchronization

Configuration:
```hcl
module "external_secrets_operator" {
  source = "../../modules/external-secrets-operator"

  project_id             = var.project_id
  cluster_name           = module.gke_cluster.cluster_name
  cluster_location       = module.gke_cluster.cluster_location
  workload_identity_pool = module.gke_cluster.workload_identity_pool
  env                    = "dev"
}
```

### Application Services

#### GraphRAG Service Module (`modules/graphrag-service/`)
- Kubernetes Deployment
- gRPC service
- HPA configuration
- PDB for HA
- Secret management
- Workload Identity

## Prerequisites

### Required Tools

```bash
# Terraform
terraform --version  # >= 1.5.0

# gcloud CLI
gcloud --version

# kubectl
kubectl version --client

# kustomize
kustomize version
```

### GCP Project Setup

```bash
# Set project
export PROJECT_ID="your-project-id"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable \
  container.googleapis.com \
  compute.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  secretmanager.googleapis.com \
  storage-api.googleapis.com \
  servicenetworking.googleapis.com \
  iam.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com

# Create Terraform state bucket
gsutil mb -l us-central1 gs://${PROJECT_ID}-terraform-state-dev
gsutil versioning set on gs://${PROJECT_ID}-terraform-state-dev
```

## Quick Start

### 1. Configure Variables

Create `environments/dev/terraform.tfvars`:

```hcl
project_id  = "your-project-id"
region      = "us-central1"
alert_email = "your-email@example.com"
```

### 2. Create Secrets in Secret Manager

```bash
# Database credentials
echo -n "postgres" | gcloud secrets create cloud-sql-db-user --data-file=-
echo -n "secure-password" | gcloud secrets create cloud-sql-db-password --data-file=-
echo -n "10.0.0.3" | gcloud secrets create cloud-sql-db-host --data-file=-
echo -n "graphrag" | gcloud secrets create cloud-sql-db-name --data-file=-

# Redis
echo -n "redis-auth-token" | gcloud secrets create redis-auth-string --data-file=-
echo -n "10.0.1.3" | gcloud secrets create redis-host --data-file=-

# JWT
openssl rand -base64 32 | gcloud secrets create jwt-secret-key --data-file=-

# Neo4j Aura
echo -n "neo4j+s://xxxxx.databases.neo4j.io" | gcloud secrets create neo4j-aura-connection-string --data-file=-
echo -n "neo4j-password" | gcloud secrets create neo4j-aura-password --data-file=-

# Qdrant Cloud
echo -n "qdrant-api-key" | gcloud secrets create qdrant-cloud-api-key --data-file=-
```

### 3. Deploy Infrastructure

```bash
cd environments/dev

# Initialize
terraform init

# Plan
terraform plan

# Apply (takes 15-30 minutes)
terraform apply

# Save outputs
terraform output > outputs.txt
```

### 4. Configure kubectl

```bash
# Get credentials
gcloud container clusters get-credentials \
  $(terraform output -raw gke_cluster_name) \
  --region us-central1 \
  --project $PROJECT_ID

# Verify
kubectl cluster-info
kubectl get nodes

# Check External Secrets Operator
kubectl get pods -n external-secrets-system
kubectl get clustersecretstore
```

### 5. Deploy Application

See `k8s/DEPLOYMENT_GUIDE.md` for detailed Kubernetes deployment instructions.

```bash
cd ../../../k8s/overlays/dev

# Update PROJECT_ID
sed -i "s/PROJECT_ID/$PROJECT_ID/g" kustomization.yaml

# Deploy
kubectl apply -k .

# Monitor
kubectl get pods -n life-navigator-dev -w
```

## What's New in This Version

### GKE Integration
- ✅ Full GKE Autopilot cluster with enterprise features
- ✅ Workload Identity for secure GCP access
- ✅ Private nodes with Cloud NAT
- ✅ VPC-native networking with secondary IP ranges
- ✅ Dataplane V2 (Cilium) for advanced networking
- ✅ Managed Prometheus for monitoring
- ✅ Config Connector for GCP resource management

### External Secrets Operator
- ✅ Automatic secret synchronization from GCP Secret Manager
- ✅ No service account keys needed (Workload Identity)
- ✅ ClusterSecretStore pre-configured
- ✅ High availability in production
- ✅ Security hardened installation

### VPC Enhancements
- ✅ Secondary IP ranges for GKE pods and services
- ✅ Updated outputs to support GKE module

### Updated Environment Configuration
- ✅ Dev environment includes GKE and ESO
- ✅ Kubernetes and Helm providers configured
- ✅ Data sources for GKE cluster access
- ✅ New outputs for cluster information

## Cost Estimates

### Development (with GKE)
- GKE Autopilot: ~$300/month (2-5 pods)
- Cloud SQL (db-custom-2-7680): ~$150/month
- Redis (1GB Basic): ~$50/month
- Storage: ~$50/month
- Networking: ~$100/month
- **Total: ~$650/month**

### Staging (with GKE)
- GKE Autopilot: ~$600/month (3-8 pods)
- Cloud SQL (db-custom-4-15360): ~$400/month
- Redis (5GB Standard): ~$250/month
- Storage: ~$100/month
- Networking: ~$150/month
- **Total: ~$1,500/month**

### Production (with GKE)
- GKE Autopilot: ~$1,500/month (5-20 pods)
- Cloud SQL (db-custom-8-30720, HA): ~$1,200/month
- Redis (10GB Standard, HA): ~$600/month
- Storage: ~$200/month
- Networking: ~$300/month
- Cloud Armor: ~$100/month
- **Total: ~$3,900/month**

## Outputs

Key outputs after deployment:

```bash
# Infrastructure outputs
cloud_sql_connection_name  # Cloud SQL connection string
cloud_sql_private_ip       # Cloud SQL private IP
redis_host                 # Redis host IP
redis_port                 # Redis port
vpc_name                   # VPC network name

# GKE outputs ⭐ NEW
gke_cluster_name           # GKE cluster name
gke_cluster_endpoint       # GKE API endpoint
gke_cluster_ca_certificate # GKE CA certificate
gke_workload_identity_pool # Workload Identity pool

# External Secrets Operator outputs ⭐ NEW
eso_namespace              # ESO namespace
eso_cluster_secret_store   # ClusterSecretStore name
eso_gcp_sa_email          # ESO GCP service account
```

## Security Features

### Network Security
- Private GKE nodes (no public IPs)
- VPC-native networking with Network Policies
- Cloud NAT for controlled outbound access
- Private Google Access for GCP services
- Cloud Armor WAF (production)

### Identity and Access
- Workload Identity (no service account keys!)
- Least privilege IAM roles
- Service accounts per workload
- Audit logging enabled

### Secret Management
- All secrets in GCP Secret Manager
- Automatic secret synchronization to Kubernetes
- Secret rotation support
- No secrets in Git or Terraform state

### Cluster Security
- Binary authorization (production)
- Pod Security Policies
- Security Context enforcement
- Read-only root filesystems
- Non-root containers

## Troubleshooting

### GKE Cluster Issues

```bash
# Check cluster status
gcloud container clusters describe \
  $(terraform output -raw gke_cluster_name) \
  --region us-central1

# Check node status
kubectl get nodes
kubectl describe nodes

# Common issues:
# 1. Cluster creation timeout - increase Terraform timeout
# 2. Network connectivity - verify VPC peering
# 3. Workload Identity - check IAM bindings
```

### External Secrets Issues

```bash
# Check ESO pods
kubectl get pods -n external-secrets-system
kubectl logs -n external-secrets-system -l app.kubernetes.io/name=external-secrets

# Check ClusterSecretStore
kubectl describe clustersecretstore gcpsm-secret-store

# Check ExternalSecret
kubectl get externalsecrets -A
kubectl describe externalsecret backend-secrets -n life-navigator-dev

# Force sync
kubectl annotate externalsecret backend-secrets \
  force-sync=$(date +%s) \
  -n life-navigator-dev
```

### Terraform State Issues

```bash
# List state
terraform state list

# Show resource
terraform state show module.gke_cluster.google_container_cluster.primary

# Refresh state
terraform refresh

# Import resource if needed
terraform import \
  module.gke_cluster.google_container_cluster.primary \
  projects/PROJECT/locations/REGION/clusters/NAME
```

## Maintenance

### Regular Tasks

1. **Weekly**
   - Review cost reports
   - Check cluster health
   - Review error logs
   - Verify backup success

2. **Monthly**
   - Update Terraform providers
   - Review and update modules
   - Security patch review
   - GKE version upgrades
   - Access audit

3. **Quarterly**
   - Disaster recovery test
   - Review resource utilization
   - Optimize costs
   - Update documentation

### Upgrade Path

1. Test in dev environment
2. Verify in staging
3. Schedule maintenance window
4. Backup production
5. Apply to production
6. Verify and monitor

## Migration Guide

If you're upgrading from a non-GKE setup:

1. **Backup existing data**
   ```bash
   # Export Cloud SQL database
   gcloud sql export sql INSTANCE gs://BUCKET/backup.sql

   # Backup secrets
   gcloud secrets list --format="table(name)"
   ```

2. **Update VPC module** (if using existing VPC)
   - Add secondary IP ranges for GKE
   - Update firewall rules

3. **Apply Terraform changes**
   ```bash
   terraform plan  # Review changes carefully
   terraform apply
   ```

4. **Deploy applications to GKE**
   - Follow k8s/DEPLOYMENT_GUIDE.md
   - Test thoroughly in dev first

5. **Migrate traffic**
   - Update DNS records
   - Monitor for issues
   - Keep old infrastructure running until stable

## Additional Resources

- [GKE Autopilot Documentation](https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview)
- [Workload Identity](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity)
- [External Secrets Operator](https://external-secrets.io/)
- [Terraform GCP Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [k8s/README.md](../../k8s/README.md) - Kubernetes deployment documentation
- [k8s/DEPLOYMENT_GUIDE.md](../../k8s/DEPLOYMENT_GUIDE.md) - Step-by-step deployment guide

## Support

For issues and questions:
1. Check troubleshooting section
2. Review GCP documentation
3. Check Terraform provider documentation
4. Review GitHub issues
