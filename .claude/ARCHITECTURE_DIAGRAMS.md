# Life Navigator Agents - Architecture Diagrams

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          LIFE NAVIGATOR APP                         │
│                         (Main Application)                          │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ HTTP/REST
                          ↓
┌─────────────────────────────────────────────────────────────────────┐
│                   LIFE NAVIGATOR AGENTS SERVICE                     │
│                      (This Microservice)                            │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │                      FastAPI Gateway                          │ │
│  │              POST /orchestrator/analyze                       │ │
│  └──────────────────────────┬────────────────────────────────────┘ │
│                             ↓                                       │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │ L0: Orchestrator                                             │  │
│  │ • Intent Analysis (Llama 4)                                  │  │
│  │ • Task Decomposition                                         │  │
│  │ • Multi-Domain Routing                                       │  │
│  └───────┬────────────┬────────────┬────────────┬───────────────┘  │
│          ↓            ↓            ↓            ↓                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐          │
│  │ Finance  │ │ Career   │ │Education │ │ Healthcare   │          │
│  │ Manager  │ │ Manager  │ │ Manager  │ │ Manager      │          │
│  │  (L1)    │ │  (L1)    │ │  (L1)    │ │  (L1)        │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘          │
│       ↓            ↓            ↓               ↓                   │
│  ┌─────────────────────────────────────────────────────┐           │
│  │ L2: Specialist Agents                               │           │
│  │ Budget│Investment│Tax│Debt│JobSearch│Skills│etc.    │           │
│  └──────────────────────┬──────────────────────────────┘           │
│                         ↓                                           │
│  ┌─────────────────────────────────────────────────────┐           │
│  │ L3: Tool Agents                                     │           │
│  │ Plaid│Coinbase│ADP│OpenFDA│LinkedIn│etc.            │           │
│  └─────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

## 2. Message Flow Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        MESSAGE BUS LAYER                         │
│                                                                  │
│  ┌────────────────────────────┐  ┌─────────────────────────┐   │
│  │ Redis Pub/Sub              │  │ RabbitMQ                │   │
│  │ • Events (fast, transient) │  │ • Tasks (guaranteed)    │   │
│  │ • Broadcasts               │  │ • Work queues           │   │
│  │ • <10ms latency            │  │ • Dead letter handling  │   │
│  └────────────────────────────┘  └─────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
           ↑                                    ↑
           │                                    │
    ┌──────┴──────┐                      ┌──────┴──────┐
    │  Publishers │                      │ Subscribers │
    │   (Agents)  │                      │   (Agents)  │
    └─────────────┘                      └─────────────┘

Message Types:

1. COMMAND (RabbitMQ Queue)
   Orchestrator → Manager: "Analyze user's budget"
   Manager → Specialist: "Get recent transactions"

2. EVENT (Redis Pub/Sub)
   Specialist → All: "Transaction processed"
   Manager → All: "Analysis complete"

3. QUERY (RabbitMQ RPC)
   Agent → GraphRAG: "Get user context"
   GraphRAG → Agent: "Context data"
