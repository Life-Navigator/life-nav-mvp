//! LifeNavigator ontology registry — the single source of truth, in code, for
//! which typed Neo4j relationships each entity emits. The human-facing spec is
//! `LIFENAVIGATOR_ONTOLOGY_STANDARD.md`; this module is its executable form.
//!
//! ## Why a registry
//! Relationship emission used to be a growing `match` in the normalizer. As more
//! domains arrive that becomes unmaintainable and easy to get wrong. The registry
//! makes a relationship a *declared rule* (data), not scattered control flow, so a
//! new domain adds rows here rather than editing the worker core.
//!
//! ## Edge direction
//! `Neo4jClient::merge_cypher_for` always emits `(target)-[rel]->(node)`, where
//! `node` is the entity being processed and `target` is the [`Relationship`]'s
//! `target_entity_type`/`target_entity_id`. So an [`IncomingEdge`] declares an edge
//! that points **into** the processed node:
//!   - [`EdgeFrom::UserAnchor`] → `(:UserProfile)-[rel]->(:ThisEntity)`
//!   - [`EdgeFrom::PayloadFk`]  → `(:OtherEntity {id=fk})-[rel]->(:ThisEntity)`
//!
//! ## Tenant safety
//! Every edge's target node is MERGEd under the *same* `tenant_id` as the source
//! (see `merge_cypher_for`), so the registry can never produce a cross-tenant edge.
//! The FK id is read from the same row's payload, i.e. the same owner.

use crate::entities::EntityType;

/// The tenant's root anchor node label (entity_type string form).
pub const USER_PROFILE: &str = "user_profile";

/// Domain ownership of a node label / relationship. Used for documentation,
/// quality gates, and future per-domain enable flags.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Domain {
    Root,
    Finance,
    Health,
    Career,
    Family,
    Education,
    Decision,
    General,
}

/// Where the *source* end of an incoming edge comes from.
#[derive(Clone, Copy, Debug)]
pub enum EdgeFrom {
    /// Source is the tenant's `UserProfile` (id == user_id). Always available.
    UserAnchor,
    /// Source is another entity whose id is read from a payload foreign-key field.
    /// The edge is emitted only when the field is present and non-empty — never a
    /// fabricated link.
    PayloadFk {
        /// entity_type (snake) of the source node, e.g. `"financial_account"`.
        from_label: &'static str,
        /// payload field holding the source id, e.g. `"account_id"`.
        field: &'static str,
    },
}

/// One declared edge pointing into a processed node.
#[derive(Clone, Copy, Debug)]
pub struct IncomingEdge {
    pub rel_type: &'static str,
    pub from: EdgeFrom,
    /// `UserAnchor` edges are structurally required; `PayloadFk` edges are optional
    /// (emitted only when the FK exists). Used by the quality gates / tests.
    pub required: bool,
    pub version: u32,
}

const fn user(rel: &'static str) -> IncomingEdge {
    IncomingEdge {
        rel_type: rel,
        from: EdgeFrom::UserAnchor,
        required: true,
        version: 1,
    }
}
const fn fk(rel: &'static str, from_label: &'static str, field: &'static str) -> IncomingEdge {
    IncomingEdge {
        rel_type: rel,
        from: EdgeFrom::PayloadFk { from_label, field },
        required: false,
        version: 1,
    }
}

// ── Finance ontology (live; the reference implementation) ───────────────────
// Each list = the typed edges that point into a node of this entity type. Only
// edges whose source data exists today are declared; future links are documented
// extension points in LIFENAVIGATOR_ONTOLOGY_STANDARD.md, NOT fake edges here.

const FINANCIAL_ACCOUNT: &[IncomingEdge] = &[user("OWNS_ACCOUNT")];
const TRANSACTION_SUMMARY: &[IncomingEdge] = &[
    user("HAS_TRANSACTION"),
    fk("HAS_TRANSACTION", "financial_account", "account_id"),
];
const ASSET: &[IncomingEdge] = &[user("HAS_ASSET")];
const DEBT: &[IncomingEdge] = &[user("HAS_DEBT")];
const INVESTMENT_HOLDING: &[IncomingEdge] = &[
    user("HAS_HOLDING"),
    fk("HAS_HOLDING", "financial_account", "account_id"),
];
const RETIREMENT_PLAN: &[IncomingEdge] = &[user("CONTRIBUTES_TO")];
const FINANCIAL_GOAL: &[IncomingEdge] = &[user("HAS_GOAL")];

// ── Finance elite schema (migration 117) — user-ownership edges ──────────────
const LIABILITY: &[IncomingEdge] = &[user("HAS_LIABILITY")];
const CASH_FLOW_SNAPSHOT: &[IncomingEdge] = &[user("HAS_SNAPSHOT")];
const NET_WORTH_SNAPSHOT: &[IncomingEdge] = &[user("HAS_SNAPSHOT")];
const BUDGET_CATEGORY: &[IncomingEdge] = &[user("HAS_BUDGET_CATEGORY")];
const INCOME_SOURCE: &[IncomingEdge] = &[user("HAS_INCOME_SOURCE")];
const EXPENSE_CATEGORY: &[IncomingEdge] = &[user("HAS_EXPENSE_CATEGORY")];
const FINANCIAL_EVENT: &[IncomingEdge] = &[user("LOGGED")];

// ── Recommendation evidence graph (RECOMMENDATION_EVIDENCE_GRAPH_SPEC.md) ────
// The recommendation is user-anchored; evidence/assumption/tradeoff/advice-boundary
// nodes anchor to the recommendation via a `recommendation_id` FK (so traversal is
// user -> recommendation -> evidence). ADDRESSES (rec -> goal/debt/budget) and
// GOVERNED_BY (rec -> governance_rule) are EXTENSION POINTS: the recommendation is
// the edge SOURCE, which needs outgoing-edge support in merge_cypher_for — tracked,
// not faked here.
const FINANCIAL_RECOMMENDATION: &[IncomingEdge] = &[user("HAS_RECOMMENDATION")];
const EVIDENCE: &[IncomingEdge] = &[fk(
    "HAS_EVIDENCE",
    "financial_recommendation",
    "recommendation_id",
)];
const ASSUMPTION: &[IncomingEdge] = &[fk(
    "HAS_ASSUMPTION",
    "financial_recommendation",
    "recommendation_id",
)];
const TRADEOFF: &[IncomingEdge] = &[fk(
    "HAS_TRADEOFF",
    "financial_recommendation",
    "recommendation_id",
)];
const ADVICE_BOUNDARY: &[IncomingEdge] = &[fk(
    "REQUIRES_REVIEW",
    "financial_recommendation",
    "recommendation_id",
)];

// ── Health & Wellness (H1; migration 119) — user-anchor edges ────────────────
// Benefit inter-entity edges (HealthInsurancePlan COVERED_BY EmployerBenefit;
// MedicalExpense ELIGIBLE_FOR_HSA_FSA HealthSpendingAccount; BenefitDeadline
// ADDRESSES HealthSpendingAccount) have the processed node as the edge SOURCE, so
// they need outgoing-edge support in merge_cypher_for — EXTENSION POINTS, not faked.
const HEALTH_PROFILE: &[IncomingEdge] = &[user("HAS_WELLNESS")];
const HEALTH_GOAL: &[IncomingEdge] = &[user("HAS_HEALTH_GOAL")];
const WELLNESS_HABIT: &[IncomingEdge] = &[user("PURSUING")];
const ACTIVITY_LOG: &[IncomingEdge] = &[user("LOGGED")];
const SLEEP_LOG: &[IncomingEdge] = &[user("LOGGED")];
const NUTRITION_LOG: &[IncomingEdge] = &[user("LOGGED")];
const SUPPLEMENT_LOG: &[IncomingEdge] = &[user("LOGGED")];
const WORKOUT_LOG: &[IncomingEdge] = &[user("LOGGED")];
const VITAL: &[IncomingEdge] = &[user("TRACKS_METRIC")];
const LAB_MARKER: &[IncomingEdge] = &[user("TRACKS_METRIC")];
const BODY_METRIC: &[IncomingEdge] = &[user("TRACKS_METRIC")];
const HEALTH_INSURANCE_PLAN: &[IncomingEdge] = &[user("HAS_INSURANCE_PLAN")];
const HEALTH_SPENDING_ACCOUNT: &[IncomingEdge] = &[user("HAS_SPENDING_ACCOUNT")];
const MEDICAL_EXPENSE: &[IncomingEdge] = &[user("LOGGED")];
const BENEFIT_DEADLINE: &[IncomingEdge] = &[user("HAS_BENEFIT_DEADLINE")];
const HEALTH_RECOMMENDATION: &[IncomingEdge] = &[user("HAS_RECOMMENDATION")];

