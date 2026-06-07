# syntax=docker/dockerfile:1
FROM python:3.12-slim

WORKDIR /app

# System deps for cryptography (PyJWT[crypto]) + httpx TLS.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates build-essential libffi-dev libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Install python deps first for layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App.
COPY app ./app

# Non-root runtime.
RUN useradd --system --uid 10001 core && chown -R core:core /app
USER core

ENV PORT=8080 \
    LOG_LEVEL=info

EXPOSE 8080

# Liveness is /healthz (configured in fly.toml).
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
