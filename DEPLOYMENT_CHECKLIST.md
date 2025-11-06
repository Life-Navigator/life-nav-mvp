# Life Navigator GCP/K8s Deployment Checklist

Use this checklist to track your deployment progress.

## Phase 1: Prerequisites

### Tools Installation
- [ ] Install gcloud CLI (`gcloud --version`)
- [ ] Install kubectl (`kubectl version --client`)
- [ ] Install kustomize (`kustomize version`)
- [ ] Install Terraform 1.5.0+ (`terraform --version`)
- [ ] Install Docker (`docker --version`)

### GCP Project Setup
- [ ] Create or select GCP project
- [ ] Set PROJECT_ID environment variable: `export PROJECT_ID="your-project-id"`
- [ ] Login to GCP: `gcloud auth login`
- [ ] Set default project: `gcloud config set project $PROJECT_ID`
- [ ] Enable billing on the project
- [ ] Enable required APIs (see below)

### Enable GCP APIs
```bash
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
```
- [ ] APIs enabled successfully

## Phase 2: Configuration

### Terraform State Bucket
- [ ] Create GCS bucket: `gsutil mb -l us-central1 gs://${PROJECT_ID}-terraform-state-dev`
- [ ] Enable versioning: `gsutil versioning set on gs://${PROJECT_ID}-terraform-state-dev`
- [ ] Update backend config in `terraform/gcp/environments/dev/main.tf` if needed

### Terraform Variables
- [ ] Create `terraform/gcp/environments/dev/terraform.tfvars`
- [ ] Set `project_id`
- [ ] Set `region` (default: us-central1)
- [ ] Set `alert_email`

### Update Project ID in Files
- [ ] Replace PROJECT_ID in `k8s/overlays/dev/kustomization.yaml`
- [ ] Replace PROJECT_ID in `k8s/base/backend/serviceaccount.yaml`
- [ ] Verify PROJECT_ID in Terraform tfvars

## Phase 3: Secrets Preparation

### Create Secrets in GCP Secret Manager

Database:
- [ ] `cloud-sql-db-user`: `echo -n "postgres" | gcloud secrets create cloud-sql-db-user --data-file=-`
- [ ] `cloud-sql-db-password`: `echo -n "CHANGE_ME" | gcloud secrets create cloud-sql-db-password --data-file=-`
- [ ] `cloud-sql-db-host`: Will be populated after Cloud SQL creation
- [ ] `cloud-sql-db-name`: `echo -n "graphrag" | gcloud secrets create cloud-sql-db-name --data-file=-`

Redis:
- [ ] `redis-auth-string`: `echo -n "$(openssl rand -base64 32)" | gcloud secrets create redis-auth-string --data-file=-`
- [ ] `redis-host`: Will be populated after Redis creation

JWT:
- [ ] `jwt-secret-key`: `openssl rand -base64 32 | gcloud secrets create jwt-secret-key --data-file=-`

Neo4j (if using Aura):
- [ ] `neo4j-aura-connection-string`: Your Neo4j Aura URI
- [ ] `neo4j-aura-password`: Your Neo4j Aura password

Qdrant (if using Cloud):
- [ ] `qdrant-cloud-api-key`: Your Qdrant Cloud API key

Maverick:
- [ ] `maverick-api-key`: Your Maverick API key (if applicable)

### Verify Secrets
- [ ] List all secrets: `gcloud secrets list`
- [ ] Verify each secret exists

## Phase 4: Infrastructure Deployment

### Deploy Terraform Infrastructure
```bash
cd terraform/gcp/environments/dev
terraform init
terraform plan
terraform apply
```

- [ ] Terraform init successful
- [ ] Terraform plan reviewed (no unexpected changes)
- [ ] Terraform apply successful (~15-30 minutes)
- [ ] Save outputs: `terraform output > outputs.txt`

