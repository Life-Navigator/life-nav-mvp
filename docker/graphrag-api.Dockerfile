# ===========================================================================
# GraphRAG API - Cloud Run Optimized Dockerfile (Python Wrapper)
# ===========================================================================
# Image: us-central1-docker.pkg.dev/lifenav-prod/life-navigator/graphrag-api:beta
# Build: docker build -f docker/graphrag-api.Dockerfile -t graphrag-api .
# ===========================================================================
# NOTE: Uses Python GraphRAG implementation from agents service for Cloud Run
# compatibility. The Rust version can be used when gRPC is needed directly.
# ===========================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder - Install dependencies
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry==1.8.4

# Copy dependency files from agents (contains graphrag dependencies)
COPY services/agents/pyproject.toml services/agents/poetry.lock* ./

# Install dependencies (lock --no-update for stale lock files)
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
    && useradd -m -u 1000 lna

WORKDIR /app

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy GraphRAG application code
COPY services/agents/graphrag/ ./graphrag/
COPY docker/scripts/graphrag-server.py ./server.py

# Change ownership
RUN chown -R lna:lna /app

USER lna

EXPOSE 8080

# Run the GraphRAG HTTP server
CMD exec uvicorn server:app --host 0.0.0.0 --port ${PORT} --workers 1 --timeout-keep-alive 30
