"""POST /api/ontology — Load TTL ontology files into Neo4j via n10s.

One-time operation to initialize Neo4j with the OWL ontology.
"""

from http.server import BaseHTTPRequestHandler
import json
import hmac
import os

from lib.config import Config
from lib import neo4j_client

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-worker-secret",
}

# Resolve base directory: ontology files are copied into the deployment
# by vercel.json buildCommand (cp -r ../../ontology/* ontology/).
# At runtime they live at ./ontology/ relative to the project root.
_THIS_DIR = os.path.dirname(os.path.abspath(__file__))
_PROJECT_ROOT = os.path.dirname(_THIS_DIR)  # apps/graphrag-pipeline/
_DEFAULT_ONTOLOGY_DIR = os.path.join(_PROJECT_ROOT, "ontology")

# Ontology files — ordered so core loads first
ONTOLOGY_FILES = [
    "core/person.ttl",
    "core/document.ttl",
    "core/cross-domain.ttl",
    "health/condition.ttl",
    "career/profile.ttl",
    "career/job.ttl",
    "education/credentials.ttl",
    "education/institutions.ttl",
    "finance/accounts.ttl",
    "finance/instruments.ttl",
    "finance/strategies.ttl",
    "goals/goal.ttl",
]


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_POST(self):
        # --- Auth ---
        secret = Config.GRAPHRAG_WORKER_SECRET
        if secret:
            provided = self.headers.get("x-worker-secret", "")
            if not hmac.compare_digest(provided, secret):
                self._json_response(401, {"error": "Unauthorized"})
                return

        # --- Parse body ---
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}
        except (json.JSONDecodeError, ValueError):
            body = {}

        # Optional: pass TTL content directly
        inline_ttl = body.get("ttl")
        # Optional: override base directory for TTL files
        base_dir = body.get("base_dir", _DEFAULT_ONTOLOGY_DIR)

        try:
            # Initialize n10s
            neo4j_client.init_n10s()

            results = []

            if inline_ttl:
                # Load inline TTL content
                result = neo4j_client.load_rdf_inline(inline_ttl)
                results.append({"source": "inline", "result": result})
            else:
                # Load all ontology files from disk
                for ttl_path in ONTOLOGY_FILES:
                    full_path = os.path.join(base_dir, ttl_path)
                    try:
                        with open(full_path, "r") as f:
                            ttl_content = f.read()
                        result = neo4j_client.load_rdf_inline(ttl_content)
                        results.append({
                            "file": ttl_path,
                            "status": "loaded",
                            "result": result,
                        })
                    except FileNotFoundError:
                        results.append({
                            "file": ttl_path,
                            "status": "not_found",
                        })
                    except Exception as e:
                        results.append({
                            "file": ttl_path,
                            "status": "error",
                            "error": str(e)[:500],
                        })

            loaded = sum(1 for r in results if r.get("status") == "loaded" or "result" in r)
            self._json_response(200, {
                "status": "ok",
                "files_loaded": loaded,
                "total_files": len(results),
                "details": results,
            })
        except Exception as e:
            self._json_response(500, {"error": str(e)[:2000]})

    def _json_response(self, code: int, body: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(json.dumps(body, default=str).encode())