```

## 3. Dual GraphRAG Data Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                      UNIFIED GRAPHRAG CLIENT                    │
│                    (Smart Query Routing)                        │
└──────────────────┬──────────────────────────┬───────────────────┘
                   │                          │
       ┌───────────┴──────────┐    ┌──────────┴───────────┐
       │                      │    │                      │
       ↓                      │    ↓                      │
┌────────────────┐            │ ┌────────────────────┐   │
│ NEPTUNE        │            │ │ POSTGRESQL         │   │
│ (Graph DB)     │            │ │ (Relational+Vector)│   │
│                │            │ │                    │   │
│ Nodes:         │            │ │ Tables:            │   │
│ • User         │            │ │ • users            │   │
│ • Account      │            │ │ • transactions     │   │
│ • Transaction  │            │ │ • accounts         │   │
│ • Investment   │            │ │ • investments      │   │
│ • Skill        │            │ │ • skills           │   │
│ • Goal         │            │ │ • goals            │   │
│ • Course       │            │ │ • embeddings       │   │
│                │            │ │                    │   │
│ Edges:         │            │ │ Features:          │   │
│ • OWNS         │            │ │ • RLS (user_id)    │   │
│ • INVESTS_IN   │            │ │ • pgvector         │   │
│ • REQUIRES     │            │ │ • ACID compliance  │   │
│ • LEADS_TO     │            │ │ • Indexes          │   │
│                │            │ │                    │   │
│ Queries:       │            │ │ Queries:           │   │
│ • Path finding │            │ │ • Aggregations     │   │
│ • Multi-hop    │            │ │ • Joins            │   │
│ • Inference    │            │ │ • Vector search    │   │
└────────────────┘            │ └────────────────────┘   │
                              │                          │
                              │  ┌──────────────────┐    │
                              └─→│ QDRANT           │←───┘
                                 │ (Vector Store)   │
                                 │                  │
                                 │ • Embeddings     │
                                 │ • Similarity     │
                                 │ • Clustering     │
                                 └──────────────────┘

Query Routing Logic:
┌────────────────────────────────────────────────────────────────┐
│ IF query requires:                                             │
│   • Relationships → Neptune                                    │
│   • Path finding → Neptune                                     │
│   • Graph traversal → Neptune                                  │
│                                                                │
│   • Transactions → PostgreSQL                                  │
│   • Aggregations → PostgreSQL                                  │
│   • User isolation → PostgreSQL (RLS)                          │
│                                                                │
│   • Semantic search → Qdrant or PostgreSQL (pgvector)          │
│   • Similarity → Qdrant                                        │
│                                                                │
│   • Complex (both) → Join results from both sources            │
└────────────────────────────────────────────────────────────────┘
```

## 4. Agent Lifecycle & State

```
┌────────────────────────────────────────────────────────────────┐
│                         AGENT LIFECYCLE                        │
└────────────────────────────────────────────────────────────────┘

    CREATED
       │
       │ startup()
       ↓
    IDLE ←──────────────────────────┐
       │                            │
       │ receive_task()             │
       ↓                            │
  PROCESSING                        │
       │                            │
       ├─→ gather_context()         │
       │   (GraphRAG query)         │
       │                            │
       ├─→ execute_logic()          │
       │   (LLM inference)          │
       │                            │
       ├─→ call_tools()             │ task_complete()
       │   (External APIs)          │
       │                            │
       ├─→ delegate_subtasks()      │
       │   (To other agents)        │
       │                            │
       ├─→ aggregate_results()      │
       │                            │
       ↓                            │
    COMPLETED ──────────────────────┘
       │
       │ (on error)
       ↓
    ERROR
       │
       │ retry_logic()
       ↓
    RETRY → (back to PROCESSING or ERROR)

Agent States:
• IDLE: Waiting for tasks
• PROCESSING: Actively working
• COMPLETED: Task finished successfully
• ERROR: Task failed
• SHUTDOWN: Agent terminating
```

## 5. Request Flow Example: "How much can I invest?"

