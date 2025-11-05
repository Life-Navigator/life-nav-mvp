# Life Navigator - Development Environment

This directory contains Terraform configuration for the **development environment** (~$950/month).

## Architecture

### Managed Services
- **Cloud SQL (PostgreSQL)**: 2 vCPU, 7.5GB RAM, single zone
- **Memorystore (Redis)**: Basic tier, 1GB
- **Cloud Storage**: Models, documents, backups buckets
- **Secret Manager**: API keys and credentials
- **IAM**: Service accounts for API, data pipeline, MCP server
- **Monitoring**: Alerts, dashboards, log retention

### Cost-Saving Features
- Scheduled start/stop for Cloud SQL (weekdays 7 AM - 7 PM)
- Single-zone deployment
- Minimal Redis tier
- Lifecycle policies on storage
- 30-day log retention

## Prerequisites

1. **GCP Project**: Create a new GCP project for development
2. **Terraform**: Install Terraform >= 1.5.0
3. **GCP CLI**: Install and authenticate with `gcloud auth login`
4. **Enable APIs**:
   ```bash
   gcloud services enable compute.googleapis.com
   gcloud services enable sqladmin.googleapis.com
   gcloud services enable redis.googleapis.com
   gcloud services enable storage-api.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   gcloud services enable cloudscheduler.googleapis.com
   gcloud services enable monitoring.googleapis.com
   gcloud services enable logging.googleapis.com
   ```

## Setup

### 1. Create Terraform State Bucket

```bash
# Set your project ID
export PROJECT_ID="your-gcp-project-id"

# Create state bucket
gsutil mb -p $PROJECT_ID -l us-central1 gs://life-navigator-terraform-state-dev

# Enable versioning
gsutil versioning set on gs://life-navigator-terraform-state-dev

# Set lifecycle policy
cat > lifecycle.json <<EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {
          "numNewerVersions": 10
        }
      }
    ]
  }
}
EOF
gsutil lifecycle set lifecycle.json gs://life-navigator-terraform-state-dev
```

### 2. Configure Variables

```bash
# Copy example variables
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

Example `terraform.tfvars`:
```hcl
project_id  = "life-navigator-dev-12345"
region      = "us-central1"
alert_email = "alerts@yourcompany.com"
```

### 3. Initialize Terraform

```bash
terraform init
```

### 4. Review Plan

```bash
terraform plan
```

Expected resources:
- VPC network with private subnet
- Cloud SQL PostgreSQL instance
- Memorystore Redis instance
- 3 Cloud Storage buckets
- 4 Secret Manager secrets
- 3 Service accounts
- Monitoring dashboards and alerts
- Budget alert ($1,500/month threshold)

### 5. Apply Configuration

```bash
terraform apply
```

This will take **10-15 minutes** to provision all resources.

## Post-Deployment

### 1. Set Secrets

After deployment, add secret values:

```bash
# Neo4j Aura connection
echo -n "neo4j+s://xxxxx.databases.neo4j.io" | \
  gcloud secrets versions add neo4j-aura-connection-string-dev --data-file=-

# Qdrant Cloud API key
echo -n "your-qdrant-api-key" | \
  gcloud secrets versions add qdrant-cloud-api-key-dev --data-file=-

# Maverick API key
echo -n "your-maverick-api-key" | \
  gcloud secrets versions add maverick-api-key-dev --data-file=-

# JWT secret
openssl rand -base64 32 | \
  gcloud secrets versions add jwt-secret-key-dev --data-file=-
```

### 2. Create Database Users

```bash
# Get Cloud SQL connection name
CONNECTION_NAME=$(terraform output -raw cloud_sql_connection_name)

# Connect using Cloud SQL proxy
cloud-sql-proxy $CONNECTION_NAME &

# Create additional users/schemas
psql "host=127.0.0.1 user=lifenavigator dbname=graphrag" \
  -c "CREATE SCHEMA IF NOT EXISTS documents;"
```

### 3. Configure Redis

Redis is automatically configured with:
- `maxmemory-policy`: allkeys-lru (evict least recently used)
- `timeout`: 300 seconds

### 4. Access Monitoring

```bash
# Get dashboard URLs
echo "Cloud SQL Dashboard:"
terraform output -json | jq -r '.dashboard_ids.value.cloudsql'

echo "Redis Dashboard:"
terraform output -json | jq -r '.dashboard_ids.value.redis'
```

## Daily Operations

### Start Cloud SQL (if scheduled stop)

Cloud SQL automatically starts at 7 AM weekdays. To start manually:

```bash
gcloud sql instances patch life-navigator-db-dev \
  --activation-policy ALWAYS
```

### Stop Cloud SQL (save costs)

```bash
gcloud sql instances patch life-navigator-db-dev \
  --activation-policy NEVER
```

### Check Costs

```bash
# Current month costs
gcloud billing projects describe $PROJECT_ID \
  --format="value(billing_account_name)"

# View budget alerts
gcloud alpha billing budgets list \
  --billing-account=YOUR_BILLING_ACCOUNT_ID
```

## Troubleshooting

### Cloud SQL won't start

```bash
# Check instance status
gcloud sql instances describe life-navigator-db-dev

# View logs
gcloud sql operations list --instance=life-navigator-db-dev --limit=5
```

### Redis connection issues

```bash
# Check Redis status
gcloud redis instances describe life-navigator-cache-dev \
  --region=us-central1

# Verify VPC peering
gcloud services vpc-peerings list \
  --network=life-navigator-vpc-dev
```

### Secrets access denied

```bash
# Grant access to service account
gcloud secrets add-iam-policy-binding neo4j-aura-connection-string-dev \
  --member="serviceAccount:api-server-dev@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

## Cost Monitoring

Expected monthly costs (~$950):
- Cloud SQL: ~$120 (with scheduled stop)
- Memorystore Redis: ~$40
- Cloud Storage: ~$20
- Networking: ~$10
- Monitoring: ~$5
- **Buffer**: ~$755 for development resources

### Cost Alerts

Budget alerts configured at:
- 50% ($750) - Warning
- 80% ($1,200) - Urgent
- 100% ($1,500) - Critical

## Destroying Resources

**WARNING**: This will delete all data!

```bash
# Review what will be destroyed
terraform plan -destroy

# Destroy all resources
terraform destroy
```

## Next Steps

1. **Sign up for managed services**:
   - [Neo4j Aura](https://neo4j.com/cloud/aura/) - Graph database
   - [Qdrant Cloud](https://cloud.qdrant.io/) - Vector database

2. **Deploy application**:
   - Build FastAPI backend
   - Deploy to Cloud Run
   - Connect to managed services

3. **Set up CI/CD**:
   - GitHub Actions
   - Automated testing
   - Deployment pipelines

## Support

For issues or questions:
- Review logs in Cloud Console
- Check [GCP Status Dashboard](https://status.cloud.google.com/)
- Consult [Terraform GCP Provider Docs](https://registry.terraform.io/providers/hashicorp/google/latest/docs)

---

**Environment**: Development
**Cost Target**: ~$950/month
**Last Updated**: 2025-10-31
