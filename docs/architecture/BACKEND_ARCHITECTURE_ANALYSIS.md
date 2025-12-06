# Life Navigator Backend FastAPI Services Architecture

## Executive Summary

The Life Navigator platform is a comprehensive, production-grade, multi-tenant SaaS application built with **FastAPI** and **PostgreSQL**. The architecture follows modern microservices patterns with clear separation of concerns, Row-Level Security (RLS) for compliance, and GraphRAG integration for AI-powered knowledge management.

### Key Statistics
- **Main Backend**: 43 Python files in `/backend/app`
- **Services API**: Full CRUD endpoints for 6 life domains
- **Finance-API**: Specialized financial microservice with 10+ endpoints
- **Agents Service**: Multi-agent orchestration with GraphRAG integration
- **Database**: PostgreSQL with RLS, pgvector, and 43+ tables across 6 domains
- **GraphRAG Integration**: gRPC-based hybrid knowledge graph + vector search

---

## 1. BACKEND APPLICATION ARCHITECTURE (`/backend`)

### 1.1 Main Application Entry Point

**File**: `/backend/app/main.py`

```
FastAPI Application with:
- Async lifecycle management (startup/shutdown)
- Sentry integration for error tracking
- CORS middleware with configurable origins
- Gzip compression middleware
- Request logging middleware (dev only)
- Trusted host middleware (prod only)
- Health check endpoints (/health, /health/db)
- Prometheus metrics endpoint (/metrics)
- Exception handlers for global error management
```

**Key Features**:
- **Lifespan Context Manager**: Handles database initialization, health checks, and graceful shutdown
- **Environment-Aware Configuration**: Different behavior for dev/staging/production
- **Structured Logging**: Using Python logging with contextual information
- **Error Handling**: Global exception handler returns appropriate error responses

### 1.2 Routing Structure

**File**: `/backend/app/api/v1/router.py`

API is organized into 8 main route groups:

| Route | Prefix | Purpose |
|-------|--------|---------|
| **Auth** | `/auth` | Registration, login, token refresh, logout |
| **Users** | `/users` | User management and tenant administration |
| **Finance** | `/finance` | Financial accounts, transactions, budgets |
| **Career** | `/career` | Career profiles, job applications, interviews |
| **Education** | `/education` | Education credentials, courses |
| **Goals** | `/goals` | Personal goals, milestones, tracking |
| **Health** | `/health` | Health conditions, medications |
| **Relationships** | `/relationships` | Contacts, interactions, relationship tracking |
| **GraphRAG Search** | `/search` | Knowledge graph queries with RAG |

---

## 2. AUTHENTICATION & AUTHORIZATION

### 2.1 Security Architecture

**File**: `/backend/app/core/security.py`

**Authentication Methods**:
- **JWT Tokens**: HS256 algorithm with configurable expiration
- **Access Tokens**: 30-minute default expiration (configurable)
- **Refresh Tokens**: 30-day default expiration
- **Password Hashing**: BCrypt with auto-deprecated older schemes

**Token Structure**:
```python
{
    "sub": "user_id (UUID)",
    "tenant_id": "tenant_id (UUID)",  # Multi-tenancy context
    "exp": "expiration_timestamp",
    "type": "access|refresh|password_reset|email_verification"
}
```

### 2.2 Dependency Injection System

**File**: `/backend/app/api/deps.py`

**Core Dependencies** (type-annotated for FastAPI):
```python
CurrentUser = Annotated[User, Depends(get_current_active_user)]
TenantID = Annotated[UUID, Depends(get_tenant_id_from_token)]
UserTenantMembership = Annotated[UserTenant, Depends(verify_tenant_access)]
DBSession = Annotated[AsyncSession, Depends(set_rls_context)]
AdminUser = Annotated[UserTenant, Depends(require_admin)]
OwnerUser = Annotated[UserTenant, Depends(require_owner)]
```

**Key Functions**:

