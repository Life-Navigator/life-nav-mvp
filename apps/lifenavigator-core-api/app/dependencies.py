"""FastAPI dependency providers (DI).

Clients are constructed from Settings. Tests override ``get_settings`` and/or
individual providers via ``app.dependency_overrides`` to inject fakes — so no
test ever touches a real downstream service.
"""
from __future__ import annotations

import os

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
from .services.family_office import FamilyOfficeService
from .services.guidance import GuidanceEngine
from .services.financial_planning import FinancialPlanningEngine
from .services.financial_resolver import FinancialInputResolver
from .services.health_intelligence import HealthIntelligenceService
from .services.decision_brain import DecisionBrainService
from .services.decision_engine import DecisionEngine
from .services.decision_graph import DecisionGraphService
from .services.decision_workspace import DecisionWorkspaceService
from .services.documents import DocumentIntelligenceService
from .services.life_bridge import LifeBridgeService
from .services.life_discovery import LifeDiscoveryService
from .services.discovery_coverage import DiscoveryCoverageService
from .services.my_life import MyLifeService
from .services.readiness import LifeReadinessEngine
from .services.recommendations_os import RecommendationOS
from .services.relationship_manager import RelationshipManager
from .services.sharing import ShareService
from .services.scenario_compare import ScenarioComparisonEngine
from .services.scenario_tree import ScenarioTreeService
from .services.snapshots import SnapshotEngine, TrendAnalyzer
from .services.report_engine import UniversalReportEngine
from .services.cost_meter import CostMeter
from .services.life_profile import LifeProfileService
from .services.market_intelligence import MarketPositionAnalyzer
from .services.platform_access import PlatformAccess
from .services.military import MilitaryService
from .services.tools import ToolRunner
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


def get_plaid(settings: Settings = Depends(get_settings)) -> "PlaidClient":
    from .clients.plaid import PlaidClient

    return PlaidClient.from_settings(settings)


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
    readiness = LifeReadinessEngine(domains=domains, education=education, supabase=supabase, planning=FinancialPlanningEngine(supabase, CompensationBenefitsEngine(supabase)))
    return UniversalReportEngine(domains=domains, education=education, supabase=supabase, trends=TrendAnalyzer(supabase), comp_benefits=CompensationBenefitsEngine(supabase), reco_os=RecommendationOS(supabase), readiness=readiness)


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


def get_conflict_service(supabase: SupabaseClient = Depends(get_supabase)):
    from .services.conflicts import ConflictDetectionService
    return ConflictDetectionService(supabase)


def get_resume_service(supabase: SupabaseClient = Depends(get_supabase)):
    from .services.resume import ResumeImportService
    return ResumeImportService(supabase)


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
    return DecisionGraphService(workspace=workspace, comp_benefits=comp, supabase=supabase, reco_os=RecommendationOS(supabase))


def get_financial_planning(supabase: SupabaseClient = Depends(get_supabase)) -> FinancialPlanningEngine:
    return FinancialPlanningEngine(supabase=supabase, comp_benefits=CompensationBenefitsEngine(supabase))


def get_scenario_tree(
    readiness: LifeReadinessEngine = Depends(get_readiness_engine),
    planning: FinancialPlanningEngine = Depends(get_financial_planning),
    supabase: SupabaseClient = Depends(get_supabase),
) -> ScenarioTreeService:
    return ScenarioTreeService(readiness=readiness, planning=planning, supabase=supabase,
                               comp_benefits=CompensationBenefitsEngine(supabase))


def get_family_office(
    supabase: SupabaseClient = Depends(get_supabase),
    family: FamilyService = Depends(get_family_service),
) -> FamilyOfficeService:
    return FamilyOfficeService(supabase=supabase, family_service=family, comp_benefits=CompensationBenefitsEngine(supabase))


def get_health_intelligence(supabase: SupabaseClient = Depends(get_supabase)) -> HealthIntelligenceService:
    return HealthIntelligenceService(supabase=supabase)


def get_military_service(supabase: SupabaseClient = Depends(get_supabase)) -> MilitaryService:
    return MilitaryService(supabase=supabase)


def get_platform_access(
    supabase: SupabaseClient = Depends(get_supabase),
    settings: Settings = Depends(get_settings),
) -> PlatformAccess:
    return PlatformAccess(supabase=supabase, admin_emails=settings.admin_email_set())


def get_life_discovery(supabase: SupabaseClient = Depends(get_supabase)) -> LifeDiscoveryService:
    return LifeDiscoveryService(supabase)


