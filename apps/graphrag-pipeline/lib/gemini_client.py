"""Gemini embedding + generation client."""

import json
import httpx
from lib.config import Config

EMBED_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{Config.GEMINI_EMBED_MODEL}:embedContent"
GENERATE_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{Config.GEMINI_GENERATE_MODEL}:generateContent"
STREAM_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{Config.GEMINI_GENERATE_MODEL}:streamGenerateContent?alt=sse"


def embed_text(text: str) -> list[float]:
    """Generate an embedding for the given text via Gemini.

    Explicitly requests output_dimensionality=768 to match Qdrant collection config.
    """
    resp = httpx.post(
        EMBED_URL,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": Config.GEMINI_API_KEY,
        },
        json={
            "model": f"models/{Config.GEMINI_EMBED_MODEL}",
            "content": {"parts": [{"text": text}]},
            "outputDimensionality": Config.EMBEDDING_DIMENSIONS,
        },
        timeout=30.0,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["embedding"]["values"]


def generate(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.1,
    max_tokens: int = 512,
) -> str:
    """Generate text with Gemini Flash (non-streaming)."""
    resp = httpx.post(
        GENERATE_URL,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": Config.GEMINI_API_KEY,
        },
        json={
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"role": "user", "parts": [{"text": user_prompt}]}],
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    data = resp.json()
    return data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")


def generate_stream(
    system_prompt: str,
    messages: list[dict],
    temperature: float = 0.7,
    max_tokens: int = 2048,
):
    """Stream text chunks from Gemini Flash. Yields text strings."""
    with httpx.stream(
        "POST",
        STREAM_URL,
        headers={
            "Content-Type": "application/json",
            "x-goog-api-key": Config.GEMINI_API_KEY,
        },
        json={
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": messages,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
                "topP": 0.9,
            },
        },
        timeout=120.0,
    ) as resp:
        resp.raise_for_status()
        buffer = ""
        for line in resp.iter_lines():
            if not line.startswith("data: "):
                continue
            payload = line[6:].strip()
            if payload == "[DONE]":
                break
            try:
                parsed = json.loads(payload)
                text = (
                    parsed.get("candidates", [{}])[0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                )
                if text:
                    yield text
            except (json.JSONDecodeError, IndexError, KeyError):
                continue


def nl_to_cypher(query: str, graph_schema: str) -> dict | None:
    """Convert a natural language query to Cypher via Gemini.

    Returns {"cypher": "...", "params": {}} or None if not possible.
    """
    system_prompt = f"""\
You are a Neo4j Cypher query generator for a personal life management app.
Given the user's natural-language question, produce ONE read-only Cypher query.

{graph_schema}

RULES:
1. ALWAYS filter by tenant_id = $tenant_id (provided automatically).
2. Only read queries — no CREATE, MERGE, SET, DELETE.
3. RETURN human-readable columns.
4. Limit to 20 rows max.
5. Use OPTIONAL MATCH when a relationship may not exist.

Respond with ONLY a JSON object (no markdown, no explanation):
{{"cypher": "MATCH ...", "params": {{}}}}

$tenant_id is injected automatically — do NOT include it in params.
If the question cannot be answered from this schema, return:
{{"cypher": null, "params": {{}}}}"""

    raw = generate(system_prompt, query)
    # Strip potential markdown code fences
    cleaned = raw.replace("```json", "").replace("```", "").strip()
    try:
        parsed = json.loads(cleaned)
        if not parsed.get("cypher"):
            return None
        return parsed
    except (json.JSONDecodeError, KeyError):
        return None
