# vLLM Production Setup for DGX/GCP

## Architecture

**Ollama is NOT used** - it's unnecessary overhead for enterprise GPU infrastructure.

Instead, we use **vLLM** which provides:
- ✅ Optimized for NVIDIA GPUs (DGX, GCP A100/H100)
- ✅ Continuous batching for 10-20x higher throughput
- ✅ PagedAttention for efficient memory usage
- ✅ Multi-GPU tensor parallelism support
- ✅ OpenAI-compatible API (easy integration)
- ✅ FP8/INT8 quantization support

## Quick Start

### 1. Choose Your Model

For production, recommended models:

```bash
# Small (3-7B) - Good for local testing/cost-efficiency
export VLLM_MODEL="meta-llama/Llama-3.2-3B-Instruct"  # Default for DGX local testing

# Medium (8-13B) - Balanced performance
export VLLM_MODEL="meta-llama/Llama-3.1-8B-Instruct"

# Large (70B+) - Best quality (requires multi-GPU)
export VLLM_MODEL="meta-llama/Llama-3.1-70B-Instruct"

# Your Maverick Model (375B MoE, 17B active) - Production deployment
# BFloat16 (original)
export VLLM_MODEL="/home/riffe007/nvidia-workbench/MAVRIX/models/mavrix"

# Float16 (converted for optimal inference)
export VLLM_MODEL="/home/riffe007/nvidia-workbench/MAVRIX/models/mavrix-fp16"
```

### 2. Start vLLM Server

```bash
# Single GPU (default)
./scripts/dev/start-vllm-server.sh

# Multi-GPU (DGX) - use tensor parallelism
TENSOR_PARALLEL_SIZE=4 ./scripts/dev/start-vllm-server.sh

# Custom configuration
VLLM_MODEL="meta-llama/Llama-3.1-8B-Instruct" \
GPU_MEMORY_UTILIZATION=0.95 \
MAX_MODEL_LEN=8192 \
./scripts/dev/start-vllm-server.sh
```

### 3. Verify It's Running

```bash
# Check health
curl http://localhost:8090/health

# List models
curl http://localhost:8090/v1/models

# Test completion
curl http://localhost:8090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "default",
    "messages": [{"role": "user", "content": "Hello!"}],
    "max_tokens": 50
  }'
```

## DGX Configuration

For DGX-Spark (typically 4-8 GPUs):

```bash
# Use all GPUs with tensor parallelism
TENSOR_PARALLEL_SIZE=8 \
VLLM_MODEL="meta-llama/Llama-3.1-70B-Instruct" \
GPU_MEMORY_UTILIZATION=0.95 \
MAX_MODEL_LEN=8192 \
./scripts/dev/start-vllm-server.sh
```

## GCP Deployment

### Option 1: GCP Compute Engine with GPUs

```yaml
# terraform configuration
resource "google_compute_instance" "vllm_server" {
  name         = "lifenavigator-vllm"
  machine_type = "a2-highgpu-4g"  # 4x A100 GPUs
  zone         = "us-central1-a"

  boot_disk {
    initialize_params {
      image = "deeplearning-platform-release/pytorch-latest-gpu"
      size  = 200
    }
  }

  guest_accelerator {
    type  = "nvidia-tesla-a100"
    count = 4
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    pip install vllm
    TENSOR_PARALLEL_SIZE=4 \
    VLLM_MODEL="meta-llama/Llama-3.1-70B-Instruct" \
    python -m vllm.entrypoints.openai.api_server \
      --host 0.0.0.0 \
      --port 8090 \
      --tensor-parallel-size 4
  EOF
}
```

### Option 2: GKE with GPU Node Pool

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-deployment
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: vllm
        image: vllm/vllm-openai:latest
        env:
        - name: TENSOR_PARALLEL_SIZE
          value: "4"
        resources:
          limits:
            nvidia.com/gpu: 4
        command:
        - python
        - -m
        - vllm.entrypoints.openai.api_server
        - --model
        - meta-llama/Llama-3.1-70B-Instruct
        - --tensor-parallel-size
        - "4"
        - --host
        - "0.0.0.0"
        - --port
        - "8090"
