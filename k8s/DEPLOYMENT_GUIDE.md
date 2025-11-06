# Life Navigator GKE Deployment Guide

This guide walks through deploying the Life Navigator application to Google Kubernetes Engine (GKE) using Terraform and Kubernetes manifests.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Infrastructure Setup (Terraform)](#infrastructure-setup-terraform)
3. [Application Deployment (Kubernetes)](#application-deployment-kubernetes)
4. [Post-Deployment Configuration](#post-deployment-configuration)
5. [Verification](#verification)
6. [Common Issues](#common-issues)

## Prerequisites

### Tools Required

```bash
# Install gcloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Install kubectl
gcloud components install kubectl

# Install kustomize
curl -s "https://raw.githubusercontent.com/kubernetes-sigs/kustomize/master/hack/install_kustomize.sh" | bash
sudo mv kustomize /usr/local/bin/

# Install Terraform
wget https://releases.hashicorp.com/terraform/1.6.6/terraform_1.6.6_linux_amd64.zip
unzip terraform_1.6.6_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Verify installations
gcloud --version
kubectl version --client
kustomize version
terraform --version
```

### GCP Setup

```bash
# Login to GCP
gcloud auth login
gcloud auth application-default login

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
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  servicenetworking.googleapis.com \
  monitoring.googleapis.com \
  logging.googleapis.com
```

### Create GCS Bucket for Terraform State

```bash
# Create bucket for Terraform state
gsutil mb -l us-central1 gs://life-navigator-terraform-state-dev

# Enable versioning
gsutil versioning set on gs://life-navigator-terraform-state-dev
```

### Prepare Secrets in GCP Secret Manager

```bash
# Database credentials
echo -n "postgres" | gcloud secrets create cloud-sql-db-user --data-file=-
echo -n "your-secure-password" | gcloud secrets create cloud-sql-db-password --data-file=-
echo -n "10.0.0.3" | gcloud secrets create cloud-sql-db-host --data-file=-
echo -n "graphrag" | gcloud secrets create cloud-sql-db-name --data-file=-

# Redis
echo -n "your-redis-auth" | gcloud secrets create redis-auth-string --data-file=-
echo -n "10.0.1.3" | gcloud secrets create redis-host --data-file=-

# JWT secret
openssl rand -base64 32 | gcloud secrets create jwt-secret-key --data-file=-

# Neo4j Aura
echo -n "neo4j+s://your-instance.databases.neo4j.io" | gcloud secrets create neo4j-aura-connection-string --data-file=-
echo -n "your-neo4j-password" | gcloud secrets create neo4j-aura-password --data-file=-

# Qdrant Cloud
echo -n "your-qdrant-api-key" | gcloud secrets create qdrant-cloud-api-key --data-file=-

# Maverick API key
echo -n "your-maverick-key" | gcloud secrets create maverick-api-key --data-file=-
```

## Infrastructure Setup (Terraform)

### Step 1: Configure Variables

Create `terraform/gcp/environments/dev/terraform.tfvars`:

```hcl
project_id  = "your-project-id"
region      = "us-central1"
alert_email = "your-email@example.com"
```

### Step 2: Update VPC Configuration

The VPC module needs secondary IP ranges for GKE. Update `terraform/gcp/modules/vpc/main.tf` to add:

```hcl
# In the subnet resource, add:
secondary_ip_range {
  range_name    = "pods"
  ip_cidr_range = "10.1.0.0/16"
}

secondary_ip_range {
  range_name    = "services"
  ip_cidr_range = "10.2.0.0/16"
}
```

Or modify the dev environment to create additional subnets with secondary ranges.

### Step 3: Deploy Infrastructure

```bash
cd terraform/gcp/environments/dev

# Initialize Terraform
terraform init

# Review plan
terraform plan

# Apply infrastructure (takes 15-30 minutes)
terraform apply

# Save outputs
terraform output > outputs.txt
```

This creates:
- VPC with private subnets
- Cloud SQL PostgreSQL instance
- Redis (Memorystore) instance
- Cloud Storage buckets
- GKE Autopilot cluster
- External Secrets Operator
- IAM service accounts
- Secret Manager integration

### Step 4: Configure kubectl

```bash
# Get cluster credentials
gcloud container clusters get-credentials \
  $(terraform output -raw gke_cluster_name) \
  --region us-central1 \
  --project $PROJECT_ID

# Verify connection
kubectl cluster-info
kubectl get nodes
```

### Step 5: Verify External Secrets Operator

```bash
# Check ESO installation
kubectl get pods -n external-secrets-system

# Check ClusterSecretStore
kubectl get clustersecretstore
kubectl describe clustersecretstore gcpsm-secret-store
```

## Application Deployment (Kubernetes)

### Step 1: Build and Push Container Images

```bash
# Set variables
export PROJECT_ID="your-project-id"
export IMAGE_TAG="dev-$(git rev-parse --short HEAD)"

# Build backend image
cd backend
docker build -t gcr.io/$PROJECT_ID/life-navigator-backend:$IMAGE_TAG .

# Push to Google Container Registry
docker push gcr.io/$PROJECT_ID/life-navigator-backend:$IMAGE_TAG

# Tag as latest for dev
docker tag gcr.io/$PROJECT_ID/life-navigator-backend:$IMAGE_TAG \
  gcr.io/$PROJECT_ID/life-navigator-backend:dev-latest
docker push gcr.io/$PROJECT_ID/life-navigator-backend:dev-latest
```

### Step 2: Update Kubernetes Manifests

```bash
cd k8s/overlays/dev

# Update PROJECT_ID in kustomization.yaml
sed -i "s/PROJECT_ID/$PROJECT_ID/g" kustomization.yaml

# Update image tag
kustomize edit set image gcr.io/$PROJECT_ID/life-navigator-backend:$IMAGE_TAG

# Also update in base/backend/serviceaccount.yaml
sed -i "s/PROJECT_ID/$PROJECT_ID/g" ../../base/backend/serviceaccount.yaml
```

### Step 3: Deploy Application

```bash
# Preview what will be deployed
kubectl kustomize overlays/dev

# Apply manifests
kubectl apply -k overlays/dev

# Watch deployment
kubectl get pods -n life-navigator-dev -w
```

### Step 4: Wait for External Secrets

```bash
# Check ExternalSecret status
kubectl get externalsecrets -n life-navigator-dev

# Wait for secrets to be created
kubectl wait --for=condition=Ready externalsecret/backend-secrets \
  -n life-navigator-dev --timeout=5m

# Verify secrets were created
kubectl get secrets -n life-navigator-dev
```

### Step 5: Monitor Deployment

```bash
# Check deployment status
kubectl rollout status deployment/backend -n life-navigator-dev

# Check pods
kubectl get pods -n life-navigator-dev

# Check logs
kubectl logs -n life-navigator-dev -l app=backend --tail=100 -f

# Check HPA
kubectl get hpa -n life-navigator-dev
```

## Post-Deployment Configuration

### Configure DNS

```bash
# Get ingress IP address
kubectl get ingress life-navigator -n life-navigator-dev

# Add A record in your DNS provider:
# api-dev.life-navigator.app -> INGRESS_IP
```

### Wait for SSL Certificate

```bash
# Check certificate status
kubectl get managedcertificate -n life-navigator-dev
kubectl describe managedcertificate life-navigator-cert -n life-navigator-dev

# This can take 15-60 minutes
# Status should change from "Provisioning" to "Active"
```

### Configure Workload Identity Binding

The Terraform already created the IAM bindings, but verify:

```bash
# Check service account annotation
kubectl get sa backend -n life-navigator-dev -o yaml | grep iam.gke.io

# Verify IAM binding
gcloud iam service-accounts get-iam-policy \
  api-server-dev@$PROJECT_ID.iam.gserviceaccount.com
```

## Verification

### Health Checks

```bash
# Port-forward to test locally first
kubectl port-forward -n life-navigator-dev svc/backend 8080:8000

# Test health endpoint
curl http://localhost:8080/health

# Test API docs
curl http://localhost:8080/docs
```

### Test via Ingress

```bash
# Get ingress URL
INGRESS_URL=$(kubectl get ingress life-navigator -n life-navigator-dev -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

# Test (may take time for SSL to provision)
curl -k https://api-dev.life-navigator.app/health
curl -k https://api-dev.life-navigator.app/docs
```

### Verify Database Connection

```bash
# Check if pods can connect to Cloud SQL
kubectl exec -it -n life-navigator-dev deployment/backend -- \
  python -c "import psycopg2; print('Connected' if psycopg2.connect(os.getenv('DATABASE_URL')) else 'Failed')"
```

### Verify Redis Connection

```bash
# Check Redis connectivity
kubectl exec -it -n life-navigator-dev deployment/backend -- \
  python -c "import redis; r=redis.from_url(os.getenv('REDIS_URL')); print(r.ping())"
```

### Check Metrics

```bash
# View Prometheus metrics
kubectl port-forward -n life-navigator-dev svc/backend 8080:8000
curl http://localhost:8080/metrics
```

### Load Testing

```bash
# Simple load test
kubectl run -it --rm load-test --image=busybox --restart=Never -- \
  wget -q -O- http://backend.life-navigator-dev.svc.cluster.local:8000/health

# Watch HPA scale
kubectl get hpa -n life-navigator-dev -w
```

## Common Issues

### Issue: Pods in CrashLoopBackOff

```bash
# Check logs
kubectl logs -n life-navigator-dev POD_NAME

# Check events
kubectl describe pod -n life-navigator-dev POD_NAME

# Common causes:
# 1. Secrets not synced - check ExternalSecrets
# 2. Database connection failed - verify Cloud SQL proxy
# 3. Missing dependencies - rebuild container image
```

### Issue: External Secrets Not Syncing

```bash
# Check ESO logs
kubectl logs -n external-secrets-system -l app.kubernetes.io/name=external-secrets

# Check secret store
kubectl describe clustersecretstore gcpsm-secret-store

# Common causes:
# 1. Workload Identity not configured correctly
# 2. GCP service account missing permissions
# 3. Secrets don't exist in Secret Manager

# Fix permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:external-secrets-dev@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### Issue: Ingress Not Working

```bash
# Check ingress status
kubectl describe ingress life-navigator -n life-navigator-dev

# Check backend config
kubectl describe backendconfig backend-backendconfig -n life-navigator-dev

# Common causes:
# 1. DNS not configured
# 2. SSL certificate provisioning (takes time)
# 3. Backend health check failing

# Check backend health
kubectl get pods -n life-navigator-dev
kubectl logs -n life-navigator-dev -l app=backend
```

### Issue: HPA Not Scaling

```bash
# Check HPA status
kubectl describe hpa backend -n life-navigator-dev

# Check metrics server
kubectl top nodes
kubectl top pods -n life-navigator-dev

# Common causes:
# 1. Metrics server not running (should be automatic in Autopilot)
# 2. Resource requests not defined (check deployment)
# 3. Load not high enough to trigger scaling
```

### Issue: High Costs

```bash
# Check resource usage
kubectl top pods -n life-navigator-dev

# Reduce costs:
# 1. Lower HPA minimum replicas
# 2. Reduce resource requests/limits
# 3. Enable cluster autoscaling down
# 4. Use preemptible nodes (Autopilot handles automatically)

# Update HPA
kubectl patch hpa backend -n life-navigator-dev --patch '{"spec":{"minReplicas":1}}'
```

## Cleanup

### Delete Application

```bash
# Delete Kubernetes resources
kubectl delete -k overlays/dev

# Delete namespace (if needed)
kubectl delete namespace life-navigator-dev
```

### Destroy Infrastructure

```bash
cd terraform/gcp/environments/dev

# Destroy all resources
terraform destroy

# This will delete:
# - GKE cluster
# - Cloud SQL
# - Redis
# - Storage buckets
# - IAM resources
# - VPC (if nothing else using it)
```

## Next Steps

1. **Set up CI/CD**: Automate deployments with Cloud Build or GitHub Actions
2. **Configure monitoring**: Set up alerting in Cloud Monitoring
3. **Enable logging**: Configure log-based metrics and alerts
4. **Implement backup strategy**: Automate Cloud SQL and Storage backups
5. **Security hardening**: Enable Binary Authorization, Pod Security Policies
6. **Deploy to staging**: Replicate setup for staging environment
7. **Prepare for production**: Review and harden production configuration

## Additional Resources

- [GKE Best Practices](https://cloud.google.com/kubernetes-engine/docs/best-practices)
- [External Secrets Operator Docs](https://external-secrets.io/)
- [Terraform GCP Provider](https://registry.terraform.io/providers/hashicorp/google/latest/docs)
- [Kustomize Documentation](https://kustomize.io/)
