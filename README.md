# Life Navigator Monorepo

Production-grade AI life management platform with dual-graph semantic architecture.

## Architecture

This is a comprehensive monorepo containing:

- **apps/web**: Next.js 15 web application
- **apps/mobile**: React Native (Expo) mobile application
- **services/api**: FastAPI main backend service
- **services/agents**: ML agents and AI orchestration
- **services/kg-sync**: GraphDB → Neo4j ETL pipeline
- **services/embeddings**: Vector embedding generation service
- **packages/ui-components**: Shared React/React Native components
- **packages/api-client**: TypeScript API client (OpenAPI generated)
- **packages/ontology-sdk**: RDF/Turtle ontology SDK
- **packages/provenance**: Provenance chain utilities
- **infra**: Infrastructure as Code (Terraform, K8s)
- **ontology**: RDF/Turtle semantic layer

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

# Install Python dependencies
cd services/api && poetry install
cd ../agents && poetry install
cd ../kg-sync && poetry install
cd ../embeddings && poetry install

# Start local development environment
docker-compose up -d

# Run all services
pnpm dev
```

## Development Commands

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

## Project Structure

```
life-navigator-monorepo/
├── apps/               # Applications
│   ├── web/           # Next.js web app
│   └── mobile/        # React Native mobile app
├── packages/          # Shared libraries
│   ├── ui-components/ # Shared UI components
│   ├── api-client/    # API client
│   ├── ontology-sdk/  # Ontology utilities
│   └── provenance/    # Provenance tracking
├── services/          # Backend services
│   ├── api/          # Main FastAPI backend
│   ├── agents/       # ML agents
│   ├── kg-sync/      # Knowledge graph sync
│   └── embeddings/   # Vector embeddings
├── infra/            # Infrastructure
│   ├── terraform/    # IaC
│   ├── k8s/         # Kubernetes configs
│   └── helm/        # Helm charts
├── ontology/         # RDF/Turtle ontology
├── migrations/       # Database migrations
├── docs/            # Documentation
└── scripts/         # Utility scripts
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
