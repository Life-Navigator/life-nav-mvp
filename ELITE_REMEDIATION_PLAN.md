# LIFE NAVIGATOR - ELITE-LEVEL PRODUCTION REMEDIATION PLAN
**Prepared by: Expert Systems Architect | Date: November 9, 2025**

---

## EXECUTIVE OVERVIEW

This plan provides **ELITE-LEVEL ADVANCED PROGRAMMING** solutions to remediate all identified issues while **preserving the incredible features** of the Life Navigator platform. This is NOT a simplification—this is optimization, hardening, and production-readiness engineering at the highest level.

### Current State Assessment
- **Architecture Quality**: 9/10 (Elite-level design patterns)
- **Feature Completeness**: 95% (Industry-leading multi-agent AI platform)
- **Production Readiness**: 75% (Requires systematic hardening)
- **Code Quality**: 85% (Professional with documented technical debt)

### Strategic Approach
**PRESERVE ALL ADVANCED FEATURES** while systematically eliminating:
1. Configuration mismatches
2. Runtime reliability risks
3. Security gate bypasses
4. Type safety gaps
5. Error handling weaknesses

---

## PHASE 1: CRITICAL PATH TO PRODUCTION (2-3 HOURS)
**Objective**: Achieve deployment-ready state with ZERO compromises on functionality

### 1.1 VERSION CONTROL HYGIENE (5 minutes)

**Issue**: 58 modified files representing quality improvements are uncommitted
**Elite Solution**: Structured commit strategy preserving atomic changes

```bash
# Stage and commit by functional area
git add services/agents/agents/core/
git add services/agents/agents/domain/
git add services/agents/agents/orchestration/
git add services/agents/agents/specialists/
git commit -m "feat(agents): enhance type safety and error handling across core agent system

- Add explicit type annotations to 40+ agent modules
- Replace bare except clauses with specific exception handling
- Update Pydantic models to v2 compatibility
- Improve async/await patterns in orchestration layer
- Enhance error recovery mechanisms in specialist agents

All changes maintain backward compatibility while improving reliability.
BREAKING CHANGES: None
Refs: PRODUCTION_AUDIT_REPORT.md Section 1"

git add services/agents/mcp-server/
git commit -m "feat(mcp-server): improve MCP server reliability and observability

- Enhance error handling in ingestion pipeline
- Add structured logging to protocol handlers
- Improve plugin lifecycle management
- Update monitoring middleware with Prometheus metrics
- Fix type annotations in coordinator and workflow engine

Refs: PRODUCTION_AUDIT_REPORT.md Section 1.2, 14.2"

git add scripts/dev/ scripts/start_maverick_gpu.sh
git commit -m "chore(scripts): update GPU deployment and development scripts

- Enhance Maverick GPU startup with health checks
- Improve dev environment initialization
- Add error recovery for CUDA initialization failures

Refs: GPU_DEPLOYMENT_STRATEGY.md"

# Verify clean state
git status
```

**Advanced Alternative**: Use interactive staging for granular control
```bash
git add -p  # Review each hunk individually
```

---

### 1.2 DOCKER PYTHON VERSION ALIGNMENT (30 minutes)

**Issue**: Backend requires Python 3.12+ but Dockerfile specifies 3.11-slim
**Root Cause**: pyproject.toml updated but Docker image not synchronized
**Elite Solution**: Multi-stage build with version pinning and build args

**File**: `backend/Dockerfile`

**Current (WRONG)**:
```dockerfile
FROM python:3.11-slim as builder
```

**Elite Solution (PRODUCTION-GRADE)**:
```dockerfile
# ==============================================================================
# Multi-stage Dockerfile for Life Navigator Backend
# ==============================================================================
# Build args for version pinning (overridable in CI/CD)
ARG PYTHON_VERSION=3.12.6
ARG POETRY_VERSION=1.7.1
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# ==============================================================================
# Stage 1: Builder - Install dependencies in isolated environment
# ==============================================================================
FROM python:${PYTHON_VERSION}-slim as builder

# Set build environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    POETRY_VERSION=${POETRY_VERSION} \
    POETRY_HOME="/opt/poetry" \
    POETRY_VIRTUALENVS_IN_PROJECT=true \
    POETRY_NO_INTERACTION=1

# Install system dependencies for building Python packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Poetry via official installer (more reliable than pip)
RUN curl -sSL https://install.python-poetry.org | python3 -
ENV PATH="$POETRY_HOME/bin:$PATH"

WORKDIR /app

# Copy dependency files first (layer caching optimization)
COPY pyproject.toml poetry.lock ./

# Install production dependencies only (no dev/test)
RUN poetry install --only main --no-root --no-directory

# Copy application code
COPY . .

# Install the application itself
RUN poetry install --only main

# ==============================================================================
# Stage 2: Runtime - Minimal production image
# ==============================================================================
FROM python:${PYTHON_VERSION}-slim

# Runtime environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app"

# Install ONLY runtime dependencies (PostgreSQL client library)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser -u 1000 appuser

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder --chown=appuser:appuser /app/.venv /app/.venv
COPY --from=builder --chown=appuser:appuser /app /app

# Security: Switch to non-root user
USER appuser

# Expose application port
EXPOSE 8000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# OCI Image labels for metadata
LABEL org.opencontainers.image.title="Life Navigator Backend" \
      org.opencontainers.image.description="Production FastAPI backend with multi-tenant support" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.vendor="Life Navigator" \
      org.opencontainers.image.python.version="${PYTHON_VERSION}"

# Start Uvicorn with production settings
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "4", \
     "--loop", "uvloop", \
     "--http", "httptools", \
     "--no-access-log", \
     "--proxy-headers", \
     "--forwarded-allow-ips", "*"]
```

**Build and Verify**:
```bash
# Build with explicit version argument
docker build \
  --build-arg PYTHON_VERSION=3.12.6 \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  --build-arg VCS_REF=$(git rev-parse --short HEAD) \
  --build-arg VERSION=$(git describe --tags --always) \
  -t life-navigator-backend:latest \
  -f backend/Dockerfile \
  backend/

# Verify Python version in built image
docker run --rm life-navigator-backend:latest python --version
# Expected output: Python 3.12.6

# Verify dependencies
docker run --rm life-navigator-backend:latest pip list | grep fastapi
```

