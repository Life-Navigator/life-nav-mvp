#!/bin/bash
# Generate Python gRPC stubs from protobuf definitions

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
PROTO_DIR="$BACKEND_DIR/app/proto"

echo "Generating Python gRPC stubs..."
echo "Proto directory: $PROTO_DIR"

# Ensure grpcio-tools is installed
if ! python -m grpc_tools.protoc --version &> /dev/null; then
    echo "Error: grpcio-tools not installed. Install with: poetry add grpcio-tools"
    exit 1
fi

# Generate Python stubs
python -m grpc_tools.protoc \
    -I"$PROTO_DIR" \
    --python_out="$PROTO_DIR" \
    --grpc_python_out="$PROTO_DIR" \
    --pyi_out="$PROTO_DIR" \
    "$PROTO_DIR/graphrag.proto"

echo "✓ Generated Python stubs in $PROTO_DIR"
echo "  - graphrag_pb2.py (message types)"
echo "  - graphrag_pb2_grpc.py (service stubs)"
echo "  - graphrag_pb2.pyi (type hints)"
