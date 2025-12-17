FROM postgres:15-alpine

# Install necessary tools
RUN apk add --no-cache \
    bash \
    curl \
    jq \
    python3

# Create migrations directory
WORKDIR /migrations

# Copy migration files
COPY migrations/ /migrations/

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
