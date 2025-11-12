# Life Navigator Monorepo - Complete Architecture Analysis

## Executive Summary

Life Navigator is a production-grade AI life management platform using a monorepo architecture with a dual-graph semantic system (PostgreSQL + Neo4j + GraphDB). It's built for HIPAA compliance with multi-tenant support and leverages advanced AI agents for holistic life management.

---

## 1. SERVICES & APPLICATIONS OVERVIEW

### Frontend Applications

#### Web Application (apps/web)
- **Technology**: Next.js 15, React 19, TypeScript
- **Framework**: Modern React with concurrent features
- **Port**: 3000/3002
- **Package Manager**: pnpm workspaces
- **Key Dependencies**:
  - Tailwind CSS 4.0 for styling
  - TanStack React Query 5.0 for server state
  - Framer Motion for animations
  - Prisma 5.22.0 for ORM
  - Recharts for data visualization
  - Zod for schema validation
- **Features**:
  - Dashboard with multi-module support
  - Real-time chat integration
  - Dark mode support
  - Responsive design
  - OTP/2FA support
  - Plaid integration for banking
  - Calendar and scheduling

#### Mobile Application (apps/mobile)
- **Technology**: React Native, Expo 52, TypeScript
- **Platform**: iOS & Android
- **Port**: 19006 (Expo dev server)
- **Key Dependencies**:
  - React Native 0.76.1
  - Expo 52.0.0
  - React Navigation 7.0
  - TanStack React Query 5.62.9
  - React Native health tracking libraries
  - Expo Secure Store for secure storage
  - Camera, Calendar, Location APIs
- **Features**:
  - Health data collection
  - Wearable integration (Apple Health, Google Fit)
  - BLE connectivity for health devices
  - Offline-first architecture
  - Location-based services

---

## 2. BACKEND SERVICES

### Core Backend (backend/)
- **Technology**: FastAPI 0.115.0, Python 3.11+, SQLAlchemy 2.0
- **Port**: 8000
- **Architecture**: Multi-tenant, REST API
- **Key Dependencies**:
  - Uvicorn 0.32.0 with async workers
  - Pydantic 2.9.0 for validation
  - asyncpg 0.29.0 for PostgreSQL
  - SQLAlchemy 2.0.36 with async support
  - python-jose 3.5.0 for JWT
  - bcrypt password hashing
  - Alembic for migrations
  - Redis 5.0.1 for caching
  - Celery 5.3.6 for async tasks
  - gRPC 1.60.0 for services
  - OpenTelemetry for observability
  - Sentry for error tracking

**Database Models** (43 tables):
- User Management: User, Organization, Tenant, UserTenant, UserTenantRole
- Finance: FinancialAccount, Transaction, Budget, Investment
- Health: HealthCondition, Medication, HealthMetric
- Career: CareerProfile, JobApplication, Interview
- Education: EducationCredential, Course
- Goals: Goal, Milestone
- Relationships: Contact, ContactInteraction
- Audit: AuditLog

**API Endpoints** (52+):
- `/api/v1/auth` - Register, Login, Refresh, Logout, MFA
- `/api/v1/users` - User management, profiles
- `/api/v1/finance` - Accounts, transactions, budgets
- `/api/v1/health` - Conditions, medications, metrics
- `/api/v1/career` - Career profiles, job applications
- `/api/v1/education` - Credentials, courses
- `/api/v1/goals` - Goal management, milestones
- `/api/v1/graphrag` - Knowledge graph queries
- `/api/v1/agents` - Agent interactions

**Security Features**:
- JWT-based authentication (8-hour expiry)
- Refresh tokens (7-day expiry)
- Multi-factor authentication (TOTP)
- Password reset tokens (24-hour expiry)
- Email verification tokens (7-day expiry)
- Multi-tenant isolation with RLS
- Field-level encryption for PHI
- Rate limiting
- CORS configuration
- Audit logging

### API Service (services/api/)
- **Status**: Legacy (being migrated to backend/)
- **Technology**: FastAPI, Python
- **Port**: Could run on 8001 or alternative
- **Purpose**: Legacy API endpoints (in transition)