| Function | Purpose |
|----------|---------|
| `get_current_user()` | Extract and validate JWT token, fetch user from DB |
| `get_current_active_user()` | Verify user is active (not suspended/deleted) |
| `get_tenant_id_from_token()` | Extract tenant context from JWT |
| `verify_tenant_access()` | Verify user has access to requested tenant |
| `set_rls_context()` | Set PostgreSQL session context for Row-Level Security |
| `require_admin()` | Enforce admin or owner role requirement |
| `require_owner()` | Enforce owner role requirement |

**Authorization Model**:
- **RBAC**: Role-Based Access Control with 4 roles per tenant
  - `OWNER`: Full control, can manage all users and resources
  - `ADMIN`: Can manage users and resources but can't change ownership
  - `MEMBER`: Can access shared resources
  - `GUEST`: Limited read-only access

---

## 3. DATABASE ARCHITECTURE

### 3.1 Multi-Tenancy Model

**PostgreSQL with Row-Level Security (RLS)**

**Core Tables**:

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `organizations` | B2B SaaS organizations | id, name, slug, status, subscription_tier |
| `tenants` | Workspaces within organizations | id, organization_id, name, type, status, hipaa_enabled |
| `users` | System users across organizations | id, email, password_hash, status, auth_provider |
| `user_tenants` | User-tenant memberships | user_id, tenant_id, role, status, joined_at |
| `audit_logs` | Immutable audit trail for HIPAA | tenant_id, user_id, event_type, resource_type, created_at |

**Base Model Mixins** (`/backend/app/models/mixins.py`):

```python
UUIDMixin          # UUID primary key with auto-generation
TimestampMixin     # created_at, updated_at timestamps (UTC)
SoftDeleteMixin    # deleted_at for soft deletes
TenantMixin        # Automatic tenant_id foreign key
UserOwnedMixin     # Both tenant_id and user_id foreign keys
BaseTenantModel    # Combined: UUID, Timestamps, SoftDelete, UserOwned
```

### 3.2 Domain Models (43 tables)

**Finance Domain**:
```python
FinancialAccount (type, institution, balance, status)
Transaction (type, amount, category, account_id)
Budget (period, limit, remaining, status)
```

**Career Domain**:
```python
CareerProfile (title, industry, experience_level)
JobApplication (company, position, status, applied_date)
Interview (position, company, date, rating, notes)
```

**Education Domain**:
```python
EducationCredential (type, institution, field, date_earned)
Course (name, provider, status, progress)
```

**Goals Domain**:
```python
Goal (title, domain, status, target_date)
Milestone (goal_id, title, completed)
```

**Health Domain**:
```python
HealthCondition (name, status, diagnosed_date)
Medication (name, dosage, frequency)
```

**Relationships Domain**:
```python
Contact (name, relationship_type, contact_info)
ContactInteraction (type, date, notes)
```

### 3.3 Row-Level Security (RLS)

**File**: `/backend/app/db/migrations/003_enable_rls.sql`

**Security Model**:

```sql
-- Session context functions
current_tenant_id()           -- Get current tenant from session
current_user_id()            -- Get current user from session
validate_tenant_access()     -- Verify user can access tenant

-- Policy Types Applied:
1. Service Account Policy    -- Unrestricted for server processes
2. Tenant Isolation Policy   -- Users see only their tenant's data
3. User Ownership Policy     -- Users see only their own resources
4. Admin Policy              -- Admins see tenant's data
5. Audit Log Read-Only       -- Append-only audit logs
```

**Policy Example** (Financial Accounts):
```sql
CREATE POLICY financial_accounts_tenant_isolation ON financial_accounts
    FOR ALL
    TO authenticated
    USING (tenant_id = current_tenant_id())
    WITH CHECK (tenant_id = current_tenant_id());
```

### 3.4 Database Session Management

**File**: `/backend/app/core/database.py`

```python
# Connection Pooling
QueuePool: 
  - Size: 20 connections
  - Max Overflow: 10 additional connections
  - Timeout: 30 seconds
  - Recycle: 3600 seconds (1 hour)
  - Pre-ping: Verify connections before use

# Session Factory
async_sessionmaker with:
  - expire_on_commit=False (keep objects after commit)
  - autocommit=False (explicit transaction control)
  - autoflush=False (explicit flush control)

# RLS Context Setting
await set_tenant_context(session, tenant_id, user_id)
  Sets PostgreSQL session variables:
  - app.current_tenant_id = tenant_id
  - app.current_user_id = user_id
```

