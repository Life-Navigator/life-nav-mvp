"""GET /api/health — Healthcheck endpoint."""

from http.server import BaseHTTPRequestHandler
import json

from lib.config import Config


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        missing = Config.validate()
        status = "healthy" if not missing else "degraded"
        code = 200 if not missing else 503

        body = {
            "status": status,
            "service": "graphrag-pipeline",
            "version": "1.0.0",
        }
        if missing:
            body["missing_env_vars"] = missing

        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())
