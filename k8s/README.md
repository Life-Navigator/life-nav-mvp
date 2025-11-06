# Life Navigator Kubernetes Manifests

This directory contains Kubernetes manifests for deploying the Life Navigator application to GKE (Google Kubernetes Engine).

## Directory Structure

```
k8s/
├── base/                          # Base Kubernetes resources
│   ├── namespace.yaml            # Namespace definitions
│   ├── kustomization.yaml        # Base kustomization config
│   └── backend/                  # Backend API server
│       ├── deployment.yaml       # Backend deployment
│       ├── service.yaml          # Backend service
│       ├── serviceaccount.yaml   # Service account with Workload Identity
│       ├── configmap.yaml        # Configuration values
│       ├── hpa.yaml              # Horizontal Pod Autoscaler
│       ├── pdb.yaml              # Pod Disruption Budget
│       ├── networkpolicy.yaml    # Network policies
│       └── backendconfig.yaml    # GCE BackendConfig
├── shared/                        # Shared resources across environments
│   ├── ingress.yaml              # GCE Ingress with TLS
│   └── external-secrets.yaml     # External Secrets definitions
└── overlays/                      # Environment-specific configurations
    ├── dev/
    │   └── kustomization.yaml    # Dev environment overrides
    ├── staging/
    │   └── kustomization.yaml    # Staging environment overrides
    └── prod/
        └── kustomization.yaml    # Production environment overrides
```

## Prerequisites

1. **GKE Cluster**: Deploy using Terraform
   ```bash
   cd terraform/gcp/environments/dev
   terraform init
   terraform apply
   ```

2. **Tools Required**:
   - `kubectl` (v1.27+)
   - `kustomize` (v5.0+)
   - `gcloud` CLI configured with your GCP project

3. **GCP Setup**:
   - GKE Autopilot cluster running
   - Workload Identity enabled
   - External Secrets Operator installed (via Terraform)
   - Secrets in GCP Secret Manager

## Deployment

### Step 1: Configure kubectl

```bash
# Get GKE credentials
gcloud container clusters get-credentials life-navigator-gke-dev \
  --region us-central1 \
  --project YOUR_PROJECT_ID
```

### Step 2: Update Configuration

Before deploying, update the following placeholders:

1. **Project ID**: Replace `PROJECT_ID` in overlays with your GCP project ID
2. **Image Tags**: Update image tags in `overlays/{env}/kustomization.yaml`
3. **Domain Names**: Update ingress domains in overlays
4. **Secrets**: Ensure all required secrets are in GCP Secret Manager:
   - `cloud-sql-db-user`
   - `cloud-sql-db-password`
   - `cloud-sql-db-host`
   - `cloud-sql-db-name`
   - `redis-auth-string`
   - `redis-host`
   - `jwt-secret-key`
   - `neo4j-aura-connection-string`
   - `neo4j-aura-password`
   - `qdrant-cloud-api-key`

### Step 3: Deploy to Dev

```bash
# Preview changes
kubectl kustomize overlays/dev

# Apply to cluster
kubectl apply -k overlays/dev

# Watch deployment progress
kubectl get pods -n life-navigator-dev -w
```

### Step 4: Verify Deployment

```bash
# Check pods
kubectl get pods -n life-navigator-dev

# Check services
kubectl get svc -n life-navigator-dev

# Check ingress
kubectl get ingress -n life-navigator-dev

# Check external secrets
kubectl get externalsecrets -n life-navigator-dev

# View logs
kubectl logs -n life-navigator-dev -l app=backend --tail=100 -f
```

## Environment-Specific Deployments

### Development
```bash
kubectl apply -k overlays/dev
```

Features:
- 1-5 replicas (HPA)
- Debug logging enabled
- Swagger UI enabled
- Lower resource limits

### Staging
```bash
kubectl apply -k overlays/staging
```

Features:
- 2-8 replicas (HPA)
- Info logging
- Swagger UI enabled
- Tracing enabled
- Production-like configuration

### Production
```bash
kubectl apply -k overlays/prod
```

Features:
- 3-20 replicas (HPA)
- Info logging only
- Swagger UI disabled
- Full monitoring & tracing
- Higher resource limits
- Strict security policies

## Configuration Management

### ConfigMaps

ConfigMaps store non-sensitive configuration:
- Environment variables
- Feature flags
- API endpoints
- Service URLs

Edit `base/backend/configmap.yaml` or override in overlays.

### Secrets

Secrets are managed via External Secrets Operator and pulled from GCP Secret Manager:
- Database credentials
- API keys
- JWT secrets
- Service passwords

To update a secret:
```bash
# Update in GCP Secret Manager
gcloud secrets versions add SECRET_NAME --data-file=-

# Trigger refresh (automatic after 1h, or force)
kubectl annotate externalsecret backend-secrets \
  force-sync=$(date +%s) \
  -n life-navigator-dev
```

## Workload Identity

The backend service account is configured for Workload Identity to access GCP services securely:

```yaml
metadata:
  annotations:
    iam.gke.io/gcp-service-account: api-server-dev@PROJECT_ID.iam.gserviceaccount.com
```

Ensure the GCP service account has the following roles:
- `roles/cloudsql.client`
- `roles/secretmanager.secretAccessor`
- `roles/storage.objectViewer`
- `roles/redis.editor`

## Networking

### Ingress

The application uses Google Cloud Load Balancer (Ingress) with:
- Managed SSL certificates (auto-renewal)
- Cloud Armor (production)
- Health checks
- Session affinity (disabled)