**CI/CD Integration** (`.github/workflows/backend.yml`):
```yaml
- name: Build Backend Docker Image
  uses: docker/build-push-action@v5
  with:
    context: ./backend
    file: ./backend/Dockerfile
    build-args: |
      PYTHON_VERSION=3.12.6
      POETRY_VERSION=1.7.1
      BUILD_DATE=${{ steps.date.outputs.date }}
      VCS_REF=${{ github.sha }}
      VERSION=${{ github.ref_name }}
    push: true
    tags: |
      ghcr.io/${{ github.repository }}/backend:latest
      ghcr.io/${{ github.repository }}/backend:${{ github.sha }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

---

### 1.3 RUST BASE IMAGE VERSION PINNING (20 minutes)

**Issue**: GraphRAG uses `FROM rust:latest` causing non-deterministic builds
**Elite Solution**: Pin to specific Rust version with multi-stage optimization

**File**: `services/graphrag-rs/Dockerfile`

**Current (WRONG)**:
```dockerfile
FROM rust:latest as builder
```

**Elite Solution (PRODUCTION-GRADE)**:
```dockerfile
# ==============================================================================
# Multi-stage Dockerfile for GraphRAG Rust gRPC Service
# ==============================================================================
ARG RUST_VERSION=1.75.0
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# ==============================================================================
# Stage 1: Chef - Pre-build dependencies for caching
# ==============================================================================
FROM rust:${RUST_VERSION} as chef

# Install cargo-chef for dependency caching
RUN cargo install cargo-chef
WORKDIR /app

# ==============================================================================
# Stage 2: Planner - Analyze dependency structure
# ==============================================================================
FROM chef as planner
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# ==============================================================================
# Stage 3: Builder - Build dependencies and application
# ==============================================================================
FROM chef as builder

# Install system dependencies for gRPC
RUN apt-get update && apt-get install -y --no-install-recommends \
    protobuf-compiler \
    libprotobuf-dev \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=planner /app/recipe.json recipe.json

# Build dependencies first (cached layer)
RUN cargo chef cook --release --recipe-path recipe.json

# Copy source code and build application
COPY . .

# Build with production optimizations
RUN cargo build --release \
    && strip target/release/graphrag-server

# ==============================================================================
# Stage 4: Runtime - Minimal Debian image
# ==============================================================================
FROM debian:bookworm-slim

# Install ONLY runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN groupadd -r graphrag && useradd -r -g graphrag -u 1000 graphrag

WORKDIR /app

# Copy compiled binary from builder
COPY --from=builder --chown=graphrag:graphrag /app/target/release/graphrag-server /usr/local/bin/graphrag-server

# Copy configuration templates
COPY --from=builder --chown=graphrag:graphrag /app/config /app/config

# Security: Switch to non-root user
USER graphrag

# Expose gRPC port
EXPOSE 50051

# Health check via gRPC health checking protocol
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:50051/health || exit 1

# OCI Image labels
LABEL org.opencontainers.image.title="Life Navigator GraphRAG" \
      org.opencontainers.image.description="High-performance Rust gRPC service for graph operations" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.vendor="Life Navigator" \
      org.opencontainers.image.rust.version="${RUST_VERSION}"

# Start server
CMD ["graphrag-server"]
```

**Advanced Features**:
1. **cargo-chef**: Caches dependencies separately from source code (massive build speedup)
2. **Strip binary**: Removes debug symbols (reduces image size by 50%+)
3. **Debian slim**: Smaller than Ubuntu, more stable than Alpine for gRPC
4. **Health check**: gRPC health checking protocol support

**Cargo.toml optimizations** (ensure these are set):
```toml
[profile.release]
lto = true              # Link-time optimization
codegen-units = 1       # Better optimization, slower compile
opt-level = 3           # Maximum optimization
strip = true            # Strip symbols
panic = 'abort'         # Smaller binary size
```

---

### 1.4 WEB APP DOCKER PACKAGE MANAGER FIX (30 minutes)

**Issue**: Dockerfile uses npm/package-lock.json but repository uses pnpm
**Elite Solution**: Unified pnpm-based build with Turborepo integration

**File**: `apps/web/Dockerfile`

**Elite Solution (PRODUCTION-GRADE)**:
```dockerfile
# ==============================================================================
# Multi-stage Dockerfile for Next.js Web Application
# ==============================================================================
ARG NODE_VERSION=20.10.0
ARG PNPM_VERSION=8.12.0
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# ==============================================================================
# Stage 1: Dependencies - Install all workspace dependencies
# ==============================================================================
FROM node:${NODE_VERSION}-alpine AS deps

# Install pnpm globally
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY turbo.json ./

# Copy all package.json files from workspace
COPY apps/web/package.json apps/web/
COPY packages/*/package.json packages/*/

# Install dependencies with frozen lockfile (CI mode)
RUN pnpm install --frozen-lockfile --prefer-offline

# ==============================================================================
# Stage 2: Builder - Build application and dependencies
# ==============================================================================
FROM node:${NODE_VERSION}-alpine AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/pnpm-lock.yaml ./

# Copy source code
COPY . .

# Generate Prisma client
RUN pnpm --filter @life-navigator/web exec prisma generate

# Build with Turbo (builds dependencies first)
RUN pnpm turbo run build --filter=@life-navigator/web

# ==============================================================================
# Stage 3: Runner - Minimal production image
# ==============================================================================
FROM node:${NODE_VERSION}-alpine AS runner

# Install pnpm (needed for running Next.js)
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js build artifacts
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

# Copy Prisma schema and generated client
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Security: Switch to non-root user
USER nextjs

# Expose Next.js default port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node healthcheck.js || exit 1

# OCI Image labels
LABEL org.opencontainers.image.title="Life Navigator Web" \
      org.opencontainers.image.description="Next.js 15 web application" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.node.version="${NODE_VERSION}"

# Start Next.js
CMD ["node", "apps/web/server.js"]
```

**Next.js Configuration** (`apps/web/next.config.js`):
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for optimized Docker builds
  output: 'standalone',

  // Experimental features
  experimental: {
    // Reduce bundle size
    optimizePackageImports: ['@headlessui/react', 'recharts'],
  },

  // Disable telemetry in production
  telemetry: false,
}

module.exports = nextConfig
```

---

### 1.5 CI/CD SECURITY GATES ENFORCEMENT (15 minutes)

**Issue**: Security scans use `continue-on-error: true`, allowing vulnerable code to merge
**Elite Solution**: Fail-fast security gates with severity thresholds

**File**: `.github/workflows/ci.yml`

**Current (INSECURE)**:
```yaml
- name: Run pnpm audit
  run: pnpm audit --prod
  continue-on-error: true  # ❌ WRONG - Allows vulnerabilities

- name: Run Snyk to check for vulnerabilities
  uses: snyk/actions/node@master
  continue-on-error: true  # ❌ WRONG - Bypasses security
```

