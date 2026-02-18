# Life Navigator - MCP Server

Model Context Protocol (MCP) server implementation for the Life Navigator platform.

## Overview

The MCP server provides a standardized protocol for LLMs to:
- Access context from multiple sources (GraphRAG, memory, documents)
- Execute tools and operations (search, query, update)
- Maintain conversation state and memory
- Support extensible plugins for new capabilities

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      MCP Server                         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │              Protocol Layer                      │  │
│  │  (Request/Response, Authentication, Routing)    │  │
│  └──────────────────┬──────────────────────────────┘  │
│                     │                                  │
│  ┌─────────────────┴──────────────────────────────┐  │
│  │              Plugin Manager                      │  │
│  │  (Discovery, Loading, Lifecycle)                │  │
│  └──────────────────┬──────────────────────────────┘  │
│                     │                                  │
│  ┌──────────────────┴─────────────────────────────┐  │
│  │               Plugins                           │  │
│  │  ┌────────┐  ┌────────┐  ┌────────┐           │  │
│  │  │GraphRAG│  │ Memory │  │WebSearch│  ...      │  │
│  │  └────────┘  └────────┘  └────────┘           │  │
│  └──────────────────┬──────────────────────────────┘  │
│                     │                                  │
│  ┌──────────────────┴─────────────────────────────┐  │
│  │                  Tools                          │  │
│  │  (Query, Search, Update, Analyze, Execute)     │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │PostgreSQL│        │  Redis   │        │  Neo4j   │
   └──────────┘        └──────────┘        └──────────┘
```

## Directory Structure

```
mcp-server/
├── core/                    # Core MCP protocol implementation
│   ├── __init__.py
│   ├── server.py           # FastAPI server
│   ├── protocol.py         # MCP protocol handlers
│   ├── plugin_manager.py   # Plugin system
│   └── context_builder.py  # Context aggregation
│
├── plugins/                 # Built-in plugins
│   ├── __init__.py
│   ├── base.py             # Base plugin interface
│   ├── graphrag/           # GraphRAG plugin
│   │   ├── __init__.py
│   │   ├── plugin.py
│   │   └── operations.py
│   ├── memory/             # Memory system plugin
│   │   ├── __init__.py
│   │   ├── plugin.py
│   │   └── operations.py
│   ├── websearch/          # Web search plugin
│   │   ├── __init__.py
│   │   └── plugin.py
│   └── files/              # File operations plugin
│       ├── __init__.py
│       └── plugin.py
│
├── tools/                   # MCP tools (callable by LLMs)
│   ├── __init__.py
│   ├── query.py            # Query tools
│   ├── search.py           # Search tools
│   ├── update.py           # Update tools
│   └── analyze.py          # Analysis tools
│
├── schemas/                 # Pydantic schemas
│   ├── __init__.py
│   ├── protocol.py         # MCP protocol schemas
│   ├── context.py          # Context schemas
│   └── tools.py            # Tool schemas
│
├── utils/                   # Utilities
│   ├── __init__.py
│   ├── config.py           # Configuration
│   ├── logging.py          # Logging setup
│   └── auth.py             # Authentication
│
├── tests/                   # Tests
│   ├── test_protocol.py
│   ├── test_plugins.py
│   └── test_tools.py
│
├── config/                  # Configuration files
│   ├── plugins.yaml        # Plugin configurations
│   └── tools.yaml          # Tool configurations
│
├── requirements.txt         # Python dependencies
├── Dockerfile              # Container image
└── README.md               # This file
```

## Core Concepts

### MCP Protocol

The MCP protocol defines how LLMs interact with the server:

1. **Context Request**: LLM requests context for a query
2. **Context Response**: Server returns aggregated context from plugins
3. **Tool Invocation**: LLM calls a tool to perform an action
4. **Tool Response**: Server executes tool and returns result

### Plugins

Plugins extend MCP capabilities:

- **Discovery**: Automatically discovered via entry points
- **Registration**: Register tools, context providers, event handlers
- **Lifecycle**: Initialize, configure, start, stop, cleanup
- **Isolation**: Each plugin runs in its own namespace

### Tools

Tools are callable functions exposed to LLMs:

- **Declaration**: Defined with JSON Schema for parameters
- **Validation**: Pydantic models validate inputs
- **Execution**: Async execution with timeout and retry
- **Results**: Structured responses with metadata

## Installation

### Development Setup

```bash
# Create virtual environment
cd mcp-server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
nano .env

