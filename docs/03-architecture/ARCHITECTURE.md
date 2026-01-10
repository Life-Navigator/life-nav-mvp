# Life Navigator Agent System - Architecture

## System Overview

The Life Navigator Agent System is a hierarchical multi-agent system designed to provide personalized financial and career guidance. The system features a 4-level hierarchy with specialized agents, semantic memory, and integration with external services via the Model Context Protocol (MCP).

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Life Navigator App                           │
│                    (Next.js + Tauri)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Plaid      │  │  Coinbase    │  │   Canvas     │          │
│  │   OAuth      │  │   OAuth      │  │   OAuth      │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                  │                   │
│         └─────────────────┴──────────────────┘                   │
│                           │                                      │
│                  ┌────────▼─────────┐                            │
│                  │  MCP Server      │                            │
│                  │  - RLS Enforced  │                            │
│                  │  - PII Redacted  │                            │
│                  └────────┬─────────┘                            │
└───────────────────────────┼──────────────────────────────────────┘
                            │
                      MCP Protocol
                  (HTTP/JSON over REST)
                            │
┌───────────────────────────▼──────────────────────────────────────┐
│                    Agent System (This)                            │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                    MCP Client Layer                           ││
│  │  - Connection pooling                                        ││
│  │  - Exponential backoff                                       ││
│  │  - Request tracing                                           ││
│  └──────────────────────────────────────────────────────────────┘│
│                            │                                      │
│  ┌─────────────────────────▼──────────────────────────────────┐  │
│  │              L0: Orchestrator (Root)                       │  │
│  │  - Intent analysis (vLLM)                                  │  │
│  │  - Task decomposition                                      │  │
│  │  - Domain routing                                          │  │
│  └──────────────┬─────────────────────┬───────────────────────┘  │
│                 │                     │                          │
│    ┌────────────▼────────┐  ┌────────▼────────────┐              │
│    │  L1: Finance Manager│  │  L1: Career Manager │              │
│    │  - Specialist routing│  │  - Specialist routing│              │
│    │  - Result aggregation│  │  - Result aggregation│              │
│    └────────────┬────────┘  └────────┬────────────┘              │
│                 │                     │                          │
│      ┌──────────┴────────┬────┬──────▼────┐                      │
│      │                   │    │           │                      │
│  ┌───▼───┐ ┌───▼───┐ ┌──▼─┐ ┌▼──┐ ┌─────▼───┐ ┌──────▼───┐      │
│  │Budget │ │Invest │ │Tax │ │Debt│ │Savings  │ │JobSearch │      │
│  │Spec   │ │Spec   │ │Spec│ │Spec│ │Spec     │ │Spec      │      │
│  └───────┘ └───────┘ └────┘ └────┘ └─────────┘ └──────────┘      │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                Infrastructure Layer                           │ │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────┐               │ │
│  │  │   vLLM     │  │  GraphRAG  │  │  Redis   │               │ │
│  │  │  (Llama 4) │  │  Dual KG   │  │  Cache   │               │ │
│  │  └────────────┘  └────────────┘  └──────────┘               │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

## Agent Hierarchy

### Level 0: Orchestrator
**Responsibility**: Intent analysis, task decomposition, domain routing

```python
orchestrator = Orchestrator(
    agent_id="orchestrator",
    vllm_client=vllm_client,
    graphrag_client=graphrag_client,
    message_bus=message_bus
)
```

**Key Functions**:
- Analyzes user intent using LLM
- Decomposes complex multi-domain requests
- Routes tasks to appropriate domain managers
- Synthesizes results into natural language

### Level 1: Domain Managers
**Responsibility**: Specialist routing, workflow coordination

#### Finance Manager
```python
finance_manager = FinanceManager(
    agent_id="finance_manager",
    vllm_client=vllm_client,
    graphrag_client=graphrag_client
)

finance_manager.specialists = {
    "budget_specialist": budget_specialist,
    "investment_specialist": investment_specialist,
    "tax_specialist": tax_specialist,
    "debt_specialist": debt_specialist,
    "savings_specialist": savings_specialist,
}
```

**Routes to**:
- Budget Specialist → spending analysis, cashflow forecasting
- Investment Specialist → portfolio analysis, rebalancing
- Tax Specialist → tax estimation, deduction optimization
- Debt Specialist → payoff strategies, refinancing analysis
- Savings Specialist → goal tracking, emergency fund recommendations

