# Life Navigator - GCP Infrastructure Guide

**Last Updated**: October 27, 2025
**Target Cloud**: Google Cloud Platform (GCP)
**Model**: Llama-4-Maverick-17B-128E-Instruct (749 GB)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Infrastructure Components](#infrastructure-components)
- [Cost Breakdown](#cost-breakdown)
- [Terraform Modules Required](#terraform-modules-required)
- [Deployment Steps](#deployment-steps)
- [Frontend Integration](#frontend-integration)
- [Monitoring & Observability](#monitoring--observability)

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                         GCP Production Architecture                     │
└────────────────────────────────────────────────────────────────────────┘

                                ┌──────────────┐
                                │  Cloud CDN   │
                                │ + Cloud Armor│
                                └──────┬───────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Global Load Balancer (HTTPS)                    │
│                      SSL Certificate + Custom Domain                    │
└────────────────────┬────────────────────────────────────┬───────────────┘
                     │                                    │
                     ▼                                    ▼
          ┌──────────────────────┐           ┌──────────────────────┐
          │  Frontend (React/    │           │   Backend API        │
          │  Next.js) on         │           │   (FastAPI)          │
          │  Cloud Run           │           │   on GKE Autopilot   │
          │                      │           │                      │
          │  - Streamlit Admin   │◄─────────►│  - Multi-Agent       │
          │  - User Dashboard    │           │  - Orchestrator      │
          │  - Chat Interface    │           │  - MCP Server        │
          └──────────────────────┘           └──────────┬───────────┘
                                                        │
                                                        ▼
                           ┌────────────────────────────────────────────┐
                           │          vLLM Model Server (GPU)           │
                           │    GKE Node Pool with 3x A100 80GB GPUs    │
                           │                                            │
                           │  - Llama-4-Maverick-17B-128E-Instruct     │
                           │  - vLLM OpenAI-compatible API             │
                           │  - Flash Attention 2                       │
                           │  - Persistent Disk for model storage      │
                           └────────────────────────────────────────────┘
                                                │
                   ┌────────────────────────────┼────────────────────────────┐
                   │                            │                            │
                   ▼                            ▼                            ▼
      ┌────────────────────┐      ┌────────────────────┐      ┌────────────────────┐
      │   Cloud SQL        │      │   Memorystore      │      │   Firestore        │
      │   PostgreSQL       │      │   Redis            │      │   (Document Store) │
      │   + pgvector       │      │                    │      │                    │
      │                    │      │   - Pub/Sub Cache  │      │   - User Profiles  │
      │  - GraphRAG Entities│     │   - Session Store  │      │   - Agent Config   │
      │  - Relationships   │      │   - Rate Limiting  │      │   - Audit Logs     │
      │  - User Data (RLS) │      └────────────────────┘      └────────────────────┘
      │  - Multi-region    │
      │    replication     │
      └────────────────────┘

                   ┌────────────────────────────────────────────┐
                   │        Additional Services                  │
                   ├─────────────────────────────────────────────┤
                   │  - Cloud Storage (model files, documents)   │
                   │  - Secret Manager (API keys, passwords)     │
                   │  - Cloud Logging + Monitoring              │
                   │  - Cloud Trace (distributed tracing)       │
                   │  - Pub/Sub (async messaging)                │
                   │  - Cloud Tasks (scheduled jobs)             │
                   │  - Vertex AI Workbench (model management)   │
                   └────────────────────────────────────────────┘
```

---

## Infrastructure Components

### 1. Compute - GKE Autopilot Cluster

**Why GKE Autopilot**: Fully managed Kubernetes that auto-scales and manages nodes for you.

**Configuration**:
```hcl
# GKE Autopilot Cluster
resource "google_container_cluster" "life_navigator" {
  name     = "life-navigator-cluster"
  location = var.region  # e.g., us-central1

  # Autopilot mode - Google manages nodes
  enable_autopilot = true

  # Release channel for automatic upgrades
  release_channel {
    channel = "REGULAR"
  }

  # Workload Identity for secure pod authentication
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Private cluster (nodes not publicly accessible)
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  # Network configuration
  network    = google_compute_network.vpc.name
  subnetwork = google_compute_subnetwork.gke_subnet.name

  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }
}
```

**Node Pools**:

1. **API/Agent Node Pool** (CPU workloads)
   - Machine type: `n2-standard-8` (8 vCPUs, 32 GB RAM)
   - Autoscaling: 2-10 nodes
   - Spot VMs enabled (70% cost savings for non-critical)

2. **vLLM GPU Node Pool** (Model serving)
   - Machine type: `a2-ultragpu-3g` (3x NVIDIA A100 80GB GPUs, 340 GB RAM)
   - GPU: 3x A100 80GB (required for 749GB model)
   - Nodes: 1-2 (autoscale based on load)
   - Persistent disk: 1TB SSD for model files

**Cost**:
- API nodes: ~$400/month (2 nodes baseline)
- GPU node: ~$10,000/month per node (3x A100)

---

### 2. Database Layer

#### a) Cloud SQL PostgreSQL (GraphRAG Storage)

**Configuration**:
```hcl
resource "google_sql_database_instance" "graphrag" {
  name             = "life-navigator-graphrag-prod"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    # High-availability tier
    tier              = "db-custom-8-32768"  # 8 vCPUs, 32 GB RAM
    availability_type = "REGIONAL"           # Multi-zone HA
    disk_size         = 500                  # 500 GB SSD
    disk_autoresize   = true

    # Backup configuration
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"  # 3 AM backups
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 30
      }
    }

    # Database flags for pgvector
    database_flags {
      name  = "shared_preload_libraries"
      value = "vector"
    }

    database_flags {
      name  = "max_connections"
      value = "500"
    }

    # IP configuration (private)
    ip_configuration {
      ipv4_enabled    = false  # No public IP
      private_network = google_compute_network.vpc.id
      require_ssl     = true
    }

    # Maintenance window
    maintenance_window {
      day          = 7  # Sunday
      hour         = 3  # 3 AM
      update_track = "stable"
    }

    # Insights for query performance
    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
    }
  }

  # Deletion protection for production
  deletion_protection = true
}

# pgvector extension
resource "google_sql_database" "graphrag_db" {
  name     = "life_navigator_graphrag"
  instance = google_sql_database_instance.graphrag.name
}

# Create pgvector extension (via init script)
resource "null_resource" "pgvector_extension" {
  provisioner "local-exec" {
    command = <<-EOT
      gcloud sql connect ${google_sql_database_instance.graphrag.name} \
        --user=postgres \
        --database=${google_sql_database.graphrag_db.name} \
        --quiet < ${path.module}/scripts/enable_pgvector.sql
    EOT
  }
}
```

**Cost**: ~$550/month (db-custom-8-32768, Regional HA, 500GB)

#### b) Memorystore Redis (Caching & Pub/Sub)

**Configuration**:
```hcl
resource "google_redis_instance" "cache" {
  name           = "life-navigator-cache"
  tier           = "STANDARD_HA"  # High availability
  memory_size_gb = 10
  region         = var.region

  # Redis version
  redis_version = "REDIS_7_0"

  # Network
  authorized_network = google_compute_network.vpc.id

  # Maintenance policy
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 3
        minutes = 0
      }
    }
  }

  # Redis configuration
  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }
}
```

**Cost**: ~$140/month (Standard HA, 10 GB)

---

### 3. Storage

#### a) Cloud Storage (Model Files & Documents)

**Buckets**:
1. **Model Bucket** (`gs://life-navigator-models-prod`)
   - Llama-4-Maverick model files (749 GB)
   - Storage class: Regional (low latency)
   - Lifecycle: Retain indefinitely