// ── Career ontology (migration 122) ─────────────────────────────────────────
// Every Career entity is user-anchored (required) so none falls back to RELATED_TO.
// Inter-entity FK edges are declared ONLY where the X1 schema FK exists and reads
// naturally as (:Source)-[rel]->(:Processed). Reverse-direction links (CareerGoal→
// JobTarget, JobTarget→Skill, QUALIFIES_FOR, cross-domain IMPACTS/AFFECTS_CASHFLOW/
// SUPPORTS_GOAL) are documented extension points in CAREER_EDUCATION_FAMILY_ONTOLOGY —
// NOT faked here (no FK / outgoing-edge support yet).
const CAREER_PROFILE: &[IncomingEdge] = &[user("HAS_CAREER")];
const CAREER_GOAL: &[IncomingEdge] = &[user("HAS_GOAL")];
const EXPERIENCE_RECORD: &[IncomingEdge] = &[user("HAS_EXPERIENCE")];
const SKILL: &[IncomingEdge] = &[user("HAS_SKILL")];
const USER_SKILL: &[IncomingEdge] = &[
    user("HAS_SKILL"),
    fk("HAS_PROFICIENCY", "skill", "skill_id"),
];
const SKILL_GAP: &[IncomingEdge] = &[user("HAS_SKILL_GAP")];
const CREDENTIAL: &[IncomingEdge] = &[user("HAS_CREDENTIAL")];
const CERTIFICATION: &[IncomingEdge] = &[user("HAS_CERTIFICATION")];
const DEGREE: &[IncomingEdge] = &[user("HAS_DEGREE")];
const RESUME: &[IncomingEdge] = &[user("HAS_RESUME")];
const PORTFOLIO_ITEM: &[IncomingEdge] = &[user("HAS_PORTFOLIO_ITEM")];
const JOB_TARGET: &[IncomingEdge] = &[user("TARGETS_ROLE")];
const JOB_APPLICATION: &[IncomingEdge] = &[user("HAS_APPLICATION")];
const INTERVIEW: &[IncomingEdge] = &[
    user("HAS_INTERVIEW"),
    fk(
        "INCLUDES_INTERVIEW",
        "job_application",
        "job_application_id",
    ),
];
const COMPENSATION_RECORD: &[IncomingEdge] = &[user("HAS_COMPENSATION")];
const COMPENSATION_PROJECTION: &[IncomingEdge] = &[user("HAS_COMPENSATION_PROJECTION")];
const CAREER_RECOMMENDATION: &[IncomingEdge] = &[user("HAS_RECOMMENDATION")];

// ── Education ontology (migration 127) ───────────────────────────────────────
// User-anchored (required) so no mapped Education entity falls back to RELATED_TO.
// Program OFFERS edge declared because the X1 FK (programs.school_id) exists + reads
// naturally as (:School)-[:OFFERS]->(:Program). Cross-domain links (Program QUALIFIES_FOR
// JobTarget, Program FUNDED_BY FinancialGoal, Program IMPACTS CashFlowSnapshot) are
// documented extension points in CAREER_EDUCATION_FAMILY_ONTOLOGY — NOT faked here.
const EDUCATION_PROFILE: &[IncomingEdge] = &[user("HAS_EDUCATION")];
const EDUCATION_GOAL: &[IncomingEdge] = &[user("HAS_EDUCATION_GOAL")];
const LEARNING_PATH: &[IncomingEdge] = &[user("HAS_LEARNING_PATH")];
const SCHOOL: &[IncomingEdge] = &[user("CONSIDERS_SCHOOL")];
const PROGRAM: &[IncomingEdge] = &[
    user("EVALUATES_PROGRAM"),
    fk("OFFERS", "school", "school_id"),
];
const PROGRAM_COMPARISON: &[IncomingEdge] = &[user("HAS_PROGRAM_COMPARISON")];
const EDUCATION_RECOMMENDATION: &[IncomingEdge] = &[user("HAS_RECOMMENDATION")];

// ── Family ontology (migration 131) ──────────────────────────────────────────
// User-anchored (required) so no mapped Family entity falls back to RELATED_TO.
// Dependent COVERS_DEPENDENT edge declared because the X1 FK (dependents.
// guardianship_plan_id) exists + reads naturally as (:GuardianshipPlan)-[:COVERS_
// DEPENDENT]->(:Dependent). Cross-domain links (FamilyGoal FUNDED_BY FinancialGoal,
// CollegePlanning -> Education cost, ProtectionItem ADDRESSES InsuranceNeed) are
// documented extension points in CAREER_EDUCATION_FAMILY_ONTOLOGY — NOT faked here.
const FAMILY_PROFILE: &[IncomingEdge] = &[user("HAS_FAMILY")];
const DEPENDENT: &[IncomingEdge] = &[
    user("HAS_DEPENDENT"),
    fk(
        "COVERS_DEPENDENT",
        "guardianship_plan",
        "guardianship_plan_id",
    ),
];
const SPOUSE_PROFILE: &[IncomingEdge] = &[user("HAS_SPOUSE")];
const GUARDIANSHIP_PLAN: &[IncomingEdge] = &[user("HAS_GUARDIANSHIP_PLAN")];
const ESTATE_PLAN: &[IncomingEdge] = &[user("HAS_ESTATE_PLAN")];
const INSURANCE_PROFILE: &[IncomingEdge] = &[user("HAS_INSURANCE_PROFILE")];
const COLLEGE_PLANNING: &[IncomingEdge] = &[user("HAS_COLLEGE_PLAN")];
const FAMILY_RECOMMENDATION: &[IncomingEdge] = &[user("HAS_RECOMMENDATION")];

// ── Decision Engine ontology (migration 134) ─────────────────────────────────
// A LifeDecision is the user-anchored root of a decision graph; DecisionScenario nodes
// (worst/expected/best) + Evidence/Tradeoff/AdviceBoundary are fanned out by the worker
// (expand_children) anchored to the decision, so their edges are emitted there — these
// consts cover standalone processing. DecisionScenario anchors to its decision via the
// `decision_id` FK.
const LIFE_DECISION: &[IncomingEdge] = &[user("HAS_DECISION")];
const DECISION_SCENARIO: &[IncomingEdge] = &[fk("HAS_SCENARIO", "life_decision", "decision_id")];

// ---- Document Intelligence Platform (Elite Sprint 10) ----
// The user owns each uploaded document; extracted fields anchor to their document via FK.
const DOCUMENT: &[IncomingEdge] = &[user("HAS_DOCUMENT")];
const DOCUMENT_FIELD: &[IncomingEdge] = &[fk("HAS_EXTRACTED_FIELD", "document", "document_id")];

