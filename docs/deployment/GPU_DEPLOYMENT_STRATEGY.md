# GPU Deployment Strategy for Life Navigator + Maverick

## Your Current Hardware Analysis

### DGX-Spark Local Workstation
- **GPU:** 1x NVIDIA GB10 (Blackwell integrated)
- **CUDA:** 13.0
- **VRAM:** Shared memory architecture (not suitable for large LLMs)
- **CPU:** 20 cores ARM (Cortex-X925/A725)
- **RAM:** 119 GB
- **Architecture:** ARM-based workstation

**Limitation:** Cannot run 749GB Maverick model locally. Use for development and testing only.

---

## Deployment Options

### Option 1: Local Testing (Current Hardware)

**Use Case:** Development, testing, debugging
**Model:** Small quantized models only

**Recommended Models for Local Testing:**
```bash
# Tiny model for fast iteration (fits in shared GPU memory)
VLLM_MODEL="TinyLlama/TinyLlama-1.1B-Chat-v1.0"

# Small model for better quality testing
VLLM_MODEL="meta-llama/Llama-3.2-3B-Instruct"

# Medium model (may need CPU offload)
VLLM_MODEL="meta-llama/Llama-3.2-8B-Instruct"
```

**Launch Command (Optimized for GB10):**
```bash
# Start vLLM with small model, optimized for integrated GPU
VLLM_MODEL="TinyLlama/TinyLlama-1.1B-Chat-v1.0" \
GPU_MEMORY_UTILIZATION=0.70 \
MAX_MODEL_LEN=2048 \
./scripts/dev/start-vllm-server.sh
```

**Why not Maverick locally?**
- Maverick: 749GB of weights
- Your GPU: Shared memory, ~10-20GB max for inference
- **Impossible to fit**

---

### Option 2: GCP Production (Full Maverick Model)

**Use Case:** Production deployment with full Maverick-4-17B-128E

#### Recommended GCP Configuration

**GPU Setup: 3x A100 80GB**
```
Machine Type: a2-ultragpu-3g
GPUs: 3x NVIDIA A100 80GB
Total VRAM: 240 GB
vCPUs: 36
RAM: 680 GB
Cost: ~$12-15/hour (~$8,640-10,800/month)
```

**Why 3x A100 80GB?**
- Model size: 749GB FP16
- Tensor parallelism: Shards model across GPUs
- 3x 80GB = 240GB total VRAM
- With 90% utilization: 216GB usable
- Leaves ~20GB for KV cache and activations ✅

**Launch Command (GCP):**
```bash
# Full Maverick FP16 with tensor parallelism
TENSOR_PARALLEL_SIZE=3 \
VLLM_MODEL="/home/riffe007/nvidia-workbench/MAVRIX/models/mavrix-fp16" \
GPU_MEMORY_UTILIZATION=0.90 \
MAX_MODEL_LEN=4096 \
./scripts/dev/start-vllm-server.sh
```

---

### Option 3: GCP Budget (Quantized Maverick)

**Use Case:** Lower cost, acceptable quality loss

**GPU Setup: 2x A100 40GB**
```
Machine Type: a2-highgpu-2g
GPUs: 2x NVIDIA A100 40GB
Total VRAM: 80 GB
vCPUs: 24
RAM: 340 GB
Cost: ~$6-8/hour (~$4,320-5,760/month)
```

**Requirement:** Need to quantize Maverick to 4-bit (INT4)
- FP16: 749GB → INT4: ~187GB
- With tensor parallelism across 2x A100: feasible

**Launch Command (Requires 4-bit quantization):**
```bash
# Would need to create INT4 quantized version first
TENSOR_PARALLEL_SIZE=2 \
VLLM_MODEL="/path/to/maverick-int4" \
QUANTIZATION="awq" \
GPU_MEMORY_UTILIZATION=0.90 \
MAX_MODEL_LEN=4096 \
./scripts/dev/start-vllm-server.sh
```

---

## Recommended Workflow

### 1. Local Development (Your DGX-Spark)
```bash
# Use TinyLlama for fast iteration
cd /home/riffe007/Documents/projects/life-navigator-monorepo

# Start vLLM with tiny model
VLLM_MODEL="TinyLlama/TinyLlama-1.1B-Chat-v1.0" \
GPU_MEMORY_UTILIZATION=0.70 \
./scripts/dev/start-vllm-server.sh

# Start complete system
./START_COMPLETE_SYSTEM.sh
```

**Benefits:**
- Fast startup (~30 seconds)
- Immediate feedback for development
- Same API interface as production
- Free (local GPU)

### 2. GCP Production Deployment

**Step 1: Create GCP Compute Instance**
```bash
# Create instance with 3x A100 80GB
gcloud compute instances create lifenavigator-maverick \
  --zone=us-central1-a \
  --machine-type=a2-ultragpu-3g \
  --accelerator=type=nvidia-tesla-a100,count=3 \
  --image-family=pytorch-latest-gpu \
  --image-project=deeplearning-platform-release \
  --boot-disk-size=2000GB \
  --boot-disk-type=pd-ssd \
  --metadata=install-nvidia-driver=True
```

