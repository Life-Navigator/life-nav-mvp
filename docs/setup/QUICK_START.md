# Life Navigator - Quick Start Guide

**Status**: ✅ **Ready for Local Development**
**Last Updated**: 2025-11-09

---

## 🎉 All Critical Blockers RESOLVED!

✅ **Blocker 1**: Docker Compose services added (Finance API, Agents, MCP Server)
✅ **Blocker 2**: OCR models will auto-download on first use
✅ **Blocker 3**: Environment variables consolidated in `.env.example`
✅ **Blocker 4**: Migration verification script created

---

## 🚀 Start Development in 3 Steps

### Step 1: Configure Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env and add your Anthropic API key (REQUIRED)
nano .env
# Set: ANTHROPIC_API_KEY=sk-ant-xxxxx
```

**Get Anthropic API Key**: https://console.anthropic.com/

### Step 2: Start All Services

```bash
# Start infrastructure and application services
docker compose up -d

# Watch logs (optional)
docker compose logs -f
```

This will start:
- ✅ PostgreSQL (port 5432)
- ✅ Redis (port 6379)
- ✅ Neo4j (ports 7474, 7687)
- ✅ Qdrant (ports 6333, 6334)
- ✅ GraphDB (port 7200)
- ✅ GraphRAG Rust service (port 50051)
- ✅ Backend API (port 8000)
- ✅ Finance API (port 8001)
- ✅ Agents Service (port 8080)
- ✅ MCP Server (port 8090)

### Step 3: Run Database Migrations

```bash
# Verify migrations status
./scripts/verify_migrations.sh

# Apply all migrations
./scripts/verify_migrations.sh --apply
```

---

## ✅ Verify Everything Works

### Health Checks

```bash
# Backend API
curl http://localhost:8000/health
# Expected: {"status":"healthy","service":"backend"}

# Finance API
curl http://localhost:8001/health
# Expected: {"status":"healthy","service":"finance-api"}

# Agents Service
curl http://localhost:8080/health
# Expected: {"status":"healthy","service":"agents"}

# MCP Server
curl http://localhost:8090/health
# Expected: {"status":"healthy","service":"mcp-server"}

# GraphRAG
docker compose logs graphrag | grep "ready"
```

### API Documentation

- Backend API: http://localhost:8000/docs
- Finance API: http://localhost:8001/api/docs
- Neo4j Browser: http://localhost:7474 (user: neo4j, pass: devpassword)

---

## 📋 Service Ports Reference

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| Backend API | 8000 | http://localhost:8000 | Main backend service |
| Finance API | 8001 | http://localhost:8001 | OCR & financial calculations |
| Agents Service | 8080 | http://localhost:8080 | Multi-agent orchestration |
| MCP Server | 8090 | http://localhost:8090 | Model Context Protocol |
| PostgreSQL | 5432 | postgresql://localhost:5432 | Primary database |
| Redis | 6379 | redis://localhost:6379 | Cache & sessions |
| Neo4j HTTP | 7474 | http://localhost:7474 | Knowledge graph UI |
| Neo4j Bolt | 7687 | bolt://localhost:7687 | Knowledge graph API |
| Qdrant HTTP | 6333 | http://localhost:6333 | Vector database |
| Qdrant gRPC | 6334 | - | Vector database gRPC |
| GraphDB | 7200 | http://localhost:7200 | Semantic triple store |
| GraphRAG | 50051 | - | GraphRAG gRPC service |

---

## 🐛 Common Issues & Solutions

### Issue: "ANTHROPIC_API_KEY not set"

**Solution**:
```bash
# Edit .env and add your key
echo 'ANTHROPIC_API_KEY=sk-ant-your-key-here' >> .env
```

### Issue: "Port already in use"

**Solution**:
```bash
# Find process using port (e.g., 8000)
lsof -i :8000

# Kill process
kill -9 <PID>

