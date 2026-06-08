"""FastAPI dependency providers (DI).

Clients are constructed from Settings. Tests override ``get_settings`` and/or
individual providers via ``app.dependency_overrides`` to inject fakes — so no
test ever touches a real downstream service.
"""
from __future__ import annotations

from fastapi import Depends

from .agents.memory import MemoryAgent
from .agents.orchestrator import LifeOrchestratorAgent
from .agents.recommendation import RecommendationAgent
from .agents.trust_safety import TrustSafetyAgent
from .auth import AuthenticatedUser, current_user
from .clients.gemini import GeminiClient
from .clients.neo4j import Neo4jClient
from .clients.qdrant import QdrantClient
from .clients.supabase import SupabaseClient
from .config import Settings, get_settings
from .domains.base import DomainService
from .domains.finance import FinanceService
from .domains.registry import DomainRegistry
from .grounding.context_builder import ContextBuilder
from .grounding.retriever import Retriever
from .services.cost_meter import CostMeter
from .services.life_profile import LifeProfileService
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


def get_domain_services(
    finance: FinanceService = Depends(get_finance_service),
) -> dict[str, DomainService]:
    """Registry of domain services. F2: finance only. New domains register here
    and auto-join chat-context, life-profile, and recommendations."""
    return {finance.domain: finance}


def get_retriever(
    gemini: GeminiClient = Depends(get_gemini),
    qdrant: QdrantClient = Depends(get_qdrant),
    neo4j: Neo4jClient = Depends(get_neo4j),
) -> Retriever:
    return Retriever(gemini=gemini, qdrant=qdrant, neo4j=neo4j)


def get_context_builder(
    domain_services: dict[str, DomainService] = Depends(get_domain_services),
    retriever: Retriever = Depends(get_retriever),
) -> ContextBuilder:
    # central_enabled stays False until ln_central is seeded (Phase 8).
    return ContextBuilder(domain_services, retriever, central_enabled=False)


def get_memory_agent(supabase: SupabaseClient = Depends(get_supabase)) -> MemoryAgent:
    return MemoryAgent(supabase=supabase)


def get_trust_safety_agent() -> TrustSafetyAgent:
    return TrustSafetyAgent(_trust_safety)


def get_recommendation_agent() -> RecommendationAgent:
    return RecommendationAgent()


def get_domain_registry(
    services: dict[str, DomainService] = Depends(get_domain_services),
) -> DomainRegistry:
    """Live domain registry. Only registered services are live; unfinished
    domains are never exposed as live (see DomainRegistry.unavailable())."""
    return DomainRegistry(services)


def get_life_profile_service(
    registry: DomainRegistry = Depends(get_domain_registry),
    recommendation_agent: RecommendationAgent = Depends(get_recommendation_agent),
) -> LifeProfileService:
    return LifeProfileService(registry, recommendation_agent)


def get_orchestrator(
    context_builder: ContextBuilder = Depends(get_context_builder),
    gemini: GeminiClient = Depends(get_gemini),
    trust_safety: TrustSafetyAgent = Depends(get_trust_safety_agent),
    memory: MemoryAgent = Depends(get_memory_agent),
) -> LifeOrchestratorAgent:
    return LifeOrchestratorAgent(
        context_builder=context_builder,
        gemini=gemini,
        trust_safety=trust_safety,
        memory=memory,
    )


def authenticated(user: AuthenticatedUser = Depends(current_user)) -> AuthenticatedUser:
    """Alias dependency for protected routes."""
    return user