2. **Documents Bucket** (`gs://life-navigator-documents-prod`)
   - FINRA, CFP, tax documents
   - Storage class: Standard
   - Versioning enabled
   - Lifecycle: Delete after 365 days

3. **Backups Bucket** (`gs://life-navigator-backups-prod`)
   - Database backups
   - Storage class: Nearline (cost-effective)
   - Lifecycle: Move to Coldline after 90 days

**Configuration**:
```hcl
resource "google_storage_bucket" "models" {
  name          = "${var.project_id}-models-prod"
  location      = var.region
  storage_class = "REGIONAL"

  uniform_bucket_level_access = true

  versioning {
    enabled = false  # Model files are immutable
  }
}

resource "google_storage_bucket" "documents" {
  name          = "${var.project_id}-documents-prod"
  location      = var.region
  storage_class = "STANDARD"

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 3
    }
    action {
      type = "Delete"
    }
  }
}
```

**Cost**:
- Model bucket: ~$19/month (749 GB Regional storage)
- Documents bucket: ~$2/month (estimated 100 GB)
- Backups bucket: ~$5/month (200 GB Nearline)

---

### 4. Load Balancing & CDN

#### Global Load Balancer with Cloud CDN

**Configuration**:
```hcl
# Reserved static IP
resource "google_compute_global_address" "lb_ip" {
  name = "life-navigator-lb-ip"
}

# SSL certificate
resource "google_compute_managed_ssl_certificate" "default" {
  name = "life-navigator-cert"

  managed {
    domains = ["app.lifenavigator.ai", "api.lifenavigator.ai"]
  }
}

# Backend service for API
resource "google_compute_backend_service" "api" {
  name                  = "life-navigator-api-backend"
  protocol              = "HTTP"
  port_name             = "http"
  timeout_sec           = 30
  enable_cdn            = false  # API shouldn't be cached

  backend {
    group = google_compute_region_network_endpoint_group.api_neg.id
  }

  health_check = google_compute_health_check.api.id

  log_config {
    enable      = true
    sample_rate = 1.0
  }
}

# Backend service for frontend (with CDN)
resource "google_compute_backend_service" "frontend" {
  name                  = "life-navigator-frontend-backend"
  protocol              = "HTTP"
  port_name             = "http"
  timeout_sec           = 30
  enable_cdn            = true  # Frontend assets cached

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    default_ttl       = 3600
    max_ttl           = 86400
    client_ttl        = 3600
    negative_caching  = true
  }

  backend {
    group = google_compute_region_network_endpoint_group.frontend_neg.id
  }

  health_check = google_compute_health_check.frontend.id
}

# URL map
resource "google_compute_url_map" "default" {
  name            = "life-navigator-url-map"
  default_service = google_compute_backend_service.frontend.id

  host_rule {
    hosts        = ["api.lifenavigator.ai"]
    path_matcher = "api"
  }

  path_matcher {
    name            = "api"
    default_service = google_compute_backend_service.api.id
  }
}

# HTTPS proxy
resource "google_compute_target_https_proxy" "default" {
  name             = "life-navigator-https-proxy"
  url_map          = google_compute_url_map.default.id
  ssl_certificates = [google_compute_managed_ssl_certificate.default.id]
}

# Forwarding rule
resource "google_compute_global_forwarding_rule" "https" {
  name       = "life-navigator-https-rule"
  target     = google_compute_target_https_proxy.default.id
  port_range = "443"
  ip_address = google_compute_global_address.lb_ip.address
}
```

