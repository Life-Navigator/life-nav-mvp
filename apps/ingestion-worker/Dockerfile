# syntax=docker/dockerfile:1

# ---- build stage ----
FROM rust:1.83-slim AS builder
WORKDIR /app

# Pre-cache the dependency graph by building a dummy crate first.
COPY Cargo.toml ./
RUN mkdir -p src && \
    echo 'fn main() {}' > src/main.rs && \
    echo '' > src/lib.rs && \
    cargo build --release --bin ingestion-worker || true && \
    rm -rf src target/release/deps/ingestion_worker* target/release/deps/ingestion-worker*

# Real source build.
COPY src ./src
COPY tests ./tests
RUN cargo build --release --bin ingestion-worker && \
    strip target/release/ingestion-worker

# ---- runtime stage ----
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates libssl3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/target/release/ingestion-worker /usr/local/bin/ingestion-worker

# Fly.io passes config via env vars. We do not bake secrets into the image.
ENV LOG_LEVEL=info \
    WORKER_POLL_INTERVAL_SECONDS=5 \
    WORKER_BATCH_SIZE=25 \
    WORKER_MAX_RETRIES=5

# Run as a non-root user.
RUN useradd --system --uid 10001 worker
USER worker

ENTRYPOINT ["ingestion-worker"]
