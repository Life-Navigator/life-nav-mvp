"""FastAPI dependency providers (DI).

Clients are constructed from Settings. Tests override ``get_settings`` and/or
individual providers via ``app.dependency_overrides`` to inject fakes — so no
test ever touches a real downstream service.
"""
from __future__ import annotations

from fastapi import Depends

from .auth import AuthenticatedUser, current_user
from .clients.gemini import GeminiClient
from .clients.neo4j import Neo4jClient
from .clients.qdrant import QdrantClient
from .clients.supabase import SupabaseClient
from .config import Settings, get_settings
from .domains.finance import FinanceService
from .services.cost_meter import CostMeter
from .services.trust_safety import TrustSafetyGate

# Stateless singletons (no per-request state).
_cost_meter = CostMeter()
_trust_safety = TrustSafetyGate()


def get_supabase(settings: Settings = Depends(get_settings)) -> SupabaseClient:
    return SupabaseClient.from_settings(settings)


def get_qdrant(settings: Settings = Depends(get_settings)) -> QdrantClient:
    return QdrantClient.from_settings(settings)


def get_neo4j(settings: Settings = Depends(get_settings)) -> Neo4jClient:
    return Neo4jClient.from_settings(settings)


def get_gemini(settings: Settings = Depends(get_settings)) -> GeminiClient:
    return GeminiClient.from_settings(settings)


def get_cost_meter() -> CostMeter:
    return _cost_meter


def get_trust_safety() -> TrustSafetyGate:
    return _trust_safety


def get_finance_service(
    supabase: SupabaseClient = Depends(get_supabase),
) -> FinanceService:
    return FinanceService(supabase=supabase)


def authenticated(user: AuthenticatedUser = Depends(current_user)) -> AuthenticatedUser:
    """Alias dependency for protected routes."""
    return user
