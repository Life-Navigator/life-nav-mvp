# GCP Infrastructure Requirements - Life Navigator

**Date**: November 9, 2025
**Status**: Production-Ready Architecture
**Cloud Provider**: Google Cloud Platform (GCP)

---

## Executive Summary

Life Navigator requires a **GPU-enabled, microservices architecture** on GCP to support:
- **Tri-Engine OCR** (Tesseract + PaddleOCR + DeepSeek-OCR) - Requires GPU
- **Multi-Agent System** with hierarchical orchestration
- **Dual GraphRAG** (Neo4j + Qdrant vector store)
- **E5-large-v2 Embeddings** (1024 dimensions) - Requires GPU
- **Maverick LLM** (local llama.cpp) - Requires GPU
- **Real-time Financial Data** processing

**Total Estimated Monthly Cost**: $2,800 - $3,500 (MVP) | $6,500 - $8,000 (Production Scale)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          GOOGLE CLOUD PLATFORM                       │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                    Cloud Load Balancer                        │  │
│  │              (HTTPS/SSL Termination)                          │  │
│  └────────────┬─────────────────────────────────┬────────────────┘  │
│               │                                  │                   │
│    ┌──────────▼─────────┐            ┌──────────▼──────────┐       │
│    │   Frontend (GKE)    │            │    Backend APIs     │       │
│    │  Next.js/React      │            │    (GKE Cluster)    │       │
│    │  Cloud Run          │            │                     │       │
│    └─────────────────────┘            └──────────┬──────────┘       │
│                                                   │                   │
│              ┌────────────────────────────────────┤                   │
│              │                │                   │                   │
│   ┌──────────▼────┐  ┌────────▼──────┐  ┌───────▼────────┐         │
│   │  Finance API   │  │   Main API     │  │  MCP Server    │         │
│   │  (FastAPI)     │  │  (FastAPI)     │  │  (FastAPI)     │         │
│   │  + Tri-OCR     │  │                │  │  Plugin System │         │
│   │  GPU: T4       │  │                │  │                │         │
│   └────────┬───────┘  └────────┬───────┘  └────────┬───────┘         │
│            │                   │                    │                 │
│   ┌────────▼───────────────────▼────────────────────▼──────────┐    │
│   │                  Agents Service (GKE)                       │    │
│   │         Multi-Agent System + GraphRAG + Embeddings         │    │
│   │                  GPU: T4 or A100 (2x GPUs)                  │    │
│   │                                                              │    │
│   │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │    │
│   │  │ Orchestrator │  │ Career Agent │  │  Finance Agent  │  │    │
│   │  └──────────────┘  └──────────────┘  └─────────────────┘  │    │
│   │  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐  │    │
│   │  │  Embeddings  │  │   Maverick   │  │    GraphRAG     │  │    │
│   │  │  (E5-large)  │  │   (llama.cpp)│  │  (Rust + Neo4j) │  │    │
│   │  └──────────────┘  └──────────────┘  └─────────────────┘  │    │
│   └──────────────────────────────────────────────────────────────┘    │
│                                  │                                     │
│              ┌───────────────────┼───────────────────┐                │
│              │                   │                   │                │
│   ┌──────────▼──────┐  ┌────────▼────────┐  ┌──────▼──────────┐    │
│   │   PostgreSQL    │  │     Redis       │  │   Cloud Storage │    │
│   │  (Cloud SQL)    │  │  (Memorystore)  │  │   (GCS Buckets) │    │
│   │  • User data    │  │  • Session cache│  │  • Documents    │    │
│   │  • Agent state  │  │  • Rate limiting│  │  • OCR models   │    │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘    │
│                                                                       │
│   ┌──────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │
│   │     Neo4j        │  │     Qdrant      │  │   Secret Manager │   │
│   │ (Compute Engine) │  │ (Compute Engine)│  │  (API Keys, JWT) │   │
│   │ • Knowledge graph│  │ • Vector store  │  │                  │   │
│   │ • Entity relations│  │ • Embeddings   │  │                  │   │
│   └──────────────────┘  └─────────────────┘  └─────────────────┘   │
│                                                                       │
│   ┌──────────────────────────────────────────────────────────────┐  │
│   │              Monitoring & Observability                       │  │
│   │  ┌────────────┐  ┌─────────────┐  ┌───────────────────────┐ │  │
│   │  │   Cloud    │  │    Cloud    │  │   Cloud Operations   │ │  │
│   │  │ Monitoring │  │   Logging   │  │   (Prometheus/Grafana) │ │  │
│   │  └────────────┘  └─────────────┘  └───────────────────────┘ │  │
│   └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## GCP Services Required

