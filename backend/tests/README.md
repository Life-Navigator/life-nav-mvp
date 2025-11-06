# Backend Tests

Comprehensive test suite for the Life Navigator FastAPI backend.

## Overview

- **Total Test Files:** 4
- **Test Categories:** Unit, Integration, API
- **Coverage Target:** 80%+
- **Test Framework:** pytest with pytest-asyncio

## Test Structure

```
tests/
├── conftest.py                 # Pytest fixtures and configuration
├── api/                        # API endpoint tests
│   ├── test_auth.py           # Authentication endpoints (8 test classes, 20+ tests)
│   └── test_finance.py        # Finance domain endpoints (4 test classes, 15+ tests)
├── integration/                # Integration tests
│   └── test_rls.py            # Row-Level Security tests (5 test classes, 15+ tests)
└── unit/                       # Unit tests (to be added)
```

## Running Tests

### Run All Tests
```bash
cd backend
pytest
```

### Run with Coverage
```bash
pytest --cov=app --cov-report=html
# View coverage: open htmlcov/index.html
```

### Run Specific Test Categories
```bash
# Unit tests only
pytest -m unit

# Integration tests only
pytest -m integration

# API tests only
pytest -m api

# Skip slow tests
pytest -m "not slow"

# Authentication tests
pytest -m auth

# RLS tests
pytest -m rls
```

### Run Specific Test Files
```bash
# Auth tests only
pytest tests/api/test_auth.py

# RLS tests only
pytest tests/integration/test_rls.py

# Finance tests only
pytest tests/api/test_finance.py
```

### Run Specific Test Classes or Functions
```bash
# Specific test class
pytest tests/api/test_auth.py::TestRegistration

# Specific test function
pytest tests/api/test_auth.py::TestRegistration::test_register_success

# Pattern matching
pytest -k "auth"  # Run all tests with "auth" in the name
pytest -k "rls"   # Run all tests with "rls" in the name
```

### Verbose Output
```bash
# Show detailed output
pytest -v

# Show even more details
pytest -vv

# Show local variables on failure
pytest -l

# Show print statements
pytest -s
```

### Parallel Execution (Faster)
```bash
# Install pytest-xdist first
pip install pytest-xdist

# Run tests in parallel
pytest -n auto  # Auto-detect number of CPUs
pytest -n 4     # Use 4 workers
```

## Test Database

Tests use a separate test database to avoid polluting development data.

### Configuration
Set the test database URL in environment variable:
```bash
export TEST_DATABASE_URL="postgresql+asyncpg://postgres:postgres@localhost:5432/lifenavigator_test"
```

Or in `.env`:
```
TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/lifenavigator_test
```

### Setup Test Database
```bash
# Create test database
createdb lifenavigator_test

# Or via psql
psql -U postgres -c "CREATE DATABASE lifenavigator_test;"
```

### Test Isolation
Each test runs in a transaction that is rolled back after the test completes. This ensures:
- Tests don't interfere with each other
- Database state is clean for each test
- Fast test execution (no need to recreate database)

## Test Fixtures

### Authentication Fixtures
- `test_organization` - Creates a test organization
- `test_tenant` - Creates a test tenant
- `test_user` - Creates a test user
- `test_user_tenant` - Creates user-tenant membership
- `auth_token` - Generates JWT token
- `auth_headers` - HTTP headers with Bearer token
- `authenticated_client` - Test client with auth headers

### Database Fixtures
- `db_session` - Async database session (with rollback)
- `db_session_with_rls` - Session with RLS context set
- `second_tenant` - Second tenant for isolation tests
- `second_user` - Second user for access control tests

### Client Fixtures
- `client` - FastAPI test client
- `authenticated_client` - Client with auth headers pre-set

## Test Coverage

### Current Coverage (Phase 2)
- ✅ Authentication (register, login, logout, token refresh)
- ✅ Row-Level Security (tenant isolation, RLS enforcement)
- ✅ Finance domain CRUD (accounts, transactions, budgets)
- ✅ Multi-tenant isolation
- ✅ Permission enforcement

### To Be Added
- Career domain endpoints
- Education domain endpoints
- Goals domain endpoints
- Health domain endpoints
- Relationships domain endpoints
- GraphRAG integration (after gRPC client implementation)
- Error handling edge cases
- Performance tests
- Load tests

## Writing New Tests

### Test File Template
```python
"""
Tests for [feature name].

Tests cover:
- [Test category 1]
- [Test category 2]
"""

import pytest
from fastapi.testclient import TestClient


class TestFeature:
    """Tests for specific feature."""

    def test_something(self, authenticated_client: TestClient):
        """Test description."""
        response = authenticated_client.get("/api/v1/endpoint")

        assert response.status_code == 200
        assert response.json() == expected_data


    @pytest.mark.asyncio
    async def test_async_something(self, db_session: AsyncSession):
        """Test async operation."""
        # Test async code
        result = await some_async_function()

        assert result is not None
```

### Best Practices
1. **Use descriptive test names** - `test_user_can_create_account`
2. **One assertion per test** - Makes failures easier to debug
3. **Use fixtures** - Don't repeat setup code
4. **Test edge cases** - Not just happy paths
5. **Test error handling** - Verify appropriate error responses
6. **Use markers** - Categorize tests (`@pytest.mark.integration`)
7. **Keep tests fast** - Mock external dependencies
8. **Test isolation** - Each test should be independent

### Async Tests
For async code, use `@pytest.mark.asyncio`:
```python
@pytest.mark.asyncio
async def test_async_endpoint(db_session: AsyncSession):
    result = await db_session.execute(query)
    assert result is not None
```

## Continuous Integration

Tests run automatically on:
- Pull requests (via `.github/workflows/pr-checks.yml`)
- Push to main/develop (via `.github/workflows/backend.yml`)

CI pipeline includes:
- Linting (black, ruff)
- Type checking (mypy)
- Tests with coverage
- Coverage upload to Codecov

## Troubleshooting

### Tests Failing Locally
```bash
# Clear pytest cache
pytest --cache-clear

# Recreate test database
dropdb lifenavigator_test
createdb lifenavigator_test

# Check database connection
psql -U postgres -d lifenavigator_test -c "SELECT 1;"
```

### Database Connection Errors
- Ensure PostgreSQL is running: `pg_isready`
- Check TEST_DATABASE_URL is correct
- Verify database exists: `psql -l | grep lifenavigator_test`

### Import Errors
```bash
# Reinstall dependencies
cd backend
poetry install

# Verify app is importable
python -c "from app.main import app; print('OK')"
```

### Slow Tests
```bash
# Find slowest tests
pytest --durations=10

# Profile test execution
pytest --profile
```

## Coverage Reports

### Generate HTML Report
```bash
pytest --cov=app --cov-report=html
open htmlcov/index.html
```

### Generate Terminal Report
```bash
pytest --cov=app --cov-report=term-missing
```

### Coverage Targets
- **Minimum:** 70% (CI will warn)
- **Target:** 80%
- **Ideal:** 90%+

### Excluded from Coverage
- Test files (`tests/`)
- Migrations (`alembic/`, `app/db/migrations/`)
- Init files (`__init__.py`)
- Type checking blocks (`if TYPE_CHECKING:`)

## Resources

- [pytest documentation](https://docs.pytest.org/)
- [pytest-asyncio documentation](https://pytest-asyncio.readthedocs.io/)
- [FastAPI testing](https://fastapi.tiangolo.com/tutorial/testing/)
- [SQLAlchemy testing](https://docs.sqlalchemy.org/en/20/orm/session_transaction.html#joining-a-session-into-an-external-transaction-such-as-for-test-suites)