### Agents Service (services/agents/)
- **Technology**: FastAPI, Python 3.12+, Hierarchical Multi-Agent System
- **Port**: 8080 (Agents) / 8090 (MCP Server)
- **MCP Server**: Model Context Protocol for Claude integration
- **Architecture**: Multi-agent orchestration with context building
- **Key Dependencies**:
  - FastAPI 0.121.1
  - Uvicorn 0.38.0
  - Transformers 4.57.1 (Hugging Face)
  - Sentence Transformers 3.0.1 for embeddings
  - Neo4j driver 5.24.0
  - Qdrant client 1.11.0
  - PostgreSQL driver: psycopg 3.2.1 with pgvector 0.3.2
  - Redis 7.0.1 with hiredis
  - Prometheus 0.20.0 for monitoring
  - PyTorch via transformers
  - Datasets 4.3.0 for data loading

**Agents Include**:
- Finance Agent - Portfolio analysis, investment insights
- Health Agent - Health trend analysis, recommendations
- Career Agent - Career path guidance, interview prep
- Education Agent - Learning recommendations
- Planning Agent - Goal setting and milestone tracking
- Knowledge Agent - GraphRAG integration

### GraphRAG Service (services/graphrag-rs/)
- **Technology**: Rust 2021 edition, gRPC, high-performance
- **Performance**: 100x faster than Python version
- **Port**: 50051 (gRPC)
- **Key Dependencies**:
  - Tonic 0.11 for gRPC
  - Prost 0.12 for protobuf
  - neo4rs 0.7 (Neo4j async Rust client)
  - qdrant-client 1.7 (Official Qdrant)
  - tokio 1.35 for async runtime
  - reqwest 0.11 for HTTP (GraphDB SPARQL)
  - Tracing for observability
  - Prometheus 0.14 for metrics

**Functionality**:
- Graph queries and traversal
- Vector similarity search integration
- SPARQL query execution
- Neo4j Cypher query execution
- Embeddings retrieval
- Connection pooling with deadpool

### Finance API Service (services/finance-api/)
- **Technology**: FastAPI, Python 3.11
- **Port**: 8001
- **Key Dependencies**:
  - Triple-engine OCR (Tesseract, PaddleOCR, DeepSeek)
  - Plaid SDK 18.0.0 for banking
  - PDF/document processing
  - Image recognition

**Features**:
- Receipt/document OCR
- Financial statement parsing
- Transaction extraction
- Account linking via Plaid
- Multi-currency support
- Confidence scoring for OCR results

### Embeddings Service (services/embeddings/)
- **Technology**: Python, FastAPI
- **Purpose**: Vector embedding generation
- **Key Dependencies**:
  - Sentence transformers
  - PyTorch
  - HuggingFace models

### KG Sync Service (services/kg-sync/)
- **Technology**: Python, FastAPI
- **Purpose**: GraphDB to Neo4j ETL pipeline
- **Functionality**:
  - RDF to graph synchronization
  - Ontology-driven transformation
  - Constraint resolution

---

## 3. TECHNOLOGY STACK SUMMARY

### Frontend
| Layer | Technology | Version |
|-------|-----------|---------|
| Web | Next.js | 15.4.7 |
| | React | 19.0.0 |
| | TypeScript | 5.x |
| Mobile | React Native | 0.76.1 |
| | Expo | 52.0.0 |
| Styling | Tailwind CSS | 4.0.0 |
| State | TanStack Query | 5.x |
| | Zustand (mobile) | 5.0.2 |
| UI Components | Headless UI | 2.2.9 |
| | Lucide React | 0.292.0 |
| | Framer Motion | 10.16.0 |

### Backend
| Layer | Technology | Version |
|-------|-----------|---------|
| API | FastAPI | 0.115.0 (main), 0.121.1 (agents) |
| Framework | Uvicorn | 0.32.0, 0.38.0 |
| Language | Python | 3.11+, 3.12+ |
| Validation | Pydantic | 2.9.0, 2.12.4 |
| ORM | SQLAlchemy | 2.0.36 |
| ML/AI | Transformers | 4.57.1 |
| | Sentence Transformers | 3.0.1 |
| | PyTorch | via transformers |
| gRPC | Tonic (Rust) | 0.11 |
| Async | Tokio (Rust) | 1.35 |
| Task Queue | Celery | 5.3.6 |
| Authorization | python-jose | 3.5.0 |
| Password Hash | bcrypt | via passlib 1.7.4 |

