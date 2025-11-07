# ===========================================================================
# Multi-stage Dockerfile for GraphRAG Rust Service
# ===========================================================================
# Build: docker build -t graphrag-rs:latest .
# Run: docker run -p 50051:50051 graphrag-rs:latest
# ===========================================================================

# -----------------------------------------------------------------------------
# Stage 1: Builder - Compile Rust binary
# -----------------------------------------------------------------------------
FROM rust:latest as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy manifests
COPY Cargo.toml Cargo.lock ./

# Copy proto files and build script
COPY proto/ ./proto/
COPY build.rs ./

# Copy source code
COPY src/ ./src/

# Copy configuration
COPY config.toml ./

# Build for release
RUN cargo build --release

# -----------------------------------------------------------------------------
# Stage 2: Runtime - Minimal Debian image
# -----------------------------------------------------------------------------
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Create app directory
WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/graphrag-rs /usr/local/bin/graphrag-rs

# Copy config from builder
COPY --from=builder /app/config.toml ./config.toml

# Change ownership
RUN chown -R appuser:appuser /app /usr/local/bin/graphrag-rs

# Switch to non-root user
USER appuser

# Expose gRPC port
EXPOSE 50051

# Health check (requires grpcurl or similar)
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD pgrep graphrag-rs || exit 1

# Run the service
CMD ["graphrag-rs"]