// ── Legacy user-anchored edges (NOT YET registry-migrated) ──────────────────
//
// WHY THIS TABLE EXISTS
// ---------------------
// `normalizer::relationships_for` carried this mapping as an inline `match`. That put it OUTSIDE
// `REGISTRY`, and `all_relationship_types()` walks only `REGISTRY` — so every relationship below was
// emitted into Neo4j while being absent from the generated manifest, and therefore absent from the
// retrieval allowlist the planner derives from it. Those edges were writable but never traversable.
//
// This was not hypothetical: `HAS_EDUCATION_RECORD` has 16 live edges in production and appeared in no
// manifest. The other 85 types below are latent instances of the same defect — unreachable the moment
// their domain gets data.
//
// The table is the SINGLE source of truth; the normalizer now reads it via `legacy_user_edge`. Keeping
// the mapping here is what lets `all_relationship_types()` — and thus the manifest, the planner
// allowlist, and the drift gate — see the whole vocabulary rather than the registry-shaped half of it.
//
// These edges are all `EdgeFrom::UserAnchor` in effect: the legacy match emitted a single typed edge
// from the tenant's UserProfile. FK/inter-entity edges belong in `REGISTRY` proper — migrating a domain
// out of this table and into `REGISTRY` is how it gains richer edges.
pub const LEGACY_USER_EDGES: &[(EntityType, &str)] = &[
    (EntityType::Goal, "HAS_GOAL"),
    (EntityType::Constraint, "HAS_CONSTRAINT"),
    (EntityType::Capability, "HAS_CAPABILITY"),
    (EntityType::Motivation, "HAS_MOTIVATION"),
    (EntityType::DecisionPreference, "HAS_DECISION_PREFERENCE"),
    (EntityType::DomainRiskTolerance, "HAS_RISK_TOLERANCE"),
    (EntityType::Decision, "MADE_DECISION"),
    (EntityType::Recommendation, "RECEIVED_RECOMMENDATION"),
    (EntityType::Action, "TOOK_ACTION"),
    (EntityType::Outcome, "OBSERVED_OUTCOME"),
    (EntityType::HealthMetric, "HAS_HEALTH_METRIC"),
    (EntityType::HealthInsurancePlan, "HAS_INSURANCE_PLAN"),
    (EntityType::CareerProfile, "HAS_CAREER_PROFILE"),
    (EntityType::EducationRecord, "HAS_EDUCATION_RECORD"),
    (EntityType::WearableMetric, "HAS_WEARABLE_METRIC"),
    (EntityType::ArcanaLeadPackage, "GENERATED_ARCANA_LEAD"),
    (EntityType::LifeVision, "HAS_LIFE_VISION"),
    (EntityType::CommitmentLevel, "HAS_COMMITMENT_LEVEL"),
    (EntityType::LifeEvent, "EXPERIENCED_LIFE_EVENT"),
    (EntityType::GoalDiscoveryTurn, "HAS_DISCOVERY_TURN"),
    (EntityType::GoalInterpretation, "HAS_GOAL_INTERPRETATION"),
    (EntityType::OptimizerRun, "HAS_OPTIMIZER_RUN"),
    (EntityType::OptimizerAllocation, "HAS_ALLOCATION"),
    (EntityType::OptimizerRecommendation, "RECEIVED_RECOMMENDATION"),
    (EntityType::LifeScenario, "HAS_SCENARIO"),
    (EntityType::LifeScenarioVersion, "HAS_SCENARIO_VERSION"),
    (EntityType::LifeScenarioDecision, "SCENARIO_DECISION"),
    (EntityType::LifeScenarioOutput, "HAS_SCENARIO_OUTPUT"),
    (EntityType::LifeTrajectorySnapshot, "HAS_TRAJECTORY_SNAPSHOT"),
    (EntityType::EstateProfile, "HAS_ESTATE_PROFILE"),
    (EntityType::EstateBeneficiary, "HAS_BENEFICIARY"),
    (EntityType::InsuranceDocument, "HAS_INSURANCE_DOCUMENT"),
    (EntityType::InsuranceDocumentFact, "HAS_INSURANCE_FACT"),
    (EntityType::BenefitProfile, "HAS_BENEFIT_PROFILE"),
    (EntityType::HealthAlertEvent, "OBSERVED_HEALTH_ALERT"),
    (EntityType::UserFinancialProfile, "HAS_FINANCIAL_PROFILE"),
    (EntityType::FinancingPreference, "HAS_FINANCING_PREFERENCE"),
    (EntityType::EducationIntake, "HAS_EDUCATION_INTAKE"),
    (EntityType::Injury, "HAS_INJURY"),
    (EntityType::CandidateMatch, "MATCHED_TO_JOB"),
    (EntityType::GoalProgressSnapshot, "HAS_GOAL_PROGRESS_SNAPSHOT"),
    (EntityType::GoalProgressEvent, "GOAL_PROGRESS_EVENT"),
    (EntityType::GoalProgressScore, "HAS_GOAL_PROGRESS_SCORE"),
    (EntityType::GoalProgressPrediction, "PREDICTED_GOAL_PROGRESS"),
    (EntityType::CrossDomainImpact, "CROSS_DOMAIN_IMPACT"),
    (EntityType::OutcomeAttribution, "ATTRIBUTED_OUTCOME"),
    (EntityType::PredictionCalibration, "CALIBRATION_OBSERVATION"),
    (EntityType::RecommendationAccuracy, "RECOMMENDATION_ACCURACY"),
    (EntityType::AdvisorAccuracy, "ADVISOR_ACCURACY_SNAPSHOT"),
    (EntityType::RecommendationQualityMetric, "RECOMMENDATION_QUALITY_METRIC"),
    (EntityType::PathwayEffectiveness, "EFFECTIVE_PATHWAY"),
    (EntityType::GoalProbabilityDistribution, "HAS_PROBABILITY_DISTRIBUTION"),
    (EntityType::GoalProbabilitySnapshot, "HAS_PROBABILITY_SNAPSHOT"),
    (EntityType::GoalDecisionImpact, "CHANGES_PROBABILITY_OF"),
    (EntityType::GoalPathwayProbability, "HAS_PATHWAY_PROBABILITY"),
    (EntityType::GoalFutureState, "PROJECTS_FUTURE_STATE"),
    (EntityType::DecisionMarginalImpact, "RANKED_MARGINAL_IMPACT"),
    (EntityType::TrajectoryVarianceFactor, "TRAJECTORY_VARIANCE_FACTOR"),
    (EntityType::RecommendationAuditTrail, "AUDITED_BY"),
    (EntityType::WhyChain, "HAS_WHY_CHAIN"),
    (EntityType::EvidenceLink, "SUPPORTED_BY"),
    (EntityType::CounterfactualScenario, "COUNTERFACTUAL_OF"),
    (EntityType::RecommendationAssumption, "ASSUMED_BY"),
    (EntityType::DiscoverySession, "HAS_DISCOVERY_SESSION"),
    (EntityType::AssumptionChallenge, "CHALLENGED_BY"),
    (EntityType::ConversationTrace, "TRACED_BY"),
    (EntityType::ProviderProfile, "HAS_PROVIDER_PROFILE"),
    (EntityType::ProviderEngagement, "HAS_PROVIDER_ENGAGEMENT"),
    (EntityType::ProviderConsentScope, "HAS_CONSENT_SCOPE"),
    (EntityType::ProviderRecommendation, "RECOMMENDED_BY_PROVIDER"),
    (EntityType::ProviderOutcome, "PROVIDER_OUTCOME"),
    (EntityType::ProviderKnowledgeEntry, "AUTHORED_KNOWLEDGE"),
    (EntityType::ProviderAnalytics, "ANALYZED_BY_PROVIDER"),
    (EntityType::ArcanaProfile, "HAS_ARCANA_PROFILE"),
    (EntityType::ArcanaAssessment, "HAS_ARCANA_ASSESSMENT"),
    (EntityType::ArcanaGoal, "HAS_ARCANA_GOAL"),
    (EntityType::ArcanaConstraint, "HAS_ARCANA_CONSTRAINT"),
    (EntityType::ArcanaCapability, "HAS_ARCANA_CAPABILITY"),
    (EntityType::ArcanaMotivation, "HAS_ARCANA_MOTIVATION"),
    (EntityType::ArcanaReadiness, "HAS_ARCANA_READINESS"),
    (EntityType::SupplementProtocol, "HAS_SUPPLEMENT_PROTOCOL"),
    (EntityType::TrainingProtocol, "HAS_TRAINING_PROTOCOL"),
    (EntityType::HealthMilestone, "HAS_HEALTH_MILESTONE"),
    (EntityType::BiometricObservation, "HAS_BIOMETRIC_OBSERVATION"),
    (EntityType::LabResult, "HAS_LAB_RESULT"),
    (EntityType::WearableConnection, "HAS_WEARABLE_CONNECTION"),
    (EntityType::ArcanaInsuranceDocument, "HAS_ARCANA_INSURANCE_DOCUMENT"),
    (EntityType::LeadPackageConsent, "GRANTED_LEAD_CONSENT"),
    (EntityType::ConciergePreference, "HAS_CONCIERGE_PREFERENCE"),
    (EntityType::ArcanaMembership, "HAS_ARCANA_MEMBERSHIP"),
];

