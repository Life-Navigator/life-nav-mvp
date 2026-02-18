FROM qdrant/qdrant:v1.15.0

# Install wget for health checks
USER root
RUN apt-get update && \
    apt-get install -y wget && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Don't switch user - the base image handles this
USER root