def get_life_bridge(supabase: SupabaseClient = Depends(get_supabase)) -> LifeBridgeService:
    return LifeBridgeService(supabase, LifeDiscoveryService(supabase))


def get_relationship_manager(supabase: SupabaseClient = Depends(get_supabase),
                             settings: Settings = Depends(get_settings)) -> RelationshipManager:
    # Onboarding interpreter LLM — same proven path as the advisor (Vertex/WIF in prod). Optional + fail-safe:
    # if it can't be built or is unavailable, the RelationshipManager falls back to deterministic extraction.
    gem = None
    try:
        if settings.model_provider.lower() == "vertex":
            from .clients.gemini import VertexGeminiClient
            from .clients.vertex_auth import AdcTokenProvider
            gem = VertexGeminiClient.from_settings(settings, AdcTokenProvider())
        else:
            gem = get_gemini(settings)
    except Exception:  # noqa: BLE001 — interpreter is an enhancement; never block discovery construction
        gem = None
    return RelationshipManager(supabase, LifeDiscoveryService(supabase),
                               LifeBridgeService(supabase, LifeDiscoveryService(supabase)), gemini=gem)


def get_advisor_orchestrator(
    supabase: SupabaseClient = Depends(get_supabase),
    rm: RelationshipManager = Depends(get_relationship_manager),
    gemini: GeminiClient = Depends(get_gemini),
    settings: Settings = Depends(get_settings),
) -> "AdvisorOrchestrator":
    # Hybrid advisor: rules supply guardrails (classified facts, discovery scores, domain priorities,
    # safety), the LLM leads the conversation within them, a validator gates the output. Env-flagged
    # (default ON); falls back to pure rule-based automatically if Gemini is unavailable or output is
    # rejected. The LLM never writes to the DB — persistence stays in the deterministic engine.
    from .services.advisor_context import AdvisorContextBuilder
    from .services.advisor_llm import GeminiAdvisorLLM, VertexClaudeAdvisorLLM
    from .services.advisor_orchestrator import AdvisorOrchestrator
    enabled = os.environ.get("ADVISOR_LLM_ENABLED", "true").lower() in ("1", "true", "yes")
    # Claude Control Experiment (feature-flagged; Gemini is the default). When USE_VERTEX_CLAUDE is on, the
    # SAME advisor pipeline runs with Claude on Vertex as the model — nothing else changes — so any benchmark
    # delta is attributable to the model alone.
    use_claude = os.environ.get("USE_VERTEX_CLAUDE", "false").lower() in ("1", "true", "yes")
    # Per-domain discovery scores + the real personal graph feed the LLM's question prioritisation and
    # relationship reasoning. Built inline because get_discovery_coverage is defined later in this module
    # (avoids a forward-ref NameError).
    life = LifeDiscoveryService(supabase)
    coverage = DiscoveryCoverageService(
        life, supabase,
        FinancialInputResolver(supabase, CompensationBenefitsEngine(supabase)),
    )
    # Deterministic finance scenario engine — grounds the advisor's numbers (net worth, down-payment tiers,
    # emergency-fund range, …) so the LLM interprets REAL figures and the validator passes. Reuses the canonical
    # FinancialInputResolver. Best-effort (None → unchanged behavior).
    scenarios: Any = None
    try:
        from .services.finance_scenarios import FinanceScenarioEngine
        scenarios = FinanceScenarioEngine(supabase, FinancialInputResolver(supabase, CompensationBenefitsEngine(supabase)))
    except Exception:  # noqa: BLE001
        scenarios = None
    # WS-E (Option A): wire live GraphRAG retrieval (Neo4j + Qdrant) into the advisor's grounding. DEFAULT
    # OFF — the retriever is None until GRAPH_GROUNDING_ENABLED, so the advisor grounds on Supabase exactly
    # as before. Enable only after the eval harness confirms it doesn't regress trust. Constructed lazily.
    retriever: Any = None
    if os.environ.get("GRAPH_GROUNDING_ENABLED", "false").lower() in ("1", "true", "yes"):
        try:
            from .grounding.retriever import Retriever
            retriever = Retriever(gemini=gemini, qdrant=get_qdrant(settings), neo4j=get_neo4j(settings))
        except Exception:  # noqa: BLE001 — grounding is optional; never block advisor construction
            retriever = None
    builder = AdvisorContextBuilder(supabase, coverage=coverage, life=life, scenarios=scenarios,
                                    retriever=retriever)
    if use_claude:
        # Claude on Vertex. ADC by default (no API key); a static VERTEX_ACCESS_TOKEN still wins if set.
        from .clients.vertex_auth import AdcTokenProvider
        static_tok = os.environ.get("VERTEX_ACCESS_TOKEN", "")
        llm: Any = VertexClaudeAdvisorLLM(
            project=os.environ.get("VERTEX_PROJECT", "") or settings.vertex_project,
            region=os.environ.get("VERTEX_REGION", "global"),
            model=os.environ.get("ADVISOR_MODEL", "claude-opus-4-1@20250805"),
            token=static_tok,
            token_provider=None if static_tok else AdcTokenProvider(),
        )
    elif settings.model_provider.lower() == "vertex":
        # Gemini via Vertex AI + ADC — NO API key (required where org policy disallows keys).
        from .clients.gemini import VertexGeminiClient
        from .clients.vertex_auth import AdcTokenProvider
        llm = GeminiAdvisorLLM(VertexGeminiClient.from_settings(settings, AdcTokenProvider()))
    else:
        llm = GeminiAdvisorLLM(gemini)

    # Selective orchestration (default OFF via MODEL_ROUTER_ENABLED → the single `llm` above is used,
    # i.e. unchanged production behavior). The factory builds an AdvisorLLM per registry model key.
    from .services.model_registry import MODELS
    from .clients.gemini import GeminiClient
    from .services.model_router import ModelRouter

    def _llm_factory(model_key: str) -> Any:
        spec = MODELS.get(model_key)
        if not spec:
            return None
        if spec["provider"] == "google_aistudio":
            client = GeminiClient(api_key=os.environ.get("GEMINI_API_KEY", "") or "",
                                  embedding_model="gemini-embedding-001",
                                  generation_model=spec["model_id"], timeout=float(spec["timeout_s"]))
            return GeminiAdvisorLLM(client)
        if spec["provider"] == "vertex_anthropic":
            from .clients.vertex_auth import AdcTokenProvider
            static_tok = os.environ.get("VERTEX_ACCESS_TOKEN", "")
            return VertexClaudeAdvisorLLM(
                project=os.environ.get("VERTEX_PROJECT", "gen-lang-client-0849161409"),
                region=os.environ.get("VERTEX_REGION", "global"), model=spec["model_id"],
                token=static_tok, token_provider=None if static_tok else AdcTokenProvider())
        return None

    router = ModelRouter(_llm_factory)

    # Opus 4.8 HYBRID (flag-gated, default OFF): route clearly finance/health turns to Claude on Vertex,
    # with the Gemini `llm` above as same-tier fallback. Distinct from USE_VERTEX_CLAUDE (whole-advisor swap).
    hybrid_claude: Any = None
    claude_domains: set[str] = set()
    high_stakes_only = os.environ.get("CLAUDE_HIGH_STAKES_ONLY", "true").lower() in ("1", "true", "yes")
    if os.environ.get("ENABLE_VERTEX_CLAUDE", "false").lower() in ("1", "true", "yes"):
        from .clients.vertex_auth import AdcTokenProvider
        static_tok = os.environ.get("VERTEX_ACCESS_TOKEN", "")
        hybrid_claude = VertexClaudeAdvisorLLM(
            project=os.environ.get("VERTEX_PROJECT", "") or settings.vertex_project,
            region=os.environ.get("CLAUDE_REGION", "global"),   # Claude is served only on `global` for this project
            model=os.environ.get("CLAUDE_MODEL", "claude-opus-4-8"),
            token=static_tok,
            token_provider=None if static_tok else AdcTokenProvider(),
        )
        claude_domains = {d.strip() for d in os.environ.get("CLAUDE_DOMAINS", "finance,health").split(",") if d.strip()}

    # FAST PATH model (first-5 latency): a Gemini Flash client for non-supervised advisor turns. Built on the
    # same Vertex/ADC auth as the primary (no API key), so it works wherever the Pro model does. Only wired for
    # the Vertex path (prod); other providers leave it None (unchanged behavior). Kill-switch:
    # ADVISOR_FAST_PATH_ENABLED=false. Model override: ADVISOR_FAST_MODEL (default gemini-2.5-flash).
    fast_llm: Any = None
    try:
        if not use_claude and settings.model_provider.lower() == "vertex":
            from .clients.gemini import VertexGeminiClient
            from .clients.vertex_auth import AdcTokenProvider
            fast_model = os.environ.get("ADVISOR_FAST_MODEL", "gemini-2.5-flash")
            fast_llm = GeminiAdvisorLLM(
                VertexGeminiClient.from_settings(settings, AdcTokenProvider(), generation_model=fast_model))
    except Exception:  # noqa: BLE001 — a missing fast model must never break advisor construction
        fast_llm = None

    return AdvisorOrchestrator(rm, builder, llm, enabled=enabled, supabase=supabase, router=router,
                               hybrid_claude=hybrid_claude, claude_domains=claude_domains,
                               claude_high_stakes_only=high_stakes_only, fast_llm=fast_llm)