/// The legacy user-anchored relationship for an entity type, if it has one.
///
/// Returns `None` for registry-mapped entities (which own their edges) and for genuinely unmapped
/// types, which still fall back to `RELATED_TO` in the normalizer.
pub fn legacy_user_edge(et: &EntityType) -> Option<&'static str> {
    LEGACY_USER_EDGES
        .iter()
        .find(|(k, _)| k == et)
        .map(|(_, rel)| *rel)
}

/// Registry lookup: the declared incoming edges for an entity type.
///
/// Returns a non-empty slice for entities the ontology registry owns (finance
/// today). An empty slice means "not registry-mapped" — the normalizer then uses
/// its legacy typed-label `match`, and unmapped types fall back to `RELATED_TO`.
/// Mapped entities therefore NEVER fall back to `RELATED_TO`.
pub fn incoming_edges(et: &EntityType) -> &'static [IncomingEdge] {
    REGISTRY
        .iter()
        .find(|(k, _)| k == et)
        .map(|(_, edges)| *edges)
        .unwrap_or(&[])
}

/// The registry, as an enumerable TABLE.
///
/// This was a `match` — which meant the set of declared relationships could be *evaluated* but never
/// *listed*. Nothing outside this crate could ask "what edge types exist?", so the retrieval tier in
/// core-api kept its own hand-copied Python list, and the two drifted: 24 of 61 relationship types were
/// being written to Neo4j that traversal could not follow, including every Document Intelligence edge.
/// A vocabulary that cannot be enumerated will always drift from its copies.
///
/// As a table it is data, exactly as this module's header claims a relationship should be — and it can be
/// exported (see [`relationship_manifest`]) so every tier consumes ONE vocabulary instead of a transcript
/// of one.
pub const REGISTRY: &[(EntityType, &'static [IncomingEdge])] = &[
    (EntityType::FinancialAccount, FINANCIAL_ACCOUNT),
    (EntityType::TransactionSummary, TRANSACTION_SUMMARY),
    (EntityType::Asset, ASSET),
    (EntityType::Debt, DEBT),
    (EntityType::InvestmentHolding, INVESTMENT_HOLDING),
    (EntityType::RetirementPlan, RETIREMENT_PLAN),
    (EntityType::FinancialGoal, FINANCIAL_GOAL),
    // Finance elite schema (migration 117).
    (EntityType::Liability, LIABILITY),
    (EntityType::CashFlowSnapshot, CASH_FLOW_SNAPSHOT),
    (EntityType::NetWorthSnapshot, NET_WORTH_SNAPSHOT),
    (EntityType::BudgetCategory, BUDGET_CATEGORY),
    (EntityType::IncomeSource, INCOME_SOURCE),
    (EntityType::ExpenseCategory, EXPENSE_CATEGORY),
    (EntityType::FinancialEvent, FINANCIAL_EVENT),
    // Recommendation evidence graph.
    (
        EntityType::FinancialRecommendation,
        FINANCIAL_RECOMMENDATION,
    ),
    (EntityType::Evidence, EVIDENCE),
    (EntityType::Assumption, ASSUMPTION),
    (EntityType::Tradeoff, TRADEOFF),
    (EntityType::AdviceBoundary, ADVICE_BOUNDARY),
    // Health & Wellness (migration 119).
    (EntityType::HealthProfile, HEALTH_PROFILE),
    (EntityType::HealthGoal, HEALTH_GOAL),
    (EntityType::WellnessHabit, WELLNESS_HABIT),
    (EntityType::ActivityLog, ACTIVITY_LOG),
    (EntityType::SleepLog, SLEEP_LOG),
    (EntityType::NutritionLog, NUTRITION_LOG),
    (EntityType::SupplementLog, SUPPLEMENT_LOG),
    (EntityType::WorkoutLog, WORKOUT_LOG),
    (EntityType::Vital, VITAL),
    (EntityType::LabMarker, LAB_MARKER),
    (EntityType::BodyMetric, BODY_METRIC),
    (EntityType::HealthInsurancePlan, HEALTH_INSURANCE_PLAN),
    (EntityType::HealthSpendingAccount, HEALTH_SPENDING_ACCOUNT),
    (EntityType::MedicalExpense, MEDICAL_EXPENSE),
    (EntityType::BenefitDeadline, BENEFIT_DEADLINE),
    (EntityType::HealthRecommendation, HEALTH_RECOMMENDATION),
    // Career (migration 122).
    (EntityType::CareerProfile, CAREER_PROFILE),
    (EntityType::CareerGoal, CAREER_GOAL),
    (EntityType::ExperienceRecord, EXPERIENCE_RECORD),
    (EntityType::Skill, SKILL),
    (EntityType::UserSkill, USER_SKILL),
    (EntityType::SkillGap, SKILL_GAP),
    (EntityType::Credential, CREDENTIAL),
    (EntityType::Certification, CERTIFICATION),
    (EntityType::Degree, DEGREE),
    (EntityType::Resume, RESUME),
    (EntityType::PortfolioItem, PORTFOLIO_ITEM),
    (EntityType::JobTarget, JOB_TARGET),
    (EntityType::JobApplication, JOB_APPLICATION),
    (EntityType::Interview, INTERVIEW),
    (EntityType::CompensationRecord, COMPENSATION_RECORD),
    (EntityType::CompensationProjection, COMPENSATION_PROJECTION),
    (EntityType::CareerRecommendation, CAREER_RECOMMENDATION),
    // Education (migration 127).
    (EntityType::EducationProfile, EDUCATION_PROFILE),
    (EntityType::EducationGoal, EDUCATION_GOAL),
    (EntityType::LearningPath, LEARNING_PATH),
    (EntityType::School, SCHOOL),
    (EntityType::Program, PROGRAM),
    (EntityType::ProgramComparison, PROGRAM_COMPARISON),
    (
        EntityType::EducationRecommendation,
        EDUCATION_RECOMMENDATION,
    ),
    // Family (migration 131).
    (EntityType::FamilyProfile, FAMILY_PROFILE),
    (EntityType::Dependent, DEPENDENT),
    (EntityType::SpouseProfile, SPOUSE_PROFILE),
    (EntityType::GuardianshipPlan, GUARDIANSHIP_PLAN),
    (EntityType::EstatePlan, ESTATE_PLAN),
    (EntityType::InsuranceProfile, INSURANCE_PROFILE),
    (EntityType::CollegePlanning, COLLEGE_PLANNING),
    (EntityType::FamilyRecommendation, FAMILY_RECOMMENDATION),
    // Decision Engine (migration 134).
    (EntityType::LifeDecision, LIFE_DECISION),
    (EntityType::DecisionScenario, DECISION_SCENARIO),
    (EntityType::Document, DOCUMENT),
    (EntityType::DocumentField, DOCUMENT_FIELD),
];

// ── Semantic classification ─────────────────────────────────────────────────────────────────────

/// What a relationship MEANS, independent of which domain it belongs to.
///
/// Retrieval needs this. A query planner deciding how far to walk and which edges matter cannot work
/// from 61 opaque strings — "why did you recommend that" needs provenance edges, "how am I trending"
/// needs time-series edges, and the difference is semantic, not lexical. Deriving it from the name
/// would be guesswork (`LOGGED` and `HAS_SNAPSHOT` share no prefix yet mean nearly the same thing;
/// `HAS_GOAL` and `HAS_DEBT` share one and do not).
///
/// So it is DECLARED, here, beside the edges themselves — one classification, exported to every tier,
/// rather than a Python transcript that silently disagrees.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum EdgeFamily {
    /// The user owns/holds this thing. The backbone of "what do I have".
    Ownership,
    /// Provenance and reasoning: why a recommendation exists, what it assumed, what it traded off.
    Evidence,
    /// Change over time: logs, snapshots, tracked metrics, contributions.
    Progress,
    /// Who the user is: profiles, skills, credentials, relationships.
    Identity,
    /// Intent: goals, targets, plans, pursuits.
    Planning,
    /// Source documents and the fields extracted from them. Carries provenance INTO the life model,
    /// which is why it is not folded into Ownership.
    Document,
    /// The normalizer's fallback for an unmapped entity. Deliberately its own family so it can be
    /// ranked last and never widens a walk on its own.
    Association,
}

