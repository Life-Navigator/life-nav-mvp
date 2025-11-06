# Life Navigator Scripts

This directory contains all operational scripts for the Life Navigator monorepo, organized by purpose.

## Directory Structure

```
scripts/
├── dev/          # Development environment scripts
├── deploy/       # Deployment scripts
├── db/           # Database initialization and migration scripts
└── utils/        # Utility scripts for code generation and configuration
```

## Development Scripts (`dev/`)

### `local-dev.sh`
**Purpose:** Start the local development environment with Docker Compose

**Usage:**
```bash
./scripts/dev/local-dev.sh
```

**What it does:**
- Starts all services via docker-compose.yml
- Sets up PostgreSQL, Redis, Neo4j, Qdrant, GraphDB
- Starts backend API and GraphRAG service
- Exposes services on localhost

**Prerequisites:**
- Docker and Docker Compose installed
- .env files configured

---

### `setup-web.sh`
**Purpose:** Set up the web application development environment

**Usage:**
```bash
./scripts/dev/setup-web.sh
```

**What it does:**
- Installs Node.js dependencies (pnpm)
- Sets up environment variables
- Initializes Prisma client
- Builds packages
- Prepares web app for development

**Prerequisites:**
- Node.js 18+ installed
- pnpm installed

---

### `start-backend.sh`
**Purpose:** Start the FastAPI backend in development mode

**Usage:**
```bash
./scripts/dev/start-backend.sh
```

**What it does:**
- Activates Python virtual environment
- Starts Uvicorn with hot reload
- Exposes API on http://localhost:8000

**Prerequisites:**
- Python 3.11+ installed
- Virtual environment set up
- Dependencies installed via Poetry

---

### `run-admin-ui.sh`
**Purpose:** Run the Streamlit admin dashboard for agent system monitoring

**Usage:**
```bash
./scripts/dev/run-admin-ui.sh
```

**What it does:**
- Starts Streamlit admin interface
- Provides real-time monitoring of agent system
- Shows execution logs, performance metrics

**Prerequisites:**
- Python 3.11+ installed
- Streamlit and dependencies installed
- Agent system running

---

### `start-maverick.sh`
**Purpose:** Quick start script for Maverick LLM model

**Usage:**
```bash
./scripts/dev/start-maverick.sh
```

**What it does:**
- Starts vLLM server with Maverick model
- Configures GPU settings
- Sets up model endpoints for agent system

**Prerequisites:**
- GPU with 24GB+ VRAM (or CPU mode for testing)
- vLLM installed
- Maverick model weights downloaded

---

## Deployment Scripts (`deploy/`)

### `deploy-web.sh`
**Purpose:** Deploy the Next.js web application to production

**Usage:**
```bash
./scripts/deploy/deploy-web.sh [environment]
```

**Arguments:**
- `environment`: dev, staging, or prod (default: prod)

**What it does:**
- Builds Next.js application
- Creates Docker image
- Pushes to container registry
- Deploys to GKE via kubectl
- Runs health checks

**Prerequisites:**
- gcloud CLI authenticated
- kubectl configured
- Docker installed

---

### `prepare-and-build-web.sh`
**Purpose:** Prepare and build the web app for deployment

**Usage:**
```bash
./scripts/deploy/prepare-and-build-web.sh
```

**What it does:**
- Runs linting and type checking
- Builds Next.js production bundle
- Generates static exports if needed
- Optimizes assets

---

### `setup-gcp.sh`
**Purpose:** Set up GCP infrastructure for Life Navigator

**Usage:**
```bash
./scripts/deploy/setup-gcp.sh
```

**What it does:**
- Enables required GCP APIs
- Creates service accounts
- Sets up IAM bindings
- Configures Workload Identity
- Creates Cloud SQL, Redis, GKE resources

**Prerequisites:**
- gcloud CLI authenticated
- Billing enabled on GCP project
- Project ID set: `export PROJECT_ID=your-project-id`

---

## Database Scripts (`db/`)

### `init-graphdb.sh`
**Purpose:** Initialize GraphDB RDF triple store with ontologies

**Usage:**
```bash
./scripts/db/init-graphdb.sh
```

**What it does:**
- Starts GraphDB server
- Creates repository with RDFS+ reasoning
- Loads ontology files (career, education, finance, goals, health)
- Validates SHACL shapes
- Sets up SPARQL endpoints

**Prerequisites:**
- GraphDB running (local or Docker)
- Ontology files in `/ontology` directory

---

