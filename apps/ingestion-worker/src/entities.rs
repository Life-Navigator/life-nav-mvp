//! Canonical graph object emitted by the normalizer and consumed by the
//! Qdrant + Neo4j upsert clients.
//!
//! Every personalized graph node carries:
//!   tenant_id (== user_id), user_id, entity_id, entity_type, domain,
//!   source_table, created_at, updated_at, sensitivity_level.
//!
//! All personalized Neo4j queries MUST filter by tenant_id.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// One-line label used by Qdrant for sensitivity-aware filters
/// (and as a Neo4j node property).
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SensitivityLevel {
    Low,
    Medium,
    High,
}

impl SensitivityLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            SensitivityLevel::Low => "low",
            SensitivityLevel::Medium => "medium",
            SensitivityLevel::High => "high",
        }
    }
}

/// Supported entity types (mirrors the Prompt-2 list). The string form
/// is what flows through `graphrag.sync_queue.entity_type`.
#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntityType {
    UserProfile,
    Goal,
    GoalMilestone,
    GoalDependency,
    LifeVision,
    Constraint,
    DecisionPreference,
    DomainRiskTolerance,
    CommitmentLevel,
    Capability,
    Motivation,
    Decision,
    Recommendation,
    Outcome,
    Action,
    LifeEvent,
    FinancialAccount,
    FinancialGoal,
    /// Serializes as "transaction_summary" but also accepts "transaction"
    /// from older triggers (finance.transactions emits entity_type='transaction').
    /// Without the alias, every transaction job deserializes as Unknown,
    /// producing :Unknown Neo4j labels (233 such nodes observed 2026-06-06).
    #[serde(alias = "transaction")]
    TransactionSummary,
    Debt,
    Asset,
    InvestmentHolding,
    TaxProfile,
    EmployerBenefit,
    RetirementPlan,
    HealthProfile,
    HealthMetric,
    BodyMeasurement,
    FitnessProfile,
    WorkoutLog,
    NutritionLog,
    SupplementLog,
    MedicationLog,
    LabRecord,
    HealthInsurancePlan,
    InsuranceDocumentFact,
    CareerProfile,
    JobApplication,
    Skill,
    Certification,
    EducationRecord,
    Course,
    StudyLog,
    FamilyMember,
    LifestyleGoal,
    ArcanaLeadPackage,
    WearableMetric,
    JobPosting,
    EmployerProfile,
    CandidateMatch,
    // ---- Added by migration 074 ----
    GoalDiscoveryTurn,
    GoalInterpretation,
    OptimizerRun,
    OptimizerAllocation,
    OptimizerRecommendation,
    LifeScenario,
    LifeScenarioVersion,
    LifeScenarioDecision,
    LifeScenarioOutput,
    LifeTrajectorySnapshot,
    EstateProfile,
    EstateBeneficiary,
    InsuranceDocument,
    BenefitProfile,
    HealthAlertEvent,
    UserFinancialProfile,
    FinancingPreference,
    EducationIntake,
    Injury,
    // Decision intelligence (migration 080)
    GoalProgressSnapshot,
    GoalProgressEvent,
    GoalProgressScore,
    GoalProgressPrediction,
    CrossDomainImpact,
    OutcomeAttribution,
    PredictionCalibration,
    RecommendationAccuracy,
    AdvisorAccuracy,
    RecommendationQualityMetric,
    PathwayEffectiveness,
    // Decision impact + probability distribution (migration 081)
    GoalProbabilityDistribution,
    GoalProbabilitySnapshot,
    GoalDecisionImpact,
    GoalPathwayProbability,
    GoalFutureState,
    DecisionMarginalImpact,
    TrajectoryVarianceFactor,
    // XAI + Trust Layer (migration 082)
    RecommendationAuditTrail,
    WhyChain,
    EvidenceLink,
    CounterfactualScenario,
    RecommendationAssumption,
    // Conversation Intelligence (migration 084)
    DiscoverySession,
    AssumptionChallenge,
    ConversationTrace,
    // Provider GraphRAG (migration 085)
    ProviderProfile,
    ProviderEngagement,
    ProviderConsentScope,
    ProviderRecommendation,
    ProviderOutcome,
    ProviderKnowledgeEntry,
    ProviderAnalytics,
    // Sprint C — Arcana Health & Performance Activation
    ArcanaProfile,
    ArcanaAssessment,
    ArcanaGoal,
    ArcanaConstraint,
    ArcanaCapability,
    ArcanaMotivation,
    ArcanaReadiness,
    SupplementProtocol,
    TrainingProtocol,
    HealthMilestone,
    BiometricObservation,
    LabResult,
    WearableConnection,
    ArcanaInsuranceDocument,
    LeadPackageConsent,
    ConciergePreference,
    ArcanaMembership,
    /// LifeNavigator beta "sample financial profile" metadata (career, income,
    /// risk, goals) — promoted to the graph alongside Plaid-derived data.
    PersonaProfile,
    /// Catch-all so a new sync-queue entity_type doesn't crash the worker;
    /// the normalizer skips unknown types.
    #[serde(other)]
    Unknown,
}

