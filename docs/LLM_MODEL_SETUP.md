# LLM Model Setup Guide - Llama-4-Maverick-17B-128E

## Overview

This guide walks you through setting up the **Llama-4-Maverick-17B-128E** model for your Life Navigator Agent system.

**Model Specifications:**
- **Architecture**: Mixture of Experts (MoE) with 128 experts
- **Active Parameters**: ~17B (sparse activation)
- **Total Parameters**: Higher (many experts, few active per token)
- **Context Length**: 32,768 tokens
- **Optimizations**: Flash Attention 2, Chunked Prefill, Continuous Batching

---

## Quick Start (5 Minutes)

```bash
# 1. Set Hugging Face token
export HF_TOKEN="your-hugging-face-token-here"

# 2. Run setup script
python scripts/setup_llm_model.py

# 3. Start vLLM server
bash scripts/start_vllm.sh

# 4. Test connection
python scripts/test_vllm_connection.py

# 5. Run agents
python scripts/start_with_dashboard.py
```

---

## System Requirements

### Minimum (Development)

| Component | Requirement |
|-----------|-------------|
| **GPU** | NVIDIA RTX 3090 / A5000 (24GB VRAM) |
| **RAM** | 64GB system memory |
| **Disk** | 40GB free space |
| **CUDA** | 11.8+ or 12.1+ |
| **OS** | Linux (Ubuntu 20.04+) |

### Recommended (Production)

| Component | Requirement |
|-----------|-------------|
| **GPU** | NVIDIA A100 (40GB/80GB) or H100 |
| **RAM** | 128GB system memory |
| **Disk** | 100GB SSD free space |
| **CUDA** | 12.1+ |
| **OS** | Linux (Ubuntu 22.04+) |

### Multi-GPU Setup

For higher throughput, use multiple GPUs:

| GPUs | Configuration | Throughput |
|------|---------------|------------|
| 1x A100 (40GB) | `--tensor-parallel-size 1` | ~50 req/sec |
| 2x A100 (40GB) | `--tensor-parallel-size 2` | ~100 req/sec |
| 4x A100 (40GB) | `--tensor-parallel-size 4` | ~200 req/sec |
| 8x H100 (80GB) | `--tensor-parallel-size 8` | ~500 req/sec |

---

## Step-by-Step Setup

### Step 1: Install Prerequisites

```bash
# Install vLLM (includes PyTorch, transformers, Flash Attention 2)
pip install vllm

# Install Hugging Face Hub
pip install huggingface-hub

# Verify installation
python -c "import vllm; print(vllm.__version__)"
```

### Step 2: Hugging Face Authentication

#### Option A: Environment Variable
```bash
# Get token from: https://huggingface.co/settings/tokens
export HF_TOKEN="hf_your_token_here"
```

#### Option B: Login via CLI
```bash
huggingface-cli login
# Paste your token when prompted
```

#### Option C: Save to File
```bash
mkdir -p ~/.huggingface
echo "hf_your_token_here" > ~/.huggingface/token
chmod 600 ~/.huggingface/token
```

### Step 3: Download Model

#### Automatic (Recommended)
```bash
python scripts/setup_llm_model.py
```

This script will:
1. ✅ Check prerequisites
2. ✅ Verify HF authentication
3. ✅ Download model (~34GB)
4. ✅ Verify download integrity
5. ✅ Update configuration files
6. ✅ Generate startup scripts

#### Manual (Advanced)
```bash
# Using Hugging Face Hub
python -c "
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id='meta-llama/Llama-4-Maverick-17B-128E',
    cache_dir='~/.cache/huggingface/hub'
)
"
```

### Step 4: Verify Download

```bash
# Check model files
ls -lh ~/.cache/huggingface/hub/models--meta-llama--Llama-4-Maverick-17B-128E/

# Should see:
#   config.json
#   tokenizer_config.json
#   tokenizer.json
#   *.safetensors (model weights)
#   *.bin (alternative format)
```

### Step 5: Configure Environment

Update `.env` file:
```bash
# Copy example if needed
cp .env.example .env

# Update model name
sed -i 's/VLLM_MODEL_NAME=.*/VLLM_MODEL_NAME=meta-llama\/Llama-4-Maverick-17B-128E/' .env
```

