# Lightweight migration runner for Cloud Run Jobs
FROM python:3.12-slim

WORKDIR /app

# Install PostgreSQL client
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy migration scripts
COPY app/db/migrations/ /app/migrations/

# Copy entrypoint script
COPY migrations-entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Run as non-root
RUN useradd -m -u 1000 migrator
USER migrator

ENTRYPOINT ["/app/entrypoint.sh"]
