#!/usr/bin/env bash
#
# Advanced Maverick Model GPU Startup Script
# Optimized for multi-GPU with CPU offloading
#

set -e

echo "🚀 Starting Maverick Model with Advanced GPU Configuration..."

# Detect number of GPUs
GPU_COUNT=$(nvidia-smi --query-gpu=name --format=csv,noheader | wc -l)
echo "📊 Detected $GPU_COUNT GPU(s)"

# Configuration
MODEL_NAME="${MODEL_NAME:-cognitivecomputations/dolphin-2.9-llama3-70b}"
MODEL_PATH="${MODEL_PATH:-./models/maverick}"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8090}"

# Advanced vLLM Configuration
# For single GPU: use it fully
# For multiple GPUs: enable tensor parallelism
if [ "$GPU_COUNT" -gt 1 ]; then
    TENSOR_PARALLEL_SIZE=$GPU_COUNT
    echo "🔀 Enabling tensor parallelism across $TENSOR_PARALLEL_SIZE GPUs"
else
    TENSOR_PARALLEL_SIZE=1
    echo "📍 Using single GPU mode"
fi

# GPU Memory Utilization (95% for maximum performance)
GPU_MEMORY_UTILIZATION=0.95

# CPU Offloading Configuration
# Offload 10GB to CPU to free up GPU memory for larger contexts
CPU_OFFLOAD_GB=10

# Context Length and Batch Size
MAX_MODEL_LEN=8192
MAX_NUM_SEQS=256

# Enable advanced optimizations
ENABLE_PREFIX_CACHING="true"
DISABLE_LOG_REQUESTS="false"

# KV Cache Configuration
KV_CACHE_DTYPE="auto"
QUANTIZATION="awq"  # Use AWQ quantization for better performance

# Build vLLM command
VLLM_CMD="python3 -m vllm.entrypoints.openai.api_server"

# Model arguments
VLLM_CMD="$VLLM_CMD --model $MODEL_NAME"
VLLM_CMD="$VLLM_CMD --host $HOST"
VLLM_CMD="$VLLM_CMD --port $PORT"

# Parallelism and GPU configuration
VLLM_CMD="$VLLM_CMD --tensor-parallel-size $TENSOR_PARALLEL_SIZE"
VLLM_CMD="$VLLM_CMD --gpu-memory-utilization $GPU_MEMORY_UTILIZATION"

# CPU offloading (only if we have GPUs)
if [ "$GPU_COUNT" -gt 0 ]; then
    VLLM_CMD="$VLLM_CMD --cpu-offload-gb $CPU_OFFLOAD_GB"
fi

# Context and batch configuration
VLLM_CMD="$VLLM_CMD --max-model-len $MAX_MODEL_LEN"
VLLM_CMD="$VLLM_CMD --max-num-seqs $MAX_NUM_SEQS"

# Performance optimizations
VLLM_CMD="$VLLM_CMD --enable-prefix-caching"
VLLM_CMD="$VLLM_CMD --kv-cache-dtype $KV_CACHE_DTYPE"

# Logging
if [ "$DISABLE_LOG_REQUESTS" = "true" ]; then
    VLLM_CMD="$VLLM_CMD --disable-log-requests"
fi

# Quantization (if specified)
if [ -n "$QUANTIZATION" ]; then
    VLLM_CMD="$VLLM_CMD --quantization $QUANTIZATION"
fi

# Environment variables for optimal performance
export CUDA_VISIBLE_DEVICES=$(seq -s, 0 $((GPU_COUNT-1)))
export VLLM_WORKER_MULTIPROC_METHOD=spawn
export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512

echo "⚙️  Configuration:"
echo "   - Model: $MODEL_NAME"
echo "   - GPUs: $GPU_COUNT (Tensor Parallel: $TENSOR_PARALLEL_SIZE)"
echo "   - GPU Memory Util: ${GPU_MEMORY_UTILIZATION}%"
echo "   - CPU Offload: ${CPU_OFFLOAD_GB}GB"
echo "   - Max Context Length: $MAX_MODEL_LEN"
echo "   - Max Batch Size: $MAX_NUM_SEQS"
echo "   - Prefix Caching: $ENABLE_PREFIX_CACHING"
echo "   - Quantization: ${QUANTIZATION:-none}"
echo ""
echo "🎯 Starting vLLM server..."
echo "Command: $VLLM_CMD"
echo ""

# Execute vLLM
exec $VLLM_CMD