---

## 4. KEY ENDPOINTS & API DESIGN

### 4.1 Authentication Endpoints

**Endpoint**: `POST /api/v1/auth/register`
- Creates organization, tenant, user, and user-tenant membership
- Returns access token, refresh token, and user info
- **Status**: 201 Created

**Endpoint**: `POST /api/v1/auth/login`
- Validates credentials, checks user status
- Returns tokens with tenant context
- **Status**: 200 OK

**Endpoint**: `POST /api/v1/auth/refresh`
- Validates refresh token, generates new access token
- **Status**: 200 OK

**Endpoint**: `POST /api/v1/auth/logout`
- Client-side token discard (stateless JWT)
- Future: Server-side token blacklist with Redis
- **Status**: 204 No Content

### 4.2 Finance Domain Endpoints

**Endpoint**: `GET /api/v1/finance/accounts`
- List all financial accounts for current user
- Pagination support (skip, limit)
- Filtered by RLS automatically
- **Returns**: List[FinancialAccountResponse]

**Endpoint**: `POST /api/v1/finance/accounts`
- Create new financial account
- Requires current user context
- Automatically sets tenant_id and user_id
- **Status**: 201 Created

**Endpoint**: `GET /api/v1/finance/accounts/{account_id}`
- Get specific financial account
- RLS ensures ownership verification
- **Status**: 200 OK or 404 Not Found

### 4.3 GraphRAG Search Endpoints

**Endpoint**: `POST /api/v1/search/query`
- Query knowledge graph with natural language + RAG
- Performs hybrid search (graph + vector)
- RLS filtering for multi-tenant isolation
- **Returns**: GraphRAGQueryResponse with answer, sources, entities, reasoning

**Response Schema**:
```python
{
    "answer": "generated answer from RAG",
    "sources": [
        {
            "source_type": "knowledge_graph|vector_db|llm",
            "source_uri": "entity_uri|document_id",
            "content": "snippet",
            "relevance": 0.95,
            "metadata": {...}
        }
    ],
    "reasoning": [
        {"step": 1, "description": "...", "action": "...", "result": "..."}
    ],
    "confidence": 0.87,
    "entities": [
        {
            "uri": "ln:Goal:123",
            "type": "ln:Goal",
            "label": "Save $10k",
            "properties": {...}
        }
    ],
    "duration_ms": 245
}
```

**Endpoint**: `GET /api/v1/search/status`
- Health check for GraphRAG service
- Returns service status, version, component health
- **Status**: 200 OK or empty status dict on error

---

## 5. GRAPHRAG INTEGRATION

### 5.1 GraphRAG Client Architecture

**File**: `/backend/app/clients/graphrag.py`

**gRPC Integration**:
```
GraphRAGClient (async gRPC client)
├── Protocol: gRPC with async/await
├── Address: localhost:50051 (configurable)
├── Timeout: 30 seconds (configurable)
├── Max Retries: 3
└── Message Size: 100 MB (send/receive)
```

**Connection Management**:
```python
# Channel pooling
self._channel = aio.insecure_channel(
    address,
    options=[
        ("grpc.max_send_message_length", 100 * 1024 * 1024),
        ("grpc.max_receive_message_length", 100 * 1024 * 1024),
        ("grpc.keepalive_time_ms", 30000),
        ("grpc.keepalive_timeout_ms", 10000),
    ]
)

# Persistent stub (global client instance)
_graphrag_client = GraphRAGClient()  # Singleton
get_graphrag_client()  # Reuse connections
```

### 5.2 Query Types

| Method | Purpose | Auth | Multi-Tenant |
|--------|---------|------|--------------|
| `query_personalized()` | User-specific query with RLS | Required | ✓ (tenant_id, user_id) |
| `query_centralized()` | Org-wide knowledge query | Required | ✓ (domain filter) |
| `semantic_search()` | Vector similarity search | Required | ✓ (tenant_id) |
| `vector_search()` | Embedding-based search | Required | ✗ (global) |
| `hybrid_search()` | Graph + vector combined | Required | ✓ (configurable weights) |