### `init-prisma.sh`
**Purpose:** Initialize Prisma database for the web app

**Usage:**
```bash
./scripts/db/init-prisma.sh
```

**What it does:**
- Runs Prisma migrations
- Seeds initial data
- Generates Prisma client

**Prerequisites:**
- PostgreSQL running
- DATABASE_URL configured
- Prisma CLI installed

---

### `migrate-to-postgres.sh`
**Purpose:** Migrate web app database from SQLite to PostgreSQL

**Usage:**
```bash
./scripts/db/migrate-to-postgres.sh
```

**What it does:**
- Exports data from SQLite
- Creates PostgreSQL schema
- Imports data
- Updates connection strings

**Prerequisites:**
- PostgreSQL running and accessible
- Existing SQLite database
- Backup created

---

### `postgres-setup.sh`
**Purpose:** Set up PostgreSQL with extensions and schemas

**Usage:**
```bash
./scripts/db/postgres-setup.sh
```

**What it does:**
- Creates database and users
- Enables pgvector extension
- Sets up schemas (public, auth, storage)
- Configures Row-Level Security
- Grants permissions

**Prerequisites:**
- PostgreSQL 15+ installed
- POSTGRES_PASSWORD environment variable set

---

## Utility Scripts (`utils/`)

### `codegen.sh`
**Purpose:** Generate code from protobuf definitions and GraphQL schemas

**Usage:**
```bash
./scripts/utils/codegen.sh
```

**What it does:**
- Generates gRPC clients/servers from `.proto` files
- Generates TypeScript types from GraphQL schemas
- Generates API client SDKs

**Prerequisites:**
- protoc (Protocol Buffers compiler) installed
- graphql-codegen configured

---

### `create-placeholders.sh`
**Purpose:** Create placeholder files for missing components

**Usage:**
```bash
./scripts/utils/create-placeholders.sh
```

**What it does:**
- Creates empty component files
- Generates basic test stubs
- Sets up directory structure

**Use case:** Development scaffolding

---

### `generate-env.sh`
**Purpose:** Generate environment variable files from templates

**Usage:**
```bash
./scripts/utils/generate-env.sh [environment]
```

**Arguments:**
- `environment`: dev, staging, or prod

**What it does:**
- Copies .env.example to .env
- Prompts for required secrets
- Validates configuration
- Sets environment-specific values

---

## Python Scripts (in root `/scripts`)

The `/scripts` directory also contains Python scripts for testing and benchmarking:

### `benchmark_rust_python.py`
Benchmarks Rust vs Python graph algorithm performance

### `setup_llm_model.py`
Downloads and configures LLM models for the agent system

### `test_vllm_connection.py`
Tests connection to vLLM server

---

## Best Practices

### Running Scripts
- Always run scripts from the monorepo root: `./scripts/dev/local-dev.sh`
- Check script permissions: `chmod +x scripts/**/*.sh`
- Review script output for errors

### Environment Variables
- Source .env files before running scripts: `set -a; source .env; set +a`
- Never commit .env files with secrets
- Use .env.example as templates

### Error Handling
- Scripts should fail fast: `set -e`
- Check prerequisites before execution
- Provide helpful error messages

### Logging
- Scripts log to stdout/stderr
- Capture logs: `./scripts/deploy/deploy-web.sh 2>&1 | tee deploy.log`
- Check logs for debugging

---

## Troubleshooting

### Script Won't Execute
```bash
# Make executable
chmod +x scripts/path/to/script.sh

# Check for Windows line endings (if edited on Windows)
dos2unix scripts/path/to/script.sh
```

### Missing Dependencies
```bash
# Install system dependencies
# See individual script documentation above
```

### Permission Errors
```bash
# Check file ownership
ls -la scripts/

# Fix ownership if needed
chown -R $USER:$USER scripts/
```

---

## Contributing

When adding new scripts:
1. Place in the appropriate subdirectory
2. Make executable: `chmod +x script.sh`
3. Add documentation to this README
4. Include usage examples
5. Add prerequisites and error handling
6. Test in multiple environments

---

## Migration Notes

**Previous Locations:**
- Scripts were scattered in `/apps/web/`, `/apps/web/scripts/`, root directory
- Consolidated on November 5, 2025
- Old script locations retained in web app for Docker-specific scripts only

**Docker-Specific Scripts (Not Moved):**
- `apps/web/docker-entrypoint.sh` - Docker container entrypoint
- `apps/web/docker-setup.sh` - Docker build setup

These remain in place as they are referenced by Dockerfile.