### Databases
| Database | Type | Version | Port |
|----------|------|---------|------|
| PostgreSQL | RDBMS | 15+ | 5432 |
| pgvector | Vector DB | 0.2.4 (Python) | 5432 |
| Neo4j | Graph | 5.15.0 | 7474, 7687 |
| GraphDB | RDF Triple Store | 10.5.1 | 7200 |
| Qdrant | Vector DB | 1.15.0 | 6333, 6334 |
| Redis | Cache/Queue | 7-alpine | 6379 |

### Infrastructure & Deployment
| Component | Technology | Version |
|-----------|-----------|---------|
| Container | Docker | latest |
| Orchestration | Kubernetes/GCP GKE | - |
| IaC | Terraform | 1.5.0+ |
| CI/CD | GitHub Actions | - |
| Build System | Turborepo | 1.11.0 |
| Package Manager | pnpm | 8.12.0 |
| Node Runtime | Node.js | 18+ |

### AI/ML Services
| Service | Technology | Details |
|---------|-----------|---------|
| LLM | vLLM | OpenAI-compatible API |
| Model | Llama (local), Maverick (prod) | 3B-375B parameters |
| Embeddings | Sentence Transformers | Pre-trained models |
| Vector Search | Qdrant + Neo4j | Dual-graph architecture |
| Knowledge Graph | Neo4j + GraphDB | Semantic reasoning |
| Observability | Prometheus/OpenTelemetry | Distributed tracing |

---

## 4. DIRECTORY STRUCTURE