### 5.3 RLS Context Propagation

```
1. FastAPI Request arrives with JWT token
2. Dependency: get_current_user() → verifies token, fetches User
3. Dependency: get_tenant_id_from_token() → extracts tenant_id
4. Dependency: set_rls_context() → sets PostgreSQL session context
5. GraphRAG Query: receives user_id + tenant_id
6. GraphRAG applies filters for isolation
7. Results returned (only accessible data)
```

**Security Flow**:
```python
# In endpoint
async def search_knowledge_graph(
    request: GraphRAGQueryRequest,
    current_user: CurrentUser,        # Authenticated user
    tenant_id: TenantID,              # Tenant context
):
    client = get_graphrag_client()
    response = await client.query_personalized(
        query=request.query,
        user_id=str(current_user.id),  # RLS filtering
        tenant_id=str(tenant_id),       # Multi-tenancy
        ...
    )
```

---

## 6. COMPLIANCE & REGULATORY FEATURES

### 6.1 HIPAA Compliance

**Configuration Settings** (`/backend/app/core/config.py`):
```python
ENABLE_AUDIT_LOGGING: bool = True
DATA_RETENTION_DAYS: int = 2555  # 7 years
ENABLE_ENCRYPTION_AT_REST: bool = True
REQUIRE_MFA_FOR_HEALTH_DATA: bool = True
```

**Tenant-Level Settings** (`tenants` table):
```python
hipaa_enabled BOOLEAN DEFAULT true
encryption_at_rest BOOLEAN DEFAULT true
audit_log_enabled BOOLEAN DEFAULT true
data_retention_days INTEGER DEFAULT 2555
```

### 6.2 Audit Logging

**File**: `/backend/app/models/user.py`

**AuditLog Model**:
```python
class AuditLog(UUIDMixin):
    # Tenant & user context
    tenant_id: UUID          # Which tenant was affected
    user_id: UUID | None     # Who made the change
    
    # Event details
    event_type: str          # 'LOGIN', 'CREATE_RESOURCE', 'UPDATE_DATA', etc.
    event_category: str      # 'AUTH', 'DATA_ACCESS', 'DATA_MODIFICATION'
    severity: str            # 'info', 'warning', 'error', 'critical'
    
    # Resource information
    resource_type: str       # 'FinancialAccount', 'HealthCondition', etc.
    resource_id: UUID        # Which resource was affected
    resource_changes: dict   # Before/after data (JSONB)
    
    # Request context
    ip_address: str          # IPv6 compatible
    user_agent: str
    request_id: UUID         # Trace request end-to-end
    session_id: UUID         # Track user session
    
    # Metadata
    metadata_: dict          # Custom fields (JSONB)
    created_at: datetime     # Immutable (no updated_at)
```

**Immutable Design**: Audit logs can only be inserted, never updated or deleted (enforced by RLS policies)

### 6.3 Data Privacy Features

**Soft Delete Pattern**: 
- Records marked with `deleted_at` timestamp
- Preserved for audit trail retention
- Excluded from queries by default
- GDPR-friendly (supports right-to-be-forgotten with permanent deletion after retention period)

**Encryption**: 
- Configuration supports encryption at rest
- PostgreSQL pgcrypto extension loaded
- Field-level encryption can be implemented per domain

**MFA Support**:
- TOTP secret storage in User model
- Backup codes for recovery
- MFA enforcement for sensitive operations (health data)

---

## 7. ERROR HANDLING PATTERNS

### 7.1 HTTP Exception Handling

**Authentication Errors** (401 Unauthorized):
```python
HTTPException(status_code=401, detail="Invalid authentication credentials")
HTTPException(status_code=401, detail="Invalid token payload")
HTTPException(status_code=401, detail="User not found")
HTTPException(status_code=401, detail="Token expired")
```

