# Life Navigator - GCP Infrastructure

This directory contains Terraform configurations for deploying the Life Navigator platform on Google Cloud Platform.

## Directory Structure

```
gcp/
├── modules/              # Reusable Terraform modules
│   ├── vpc/             # VPC networking
│   ├── cloud-sql/       # PostgreSQL database
│   ├── memorystore/     # Redis cache
│   ├── storage/         # Cloud Storage buckets
│   ├── secret-manager/  # Secrets management
│   ├── iam/             # Service accounts & permissions
│   └── monitoring/      # Monitoring, logging, alerts
└── environments/
    ├── dev/             # Development environment (~$950/month)
    ├── staging/         # Staging environment (future)
    └── prod/            # Production environment (future)
```

## Architecture Overview

### Managed Services Strategy

Life Navigator uses **managed GCP services** to minimize operational overhead and costs:

| Service | Purpose | Provider |
|---------|---------|----------|
| **PostgreSQL** | Relational data, auth, metadata | Cloud SQL |
| **Redis** | Short-term memory, caching | Memorystore |
| **Neo4j** | Knowledge graph | Neo4j Aura (external) |
| **Qdrant** | Vector embeddings | Qdrant Cloud (external) |
| **Object Storage** | Models, documents, backups | Cloud Storage |
| **Secrets** | API keys, credentials | Secret Manager |
| **LLM Serving** | Maverick model inference | Cloud Run + Spot VMs |

### Network Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    VPC Network                          │
│                                                         │
│  ┌──────────────┐      ┌──────────────┐               │
│  │ Private      │      │ Cloud SQL    │               │
│  │ Subnet       │─────▶│ PostgreSQL   │               │
│  │ 10.0.0.0/24  │      │ (Private IP) │               │
│  └──────────────┘      └──────────────┘               │
│         │                                              │
│         │              ┌──────────────┐               │
│         └─────────────▶│ Memorystore  │               │
│                        │ Redis        │               │
│                        │ 10.0.1.0/29  │               │
│                        └──────────────┘               │
│                                                         │
│  ┌──────────────┐                                     │
│  │ Cloud NAT    │─────▶ Internet (outbound only)     │
│  └──────────────┘                                     │
└─────────────────────────────────────────────────────────┘
         │
         │ Private Service Connect
         ▼
┌─────────────────┐     ┌─────────────────┐
│ Neo4j Aura      │     │ Qdrant Cloud    │
│ (External)      │     │ (External)      │
└─────────────────┘     └─────────────────┘
```

## Environments

### Development (~$950/month)
- **Purpose**: Local development, testing, experimentation
- **Features**: Scheduled start/stop, single-zone, minimal tiers
- **Deployment**: Manual via Terraform
- **Path**: `environments/dev/`

### Staging (Future)
- **Purpose**: Pre-production testing, integration tests
- **Features**: Production-like config, lower resources
- **Deployment**: CI/CD pipeline
- **Path**: `environments/staging/`

### Production (Future)
- **Purpose**: Live system serving users
- **Features**: Multi-zone HA, autoscaling, full monitoring
- **Deployment**: GitOps with approval gates
- **Path**: `environments/prod/`

## Cost Breakdown

### Development Environment (~$950/month)
```
Cloud SQL (db-custom-2-7680, scheduled):  $120/mo
Memorystore Redis (1GB, BASIC):           $40/mo
Cloud Storage (3 buckets):                $20/mo
Secret Manager:                           $5/mo
Networking:                               $10/mo
Monitoring & Logging:                     $5/mo
Buffer for dev resources:                 $750/mo
─────────────────────────────────────────────────
Total:                                    ~$950/mo
```

### Production Environment (Future, ~$3,200/month)
```
Cloud SQL (multi-zone, 8GB):              $350/mo
Memorystore Redis (5GB, STANDARD_HA):     $250/mo
Cloud Run (backend API):                  $500/mo
Spot VMs (Maverick model):                $1,500/mo
Cloud Storage:                            $100/mo
Neo4j Aura (external):                    $300/mo
Qdrant Cloud (external):                  $200/mo
─────────────────────────────────────────────────
Total:                                    ~$3,200/mo
```

## Quick Start

### Prerequisites

1. **GCP Account**: Active billing account
2. **Terraform**: Version >= 1.5.0
3. **gcloud CLI**: Authenticated and configured
4. **Project**: New GCP project for Life Navigator

### Setup Development Environment

```bash
# 1. Navigate to dev environment
cd terraform/gcp/environments/dev