```
life-navigator-monorepo/
├── apps/
│   ├── web/                        # Next.js 15 frontend
│   │   ├── src/
│   │   ├── public/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── Dockerfile
│   │   └── next.config.js
│   │
│   └── mobile/                     # React Native (Expo)
│       ├── src/
│       ├── package.json
│       └── app.json (Expo config)
│
├── backend/                        # NEW FastAPI backend (25K+ lines)
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── endpoints/
│   │   │   │   │   ├── auth.py     # JWT, registration, MFA
│   │   │   │   │   ├── users.py    # User management
│   │   │   │   │   ├── finance.py  # Financial endpoints
│   │   │   │   │   ├── health.py   # Health tracking
│   │   │   │   │   ├── career.py   # Career management
│   │   │   │   │   ├── education.py# Education
│   │   │   │   │   ├── goals.py    # Goal management
│   │   │   │   │   ├── graphrag.py # Knowledge queries
│   │   │   │   │   └── agents.py   # Agent integration
│   │   │   │   └── router.py
│   │   │   ├── deps.py             # Dependency injection
│   │   │   └── __init__.py
│   │   │
│   │   ├── core/
│   │   │   ├── config.py           # Settings/env vars
│   │   │   ├── security.py         # JWT, password hashing
│   │   │   ├── database.py         # DB connection
│   │   │   ├── logging.py          # Structured logging
│   │   │   └── __init__.py
│   │   │
│   │   ├── models/                 # SQLAlchemy ORM (43 tables)
│   │   │   ├── user.py             # User, Tenant, Org
│   │   │   ├── finance.py          # Financial models
│   │   │   ├── health.py           # Health models
│   │   │   ├── career.py           # Career models
│   │   │   ├── education.py        # Education models
│   │   │   ├── goals.py            # Goal models
│   │   │   ├── relationships.py    # Contact models
│   │   │   ├── mixins.py           # Base model mixins
│   │   │   └── __init__.py
│   │   │
│   │   ├── schemas/                # Pydantic validation
│   │   │   ├── auth.py
│   │   │   ├── user.py
│   │   │   ├── finance.py
│   │   │   └── ...
│   │   │
│   │   ├── clients/                # External service clients
│   │   │   ├── graphrag.py         # GraphRAG gRPC
│   │   │   ├── neo4j.py            # Neo4j queries
│   │   │   └── ...
│   │   │
│   │   ├── db/
│   │   │   └── migrations/         # SQL migration scripts
│   │   │
│   │   ├── main.py                 # FastAPI app initialization
│   │   └── __init__.py
│   │
│   ├── alembic/                    # Database migrations
│   │   ├── versions/
│   │   ├── alembic.ini
│   │   └── env.py
│   │
│   ├── pyproject.toml              # Poetry dependencies
│   ├── poetry.lock
│   ├── Dockerfile                  # Multi-stage build
│   ├── pytest.ini                  # Testing config
│   └── tests/                      # Unit/integration tests
│
├── services/
│   ├── api/                        # Legacy API (migrating)
│   │   ├── app/
│   │   ├── pyproject.toml
│   │   └── Dockerfile
│   │
│   ├── agents/                     # Multi-agent system
│   │   ├── app/
│   │   │   └── mcp-server/         # MCP Server
│   │   │       ├── core/
│   │   │       │   ├── server.py   # FastAPI server
│   │   │       │   └── config.py
│   │   │       ├── agents/         # Agent implementations
│   │   │       ├── plugins/        # GraphRAG, memory
│   │   │       └── tools/          # Available tools
│   │   │
│   │   ├── pyproject.toml
│   │   ├── Dockerfile
│   │   ├── Dockerfile.test
│   │   └── tests/
│   │
│   ├── graphrag-rs/                # Rust gRPC service
│   │   ├── src/
│   │   ├── Cargo.toml
│   │   ├── Dockerfile
│   │   └── proto/
│   │
│   ├── embeddings/                 # Embedding service
│   │   ├── app/
│   │   ├── pyproject.toml
│   │   └── Dockerfile
│   │
│   ├── finance-api/                # Finance microservice
│   │   ├── app/
│   │   │   ├── main.py
│   │   │   ├── ocr/                # Triple-engine OCR
│   │   │   ├── plaid/              # Banking integration
│   │   │   └── models/
│   │   │
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── OCR_SETUP.md
│   │
│   ├── kg-sync/                    # GraphDB to Neo4j sync
│   │   ├── app/
│   │   ├── pyproject.toml
│   │   └── Dockerfile
│   │
│   └── qdrant/
│       └── Dockerfile
│
├── packages/                       # Shared libraries
│   ├── ui-components/              # React/RN components
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── api-client/                 # TypeScript API client
│   │   ├── src/
│   │   └── package.json
│   │
│   ├── ontology-sdk/               # RDF/Turtle SDK
│   │   └── package.json
│   │
│   ├── provenance/                 # Provenance tracking
│   │   └── package.json
│   │
│   └── messaging/                  # Event bus
│       └── package.json
│
├── terraform/                      # Infrastructure as Code
│   ├── gcp/                        # GCP-specific
│   │   └── modules/
│   │       ├── networking/
│   │       ├── gke/
│   │       ├── cloud-sql/
│   │       ├── neo4j/
│   │       └── ...
│   │
│   ├── backend/                    # Terraform backend config
│   │   ├── main.tf
│   │   ├── outputs.tf
│   │   └── variables.tf
│   │
│   ├── modules/                    # Reusable modules
│   │   ├── database/
│   │   ├── monitoring/
│   │   ├── security/
│   │   └── ...
│   │
│   └── environments/               # Environment configs
│       ├── dev/
│       ├── staging/
│       └── production/
│
├── k8s/                            # Kubernetes manifests
│   ├── base/                       # Base resources
│   │   ├── backend-deployment.yaml
│   │   ├── agents-deployment.yaml
│   │   └── ...
│   │
│   ├── shared/                     # Shared resources
│   │   ├── ingress.yaml
│   │   ├── external-secrets.yaml
│   │   └── ...
│   │
│   └── overlays/                   # Kustomize overlays
│       ├── dev/
│       ├── staging/
│       └── production/
│
├── ontology/                       # RDF/OWL semantic models
│   ├── core/                       # Core concepts
│   ├── finance/                    # Finance domain
│   ├── health/                     # Health domain
│   ├── career/                     # Career domain
│   ├── education/                  # Education domain
│   ├── goals/                      # Goals domain
│   ├── relationships/              # Relationships domain
│   └── shacl/                      # SHACL validation shapes
│
├── migrations/                     # Database migrations
│   ├── postgres/                   # PostgreSQL migrations
│   ├── neo4j/                      # Neo4j migrations
│   └── graphdb/                    # GraphDB migrations
│
├── scripts/                        # Operational scripts
│   ├── dev/
│   │   ├── local-dev.sh            # Start local environment
│   │   ├── setup-web.sh
│   │   ├── start-backend.sh
│   │   └── ...
│   │
│   ├── deploy/
│   │   ├── deploy-web.sh
│   │   ├── setup-gcp.sh
│   │   └── ...
│   │
│   ├── db/
│   │   ├── init-graphdb.sh
│   │   ├── postgres-setup.sh
│   │   └── ...
│   │
│   └── utils/
│       ├── codegen.sh
│       ├── generate-env.sh
│       └── ...
│
├── docs/                           # Documentation
│   ├── architecture/               # System design
│   ├── deployment/                 # Deploy guides
│   ├── compliance/                 # HIPAA/security
│   ├── web/                        # Web app docs
│   │   ├── auth-system.md
│   │   └── auth-implementation.md
│   ├── api/                        # API reference
│   └── guides/
│       └── oauth-setup.md
│
├── .github/workflows/              # CI/CD pipelines
│   ├── ci.yml                      # Main CI
│   ├── backend.yml                 # Backend testing
│   ├── graphrag.yml                # Rust service
│   ├── pr-checks.yml               # PR checks
│   ├── mobile.yml                  # React Native
│   └── vercel-deploy.yml           # Vercel deployment
│
├── docker-compose.yml              # Local dev (all services)
├── docker-compose.test.yml         # Test environment
├── turbo.json                      # Turborepo config
├── package.json                    # Root package.json
├── pnpm-workspace.yaml             # pnpm workspaces
├── tsconfig.json                   # TypeScript config
├── .eslintrc.js                    # ESLint config
├── .env.example                    # Environment template
└── README.md                       # This file
```

