# Deployment Guide: Life Navigator Agent System

This guide covers deploying the agent system to production environments.

## Prerequisites

- Docker & Docker Compose (or Kubernetes)
- PostgreSQL 16+ (for Supabase)
- Redis 7+
- Neo4j 5.12+
- GPU with 24GB+ VRAM (for vLLM)
- Python 3.12+

## Quick Start (Docker Compose)

### 1. Environment Configuration

Create `.env` file:
```bash
# MCP Integration
MCP_SERVER_URL=http://app:8000

# vLLM (LLM Inference)
VLLM_BASE_URL=http://vllm:8000
VLLM_MODEL=meta-llama/Llama-4-Maverick-17B-128E

# GraphRAG (Semantic Memory)
GRAPHRAG_NEO4J_URI=bolt://neo4j:7687
GRAPHRAG_NEO4J_USER=neo4j
GRAPHRAG_NEO4J_PASSWORD=your_password

GRAPHRAG_QDRANT_URL=http://qdrant:6333
GRAPHRAG_POSTGRES_URL=postgresql://postgres:password@postgres:5432/graphrag

# Redis (Caching)
REDIS_URL=redis://redis:6379/0

# Message Bus
RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/

# Supabase (for app layer, if applicable)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
```

### 2. Docker Compose Setup

```yaml
# docker-compose.yml
version: '3.9'

services:
  # ========================================================================
  # Agent System
  # ========================================================================

  agents:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: life-navigator-agents
    ports:
      - "8001:8000"  # Agent API
    environment:
      - MCP_SERVER_URL=${MCP_SERVER_URL}
      - VLLM_BASE_URL=${VLLM_BASE_URL}
      - GRAPHRAG_NEO4J_URI=${GRAPHRAG_NEO4J_URI}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - vllm
      - neo4j
      - qdrant
      - redis
      - rabbitmq
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '4'
          memory: 8G

  # ========================================================================
  # vLLM Server (LLM Inference)
  # ========================================================================

  vllm:
    image: vllm/vllm-openai:v0.5.0
    container_name: vllm-server
    ports:
      - "8002:8000"
    command: >
      --model meta-llama/Llama-4-Maverick-17B-128E
      --tensor-parallel-size 1
      --dtype auto
      --api-key EMPTY
    environment:
      - CUDA_VISIBLE_DEVICES=0
      - HF_TOKEN=${HF_TOKEN}  # For downloading Llama models
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    restart: unless-stopped

  # ========================================================================
  # GraphRAG Components
  # ========================================================================

  neo4j:
    image: neo4j:5.12
    container_name: neo4j-graphrag
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    environment:
      - NEO4J_AUTH=neo4j/${GRAPHRAG_NEO4J_PASSWORD}
      - NEO4J_PLUGINS=["apoc", "graph-data-science"]
      - NEO4J_dbms_memory_heap_max__size=4G
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant:v1.7.0
    container_name: qdrant-vectordb
    ports:
      - "6333:6333"
    volumes:
      - qdrant_storage:/qdrant/storage
    restart: unless-stopped

  postgres:
    image: ankane/pgvector:v0.5.1
    container_name: graphrag-postgres
    ports:
      - "5433:5432"  # Avoid conflict with main Supabase
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=your_password
      - POSTGRES_DB=graphrag
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  # ========================================================================
  # Infrastructure
  # ========================================================================

  redis:
    image: redis:7-alpine
    container_name: agent-redis
    ports:
      - "6379:6379"
    command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    restart: unless-stopped

  rabbitmq:
    image: rabbitmq:3.12-management
    container_name: agent-rabbitmq
    ports:
      - "5672:5672"  # AMQP
      - "15672:15672"  # Management UI
    environment:
      - RABBITMQ_DEFAULT_USER=guest
      - RABBITMQ_DEFAULT_PASS=guest
    volumes:
      - rabbitmq_data:/var/lib/rabbitmq
    restart: unless-stopped

volumes:
  neo4j_data:
  neo4j_logs:
  qdrant_storage:
  postgres_data:
  redis_data:
  rabbitmq_data:
```

### 3. Build and Run

```bash
# Build agent system
docker-compose build agents

# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f agents

# Verify health
curl http://localhost:8001/health
```

## Production Deployment (Kubernetes)

### 1. Namespace Setup

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: life-navigator-agents
```

### 2. ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-config
  namespace: life-navigator-agents
data:
  MCP_SERVER_URL: "http://app-service:8000"
  VLLM_BASE_URL: "http://vllm-service:8000"
  GRAPHRAG_NEO4J_URI: "bolt://neo4j-service:7687"
  REDIS_URL: "redis://redis-service:6379/0"
```

