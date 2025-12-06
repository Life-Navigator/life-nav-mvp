# Life Navigator - GCP Infrastructure (Cloud Run Scale-to-Zero)

## Architecture Overview

This infrastructure uses **Cloud Run** for all stateless services with **scale-to-zero** capability, ensuring minimal costs during low-usage periods like the beta launch phase.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Internet / Users                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Cloud Run: ln-api-gateway                                 │
│                    (min_instances: 0, scales to zero)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
          ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
          │ ln-orchestrator │ │ ln-graphrag │ │ ln-compliance   │
          │ (scale-to-zero) │ │ (scale-to-0)│ │ (scale-to-zero) │
          └─────────────────┘ └─────────────┘ └─────────────────┘
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
          ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
          │   Cloud SQL     │ │   Redis     │ │  Cloud Storage  │
          │  (always-on)    │ │  (BASIC)    │ │                 │
          └─────────────────┘ └─────────────┘ └─────────────────┘
                                    │
                                    │ (external call)
                                    ▼
          ┌─────────────────────────────────────────────────────┐
          │              DGX-Spark (Heavy AI Workloads)          │
          │           GPU inference, LLM, embeddings             │
          └─────────────────────────────────────────────────────┘
```

## Cost Breakdown (Beta Environment)

| Resource | Configuration | Monthly Cost (Idle) | Monthly Cost (Active) |
|----------|--------------|---------------------|----------------------|
| Cloud SQL | db-f1-micro, ZONAL | ~$7-10 | ~$30-50 |
| Redis | BASIC, 1GB | ~$30-35 | ~$35 |
| Cloud Run Services | 4 services, min=0 | ~$0 | Pay per request |
| Cloud Run Jobs | 2 jobs, scheduled | ~$0 | Pay per execution |
| VPC Connector | e2-micro, 2 instances | ~$10-15 | ~$15 |
| Storage | Standard, small usage | ~$1-5 | ~$5-10 |
| **Total** | | **~$50-70** | **~$100-150** |

## Services

### Cloud Run Services (Scale-to-Zero)

| Service | Port | CPU | Memory | Max Instances | Purpose |
|---------|------|-----|--------|---------------|---------|
| `ln-api-gateway` | 8080 | 1 | 512Mi | 5 | Main API entry point |
| `ln-agent-orchestrator` | 8080 | 2 | 1Gi | 3 | Multi-agent coordination |
| `ln-graphrag-api` | 8080 | 1 | 1Gi | 3 | Graph-based RAG queries |
| `ln-compliance-checker` | 8080 | 1 | 512Mi | 2 | Document compliance checks |

### Cloud Run Jobs (Batch Processing)

| Job | Schedule | CPU | Memory | Purpose |
|-----|----------|-----|--------|---------|
| `ln-proactive-scan` | Every 6 hours | 2 | 2Gi | Proactive document scanning |
| `ln-ingestion-job` | On-demand | 2 | 4Gi | Document ingestion pipeline |

## Directory Structure

```
terraform/gcp/
├── environments/
│   └── beta/
│       ├── main.tf           # Main configuration
│       ├── variables.tf      # Variable definitions
│       └── terraform.tfvars  # Variable values
│
├── modules/
│   ├── cloud-run/            # Cloud Run service module
│   ├── cloud-run-job/        # Cloud Run job module
│   ├── artifact-registry/    # Container registry
│   ├── vpc-connector/        # VPC Access Connector
│   ├── vpc/                  # VPC networking
│   ├── cloud-sql/            # PostgreSQL database
│   ├── memorystore/          # Redis cache
│   ├── secret-manager/       # Secrets management
│   ├── storage/              # Cloud Storage
│   └── iam/                  # Service accounts
│
└── GCP_INFRA_README.md       # This file
```

## Deployment

### Prerequisites

1. GCP Project with billing enabled
2. GitHub repository with Workload Identity Federation configured
3. Required GitHub Secrets:
   - `GCP_PROJECT_ID`: `lifenav-prod`
   - `GCP_WORKLOAD_IDENTITY_PROVIDER`: `projects/816649286806/locations/global/workloadIdentityPools/github-pool/providers/github-provider`
   - `GCP_SERVICE_ACCOUNT`: `terraform-deployer@lifenav-prod.iam.gserviceaccount.com`
   - `GCP_REGION`: `us-central1`

### Manual Deployment

```bash
cd terraform/gcp/environments/beta