### 1. **Google Kubernetes Engine (GKE)** - Microservices Orchestration

**Cluster Configuration:**
- **Node Pools**:
  1. **CPU Pool** (General workloads)
     - Machine Type: `n2-standard-4` (4 vCPU, 16 GB RAM)
     - Nodes: 3-5 (autoscaling)
     - Purpose: Frontend, API services, orchestration

  2. **GPU Pool** (ML/OCR workloads)
     - Machine Type: `n1-standard-8` + NVIDIA T4 GPU
     - Nodes: 2-3 (autoscaling)
     - Purpose: OCR (DeepSeek, PaddleOCR), Embeddings, Maverick LLM

  3. **High-Memory Pool** (Database workloads)
     - Machine Type: `n2-highmem-4` (4 vCPU, 32 GB RAM)
     - Nodes: 2
     - Purpose: Neo4j, Qdrant

**Estimated Cost**: $1,500 - $2,200/month

**Services Deployed:**
- Finance API (FastAPI + Tri-Engine OCR)
- Main API (FastAPI)
- MCP Server (FastAPI + Plugins)
- Agents Service (Multi-agent system)
- Frontend (Next.js) - Alternative: Cloud Run

---

### 2. **Compute Engine** - Specialized Workloads

**Instances:**

1. **Neo4j Knowledge Graph**
   - Machine Type: `n2-highmem-8` (8 vCPU, 64 GB RAM)
   - Boot Disk: 200 GB SSD
   - Data Disk: 500 GB SSD (persistent)
   - Purpose: Knowledge graph with entity relationships
   - **Cost**: ~$400/month

2. **Qdrant Vector Store**
   - Machine Type: `n2-standard-4` (4 vCPU, 16 GB RAM)
   - Boot Disk: 100 GB SSD
   - Data Disk: 300 GB SSD (persistent)
   - Purpose: E5-large-v2 embeddings (1024d)
   - **Cost**: ~$250/month

3. **Bastion Host** (Optional)
   - Machine Type: `e2-micro` (0.25 vCPU, 1 GB RAM)
   - Purpose: Secure SSH access to VPC
   - **Cost**: ~$7/month

**Total Compute Engine**: ~$650/month

---

### 3. **Cloud SQL (PostgreSQL)** - Relational Database

**Configuration:**
- Engine: PostgreSQL 15
- Machine Type: `db-custom-4-16384` (4 vCPU, 16 GB RAM)
- Storage: 200 GB SSD (autoscaling to 1 TB)
- High Availability: Enabled (failover replica)
- Automated Backups: Daily, 7-day retention

**Purpose:**
- User accounts and authentication
- Agent state and task history
- Financial transactions metadata
- Document metadata

**Estimated Cost**: $300 - $400/month

---

### 4. **Memorystore for Redis** - Caching Layer

**Configuration:**
- Tier: Standard (High Availability)
- Memory: 10 GB
- Version: Redis 7.0

**Purpose:**
- Session management
- Rate limiting
- API response caching
- Agent message queues

**Estimated Cost**: $120/month

---

### 5. **Cloud Storage (GCS)** - Object Storage

**Buckets:**

