//! Maps a `SyncQueueJob` to the `CanonicalGraphObject` the rest of the
//! pipeline consumes.
//!
//! Two invariants this module enforces:
//!
//!   1. `tenant_id == user_id`. Personalized GraphRAG is single-tenant
//!      per user; the worker never co-mingles users.
//!
//!   2. The embedding-ready `summary` and the persisted `attributes`
//!      bag NEVER contain a sensitive field. The
//!      `SENSITIVE_FIELD_PATTERN` from telemetry.rs is the single source
//!      of truth for "what we never let through".
//!
//! Both invariants are verified by the integration tests under tests/.

use chrono::{DateTime, Utc};
use serde_json::{Map, Value};
use uuid::Uuid;

use crate::entities::{CanonicalGraphObject, EntityType, Relationship};
use crate::errors::{Result, WorkerError};
use crate::queue::SyncQueueJob;
use crate::telemetry::SENSITIVE_FIELD_PATTERN;

/// Build the canonical object for a queue job.
///
/// `now` is parameterized so tests are deterministic.
pub fn normalize(job: &SyncQueueJob, now: DateTime<Utc>) -> Result<CanonicalGraphObject> {
    let entity_type = EntityType::from_queue_str(&job.entity_type);

    let payload = job.payload.as_object().cloned().unwrap_or_default();
    let sanitized = sanitize(&payload);

    let title = build_title(&entity_type, &sanitized);
    let summary = build_summary(&entity_type, &sanitized);
    let relationships = relationships_for(&entity_type, &job.user_id.to_string());

    Ok(CanonicalGraphObject {
        tenant_id: job.user_id,
        user_id: job.user_id,
        entity_id: job.entity_id.clone(),
        entity_type: entity_type.as_str().to_string(),
        domain: entity_type.domain().to_string(),
        source_table: job.source_table.clone(),
        title,
        summary,
        attributes: sanitized,
        relationships,
        sensitivity_level: entity_type.sensitivity(),
        created_at: parse_ts(&payload, "created_at").unwrap_or(now),
        updated_at: parse_ts(&payload, "updated_at").unwrap_or(now),
    })
}

/// Recursive sensitive-field stripper. Returns a fresh Map.
/// `null` values are dropped to keep the embedding text terse.
pub fn sanitize(map: &Map<String, Value>) -> Map<String, Value> {
    let mut out = Map::with_capacity(map.len());
    for (k, v) in map {
        if SENSITIVE_FIELD_PATTERN.is_match(k) {
            // Drop sensitive keys entirely. We deliberately do NOT
            // replace with "[REDACTED]" here because that string would
            // then end up embedded — a wasted token at best.
            continue;
        }
        let v = match v {
            Value::Object(inner) => Value::Object(sanitize(inner)),
            Value::Array(arr) => Value::Array(
                arr.iter()
                    .map(|x| match x {
                        Value::Object(o) => Value::Object(sanitize(o)),
                        other => other.clone(),
                    })
                    .collect(),
            ),
            Value::Null => continue, // drop nulls
            other => other.clone(),
        };
        out.insert(k.clone(), v);
    }
    out
}

fn build_title(et: &EntityType, attrs: &Map<String, Value>) -> String {
    let by_key = |keys: &[&str]| -> Option<String> {
        for k in keys {
            if let Some(Value::String(s)) = attrs.get(*k) {
                if !s.trim().is_empty() {
                    return Some(s.trim().to_string());
                }
            }
        }
        None
    };

    match et {
        EntityType::Goal | EntityType::FinancialGoal | EntityType::LifestyleGoal => {
            by_key(&["title", "name"]).unwrap_or_else(|| "Goal".into())
        }
        EntityType::FinancialAccount => by_key(&["account_name", "institution_name", "name"])
            .unwrap_or_else(|| "Account".into()),
        EntityType::Debt => by_key(&["debt_name", "name"]).unwrap_or_else(|| "Debt".into()),
        EntityType::JobApplication => format!(
            "{} @ {}",
            by_key(&["position", "title"]).unwrap_or_else(|| "Role".into()),
            by_key(&["company"]).unwrap_or_else(|| "Company".into())
        ),
        EntityType::HealthInsurancePlan => {
            by_key(&["plan_name", "carrier"]).unwrap_or_else(|| "Insurance plan".into())
        }
        EntityType::CareerProfile => {
            by_key(&["current_title", "title"]).unwrap_or_else(|| "Career profile".into())
        }
        EntityType::EducationRecord => by_key(&["institution_name", "degree_type"])
            .unwrap_or_else(|| "Education record".into()),
        EntityType::WorkoutLog => {
            by_key(&["session_name", "modality"]).unwrap_or_else(|| "Workout".into())
        }
        _ => by_key(&["title", "name", "label", "action"]).unwrap_or_else(|| et.as_str().into()),
    }
}

