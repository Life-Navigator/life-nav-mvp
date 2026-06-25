#!/bin/sh
# Fly creates the machine API socket /.fly/api owned root:root, and connecting to a unix socket needs the
# WRITE permission — which only root has by default. The keyless Vertex (Workload Identity Federation) token
# fetch must connect to this socket to mint a Fly OIDC token; but the app runs as the non-root `core` user,
# so without this every Vertex token fetch fails with EACCES and the advisor silently falls back to its
# deterministic reply for ALL real web requests. So: as root, open connect access on the socket, then DROP
# privileges to `core` and exec the app. Best-effort (|| true) so a non-Fly environment (no socket) still boots.
set -e
if [ -S /.fly/api ]; then
  chmod o+rw /.fly/api 2>/dev/null || true
fi
exec setpriv --reuid=10001 --regid=999 --init-groups \
  uvicorn app.main:app --host 0.0.0.0 --port 8080 --workers 2
