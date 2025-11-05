# Life Navigator Agents - Complete Project Context

## 🎯 PROJECT IDENTITY

**Name:** Life Navigator Agents
**Type:** Hierarchical Multi-Agent Orchestration System with Dual GraphRAG
**Status:** Phase 0 → Phase 1 (Foundation Building Required)
**Purpose:** Standalone microservice for intelligent task decomposition and execution across life domains
**Not:** This is NOT the Life Navigator app itself - it's a backend service consumed by the main app

---

## 📊 CURRENT STATE (Critical to Understand)

### What EXISTS:
- ✅ Project structure (directories created)
- ✅ Python 3.12 virtual environment
- ✅ Dependencies installed via pyproject.toml
- ✅ Empty `__init__.py` files in all modules
- ✅ Configuration files (.env, pyproject.toml, .gitignore)
- ✅ Git repository initialized (no commits yet)

### What DOES NOT EXIST (Needs Building):
- ❌ **Zero lines of implementation code**
- ❌ All core files mentioned in context.md (they're planned, not built)
- ❌ Documentation files (docs/ folder is empty)
- ❌ Infrastructure configs (docker/, k8s/, terraform/ folders are empty)
- ❌ Tests (test folders exist but are empty)
- ❌ Examples and scripts (folders exist but are empty)

**Total Current Codebase:** 0 lines of Python implementation

---

## 🏗️ TARGET ARCHITECTURE

### 4-Tier Hierarchical Agent System

```
┌─────────────────────────────────────────────────────────────┐
│ L0: ORCHESTRATOR                                            │
│ • Request parsing & intent analysis (Llama 4 LLM)          │
│ • Strategic planning & task decomposition                   │
│ • Multi-domain routing & conflict resolution                │
│ • Single entry point for all user requests                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ L1: DOMAIN MANAGERS (4 managers)                            │
│ ┌──────────┬──────────┬──────────┬──────────────┐          │
│ │ Finance  │ Career   │ Education│ Healthcare   │          │
│ │ Manager  │ Manager  │ Manager  │ Manager      │          │
│ └──────────┴──────────┴──────────┴──────────────┘          │
│ • Domain-specific coordination                              │
│ • Specialist agent delegation                               │
│ • Cross-specialist orchestration                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ L2: SPECIALIST AGENTS (8-12 specialists)                    │
│                                                             │
│ Finance:          Career:           Education:              │
│ • Budget         • Job Search       • Course Planning       │
│ • Investment     • Skills Dev       • Learning Paths        │
│ • Tax            • Networking       (Future)                │
│ • Debt           • Performance                              │
│                                                             │
│ • Single-domain expertise                                   │
│ • Tool orchestration                                        │
│ • GraphRAG context gathering                                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ L3: TOOL AGENTS (External Integrations)                     │
│ • Plaid (banking APIs)                                      │
│ • Coinbase (crypto trading)                                 │
│ • ADP (payroll data)                                        │
│ • Future: OpenFDA, LinkedIn, Coursera APIs                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 💾 DUAL GRAPHRAG ARCHITECTURE

### Why Dual Graphs?
Different data structures serve different query patterns:

### 1. **Neptune (Graph Database)**
- **Purpose:** Relationship mapping, path finding, inference
- **Use Cases:**
  - "What investments are affected by my job change?"
  - "How does this skill gap impact my career goals?"
  - "Find connections between health conditions and expenses"
- **Data Model:**
  ```
  User → Account → Transaction
  User → Job → Skills → Goals
  User → Course → Skills → Career
  User → Condition → Medication → Appointment
  ```
- **Queries:** Cypher-like graph traversal

### 2. **PostgreSQL with RLS (Relational + Vector)**
- **Purpose:** Transactional records, user isolation, semantic search
- **Use Cases:**
  - Transactional queries (recent expenses, account balances)
  - User data isolation (Row-Level Security)
  - Semantic similarity (pgvector embeddings)
  - ACID compliance for financial data
- **Features:**
  - pgvector extension for embeddings
  - Row-Level Security for multi-tenancy
  - Traditional SQL for complex aggregations

### 3. **Unified GraphRAG Client**
- Abstracts both backends
- Intelligent query routing (graph vs relational)
- Embedding generation via Sentence Transformers
- Cross-graph joins when needed

---

## 🔧 TECHNOLOGY STACK

### Core Framework
- **Language:** Python 3.12 (async/await throughout)
- **Async Runtime:** asyncio with uvloop (high-performance event loop)
- **Type System:** Full type hints (mypy strict mode)

### LLM Infrastructure
- **Model:** Llama 4 Maverick (70B parameters, planned)
- **Serving:** vLLM (GPU-optimized inference)
- **Instances:** 2x vLLM servers (load balanced)
  - Instance 1: localhost:8000
  - Instance 2: localhost:8001
- **Use Cases:**
  - Intent analysis (Orchestrator)
  - Task decomposition
  - Context synthesis
  - Query generation

### Data Layer
- **Graph DB:** AWS Neptune (Gremlin/SPARQL)
- **Relational DB:** PostgreSQL 15+
  - Extensions: pgvector, RLS
- **Vector Search:** Qdrant (optional, for dedicated vector ops)
- **Embeddings:** Sentence Transformers (all-MiniLM-L6-v2)

### Messaging & Communication
- **Fast Events:** Redis Pub/Sub
  - Sub-10ms latency
  - Broadcast patterns
  - Transient events
- **Reliable Tasks:** RabbitMQ
  - Guaranteed delivery
  - Dead letter queues
  - Work distribution

### API & Monitoring
- **Web Framework:** FastAPI + Uvicorn (ASGI)
- **Metrics:** Prometheus client
- **Logging:** Structured JSON logs
- **Security:** JWT tokens, encryption, CORS

### Development Tools
- **Formatting:** Black (88 char line length)
- **Linting:** Ruff (fast Python linter)
- **Type Checking:** mypy
- **Testing:** pytest + pytest-asyncio + pytest-cov (≥80% coverage)

---

## 📁 PROJECT STRUCTURE

```
life-navigator-agents/
├── agents/
│   ├── core/
│   │   ├── __init__.py
│   │   └── base_agent.py          # TO BUILD: BaseAgent framework
│   ├── orchestration/
│   │   ├── __init__.py
│   │   └── orchestrator.py        # TO BUILD: L0 Orchestrator
│   ├── domain/
│   │   ├── __init__.py
│   │   ├── domain_managers.py     # TO BUILD: L1 Domain Managers
│   │   ├── finance_manager.py
│   │   ├── career_manager.py
│   │   └── ...
│   ├── specialists/
│   │   ├── __init__.py
│   │   ├── finance/
│   │   │   ├── budget_agent.py
│   │   │   ├── investment_agent.py
│   │   │   ├── tax_agent.py
│   │   │   └── debt_agent.py
│   │   ├── career/
│   │   │   ├── job_search_agent.py
│   │   │   ├── skills_agent.py
│   │   │   ├── networking_agent.py
│   │   │   └── performance_agent.py
│   │   └── ...
│   └── tools/
│       ├── __init__.py
│       ├── plaid_tool.py
│       ├── coinbase_tool.py
│       └── adp_tool.py
├── graphrag/
│   ├── __init__.py
│   ├── client.py                   # TO BUILD: Unified GraphRAG
│   ├── neptune_client.py
│   ├── postgres_client.py
│   └── embeddings.py
├── models/
│   ├── __init__.py
│   ├── vllm_client.py             # TO BUILD: vLLM integration
│   ├── agent_models.py             # Pydantic models
│   ├── message_models.py
│   └── graphrag_models.py
├── messaging/
│   ├── __init__.py
│   ├── message_bus.py             # TO BUILD: Redis + RabbitMQ
│   ├── redis_client.py
│   └── rabbitmq_client.py
├── api/
│   ├── __init__.py
│   ├── main.py                    # TO BUILD: FastAPI app
│   ├── routes/
│   │   ├── orchestrator.py
│   │   ├── finance.py
│   │   ├── career.py
│   │   └── ...
│   └── middleware/
│       ├── auth.py
│       └── logging.py
├── utils/
│   ├── __init__.py
│   ├── logging.py
│   ├── config.py
│   └── errors.py
├── tests/
│   ├── unit/
│   │   ├── test_base_agent.py
│   │   ├── test_orchestrator.py
│   │   └── ...
│   └── integration/
│       ├── test_graphrag.py
│       ├── test_message_bus.py
│       └── ...
├── infra/
│   ├── docker/
│   │   ├── Dockerfile
│   │   ├── docker-compose.yml      # TO CREATE: Local dev
│   │   └── docker-compose.prod.yml
│   ├── k8s/
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   └── configmap.yaml
│   └── terraform/
│       ├── main.tf
│       ├── neptune.tf
│       ├── rds.tf
│       └── elasticache.tf
├── docs/
│   ├── ARCHITECTURE.md             # TO CREATE
│   ├── IMPLEMENTATION_GUIDE.md     # TO CREATE
│   ├── API_REFERENCE.md
│   └── DEPLOYMENT.md
├── .env                            # EXISTS (needs secrets)
├── pyproject.toml                  # EXISTS
├── README.md                       # EXISTS (basic)
└── .gitignore                      # EXISTS
```

---

## 🔑 KEY DESIGN PATTERNS

### 1. **BaseAgent Pattern**
Every agent inherits from `BaseAgent` (to be built):

```python
class BaseAgent:
    """
    Core agent framework providing:
    - State management (idle, processing, error)
    - Lifecycle hooks (startup, shutdown, health)
    - Memory management (short-term context)
    - Error handling & retry logic
    - GraphRAG integration
    - Message bus integration
    - Metrics collection
    """

    async def handle_task(self, task: Task) -> TaskResult
    async def handle_query(self, query: Query) -> QueryResult
    async def gather_context(self, user_id: str) -> Context
```

### 2. **Message-Driven Architecture**
Agents communicate via messages, not direct calls:

- **Commands:** "Do this task" (RabbitMQ queues)
- **Events:** "This happened" (Redis pub/sub)
- **Queries:** "What is...?" (RabbitMQ RPC)

### 3. **Async-First**
- No blocking I/O in event loop
- All database calls are async (asyncpg, async Neo4j driver)
- Concurrent task execution with asyncio.gather()
- Timeouts on all external calls

### 4. **Factory Pattern for Agent Creation**
```python
AgentRegistry.create("FinanceManager", user_id="123")
AgentRegistry.create("BudgetSpecialist", user_id="123")
```

### 5. **Strategy Pattern for Query Routing**
GraphRAG client decides: Neptune vs PostgreSQL vs Both

---

## 🔄 MESSAGE FLOW EXAMPLE

**User Request:** "How much can I invest this month?"

```
1. API Gateway receives request
   POST /orchestrator/analyze

2. Orchestrator (L0)
   ├─ Parse intent with Llama 4
   ├─ Decompose: "Need budget analysis + investment capacity"
   └─ Route to: FinanceManager

3. FinanceManager (L1)
   ├─ Delegate to: BudgetSpecialist
   ├─ Delegate to: InvestmentSpecialist
   └─ Coordinate results

4. BudgetSpecialist (L2)
   ├─ Query GraphRAG: Income, expenses, goals
   ├─ Calculate: Available funds
   └─ Return: Budget report

5. InvestmentSpecialist (L2)
   ├─ Query GraphRAG: Existing investments, risk profile
   ├─ Tool call: Coinbase (current prices)
   ├─ Calculate: Investment recommendation
   └─ Return: Investment report

6. FinanceManager aggregates
   └─ Synthesizes final answer

7. Orchestrator responds to API
   └─ Returns JSON response
```

---

## 📝 DEVELOPMENT STANDARDS

### Code Style
- **Formatting:** Black with 88-character line length
- **Imports:** isort (automatic sorting)
- **Linting:** Ruff (replaces flake8, pylint, etc.)
- **Type Hints:** Mandatory on all functions
  ```python
  async def process(self, data: TaskData) -> Result:
      ...
  ```

### Docstrings (Google Style)
```python
async def handle_task(self, task: Task) -> TaskResult:
    """Process a task assigned to this agent.

    Args:
        task: Task object containing user request and context.

    Returns:
        TaskResult with status, data, and any errors.

    Raises:
        TaskExecutionError: If task processing fails.
        TimeoutError: If task exceeds time limit.
    """
```

### Testing Requirements
- **Coverage:** ≥80% overall
- **Unit Tests:** For all business logic
- **Integration Tests:** For database, messaging, external APIs
- **Async Tests:** Use pytest-asyncio
- **Fixtures:** Shared in conftest.py
- **Mocking:** Use pytest-mock for external services

### Commit Convention
```
feat(scope): add investment specialist agent
fix(graphrag): correct Neptune connection pooling
docs(api): update endpoint documentation
test(orchestrator): add integration tests
refactor(messaging): simplify message routing
```

### Error Handling
```python
class AgentError(Exception):
    """Base exception for agent errors."""

class TaskExecutionError(AgentError):
    """Raised when task execution fails."""

class GraphRAGError(AgentError):
    """Raised when GraphRAG queries fail."""
```

---

## 🚀 PHASE 1: FOUNDATION (Current Priority)

### Critical Path (Build in Order)

1. **Core Infrastructure** (Week 1)
   - [ ] `utils/config.py` - Configuration management
   - [ ] `utils/logging.py` - Structured logging
   - [ ] `utils/errors.py` - Error hierarchy
   - [ ] `models/agent_models.py` - Pydantic models
   - [ ] `models/message_models.py` - Message schemas

2. **Data Layer** (Week 1-2)
   - [ ] `graphrag/embeddings.py` - Sentence Transformers wrapper
   - [ ] `graphrag/postgres_client.py` - AsyncPG + pgvector
   - [ ] `graphrag/neptune_client.py` - Gremlin client
   - [ ] `graphrag/client.py` - Unified interface

3. **Messaging** (Week 2)
   - [ ] `messaging/redis_client.py` - Pub/Sub
   - [ ] `messaging/rabbitmq_client.py` - Task queues
   - [ ] `messaging/message_bus.py` - Unified bus

4. **LLM Integration** (Week 2)
   - [ ] `models/vllm_client.py` - vLLM HTTP client
   - [ ] Prompt templates for intent analysis
   - [ ] Response parsing utilities

5. **Agent Framework** (Week 3)
   - [ ] `agents/core/base_agent.py` - 400+ lines
     - State management
     - Lifecycle hooks
     - GraphRAG integration
     - Message handling
     - Metrics collection

6. **L0: Orchestrator** (Week 3-4)
   - [ ] `agents/orchestration/orchestrator.py` - 400+ lines
     - Request parsing
     - Intent analysis (LLM)
     - Task decomposition
     - Domain routing

7. **L1: Domain Managers** (Week 4)
   - [ ] `agents/domain/finance_manager.py`
   - [ ] `agents/domain/career_manager.py`
   - [ ] Specialist delegation logic
   - [ ] Result aggregation

8. **API Layer** (Week 4)
   - [ ] `api/main.py` - FastAPI app
   - [ ] `api/routes/orchestrator.py` - Main endpoint
   - [ ] `api/middleware/auth.py` - JWT validation
   - [ ] `api/middleware/logging.py` - Request/response logging

9. **Infrastructure** (Week 5)
   - [ ] `infra/docker/docker-compose.yml` - Local dev environment
     - PostgreSQL with pgvector
     - Redis
     - RabbitMQ
     - 2x vLLM containers
   - [ ] `infra/docker/Dockerfile` - App container
   - [ ] Database migration scripts

10. **Testing** (Ongoing)
    - [ ] Unit tests for each module
    - [ ] Integration tests for full flows
    - [ ] Load testing scripts

---

## 🎯 PHASE 2: SPECIALIST AGENTS

### Finance Specialists (Priority 1)

1. **BudgetSpecialistAgent**
   - Responsibilities:
     - Income/expense tracking
     - Budget creation & monitoring
     - Spending pattern analysis
     - Cash flow forecasting
   - GraphRAG Queries:
     - Recent transactions by category
     - Recurring expenses
     - Income sources
   - Tools: Plaid (bank transactions)

2. **InvestmentSpecialistAgent**
   - Responsibilities:
     - Portfolio analysis
     - Asset allocation recommendations
     - Performance tracking
     - Rebalancing suggestions
   - GraphRAG Queries:
     - Current holdings
     - Historical returns
     - Risk profile
   - Tools: Coinbase, stock APIs

3. **TaxSpecialistAgent**
   - Responsibilities:
     - Tax liability estimation
     - Deduction identification
     - Tax-efficient strategies
     - Document preparation assistance
   - GraphRAG Queries:
     - Income sources
     - Deductible expenses
     - Investment transactions
   - Tools: Tax calculation APIs

4. **DebtSpecialistAgent**
   - Responsibilities:
     - Debt tracking & analysis
     - Payoff strategy optimization
     - Refinancing opportunities
     - Credit score improvement
   - GraphRAG Queries:
     - Outstanding debts
     - Payment history
     - Interest rates
   - Tools: Credit reporting APIs

### Career Specialists (Priority 2)

1. **JobSearchSpecialistAgent**
   - Job matching, application tracking, market analysis

2. **SkillsSpecialistAgent**
   - Skill gap analysis, learning path recommendations

3. **NetworkingSpecialistAgent**
   - Connection suggestions, event recommendations

4. **PerformanceSpecialistAgent**
   - Performance tracking, goal progress, salary negotiation

---

## 🔐 SECURITY & MULTI-TENANCY

### Row-Level Security (PostgreSQL)
```sql
-- All tables have user_id column
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation ON transactions
    USING (user_id = current_setting('app.user_id')::uuid);
```

### JWT Authentication
- API validates JWT on every request
- User ID extracted from token
- Passed to all agents and database queries

### Encryption
- Environment variables encrypted at rest
- API keys stored in AWS Secrets Manager (prod)
- Database connections use SSL/TLS

---

## 📊 MONITORING & OBSERVABILITY

### Metrics (Prometheus)
```python
task_duration = Histogram('agent_task_duration_seconds',
                          'Task execution time',
                          ['agent_type', 'task_type'])

task_errors = Counter('agent_task_errors_total',
                      'Task execution errors',
                      ['agent_type', 'error_type'])
```

### Logging Structure
```json
{
  "timestamp": "2025-10-21T22:00:00Z",
  "level": "INFO",
  "agent_type": "BudgetSpecialist",
  "user_id": "uuid",
  "task_id": "uuid",
  "message": "Task completed successfully",
  "duration_ms": 145,
  "metadata": {}
}
```

---

## 🎓 WHEN ASSISTING WITH THIS PROJECT

### Always Remember:
1. **No code exists yet** - Everything needs to be built from scratch
2. **Follow the architecture** - 4-tier hierarchy, message-driven, async
3. **Dual GraphRAG** - Use Neptune for relationships, PostgreSQL for transactions
4. **Type everything** - Full type hints required
5. **Test everything** - ≥80% coverage mandatory
6. **Document as you go** - Google-style docstrings

### When Building Agents:
1. Inherit from `BaseAgent`
2. Implement `handle_task()` and `handle_query()`
3. Use GraphRAG for context gathering
4. Publish events to message bus
5. Add Prometheus metrics
6. Write comprehensive tests

### When Asked to Build Features:
1. Ask about domain (Finance, Career, Education, Healthcare)
2. Identify which layer (L0, L1, L2, L3)
3. Check dependencies (does BaseAgent exist?)
4. Follow the critical path order
5. Create tests alongside implementation

### Code Quality Checks:
```bash
# Before committing
black .
ruff check .
mypy .
pytest --cov --cov-report=term-missing
```

---

## 📞 QUICK REFERENCE

### Environment Variables (.env)
```bash
# LLM
VLLM_INSTANCE_1=http://localhost:8000
VLLM_INSTANCE_2=http://localhost:8001

# Databases
NEPTUNE_ENDPOINT=neptune-cluster.us-west-2.neptune.amazonaws.com
POSTGRES_HOST=localhost
POSTGRES_DB=life_navigator_agents
POSTGRES_USER=lna_user

# Messaging
REDIS_HOST=localhost
RABBITMQ_HOST=localhost

# Security
JWT_SECRET=<generated>
ENCRYPTION_KEY=<generated>
```

### Common Commands
```bash
# Setup
python3.12 -m venv venv
source venv/bin/activate
pip install -e ".[dev]"

# Development
python -m pytest
python -m mypy .
python -m black .
python -m ruff check .

# Run
python -m api.main
```

### Package Dependencies
See `pyproject.toml` for full list. Key ones:
- FastAPI, uvicorn (API)
- asyncpg, psycopg[binary], pgvector (PostgreSQL)
- neo4j (Neptune/Gremlin)
- redis, aio-pika (Messaging)
- sentence-transformers (Embeddings)
- pydantic (Models)
- pytest, pytest-asyncio, pytest-cov (Testing)

---

## 🎯 IMMEDIATE NEXT STEPS

When you start working on this project:

1. **First Session:**
   - Build `utils/` module (config, logging, errors)
   - Create Pydantic models in `models/`
   - Set up Docker Compose for local dev

2. **Second Session:**
   - Implement GraphRAG clients
   - Build message bus integration
   - Create database schemas

3. **Third Session:**
   - Implement `BaseAgent` framework
   - Build Orchestrator (L0)
   - Create first Domain Manager

4. **Fourth Session:**
   - Build first specialist (BudgetAgent)
   - Create API endpoints
   - Write integration tests

---

## ⚠️ IMPORTANT NOTES

- **This is a microservice** - Not the end-user app
- **GPU required** - For vLLM inference (2x NVIDIA GPUs recommended)
- **AWS account needed** - For Neptune (or use local Neo4j for dev)
- **No UI** - This is pure backend logic
- **Multi-tenant** - Design for multiple users from day one
- **Async everything** - No blocking calls allowed

---

**Last Updated:** 2025-10-21
**Status:** Phase 0 Complete (Structure) → Phase 1 Starting (Implementation)
**Total Code:** 0 lines → Target: 3,500+ lines for Phase 1