### Update Secrets with Infrastructure IPs
After Terraform completes:
- [ ] Get Cloud SQL host: `terraform output -raw cloud_sql_private_ip`
- [ ] Update `cloud-sql-db-host` secret
- [ ] Get Redis host: `terraform output -raw redis_host`
- [ ] Update `redis-host` secret

### Configure kubectl
- [ ] Get GKE credentials:
  ```bash
  gcloud container clusters get-credentials \
    $(terraform output -raw gke_cluster_name) \
    --region us-central1 \
    --project $PROJECT_ID
  ```
- [ ] Verify connection: `kubectl cluster-info`
- [ ] Check nodes: `kubectl get nodes`

### Verify Infrastructure
- [ ] GKE cluster running
- [ ] External Secrets Operator installed: `kubectl get pods -n external-secrets-system`
- [ ] ClusterSecretStore created: `kubectl get clustersecretstore`
- [ ] Cloud SQL instance available
- [ ] Redis instance available
- [ ] Storage buckets created
- [ ] IAM service accounts created

## Phase 5: Application Deployment

### Build Container Images
- [ ] Build backend image:
  ```bash
  cd backend
  docker build -t gcr.io/$PROJECT_ID/life-navigator-backend:dev-latest .
  ```
- [ ] Configure Docker for GCR: `gcloud auth configure-docker`
- [ ] Push backend image: `docker push gcr.io/$PROJECT_ID/life-navigator-backend:dev-latest`

### Deploy to Kubernetes
```bash
cd k8s/overlays/dev
kubectl apply -k .
```

- [ ] Namespaces created: `kubectl get namespaces | grep life-navigator`
- [ ] Backend deployment created: `kubectl get deployment -n life-navigator-dev`
- [ ] Backend service created: `kubectl get svc -n life-navigator-dev`
- [ ] External Secrets created: `kubectl get externalsecrets -n life-navigator-dev`

### Wait for Secret Synchronization
- [ ] Check ExternalSecret status: `kubectl get externalsecrets -n life-navigator-dev`
- [ ] Wait for Ready condition (~1-2 minutes)
- [ ] Verify secrets created: `kubectl get secrets -n life-navigator-dev`

### Monitor Deployment
- [ ] Watch pod startup: `kubectl get pods -n life-navigator-dev -w`
- [ ] Pods running (may take 2-5 minutes)
- [ ] Check logs: `kubectl logs -n life-navigator-dev -l app=backend --tail=50`
- [ ] No error messages in logs

## Phase 6: Verification

### Health Checks
- [ ] Port-forward to test: `kubectl port-forward -n life-navigator-dev svc/backend 8080:8000`
- [ ] Test health endpoint: `curl http://localhost:8080/health`
- [ ] Test API docs: `curl http://localhost:8080/docs`
- [ ] Expected response: HTTP 200

### HPA Check
- [ ] HPA created: `kubectl get hpa -n life-navigator-dev`
- [ ] Metrics available: `kubectl top pods -n life-navigator-dev`

### Ingress Check
- [ ] Ingress created: `kubectl get ingress -n life-navigator-dev`
- [ ] Get external IP: `kubectl get ingress life-navigator -n life-navigator-dev -o jsonpath='{.status.loadBalancer.ingress[0].ip}'`
- [ ] DNS configured (if using custom domain)

### SSL Certificate
- [ ] Check certificate status: `kubectl get managedcertificate -n life-navigator-dev`
- [ ] Wait for "Active" status (can take 15-60 minutes)
- [ ] Note: Certificate provisioning requires DNS to be configured first

### Database Connectivity
- [ ] Test from pod:
  ```bash
  kubectl exec -it -n life-navigator-dev deployment/backend -- \
    python -c "import os; print('Env vars loaded' if os.getenv('DATABASE_URL') else 'Missing vars')"
  ```

## Phase 7: DNS and SSL (Optional)

### Configure DNS
- [ ] Get ingress IP: `kubectl get ingress life-navigator -n life-navigator-dev`
- [ ] Create A record: `api-dev.life-navigator.app -> INGRESS_IP`
- [ ] Verify DNS propagation: `nslookup api-dev.life-navigator.app`
- [ ] Wait for DNS to propagate (can take minutes to hours)