---

## 5. DOCKER CONTAINERS & COMPOSE

### docker-compose.yml Services (8 containers)

```yaml
Services:
1. postgres:pgvector:pg15        - PostgreSQL 15 with pgvector
   - Port: 5432
   - User: lifenavigator
   - DB: lifenavigator_dev
   - Health checks: pg_isready

2. redis:7-alpine                - Redis cache and queue
   - Port: 6379
   - Persistent volume

3. neo4j:5.15.0-enterprise       - Knowledge graph database
   - Ports: 7474 (HTTP), 7687 (Bolt)
   - Auth: neo4j/devpassword
   - Memory: 2G heap, 1G page cache
   - Plugins: APOC, Graph Data Science, n10s

4. qdrant:1.15.0 (custom)        - Vector database
   - Ports: 6333 (HTTP), 6334 (gRPC)
   - Built from: ./services/qdrant/Dockerfile
   - Persistent storage

5. graphdb:10.5.1 (Ontotext)     - RDF triple store
   - Port: 7200
   - Heap: 2GB
   - Volumes: ./ontology mounted RO

6. graphrag (Rust)               - gRPC GraphRAG service
   - Port: 50051 (gRPC)
   - Built from: ./services/graphrag-rs
   - Depends on: neo4j, qdrant, graphdb

7. backend (FastAPI)             - Main API
   - Port: 8000
   - Built from: ./backend
   - Connects to: postgres, redis, graphrag

8. finance-api (FastAPI)         - Finance microservice
   - Port: 8001
   - OCR engines: Tesseract, PaddleOCR
   - Plaid integration

9. agents (FastAPI + MCP)        - Multi-agent system
   - Port: 8080 (Agents), 8090 (MCP)
   - Built from: ./services/agents

Network: ln-network (bridge driver)
Volumes: postgres_data, redis_data, neo4j_data, qdrant_data, graphdb_data
```

### Dockerfile Patterns

All services use **multi-stage builds** for production:

```dockerfile
Stage 1: Builder
- Install build dependencies
- Install Poetry/pip packages
- Compile/cache dependencies

Stage 2: Runtime
- Minimal base image (python:3.12-slim)
- Copy only production dependencies
- Create non-root user
- Set resource limits
- Health checks
- Expose ports
```

---

## 6. CI/CD CONFIGURATION

### GitHub Actions Workflows (.github/workflows/)

#### 1. ci.yml (Main CI Pipeline)
- **Triggers**: Push to main/develop, PRs
- **Jobs**:
  - **lint**: ESLint, Ruff (Python), code style
    - Setup: Node 20, pnpm 8, Python 3.12, Poetry
    - Cache: pnpm store, Python deps
  - **typecheck**: TypeScript & MyPy strict mode
    - Python mypy with --strict flag
    - TS type-check
  - **test**: Run test suites
    - Backend: pytest with coverage
    - Frontend: Jest tests
    - Services: Service-specific tests
  - **build**: Build all packages
    - Turborepo with cache
    - Docker image builds
- **Duration**: ~30-40 minutes

#### 2. backend.yml
- FastAPI backend CI/CD
- Database migration testing
- Pytest coverage reporting
- Docker image build and push

#### 3. pr-checks.yml
- Fast PR feedback
- Lint and typecheck only
- Quick turnaround (~5 mins)