**Cost**: ~$35/month (load balancer + minimal traffic)

---

### 5. Security

#### a) Secret Manager

**Secrets to store**:
```hcl
# Database password
resource "google_secret_manager_secret" "db_password" {
  secret_id = "graphrag-db-password"

  replication {
    auto {}
  }
}

# Redis auth string
resource "google_secret_manager_secret" "redis_auth" {
  secret_id = "redis-auth-string"

  replication {
    auto {}
  }
}

# API keys
resource "google_secret_manager_secret" "api_keys" {
  secret_id = "life-navigator-api-keys"

  replication {
    auto {}
  }
}

# OAuth client secrets
resource "google_secret_manager_secret" "oauth_client" {
  secret_id = "oauth-client-secret"

  replication {
    auto {}
  }
}
```

**Cost**: ~$1/month (4 secrets, minimal access)

#### b) Cloud Armor (DDoS Protection)

```hcl
resource "google_compute_security_policy" "policy" {
  name = "life-navigator-security-policy"

  # Rate limiting
  rule {
    action   = "rate_based_ban"
    priority = 1000
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      enforce_on_key = "IP"
      ban_duration_sec = 600

      rate_limit_threshold {
        count        = 100
        interval_sec = 60
      }
    }
  }

  # Block known bad IPs
  rule {
    action   = "deny(403)"
    priority = 2000
    match {
      expr {
        expression = "origin.region_code == 'CN' || origin.region_code == 'RU'"
      }
    }
    description = "Block traffic from certain regions"
  }
}
```

