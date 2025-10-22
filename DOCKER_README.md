# Docker Setup Guide

Complete guide for running Life Navigator Agents with Docker.

## Prerequisites

### Required
- Docker Engine 20.10+
- Docker Compose 2.0+
- 16GB RAM minimum
- 50GB free disk space

### Optional (for GPU support)
- NVIDIA GPU with 24GB+ VRAM
- NVIDIA Container Toolkit
- CUDA 12.0+

## Quick Start

### 1. Without GPU (recommended for development)

```bash
# Copy environment file
cp .env.docker .env

# Start services (PostgreSQL, Redis, RabbitMQ, Qdrant)
make docker-up

# Check service health
docker-compose ps
```

### 2. With GPU (for LLM inference)

```bash
# Verify NVIDIA setup
nvidia-smi
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi

# Start services with GPU
make docker-up-gpu
```

## Services

### Core Infrastructure (always running)

| Service | Port | Purpose | Health Check |
|---------|------|---------|--------------|
| PostgreSQL | 5432 | Structured data + pgvector | `docker exec lna-postgres pg_isready` |
| Redis | 6379 | Fast pub/sub + caching | `docker exec lna-redis redis-cli ping` |
| RabbitMQ | 5672, 15672 | Reliable task queues | http://localhost:15672 |
| Qdrant | 6333 | Vector similarity search | http://localhost:6333/dashboard |
| LocalStack | 4566, 8182 | Neptune simulation | http://localhost:4566/_localstack/health |

### Optional Services (profiles)

| Service | Port | Profile | Purpose |
|---------|------|---------|---------|
| vLLM-1 | 8000 | `gpu` | LLM inference (instance 1) |
| vLLM-2 | 8001 | `gpu` | LLM inference (instance 2) |
| App | 8080 | `app` | Agent application |

## Service Details

### PostgreSQL

**Image:** `pgvector/pgvector:pg16`

**Extensions:**
- pgvector: Vector similarity search
- uuid-ossp: UUID generation
- pg_trgm: Fuzzy text search
- btree_gin: Advanced indexing

**Schemas:**
- `agents`: Agent metadata and tasks
- `graphrag`: GraphRAG data
- `messaging`: Message bus data

**Connection:**
```bash
# Connect with psql
docker exec -it lna-postgres psql -U lna_user -d life_navigator_agents

# Run migrations
docker exec lna-postgres psql -U lna_user -d life_navigator_agents -f /docker-entrypoint-initdb.d/01-extensions.sql
```

### Redis

**Image:** `redis:7-alpine`

**Configuration:**
- Append-only file enabled (persistence)
- Password authentication
- Max memory: Host dependent

**CLI:**
```bash
# Connect with redis-cli
docker exec -it lna-redis redis-cli -a lna_redis_password

# Monitor commands
docker exec lna-redis redis-cli -a lna_redis_password MONITOR

# Check info
docker exec lna-redis redis-cli -a lna_redis_password INFO
```

### RabbitMQ

**Image:** `rabbitmq:3-management-alpine`

**Management UI:** http://localhost:15672
- Username: `lna_user`
- Password: `lna_rabbitmq_password`

**CLI:**
```bash
# List queues
docker exec lna-rabbitmq rabbitmqctl list_queues

# List exchanges
docker exec lna-rabbitmq rabbitmqctl list_exchanges

# Check status
docker exec lna-rabbitmq rabbitmq-diagnostics status
```

### Qdrant

**Image:** `qdrant/qdrant:latest`

**Dashboard:** http://localhost:6333/dashboard

**API Examples:**
```bash
# Health check
curl http://localhost:6333/health

# List collections
curl http://localhost:6333/collections

# Create collection
curl -X PUT http://localhost:6333/collections/life_navigator \
  -H 'Content-Type: application/json' \
  -d '{"vectors": {"size": 384, "distance": "Cosine"}}'
```

### vLLM (GPU Required)

**Image:** `vllm/vllm-openai:latest`

**Model:** `meta-llama/Llama-3.1-70B-Instruct`

**Requirements:**
- 2x NVIDIA GPUs with 24GB VRAM each
- Tensor parallelism: 2
- GPU memory utilization: 90%

**API Examples:**
```bash
# Health check
curl http://localhost:8000/health

# List models
curl http://localhost:8000/v1/models

# Generate completion
curl http://localhost:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-3.1-70B-Instruct",
    "prompt": "Explain budgeting in one sentence:",
    "max_tokens": 50
  }'
```

