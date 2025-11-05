#!/bin/bash
# Start the Maverick AI backend (MCP Server)

BACKEND_DIR="/home/riffe007/Documents/projects/life-navigator-agents"

# Check if backend directory exists
if [ ! -d "$BACKEND_DIR" ]; then
    echo "❌ Error: Backend directory not found at $BACKEND_DIR"
    exit 1
fi

# Check if backend is already running
if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Backend is already running on port 8080"
    exit 0
fi

echo "🚀 Starting Maverick AI backend..."
cd "$BACKEND_DIR"

# Check if venv exists
if [ ! -d "venv" ]; then
    echo "❌ Error: Python virtual environment not found"
    echo "Please set up the backend first"
    exit 1
fi

# Activate virtual environment and start server
source venv/bin/activate
python3 start_mcp_server_single.py