**Cost**: ~$10/month

---

### 6. Networking

#### VPC & Subnets

```hcl
# VPC Network
resource "google_compute_network" "vpc" {
  name                    = "life-navigator-vpc"
  auto_create_subnetworks = false
}

# GKE Subnet
resource "google_compute_subnetwork" "gke_subnet" {
  name          = "gke-subnet"
  ip_cidr_range = "10.0.0.0/20"
  region        = var.region
  network       = google_compute_network.vpc.id

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.4.0.0/14"
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.8.0.0/20"
  }

  private_ip_google_access = true
}

# Cloud SQL Private IP
resource "google_compute_global_address" "private_ip_address" {
  name          = "private-ip-address"
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.vpc.id
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.vpc.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_address.name]
}

# Firewall rules
resource "google_compute_firewall" "allow_internal" {
  name    = "allow-internal"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = ["10.0.0.0/8"]
}
```

**Cost**: Free (VPC, subnets, firewall rules are free; only charged for egress traffic)

---

## Cost Breakdown

### Monthly Cost Estimate (Production)

| Component | Configuration | Monthly Cost |
|-----------|--------------|--------------|
| **Compute** | | |
| GKE API nodes | 2x n2-standard-8 (baseline) | $400 |
| GKE GPU node | 1x a2-ultragpu-3g (3x A100 80GB) | $10,000 |
| Cloud Run (frontend) | 100K requests, 2 GB RAM | $20 |
| **Databases** | | |
| Cloud SQL PostgreSQL | db-custom-8-32768, Regional HA, 500GB | $550 |
| Memorystore Redis | Standard HA, 10 GB | $140 |
| **Storage** | | |
| Model files (Regional) | 749 GB | $19 |
| Documents (Standard) | 100 GB | $2 |
| Backups (Nearline) | 200 GB | $5 |
| **Networking** | | |
| Global Load Balancer | HTTPS, minimal traffic | $35 |
| Egress traffic | ~500 GB/month | $45 |
| **Security & Other** | | |
| Cloud Armor | DDoS protection | $10 |
| Secret Manager | 4 secrets | $1 |
| Cloud Logging | ~500 GB/month | $25 |
| Cloud Monitoring | Metrics, dashboards | $10 |
| **Total** | | **~$11,262/month** |

### Cost Optimization Strategies

1. **Use Spot VMs for GPU nodes**: Save 60-91% on GPU costs
   - Production: ~$4,000/month (from $10,000)
   - Risk: Nodes can be preempted

2. **Use GKE Autopilot Spot for API nodes**: Save 70%
   - Production: ~$120/month (from $400)

3. **Reduce GPU hours**: Run GPU node only during business hours
   - 12 hours/day: ~$5,000/month
   - 8 hours/day: ~$3,300/month

4. **Use Cloud Storage Nearline for model**: Save 50% on storage
   - Model storage: ~$9.50/month (from $19)
   - Trade-off: Higher retrieval costs

**Optimized Production Cost**: ~$5,300-$6,500/month

### Development Environment Cost

| Component | Configuration | Monthly Cost |
|-----------|--------------|--------------|
| GKE nodes | 1x e2-standard-4 (CPU only) | $100 |
| Cloud SQL | db-f1-micro, Single-zone | $25 |
| Memorystore | Basic, 1 GB | $35 |
| Storage | 100 GB total | $3 |
| Load Balancer | HTTP only | $20 |
| Other | Logging, monitoring | $10 |
| **Total (no GPU)** | | **~$193/month** |