### 3. Secrets

```yaml
# secrets.yaml
apiVersion: v1
kind: Secret
metadata:
  name: agent-secrets
  namespace: life-navigator-agents
type: Opaque
stringData:
  NEO4J_PASSWORD: "your_neo4j_password"
  HF_TOKEN: "your_huggingface_token"
```

### 4. Agent Deployment

```yaml
# agent-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: life-navigator-agents
  namespace: life-navigator-agents
spec:
  replicas: 3
  selector:
    matchLabels:
      app: life-navigator-agents
  template:
    metadata:
      labels:
        app: life-navigator-agents
    spec:
      containers:
      - name: agents
        image: your-registry/life-navigator-agents:latest
        ports:
        - containerPort: 8000
        envFrom:
        - configMapRef:
            name: agent-config
        - secretRef:
            name: agent-secrets
        resources:
          requests:
            memory: "4Gi"
            cpu: "2"
          limits:
            memory: "8Gi"
            cpu: "4"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: agent-service
  namespace: life-navigator-agents
spec:
  selector:
    app: life-navigator-agents
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

### 5. vLLM Deployment (GPU)

```yaml
# vllm-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-server
  namespace: life-navigator-agents
spec:
  replicas: 1  # Single replica per GPU
  selector:
    matchLabels:
      app: vllm-server
  template:
    metadata:
      labels:
        app: vllm-server
    spec:
      nodeSelector:
        accelerator: nvidia-gpu
      containers:
      - name: vllm
        image: vllm/vllm-openai:v0.5.0
        command:
        - python
        - -m
        - vllm.entrypoints.openai.api_server
        - --model
        - meta-llama/Llama-4-Maverick-17B-128E
        - --tensor-parallel-size
        - "1"
        - --dtype
        - auto
        ports:
        - containerPort: 8000
        resources:
          limits:
            nvidia.com/gpu: 1
            memory: "32Gi"
          requests:
            nvidia.com/gpu: 1
            memory: "16Gi"
        env:
        - name: HF_TOKEN
          valueFrom:
            secretKeyRef:
              name: agent-secrets
              key: HF_TOKEN
---
apiVersion: v1
kind: Service
metadata:
  name: vllm-service
  namespace: life-navigator-agents
spec:
  selector:
    app: vllm-server
  ports:
  - port: 8000
    targetPort: 8000
  type: ClusterIP
```

### 6. Apply Configurations

```bash
kubectl apply -f namespace.yaml
kubectl apply -f configmap.yaml
kubectl apply -f secrets.yaml
kubectl apply -f agent-deployment.yaml
kubectl apply -f vllm-deployment.yaml

# Verify deployments
kubectl get pods -n life-navigator-agents

# Check logs
kubectl logs -f deployment/life-navigator-agents -n life-navigator-agents
```

## Monitoring & Observability

### Prometheus Metrics

Add Prometheus annotations to deployment:
```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8000"
    prometheus.io/path: "/metrics"
```

Key metrics to monitor:
- `agent_request_duration_seconds` - Request latency
- `mcp_errors_total` - MCP integration errors
- `vllm_inference_duration_seconds` - LLM inference time
- `graphrag_query_duration_seconds` - Semantic search latency

### Grafana Dashboards

Example dashboard panels:
- Agent request rate (requests/sec)
- P50/P95/P99 latency
- Error rate by type
- MCP connection pool utilization
- vLLM GPU utilization

### Logging

Configure structured logging:
```python
# logging_config.yaml
version: 1
formatters:
  json:
    class: pythonjsonlogger.jsonlogger.JsonFormatter
handlers:
  console:
    class: logging.StreamHandler
    formatter: json
loggers:
  agents:
    level: INFO
    handlers: [console]
