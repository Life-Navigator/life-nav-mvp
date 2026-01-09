# LifeNavigator Deployment Map

**Status:** Production Hardening - Release Gate Enforced
**Last Updated:** 2026-01-09
**Owner:** Platform Engineering

---

## Purpose

This document establishes **explicit, enforceable deployment boundaries** for all services in the LifeNavigator monorepo. Every deployable target, communication path, and access restriction is documented to prevent misuse and ensure compliance.

---

## Deployment Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│ PUBLIC INTERNET                                                            │
└───────┬────────────────────────────────────────────────────────────────────┘
        │
        │ HTTPS
        │
        ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ Cloud Load Balancer (GCP)                                                  │
│ - SSL/TLS termination                                                      │
│ - DDoS protection                                                          │
│ - WAF rules                                                                │
└───────┬──────────────────────────────────┬─────────────────────────────────┘
        │                                  │
        │ /web/*                           │ /api/*
        │                                  │
        ▼                                  ▼
┌───────────────────────────┐     ┌───────────────────────────────────────────┐
│ FRONTEND (PUBLIC)         │     │ BACKEND API GATEWAY (PUBLIC)              │
│                           │     │                                           │
│ apps/web                  │     │ backend/                                  │
│ Platform: Cloud Run       │     │ Platform: Cloud Run                       │
│ Framework: Next.js 16     │     │ Framework: FastAPI                        │
│ Runtime: Node.js 20       │     │ Runtime: Python 3.12                      │
│ Port: 3000                │     │ Port: 8000                                │
│                           │     │                                           │
│ Deployment:               │     │ Deployment:                               │
│ - Cloud Run (main-web)    │     │ - Cloud Run (main-backend)                │
│ - Vercel DISABLED         │     │ - K8s fallback available                  │
│   (HIPAA compliance)      │     │                                           │
│                           │     │ API Routes:                               │
│ Serves:                   │     │ - /api/v1/* (all endpoints)               │
│ - SSR pages               │     │ - /health                                 │
│ - API routes (/api/*)     │     │ - /docs (Swagger)                         │
│ - Static assets           │     │ - /metrics (Prometheus)                   │
└─────────┬─────────────────┘     └─────────┬─────────────────────────────────┘
          │                                 │
          │ Internal calls                  │ Internal S2S JWT
          │ (server-side only)              │
          └─────────────────────────────────┘
                                            │
        ┌───────────────────────────────────┼───────────────────────────────┐
        │                                   │                               │
        │                                   │                               │
        ▼                                   ▼                               ▼
┌───────────────────┐           ┌───────────────────┐         ┌──────────────────┐
│ INTERNAL SERVICES │           │ INTERNAL SERVICES │         │ INTERNAL SERVICES│
│ (PRIVATE)         │           │ (PRIVATE)         │         │ (PRIVATE)        │
│                   │           │                   │         │                  │
│ services/         │           │ services/         │         │ services/        │
│ risk-engine       │           │ market-data       │         │ agents           │
│                   │           │                   │         │                  │
│ Platform: K8s     │           │ Platform: K8s     │         │ Platform: K8s/   │
│ Framework: Python │           │ Framework: FastAPI│         │   Cloud Run      │
│ Port: 8001        │           │ Port: 8002        │         │ Port: 8003       │
│                   │           │                   │         │                  │
│ Access:           │           │ Access:           │         │ Access:          │
│ - Backend only    │           │ - Backend only    │         │ - Backend only   │
│ - S2S JWT         │           │ - S2S JWT         │         │ - S2S JWT        │
│ - NetworkPolicy   │           │ - NetworkPolicy   │         │ - Private        │
│   enforced        │           │   enforced        │         │                  │
└───────────────────┘           └───────────────────┘         └──────────────────┘
        │                               │                             │
        │                               │                             │
        ▼                               ▼                             ▼
┌────────────────────────────────────────────────────────────────────────────┐
│ DATA LAYER (PRIVATE)                                                       │
│                                                                            │
│ - Supabase (PostgreSQL)      - Managed, HIPAA-compliant                  │
│ - Redis (Cache/Queue)        - Elasticache, private subnet               │
│ - Cloud Storage (GCS)        - Market snapshots, documents               │
│ - Qdrant (Vector DB)         - Private K8s, embeddings only              │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Targets

### 1. **apps/web** - Next.js Frontend (PUBLIC)

**Deployment Platform:** GCP Cloud Run
**Deployment Name:** `main-web` (production), `beta-web` (staging)
**Access:** Public internet
**Runtime:** Node.js 20
**Framework:** Next.js 16.1.1

**Build Command:**
```bash
pnpm --filter @life-navigator/web build
```

**Docker Image:**
- **File:** `apps/web/Dockerfile`
- **Registry:** `us-central1-docker.pkg.dev/life-navigator/main-web:latest`

**Environment Variables Required:**
- `DATABASE_URL` - Supabase connection string
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `JWT_SECRET`
- `REDIS_URL`

**Exposed Ports:**
- `3000` - HTTP server

**Routes Served:**
- `/` - Homepage
- `/dashboard/*` - User dashboard (authenticated)
- `/api/*` - Next.js API routes (server-side only)
- `/scenario-lab/*` - Scenario analysis pages

**Security:**
- Session auth via Supabase
- Row-level security (RLS) enforced
- CSRF protection enabled
- Rate limiting via Redis

**CI/CD:**
- Workflow: `.github/workflows/web-frontend.yml`
- Triggers: Push to `main`, PR to `main`
- Gates: lint, typecheck, test, build

---

### 2. **backend/** - FastAPI Main Backend (PUBLIC)

**Deployment Platform:** GCP Cloud Run
**Deployment Name:** `main-backend` (production), `beta-backend` (staging)
**Access:** Public internet via `/api/*`
**Runtime:** Python 3.12
**Framework:** FastAPI

**Build Command:**
```bash
cd backend && poetry install --no-dev
```

**Docker Image:**
- **File:** `backend/Dockerfile`
- **Registry:** `us-central1-docker.pkg.dev/life-navigator/main-backend:latest`

**Environment Variables Required:**
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `SENTRY_DSN`
- `MARKET_DATA_SERVICE_URL` (internal)
- `RISK_ENGINE_SERVICE_URL` (internal)

**Exposed Ports:**
- `8000` - HTTP server
- `9090` - Prometheus metrics (internal only)

**API Routes:**
- `/api/v1/*` - All REST endpoints
- `/health` - Health check
- `/readyz` - Readiness probe
- `/docs` - Swagger UI (disabled in production)
- `/metrics` - Prometheus metrics

**Security:**
- JWT authentication (Supabase)
- Rate limiting (Redis-backed)
- CORS configured for web domain only
- Service-to-service JWT for internal calls

**CI/CD:**
- Workflow: `.github/workflows/backend.yml`, `.github/workflows/backend-cloudrun.yml`
- Triggers: Push to `main`, PR to `main`
- Gates: lint (ruff), test (pytest), mypy, security scan

---

### 3. **services/risk-engine** - Monte Carlo Risk Engine (PRIVATE)

**Deployment Platform:** Kubernetes (GKE)
**Deployment Name:** `risk-engine`
**Access:** Internal only - Backend via S2S JWT
**Runtime:** Python 3.12
**Framework:** FastAPI

**Build Command:**
```bash
cd services/risk-engine && poetry build
```

**Docker Image:**
- **File:** `services/risk-engine/Dockerfile`
- **Registry:** `us-central1-docker.pkg.dev/life-navigator/risk-engine:latest`

**K8s Deployment:**
- **Namespace:** `lifenav-backend`
- **Service Type:** ClusterIP (internal only)
- **Replicas:** 3 (HPA: 3-10)
- **Network Policy:** Only backend can ingress

**Environment Variables Required:**
- `JWT_SECRET` (for S2S validation)
- `REDIS_URL`
- `LOG_LEVEL`

**Exposed Ports:**
- `8001` - HTTP server (ClusterIP only)
- `9091` - Metrics

**API Routes:**
- `POST /v1/risk/snapshot` - Run simulation
- `POST /v1/risk/stream` - SSE streaming updates
- `GET /v1/risk/explain` - Explainability
- `GET /healthz`, `/readyz`

**Security:**
- **NO public access** - NetworkPolicy enforced
- S2S JWT required (`aud="risk-engine"`)
- Scoped permissions (`risk-engine:snapshot`)
- Receives NO PHI/PCI (only derived numeric features)

**CI/CD:**
- Manual deploy via kubectl or Cloud Build
- Gates: pytest, contract tests, security scan

---

### 4. **services/market-data** - Market Data Feeds (PRIVATE)

**Deployment Platform:** Kubernetes (GKE)
**Deployment Name:** `market-data`
**Access:** Internal only - Backend via S2S JWT
**Runtime:** Python 3.12
**Framework:** FastAPI

**Build Command:**
```bash
cd services/market-data && pip install -e .
```

**Docker Image:**
- **File:** `services/market-data/Dockerfile`
- **Registry:** `us-central1-docker.pkg.dev/life-navigator/market-data:latest`

**K8s Deployment:**
- **Namespace:** `lifenav-backend`
- **Service Type:** ClusterIP (internal only)
- **Replicas:** 2 (HPA: 2-4)
- **Network Policy:** Only backend can ingress
- **CronJob:** Daily 6 AM UTC snapshot build

**Environment Variables Required:**
- `JWT_SECRET`
- `GCS_BUCKET_NAME`
- `GCS_PROJECT_ID`
- `FRED_API_KEY` (optional)

**Exposed Ports:**
- `8002` - HTTP server (ClusterIP only)
- `9090` - Metrics

**API Routes:**
- `POST /v1/snapshots/build` - Trigger build (admin)
- `GET /v1/snapshots/latest` - Fetch latest
- `GET /v1/snapshots/{date}` - Historical
- `GET /healthz`, `/readyz`, `/metrics`

**Security:**
- **NO public access** - NetworkPolicy enforced
- S2S JWT required (`aud="market-data"`)
- Scoped permissions (`market:read`, `market:build`)
- Only stores derived metrics (no raw vendor payloads)

**CI/CD:**
- Manual deploy via kubectl
- Gates: pytest, schema contract tests, security scan

---

### 5. **services/agents** - AI Agent Orchestrator (PRIVATE)

**Deployment Platform:** Kubernetes (GKE) or Cloud Run
**Deployment Name:** `agent-orchestrator`
**Access:** Internal only - Backend via S2S JWT
**Runtime:** Python 3.12
**Framework:** FastAPI

**Build Command:**
```bash
cd services/agents && poetry install
```

**Docker Image:**
- **File:** `services/agents/Dockerfile`
- **Registry:** `us-central1-docker.pkg.dev/life-navigator/agent-orchestrator:latest`

**Environment Variables Required:**
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `JWT_SECRET`
- `DATABASE_URL`
- `REDIS_URL`

**Exposed Ports:**
- `8003` - HTTP server
- `9092` - Metrics

**API Routes:**
- `POST /v1/agents/run` - Execute agent
- `POST /v1/agents/stream` - Streaming responses
- `GET /v1/agents/status` - Check status

**Security:**
- S2S JWT required
- API keys in secrets
- Audit logging for all LLM calls

**CI/CD:**
- Workflow: `.github/workflows/backend.yml` (agents path)
- Gates: pytest, lint, security scan

---

### 6. **services/api** - Legacy API Gateway (DEPRECATED)

**Status:** ⚠️ **DEPRECATED** - Being migrated to `backend/`
**Deployment Platform:** None (disabled)
**Access:** N/A

**Deprecation Plan:**
- All endpoints migrated to `backend/app/api/v1/`
- This service will be removed in Q2 2026
- CI blocks new changes to this directory

**Migration Status:**
- ✅ User auth endpoints → `backend/app/api/v1/auth.py`
- ✅ Goal endpoints → `backend/app/api/v1/goals.py`
- ✅ Scenario lab → `backend/app/api/v1/scenario_lab.py`
- ⏳ Remaining: None

**Blocked in CI:**
- Linting will fail if files modified
- Import restrictions prevent usage

---

### 7. **services/graphrag-rs** - GraphRAG API (PRIVATE)

**Deployment Platform:** Kubernetes (GKE)
**Deployment Name:** `graphrag-api`
**Access:** Internal only
**Runtime:** Rust (actix-web)

**Build Command:**
```bash
cd services/graphrag-rs && cargo build --release
```

**Docker Image:**
- **File:** `services/graphrag-rs/Dockerfile`
- **Registry:** `us-central1-docker.pkg.dev/life-navigator/graphrag-api:latest`

**Environment Variables Required:**
- `DATABASE_URL`
- `JWT_SECRET`

**Exposed Ports:**
- `8004` - HTTP server

**API Routes:**
- `POST /query` - GraphRAG query
- `GET /health`

**Security:**
- S2S JWT required
- Read-only database access

**CI/CD:**
- Workflow: `.github/workflows/graphrag.yml`
- Gates: cargo test, cargo clippy, security audit

---

### 8. **services/finance-api** - Finance Data API (PRIVATE)

**Deployment Platform:** Kubernetes (GKE)
**Deployment Name:** `finance-api`
**Access:** Internal only
**Runtime:** Python 3.12

**Build Command:**
```bash
cd services/finance-api && poetry install
```

**Docker Image:**
- **File:** `services/finance-api/Dockerfile`

**Environment Variables Required:**
- `PLAID_CLIENT_ID`
- `PLAID_SECRET`
- `DATABASE_URL`

**Exposed Ports:**
- `8005` - HTTP server

**Security:**
- S2S JWT required
- PCI-compliant (no card data stored)
- Plaid Link for bank connections

---

### 9. **apps/mobile** - React Native Mobile App (PUBLIC)

**Deployment Platform:** Expo / App Stores
**Access:** Public (iOS App Store, Google Play)
**Runtime:** React Native 0.76.1
**Framework:** Expo

**Build Command:**
```bash
cd apps/mobile && pnpm build
```

**Environment Variables Required:**
- `EXPO_PUBLIC_API_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

**Deployment:**
- iOS: App Store Connect
- Android: Google Play Console
- EAS Build for CI/CD

**Security:**
- Secure storage for tokens
- Certificate pinning for API calls
- Biometric authentication

**CI/CD:**
- Workflow: `.github/workflows/mobile.yml`
- Gates: lint, typecheck, jest tests

---

### 10. **Cloudflare Workers** (EDGE)

**Location:** `terraform/cloudflare/workers/`

#### a) **supabase-proxy** (EDGE - PUBLIC)
- **Purpose:** Edge caching for Supabase queries
- **Access:** Public
- **Runtime:** Cloudflare Workers
- **Deploy:** `wrangler deploy`

#### b) **image-optimizer** (EDGE - PUBLIC)
- **Purpose:** Image optimization and CDN
- **Access:** Public
- **Runtime:** Cloudflare Workers
- **Deploy:** `wrangler deploy`

**Security:**
- Rate limiting at edge
- WAF rules enforced
- Origin validation

---

## Service-to-Service Communication Matrix

| Caller | Target | Protocol | Auth Method | Network |
|--------|--------|----------|-------------|---------|
| Web (apps/web) | Backend (backend/) | HTTPS | Supabase JWT | Public |
| Web (apps/web) | Supabase | HTTPS | RLS + JWT | Public |
| Backend | Risk Engine | HTTP | S2S JWT | Private (K8s) |
| Backend | Market Data | HTTP | S2S JWT | Private (K8s) |
| Backend | Agents | HTTP | S2S JWT | Private |
| Backend | GraphRAG | HTTP | S2S JWT | Private (K8s) |
| Backend | Finance API | HTTP | S2S JWT | Private (K8s) |
| Backend | Supabase | HTTPS | Service Key | Public |
| Risk Engine | Redis | TCP | Password | Private |
| Market Data | GCS | HTTPS | IAM | Private |
| Market Data | FRED API | HTTPS | API Key | Public |
| Market Data | Yahoo Finance | HTTPS | None (free) | Public |
| Mobile (apps/mobile) | Backend | HTTPS | Supabase JWT | Public |
| **BLOCKED** | Web → Risk Engine | N/A | N/A | **Forbidden** |
| **BLOCKED** | Web → Market Data | N/A | N/A | **Forbidden** |
| **BLOCKED** | Mobile → Risk Engine | N/A | N/A | **Forbidden** |

---

## Public vs Private Services

### Public Services (Internet-Accessible)

1. **apps/web** - Frontend (Cloud Run)
2. **backend/** - API Gateway (Cloud Run)
3. **apps/mobile** - Mobile app (App Stores)
4. **Cloudflare Workers** - Edge functions

**Access Control:**
- User authentication (Supabase JWT)
- Rate limiting (Redis-backed)
- CORS restrictions
- DDoS protection (Cloud Load Balancer)

### Private Services (Internal Only)

1. **services/risk-engine** - K8s ClusterIP
2. **services/market-data** - K8s ClusterIP
3. **services/agents** - K8s ClusterIP
4. **services/graphrag-rs** - K8s ClusterIP
5. **services/finance-api** - K8s ClusterIP
6. **services/qdrant** - K8s ClusterIP

**Access Control:**
- Kubernetes NetworkPolicy (ingress restricted)
- Service-to-service JWT validation
- No public ingress
- No external load balancer

---

## Data Flow Examples

### Example 1: User Risk Computation Request

```
1. User (Browser) → Web (apps/web)
   - Auth: Supabase session token
   - Route: POST /api/risk/compute

2. Web (Server Component) → Backend (backend/)
   - Auth: Proxied user JWT
   - Route: POST /api/v1/risk/compute

3. Backend → Market Data (services/market-data)
   - Auth: S2S JWT (aud="market-data", scope="market:read")
   - Route: GET /v1/snapshots/latest
   - Returns: MarketSnapshot

4. Backend (enriches request with market_context)

5. Backend → Risk Engine (services/risk-engine)
   - Auth: S2S JWT (aud="risk-engine", scope="risk-engine:snapshot")
   - Route: POST /v1/risk/snapshot
   - Payload: RiskRequest with market_context
   - Returns: RiskResponse

6. Backend → Web
   - Returns: RiskResponse (with metadata)

7. Web → User
   - Renders: Goal probability, recommendations
```

### Example 2: Daily Market Snapshot Build

```
1. K8s CronJob (6 AM UTC) → Market Data
   - Auth: S2S JWT (aud="market-data", scope="market:build")
   - Route: POST /v1/snapshots/build

2. Market Data → FRED API
   - Fetches: Rates, inflation, unemployment

3. Market Data → Yahoo Finance API
   - Fetches: Equity prices, VIX, bond ETFs

4. Market Data (normalizes + computes features)

5. Market Data → GCS
   - Stores: snapshots/YYYY-MM-DD/{snapshot_id}.json

6. Market Data (updates Prometheus metrics)

7. Return: Success/failure status
```

---

## Deprecated Paths and Block List

### Deprecated Services (Block in CI)

| Path | Status | Reason | Removal Date |
|------|--------|--------|--------------|
| `services/api/` | ⚠️ DEPRECATED | Migrated to `backend/` | Q2 2026 |
| `apps/web/pages/api/legacy/` | ⚠️ DEPRECATED | Use `app/api/` instead | Q1 2026 |
| `backend/app/api/v0/` | ⚠️ DEPRECATED | Upgrade to v1 | Q1 2026 |
| `services/shared/` | ⚠️ DEPRECATED | Use `packages/*` instead | Q2 2026 |

### Blocked Import Patterns

**Web App (apps/web) CANNOT import:**
- ❌ `backend/app/**` (server-only code)
- ❌ `services/**/app/**` (internal services)
- ❌ Direct database access (use API only)

**Shared Packages (packages/*) CANNOT import:**
- ❌ `apps/**` (circular dependency risk)
- ❌ `services/**` (platform-specific)
- ❌ `backend/**` (server-only)

**Services CANNOT import:**
- ❌ `apps/**` (deployment boundary violation)
- ❌ Other services directly (use service clients)

### CI Enforcement

Add to `.eslintrc.js`:
```javascript
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [
        {
          "group": ["backend/app/**"],
          "message": "Web app cannot import server-only backend code"
        },
        {
          "group": ["services/**/app/**"],
          "message": "Web app cannot import internal service code"
        },
        {
          "group": ["apps/**"],
          "message": "Shared packages cannot import app code"
        }
      ]
    }]
  }
}
```

---

## Release Gate Requirements

All deployments MUST pass these gates before production deployment:

### 1. **Linting**
```bash
pnpm lint
```
- ESLint (TypeScript/JavaScript)
- Ruff (Python)
- Clippy (Rust)

### 2. **Type Checking**
```bash
pnpm type-check
```
- TypeScript `tsc --noEmit`
- Python `mypy`

### 3. **Unit Tests**
```bash
pnpm test
```
- Jest (frontend)
- Pytest (Python services)
- Coverage >80% for new code

### 4. **Contract Tests**
```bash
pnpm test:contract
```
- API schema validation
- S2S interface contracts
- Database migration tests

### 5. **Container Security Scan**
```bash
trivy image <image>:<tag>
```
- No HIGH or CRITICAL vulns
- Scan all Docker images

### 6. **Secret Detection**
```bash
detect-secrets scan
```
- No secrets in code
- Pre-commit hook enforced

### 7. **Migration Dry-Run**
```bash
# Prisma
pnpm db:migrate --preview

# Alembic
alembic upgrade head --sql
```
- Must succeed without errors
- Rollback plan required

### 8. **Dependency Audit**
```bash
pnpm audit
poetry check
cargo audit
```
- No HIGH or CRITICAL vulns
- Update policy enforced

---

## Deployment Checklist

Before deploying to production:

- [ ] All release gates passed
- [ ] Deployment plan reviewed
- [ ] Rollback plan documented
- [ ] Database migrations tested in staging
- [ ] Secrets rotated (if needed)
- [ ] Monitoring dashboards updated
- [ ] On-call engineer notified
- [ ] Incident response plan ready

---

## Related Documentation

- [Security Quickstart](../security/SECURITY_QUICKSTART.md)
- [Risk Engine Data Boundary](../security/RISK_ENGINE_DATA_BOUNDARY.md)
- [Market Data Service](./MARKET_DATA_SERVICE.md)
- [Services Architecture](./SERVICES.md)

---

**Last Updated:** 2026-01-09
**Next Review:** Monthly
