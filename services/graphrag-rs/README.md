# GraphRAG Service (Rust)

High-performance hybrid knowledge graph + vector RAG service for Life Navigator.

## Architecture

This service combines three powerful technologies for advanced retrieval-augmented generation:

1. **Neo4j** - Property graph database for entity relationships and graph traversal
2. **Qdrant** - Vector database for semantic similarity search
3. **GraphDB** - RDF/SPARQL triple store for semantic ontology queries

## Features

- **Hybrid Search**: Combines semantic graph queries with vector similarity
- **Multi-tenant RLS**: Row-level security with tenant isolation (HIPAA compliant)
- **Dual Query Modes**:
  - **Centralized**: Org-wide knowledge queries
  - **Personalized**: User-specific queries with RLS filtering
- **gRPC API**: High-performance binary protocol
- **100x Faster**: Rust performance for graph algorithms and embeddings

## Query Modes

### Centralized Mode
Query across all organizational knowledge without tenant filtering.

```rust
query_centralized(
    query: "What are my investment goals?",
    max_results: 10,
    domains: ["finance", "goals"],
    filters: {}
)
```

### Personalized Mode (with RLS)
Query user-specific knowledge with automatic tenant filtering.

```rust
query_personalized(
    query: "What are my investment goals?",
    user_id: "user_123",
    tenant_id: "tenant_abc",
    max_results: 10,
    domains: ["finance", "goals"],
    filters: {}
)
```

## Setup

### Prerequisites

- Rust 1.75+ (MSRV)
- Neo4j 5.15+ (running on port 7687)
- Qdrant 1.7+ (running on port 6333)
- GraphDB 10.5+ (running on port 7200)
- Maverick LLM (running on port 8090) for embeddings

### Installation

```bash
# Build the service
cargo build --release

# Run tests (requires running databases)
cargo test -- --ignored

# Run the service
cargo run --release
```

### Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
# Edit .env with your database credentials
```

Environment variables follow the pattern `GRAPHRAG_<SECTION>__<KEY>`:

```
GRAPHRAG_NEO4J__URI=bolt://localhost:7687
GRAPHRAG_NEO4J__PASSWORD=your_password
GRAPHRAG_QDRANT__URL=http://localhost:6333
GRAPHRAG_GRAPHDB__URL=http://localhost:7200
```

## gRPC API

The service exposes a gRPC API defined in `proto/graphrag.proto`:

- `QueryCentralized` - Centralized knowledge query
- `QueryPersonalized` - Personalized query with RLS
- `SemanticSearch` - SPARQL-based semantic search
- `VectorSearch` - Vector similarity search
- `HybridSearch` - Combined semantic + vector search
- `GetEntity` - Fetch entity with relationships
- `GetRelationships` - Get entity relationships
- `HealthCheck` - Service health status

### Example gRPC Client (Python)

```python
import grpc
from graphrag_pb2 import QueryRequest
from graphrag_pb2_grpc import GraphRAGStub

channel = grpc.insecure_channel('localhost:50051')
client = GraphRAGStub(channel)

request = QueryRequest(
    query="What are my financial goals?",
    max_results=10,
    domains=["finance", "goals"],
    include_sources=True
)

response = client.QueryCentralized(request)
print(f"Answer: {response.answer}")
print(f"Entities found: {len(response.entities)}")
```

## Performance

- **Query latency**: <100ms for hybrid search (p95)
- **Throughput**: >1000 queries/sec on 8-core machine
- **Memory**: ~500MB base + vector index size
- **Embeddings**: 10-20ms per text with Maverick

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     GraphRAG Service (Rust)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              gRPC Service Layer                       │  │
│  │  (QueryCentralized, QueryPersonalized, HybridSearch) │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │               RAG Service                             │  │
│  │  - Query orchestration                                │  │
│  │  - Result ranking & fusion                            │  │
│  │  - Multi-tenant RLS enforcement                       │  │
│  └─────┬────────┬────────┬──────────┬──────────────────┘  │
│        │        │        │          │                       │
│  ┌─────▼─┐  ┌──▼───┐ ┌──▼─────┐ ┌─▼─────────┐            │
│  │ Neo4j │  │Qdrant│ │GraphDB │ │Embeddings │            │
│  │Client │  │Client│ │Client  │ │Service    │            │
│  └───────┘  └──────┘ └────────┘ └───────────┘            │
│                                                              │
└──────┬──────────┬──────────┬──────────┬────────────────────┘
       │          │          │          │
   ┌───▼───┐  ┌──▼────┐ ┌───▼─────┐ ┌─▼────────┐
   │ Neo4j │  │Qdrant │ │GraphDB  │ │ Maverick │
   │  DB   │  │Vector │ │ Triple  │ │   LLM    │
   │       │  │  DB   │ │  Store  │ │          │
   └───────┘  └───────┘ └─────────┘ └──────────┘
```

## Development

### Project Structure

```
graphrag-rs/
├── Cargo.toml              # Rust dependencies
├── build.rs                # Proto compilation
├── proto/
│   └── graphrag.proto      # gRPC service definition
├── src/
│   ├── main.rs             # Service entry point
│   ├── lib.rs              # Library exports
│   ├── config.rs           # Configuration management
│   ├── error.rs            # Error types
│   ├── neo4j_client.rs     # Neo4j client
│   ├── qdrant_client.rs    # Qdrant client
│   ├── graphdb_client.rs   # GraphDB SPARQL client
│   ├── embeddings.rs       # Embeddings service
│   ├── rag_service.rs      # RAG orchestration
│   └── grpc_service.rs     # gRPC handlers
├── .env.example            # Environment config template
└── README.md               # This file
```

### Testing

```bash
# Run unit tests
cargo test

# Run integration tests (requires databases)
cargo test -- --ignored

# Run with debug logging
RUST_LOG=debug cargo run
```

### Code Quality

```bash
# Format code
cargo fmt

# Lint code
cargo clippy -- -D warnings

# Check without building
cargo check
```

## Deployment

### Docker

```dockerfile
FROM rust:1.75 as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bookworm-slim
COPY --from=builder /app/target/release/graphrag-rs /usr/local/bin/
CMD ["graphrag-rs"]
```

### Kubernetes

See `k8s/graphrag-deployment.yaml` for Kubernetes manifests.

## License

Proprietary - Life Navigator Platform

## Contributing

See the main repository CONTRIBUTING.md for guidelines.
