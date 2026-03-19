"""POST /api/compliance_process — Background processor for pending compliance chunks.

Auth: service-role only (via x-worker-secret).
Processes pending chunks from compliance.document_chunks where
embedding_status = 'pending'. Called by pg_cron or manually after upload.
"""

from http.server import BaseHTTPRequestHandler
import json
import hmac

from lib.config import Config
from lib import supabase_client, gemini_client, qdrant_client
from lib.document_processor import _embed_and_upsert_chunks

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
        # --- Auth: service-role only ---
        secret = Config.GRAPHRAG_WORKER_SECRET
        if not secret:
            self._json_response(503, {"error": "GRAPHRAG_WORKER_SECRET not configured"})
            return

        provided = self.headers.get("x-worker-secret", "")
        if not hmac.compare_digest(provided, secret):
            self._json_response(401, {"error": "Unauthorized — service-role only"})
            return

        # --- Parse body ---
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}
        except (json.JSONDecodeError, ValueError):
            body = {}

        batch_size = min(body.get("batch_size", 50), 100)

        # --- Validate env ---
        missing = Config.validate()
        if missing:
            self._json_response(503, {"error": f"Missing env vars: {missing}"})
            return

        try:
            sb = supabase_client.get_client()

            # Find documents with pending chunks
            docs_resp = (
                sb.schema("compliance")
                .from_("regulatory_documents")
                .select("id")
                .in_("status", ["processing", "pending"])
                .limit(10)
                .execute()
            )
            documents = docs_resp.data or []

            total_embedded = 0
            doc_results = []

            for doc in documents:
                doc_id = doc["id"]
                embedded = _embed_and_upsert_chunks(
                    document_id=doc_id,
                    supabase_client=supabase_client,
                    gemini_client=gemini_client,
                    qdrant_client=qdrant_client,
                    limit=batch_size,
                )
                total_embedded += embedded
                doc_results.append({"document_id": doc_id, "embedded": embedded})

                # Check if all chunks for this doc are done
                pending_resp = (
                    sb.schema("compliance")
                    .from_("document_chunks")
                    .select("id", count="exact")
                    .eq("document_id", doc_id)
                    .eq("embedding_status", "pending")
                    .execute()
                )
                pending_count = pending_resp.count or 0
                if pending_count == 0:
                    sb.schema("compliance").from_("regulatory_documents").update({
                        "status": "completed",
                        "updated_at": "now()",
                    }).eq("id", doc_id).execute()

            self._json_response(200, {
                "status": "ok",
                "documents_processed": len(documents),
                "total_embedded": total_embedded,
                "details": doc_results,
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