impl EdgeFamily {
    pub fn as_str(&self) -> &'static str {
        match self {
            EdgeFamily::Ownership => "ownership",
            EdgeFamily::Evidence => "evidence",
            EdgeFamily::Progress => "progress",
            EdgeFamily::Identity => "identity",
            EdgeFamily::Planning => "planning",
            EdgeFamily::Document => "document",
            EdgeFamily::Association => "association",
        }
    }

    /// Default evidential weight for the family. A concrete type may override (see [`edge_weight`]).
    pub fn base_weight(&self) -> f32 {
        match self {
            EdgeFamily::Evidence => 0.90,
            EdgeFamily::Ownership => 0.85,
            EdgeFamily::Planning => 0.80,
            EdgeFamily::Identity => 0.75,
            EdgeFamily::Document => 0.70,
            EdgeFamily::Progress => 0.65,
            EdgeFamily::Association => 0.25,
        }
    }
}

/// The semantic family of a relationship type.
///
/// EXHAUSTIVE over everything [`REGISTRY`] emits — `manifest_covers_every_relationship` fails the build
/// if a new edge is added without classifying it. That test is the mechanism preventing the drift this
/// module just recovered from: an unclassified edge cannot quietly default to "unreachable".
pub fn family_of(rel_type: &str) -> EdgeFamily {
    match rel_type {
        // Ownership — the user holds this.
        "OWNS_ACCOUNT"
        | "HAS_ASSET"
        | "HAS_DEBT"
        | "HAS_HOLDING"
        | "HAS_LIABILITY"
        | "HAS_INCOME_SOURCE"
        | "HAS_INSURANCE_PLAN"
        | "HAS_INSURANCE_PROFILE"
        | "HAS_SPENDING_ACCOUNT"
        | "HAS_PORTFOLIO_ITEM"
        | "HAS_BUDGET_CATEGORY"
        | "HAS_EXPENSE_CATEGORY"
        | "HAS_TRANSACTION" => EdgeFamily::Ownership,

        // Evidence — provenance and the reasoning behind advice.
        "HAS_EVIDENCE" | "HAS_ASSUMPTION" | "HAS_TRADEOFF" | "REQUIRES_REVIEW"
        | "HAS_RECOMMENDATION" | "HAS_DECISION" => EdgeFamily::Evidence,

        // Progress — anything whose meaning is "over time".
        "LOGGED"
        | "HAS_SNAPSHOT"
        | "TRACKS_METRIC"
        | "CONTRIBUTES_TO"
        | "HAS_SCENARIO"
        | "HAS_COMPENSATION"
        | "HAS_COMPENSATION_PROJECTION" => EdgeFamily::Progress,

        // Identity — who the user is and what they can do.
        "HAS_CAREER" | "HAS_EDUCATION" | "HAS_FAMILY" | "HAS_WELLNESS" | "HAS_SKILL"
        | "HAS_PROFICIENCY" | "HAS_CREDENTIAL" | "HAS_CERTIFICATION" | "HAS_DEGREE"
        | "HAS_EXPERIENCE" | "HAS_RESUME" | "HAS_DEPENDENT" | "HAS_SPOUSE" | "COVERS_DEPENDENT" => {
            EdgeFamily::Identity
        }

        // Planning — intent, targets, and the plans that serve them.
        "HAS_GOAL"
        | "HAS_HEALTH_GOAL"
        | "HAS_EDUCATION_GOAL"
        | "PURSUING"
        | "TARGETS_ROLE"
        | "HAS_LEARNING_PATH"
        | "HAS_SKILL_GAP"
        | "HAS_ESTATE_PLAN"
        | "HAS_COLLEGE_PLAN"
        | "HAS_GUARDIANSHIP_PLAN"
        | "HAS_APPLICATION"
        | "HAS_INTERVIEW"
        | "INCLUDES_INTERVIEW"
        | "CONSIDERS_SCHOOL"
        | "EVALUATES_PROGRAM"
        | "HAS_PROGRAM_COMPARISON"
        | "OFFERS"
        | "HAS_BENEFIT_DEADLINE" => EdgeFamily::Planning,

        // Document — source material and extracted fields.
        "HAS_DOCUMENT" | "HAS_EXTRACTED_FIELD" => EdgeFamily::Document,

        // ── Legacy user-anchored edges (see LEGACY_USER_EDGES) ──────────────────────────────────
        // Classified here so none of them falls through to the Association default, which would make
        // them followable but ranked near-worthless.

        // Identity — stable descriptions of who the user is / what they hold.
        "HAS_CAREER_PROFILE" | "HAS_EDUCATION_RECORD" | "HAS_EDUCATION_INTAKE" | "HAS_LIFE_VISION"
        | "HAS_FINANCIAL_PROFILE" | "HAS_ESTATE_PROFILE" | "HAS_BENEFIT_PROFILE" | "HAS_BENEFICIARY"
        | "HAS_CAPABILITY" | "HAS_CONSTRAINT" | "HAS_MOTIVATION" | "HAS_DECISION_PREFERENCE"
        | "HAS_RISK_TOLERANCE" | "HAS_COMMITMENT_LEVEL" | "HAS_FINANCING_PREFERENCE"
        | "HAS_INJURY" | "HAS_WEARABLE_CONNECTION" => EdgeFamily::Identity,

        // Planning — intent, protocols, targets, projections.
        "HAS_SUPPLEMENT_PROTOCOL" | "HAS_TRAINING_PROTOCOL" | "HAS_HEALTH_MILESTONE"
        | "MATCHED_TO_JOB" | "PROJECTS_FUTURE_STATE" | "HAS_PATHWAY_PROBABILITY"
        | "HAS_SCENARIO_VERSION" | "HAS_SCENARIO_OUTPUT" | "SCENARIO_DECISION" | "HAS_ALLOCATION"
        | "HAS_OPTIMIZER_RUN" | "HAS_GOAL_INTERPRETATION" => EdgeFamily::Planning,

        // Progress — measurements, snapshots, and anything whose meaning is "over time".
        "HAS_HEALTH_METRIC" | "HAS_WEARABLE_METRIC" | "HAS_BIOMETRIC_OBSERVATION" | "HAS_LAB_RESULT"
        | "HAS_TRAJECTORY_SNAPSHOT" | "HAS_GOAL_PROGRESS_SNAPSHOT" | "HAS_GOAL_PROGRESS_SCORE"
        | "GOAL_PROGRESS_EVENT" | "PREDICTED_GOAL_PROGRESS" | "HAS_PROBABILITY_DISTRIBUTION"
        | "HAS_PROBABILITY_SNAPSHOT" | "TRAJECTORY_VARIANCE_FACTOR" | "OBSERVED_OUTCOME"
        | "OBSERVED_HEALTH_ALERT" | "EXPERIENCED_LIFE_EVENT" | "TOOK_ACTION"
        | "CALIBRATION_OBSERVATION" | "ADVISOR_ACCURACY_SNAPSHOT" | "RECOMMENDATION_ACCURACY"
        | "RECOMMENDATION_QUALITY_METRIC" | "EFFECTIVE_PATHWAY" | "ATTRIBUTED_OUTCOME"
        | "CROSS_DOMAIN_IMPACT" | "CHANGES_PROBABILITY_OF"
        | "RANKED_MARGINAL_IMPACT" => EdgeFamily::Progress,

        // Evidence — decisions, reasoning chains, and their provenance.
        "MADE_DECISION" | "RECEIVED_RECOMMENDATION" | "HAS_WHY_CHAIN" | "SUPPORTED_BY" | "ASSUMED_BY"
        | "AUDITED_BY" | "COUNTERFACTUAL_OF" | "CHALLENGED_BY" | "TRACED_BY"
        | "HAS_DISCOVERY_SESSION" | "HAS_DISCOVERY_TURN" => EdgeFamily::Evidence,

        // Document — source material and facts extracted from it.
        "HAS_INSURANCE_DOCUMENT" | "HAS_INSURANCE_FACT"
        | "HAS_ARCANA_INSURANCE_DOCUMENT" => EdgeFamily::Document,

        // Provider / Arcana (B2B + concierge). Declared for vocabulary completeness and drift
        // detection, but `is_traversable` excludes them from personal retrieval — they describe the
        // service relationship around the user, not facts inside the user's life model.
        "HAS_PROVIDER_PROFILE" | "HAS_PROVIDER_ENGAGEMENT" | "HAS_CONSENT_SCOPE"
        | "RECOMMENDED_BY_PROVIDER" | "PROVIDER_OUTCOME" | "AUTHORED_KNOWLEDGE"
        | "ANALYZED_BY_PROVIDER" | "HAS_ARCANA_PROFILE" | "HAS_ARCANA_ASSESSMENT" | "HAS_ARCANA_GOAL"
        | "HAS_ARCANA_CONSTRAINT" | "HAS_ARCANA_CAPABILITY" | "HAS_ARCANA_MOTIVATION"
        | "HAS_ARCANA_READINESS" | "HAS_ARCANA_MEMBERSHIP" | "GENERATED_ARCANA_LEAD"
        | "GRANTED_LEAD_CONSENT" | "HAS_CONCIERGE_PREFERENCE" => EdgeFamily::Association,

        // Fallback.
        "RELATED_TO" => EdgeFamily::Association,

        // An edge added to REGISTRY but never classified. Association is the SAFE default — it is
        // followable but ranked near-worthless, so a forgotten classification degrades quality rather
        // than making data invisible. `manifest_covers_every_relationship` fails the build anyway.
        _ => EdgeFamily::Association,
    }
}