# Initialize Terraform
terraform init

# Plan changes
terraform plan

# Apply changes
terraform apply
```

### CI/CD Deployment

Push to `beta` or `main` branch to trigger automatic deployment via GitHub Actions.

## Environment Variables

### API Gateway
- `ENVIRONMENT`: beta
- `REDIS_HOST`: Redis private IP
- `ORCHESTRATOR_URL`: Internal Cloud Run URL
- `GRAPHRAG_URL`: Internal Cloud Run URL
- `COMPLIANCE_URL`: Internal Cloud Run URL
- `DGX_SPARK_URL`: External DGX-Spark endpoint

### Secrets (via Secret Manager)
- `database-password-beta`: PostgreSQL password
- `jwt-secret-beta`: JWT signing secret
- `nextauth-secret-beta`: NextAuth secret
- `dgx-spark-api-key-beta`: DGX-Spark API key

## DGX-Spark Integration

Heavy AI workloads (LLM inference, embedding generation, vector operations) are offloaded to DGX-Spark via HTTP API calls:

```python
# Example: Calling DGX-Spark from Cloud Run
import httpx

async def generate_embeddings(text: str) -> list[float]:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{os.environ['DGX_SPARK_URL']}/v1/embeddings",
            json={"input": text, "model": "text-embedding-3-small"},
            headers={"Authorization": f"Bearer {os.environ['DGX_SPARK_API_KEY']}"},
            timeout=30.0
        )
        return response.json()["data"][0]["embedding"]
```

## Scaling Behavior

### Cold Start Mitigation
- `startup_cpu_boost: true` - 2x CPU during startup
- `cpu_idle: true` - CPU throttled when no requests

### Scaling Triggers
- Scale up: Based on concurrent requests per instance
- Scale down: Automatic after idle period (no requests)
- Scale to zero: After ~15 minutes of inactivity

## Monitoring

### Cloud Run Metrics
- Request count, latency, error rate
- Instance count over time
- Cold start frequency

### Cloud SQL Insights
- Query performance
- Connection count
- Storage usage

### Recommended Alerts
- API Gateway error rate > 1%
- Cold start latency > 10s
- Cloud SQL CPU > 80%

## Security

### Network Security
- VPC Connector for private networking
- Private Google Access enabled
- Firewall rules restrict internal traffic

### Authentication
- Workload Identity Federation (no service account keys)
- Cloud Run services authenticated via IAM
- API Gateway allows unauthenticated (public API)

### Secrets
- Stored in Secret Manager
- Accessed via native Cloud Run secret injection
- Automatic rotation support

## Troubleshooting

### Service Not Responding
```bash
# Check service status
gcloud run services describe ln-api-gateway --region=us-central1

# View logs
gcloud run services logs read ln-api-gateway --region=us-central1 --limit=50
```

### Database Connection Issues
```bash
# Check Cloud SQL status
gcloud sql instances describe life-navigator-db-beta

# Test connectivity from Cloud Shell
gcloud sql connect life-navigator-db-beta --user=postgres
```

### Job Failures
```bash
# View job execution history
gcloud run jobs executions list --job=ln-proactive-scan --region=us-central1

# View specific execution logs
gcloud run jobs executions logs <execution-name> --region=us-central1
```

## Cost Optimization Tips

1. **Scale-to-Zero**: Already configured with `min_instances: 0`
2. **Right-size Resources**: Start small, scale up based on metrics
3. **Schedule Jobs Wisely**: Adjust proactive scan frequency based on usage
4. **Use BASIC Redis**: Standard tier only needed for HA in production
5. **ZONAL SQL**: No HA replication in beta (acceptable for non-production)
