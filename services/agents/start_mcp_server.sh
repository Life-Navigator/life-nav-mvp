#!/bin/bash
# Start MCP Server for Life Navigator Multi-Agent System
# Works with vLLM-served models (local testing or GCP production)

set -e

cd "$(dirname "$0")"

echo "🚀 Starting Life Navigator MCP Server"
echo "======================================="

# Check if vLLM is running
if ! curl -s http://localhost:8090/health > /dev/null 2>&1; then
    echo "⚠️  vLLM server not detected on port 8090"
    echo "   Start it with: ./scripts/dev/start-vllm-server.sh"
    echo "   Or set MAVERICK_URL to point to your vLLM instance"
    echo ""
fi

# Configuration
export MAVERICK_URL="${MAVERICK_URL:-http://localhost:8090}"
export MCP_PORT="${MCP_PORT:-8080}"
export MCP_HOST="${MCP_HOST:-0.0.0.0}"

echo "Configuration:"
echo "  Maverick URL: $MAVERICK_URL"
echo "  MCP Port: $MCP_PORT"
echo "  MCP Host: $MCP_HOST"
echo ""

# Check for virtual environment
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate venv
source venv/bin/activate

# Install dependencies if needed
if [ ! -f "venv/.deps_installed" ]; then
    echo "📦 Installing dependencies..."
    pip install -e . 2>&1 | tail -20
    touch venv/.deps_installed
fi

# Start MCP Server
echo "🚀 Starting MCP Server..."
python3 -m uvicorn mcp-server.core.server:app \
    --host "$MCP_HOST" \
    --port "$MCP_PORT" \
    --reload \
    2>&1 | tee /tmp/mcp-server.log