# 2. Create state bucket
export PROJECT_ID="your-project-id"
gsutil mb -p $PROJECT_ID -l us-central1 gs://life-navigator-terraform-state-dev
gsutil versioning set on gs://life-navigator-terraform-state-dev

# 3. Enable required APIs
gcloud services enable \
  compute.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage-api.googleapis.com \
  secretmanager.googleapis.com \
  cloudscheduler.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com

# 4. Configure variables
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars

# 5. Initialize Terraform
terraform init

# 6. Review plan
terraform plan

# 7. Apply configuration
terraform apply
```

See `environments/dev/README.md` for detailed instructions.

## Modules

### VPC Module (`modules/vpc`)
- Creates VPC network with private subnets
- Configures Cloud NAT for outbound internet
- Sets up firewall rules
- Enables Private Service Connect for Cloud SQL

### Cloud SQL Module (`modules/cloud-sql`)
- PostgreSQL 15 database
- Automated backups
- Private IP only (no public access)
- Optional scheduled start/stop for cost savings

### Memorystore Module (`modules/memorystore`)
- Redis 7.0 cache
- BASIC tier (dev) or STANDARD_HA (prod)
- Connected to VPC via reserved IP range

### Storage Module (`modules/storage`)
- Model storage bucket (STANDARD → NEARLINE after 30 days)
- Document storage bucket (delete after 90 days)
- Backup storage bucket (NEARLINE, delete after 180 days)

### Secret Manager Module (`modules/secret-manager`)
- Stores API keys and credentials
- Automatic replication across regions
- IAM-based access control

### IAM Module (`modules/iam`)
- Service accounts for API server, data pipeline, MCP server
- Role bindings with least-privilege access
- Workload identity for GKE (future)

### Monitoring Module (`modules/monitoring`)
- Budget alerts (50%, 80%, 100% thresholds)
- Error rate alerts
- Latency alerts (p95 > 5s)
- Custom dashboards for Cloud SQL and Redis
- Log aggregation and retention

## Best Practices

### Security
- ✅ All databases use private IPs only
- ✅ Secrets stored in Secret Manager
- ✅ IAM follows least-privilege principle
- ✅ TLS/SSL required for all connections
- ✅ VPC firewall rules restrict access

### Cost Optimization
- ✅ Scheduled start/stop for dev resources
- ✅ Lifecycle policies on storage
- ✅ Minimal tiers for non-prod
- ✅ Budget alerts prevent overruns
- ✅ Log retention limits (30 days dev, 90 days prod)

### Reliability
- ✅ Automated backups for databases
- ✅ Point-in-time recovery for prod
- ✅ Multi-zone for prod resources
- ✅ Health checks and monitoring
- ✅ Terraform state in GCS with versioning

### Operations
- ✅ Infrastructure as Code (Terraform)
- ✅ Modular, reusable components
- ✅ Environment isolation (dev/staging/prod)
- ✅ Comprehensive logging and monitoring
- ✅ Documentation for all modules

## External Services

### Neo4j Aura (Graph Database)
- **Sign up**: https://neo4j.com/cloud/aura/
- **Pricing**: ~$65-300/month depending on size
- **Connection**: Store connection string in Secret Manager
- **Integration**: Private endpoint via VPC peering (optional)

### Qdrant Cloud (Vector Database)
- **Sign up**: https://cloud.qdrant.io/
- **Pricing**: ~$25-200/month depending on size
- **Connection**: Store API key in Secret Manager
- **Integration**: HTTPS API (no VPC required)

## Next Steps

1. **Deploy Development Environment**: Follow quick start guide
2. **Sign up for Neo4j Aura**: Create graph database instance
3. **Sign up for Qdrant Cloud**: Create vector database cluster
4. **Build FastAPI Backend**: Implement API server
5. **Deploy to Cloud Run**: Containerize and deploy
6. **Set up CI/CD**: Automate deployments
7. **Implement Monitoring**: Custom dashboards and alerts
8. **Plan Production**: Scale up for production workloads

---

**Maintained by**: Life Navigator Team
**Last Updated**: 2025-10-31
**Terraform Version**: >= 1.5.0
**GCP Provider Version**: ~> 5.0
