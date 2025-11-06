# Life Navigator Monorepo

Production-grade AI life management platform with dual-graph semantic architecture.

## 📚 Documentation

**[Complete Documentation Hub →](./docs/README.md)**

- **[System Audit Report](./docs/SYSTEM_AUDIT_REPORT.md)** - Production readiness assessment (Nov 2025)
- **[Deployment Guide](./docs/deployment/)** - GCP, K8s, Docker deployment
- **[Scripts Documentation](./scripts/README.md)** - All operational scripts organized
- **[Architecture Docs](./docs/architecture/)** - System design and patterns
- **[API Documentation](./docs/api/)** - REST API reference

## Architecture

This is a comprehensive monorepo containing:

### Applications
- **apps/web**: Next.js 15 web application with React 19
- **apps/mobile**: React Native (Expo) mobile application

### Backend Services
- **backend**: NEW FastAPI backend with multi-tenant architecture, RLS, HIPAA compliance
- **services/api**: Legacy FastAPI service (being migrated)
- **services/agents**: ML agents and AI orchestration
- **services/graphrag-rs**: Rust gRPC GraphRAG service (100x faster)
- **services/kg-sync**: GraphDB → Neo4j ETL pipeline
- **services/embeddings**: Vector embedding generation service
- **services/finance-api**: Finance domain microservice

### Shared Packages
- **packages/ui-components**: Shared React/React Native components
- **packages/api-client**: TypeScript API client (OpenAPI generated)
- **packages/ontology-sdk**: RDF/Turtle ontology SDK
- **packages/provenance**: Provenance chain utilities
- **packages/messaging**: Event bus for inter-service communication

### Infrastructure & Configuration
- **terraform**: Infrastructure as Code (GCP modules)
- **k8s**: Kubernetes manifests with Kustomize overlays
- **scripts**: Organized operational scripts (dev, deploy, db, utils)
- **ontology**: RDF/Turtle semantic layer (6 domains)
- **migrations**: Database migrations for all databases
- **infra-archive**: Archived legacy infrastructure (historical reference)

## Tech Stack

- **Frontend**: TypeScript, Next.js 15, React Native, Expo
- **Backend**: Python 3.11+, FastAPI, SQLAlchemy
- **Databases**: PostgreSQL 16, Neo4j 5, GraphDB 10
- **AI/ML**: Anthropic Claude, Vertex AI, sentence-transformers
- **Infrastructure**: GCP, Terraform, Kubernetes, Docker
- **Build System**: Turborepo, pnpm workspaces

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Python 3.11+
- Poetry
- Docker & Docker Compose

### Installation

```bash
# Install Node dependencies
pnpm install

# Install Python dependencies (backend)
cd backend && poetry install && cd ..

# Install Python dependencies (services)
cd services/api && poetry install && cd ../..
cd services/agents && poetry install && cd ../..
cd services/kg-sync && poetry install && cd ../..
cd services/embeddings && poetry install && cd ../..

# Start local development environment (all databases + services)
./scripts/dev/local-dev.sh

# OR manually with Docker Compose:
docker-compose up -d

# Run all frontend applications
pnpm dev
```

## Development Commands

### Monorepo Commands (pnpm)
```bash
# Run all services in dev mode
pnpm dev

# Build all packages
pnpm build

# Run all tests
pnpm test

# Lint all code
pnpm lint

# Type check
pnpm type-check

# Format code
pnpm format

# Generate API clients and types
pnpm codegen

# Clean all build artifacts
pnpm clean
```

### Script Commands
All operational scripts are in `/scripts` directory. See **[scripts/README.md](./scripts/README.md)** for complete documentation.

```bash
# Development
./scripts/dev/local-dev.sh              # Start local environment
./scripts/dev/setup-web.sh              # Setup web app
./scripts/dev/start-backend.sh          # Start FastAPI backend
./scripts/dev/start-maverick.sh         # Start Maverick LLM
./scripts/dev/run-admin-ui.sh           # Run admin dashboard

# Database
./scripts/db/init-graphdb.sh            # Initialize GraphDB with ontologies
./scripts/db/init-prisma.sh             # Initialize Prisma
./scripts/db/postgres-setup.sh          # Setup PostgreSQL with extensions
./scripts/db/migrate-to-postgres.sh     # Migrate to PostgreSQL

# Deployment
./scripts/deploy/deploy-web.sh [env]    # Deploy web app
./scripts/deploy/setup-gcp.sh           # Setup GCP infrastructure
./scripts/deploy/prepare-and-build-web.sh  # Build web app

# Utilities
./scripts/utils/codegen.sh              # Generate code from proto/graphql
./scripts/utils/generate-env.sh [env]   # Generate .env files
./scripts/utils/create-placeholders.sh  # Create placeholder files
```