# Or stop docker compose and restart
docker compose down
docker compose up -d
```

### Issue: "Cannot connect to database"

**Solution**:
```bash
# Check if PostgreSQL is healthy
docker compose ps postgres

# Restart PostgreSQL
docker compose restart postgres

# Check logs
docker compose logs postgres
```

### Issue: "Neo4j license error"

**Solution**: License is already accepted in docker-compose.yml
```yaml
NEO4J_ACCEPT_LICENSE_AGREEMENT: "yes"
```

### Issue: OCR models not found

**Solution**: Models will download automatically on first use. To pre-download:
```bash
# Install dependencies first
pip install paddleocr paddlepaddle transformers torch addict matplotlib

# Then download models
python scripts/download_ocr_models.py
```

---

## 🛠️ Development Workflow

### Running Tests

```bash
# Backend tests
cd backend
pytest

# Finance API tests
cd services/finance-api
pytest

# Agents tests
cd services/agents
pytest tests/integration/
```

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f finance-api
docker compose logs -f agents

# Last 100 lines
docker compose logs --tail=100 backend
```

### Restarting Services

```bash
# Restart all
docker compose restart

# Restart specific service
docker compose restart backend
docker compose restart finance-api

# Rebuild after code changes
docker compose up -d --build finance-api
```

### Stopping Everything

```bash
# Stop all services (keep data)
docker compose stop

# Stop and remove containers (keep data)
docker compose down

# Stop and remove everything including volumes (DANGER!)
docker compose down -v
```

---

## 📦 What's Included

### Docker Compose Services
- ✅ PostgreSQL 15 with pgvector
- ✅ Redis 7 cache
- ✅ Neo4j 5.15 Enterprise
- ✅ Qdrant vector database
- ✅ GraphDB 10.5.1
- ✅ GraphRAG Rust service
- ✅ Backend FastAPI service
- ✅ Finance API with tri-engine OCR
- ✅ Agents multi-agent system
- ✅ MCP Server

### Migrations
- ✅ Backend: 4 migrations
- ✅ API Service: 4 migrations
- ✅ Finance API: Ready for initial migration

### Configuration
- ✅ Comprehensive `.env.example` with all required variables
- ✅ Docker Compose configured for all services
- ✅ Health checks for all services
- ✅ Auto-restart policies

---

## 📚 Next Steps

1. **Review**: Read the comprehensive `MVP_LAUNCH_GUIDE.md` for full details
2. **Develop**: Start building features using the running services
3. **Deploy**: Follow GCP deployment guide when ready for production

---

## 🔗 Important Documentation

- **MVP Launch Guide**: `MVP_LAUNCH_GUIDE.md` - Complete deployment guide
- **GCP Infrastructure**: `GCP_INFRASTRUCTURE_REQUIREMENTS.md` - Cloud architecture
- **Deployment Checklist**: `DEPLOYMENT_CHECKLIST.md` - K8s deployment steps
- **OCR Setup**: `services/finance-api/OCR_SETUP.md` - OCR configuration

---

## 💡 Tips

- Use `docker compose ps` to check service status
- Use `docker compose logs -f SERVICE` to debug issues
- All services have `/health` endpoints for status checks
- Database credentials are in docker-compose.yml (dev only!)
- OCR works with Tesseract + PaddleOCR (CPU), DeepSeek requires GPU

---

## 🎯 Production Deployment

When ready for GCP deployment:

```bash
# 1. Review infrastructure requirements
cat GCP_INFRASTRUCTURE_REQUIREMENTS.md

# 2. Follow the 11-phase deployment guide
cat MVP_LAUNCH_GUIDE.md | grep "Phase"

# 3. Use Terraform modules in terraform/gcp/modules/
cd terraform/gcp/environments/dev
terraform init
terraform plan
```

---

**Need Help?**
- Check `MVP_LAUNCH_GUIDE.md` for troubleshooting
- Review logs: `docker compose logs -f`
- Verify health: `curl http://localhost:8000/health`

**Happy Coding! 🚀**