#### Career Manager
```python
career_manager = CareerManager(
    agent_id="career_manager",
    vllm_client=vllm_client,
    graphrag_client=graphrag_client
)

career_manager.specialists = {
    "job_search_specialist": job_search_specialist,
    "resume_specialist": resume_specialist,
}
```

**Routes to**:
- Job Search Specialist → job matching, application tracking
- Resume Specialist → ATS optimization, keyword analysis

### Level 2: Specialists
**Responsibility**: Domain-specific task execution

All specialists share common patterns:
```python
specialist = SpecialistAgent(
    agent_id="specialist_name",
    vllm_client=vllm_client,       # For insights generation
    graphrag_client=graphrag_client,  # For semantic memory
    mcp_client=mcp_client,         # For data fetching
    message_bus=message_bus        # For agent communication
)
```

#### Data Fetching Pattern (Dual Mode)
```python
async def execute_task(self, task: AgentTask):
    # Try MCP first (production mode)
    if self.mcp and not task.payload.get("data"):
        context = await self._fetch_via_mcp(task)
    else:
        # Fallback to payload (testing/mock mode)
        context = task.payload

    return await self._analyze(context)
```

## MCP Integration

### Client Configuration
```python
from agents.tools.mcp_client import mcp_client

# Singleton client configured via environment
# MCP_SERVER_URL=http://app:8000

# Usage in agents
data = await mcp_client.get_financial_context(
    user_id=UUID("..."),
    session_id="sess_123",
    days=90
)
```

### Available Tools
See `docs/mcp_tools_schema.yaml` for complete specification.

**Financial Tools**:
- `get_user_accounts` - Fetch account balances
- `get_user_transactions` - Fetch transaction history
- `get_spending_by_category` - Aggregated spending analysis
- `get_recurring_transactions` - Identify recurring bills
- `get_investment_portfolio` - Portfolio holdings
- `get_crypto_holdings` - Cryptocurrency balances
- `get_paystubs` - Income documentation

**Career Tools**:
- `get_user_resume` - Resume data
- `get_job_search_history` - Application tracking

**Education Tools**:
- `get_courses` - Active courses (LMS integration)
- `get_assignments` - Upcoming assignments

### Error Handling
```python
from agents.tools.mcp_error import (
    MCPError,
    MCPTimeoutError,
    MCPUnauthorizedError,
)

try:
    data = await mcp_client.call_tool(...)
except MCPTimeoutError:
    # Handle timeout
except MCPUnauthorizedError:
    # Handle auth failure
except MCPError as e:
    # Handle general MCP error
    logger.error(f"MCP failed: {e}")
```

## Data Flow

### Request Flow
```
User Request
    │
    ▼
L0: Orchestrator
    │
    ├─> Intent Analysis (vLLM)
    │   "I need help with my budget"
    │   → domain=finance, task_type=spending_analysis
    │
    ├─> Domain Routing
    │   → FinanceManager
    │
    ▼
L1: Finance Manager
    │
    ├─> Specialist Routing
    │   spending_analysis → BudgetSpecialist
    │
    ▼
L2: Budget Specialist
    │
    ├─> Data Fetching
    │   └─> MCP Client
    │       └─> App Layer (MCP Server)
    │           └─> Plaid API
    │
    ├─> Analysis
    │   - Calculate savings rate
    │   - Identify spending patterns
    │   - Generate recommendations
    │
    ├─> Semantic Memory (GraphRAG)
    │   - Store analysis for future context
    │
    └─> Return Results
        │
        ▼
L1: Finance Manager (Aggregation)
        │
        ▼
L0: Orchestrator (Synthesis)
        │
        └─> Natural Language Response (vLLM)
            "Based on your spending, your savings rate is 23%..."
```

### MCP Request Example
```python
# Agent makes request
context = await mcp_client.get_financial_context(
    user_id=UUID("550e8400-e29b-41d4-a716-446655440000"),
    session_id="sess_abc123",
    days=90
)

# MCP client sends HTTP request
POST http://app:8000/mcp/execute
{
  "tool_name": "get_user_transactions",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "sess_abc123",
  "arguments": {
    "start_date": "2025-07-27",
    "end_date": "2025-10-26"
  },
  "request_id": "mcp_a1b2c3d4e5f6"
}

# App layer response (RLS enforced, PII redacted)
{
  "success": true,
  "data": {
    "transactions": [
      {
        "transaction_id": "txn_001",
        "date": "2025-10-25",
        "amount": -125.50,
        "merchant": "Whole Foods",
        "category": "food_and_drink",
        "account_mask": "1234"  # Last 4 digits only
      },
      ...
    ]
  }
}
```

