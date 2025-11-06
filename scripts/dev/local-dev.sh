#!/bin/bash
# Local Development Environment Startup Script

set -e

echo "🚀 Starting Life Navigator local development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker and try again."
  exit 1
fi

# Start Docker Compose services
echo "📦 Starting Docker Compose services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
echo "🔍 Checking service health..."
docker-compose ps

# Run database migrations
echo "📊 Running database migrations..."
if [ -f "services/api/alembic.ini" ]; then
  cd services/api
  poetry run alembic upgrade head
  cd ../..
fi

# Start all services with Turbo
echo "🎯 Starting all services..."
pnpm dev

echo "✅ Local development environment is ready!"
echo ""
echo "📌 Services:"
echo "  - Web App:     http://localhost:3000"
echo "  - API:         http://localhost:8000"
echo "  - API Docs:    http://localhost:8000/docs"
echo "  - Agents:      http://localhost:8080"
echo "  - Neo4j:       http://localhost:7474"
echo "  - GraphDB:     http://localhost:7200"