```

Forward logs to centralized service (e.g., Datadog, CloudWatch):
```yaml
# fluent-bit configmap
[INPUT]
    Name tail
    Path /app/logs/*.log
    Parser json

[OUTPUT]
    Name datadog
    Match *
    apikey ${DATADOG_API_KEY}
```

## Scaling

### Horizontal Scaling

```bash
# Scale agent pods
kubectl scale deployment/life-navigator-agents \
  --replicas=10 \
  -n life-navigator-agents

# Auto-scaling based on CPU
kubectl autoscale deployment/life-navigator-agents \
  --cpu-percent=70 \
  --min=3 \
  --max=20 \
  -n life-navigator-agents
```

### Vertical Scaling (vLLM)

For larger models or higher throughput:
```yaml
resources:
  limits:
    nvidia.com/gpu: 4  # Multi-GPU
    memory: "128Gi"
```

Adjust tensor parallelism:
```bash
--tensor-parallel-size 4  # Match GPU count
```

## Security

### Network Policies

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: agent-network-policy
  namespace: life-navigator-agents
spec:
  podSelector:
    matchLabels:
      app: life-navigator-agents
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: life-navigator-app
    ports:
    - protocol: TCP
      port: 8000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: vllm-server
  - to:
    - podSelector:
        matchLabels:
          app: neo4j
```

### Secrets Management

Use external secrets operator:
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: agent-secrets
spec:
  secretStoreRef:
    name: aws-secrets-manager
  target:
    name: agent-secrets
  data:
  - secretKey: NEO4J_PASSWORD
    remoteRef:
      key: /life-navigator/neo4j/password
```

## Backup & Disaster Recovery

### Neo4j Backups

```bash
# Create backup
kubectl exec -it neo4j-0 -n life-navigator-agents -- \
  neo4j-admin backup --backup-dir=/backups --name=graph-backup

# Restore
kubectl exec -it neo4j-0 -n life-navigator-agents -- \
  neo4j-admin restore --from=/backups/graph-backup
```

### PostgreSQL Backups

```bash
# Automated daily backups
kubectl create cronjob postgres-backup \
  --image=postgres:16 \
  --schedule="0 2 * * *" \
  -- pg_dump -h postgres-service -U postgres graphrag > /backups/$(date +%Y%m%d).sql
```

## Health Checks

### Endpoint: `/health`

```json
{
  "status": "healthy",
  "timestamp": "2025-10-26T20:00:00Z",
  "components": {
    "mcp_client": {
      "status": "healthy",
      "response_time_ms": 45
    },
    "vllm": {
      "status": "healthy",
      "model": "meta-llama/Llama-4-Maverick-17B-128E"
    },
    "graphrag": {
      "neo4j": "connected",
      "qdrant": "connected"
    },
    "redis": {
      "status": "connected",
      "memory_used_mb": 245
    }
  },
  "agents": {
    "total": 9,
    "healthy": 9
  }
}
```

### Readiness vs. Liveness

```yaml
livenessProbe:
  # Just check if process is alive
  httpGet:
    path: /health/live
    port: 8000
  failureThreshold: 3
  periodSeconds: 10

readinessProbe:
  # Check if ready to serve traffic
  httpGet:
    path: /health/ready
    port: 8000
  failureThreshold: 2
  periodSeconds: 5
```

## Troubleshooting

### Pod Crashloop

```bash
# Check logs
kubectl logs -f pod/life-navigator-agents-xxx -n life-navigator-agents

# Describe pod for events
kubectl describe pod/life-navigator-agents-xxx -n life-navigator-agents

# Common fixes:
# 1. Check environment variables
# 2. Verify MCP_SERVER_URL is reachable
# 3. Ensure GPU drivers installed (for vLLM)
# 4. Check resource limits
```

### MCP Connection Issues

```bash
# Test MCP connectivity from pod
kubectl exec -it pod/life-navigator-agents-xxx -n life-navigator-agents -- \
  curl http://app-service:8000/health

# If fails, check network policy or service DNS
```

### GPU Not Available (vLLM)

```bash
# Check NVIDIA device plugin
kubectl get pods -n kube-system | grep nvidia

# Check node has GPU
kubectl describe node <node-name> | grep nvidia.com/gpu

# Install NVIDIA device plugin if missing
kubectl apply -f https://raw.githubusercontent.com/NVIDIA/k8s-device-plugin/main/nvidia-device-plugin.yml
```

## Performance Tuning

### Connection Pooling

```python
# mcp_client.py
self.client = httpx.AsyncClient(
    limits=httpx.Limits(
        max_keepalive_connections=50,  # ← Increase for production
        max_connections=200,
    )
)
```

### Redis Caching

```python
# Enable caching
import redis.asyncio as redis

cache = redis.from_url(os.getenv("REDIS_URL"))

@cache.cached(ttl=300)  # 5 min cache
async def get_financial_context(user_id, session_id):
    return await mcp_client.get_financial_context(...)
```

### vLLM Optimization

```bash
# Use Flash Attention 2
--use-flash-attn

# Quantization for faster inference
--quantization awq

# Increase batch size
--max-model-len 4096
--max-num-batched-tokens 8192
```

## Cost Optimization

- Use spot instances for non-critical workloads
- Scale down vLLM pods during low traffic
- Use smaller model (Llama-4-Maverick-8B) for less complex tasks
- Cache aggressively (Redis)
- Batch requests to vLLM

## Support

For deployment issues:
- Check `docs/ARCHITECTURE.md` for system overview
- Review logs: `kubectl logs -f deployment/life-navigator-agents`
- Run health check: `curl http://agents:8000/health`