#### 4. graphrag.yml
- Rust service testing
- Cargo build and tests
- Performance checks

#### 5. mobile.yml
- React Native testing
- Expo build validation
- iOS/Android checks

#### 6. vercel-deploy.yml
- Next.js web app deployment
- Automatic to Vercel on main

---

## 7. AUTHENTICATION MECHANISMS

### JWT-Based Authentication

#### Flow
1. **Registration/Login**
   - User submits credentials
   - Password verified with bcrypt
   - JWT access token created (8-hour expiry)
   - Refresh token created (7-day expiry)
   - Tokens in HTTP-only, Secure cookies

2. **Request Authentication**
   - Middleware validates JWT from Authorization header
   - Token claims extracted and verified
   - User attached to request context

3. **Token Refresh**
   - Refresh token sent to `/api/v1/auth/refresh`
   - New access token returned
   - Refresh token rotated

#### Security Features
- **Password Security**:
  - BCrypt hashing with salt
  - Strong password policy (12+ chars, mixed types)
  - Password reset tokens (24-hour expiry)

- **Multi-Factor Authentication (MFA)**:
  - TOTP (Time-based OTP) implementation
  - Recovery codes for account access
  - QR code generation

- **Token Security**:
  - Cryptographically signed JWTs
  - HS256 algorithm
  - Token type validation
  - Expiration checks

- **Account Security**:
  - Account lockout after 5 failed attempts
  - Email verification tokens (7-day)
  - Session activity monitoring
  - CSRF protection with double-submit cookies

- **Authorization**:
  - Role-Based Access Control (RBAC)
  - UserTenantRole enum: OWNER, ADMIN, MEMBER, VIEWER
  - Permission-based checks
  - Multi-tenant isolation (RLS via database constraints)

#### Endpoints
- `POST /api/v1/auth/register` - New user registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Token refresh
- `POST /api/v1/auth/logout` - Session termination
- `POST /api/v1/auth/mfa/setup` - MFA setup
- `POST /api/v1/auth/mfa/verify` - MFA verification
- `POST /api/v1/auth/password-reset` - Reset request
- `POST /api/v1/auth/verify-email` - Email verification

---

## 8. INFRASTRUCTURE & DEPLOYMENT

### Terraform Configuration

**Structure**:
```
terraform/
├── backend/             # S3 state backend
├── modules/             # Reusable modules
│   ├── database/        # PostgreSQL, Neo4j
│   ├── networking/      # VPC, subnets
│   ├── monitoring/      # Prometheus, Grafana
│   ├── security/        # Secrets, encryption
│   └── ...
└── environments/        # Environment configs
    ├── dev/
    ├── staging/
    └── production/
```

**Providers**:
- AWS (5.0+)
- GCP (for GKE)
- Terraform 1.5.0+

**Key Resources**:
- GCP GKE cluster (Kubernetes)
- Cloud SQL PostgreSQL instances
- Neo4j managed database
- VPC with private/public subnets
- Cloud NAT, Load Balancers
- CloudSQL Proxy
- Secret Manager
- Cloud Storage buckets
- Monitoring and logging

### Kubernetes Deployment

**Manifests**:
- Base resources: Deployments, Services, ConfigMaps
- Kustomize overlays for dev/staging/prod
- External Secrets for credential management
- Ingress for routing
- PersistentVolumes for databases

**Services**:
- Backend API
- GraphRAG gRPC
- Agents service
- Finance API
- Embeddings service
- Databases (via Cloud SQL proxy)

---

## 9. DATABASE CONNECTIONS

### PostgreSQL (Primary RDBMS)
```
Host: postgres (docker) or Cloud SQL
Port: 5432
User: lifenavigator
DB: lifenavigator_dev
Extensions: pgvector, uuid-ossp
Connection String: postgresql+asyncpg://user:pass@host:5432/db
```

**ORM**: SQLAlchemy 2.0 async with asyncpg
**Migrations**: Alembic

**Tables** (43 total):
- Core: users, organizations, tenants, user_tenants, audit_logs
- Finance: financial_accounts, transactions, budgets, investments
- Health: health_conditions, medications, health_metrics
- Career: career_profiles, job_applications, interviews
- Education: education_credentials, courses
- Goals: goals, milestones
- Relationships: contacts, contact_interactions

