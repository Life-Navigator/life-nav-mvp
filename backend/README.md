# Life Navigator Backend

FastAPI backend service for Life Navigator - Multi-tenant HIPAA-compliant platform.

## Features

- FastAPI async web framework
- SQLAlchemy 2.0 with asyncpg
- Multi-tenant architecture with row-level security
- HIPAA-compliant data handling
- Integration with GraphRAG service
- Plaid financial data integration
- Stripe payment processing
- Celery background tasks
- OpenTelemetry observability

## Requirements

- Python 3.11+
- PostgreSQL 14+
- Redis 7+

## Installation

```bash
# Install dependencies
poetry install

# Run migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload
```

## Environment Variables

See `../.env.example` and `docs/deployment/ENVIRONMENT_VARIABLES.md` for configuration.

## Development

```bash
# Run tests
pytest

# Run linting
ruff check .
black --check .

# Run type checking
mypy app/
```