# Run development server
python -m core.server
```

### Docker Setup

```bash
# Build image
docker build -t life-navigator-mcp:latest .

# Run container
docker run -d \
  -p 8080:8080 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e NEO4J_URI=neo4j+s://... \
  --name mcp-server \
  life-navigator-mcp:latest
```

## Configuration

### Environment Variables

```bash
# Server
MCP_HOST=0.0.0.0
MCP_PORT=8080
MCP_WORKERS=4
MCP_LOG_LEVEL=INFO

# Databases
DATABASE_URL=postgresql://user:pass@host:5432/dbname
REDIS_URL=redis://host:6379/0
NEO4J_URI=neo4j+s://host:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
QDRANT_URL=https://host:6333
QDRANT_API_KEY=xxx

# Authentication
JWT_SECRET_KEY=xxx
JWT_ALGORITHM=HS256
JWT_EXPIRATION_MINUTES=60

# Plugins
ENABLE_GRAPHRAG_PLUGIN=true
ENABLE_MEMORY_PLUGIN=true
ENABLE_WEBSEARCH_PLUGIN=true
ENABLE_FILES_PLUGIN=true

# External APIs
SERPER_API_KEY=xxx  # For web search
OPENAI_API_KEY=xxx  # For embeddings (optional)
```

### Plugin Configuration

`config/plugins.yaml`:
```yaml
plugins:
  graphrag:
    enabled: true
    priority: 100
    config:
      max_results: 10
      include_relationships: true

  memory:
    enabled: true
    priority: 90
    config:
      short_term_ttl: 3600
      working_memory_size: 50

  websearch:
    enabled: true
    priority: 50
    config:
      max_results: 5
      search_provider: serper
```

## API Reference

### Context API

**Request Context**

```http
POST /mcp/context
Content-Type: application/json

{
  "user_id": "user_123",
  "query": "What are my upcoming tasks?",
  "conversation_id": "conv_456",
  "context_types": ["conversational", "semantic", "graph"],
  "max_tokens": 2000
}
```

**Response**

```json
{
  "context": {
    "conversational": { ... },
    "semantic": { ... },
    "graph": { ... }
  },
  "metadata": {
    "sources": ["memory", "graphrag"],
    "tokens": 1850,
    "latency_ms": 150
  }
}
```

### Tool API

**Invoke Tool**

```http
POST /mcp/tool/invoke
Content-Type: application/json

{
  "tool_name": "query_knowledge_graph",
  "parameters": {
    "query": "Find all projects related to AI",
    "limit": 10
  },
  "user_id": "user_123"
}
```

**Response**

```json
{
  "result": {
    "nodes": [ ... ],
    "relationships": [ ... ]
  },
  "execution_time_ms": 250,
  "tool_name": "query_knowledge_graph"
}
```

### Health Check

```http
GET /health
```

**Response**

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "plugins": {
    "graphrag": "ok",
    "memory": "ok",
    "websearch": "ok"
  }
}
```

## Plugin Development

### Creating a Custom Plugin

