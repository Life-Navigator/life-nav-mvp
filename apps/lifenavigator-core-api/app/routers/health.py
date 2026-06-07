"""Liveness + readiness.

/healthz  — liveness (process up). Used by the Fly http check.
/readyz   — readiness shape: which downstream dependencies are wired.
            F1 reports configuration presence (fast, deterministic); deep
            liveness pings (the async client.ready() methods) are available
            for a future /readyz?deep=1.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..clients.gemini import GeminiClient
from ..clients.neo4j import Neo4jClient
from ..clients.qdrant import QdrantClient
from ..clients.supabase import SupabaseClient
from ..dependencies import get_gemini, get_neo4j, get_qdrant, get_supabase

router = APIRouter(tags=["health"])


@router.get("/healthz", include_in_schema=False)
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/readyz", include_in_schema=False)
def readyz(
    supabase: SupabaseClient = Depends(get_supabase),
    qdrant: QdrantClient = Depends(get_qdrant),
    neo4j: Neo4jClient = Depends(get_neo4j),
    gemini: GeminiClient = Depends(get_gemini),
) -> dict[str, object]:
    services = {
        "supabase": supabase.configured,
        "qdrant": qdrant.configured,
        "neo4j": neo4j.configured,
        "gemini": gemini.configured,
    }
    return {
        "status": "ok" if all(services.values()) else "degraded",
        "services": services,
    }
