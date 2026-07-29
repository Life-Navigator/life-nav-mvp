"""FastAPI app bootstrap.

Routes are registered explicitly so the surface is reviewable in this
one file. Every protected route depends on
``app.auth.current_user``; tests pass overrides via
``app.dependency_overrides``.
"""
from __future__ import annotations

import json
import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .routes import (
    arcana,
    compliance,
    graphrag,
    health_monitoring,
    optimizer,
    recommendations,
    simulations,
)


def _build_logger(level: str) -> None:
    numeric = getattr(logging, level.upper(), logging.INFO)
    logging.basicConfig(
        level=numeric,
        format='{"level":"%(levelname)s","time":"%(asctime)s","name":"%(name)s","msg":"%(message)s"}',
    )


def _warn_on_residual_supabase_credentials() -> None:
    """Surface Supabase credentials still attached to this service's runtime.

    The 2026-07-29 privilege reduction removed all Supabase config except the JWT secret, because the
    service had zero Supabase read sites. Removing the *code* does not remove the *grant*: if the
    deployment platform still injects SUPABASE_SERVICE_ROLE_KEY, this process still holds a key that
    bypasses every Row-Level Security policy in the project, and a container compromise still leaks it.

    This warns rather than exits: the credential is unused, so refusing to boot would trade a real-but-
    contained exposure for an outage during the migration window. The warning names the exact fix so the
    residual cannot be silently forgotten. See GATEWAY_PRIVILEGE_REDUCTION.md.
    """
    residual = [k for k in ("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_URL", "SUPABASE_ANON_KEY")
                if os.environ.get(k)]
    if residual:
        logging.getLogger("gateway.privilege").warning(
            json.dumps({
                "event": "residual_unused_credential",
                "service": "api-gateway",
                "variables": residual,
                "impact": "service_role bypasses all RLS; this service has no Supabase usage",
                "remediation": "flyctl secrets unset " + " ".join(residual) + " -a lifenavigator-api-gateway",
            })
        )


def create_app() -> FastAPI:
    settings = get_settings()
    _build_logger(settings.log_level)
    _warn_on_residual_supabase_credentials()

    app = FastAPI(
        title="LifeNavigator API gateway",
        version="0.1.0",
        description=(
            "Personal + central GraphRAG retrieval, recommendation, "
            "simulation, optimizer, Arcana lead package, and health "
            "monitoring endpoints. JWT-protected."
        ),
    )

    # CORS — restricted to the configured origins. Default ``*`` for dev.
    origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()] or ["*"]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
        allow_headers=["*"],
    )

    @app.get("/healthz", include_in_schema=False)
    def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/readyz", include_in_schema=False)
    def readyz() -> dict[str, str]:
        # Minimal readiness — full readiness can include downstream ping.
        return {"status": "ok"}

    app.include_router(graphrag.router, prefix="/api/graphrag", tags=["graphrag"])
    app.include_router(recommendations.router, prefix="/api/recommendations", tags=["recommendations"])
    app.include_router(simulations.router, prefix="/api/simulations", tags=["simulations"])
    app.include_router(optimizer.router, prefix="/api/optimizer", tags=["optimizer"])
    app.include_router(compliance.router, prefix="/api/compliance", tags=["compliance"])
    app.include_router(arcana.router, prefix="/api/arcana", tags=["arcana"])
    app.include_router(health_monitoring.router, prefix="/api/health-monitoring", tags=["health-monitoring"])

    return app


app = create_app()
