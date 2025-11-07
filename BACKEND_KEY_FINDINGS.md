# Life Navigator Backend - Key Architectural Findings

## System Overview
Production-grade multi-tenant SaaS platform with 4 interconnected FastAPI services:
1. **Main Backend** (Port 8000) - Core API with 6 life domains + GraphRAG integration
2. **Services/API** (Independent instance) - Replicated domain endpoints + LLM client
3. **Finance-API** (Specialized microservice) - Advanced financial analytics + tax optimization
4. **Agents Service** - Multi-agent orchestration with GraphRAG knowledge graph

---

## Architecture Highlights

### 1. Multi-Tenant Isolation (Defense in Depth)
- **Layer 1 (JWT)**: Tenant context embedded in access tokens
- **Layer 2 (Application)**: Dependency injection enforces tenant access verification
- **Layer 3 (Database)**: PostgreSQL Row-Level Security (RLS) at SQL level
  - `current_tenant_id()` function manages session context
  - Policies prevent cross-tenant data leakage
  - Service accounts bypass RLS for batch operations

### 2. Authentication & Authorization
**JWT Structure**:
```
{
  "sub": "user_id",
  "tenant_id": "context",
  "type": "access|refresh|password_reset|email_verification",
  "exp": "expiration"
}
```

**RBAC Roles** (per tenant):
- OWNER: Full control
- ADMIN: Manage users/resources (no ownership changes)
- MEMBER: Access shared resources
- GUEST: Read-only

### 3. Database Design (43 Tables)
**Multi-Tenancy Model**:
```
Organization (B2B) 
  └─ Tenant (Workspace)
      └─ User (Member)
          └─ UserTenant (Role: OWNER|ADMIN|MEMBER|GUEST)
```

**Composition Pattern** (Model Mixins):
- UUIDMixin: UUID primary keys
- TimestampMixin: created_at, updated_at
- SoftDeleteMixin: deleted_at (soft deletes)
- UserOwnedMixin: tenant_id + user_id
- TenantMixin: tenant_id isolation

**6 Domain Areas** (~40 models):
1. Finance: Accounts, Transactions, Budgets
2. Career: Profiles, Applications, Interviews
3. Education: Credentials, Courses
4. Goals: Goals, Milestones
5. Health: Conditions, Medications (HIPAA-enabled)
6. Relationships: Contacts, Interactions

### 4. GraphRAG Integration (gRPC)
**Architecture**:
- Async gRPC client to Rust service (localhost:50051)
- Connection pooling with keepalive
- Message size: 100MB (send/receive)
- Timeout: 30 seconds (configurable)

**Query Types**:
- `query_personalized()` - User-specific with RLS filtering
- `query_centralized()` - Org-wide knowledge
- `hybrid_search()` - Graph + vector combined
- `semantic_search()` - Vector similarity
- `vector_search()` - Pure embedding search

**RLS Propagation**:
```
Request → JWT → Extract tenant_id/user_id
       → Set DB context → GraphRAG query
       → Results filtered by RLS policies
```

### 5. Compliance & Audit
**HIPAA Features**:
- Tenant-level encryption settings (encryption_at_rest, audit_log_enabled)
- 7-year data retention (configurable per tenant)
- MFA support for health data
- Immutable audit logs (append-only by policy)

**AuditLog Model**:
- tenant_id, user_id, event_type, event_category
- resource_type, resource_id, resource_changes (JSONB)
- ip_address, user_agent, request_id, session_id
- created_at only (no updates)

**GDPR Support**:
- Soft deletes + permanent deletion after retention
- Data export capability
- Right-to-be-forgotten compatible

### 6. API Design
**Endpoint Organization**:
```
/api/v1/
├── /auth          (register, login, refresh, logout)
├── /users         (user management, tenant admin)
├── /finance       (accounts, transactions, budgets)
├── /career        (profiles, applications, interviews)
├── /education     (credentials, courses)
├── /goals         (goals, milestones)
├── /health        (conditions, medications)
├── /relationships (contacts, interactions)
└── /search        (GraphRAG queries, knowledge graph)
```

**Error Handling**:
- 401: Invalid credentials, token expired
- 403: Forbidden (RLS violation, role insufficient)
- 404: Resource not found
- 503: Service unavailable (GraphRAG down)

### 7. Security Layers
```
Transport    → HTTPS (enforced prod)
Auth         → JWT + RLS + RBAC
Authorization → Dependency injection + DB policies
Data Access  → RLS at SQL + Pydantic validation
Audit        → Immutable logs + event tracing
Secrets      → Environment variables + pgcrypto
```

### 8. Performance Features
- **Connection Pooling**: 20 steady-state + 10 overflow
- **Async/Await**: All I/O non-blocking
- **RLS Indexes**: Optimized for isolation policies
- **Lazy Loading**: Relationships loaded on demand
- **Caching**: Redis for session/config (token blacklist planned)

### 9. Operational Excellence
**Health Checks**:
- `/health` - Service status
- `/health/db` - Database connectivity
- `/metrics` - Prometheus metrics

**Monitoring**:
- Sentry integration (error tracking)
- OpenTelemetry support (distributed tracing)
- Structured logging (contextual info)

**Graceful Shutdown**:
- Connection pool drainage
- In-flight request completion
- Database cleanup