/// Evidential weight of a concrete relationship type: the family's base, with narrow overrides where a
/// specific edge is stronger or weaker than its family average.
pub fn edge_weight(rel_type: &str) -> f32 {
    match rel_type {
        // A recommendation's own evidence is the strongest link in the graph — it is what lets the
        // advisor cite WHY rather than merely assert.
        "HAS_EVIDENCE" => 1.00,
        // An extracted field is only as good as the extraction; it carries a confidence of its own.
        "HAS_EXTRACTED_FIELD" => 0.65,
        _ => family_of(rel_type).base_weight(),
    }
}

/// Every distinct relationship type the registry can emit, sorted and de-duplicated.
pub fn all_relationship_types() -> Vec<&'static str> {
    let mut out: Vec<&'static str> = REGISTRY
        .iter()
        .flat_map(|(_, edges)| edges.iter().map(|e| e.rel_type))
        .collect();
    // Legacy user-anchored edges are emitted by the normalizer for not-yet-migrated domains. They are
    // written to the graph exactly like registry edges, so excluding them here is what made 86 emittable
    // relationship types — including the 16 live `HAS_EDUCATION_RECORD` edges — absent from the manifest
    // and therefore unreachable by traversal. See `LEGACY_USER_EDGES`.
    out.extend(LEGACY_USER_EDGES.iter().map(|(_, rel)| *rel));
    // The normalizer's fallback for unmapped entities never appears in REGISTRY, but it IS written to
    // the graph — omitting it is what left it rankable-but-unreachable in the retrieval tier.
    out.push("RELATED_TO");
    out.sort_unstable();
    out.dedup();
    out
}

/// The exported ontology contract, as JSON.
///
/// This is what makes core-api's retrieval ontology-DERIVED rather than ontology-INSPIRED. Written to
/// `ontology/generated/relationship_manifest.json`, verified in CI, and loaded by the Python planner.
pub fn relationship_manifest() -> String {
    let mut rows: Vec<String> = Vec::new();
    for rel in all_relationship_types() {
        let fam = family_of(rel);
        rows.push(format!(
            "    {{ \"rel_type\": \"{}\", \"family\": \"{}\", \"weight\": {:.2}, \
\"lifecycle\": \"{}\", \"traversable\": {} }}",
            rel,
            fam.as_str(),
            edge_weight(rel),
            crate::relationship_catalog::spec_for(rel)
                .map(|sp| match sp.lifecycle {
                    crate::relationship_catalog::RelLifecycle::Implemented => "implemented",
                    crate::relationship_catalog::RelLifecycle::Planned => "planned",
                    crate::relationship_catalog::RelLifecycle::Deprecated => "deprecated",
                    crate::relationship_catalog::RelLifecycle::Unsupported => "unsupported",
                    crate::relationship_catalog::RelLifecycle::DerivedOnly => "derived_only",
                })
                .unwrap_or("undeclared"),
            crate::relationship_catalog::is_traversable_in(
                rel,
                crate::relationship_catalog::QueryContext::PersonalAdvisor
            )
        ));
    }
    format!(
        "{{\n  \"_generated_by\": \"apps/ingestion-worker/src/ontology.rs :: relationship_manifest()\",\n  \
\"_do_not_edit\": \"Regenerate with: cargo test -p ingestion-worker export_relationship_manifest -- --ignored\",\n  \
\"version\": 2,\n  \"relationships\": [\n{}\n  ]\n}}\n",
        rows.join(",\n")
    )
}

/// Whether the ontology registry owns this entity's relationship emission.
pub fn is_registry_mapped(et: &EntityType) -> bool {
    !incoming_edges(et).is_empty()
}

/// Domain ownership for an entity type (documentation + quality gates).
pub fn domain_of(et: &EntityType) -> Domain {
    match et {
        EntityType::UserProfile | EntityType::PersonaProfile => Domain::Root,
        EntityType::FinancialAccount
        | EntityType::TransactionSummary
        | EntityType::Asset
        | EntityType::Debt
        | EntityType::InvestmentHolding
        | EntityType::RetirementPlan
        | EntityType::FinancialGoal
        | EntityType::TaxProfile
        | EntityType::UserFinancialProfile
        | EntityType::FinancialRecommendation
        | EntityType::Liability
        | EntityType::CashFlowSnapshot
        | EntityType::NetWorthSnapshot
        | EntityType::BudgetCategory
        | EntityType::IncomeSource
        | EntityType::ExpenseCategory
        | EntityType::FinancialEvent
        | EntityType::Evidence
        | EntityType::Assumption
        | EntityType::Tradeoff
        | EntityType::AdviceBoundary => Domain::Finance,
        EntityType::HealthProfile
        | EntityType::HealthGoal
        | EntityType::WellnessHabit
        | EntityType::ActivityLog
        | EntityType::SleepLog
        | EntityType::NutritionLog
        | EntityType::SupplementLog
        | EntityType::WorkoutLog
        | EntityType::Vital
        | EntityType::LabMarker
        | EntityType::BodyMetric
        | EntityType::HealthInsurancePlan
        | EntityType::HealthSpendingAccount
        | EntityType::MedicalExpense
        | EntityType::BenefitDeadline
        | EntityType::HealthRecommendation => Domain::Health,
        EntityType::CareerProfile
        | EntityType::CareerGoal
        | EntityType::ExperienceRecord
        | EntityType::Skill
        | EntityType::UserSkill
        | EntityType::SkillGap
        | EntityType::Credential
        | EntityType::Certification
        | EntityType::Degree
        | EntityType::Resume
        | EntityType::PortfolioItem
        | EntityType::JobTarget
        | EntityType::JobApplication
        | EntityType::Interview
        | EntityType::CompensationRecord
        | EntityType::CompensationProjection
        | EntityType::CareerRecommendation => Domain::Career,
        EntityType::EducationProfile
        | EntityType::EducationGoal
        | EntityType::LearningPath
        | EntityType::School
        | EntityType::Program
        | EntityType::ProgramComparison
        | EntityType::EducationRecommendation => Domain::Education,
        EntityType::FamilyProfile
        | EntityType::Dependent
        | EntityType::SpouseProfile
        | EntityType::GuardianshipPlan
        | EntityType::EstatePlan
        | EntityType::InsuranceProfile
        | EntityType::CollegePlanning
        | EntityType::FamilyRecommendation => Domain::Family,
        EntityType::LifeDecision | EntityType::DecisionScenario => Domain::Decision,
        _ => Domain::General,
    }
}