**Note**: Dev environment doesn't include GPU. Test model inference using:
- Vertex AI Prediction (pay-per-request)
- Local GPU workstation
- Shared production GPU during off-hours

---

## Terraform Modules Required

### Directory Structure

```
terraform/
├── gcp/
│   ├── modules/
│   │   ├── vpc/                    # VPC, subnets, firewall
│   │   ├── gke/                    # GKE Autopilot cluster
│   │   ├── cloud-sql/              # PostgreSQL with pgvector
│   │   ├── memorystore/            # Redis instance
│   │   ├── storage/                # Cloud Storage buckets
│   │   ├── load-balancer/          # Global LB + Cloud CDN
│   │   ├── security/               # Secret Manager, Cloud Armor
│   │   ├── monitoring/             # Logging, monitoring, alerts
│   │   └── iam/                    # Service accounts, roles
│   │
│   ├── environments/
│   │   ├── dev/
│   │   │   ├── main.tf
│   │   │   ├── variables.tf
│   │   │   ├── terraform.tfvars
│   │   │   └── outputs.tf
│   │   │
│   │   └── prod/
│   │       ├── main.tf
│   │       ├── variables.tf
│   │       ├── terraform.tfvars
│   │       └── outputs.tf
│   │
│   ├── backend.tf                  # GCS backend for state
│   └── README.md
│
└── kubernetes/                     # K8s manifests for GKE
    ├── api/
    │   ├── deployment.yaml
    │   ├── service.yaml
    │   └── hpa.yaml
    │
    ├── vllm/
    │   ├── deployment.yaml         # GPU deployment
    │   ├── service.yaml
    │   └── pvc.yaml                # Persistent volume for model
    │
    └── ingress/
        └── ingress.yaml
```

---

## Deployment Steps

### Phase 1: GCP Project Setup (30 minutes)

```bash
# 1. Create GCP project
gcloud projects create life-navigator-prod --name="Life Navigator Production"

# 2. Set project
gcloud config set project life-navigator-prod

# 3. Enable required APIs
gcloud services enable \
  container.googleapis.com \
  compute.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com \
  servicenetworking.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com

# 4. Create GCS bucket for Terraform state
gsutil mb -l us-central1 gs://life-navigator-terraform-state

# 5. Enable versioning
gsutil versioning set on gs://life-navigator-terraform-state
```

### Phase 2: Upload Model to Cloud Storage (2-4 hours)

```bash
# 1. Create model bucket
gsutil mb -l us-central1 -c REGIONAL gs://life-navigator-models-prod

# 2. Upload Llama-4-Maverick model (749 GB - will take 2-4 hours)
gsutil -m rsync -r \
  /home/riffe007/nvidia-workbench/MAVRIX/models/mavrix/ \
  gs://life-navigator-models-prod/llama-4-maverick/

# 3. Verify upload
gsutil du -sh gs://life-navigator-models-prod/llama-4-maverick/
```

### Phase 3: Deploy Infrastructure with Terraform (1 hour)

```bash
# 1. Navigate to Terraform directory
cd terraform/gcp/environments/prod

# 2. Initialize Terraform
terraform init

# 3. Review plan
terraform plan -out=tfplan

# 4. Apply infrastructure
terraform apply tfplan

# 5. Get outputs
terraform output -json > outputs.json
```

### Phase 4: Deploy Applications to GKE (1 hour)

```bash
# 1. Get GKE credentials
gcloud container clusters get-credentials life-navigator-cluster \
  --region us-central1

# 2. Create namespace
kubectl create namespace life-navigator

# 3. Deploy vLLM server (GPU)
kubectl apply -f kubernetes/vllm/

# 4. Wait for model to load (5-10 minutes)
kubectl logs -f -n life-navigator -l app=vllm

# 5. Deploy API server
kubectl apply -f kubernetes/api/

# 6. Deploy ingress
kubectl apply -f kubernetes/ingress/

# 7. Verify deployments
kubectl get pods -n life-navigator
kubectl get services -n life-navigator
```

