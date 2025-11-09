#!/bin/bash
# Start Life Navigator for LOCAL TESTING (GB10 integrated GPU)
# Uses TinyLlama for fast iteration and development

set -e

echo "🚀 Starting Life Navigator - LOCAL TESTING MODE"
echo "=================================================="
echo ""
echo "GPU: NVIDIA GB10 (Integrated)"
echo "Model: TinyLlama 1.1B (optimized for local GPU)"
echo "Use Case: Development, testing, API verification"
echo ""
echo "⚠️  NOTE: This uses a small model for testing only."
echo "   For production quality, deploy to GCP with full Maverick model."
echo ""
echo "=================================================="
echo ""

# Function to check if port is in use
check_port() {
    lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1
}

# 1. Start vLLM with TinyLlama (optimized for GB10)
if check_port 8090; then
    echo "✅ vLLM already running on port 8090"
else
    echo "🤖 Starting vLLM with TinyLlama (fast startup)..."
    VLLM_MODEL="TinyLlama/TinyLlama-1.1B-Chat-v1.0" \
    GPU_MEMORY_UTILIZATION=0.70 \
    MAX_MODEL_LEN=2048 \
    nohup ./scripts/dev/start-vllm-server.sh > /tmp/vllm.log 2>&1 &

    echo "   Waiting for vLLM to load model (30-60 seconds)..."
    sleep 45
fi

# 2. Start MCP Server (if not already running)
if check_port 8080; then
    echo "✅ MCP Server already running on port 8080"
else
    echo "🔧 Starting MCP Server..."
    cd services/agents
    nohup ./start_mcp_server.sh > /tmp/mcp-server.log 2>&1 &
    sleep 5
    cd ../..
fi

# 3. Start FastAPI Backend (if not already running)
if check_port 8000; then
    echo "✅ FastAPI Backend already running on port 8000"
else
    echo "⚡ Starting FastAPI Backend..."
    cd services/api
    nohup bash -c "source venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" > /tmp/api.log 2>&1 &
    sleep 3
    cd ../..
fi

# 4. Start Next.js Frontend (if not already running)
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
echo "=================================================="
echo "✅ Local Testing Environment Ready!"
echo "=================================================="
echo ""
echo "🔗 URLs:"
echo "   Frontend:        http://localhost:3000"
echo "   FastAPI Backend: http://localhost:8000"
echo "   API Docs:        http://localhost:8000/docs"
echo "   MCP Server:      http://localhost:8080"
echo "   vLLM (TinyLlama): http://localhost:8090"
echo ""
echo "📊 Logs:"
echo "   vLLM:       tail -f /tmp/vllm.log"
echo "   MCP Server: tail -f /tmp/mcp-server.log"
echo "   API:        tail -f /tmp/api.log"
echo "   Frontend:   tail -f /tmp/nextjs.log"
echo ""
echo "🧪 Test LLM:"
echo "   curl http://localhost:8090/v1/chat/completions \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"model\":\"default\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello!\"}]}'"
echo ""
echo "🛑 To stop all:"
echo "   pkill -f 'vllm|mcp-server|uvicorn|next'"
echo ""
echo "💡 Model Info:"
echo "   Current: TinyLlama 1.1B (local testing)"
echo "   Production: Maverick 17B-128E (requires GCP with 3x A100)"
echo ""
