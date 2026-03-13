"""Supabase admin client (service role)."""

from supabase import create_client, Client
from lib.config import Config

_client: Client | None = None


def get_client() -> Client:
    """Return a singleton Supabase client using the service role key."""
    global _client
    if _client is None:
        _client = create_client(Config.SUPABASE_URL, Config.SUPABASE_SERVICE_ROLE_KEY)
    return _client


def claim_sync_jobs(limit: int = 25) -> list[dict]:
    """Claim pending jobs from graphrag.sync_queue via RPC."""
    client = get_client()
    resp = client.schema("graphrag").rpc("claim_sync_jobs", {"p_limit": limit}).execute()
    return resp.data or []


def complete_sync_job(
    job_id: str,
    neo4j_synced: bool = False,
    qdrant_synced: bool = False,
    error: str | None = None,
) -> None:
    """Mark a sync job as completed or failed."""
    client = get_client()
    params: dict = {"p_job_id": job_id}
    if error:
        params["p_error"] = error
    else:
        params["p_neo4j_synced"] = neo4j_synced
        params["p_qdrant_synced"] = qdrant_synced
    client.schema("graphrag").rpc("complete_sync_job", params).execute()


def check_query_cache(user_id: str, query_hash: str) -> dict | None:
    """Check the query cache for a cached response."""
    from datetime import datetime, timezone

    client = get_client()
    resp = (
        client.schema("graphrag")
        .from_("query_cache")
        .select("response, sources, confidence")
        .eq("user_id", user_id)
        .eq("query_hash", query_hash)
        .gt("expires_at", datetime.now(timezone.utc).isoformat())
        .maybe_single()
        .execute()
    )
    return resp.data


def write_query_cache(
    user_id: str,
    query_hash: str,
    query_text: str,
    response: dict,
    sources: list,
    confidence: float,
    duration_ms: int,
) -> None:
    """Write a query result to cache (fire-and-forget)."""
    try:
        client = get_client()
        client.schema("graphrag").from_("query_cache").insert(
            {
                "user_id": user_id,
                "query_hash": query_hash,
                "query_text": query_text,
                "response": response,
                "sources": sources,
                "confidence": confidence,
                "duration_ms": duration_ms,
            }
        ).execute()
    except Exception:
        pass  # Ignore cache write failures


def fetch_table_rows(table: str, batch_size: int = 100, offset: int = 0) -> list[dict]:
    """Fetch rows from a Supabase table for reindexing."""
    client = get_client()
    # Handle schema-qualified table names like "finance.financial_accounts"
    if "." in table:
        schema, table_name = table.split(".", 1)
        resp = (
            client.schema(schema)
            .from_(table_name)
            .select("*")
            .range(offset, offset + batch_size - 1)
            .execute()
        )
    else:
        resp = (
            client.from_(table)
            .select("*")
            .range(offset, offset + batch_size - 1)
            .execute()
        )
    return resp.data or []


def enqueue_sync(
    user_id: str,
    entity_type: str,
    entity_id: str,
    source_table: str,
    operation: str,
    payload: dict,
) -> None:
    """Enqueue a sync job directly."""
    client = get_client()
    client.schema("graphrag").rpc(
        "enqueue_sync",
        {
            "p_user_id": user_id,
            "p_entity_type": entity_type,
            "p_entity_id": entity_id,
            "p_source_table": source_table,
            "p_operation": operation,
            "p_payload": payload,
        },
    ).execute()