```
1. API Gateway
   ┌─────────────────────────────────────────┐
   │ POST /orchestrator/analyze              │
   │ {                                       │
   │   "user_id": "uuid-123",                │
   │   "query": "How much can I invest?"     │
   │ }                                       │
   └─────────────────┬───────────────────────┘
                     ↓
2. Orchestrator (L0)
   ┌─────────────────────────────────────────┐
   │ • Authenticate JWT                      │
   │ • Parse intent with Llama 4             │
   │   → "Budget analysis + investment calc" │
   │ • Decompose task:                       │
   │   - Get available funds (Budget)        │
   │   - Analyze capacity (Investment)       │
   │ • Route to: FinanceManager              │
   └─────────────────┬───────────────────────┘
                     ↓
3. FinanceManager (L1)
   ┌─────────────────────────────────────────┐
   │ • Receive task from Orchestrator        │
   │ • Delegate to specialists:              │
   │   - BudgetSpecialist (get funds)        │
   │   - InvestmentSpecialist (recommend)    │
   │ • Coordinate parallel execution         │
   └──────┬──────────────────────────┬───────┘
          ↓                          ↓
4a. BudgetSpecialist (L2)      4b. InvestmentSpecialist (L2)
   ┌─────────────────────┐         ┌────────────────────────┐
   │ • Query GraphRAG:   │         │ • Query GraphRAG:      │
   │   - Income          │         │   - Current portfolio  │
   │   - Expenses        │         │   - Risk profile       │
   │   - Goals           │         │   - Investment goals   │
   │ • Calculate:        │         │ • Tool call:           │
   │   - Total income    │         │   - Coinbase API       │
   │   - Total expenses  │         │   (current prices)     │
   │   - Available: $500 │         │ • Calculate:           │
   │ • Return result     │         │   - Allocation         │
   └──────┬──────────────┘         │   - Risk-adjusted amt  │
          │                        │   - Recommendation     │
          │                        │ • Return result        │
          │                        └────────┬───────────────┘
          │                                 │
          └──────────┬──────────────────────┘
                     ↓
5. FinanceManager (Aggregation)
   ┌─────────────────────────────────────────┐
   │ • Receive both results                  │
   │ • Synthesize answer:                    │
   │   "You have $500 available.             │
   │    Based on your risk profile,          │
   │    invest $400 (80%) in ETFs,           │
   │    keep $100 (20%) liquid."             │
   │ • Return to Orchestrator                │
   └─────────────────┬───────────────────────┘
                     ↓
6. Orchestrator (Response)
   ┌─────────────────────────────────────────┐
   │ • Format final response                 │
   │ • Add metadata (timing, agents used)    │
   │ • Log metrics                           │
   │ • Return to API                         │
   └─────────────────┬───────────────────────┘
                     ↓
7. API Gateway (Response)
   ┌─────────────────────────────────────────┐
   │ {                                       │
   │   "status": "success",                  │
   │   "data": {                             │
   │     "available": 500,                   │
   │     "recommendation": {                 │
   │       "etf": 400,                       │
   │       "liquid": 100                     │
   │     },                                  │
   │     "reasoning": "..."                  │
   │   },                                    │
   │   "metadata": {                         │
   │     "duration_ms": 1250,                │
   │     "agents_used": ["BudgetSpecialist", │
   │                     "InvestmentSpecialist"]│
   │   }                                     │
   │ }                                       │
   └─────────────────────────────────────────┘

Timing Breakdown:
├─ API Gateway: 5ms
├─ Orchestrator (LLM): 200ms
├─ FinanceManager (routing): 10ms
├─ Specialists (parallel):
│  ├─ BudgetSpecialist: 500ms
│  │  ├─ GraphRAG query: 150ms
│  │  └─ Calculation: 350ms
│  └─ InvestmentSpecialist: 800ms
│     ├─ GraphRAG query: 200ms
│     ├─ Coinbase API: 400ms
│     └─ Calculation: 200ms
├─ FinanceManager (aggregation): 50ms
└─ Orchestrator (response): 35ms
────────────────────────────────────
Total: ~1250ms (specialists run in parallel)
```

## 6. Data Flow: GraphRAG Query

```
Agent needs context
       │
       ↓
┌────────────────────────────────────────┐
│ GraphRAG Client                        │
│ • Analyze query intent                 │
│ • Determine data source(s)             │
└────────┬───────────────────────────────┘
         │
         ├─────────────────┬──────────────┐
         ↓                 ↓              ↓
    ┌─────────┐      ┌──────────┐   ┌──────────┐
    │ Neptune │      │ Postgres │   │ Qdrant   │
    │         │      │          │   │          │
    │ Cypher  │      │ SQL +    │   │ Vector   │
    │ query   │      │ pgvector │   │ search   │
    └────┬────┘      └─────┬────┘   └─────┬────┘
         │                 │              │
         └────────┬────────┴──────────────┘
                  ↓
         ┌────────────────┐
         │ Merge Results  │
         │ • Deduplicate  │
         │ • Enrich       │
         │ • Format       │
         └───────┬────────┘
                 ↓
         ┌────────────────┐
         │ Return Context │
         │ to Agent       │
         └────────────────┘

Example Queries:

1. "Get recent transactions"
   → PostgreSQL only (transactional data)

2. "How does job change affect investments?"
   → Neptune (relationship traversal)
   → User→Job→Income→Investment path

3. "Find similar financial goals"
   → Qdrant (vector similarity)
   → Embed goal text, find neighbors

4. "Investment impact analysis"
   → BOTH (complex query)
   → Neptune: Investment→Account→Transaction edges
   → Postgres: Transaction details, aggregations
   → Merge: Full context with relationships + data
```