```python
from mcp_server.plugins.base import BasePlugin, PluginMetadata
from mcp_server.tools.base import Tool

class MyCustomPlugin(BasePlugin):
    def __init__(self):
        super().__init__(
            metadata=PluginMetadata(
                name="my_custom",
                version="1.0.0",
                description="My custom plugin"
            )
        )

    async def initialize(self, config: dict):
        """Initialize plugin resources"""
        self.config = config
        # Set up connections, load data, etc.

    async def get_context(self, query: str, user_id: str) -> dict:
        """Provide context for a query"""
        return {
            "custom_data": "...",
            "source": "my_custom"
        }

    def get_tools(self) -> list[Tool]:
        """Register tools"""
        return [
            Tool(
                name="my_custom_tool",
                description="Does something custom",
                parameters_schema={...},
                handler=self.my_tool_handler
            )
        ]

    async def my_tool_handler(self, **kwargs):
        """Tool implementation"""
        return {"result": "..."}

    async def cleanup(self):
        """Cleanup resources"""
        pass
```

### Registering Plugin

Add entry point in `setup.py`:

```python
setup(
    name="my-custom-plugin",
    entry_points={
        "mcp_server.plugins": [
            "my_custom = my_plugin.plugin:MyCustomPlugin"
        ]
    }
)
```

## Built-in Plugins

### GraphRAG Plugin

Provides access to knowledge graph:

**Tools**:
- `query_knowledge_graph`: Cypher query execution
- `search_entities`: Semantic entity search
- `get_entity_neighbors`: Relationship traversal
- `add_entity`: Create new entity
- `add_relationship`: Create relationship

### Memory Plugin

Manages conversation and long-term memory:

**Tools**:
- `store_memory`: Save information to memory
- `recall_memory`: Retrieve relevant memories
- `summarize_conversation`: Generate conversation summary
- `get_user_profile`: Fetch user profile context

### Web Search Plugin

Performs web searches:

**Tools**:
- `search_web`: General web search
- `search_news`: News search
- `search_images`: Image search

### File Operations Plugin

File system operations:

**Tools**:
- `read_file`: Read file contents
- `write_file`: Write file
- `list_files`: List directory contents
- `search_files`: Search file contents

## Security

### Authentication

- JWT-based authentication
- API key support for service accounts
- Row-level security for multi-tenant data

### Authorization

- Role-based access control (RBAC)
- Tool-level permissions
- Data access policies

### Rate Limiting

- Per-user rate limits
- Per-tool rate limits
- Burst protection

## Monitoring

### Metrics

- Request latency (p50, p95, p99)
- Tool invocation count
- Plugin performance
- Error rates

### Logging

- Structured JSON logs
- Request/response logging
- Error tracking
- Audit logs

### Health Checks

- Liveness probe: `/health/live`
- Readiness probe: `/health/ready`
- Dependency checks: databases, external APIs

## Performance

### Optimization

- Connection pooling for databases
- Redis caching for frequent queries
- Async I/O throughout
- Batch operations where possible

### Scaling

- Horizontal scaling via load balancer
- Stateless design (state in databases)
- Plugin isolation (can run in separate processes)

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=mcp_server --cov-report=html

# Run specific test
pytest tests/test_plugins.py::test_graphrag_plugin
```

## Deployment

### Cloud Run (GCP)

```bash
# Build and push image
gcloud builds submit --tag gcr.io/PROJECT_ID/mcp-server

# Deploy
gcloud run deploy mcp-server \
  --image gcr.io/PROJECT_ID/mcp-server \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars DATABASE_URL=...,REDIS_URL=...
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -f k8s/

# Check status
kubectl get pods -l app=mcp-server
kubectl logs -f deployment/mcp-server
```

## Troubleshooting

### Plugin Not Loading

1. Check plugin is installed: `pip list | grep plugin-name`
2. Verify entry point in `setup.py`
3. Check logs for initialization errors
4. Ensure plugin dependencies are installed

### Database Connection Issues

1. Verify connection strings in environment
2. Check network connectivity
3. Verify credentials
4. Check database is running and accessible

### High Latency

1. Check database query performance
2. Review cache hit rates
3. Check for N+1 query problems
4. Profile plugin performance

## Contributing

See main project CONTRIBUTING.md for guidelines.

## License

Part of the Life Navigator project.

---

**Maintained by**: Life Navigator Team
**Last Updated**: 2025-10-31
**Version**: 1.0.0
