# Maverick + GraphRAG Deployment Guide

This guide covers the deployment of the Llama 4 Maverick embeddings service and GraphRAG service to enable full semantic GraphRAG with ontology reasoning.

## Overview

The deployment consists of two main components:

1. **Maverick vLLM Service**: Hosts the Llama 4 Maverick model for embeddings generation
2. **GraphRAG Service**: Provides ontology-based reasoning over Neo4j, Qdrant, and GraphDB

## Prerequisites

- GKE GPU cluster deployed (with NVIDIA T4 node pool)
- External Secrets Operator configured
- Neo4j Aura or self-hosted Neo4j
- Qdrant Cloud or self-hosted Qdrant
- GraphDB deployed (if using semantic ontology)
- HuggingFace token with access to Llama 4 Maverick model

## Part 1: Deploying Maverick vLLM Service

### Step 1: Add HuggingFace Token to GCP Secret Manager

```bash
# Create the secret
gcloud secrets create huggingface-token-dev \
  --data-file=<(echo "your-huggingface-token-here") \
  --project=YOUR_PROJECT_ID \
  --replication-policy="automatic"

# Grant access to the Kubernetes service account
gcloud secrets add-iam-policy-binding huggingface-token-dev \
  --member="serviceAccount:maverick-dev@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor" \
  --project=YOUR_PROJECT_ID
```

### Step 2: Create Maverick Service Account in GCP

```bash
# Create the service account
gcloud iam service-accounts create maverick-dev \
  --display-name="Maverick Embeddings Service (Dev)" \
  --project=YOUR_PROJECT_ID

# Grant necessary roles
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:maverick-dev@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.objectViewer"  # For model downloads

# Bind to Kubernetes service account (Workload Identity)
gcloud iam service-accounts add-iam-policy-binding \
  maverick-dev@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="serviceAccount:YOUR_PROJECT_ID.svc.id.goog[default/maverick]" \
  --project=YOUR_PROJECT_ID
```

### Step 3: Deploy Maverick to Kubernetes

```bash
# Apply the Maverick manifests
kubectl apply -f k8s/base/maverick/

# Verify deployment
kubectl get pods -l app=maverick
kubectl logs -l app=maverick -f  # Watch model download (takes 5-10 minutes)
```

### Step 4: Verify Maverick is Running

```bash
# Check if the model is loaded
kubectl exec -it deployment/maverick -- curl http://localhost:8090/health

# Test embeddings endpoint
kubectl exec -it deployment/maverick -- curl http://localhost:8090/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "maverick",
    "input": "This is a test sentence"
  }'
```

Expected response:
```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "embedding": [0.123, -0.456, ...],
      "index": 0
    }
  ],
  "model": "maverick",
  "usage": {
    "prompt_tokens": 6,
    "total_tokens": 6
  }
}
```

## Part 2: Deploying GraphRAG Service

### Step 1: Uncomment GraphRAG Module in Terraform

Edit `terraform/gcp/environments/dev/main.tf` and uncomment lines 494-530:

```terraform
module "graphrag_service" {
  source = "../../modules/graphrag-service"

  project_id   = var.project_id
  region       = var.region
  env          = "dev"
  cluster_name = module.gke_cluster.cluster_name

  # Neo4j configuration (using Aura)
  neo4j_service            = "neo4j-dev"
  neo4j_namespace          = "databases"
  neo4j_password_secret    = "neo4j-aura-connection-string"  # From GCP Secret Manager

  # Qdrant configuration (using Cloud)
  qdrant_url              = "https://your-qdrant-cloud-url.qdrant.io"
  qdrant_api_key_secret   = "qdrant-cloud-api-key"  # From GCP Secret Manager

  # GraphDB configuration
  graphdb_service         = "graphdb-dev"
  graphdb_namespace       = "databases"
  graphdb_repository      = "life-navigator-dev"

  # Embeddings service (Maverick)
  embeddings_service_url  = "http://maverick:8090"

  image_tag = "dev-latest"

  labels = {
    environment = "dev"
    managed_by  = "terraform"
  }

  depends_on = [
    module.gke_cluster,
    module.external_secrets_operator
  ]
}
```

### Step 2: Add Required Secrets to GCP Secret Manager

```bash
# Neo4j connection string
gcloud secrets create neo4j-aura-connection-string \
  --data-file=<(echo "neo4j+s://xxxxx.databases.neo4j.io") \
  --project=YOUR_PROJECT_ID

# Qdrant API key
gcloud secrets create qdrant-cloud-api-key \
  --data-file=<(echo "your-qdrant-api-key") \
  --project=YOUR_PROJECT_ID
```

### Step 3: Deploy GraphRAG via Terraform