### Wait for SSL Certificate
- [ ] Monitor certificate: `kubectl describe managedcertificate life-navigator-cert -n life-navigator-dev`
- [ ] Status changes to "Active"
- [ ] Test HTTPS: `curl https://api-dev.life-navigator.app/health`

## Phase 8: Post-Deployment

### Monitoring Setup
- [ ] Access Cloud Console Monitoring
- [ ] Verify metrics appearing
- [ ] Check logs in Cloud Logging
- [ ] Set up alerting policies (optional)

### Security Review
- [ ] Workload Identity configured: `kubectl get sa backend -n life-navigator-dev -o yaml | grep iam.gke.io`
- [ ] No secrets in Git
- [ ] IAM permissions follow least privilege
- [ ] Network policies in place

### Documentation
- [ ] Document custom configurations
- [ ] Record any deviations from defaults
- [ ] Update team documentation
- [ ] Share access credentials securely

### Backup Verification
- [ ] Cloud SQL backups enabled
- [ ] Verify first backup completes
- [ ] Test restore procedure (optional but recommended)

## Phase 9: Testing

### Smoke Tests
- [ ] Health endpoint responds
- [ ] API documentation accessible
- [ ] Authentication works (if implemented)
- [ ] Database queries successful
- [ ] Redis cache working

### Load Testing (Optional)
- [ ] Basic load test
- [ ] Observe HPA scaling
- [ ] Monitor resource usage
- [ ] Check for errors under load

### Integration Tests
- [ ] Neo4j connectivity
- [ ] Qdrant connectivity
- [ ] GraphRAG service (if deployed)
- [ ] External APIs working

## Phase 10: Cleanup (if needed)

### Delete Application
- [ ] Delete K8s resources: `kubectl delete -k k8s/overlays/dev`
- [ ] Verify pods deleted

### Destroy Infrastructure
- [ ] Destroy Terraform: `cd terraform/gcp/environments/dev && terraform destroy`
- [ ] Confirm deletion (~10-15 minutes)
- [ ] Delete state bucket (optional): `gsutil rm -r gs://${PROJECT_ID}-terraform-state-dev`

## Troubleshooting Reference

If issues occur, check:
1. Logs: `kubectl logs -n life-navigator-dev -l app=backend --tail=100`
2. Events: `kubectl get events -n life-navigator-dev --sort-by='.lastTimestamp'`
3. Pod describe: `kubectl describe pod POD_NAME -n life-navigator-dev`
4. External Secrets: `kubectl describe externalsecret backend-secrets -n life-navigator-dev`
5. ESO logs: `kubectl logs -n external-secrets-system -l app.kubernetes.io/name=external-secrets`

## Estimated Timeline

- Prerequisites & Setup: 1-2 hours
- Terraform Deployment: 30-45 minutes
- K8s Deployment: 10-15 minutes
- SSL Certificate: 15-60 minutes
- Testing & Verification: 30 minutes
- **Total: 2.5-4 hours**

## Cost Tracking

After deployment, monitor costs:
- [ ] Set up billing alerts
- [ ] Review daily costs for first week
- [ ] Optimize resource usage if needed
- [ ] Expected cost: ~$650/month for dev

## Success Criteria

Deployment is successful when:
- [ ] All pods running and healthy
- [ ] External Secrets synced
- [ ] Health endpoints responding
- [ ] Logs show no errors
- [ ] HPA configured and working
- [ ] Ingress accessible (with or without SSL)
- [ ] Database connectivity confirmed
- [ ] All integration tests passing

---

## Notes

Use this space for deployment-specific notes, issues encountered, or customizations made:

```
Date: ___________
Deployed by: ___________
Environment: dev
Project ID: ___________

Notes:
-
-
-

Issues encountered:
-
-
-

Resolutions:
-
-
-
```