### Phase 5: Database Setup (30 minutes)

```bash
# 1. Connect to Cloud SQL
gcloud sql connect life-navigator-graphrag-prod --user=postgres

# 2. Run initialization scripts
\i /path/to/graphrag/schema.sql

# 3. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

# 4. Verify tables
\dt graphrag.*

# 5. Create application user
CREATE USER life_navigator WITH PASSWORD 'secure_password';
GRANT ALL ON SCHEMA graphrag TO life_navigator;
```

---

## Frontend Integration

### Connection Architecture

```
User Browser
    │
    ▼
app.lifenavigator.ai (Cloud Run - React/Next.js Frontend)
    │
    │ HTTPS
    ▼
api.lifenavigator.ai (Global Load Balancer)
    │
    │ Internal
    ▼
GKE Service: life-navigator-api (FastAPI)
    │
    ├──► POST /api/query          → Orchestrator → Agents → vLLM
    ├──► POST /api/graphrag/ingest → Document Ingestion
    ├──► GET  /api/health         → Health Check
    └──► GET  /api/metrics        → Prometheus Metrics
```

### Frontend Environment Variables

```env
# .env.production
NEXT_PUBLIC_API_URL=https://api.lifenavigator.ai
NEXT_PUBLIC_ADMIN_URL=https://admin.lifenavigator.ai
NEXT_PUBLIC_WEBSOCKET_URL=wss://api.lifenavigator.ai/ws

# Authentication
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=your-client-id

# Analytics
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

### API Endpoints for Frontend

**1. Query Endpoint** (Main chat interface)
```typescript
POST /api/query
Content-Type: application/json
Authorization: Bearer <token>

{
  "user_id": "user_123",
  "session_id": "session_456",
  "query": "How much should I save for retirement?",
  "context": {
    "conversation_history": [...],
    "user_profile": {...}
  }
}

Response:
{
  "response": "Based on your profile...",
  "agent_chain": ["orchestrator", "finance_manager", "investment_specialist"],
  "sources": [...],
  "metadata": {
    "processing_time_ms": 1250,
    "tokens_used": 432
  }
}
```

**2. Document Upload** (Admin dashboard)
```typescript
POST /api/graphrag/ingest
Content-Type: multipart/form-data
Authorization: Bearer <admin_token>

Form Data:
- file: File (PDF, HTML, Markdown)
- document_type: "finra" | "cfp" | "tax_law"
- metadata: JSON string

Response:
{
  "document_id": "doc_789",
  "chunks_stored": 42,
  "status": "success"
}
```

**3. WebSocket Connection** (Real-time chat)
```typescript
WS wss://api.lifenavigator.ai/ws/{session_id}
Authorization: Bearer <token>

// Client → Server
{
  "type": "message",
  "content": "Tell me about 401k contribution limits"
}