#[cfg(test)]
mod career_tests {
    use super::*;

    /// Every mapped Career entity has at least one incoming edge → it can NEVER
    /// fall back to RELATED_TO.
    #[test]
    fn all_career_entities_registry_mapped() {
        for et in [
            EntityType::CareerProfile,
            EntityType::CareerGoal,
            EntityType::ExperienceRecord,
            EntityType::Skill,
            EntityType::UserSkill,
            EntityType::SkillGap,
            EntityType::Credential,
            EntityType::Certification,
            EntityType::Degree,
            EntityType::Resume,
            EntityType::PortfolioItem,
            EntityType::JobTarget,
            EntityType::JobApplication,
            EntityType::Interview,
            EntityType::CompensationRecord,
            EntityType::CompensationProjection,
            EntityType::CareerRecommendation,
        ] {
            assert!(
                is_registry_mapped(&et),
                "{et:?} not registry-mapped (would RELATED_TO)"
            );
            assert_eq!(domain_of(&et), Domain::Career, "{et:?} wrong domain_of");
        }
    }

    #[test]
    fn career_user_anchor_edges_are_typed_and_required() {
        let cases = [
            (EntityType::CareerProfile, "HAS_CAREER"),
            (EntityType::CareerGoal, "HAS_GOAL"),
            (EntityType::ExperienceRecord, "HAS_EXPERIENCE"),
            (EntityType::UserSkill, "HAS_SKILL"),
            (EntityType::JobTarget, "TARGETS_ROLE"),
            (EntityType::CompensationRecord, "HAS_COMPENSATION"),
            (
                EntityType::CompensationProjection,
                "HAS_COMPENSATION_PROJECTION",
            ),
            (EntityType::CareerRecommendation, "HAS_RECOMMENDATION"),
        ];
        for (et, rel) in cases {
            let edges = incoming_edges(&et);
            let anchor = edges
                .iter()
                .find(|e| matches!(e.from, EdgeFrom::UserAnchor))
                .expect("user anchor");
            assert_eq!(anchor.rel_type, rel, "{et:?}");
            assert!(anchor.required, "{et:?} user anchor must be required");
            assert!(edges.iter().all(|e| e.rel_type != "RELATED_TO"));
        }
    }

    /// Optional inter-entity FK edges are declared ONLY where the X1 FK exists,
    /// and they are optional (not required).
    #[test]
    fn career_optional_fk_edges() {
        let us: Vec<_> = incoming_edges(&EntityType::UserSkill)
            .iter()
            .filter(|e| matches!(e.from, EdgeFrom::PayloadFk { .. }))
            .collect();
        assert!(us
            .iter()
            .any(|e| e.rel_type == "HAS_PROFICIENCY" && !e.required));
        let iv: Vec<_> = incoming_edges(&EntityType::Interview).iter()
            .filter(|e| matches!(e.from, EdgeFrom::PayloadFk { field, .. } if field == "job_application_id")).collect();
        assert!(iv
            .iter()
            .any(|e| e.rel_type == "INCLUDES_INTERVIEW" && !e.required));
        // entities with no FK in the X1 schema declare ONLY the user anchor (no faked FK).
        assert!(incoming_edges(&EntityType::CareerGoal)
            .iter()
            .all(|e| matches!(e.from, EdgeFrom::UserAnchor)));
    }

    #[test]
    fn education_entities_registry_mapped_and_user_anchored() {
        let cases = [
            (EntityType::EducationProfile, "HAS_EDUCATION"),
            (EntityType::EducationGoal, "HAS_EDUCATION_GOAL"),
            (EntityType::LearningPath, "HAS_LEARNING_PATH"),
            (EntityType::School, "CONSIDERS_SCHOOL"),
            (EntityType::Program, "EVALUATES_PROGRAM"),
            (EntityType::ProgramComparison, "HAS_PROGRAM_COMPARISON"),
            (EntityType::EducationRecommendation, "HAS_RECOMMENDATION"),
        ];
        for (et, rel) in cases {
            assert!(
                is_registry_mapped(&et),
                "{et:?} not mapped (would RELATED_TO)"
            );
            assert_eq!(domain_of(&et), Domain::Education, "{et:?} domain_of");
            let edges = incoming_edges(&et);
            let anchor = edges
                .iter()
                .find(|e| matches!(e.from, EdgeFrom::UserAnchor))
                .expect("anchor");
            assert_eq!(anchor.rel_type, rel, "{et:?}");
            assert!(edges.iter().all(|e| e.rel_type != "RELATED_TO"));
        }
        // Program OFFERS school via the X1 school_id FK (optional inter-entity).
        let p: Vec<_> = incoming_edges(&EntityType::Program)
            .iter()
            .filter(|e| matches!(e.from, EdgeFrom::PayloadFk { field, .. } if field == "school_id"))
            .collect();
        assert!(p.iter().any(|e| e.rel_type == "OFFERS" && !e.required));
    }

    #[test]
    fn family_entities_registry_mapped_and_user_anchored() {
        let cases = [
            (EntityType::FamilyProfile, "HAS_FAMILY"),
            (EntityType::Dependent, "HAS_DEPENDENT"),
            (EntityType::SpouseProfile, "HAS_SPOUSE"),
            (EntityType::GuardianshipPlan, "HAS_GUARDIANSHIP_PLAN"),
            (EntityType::EstatePlan, "HAS_ESTATE_PLAN"),
            (EntityType::InsuranceProfile, "HAS_INSURANCE_PROFILE"),
            (EntityType::CollegePlanning, "HAS_COLLEGE_PLAN"),
            (EntityType::FamilyRecommendation, "HAS_RECOMMENDATION"),
        ];
        for (et, rel) in cases {
            assert!(
                is_registry_mapped(&et),
                "{et:?} not mapped (would RELATED_TO)"
            );
            assert_eq!(domain_of(&et), Domain::Family, "{et:?} domain_of");
            let edges = incoming_edges(&et);
            let anchor = edges
                .iter()
                .find(|e| matches!(e.from, EdgeFrom::UserAnchor))
                .expect("anchor");
            assert_eq!(anchor.rel_type, rel, "{et:?}");
            assert!(edges.iter().all(|e| e.rel_type != "RELATED_TO"));
        }
        // Dependent COVERS_DEPENDENT via the X1 guardianship_plan_id FK (optional).
        let d: Vec<_> = incoming_edges(&EntityType::Dependent).iter()
            .filter(|e| matches!(e.from, EdgeFrom::PayloadFk { field, .. } if field == "guardianship_plan_id")).collect();
        assert!(d
            .iter()
            .any(|e| e.rel_type == "COVERS_DEPENDENT" && !e.required));
    }
}

#[cfg(test)]
mod manifest_tests {
    use super::*;

    /// The manifest lives INSIDE the core-api Python package, not in `ontology/`, because that is the
    /// only place it actually ships: core-api's Dockerfile does `COPY app ./app` with the service
    /// directory as its build context, so a file at the repo root would be absent from the image and
    /// the planner would fall back at runtime — in production only, where it is hardest to notice.
    /// One canonical copy, in the consumer, kept honest by `manifest_on_disk_matches_the_registry`.
    const MANIFEST_PATH: &str =
        "../lifenavigator-core-api/app/grounding/semantic/ontology_manifest.json";

