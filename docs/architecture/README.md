# Life Navigator Architecture

## Overview

Life Navigator is a production-grade AI life management platform built on a unique **dual-graph semantic architecture** combining the semantic reasoning power of RDF/SPARQL (GraphDB) with the performance optimization of property graphs (Neo4j).

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
├──────────────────────────┬──────────────────────────────────────┤
│  Next.js 15 Web App      │  React Native Mobile App            │
│  (apps/web)              │  (apps/mobile)                       │
└──────────────────────────┴──────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                          │
├─────────────────────────────────────────────────────────────────┤
│  FastAPI Main Backend (services/api)                            │
│  - Authentication & Authorization                               │
│  - Rate Limiting & CORS                                         │
│  - Request Routing                                              │
└─────────────────────────────────────────────────────────────────┘
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                      Service Layer                              │
├──────────────────┬─────────────────┬──────────────────┬─────────┤
│  ML Agents       │  KG Sync        │  Embeddings      │  API    │
│  (agents)        │  (kg-sync)      │  (embeddings)    │  (api)  │
└──────────────────┴─────────────────┴──────────────────┴─────────┘
                                    │
┌─────────────────────────────────────────────────────────────────┐
│                       Data Layer                                │
├───────────────┬───────────────┬──────────────┬──────────────────┤
│  PostgreSQL   │  Neo4j        │  GraphDB     │  Redis           │
│  (Operational)│  (Performance)│  (Semantic)  │  (Cache)         │
└───────────────┴───────────────┴──────────────┴──────────────────┘
```

## Dual-Graph GraphRAG Architecture

### Why Two Graph Databases?

Life Navigator uses both GraphDB (RDF/SPARQL) and Neo4j (Cypher) for complementary purposes:

**GraphDB (Semantic Layer)**:
- Ontology-driven data modeling with OWL/RDFS
- SHACL validation for data quality
- SPARQL reasoning and inference
- FHIR alignment for healthcare compliance
- Source of truth for semantic relationships

**Neo4j (Performance Layer)**:
- Optimized for fast graph traversals
- Real-time recommendations and analytics
- Vector similarity search integration
- User-facing queries and API responses

### Query Flow

```
User Query
    ↓
Vector Embedding (sentence-transformers)
    ↓
Vertex AI Vector Search (find similar concepts)
    ↓
Neo4j Cypher Query (fast retrieval)
    ↓
GraphDB SPARQL Query (semantic enrichment)
    ↓
LLM Response Generation (Claude)
    ↓
