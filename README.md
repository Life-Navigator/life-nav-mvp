# Life Navigator - Multi-Agent GraphRAG System

**Production-ready multi-agent system with hybrid GraphRAG, 4-tier memory, and automated data ingestion**

---

## 🌟 Key Features

### 🧠 Hybrid GraphRAG
- Knowledge Graph (Neo4j) + Vector Store (Qdrant)
- Row-level security for multi-tenancy
- Centralized & personalized knowledge bases

### 💾 4-Tier Memory System
- Short-term (Redis), Working (Redis), Long-term (PostgreSQL), Episodic (Neo4j)
- Automatic memory consolidation

### 🤖 A2A Multi-Agent Framework
- Research, Analyst, Writer agents
- Message bus, coordinator, workflow engine

### 📄 Automated Data Ingestion
- 8 document formats: TXT, MD, PDF, DOCX, HTML, CSV, JSON
- Entity & concept extraction with Maverick LLM
- Background processing with progress tracking

### 🎨 Beautiful Admin UI
- Reflex-based responsive interface
- Drag & drop uploads
- Real-time progress monitoring

### 🚀 FastAPI REST API
- Document upload, job tracking, statistics
- GraphRAG queries, tool invocation

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt
pip install PyPDF2 python-docx beautifulsoup4 sentence-transformers

# 2. Start databases
docker-compose up -d

# 3. Start Maverick
./scripts/start_maverick_gpu.sh

# 4. Start MCP Server
cd mcp-server
uvicorn core.server:app --reload

# 5. Start Admin UI
cd admin_ui
./run_admin.sh
```

**Verify**: http://localhost:8000/health

---

## 📖 Documentation

- [Deployment Guide](DEPLOYMENT.md) - Complete setup
- [API Documentation](mcp-server/API_USAGE.md) - REST API reference
- [Admin UI Guide](admin_ui/README.md) - UI documentation

---

## 🏗️ Architecture

```
Maverick LLM → MCP Server → GraphRAG/Memory/A2A
                  ↓
            Neo4j + Qdrant + PostgreSQL + Redis
```

---

## 📊 System Status

✅ MCP Server (FastAPI)  
✅ GraphRAG Plugin (Neo4j + Qdrant)  
✅ 4-Tier Memory System  
✅ A2A Multi-Agent Framework  
✅ Data Ingestion Pipeline  
✅ Admin UI (Reflex)  
✅ REST API Endpoints  

**Ready for production deployment!**

---

Built with Claude Code
