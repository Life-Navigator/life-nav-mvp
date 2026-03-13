"""POST /api/reindex — Bulk re-index a Supabase table.

Reads all rows from a given table and enqueues them to graphrag.sync_queue.
Used for initial population or after schema changes.
"""

from http.server import BaseHTTPRequestHandler
import json
import hmac

from lib.config import Config
from lib import supabase_client
from lib.graph_schema import SOURCE_TABLE_MAP

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-worker-secret",
}

# Reverse lookup: source table → entity_type
TABLE_TO_ENTITY = {v: k for k, v in SOURCE_TABLE_MAP.items()}


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
            self._json_response(400, {"error": "Invalid JSON body"})
            return

        table = body.get("table", "")
        entity_type = body.get("entity_type", "")
        batch_size = min(int(body.get("batch_size", 100)), 500)

        # Resolve entity_type from table if not provided
        if not entity_type and table:
            entity_type = TABLE_TO_ENTITY.get(table, "")

        if not entity_type:
            valid_tables = list(SOURCE_TABLE_MAP.values())
            self._json_response(400, {
                "error": "table or entity_type is required",
                "valid_tables": valid_tables,
                "valid_entity_types": list(SOURCE_TABLE_MAP.keys()),
            })
            return

        source_table = SOURCE_TABLE_MAP.get(entity_type, table)
        if not source_table:
            self._json_response(400, {"error": f"Unknown entity_type: {entity_type}"})
            return

        try:
            total_enqueued = 0
            offset = 0

            while True:
                rows = supabase_client.fetch_table_rows(
                    source_table, batch_size=batch_size, offset=offset
                )
                if not rows:
                    break

                for row in rows:
                    row_id = row.get("id", "")
                    user_id = row.get("user_id", "")
                    if not row_id or not user_id:
                        continue

                    supabase_client.enqueue_sync(
                        user_id=user_id,
                        entity_type=entity_type,
                        entity_id=str(row_id),
                        source_table=source_table,
                        operation="upsert",
                        payload=row,
                    )
                    total_enqueued += 1

                offset += len(rows)
                if len(rows) < batch_size:
                    break  # Last batch

            self._json_response(200, {
                "status": "ok",
                "entity_type": entity_type,
                "source_table": source_table,
                "total_enqueued": total_enqueued,
                "batches_processed": (offset // batch_size) + 1,
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