## Infrastructure Dependencies

### vLLM Server
**Purpose**: LLM inference for intent analysis and synthesis
**Model**: meta-llama/Llama-4-Maverick-17B-128E
**Endpoint**: Configured via `VLLM_BASE_URL` environment variable

### GraphRAG (Dual Knowledge Graph)
**Purpose**: Semantic memory and entity relationships
**Components**:
- **Qdrant**: Vector search for semantic queries
- **Neo4j**: Graph database for entity relationships
- **PostgreSQL**: Backup storage

### Redis
**Purpose**: Caching and session management
**Usage**:
- MCP response caching (TTL-based)
- Agent state management
- Rate limiting

### Message Bus (RabbitMQ)
**Purpose**: Asynchronous agent communication
**Usage**:
- Task distribution
- Event notifications
- Cross-agent coordination

## Security Model

### Row-Level Security (RLS)
- All MCP requests include `user_id`
- App layer enforces Supabase RLS policies
- Agents never see data from other users

### PII Redaction
- Account numbers → last 4 digits only
- SSNs → redacted entirely
- Email addresses → masked
- Phone numbers → masked

### OAuth Token Isolation
- Agents NEVER receive OAuth tokens
- All external API calls go through app layer
- MCP server acts as security boundary

## Deployment

### Docker Compose (Development)
```yaml
services:
  agents:
    build: .
    environment:
      - MCP_SERVER_URL=http://app:8000
      - VLLM_BASE_URL=http://vllm:8000
      - GRAPHRAG_NEO4J_URI=bolt://neo4j:7687
      - REDIS_URL=redis://redis:6379

  vllm:
    image: vllm/vllm-openai:latest

  neo4j:
    image: neo4j:5.12

  redis:
    image: redis:7-alpine
```

### Kubernetes (Production)
See `docs/DEPLOYMENT_GUIDE.md` for production configuration.

## Performance Characteristics

### Latency
- **Intent Analysis**: ~200-500ms (vLLM)
- **MCP Data Fetch**: ~100-300ms (app layer)
- **Specialist Analysis**: ~50-200ms (computation)
- **Total E2E**: ~500-1500ms

### Throughput
- **Concurrent Users**: 100+ (connection pooling)
- **Requests/Second**: 50-100 (depends on vLLM GPU)
- **Cache Hit Rate**: 70%+ (Redis caching)

### Scaling
- **Horizontal**: Add more agent worker pods
- **Vertical**: Increase vLLM GPU allocation
- **Database**: Qdrant sharding, Neo4j clustering

## Monitoring

### Metrics (Prometheus)
```python
from prometheus_client import Histogram, Counter

request_duration = Histogram(
    'agent_request_duration_seconds',
    'Agent request duration',
    ['agent_type', 'task_type']
)

mcp_errors = Counter(
    'mcp_errors_total',
    'Total MCP errors',
    ['error_type']
)
```

### Health Checks
```python
from agents.orchestration.factory import health_check_hierarchy

health = await health_check_hierarchy(orchestrator)
# Returns status for all 9 agents
```

## Extension Points

### Adding New Specialists
1. Create specialist class (inherit from `BaseAgent`)
2. Implement `handle_task()` method
3. Add to factory in `agents/orchestration/factory.py`
4. Update domain manager routing table

### Adding New MCP Tools
1. Add tool spec to `docs/mcp_tools_schema.yaml`
2. App team implements tool in MCP server
3. Update `MCPClient` convenience methods if needed
4. Add test fixtures to `tests/fixtures/mcp_responses/`

### Adding New Domains
1. Create new domain manager (e.g., `HealthManager`)
2. Create domain specialists
3. Update Orchestrator routing table
4. Add to factory `create_agent_hierarchy()`

## Testing Strategy

### Unit Tests
- Each agent tested in isolation
- Mock dependencies (MCP, vLLM, GraphRAG)
- Coverage: 80%+ per module

### Integration Tests
- Full hierarchy with `MockMCPClient`
- End-to-end request routing
- Multi-agent workflows

### Performance Tests
- Load testing with concurrent requests
- Latency benchmarking
- Memory profiling

See `tests/` directory for complete test suite.
