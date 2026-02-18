# Quick Start: LLM Model Setup

## 🚀 5-Minute Setup

```bash
# 1. Export your Hugging Face token
export HF_TOKEN="hf_your_token_here"
# Get token from: https://huggingface.co/settings/tokens

# 2. Run automated setup
python scripts/setup_llm_model.py

# 3. Start vLLM server
bash scripts/start_vllm.sh

# 4. Test (in another terminal)
python scripts/test_vllm_connection.py

# 5. Run agents with dashboard
python scripts/start_with_dashboard.py

# 6. Open dashboard
# http://localhost:3000
```

---

## Model Info

**Name**: `meta-llama/Llama-4-Maverick-17B-128E`

**Specs**:
- Architecture: Mixture of Experts (MoE)
- Active Parameters: ~17B
- Experts: 128
- Context: 32,768 tokens
- Size: ~34GB download

---

## System Requirements

### Minimum (Dev)
- GPU: NVIDIA RTX 3090 (24GB)
- RAM: 64GB
- Disk: 40GB free

### Recommended (Prod)
- GPU: NVIDIA A100 (40GB+)
- RAM: 128GB
- Disk: 100GB SSD

---

## Manual Setup

### 1. Install Dependencies
```bash
pip install vllm huggingface-hub torch transformers
```

### 2. Login to Hugging Face
```bash
huggingface-cli login
# Or: export HF_TOKEN="your-token"
```

### 3. Download Model
```bash
python -c "
from huggingface_hub import snapshot_download
snapshot_download('meta-llama/Llama-4-Maverick-17B-128E')
"
```

### 4. Update Configuration
```bash
# Edit .env file
VLLM_MODEL_NAME=meta-llama/Llama-4-Maverick-17B-128E
```

### 5. Start vLLM
```bash
vllm serve meta-llama/Llama-4-Maverick-17B-128E \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype auto \
  --max-model-len 32768 \
  --gpu-memory-utilization 0.9 \
  --enable-chunked-prefill \
  --trust-remote-code
```

---

## Testing

### Quick Health Check
```bash
curl http://localhost:8000/health
# Expected: OK
```

### Simple Inference Test
```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "meta-llama/Llama-4-Maverick-17B-128E",
    "messages": [{"role": "user", "content": "What is 2+2?"}],
    "max_tokens": 50
  }'
```

### Full Test Suite
```bash
python scripts/test_vllm_connection.py

# Expected:
# ✅ Health Check: PASSED
# ✅ Simple Inference: PASSED
# ✅ Chat Completion: PASSED
# ✅ Intent Analysis: PASSED
# ✅ Performance: PASSED
```

---

## Troubleshooting

### Problem: Model Download Fails

**Check HF Token:**
```bash
echo $HF_TOKEN  # Should show your token
# If empty: export HF_TOKEN="hf_..."
```

**Check Access:**
- Go to https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E
- Click "Access repository"
- Accept license agreement

### Problem: Out of Memory

**Reduce Memory Usage:**
```bash
vllm serve meta-llama/Llama-4-Maverick-17B-128E \
  --gpu-memory-utilization 0.7 \  # Lower from 0.9
  --max-model-len 16384 \          # Lower from 32768
  --max-num-seqs 128               # Lower from 256
```

**Or Use Quantization:**
```bash
vllm serve meta-llama/Llama-4-Maverick-17B-128E \
  --quantization awq  # Reduces memory by ~50%
```

### Problem: Connection Refused

**Check Server Running:**
```bash
ps aux | grep vllm  # Should show vllm process
```

**Check Port:**
```bash
netstat -tlnp | grep 8000  # Should show port 8000 listening
```

**Restart Server:**
```bash
pkill -f vllm  # Kill existing
bash scripts/start_vllm.sh  # Restart
```

---

## Performance Tuning

### For Lower Latency
```bash
--enable-chunked-prefill \
--max-num-seqs 128  # Lower batch size
```

### For Higher Throughput
```bash
--max-num-seqs 512 \  # Higher batch size
--enable-prefix-caching
```

### For Multi-GPU
```bash
--tensor-parallel-size 2  # Use 2 GPUs
--max-num-seqs 512        # Increase batch size
```

---

## Configuration Files

**Updated Files:**
- `.env` → `VLLM_MODEL_NAME=meta-llama/Llama-4-Maverick-17B-128E`
- `models/vllm_client.py` → Default model updated
- `scripts/start_vllm.sh` → Startup script generated

**Config Location:**
```bash
# Environment
cat .env | grep VLLM_

# Client
grep LLAMA_4_MAVERICK models/vllm_client.py
```

---

## Next Steps

1. ✅ **Model Setup Complete**
   - Model downloaded (~34GB)
   - vLLM server running on port 8000
   - Tests passing

2. 🚀 **Run Agent Demo**
   ```bash
   python scripts/start_with_dashboard.py
   ```

3. 📊 **Monitor Performance**
   - Open: http://localhost:3000
   - Navigate to "Debugging" tab
   - Watch real-time metrics

4. 🎓 **Fine-Tune Model** (Optional)
   - See: `docs/FINE_TUNING_GUIDE.md`
   - Train on your data
   - Compare in dashboard

---

## Documentation

- **Full Setup Guide**: `docs/LLM_MODEL_SETUP.md` (comprehensive)
- **Admin Integration**: `docs/ADMIN_DASHBOARD_INTEGRATION.md`
- **Architecture**: `docs/INTEGRATION_ARCHITECTURE.md`
- **Quick Reference**: This file

---

## Support

**Common Commands:**
```bash
# Setup
python scripts/setup_llm_model.py

# Start vLLM
bash scripts/start_vllm.sh

# Test
python scripts/test_vllm_connection.py

# Run agents
python scripts/start_with_dashboard.py

# Monitor
watch -n 1 nvidia-smi  # GPU usage
htop                   # CPU usage
netstat -tlnp         # Port usage
```

**Logs:**
```bash
# vLLM logs
tail -f /tmp/vllm_*.log

# Agent logs
tail -f logs/agent_*.log
```

**Resources:**
- vLLM Docs: https://docs.vllm.ai
- Hugging Face: https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E
- Model Card: See model README

---

**Ready to go! 🚀**
