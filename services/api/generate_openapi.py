#!/usr/bin/env python3
"""
Generate OpenAPI specification from FastAPI app
"""
import json
import sys
from pathlib import Path

# Add app directory to path
sys.path.insert(0, str(Path(__file__).parent))

from app.main import app


def generate_openapi():
    """Generate and save OpenAPI specification"""
    openapi_schema = app.openapi()

    # Save to file
    output_path = Path(__file__).parent / "openapi.json"
    with open(output_path, "w") as f:
        json.dump(openapi_schema, f, indent=2)

    print(f"✅ OpenAPI specification generated: {output_path}")
    print(f"📊 API Info:")
    print(f"   - Title: {openapi_schema['info']['title']}")
    print(f"   - Version: {openapi_schema['info']['version']}")
    print(f"   - Endpoints: {len(openapi_schema.get('paths', {}))} paths")

    # Count total operations
    total_ops = sum(
        len(
            [
                op
                for op in path_item.values()
                if isinstance(op, dict) and "operationId" in op
            ]
        )
        for path_item in openapi_schema.get("paths", {}).values()
    )
    print(f"   - Operations: {total_ops} total")


if __name__ == "__main__":
    generate_openapi()