impl EntityType {
    pub fn from_queue_str(s: &str) -> Self {
        serde_json::from_value::<EntityType>(serde_json::Value::String(s.to_string()))
            .unwrap_or(EntityType::Unknown)
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            EntityType::UserProfile => "user_profile",
            EntityType::Goal => "goal",
            EntityType::GoalMilestone => "goal_milestone",
            EntityType::GoalDependency => "goal_dependency",
            EntityType::LifeVision => "life_vision",
            EntityType::Constraint => "constraint",
            EntityType::DecisionPreference => "decision_preference",
            EntityType::DomainRiskTolerance => "domain_risk_tolerance",
            EntityType::CommitmentLevel => "commitment_level",
            EntityType::Capability => "capability",
            EntityType::Motivation => "motivation",
            EntityType::Decision => "decision",
            EntityType::Recommendation => "recommendation",
            EntityType::Outcome => "outcome",
            EntityType::Action => "action",
            EntityType::LifeEvent => "life_event",
            EntityType::PersonaProfile => "persona_profile",
            EntityType::FinancialAccount => "financial_account",
            EntityType::FinancialGoal => "financial_goal",
            EntityType::TransactionSummary => "transaction_summary",
            EntityType::Debt => "debt",
            EntityType::Asset => "asset",
            EntityType::InvestmentHolding => "investment_holding",
            EntityType::TaxProfile => "tax_profile",
            EntityType::EmployerBenefit => "employer_benefit",
            EntityType::RetirementPlan => "retirement_plan",
            EntityType::HealthProfile => "health_profile",
            EntityType::HealthMetric => "health_metric",
            EntityType::BodyMeasurement => "body_measurement",
            EntityType::FitnessProfile => "fitness_profile",
            EntityType::WorkoutLog => "workout_log",
            EntityType::NutritionLog => "nutrition_log",
            EntityType::SupplementLog => "supplement_log",
            EntityType::MedicationLog => "medication_log",
            EntityType::LabRecord => "lab_record",
            EntityType::HealthInsurancePlan => "health_insurance_plan",
            EntityType::InsuranceDocumentFact => "insurance_document_fact",
            EntityType::CareerProfile => "career_profile",
            EntityType::JobApplication => "job_application",
            EntityType::Skill => "skill",
            EntityType::Certification => "certification",
            EntityType::EducationRecord => "education_record",
            EntityType::Course => "course",
            EntityType::StudyLog => "study_log",
            EntityType::FamilyMember => "family_member",
            EntityType::LifestyleGoal => "lifestyle_goal",
            EntityType::ArcanaLeadPackage => "arcana_lead_package",
            EntityType::WearableMetric => "wearable_metric",
            EntityType::JobPosting => "job_posting",
            EntityType::EmployerProfile => "employer_profile",
            EntityType::CandidateMatch => "candidate_match",
            EntityType::GoalDiscoveryTurn => "goal_discovery_turn",
            EntityType::GoalInterpretation => "goal_interpretation",
            EntityType::OptimizerRun => "optimizer_run",
            EntityType::OptimizerAllocation => "optimizer_allocation",
            EntityType::OptimizerRecommendation => "optimizer_recommendation",
            EntityType::LifeScenario => "life_scenario",
            EntityType::LifeScenarioVersion => "life_scenario_version",
            EntityType::LifeScenarioDecision => "life_scenario_decision",
            EntityType::LifeScenarioOutput => "life_scenario_output",
            EntityType::LifeTrajectorySnapshot => "life_trajectory_snapshot",
            EntityType::EstateProfile => "estate_profile",
            EntityType::EstateBeneficiary => "estate_beneficiary",
            EntityType::InsuranceDocument => "insurance_document",
            EntityType::BenefitProfile => "benefit_profile",
            EntityType::HealthAlertEvent => "health_alert_event",
            EntityType::UserFinancialProfile => "user_financial_profile",
            EntityType::FinancingPreference => "financing_preference",
            EntityType::EducationIntake => "education_intake",
            EntityType::Injury => "injury",
            EntityType::GoalProgressSnapshot => "goal_progress_snapshot",
            EntityType::GoalProgressEvent => "goal_progress_event",
            EntityType::GoalProgressScore => "goal_progress_score",
            EntityType::GoalProgressPrediction => "goal_progress_prediction",
            EntityType::CrossDomainImpact => "cross_domain_impact",
            EntityType::OutcomeAttribution => "outcome_attribution",
            EntityType::PredictionCalibration => "prediction_calibration",
            EntityType::RecommendationAccuracy => "recommendation_accuracy",
            EntityType::AdvisorAccuracy => "advisor_accuracy",
            EntityType::RecommendationQualityMetric => "recommendation_quality_metric",
            EntityType::PathwayEffectiveness => "pathway_effectiveness",
            EntityType::GoalProbabilityDistribution => "goal_probability_distribution",
            EntityType::GoalProbabilitySnapshot => "goal_probability_snapshot",
            EntityType::GoalDecisionImpact => "goal_decision_impact",
            EntityType::GoalPathwayProbability => "goal_pathway_probability",
            EntityType::GoalFutureState => "goal_future_state",
            EntityType::DecisionMarginalImpact => "decision_marginal_impact",
            EntityType::TrajectoryVarianceFactor => "trajectory_variance_factor",
            EntityType::RecommendationAuditTrail => "recommendation_audit_trail",
            EntityType::WhyChain => "why_chain",
            EntityType::EvidenceLink => "evidence_link",
            EntityType::CounterfactualScenario => "counterfactual_scenario",
            EntityType::RecommendationAssumption => "recommendation_assumption",
            EntityType::DiscoverySession => "discovery_session",
            EntityType::AssumptionChallenge => "assumption_challenge",
            EntityType::ConversationTrace => "conversation_trace",
            EntityType::ProviderProfile => "provider_profile",
            EntityType::ProviderEngagement => "provider_engagement",
            EntityType::ProviderConsentScope => "provider_consent_scope",
            EntityType::ProviderRecommendation => "provider_recommendation",
            EntityType::ProviderOutcome => "provider_outcome",
            EntityType::ProviderKnowledgeEntry => "provider_knowledge_entry",
            EntityType::ProviderAnalytics => "provider_analytics",
            EntityType::ArcanaProfile => "arcana_profile",
            EntityType::ArcanaAssessment => "arcana_assessment",
            EntityType::ArcanaGoal => "arcana_goal",
            EntityType::ArcanaConstraint => "arcana_constraint",
            EntityType::ArcanaCapability => "arcana_capability",
            EntityType::ArcanaMotivation => "arcana_motivation",
            EntityType::ArcanaReadiness => "arcana_readiness",
            EntityType::SupplementProtocol => "supplement_protocol",
            EntityType::TrainingProtocol => "training_protocol",
            EntityType::HealthMilestone => "health_milestone",
            EntityType::BiometricObservation => "biometric_observation",
            EntityType::LabResult => "lab_result",
            EntityType::WearableConnection => "wearable_connection",
            EntityType::ArcanaInsuranceDocument => "arcana_insurance_document",
            EntityType::LeadPackageConsent => "lead_package_consent",
            EntityType::ConciergePreference => "concierge_preference",
            EntityType::ArcanaMembership => "arcana_membership",
            EntityType::Unknown => "unknown",
        }
    }

    pub fn domain(&self) -> &'static str {
        match self {
            EntityType::FinancialAccount
            | EntityType::FinancialGoal
            | EntityType::TransactionSummary
            | EntityType::Debt
            | EntityType::Asset
            | EntityType::InvestmentHolding
            | EntityType::TaxProfile
            | EntityType::EmployerBenefit
            | EntityType::RetirementPlan
            | EntityType::UserFinancialProfile
            | EntityType::FinancingPreference
            | EntityType::OptimizerRun
            | EntityType::OptimizerAllocation
            | EntityType::OptimizerRecommendation
            | EntityType::LifeScenario
            | EntityType::LifeScenarioVersion
            | EntityType::LifeScenarioDecision
            | EntityType::LifeScenarioOutput
            | EntityType::LifeTrajectorySnapshot => "financial",

            EntityType::HealthProfile
            | EntityType::HealthMetric
            | EntityType::BodyMeasurement
            | EntityType::FitnessProfile
            | EntityType::WorkoutLog
            | EntityType::NutritionLog
            | EntityType::SupplementLog
            | EntityType::MedicationLog
            | EntityType::LabRecord
            | EntityType::WearableMetric
            | EntityType::Injury
            | EntityType::HealthAlertEvent => "health",

            EntityType::HealthInsurancePlan
            | EntityType::InsuranceDocumentFact
            | EntityType::InsuranceDocument
            | EntityType::BenefitProfile => "insurance",

            EntityType::CareerProfile | EntityType::JobApplication | EntityType::Skill => "career",

            EntityType::Certification
            | EntityType::EducationRecord
            | EntityType::Course
            | EntityType::StudyLog
            | EntityType::EducationIntake => "education",

            EntityType::FamilyMember | EntityType::LifestyleGoal => "lifestyle",

            EntityType::EstateProfile | EntityType::EstateBeneficiary => "estate",

            EntityType::GoalDiscoveryTurn | EntityType::GoalInterpretation => "goals",

            EntityType::ArcanaLeadPackage => "arcana",

            EntityType::JobPosting | EntityType::EmployerProfile | EntityType::CandidateMatch => {
                "jobs"
            }

            EntityType::GoalProgressSnapshot
            | EntityType::GoalProgressEvent
            | EntityType::GoalProgressScore
            | EntityType::GoalProgressPrediction
            | EntityType::PathwayEffectiveness => "goal_progress",

            EntityType::CrossDomainImpact | EntityType::OutcomeAttribution => "attribution",

            EntityType::PredictionCalibration
            | EntityType::RecommendationAccuracy
            | EntityType::AdvisorAccuracy
            | EntityType::RecommendationQualityMetric => "calibration",

            EntityType::GoalProbabilityDistribution
            | EntityType::GoalProbabilitySnapshot
            | EntityType::GoalPathwayProbability
            | EntityType::GoalFutureState
            | EntityType::TrajectoryVarianceFactor => "probability",

            EntityType::GoalDecisionImpact | EntityType::DecisionMarginalImpact => {
                "decision_impact"
            }

            EntityType::RecommendationAuditTrail
            | EntityType::WhyChain
            | EntityType::EvidenceLink
            | EntityType::CounterfactualScenario
            | EntityType::RecommendationAssumption => "xai",

            EntityType::DiscoverySession
            | EntityType::AssumptionChallenge
            | EntityType::ConversationTrace => "conversation",

            EntityType::ProviderProfile
            | EntityType::ProviderEngagement
            | EntityType::ProviderConsentScope
            | EntityType::ProviderRecommendation
            | EntityType::ProviderOutcome
            | EntityType::ProviderKnowledgeEntry
            | EntityType::ProviderAnalytics => "provider",

            EntityType::ArcanaProfile
            | EntityType::ArcanaAssessment
            | EntityType::ArcanaGoal
            | EntityType::ArcanaConstraint
            | EntityType::ArcanaCapability
            | EntityType::ArcanaMotivation
            | EntityType::ArcanaReadiness
            | EntityType::SupplementProtocol
            | EntityType::TrainingProtocol
            | EntityType::HealthMilestone
            | EntityType::BiometricObservation
            | EntityType::LabResult
            | EntityType::WearableConnection
            | EntityType::ArcanaInsuranceDocument
            | EntityType::LeadPackageConsent
            | EntityType::ConciergePreference
            | EntityType::ArcanaMembership => "arcana",

            _ => "general",
        }
    }

    pub fn sensitivity(&self) -> SensitivityLevel {
        match self {
            EntityType::HealthProfile
            | EntityType::HealthMetric
            | EntityType::BodyMeasurement
            | EntityType::WorkoutLog
            | EntityType::NutritionLog
            | EntityType::SupplementLog
            | EntityType::MedicationLog
            | EntityType::LabRecord
            | EntityType::HealthInsurancePlan
            | EntityType::InsuranceDocumentFact
            | EntityType::InsuranceDocument
            | EntityType::WearableMetric
            | EntityType::ArcanaLeadPackage
            | EntityType::Injury
            | EntityType::HealthAlertEvent
            | EntityType::EstateProfile
            | EntityType::EstateBeneficiary
            // Sprint C — all Arcana child entities are High by default
            | EntityType::ArcanaProfile
            | EntityType::ArcanaAssessment
            | EntityType::ArcanaGoal
            | EntityType::ArcanaConstraint
            | EntityType::ArcanaCapability
            | EntityType::ArcanaMotivation
            | EntityType::ArcanaReadiness
            | EntityType::SupplementProtocol
            | EntityType::TrainingProtocol
            | EntityType::HealthMilestone
            | EntityType::BiometricObservation
            | EntityType::LabResult
            | EntityType::WearableConnection
            | EntityType::ArcanaInsuranceDocument
            | EntityType::LeadPackageConsent
            | EntityType::ConciergePreference
            | EntityType::ArcanaMembership => SensitivityLevel::High,

            EntityType::FinancialAccount
            | EntityType::Debt
            | EntityType::Asset
            | EntityType::InvestmentHolding
            | EntityType::TaxProfile
            | EntityType::RetirementPlan
            | EntityType::EmployerBenefit
            | EntityType::UserFinancialProfile
            | EntityType::FinancingPreference
            | EntityType::BenefitProfile
            | EntityType::OptimizerRun
            | EntityType::OptimizerAllocation
            | EntityType::OptimizerRecommendation
            | EntityType::LifeScenarioOutput
            | EntityType::LifeTrajectorySnapshot
            | EntityType::TransactionSummary => SensitivityLevel::Medium,

            _ => SensitivityLevel::Low,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Relationship {
    pub label: String,
    pub target_entity_type: String,
    pub target_entity_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct CanonicalGraphObject {
    pub tenant_id: Uuid,
    pub user_id: Uuid,
    pub entity_id: String,
    pub entity_type: String,
    pub domain: String,
    pub source_table: String,
    /// Short label.
    pub title: String,
    /// Embedding-ready summary — the only field passed to the embedder.
    pub summary: String,
    /// Sanitized attribute bag (sensitive fields stripped).
    pub attributes: serde_json::Map<String, serde_json::Value>,
    pub relationships: Vec<Relationship>,
    pub sensitivity_level: SensitivityLevel,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl CanonicalGraphObject {
    /// Stable Qdrant point id, derived deterministically from tenant +
    /// entity_type + entity_id so re-runs are idempotent.
    pub fn qdrant_point_id(&self) -> String {
        qdrant_point_uuid(&self.tenant_id.to_string(), &self.entity_type, &self.entity_id)
    }
}

/// Qdrant point IDs must be an unsigned integer or a UUID — a composite
/// string like `tenant|type|id` is rejected (HTTP 400). Derive a stable
/// UUIDv5 from that composite key so upserts and deletes address the same
/// point deterministically.
pub fn qdrant_point_uuid(tenant_id: &str, entity_type: &str, entity_id: &str) -> String {
    let key = format!("{tenant_id}|{entity_type}|{entity_id}");
    uuid::Uuid::new_v5(&uuid::Uuid::NAMESPACE_URL, key.as_bytes()).to_string()
}

#[cfg(test)]
mod point_id_tests {
    use super::qdrant_point_uuid;

    #[test]
    fn point_id_is_a_valid_uuid() {
        let id = qdrant_point_uuid("11111111-1111-1111-1111-111111111111", "financial_account", "abc");
        // Qdrant requires int or UUID — must parse as a UUID, not a pipe string.
        assert!(uuid::Uuid::parse_str(&id).is_ok(), "not a uuid: {id}");
        assert!(!id.contains('|'));
    }

    #[test]
    fn point_id_is_deterministic_and_distinct() {
        let a = qdrant_point_uuid("t", "financial_account", "1");
        let b = qdrant_point_uuid("t", "financial_account", "1");
        let c = qdrant_point_uuid("t", "financial_account", "2");
        assert_eq!(a, b); // stable across runs → idempotent upsert/delete
        assert_ne!(a, c); // different entity → different point
    }
}