## Project Structure

```
life-navigator-monorepo/
├── apps/                      # Applications
│   ├── web/                  # Next.js 15 + React 19 web app
│   └── mobile/               # React Native (Expo) mobile app
│
├── backend/                   # NEW FastAPI backend (25K+ lines)
│   ├── alembic/              # Database migrations
│   ├── app/
│   │   ├── api/              # REST API endpoints (52 endpoints)
│   │   ├── core/             # Config, database, security, logging
│   │   ├── models/           # SQLAlchemy ORM models (43 tables)
│   │   ├── schemas/          # Pydantic validation schemas
│   │   └── db/migrations/    # SQL migration scripts
│   ├── pyproject.toml        # Poetry dependencies
│   └── Dockerfile            # Multi-stage production build
│
├── services/                  # Microservices
│   ├── api/                  # Legacy API (being migrated)
│   ├── agents/               # ML agent orchestration
│   ├── graphrag-rs/          # Rust gRPC GraphRAG (100x faster)
│   ├── embeddings/           # Vector embedding service
│   ├── kg-sync/              # GraphDB → Neo4j sync
│   └── finance-api/          # Finance domain service
│
├── packages/                  # Shared libraries
│   ├── ui-components/        # React/RN components
│   ├── api-client/           # TypeScript API client
│   ├── ontology-sdk/         # RDF/Turtle SDK
│   ├── provenance/           # Provenance tracking
│   └── messaging/            # Event bus (inter-service)
│
├── terraform/                 # Infrastructure as Code
│   ├── gcp/                  # GCP modules
│   │   ├── modules/          # VPC, GKE, Cloud SQL, Neo4j, etc.
│   │   └── environments/     # dev/staging/prod configs
│   ├── backend/              # Terraform backend config
│   └── modules/              # Reusable modules
│
├── k8s/                      # Kubernetes manifests
│   ├── base/                 # Base resources (backend, graphrag)
│   ├── shared/               # Ingress, External Secrets
│   └── overlays/             # dev/staging/prod Kustomize
│
├── scripts/                   # Organized operational scripts
│   ├── dev/                  # Development (local-dev, setup, start)
│   ├── deploy/               # Deployment (deploy-web, setup-gcp)
│   ├── db/                   # Database (init, migrate, setup)
│   └── utils/                # Utilities (codegen, generate-env)
│
├── ontology/                  # RDF/OWL semantic models
│   ├── core/                 # Core ontology
│   ├── career/               # Career domain
│   ├── education/            # Education domain
│   ├── finance/              # Finance domain
│   ├── goals/                # Goals domain
│   ├── health/               # Health domain
│   └── shacl/                # SHACL validation shapes
│
├── migrations/                # Database migrations
│   ├── postgres/             # PostgreSQL migrations
│   ├── neo4j/                # Neo4j Cypher migrations
│   └── graphdb/              # GraphDB SPARQL migrations
│
├── docs/                      # Documentation hub
│   ├── architecture/         # System architecture
│   ├── deployment/           # Deployment guides
│   ├── guides/               # Setup and user guides
│   ├── compliance/           # HIPAA and security
│   ├── web/                  # Web app specific docs
│   ├── api/                  # API documentation
│   └── archive/              # Historical docs
│
├── .github/workflows/         # CI/CD pipelines
│   ├── backend.yml           # FastAPI CI/CD
│   ├── graphrag.yml          # Rust GraphRAG CI/CD
│   ├── web.yml               # Next.js CI/CD
│   ├── mobile.yml            # React Native CI/CD
│   ├── migrations.yml        # Database migrations
│   └── pr-checks.yml         # Fast PR feedback
│
├── infra-archive/             # Archived legacy infrastructure
├── docker-compose.yml         # Local development (6 services)
├── turbo.json                 # Turborepo configuration
└── pnpm-workspace.yaml        # pnpm workspaces
```

## Dual-Graph GraphRAG Architecture

Life Navigator uses a unique dual-graph architecture:

1. **GraphDB (RDF/SPARQL)**: Semantic knowledge base with ontology reasoning
2. **Neo4j (Cypher)**: Performance-optimized relationship queries

Query flow: `Vector Search → Neo4j → SPARQL → Enriched Response`

## HIPAA Compliance

This platform is designed for HIPAA compliance with:

- Multi-tenant isolation with Customer-Managed Encryption Keys (CMEK)
- Field-level encryption for PHI
- Comprehensive audit logging
- VPC Service Controls

## Contributing

See [CONTRIBUTING.md](./docs/CONTRIBUTING.md) for development guidelines.

## License

Proprietary - All rights reserved