**Step 2: Copy Maverick Model to GCP**
```bash
# Create GCS bucket
gsutil mb gs://lifenavigator-models

# Upload Maverick FP16 model (749GB - will take hours)
gsutil -m cp -r /home/riffe007/nvidia-workbench/MAVRIX/models/mavrix-fp16 \
  gs://lifenavigator-models/

# On GCP instance, download model
gsutil -m cp -r gs://lifenavigator-models/mavrix-fp16 /opt/models/
```

**Step 3: Start vLLM on GCP**
```bash
# SSH into instance
gcloud compute ssh lifenavigator-maverick --zone=us-central1-a

# Install vLLM
pip install vllm==0.11.0

# Start Maverick with tensor parallelism
TENSOR_PARALLEL_SIZE=3 \
python -m vllm.entrypoints.openai.api_server \
  --model /opt/models/mavrix-fp16 \
  --host 0.0.0.0 \
  --port 8090 \
  --tensor-parallel-size 3 \
  --gpu-memory-utilization 0.90 \
  --max-model-len 4096 \
  --trust-remote-code
```

**Step 4: Configure Firewall**
```bash
# Allow vLLM API access
gcloud compute firewall-rules create allow-vllm \
  --allow tcp:8090 \
  --source-ranges YOUR_IP/32 \
  --description "Allow vLLM API access"
```

**Step 5: Update Life Navigator Backend**
```bash
# In services/api/.env
MAVERICK_URL="http://[GCP_INSTANCE_IP]:8090"
```

---

## Performance Expectations

### Local Testing (TinyLlama 1.1B)
- **First Token:** < 1 second
- **Generation:** 50-100 tokens/second
- **Quality:** Basic (good for testing API, not production)
- **Context:** 2048 tokens

### GCP Production (Maverick FP16, 3x A100)
- **First Token:** 2-5 seconds
- **Generation:** 15-25 tokens/second (MoE optimization)
- **Quality:** Production-grade
- **Context:** 4096-8192 tokens
- **Throughput:** 10-20 concurrent users

---

## Cost Analysis

| Setup | Hardware | Monthly Cost | Use Case |
|-------|----------|--------------|----------|
| Local Testing | 1x GB10 (integrated) | $0 | Development only |
| GCP 3x A100 80GB | Production Full | ~$8,640-10,800 | Production (best quality) |
| GCP 2x A100 40GB | Quantized INT4 | ~$4,320-5,760 | Production (budget) |
| GCP Reserved | 1-year commit | ~40% savings | Long-term production |

---

## GPU Optimization Settings

### Local GB10 (Integrated GPU)
```bash
export VLLM_MODEL="TinyLlama/TinyLlama-1.1B-Chat-v1.0"
export VLLM_PORT=8090
export GPU_MEMORY_UTILIZATION=0.70  # Conservative for shared memory
export MAX_MODEL_LEN=2048           # Short context
export TENSOR_PARALLEL_SIZE=1       # Single GPU only
```

### GCP 3x A100 80GB (Production Maverick)
```bash
export VLLM_MODEL="/opt/models/mavrix-fp16"
export VLLM_PORT=8090
export GPU_MEMORY_UTILIZATION=0.90  # Aggressive (dedicated VRAM)
export MAX_MODEL_LEN=4096           # Standard context
export TENSOR_PARALLEL_SIZE=3       # Shard across 3 GPUs
```

### Environment Variables for vLLM
```bash
# Force CUDA device visibility (if needed)
export CUDA_VISIBLE_DEVICES=0,1,2

# Enable NCCL for multi-GPU communication
export NCCL_DEBUG=INFO
export NCCL_IB_DISABLE=0

# Optimize PyTorch for A100
export TORCH_CUDNN_V8_API_ENABLED=1
```

---

## Monitoring GPU Utilization

### Watch GPU usage in real-time:
```bash
# On GCP instance
watch -n 1 nvidia-smi

# Check if all 3 GPUs are being used:
nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total --format=csv
```

### Expected Output (3x A100):
```
index, name, utilization.gpu [%], memory.used [MiB], memory.total [MiB]
0, NVIDIA A100-SXM4-80GB, 98, 72000, 81920
1, NVIDIA A100-SXM4-80GB, 98, 72000, 81920
2, NVIDIA A100-SXM4-80GB, 98, 72000, 81920
```

---

## Next Steps

### Immediate (Local Development):
1. ✅ Maverick FP16 model converted
2. ⏳ Start vLLM with TinyLlama for testing
3. ⏳ Verify complete system integration
4. ⏳ Test API endpoints and agent system

### For Production Launch (GCP):
1. ⏳ Provision 3x A100 80GB GCP instance
2. ⏳ Transfer Maverick FP16 model (749GB)
3. ⏳ Configure tensor parallelism (3 GPUs)
4. ⏳ Load test and performance tuning
5. ⏳ Set up monitoring and auto-scaling

---

## Summary

**Your GB10 GPU:**
- ✅ Perfect for: Development, testing, debugging
- ❌ Cannot run: 749GB Maverick model
- 💡 Use: TinyLlama or Llama-3.2-3B for local testing

**Production Deployment:**
- ✅ Deploy to GCP with 3x A100 80GB
- ✅ Use tensor parallelism across GPUs
- ✅ Maverick FP16 model ready to transfer
- 💰 Cost: ~$8,640-10,800/month for 24/7 operation

The FP16 conversion is complete and ready for GCP deployment!
