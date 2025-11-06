# Life Navigator - Production Environment Variables Guide

This comprehensive guide documents all environment variables required to deploy Life Navigator across all services: Web App (Next.js), Backend API (FastAPI), GraphRAG Service (Rust), and supporting infrastructure.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Generating Secrets](#generating-secrets)
3. [Web App (Next.js)](#web-app-nextjs)
4. [Backend API (FastAPI)](#backend-api-fastapi)
5. [GraphRAG Service (Rust)](#graphrag-service-rust)
6. [Environment-Specific Configurations](#environment-specific-configurations)
7. [GCP Production Setup](#gcp-production-setup)
8. [Vercel Deployment](#vercel-deployment)
9. [Local Development](#local-development)

---

## Quick Start

### Required Files

Create these `.env` files in your project:

```bash
# Root directory
cp .env.example .env

# Web app
cp apps/web/env.example apps/web/.env.local

# Backend API
cp backend/.env.example backend/.env

# GraphRAG service
cp services/graphrag-rs/.env.example services/graphrag-rs/.env

# Python API service
cp services/api/.env.example services/api/.env
```

---

## Generating Secrets

### JWT Secret (minimum 32 characters)

```bash
# Option 1: OpenSSL
openssl rand -hex 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 3: Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### NextAuth Secret (minimum 32 characters)

```bash
# Generate with openssl
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Encryption Keys (exactly 32 bytes)

```bash
# For field-level encryption
openssl rand -hex 32

# For encryption salt
openssl rand -hex 16
```

### Internal API Keys

```bash
# Generate secure internal API keys
openssl rand -hex 24
```

---

## Web App (Next.js)

Location: `apps/web/.env.local`

### Core Configuration

```bash
# Environment
NODE_ENV=production                           # development | staging | production
NEXT_PUBLIC_APP_URL=https://app.lifenavigator.ai
APP_ENV=prod                                   # local | dev | staging | prod
USE_MOCK_DB=false                              # Use real database in production
```

### Database - Vercel Postgres

```bash
# Vercel Postgres (with PgBouncer)
POSTGRES_PRISMA_URL=postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=1
POSTGRES_URL_NON_POOLING=postgresql://user:pass@host:5432/db

# Legacy format (for local dev)
DATABASE_URL=postgresql://user:pass@host:5432/db
SHADOW_DATABASE_URL=postgresql://user:pass@host:5432/db_shadow
```

**GCP Cloud SQL Connection:**
```bash
# For production on GCP
POSTGRES_PRISMA_URL=postgresql://user:pass@/db?host=/cloudsql/PROJECT_ID:REGION:INSTANCE&pgbouncer=true
POSTGRES_URL_NON_POOLING=postgresql://user:pass@/db?host=/cloudsql/PROJECT_ID:REGION:INSTANCE
```

### Authentication (NextAuth.js)

```bash
# NextAuth Configuration
NEXTAUTH_URL=https://app.lifenavigator.ai
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>

# Google OAuth
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>
```

**How to get Google OAuth credentials:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to APIs & Services > Credentials
3. Create OAuth 2.0 Client ID (Web application)
4. Add authorized redirect URI: `https://app.lifenavigator.ai/api/auth/callback/google`

### Encryption & Security

```bash
# Field-level encryption keys (HIPAA compliance)
ENCRYPTION_KEY=<generate-with-openssl-rand-hex-32>
ENCRYPTION_MASTER_KEY=<generate-with-openssl-rand-hex-32>
ENCRYPTION_SALT=<generate-with-openssl-rand-hex-16>
ENABLE_FIELD_ENCRYPTION=true
```

### Financial Integrations

```bash
# Plaid - Bank account connections
PLAID_CLIENT_ID=<from-plaid-dashboard>
PLAID_CLIENT_SECRET=<from-plaid-dashboard>
PLAID_ENV=production                          # sandbox | development | production

# Coinbase - Cryptocurrency tracking
COINBASE_CLIENT_ID=<from-coinbase-developers>
COINBASE_CLIENT_SECRET=<from-coinbase-developers>
```

**Plaid Setup:**
- Sign up at [Plaid Dashboard](https://dashboard.plaid.com/)
- Create application and get API keys
- Request production access (requires verification)

### Education Integrations

```bash
# Canvas LMS
CANVAS_CLIENT_ID=<from-canvas-developer-keys>
CANVAS_CLIENT_SECRET=<from-canvas-developer-keys>

# Google Classroom
CLASSROOM_CLIENT_ID=<from-google-cloud-console>
CLASSROOM_CLIENT_SECRET=<from-google-cloud-console>
```

### Healthcare Integrations

```bash
# Epic FHIR (EHR integration)
EPIC_CLIENT_ID=<from-epic-app-orchard>
EPIC_CLIENT_SECRET=<from-epic-app-orchard>
FHIR_BASE_URL=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4
```

**Epic FHIR Setup:**
- Register at [Epic App Orchard](https://apporchard.epic.com/)
- Complete SMART on FHIR app registration
- Requires healthcare provider verification

### Career Integrations

```bash
# LinkedIn OAuth
LINKEDIN_CLIENT_ID=<from-linkedin-developers>
LINKEDIN_CLIENT_SECRET=<from-linkedin-developers>
```

### Smart Home & Automotive

```bash
# Smartcar - Vehicle data integration
SMARTCAR_CLIENT_ID=<from-smartcar-dashboard>
SMARTCAR_CLIENT_SECRET=<from-smartcar-dashboard>

# Google Home integration
GOOGLE_HOME_CLIENT_ID=<from-google-cloud-console>
GOOGLE_HOME_CLIENT_SECRET=<from-google-cloud-console>
```

### Monitoring & Observability

```bash
# Sentry - Error tracking
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>

# Honeybadger - Uptime monitoring
HONEYBADGER_API_KEY=<from-honeybadger>

# PostHog - Product analytics
POSTHOG_API_KEY=<from-posthog>
```

**Sentry Setup:**
1. Create project at [Sentry.io](https://sentry.io/)
2. Copy DSN from Project Settings > Client Keys
3. Configure release tracking in CI/CD

### Cross-Service Communication

```bash
# Internal API authentication
INTERNAL_API_KEY=<generate-with-openssl-rand-hex-24>

# Backend API connections
FINANCIAL_API_URL=https://api.lifenavigator.ai/api/v1
FINANCIAL_API_KEY=<generate-with-openssl-rand-hex-24>
HEALTH_API_URL=https://api.lifenavigator.ai/api/v1
HEALTH_API_KEY=<generate-with-openssl-rand-hex-24>
CAREER_API_URL=https://api.lifenavigator.ai/api/v1
CAREER_API_KEY=<generate-with-openssl-rand-hex-24>
EDUCATION_API_URL=https://api.lifenavigator.ai/api/v1
EDUCATION_API_KEY=<generate-with-openssl-rand-hex-24>
ANALYTICS_API_URL=https://analytics.lifenavigator.ai/api/v1
ANALYTICS_API_KEY=<generate-with-openssl-rand-hex-24>
```

### CORS Configuration

```bash
# Production CORS settings
CORS_ALLOWED_ORIGINS=https://app.lifenavigator.ai,https://admin.lifenavigator.ai
ADMIN_ALLOWED_ORIGINS=https://admin.lifenavigator.ai
INTERNAL_ALLOWED_ORIGINS=https://api.lifenavigator.ai,https://analytics.lifenavigator.ai
ADMIN_ALLOWED_IPS=<your-office-ip>,<vpn-gateway-ip>
```

### API Gateway Security

```bash
# Admin authentication
API_LOGGING=true
ADMIN_API_KEYS=<comma-separated-admin-keys>
```

### Rate Limiting

```bash
# Format: requests:window_ms
RATE_LIMIT_STANDARD=100:60000              # 100/min standard endpoints
RATE_LIMIT_PUBLIC=50:60000                 # 50/min public endpoints
RATE_LIMIT_AUTH=20:60000                   # 20/min auth (prevent brute force)
RATE_LIMIT_ADMIN=300:60000                 # 300/min admin endpoints
RATE_LIMIT_INTERNAL=500:60000              # 500/min internal services

# Sensitive operations (stricter limits)
RATE_LIMIT_REGISTER=5:1800000              # 5 per 30 min registration
RATE_LIMIT_PASSWORD_OPS=5:900000           # 5 per 15 min password/MFA
RATE_LIMIT_USER_ACCOUNT_OPS=10:3600000     # 10 per hour account ops
RATE_LIMIT_DOCUMENT_OPS=20:600000          # 20 per 10 min document ops
RATE_LIMIT_OAUTH=10:300000                 # 10 per 5 min OAuth ops
```

### AI Agent Configuration

```bash
# OpenAI (GPT models)
OPENAI_API_KEY=sk-<your-openai-api-key>

# Anthropic (Claude models)
ANTHROPIC_API_KEY=sk-ant-<your-anthropic-api-key>

# Local AI toggle
LOCAL_AI_ENABLED=false                     # Set true if using local LLM
```

### Feature Flags

```bash
# Toggle features per environment
ENABLE_DESKTOP_FEATURES=false              # Desktop app features
ENABLE_NOTIFICATIONS=true                  # Push notifications
ENABLE_MULTI_AGENT=true                    # Multi-agent system
ENABLE_ANALYTICS=true                      # Analytics tracking
ENABLE_FIELD_ENCRYPTION=true               # HIPAA field encryption
```

---

## Backend API (FastAPI)

Location: `backend/.env`

### Application Configuration

```bash
# Environment
ENVIRONMENT=production                     # development | staging | production
DEBUG=false                                # Never true in production
LOG_LEVEL=INFO                            # DEBUG | INFO | WARNING | ERROR
```

### API Server

```bash
# FastAPI/Uvicorn configuration
API_HOST=0.0.0.0
API_PORT=8000
API_WORKERS=4                              # Adjust based on CPU cores
API_RELOAD=false                           # Never true in production
```

### Database (PostgreSQL)

```bash
# PostgreSQL with asyncpg driver
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/lifenavigator_prod
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10
DATABASE_POOL_TIMEOUT=30
DATABASE_POOL_RECYCLE=3600
DATABASE_ECHO=false
```

**GCP Cloud SQL:**
```bash
# Using Cloud SQL Proxy
DATABASE_URL=postgresql+asyncpg://user:pass@/lifenavigator_prod?host=/cloudsql/PROJECT_ID:REGION:INSTANCE
```

### Redis Cache

```bash
# ElastiCache Redis (AWS) or Memorystore (GCP)
REDIS_URL=redis://redis-endpoint:6379/0
REDIS_MAX_CONNECTIONS=50
```

**GCP Memorystore:**
```bash
REDIS_URL=redis://10.0.0.3:6379/0          # Private IP from VPC
```

### Security

```bash
# JWT tokens
SECRET_KEY=<generate-with-openssl-rand-hex-32>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=30
```

### CORS

```bash
# Backend CORS configuration
CORS_ORIGINS=https://app.lifenavigator.ai,https://admin.lifenavigator.ai
CORS_CREDENTIALS=true
CORS_METHODS=GET,POST,PUT,DELETE,PATCH,OPTIONS
CORS_HEADERS=*
```

### Multi-tenancy

```bash
# Tenant isolation
DEFAULT_TENANT_ID=                         # Empty for new tenants
ENABLE_TENANT_ISOLATION=true
```

### GraphRAG Service (gRPC)

```bash
# Rust GraphRAG service connection
GRAPHRAG_URL=localhost:50051               # Or internal service DNS
GRAPHRAG_TIMEOUT=30
GRAPHRAG_MAX_RETRIES=3
```

**GCP Internal Service:**
```bash
GRAPHRAG_URL=graphrag-service.default.svc.cluster.local:50051
```

### Knowledge Graph (Neo4j)

```bash
# Neo4j Aura or self-hosted
NEO4J_URI=bolt+s://xxx.databases.neo4j.io:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=<your-neo4j-password>
NEO4J_DATABASE=neo4j
```

**GCP Compute Engine:**
```bash
NEO4J_URI=bolt://10.0.0.4:7687             # Internal IP
```

### Vector Database (Qdrant)

```bash
# Qdrant Cloud or self-hosted
QDRANT_URL=https://xxx.cloud.qdrant.io:6333
QDRANT_API_KEY=<your-qdrant-api-key>
QDRANT_COLLECTION=life_navigator_prod
```

**GCP Kubernetes:**
```bash
QDRANT_URL=http://qdrant-service.default.svc.cluster.local:6333
QDRANT_API_KEY=                            # Empty for internal service
```

### Semantic Store (GraphDB)

```bash
# GraphDB server
GRAPHDB_URL=http://graphdb-host:7200
GRAPHDB_REPOSITORY=life-navigator
GRAPHDB_USERNAME=admin
GRAPHDB_PASSWORD=<your-graphdb-password>
```

### Email (SendGrid)

```bash
# SendGrid for transactional emails
SENDGRID_API_KEY=SG.<your-sendgrid-api-key>
SENDGRID_FROM_EMAIL=noreply@lifenavigator.ai
SENDGRID_FROM_NAME=Life Navigator
```

**SendGrid Setup:**
1. Create account at [SendGrid](https://sendgrid.com/)
2. Verify domain for sender authentication
3. Generate API key with Mail Send permissions

### SMS (Twilio)

```bash
# Twilio for SMS notifications
TWILIO_ACCOUNT_SID=AC<your-twilio-account-sid>
TWILIO_AUTH_TOKEN=<your-twilio-auth-token>
TWILIO_FROM_NUMBER=+1234567890
```

### Storage

```bash
# Storage provider selection
STORAGE_PROVIDER=gcs                       # local | gcs | s3

# Google Cloud Storage
GCS_BUCKET_NAME=lifenavigator-prod-documents
GCS_PROJECT_ID=<your-gcp-project-id>

# AWS S3 (if using S3)
S3_BUCKET_NAME=lifenavigator-prod-documents
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-aws-access-key>
AWS_SECRET_ACCESS_KEY=<your-aws-secret-key>
```

### File Upload

```bash
# Upload limits
MAX_UPLOAD_SIZE=10485760                   # 10MB in bytes
ALLOWED_EXTENSIONS=jpg,jpeg,png,pdf,doc,docx
```

### Financial Integration (Plaid)

```bash
# Plaid configuration
PLAID_CLIENT_ID=<from-plaid-dashboard>
PLAID_SECRET=<from-plaid-dashboard>
PLAID_ENV=production
PLAID_PRODUCTS=auth,transactions,investments
PLAID_COUNTRY_CODES=US,CA
```

### Payments (Stripe)

```bash
# Stripe payment processing
STRIPE_API_KEY=sk_live_<your-stripe-secret-key>
STRIPE_WEBHOOK_SECRET=whsec_<your-webhook-secret>
STRIPE_PRICE_ID_BASIC=price_<basic-price-id>
STRIPE_PRICE_ID_PRO=price_<pro-price-id>
STRIPE_PRICE_ID_ENTERPRISE=price_<enterprise-price-id>
```

**Stripe Setup:**
1. Create account at [Stripe Dashboard](https://dashboard.stripe.com/)
2. Create products and pricing plans
3. Configure webhook endpoint: `https://api.lifenavigator.ai/webhooks/stripe`

### OAuth Providers

```bash
# Google OAuth
GOOGLE_CLIENT_ID=<from-google-cloud-console>
GOOGLE_CLIENT_SECRET=<from-google-cloud-console>

# Microsoft OAuth
MICROSOFT_CLIENT_ID=<from-azure-portal>
MICROSOFT_CLIENT_SECRET=<from-azure-portal>

# Apple Sign In
APPLE_CLIENT_ID=<from-apple-developer>
APPLE_CLIENT_SECRET=<from-apple-developer>
```

### Monitoring (Sentry)

```bash
# Sentry error tracking
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1              # Sample 10% of transactions
```

### OpenTelemetry

```bash
# Distributed tracing
OTEL_EXPORTER_OTLP_ENDPOINT=https://otel-collector:4317
OTEL_SERVICE_NAME=life-navigator-backend
OTEL_TRACES_ENABLED=true
OTEL_METRICS_ENABLED=true
```

**GCP Cloud Trace:**
```bash
OTEL_EXPORTER_OTLP_ENDPOINT=https://cloudtrace.googleapis.com/
```

### Background Tasks (Celery)

```bash
# Celery with Redis
CELERY_BROKER_URL=redis://redis-endpoint:6379/1
CELERY_RESULT_BACKEND=redis://redis-endpoint:6379/2
CELERY_TASK_ALWAYS_EAGER=false             # Must be false in production
```

### Rate Limiting

```bash
# API rate limits
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000
```

### Feature Flags

```bash
# Feature toggles
ENABLE_PLAID_SYNC=true
ENABLE_VECTOR_SEARCH=true
ENABLE_GRAPH_QUERIES=true
ENABLE_EMAIL_NOTIFICATIONS=true
ENABLE_SMS_NOTIFICATIONS=true
```

### HIPAA Compliance

```bash
# Compliance settings
ENABLE_AUDIT_LOGGING=true
DATA_RETENTION_DAYS=2555                   # 7 years for HIPAA
ENABLE_ENCRYPTION_AT_REST=true
REQUIRE_MFA_FOR_HEALTH_DATA=true
```

---

## GraphRAG Service (Rust)

Location: `services/graphrag-rs/.env`

### Server Configuration

```bash
# gRPC server
GRAPHRAG_SERVER__HOST=0.0.0.0
GRAPHRAG_SERVER__PORT=50051
```

### Neo4j Knowledge Graph

```bash
# Neo4j connection
GRAPHRAG_NEO4J__URI=bolt+s://xxx.databases.neo4j.io:7687
GRAPHRAG_NEO4J__USER=neo4j
GRAPHRAG_NEO4J__PASSWORD=<your-neo4j-password>
GRAPHRAG_NEO4J__DATABASE=neo4j
GRAPHRAG_NEO4J__MAX_CONNECTIONS=10
```

### Qdrant Vector Database

```bash
# Qdrant configuration
GRAPHRAG_QDRANT__URL=https://xxx.cloud.qdrant.io:6333
GRAPHRAG_QDRANT__API_KEY=<your-qdrant-api-key>
GRAPHRAG_QDRANT__COLLECTION_NAME=life_navigator
GRAPHRAG_QDRANT__VECTOR_SIZE=384
```

### GraphDB Semantic Ontology

```bash
# GraphDB SPARQL endpoint
GRAPHRAG_GRAPHDB__URL=http://graphdb-host:7200
GRAPHRAG_GRAPHDB__REPOSITORY=life-navigator
GRAPHRAG_GRAPHDB__USERNAME=admin
GRAPHRAG_GRAPHDB__PASSWORD=<your-graphdb-password>
```

### Embeddings Service

```bash
# Maverick embeddings service
GRAPHRAG_EMBEDDINGS__SERVICE_URL=http://maverick-service:8090
GRAPHRAG_EMBEDDINGS__MODEL=all-MiniLM-L6-v2
GRAPHRAG_EMBEDDINGS__DIMENSION=384
```

**GCP Vertex AI Embeddings (alternative):**
```bash
GRAPHRAG_EMBEDDINGS__SERVICE_URL=https://us-central1-aiplatform.googleapis.com
GRAPHRAG_EMBEDDINGS__MODEL=textembedding-gecko@003
GRAPHRAG_EMBEDDINGS__DIMENSION=768
```

### RAG Configuration

```bash
# Retrieval settings
GRAPHRAG_RAG__MAX_RESULTS=10
GRAPHRAG_RAG__MIN_SIMILARITY_SCORE=0.5
GRAPHRAG_RAG__SEMANTIC_WEIGHT=0.6
GRAPHRAG_RAG__VECTOR_WEIGHT=0.4
```

---

## Environment-Specific Configurations

### Development

```bash
NODE_ENV=development
DEBUG=true
LOG_LEVEL=DEBUG
USE_MOCK_DB=true
API_RELOAD=true

# Use local services
DATABASE_URL=postgresql://localhost:5432/lifenavigator_dev
REDIS_URL=redis://localhost:6379/0
NEO4J_URI=bolt://localhost:7687

# Disable expensive features
ENABLE_AUDIT_LOGGING=false
ENABLE_FIELD_ENCRYPTION=false
SENTRY_DSN=                                # Empty to disable
```

### Staging

```bash
NODE_ENV=staging
DEBUG=false
LOG_LEVEL=INFO
USE_MOCK_DB=false
API_RELOAD=false

# Use staging databases
DATABASE_URL=postgresql://staging-db:5432/lifenavigator_staging
REDIS_URL=redis://staging-redis:6379/0

# Use sandbox/test integrations
PLAID_ENV=sandbox
STRIPE_API_KEY=sk_test_<test-key>

# Enable monitoring
SENTRY_ENVIRONMENT=staging
ENABLE_AUDIT_LOGGING=true
```

### Production

```bash
NODE_ENV=production
DEBUG=false
LOG_LEVEL=WARNING                          # Or ERROR for less verbosity
USE_MOCK_DB=false
API_RELOAD=false

# Use production databases
DATABASE_URL=postgresql://prod-db:5432/lifenavigator
REDIS_URL=redis://prod-redis:6379/0

# Use production integrations
PLAID_ENV=production
STRIPE_API_KEY=sk_live_<live-key>

# Full monitoring and compliance
SENTRY_ENVIRONMENT=production
ENABLE_AUDIT_LOGGING=true
ENABLE_ENCRYPTION_AT_REST=true
ENABLE_FIELD_ENCRYPTION=true
REQUIRE_MFA_FOR_HEALTH_DATA=true
DATA_RETENTION_DAYS=2555
```

---

## GCP Production Setup

### Required GCP Services

1. **Cloud SQL (PostgreSQL)**
2. **Memorystore (Redis)**
3. **GKE (Kubernetes cluster)**
4. **Cloud Storage (GCS buckets)**
5. **Secret Manager (for secrets)**
6. **Cloud Load Balancing**
7. **Cloud CDN**
8. **Cloud Logging**
9. **Cloud Monitoring**
10. **Cloud Trace**

### GCP-Specific Environment Variables

```bash
# GCP Project
GCP_PROJECT_ID=life-navigator-prod
GCP_REGION=us-central1
GCP_ZONE=us-central1-a

# Vertex AI (for LLM services)
VERTEX_AI_PROJECT=life-navigator-prod
VERTEX_AI_LOCATION=us-central1
VERTEX_AI_MODEL=text-bison@002

# Google AI
GOOGLE_AI_API_KEY=<from-google-ai-studio>

# Cloud Storage
GCS_BUCKET=life-navigator-prod-documents
GCS_BUCKET_MODELS=life-navigator-prod-models
GCS_BUCKET_ONTOLOGY=life-navigator-prod-ontology

# Cloud SQL connection
DATABASE_URL=postgresql+asyncpg://user:pass@/db?host=/cloudsql/life-navigator-prod:us-central1:main-db

# Memorystore Redis
REDIS_URL=redis://10.0.0.3:6379/0          # Internal VPC IP
```

### Using GCP Secret Manager

Store sensitive values in Secret Manager:

```bash
# Create secrets
gcloud secrets create nextauth-secret --data-file=- <<< "your-secret-here"
gcloud secrets create database-password --data-file=- <<< "your-db-password"
gcloud secrets create plaid-secret --data-file=- <<< "your-plaid-secret"

# Reference in Kubernetes (using External Secrets Operator)
# See terraform/gcp/modules/external-secrets-operator/README.md
```

### Terraform Variable Files

Location: `terraform/gcp/environments/prod/terraform.tfvars`

```hcl
project_id = "life-navigator-prod"
region     = "us-central1"
environment = "production"

# Database
db_tier = "db-custom-4-16384"              # 4 vCPU, 16GB RAM
db_availability_type = "REGIONAL"          # Multi-zone HA

# Redis
redis_memory_size_gb = 4
redis_tier = "STANDARD_HA"

# GKE
gke_node_count = 3
gke_machine_type = "n2-standard-4"         # 4 vCPU, 16GB RAM
gke_disk_size_gb = 100

# Enable features
enable_cdn = true
enable_cloud_armor = true
enable_backup = true
```

---

## Vercel Deployment

### Project Setup

1. Connect repository to Vercel
2. Configure build settings:
   - **Framework Preset**: Next.js
   - **Root Directory**: `apps/web`
   - **Build Command**: `pnpm run build`
   - **Output Directory**: `.next`

### Environment Variables in Vercel

Add these in Vercel Dashboard → Project Settings → Environment Variables:

#### Production Environment

```bash
# Core
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.lifenavigator.ai
APP_ENV=prod

# Database (Vercel Postgres)
POSTGRES_PRISMA_URL=<from-vercel-postgres>
POSTGRES_URL_NON_POOLING=<from-vercel-postgres>

# Authentication
NEXTAUTH_URL=https://app.lifenavigator.ai
NEXTAUTH_SECRET=<your-generated-secret>
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>

# Encryption
ENCRYPTION_KEY=<your-encryption-key>
ENCRYPTION_MASTER_KEY=<your-master-key>
ENCRYPTION_SALT=<your-salt>
ENABLE_FIELD_ENCRYPTION=true

# Integrations (add as needed)
PLAID_CLIENT_ID=<your-plaid-client-id>
PLAID_CLIENT_SECRET=<your-plaid-secret>
PLAID_ENV=production

# Monitoring
SENTRY_DSN=<your-sentry-dsn>

# Backend APIs
FINANCIAL_API_URL=https://api.lifenavigator.ai/api/v1
FINANCIAL_API_KEY=<your-api-key>
# ... (repeat for other API endpoints)

# Feature Flags
ENABLE_MULTI_AGENT=true
ENABLE_ANALYTICS=true
ENABLE_FIELD_ENCRYPTION=true
```

#### Preview Environment

Set different values for preview deployments:

```bash
NODE_ENV=staging
NEXT_PUBLIC_APP_URL=https://preview.lifenavigator.ai
APP_ENV=staging
PLAID_ENV=sandbox                          # Use sandbox for previews
```

### Vercel CLI Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
cd apps/web
vercel link

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Vercel Postgres Setup

```bash
# Create Vercel Postgres database
vercel postgres create life-navigator-prod

# Get connection strings (automatically added to project)
# POSTGRES_PRISMA_URL - for Prisma with PgBouncer
# POSTGRES_URL_NON_POOLING - for migrations
```

---

## Local Development

### Docker Compose Setup

Start all services locally:

```bash
# From project root
docker-compose up -d

# This starts:
# - PostgreSQL (port 5432)
# - Redis (port 6379)
# - Neo4j (port 7687, 7474)
# - GraphDB (port 7200)
# - Qdrant (port 6333)
```

### Local Environment Variables

Use these for local development:

```bash
# Root .env
NODE_ENV=development
DATABASE_URL=postgresql://postgres:localdev@localhost:5432/lifenavigator
REDIS_URL=redis://localhost:6379
NEO4J_URI=bolt://localhost:7687
NEO4J_PASSWORD=localdev
GRAPHDB_URL=http://localhost:7200
CORS_ORIGINS=http://localhost:3000,http://localhost:19006

# Web app .env.local
USE_MOCK_DB=true
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=local-dev-secret-at-least-32-characters-long

# Backend .env
DEBUG=true
API_RELOAD=true
LOG_LEVEL=DEBUG
DATABASE_URL=postgresql+asyncpg://postgres:localdev@localhost:5432/lifenavigator
```

### Local Development Script

```bash
# Use the provided local development script
./scripts/local-dev.sh

# This will:
# 1. Start Docker services
# 2. Run database migrations
# 3. Seed test data
# 4. Start all services (web, backend, graphrag)
```

---

## Security Best Practices

### 1. Secret Management

- **Never commit** `.env` files to git
- Use `.env.example` as templates (without real values)
- Use GCP Secret Manager or AWS Secrets Manager in production
- Rotate secrets regularly (every 90 days)

### 2. Access Control

- Use separate credentials for each environment
- Implement least-privilege principle
- Enable MFA for all admin accounts
- Use service accounts for service-to-service communication

### 3. Encryption

- Enable encryption at rest for all databases
- Use TLS/SSL for all data in transit
- Implement field-level encryption for PHI/PII
- Use strong encryption keys (minimum 256-bit)

### 4. Monitoring

- Enable audit logging for all environments
- Set up alerts for suspicious activity
- Monitor API rate limits and abuse
- Track failed authentication attempts

---

## Validation Checklist

Before deploying to production:

- [ ] All secrets generated using cryptographically secure methods
- [ ] Database credentials unique per environment
- [ ] All API keys from production services (not sandbox)
- [ ] CORS origins restricted to actual domains
- [ ] Rate limiting configured appropriately
- [ ] Monitoring and error tracking enabled
- [ ] Backup and disaster recovery configured
- [ ] HIPAA compliance settings enabled
- [ ] SSL/TLS certificates configured
- [ ] Domain DNS records configured
- [ ] Secrets stored in Secret Manager (not plain text)
- [ ] Service account permissions reviewed
- [ ] Multi-zone deployment for HA (production)
- [ ] Load testing completed
- [ ] Security audit completed

---

## Troubleshooting

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql "postgresql://user:pass@host:5432/db"

# Test Cloud SQL proxy
cloud_sql_proxy -instances=PROJECT:REGION:INSTANCE=tcp:5432
psql -h 127.0.0.1 -U user -d db
```

### Redis Connection Issues

```bash
# Test Redis connection
redis-cli -h host -p 6379 -a password ping

# Should return: PONG
```

### Neo4j Connection Issues

```bash
# Test Neo4j connection using cypher-shell
cypher-shell -a bolt://host:7687 -u neo4j -p password "RETURN 1"
```

### Secret Manager Access Issues

```bash
# Test secret access
gcloud secrets versions access latest --secret="secret-name"

# List accessible secrets
gcloud secrets list
```

---

## Additional Resources

- [GCP Infrastructure Setup](../../terraform/gcp/README.md)
- [Kubernetes Deployment](../../k8s/README.md)
- [HIPAA Compliance](../compliance/hipaa-checklist.md)
- [Monitoring Setup](../guides/monitoring-setup.md)
- [OAuth Setup Guide](../guides/oauth-setup.md)

---

## Support

For questions or issues with environment configuration:

1. Check the [troubleshooting section](#troubleshooting)
2. Review service-specific documentation
3. Open an issue on GitHub
4. Contact the infrastructure team

---

**Last Updated**: 2025-11-06
**Document Version**: 1.0.0