    /// THE DRIFT GATE.
    ///
    /// core-api's retrieval planner loads the generated manifest. If someone adds a relationship to
    /// `REGISTRY` and does not regenerate, the graph gains an edge type traversal cannot follow — which
    /// is exactly how 24 of 61 relationship types (including every Document Intelligence edge) became
    /// invisible to retrieval while every test passed.
    ///
    /// This fails the build on that. Regenerate with:
    ///   cargo test -p ingestion-worker export_relationship_manifest -- --ignored
    #[test]
    fn manifest_on_disk_matches_the_registry() {
        let raw = std::fs::read_to_string(MANIFEST_PATH).unwrap_or_else(|e| {
            panic!(
                "cannot read {MANIFEST_PATH}: {e}. Generate it with: \
                    cargo test -p ingestion-worker export_relationship_manifest -- --ignored"
            )
        });

        // Compare CONTENT, not bytes.
        //
        // The first version of this gate compared raw strings and broke within the hour: the repo's
        // pre-commit `prettier` pass rewrites .json and normalised `0.80` -> `0.8`, so a FORMATTER,
        // not a drift, failed the build. A contract test that a formatter can break teaches people to
        // bypass it, which is worse than not having the test.
        //
        // The semantics are (rel_type, family, weight). Whitespace and float spelling are not.
        let parse = |s: &str| -> Vec<(String, String, String)> {
            let v: serde_json::Value = serde_json::from_str(s).expect("manifest is valid JSON");
            let mut rows: Vec<(String, String, String)> = v["relationships"]
                .as_array()
                .expect("relationships array")
                .iter()
                .map(|r| {
                    (
                        r["rel_type"].as_str().unwrap_or_default().to_string(),
                        r["family"].as_str().unwrap_or_default().to_string(),
                        // Canonical precision, so 0.8 and 0.80 compare equal.
                        format!("{:.2}", r["weight"].as_f64().unwrap_or_default()),
                    )
                })
                .collect();
            rows.sort();
            rows
        };

        let actual = parse(&raw);
        let expected = parse(&relationship_manifest());
        assert_eq!(
            actual,
            expected,
            "\n\nThe ontology manifest is STALE — the registry declares relationships the generated \
             contract does not.\n\
             core-api's traversal reads that contract, so every un-exported edge type is one the \
             advisor cannot follow.\n\n\
             Regenerate:  cargo test -p ingestion-worker export_relationship_manifest -- --ignored\n"
        );
    }

    /// Every relationship the registry can emit has a DECLARED family — not the `_` fallback.
    ///
    /// Without this, adding an edge and forgetting to classify it silently lands it in `Association`,
    /// weight 0.25, ranked below everything. It would be followable but effectively invisible, which is
    /// the quiet version of the bug this whole change exists to fix.
    #[test]
    fn manifest_covers_every_relationship() {
        // The catalog — not a second hand-maintained list — is the classification gate now.
        //
        // This test previously compared `family_of` against a literal list inside the test. That could
        // only ever cover what someone remembered to paste, and it silently ignored the normalizer's
        // legacy emitter entirely: 86 emittable relationship types were absent from the manifest while
        // this test passed. Asserting against `emittable_relationship_types()` means the gate is derived
        // from the emitters themselves, so a new edge in ANY enumerable emitter fails CI until it is
        // declared with an explicit policy.
        use crate::relationship_catalog::{emittable_relationship_types, spec_for};

        let undeclared: Vec<&str> = emittable_relationship_types()
            .into_iter()
            .filter(|r| spec_for(r).is_none())
            .collect();
        assert!(
            undeclared.is_empty(),
            "executable code can emit {} relationship type(s) with no catalog row: {:?}\n\n\
             Every emittable relationship needs an explicit RelationshipSpec in \
             `relationship_catalog::CATALOG` — including its traversal policy. There is no default \
             policy, because a default would let a new edge acquire permissions nobody decided.\n",
            undeclared.len(),
            undeclared
        );
    }

    /// Requirement: a manifest relationship must carry an explicit traversal-policy decision.
    ///
    /// "Explicit" means the spec names the contexts allowed to follow it. An EMPTY `permitted_contexts`
    /// is a valid, deliberate decision (no context may traverse) — what is not allowed is a row that
    /// never considered the question, which `max_hops > 0` with no contexts would represent.
    #[test]
    fn every_catalog_row_has_an_explicit_traversal_policy() {
        use crate::relationship_catalog::CATALOG;
        let incoherent: Vec<&str> = CATALOG
            .iter()
            .filter(|s| s.max_hops > 0 && s.permitted_contexts.is_empty())
            .map(|s| s.rel_type)
            .collect();
        assert!(
            incoherent.is_empty(),
            "relationship(s) are hop-expandable but permit no query context, which is not a \
             decision — it is an omission: {:?}",
            incoherent
        );
    }

    /// Provider/Arcana B2B edges must never default into personal-advisor retrieval.
    #[test]
    fn provider_b2b_edges_are_not_personal_advisor_eligible() {
        use crate::relationship_catalog::{Classification, CATALOG};
        let leaked: Vec<&str> = CATALOG
            .iter()
            .filter(|s| {
                s.classification == Classification::ProviderB2b && s.personal_advisor_eligible()
            })
            .map(|s| s.rel_type)
            .collect();
        assert!(
            leaked.is_empty(),
            "provider/B2B relationship(s) are personal-advisor eligible. These describe the service \
             relationship around a user, not facts inside their life model; enabling them needs a \
             separate authorization, tenancy and query-context design: {:?}",
            leaked
        );
    }

    /// Fail-closed: an undeclared relationship gets no inferred policy in any context.
    ///
    /// This is the behavioural half of the CI gate above. Even if a row were somehow missing, traversal
    /// planning must refuse rather than guess.
    #[test]
    fn undeclared_relationship_is_refused_in_every_context() {
        use crate::relationship_catalog::{is_traversable_in, spec_for, QueryContext};
        const FAKE: &str = "ZZ_NOT_A_REAL_RELATIONSHIP";
        assert!(spec_for(FAKE).is_none());
        for ctx in [
            QueryContext::PersonalAdvisor,
            QueryContext::ProviderAdvisor,
            QueryContext::OrgAdministrator,
            QueryContext::InternalAudit,
            QueryContext::CentralKnowledge,
        ] {
            assert!(
                !is_traversable_in(FAKE, ctx),
                "undeclared relationship was traversable in {:?} — the planner inferred a policy",
                ctx
            );
        }
    }

    /// RELATED_TO must be in the exported vocabulary. It never appears in REGISTRY (the normalizer
    /// emits it as a fallback), and omitting it is precisely why retrieval could weight it but never
    /// traverse it.
    #[test]
    fn fallback_edge_is_in_the_vocabulary() {
        assert!(all_relationship_types().contains(&"RELATED_TO"));
        assert_eq!(family_of("RELATED_TO"), EdgeFamily::Association);
        assert!(edge_weight("RELATED_TO") < edge_weight("HAS_EVIDENCE"));
    }

    /// Evidence outranks association by a wide margin — the property traversal's ranking depends on.
    #[test]
    fn evidence_outranks_association() {
        assert!(edge_weight("HAS_EVIDENCE") >= 1.0);
        assert!(edge_weight("HAS_EVIDENCE") > edge_weight("LOGGED"));
        assert!(edge_weight("LOGGED") > edge_weight("RELATED_TO"));
    }

    /// The table and the lookup cannot disagree — the lookup IS the table.
    #[test]
    fn registry_table_backs_the_lookup() {
        for (et, edges) in REGISTRY {
            assert_eq!(
                incoming_edges(et).len(),
                edges.len(),
                "{et:?} lookup disagrees with the table"
            );
        }
        assert!(REGISTRY.len() >= 70, "registry unexpectedly small");
    }

    /// Writes the manifest. Ignored by default so a normal `cargo test` never mutates the repo.
    #[test]
    #[ignore]
    fn export_relationship_manifest() {
        let path = std::path::Path::new(MANIFEST_PATH);
        std::fs::create_dir_all(path.parent().unwrap()).expect("create ontology/generated");
        std::fs::write(path, relationship_manifest()).expect("write manifest");
        eprintln!(
            "wrote {} relationship types -> {MANIFEST_PATH}",
            all_relationship_types().len()
        );
    }
}