**Authorization Errors** (403 Forbidden):
```python
HTTPException(status_code=403, detail="User account is suspended")
HTTPException(status_code=403, detail="Access to this tenant is forbidden")
HTTPException(status_code=403, detail="Admin or owner role required")
```

**Not Found Errors** (404):
```python
HTTPException(status_code=404, detail="Financial account not found")
HTTPException(status_code=404, detail="Resource not found")
```

**Service Unavailable** (503):
```python
HTTPException(status_code=503, detail="GraphRAG service error: ...")
HTTPException(status_code=503, detail="Database connection failed")
```

### 7.2 Global Exception Handler

**File**: `/backend/app/main.py`

```python
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """
    Handles unhandled exceptions globally
    
    Production: Generic error message
    Development: Includes error details for debugging
    """
    logger.error(
        "Unhandled exception",
        error=str(exc),
        path=request.url.path,
        method=request.method,
        exc_info=exc
    )
    
    if settings.is_production:
        return {"detail": "Internal server error"}
    else:
        return {
            "detail": "Internal server error",
            "error": str(exc),
            "type": type(exc).__name__
        }
```

---

## 8. SERVICES/API (`/services/api`)

### 8.1 Service Architecture

**File**: `/services/api/app/main.py`

Similar structure to main backend:
```python
# FastAPI app with lifespan
# Middleware: CORS, logging, rate limiting, auth
# Initialization: Database, Maverick LLM client
# Routes: Same 6 domains + agents
```

**Key Integration**: Maverick LLM Client
```python
await get_maverick_client()      # Initialize on startup
await shutdown_maverick_client() # Cleanup on shutdown
```

### 8.2 Maverick Integration

**File**: `/services/api/app/services/maverick_client.py`

Provides:
- LLM inference for agent reasoning
- Streaming responses support
- Context window management
- Token counting

---

## 9. FINANCE-API MICROSERVICE (`/services/finance-api`)

### 9.1 Purpose

Specialized financial services microservice with:
- Advanced portfolio analysis
- Tax strategy optimization
- Market data integration
- Financial health scoring
- Investment analytics

### 9.2 Architecture

**File**: `/services/finance-api/app/main.py`

```python
Middleware Stack:
├── AuthMiddleware      (JWT validation)
├── RateLimitMiddleware (Per-user rate limiting)
├── LoggingMiddleware   (Structured logging)
└── CORS & GZip

Initialization:
├── PostgreSQL database
├── Redis cache
├── Market data services
└── Tax calculation engines
```

### 9.3 Endpoints

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/v1/profile` | GET, POST, PUT, DELETE | User financial profile |
| `/api/v1/accounts` | GET, POST, PUT, DELETE | Bank accounts, investments, loans |
| `/api/v1/transactions` | GET, POST, PUT, DELETE | Categorized transactions, analytics |
| `/api/v1/budgets` | GET, POST, PUT, DELETE | Budget management |
| `/api/v1/goals` | GET, POST, PUT, DELETE | Financial goals |
| `/api/v1/investments` | GET, POST | Portfolio analysis |
| `/api/v1/market` | GET | Market data integration |
| `/api/v1/analytics` | GET | Financial analytics |
| `/api/v1/plaid` | POST | Plaid banking integration |

### 9.4 Services Layer

**InvestmentService**:
```python
calculate_portfolio_performance()  # Returns: PortfolioPerformance
get_asset_allocation()            # Returns: Dict[str, float]
calculate_tax_efficiency()        # Tax optimization
rebalance_portfolio()             # Recommend rebalancing
```

**TaxService**:
```python
calculate_tax_liability()         # Federal + state taxes
recommend_tax_strategies()        # Tax-loss harvesting, etc.
estimate_quarterly_taxes()        # Estimated tax payments
```

**TransactionService**:
```python
categorize_transaction()          # Auto-categorize
detect_recurring()                # Find recurring patterns
get_spending_trends()             # Trend analysis
```

---

## 10. AGENTS SERVICE (`/services/agents`)

### 10.1 Multi-Agent System

**Directory**: `/services/agents/agents/`

```
agents/
├── core/                    # Base agent classes
├── domain/                  # Domain-specific agents
│   ├── finance_agent.py
│   ├── health_agent.py
│   ├── career_agent.py
│   └── education_agent.py
├── orchestration/           # Agent coordination
├── specialists/             # Specialized tools
└── tools/                   # External integrations
```

### 10.2 GraphRAG Plugin (MCP Server)

**File**: `/services/agents/mcp-server/plugins/graphrag/plugin.py`

**Purpose**: Hybrid knowledge graph + vector search integration

**Tool Suite**:
```python
query_knowledge_graph()      # Cypher queries
search_semantic()            # Vector similarity search
hybrid_search()              # Combined graph + vector
add_entity()                 # Create entities
add_relationship()           # Create relationships
get_entity_context()         # Full entity context
find_path()                  # Shortest path queries
get_recommendations()        # Graph-based recommendations
```

**Databases**:
- **Neo4j**: Knowledge graph (relationships, patterns)
- **Qdrant**: Vector database (embeddings, semantic search)

---

## 11. CONFIGURATION MANAGEMENT

### 11.1 Environment-Based Configuration

**File**: `/backend/app/core/config.py`

```python
# Environment
ENVIRONMENT: "development" | "staging" | "production"
DEBUG: bool
LOG_LEVEL: str

