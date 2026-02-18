# Life Navigator Agents - Quick Context

## 🎯 What This Is
Hierarchical multi-agent system with dual GraphRAG for intelligent task decomposition across life domains (Finance, Career, Education, Healthcare).

## 📊 Current State
- **Status:** Empty skeleton - 0 lines of code
- **Phase:** Need to build Phase 1 foundation
- **Structure:** ✅ Directories exist, ❌ Implementation missing

## 🏗️ Architecture (4 Tiers)
```
L0: Orchestrator (1) → Intent analysis, task decomposition
L1: Domain Managers (4) → Finance, Career, Education, Healthcare
L2: Specialists (8+) → Budget, Investment, Job Search, Skills, etc.
L3: Tools → External APIs (Plaid, Coinbase, ADP)
```

## 💾 Dual GraphRAG
- **Neptune:** Relationships, graph traversal, inference
- **PostgreSQL+pgvector:** Transactions, RLS, semantic search
- **Unified Client:** Smart routing between both

## 🔧 Tech Stack
- Python 3.12 (async/await)
- Llama 4 via vLLM (2 instances)
- FastAPI + Uvicorn
- Redis (pub/sub) + RabbitMQ (queues)
- PostgreSQL + Neptune + Qdrant
- Prometheus metrics

## 📁 Key Files to Build (In Order)

### 1. Foundation (Week 1)
```
utils/config.py          # Configuration
utils/logging.py         # Structured logs
utils/errors.py          # Error hierarchy
models/agent_models.py   # Pydantic models
models/message_models.py # Message schemas
```

### 2. Data Layer (Week 1-2)
```
graphrag/embeddings.py      # Sentence Transformers
graphrag/postgres_client.py # AsyncPG + pgvector
graphrag/neptune_client.py  # Gremlin client
graphrag/client.py          # Unified interface
```

### 3. Messaging (Week 2)
```
messaging/redis_client.py    # Pub/Sub
messaging/rabbitmq_client.py # Task queues
messaging/message_bus.py     # Unified bus
```

### 4. LLM (Week 2)
```
models/vllm_client.py # vLLM HTTP client
```

### 5. Agent Framework (Week 3)
```
agents/core/base_agent.py # BaseAgent (400+ lines)
```

### 6. Orchestration (Week 3-4)
```
agents/orchestration/orchestrator.py # L0 agent (400+ lines)
agents/domain/finance_manager.py     # L1 manager
agents/domain/career_manager.py      # L1 manager
```

### 7. API (Week 4)
```
api/main.py                  # FastAPI app
api/routes/orchestrator.py   # Main endpoint
api/middleware/auth.py       # JWT
```

### 8. Infrastructure (Week 5)
```
infra/docker/docker-compose.yml # Local dev
```

## 🎨 Design Patterns

### BaseAgent (All agents inherit)
```python
class BaseAgent:
    async def handle_task(task: Task) -> TaskResult
    async def handle_query(query: Query) -> QueryResult
    async def gather_context(user_id: str) -> Context
```

### Message Types
- **Commands:** RabbitMQ queues (reliable)
- **Events:** Redis pub/sub (fast, transient)
- **Queries:** RabbitMQ RPC (request-response)

### Code Standards
- Black (88 chars) + Ruff
- Type hints mandatory
- Google-style docstrings
- ≥80% test coverage
- Async-first (no blocking I/O)

## 🚀 Quick Commands
```bash
# Setup
python3.12 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"

# Dev
pytest --cov
mypy .
black .
ruff check .

# Run
python -m api.main
```

## 📝 When Building Agents

1. **Inherit from BaseAgent**
2. **Implement required methods:** `handle_task()`, `handle_query()`
3. **Use GraphRAG:** Query context before processing
4. **Publish events:** Notify other agents of state changes
5. **Add metrics:** Prometheus counters/histograms
6. **Write tests:** Unit + integration

## 🔐 Security
- JWT authentication on all API calls
- PostgreSQL RLS for multi-tenancy
- All DB connections use SSL/TLS
- Secrets in AWS Secrets Manager (prod)

## ⚠️ Critical Reminders
- **No code exists** - Build from scratch
- **Async everything** - No blocking calls
- **Microservice only** - No UI, pure backend
- **Multi-tenant** - Design for multiple users
- **GPU required** - For vLLM (2x NVIDIA recommended)

## 📚 Full Documentation
See `CLAUDE_CONTEXT_PROMPT.md` for complete details.

---
**Status:** Phase 0 → Phase 1
**Target:** 3,500+ lines for foundation
**Current:** 0 lines
