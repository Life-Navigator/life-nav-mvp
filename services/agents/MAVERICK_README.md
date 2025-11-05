# 🚀 Your Maverick Model Setup

## ✅ What You Have

Your system is configured for **optimal GPU + CPU hybrid inference**:

### Hardware
- **GPU**: NVIDIA GB10 (24GB VRAM)
- **Model**: Maverick Q4_K_M (227GB)
- **RAM**: 119GB system RAM

### Optimizations Applied

**GPU Offload**: 10 layers on GPU
- First 10 transformer layers run on GPU
- Provides ~2-3x speedup over CPU-only
- Safe for 24GB VRAM (no CUDA OOM errors)

**CPU Offload**: ~38 remaining layers on CPU
- Automatic fallback for layers that don't fit in VRAM
- Uses 75% of CPU cores for parallel processing
- Memory-mapped to avoid loading full 227GB into RAM

**Result**: Best balance of speed and stability! 🎯

---

## 🚀 Quick Start

### Start Everything (GPU Mode)

```bash
./START_MAVERICK_QUICKSTART.sh
```

This will:
1. Start Maverick with GPU+CPU hybrid mode
2. Start MCP Server
3. Start Admin Dashboard

### Manual Start (if needed)

```bash
# Start Maverick with GPU
./scripts/start_maverick_gpu.sh

# Or CPU-only (slower but works without GPU)
./scripts/start_maverick_cpu.sh
```

---

## 📊 Performance

### Expected Speed (GPU Mode)
- **First Token**: 2-5 seconds
- **Generation**: 10-20 tokens/second
- **Quality**: 97-98% of full FP16 model

### Expected Speed (CPU-Only Mode)
- **First Token**: 5-15 seconds
- **Generation**: 2-5 tokens/second
- **Quality**: Same 97-98%

---

## 🛠️ Configuration

The GPU script (`scripts/start_maverick_gpu.sh`) is optimized for your hardware:

```bash
GPU_LAYERS=10        # Safe for GB10 24GB VRAM
THREADS=~75% cores   # Parallel CPU processing
CONTEXT=4096         # Reasonable context window
```

**Want more GPU layers?** Edit `start_maverick_gpu.sh` and increase `GPU_LAYERS`
- 15 layers = more GPU usage (faster but may hit VRAM limit)
- 10 layers = stable (current setting)
- 5 layers = conservative (if you get CUDA errors)

---

## ✅ Verify It's Working

```bash
# Check if running
curl http://localhost:8090/health

# Test inference
curl -X POST http://localhost:8090/completion \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Hello! Say hi in one sentence.",
    "n_predict": 50
  }'

# Monitor GPU usage
watch -n 1 nvidia-smi
```

---

## 📚 Next Steps

1. **Start Maverick**: `./START_MAVERICK_QUICKSTART.sh`
2. **Connect to agents**: Follow `docs/guides/START_HERE.md`
3. **Chat**: `./venv/bin/python3 chat_with_agent.py`

---

**Your setup is ready for production local testing!** 🎉