def get_recommendation_os(
    supabase: SupabaseClient = Depends(get_supabase),
    readiness: LifeReadinessEngine = Depends(get_readiness_engine),
    family_office: FamilyOfficeService = Depends(get_family_office),
    health: HealthIntelligenceService = Depends(get_health_intelligence),
    military: MilitaryService = Depends(get_military_service),
) -> RecommendationOS:
    comp = CompensationBenefitsEngine(supabase)
    planning = FinancialPlanningEngine(supabase, comp)
    return RecommendationOS(supabase, readiness=readiness, family_office=family_office, health=health,
                            military=military, comp=comp, planning=planning)


def get_guidance(
    readiness: LifeReadinessEngine = Depends(get_readiness_engine),
    documents: DocumentIntelligenceService = Depends(get_document_service),
    supabase: SupabaseClient = Depends(get_supabase),
    reco_os: RecommendationOS = Depends(get_recommendation_os),
) -> GuidanceEngine:
    return GuidanceEngine(readiness=readiness, documents=documents, supabase=supabase, reco_os=reco_os)


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


def get_financial_resolver(supabase: SupabaseClient = Depends(get_supabase)) -> FinancialInputResolver:
    return FinancialInputResolver(supabase, CompensationBenefitsEngine(supabase))


def get_discovery_coverage(supabase: SupabaseClient = Depends(get_supabase)) -> DiscoveryCoverageService:
    return DiscoveryCoverageService(LifeDiscoveryService(supabase), supabase,
                                    FinancialInputResolver(supabase, CompensationBenefitsEngine(supabase)))


