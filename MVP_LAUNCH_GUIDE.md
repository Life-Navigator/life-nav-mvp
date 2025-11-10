# Life Navigator MVP Launch Guide

**Status**: Ready for Local Development | GCP Deployment Preparation Required
**Last Updated**: 2025-11-09
**Security Vulnerabilities**: ✅ RESOLVED (Zero critical/high/moderate)

---

## Executive Summary

This guide provides a complete roadmap to launch the Life Navigator MVP, both locally and on Google Cloud Platform (GCP). The system has been audited and all critical/high/moderate security vulnerabilities have been resolved.

### System Status Overview

| Component | Status | Action Required |
|-----------|--------|----------------|
| **Security** | ✅ Complete | None - All vulnerabilities fixed |
| **GCP Infrastructure Docs** | ✅ Complete | Review `GCP_INFRASTRUCTURE_REQUIREMENTS.md` |
| **Terraform GPU Modules** | ✅ Complete | Ready for deployment |
| **Local Docker Compose** | ⚠️ Partial | Missing Finance API & Agents services |
| **K8s Manifests** | ⚠️ Partial | Only backend service configured |
| **Environment Variables** | ⚠️ Needs Review | Multiple .env.example files need consolidation |
| **Database Migrations** | ❓ Unknown | Need verification |
| **OCR Models** | ⚠️ Not Downloaded | See `scripts/download_ocr_models.py` |

---

## Table of Contents