fn flatten_value(v: &Value) -> Option<String> {
    match v {
        Value::String(s) if !s.trim().is_empty() => Some(s.trim().to_string()),
        Value::Number(n) => Some(n.to_string()),
        Value::Bool(b) => Some(b.to_string()),
        Value::Array(arr) => {
            let items: Vec<String> = arr.iter().filter_map(flatten_value).collect();
            if items.is_empty() {
                None
            } else {
                Some(items.join(", "))
            }
        }
        _ => None,
    }
}

/// Build a short, embedding-ready summary. We deliberately enumerate
/// fields per entity type rather than blindly stringifying the whole
/// payload, so the embedding is information-dense and stable.
fn build_summary(et: &EntityType, attrs: &Map<String, Value>) -> String {
    let parts_for = |keys: &[&str]| -> Vec<String> {
        keys.iter()
            .filter_map(|k| {
                attrs
                    .get(*k)
                    .and_then(flatten_value)
                    .map(|v| format!("{k}: {v}"))
            })
            .collect()
    };

    let parts: Vec<String> = match et {
        EntityType::Goal => parts_for(&[
            "title",
            "category",
            "description",
            "target_value",
            "target_unit",
            "priority",
            "status",
            "urgency",
            "root_goal",
            "dominant_driver",
        ]),
        EntityType::PersonaProfile => parts_for(&[
            "display_name",
            "profession",
            "life_stage",
            "family",
            "income_type",
            "spending_pattern",
            "asset_profile",
            "liability_profile",
            "investment_profile",
            "risk_profile",
        ]),
        EntityType::FinancialAccount => parts_for(&[
            "account_name",
            "account_type",
            "institution_name",
            "current_balance",
            "currency",
            "interest_rate",
        ]),
        EntityType::Debt => parts_for(&[
            "debt_name",
            "debt_type",
            "current_balance",
            "interest_rate",
            "minimum_payment",
            "payoff_strategy",
        ]),
        EntityType::CareerProfile => parts_for(&[
            "current_title",
            "current_company",
            "industry",
            "years_of_experience",
            "desired_title",
            "skills",
            "skill_gaps",
            "job_change_willingness",
        ]),
        EntityType::EducationRecord => parts_for(&[
            "institution_name",
            "degree_type",
            "field_of_study",
            "status",
            "gpa",
        ]),
        EntityType::HealthInsurancePlan => parts_for(&[
            "plan_type",
            "carrier",
            "plan_name",
            "monthly_premium",
            "annual_deductible",
            "out_of_pocket_max",
            "coinsurance_percent",
        ]),
        EntityType::WorkoutLog => parts_for(&[
            "modality",
            "session_name",
            "duration_minutes",
            "intensity",
            "rpe",
            "calories_burned",
        ]),
        EntityType::NutritionLog => parts_for(&[
            "calories",
            "protein_g",
            "carb_g",
            "fat_g",
            "fiber_g",
            "water_ml",
            "adherence_score",
        ]),
        EntityType::JobPosting => parts_for(&[
            "title",
            "industry",
            "employment_type",
            "remote_mode",
            "experience_level",
            "salary_min",
            "salary_max",
        ]),
        // ---- Added in 074 ----
        EntityType::LifeVision => parts_for(&["horizon", "vision_text", "domains"]),
        EntityType::Constraint => parts_for(&[
            "dimension",
            "severity",
            "description",
            "value_numeric",
            "value_unit",
        ]),
        EntityType::Capability => parts_for(&[
            "capability_name",
            "domain",
            "proficiency_level",
            "self_assessed",
        ]),
        EntityType::CommitmentLevel => {
            parts_for(&["domain", "hours_per_week", "energy_level", "duration_weeks"])
        }
        EntityType::Motivation => parts_for(&["motivation_text", "motivation_type", "intensity"]),
        EntityType::DecisionPreference => parts_for(&["axis", "weight", "notes"]),
        EntityType::DomainRiskTolerance => {
            parts_for(&["domain", "tolerance_score", "qualitative_level"])
        }
        EntityType::Decision => parts_for(&[
            "title",
            "description",
            "decision_type",
            "rationale",
            "reversibility",
            "status",
        ]),
        EntityType::Recommendation => parts_for(&[
            "action",
            "rationale",
            "expected_impact",
            "priority",
            "status",
        ]),
        EntityType::Outcome => parts_for(&[
            "outcome_type",
            "observed_value",
            "observed_unit",
            "observed_at",
        ]),
        EntityType::Action => parts_for(&[
            "domain",
            "action_type",
            "action_title",
            "status",
            "taken_at",
        ]),
        EntityType::LifeEvent => parts_for(&[
            "event_type",
            "event_title",
            "occurred_at",
            "expected_at",
            "impact_level",
        ]),
        EntityType::GoalDiscoveryTurn => parts_for(&[
            "prompt_kind",
            "user_answer",
            "inferred_root_goal",
            "confidence_after_turn",
        ]),
        EntityType::GoalInterpretation => {
            parts_for(&["stated_goal", "inferred_true_goal", "confidence_score"])
        }
        EntityType::OptimizerRun => parts_for(&[
            "status",
            "monthly_surplus",
            "next_best_action",
            "summary",
            "confidence_score",
        ]),
        EntityType::OptimizerAllocation => parts_for(&[
            "category",
            "amount_usd",
            "share_pct",
            "priority",
            "rationale",
        ]),
        EntityType::OptimizerRecommendation => parts_for(&["title", "body", "status"]),
        EntityType::LifeScenario => parts_for(&["title", "description", "domain", "status"]),
        EntityType::LifeScenarioVersion => {
            parts_for(&["label", "version_index", "horizon_years", "status"])
        }
        EntityType::LifeScenarioOutput => parts_for(&[
            "final_net_worth",
            "final_debt",
            "final_annual_income",
            "emergency_fund_months_final",
            "retirement_ready",
            "rationale",
        ]),
        EntityType::LifeTrajectorySnapshot => parts_for(&[
            "net_worth",
            "annual_income",
            "monthly_cash_flow",
            "total_debt",
            "emergency_months",
            "health_cost_exposure",
        ]),
        EntityType::EstateProfile => parts_for(&[
            "has_will",
            "has_living_trust",
            "has_financial_poa",
            "has_healthcare_poa",
            "has_healthcare_directive",
            "guardian_designated",
            "owns_business",
            "digital_asset_inventory_status",
            "charitable_intent",
        ]),
        EntityType::EstateBeneficiary => parts_for(&[
            "beneficiary_name",
            "relationship",
            "asset_class",
            "allocation_percent",
            "is_contingent",
        ]),
        EntityType::InsuranceDocument => parts_for(&["document_type", "filename", "ocr_status"]),
        EntityType::BenefitProfile => parts_for(&[
            "has_employer_wellness_stipend",
            "has_education_reimbursement",
            "has_commuter_benefits",
            "has_dependent_care_fsa",
            "has_espp",
            "has_va_benefits",
        ]),
        EntityType::HealthAlertEvent => {
            parts_for(&["rule_key", "severity", "headline", "recommended_next_step"])
        }
        EntityType::UserFinancialProfile => parts_for(&[
            "annual_income",
            "income_stability",
            "employment_type",
            "monthly_expenses",
            "emergency_fund_months",
            "credit_score_range",
            "employer_match_percent",
            "estimated_marginal_tax_bracket",
        ]),
        EntityType::FinancingPreference => parts_for(&[
            "liquidity_preference",
            "liquidity_target_months",
            "debt_pay_weight",
            "invest_weight",
            "save_weight",
        ]),
        EntityType::EducationIntake => parts_for(&[
            "highest_completed_degree",
            "current_program",
            "current_institution",
            "tuition_budget_annual",
            "expected_roi_preference",
            "credential_urgency",
            "has_gi_bill",
            "desired_schools",
        ]),
        EntityType::Injury => parts_for(&[
            "body_region",
            "side",
            "severity",
            "pain_score",
            "status",
            "affects_modalities",
        ]),
        EntityType::CandidateMatch => {
            parts_for(&["match_score", "status", "employer_facing_summary"])
        }
        // Decision-intelligence completion (migration 080) — every row
        // is structured + non-sensitive; the summary names the metric +
        // numbers so retrieval can match on the canonical phrasing.
        EntityType::GoalProgressSnapshot => parts_for(&["score", "confidence", "source"]),
        EntityType::GoalProgressEvent => {
            parts_for(&["event_type", "delta", "occurred_at", "reason"])
        }
        EntityType::GoalProgressScore => {
            parts_for(&["period", "period_start", "score", "delta", "events_count"])
        }
        EntityType::GoalProgressPrediction => parts_for(&[
            "target_date",
            "predicted_score",
            "confidence",
            "model_version",
            "validation_score",
            "validation_error",
        ]),
        EntityType::CrossDomainImpact => parts_for(&[
            "source_domain",
            "target_domain",
            "label",
            "strength",
            "confidence",
        ]),
        EntityType::OutcomeAttribution => parts_for(&[
            "attributed_to_action_id",
            "attribution_share",
            "confidence",
            "reasoning",
        ]),
        EntityType::PredictionCalibration => parts_for(&[
            "predicted_confidence",
            "actual_correct",
            "actual_value",
            "bucket",
        ]),
        EntityType::RecommendationAccuracy => parts_for(&[
            "action_id",
            "predicted_strength",
            "observed_outcome_quality",
            "observed_strength",
            "accuracy_score",
        ]),
        EntityType::AdvisorAccuracy => parts_for(&[
            "advisor_run_id",
            "total_actions",
            "completed_actions",
            "mean_predicted_confidence",
            "mean_observed_outcome_quality",
            "brier_score",
            "calibration_error",
            "confidence_accuracy_gap",
        ]),
        EntityType::RecommendationQualityMetric => parts_for(&[
            "period",
            "period_start",
            "recommendation_type",
            "domain",
            "total",
            "success_rate",
            "completion_rate",
            "mean_outcome_quality",
        ]),
        EntityType::PathwayEffectiveness => parts_for(&[
            "root_goal_concept",
            "pathway_label",
            "sample_size",
            "success_rate",
            "completion_rate",
            "mean_duration_months",
        ]),
        // 081 — probability + impact entities
        EntityType::GoalProbabilityDistribution => parts_for(&[
            "time_horizon",
            "worst_case",
            "p10",
            "p25",
            "most_likely",
            "p75",
            "p90",
            "best_case",
            "confidence",
        ]),
        EntityType::GoalProbabilitySnapshot => parts_for(&[
            "time_horizon",
            "most_likely",
            "range_width",
            "confidence",
            "snapshot_at",
        ]),
        EntityType::GoalDecisionImpact => parts_for(&[
            "decision_label",
            "time_horizon",
            "probability_delta",
            "timeline_delta_months",
            "risk_delta",
            "is_structural",
            "structural_variable",
            "confidence",
        ]),
        EntityType::GoalPathwayProbability => parts_for(&[
            "pathway_label",
            "time_horizon",
            "most_likely",
            "worst_case",
            "best_case",
            "confidence",
        ]),
        EntityType::GoalFutureState => parts_for(&[
            "time_horizon",
            "path_kind",
            "projected_score",
            "projected_at",
            "confidence",
        ]),
        EntityType::DecisionMarginalImpact => parts_for(&[
            "rank",
            "decision_label",
            "target_goal_concept",
            "domain",
            "marginal_impact",
            "time_horizon",
            "confidence",
        ]),
        EntityType::TrajectoryVarianceFactor => {
            parts_for(&["factor_kind", "factor_label", "effect", "confidence"])
        }
        // 082 — XAI + Trust Layer
        EntityType::RecommendationAuditTrail => parts_for(&[
            "target_kind",
            "engine_versions",
            "duration_ms",
            "computed_at",
        ]),
        EntityType::WhyChain => parts_for(&["target_kind", "max_depth", "computed_at"]),
        EntityType::EvidenceLink => parts_for(&[
            "target_kind",
            "source_kind",
            "source_label",
            "citation_reference",
            "confidence",
            "weight",
        ]),
        EntityType::CounterfactualScenario => parts_for(&[
            "target_kind",
            "scenario_label",
            "expected_outcome",
            "sensitivity",
            "delta_summary",
        ]),
        EntityType::RecommendationAssumption => parts_for(&[
            "target_kind",
            "assumption_text",
            "severity",
            "sensitivity",
            "source_engine",
        ]),
        // 084 — Conversation Intelligence
        EntityType::DiscoverySession => parts_for(&[
            "domain",
            "status",
            "current_depth",
            "dominant_driver",
            "secondary_driver",
            "driver_confidence",
            "inferred_root_goal",
        ]),
        EntityType::AssumptionChallenge => parts_for(&[
            "assumption_text",
            "challenge_kind",
            "response_state",
            "changed_outcome",
        ]),
        EntityType::ConversationTrace => parts_for(&[
            "turn_index",
            "classified_intent",
            "turn_kind",
            "explainer_kind",
            "used_llm",
            "missing_info_count",
            "contradiction_count",
        ]),
        // 085 — Provider GraphRAG
        EntityType::ProviderProfile => parts_for(&[
            "provider_type",
            "legal_name",
            "primary_domains",
            "specialties",
            "verified",
        ]),
        EntityType::ProviderEngagement => parts_for(&[
            "status",
            "allowed_domains",
            "max_sensitivity",
            "can_issue_recommendations",
            "initiated_by",
            "accepted_at",
            "expires_at",
        ]),
        EntityType::ProviderConsentScope => parts_for(&["scope_kind", "entity_type"]),
        EntityType::ProviderRecommendation => parts_for(&[
            "domain",
            "title",
            "body",
            "rationale",
            "expected_horizon_months",
            "expected_strength",
            "status",
        ]),
        EntityType::ProviderOutcome => parts_for(&[
            "dimension",
            "observed_value",
            "observed_unit",
            "expected_value",
            "delta",
            "accuracy_score",
            "outcome_quality",
            "source",
        ]),
        EntityType::ProviderKnowledgeEntry => {
            parts_for(&["entry_kind", "title", "domain", "tags", "visibility"])
        }
        EntityType::ProviderAnalytics => parts_for(&[
            "period",
            "period_start",
            "active_patient_count",
            "recommendations_issued",
            "recommendations_completed",
            "success_rate",
            "mean_outcome_quality",
        ]),
        // 086 — Arcana Health & Performance
        EntityType::ArcanaProfile => parts_for(&[
            "intake_source",
            "membership_tier",
            "dominant_driver",
            "secondary_driver",
            "readiness_score",
        ]),
        EntityType::ArcanaAssessment => parts_for(&[
            "assessment_kind",
            "summary",
            "confidence",
        ]),
        EntityType::ArcanaGoal => parts_for(&[
            "goal_kind",
            "domain",
            "title",
            "description",
            "target_value",
            "target_unit",
            "target_date",
            "why_text",
        ]),
        EntityType::ArcanaConstraint => parts_for(&[
            "constraint_kind",
            "description",
            "severity",
            "value_numeric",
            "value_unit",
        ]),
        EntityType::ArcanaCapability => parts_for(&[
            "capability_kind",
            "proficiency",
            "description",
        ]),
        EntityType::ArcanaMotivation => parts_for(&[
            "driver",
            "motivation_text",
            "intensity",
            "surfaced_at_depth",
        ]),
        EntityType::ArcanaReadiness => parts_for(&[
            "overall_score",
            "motivation_score",
            "capability_score",
            "capacity_score",
            "consistency_score",
            "recommended_membership",
        ]),
        EntityType::SupplementProtocol => parts_for(&[
            "supplement_name",
            "brand",
            "dose",
            "dose_unit",
            "frequency",
            "timing",
            "source",
            "active",
        ]),
        EntityType::TrainingProtocol => parts_for(&[
            "protocol_name",
            "protocol_kind",
            "sessions_per_week",
            "duration_min_per_session",
            "periodization_kind",
            "active",
        ]),
        EntityType::HealthMilestone => parts_for(&[
            "title",
            "description",
            "target_date",
            "achieved_at",
        ]),
        EntityType::BiometricObservation => parts_for(&[
            "metric_kind",
            "value",
            "unit",
            "source",
            "source_wearable",
            "collected_at",
        ]),
        EntityType::LabResult => parts_for(&[
            "lab_kind",
            "panel_name",
            "collection_date",
            "result_value",
            "unit",
            "flag",
            "lab_source",
        ]),
        EntityType::WearableConnection => {
            parts_for(&["provider", "status", "scopes", "connected_at"])
        }
        EntityType::ArcanaInsuranceDocument => parts_for(&[
            "document_kind",
            "ocr_status",
            "uploaded_at",
        ]),
        EntityType::LeadPackageConsent => parts_for(&[
            "consent_kind",
            "include_goals",
            "include_constraints",
            "include_motivation",
            "include_biometrics",
            "include_labs",
            "include_protocols",
            "include_supplements",
            "include_medications",
            "include_insurance",
            "granted_at",
            "revoked_at",
            "expires_at",
        ]),
        EntityType::ConciergePreference => parts_for(&[
            "travel_profile",
            "gym_access_preferences",
            "recovery_preferences",
            "provider_preferences",
        ]),
        EntityType::ArcanaMembership => parts_for(&[
            "tier",
            "status",
            "started_at",
            "renewed_at",
            "ends_at",
        ]),
        _ => {
            // Fallback — include every short stringable field we
            // didn't explicitly drop. Cap the total length so we never
            // accidentally embed a whole document.
            attrs
                .iter()
                .filter_map(|(k, v)| flatten_value(v).map(|s| format!("{k}: {s}")))
                .collect()
        }
    };

    let combined = parts.join(" | ");
    if combined.len() > 1600 {
        format!("{} …", &combined[..1597])
    } else {
        combined
    }
}