## 7. LLM Integration (vLLM)

```
┌─────────────────────────────────────────────────────────────┐
│                       VLLM CLUSTER                          │
│                                                             │
│  ┌──────────────────────┐      ┌──────────────────────┐   │
│  │ vLLM Instance 1      │      │ vLLM Instance 2      │   │
│  │ localhost:8000       │      │ localhost:8001       │   │
│  │                      │      │                      │   │
│  │ Llama 4 Maverick     │      │ Llama 4 Maverick     │   │
│  │ 70B parameters       │      │ 70B parameters       │   │
│  │                      │      │                      │   │
│  │ GPU: NVIDIA A100     │      │ GPU: NVIDIA A100     │   │
│  └──────────────────────┘      └──────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↑
                          │ HTTP POST /v1/completions
                          │ Round-robin load balancing
                          │
                ┌─────────┴─────────┐
                │  vLLM Client      │
                │  (models/vllm_    │
                │   client.py)      │
                │                   │
                │ • Load balancing  │
                │ • Retry logic     │
                │ • Prompt caching  │
                │ • Streaming       │
                └─────────┬─────────┘
                          │
                ┌─────────┴─────────────────────────────────┐
                │                                           │
         ┌──────┴──────┐                          ┌────────┴────────┐
         │ Orchestrator│                          │ Domain Managers │
         │  (L0)       │                          │ (L1)            │
         │             │                          │                 │
         │ Use cases:  │                          │ Use cases:      │
         │ • Intent    │                          │ • Specialist    │
         │   analysis  │                          │   selection     │
         │ • Task      │                          │ • Result        │
         │   decomp    │                          │   synthesis     │
         └─────────────┘                          └─────────────────┘

Prompt Template Example (Intent Analysis):
┌──────────────────────────────────────────────────────────────┐
│ System: You are an intent analysis agent.                   │
│                                                              │
│ User Query: "{user_query}"                                  │
│                                                              │
│ Available Domains:                                          │
│ - Finance: Budget, investment, tax, debt management         │
│ - Career: Job search, skills, networking, performance       │
│ - Education: Learning paths, courses, certifications        │
│ - Healthcare: Wellness, medical, mental health              │
│                                                              │
│ Analyze and respond in JSON:                                │
│ {                                                            │
│   "primary_domain": "...",                                  │
│   "secondary_domains": [...],                               │
│   "required_specialists": [...],                            │
│   "task_breakdown": [...],                                  │
│   "confidence": 0.0-1.0                                     │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
```

## 8. Deployment Architecture (Production)

```
┌─────────────────────────────────────────────────────────────────┐
│                          AWS CLOUD                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ EKS Cluster (Kubernetes)                                 │  │
│  │                                                          │  │
│  │  ┌────────────────┐    ┌────────────────┐              │  │
│  │  │ API Pods (3x)  │    │ Agent Pods(6x) │              │  │
│  │  │ • FastAPI      │    │ • Orchestrator │              │  │
│  │  │ • Auto-scaling │    │ • Domain Mgrs  │              │  │
│  │  │ • Health check │    │ • Specialists  │              │  │
│  │  └────────┬───────┘    └───────┬────────┘              │  │
│  │           │                    │                        │  │
│  │  ┌────────┴────────────────────┴────────┐              │  │
│  │  │ Service Mesh (Istio)                 │              │  │
│  │  │ • Load balancing                     │              │  │
│  │  │ • Circuit breaking                   │              │  │
│  │  │ • Observability                      │              │  │
│  │  └──────────────────────────────────────┘              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │ RDS Postgres │  │ ElastiCache  │  │ Amazon MQ        │     │
│  │ (Multi-AZ)   │  │ (Redis)      │  │ (RabbitMQ)       │     │
│  │ • pgvector   │  │ • Pub/Sub    │  │ • Task queues    │     │
│  │ • RLS        │  │ • Session    │  │ • HA cluster     │     │
│  └──────────────┘  └──────────────┘  └──────────────────┘     │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐     │
│  │ Neptune      │  │ EC2 vLLM     │  │ Secrets Manager  │     │
│  │ (Graph DB)   │  │ (GPU x2)     │  │ • API keys       │     │
│  │ • HA cluster │  │ • p4d.24xl   │  │ • DB creds       │     │
│  │ • Multi-AZ   │  │ • Load bal   │  │ • Encryption     │     │
│  └──────────────┘  └──────────────┘  └──────────────────┘     │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐                            │
│  │ CloudWatch   │  │ Prometheus   │                            │
│  │ • Logs       │  │ • Metrics    │                            │
│  │ • Alarms     │  │ • Grafana    │                            │
│  └──────────────┘  └──────────────┘                            │
└─────────────────────────────────────────────────────────────────┘

Traffic Flow:
User → ALB → API Pods → Service Mesh → Agent Pods → Databases
```