## Docker Compose Profiles

Use profiles to start specific service groups:

```bash
# Core services only (default)
docker-compose up -d

# Core + GPU services
docker-compose --profile gpu up -d

# Core + Application
docker-compose --profile app up -d

# Everything
docker-compose --profile gpu --profile app up -d
```

Or use environment variable:
```bash
export COMPOSE_PROFILES=gpu,app
docker-compose up -d
```

## Testing

### Run Tests in Docker

```bash
# Run all tests
make docker-test

# Run specific test file
docker-compose -f docker-compose.test.yml run --rm test-runner pytest tests/unit/test_config.py -v

# Run with coverage
docker-compose -f docker-compose.test.yml run --rm test-runner pytest --cov=. --cov-report=html
```

### Manual Testing

```bash
# Start test services
docker-compose -f docker-compose.test.yml up -d postgres redis rabbitmq qdrant

# Run tests locally
pytest tests/ -v

# Cleanup
docker-compose -f docker-compose.test.yml down -v
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs <service-name>

# Check health
docker-compose ps

# Restart service
docker-compose restart <service-name>
```

### PostgreSQL Connection Issues

```bash
# Check if extension is enabled
docker exec lna-postgres psql -U lna_user -d life_navigator_agents -c "SELECT extname FROM pg_extension;"

# Recreate database
docker-compose down -v
docker-compose up -d postgres
```

### Redis Connection Issues

```bash
# Check Redis is responding
docker exec lna-redis redis-cli -a lna_redis_password PING

# Check memory usage
docker exec lna-redis redis-cli -a lna_redis_password INFO memory
```

### RabbitMQ Queue Issues

```bash
# Purge all queues
docker exec lna-rabbitmq rabbitmqctl purge_queue <queue-name>

# Reset RabbitMQ
docker-compose restart rabbitmq
```

### vLLM GPU Issues

```bash
# Verify GPU access
docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi

# Check vLLM logs
docker-compose logs vllm-1

# Check GPU memory
nvidia-smi -l 1
```

### Out of Disk Space

```bash
# Remove unused images
docker image prune -a

# Remove all stopped containers
docker container prune

# Remove unused volumes
docker volume prune

# Complete cleanup
make docker-clean
```

## Performance Tuning

### PostgreSQL

Edit `docker-compose.yml`:
```yaml
postgres:
  environment:
    POSTGRES_SHARED_BUFFERS: "4GB"
    POSTGRES_EFFECTIVE_CACHE_SIZE: "12GB"
    POSTGRES_MAX_CONNECTIONS: "200"
```

### Redis

Edit `docker-compose.yml`:
```yaml
redis:
  command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
```

### RabbitMQ

```bash
# Set channel max
docker exec lna-rabbitmq rabbitmqctl set_vm_memory_high_watermark 0.6
```

## Production Considerations

### Security

1. **Change all default passwords** in `.env`
2. **Enable SSL/TLS** for all services
3. **Use secrets management** (Docker secrets, Vault)
4. **Restrict network access** with firewall rules
5. **Enable audit logging**

### Scaling

1. **PostgreSQL**: Use managed service (RDS, Aurora)
2. **Redis**: Redis Cluster or Redis Sentinel
3. **RabbitMQ**: Cluster with mirrored queues
4. **vLLM**: Kubernetes with GPU node pools
5. **Qdrant**: Distributed cluster

### Monitoring

Add monitoring stack:
```yaml
services:
  prometheus:
    image: prom/prometheus
  grafana:
    image: grafana/grafana
  jaeger:
    image: jaegertracing/all-in-one
```

## Clean Up

```bash
# Stop all services
make docker-down

# Remove all volumes (⚠️ deletes all data)
make docker-clean

# Remove everything including cache
make clean-all
```

## Common Workflows

### Development Workflow

```bash
# 1. Start infrastructure
make docker-up

# 2. Run application locally
python -m uvicorn api.main:app --reload

# 3. Run tests
make test

# 4. Stop services
make docker-down
```

### Testing Workflow

```bash
# Run tests in Docker
make docker-test

# Or run locally with Docker services
make docker-up
pytest tests/ -v
make docker-down
```

### CI/CD Workflow

```bash
# In CI pipeline
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
```

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL with pgvector](https://github.com/pgvector/pgvector)
- [Redis Documentation](https://redis.io/documentation)
- [RabbitMQ Documentation](https://www.rabbitmq.com/documentation.html)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [vLLM Documentation](https://docs.vllm.ai/)