```

## Performance Tuning

### GPU Memory Optimization

```bash
# Adjust GPU memory usage (0.0-1.0)
GPU_MEMORY_UTILIZATION=0.90  # Conservative (default)
GPU_MEMORY_UTILIZATION=0.95  # Aggressive (recommended for prod)
```

### Context Length

```bash
# Longer context for complex conversations
MAX_MODEL_LEN=4096   # Default
MAX_MODEL_LEN=8192   # Extended
MAX_MODEL_LEN=16384  # Very long (requires more memory)
```

### Quantization (for larger models)

```bash
# FP8 quantization (2x faster, minimal quality loss)
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.1-70B-Instruct \
  --quantization fp8 \
  --tensor-parallel-size 4

# INT8 (even more memory efficient)
python -m vllm.entrypoints.openai.api_server \
  --model meta-llama/Llama-3.1-70B-Instruct \
  --quantization awq \
  --tensor-parallel-size 4
```

## Monitoring

### Prometheus Metrics

vLLM exposes Prometheus metrics at `/metrics`:

```bash
curl http://localhost:8090/metrics
```

Key metrics:
- `vllm:num_requests_running` - Current active requests
- `vllm:num_requests_waiting` - Queue depth
- `vllm:gpu_cache_usage_perc` - GPU memory usage
- `vllm:time_to_first_token_seconds` - Latency metric
- `vllm:time_per_output_token_seconds` - Throughput metric

### Logging

```bash
# View server logs
tail -f /tmp/vllm-server.log

# With structured logging
export VLLM_CONFIGURE_LOGGING=1
./scripts/dev/start-vllm-server.sh
```

## Cost Optimization

### Model Selection by Use Case

| Use Case | Recommended Model | GPUs Needed | Est. Cost/Hour (GCP) |
|----------|------------------|-------------|---------------------|
| Development/Testing | Llama-3.2-3B | 1x T4 | ~$0.35 |
| Production (Standard) | Llama-3.1-8B | 1x A100 | ~$3.67 |
| Production (High Quality) | Llama-3.1-70B | 4x A100 | ~$14.68 |
| Enterprise | Llama-3.1-405B | 8x H100 | ~$60+ |

### Auto-scaling

For GKE deployments, use Horizontal Pod Autoscaler:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: vllm-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: vllm-deployment
  minReplicas: 1
  maxReplicas: 5
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Integration with Life Navigator

The FastAPI backend is already configured to use vLLM:

```python
# services/api/app/services/maverick_client.py
# Uses OpenAI-compatible API at http://localhost:8090
```

Endpoints:
- `/v1/chat/completions` - Chat interface
- `/v1/completions` - Raw completions
- `/health` - Health check
- `/v1/models` - List loaded models

## Troubleshooting

### Out of Memory

```bash
# Reduce GPU memory utilization
GPU_MEMORY_UTILIZATION=0.85 ./scripts/dev/start-vllm-server.sh

# Use quantization
--quantization fp8
```

### Slow First Request

This is normal - vLLM loads the model on first request. Use warmup:

```bash
# After starting server, send warmup request
curl http://localhost:8090/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "default", "messages": [{"role": "user", "content": "warmup"}]}'
```

### Port Already in Use

```bash
# Kill existing vLLM
pkill -f vllm.entrypoints

# Or use different port
VLLM_PORT=8091 ./scripts/dev/start-vllm-server.sh
```

## Security

### Production Checklist

- [ ] Enable authentication (add API key middleware)
- [ ] Use HTTPS/TLS
- [ ] Rate limiting (nginx/cloudflare)
- [ ] Input validation
- [ ] Monitor for prompt injection attacks
- [ ] Restrict network access (VPC/firewall)
- [ ] Regular security updates

### API Key Protection

Add to nginx config:

```nginx
location /v1/ {
    if ($http_x_api_key != "your-secret-key") {
        return 401;
    }
    proxy_pass http://localhost:8090;
}
```

## Next Steps

1. Choose your model based on requirements
2. Start vLLM server with appropriate GPU configuration
3. Test with provided curl commands
4. Integrate with Life Navigator FastAPI backend
5. Monitor performance and optimize
6. Deploy to GCP with auto-scaling

For questions or issues, check vLLM documentation:
https://docs.vllm.ai/
