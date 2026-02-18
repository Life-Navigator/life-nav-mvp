# ==============================================================================
# Market Data Service - Multi-Stage Dockerfile
# ==============================================================================
# Production-grade container for market data collection and normalization
#
# Security:
# - Non-root user
# - Read-only root filesystem
# - No unnecessary packages
# - Minimal attack surface
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Builder
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS builder

WORKDIR /build

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency files
COPY pyproject.toml ./

# Install dependencies to a local directory
RUN pip install --no-cache-dir --user -e .

# ------------------------------------------------------------------------------
# Stage 2: Runtime
# ------------------------------------------------------------------------------
FROM python:3.12-slim

# Create non-root user
RUN useradd -m -u 1000 -s /bin/bash marketdata

WORKDIR /app

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy Python dependencies from builder
COPY --from=builder /root/.local /home/marketdata/.local

# Copy application code
COPY --chown=marketdata:marketdata app/ ./app/

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH=/home/marketdata/.local/bin:$PATH \
    PORT=8002

# Switch to non-root user
USER marketdata

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8002/healthz || exit 1

# Expose port
EXPOSE 8002

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002", "--workers", "2"]
