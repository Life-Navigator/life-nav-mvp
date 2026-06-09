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
from .domains.career import CareerService
from .domains.education import EducationService
from .domains.family import FamilyService
from .domains.finance import FinanceService
from .domains.health import HealthService
from .domains.registry import DomainRegistry
from .grounding.context_builder import ContextBuilder
from .grounding.retriever import Retriever
from .services.analytics import AnalyticsService
from .services.comp_benefits import CompensationBenefitsEngine
from .services.compensation import CompensationIntelligenceEngine
from .services.financial_planning import FinancialPlanningEngine
from .services.decision_engine import DecisionEngine
from .services.decision_graph import DecisionGraphService
from .services.decision_workspace import DecisionWorkspaceService
from .services.documents import DocumentIntelligenceService
from .services.readiness import LifeReadinessEngine
from .services.sharing import ShareService
from .services.scenario_tree import ScenarioTreeService
from .services.snapshots import SnapshotEngine, TrendAnalyzer
from .services.report_engine import UniversalReportEngine
from .services.cost_meter import CostMeter
from .services.life_profile import LifeProfileService
from .services.market_intelligence import MarketPositionAnalyzer
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


def get_health_service(
    supabase: SupabaseClient = Depends(get_supabase),
) -> HealthService:
    # H1: HealthService backs the /v1/health router but is NOT registered in
    # get_domain_services, so Health stays `unavailable()` in the registry (not
    # unlocked / not in production navigation) until its gates pass.
    return HealthService(supabase=supabase)


def get_career_service(
    supabase: SupabaseClient = Depends(get_supabase),
) -> CareerService:
    # X4: CareerService backs the /v1/career router but is NOT registered in
    # get_domain_services, so Career stays `unavailable()` in the registry (appears
    # in life-profile as a missing domain, not live) until its 15 gates pass + approval.
    comp = CompensationIntelligenceEngine(supabase)
    market = MarketPositionAnalyzer(supabase)
    return CareerService(supabase=supabase, comp=comp, market=market)


def get_family_service(
    supabase: SupabaseClient = Depends(get_supabase),
) -> FamilyService:
    # F2: FamilyService backs the /v1/family router but is NOT registered in
    # get_domain_services, so Family stays `unavailable()` until its gates pass + approval.
    # Income for the insurance/survivor need comes from the Career compensation engine (cited).
    return FamilyService(supabase=supabase, comp=CompensationIntelligenceEngine(supabase))


def get_education_service(
    supabase: SupabaseClient = Depends(get_supabase),
) -> EducationService:
    # E2: EducationService backs the /v1/education router but is NOT registered in
    # get_domain_services, so Education stays `unavailable()` (appears in life-profile as a
    # missing domain, not live) until its gates pass + approval. Its ROI engine cites
    # Career compensation (OEWS) + Scorecard program earnings — no uncited ROI.
    return EducationService(supabase=supabase, comp=CompensationIntelligenceEngine(supabase))


def get_decision_engine(
    supabase: SupabaseClient = Depends(get_supabase),
    education: EducationService = Depends(get_education_service),
    career: CareerService = Depends(get_career_service),
    family: FamilyService = Depends(get_family_service),
) -> DecisionEngine:
    # D1: the cross-domain Decision Engine. Reuses the live domain engines; NOT a registry
    # domain (decisions are produced on demand, persisted as decision graphs).
    return DecisionEngine(supabase=supabase, education=education, career=career, family=family)


def get_domain_services(
    finance: FinanceService = Depends(get_finance_service),
    health: HealthService = Depends(get_health_service),
    career: CareerService = Depends(get_career_service),
    family: FamilyService = Depends(get_family_service),
) -> dict[str, DomainService]:
    """Registry of live domain services. A registered domain auto-joins chat-context,
    life-profile, and recommendations. Finance/Health/Career/Family are live; the
    life-profile aggregation degrades gracefully if any single domain summary fails."""
    return {finance.domain: finance, health.domain: health, career.domain: career, family.domain: family}


def get_report_engine(
    domains: dict[str, DomainService] = Depends(get_domain_services),
    education: EducationService = Depends(get_education_service),
    supabase: SupabaseClient = Depends(get_supabase),
) -> UniversalReportEngine:
    return UniversalReportEngine(domains=domains, education=education, supabase=supabase, trends=TrendAnalyzer(supabase), comp_benefits=CompensationBenefitsEngine(supabase))


def get_readiness_engine(
    domains: dict[str, DomainService] = Depends(get_domain_services),
    education: EducationService = Depends(get_education_service),
    supabase: SupabaseClient = Depends(get_supabase),
) -> LifeReadinessEngine:
    return LifeReadinessEngine(domains=domains, education=education, supabase=supabase, planning=FinancialPlanningEngine(supabase, CompensationBenefitsEngine(supabase)))


def get_share_service(
    supabase: SupabaseClient = Depends(get_supabase),
    reports: UniversalReportEngine = Depends(get_report_engine),
) -> ShareService:
    return ShareService(supabase=supabase, reports=reports)


def get_snapshot_engine(supabase: SupabaseClient = Depends(get_supabase)) -> SnapshotEngine:
    return SnapshotEngine(supabase=supabase)


def get_trend_analyzer(supabase: SupabaseClient = Depends(get_supabase)) -> TrendAnalyzer:
    return TrendAnalyzer(supabase=supabase)


def get_analytics_service(supabase: SupabaseClient = Depends(get_supabase)) -> AnalyticsService:
    return AnalyticsService(supabase=supabase)


def get_document_service(supabase: SupabaseClient = Depends(get_supabase)) -> DocumentIntelligenceService:
    return DocumentIntelligenceService(supabase=supabase)


def get_comp_benefits_engine(supabase: SupabaseClient = Depends(get_supabase)) -> CompensationBenefitsEngine:
    return CompensationBenefitsEngine(supabase=supabase)


def get_decision_workspace(
    decision: DecisionEngine = Depends(get_decision_engine),
    readiness: LifeReadinessEngine = Depends(get_readiness_engine),
) -> DecisionWorkspaceService:
    return DecisionWorkspaceService(decision_engine=decision, readiness_engine=readiness)


def get_decision_graph(
    workspace: DecisionWorkspaceService = Depends(get_decision_workspace),
    comp: CompensationBenefitsEngine = Depends(get_comp_benefits_engine),
    supabase: SupabaseClient = Depends(get_supabase),
) -> DecisionGraphService:
    return DecisionGraphService(workspace=workspace, comp_benefits=comp, supabase=supabase)


def get_financial_planning(supabase: SupabaseClient = Depends(get_supabase)) -> FinancialPlanningEngine:
    return FinancialPlanningEngine(supabase=supabase, comp_benefits=CompensationBenefitsEngine(supabase))


def get_scenario_tree(
    readiness: LifeReadinessEngine = Depends(get_readiness_engine),
    planning: FinancialPlanningEngine = Depends(get_financial_planning),
    supabase: SupabaseClient = Depends(get_supabase),
) -> ScenarioTreeService:
    return ScenarioTreeService(readiness=readiness, planning=planning, supabase=supabase)


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