def get_my_life(
    supabase: SupabaseClient = Depends(get_supabase),
    readiness: LifeReadinessEngine = Depends(get_readiness_engine),
) -> MyLifeService:
    return MyLifeService(LifeDiscoveryService(supabase), readiness, RecommendationOS(supabase), supabase,
                         FinancialInputResolver(supabase, CompensationBenefitsEngine(supabase)))


def get_scenario_compare(
    supabase: SupabaseClient = Depends(get_supabase),
    readiness: LifeReadinessEngine = Depends(get_readiness_engine),
    life: LifeDiscoveryService = Depends(get_life_discovery),
) -> ScenarioComparisonEngine:
    return ScenarioComparisonEngine(readiness=readiness, life=life, supabase=supabase,
                                    tools=ToolRunner(supabase), comp=CompensationBenefitsEngine(supabase))


def get_decision_brain(
    supabase: SupabaseClient = Depends(get_supabase),
    readiness: LifeReadinessEngine = Depends(get_readiness_engine),
    life: LifeDiscoveryService = Depends(get_life_discovery),
    reco_os: RecommendationOS = Depends(get_recommendation_os),
) -> DecisionBrainService:
    return DecisionBrainService(readiness=readiness, life=life, reco_os=reco_os, supabase=supabase)


def get_orchestrator(
    context_builder: ContextBuilder = Depends(get_context_builder),
    gemini: GeminiClient = Depends(get_gemini),
    trust_safety: TrustSafetyAgent = Depends(get_trust_safety_agent),
    memory: MemoryAgent = Depends(get_memory_agent),
    recommendation_os: RecommendationOS = Depends(get_recommendation_os),
    life: LifeDiscoveryService = Depends(get_life_discovery),
) -> LifeOrchestratorAgent:
    return LifeOrchestratorAgent(
        context_builder=context_builder,
        gemini=gemini,
        trust_safety=trust_safety,
        memory=memory,
        recommendation_os=recommendation_os,
        life=life,
    )


def authenticated(user: AuthenticatedUser = Depends(current_user)) -> AuthenticatedUser:
    """Alias dependency for protected routes."""
    return user


def get_tool_runner(supabase: SupabaseClient = Depends(get_supabase)) -> ToolRunner:
    return ToolRunner(supabase)
