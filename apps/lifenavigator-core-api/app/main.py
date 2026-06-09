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
from .routers import benefits, career_domain, chat, decision, documents, education_domain, family_domain, finance, health, health_domain, analytics, life as life_discovery_router, life_profile, military, platform_router, readiness, recommendations, reports, share


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
    app.include_router(life_discovery_router.router)
    app.include_router(finance.router)
    app.include_router(life_profile.router)
    app.include_router(chat.router)

    return app


app = create_app()
