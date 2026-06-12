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
from ..dependencies import authenticated, get_gemini, get_life_discovery
from ..models.common import UserContext
from ..services.life_discovery import LifeDiscoveryService
from ..services.life_graph_workspace import build_workspace, query_focus

router = APIRouter(prefix="/v1/life-graph", tags=["life-graph"])

_EMPTY = {"nodes": [], "edges": [], "metrics": {"totalNodes": 0, "totalEdges": 0,
                                               "avgConfidence": None, "avgStrength": None, "lastUpdated": None}}


def _ctx(u: AuthenticatedUser) -> UserContext:
    return UserContext(user_id=u.user_id)


@router.get("/workspace")
async def workspace(user: AuthenticatedUser = Depends(authenticated),
                    life: LifeDiscoveryService = Depends(get_life_discovery)):
    """The real explainable graph: nodes + provenance-tagged edges + metrics. Empty if nothing is built."""
    try:
        graph = await life.personal_graph(_ctx(user))
    except Exception:  # noqa: BLE001 — never 500 the canvas; an empty graph is a valid state
        return _EMPTY
    return build_workspace(graph or {})


@router.post("/query-focus")
async def query_focus_endpoint(user: AuthenticatedUser = Depends(authenticated),
                               life: LifeDiscoveryService = Depends(get_life_discovery),
                               gemini: GeminiClient = Depends(get_gemini),
                               query: str = Body(default="", embed=True)):
    """Semantic focus: real embedding-based relevance per node id. No match / no embeddings → {}."""
    try:
        graph = await life.personal_graph(_ctx(user))
        relevance = await query_focus(gemini, graph or {}, query)
    except Exception:  # noqa: BLE001
        relevance = {}
    return {"nodeRelevance": relevance}
