# ===========================================================================
# Ingestion Worker - Cloud Run Job Dockerfile
# ===========================================================================
# Image: us-central1-docker.pkg.dev/lifenav-prod/life-navigator/ingestion-worker:beta
# Build: docker build -f docker/ingestion-worker.Dockerfile -t ingestion-worker .
# ===========================================================================
# This runs as a Cloud Run Job triggered on-demand for document ingestion
# ===========================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder - Install dependencies
# -----------------------------------------------------------------------------
FROM python:3.12-slim AS builder

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Install build dependencies (including OCR dependencies)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry
RUN pip install poetry==1.8.4

# Copy dependency files from agents service
COPY services/agents/pyproject.toml services/agents/poetry.lock* ./

# Install dependencies (lock --no-update for stale lock files)
RUN poetry config virtualenvs.create false && \
    poetry lock --no-update && \
    poetry install --only main --no-interaction --no-ansi

# -----------------------------------------------------------------------------
# Stage 2: Runtime - Minimal production image with OCR support
# -----------------------------------------------------------------------------
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    ENVIRONMENT=production \
    ENABLE_TESSERACT=true \
    ENABLE_PADDLEOCR=false

# Install runtime dependencies including Tesseract for OCR
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd -m -u 1000 lna

WORKDIR /app

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy application code
COPY services/agents/mcp-server/ ./mcp-server/
COPY services/agents/graphrag/ ./graphrag/
COPY services/agents/agents/ ./agents/

# Copy ingestion worker entrypoint
COPY docker/scripts/ingestion-worker.py ./worker.py

# Change ownership
RUN chown -R lna:lna /app

USER lna

# No EXPOSE needed - this is a batch job

# Run the ingestion worker
CMD ["python", "worker.py"]