// Server → Client (streaming response)
{
  "type": "response_chunk",
  "content": "The 2025 401k contribution limit is...",
  "is_final": false
}
```

### Cloud Run Frontend Deployment

```hcl
resource "google_cloud_run_service" "frontend" {
  name     = "life-navigator-frontend"
  location = var.region

  template {
    spec {
      containers {
        image = "gcr.io/${var.project_id}/frontend:latest"

        ports {
          container_port = 3000
        }

        env {
          name  = "NEXT_PUBLIC_API_URL"
          value = "https://api.lifenavigator.ai"
        }

        resources {
          limits = {
            cpu    = "2"
            memory = "2Gi"
          }
        }
      }

      container_concurrency = 80
      timeout_seconds       = 300
    }

    metadata {
      annotations = {
        "autoscaling.knative.dev/minScale" = "1"
        "autoscaling.knative.dev/maxScale" = "10"
      }
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}

# Allow unauthenticated access
resource "google_cloud_run_service_iam_member" "public_access" {
  service  = google_cloud_run_service.frontend.name
  location = google_cloud_run_service.frontend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
```

---

## Monitoring & Observability

### Cloud Logging

**Log Sinks**:
```hcl
# Application logs
resource "google_logging_project_sink" "app_logs" {
  name        = "app-logs-sink"
  destination = "storage.googleapis.com/${google_storage_bucket.logs.name}"

  filter = <<-EOT
    resource.type="k8s_container"
    resource.labels.namespace_name="life-navigator"
  EOT
}

# Audit logs
resource "google_logging_project_sink" "audit_logs" {
  name        = "audit-logs-sink"
  destination = "bigquery.googleapis.com/projects/${var.project_id}/datasets/audit_logs"

  filter = <<-EOT
    protoPayload.serviceName="cloudaudit.googleapis.com"
  EOT
}
```

### Cloud Monitoring Dashboards

```hcl
resource "google_monitoring_dashboard" "main" {
  dashboard_json = jsonencode({
    displayName = "Life Navigator - Production"

    gridLayout = {
      widgets = [
        {
          title = "API Request Rate"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"life-navigator\""
                  aggregation = {
                    perSeriesAligner = "ALIGN_RATE"
                  }
                }
              }
            }]
          }
        },
        {
          title = "vLLM GPU Utilization"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"gce_instance\" AND metric.type=\"compute.googleapis.com/instance/gpu/utilization\""
                }
              }
            }]
          }
        },
        {
          title = "Cloud SQL Connections"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\""
                }
              }
            }]
          }
        }
      ]
    }
  })
}
```

### Alert Policies

```hcl
# High API error rate
resource "google_monitoring_alert_policy" "api_errors" {
  display_name = "High API Error Rate"
  combiner     = "OR"

  conditions {
    display_name = "Error rate > 5%"

    condition_threshold {
      filter          = "resource.type=\"k8s_container\" AND metric.type=\"logging.googleapis.com/user/error_count\""
      duration        = "300s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.05

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email.id]
}

# GPU node down
resource "google_monitoring_alert_policy" "gpu_node_down" {
  display_name = "GPU Node Unavailable"
  combiner     = "OR"

  conditions {
    display_name = "vLLM pod not running"

    condition_absent {
      filter   = "resource.type=\"k8s_pod\" AND resource.labels.pod_name=~\"vllm-.*\""
      duration = "300s"
    }
  }

  notification_channels = [
    google_monitoring_notification_channel.email.id,
    google_monitoring_notification_channel.pagerduty.id
  ]
}
```

---

## Summary

### Infrastructure Checklist

- [ ] GCP project created and APIs enabled
- [ ] VPC and subnets configured
- [ ] GKE Autopilot cluster deployed
- [ ] Cloud SQL PostgreSQL with pgvector
- [ ] Memorystore Redis
- [ ] Cloud Storage buckets (models, documents, backups)
- [ ] Global Load Balancer with SSL
- [ ] Cloud Armor security policies
- [ ] Secret Manager secrets created
- [ ] IAM service accounts and permissions
- [ ] Cloud Logging sinks configured
- [ ] Cloud Monitoring dashboards and alerts
- [ ] Model uploaded to Cloud Storage (749 GB)
- [ ] vLLM deployment on GPU nodes
- [ ] API deployment on GKE
- [ ] Frontend deployed to Cloud Run
- [ ] DNS configured (Cloud DNS or external)
- [ ] SSL certificates provisioned

### Key Costs

- **Production** (Full GPU): ~$11,000/month
- **Production** (Optimized with Spot GPU): ~$5,500/month
- **Development** (No GPU): ~$190/month

### Next Steps

1. Review and customize Terraform variables
2. Create GCP project and enable billing
3. Run Terraform to provision infrastructure
4. Upload model to Cloud Storage
5. Deploy applications to GKE
6. Configure DNS and SSL
7. Test end-to-end flow from frontend → API → vLLM
8. Set up monitoring and alerts
9. Load centralized knowledge documents
10. Go live!

---

**Questions?** Refer to the Terraform module READMEs or GCP documentation.