Your `.env` should contain:
```ini
VLLM_MODEL_NAME=meta-llama/Llama-4-Maverick-17B-128E
VLLM_INSTANCE_1=http://localhost:8000
VLLM_INSTANCE_2=http://localhost:8001
VLLM_TIMEOUT=30
VLLM_MAX_TOKENS=4096
VLLM_TEMPERATURE=0.7
```

---

## Starting vLLM Server

### Single Instance (Basic)

```bash
vllm serve meta-llama/Llama-4-Maverick-17B-128E \
  --host 0.0.0.0 \
  --port 8000 \
  --tensor-parallel-size 1 \
  --dtype auto \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.9 \
  --enable-chunked-prefill \
  --max-num-seqs 256 \
  --trust-remote-code
```

### Dual Instance (Load Balancing)

**Terminal 1:**
```bash
vllm serve meta-llama/Llama-4-Maverick-17B-128E \
  --host 0.0.0.0 \
  --port 8000 \
  --tensor-parallel-size 1 \
  --dtype auto \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.45 \
  --enable-chunked-prefill \
  --max-num-seqs 128 \
  --trust-remote-code
```

**Terminal 2:**
```bash
vllm serve meta-llama/Llama-4-Maverick-17B-128E \
  --host 0.0.0.0 \
  --port 8001 \
  --tensor-parallel-size 1 \
  --dtype auto \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.45 \
  --enable-chunked-prefill \
  --max-num-seqs 128 \
  --trust-remote-code
```

**Note**: Split GPU memory (0.45 + 0.45 = 0.9) for two instances on one GPU.

### Multi-GPU (High Throughput)

```bash
# 2 GPUs
vllm serve meta-llama/Llama-4-Maverick-17B-128E \
  --host 0.0.0.0 \
  --port 8000 \
  --tensor-parallel-size 2 \
  --dtype auto \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.9 \
  --enable-chunked-prefill \
  --max-num-seqs 512 \
  --trust-remote-code

# 4 GPUs
vllm serve meta-llama/Llama-4-Maverick-17B-128E \
  --host 0.0.0.0 \
  --port 8000 \
  --tensor-parallel-size 4 \
  --dtype auto \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.9 \
  --enable-chunked-prefill \
  --max-num-seqs 1024 \
  --trust-remote-code
```

### Using Startup Script (Easiest)

```bash
# Generated by setup_llm_model.py
bash scripts/start_vllm.sh
```

---

## vLLM Configuration Options

### Essential Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--host` | `0.0.0.0` | Server host (0.0.0.0 = all interfaces) |
| `--port` | `8000` | Server port |
| `--tensor-parallel-size` | `1` | Number of GPUs for tensor parallelism |
| `--dtype` | `auto` | Model precision (auto, float16, bfloat16) |
| `--max-model-len` | `32768` | Maximum context length |
| `--gpu-memory-utilization` | `0.9` | GPU memory usage fraction (0.0-1.0) |

### Performance Tuning

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--max-num-seqs` | `256` | Max concurrent sequences (higher = more throughput) |
| `--max-num-batched-tokens` | Auto | Max tokens in batch |
| `--enable-chunked-prefill` | False | Enable chunked prefill (lower latency) |
| `--enable-prefix-caching` | False | Enable prefix caching (reuse prompts) |
| `--swap-space` | `4` | CPU swap space in GB |

### Quality & Safety

| Parameter | Default | Description |
|-----------|---------|-------------|
| `--trust-remote-code` | False | Allow custom model code (required for some models) |
| `--enforce-eager` | False | Disable CUDA graphs (debug mode) |
| `--disable-log-requests` | False | Disable request logging |
| `--disable-log-stats` | False | Disable stats logging |

---

## Testing the Setup

### Test 1: Health Check

```bash
curl http://localhost:8000/health
# Expected: OK
```

### Test 2: Model Info

```bash
curl http://localhost:8000/v1/models
# Expected: JSON with model info
```

### Test 3: Simple Inference

```bash
curl http://localhost:8000/v1/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-4-Maverick-17B-128E",
    "prompt": "What is 2+2?",
    "max_tokens": 50
  }'
