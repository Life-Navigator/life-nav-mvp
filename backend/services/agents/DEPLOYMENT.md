# Life Navigator - Complete Deployment Guide

This guide will help you deploy the complete Life Navigator multi-agent system with GraphRAG.

## 🎯 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Life Navigator System                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Maverick LLM │  │  MCP Server  │  │  Admin UI    │      │
│  │ (Port 8090)  │  │ (Port 8000)  │  │ (Port 3000)  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         │                  │                  │              │
│         └──────────────────┴──────────────────┘              │
│                           │                                  │
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Database Layer                          │   │
│  ├──────────────┬────────────┬───────────┬────────────┤   │
│  │  PostgreSQL  │   Redis    │   Neo4j   │   Qdrant   │   │
│  │  (Port 5432) │ (Port 6379)│ (Port 7687│ (Port 6333)│   │
│  └──────────────┴────────────┴───────────┴────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## 📋 Prerequisites

### Required Software

```bash
# Python 3.10+
python3 --version

# pip
pip3 --version

# Git
git --version

# Docker (for databases)
docker --version
docker-compose --version
```

### System Requirements

- **CPU**: 8+ cores (or GPU for Maverick)
- **RAM**: 32GB+ recommended
- **Disk**: 100GB+ free space
- **GPU**: NVIDIA GPU with 24GB+ VRAM (for Maverick Q4_K_M)

## 🚀 Quick Start (Development)

### 1. Clone Repository

```bash
cd ~/Documents/projects
git clone <repository-url> life-navigator-agents
cd life-navigator-agents
```

### 2. Install Python Dependencies

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install core dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Install ingestion dependencies
pip install PyPDF2 python-docx beautifulsoup4 sentence-transformers

# Install admin UI dependencies
cd admin_ui
pip install -r requirements.txt
cd ..
```

### 3. Start Databases (Docker Compose)

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: life_navigator
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: your_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

  neo4j:
    image: neo4j:5
    environment:
      NEO4J_AUTH: neo4j/your_password
      NEO4J_PLUGINS: '["apoc"]'
    ports:
      - "7474:7474"
      - "7687:7687"
    volumes:
      - neo4j_data:/data

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  postgres_data:
  redis_data:
  neo4j_data:
  qdrant_data:
```

```bash
# Start databases
docker-compose up -d

# Check status
docker-compose ps
```

### 4. Configure Environment

Create `.env` file:

```bash
# Application
APP_NAME=life-navigator
APP_VERSION=1.0.0
HOST=0.0.0.0
PORT=8000

# Database URLs
POSTGRES_URL=postgresql://postgres:your_password@localhost:5432/life_navigator
REDIS_URL=redis://localhost:6379/0
NEO4J_URL=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
QDRANT_URL=http://localhost:6333

# LLM
LLM_ENDPOINT=http://localhost:8090/v1/chat/completions

# Plugins
ENABLE_GRAPHRAG_PLUGIN=true
ENABLE_MEMORY_PLUGIN=true
ENABLE_WEBSEARCH_PLUGIN=false
ENABLE_FILES_PLUGIN=false

# Logging
LOG_LEVEL=INFO
```

### 5. Start Maverick LLM

```bash
# Start Maverick GPU server
./scripts/start_maverick_gpu.sh

# Wait for it to load (check health)
curl http://localhost:8090/health
```

### 6. Start MCP Server

```bash
# Activate venv
source venv/bin/activate

# Start server
cd mcp-server
python -m uvicorn core.server:app --host 0.0.0.0 --port 8000 --reload

# Or use the convenience script
# ./scripts/start_mcp_server.sh
```

### 7. Start Admin UI

```bash
# In a new terminal
cd admin_ui
./run_admin.sh
```

### 8. Verify Installation

```bash
# Check all services
curl http://localhost:8090/health  # Maverick
curl http://localhost:8000/health  # MCP Server
curl http://localhost:3000         # Admin UI
```

## 🔧 Configuration

### MCP Server Configuration

Edit `mcp-server/utils/config.py` or use environment variables:

```python
# Database settings
POSTGRES_URL: str
REDIS_URL: str
NEO4J_URL: str
QDRANT_URL: str

# Plugin settings
ENABLE_GRAPHRAG_PLUGIN: bool = True
ENABLE_MEMORY_PLUGIN: bool = True

# LLM settings
LLM_ENDPOINT: str = "http://localhost:8090/v1/chat/completions"
```

### Maverick LLM Configuration

Edit `scripts/start_maverick_gpu.sh`:

```bash
# GPU layers (adjust based on your GPU)
-ngl 10 \

# Context size (reduce if getting context shift errors)
-c 4096 \

# Threads
-t 8 \

# Batch size
-b 512
```

**Note**: If you see "context shift is disabled" errors, reduce `-c` to 2048 or 4096.

## 📊 Usage

### Upload Documents via Admin UI

1. Open http://localhost:3000
2. Toggle "Centralized" mode (or set User ID)
3. Drag & drop files or click to upload
4. Watch real-time progress
5. View statistics

### Upload via API

```bash
curl -X POST "http://localhost:8000/ingest/upload" \
  -F "file=@document.pdf" \
  -F "user_id=admin" \
  -F "is_centralized=true"
```

### Query Knowledge Graph

```bash
curl -X POST "http://localhost:8000/mcp/tool/invoke" \
  -H "Content-Type: application/json" \
  -d '{
    "tool_name": "hybrid_search",
    "user_id": "admin",
    "parameters": {
      "query": "artificial intelligence",
      "max_results": 10
    }
  }'
```

## 🐳 Production Deployment (Docker)

### Build Docker Images

```dockerfile
# Dockerfile for MCP Server
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY mcp-server/ ./mcp-server/

EXPOSE 8000

CMD ["uvicorn", "mcp-server.core.server:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
# Build
docker build -t life-navigator-mcp:latest .

# Run
docker run -d \
  --name mcp-server \
  -p 8000:8000 \
  --env-file .env \
  life-navigator-mcp:latest
```

### Production Stack (docker-compose-prod.yml)

```yaml
version: '3.8'

services:
  mcp-server:
    build: .
    ports:
      - "8000:8000"
    environment:
      - POSTGRES_URL=postgresql://postgres:password@postgres:5432/life_navigator
      - REDIS_URL=redis://redis:6379/0
      - NEO4J_URL=bolt://neo4j:7687
      - QDRANT_URL=http://qdrant:6333
    depends_on:
      - postgres
      - redis
      - neo4j
      - qdrant

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: life_navigator
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  neo4j:
    image: neo4j:5
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
      NEO4J_PLUGINS: '["apoc"]'
    volumes:
      - neo4j_data:/data

  qdrant:
    image: qdrant/qdrant:latest
    volumes:
      - qdrant_data:/qdrant/storage

volumes:
  postgres_data:
  redis_data:
  neo4j_data:
  qdrant_data:
```

```bash
# Deploy
docker-compose -f docker-compose-prod.yml up -d
```

## 🔐 Security

### Production Checklist

- [ ] Change all default passwords
- [ ] Enable HTTPS/TLS
- [ ] Add API authentication (JWT/OAuth2)
- [ ] Configure firewalls
- [ ] Enable database encryption
- [ ] Set up backup strategy
- [ ] Configure log rotation
- [ ] Add rate limiting
- [ ] Enable CORS properly
- [ ] Use secrets management

### Environment Variables

Never commit `.env` to git. Use:
- Azure Key Vault
- AWS Secrets Manager
- HashiCorp Vault
- Kubernetes Secrets

## 📈 Monitoring

### Health Checks

```bash
# MCP Server health
curl http://localhost:8000/health

# Database health
curl http://localhost:8000/health | jq '.databases'

# Plugin health
curl http://localhost:8000/health | jq '.plugins'
```

### Logs

```bash
# MCP Server logs
tail -f logs/mcp_server.log

# Maverick logs
tail -f logs/maverick_server.log

# Docker logs
docker-compose logs -f mcp-server
```

### Metrics (Future)

- Prometheus metrics at `/metrics`
- Grafana dashboards
- Alert manager integration

## 🔄 Backup & Recovery

### Database Backups

```bash
# PostgreSQL backup
docker exec postgres pg_dump -U postgres life_navigator > backup.sql

# Neo4j backup
docker exec neo4j neo4j-admin database dump neo4j --to=/backups/neo4j.dump

# Qdrant backup
docker exec qdrant tar czf /backups/qdrant.tar.gz /qdrant/storage
```

### Restore

```bash
# PostgreSQL restore
cat backup.sql | docker exec -i postgres psql -U postgres life_navigator

# Neo4j restore
docker exec neo4j neo4j-admin database load neo4j --from=/backups/neo4j.dump

# Qdrant restore
docker exec qdrant tar xzf /backups/qdrant.tar.gz -C /
```

## 🐛 Troubleshooting

### Common Issues

**1. Maverick "context shift" error**
- Reduce context size in start script (`-c 2048`)
- Use smaller documents
- Enable context shift if supported

**2. Database connection errors**
- Check Docker containers are running
- Verify connection strings in `.env`
- Check firewall settings

**3. Out of memory**
- Reduce Maverick GPU layers (`-ngl`)
- Increase Docker memory limits
- Use smaller embedding model

**4. Slow processing**
- Check GPU utilization
- Increase batch size
- Use more workers

### Debug Mode

```bash
# MCP Server debug logs
LOG_LEVEL=DEBUG python -m uvicorn core.server:app --reload

# Maverick verbose mode
./scripts/start_maverick_gpu.sh --verbose
```

## 📚 Additional Resources

- [API Documentation](mcp-server/API_USAGE.md)
- [Admin UI Guide](admin_ui/README.md)
- [GraphRAG Plugin](docs/QUICKSTART_GRAPHRAG.md)
- [Memory System](mcp-server/plugins/memory/README.md)
- [A2A Framework](mcp-server/agents/README.md)

## 🆘 Support

For issues or questions:
1. Check the troubleshooting section
2. Review logs for errors
3. Check GitHub issues
4. Contact support team

## 🎉 Success!

You should now have:
- ✅ Maverick LLM running on port 8090
- ✅ MCP Server running on port 8000
- ✅ Admin UI running on port 3000
- ✅ All databases operational
- ✅ Document ingestion working
- ✅ Knowledge graph populated
- ✅ Vector search enabled

Start uploading documents and building your knowledge base!
