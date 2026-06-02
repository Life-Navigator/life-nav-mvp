# syntax=docker/dockerfile:1
FROM python:3.12-slim

WORKDIR /app

# System deps for cryptography + httpx tls.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates build-essential libffi-dev libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Install python deps first to maximize layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App.
COPY app ./app
COPY tests ./tests

# Non-root runtime.
RUN useradd --system --uid 10001 api && chown -R api:api /app
USER api

ENV PORT=8080 \
    LOG_LEVEL=info

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080", "--workers", "2"]