1. **User Documents Bucket** (`life-navigator-documents-prod`)
   - Storage Class: Standard
   - Region: us-central1
   - Lifecycle: Archive to Nearline after 90 days
   - Estimated Size: 500 GB
   - Purpose: Uploaded tax documents, receipts, bank statements

2. **ML Models Bucket** (`life-navigator-models-prod`)
   - Storage Class: Standard
   - Region: us-central1
   - Estimated Size: 10 GB
   - Purpose: PaddleOCR models (~500MB), DeepSeek-OCR (~2GB), E5-large-v2 (~1GB)

3. **Backups Bucket** (`life-navigator-backups-prod`)
   - Storage Class: Coldline
   - Region: us-central1
   - Estimated Size: 200 GB
   - Purpose: Database backups, configuration snapshots

**Estimated Cost**: $30 - $50/month

---

### 6. **Cloud Load Balancing** - Traffic Distribution

**Configuration:**
- Type: HTTPS Load Balancer (Global)
- SSL Certificate: Google-managed certificate
- Backend Services:
  - Frontend (Cloud Run or GKE)
  - API services (GKE)
- Health Checks: Configured for all backends

**Purpose:**
- HTTPS/SSL termination
- Traffic distribution across regions
- DDoS protection

**Estimated Cost**: $25 - $40/month

---

### 7. **Cloud CDN** - Content Delivery

**Configuration:**
- Cache Mode: CACHE_ALL_STATIC
- TTL: 3600 seconds
- Compression: Enabled (Gzip, Brotli)

**Purpose:**
- Frontend static assets (JS, CSS, images)
- API response caching (GET requests)

**Estimated Cost**: $15 - $30/month

---

### 8. **Cloud Run** - Serverless Frontend (Alternative)

**Configuration:**
- Memory: 2 GB
- CPU: 2 vCPU
- Min Instances: 1
- Max Instances: 10 (autoscaling)
- Concurrency: 80 requests/instance

**Purpose:**
- Next.js frontend (if not using GKE)
- Lower cost for frontend hosting

**Estimated Cost**: $50 - $100/month (if used instead of GKE frontend)

---

### 9. **Secret Manager** - Credentials Management

**Secrets Stored:**
- Database connection strings
- Redis password
- JWT secret keys
- API keys (Stripe, Plaid, etc.)
- Neo4j credentials
- Qdrant API keys

**Estimated Cost**: $2/month

---

### 10. **Cloud Monitoring & Logging** - Observability

**Services:**

1. **Cloud Monitoring (Stackdriver)**
   - Metrics collection (CPU, memory, GPU, disk)
   - Custom metrics (OCR accuracy, agent task latency)
   - Alerting (PagerDuty/Slack integration)

2. **Cloud Logging**
   - Log retention: 30 days
   - Log volume: ~100 GB/month
   - Structured logging (JSON)

3. **Cloud Trace**
   - Distributed tracing for microservices
   - Latency analysis

**Estimated Cost**: $50 - $100/month

---

### 11. **Cloud IAM** - Access Control

**Configuration:**
- Service Accounts:
  - `gke-agent-sa@` - GKE cluster service account
  - `finance-api-sa@` - Finance API service account
  - `mcp-server-sa@` - MCP Server service account
  - `agents-sa@` - Agents service account

- Roles:
  - Cloud SQL Client
  - Cloud Storage Object Admin (specific buckets)
  - Secret Manager Secret Accessor
  - Logging Writer
  - Monitoring Metric Writer

**Estimated Cost**: Free

---

### 12. **Cloud Armor** - DDoS Protection & WAF

**Configuration:**
- Security Policy: Attached to load balancer
- Rules:
  - Rate limiting: 100 requests/minute per IP
  - Geo-blocking: Block high-risk countries (optional)
  - SQL injection protection
  - XSS protection

**Estimated Cost**: $20 - $30/month

---

## GPU Requirements (Critical for ML Workloads)

### GPU Instances Needed:

