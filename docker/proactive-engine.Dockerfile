# ===========================================================================
# Proactive Engine - Cloud Run Job Dockerfile
# ===========================================================================
# Image: us-central1-docker.pkg.dev/lifenav-prod/life-navigator/proactive-engine:beta
# Build: docker build -f docker/proactive-engine.Dockerfile -t proactive-engine .
# ===========================================================================
# This runs as a Cloud Run Job triggered by Cloud Scheduler every 6 hours
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
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry==1.8.4

# Copy dependency files from backend (shares dependencies)
COPY backend/pyproject.toml backend/poetry.lock* ./

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
    ENVIRONMENT=production

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

# Copy proactive worker entrypoint script
COPY docker/scripts/proactive-worker.py ./worker.py

# Change ownership
RUN chown -R appuser:appuser /app

USER appuser

# No EXPOSE needed - this is a batch job, not a service

# Run the proactive scan job
CMD ["python", "worker.py"]
