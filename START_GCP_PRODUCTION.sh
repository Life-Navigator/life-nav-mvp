#!/bin/bash
# Start Life Navigator on GCP with FULL MAVERICK MODEL
# Requires: 3x A100 80GB GPUs with tensor parallelism

set -e

echo "🚀 Starting Life Navigator - GCP PRODUCTION MODE"
echo "======================================================"
echo ""

# Check GPU configuration
GPU_COUNT=$(nvidia-smi --query-gpu=name --format=csv,noheader | wc -l)
GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)

echo "🔍 GPU Configuration:"
echo "   Count: $GPU_COUNT"
echo "   Type:  $GPU_NAME"
echo ""

# Validate GPU requirements
if [[ $GPU_COUNT -lt 3 ]]; then
    echo "❌ ERROR: Maverick requires at least 3 GPUs"
    echo "   Current: $GPU_COUNT GPU(s)"
    echo "   Required: 3x A100 80GB"
    echo ""
    echo "💡 For local testing, use: ./START_LOCAL_TESTING.sh"
    exit 1
fi

if [[ ! "$GPU_NAME" == *"A100"* ]]; then
    echo "⚠️  WARNING: Non-A100 GPUs detected"
    echo "   Recommended: 3x A100 80GB"
    echo "   Detected: $GPU_NAME"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if Maverick FP16 model exists
MAVERICK_MODEL="/opt/models/mavrix-fp16"
if [[ ! -d "$MAVERICK_MODEL" ]]; then
    echo "❌ ERROR: Maverick FP16 model not found at $MAVERICK_MODEL"
    echo ""
    echo "📥 To transfer model from local to GCP:"
    echo "   1. Create GCS bucket: gsutil mb gs://lifenavigator-models"
    echo "   2. Upload from local: gsutil -m cp -r /home/riffe007/nvidia-workbench/MAVRIX/models/mavrix-fp16 gs://lifenavigator-models/"
    echo "   3. Download on GCP: gsutil -m cp -r gs://lifenavigator-models/mavrix-fp16 /opt/models/"
    echo ""
    exit 1
fi

echo "✅ Maverick FP16 model found at $MAVERICK_MODEL"
echo ""

# Function to check if port is in use
check_port() {
    lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1
}

# 1. Start vLLM with Full Maverick Model (Tensor Parallelism)
if check_port 8090; then
    echo "✅ vLLM already running on port 8090"
else
    echo "🤖 Starting vLLM with Maverick FP16 (749GB model)..."
    echo "   This will take 5-10 minutes to load across 3 GPUs..."

    TENSOR_PARALLEL_SIZE=3 \
    VLLM_MODEL="$MAVERICK_MODEL" \
    GPU_MEMORY_UTILIZATION=0.90 \
    MAX_MODEL_LEN=4096 \
    nohup ./scripts/dev/start-vllm-server.sh > /tmp/vllm.log 2>&1 &

    echo "   Waiting for model to load (this may take 5-10 minutes)..."
    echo "   Monitor: tail -f /tmp/vllm.log"

    # Wait for vLLM to be ready
    for i in {1..120}; do
        if curl -s http://localhost:8090/health > /dev/null 2>&1; then
            echo "   ✅ vLLM ready!"
            break
        fi
        echo -n "."
        sleep 5
    done
    echo ""
fi

# 2. Start MCP Server
if check_port 8080; then
    echo "✅ MCP Server already running on port 8080"
else
    echo "🔧 Starting MCP Server..."
    cd services/agents
    nohup ./start_mcp_server.sh > /tmp/mcp-server.log 2>&1 &
    sleep 5
    cd ../..
fi

# 3. Start FastAPI Backend
if check_port 8000; then
    echo "✅ FastAPI Backend already running on port 8000"
else
    echo "⚡ Starting FastAPI Backend..."
    cd services/api
    nohup bash -c "source venv/bin/activate && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4" > /tmp/api.log 2>&1 &
    sleep 3
    cd ../..
fi

# 4. Start Next.js Frontend (for admin/monitoring)
if check_port 3000; then
    echo "✅ Next.js Frontend already running on port 3000"
else
    echo "🌐 Starting Next.js Frontend..."
    cd apps/web
    nohup npm run dev > /tmp/nextjs.log 2>&1 &
    sleep 5
    cd ../..
fi

echo ""
echo "======================================================"
echo "✅ GCP Production Environment Ready!"
echo "======================================================"
echo ""
echo "🔗 URLs:"
echo "   Frontend:        http://[INSTANCE_IP]:3000"
echo "   FastAPI Backend: http://[INSTANCE_IP]:8000"
echo "   API Docs:        http://[INSTANCE_IP]:8000/docs"
echo "   MCP Server:      http://[INSTANCE_IP]:8080"
echo "   vLLM (Maverick): http://[INSTANCE_IP]:8090"
echo ""
echo "📊 Logs:"
echo "   vLLM:       tail -f /tmp/vllm.log"
echo "   MCP Server: tail -f /tmp/mcp-server.log"
echo "   API:        tail -f /tmp/api.log"
echo "   Frontend:   tail -f /tmp/nextjs.log"
echo ""
echo "🔍 Monitor GPU Usage:"
echo "   watch -n 1 nvidia-smi"
echo ""
echo "🧪 Test Maverick:"
echo "   curl http://localhost:8090/v1/chat/completions \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"model\":\"default\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello!\"}],\"max_tokens\":100}'"
echo ""
echo "💰 Cost: ~$12-15/hour (3x A100 80GB)"
echo ""
echo "🛑 To stop all:"
echo "   pkill -f 'vllm|mcp-server|uvicorn|next'"
echo ""