1. **Finance API (OCR)**
   - GPU: 1x NVIDIA T4 (16 GB)
   - Purpose: Tri-engine OCR (PaddleOCR GPU + DeepSeek-OCR)
   - Utilization: ~40-60% (burst to 100%)

2. **Agents Service (Embeddings + LLM)**
   - GPU: 2x NVIDIA T4 (16 GB each) OR 1x NVIDIA A100 (40 GB)
   - Purpose:
     - E5-large-v2 embeddings (1024d)
     - Maverick LLM inference
     - Agent task processing
   - Utilization: ~60-80% sustained

**GPU Costs:**
- T4 GPU: ~$0.35/hour = ~$252/month (per GPU)
- A100 GPU: ~$2.48/hour = ~$1,785/month (per GPU)

**Recommended**: 3x T4 GPUs (1 for OCR, 2 for Agents)
**GPU Cost**: $756/month

---

## Network Configuration

### VPC Setup:

**Subnets:**
1. **Public Subnet** (10.1.0.0/24)
   - Load Balancer
   - NAT Gateway
   - Bastion Host

2. **Private Subnet - Services** (10.1.1.0/24)
   - GKE cluster nodes
   - Finance API
   - MCP Server
   - Agents Service

3. **Private Subnet - Data** (10.1.2.0/24)
   - Neo4j
   - Qdrant
   - PostgreSQL (Cloud SQL)
   - Redis (Memorystore)

**Firewall Rules:**
- Allow HTTPS (443) from internet → Load Balancer
- Allow SSH (22) from bastion → private subnets
- Allow internal communication within VPC
- Deny all other inbound traffic

**Estimated Network Cost**: $30 - $50/month

---

## Monthly Cost Breakdown (MVP)

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| **GKE Cluster** | CPU Pool (3 nodes) + GPU Pool (2 T4 GPUs) + High-Mem Pool (2 nodes) | $1,500 - $2,200 |
| **Compute Engine** | Neo4j (n2-highmem-8) + Qdrant (n2-standard-4) | $650 |
| **Cloud SQL** | PostgreSQL (4 vCPU, 16 GB, HA) | $300 - $400 |
| **Memorystore Redis** | 10 GB Standard tier | $120 |
| **Cloud Storage** | Documents (500 GB) + Models (10 GB) + Backups (200 GB) | $30 - $50 |
| **Load Balancing** | HTTPS Load Balancer | $25 - $40 |
| **Cloud CDN** | Static asset caching | $15 - $30 |
| **Secret Manager** | ~20 secrets | $2 |
| **Monitoring & Logging** | Metrics + logs + traces | $50 - $100 |
| **Cloud Armor** | DDoS protection + WAF | $20 - $30 |
| **Network** | Egress traffic, NAT Gateway | $30 - $50 |
| **GPUs** | 3x T4 GPUs (included in GKE cost above) | (included) |

**Total MVP Cost**: **$2,742 - $3,572/month**

---

## Monthly Cost Breakdown (Production Scale)

For 10,000+ users with high traffic:

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| **GKE Cluster** | CPU Pool (8 nodes) + GPU Pool (4 T4 + 1 A100) + High-Mem Pool (3 nodes) | $4,500 - $5,500 |
| **Compute Engine** | Neo4j (n2-highmem-16) + Qdrant cluster (3x n2-standard-8) | $1,200 |
| **Cloud SQL** | PostgreSQL (16 vCPU, 64 GB, HA, Read Replicas) | $800 - $1,000 |
| **Memorystore Redis** | 50 GB Standard tier | $600 |
| **Cloud Storage** | Documents (5 TB) + Models (10 GB) + Backups (1 TB) | $150 - $200 |
| **Load Balancing** | Multi-region load balancer | $80 - $120 |
| **Cloud CDN** | Global CDN | $50 - $100 |
| **Secret Manager** | ~50 secrets | $5 |
| **Monitoring & Logging** | High volume logs + custom metrics | $200 - $300 |
| **Cloud Armor** | Advanced DDoS protection | $50 - $80 |
| **Network** | Higher egress traffic | $100 - $200 |