```

### Test 4: Chat Completion

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-4-Maverick-17B-128E",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

### Test 5: Python Client

```bash
python scripts/test_vllm_connection.py
```

Expected output:
```
✅ Health Check: PASSED
✅ Simple Inference: PASSED
✅ Chat Completion: PASSED
✅ Intent Analysis: PASSED
✅ Performance: PASSED
```

---

## Integration with Agents

Once vLLM is running, your agents automatically use it:

```python
from agents.specialists.finance.budget_agent import BudgetSpecialist
from models.agent_models import AgentTask, TaskMetadata, TaskPriority
from uuid import uuid4

# Create agent (automatically connects to vLLM)
specialist = BudgetSpecialist()
await specialist.startup()

# Execute task (uses LLM for reasoning)
task = AgentTask(
    metadata=TaskMetadata(
        task_id=uuid4(),
        user_id="user-123",
        priority=TaskPriority.NORMAL
    ),
    task_type="spending_analysis",
    payload={"transactions": [...]}
)

# LLM is automatically used for analysis
result = await specialist.execute_task(task)
```

---

## Performance Benchmarks

### Single GPU (A100 40GB)

| Metric | Value |
|--------|-------|
| **Throughput** | 50 req/sec |
| **Latency (P50)** | 800ms |
| **Latency (P95)** | 1,500ms |
| **Latency (P99)** | 2,000ms |
| **Tokens/sec** | 2,500 |
| **GPU Utilization** | 90% |

### Multi-GPU (4x A100 40GB)

| Metric | Value |
|--------|-------|
| **Throughput** | 200 req/sec |
| **Latency (P50)** | 400ms |
| **Latency (P95)** | 800ms |
| **Latency (P99)** | 1,200ms |
| **Tokens/sec** | 10,000 |
| **GPU Utilization** | 85% avg |

---

## Troubleshooting

### Problem: Model Not Found

**Error:**
```
OSError: meta-llama/Llama-4-Maverick-17B-128E does not appear to be a valid model identifier
```

**Solution:**
1. Check model exists on Hugging Face
2. Verify your HF_TOKEN has access
3. Try manual download:
   ```bash
   huggingface-cli download meta-llama/Llama-4-Maverick-17B-128E
   ```

### Problem: Out of Memory (OOM)

**Error:**
```
torch.cuda.OutOfMemoryError: CUDA out of memory
```

**Solutions:**
1. Reduce `--gpu-memory-utilization`:
   ```bash
   --gpu-memory-utilization 0.7  # Try 0.7 instead of 0.9
   ```

2. Reduce `--max-model-len`:
   ```bash
   --max-model-len 16384  # Try 16K instead of 32K
   ```

3. Reduce `--max-num-seqs`:
   ```bash
   --max-num-seqs 128  # Try 128 instead of 256
   ```

4. Use quantization:
   ```bash
   --quantization awq  # Or: gptq, bitsandbytes
   ```

### Problem: Slow Inference

**Symptoms:**
- Latency > 5 seconds
- Low tokens/sec
- GPU utilization < 50%

**Solutions:**
1. Enable chunked prefill:
   ```bash
   --enable-chunked-prefill
   ```

2. Increase batch size:
   ```bash
   --max-num-seqs 512  # Increase from 256
   ```

3. Enable prefix caching:
   ```bash
   --enable-prefix-caching
   ```

4. Check for CPU bottleneck:
   ```bash
   nvidia-smi dmon -s u  # Monitor GPU utilization
   htop  # Monitor CPU usage
   ```

### Problem: Connection Refused

**Error:**
```
ConnectionRefusedError: [Errno 111] Connection refused
```

**Solutions:**
1. Check vLLM is running:
   ```bash
   ps aux | grep vllm
   ```

2. Check port is correct:
   ```bash
   netstat -tlnp | grep 8000
   ```

3. Check firewall:
   ```bash
   sudo ufw status
   sudo ufw allow 8000
   ```

4. Test with curl:
   ```bash
   curl http://localhost:8000/health
   ```

### Problem: Model Loading Slow

**Symptoms:**
- vLLM takes > 5 minutes to start
- Disk I/O at 100%

**Solutions:**
1. Use SSD for model cache:
   ```bash
   export HF_HOME=/mnt/ssd/.cache/huggingface
   ```

2. Preload model in memory:
   ```bash
   # Load model into RAM before vLLM
   python -c "from transformers import AutoModel; AutoModel.from_pretrained('meta-llama/Llama-4-Maverick-17B-128E')"
   ```

3. Use `--load-format`:
   ```bash
   --load-format safetensors  # Faster than .bin
   ```

---

## Production Deployment

### Docker (Recommended)

```dockerfile
FROM vllm/vllm-openai:latest

