"""Qdrant client wrapper."""

from qdrant_client import QdrantClient
from qdrant_client.models import (
    Distance,
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    PointIdsList,
    VectorParams,
    SearchRequest,
)
from lib.config import Config

_client: QdrantClient | None = None


def get_client() -> QdrantClient:
    """Return a singleton Qdrant client."""
    global _client
    if _client is None:
        _client = QdrantClient(url=Config.QDRANT_URL, api_key=Config.QDRANT_API_KEY)
    return _client


def upsert_points(
    points: list[dict],
    collection: str | None = None,
) -> None:
    """Upsert points into Qdrant. Each dict: {id, vector, payload}."""
    client = get_client()
    col = collection or Config.QDRANT_COLLECTION
    client.upsert(
        collection_name=col,
        points=[
            PointStruct(
                id=p["id"],
                vector=p["vector"],
                payload=p["payload"],
            )
            for p in points
        ],
        wait=True,
    )


def delete_points(
    ids: list[str],
    collection: str | None = None,
) -> None:
    """Delete points by ID."""
    client = get_client()
    col = collection or Config.QDRANT_COLLECTION
    client.delete(
        collection_name=col,
        points_selector=PointIdsList(points=ids),
        wait=True,
    )


def search(
    vector: list[float],
    tenant_id: str,
    top_k: int | None = None,
    score_threshold: float = 0.3,
    collection: str | None = None,
) -> list[dict]:
    """Tenant-filtered similarity search. Returns list of {id, score, payload}."""
    client = get_client()
    col = collection or Config.QDRANT_COLLECTION
    k = top_k or Config.VECTOR_TOP_K

    results = client.search(
        collection_name=col,
        query_vector=vector,
        query_filter=Filter(
            must=[FieldCondition(key="tenant_id", match=MatchValue(value=tenant_id))]
        ),
        limit=k,
        with_payload=True,
        score_threshold=score_threshold,
    )

    return [
        {
            "id": str(hit.id),
            "score": hit.score,
            "payload": hit.payload or {},
        }
        for hit in results
    ]