## 9. Local Development Environment

```
┌─────────────────────────────────────────────────────────────────┐
│                    docker-compose.yml                           │
└─────────────────────────────────────────────────────────────────┘

Services:

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ PostgreSQL   │  │ Redis        │  │ RabbitMQ     │
│ Port: 5432   │  │ Port: 6379   │  │ Port: 5672   │
│              │  │              │  │ Admin: 15672 │
│ • pgvector   │  │ • persistence│  │ • Management │
│ • initdb.sql │  │   off (dev)  │  │   UI         │
└──────────────┘  └──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐
│ vLLM 1       │  │ vLLM 2       │
│ Port: 8000   │  │ Port: 8001   │
│              │  │              │
│ • Llama 4    │  │ • Llama 4    │
│ • GPU 0      │  │ • GPU 1      │
│ • Model      │  │ • Model      │
│   caching    │  │   caching    │
└──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐
│ Neo4j        │  │ Qdrant       │
│ Port: 7687   │  │ Port: 6333   │
│ (Neptune alt)│  │              │
│              │  │ • Web UI     │
│ • Browser UI │  │   6333       │
│   7474       │  │ • Collections│
└──────────────┘  └──────────────┘

Development workflow:
1. docker-compose up -d
2. source venv/bin/activate
3. python -m api.main  (runs outside Docker for hot reload)
4. Access services:
   - API: http://localhost:8080
   - RabbitMQ UI: http://localhost:15672
   - Neo4j Browser: http://localhost:7474
   - Qdrant UI: http://localhost:6333
```

## 10. Security Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      SECURITY LAYERS                            │
└─────────────────────────────────────────────────────────────────┘

Layer 1: API Gateway
┌────────────────────────────────────────┐
│ • JWT Token Validation                 │
│ • Rate Limiting (per user)             │
│ • CORS (allowed origins)               │
│ • Request Size Limits                  │
│ • HTTPS Only (TLS 1.3)                 │
└────────────────┬───────────────────────┘
                 ↓
Layer 2: Application
┌────────────────────────────────────────┐
│ • Extract user_id from JWT             │
│ • Set session context                  │
│ • Input validation (Pydantic)          │
│ • SQL injection prevention             │
│ • Path traversal checks                │
└────────────────┬───────────────────────┘
                 ↓
Layer 3: Data Access
┌────────────────────────────────────────┐
│ PostgreSQL Row-Level Security (RLS):   │
│                                        │
│ CREATE POLICY user_isolation           │
│   ON transactions                      │
│   USING (                              │
│     user_id =                          │
│     current_setting('app.user_id')    │
│       ::uuid                           │
│   );                                   │
│                                        │
│ • Every query filtered by user_id      │
│ • No cross-user data leakage           │
│ • Database-enforced isolation          │
└────────────────┬───────────────────────┘
                 ↓
Layer 4: Secrets Management
┌────────────────────────────────────────┐
│ Development:                           │
│ • .env file (gitignored)               │
│ • Local secrets only                   │
│                                        │
│ Production:                            │
│ • AWS Secrets Manager                  │
│ • Automatic rotation                   │
│ • Encryption at rest (KMS)             │
│ • IAM role-based access                │
└────────────────────────────────────────┘

Audit Logging:
┌────────────────────────────────────────┐
│ Every action logged:                   │
│ • timestamp                            │
│ • user_id                              │
│ • action (read/write/delete)           │
│ • resource (table/record)              │
│ • result (success/failure)             │
│ • ip_address                           │
│                                        │
│ Retention: 90 days (compliance)        │
└────────────────────────────────────────┘
```

---

**These diagrams represent the target architecture. Current implementation: 0%**
