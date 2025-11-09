#!/bin/bash
# Start vLLM server for Maverick model serving
# Auto-detects GPU configuration and optimizes settings

set -e

# Detect GPU configuration
GPU_COUNT=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | wc -l || echo "0")
if [[ $GPU_COUNT -gt 0 ]]; then
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
    echo "🔍 Detected: $GPU_COUNT x $GPU_NAME"
else
    echo "❌ No NVIDIA GPUs detected"
    exit 1
fi

# Auto-configure based on GPU
if [[ $GPU_COUNT -eq 1 ]] && [[ "$GPU_NAME" == *"GB10"* ]]; then
    echo "📱 Local development mode: Single integrated GPU detected"
    DEFAULT_MODEL="TinyLlama/TinyLlama-1.1B-Chat-v1.0"
    DEFAULT_GPU_MEM=0.70
    DEFAULT_MAX_LEN=2048
    DEFAULT_TP_SIZE=1
elif [[ $GPU_COUNT -ge 3 ]] && [[ "$GPU_NAME" == *"A100"* ]]; then
    echo "🚀 Production mode: Multi-GPU A100 detected"
    DEFAULT_MODEL="/home/riffe007/nvidia-workbench/MAVRIX/models/mavrix-fp16"
    DEFAULT_GPU_MEM=0.90
    DEFAULT_MAX_LEN=4096
    DEFAULT_TP_SIZE=$GPU_COUNT
else
    echo "⚙️  Standard mode: Using defaults"
    DEFAULT_MODEL="meta-llama/Llama-3.2-3B-Instruct"
    DEFAULT_GPU_MEM=0.85
    DEFAULT_MAX_LEN=4096
    DEFAULT_TP_SIZE=1
fi

# Configuration (with auto-detected defaults)
MODEL="${VLLM_MODEL:-$DEFAULT_MODEL}"
PORT="${VLLM_PORT:-8090}"
HOST="${VLLM_HOST:-0.0.0.0}"
GPU_MEMORY_UTILIZATION="${GPU_MEMORY_UTILIZATION:-$DEFAULT_GPU_MEM}"
MAX_MODEL_LEN="${MAX_MODEL_LEN:-$DEFAULT_MAX_LEN}"
TENSOR_PARALLEL_SIZE="${TENSOR_PARALLEL_SIZE:-$DEFAULT_TP_SIZE}"

echo ""
echo "🚀 Starting vLLM Server for Life Navigator"
echo "==========================================="
echo "Model: $MODEL"
echo "Port: $PORT"
echo "GPU Memory: ${GPU_MEMORY_UTILIZATION}%"
echo "Max Context: $MAX_MODEL_LEN tokens"
echo "Tensor Parallel: $TENSOR_PARALLEL_SIZE GPUs"
echo "==========================================="
echo ""

# Check if port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "✅ vLLM server already running on port $PORT"
    exit 0
fi

# Set CUDA devices for tensor parallelism
if [[ $TENSOR_PARALLEL_SIZE -gt 1 ]]; then
    export CUDA_VISIBLE_DEVICES=$(seq -s, 0 $((TENSOR_PARALLEL_SIZE-1)))
    echo "🔧 CUDA_VISIBLE_DEVICES=$CUDA_VISIBLE_DEVICES"
    # Enable NCCL for multi-GPU communication
    export NCCL_DEBUG=INFO
    export NCCL_IB_DISABLE=0
fi

# Activate venv
cd /home/riffe007/Documents/projects/life-navigator-monorepo/services/api
source venv/bin/activate

# Start vLLM server with OpenAI-compatible API
echo "🔥 Starting vLLM with optimizations..."
python -m vllm.entrypoints.openai.api_server \
    --model "$MODEL" \
    --host "$HOST" \
    --port "$PORT" \
    --gpu-memory-utilization "$GPU_MEMORY_UTILIZATION" \
    --max-model-len "$MAX_MODEL_LEN" \
    --tensor-parallel-size "$TENSOR_PARALLEL_SIZE" \
    --trust-remote-code \
    --disable-log-requests \
    2>&1 | tee /tmp/vllm-server.log
