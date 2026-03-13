"""POST /api/query — Hybrid search + Gemini answer generation.

Called by Supabase Edge Function or directly by frontend.
Combines Qdrant vector search + Neo4j graph traversal via Gemini NL→Cypher,
fuses with RRF, and generates a personalized answer.
"""

from http.server import BaseHTTPRequestHandler
import json
import hmac
import time

from lib.config import Config
from lib import supabase_client, gemini_client, qdrant_client, neo4j_client
from lib.graph_schema import GRAPH_SCHEMA
from lib.rrf import reciprocal_rank_fusion

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-worker-secret, apikey",
}

ANSWER_SYSTEM = """\
You are Life Navigator, a personalized AI advisor helping users manage goals,
finances, career, and personal development.

You have access to the user's ACTUAL data retrieved from their knowledge graph.
Use it to give specific, personalized, actionable advice.

Guidelines:
- Reference the user's specific goals, accounts, and data
- Consider the user's risk tolerance when advising on finances
- Be encouraging but realistic
- Provide concrete next steps
- If data is missing, acknowledge it honestly
- Never fabricate data about the user
- Keep tone conversational and helpful"""


def _hash_query(query: str) -> str:
    """Simple djb2 hash for cache lookup."""
    h = 5381
    for b in query.strip().lower().encode():
        h = ((h << 5) + h + b) & 0xFFFFFFFF
    return format(h, "x")


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()

    def do_POST(self):
        # --- Parse body ---
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}
        except (json.JSONDecodeError, ValueError):
            self._json_response(400, {"error": "Invalid JSON body"})
            return

        query = body.get("query", "")
        user_id = body.get("user_id")
        stream = body.get("stream", False)
        conversation_id = body.get("conversation_id")
        previous_messages = body.get("previous_messages", [])

        # --- Auth ---
        secret = Config.GRAPHRAG_WORKER_SECRET
        provided = self.headers.get("x-worker-secret", "")
        auth_header = self.headers.get("authorization", "")

        if secret and provided and hmac.compare_digest(provided, secret):
            pass  # Service-to-service auth — user_id from body
        elif auth_header.startswith("Bearer "):
            # Validate JWT via Supabase
            try:
                client = supabase_client.get_client()
                resp = client.auth.get_user(auth_header[7:])
                user_id = resp.user.id
            except Exception:
                self._json_response(401, {"error": "Invalid token"})
                return
        else:
            self._json_response(401, {"error": "Unauthorized"})
            return

        if not query or not user_id:
            self._json_response(400, {"error": "query and user_id are required"})
            return

        # --- Validate env ---
        missing = Config.validate()
        if missing:
            self._json_response(503, {"error": f"Missing env vars: {missing}"})
            return

        try:
            result = self._process_query(
                query, user_id, stream, conversation_id, previous_messages
            )
            self._json_response(200, result)
        except Exception as e:
            self._json_response(500, {"error": str(e)[:2000]})

    def _process_query(
        self,
        query: str,
        user_id: str,
        stream: bool,
        conversation_id: str | None,
        previous_messages: list[dict],
    ) -> dict:
        start_ms = time.time()

        # --- Check cache ---
        q_hash = _hash_query(query)
        if not stream:
            cached = supabase_client.check_query_cache(user_id, q_hash)
            if cached:
                return cached["response"]

        # --- Embed query ---
        query_vector = gemini_client.embed_text(query)

        # --- Parallel hybrid search ---
        # Vector search
        vector_results = []
        try:
            hits = qdrant_client.search(query_vector, tenant_id=user_id)
            vector_results = [
                {
                    "entity_id": h["id"],
                    "entity_type": h["payload"].get("entity_type", "unknown"),
                    "text": h["payload"].get("text", ""),
                    "score": h["score"],
                    "source": "vector",
                    "metadata": h["payload"],
                }
                for h in hits
            ]
        except Exception as e:
            print(f"Qdrant search failed: {e}")

        # Graph search (NL→Cypher)
        graph_results = []
        try:
            cypher_result = gemini_client.nl_to_cypher(query, GRAPH_SCHEMA)
            if cypher_result:
                params = {**cypher_result.get("params", {}), "tenant_id": user_id}
                rows = neo4j_client.run_cypher(cypher_result["cypher"], params)
                graph_results = [
                    {
                        "entity_id": str(row.get("entity_id", row.get("id", f"graph_{i}"))),
                        "entity_type": str(row.get("entity_type", row.get("label", "graph_result"))),
                        "text": json.dumps(row, default=str),
                        "score": 1.0 - i * 0.05,
                        "source": "graph",
                        "metadata": row,
                    }
                    for i, row in enumerate(rows)
                ]
        except Exception as e:
            print(f"Neo4j query failed: {e}")

        # --- RRF fusion ---
        fused = reciprocal_rank_fusion(vector_results, graph_results)

        # --- Build context ---
        context_lines = ["## User Data from Knowledge Graph\n"]
        for r in fused[:15]:
            context_lines.append(f"- [{r['entity_type']}] {r['text']}")
        context = "\n".join(context_lines) if fused else "No relevant data found in the knowledge graph."

        # --- Fetch risk profile for personalization ---
        try:
            client = supabase_client.get_client()
            risk_resp = (
                client.from_("risk_assessments")
                .select("overall_score, risk_level, assessment_type")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .limit(1)
                .maybe_single()
                .execute()
            )
            if risk_resp.data:
                rp = risk_resp.data
                context += f"\n\n## User Risk Profile\n- Risk Level: {rp['risk_level']}\n- Overall Score: {rp['overall_score']}/100\n- Assessment Type: {rp['assessment_type']}"
        except Exception:
            pass

        # --- Generate answer ---
        full_prompt = f"{context}\n\n---\n\nUser question: {query}"
        answer = gemini_client.generate(
            ANSWER_SYSTEM,
            full_prompt,
            temperature=0.7,
            max_tokens=2048,
        )

        duration_ms = int((time.time() - start_ms) * 1000)

        response = {
            "message": answer,
            "conversation_id": conversation_id or f"conv_{user_id[:8]}_{int(time.time())}",
            "sources": [
                {
                    "entity_type": r["entity_type"],
                    "entity_id": r["entity_id"],
                    "score": r["score"],
                    "source": r["source"],
                }
                for r in fused[:5]
            ],
            "metadata": {
                "duration_ms": duration_ms,
                "vector_results": len(vector_results),
                "graph_results": len(graph_results),
                "fused_results": len(fused),
            },
        }

        # --- Cache response ---
        supabase_client.write_query_cache(
            user_id=user_id,
            query_hash=q_hash,
            query_text=query,
            response=response,
            sources=response["sources"],
            confidence=fused[0]["score"] if fused else 0,
            duration_ms=duration_ms,
        )

        return response

    def _json_response(self, code: int, body: dict):
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(json.dumps(body, default=str).encode())