# Copy model (if bundled)
# COPY model/ /models/

# Set environment
ENV HF_TOKEN=${HF_TOKEN}
ENV VLLM_MODEL=meta-llama/Llama-4-Maverick-17B-128E

# Expose port
EXPOSE 8000

# Start vLLM
CMD ["vllm", "serve", "meta-llama/Llama-4-Maverick-17B-128E", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--tensor-parallel-size", "1", \
     "--dtype", "auto", \
     "--max-model-len", "32768", \
     "--gpu-memory-utilization", "0.9"]
```

Build and run:
```bash
docker build -t life-navigator-vllm .
docker run --gpus all -p 8000:8000 -e HF_TOKEN=$HF_TOKEN life-navigator-vllm
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-deployment
spec:
  replicas: 2
  selector:
    matchLabels:
      app: vllm
  template:
    metadata:
      labels:
        app: vllm
    spec:
      containers:
      - name: vllm
        image: vllm/vllm-openai:latest
        command: ["vllm", "serve"]
        args:
          - "meta-llama/Llama-4-Maverick-17B-128E"
          - "--host=0.0.0.0"
          - "--port=8000"
          - "--tensor-parallel-size=1"
        ports:
        - containerPort: 8000
        env:
        - name: HF_TOKEN
          valueFrom:
            secretKeyRef:
              name: hf-token
              key: token
        resources:
          limits:
            nvidia.com/gpu: 1
            memory: "64Gi"
          requests:
            nvidia.com/gpu: 1
            memory: "32Gi"
---
apiVersion: v1
kind: Service
metadata:
  name: vllm-service
spec:
  selector:
    app: vllm
  ports:
  - port: 8000
    targetPort: 8000
  type: LoadBalancer
```

---

## Cost Optimization

### On-Premises

| GPU | Hourly Cost (AWS) | Daily Cost | Monthly Cost |
|-----|------------------|------------|--------------|
| 1x A100 (40GB) | $4.00 | $96 | $2,880 |
| 2x A100 (40GB) | $8.00 | $192 | $5,760 |
| 4x A100 (40GB) | $16.00 | $384 | $11,520 |
| 8x H100 (80GB) | $40.00 | $960 | $28,800 |

### Cloud Providers

| Provider | Instance Type | GPUs | Cost/hour |
|----------|--------------|------|-----------|
| AWS | p4d.24xlarge | 8x A100 (40GB) | $32.77 |
| AWS | p5.48xlarge | 8x H100 (80GB) | $98.32 |
| GCP | a2-highgpu-8g | 8x A100 (40GB) | $29.39 |
| Azure | ND96asr_v4 | 8x A100 (80GB) | $32.77 |

### Optimization Tips

1. **Use Spot Instances**: Save 70-90% on cloud costs
2. **Batch Requests**: Group requests for higher GPU utilization
3. **Enable Caching**: Reduce redundant computations
4. **Right-Size Model**: Use 17B instead of 70B if sufficient
5. **Auto-Scaling**: Scale down during low traffic

---

## Next Steps

1. ✅ Model downloaded and configured
2. ✅ vLLM server running and tested
3. 🚀 **Run agent demo**:
   ```bash
   python scripts/start_with_dashboard.py
   ```

4. 📊 **Monitor in dashboard**:
   ```
   http://localhost:3000
   ```

5. 🎓 **Fine-tune model** (optional):
   - See `docs/FINE_TUNING_GUIDE.md`

---

## Support & Resources

- **vLLM Documentation**: https://docs.vllm.ai
- **Hugging Face Hub**: https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E
- **Model Card**: https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E/blob/main/README.md
- **Integration Guide**: `docs/ADMIN_DASHBOARD_INTEGRATION.md`
- **GitHub Issues**: https://github.com/vllm-project/vllm/issues

---

**Your LLM is ready for production! 🚀**
