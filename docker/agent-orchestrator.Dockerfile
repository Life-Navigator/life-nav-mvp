# ===========================================================================
# Agent Orchestrator - Cloud Run Optimized Dockerfile
# ===========================================================================
# Image: us-central1-docker.pkg.dev/lifenav-prod/life-navigator/agent-orchestrator:beta
# Build: docker build -f docker/agent-orchestrator.Dockerfile -t agent-orchestrator .
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

# Copy dependency files
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
    PORT=8080 \
    USE_LOCAL_EMBEDDINGS=false \
    ENABLE_GPU=false

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

# Copy application code
COPY services/agents/api/ ./api/
COPY services/agents/agents/ ./agents/
COPY services/agents/graphrag/ ./graphrag/
COPY services/agents/mcp-server/ ./mcp-server/

# Change ownership
RUN chown -R lna:lna /app

USER lna

EXPOSE 8080

# Cloud Run uses PORT env var - single worker for scale-to-zero efficiency
CMD exec uvicorn api.main:app --host 0.0.0.0 --port ${PORT} --workers 1 --timeout-keep-alive 30
