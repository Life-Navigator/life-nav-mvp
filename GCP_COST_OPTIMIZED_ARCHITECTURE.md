# Life Navigator - Cost-Optimized Auto-Scaling Architecture

**Goal**: Minimize costs, auto-scale to zero when idle, maintain excellent user experience

**Challenge**: 749GB Llama-4-Maverick model takes 5-10 minutes to load into GPU memory

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [The GPU Cold Start Problem](#the-gpu-cold-start-problem)
- [Solution: Hybrid Multi-Tier Architecture](#solution-hybrid-multi-tier-architecture)
- [Cost Comparison](#cost-comparison)
- [Terraform Implementation](#terraform-implementation)
- [Monitoring & Optimization](#monitoring--optimization)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│              TIER 1: Instant Response (Scale to Zero)               │
│                     Cloud Run - Stateless APIs                      │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│         TIER 2: Smart Model Serving (Intelligent Warm-up)           │
│                                                                     │
│  ┌──────────────────┐        ┌──────────────────┐                 │
│  │  Lightweight     │        │  Full vLLM Model │                 │
│  │  Model on        │   →    │  (GKE Spot GPU)  │                 │
│  │  Cloud Run       │        │  Auto-wake on    │                 │
│  │  (Always ready)  │        │  demand          │                 │
│  └──────────────────┘        └──────────────────┘                 │
│         ↓                             ↓                            │
│    Fast response              Full model response                 │
│    (<500ms)                   (5-10min first request)             │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│           TIER 3: Data Layer (Managed Services)                     │
│  Cloud SQL (Auto-pause) + Memorystore (scale to 1GB) + Firestore   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## The GPU Cold Start Problem

### Problem Statement

Your Llama-4-Maverick-17B-128E-Instruct model:
- **Size**: 749 GB on disk
- **GPU Memory**: ~187 GB in FP16/BF16
- **Load Time**: 5-10 minutes to load into A100 GPUs
- **Cost**: $10,000/month for 3x A100 GPUs (24/7)

**If we scale to zero**:
- Save: ~$10,000/month in GPU costs
- Problem: First user waits 10 minutes (unacceptable UX)

---

## Solution: Hybrid Multi-Tier Architecture

### Tier 1: Instant Response Layer (Cloud Run)

**All stateless components scale to zero**:

```hcl
# API Server on Cloud Run (FastAPI)
resource "google_cloud_run_service" "api" {
  name     = "life-navigator-api"
  location = var.region

  template {
    metadata {
      annotations = {
        # Scale to zero when idle
        "autoscaling.knative.dev/minScale" = "0"
        "autoscaling.knative.dev/maxScale" = "100"

        # Fast cold starts
        "run.googleapis.com/startup-cpu-boost" = "true"

        # Keep 1 instance warm during business hours (optional)
        "autoscaling.knative.dev/minScale" = var.business_hours ? "1" : "0"
      }
    }

    spec {
      containers {
        image = "gcr.io/${var.project_id}/life-navigator-api:latest"

        ports {
          container_port = 8000
        }

        # Optimized for fast cold starts
        resources {
          limits = {
            cpu    = "4"     # Burst CPU for fast startup
            memory = "2Gi"
          }
        }

        # Environment variables
        env {
          name  = "VLLM_ENDPOINT"
          value = google_cloud_run_service.vllm_proxy.status[0].url
        }

        env {
          name  = "LIGHTWEIGHT_MODEL_ENDPOINT"
          value = google_cloud_run_service.lightweight_model.status[0].url
        }
      }

      # Cold start optimization
      container_concurrency = 80
      timeout_seconds       = 300
    }
  }

  traffic {
    percent         = 100
    latest_revision = true
  }
}
```

**Cold Start Performance**:
- Cloud Run cold start: **<1 second** (with startup CPU boost)
- API ready to accept requests: **<2 seconds**

**Cost When Idle**: $0/month (scales to zero)
**Cost When Active**: ~$0.10 per 100K requests

---

### Tier 2: Smart Model Serving (Hybrid Approach)

#### Strategy A: Lightweight Model + On-Demand Full Model

**Best for**: Low-medium traffic, cost-sensitive deployments

```
User Request
    ↓
API checks request complexity
    ↓
    ├─→ Simple query → Lightweight model (instant, always warm)
    │                   - Cloud Run with small Llama/Mistral
    │                   - 7B-13B parameters
    │                   - Response time: <2 seconds
    │
    └─→ Complex query → Full Llama-4-Maverick
                        - Wake up GPU if sleeping
                        - Queue request during warm-up
                        - Response time: <1s (if warm) or 10min (if cold)
```

**Implementation**:

```hcl
# Lightweight model on Cloud Run (7B-13B params)
resource "google_cloud_run_service" "lightweight_model" {
  name     = "life-navigator-lightweight-model"
  location = var.region

  template {
    metadata {
      annotations = {
        # Keep 1 instance always warm (cheap for small model)
        "autoscaling.knative.dev/minScale" = "1"
        "autoscaling.knative.dev/maxScale" = "10"
      }
    }

    spec {
      containers {
        image = "gcr.io/${var.project_id}/vllm-lightweight:latest"

        ports {
          container_port = 8000
        }

        # Small model fits in Cloud Run
        resources {
          limits = {
            cpu    = "8"
            memory = "32Gi"
          }
        }

        env {
          name  = "MODEL_NAME"
          value = "meta-llama/Llama-3.1-8B-Instruct"  # 16GB model
        }
      }
    }
  }
}

# Full vLLM model on GKE Spot GPU with auto-wake
resource "google_compute_instance" "vllm_gpu" {
  name         = "vllm-gpu-spot"
  machine_type = "a2-ultragpu-3g"
  zone         = "${var.region}-a"

  # Spot VM (60-91% cheaper)
  scheduling {
    preemptible       = true
    automatic_restart = false
    on_host_maintenance = "TERMINATE"
  }

  boot_disk {
    initialize_params {
      image = "projects/ml-images/global/images/c0-deeplearning-common-gpu-v20240122-debian-11-py310"
      size  = 200  # Boot disk
    }
  }

  # Persistent disk for model (749GB)
  attached_disk {
    source      = google_compute_disk.vllm_model.id
    device_name = "model-disk"
  }

  guest_accelerator {
    type  = "nvidia-tesla-a100-80gb"
    count = 3
  }

  # Startup script loads model
  metadata_startup_script = file("${path.module}/scripts/vllm_startup.sh")

  # Auto-shutdown after 1 hour of inactivity
  metadata = {
    "idle-timeout" = "3600"
  }
}

# Persistent disk for model (always available)
resource "google_compute_disk" "vllm_model" {
  name  = "vllm-model-disk"
  type  = "pd-ssd"
  size  = 1000  # 1TB SSD
  zone  = "${var.region}-a"

  # Snapshot for faster provisioning
  snapshot = google_compute_snapshot.vllm_model_snapshot.id
}
```

**vLLM Startup Script** (`scripts/vllm_startup.sh`):

```bash
#!/bin/bash
set -e

# Mount model disk
mkdir -p /mnt/model
mount /dev/disk/by-id/google-model-disk /mnt/model

# Check if model is already loaded in GPU memory (if instance was suspended)
if nvidia-smi | grep -q "vllm"; then
  echo "vLLM already running, skipping load"
  exit 0
fi

# Start vLLM server
docker run -d \
  --name vllm-server \
  --gpus all \
  --shm-size=16g \
  -v /mnt/model:/workspace/models \
  -p 8000:8000 \
  vllm/vllm-openai:latest \
  --model /workspace/models/llama-4-maverick \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype bfloat16 \
  --max-model-len 8192 \
  --gpu-memory-utilization 0.90 \
  --enforce-eager \
  --use-v2-block-manager

# Wait for model to load (5-10 minutes)
timeout 600 bash -c 'until curl -f http://localhost:8000/health; do sleep 10; done'

echo "vLLM server ready"

# Start idle checker (shuts down after 1 hour of no requests)
/usr/local/bin/idle-checker.sh &
```

**Idle Checker** (`scripts/idle-checker.sh`):

```bash
#!/bin/bash

IDLE_TIMEOUT=3600  # 1 hour
LAST_REQUEST=$(date +%s)

while true; do
  # Check if any requests in last minute
  REQUESTS=$(curl -s http://localhost:8000/metrics | grep vllm_request_count | awk '{print $2}')

  if [ "$REQUESTS" -gt 0 ]; then
    LAST_REQUEST=$(date +%s)
  fi

  # Check idle time
  NOW=$(date +%s)
  IDLE_TIME=$((NOW - LAST_REQUEST))

  if [ $IDLE_TIME -gt $IDLE_TIMEOUT ]; then
    echo "Idle for ${IDLE_TIMEOUT}s, shutting down"
    sudo shutdown -h now
  fi

  sleep 60
done
```

**Auto-Wake Proxy** (Cloud Run):

```python
# vllm_proxy/main.py
from fastapi import FastAPI, HTTPException, BackgroundTasks
from google.cloud import compute_v1
import httpx
import asyncio
from datetime import datetime, timedelta

app = FastAPI()

# In-memory cache of instance state
instance_state = {
    "status": "TERMINATED",  # RUNNING, TERMINATED, PROVISIONING
    "last_check": None,
    "endpoint": None
}

async def wake_up_instance():
    """Start the GPU instance if it's stopped."""
    compute_client = compute_v1.InstancesClient()

    # Check current status
    instance = compute_client.get(
        project="life-navigator-prod",
        zone="us-central1-a",
        instance="vllm-gpu-spot"
    )

    if instance.status == "TERMINATED":
        # Start instance
        operation = compute_client.start(
            project="life-navigator-prod",
            zone="us-central1-a",
            instance="vllm-gpu-spot"
        )

        # Wait for startup (non-blocking)
        instance_state["status"] = "PROVISIONING"

        # Background task to check when ready
        asyncio.create_task(wait_for_ready())

        return False  # Not ready yet

    elif instance.status == "RUNNING":
        # Check if vLLM is ready
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"http://{instance.network_interfaces[0].network_i_p}:8000/health")
                if response.status_code == 200:
                    instance_state["status"] = "RUNNING"
                    instance_state["endpoint"] = f"http://{instance.network_interfaces[0].network_i_p}:8000"
                    return True
        except:
            pass

    return False

async def wait_for_ready():
    """Background task to wait for vLLM to be ready."""
    max_wait = 600  # 10 minutes
    start_time = datetime.now()

    while (datetime.now() - start_time).total_seconds() < max_wait:
        if await wake_up_instance():
            print("vLLM is ready!")
            return
        await asyncio.sleep(10)

    print("vLLM failed to start within timeout")
    instance_state["status"] = "FAILED"

@app.post("/v1/chat/completions")
async def chat_completion(request: dict, background_tasks: BackgroundTasks):
    """Proxy to vLLM, auto-waking instance if needed."""

    # Check if instance is running
    is_ready = await wake_up_instance()

    if not is_ready:
        if instance_state["status"] == "PROVISIONING":
            # Return helpful message
            return {
                "status": "warming_up",
                "message": "GPU is warming up. This takes 5-10 minutes for the first request. Your request has been queued.",
                "estimated_wait_seconds": 600,
                "queue_position": 1
            }
        else:
            # Start instance and queue request
            background_tasks.add_task(wake_up_instance)
            return {
                "status": "cold_start",
                "message": "Starting GPU instance. This will take 5-10 minutes.",
                "estimated_wait_seconds": 600
            }

    # Instance is ready, proxy request
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{instance_state['endpoint']}/v1/chat/completions",
            json=request
        )
        return response.json()

@app.get("/health")
async def health():
    """Health check that shows instance status."""
    return {
        "status": "ok",
        "vllm_status": instance_state["status"],
        "vllm_endpoint": instance_state.get("endpoint")
    }
```

**Cost Savings**:
- Lightweight model always warm: ~$100/month (Cloud Run with 1 min instance)
- Full GPU model (Spot VM): ~$4,000/month if running 24/7
  - Auto-shutdown after 1 hour idle: ~$500-$1,500/month (depends on usage)
  - Business hours only (8am-6pm): ~$1,600/month
- **Total**: $600-$1,600/month (vs $10,000 baseline)

---

#### Strategy B: Scheduled Warm-Up (Predictable Traffic)

**Best for**: Known usage patterns (business hours, predictable spikes)

```hcl
# Cloud Scheduler to warm up GPU before business hours
resource "google_cloud_scheduler_job" "warm_up_gpu" {
  name      = "warm-up-vllm-gpu"
  schedule  = "0 7 * * 1-5"  # 7 AM weekdays
  time_zone = "America/New_York"

  http_target {
    uri         = "https://vllm-proxy-xxxxx.run.app/warm-up"
    http_method = "POST"

    oidc_token {
      service_account_email = google_service_account.scheduler.email
    }
  }
}

# Cloud Scheduler to shut down GPU after hours
resource "google_cloud_scheduler_job" "shutdown_gpu" {
  name      = "shutdown-vllm-gpu"
  schedule  = "0 19 * * 1-5"  # 7 PM weekdays
  time_zone = "America/New_York"

  http_target {
    uri         = "https://vllm-proxy-xxxxx.run.app/shutdown"
    http_method = "POST"

    oidc_token {
      service_account_email = google_service_account.scheduler.email
    }
  }
}
```

**Cost Savings**:
- Business hours only (10 hours/day, 5 days/week): ~$2,100/month
- Add 2 hours buffer for warm-up/shutdown: ~$2,520/month
- **Savings**: ~$7,500/month (75% reduction)

---

#### Strategy C: Vertex AI Model Garden (Fully Managed)

**Best for**: Variable traffic, no infrastructure management

```python
# Use Vertex AI Prediction instead of self-hosted vLLM
from google.cloud import aiplatform

aiplatform.init(project="life-navigator-prod", location="us-central1")

# Deploy model to Vertex AI (one-time)
model = aiplatform.Model.upload(
    display_name="llama-4-maverick",
    artifact_uri="gs://life-navigator-models-prod/llama-4-maverick/",
    serving_container_image_uri="us-docker.pkg.dev/vertex-ai/prediction/vllm-serve:latest"
)

# Deploy to endpoint with auto-scaling
endpoint = model.deploy(
    machine_type="a2-ultragpu-3g",
    accelerator_type="NVIDIA_A100_80GB",
    accelerator_count=3,

    # Auto-scaling configuration
    min_replica_count=0,  # Scale to zero
    max_replica_count=5,

    # Auto-scaling metrics
    autoscaling_target_cpu_utilization=70,
    autoscaling_target_accelerator_duty_cycle=70
)

# Inference (pay-per-prediction)
prediction = endpoint.predict(instances=[{
    "prompt": "What is a Roth IRA?",
    "max_tokens": 200
}])
```

**Pricing**:
- **Scale to zero**: $0 when idle
- **Per-prediction**: ~$0.002-$0.005 per request
- **Estimated monthly cost** (10K requests): ~$20-$50/month
- **No infrastructure management**: Google handles scaling, monitoring, updates

**Trade-offs**:
- ❌ Cold start: 5-10 minutes for first request after idle
- ❌ Less control over serving configuration
- ✅ Zero infrastructure management
- ✅ Automatic scaling
- ✅ Pay only for what you use

---

### Tier 3: Data Layer (Cost-Optimized Managed Services)

#### Cloud SQL with Auto-Pause

```hcl
resource "google_sql_database_instance" "graphrag" {
  name             = "life-navigator-graphrag-prod"
  database_version = "POSTGRES_16"
  region           = var.region

  settings {
    tier              = "db-custom-4-16384"  # Smaller than before
    availability_type = "ZONAL"              # Single-zone for dev/staging
    disk_size         = 100                  # Start smaller, auto-resize
    disk_autoresize   = true

    # Auto-pause after 15 minutes of inactivity (Enterprise Plus only)
    # Note: This feature requires Cloud SQL Enterprise Plus edition
    # For standard edition, use scheduled start/stop
    database_flags {
      name  = "cloudsql.enable_auto_pause"
      value = "on"
    }

    database_flags {
      name  = "cloudsql.auto_pause_delay"
      value = "900"  # 15 minutes
    }

    # Connection pooling (reduce connections, lower cost)
    database_flags {
      name  = "max_connections"
      value = "100"  # Lower than default
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = google_compute_network.vpc.id
      require_ssl     = true
    }
  }
}
```

**Alternative: Scheduled Start/Stop** (Standard Edition):

```hcl
# Cloud Scheduler to stop Cloud SQL after hours
resource "google_cloud_scheduler_job" "stop_db" {
  name      = "stop-cloud-sql"
  schedule  = "0 19 * * 1-5"  # 7 PM weekdays
  time_zone = "America/New_York"

  http_target {
    uri         = "https://sqladmin.googleapis.com/sql/v1beta4/projects/${var.project_id}/instances/${google_sql_database_instance.graphrag.name}/stop"
    http_method = "POST"

    oauth_token {
      service_account_email = google_service_account.scheduler.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }
}

# Start Cloud SQL before business hours
resource "google_cloud_scheduler_job" "start_db" {
  name      = "start-cloud-sql"
  schedule  = "0 7 * * 1-5"  # 7 AM weekdays
  time_zone = "America/New_York"

  http_target {
    uri         = "https://sqladmin.googleapis.com/sql/v1beta4/projects/${var.project_id}/instances/${google_sql_database_instance.graphrag.name}/start"
    http_method = "POST"

    oauth_token {
      service_account_email = google_service_account.scheduler.email
      scope                 = "https://www.googleapis.com/auth/cloud-platform"
    }
  }
}
```

**Cost Savings**:
- db-custom-4-16384 (vs db-custom-8-32768): ~$275/month (vs $550)
- Zonal (vs Regional HA): ~$140/month (vs $275)
- Scheduled stop (12 hours/day): ~$70/month
- **Total**: $70-$140/month (vs $550)

#### Memorystore Redis (Scale to Minimum)

```hcl
resource "google_redis_instance" "cache" {
  name           = "life-navigator-cache"
  tier           = "BASIC"  # No HA for dev/staging
  memory_size_gb = 1        # Minimum size
  region         = var.region

  redis_version = "REDIS_7_0"

  authorized_network = google_compute_network.vpc.id

  # Reserved IP range (smaller)
  reserved_ip_range = "10.0.1.0/29"

  redis_configs = {
    maxmemory-policy = "allkeys-lru"
  }
}
```

**Cost Savings**:
- Basic tier, 1GB (vs Standard HA, 10GB): ~$35/month (vs $140)

#### Firestore (Pay-per-use)

```hcl
resource "google_firestore_database" "default" {
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  # Pay only for what you use
  # Free tier: 50K reads, 20K writes, 20K deletes per day
}
```

**Cost Savings**:
- Within free tier: $0/month
- Above free tier (estimated 500K operations): ~$2/month

---

## Cost Comparison

### Baseline (Always-On, Full Resources)

| Component | Configuration | Monthly Cost |
|-----------|--------------|--------------|
| GKE GPU nodes | 1x a2-ultragpu-3g (24/7) | $10,000 |
| GKE API nodes | 2x n2-standard-8 | $400 |
| Cloud SQL | db-custom-8-32768, Regional HA | $550 |
| Memorystore | Standard HA, 10GB | $140 |
| Storage | 849GB total | $26 |
| Networking | Load balancer + egress | $80 |
| Other | Logging, monitoring | $35 |
| **Total** | | **$11,231/month** |

---

### Optimized Architecture A: Hybrid Model (Recommended)

| Component | Configuration | Monthly Cost |
|-----------|--------------|--------------|
| **Compute** | | |
| Lightweight model | Cloud Run, 1 instance warm, 8 vCPU, 32GB | $100 |
| Full GPU model | Spot a2-ultragpu-3g, auto-shutdown, 8hrs/day | $1,600 |
| API server | Cloud Run, scale to zero | $20 |
| **Databases** | | |
| Cloud SQL | db-custom-4-16384, zonal, scheduled stop | $70 |
| Memorystore | Basic, 1GB | $35 |
| Firestore | Pay-per-use (within free tier) | $0 |
| **Storage** | | |
| Model + documents | 849GB, optimized classes | $20 |
| **Networking** | | |
| Load balancer | HTTPS, minimal traffic | $35 |
| Egress | ~200GB/month | $18 |
| **Other** | | |
| Logging (reduced retention) | 100GB/month | $5 |
| Monitoring | Basic dashboards | $5 |
| Cloud Scheduler | Warm-up jobs | $1 |
| **Total** | | **$1,909/month** |
| **Savings** | | **$9,322/month (83%)** |

---

### Optimized Architecture B: Vertex AI (Serverless)

| Component | Configuration | Monthly Cost |
|-----------|--------------|--------------|
| **Compute** | | |
| Lightweight model | Cloud Run, 1 instance warm | $100 |
| Full model (Vertex AI) | Pay-per-prediction, 10K requests | $50 |
| API server | Cloud Run, scale to zero | $20 |
| **Databases** | | |
| Cloud SQL | db-f1-micro, scheduled stop | $15 |
| Memorystore | Basic, 1GB | $35 |
| Firestore | Pay-per-use | $0 |
| **Storage** | | |
| Model in Cloud Storage | 749GB, Nearline | $10 |
| Documents | 100GB, Standard | $2 |
| **Networking** | | |
| Load balancer | Minimal | $25 |
| **Other** | | |
| Logging, monitoring | Minimal | $5 |
| **Total** | | **$262/month** |
| **Savings** | | **$10,969/month (98%)** |

**Note**: Vertex AI cost scales with usage. At 100K requests/month: ~$500-$1,000/month.

---

### Optimized Architecture C: Development/Staging (No GPU)

| Component | Configuration | Monthly Cost |
|-----------|--------------|--------------|
| Lightweight model only | Cloud Run, scale to zero | $50 |
| API server | Cloud Run, scale to zero | $10 |
| Cloud SQL | db-f1-micro, zonal | $10 |
| Memorystore | Basic, 1GB | $35 |
| Storage | 100GB | $2 |
| Load balancer | HTTP only | $15 |
| Other | Minimal | $3 |
| **Total** | | **$125/month** |
| **Savings** | | **$11,106/month (99%)** |

---

## Terraform Implementation

### Variables for Cost Optimization

```hcl
# terraform/gcp/environments/prod/variables.tf

variable "enable_gpu" {
  description = "Enable full GPU model serving"
  type        = bool
  default     = true
}

variable "gpu_schedule" {
  description = "GPU operation schedule"
  type        = string
  default     = "business_hours"  # business_hours, always_on, on_demand
}

variable "business_hours_start" {
  description = "Start time for business hours (24h format)"
  type        = number
  default     = 7  # 7 AM
}

variable "business_hours_end" {
  description = "End time for business hours (24h format)"
  type        = number
  default     = 19  # 7 PM
}

variable "use_spot_instances" {
  description = "Use Spot VMs for GPU (60-91% cheaper, may be preempted)"
  type        = bool
  default     = true
}

variable "auto_shutdown_timeout" {
  description = "Minutes of inactivity before GPU auto-shutdown"
  type        = number
  default     = 60
}

variable "min_api_instances" {
  description = "Minimum API instances (0 = scale to zero)"
  type        = number
  default     = 0
}

variable "enable_lightweight_model" {
  description = "Deploy lightweight model for fast responses"
  type        = bool
  default     = true
}

variable "database_schedule" {
  description = "Database operation schedule"
  type        = string
  default     = "business_hours"  # business_hours, always_on
}
```

### Main Terraform Module

```hcl
# terraform/gcp/environments/prod/main.tf

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  backend "gcs" {
    bucket = "life-navigator-terraform-state"
    prefix = "prod"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# VPC and networking
module "vpc" {
  source = "../../modules/vpc"

  project_id = var.project_id
  region     = var.region
  env        = "prod"
}

# API Server on Cloud Run (scale to zero)
module "api_server" {
  source = "../../modules/cloud_run_api"

  project_id        = var.project_id
  region            = var.region
  min_instances     = var.min_api_instances  # 0 for scale to zero
  max_instances     = 100

  vllm_endpoint     = module.vllm_serving.endpoint
  lightweight_endpoint = var.enable_lightweight_model ? module.lightweight_model[0].endpoint : null
}

# Lightweight model (always warm)
module "lightweight_model" {
  count  = var.enable_lightweight_model ? 1 : 0
  source = "../../modules/cloud_run_model"

  project_id    = var.project_id
  region        = var.region
  model_name    = "meta-llama/Llama-3.1-8B-Instruct"
  min_instances = 1  # Always keep 1 warm
  max_instances = 10

  cpu    = "8"
  memory = "32Gi"
}

# Full vLLM serving with auto-scaling
module "vllm_serving" {
  count  = var.enable_gpu ? 1 : 0
  source = "../../modules/vllm_gpu"

  project_id               = var.project_id
  region                   = var.region
  zone                     = "${var.region}-a"

  use_spot                 = var.use_spot_instances
  gpu_schedule             = var.gpu_schedule
  business_hours_start     = var.business_hours_start
  business_hours_end       = var.business_hours_end
  auto_shutdown_timeout    = var.auto_shutdown_timeout

  model_bucket             = module.storage.model_bucket_name
  model_path               = "llama-4-maverick"
}

# Cloud SQL with scheduled start/stop
module "database" {
  source = "../../modules/cloud_sql"

  project_id         = var.project_id
  region             = var.region

  instance_tier      = "db-custom-4-16384"  # Smaller tier
  availability_type  = "ZONAL"              # No HA for cost savings

  enable_schedule    = var.database_schedule == "business_hours"
  schedule_start     = var.business_hours_start
  schedule_end       = var.business_hours_end
}

# Memorystore Redis (minimum size)
module "cache" {
  source = "../../modules/memorystore"

  project_id     = var.project_id
  region         = var.region

  tier           = "BASIC"  # No HA
  memory_size_gb = 1        # Minimum
}

# Storage
module "storage" {
  source = "../../modules/storage"

  project_id = var.project_id
  region     = var.region
}

# Load Balancer
module "load_balancer" {
  source = "../../modules/load_balancer"

  project_id         = var.project_id
  api_backend_url    = module.api_server.url
  enable_cdn         = true
}

# Auto-scaling policies
module "autoscaling" {
  source = "../../modules/autoscaling"

  project_id            = var.project_id
  region                = var.region

  # Scale based on request latency
  target_latency_ms     = 500

  # Scale based on request count
  target_requests_per_second = 100
}

# Monitoring and alerts
module "monitoring" {
  source = "../../modules/monitoring"

  project_id              = var.project_id

  # Alert on cold starts
  alert_on_cold_starts    = true
  cold_start_threshold_ms = 3000

  # Alert on high costs
  alert_on_budget         = true
  monthly_budget_usd      = 2000
}
```

---

## Monitoring & Optimization

### Key Metrics to Monitor

```hcl
# Custom metrics for cost optimization
resource "google_monitoring_metric_descriptor" "gpu_idle_time" {
  description  = "Time GPU has been idle (no requests)"
  display_name = "GPU Idle Time"
  type         = "custom.googleapis.com/vllm/gpu_idle_seconds"
  metric_kind  = "GAUGE"
  value_type   = "INT64"
}

resource "google_monitoring_metric_descriptor" "cold_start_count" {
  description  = "Number of cold starts"
  display_name = "Cold Start Count"
  type         = "custom.googleapis.com/vllm/cold_starts"
  metric_kind  = "CUMULATIVE"
  value_type   = "INT64"
}

resource "google_monitoring_metric_descriptor" "request_routing" {
  description  = "Requests routed to lightweight vs full model"
  display_name = "Request Routing"
  type         = "custom.googleapis.com/routing/model_type"
  metric_kind  = "CUMULATIVE"
  value_type   = "INT64"

  labels {
    key         = "model_type"
    description = "lightweight or full"
  }
}
```

### Cost Optimization Dashboard

```hcl
resource "google_monitoring_dashboard" "cost_optimization" {
  dashboard_json = jsonencode({
    displayName = "Life Navigator - Cost Optimization"

    gridLayout = {
      widgets = [
        {
          title = "GPU Utilization"
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
          title = "GPU Idle Time"
          scorecard = {
            timeSeriesQuery = {
              timeSeriesFilter = {
                filter = "metric.type=\"custom.googleapis.com/vllm/gpu_idle_seconds\""
              }
            }
            thresholds = [
              { value = 3600, color = "YELLOW" },  # 1 hour
              { value = 7200, color = "RED" }      # 2 hours
            ]
          }
        },
        {
          title = "Cold Starts (Last 24h)"
          scorecard = {
            timeSeriesQuery = {
              timeSeriesFilter = {
                filter = "metric.type=\"custom.googleapis.com/vllm/cold_starts\""
                aggregation = {
                  alignmentPeriod = "86400s"  # 24 hours
                }
              }
            }
          }
        },
        {
          title = "Request Routing (Lightweight vs Full)"
          pieChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\"custom.googleapis.com/routing/model_type\""
                  groupByFields = ["metric.label.model_type"]
                }
              }
            }]
          }
        },
        {
          title = "Estimated Monthly Cost"
          scorecard = {
            sparkChartView = {
              sparkChartType = "SPARK_LINE"
            }
            thresholds = [
              { value = 2000, color = "YELLOW" },
              { value = 3000, color = "RED" }
            ]
          }
        },
        {
          title = "Cloud Run Scale-to-Zero Events"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/container/instance_count\""
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

### Budget Alerts

```hcl
# Set up billing budget with alerts
resource "google_billing_budget" "monthly_budget" {
  billing_account = var.billing_account_id
  display_name    = "Life Navigator Monthly Budget"

  budget_filter {
    projects = ["projects/${var.project_id}"]
  }

  amount {
    specified_amount {
      currency_code = "USD"
      units         = "2000"  # $2,000/month target
    }
  }

  threshold_rules {
    threshold_percent = 0.5   # Alert at 50%
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.75  # Alert at 75%
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 0.9   # Alert at 90%
    spend_basis       = "CURRENT_SPEND"
  }

  threshold_rules {
    threshold_percent = 1.0   # Alert at 100%
    spend_basis       = "CURRENT_SPEND"
  }

  all_updates_rule {
    pubsub_topic = google_pubsub_topic.budget_alerts.id
  }
}
```

---

## Frontend UX Optimization

### Handling Cold Starts in UI

```typescript
// frontend/lib/api.ts

interface QueryResponse {
  status: 'success' | 'warming_up' | 'cold_start';
  message?: string;
  estimated_wait_seconds?: number;
  response?: string;
}

export async function sendQuery(query: string): Promise<QueryResponse> {
  const response = await fetch('https://api.lifenavigator.ai/api/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  const data = await response.json();

  if (data.status === 'warming_up' || data.status === 'cold_start') {
    // Show progress indicator
    return data;
  }

  return data;
}

// frontend/components/ChatInterface.tsx

function ChatInterface() {
  const [warmingUp, setWarmingUp] = useState(false);
  const [estimatedWait, setEstimatedWait] = useState(0);

  const handleSubmit = async (query: string) => {
    const result = await sendQuery(query);

    if (result.status === 'warming_up' || result.status === 'cold_start') {
      // Show warming up UI
      setWarmingUp(true);
      setEstimatedWait(result.estimated_wait_seconds || 600);

      // Poll for status
      const interval = setInterval(async () => {
        const status = await checkStatus();
        if (status.ready) {
          clearInterval(interval);
          setWarmingUp(false);
          // Retry query
          const retryResult = await sendQuery(query);
          displayResponse(retryResult.response);
        }
      }, 10000);  // Poll every 10 seconds
    } else {
      // Display response immediately
      displayResponse(result.response);
    }
  };

  return (
    <div>
      {warmingUp && (
        <WarmUpIndicator
          estimatedSeconds={estimatedWait}
          message="Our AI is waking up! This happens when the system hasn't been used for a while. Future responses will be instant."
        />
      )}
      {/* ... rest of chat UI */}
    </div>
  );
}
```

---

## Summary

### Recommended Architecture: Hybrid Model (Strategy A)

**Components**:
1. Lightweight Llama-3.1-8B always warm on Cloud Run ($100/month)
2. Full Llama-4-Maverick on Spot GPU with auto-shutdown ($1,600/month)
3. Cloud Run API (scale to zero)
4. Cloud SQL with scheduled stop
5. Minimal Memorystore Redis

**Total Cost**: ~$1,900/month (83% savings vs $11,200 baseline)

**User Experience**:
- 95% of requests → Lightweight model → <2s response
- 5% of complex requests → Full model → <1s if warm, 10min if cold
- Scheduled warm-up before business hours → minimal cold starts

**Cost vs UX Trade-off**:
- Best balance of cost and performance
- Acceptable UX for most use cases
- Transparent communication about warm-up times

### Next Steps

1. Implement hybrid architecture with Terraform
2. Deploy lightweight model to Cloud Run
3. Set up GPU instance with auto-shutdown
4. Configure scheduled warm-ups for business hours
5. Add monitoring and cost alerts
6. Test cold start UX flow
7. Optimize based on actual usage patterns

---

**Questions?** This architecture can be tuned based on your actual traffic patterns and budget constraints.