/// Build the canonical Person → entity relationship for the entity. The
/// `user_id` is taken directly from the SyncQueueJob (NOT from the
/// payload attrs — the trigger payloads in 050/055/068/074 deliberately
/// don't include `user_id` because the queue row already has it as a
/// column).
fn relationships_for(et: &EntityType, user_id: &str) -> Vec<Relationship> {
    if user_id.is_empty() {
        return Vec::new();
    }
    let label: String = match et {
        EntityType::Goal => "HAS_GOAL",
        EntityType::Constraint => "HAS_CONSTRAINT",
        EntityType::Capability => "HAS_CAPABILITY",
        EntityType::Motivation => "HAS_MOTIVATION",
        EntityType::DecisionPreference => "HAS_DECISION_PREFERENCE",
        EntityType::DomainRiskTolerance => "HAS_RISK_TOLERANCE",
        EntityType::Decision => "MADE_DECISION",
        EntityType::Recommendation => "RECEIVED_RECOMMENDATION",
        EntityType::Action => "TOOK_ACTION",
        EntityType::Outcome => "OBSERVED_OUTCOME",
        EntityType::HealthMetric => "HAS_HEALTH_METRIC",
        EntityType::HealthInsurancePlan => "HAS_INSURANCE_PLAN",
        EntityType::CareerProfile => "HAS_CAREER_PROFILE",
        EntityType::EducationRecord => "HAS_EDUCATION_RECORD",
        EntityType::WearableMetric => "HAS_WEARABLE_METRIC",
        EntityType::ArcanaLeadPackage => "GENERATED_ARCANA_LEAD",
        // Added in 074
        EntityType::LifeVision => "HAS_LIFE_VISION",
        EntityType::CommitmentLevel => "HAS_COMMITMENT_LEVEL",
        EntityType::LifeEvent => "EXPERIENCED_LIFE_EVENT",
        EntityType::GoalDiscoveryTurn => "HAS_DISCOVERY_TURN",
        EntityType::GoalInterpretation => "HAS_GOAL_INTERPRETATION",
        EntityType::OptimizerRun => "HAS_OPTIMIZER_RUN",
        EntityType::OptimizerAllocation => "HAS_ALLOCATION",
        EntityType::OptimizerRecommendation => "RECEIVED_RECOMMENDATION",
        EntityType::LifeScenario => "HAS_SCENARIO",
        EntityType::LifeScenarioVersion => "HAS_SCENARIO_VERSION",
        EntityType::LifeScenarioDecision => "SCENARIO_DECISION",
        EntityType::LifeScenarioOutput => "HAS_SCENARIO_OUTPUT",
        EntityType::LifeTrajectorySnapshot => "HAS_TRAJECTORY_SNAPSHOT",
        EntityType::EstateProfile => "HAS_ESTATE_PROFILE",
        EntityType::EstateBeneficiary => "HAS_BENEFICIARY",
        EntityType::InsuranceDocument => "HAS_INSURANCE_DOCUMENT",
        EntityType::InsuranceDocumentFact => "HAS_INSURANCE_FACT",
        EntityType::BenefitProfile => "HAS_BENEFIT_PROFILE",
        EntityType::HealthAlertEvent => "OBSERVED_HEALTH_ALERT",
        EntityType::UserFinancialProfile => "HAS_FINANCIAL_PROFILE",
        EntityType::FinancingPreference => "HAS_FINANCING_PREFERENCE",
        EntityType::EducationIntake => "HAS_EDUCATION_INTAKE",
        EntityType::Injury => "HAS_INJURY",
        EntityType::CandidateMatch => "MATCHED_TO_JOB",
        // Decision-intelligence completion (migration 080).
        EntityType::GoalProgressSnapshot => "HAS_GOAL_PROGRESS_SNAPSHOT",
        EntityType::GoalProgressEvent => "GOAL_PROGRESS_EVENT",
        EntityType::GoalProgressScore => "HAS_GOAL_PROGRESS_SCORE",
        EntityType::GoalProgressPrediction => "PREDICTED_GOAL_PROGRESS",
        EntityType::CrossDomainImpact => "CROSS_DOMAIN_IMPACT",
        EntityType::OutcomeAttribution => "ATTRIBUTED_OUTCOME",
        EntityType::PredictionCalibration => "CALIBRATION_OBSERVATION",
        EntityType::RecommendationAccuracy => "RECOMMENDATION_ACCURACY",
        EntityType::AdvisorAccuracy => "ADVISOR_ACCURACY_SNAPSHOT",
        EntityType::RecommendationQualityMetric => "RECOMMENDATION_QUALITY_METRIC",
        EntityType::PathwayEffectiveness => "EFFECTIVE_PATHWAY",
        // Decision impact + probability (migration 081).
        EntityType::GoalProbabilityDistribution => "HAS_PROBABILITY_DISTRIBUTION",
        EntityType::GoalProbabilitySnapshot => "HAS_PROBABILITY_SNAPSHOT",
        EntityType::GoalDecisionImpact => "CHANGES_PROBABILITY_OF",
        EntityType::GoalPathwayProbability => "HAS_PATHWAY_PROBABILITY",
        EntityType::GoalFutureState => "PROJECTS_FUTURE_STATE",
        EntityType::DecisionMarginalImpact => "RANKED_MARGINAL_IMPACT",
        EntityType::TrajectoryVarianceFactor => "TRAJECTORY_VARIANCE_FACTOR",
        // XAI + Trust Layer (migration 082).
        EntityType::RecommendationAuditTrail => "AUDITED_BY",
        EntityType::WhyChain => "HAS_WHY_CHAIN",
        EntityType::EvidenceLink => "SUPPORTED_BY",
        EntityType::CounterfactualScenario => "COUNTERFACTUAL_OF",
        EntityType::RecommendationAssumption => "ASSUMED_BY",
        // Conversation Intelligence (migration 084).
        EntityType::DiscoverySession => "HAS_DISCOVERY_SESSION",
        EntityType::AssumptionChallenge => "CHALLENGED_BY",
        EntityType::ConversationTrace => "TRACED_BY",
        // Provider GraphRAG (migration 085).
        EntityType::ProviderProfile => "HAS_PROVIDER_PROFILE",
        EntityType::ProviderEngagement => "HAS_PROVIDER_ENGAGEMENT",
        EntityType::ProviderConsentScope => "HAS_CONSENT_SCOPE",
        EntityType::ProviderRecommendation => "RECOMMENDED_BY_PROVIDER",
        EntityType::ProviderOutcome => "PROVIDER_OUTCOME",
        EntityType::ProviderKnowledgeEntry => "AUTHORED_KNOWLEDGE",
        EntityType::ProviderAnalytics => "ANALYZED_BY_PROVIDER",
        // Sprint C — Arcana Health & Performance.
        EntityType::ArcanaProfile => "HAS_ARCANA_PROFILE",
        EntityType::ArcanaAssessment => "HAS_ARCANA_ASSESSMENT",
        EntityType::ArcanaGoal => "HAS_ARCANA_GOAL",
        EntityType::ArcanaConstraint => "HAS_ARCANA_CONSTRAINT",
        EntityType::ArcanaCapability => "HAS_ARCANA_CAPABILITY",
        EntityType::ArcanaMotivation => "HAS_ARCANA_MOTIVATION",
        EntityType::ArcanaReadiness => "HAS_ARCANA_READINESS",
        EntityType::SupplementProtocol => "HAS_SUPPLEMENT_PROTOCOL",
        EntityType::TrainingProtocol => "HAS_TRAINING_PROTOCOL",
        EntityType::HealthMilestone => "HAS_HEALTH_MILESTONE",
        EntityType::BiometricObservation => "HAS_BIOMETRIC_OBSERVATION",
        EntityType::LabResult => "HAS_LAB_RESULT",
        EntityType::WearableConnection => "HAS_WEARABLE_CONNECTION",
        EntityType::ArcanaInsuranceDocument => "HAS_ARCANA_INSURANCE_DOCUMENT",
        EntityType::LeadPackageConsent => "GRANTED_LEAD_CONSENT",
        EntityType::ConciergePreference => "HAS_CONCIERGE_PREFERENCE",
        EntityType::ArcanaMembership => "HAS_ARCANA_MEMBERSHIP",
        _ => "RELATED_TO",
    }
    .into();
    vec![Relationship {
        label,
        target_entity_type: "user_profile".into(),
        target_entity_id: user_id.to_string(),
    }]
}