Provenance Chain (audit trail)
```

## Multi-Tenancy & HIPAA Compliance

### Tenant Isolation

Every entity in the system has a `tenantId` property enforced at:
- Database query level (Row-Level Security)
- API authorization level
- Graph database level (node properties)
- Ontology validation level (SHACL shapes)

### Encryption

- **At Rest**: Customer-Managed Encryption Keys (CMEK) via Google Cloud KMS
- **In Transit**: TLS 1.3 for all connections
- **Field-Level**: PHI fields encrypted with tenant-specific keys

### Audit Logging

All operations create provenance records:
- Actor (user/service)
- Action (create/read/update/delete)
- Resource (entity URI)
- Timestamp
- Metadata (IP, request ID, etc.)

## Technology Stack

### Frontend
- **Web**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Mobile**: React Native, Expo
- **Shared**: Workspace packages for UI components and API client

### Backend
- **Primary API**: Python 3.11, FastAPI, SQLAlchemy
- **ML Agents**: Python, Anthropic Claude, custom orchestration
- **Sync Services**: Python, asyncio, Pub/Sub

### Data
- **Operational**: PostgreSQL 16 with pgvector extension
- **Graph**: Neo4j 5.15 Enterprise + GraphDB 10.5
- **Cache**: Redis 7
- **Object Storage**: Google Cloud Storage

### Infrastructure
- **Cloud**: Google Cloud Platform (GCP)
- **Orchestration**: Kubernetes (GKE Autopilot)
- **IaC**: Terraform
- **CI/CD**: GitHub Actions
- **Build**: Turborepo, pnpm workspaces

## Project Structure

```
life-navigator-monorepo/
├── apps/               # User-facing applications
│   ├── web/           # Next.js web application
│   └── mobile/        # React Native mobile app
├── packages/          # Shared libraries
│   ├── ui-components/ # Shared React/RN components
│   ├── api-client/    # Generated TypeScript API client
│   ├── ontology-sdk/  # RDF/Turtle utilities
│   └── provenance/    # Provenance chain tracking
├── services/          # Backend microservices
│   ├── api/          # Main FastAPI backend
│   ├── agents/       # ML agents and orchestration
│   ├── kg-sync/      # GraphDB → Neo4j ETL
│   └── embeddings/   # Vector embedding generation
├── infra/            # Infrastructure as Code
│   ├── terraform/    # GCP resource definitions
│   ├── k8s/         # Kubernetes manifests
│   └── helm/        # Helm charts
├── ontology/         # Semantic layer
│   ├── core/        # Core ontology (Person, etc.)
│   ├── health/      # Healthcare domain (FHIR-aligned)
│   ├── finance/     # Financial domain
│   └── shacl/       # Validation shapes
├── migrations/       # Database migrations
├── docs/            # Documentation
└── scripts/         # Utility scripts
```

## Key Design Decisions

### Why Turborepo?

- Multi-language support (TypeScript + Python)
- Incremental builds with caching
- Task orchestration across packages
- Less opinionated than Nx

### Why FastAPI + Next.js?

- **FastAPI**: Best-in-class Python async web framework with automatic OpenAPI generation
- **Next.js**: React framework with server-side rendering, optimal for SEO and performance

### Why Dual Graphs?

- **Performance**: Neo4j for millisecond queries
- **Semantics**: GraphDB for reasoning and compliance
- **Best of Both**: Combine speed with intelligence

### Why Google Cloud Platform?

- $350K in credits available
- Vertex AI for ML/AI workloads
- AlloyDB (PostgreSQL-compatible) for future migration
- Strong HIPAA compliance certifications
- VPC Service Controls for data isolation

## Security Architecture

### Defense in Depth

1. **Network Layer**: VPC with private subnets, Cloud NAT
2. **Application Layer**: JWT authentication, CSRF protection, rate limiting
3. **Data Layer**: CMEK encryption, row-level security, audit logging
4. **Monitoring**: Cloud Logging, alerting on suspicious activity

### Compliance

- **HIPAA**: Business Associate Agreement (BAA) with GCP
- **GDPR**: Right to access, rectification, erasure
- **SOC 2**: In progress

## Scalability

### Horizontal Scaling

- Stateless services deployed on GKE Autopilot
- Auto-scaling based on CPU/memory metrics
- Cloud Load Balancer for traffic distribution

### Database Scaling

- **PostgreSQL**: Read replicas, connection pooling (PgBouncer)
- **Neo4j**: Causal clustering (3+ nodes)
- **Redis**: Cluster mode with sharding

### Caching Strategy

- **L1**: In-memory (service-level)
- **L2**: Redis (shared cache)
- **L3**: CDN (static assets)

## Disaster Recovery

- **RTO**: 4 hours
- **RPO**: 15 minutes
- **Backups**: Daily automated snapshots to GCS
- **Replication**: Multi-region for critical data

## Monitoring & Observability

- **Metrics**: Prometheus + Grafana
- **Logs**: Cloud Logging (centralized)
- **Traces**: OpenTelemetry
- **Alerts**: PagerDuty integration
- **Dashboards**: Custom Grafana dashboards per service

## Future Enhancements

1. **AlloyDB Migration**: Migrate from Cloud SQL to AlloyDB for better performance
2. **Multi-Region**: Deploy to multiple GCP regions for lower latency
3. **Real-Time Sync**: WebSocket support for live updates
4. **Mobile Offline**: Offline-first architecture with sync
5. **Advanced ML**: Fine-tune domain-specific models on Vertex AI