# API Server
API_HOST: str = "0.0.0.0"
API_PORT: int = 8000
API_PREFIX: str = "/api/v1"

# Database
DATABASE_URL: PostgreSQL connection string
DATABASE_POOL_SIZE: int = 20
DATABASE_POOL_TIMEOUT: int = 30

# Cache
REDIS_URL: Redis connection string
REDIS_MAX_CONNECTIONS: int = 50

# Security
SECRET_KEY: str (min 32 chars)
ALGORITHM: str = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
REFRESH_TOKEN_EXPIRE_DAYS: int = 30

# Multi-Tenancy
DEFAULT_TENANT_ID: str | None
ENABLE_TENANT_ISOLATION: bool = True

# GraphRAG Service
GRAPHRAG_URL: str = "localhost:50051"
GRAPHRAG_TIMEOUT: int = 30
GRAPHRAG_MAX_RETRIES: int = 3

# Knowledge Graphs
NEO4J_URI: str
NEO4J_USER: str
NEO4J_PASSWORD: str
QDRANT_URL: str
GRAPHDB_URL: str

# External Services
PLAID_CLIENT_ID: str
PLAID_SECRET: str
STRIPE_API_KEY: str
SENDGRID_API_KEY: str

# Feature Flags
ENABLE_PLAID_SYNC: bool = True
ENABLE_VECTOR_SEARCH: bool = True
ENABLE_GRAPH_QUERIES: bool = True
ENABLE_EMAIL_NOTIFICATIONS: bool = True

# Monitoring
SENTRY_DSN: str
OTEL_EXPORTER_OTLP_ENDPOINT: str
OTEL_TRACES_ENABLED: bool = True
OTEL_METRICS_ENABLED: bool = True
```

---

## 12. DATA MODELS & PERSISTENCE STRATEGY

### 12.1 Schema Design Principles

1. **Normalized** (3NF): Avoid data duplication, maintain referential integrity
2. **Tenant-Scoped**: Every table has `tenant_id` or inherits through FK
3. **Auditable**: Track creation/modification times
4. **Soft-Deletable**: Preserve audit history
5. **Indexed**: Optimize RLS and common queries
6. **Type-Safe**: Use PostgreSQL enums for constrained values

### 12.2 Key Architectural Patterns

**Multi-Tenancy**:
```
Organization (1) ──→ (N) Tenant (1) ──→ (N) User
                                  ↓
                            (RLS Isolation)
                                  ↓
                    User_Tenant (membership)
```

**Resource Ownership**:
```
Tenant (1) ──→ (N) Financial Account ──→ (N) Transaction
         ↓
      User (owner)
```

**Audit Trail**:
```
Any table modification → AuditLog entry (immutable)
  - What changed (resource_changes JSONB)
  - Who changed it (user_id)
  - When (created_at)
  - Why (request_id for traceability)
