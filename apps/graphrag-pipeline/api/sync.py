"""POST /api/sync — Process sync_queue jobs.

Called by cron or Supabase webhook. Claims pending jobs from
graphrag.sync_queue, syncs entities to Neo4j + Qdrant.
"""

from http.server import BaseHTTPRequestHandler
import json
import hmac
import time

from lib.config import Config
from lib import supabase_client
from lib.entity_mapper import sync_entity

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-worker-secret",
}


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

        # --- Validate env ---
        missing = Config.validate()
        if missing:
            self._json_response(503, {"error": f"Missing env vars: {missing}"})
            return

        # --- Parse request body ---
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}
        except (json.JSONDecodeError, ValueError):
            body = {}

        limit = min(max(int(body.get("limit", 25)), 1), Config.MAX_CLAIM)

        # --- Claim jobs ---
        try:
            jobs = supabase_client.claim_sync_jobs(limit)
        except Exception as e:
            self._json_response(500, {"error": f"Claim failed: {e}"})
            return

        summary = {
            "claimed": len(jobs),
            "completed": 0,
            "failed": 0,
            "details": [],
        }

        # --- Process each job ---
        for job in jobs:
            started = time.time()
            job_id = job["id"]
            entity_type = job["entity_type"]
            entity_id = job["entity_id"]
            user_id = job["user_id"]
            operation = job["operation"]
            payload = job.get("payload") or {}

            try:
                result = sync_entity(
                    entity_type=entity_type,
                    entity_id=entity_id,
                    user_id=user_id,
                    operation=operation,
                    payload=payload,
                )

                supabase_client.complete_sync_job(
                    job_id=job_id,
                    neo4j_synced=result["neo4j"],
                    qdrant_synced=result["qdrant"],
                )

                summary["completed"] += 1
                summary["details"].append({
                    "job_id": job_id,
                    "entity_type": entity_type,
                    "operation": operation,
                    "status": "completed",
                    "duration_ms": int((time.time() - started) * 1000),
                })
            except Exception as e:
                err_text = str(e)[:2000]
                supabase_client.complete_sync_job(job_id=job_id, error=err_text)
                summary["failed"] += 1
                summary["details"].append({
                    "job_id": job_id,
                    "entity_type": entity_type,
                    "operation": operation,
                    "status": "failed",
                    "error": err_text,
                    "duration_ms": int((time.time() - started) * 1000),
                })

        self._json_response(200, summary)

    def _json_response(self, code: int, body: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(json.dumps(body).encode())