```bash
cd terraform/gcp/environments/dev

# Initialize Terraform (if not already done)
terraform init

# Plan the deployment
terraform plan

# Apply the GraphRAG module
terraform apply -target=module.graphrag_service

# Verify deployment
kubectl get pods -n services -l app=graphrag
```

### Step 4: Verify GraphRAG is Running

```bash
# Check GraphRAG logs
kubectl logs -n services -l app=graphrag -f

# Test GraphRAG gRPC endpoint
# Install grpcurl if not already installed
kubectl exec -it -n services deployment/graphrag -- \
  grpcurl -plaintext localhost:50051 list
```

## Part 3: Integration Testing

### Test 1: Backend to Maverick Connectivity

```bash
# From backend pod, test Maverick connection
kubectl exec -it deployment/backend -- curl http://maverick:8090/health

# Expected: {"status": "healthy", "model": "maverick"}
```

### Test 2: GraphRAG to Maverick Connectivity

```bash
# From GraphRAG pod, test Maverick connection
kubectl exec -it -n services deployment/graphrag-dev -- \
  curl http://maverick.default.svc.cluster.local:8090/health
```

### Test 3: Backend to GraphRAG Connectivity

```bash
# From backend pod, test GraphRAG gRPC connection
kubectl exec -it deployment/backend -- \
  grpcurl -plaintext graphrag-dev.services.svc.cluster.local:50051 list
```

### Test 4: End-to-End Semantic Search

```bash
# Create a test query through the backend API
curl -X POST http://localhost:8000/api/v1/search \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "financial planning advice",
    "use_semantic": true,
    "use_ontology": true
  }'
```

Expected: Response with semantically similar results enriched with ontology reasoning.

## Part 4: Monitoring and Observability

### Monitor GPU Usage

```bash
# Check GPU allocation
kubectl describe node -l cloud.google.com/gke-nodepool=gpu-t4-pool

# Watch GPU metrics
kubectl top node -l cloud.google.com/gke-nodepool=gpu-t4-pool

# Check vLLM metrics
kubectl exec -it deployment/maverick -- curl http://localhost:8090/metrics
```

### Monitor GraphRAG Performance

```bash
# Check GraphRAG metrics
kubectl exec -it -n services deployment/graphrag-dev -- \
  curl http://localhost:50051/metrics

# View logs
kubectl logs -n services -l app=graphrag --tail=100 -f
```

### Set Up Alerts

The GPU deployment guide includes comprehensive monitoring alerts at:
- `GPU_DEPLOYMENT_GUIDE.md` (Section: Monitoring GPU Utilization)

Key metrics to monitor:
- GPU memory utilization (target: 80-90%)
- Inference latency (target: <500ms per request)
- Request queue depth (alert if >100)
- Model loading time (alert if >5 minutes)

## Part 5: Scaling Configuration

### Horizontal Pod Autoscaler (HPA)

Maverick HPA is already configured in `k8s/base/maverick/deployment.yaml`:

```yaml
minReplicas: 1
maxReplicas: 3
metrics:
- type: Pods
  pods:
    metric:
      name: nvidia_gpu_duty_cycle
    target:
      type: AverageValue
      averageValue: "80"  # Scale when GPU >80% utilized
```

### Vertical Pod Autoscaler (VPA)

VPA is configured in `k8s/base/maverick/vpa.yaml`:

```yaml
updateMode: "Auto"
minAllowed:
  cpu: 2000m
  memory: 8Gi
maxAllowed:
  cpu: 8000m
  memory: 32Gi
```

### Manual Scaling

```bash
# Scale Maverick replicas
kubectl scale deployment maverick --replicas=2

# Scale GraphRAG replicas
kubectl scale deployment graphrag-dev -n services --replicas=3
```

## Part 6: Cost Optimization

### Development Environment

- **Maverick**: 1 replica with NVIDIA T4 GPU
  - Cost: ~$300-400/month
  - Machine: n1-standard-8 (8 vCPU, 30GB RAM) + 1x T4 GPU

- **GraphRAG**: 2 replicas (no GPU)
  - Cost: Included in base GKE costs
  - Machine: Standard node pool

**Total Dev Cost**: ~$988-1,448/month

### Production Environment

- **Maverick**: 2-3 replicas with autoscaling
  - Cost: ~$600-1,200/month

- **GraphRAG**: 3-5 replicas with autoscaling
  - Cost: Included in base GKE costs

**Total Prod Cost**: ~$1,500-2,500/month (including base infrastructure)

### Cost-Saving Strategies

1. **Stop GPU nodes during off-hours** (dev only):
   ```bash
   # Scale down to 0 replicas
   kubectl scale deployment maverick --replicas=0

   # GKE will automatically scale down the GPU node pool
   ```