### 10. Finance-API Specialization
Microservice with advanced features:
- Portfolio performance analysis
- Asset allocation breakdown
- Tax liability calculation
- Tax strategy recommendations (tiered by income)
- Market data integration
- Transaction auto-categorization
- Recurring transaction detection
- Spending trend analysis
- Plaid bank integration

**Services Layer**:
- InvestmentService (performance, allocation, rebalancing)
- TaxService (liability, strategies, quarterly estimates)
- TransactionService (categorization, recurring, analytics)
- MarketDataService (real-time quotes, historical data)

---

## Key Files & Locations

| Component | Path | Purpose |
|-----------|------|---------|
| Main App | `/backend/app/main.py` | FastAPI entry point with lifespan |
| Routes | `/backend/app/api/v1/router.py` | Route aggregation |
| Auth | `/backend/app/core/security.py` | JWT, password hashing |
| Dependencies | `/backend/app/api/deps.py` | DI, auth, RLS context |
| Database | `/backend/app/core/database.py` | Connection pooling, session factory |
| Models | `/backend/app/models/*.py` | SQLAlchemy ORM (43 models) |
| Schemas | `/backend/app/schemas/*.py` | Pydantic validation |
| GraphRAG Client | `/backend/app/clients/graphrag.py` | gRPC integration |
| Endpoints | `/backend/app/api/v1/endpoints/*.py` | Route handlers |
| Migrations | `/backend/alembic/versions/*.py` | Schema evolution |
| RLS SQL | `/backend/app/db/migrations/*.sql` | RLS policies |
| Finance API | `/services/finance-api/app/main.py` | Finance microservice |
| Agents | `/services/agents/agents/` | Multi-agent system |
| GraphRAG Plugin | `/services/agents/mcp-server/plugins/graphrag/` | Knowledge graph plugin |

---

## Critical Design Decisions

### 1. Async-First
- All I/O operations non-blocking
- Better scalability for concurrent users
- Reduced thread overhead

### 2. RLS at Database Layer
- Not just application-level filtering
- PostgreSQL enforces isolation
- Cross-tenant data leakage prevented at SQL level

### 3. Soft Deletes + Audit Trail
- Preserve data for compliance
- Support audit investigations
- Enable GDPR data export

### 4. Multi-Service Architecture
- Main backend for unified API
- Finance-API for specialized calculations
- Agents service for orchestration
- Each service independently deployable

### 5. JWT + Tenant Context
- Stateless authentication
- Tenant isolation in token payload
- Enables horizontal scaling

### 6. Model Mixins (DRY)
- Reusable patterns (UUID, Timestamps, SoftDelete)
- Consistent behavior across 43+ models
- Single source of truth for business logic

---

## Integration Patterns

### Frontend → Backend
```
POST /api/v1/auth/login
  ↓ (credentials)
Returns: { access_token, refresh_token, user }
  ↓
Store tokens locally
  ↓
All API calls: Authorization: Bearer {access_token}
  ↓
When expired: POST /api/v1/auth/refresh
```

### Backend → GraphRAG
```
1. User makes query request (authenticated)
2. Dependency injection extracts user_id + tenant_id
3. GraphRAG gRPC call with context
4. GraphRAG applies RLS filtering
5. Results returned (only user-accessible data)
```

### Backend → Finance-API
- Separate microservice for financial domain
- Can be deployed independently
- Shares database with main backend (separate schema possible)
- Financial calculations isolated from core logic

### Agents → GraphRAG
- MCP (Model Context Protocol) for LLM tools
- Hybrid search across knowledge graph
- Context-aware recommendations

---

## Deployment Readiness

### Container-Ready
- Dockerfile provided
- Python 3.12 + FastAPI
- Docker Compose for local dev
- Poetry for dependency management

### Kubernetes-Ready
- Health check endpoints for probes
- Stateless design (scales horizontally)
- Environment variable configuration
- Graceful shutdown support

### Database Migrations
- Alembic for schema management
- 4 migration files (schemas + RLS + pgvector)
- Reversible migrations
- Can run before API startup

### Cloud-Agnostic
- Works with any PostgreSQL (AWS RDS, GCP Cloud SQL, etc.)
- Can use cloud object storage for files
- Redis for caching (cloud-hosted possible)
- gRPC service location configurable

---

## Strengths
1. Multi-layer security (JWT + RLS + RBAC)
2. HIPAA compliance built-in (audit logs, encryption settings)
3. Scalable async design
4. Clean separation of concerns
5. Comprehensive error handling
6. Database-level data isolation
7. Production-ready monitoring
8. Well-documented migrations

## Potential Improvements
1. Server-side token blacklist (planned)
2. GraphRAG index rebuild API
3. Webhook system for events
4. Advanced analytics reporting
5. Real-time updates (WebSocket)
6. Full-text search support
7. Request rate limiting enforcement
8. Cache invalidation strategy

---

## Conclusion

This is a **highly sophisticated, production-ready** architecture that successfully balances:
- Security (RLS + RBAC + audit)
- Scalability (async, stateless, pooling)
- Maintainability (clear DI, mixins, separation)
- Compliance (HIPAA, GDPR-friendly)
- Operations (health checks, monitoring, graceful shutdown)

The multi-service design and GraphRAG integration position it well for AI-powered personalization while maintaining strong multi-tenant isolation.

