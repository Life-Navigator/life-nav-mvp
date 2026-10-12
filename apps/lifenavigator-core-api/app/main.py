"""FastAPI app bootstrap for lifenavigator-core-api.

Routers are registered explicitly so the surface is reviewable here. Every
protected route depends on ``app.auth.current_user``; tests pass overrides via
``app.dependency_overrides``.

Layering (ARCHITECTURE_BOUNDARIES.md): this service orchestrates. It holds the
Gemini/Supabase/Qdrant/Neo4j credentials server-side; the frontend never does.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .config import get_settings
from .routers import benefits, career_domain, chat, decision, documents, education_domain, family_domain, finance, health, health_domain, analytics, life as life_discovery_router, life_graph, life_profile, military, plaid, platform_router, readiness, recommendations, reports, share, version


def _configure_logging(level: str) -> None:
    numeric = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(
        level=numeric,
        format='{"level":"%(levelname)s","time":"%(asctime)s","name":"%(name)s","msg":"%(message)s"}',
    )


def create_app() -> FastAPI:
    settings = get_settings()
    _configure_logging(settings.log_level)

    app = FastAPI(
        title="LifeNavigator Core API",
        version=__version__,
        description=(
            "Orchestration tier. Authenticates Supabase JWTs, reads/writes "
            "Supabase (system of record), grounds via Qdrant + Neo4j, reasons "
            "via Gemini (server-side, behind Trust/Safety), and returns complete "
            "domain view-models. Frontend renders; it never assembles raw data."
        ),
    )

    origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()] or ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    # Release identity (/version). Registered beside health because it answers the same class of
    # question — "what is running?" — and Gate H depends on it being reachable without credentials.
    app.include_router(version.router)
    app.include_router(health_domain.router)
    app.include_router(career_domain.router)
    app.include_router(education_domain.router)
    app.include_router(family_domain.router)
    app.include_router(decision.router)
    app.include_router(reports.router)
    app.include_router(readiness.router)
    app.include_router(share.router)
    app.include_router(analytics.router)
    app.include_router(documents.router)
    app.include_router(benefits.router)
    app.include_router(military.router)
    app.include_router(platform_router.router)
    app.include_router(recommendations.router)
    # NO CALCULATOR ROUTER, DELIBERATELY (owner decision 2026-10-11).
    #
    # `/v1/tools` used to expose a catalog of every deterministic calculator plus
    # `POST /v1/tools/{name}/run`, which accepted ARBITRARY user-supplied inputs. Both are gone,
    # along with the `apps/web/src/app/api/tools/run` proxy that fronted them (dead — no UI called
    # it, but the door was open).
    #
    # Three reasons the surface had to close, beyond the owner's instruction:
    #   1. The engine IS the moat. A public calculator catalog hands away the deterministic layer
    #      and lets anyone extract the value without the advisor that frames it.
    #   2. Direct invocation bypasses every guardrail. The number gate, the strict/scenario tiering,
    #      the disclosure tier and the gap-vs-guess discipline all live in the advisor path; a raw
    #      `/run` call returns an unhedged, undisclosed figure computed from inputs the user typed
    #      rather than from their canonical data.
    #   3. User-supplied inputs are unprovenanced. The whole point of `FinancialInputResolver` is
    #      that a cited number traces to real data. A hand-typed input produces a confident figure
    #      about nothing.
    #
    # Calculators remain reachable ONLY through the advisor (`advisor_calculations.py`) and through
    # domain endpoints that compute from CANONICAL data rather than from request bodies — e.g.
    # `/v1/finance/retirement-projection`, which reads the user's own resolved inputs and returns a
    # named missing state instead of accepting substitutes. `test_no_route_exposes_arbitrary_
    # calculator_invocation` keeps it that way.
    app.include_router(life_discovery_router.router)
    app.include_router(life_graph.router)
    app.include_router(finance.router)
    app.include_router(plaid.router)
    app.include_router(life_profile.router)
    app.include_router(chat.router)

    return app


app = create_app()