1. [System Architecture Audit](#system-architecture-audit)
2. [Critical Blockers for MVP](#critical-blockers-for-mvp)
3. [Local Development Setup](#local-development-setup)
4. [GCP Deployment Guide](#gcp-deployment-guide)
5. [Configuration Checklist](#configuration-checklist)
6. [Pre-Flight Verification](#pre-flight-verification)
7. [Troubleshooting](#troubleshooting)

---

## System Architecture Audit

### Current Infrastructure

#### Docker Compose Services (Local Development)

**Configured Services** (`docker-compose.yml`):
- ✅ PostgreSQL 15 with pgvector extension (port 5432)
- ✅ Redis 7 cache (port 6379)
- ✅ Neo4j 5.15.0 Enterprise (ports 7474, 7687)
- ✅ Qdrant vector database (ports 6333, 6334)
- ✅ GraphDB 10.5.1 semantic triple store (port 7200)
- ✅ GraphRAG Rust service (port 50051)
- ✅ FastAPI Backend (port 8000)

**Missing Services** (Need to be added):
- ❌ Finance API service (port 8001) - Tri-Engine OCR
- ❌ Agents Service (port 8080) - Multi-agent system
- ❌ MCP Server - Model Context Protocol server
- ❌ Web Frontend (Next.js) - Port 3000
- ❌ Embeddings Service (port 8090) - Referenced in GraphRAG config

#### Services Directory Structure

```
services/
├── agents/          ✅ Code exists, Dockerfile present, NOT in docker-compose
├── api/             ✅ Code exists, Dockerfile present, NOT in docker-compose
├── embeddings/      ✅ Directory exists
├── finance-api/     ✅ Code exists, Dockerfile present, NOT in docker-compose
├── graphrag-rs/     ✅ Configured in docker-compose
├── kg-sync/         ✅ Directory exists
└── qdrant/          ✅ Configured in docker-compose
```

#### Kubernetes Manifests

**Configured**:
- ✅ Backend deployment, service, HPA, PDB
- ✅ External Secrets Operator integration
- ✅ Ingress configuration
- ✅ Network policies
- ✅ Service accounts with Workload Identity

**Missing**:
- ❌ Finance API K8s manifests
- ❌ Agents Service K8s manifests
- ❌ MCP Server K8s manifests
- ❌ GPU node affinity/tolerations for ML workloads
- ❌ PersistentVolumeClaims for OCR models storage

### Dependency Security Status

**All Services Updated** (2025-11-09):
- ✅ `services/finance-api/requirements.txt` - All packages latest secure versions
- ✅ `services/agents/pyproject.toml` - All packages latest secure versions
- ✅ `services/api/requirements.txt` - All packages latest secure versions
- ✅ Node.js dependencies (npm audit) - Zero vulnerabilities

**Key Updates Applied**:
```
fastapi: 0.115.6 → 0.121.1
pydantic: 2.10.5 → 2.12.4
sqlalchemy: 2.0.37 → 2.0.44
redis: 5.2.1 → 7.0.1
transformers: ≥4.35.0 → 4.57.1
torch: ≥2.1.0 → 2.9.0
pandas: 2.1.4 → 2.3.3
numpy: 1.26.3 → 2.3.4
Pillow: 11.1.0 → 12.0.0
```

### GCP Infrastructure Requirements

**Documented in**: `GCP_INFRASTRUCTURE_REQUIREMENTS.md`

**Terraform Modules Created**:
1. ✅ `terraform/gcp/modules/gke-gpu-cluster/` - GKE Standard with GPU support
   - CPU Pool: n2-standard-4 (autoscaling 1-10 nodes)
   - GPU T4 Pool: n1-standard-8 + T4 GPU (autoscaling 1-5 nodes)
   - High-Memory Pool: n2-highmem-4 (autoscaling 1-3 nodes)

2. ✅ `terraform/gcp/modules/ocr-storage/` - GCS bucket for OCR models
   - Storage for PaddleOCR (~500MB)
   - Storage for DeepSeek-OCR (~2GB)
   - Versioning and lifecycle management

**Cost Estimates**:
- MVP: $2,800-$3,500/month
- Production: $6,500-$8,000/month

---

## Critical Blockers for MVP

### 🔴 HIGH PRIORITY (Must Fix Before Launch)

#### 1. Complete Docker Compose Configuration

**Issue**: Finance API, Agents Service, and MCP Server not in docker-compose.yml

**Impact**: Cannot run tri-engine OCR or multi-agent system locally

**Solution**:
```yaml
# Add to docker-compose.yml:

  # Finance API with Tri-Engine OCR
  finance-api:
    build:
      context: ./services/finance-api
      dockerfile: Dockerfile
    container_name: ln-finance-api
    environment:
      DATABASE_URL: postgresql+asyncpg://lifenavigator:devpassword@postgres:5432/lifenavigator_dev
      REDIS_URL: redis://redis:6379/0
      OCR_MODELS_PATH: /models
      ENABLE_TESSERACT: "true"
      ENABLE_PADDLEOCR: "true"
      ENABLE_DEEPSEEK: "true"
      CUDA_VISIBLE_DEVICES: "0"  # Requires GPU
    ports:
      - "8001:8001"
    volumes:
      - ./models/ocr:/models:ro
    depends_on:
      - postgres
      - redis
    # Note: Requires GPU for DeepSeek-OCR
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    networks:
      - ln-network

  # Agents Service (Multi-Agent System)
  agents:
    build:
      context: ./services/agents
      dockerfile: Dockerfile
    container_name: ln-agents
    environment:
      DATABASE_URL: postgresql+asyncpg://lifenavigator:devpassword@postgres:5432/lifenavigator_dev
      REDIS_URL: redis://redis:6379/1
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_PASSWORD: devpassword
      QDRANT_URL: http://qdrant:6333
      GRAPHRAG_URL: graphrag:50051
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      ENABLE_GPU: "true"
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
      - neo4j
      - qdrant
      - graphrag
    networks:
      - ln-network
```

#### 2. Download OCR Models

**Issue**: OCR models not present (required ~2.5GB storage)

**Impact**: Finance API OCR features will fail

**Solution**:
```bash
# Run the download script
python scripts/download_ocr_models.py

# Or manually download:
# - PaddleOCR: Auto-downloaded on first run to ~/.paddleocr/
# - DeepSeek-OCR: Auto-downloaded from HuggingFace to ~/.cache/huggingface/
```

#### 3. Environment Variables Consolidation

**Issue**: Multiple `.env.example` files with inconsistent configurations

**Found**:
- `/home/riffe007/Documents/projects/life-navigator-monorepo/.env.example`
- `/home/riffe007/Documents/projects/life-navigator-monorepo/services/api/.env.example`
- `/home/riffe007/Documents/projects/life-navigator-monorepo/services/graphrag-rs/.env.example`
- `/home/riffe007/Documents/projects/life-navigator-monorepo/backend/.env.example`

**Solution**: Create single `.env` from root `.env.example` and add missing variables

#### 4. Database Migrations

**Issue**: Unknown if Alembic migrations are up-to-date

**Impact**: Database schema may be incompatible with latest code

**Verification Needed**:
```bash
cd services/finance-api
alembic history
alembic current
alembic upgrade head
```

### 🟡 MEDIUM PRIORITY (Should Fix Soon)

#### 5. Kubernetes Manifests for New Services

**Issue**: Only backend service has K8s manifests, missing:
- Finance API deployment
- Agents Service deployment
- MCP Server deployment
- GPU node selectors and tolerations

**Impact**: Cannot deploy to GKE without manual configuration

#### 6. Missing Embeddings Service

**Issue**: GraphRAG config references `http://localhost:8090` (embeddings service) but service doesn't exist

**Impact**: GraphRAG embeddings generation will fail

### 🟢 LOW PRIORITY (Nice to Have)

#### 7. Frontend Not in Docker Compose

**Issue**: Web frontend (Next.js) not included in docker-compose.yml

**Impact**: Full stack not runnable with single command

#### 8. Neo4j License

**Issue**: Using `neo4j:5.15.0-enterprise` which requires license

**Impact**: May hit license restrictions in production

**Solution**: Use Community Edition or obtain license

---

## Local Development Setup

### Prerequisites

```bash
# Install required tools
docker --version        # Docker 20.10+
docker compose version  # Docker Compose 2.0+
python --version        # Python 3.12+
node --version          # Node.js 18+
pnpm --version          # pnpm 8+

# For GPU workloads (optional locally, required for OCR)
nvidia-smi              # NVIDIA drivers + CUDA 13.0
```

### Step-by-Step Local Setup

#### Step 1: Clone and Install Dependencies

```bash
# Navigate to project
cd /home/riffe007/Documents/projects/life-navigator-monorepo

# Install Node.js dependencies
pnpm install

# Install Python dependencies
cd services/finance-api
pip install -r requirements.txt

cd ../agents
pip install -e .

cd ../api
pip install -r requirements.txt
```

#### Step 2: Environment Configuration

```bash
# Copy environment template
cp .env.example .env

# Edit .env and configure:
nano .env
```

**Required Variables**:
```bash
# GCP Configuration
GCP_PROJECT_ID=life-navigator-dev
GCP_REGION=us-central1

# Database - PostgreSQL
DATABASE_URL=postgresql://lifenavigator:devpassword@localhost:5432/lifenavigator_dev

# Database - Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_PASSWORD=devpassword

# Cache - Redis
REDIS_URL=redis://localhost:6379

# AI Services - Anthropic (REQUIRED)
ANTHROPIC_API_KEY=sk-ant-xxxxx  # Get from https://console.anthropic.com

# Storage - GCS (for GCP deployment)
GCS_BUCKET_MODELS=life-navigator-ocr-models-dev
```

#### Step 3: Download ML Models (Optional for Local)

```bash
# Download OCR models (~2.5GB)
python scripts/download_ocr_models.py

# Models will be saved to:
# - ~/.paddleocr/ (PaddleOCR models)
# - ~/.cache/huggingface/ (DeepSeek-OCR models)
```

#### Step 4: Start Infrastructure Services

```bash
# Start databases and backing services
docker compose up -d postgres redis neo4j qdrant graphdb

# Wait for services to be healthy (2-3 minutes)
docker compose ps

# Verify all services are "healthy"
```

#### Step 5: Run Database Migrations

```bash
# Backend migrations
cd backend
alembic upgrade head

# Finance API migrations
cd ../services/finance-api
alembic upgrade head

# Verify migrations
psql postgresql://lifenavigator:devpassword@localhost:5432/lifenavigator_dev
\dt  # List tables
\q
```

#### Step 6: Start Application Services

```bash
# Terminal 1: GraphRAG Rust Service
docker compose up graphrag

# Terminal 2: Backend API
docker compose up backend

# Terminal 3: Finance API (if added to docker-compose)
cd services/finance-api
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload

# Terminal 4: Agents Service (if added to docker-compose)
cd services/agents
uvicorn api.main:app --host 0.0.0.0 --port 8080 --reload

# Terminal 5: Web Frontend
cd apps/web
pnpm dev
```

#### Step 7: Verify All Services

```bash
# Health checks
curl http://localhost:8000/health  # Backend
curl http://localhost:8001/health  # Finance API
curl http://localhost:8080/health  # Agents Service
curl http://localhost:3000          # Web Frontend

# Database connectivity
curl http://localhost:8000/docs     # Swagger UI - test DB queries

# GraphRAG connectivity
# Check logs: docker compose logs graphrag
```

### Quick Start (All-in-One)

```bash
# Option A: Use existing docker-compose (without Finance/Agents)
docker compose up -d

# Option B: After updating docker-compose with Finance/Agents
docker compose up -d

# Check logs
docker compose logs -f
```

---

## GCP Deployment Guide

### Overview

GCP deployment uses:
- **Terraform**: Infrastructure as Code
- **GKE Standard**: Kubernetes cluster with GPU support
- **Cloud SQL**: PostgreSQL database (HIPAA-compliant)
- **Memorystore**: Redis cache
- **Cloud Storage**: OCR models and document storage
- **Secret Manager**: Secure secrets storage

### Deployment Architecture

```
                     ┌──────────────────┐
                     │  Cloud Load      │
                     │  Balancer (HTTPS)│
                     └────────┬─────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
       ┌──────▼──────┐               ┌───────▼────────┐
       │  GKE GPU    │               │ Cloud Storage  │
       │  Cluster    │               │ (OCR Models)   │
       └──────┬──────┘               └────────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
┌───▼───┐ ┌──▼────┐ ┌──▼─────┐
│Backend│ │Finance│ │Agents  │
│  API  │ │  API  │ │Service │
└───┬───┘ └───┬───┘ └───┬────┘
    │         │         │
    └─────────┼─────────┘
              │
    ┌─────────┼─────────────────┐
    │         │                 │
┌───▼────┐ ┌──▼──────┐ ┌───────▼──────┐
│Cloud   │ │Memory-  │ │Neo4j/Qdrant  │
│SQL     │ │store    │ │(Compute VM)  │
│(Postgres)│(Redis)  │ │              │
└────────┘ └─────────┘ └──────────────┘
```

### Prerequisites

```bash
# 1. Install GCP SDK
curl https://sdk.cloud.google.com | bash
exec -l $SHELL
gcloud init

# 2. Install Terraform
brew install terraform  # macOS
# or
sudo apt install terraform  # Linux

# 3. Install kubectl
gcloud components install kubectl

# 4. Authenticate
gcloud auth login
gcloud auth application-default login
```

### Phase 1: GCP Project Setup

```bash
# Set variables
export PROJECT_ID="life-navigator-mvp"
export REGION="us-central1"
export BILLING_ACCOUNT="YOUR-BILLING-ACCOUNT-ID"

# Create project
gcloud projects create $PROJECT_ID --name="Life Navigator MVP"
gcloud config set project $PROJECT_ID

# Link billing
gcloud billing projects link $PROJECT_ID \
  --billing-account=$BILLING_ACCOUNT

# Enable APIs
gcloud services enable \
  container.googleapis.com \
  compute.googleapis.com \
  sqladmin.googleapis.com \
  redis.googleapis.com \
  storage.googleapis.com \
  secretmanager.googleapis.com \
  servicenetworking.googleapis.com \
  cloudkms.googleapis.com
```

### Phase 2: Terraform State Setup

```bash
# Create state bucket
gsutil mb -l $REGION gs://${PROJECT_ID}-terraform-state

# Enable versioning
gsutil versioning set on gs://${PROJECT_ID}-terraform-state

# Configure backend
cd terraform/gcp/environments/dev

# Update backend.tf with your bucket name
cat > backend.tf <<EOF
terraform {
  backend "gcs" {
    bucket = "${PROJECT_ID}-terraform-state"
    prefix = "terraform/state"
  }
}
EOF
```

### Phase 3: Configure Terraform Variables

```bash
# Create terraform.tfvars
cat > terraform.tfvars <<EOF
project_id  = "${PROJECT_ID}"
region      = "${REGION}"
env         = "dev"

# GKE Configuration
cluster_name = "life-navigator-gpu"

# Labels
labels = {
  environment = "mvp"
  managed_by  = "terraform"
  project     = "life-navigator"
}
EOF
```

### Phase 4: Deploy Infrastructure

```bash
cd terraform/gcp/environments/dev

# Initialize Terraform
terraform init

# Preview changes
terraform plan

# Deploy infrastructure (20-30 minutes)
terraform apply -auto-approve

# Save outputs
terraform output > terraform-outputs.txt
```

**Resources Created**:
- VPC network with private subnets
- GKE Standard cluster with GPU node pool
- Cloud SQL PostgreSQL instance
- Memorystore Redis instance
- Cloud Storage buckets (models, documents)
- IAM service accounts
- Secret Manager secrets

### Phase 5: Upload OCR Models to GCS

```bash
# Get bucket name from Terraform output
export OCR_BUCKET=$(terraform output -raw ocr_models_bucket_name)

# Download models locally first
python scripts/download_ocr_models.py

# Upload to GCS
gsutil -m cp -r ~/.paddleocr/* gs://${OCR_BUCKET}/paddleocr/
gsutil -m cp -r ~/.cache/huggingface/hub/models--deepseek-ai--deepseek-ocr/* \
  gs://${OCR_BUCKET}/deepseek/

# Verify upload
gsutil du -sh gs://${OCR_BUCKET}
```

### Phase 6: Configure Kubernetes

```bash
# Get GKE credentials
gcloud container clusters get-credentials \
  life-navigator-gpu-dev \
  --region $REGION \
  --project $PROJECT_ID

# Verify connection
kubectl cluster-info
kubectl get nodes

# Verify GPU nodes
kubectl get nodes -l node-pool=gpu-t4 -o wide
```

### Phase 7: Create Kubernetes Secrets

```bash
# Create namespace
kubectl create namespace life-navigator-dev

# Create secrets from Terraform outputs
DB_HOST=$(terraform output -raw cloud_sql_private_ip)
REDIS_HOST=$(terraform output -raw redis_host)

kubectl create secret generic app-secrets \
  --namespace=life-navigator-dev \
  --from-literal=database-url="postgresql://lifenavigator:PASSWORD@${DB_HOST}:5432/lifenavigator" \
  --from-literal=redis-url="redis://${REDIS_HOST}:6379" \
  --from-literal=neo4j-uri="bolt://NEO4J_IP:7687" \
  --from-literal=neo4j-password="PASSWORD" \
  --from-literal=anthropic-api-key="YOUR_KEY"

# Or use External Secrets Operator (recommended)
kubectl apply -k k8s/base
```

### Phase 8: Build and Push Container Images

```bash
# Configure Artifact Registry
export REPO="${REGION}-docker.pkg.dev/${PROJECT_ID}/life-navigator"

gcloud artifacts repositories create life-navigator \
  --repository-format=docker \
  --location=$REGION

gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Build and push images
cd /home/riffe007/Documents/projects/life-navigator-monorepo

# Backend
docker build -t ${REPO}/backend:latest -f backend/Dockerfile backend/
docker push ${REPO}/backend:latest

# Finance API
docker build -t ${REPO}/finance-api:latest -f services/finance-api/Dockerfile services/finance-api/
docker push ${REPO}/finance-api:latest

# Agents Service
docker build -t ${REPO}/agents:latest -f services/agents/Dockerfile services/agents/
docker push ${REPO}/agents:latest

# GraphRAG
docker build -t ${REPO}/graphrag:latest -f services/graphrag-rs/Dockerfile services/graphrag-rs/
docker push ${REPO}/graphrag:latest
```

### Phase 9: Deploy to Kubernetes

```bash
# Update image references in k8s/overlays/dev/kustomization.yaml
# Then deploy

kubectl apply -k k8s/overlays/dev

# Wait for pods to start
kubectl get pods -n life-navigator-dev -w

# Check deployment status
kubectl get deployments -n life-navigator-dev
kubectl get services -n life-navigator-dev
```

### Phase 10: Verify Deployment

```bash
# Port-forward to test
kubectl port-forward -n life-navigator-dev svc/backend 8000:8000

# Test endpoints
curl http://localhost:8000/health
curl http://localhost:8000/docs

# Check logs
kubectl logs -n life-navigator-dev -l app=backend --tail=100

# View all resources
kubectl get all -n life-navigator-dev
```

### Phase 11: Configure Ingress (Optional)

```bash
# Get LoadBalancer IP
kubectl get service -n ingress-nginx ingress-nginx-controller

# Configure DNS A record pointing to LoadBalancer IP
# Then apply ingress
kubectl apply -f k8s/shared/ingress.yaml

# Access via domain
curl https://api.lifenavigator.dev/health
```

---

## Configuration Checklist

### Required Before Local Development

- [x] Install Docker & Docker Compose
- [x] Install Python 3.12+
- [x] Install Node.js 18+ and pnpm
- [ ] Copy `.env.example` to `.env`
- [ ] Add `ANTHROPIC_API_KEY` to `.env`
- [ ] Update `docker-compose.yml` to include Finance API & Agents
- [ ] Download OCR models (if testing OCR features)
- [ ] Start infrastructure: `docker compose up -d postgres redis neo4j qdrant`
- [ ] Run database migrations: `alembic upgrade head`

### Required Before GCP Deployment

#### GCP Account Setup
- [ ] Create GCP project
- [ ] Enable billing account
- [ ] Enable required APIs (see Phase 1)
- [ ] Create Terraform state bucket
- [ ] Configure `terraform.tfvars` with project details

#### Secrets Configuration
- [ ] Obtain Anthropic API key
- [ ] Generate secure database password
- [ ] Generate JWT secret key
- [ ] Generate encryption key
- [ ] Store secrets in Secret Manager or External Secrets

#### Infrastructure
- [ ] Review Terraform plans before applying
- [ ] Deploy GPU-enabled GKE cluster
- [ ] Deploy Cloud SQL PostgreSQL
- [ ] Deploy Memorystore Redis
- [ ] Create Cloud Storage buckets
- [ ] Upload OCR models to GCS

#### Application Deployment
- [ ] Build all Docker images
- [ ] Push images to Artifact Registry
- [ ] Create Kubernetes namespace
- [ ] Deploy secrets
- [ ] Deploy applications
- [ ] Configure Ingress/LoadBalancer
- [ ] Run database migrations in K8s
- [ ] Verify health checks

### Optional (Production Hardening)

- [ ] Configure Cloud Armor (DDoS protection)
- [ ] Enable Cloud CDN
- [ ] Configure custom domain + SSL certificate
- [ ] Set up monitoring dashboards
- [ ] Configure alerting policies
- [ ] Enable audit logging
- [ ] Configure backup schedules
- [ ] Test disaster recovery procedures

---

## Pre-Flight Verification

### Local Development Verification

```bash
# 1. Check all infrastructure services are healthy
docker compose ps | grep -E "(healthy|Up)"

# Expected output:
# ln-postgres    healthy
# ln-redis       healthy
# ln-neo4j       healthy
# ln-qdrant      healthy
# ln-graphdb     healthy
# ln-graphrag    healthy
# ln-backend     Up

# 2. Test database connectivity
psql postgresql://lifenavigator:devpassword@localhost:5432/lifenavigator_dev -c "SELECT version();"

# 3. Test Redis
redis-cli ping
# Expected: PONG

# 4. Test Neo4j
curl http://localhost:7474

# 5. Test Qdrant
curl http://localhost:6333/healthz

# 6. Test GraphDB
curl http://localhost:7200/protocol

# 7. Test Backend API
curl http://localhost:8000/health
curl http://localhost:8000/docs

# 8. Test Finance API (if running)
curl http://localhost:8001/health

# 9. Test Agents Service (if running)
curl http://localhost:8080/health

# 10. Run integration tests
cd services/agents
pytest tests/integration/
```

### GCP Deployment Verification

```bash
# 1. Verify Terraform state
cd terraform/gcp/environments/dev
terraform state list

# 2. Verify GKE cluster
gcloud container clusters describe life-navigator-gpu-dev --region=$REGION

# 3. Verify nodes
kubectl get nodes -o wide
kubectl describe node -l node-pool=gpu-t4 | grep nvidia.com/gpu

# 4. Verify pods
kubectl get pods -n life-navigator-dev
# All pods should be Running

# 5. Verify services
kubectl get svc -n life-navigator-dev

# 6. Check pod logs
kubectl logs -n life-navigator-dev -l app=backend --tail=50

# 7. Test health endpoints via port-forward
kubectl port-forward -n life-navigator-dev svc/backend 8000:8000
curl http://localhost:8000/health

# 8. Verify database connectivity
kubectl exec -it -n life-navigator-dev deployment/backend -- \
  python -c "import os; print(os.getenv('DATABASE_URL'))"

# 9. Check Cloud SQL
gcloud sql instances describe life-navigator-db-dev

# 10. Check Redis
gcloud redis instances describe life-navigator-redis-dev --region=$REGION
```

---

## Troubleshooting

### Local Development Issues

#### Issue: "Connection refused" to PostgreSQL

**Symptoms**: Apps can't connect to database

**Solutions**:
```bash
# Check if PostgreSQL is running
docker compose ps postgres

# Check logs
docker compose logs postgres

# Restart PostgreSQL
docker compose restart postgres

# Verify port binding
netstat -an | grep 5432
```

#### Issue: Neo4j license error

**Symptoms**: `Neo4j Enterprise requires license`

**Solutions**:
```yaml
# Option 1: Use Community Edition
# In docker-compose.yml, change:
image: neo4j:5.15.0  # Instead of neo4j:5.15.0-enterprise

# Option 2: Add license acceptance
environment:
  NEO4J_ACCEPT_LICENSE_AGREEMENT: "yes"
```

#### Issue: GPU not available for OCR

**Symptoms**: Finance API fails with "CUDA not available"

**Solutions**:
```bash
# Check NVIDIA drivers
nvidia-smi

# Check Docker GPU support
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi

# Update docker-compose.yml with GPU support
```

#### Issue: OCR models not found

**Symptoms**: `FileNotFoundError: Model files not found`

**Solutions**:
```bash
# Download models
python scripts/download_ocr_models.py

# Check model paths
ls -lah ~/.paddleocr/
ls -lah ~/.cache/huggingface/hub/

# Mount correct paths in docker-compose
volumes:
  - ~/.paddleocr:/root/.paddleocr:ro
  - ~/.cache/huggingface:/root/.cache/huggingface:ro
```

### GCP Deployment Issues

#### Issue: GKE nodes not ready

**Symptoms**: `kubectl get nodes` shows NotReady

**Solutions**:
```bash
# Describe node to see events
kubectl describe node NODE_NAME

# Check node pool status
gcloud container node-pools describe POOL_NAME \
  --cluster=life-navigator-gpu-dev \
  --region=$REGION

# Common fix: Resize node pool
gcloud container clusters resize life-navigator-gpu-dev \
  --num-nodes=3 \
  --region=$REGION
```

#### Issue: Pods stuck in ImagePullBackOff

**Symptoms**: Pods can't pull container images

**Solutions**:
```bash
# Check image exists
gcloud artifacts docker images list $REGION-docker.pkg.dev/$PROJECT_ID/life-navigator

# Grant GKE service account permission
gcloud artifacts repositories add-iam-policy-binding life-navigator \
  --location=$REGION \
  --member="serviceAccount:PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/artifactregistry.reader"

# Or use Workload Identity
kubectl annotate serviceaccount backend \
  --namespace=life-navigator-dev \
  iam.gke.io/gcp-service-account=backend-sa@PROJECT_ID.iam.gserviceaccount.com
```

#### Issue: Database connection timeout

**Symptoms**: Apps can't connect to Cloud SQL

**Solutions**:
```bash
# Verify Cloud SQL is running
gcloud sql instances describe life-navigator-db-dev

# Check VPC peering
gcloud services vpc-peerings list \
  --service=servicenetworking.googleapis.com

# Test connectivity from GKE
kubectl run -it --rm debug --image=postgres:16 --restart=Never -- \
  psql -h CLOUD_SQL_PRIVATE_IP -U lifenavigator -d lifenavigator
```

#### Issue: GPU pods won't schedule

**Symptoms**: Pods with GPU requests stuck in Pending

**Solutions**:
```bash
# Verify GPU nodes exist
kubectl get nodes -l node-pool=gpu-t4

# Verify GPU drivers installed
kubectl describe node -l node-pool=gpu-t4 | grep nvidia.com/gpu

# Check pod events
kubectl describe pod POD_NAME -n life-navigator-dev

# Verify tolerations match taints
kubectl get nodes -l node-pool=gpu-t4 -o json | jq '.items[].spec.taints'
```

---

## Next Steps After MVP Launch

### Performance Optimization
1. Enable GKE cluster autoscaling
2. Configure Horizontal Pod Autoscaling (HPA)
3. Implement caching strategies
4. Optimize database queries
5. Enable Cloud CDN for static assets

### Security Hardening
1. Rotate all secrets
2. Enable Binary Authorization
3. Implement network policies
4. Enable Cloud Armor WAF
5. Configure VPC Service Controls
6. Enable audit logging

### Monitoring & Observability
1. Set up custom Grafana dashboards
2. Configure alerting policies
3. Enable distributed tracing
4. Implement structured logging
5. Set up error tracking (Sentry)

### Compliance
1. HIPAA compliance audit
2. GDPR compliance review
3. SOC2 preparation
4. Data retention policies
5. Disaster recovery testing

### Cost Optimization
1. Review resource usage
2. Enable committed use discounts
3. Optimize storage lifecycle
4. Right-size compute resources
5. Monitor egress costs

---

## Support & Documentation

### Key Documentation Files

- `GCP_INFRASTRUCTURE_REQUIREMENTS.md` - Complete GCP infrastructure specs
- `DEPLOYMENT_CHECKLIST.md` - K8s deployment checklist
- `docs/deployment/GCP_DEPLOYMENT_GUIDE.md` - Detailed GCP deployment guide
- `services/finance-api/OCR_SETUP.md` - OCR model setup guide
- `terraform/gcp/README.md` - Terraform module documentation

### Quick Reference Commands

```bash
# Local Development
docker compose up -d                    # Start all services
docker compose logs -f SERVICE_NAME     # View logs
docker compose ps                        # Check status
docker compose down                      # Stop all services

# GCP Deployment
gcloud container clusters get-credentials CLUSTER_NAME --region=$REGION
kubectl get all -n NAMESPACE            # View all resources
kubectl logs -f deployment/SERVICE_NAME # View logs
kubectl describe pod POD_NAME           # Debug pod issues
terraform output                         # View infrastructure outputs

# Database Migrations
alembic upgrade head                     # Run migrations
alembic current                          # Check current version
alembic history                          # View migration history

# Monitoring
kubectl top nodes                        # Node resource usage
kubectl top pods -n NAMESPACE           # Pod resource usage
gcloud logging read "resource.type=k8s_container" --limit=50
```

---

**Document Version**: 1.0.0
**Last Updated**: 2025-11-09
**Prepared by**: Claude Code Assistant
**Status**: Ready for Review