2. **Use Spot/Preemptible instances** for GPU nodes (50-80% cost reduction):
   - Already configured in `terraform/gcp/modules/gke-gpu-cluster/main.tf`
   - GPU node pool uses spot instances by default in dev

3. **Enable VPA** to right-size resource requests:
   - Already configured in `k8s/base/maverick/vpa.yaml`

4. **Use model caching**:
   - PVC ensures model is cached across pod restarts
   - Saves 5-10 minutes of download time per restart

## Troubleshooting

### Issue: Model Download Fails

**Symptoms**: Init container stuck in "Running" state

**Solution**:
```bash
# Check init container logs
kubectl logs deployment/maverick -c model-downloader

# Verify HuggingFace token
kubectl exec -it deployment/maverick -c model-downloader -- \
  env | grep HUGGINGFACE_TOKEN

# Manually test download
kubectl exec -it deployment/maverick -c model-downloader -- \
  huggingface-cli download meta-llama/Llama-4-Maverick-8B --token YOUR_TOKEN
```

### Issue: GPU Not Allocated

**Symptoms**: Pod stuck in "Pending" state with "Insufficient nvidia.com/gpu"

**Solution**:
```bash
# Check GPU node pool
kubectl get nodes -l cloud.google.com/gke-nodepool=gpu-t4-pool

# Check GPU availability
kubectl describe node <GPU_NODE_NAME> | grep nvidia.com/gpu

# Verify GPU drivers installed
kubectl exec -it <GPU_NODE_NAME> -- nvidia-smi
```

### Issue: GraphRAG Cannot Connect to Maverick

**Symptoms**: GraphRAG logs show connection refused to Maverick

**Solution**:
```bash
# Verify Maverick service
kubectl get svc maverick

# Test DNS resolution from GraphRAG pod
kubectl exec -it -n services deployment/graphrag-dev -- \
  nslookup maverick.default.svc.cluster.local

# Check network policy
kubectl get networkpolicy maverick-netpol -o yaml

# Ensure GraphRAG is allowed in ingress rules
```

### Issue: High Latency

**Symptoms**: Embedding requests take >1 second

**Potential Causes**:
1. GPU memory utilization too high (>95%)
2. Too many concurrent requests
3. Model not fully loaded

**Solution**:
```bash
# Check GPU memory
kubectl exec -it deployment/maverick -- nvidia-smi

# Check vLLM metrics
kubectl exec -it deployment/maverick -- \
  curl http://localhost:8090/metrics | grep gpu_memory

# Scale up replicas if needed
kubectl scale deployment maverick --replicas=2

# Adjust GPU_MEMORY_UTILIZATION in ConfigMap
kubectl edit configmap maverick-config
# Change GPU_MEMORY_UTILIZATION from "0.9" to "0.85"
kubectl rollout restart deployment/maverick
```

## Security Considerations

1. **HuggingFace Token Protection**:
   - Stored in GCP Secret Manager
   - Accessed via External Secrets Operator
   - Never committed to Git

2. **Network Policies**:
   - Maverick only accessible from backend, agents, GraphRAG, MCP
   - GraphRAG only accessible from backend and agents
   - No external ingress to either service

3. **Workload Identity**:
   - Maverick service account has minimal permissions
   - GraphRAG service account only has access to required secrets

4. **Resource Limits**:
   - Both services have CPU/memory limits to prevent resource exhaustion
   - GPU allocation is exclusive (one pod per GPU)

## Next Steps

1. **Enable Production Monitoring**:
   - Set up Prometheus alerts for GPU utilization
   - Configure Grafana dashboards for vLLM metrics
   - Enable distributed tracing for GraphRAG queries

2. **Optimize Performance**:
   - Tune vLLM batch size for your workload
   - Implement request caching for common queries
   - Enable model quantization (FP16 or INT8) if memory-constrained

3. **Disaster Recovery**:
   - Set up regular backups of Neo4j and Qdrant
   - Document rollback procedures
   - Test failover scenarios

4. **Cost Monitoring**:
   - Set up budget alerts in GCP
   - Track GPU node costs separately
   - Review and optimize resource requests monthly

## References

- [GPU Deployment Guide](./GPU_DEPLOYMENT_GUIDE.md) - Comprehensive GPU infrastructure guide
- [vLLM Documentation](https://docs.vllm.ai/) - vLLM inference server docs
- [Llama 4 Model Card](https://huggingface.co/meta-llama/Llama-4-Maverick-8B) - Model specifications
- [GKE GPU Documentation](https://cloud.google.com/kubernetes-engine/docs/how-to/gpus) - GKE GPU configuration

---

**Last Updated**: 2025-11-12
**Next Review**: 2025-12-12 (monthly review recommended)