### Neo4j (Knowledge Graph)
```
Host: neo4j (docker) or enterprise instance
Port: 7474 (HTTP), 7687 (Bolt)
Auth: neo4j / devpassword
Protocol: bolt://neo4j:7687
```

**Driver**: neo4j-python-driver or neo4rs (Rust)

**Graph Structure**:
- Person nodes (users)
- Goal nodes (goals and milestones)
- Career nodes (jobs, interviews)
- Health nodes (conditions, medications)
- Finance nodes (accounts, budgets)
- Education nodes (courses, credentials)
- Relationships: WORKS_AT, HAS_GOAL, TAKES_COURSE, etc.

### GraphDB (RDF/SPARQL)
```
Host: graphdb (docker)
Port: 7200
Protocol: http://graphdb:7200
Repository: life-navigator
Auth: Basic (admin/devpassword)
```

**Query Language**: SPARQL (W3C standard)

**Ontologies**:
- Core concepts (Activity, Entity, Event)
- Domain-specific (Finance, Health, Career, Education)
- SHACL validation shapes

### Qdrant (Vector Database)
```
HTTP: http://qdrant:6333
gRPC: qdrant:6334
```

**Collections**:
- user_embeddings
- document_embeddings
- knowledge_embeddings

---

## 10. EXTERNAL API INTEGRATIONS

### AI/ML Services
- **Anthropic**: Claude API (REQUIRED)
  - Model: claude-3-5-sonnet-20241022
  - Key: ANTHROPIC_API_KEY
  
- **OpenAI**: GPT models (optional)
  - Key: OPENAI_API_KEY
  
- **Google Vertex AI**: Gemini/Palm models
  - Project: VERTEX_AI_PROJECT
  - Location: VERTEX_AI_LOCATION

### Financial Services
- **Plaid**: Banking data aggregation
  - Credentials: PLAID_CLIENT_ID, PLAID_SECRET
  - Environment: sandbox/production
  
- **Alpha Vantage**: Stock data
  - Key: ALPHA_VANTAGE_API_KEY
  
- **Stripe**: Payment processing
  - Key: STRIPE_SECRET_KEY

### Other Integrations
- **Twilio**: SMS notifications
- **SendGrid**: Email notifications
- **Google Cloud Storage**: Document storage
- **Sentry**: Error tracking

---

## 11. KEY SECURITY FEATURES

### Authentication & Authorization
- JWT tokens (HS256)
- Bcrypt password hashing
- Multi-factor authentication (TOTP)
- Role-based access control (RBAC)
- Multi-tenant isolation
- Account lockout mechanism
- Email verification

### Data Security
- Field-level encryption for PHI
- Encryption at rest
- HTTPS/TLS encryption in transit
- Secure cookies (HttpOnly, Secure, SameSite)
- Column-level encryption for sensitive data

### Infrastructure
- CORS configuration (allowlist origins)
- Rate limiting
- Request validation with Pydantic
- CSRF protection
- SQL injection prevention (parameterized queries)

### Compliance
- HIPAA-ready (multi-tenant, audit logging)
- Comprehensive audit logging
- Activity monitoring
- Session hijacking detection
- Data retention policies

---

## 12. DEPLOYMENT CHECKLIST

### Local Development
- Docker Compose (all 8 services)
- Hot reload enabled
- Debug logging
- Pre-commit hooks
- Poetry/pnpm package managers

### Staging
- GCP GKE cluster
- Cloud SQL PostgreSQL
- Cloud Storage for documents
- Resource quotas set
- Monitoring enabled

### Production
- High availability (3 AZs)
- Database backups (automated)
- Auto-scaling (HPA)
- CDN for static assets
- WAF for API protection
- VPC Service Controls
- Secrets Manager for credentials

---

## Summary Statistics

**Codebase Size**:
- Backend: 25,000+ lines
- Services: 15,000+ lines
- Frontend: 10,000+ lines
- Tests: 5,000+ lines
- **Total**: 55,000+ lines of code

**Database**:
- 43 ORM models
- 52+ API endpoints
- 6 database systems

**Services**:
- 2 frontend apps
- 7 backend services
- 5 shared packages

**Infrastructure**:
- Docker: 8+ containerized services
- Kubernetes: Multi-environment configs
- Terraform: Multi-cloud IaC
- CI/CD: 6 automated workflows

**Technology Stack**:
- 40+ npm/Python packages
- 8+ databases/caches
- 5+ external APIs
- 2 major languages (TS/Python + 1 Rust)