Routes:
- `/api/*` -> Backend service
- `/docs` -> API documentation (dev/staging only)
- `/health` -> Health check endpoint

### Network Policies

Network policies restrict pod-to-pod communication:
- Backend can access: Cloud SQL, Redis, Neo4j, GraphRAG, external HTTPS
- Backend accepts: Ingress controller traffic
- All other traffic denied by default

## Monitoring

### Health Checks

Three types of probes:
1. **Liveness**: `/health` - Is the app running?
2. **Readiness**: `/health/ready` - Can the app serve traffic?
3. **Startup**: `/health` - Has the app finished starting?

### Metrics

Prometheus metrics exposed at `/metrics` (port 8000):
- Request rate
- Error rate
- Latency
- Custom business metrics

### Logs

Logs are automatically collected by GKE and sent to Cloud Logging:
```bash
# View logs in Cloud Console
gcloud logging read "resource.type=k8s_container AND resource.labels.namespace_name=life-navigator-dev" --limit 50

# Or use kubectl
kubectl logs -n life-navigator-dev -l app=backend --tail=100 -f
```

## Scaling

### Horizontal Pod Autoscaler (HPA)

Automatic scaling based on:
- CPU utilization (target: 70%)
- Memory utilization (target: 80%)

Dev: 1-5 replicas
Staging: 2-8 replicas
Production: 3-20 replicas

### Vertical Scaling

Adjust resource requests/limits in overlays:
```yaml
patches:
- target:
    kind: Deployment
    name: backend
  patch: |-
    - op: replace
      path: /spec/template/spec/containers/0/resources/requests/cpu
      value: 1000m
```

## Troubleshooting

### Pods not starting

```bash
# Check pod events
kubectl describe pod POD_NAME -n life-navigator-dev

# Check logs
kubectl logs POD_NAME -n life-navigator-dev

# Check secrets
kubectl get externalsecrets -n life-navigator-dev
kubectl describe externalsecret backend-secrets -n life-navigator-dev
```

### External Secrets not syncing

```bash
# Check ESO status
kubectl get externalsecrets -A
kubectl get secretstores -A

# Check ESO logs
kubectl logs -n external-secrets-system -l app.kubernetes.io/name=external-secrets

# Force sync
kubectl annotate externalsecret backend-secrets force-sync=$(date +%s) -n life-navigator-dev
```

### Ingress not working

```bash
# Check ingress status
kubectl get ingress -n life-navigator-dev
kubectl describe ingress life-navigator -n life-navigator-dev

# Check certificate status
kubectl get managedcertificate -n life-navigator-dev
kubectl describe managedcertificate life-navigator-cert -n life-navigator-dev

# Check backend health
kubectl get backendconfig -n life-navigator-dev
```

### HPA not scaling

```bash
# Check HPA status
kubectl get hpa -n life-navigator-dev
kubectl describe hpa backend -n life-navigator-dev

# Check metrics server
kubectl top pods -n life-navigator-dev
```

## Security

### Pod Security

- Non-root user (UID 1000)
- Read-only root filesystem
- All capabilities dropped
- Seccomp profile applied
- No privilege escalation

### Network Security

- Network policies enforcing least privilege
- Private cluster option for production
- TLS for all external traffic
- Cloud Armor WAF for production

### Secret Management

- No secrets in Git
- Secrets stored in GCP Secret Manager
- Workload Identity for authentication
- Automatic secret rotation support

## CI/CD Integration

### Build Images

```bash
# Build backend image
docker build -t gcr.io/PROJECT_ID/life-navigator-backend:TAG ./backend

# Push to GCR
docker push gcr.io/PROJECT_ID/life-navigator-backend:TAG
```

### Deploy via CI/CD

```bash
# Update image tag in overlay
cd k8s/overlays/dev
kustomize edit set image gcr.io/PROJECT_ID/life-navigator-backend:NEW_TAG

# Apply changes
kubectl apply -k overlays/dev

# Wait for rollout
kubectl rollout status deployment/backend -n life-navigator-dev
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/backend -n life-navigator-dev

# Rollback to specific revision
kubectl rollout undo deployment/backend -n life-navigator-dev --to-revision=3

# Check rollout history
kubectl rollout history deployment/backend -n life-navigator-dev
```

## Cost Optimization

### Dev Environment

- Use preemptible nodes (Autopilot handles automatically)
- Scale down HPA minimum during off-hours
- Use lower resource requests/limits
- Disable expensive features (tracing, verbose logging)

### Production Environment

- Use committed use discounts
- Enable autoscaling with appropriate limits
- Monitor and optimize resource usage
- Use Cloud CDN for static assets

## Best Practices

1. **Never commit secrets** - Use External Secrets Operator
2. **Use resource limits** - Prevent resource exhaustion
3. **Implement health checks** - Enable proper traffic management
4. **Use Pod Disruption Budgets** - Maintain availability during updates
5. **Apply Network Policies** - Implement least privilege networking
6. **Enable monitoring** - Track application health and performance
7. **Use Kustomize overlays** - Manage environment differences cleanly
8. **Test in staging** - Validate changes before production
9. **Implement gradual rollouts** - Use rolling updates with readiness checks
10. **Monitor costs** - Set budget alerts and optimize resource usage

## Additional Resources

- [GKE Autopilot Documentation](https://cloud.google.com/kubernetes-engine/docs/concepts/autopilot-overview)
- [External Secrets Operator](https://external-secrets.io/)
- [Kustomize Documentation](https://kustomize.io/)
- [Workload Identity](https://cloud.google.com/kubernetes-engine/docs/how-to/workload-identity)
