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
            | EntityType::EstateBeneficiary => SensitivityLevel::High,

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
    /// Stable Qdrant point id (UUID v5-style derived deterministically
    /// from tenant + entity_type + entity_id so that re-runs are
    /// idempotent without us having to remember the previous Qdrant id).
    pub fn qdrant_point_id(&self) -> String {
        format!("{}|{}|{}", self.tenant_id, self.entity_type, self.entity_id)
    }
}
