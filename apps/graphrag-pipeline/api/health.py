"""GET /api/health — Healthcheck endpoint with real service pings."""

from http.server import BaseHTTPRequestHandler
import json

from lib.config import Config


def _check_supabase() -> str | None:
    try:
        from lib import supabase_client
        client = supabase_client.get_client()
        client.table("profiles").select("id").limit(1).execute()
        return None
    except Exception as e:
        return str(e)[:200]


def _check_qdrant(deep: bool = False) -> str | None:
    try:
        from lib import qdrant_client
        info = qdrant_client.get_collection_info()
        if not info:
            return "collection not found"
        if deep:
            # Write → delete probe to verify actual write permissions
            # Qdrant requires UUID or unsigned int for point IDs
            probe_id = "00000000-0000-0000-0000-000000000000"
            qdrant_client.upsert_points([{
                "id": probe_id,
                "vector": [0.0] * 768,
                "payload": {"_probe": True},
            }])
            qdrant_client.delete_points([probe_id])
        return None
    except Exception as e:
        return str(e)[:200]


def _check_neo4j(deep: bool = False) -> str | None:
    try:
        from lib import neo4j_client
        if deep:
            # Write → delete probe to verify actual write permissions
            neo4j_client.run_cypher(
                "CREATE (n:_HealthProbe {ts: datetime()}) "
                "WITH n DELETE n RETURN 1 AS ok", {}
            )
        else:
            neo4j_client.run_cypher("RETURN 1 AS ok", {})
        return None
    except Exception as e:
        return str(e)[:200]


def _check_gemini() -> str | None:
    try:
        from lib import gemini_client
        vec = gemini_client.embed_text("health check")
        if not vec or len(vec) < 10:
            return "embedding returned empty or truncated vector"
        return None
    except Exception as e:
        return str(e)[:200]


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        # First check env vars
        missing = Config.validate()
        if missing:
            body = {
                "status": "degraded",
                "service": "graphrag-pipeline",
                "version": "1.0.0",
                "missing_env_vars": missing,
            }
            self._respond(503, body)
            return

        # Quick mode: just check env vars (add ?quick=1)
        path = self.path or ""
        if "quick=1" in path or "quick=true" in path:
            self._respond(200, {
                "status": "healthy",
                "service": "graphrag-pipeline",
                "version": "1.0.0",
                "mode": "quick",
            })
            return

        # Deep mode: write→delete probes (add ?deep=1)
        deep = "deep=1" in path or "deep=true" in path

        # Check each service
        services = {}
        checks = {
            "supabase": lambda: _check_supabase(),
            "qdrant": lambda: _check_qdrant(deep=deep),
            "neo4j": lambda: _check_neo4j(deep=deep),
            "gemini": lambda: _check_gemini(),
        }

        for name, check_fn in checks.items():
            try:
                err = check_fn()
                services[name] = {"status": "ok"} if err is None else {"status": "error", "error": err}
            except Exception as e:
                services[name] = {"status": "error", "error": str(e)[:200]}

        all_ok = all(s["status"] == "ok" for s in services.values())
        status = "healthy" if all_ok else "degraded"
        code = 200 if all_ok else 503

        body = {
            "status": status,
            "service": "graphrag-pipeline",
            "version": "1.0.0",
            "services": services,
        }

        self._respond(code, body)

    def _respond(self, code: int, body: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())
