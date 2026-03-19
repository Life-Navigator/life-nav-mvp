"""POST /api/compliance_upload — Upload and process regulatory documents.

Auth: service-role only (via x-worker-secret).
Accepts document metadata, triggers text extraction, chunking, and embedding.
Processes up to 20 chunks inline; remainder handled by compliance_process.
"""

from http.server import BaseHTTPRequestHandler
import json
import hmac

from lib.config import Config
from lib import supabase_client, gemini_client, qdrant_client
from lib.document_processor import process_regulatory_document

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-worker-secret",
}

VALID_DOCUMENT_TYPES = {"regulation", "ruling", "guidance", "statute"}
VALID_DOMAINS = {"finance", "health", "legal", "tax", "insurance", "mental_health"}


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
            self._json_response(400, {"error": "Invalid JSON body"})
            return

        # --- Validate required fields ---
        title = body.get("title", "").strip()
        document_type = body.get("document_type", "").strip()
        domain = body.get("domain", "").strip()
        storage_path = body.get("storage_path", "").strip()

        if not all([title, document_type, domain, storage_path]):
            self._json_response(400, {
                "error": "Required fields: title, document_type, domain, storage_path"
            })
            return

        if document_type not in VALID_DOCUMENT_TYPES:
            self._json_response(400, {
                "error": f"document_type must be one of: {sorted(VALID_DOCUMENT_TYPES)}"
            })
            return

        if domain not in VALID_DOMAINS:
            self._json_response(400, {
                "error": f"domain must be one of: {sorted(VALID_DOMAINS)}"
            })
            return

        # --- Validate env ---
        missing = Config.validate()
        if missing:
            self._json_response(503, {"error": f"Missing env vars: {missing}"})
            return

        try:
            sb = supabase_client.get_client()

            # Insert document metadata
            doc_data = {
                "title": title,
                "document_type": document_type,
                "domain": domain,
                "storage_path": storage_path,
                "status": "pending",
            }
            # Optional fields
            for field in ["jurisdiction", "regulation_code", "source_url",
                          "effective_date", "uploaded_by", "total_pages"]:
                if body.get(field):
                    doc_data[field] = body[field]

            resp = (
                sb.schema("compliance")
                .from_("regulatory_documents")
                .insert(doc_data)
                .execute()
            )
            document_id = resp.data[0]["id"]

            # Process document (extract, chunk, embed first batch)
            result = process_regulatory_document(
                document_id=document_id,
                storage_path=storage_path,
                supabase_client=supabase_client,
                gemini_client=gemini_client,
                qdrant_client=qdrant_client,
                max_chunks_inline=20,
            )

            self._json_response(200, {
                "document_id": document_id,
                **result,
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
