# ===========================================================================
# API Gateway - Cloud Run Optimized Dockerfile
# ===========================================================================
# Image: us-central1-docker.pkg.dev/lifenav-prod/life-navigator/api-gateway:beta
# Build: docker build -f docker/api-gateway.Dockerfile -t api-gateway .
# ===========================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder - Install dependencies
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry==1.8.4

WORKDIR /app

# Copy dependency files from backend
COPY backend/pyproject.toml backend/poetry.lock* ./

# Configure Poetry and install dependencies (lock --no-update for stale lock files)
RUN poetry config virtualenvs.create false && \
    poetry lock --no-update && \
    poetry install --only main --no-interaction --no-ansi

# -----------------------------------------------------------------------------
# Stage 2: Runtime - Minimal production image
# -----------------------------------------------------------------------------
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production \
    PORT=8080

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY backend/app/ ./app/
COPY backend/alembic.ini ./
COPY backend/alembic/ ./alembic/

# Change ownership
RUN chown -R appuser:appuser /app

USER appuser

EXPOSE 8080

# Cloud Run uses PORT env var
CMD exec uvicorn app.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --timeout-keep-alive 30
