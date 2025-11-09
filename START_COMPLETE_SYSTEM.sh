#!/bin/bash
# Start Complete Life Navigator System
# Frontend + API + vLLM + MCP Server + Agents

set -e

echo "🚀 Starting Complete Life Navigator System"
echo "==========================================="
echo ""

# Function to check if port is in use
check_port() {
    lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1
}

# 1. Start vLLM (if not already running)
if check_port 8090; then
    echo "✅ vLLM already running on port 8090"
else
    echo "🤖 Starting vLLM server..."
    cd services/api
    nohup ./../../scripts/dev/start-vllm-server.sh > /tmp/vllm.log 2>&1 &
    echo "   Waiting for vLLM to load model (30-60 seconds)..."
    sleep 30
    cd ../..
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
echo "==========================================="
echo "✅ All Systems Operational!"
echo "==========================================="
echo ""
echo "🔗 URLs:"
echo "   Frontend:        http://localhost:3000"
echo "   FastAPI Backend: http://localhost:8000"
echo "   API Docs:        http://localhost:8000/docs"
echo "   MCP Server:      http://localhost:8080"
echo "   vLLM:            http://localhost:8090"
echo ""
echo "📊 Logs:"
echo "   vLLM:       tail -f /tmp/vllm.log"
echo "   MCP Server: tail -f /tmp/mcp-server.log"
echo "   API:        tail -f /tmp/api.log"
echo "   Frontend:   tail -f /tmp/nextjs.log"
echo ""
echo "🛑 To stop all:"
echo "   pkill -f 'vllm|mcp-server|uvicorn|next'"
echo ""