**Total Production Cost**: **$7,735 - $9,500/month**

---

## Terraform Resources Needed

1. **VPC and Networking**
   - `google_compute_network`
   - `google_compute_subnetwork`
   - `google_compute_firewall`
   - `google_compute_router`
   - `google_compute_router_nat`

2. **GKE Cluster**
   - `google_container_cluster`
   - `google_container_node_pool` (CPU, GPU, High-Memory pools)

3. **Compute Engine**
   - `google_compute_instance` (Neo4j, Qdrant)
   - `google_compute_disk` (persistent SSD disks)
   - `google_compute_attached_disk`

4. **Cloud SQL**
   - `google_sql_database_instance`
   - `google_sql_database`
   - `google_sql_user`

5. **Memorystore Redis**
   - `google_redis_instance`

6. **Cloud Storage**
   - `google_storage_bucket`
   - `google_storage_bucket_iam_member`

7. **Load Balancer**
   - `google_compute_global_forwarding_rule`
   - `google_compute_target_https_proxy`
   - `google_compute_url_map`
   - `google_compute_backend_service`
   - `google_compute_health_check`
   - `google_compute_managed_ssl_certificate`

8. **Cloud CDN**
   - `google_compute_backend_bucket`

9. **Secret Manager**
   - `google_secret_manager_secret`
   - `google_secret_manager_secret_version`

10. **IAM**
    - `google_service_account`
    - `google_project_iam_member`

11. **Monitoring**
    - `google_monitoring_alert_policy`
    - `google_monitoring_notification_channel`

---

## Scaling Considerations

### Horizontal Scaling:
- **GKE Autoscaling**: Enabled on all node pools (min: 1, max: 10 per pool)
- **Cloud Run**: Autoscaling from 1 to 100 instances
- **Qdrant**: Sharding for > 1 million documents

### Vertical Scaling:
- **Cloud SQL**: Upgrade to db-custom-32-122880 (32 vCPU, 122 GB RAM)
- **Neo4j**: Upgrade to n2-highmem-32 (32 vCPU, 256 GB RAM)

### Multi-Region:
- **Primary Region**: us-central1 (Iowa) - Low latency, GPU availability
- **Secondary Region**: us-east1 (South Carolina) - Disaster recovery
- **CDN**: Global edge locations

---

## Security Hardening

### Required:
1. **VPC Service Controls** - Prevent data exfiltration
2. **Binary Authorization** - Only signed container images
3. **Workload Identity** - Secure GKE to GCP API access
4. **Cloud KMS** - Encrypt sensitive data at rest
5. **Cloud Armor** - WAF and DDoS protection
6. **Audit Logging** - All API calls logged

### Compliance:
- **GDPR**: Data residency controls (EU region if needed)
- **HIPAA**: Business Associate Agreement (BAA) with GCP
- **SOC 2**: Compliance logging and monitoring

---

## Next Steps

1. **Terraform Implementation**
   - Create modules for each service
   - Use remote state (GCS backend)
   - Implement CI/CD with Cloud Build

2. **GPU Model Deployment**
   - Build custom container images with OCR models
   - Upload to Artifact Registry
   - Configure GKE to pull from registry

3. **Monitoring Setup**
   - Configure Prometheus/Grafana in GKE
   - Set up alert policies
   - Create dashboards for OCR accuracy, agent latency

4. **Disaster Recovery**
   - Automated backups (PostgreSQL, Neo4j)
   - Cross-region replication
   - Recovery Time Objective (RTO): < 4 hours
   - Recovery Point Objective (RPO): < 1 hour

---

**Document Version**: 1.0
**Last Updated**: November 9, 2025
**Estimated MVP Monthly Cost**: $2,800 - $3,500
**Estimated Production Monthly Cost**: $6,500 - $8,000
