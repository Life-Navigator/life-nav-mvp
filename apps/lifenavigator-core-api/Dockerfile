# syntax=docker/dockerfile:1
FROM python:3.12-slim

WORKDIR /app

# System deps: cryptography (PyJWT[crypto]) + httpx TLS, plus WeasyPrint's Pango/Cairo
# stack (HTML/CSS/SVG -> PDF) and a base font for the branded report renderer.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates build-essential libffi-dev libssl-dev \
      libpango-1.0-0 libpangocairo-1.0-0 libpangoft2-1.0-0 libcairo2 \
      libgdk-pixbuf-2.0-0 libharfbuzz0b libfontconfig1 shared-mime-info \
      fonts-dejavu-core && \
    rm -rf /var/lib/apt/lists/*

# Install python deps first for layer caching.
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App.
COPY app ./app
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

# The `core` user exists for non-root runtime, BUT the container must START as root so the entrypoint can
# open connect access on Fly's root-owned /.fly/api socket (required for the keyless Vertex/WIF token fetch);
# the entrypoint then drops to `core` (uid 10001) via setpriv before running uvicorn. Running uvicorn directly
# as `core` made every Vertex token fetch fail with EACCES on that socket -> the advisor fell back for ALL users.
RUN useradd --system --uid 10001 core && chown -R core:core /app

# ── Release identity (GET /version, Gate H) ───────────────────────────────────────────────────────
# INJECTED AT BUILD TIME. The image has no .git, so /version cannot derive this at runtime — that is
# the point: a runtime git read reports whatever tree the process sits in, which in a container is a
# lie and in a dev shell is the uncommitted tree. Pass with:
#   --build-arg LN_COMMIT_SHA=$(git rev-parse HEAD) --build-arg LN_BUILD_TIME=$(date -u +%FT%TZ)
# Left EMPTY by default on purpose: /version returns 503 in staging/production when the SHA is
# absent, so a build that forgot to inject it fails loudly instead of serving "unknown".
ARG LN_COMMIT_SHA=""
ARG LN_BUILD_TIME=""
ARG LN_APP_VERSION=""
ARG LN_ENVIRONMENT="production"

ENV PORT=8080 \
    LOG_LEVEL=info \
    LN_COMMIT_SHA=${LN_COMMIT_SHA} \
    LN_BUILD_TIME=${LN_BUILD_TIME} \
    LN_APP_VERSION=${LN_APP_VERSION} \
    LN_ENVIRONMENT=${LN_ENVIRONMENT}

EXPOSE 8080

# Liveness is /healthz (configured in fly.toml). Entrypoint opens the Fly socket then drops to `core`.
ENTRYPOINT ["./entrypoint.sh"]