```

---

## 13. KEY ARCHITECTURAL PATTERNS

### 13.1 Dependency Injection

FastAPI's `Depends()` pattern for:
- Authentication (get_current_user)
- Authorization (require_admin)
- Database sessions (get_session)
- RLS context setup (set_rls_context)

**Composition** (type aliases):
```python
CurrentUser = Annotated[User, Depends(get_current_active_user)]
DBSession = Annotated[AsyncSession, Depends(set_rls_context)]
```

### 13.2 Async/Await Throughout

All database operations:
- Async SQLAlchemy with asyncpg driver
- Non-blocking gRPC calls to GraphRAG
- Concurrent request handling

### 13.3 Pydantic Schemas

**Layers**:
1. **SQLAlchemy Models** (ORM, DB schema)
2. **Pydantic Schemas** (API contracts)
3. **Response Models** (JSON serialization)

**Validation**:
- Field validators for business logic
- Type coercion and conversion
- Enum validation

### 13.4 Resource Versioning

API versioning through URL prefix:
- `/api/v1/` (current)
- Future: `/api/v2/` for breaking changes

### 13.5 Error Recovery

**Graceful Degradation**:
- GraphRAG unavailable → Return partial response
- Database connection failed → Return 503 Service Unavailable
- RLS policy violation → Return 403 Forbidden

---

## 14. SECURITY CONSIDERATIONS

### 14.1 Defense in Depth

```
Layer 1: Transport
  - HTTPS (enforced in production)
  - TLS 1.2+

Layer 2: Authentication
  - JWT Bearer tokens
  - Stateless (no server-side session storage)
  - Token rotation (access + refresh pattern)

Layer 3: Authorization
  - RBAC (4 roles per tenant)
  - ABAC ready (can add attribute checks)
  - Per-endpoint permission checks

Layer 4: Data Access
  - PostgreSQL RLS policies
  - Database-level enforcement
  - Tenant isolation at SQL layer

Layer 5: Audit
  - Immutable audit logs
  - Event categorization (AUTH, DATA_ACCESS, etc.)
  - Request tracing (request_id)

Layer 6: Secrets
  - Environment variables (12-factor app)
  - PostgreSQL pgcrypto for sensitive fields
  - SSH keys for service-to-service communication
```

### 14.2 OWASP Top 10 Mitigation

| Vulnerability | Mitigation |
|---------------|-----------|
| Injection | Parameterized queries (SQLAlchemy ORM) |
| Broken Auth | JWT + RLS + Multi-tenant isolation |
| Sensitive Data | Encryption at rest + HIPAA policies |
| XML/XXE | No XML parsing in API |
| Broken Access | RLS + RBAC + endpoint guards |
| Security Misc | CORS + CSRF tokens (stateless JWT) |
| XSS | API returns JSON only, frontend responsible |
| Insecure Deser | Pydantic schema validation |
| Weak Auth | BCrypt password hashing + MFA ready |
| SSRF | Internal service isolation (gRPC) |

---

## 15. OPERATIONAL PATTERNS

### 15.1 Logging

**Structured Logging** (via stdlib logging):
```python
logger.info(
    "event_name",
    user_id=str(user.id),
    tenant_id=str(tenant_id),
    action="action_taken",
    status="success/failed"
)
```

**Log Levels**:
- DEBUG: Connection pooling, RLS context setting
- INFO: User login, resource creation, API calls
- WARNING: Failed authentication, policy violations
- ERROR: Database errors, service unavailable
- CRITICAL: Security violations, data corruption

### 15.2 Monitoring

**Health Checks**:
- `/health` - Service status + version
- `/health/db` - Database connectivity
- `/metrics` - Prometheus metrics

**Sentry Integration** (error tracking):
- Automatic error reporting
- User context tracking
- Release tracking

**OpenTelemetry Support**:
- Distributed tracing
- Metrics collection
- Log correlation

### 15.3 Graceful Shutdown

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_db()
    await init_graphrag_client()
    
    yield  # App running
    
    # Shutdown
    await close_graphrag_client()
    await close_db()
    # Connections drained gracefully
```