fn parse_ts(map: &Map<String, Value>, key: &str) -> Option<DateTime<Utc>> {
    map.get(key)
        .and_then(Value::as_str)
        .and_then(|s| DateTime::parse_from_rfc3339(s).ok())
        .map(|d| d.with_timezone(&Utc))
}

#[allow(dead_code)]
fn _ensure_uuid(s: &str) -> Result<Uuid> {
    Uuid::parse_str(s).map_err(|e| WorkerError::Normalizer {
        entity_type: "?".into(),
        reason: format!("invalid uuid: {e}"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn job_with(et: &str, payload: Value) -> SyncQueueJob {
        SyncQueueJob {
            id: Uuid::new_v4(),
            user_id: Uuid::new_v4(),
            entity_type: et.into(),
            entity_id: Uuid::new_v4().to_string(),
            source_table: "public.t".into(),
            operation: crate::queue::SyncOperation::Upsert,
            payload,
            attempts: 0,
            max_attempts: 5,
            access_scope: crate::queue::AccessScope::Personal,
        }
    }

    #[test]
    fn sanitize_strips_encrypted_suffix_and_member_id() {
        let p = json!({
            "carrier": "BCBS",
            "plan_name": "PPO",
            "member_id_encrypted": "ZZZ",
            "group_number_encrypted": "GGG",
            "member_id": "M-123",
            "ssn": "000",
            "social_security": "111",
            "access_token": "tok",
            "refresh_token": "rt",
            "ok": "fine",
        });
        let sanitized = sanitize(p.as_object().unwrap());
        assert!(sanitized.get("member_id_encrypted").is_none());
        assert!(sanitized.get("group_number_encrypted").is_none());
        assert!(sanitized.get("member_id").is_none());
        assert!(sanitized.get("ssn").is_none());
        assert!(sanitized.get("social_security").is_none());
        assert!(sanitized.get("access_token").is_none());
        assert!(sanitized.get("refresh_token").is_none());
        assert_eq!(sanitized.get("ok").unwrap(), "fine");
    }

    #[test]
    fn normalize_sets_tenant_to_user_and_strips_sensitive() {
        let job = job_with(
            "health_insurance_plan",
            json!({
                "carrier": "BCBS",
                "plan_name": "PPO",
                "member_id_encrypted": "ZZZ",
                "group_number_encrypted": "GGG",
            }),
        );
        let canon = normalize(&job, Utc::now()).unwrap();
        assert_eq!(canon.tenant_id, job.user_id);
        assert_eq!(canon.user_id, job.user_id);
        assert!(!canon.summary.contains("ZZZ"));
        assert!(!canon.summary.contains("GGG"));
        assert!(canon.attributes.get("member_id_encrypted").is_none());
        assert!(canon.attributes.get("group_number_encrypted").is_none());
    }

    #[test]
    fn unknown_entity_type_falls_back_safely() {
        let job = job_with("nonexistent_type", json!({"title": "x"}));
        let canon = normalize(&job, Utc::now()).unwrap();
        assert_eq!(canon.entity_type, "unknown");
        assert_eq!(canon.domain, "general");
    }

    #[test]
    fn persona_profile_summary_is_populated() {
        let job = job_with(
            "persona_profile",
            json!({
                "display_name": "Young Professional",
                "profession": "Software Analyst",
                "life_stage": "early_career",
                "income_type": "W-2 salary",
                "spending_pattern": "rent + subscriptions",
                "risk_profile": "moderate",
                "asset_profile": "starter emergency fund",
            }),
        );
        let canon = normalize(&job, Utc::now()).unwrap();
        assert_eq!(canon.entity_type, "persona_profile");
        // build_summary must produce embeddable text (not the empty-summary path)
        assert!(!canon.summary.trim().is_empty());
        assert!(canon.summary.contains("Software Analyst"));
        assert!(canon.summary.contains("moderate"));
    }
}
