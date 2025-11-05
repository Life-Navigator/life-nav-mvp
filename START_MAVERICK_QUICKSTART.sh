#!/bin/bash
# Quick start script to get Maverick + Agent System running

set -e

echo "🚀 Starting Life Navigator AI Agent System with Maverick"
echo "========================================================="
echo ""

# Check if Maverick is already running
if curl -s http://localhost:8090/health > /dev/null 2>&1; then
    echo "✅ Maverick server already running on port 8090"
else
    echo "🤖 Starting Maverick model server with GPU acceleration..."
    # Use GPU script for hybrid GPU+CPU offload (10 GPU layers + CPU)
    ./scripts/start_maverick_gpu.sh &
    echo "⏳ Waiting for Maverick to load (may take 1-2 minutes)..."
    sleep 60
    
    if curl -s http://localhost:8090/health > /dev/null 2>&1; then
        echo "✅ Maverick server started successfully"
    else
        echo "❌ Maverick server failed to start. Check logs/maverick_server.log"
        exit 1
    fi
fi

echo ""

# Start MCP Server
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ MCP Server already running on port 8080"
else
    echo "🔧 Starting MCP Server..."
    nohup ./venv/bin/python3 start_mcp_server_single.py > /tmp/mcp_server.log 2>&1 &
    sleep 3
    
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ MCP Server started successfully"
    else
        echo "❌ MCP Server failed to start. Check /tmp/mcp_server.log"
        exit 1
    fi
fi

echo ""

# Start Dashboard
if curl -s http://localhost:8501 > /dev/null 2>&1; then
    echo "✅ Dashboard already running on port 8501"
else
    echo "📊 Starting Admin Dashboard..."
    cd ui
    nohup ../venv/bin/python3 -m streamlit run admin_app.py --server.port 8501 --server.headless true > /tmp/admin_dashboard.log 2>&1 &
    cd ..
    sleep 3
    
    if curl -s http://localhost:8501 > /dev/null 2>&1; then
        echo "✅ Dashboard started successfully"
    else
        echo "❌ Dashboard failed to start. Check /tmp/admin_dashboard.log"
        exit 1
    fi
fi

echo ""
echo "========================================================="
echo "✅ All Systems Operational!"
echo "========================================================="
echo ""
echo "🔗 URLs:"
echo "   Maverick Model:  http://localhost:8090"
echo "   MCP Server:      http://localhost:8080"
echo "   Dashboard:       http://localhost:8501"
echo ""
echo "📝 Next Steps:"
echo "   1. Read: docs/guides/CONNECT_MAVERICK_MODEL.md"
echo "   2. Update mcp-server/core/server.py line 908 with Maverick code"
echo "   3. Restart MCP: pkill -f start_mcp_server && nohup ./venv/bin/python3 start_mcp_server_single.py > /tmp/mcp_server.log 2>&1 &"
echo "   4. Create agent: Open http://localhost:8501"
echo "   5. Chat: ./venv/bin/python3 chat_with_agent.py"
echo ""
echo "📚 Documentation: docs/README.md"
echo ""
