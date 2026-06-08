"""Unified cross-domain life profile (F3).

GET /v1/life-profile — one call renders the command center: per-domain cards +
full summaries (finance live now), ranked recommendations, premium missing-data
prompts, known-but-not-live domains (metadata only), and system status.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from ..auth import AuthenticatedUser
from ..clients.gemini import GeminiClient
from ..clients.neo4j import Neo4jClient
from ..clients.qdrant import QdrantClient
from ..clients.supabase import SupabaseClient
from ..dependencies import (
    authenticated,
    get_gemini,
    get_life_profile_service,
    get_neo4j,
    get_qdrant,
    get_supabase,
)
from ..models.common import LifeProfileViewModel, SystemStatus, UserContext
from ..services.life_profile import LifeProfileService

router = APIRouter(prefix="/v1", tags=["life-profile"])


@router.get("/life-profile", response_model=LifeProfileViewModel)
async def life_profile(
    user: AuthenticatedUser = Depends(authenticated),
    svc: LifeProfileService = Depends(get_life_profile_service),
    supabase: SupabaseClient = Depends(get_supabase),
    qdrant: QdrantClient = Depends(get_qdrant),
    neo4j: Neo4jClient = Depends(get_neo4j),
    gemini: GeminiClient = Depends(get_gemini),
) -> LifeProfileViewModel:
    status = SystemStatus(
        supabase=supabase.configured,
        qdrant=qdrant.configured,
        neo4j=neo4j.configured,
        gemini=gemini.configured,
    )
    return await svc.build(UserContext.from_auth(user), status)
