.PHONY: help install dev test lint format docker-up docker-down docker-logs clean

# Default target
help:
	@echo "Life Navigator Agents - Development Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make install        Install dependencies"
	@echo "  make dev            Install dev dependencies"
	@echo ""
	@echo "Testing & Quality:"
	@echo "  make test           Run all tests"
	@echo "  make test-unit      Run unit tests only"
	@echo "  make test-cov       Run tests with coverage report"
	@echo "  make lint           Run all linters (ruff + mypy)"
	@echo "  make format         Format code with black"
	@echo "  make check          Run format, lint, and test"
	@echo ""
	@echo "Docker:"
	@echo "  make docker-up      Start all Docker services"
	@echo "  make docker-down    Stop all Docker services"
	@echo "  make docker-logs    Follow Docker logs"
	@echo "  make docker-test    Run tests in Docker"
	@echo "  make docker-clean   Remove all Docker volumes"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean          Remove build artifacts"
	@echo "  make clean-all      Remove all generated files"

# Install dependencies
install:
	pip install -e .

# Install development dependencies
dev:
	pip install -e ".[dev]"

# Run all tests
test:
	pytest tests/ -v

# Run unit tests only
test-unit:
	pytest tests/unit/ -v

# Run tests with coverage
test-cov:
	pytest tests/ -v --cov=. --cov-report=term-missing --cov-report=html

# Run ruff linter
lint-ruff:
	ruff check .

# Run mypy type checker
lint-mypy:
	mypy --strict utils/ models/

# Run all linters
lint: lint-ruff lint-mypy

# Format code with black
format:
	black .

# Check formatting without making changes
format-check:
	black --check .

# Run all quality checks
check: format lint test

# Start Docker services
docker-up:
	docker-compose up -d

# Start Docker services with GPU support
docker-up-gpu:
	docker-compose --profile gpu up -d

# Start Docker services with app
docker-up-app:
	docker-compose --profile app up -d

# Stop Docker services
docker-down:
	docker-compose down

# Follow Docker logs
docker-logs:
	docker-compose logs -f

# Run tests in Docker
docker-test:
	docker-compose -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from test-runner

# Clean Docker volumes
docker-clean:
	docker-compose down -v
	docker system prune -f

# Remove Python cache and build artifacts
clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name ".pytest_cache" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
	rm -rf htmlcov/
	rm -rf .coverage

# Remove all generated files including Docker volumes
clean-all: clean docker-clean
	rm -rf venv/

# Database migrations (placeholder for future)
db-migrate:
	@echo "Database migrations not yet implemented"

# Generate API documentation (placeholder for future)
docs:
	@echo "API documentation generation not yet implemented"

# Run the application locally (requires services to be running)
run:
	uvicorn api.main:app --reload --host 0.0.0.0 --port 8080
