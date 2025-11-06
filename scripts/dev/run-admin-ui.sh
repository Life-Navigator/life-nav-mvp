#!/bin/bash
# Start Life Navigator Admin Dashboard

echo "================================================"
echo "Starting Life Navigator Admin Dashboard"
echo "================================================"
echo ""

# Check if streamlit is installed
if ! command -v streamlit &> /dev/null; then
    echo "ERROR: Streamlit is not installed!"
    echo "Install with: pip install streamlit plotly"
    exit 1
fi

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "Starting admin dashboard at http://localhost:8501"
echo ""
echo "Features:"
echo "  📤 Document Ingestion"
echo "  📈 Usage Analytics"
echo "  🛡️ Guardrail Monitoring"
echo "  🚦 Traffic & Performance"
echo "  👥 User Analytics"
echo ""

streamlit run ui/admin_app.py --server.port 8501 --server.address 0.0.0.0
