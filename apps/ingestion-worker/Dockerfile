# syntax=docker/dockerfile:1

# ---- build stage ----
# Rust 1.86+ required: getrandom 0.4 needs edition=2024 (Cargo 1.85+) and
# icu_normalizer 2.2 + icu_properties_data require rustc 1.86.
# Bumped 2026-06-02 during internal-beta deploy.
FROM rust:1.86-slim AS builder
WORKDIR /app

# Single-stage build. (Earlier two-stage pre-cache via dummy lib.rs left
# stale crate metadata that broke module resolution; the pre-cache was
# removed 2026-06-02. Buildkit cache mounts handle dep reuse instead.)
COPY Cargo.toml ./
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
