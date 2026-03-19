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
        _client = QdrantClient(url=Config.QDRANT_URL, api_key=Config.QDRANT_API_KEY, prefer_grpc=False)
    return _client


def get_collection_info(collection: str | None = None) -> dict | None:
    """Get collection info for health checks."""
    client = get_client()
    col = collection or Config.QDRANT_COLLECTION
    try:
        info = client.get_collection(collection_name=col)
        return {"points_count": info.points_count, "status": info.status.value}
    except Exception:
        return None


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


def ensure_collection(
    collection: str,
    vector_size: int = 768,
) -> None:
    """Create a Qdrant collection if it does not already exist."""
    client = get_client()
    try:
        client.get_collection(collection_name=collection)
    except Exception:
        client.create_collection(
            collection_name=collection,
            vectors_config=VectorParams(
                size=vector_size,
                distance=Distance.COSINE,
            ),
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


def search_compliance(
    vector: list[float],
    domains: list[str] | None = None,
    top_k: int = 5,
    score_threshold: float = 0.3,
) -> list[dict]:
    """Search compliance_knowledge collection. NO tenant_id filter.

    Optionally filters by domain(s). Returns list of {id, score, payload}.
    """
    client = get_client()
    col = Config.QDRANT_COMPLIANCE_COLLECTION

    query_filter = None
    if domains:
        query_filter = Filter(
            should=[
                FieldCondition(key="domain", match=MatchValue(value=d))
                for d in domains
            ]
        )

    results = client.search(
        collection_name=col,
        query_vector=vector,
        query_filter=query_filter,
        limit=top_k,
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