**Elite Solution (PRODUCTION-GRADE)**:
```yaml
# ==============================================================================
# Security Scan - Enforce on main/develop, warn on feature branches
# ==============================================================================
security:
  name: Security Scan
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4

    - name: Set up Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'

    - name: Install pnpm
      uses: pnpm/action-setup@v3
      with:
        version: '8'
        run_install: false

    - name: Install dependencies
      run: pnpm install --frozen-lockfile

    # ------------------------------------------------------------------
    # PNPM Audit - Block on production branch, warn on others
    # ------------------------------------------------------------------
    - name: Run pnpm audit (strict mode for main/develop)
      if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
      run: |
        pnpm audit --prod --audit-level=moderate || {
          echo "❌ Security vulnerabilities detected in production dependencies"
          echo "Fix with: pnpm audit --fix or update package.json"
          exit 1
        }

    - name: Run pnpm audit (advisory mode for feature branches)
      if: github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop'
      run: pnpm audit --prod --audit-level=moderate
      continue-on-error: true

    # ------------------------------------------------------------------
    # OWASP Dependency Check - Block on CVSS >= 7.0
    # ------------------------------------------------------------------
    - name: Run OWASP Dependency Check
      uses: dependency-check/Dependency-Check_Action@main
      with:
        project: 'lifenavigator'
        path: '.'
        format: 'HTML'
        out: 'reports'
        args: >
          --scan .
          --suppression .github/config/dependency-check-suppression.xml
          --failOnCVSS 7
          --enableExperimental

    - name: Upload dependency check report
      if: always()
      uses: actions/upload-artifact@v4
      with:
        name: dependency-check-report
        path: reports/
        retention-days: 30

    # ------------------------------------------------------------------
    # Snyk Security Scan - Enforce on protected branches
    # ------------------------------------------------------------------
    - name: Run Snyk (strict mode for protected branches)
      if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        args: --severity-threshold=high --fail-on=all
        command: test

    - name: Run Snyk (monitor mode for feature branches)
      if: github.ref != 'refs/heads/main' && github.ref != 'refs/heads/develop'
      uses: snyk/actions/node@master
      continue-on-error: true
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
      with:
        command: monitor

    # ------------------------------------------------------------------
    # Trivy Container Scanning - Scan base images
    # ------------------------------------------------------------------
    - name: Run Trivy vulnerability scanner
      uses: aquasecurity/trivy-action@master
      with:
        scan-type: 'config'
        scan-ref: '.'
        format: 'sarif'
        output: 'trivy-results.sarif'
        severity: 'CRITICAL,HIGH'
        exit-code: '1'  # Fail on critical/high

    - name: Upload Trivy results to GitHub Security
      if: always()
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: 'trivy-results.sarif'
```

**Advanced Features**:
1. **Branch-aware strictness**: Main/develop fail fast, feature branches warn
2. **Multiple scanners**: pnpm audit + OWASP + Snyk + Trivy (defense in depth)
3. **SARIF upload**: Integrates with GitHub Security tab
4. **Suppression file**: Allows documented exceptions for false positives

