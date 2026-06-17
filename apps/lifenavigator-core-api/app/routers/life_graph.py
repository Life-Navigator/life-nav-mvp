"""Life Graph router (`/v1/life-graph`) — the explainable 3D graph's real data source.

`/workspace` serves the user's REAL persisted life graph mapped to the frontend contract (every edge backed
by a persisted edge or a real shared-node connection, with provenance + citation). `/query-focus` returns
backend-computed semantic relevance over the real nodes. Nothing is fabricated; an empty graph yields an
empty workspace and an empty focus.
"""
from __future__ import annotations

from fastapi import APIRouter, Body, Depends

from ..auth import AuthenticatedUser
from ..clients.gemini import GeminiClient
from ..dependencies import authenticated, get_gemini, get_life_discovery, get_recommendation_os
from ..models.common import UserContext
from ..services.life_discovery import LifeDiscoveryService
from ..services.life_graph_workspace import build_workspace, query_focus
from ..services.recommendations_os import RecommendationOS

router = APIRouter(prefix="/v1/life-graph", tags=["life-graph"])

_EMPTY = {"nodes": [], "edges": [], "metrics": {"totalNodes": 0, "totalEdges": 0,
                                               "avgConfidence": None, "avgStrength": None, "lastUpdated": None}}


def _ctx(u: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=u.user_id)


async def _real_recommendations(reco: RecommendationOS, ctx: UserContext) -> list:
    """Active recommendations (a cheap DB read — generation happens elsewhere). Never blocks the graph."""
    try:
        return await reco.active(ctx)
    except Exception:  # noqa: BLE001
        return []


@router.get("/workspace")
async def workspace(user: AuthenticatedUser = Depends(authenticated),
                    life: LifeDiscoveryService = Depends(get_life_discovery),
                    reco: RecommendationOS = Depends(get_recommendation_os)):
    """The real explainable graph: persisted nodes + provenance-tagged edges + recommendation/evidence
    lineage + metrics. Empty if nothing is built."""
    ctx = _ctx(user)
    try:
        graph = await life.personal_graph(ctx)
    except Exception:  # noqa: BLE001 — never 500 the canvas; an empty graph is a valid state
        graph = {}
    recs = await _real_recommendations(reco, ctx)
    return build_workspace(graph or {}, recs)


@router.post("/query-focus")
async def query_focus_endpoint(user: AuthenticatedUser = Depends(authenticated),
                               life: LifeDiscoveryService = Depends(get_life_discovery),
                               reco: RecommendationOS = Depends(get_recommendation_os),
                               gemini: GeminiClient = Depends(get_gemini),
                               query: str = Body(default="", embed=True)):
    """Semantic focus over the FULL workspace (incl. recommendation/evidence nodes): real embedding-based
    relevance per node id. No match / no embeddings → {}."""
    ctx = _ctx(user)
    try:
        graph = await life.personal_graph(ctx)
        recs = await _real_recommendations(reco, ctx)
        workspace_doc = build_workspace(graph or {}, recs)
        relevance = await query_focus(gemini, workspace_doc, query)
    except Exception:  # noqa: BLE001
        relevance = {}
    return {"nodeRelevance": relevance}