---

## 16. DEPLOYMENT CONSIDERATIONS

### 16.1 Container-Ready

**Dockerfile** (`/backend/Dockerfile`):
```dockerfile
FROM python:3.12
WORKDIR /app
COPY pyproject.toml poetry.lock ./
RUN pip install poetry && poetry install --no-dev
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### 16.2 Kubernetes Readiness

**Liveness Probe**: `/health/db` (checks database)
**Readiness Probe**: `/health` (checks API availability)
**Grace Period**: 30 seconds for graceful shutdown

### 16.3 Database Migrations

**Alembic** (SQL-based migrations):
```
backend/alembic/versions/
├── 001_initial_schema.py (Organizations, Users, Tenants)
├── 002_domain_tables.py (Finance, Career, Health, etc.)
├── 003_enable_rls.py (Row-Level Security policies)
└── 004_enable_pgvector.py (Vector embeddings support)
```

**Execution**:
```bash
alembic upgrade head  # Apply all migrations
alembic upgrade -1    # Rollback 1 version
```

---

## 17. TESTING STRATEGY

### 17.1 Test Coverage Areas

1. **Unit Tests**: Business logic, validation
2. **Integration Tests**: Database operations, RLS policies
3. **API Tests**: Endpoint contracts, error responses
4. **Security Tests**: HIPAA compliance, data isolation
5. **Performance Tests**: RLS query impact, concurrent users

### 17.2 Test Tools

- **pytest**: Test framework
- **pytest-asyncio**: Async test support
- **httpx**: Async HTTP client for API tests
- **faker**: Test data generation
- **Coverage.py**: Coverage reporting

---

## 18. PERFORMANCE OPTIMIZATION

### 18.1 Database Optimizations

**Connection Pooling**:
```python
pool_size=20           # Steady-state connections
max_overflow=10        # Burst capacity
pool_timeout=30        # Wait timeout
pool_recycle=3600      # Recycle stale connections
```

**Query Optimization**:
- Index on foreign keys (RLS, joins)
- Index on commonly filtered columns (status, tenant_id)
- Composite indexes for multi-column filters

**Lazy Loading**:
```python
result = await db.execute(
    select(User)
    .options(selectinload(User.tenants))  # Eager load relationships
)
```

### 18.2 Caching Strategy

**Redis Caching**:
- Session data
- Token blacklist (future)
- Frequently accessed configuration
- GraphRAG query results

### 18.3 Async Advantages

- Non-blocking I/O
- Concurrent request handling
- Reduced thread overhead
- Better scalability under load

---

## 19. FUTURE ENHANCEMENTS

### Planned Features

1. **Server-Side Token Blacklist**: Revoke tokens immediately on logout
2. **GraphRAG Index Rebuild**: Incremental knowledge graph updates
3. **Webhook System**: Event-driven integrations
4. **Advanced Analytics**: Reporting and BI features
5. **Machine Learning**: Predictive recommendations
6. **Real-Time Updates**: WebSocket support
7. **Advanced Search**: Full-text search + filtering
8. **Data Export**: GDPR-compliant data export

### Infrastructure Readiness

- Cloud-agnostic (runs on GCP, AWS, Azure)
- Horizontal scalability (stateless)
- Load balancer friendly
- Database replication support

---

## CONCLUSION

The Life Navigator FastAPI backend is a **production-grade, enterprise-ready** system featuring:

✓ **Secure**: JWT + RLS + RBAC + HIPAA compliance
✓ **Scalable**: Async/await, connection pooling, stateless design
✓ **Maintainable**: Clear separation of concerns, DI pattern
✓ **Observable**: Structured logging, health checks, metrics
✓ **Compliant**: Audit logs, soft deletes, data retention policies
✓ **Extensible**: Multi-domain architecture, plugin-based agents

The architecture elegantly combines:
- Modern async Python (FastAPI, asyncpg)
- Multi-tenancy patterns (RLS at database layer)
- AI integration (GraphRAG knowledge graphs)
- Security best practices (JWT, RBAC, encryption)
- Operational excellence (monitoring, logging, graceful shutdown)