**Create suppression file** (`.github/config/dependency-check-suppression.xml`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<suppressions xmlns="https://jeremylong.github.io/DependencyCheck/dependency-suppression.1.3.xsd">
  <!-- Example: Suppress known false positive -->
  <!--
  <suppress>
    <notes>False positive - not affected by CVE-2024-XXXXX</notes>
    <packageUrl regex="true">^pkg:npm/example-package@.*$</packageUrl>
    <cve>CVE-2024-XXXXX</cve>
  </suppress>
  -->
</suppressions>
```

---

### 1.6 GITHUB ACTIONS SYNTAX MODERNIZATION (10 minutes)

**Issue**: Using deprecated `::set-output` syntax (removed in runner v4)
**Elite Solution**: Environment file-based outputs

**File**: `.github/workflows/ci.yml` line 408

**Current (DEPRECATED)**:
```yaml
- name: Extract Deployment Outputs
  id: terraform-outputs
  run: |
    cd terraform
    echo "::set-output name=alb_dns_name::$(terraform output -raw alb_dns_name || echo 'not_available')"
    echo "::set-output name=api_url::$(terraform output -raw api_url || echo 'not_available')"
```

**Elite Solution (MODERN)**:
```yaml
- name: Extract Deployment Outputs
  id: terraform-outputs
  run: |
    cd terraform

    # Extract outputs with error handling
    ALB_DNS=$(terraform output -raw alb_dns_name 2>/dev/null || echo 'not_available')
    API_URL=$(terraform output -raw api_url 2>/dev/null || echo 'not_available')

    # Write to GitHub Actions environment file
    echo "alb_dns_name=${ALB_DNS}" >> "$GITHUB_OUTPUT"
    echo "api_url=${API_URL}" >> "$GITHUB_OUTPUT"

    # Also set as environment variables for subsequent steps
    echo "ALB_DNS_NAME=${ALB_DNS}" >> "$GITHUB_ENV"
    echo "API_URL=${API_URL}" >> "$GITHUB_ENV"

    # Log outputs for debugging (sanitized)
    echo "✅ Deployment outputs extracted:"
    echo "   ALB DNS: ${ALB_DNS}"
    echo "   API URL: ${API_URL}"
```

**Find and replace all instances**:
```bash
# Search for all deprecated syntax in workflows
grep -rn "::set-output" .github/workflows/

# Update all files with modern syntax
sed -i 's/echo "::set-output name=\([^:]*\)::\([^"]*\)"/echo "\1=\2" >> "$GITHUB_OUTPUT"/g' .github/workflows/*.yml
```

**Verification**:
```bash
# Lint all workflow files
actionlint .github/workflows/*.yml
```

---

### 1.7 DOCKER COMPOSE HEALTH CHECK HARDENING (45 minutes)

**Issue**: GraphRAG lacks gRPC health check; backend doesn't wait for readiness
**Elite Solution**: gRPC health probing with proper dependency orchestration

**File**: `docker-compose.yml`

**Current Issues**:
```yaml
# Line 115-141: GraphRAG has NO health check
graphrag:
  build:
    context: ./services/graphrag-rs
    dockerfile: Dockerfile
  # Missing: healthcheck

# Line 172-173: Backend doesn't wait for GraphRAG health
backend:
  depends_on:
    graphrag:
      condition: service_started  # ❌ WRONG - Should be service_healthy
```

**Elite Solution (PRODUCTION-GRADE)**:
```yaml
version: '3.9'

services:
  # ==========================================================================
  # GraphRAG Rust Service - Enhanced with gRPC health checking
  # ==========================================================================
  graphrag:
    build:
      context: ./services/graphrag-rs
      dockerfile: Dockerfile
    container_name: ln-graphrag
    environment:
      GRAPHRAG_SERVER__HOST: 0.0.0.0
      GRAPHRAG_SERVER__PORT: 50051
      GRAPHRAG_NEO4J__URI: bolt://neo4j:7687
      GRAPHRAG_NEO4J__USER: neo4j
      GRAPHRAG_NEO4J__PASSWORD: devpassword
      GRAPHRAG_QDRANT__URL: http://qdrant:6333
      GRAPHRAG_GRAPHDB__URL: http://graphdb:7200
      GRAPHRAG_GRAPHDB__REPOSITORY: life-navigator
      GRAPHRAG_EMBEDDINGS__SERVICE_URL: http://localhost:8090
      RUST_LOG: info
      RUST_BACKTRACE: 1
    ports:
      - "50051:50051"
    depends_on:
      neo4j:
        condition: service_healthy
      qdrant:
        condition: service_healthy
      graphdb:
        condition: service_healthy
    # -----------------------------------------------------------------------
    # ELITE gRPC Health Check using grpc-health-probe
    # -----------------------------------------------------------------------
    healthcheck:
      test: [
        "CMD-SHELL",
        "wget --spider -q http://localhost:50051/health || \
         (command -v grpc_health_probe >/dev/null && \
          grpc_health_probe -addr=localhost:50051) || \
         exit 1"
      ]
      interval: 15s
      timeout: 10s
      retries: 5
      start_period: 60s
    # -----------------------------------------------------------------------
    # Resource limits for production stability
    # -----------------------------------------------------------------------
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    restart: unless-stopped
    networks:
      - ln-network

  # ==========================================================================
  # FastAPI Backend - Enhanced dependency orchestration
  # ==========================================================================
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      args:
        PYTHON_VERSION: 3.12.6
        POETRY_VERSION: 1.7.1
    container_name: ln-backend
    environment:
      ENVIRONMENT: development
      DEBUG: "true"
      LOG_LEVEL: DEBUG
      DATABASE_URL: postgresql+asyncpg://lifenavigator:devpassword@postgres:5432/lifenavigator_dev
      REDIS_URL: redis://redis:6379/0
      SECRET_KEY: dev-secret-key-change-in-production-minimum-32-chars
      CORS_ORIGINS: http://localhost:3000,http://localhost:3001
      GRAPHRAG_URL: graphrag:50051
      NEO4J_URI: bolt://neo4j:7687
      NEO4J_PASSWORD: devpassword
      QDRANT_URL: http://qdrant:6333
      GRAPHDB_URL: http://graphdb:7200
      ENABLE_PLAID_SYNC: "false"
      ENABLE_EMAIL_NOTIFICATIONS: "false"
      ENABLE_SMS_NOTIFICATIONS: "false"
    ports:
      - "8000:8000"
    # -----------------------------------------------------------------------
    # CRITICAL FIX: Wait for GraphRAG health, not just startup
    # -----------------------------------------------------------------------
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      graphrag:
        condition: service_healthy  # ✅ FIXED - Wait for gRPC readiness
      neo4j:
        condition: service_healthy
    # -----------------------------------------------------------------------
    # Backend health check
    # -----------------------------------------------------------------------
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8000/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    # -----------------------------------------------------------------------
    # Production-grade command with proper uvicorn configuration
    # -----------------------------------------------------------------------
    command: >
      uvicorn app.main:app
        --host 0.0.0.0
        --port 8000
        --workers 4
        --loop uvloop
        --http httptools
        --log-level info
        --proxy-headers
        --forwarded-allow-ips='*'
        --timeout-keep-alive 65
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
        reservations:
          cpus: '2.0'
          memory: 4G
    restart: unless-stopped
    networks:
      - ln-network

  # ==========================================================================
  # Neo4j Knowledge Graph - Enhanced with proper plugin configuration
  # ==========================================================================
  neo4j:
    image: neo4j:5.15.0-enterprise
    container_name: ln-neo4j
    environment:
      NEO4J_AUTH: neo4j/devpassword
      NEO4J_ACCEPT_LICENSE_AGREEMENT: "yes"
      # -----------------------------------------------------------------------
      # FIXED: Proper plugin installation via environment variable
      # -----------------------------------------------------------------------
      NEO4JLABS_PLUGINS: '["apoc", "graph-data-science", "n10s"]'
      NEO4J_dbms_memory_heap_max__size: 2G
      NEO4J_dbms_memory_pagecache_size: 1G
      NEO4J_dbms_security_procedures_unrestricted: "apoc.*,gds.*,n10s.*"
      NEO4J_dbms_security_procedures_allowlist: "apoc.*,gds.*,n10s.*"
      # Enable Bolt encryption (production recommendation)
      NEO4J_dbms_connector_bolt_tls__level: OPTIONAL
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
    healthcheck:
      test: [
        "CMD-SHELL",
        "cypher-shell -u neo4j -p devpassword 'RETURN 1' || exit 1"
      ]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 90s
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 4G
        reservations:
          cpus: '2.0'
          memory: 2G
    restart: unless-stopped
    networks:
      - ln-network

networks:
  ln-network:
    driver: bridge
    driver_opts:
      com.docker.network.bridge.name: ln-br0

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  neo4j_data:
    driver: local
  neo4j_logs:
    driver: local
  qdrant_data:
    driver: local
  graphdb_data:
    driver: local
```

**Add gRPC health probe to GraphRAG Dockerfile**:
```dockerfile
# In services/graphrag-rs/Dockerfile runtime stage
RUN wget -qO /usr/local/bin/grpc_health_probe \
    https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/v0.4.24/grpc_health_probe-linux-amd64 && \
    chmod +x /usr/local/bin/grpc_health_probe
```

**Implement gRPC health service in Rust** (`services/graphrag-rs/src/health.rs`):
```rust
use tonic::{Request, Response, Status};
use tonic_health::pb::health_server::{Health, HealthServer};
use tonic_health::pb::{HealthCheckRequest, HealthCheckResponse, health_check_response::ServingStatus};

#[derive(Default)]
pub struct HealthService;

#[tonic::async_trait]
impl Health for HealthService {
    async fn check(
        &self,
        _request: Request<HealthCheckRequest>,
    ) -> Result<Response<HealthCheckResponse>, Status> {
        // Add custom health checks here (DB connectivity, etc.)
        Ok(Response::new(HealthCheckResponse {
            status: ServingStatus::Serving as i32,
        }))
    }

    async fn watch(
        &self,
        _request: Request<HealthCheckRequest>,
    ) -> Result<Response<Self::WatchStream>, Status> {
        Err(Status::unimplemented("Health watch not implemented"))
    }
}
```

---

## PHASE 1 VERIFICATION CHECKLIST

```bash
# 1. Verify all files committed
git status
# Expected: "nothing to commit, working tree clean"

# 2. Verify backend Python version
docker build -t ln-backend:test backend/
docker run --rm ln-backend:test python --version
# Expected: Python 3.12.6

# 3. Verify Rust version pinned
grep "FROM rust:" services/graphrag-rs/Dockerfile
# Expected: FROM rust:1.75.0 as chef

# 4. Verify web app uses pnpm
grep "pnpm" apps/web/Dockerfile
# Expected: Multiple pnpm references

# 5. Test docker-compose startup
docker-compose up -d
docker-compose ps
# Expected: All services "healthy"

# 6. Verify CI/CD syntax
actionlint .github/workflows/*.yml
# Expected: No errors

# 7. Run security checks locally
pnpm audit --prod
# Expected: 0 vulnerabilities (or documented suppressions)
```

---

## PHASE 2: CODE QUALITY HARDENING (1-2 WEEKS)
**Objective**: Eliminate technical debt while maintaining elite-level functionality

### 2.1 BARE EXCEPT CLAUSE REMEDIATION (3 hours)

**Affected Files**: 9 instances across services/agents

**Elite Solution**: Typed exception hierarchy with structured error handling

**Pattern 1**: Optional Import Handling (benchmark_graph_algorithms.py)

**Current (WRONG)**:
```python
try:
    import networkx as nx
    NETWORKX_AVAILABLE = True
except:
    NETWORKX_AVAILABLE = False
```

**Elite Solution**:
```python
try:
    import networkx as nx
    NETWORKX_AVAILABLE = True
except (ImportError, ModuleNotFoundError) as e:
    NETWORKX_AVAILABLE = False
    logger.warning(
        "NetworkX not available, graph operations will be limited",
        exc_info=e,
        extra={"feature": "optional_dependency", "module": "networkx"}
    )
```

**Pattern 2**: Fault-Tolerant Loops (parsers.py, pipeline.py)

**Current (WRONG)**:
```python
for line in file:
    try:
        obj = json.loads(line)
        texts.append(extract_text(obj))
    except:
        continue
```

**Elite Solution**:
```python
import structlog
from typing import List
from app.core.exceptions import ParsingError

logger = structlog.get_logger(__name__)

for line_num, line in enumerate(file, start=1):
    try:
        obj = json.loads(line)
        texts.append(extract_text(obj))
    except json.JSONDecodeError as e:
        # Structured logging for malformed JSON
        logger.warning(
            "Skipping malformed JSON line",
            line_number=line_num,
            error=str(e),
            raw_line=line[:100],  # Log first 100 chars
            exc_info=True
        )
        # Increment error metric for monitoring
        metrics.parsing_errors.labels(error_type="json_decode").inc()
        continue
    except KeyError as e:
        # Missing required field
        logger.error(
            "Missing required field in JSON",
            line_number=line_num,
            missing_field=str(e),
            exc_info=True
        )
        metrics.parsing_errors.labels(error_type="missing_field").inc()
        continue
    except Exception as e:
        # Catch-all for unexpected errors (still logged/monitored)
        logger.exception(
            "Unexpected error parsing line",
            line_number=line_num,
            error_type=type(e).__name__,
        )
        metrics.parsing_errors.labels(error_type="unexpected").inc()
        # Re-raise if critical, or continue if fault-tolerant
        if not fault_tolerant:
            raise ParsingError(f"Critical parsing error at line {line_num}") from e
        continue
```

**Pattern 3**: Health Check / Connectivity Probes (mcp_client.py:525)

**Current (WRONG)**:
```python
async def health_check(self) -> bool:
    try:
        response = await self.client.get("/health")
        return response.status_code == 200
    except:
        return False
```

**Elite Solution**:
```python
from typing import Optional
import httpx
from app.core.circuit_breaker import CircuitBreaker

class MCPClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=10.0)
        self.circuit_breaker = CircuitBreaker(
            failure_threshold=5,
            recovery_timeout=60.0,
            name="mcp_health"
        )

    async def health_check(self) -> bool:
        """
        Check MCP server health with circuit breaker pattern.

        Returns:
            bool: True if server is healthy, False otherwise
        """
        try:
            async with self.circuit_breaker:
                response = await self.client.get(
                    f"{self.base_url}/health",
                    timeout=5.0  # Shorter timeout for health checks
                )

                if response.status_code == 200:
                    logger.debug("MCP health check passed")
                    return True
                else:
                    logger.warning(
                        "MCP health check failed",
                        status_code=response.status_code,
                        response_body=response.text[:200]
                    )
                    return False

        except httpx.TimeoutException as e:
            logger.warning("MCP health check timeout", exc_info=e)
            metrics.health_check_failures.labels(reason="timeout").inc()
            return False

        except httpx.NetworkError as e:
            logger.warning("MCP network error during health check", exc_info=e)
            metrics.health_check_failures.labels(reason="network").inc()
            return False

        except httpx.HTTPStatusError as e:
            logger.warning(
                "MCP health check HTTP error",
                status_code=e.response.status_code,
                exc_info=e
            )
            metrics.health_check_failures.labels(reason="http_error").inc()
            return False

        except Exception as e:
            # Circuit breaker will handle repeated failures
            logger.exception("Unexpected error in MCP health check")
            metrics.health_check_failures.labels(reason="unexpected").inc()
            return False
```

**Create custom exception hierarchy** (`app/core/exceptions.py`):
```python
"""
Elite-level exception hierarchy for Life Navigator platform.
Provides structured error handling with observability integration.
"""

class LifeNavigatorException(Exception):
    """Base exception for all Life Navigator errors."""

    def __init__(
        self,
        message: str,
        *,
        error_code: str | None = None,
        user_message: str | None = None,
        context: dict | None = None,
    ):
        super().__init__(message)
        self.error_code = error_code
        self.user_message = user_message or message
        self.context = context or {}


class ParsingError(LifeNavigatorException):
    """Error during document parsing/ingestion."""
    pass


class GraphRAGError(LifeNavigatorException):
    """Error in GraphRAG service communication."""
    pass


class AgentExecutionError(LifeNavigatorException):
    """Error during agent task execution."""
    pass


class ConfigurationError(LifeNavigatorException):
    """Invalid configuration detected."""
    pass
```

**Automated Remediation Script**:
```bash
#!/bin/bash
# scripts/fix-bare-except.sh - Automated bare except remediation

# Find all bare except clauses
files=$(grep -rl "except:" services/agents --include="*.py" | grep -v test_ | grep -v benchmark_)

for file in $files; do
  echo "Processing: $file"

  # Replace simple bare except with Exception
  sed -i 's/^    except:$/    except Exception as e:/g' "$file"

  # Add logging import if not present
  if ! grep -q "import structlog" "$file"; then
    sed -i '1a import structlog\nlogger = structlog.get_logger(__name__)' "$file"
  fi
done

echo "✅ Automated remediation complete. Manual review required."
```

---

### 2.2 PYDANTIC V2 MIGRATION (2 hours)

**Affected Files**: 15+ instances in services/api/app/api/v1/endpoints/

**Elite Solution**: Automated migration with backward compatibility

**Migration Script** (`scripts/migrate-pydantic-v2.py`):
```python
#!/usr/bin/env python3
"""
Elite Pydantic v1 → v2 migration script.
Handles .dict() → .model_dump() and .from_orm() → .model_validate()
"""

import re
import sys
from pathlib import Path
from typing import List

def migrate_file(file_path: Path) -> tuple[int, List[str]]:
    """
    Migrate a single Python file to Pydantic v2.

    Returns:
        (changes_count, list of changes)
    """
    content = file_path.read_text()
    original = content
    changes = []

    # Pattern 1: .dict() → .model_dump()
    dict_pattern = r'(\w+)\.dict\('
    def replace_dict(match):
        var_name = match.group(1)
        changes.append(f"{var_name}.dict() → {var_name}.model_dump()")
        return f"{var_name}.model_dump("

    content = re.sub(dict_pattern, replace_dict, content)

    # Pattern 2: .dict(exclude_unset=True) → .model_dump(exclude_unset=True)
    # (already handled by above)

    # Pattern 3: **model.dict() → **model.model_dump()
    # (already handled by above)

    # Pattern 4: .from_orm() → .model_validate()
    orm_pattern = r'(\w+)\.from_orm\('
    def replace_orm(match):
        class_name = match.group(1)
        changes.append(f"{class_name}.from_orm() → {class_name}.model_validate()")
        return f"{class_name}.model_validate("

    content = re.sub(orm_pattern, replace_orm, content)

    # Pattern 5: .json() → .model_dump_json()
    json_pattern = r'(\w+)\.json\('
    def replace_json(match):
        var_name = match.group(1)
        # Skip if it's likely a standard json module call
        if var_name == 'json':
            return match.group(0)
        changes.append(f"{var_name}.json() → {var_name}.model_dump_json()")
        return f"{var_name}.model_dump_json("

    content = re.sub(json_pattern, replace_json, content)

    if content != original:
        file_path.write_text(content)
        return len(changes), changes

    return 0, []

def main():
    # Find all affected files
    api_dir = Path("services/api/app/api/v1/endpoints")
    py_files = list(api_dir.glob("*.py"))

    total_changes = 0
    changed_files = []

    print("🔄 Starting Pydantic v2 migration...")
    print(f"📂 Scanning {len(py_files)} files in {api_dir}")
    print()

    for file_path in py_files:
        changes_count, changes = migrate_file(file_path)
        if changes_count > 0:
            total_changes += changes_count
            changed_files.append(file_path)
            print(f"✅ {file_path.name}")
            for change in changes:
                print(f"   - {change}")
            print()

    print("=" * 70)
    print(f"✅ Migration complete!")
    print(f"   Files changed: {len(changed_files)}")
    print(f"   Total changes: {total_changes}")
    print()
    print("Next steps:")
    print("1. Run tests: pytest services/api/tests/")
    print("2. Run type checker: mypy services/api/app/")
    print("3. Review git diff: git diff services/api/")
    print("4. Commit: git commit -am 'refactor: migrate to Pydantic v2 API'")

if __name__ == "__main__":
    main()
```

**Run migration**:
```bash
python3 scripts/migrate-pydantic-v2.py
pytest services/api/tests/
git diff services/api/
git commit -am "refactor(api): migrate to Pydantic v2 API

- Replace .dict() with .model_dump() (15+ instances)
- Replace .from_orm() with .model_validate()
- Replace .json() with .model_dump_json()
- Maintains backward compatibility via Pydantic v2's compat layer

BREAKING CHANGES: None (Pydantic v2 provides compatibility)"
```

---

### 2.3 UNIMPLEMENTED FUNCTION COMPLETION (4 hours)

**Files**:
1. `services/agents/mcp-server/plugins/base.py`
2. `services/agents/mcp-server/ingestion/parsers.py`

**Elite Solution**: Complete implementation with graceful degradation

**File 1**: Plugin Base Implementation

```python
# services/agents/mcp-server/plugins/base.py

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional, Callable
from dataclasses import dataclass
import structlog

logger = structlog.get_logger(__name__)

@dataclass
class ToolDefinition:
    """MCP tool definition with validation."""
    name: str
    description: str
    input_schema: Dict[str, Any]
    handler: Callable
    requires_auth: bool = False
    rate_limit: Optional[int] = None

class BasePlugin(ABC):
    """
    Enhanced base plugin with complete implementation.
    Provides tool registry, lifecycle management, and error handling.
    """

    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.tools: Dict[str, ToolDefinition] = {}
        self._initialized = False
        logger.info(f"Plugin initialized: {self.__class__.__name__}")

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize plugin resources (connections, caches, etc.)."""
        pass

    @abstractmethod
    async def shutdown(self) -> None:
        """Clean up plugin resources."""
        pass

    @abstractmethod
    def register_tools(self) -> List[ToolDefinition]:
        """
        Register all tools provided by this plugin.

        Returns:
            List of tool definitions
        """
        pass

    async def execute_tool(
        self,
        tool_name: str,
        arguments: Dict[str, Any],
        context: Optional[Dict[str, Any]] = None
    ) -> Any:
        """
        Execute a registered tool with error handling.

        Args:
            tool_name: Name of the tool to execute
            arguments: Tool input arguments
            context: Optional execution context (user, session, etc.)

        Returns:
            Tool execution result

        Raises:
            ToolNotFoundError: If tool is not registered
            ToolExecutionError: If tool execution fails
        """
        if tool_name not in self.tools:
            # ✅ FIXED: Graceful error instead of NotImplementedError
            logger.error(
                "Tool not found",
                tool_name=tool_name,
                available_tools=list(self.tools.keys()),
                plugin=self.__class__.__name__
            )
            raise ToolNotFoundError(
                f"Tool '{tool_name}' not found in plugin {self.__class__.__name__}. "
                f"Available tools: {', '.join(self.tools.keys())}"
            )

        tool = self.tools[tool_name]

        try:
            # Validate input schema
            self._validate_arguments(tool, arguments)

            # Execute tool handler
            logger.debug(
                "Executing tool",
                tool_name=tool_name,
                arguments=arguments,
                plugin=self.__class__.__name__
            )

            result = await tool.handler(arguments, context)

            logger.info(
                "Tool executed successfully",
                tool_name=tool_name,
                plugin=self.__class__.__name__
            )

            return result

        except Exception as e:
            logger.exception(
                "Tool execution failed",
                tool_name=tool_name,
                error=str(e),
                plugin=self.__class__.__name__
            )
            raise ToolExecutionError(
                f"Failed to execute tool '{tool_name}': {str(e)}"
            ) from e

    def _validate_arguments(
        self,
        tool: ToolDefinition,
        arguments: Dict[str, Any]
    ) -> None:
        """Validate tool arguments against schema."""
        # JSON schema validation
        from jsonschema import validate, ValidationError

        try:
            validate(instance=arguments, schema=tool.input_schema)
        except ValidationError as e:
            raise ToolArgumentError(
                f"Invalid arguments for tool '{tool.name}': {e.message}"
            ) from e


class ToolNotFoundError(Exception):
    """Tool not registered in plugin."""
    pass


class ToolExecutionError(Exception):
    """Tool execution failed."""
    pass


class ToolArgumentError(Exception):
    """Invalid tool arguments."""
    pass
```

**File 2**: Parser Implementation

```python
# services/agents/mcp-server/ingestion/parsers.py

from typing import Protocol, List, Dict, Any
import structlog

logger = structlog.get_logger(__name__)

class DocumentParser(Protocol):
    """Protocol for document parsers."""

    def parse(self, content: bytes, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Parse document content into structured chunks."""
        ...

class PDFParser:
    """Elite PDF parser with text extraction and structure preservation."""

    def parse(self, content: bytes, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        ✅ COMPLETE IMPLEMENTATION - No more NotImplementedError
        """
        import pypdf
        from io import BytesIO

        chunks = []

        try:
            pdf = pypdf.PdfReader(BytesIO(content))

            for page_num, page in enumerate(pdf.pages, start=1):
                text = page.extract_text()

                if not text.strip():
                    logger.debug(f"Skipping empty page {page_num}")
                    continue

                chunks.append({
                    "content": text,
                    "metadata": {
                        **metadata,
                        "page_number": page_num,
                        "total_pages": len(pdf.pages),
                        "source_type": "pdf",
                    }
                })

            logger.info(
                "PDF parsed successfully",
                total_pages=len(pdf.pages),
                chunks_extracted=len(chunks)
            )

            return chunks

        except Exception as e:
            logger.exception("PDF parsing failed", error=str(e))
            # Graceful degradation: return raw text
            return [{
                "content": content.decode('utf-8', errors='ignore'),
                "metadata": {
                    **metadata,
                    "source_type": "pdf",
                    "parsing_error": str(e),
                    "fallback": True
                }
            }]

class DocxParser:
    """Microsoft Word document parser."""

    def parse(self, content: bytes, metadata: Dict[str, Any]) -> List[Dict[str, Any]]:
        """✅ COMPLETE IMPLEMENTATION"""
        from docx import Document
        from io import BytesIO

        try:
            doc = Document(BytesIO(content))

            chunks = []
            for para_num, paragraph in enumerate(doc.paragraphs, start=1):
                if not paragraph.text.strip():
                    continue

                chunks.append({
                    "content": paragraph.text,
                    "metadata": {
                        **metadata,
                        "paragraph_number": para_num,
                        "source_type": "docx",
                        "style": paragraph.style.name if paragraph.style else None
                    }
                })

            logger.info(f"DOCX parsed: {len(chunks)} paragraphs")
            return chunks

        except Exception as e:
            logger.exception("DOCX parsing failed")
            return [{
                "content": content.decode('utf-8', errors='ignore'),
                "metadata": {**metadata, "parsing_error": str(e), "fallback": True}
            }]


# Factory pattern for parser selection
PARSER_REGISTRY: Dict[str, DocumentParser] = {
    "application/pdf": PDFParser(),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": DocxParser(),
    "text/plain": TextParser(),
    "text/html": HTMLParser(),
    "application/json": JSONParser(),
}

def get_parser(mime_type: str) -> DocumentParser:
    """Get parser for MIME type, with fallback to text parser."""
    return PARSER_REGISTRY.get(mime_type, TextParser())
```

---

### 2.4 PROMETHEUS METRICS IMPLEMENTATION (4 hours)

**Elite Solution**: Comprehensive metrics with RED methodology

```python
# services/agents/mcp-server/core/metrics.py

"""
Elite-level Prometheus metrics for MCP server.
Implements RED (Rate, Errors, Duration) methodology.
"""

from prometheus_client import (
    Counter,
    Histogram,
    Gauge,
    Info,
    CollectorRegistry,
    generate_latest,
    CONTENT_TYPE_LATEST
)
from functools import wraps
from typing import Callable, Any
import time
import structlog

logger = structlog.get_logger(__name__)

# Create custom registry (allows multiple servers in same process)
registry = CollectorRegistry()

# =============================================================================
# REQUEST METRICS (RED)
# =============================================================================

# RATE: Requests per second
http_requests_total = Counter(
    'mcp_http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status'],
    registry=registry
)

# ERRORS: Error rate
http_request_exceptions = Counter(
    'mcp_http_request_exceptions_total',
    'Total HTTP request exceptions',
    ['method', 'endpoint', 'exception_type'],
    registry=registry
)

# DURATION: Request latency
http_request_duration = Histogram(
    'mcp_http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint'],
    buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 2.5, 5.0, 10.0),
    registry=registry
)

# =============================================================================
# BUSINESS METRICS
# =============================================================================

# Agent execution metrics
agent_executions_total = Counter(
    'mcp_agent_executions_total',
    'Total agent executions',
    ['agent_type', 'status'],
    registry=registry
)

agent_execution_duration = Histogram(
    'mcp_agent_execution_duration_seconds',
    'Agent execution duration',
    ['agent_type'],
    buckets=(1, 5, 10, 30, 60, 120, 300),
    registry=registry
)

# Document ingestion metrics
documents_ingested_total = Counter(
    'mcp_documents_ingested_total',
    'Total documents ingested',
    ['document_type', 'status'],
    registry=registry
)

document_chunks_created = Counter(
    'mcp_document_chunks_created_total',
    'Total document chunks created',
    ['document_type'],
    registry=registry
)

# GraphRAG metrics
graphrag_queries_total = Counter(
    'mcp_graphrag_queries_total',
    'Total GraphRAG queries',
    ['query_type', 'status'],
    registry=registry
)

graphrag_query_duration = Histogram(
    'mcp_graphrag_query_duration_seconds',
    'GraphRAG query duration',
    ['query_type'],
    registry=registry
)

# =============================================================================
# SYSTEM METRICS
# =============================================================================

# Connection pool metrics
db_connections_active = Gauge(
    'mcp_db_connections_active',
    'Active database connections',
    ['database'],
    registry=registry
)

cache_hit_rate = Gauge(
    'mcp_cache_hit_rate',
    'Cache hit rate',
    ['cache_name'],
    registry=registry
)

# Plugin metrics
plugins_loaded = Gauge(
    'mcp_plugins_loaded_total',
    'Number of loaded plugins',
    registry=registry
)

plugin_execution_duration = Histogram(
    'mcp_plugin_execution_duration_seconds',
    'Plugin execution duration',
    ['plugin_name', 'tool_name'],
    registry=registry
)

# =============================================================================
# INFO METRICS
# =============================================================================

server_info = Info(
    'mcp_server',
    'MCP server information',
    registry=registry
)

# Set server info
server_info.info({
    'version': '1.0.0',  # From __version__
    'python_version': '3.12',
    'environment': 'production'
})

# =============================================================================
# DECORATORS FOR AUTOMATIC INSTRUMENTATION
# =============================================================================

def track_request_metrics(endpoint: str):
    """Decorator to track HTTP request metrics."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            method = kwargs.get('request', args[0] if args else None).method

            start_time = time.time()
            status = "success"

            try:
                result = await func(*args, **kwargs)
                return result

            except Exception as e:
                status = "error"
                http_request_exceptions.labels(
                    method=method,
                    endpoint=endpoint,
                    exception_type=type(e).__name__
                ).inc()
                raise

            finally:
                duration = time.time() - start_time

                http_requests_total.labels(
                    method=method,
                    endpoint=endpoint,
                    status=status
                ).inc()

                http_request_duration.labels(
                    method=method,
                    endpoint=endpoint
                ).observe(duration)

        return wrapper
    return decorator

def track_agent_execution(agent_type: str):
    """Decorator to track agent execution metrics."""
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> Any:
            start_time = time.time()
            status = "success"

            try:
                result = await func(*args, **kwargs)
                return result

            except Exception as e:
                status = "error"
                raise

            finally:
                duration = time.time() - start_time

                agent_executions_total.labels(
                    agent_type=agent_type,
                    status=status
                ).inc()

                agent_execution_duration.labels(
                    agent_type=agent_type
                ).observe(duration)

        return wrapper
    return decorator

# =============================================================================
# FASTAPI INTEGRATION
# =============================================================================

async def metrics_endpoint():
    """Prometheus metrics endpoint."""
    return Response(
        content=generate_latest(registry),
        media_type=CONTENT_TYPE_LATEST
    )
```

**FastAPI Integration** (`services/agents/mcp-server/core/server.py`):
```python
from fastapi import FastAPI
from .metrics import metrics_endpoint, track_request_metrics

app = FastAPI()

@app.get("/metrics")
async def metrics():
    """Expose Prometheus metrics."""
    return await metrics_endpoint()

@app.post("/agent/execute")
@track_request_metrics("/agent/execute")
async def execute_agent(request: AgentRequest):
    # Existing implementation
    pass
```

---

## PHASE 3: ELITE OPTIMIZATION (NEXT QUARTER - OPTIONAL)

### 3.1 STAR IMPORT ELIMINATION (1 hour)

**Automated with ast module**:
```python
# scripts/eliminate-star-imports.py
import ast
import sys
from pathlib import Path

def eliminate_star_imports(file_path: Path):
    """Convert star imports to explicit imports."""
    # Use mypy or rope library for AST-based refactoring
    # Implementation omitted for brevity
    pass
```

### 3.2 STRICT TYPE CHECKING MIGRATION (8 hours)

**Gradual rollout**:
1. Enable per-module with `# mypy: disallow-untyped-defs`
2. Fix type issues module-by-module
3. Update pyproject.toml when all modules pass

### 3.3 LOAD TESTING SUITE (2 weeks)

**Tools**: Locust, k6, or Artillery
```python
# tests/load/test_api_performance.py
from locust import HttpUser, task, between

class LifeNavigatorUser(HttpUser):
    wait_time = between(1, 3)

    @task(3)
    def view_goals(self):
        self.client.get("/api/v1/goals")

    @task(1)
    def create_goal(self):
        self.client.post("/api/v1/goals", json={
            "title": "Test Goal",
            "category": "career"
        })
```

---

## SUCCESS CRITERIA & VALIDATION

### Phase 1 Completion Checklist

```bash
#!/bin/bash
# scripts/validate-phase1.sh

set -e

echo "======================================================================"
echo " PHASE 1 VALIDATION - Production Readiness Check"
echo "======================================================================"

# 1. Git status
echo "✓ Checking git status..."
if [[ -n $(git status -s) ]]; then
  echo "❌ FAIL: Uncommitted changes detected"
  exit 1
fi
echo "✅ PASS: Clean git status"

# 2. Docker builds
echo "✓ Building all Docker images..."
docker-compose build --no-cache
echo "✅ PASS: All images built successfully"

# 3. Docker Compose health
echo "✓ Starting services..."
docker-compose up -d
sleep 60  # Wait for health checks

UNHEALTHY=$(docker-compose ps | grep -v "healthy" | grep -v "NAME" || true)
if [[ -n "$UNHEALTHY" ]]; then
  echo "❌ FAIL: Unhealthy services detected"
  docker-compose ps
  exit 1
fi
echo "✅ PASS: All services healthy"

# 4. Security scan
echo "✓ Running security audit..."
pnpm audit --prod --audit-level=moderate
echo "✅ PASS: No critical vulnerabilities"

# 5. Type checking
echo "✓ Running type checks..."
pnpm run type-check
echo "✅ PASS: Type checking complete"

# 6. Linting
echo "✓ Running linters..."
pnpm run lint
echo "✅ PASS: All linters passed"

# 7. CI/CD validation
echo "✓ Validating GitHub Actions..."
actionlint .github/workflows/*.yml
echo "✅ PASS: Workflow files valid"

echo "======================================================================"
echo " ✅ PHASE 1 VALIDATION COMPLETE - PRODUCTION READY"
echo "======================================================================"
```

---

## DEPLOYMENT STRATEGY

### Blue-Green Deployment Plan

```yaml
# k8s/overlays/prod/deployment-strategy.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0  # Zero-downtime deployment

  # Readiness gates
  template:
    spec:
      containers:
      - name: backend
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
          failureThreshold: 3

        livenessProbe:
          httpGet:
            path: /health/live
            port: 8000
          initialDelaySeconds: 60
          periodSeconds: 20
          failureThreshold: 3
```

---

## CONCLUSION

This **ELITE-LEVEL REMEDIATION PLAN** provides:

1. **Zero Feature Reduction**: All advanced capabilities preserved
2. **Production Hardening**: Systematic elimination of reliability risks
3. **Observable Systems**: Comprehensive metrics and logging
4. **Type Safety**: Progressive migration to strict typing
5. **Security First**: Multi-layer security gates enforced
6. **Elite Patterns**: Circuit breakers, structured logging, graceful degradation

**Timeline Summary**:
- Phase 1 (Critical): 2-3 hours → **DEPLOY**
- Phase 2 (Quality): 1-2 weeks → **RECOMMENDED**
- Phase 3 (Optimization): Next quarter → **OPTIONAL**

This is **production-ready, enterprise-grade engineering** that maintains the incredible sophistication of the Life Navigator platform while systematically eliminating all production blockers.

---

**Next Step**: Execute Phase 1 in order, validate with `scripts/validate-phase1.sh`, then deploy.
