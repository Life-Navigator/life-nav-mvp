#!/bin/bash
# Code Generation Script
# Generates TypeScript types from RDF ontology and OpenAPI specs

set -e

echo "🔧 Running code generation..."

# Generate TypeScript types from OpenAPI
echo "📝 Generating API client from OpenAPI spec..."
cd packages/api-client
if [ -f "../../services/api/openapi.json" ]; then
  pnpm run generate
else
  echo "⚠️  OpenAPI spec not found, skipping..."
fi
cd ../..

# Generate types from RDF ontology
echo "📝 Generating types from RDF ontology..."
# TODO: Implement RDF → TypeScript generation
echo "⚠️  RDF type generation not yet implemented"

# Generate Prisma client
echo "📝 Generating Prisma client..."
if [ -f "apps/web/prisma/schema.prisma" ]; then
  cd apps/web
  npx prisma generate
  cd ../..
fi

echo "✅ Code generation complete!"
