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
    let relationships = relationships_for(&entity_type, &job.user_id.to_string(), &sanitized);

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

/// Fan-out for the recommendation evidence graph. A `financial_recommendation`
/// row carries its evidence/assumptions/tradeoffs as JSON arrays and its advice
/// boundary inside `governance_verdict`. Expand those into child graph objects so
/// the recommendation becomes a traceable subgraph:
///   (:FinancialRecommendation)-[:HAS_EVIDENCE]->(:Evidence)
///   (:FinancialRecommendation)-[:HAS_ASSUMPTION]->(:Assumption)
///   (:FinancialRecommendation)-[:HAS_TRADEOFF]->(:Tradeoff)
///   (:FinancialRecommendation)-[:REQUIRES_REVIEW]->(:AdviceBoundary)
///
/// Child `entity_id`s are deterministic (`{rec_id}::{type}::{idx}`) so reprocessing
/// MERGEs in place (idempotent). Each child carries the parent's tenant/user and a
/// `recommendation_id` FK that the ontology registry turns into the typed edge — no
/// RELATED_TO fallback, no cross-tenant edge (the FK is the same owner's row).
/// Returns empty for any non-recommendation entity.
pub fn expand_children(job: &SyncQueueJob, now: DateTime<Utc>) -> Vec<CanonicalGraphObject> {
    let parent = EntityType::from_queue_str(&job.entity_type);
    if !matches!(
        parent,
        EntityType::FinancialRecommendation
            | EntityType::HealthRecommendation
            | EntityType::CareerRecommendation
            | EntityType::EducationRecommendation
            | EntityType::FamilyRecommendation
    ) {
        return Vec::new();
    }
    // Children link to THIS recommendation's type (financial_/health_/career_/
    // education_/family_recommendation), so the fan-out is domain-generic.
    let parent_label = parent.as_str();
    let payload = job.payload.as_object().cloned().unwrap_or_default();
    let rec_id = job.entity_id.clone();
    let user_id = job.user_id;
    let src = job.source_table.clone();
    let arr = |key: &str| -> Vec<Value> {
        payload
            .get(key)
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default()
    };

    let mut out = Vec::new();
    for (child_et, key) in [
        (EntityType::Evidence, "evidence_json"),
        (EntityType::Assumption, "assumptions_json"),
        (EntityType::Tradeoff, "tradeoffs_json"),
    ] {
        for (i, v) in arr(key).iter().enumerate() {
            if let Value::Object(m) = v {
                out.push(build_child(
                    child_et,
                    parent_label,
                    &rec_id,
                    i,
                    m.clone(),
                    user_id,
                    &src,
                    now,
                ));
            }
        }
    }
    // Advice boundary: derived from governance_verdict when it carries boundary data.
    if let Some(Value::Object(gov)) = payload.get("governance_verdict") {
        if gov.contains_key("boundary_type")
            || gov.contains_key("disclaimer_text")
            || gov.contains_key("disclaimer")
        {
            out.push(build_child(
                EntityType::AdviceBoundary,
                parent_label,
                &rec_id,
                0,
                gov.clone(),
                user_id,
                &src,
                now,
            ));
        }
    }
    out
}

#[allow(clippy::too_many_arguments)]
fn build_child(
    child_et: EntityType,
    parent_label: &str,
    rec_id: &str,
    idx: usize,
    mut item: Map<String, Value>,
    user_id: Uuid,
    source_table: &str,
    now: DateTime<Utc>,
) -> CanonicalGraphObject {
    // Keep the FK on the node for provenance/queryability.
    item.insert(
        "recommendation_id".into(),
        Value::String(rec_id.to_string()),
    );
    // Preserve the fact's own provenance: an Evidence item carries the underlying
    // source_table (e.g. finance.financial_accounts). Use it for the node's
    // source_table so provenance points at the fact, not the recommendation row.
    let node_source = item
        .get("source_table")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| source_table.to_string());
    let sanitized = sanitize(&item);
    let entity_id = format!("{rec_id}::{}::{idx}", child_et.as_str());
    // Typed edge into the child, anchored to THIS recommendation's type
    // (financial_recommendation OR health_recommendation) — domain-generic, no fallback.
    let rel_label = match child_et {
        EntityType::Evidence => "HAS_EVIDENCE",
        EntityType::Assumption => "HAS_ASSUMPTION",
        EntityType::Tradeoff => "HAS_TRADEOFF",
        EntityType::AdviceBoundary => "REQUIRES_REVIEW",
        _ => "RELATED_TO",
    };
    let relationships = vec![Relationship {
        label: rel_label.into(),
        target_entity_type: parent_label.to_string(),
        target_entity_id: rec_id.to_string(),
    }];
    CanonicalGraphObject {
        tenant_id: user_id,
        user_id,
        entity_id,
        entity_type: child_et.as_str().to_string(),
        domain: child_et.domain().to_string(),
        source_table: node_source,
        title: build_title(&child_et, &sanitized),
        summary: build_summary(&child_et, &sanitized),
        relationships,
        sensitivity_level: child_et.sensitivity(),
        attributes: sanitized,
        created_at: now,
        updated_at: now,
    }
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
        EntityType::RiskAssessment => by_key(&["assessment_type", "risk_tolerance"])
            .map(|t| format!("{t} risk assessment"))
            .unwrap_or_else(|| "Risk assessment".into()),
        // Finance elite + evidence graph (migration 117).
        EntityType::FinancialRecommendation => {
            by_key(&["title"]).unwrap_or_else(|| "Recommendation".into())
        }
        EntityType::Liability => by_key(&["name"]).unwrap_or_else(|| "Liability".into()),
        EntityType::CashFlowSnapshot => by_key(&["period_end", "period_start"])
            .map(|d| format!("Cash flow {d}"))
            .unwrap_or_else(|| "Cash flow snapshot".into()),
        EntityType::NetWorthSnapshot => by_key(&["as_of_date"])
            .map(|d| format!("Net worth {d}"))
            .unwrap_or_else(|| "Net worth snapshot".into()),
        EntityType::BudgetCategory => by_key(&["name"]).unwrap_or_else(|| "Budget category".into()),
        EntityType::IncomeSource => by_key(&["name"]).unwrap_or_else(|| "Income source".into()),
        EntityType::ExpenseCategory => {
            by_key(&["name"]).unwrap_or_else(|| "Expense category".into())
        }
        EntityType::FinancialEvent => {
            by_key(&["event_type"]).unwrap_or_else(|| "Financial event".into())
        }
        EntityType::Evidence => {
            by_key(&["metric_name", "explanation"]).unwrap_or_else(|| "Evidence".into())
        }
        EntityType::Assumption => {
            by_key(&["assumption_text"]).unwrap_or_else(|| "Assumption".into())
        }
        EntityType::Tradeoff => by_key(&["option_a"])
            .map(|a| format!("Tradeoff: {a}"))
            .unwrap_or_else(|| "Tradeoff".into()),
        EntityType::AdviceBoundary => by_key(&["boundary_type"])
            .map(|b| format!("{b} review boundary"))
            .unwrap_or_else(|| "Advice boundary".into()),
        // Health & Wellness (migration 119).
        EntityType::HealthGoal => {
            by_key(&["title", "target_metric"]).unwrap_or_else(|| "Health goal".into())
        }
        EntityType::WellnessHabit => by_key(&["name"]).unwrap_or_else(|| "Wellness habit".into()),
        EntityType::ActivityLog => by_key(&["activity_type"])
            .map(|a| format!("{a} activity"))
            .unwrap_or_else(|| "Activity".into()),
        EntityType::SleepLog => by_key(&["night_of"])
            .map(|d| format!("Sleep {d}"))
            .unwrap_or_else(|| "Sleep log".into()),
        EntityType::Vital => by_key(&["kind"])
            .map(|k| format!("{k} reading"))
            .unwrap_or_else(|| "Vital".into()),
        EntityType::LabMarker => by_key(&["marker"]).unwrap_or_else(|| "Lab marker".into()),
        EntityType::BodyMetric => by_key(&["observed_at"])
            .map(|d| format!("Body metrics {d}"))
            .unwrap_or_else(|| "Body metrics".into()),
        EntityType::HealthSpendingAccount => by_key(&["account_type"])
            .map(|t| format!("{} account", t.to_uppercase()))
            .unwrap_or_else(|| "Spending account".into()),
        EntityType::MedicalExpense => {
            by_key(&["description", "category"]).unwrap_or_else(|| "Medical expense".into())
        }
        EntityType::BenefitDeadline => {
            by_key(&["benefit_type", "description"]).unwrap_or_else(|| "Benefit deadline".into())
        }
        EntityType::HealthRecommendation => {
            by_key(&["title"]).unwrap_or_else(|| "Health recommendation".into())
        }
        // Career X2
        EntityType::CareerGoal => {
            by_key(&["title", "target_role"]).unwrap_or_else(|| "Career goal".into())
        }
        EntityType::ExperienceRecord => format!(
            "{} @ {}",
            by_key(&["title"]).unwrap_or_else(|| "Role".into()),
            by_key(&["employer"]).unwrap_or_else(|| "Employer".into())
        ),
        EntityType::Skill | EntityType::UserSkill => {
            by_key(&["name"]).unwrap_or_else(|| "Skill".into())
        }
        EntityType::SkillGap => format!(
            "Gap: {}",
            by_key(&["skill_name"]).unwrap_or_else(|| "skill".into())
        ),
        EntityType::Degree => format!(
            "{} {}",
            by_key(&["level"]).unwrap_or_default(),
            by_key(&["field"]).unwrap_or_else(|| "Degree".into())
        )
        .trim()
        .to_string(),
        EntityType::JobTarget => by_key(&["role_title"]).unwrap_or_else(|| "Job target".into()),
        EntityType::CompensationRecord => by_key(&["role"])
            .map(|r| format!("Compensation — {r}"))
            .unwrap_or_else(|| "Compensation record".into()),
        EntityType::CompensationProjection => by_key(&["scenario"])
            .map(|s| format!("Projected compensation ({s})"))
            .unwrap_or_else(|| "Compensation projection".into()),
        // Education E1
        EntityType::EducationProfile => by_key(&["highest_level"])
            .map(|l| format!("Education profile ({l})"))
            .unwrap_or_else(|| "Education profile".into()),
        EntityType::School => by_key(&["name"]).unwrap_or_else(|| "School".into()),
        EntityType::Program => format!(
            "{}{}",
            by_key(&["name"]).unwrap_or_else(|| "Program".into()),
            by_key(&["level"])
                .map(|l| format!(" ({l})"))
                .unwrap_or_default()
        ),
        EntityType::ProgramComparison => {
            by_key(&["title"]).unwrap_or_else(|| "Program comparison".into())
        }
        // Family F1
        EntityType::Dependent => by_key(&["relationship"])
            .map(|r| format!("Dependent ({r})"))
            .unwrap_or_else(|| "Dependent".into()),
        EntityType::SpouseProfile => "Spouse/partner profile".into(),
        EntityType::GuardianshipPlan => by_key(&["status"])
            .map(|s| format!("Guardianship plan ({s})"))
            .unwrap_or_else(|| "Guardianship plan".into()),
        EntityType::EstatePlan => by_key(&["status"])
            .map(|s| format!("Estate plan ({s})"))
            .unwrap_or_else(|| "Estate plan".into()),
        EntityType::InsuranceProfile => "Insurance profile".into(),
        EntityType::CollegePlanning => by_key(&["vehicle"])
            .map(|v| format!("College plan ({v})"))
            .unwrap_or_else(|| "College planning".into()),
        EntityType::FamilyProfile => "Family profile".into(),
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
        EntityType::RiskAssessment => parts_for(&[
            "assessment_type",
            "status",
            "overall_risk_score",
            "risk_tolerance",
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
            // X1 career.career_profiles + legacy public.career_profiles field names
            // (parts_for skips absent keys). No clearance/military in the embedding.
            "current_title",
            "current_employer",
            "current_company",
            "industry",
            "seniority_level",
            "years_experience",
            "years_of_experience",
            "remote_preference",
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
        EntityType::ArcanaAssessment => parts_for(&["assessment_kind", "summary", "confidence"]),
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
        EntityType::ArcanaCapability => {
            parts_for(&["capability_kind", "proficiency", "description"])
        }
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
        EntityType::HealthMilestone => {
            parts_for(&["title", "description", "target_date", "achieved_at"])
        }
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
        EntityType::ArcanaInsuranceDocument => {
            parts_for(&["document_kind", "ocr_status", "uploaded_at"])
        }
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
        EntityType::ArcanaMembership => {
            parts_for(&["tier", "status", "started_at", "renewed_at", "ends_at"])
        }
        // Finance elite schema (migration 117).
        EntityType::FinancialRecommendation => parts_for(&[
            "title",
            "description",
            "recommendation_type",
            "priority",
            "confidence",
            "status",
        ]),
        EntityType::Liability => parts_for(&[
            "name",
            "liability_type",
            "balance",
            "interest_rate",
            "minimum_payment",
            "currency",
        ]),
        EntityType::CashFlowSnapshot => parts_for(&[
            "period_start",
            "period_end",
            "total_income",
            "total_expenses",
            "net_cash_flow",
            "currency",
        ]),
        EntityType::NetWorthSnapshot => parts_for(&[
            "as_of_date",
            "total_assets",
            "total_liabilities",
            "net_worth",
            "currency",
        ]),
        EntityType::BudgetCategory => {
            parts_for(&["name", "category_type", "monthly_limit", "currency"])
        }
        EntityType::IncomeSource => parts_for(&[
            "name",
            "source_type",
            "monthly_amount",
            "currency",
            "is_active",
        ]),
        EntityType::ExpenseCategory => parts_for(&["name", "parent_category", "is_essential"]),
        EntityType::FinancialEvent => parts_for(&[
            "event_type",
            "event_date",
            "amount",
            "description",
            "related_entity_type",
        ]),
        // Recommendation evidence graph.
        EntityType::Evidence => parts_for(&[
            "metric_name",
            "metric_value",
            "source_table",
            "observed_at",
            "confidence",
            "explanation",
        ]),
        EntityType::Assumption => parts_for(&[
            "assumption_text",
            "confidence",
            "expires_at",
            "user_confirmed",
            "source",
        ]),
        EntityType::Tradeoff => parts_for(&[
            "option_a",
            "option_b",
            "benefit",
            "cost",
            "affected_domains",
        ]),
        EntityType::AdviceBoundary => parts_for(&[
            "boundary_type",
            "disclaimer_text",
            "requires_human_review",
            "escalation_path",
        ]),
        // Health & Wellness (migration 119).
        EntityType::HealthGoal => parts_for(&[
            "title",
            "goal_type",
            "target_metric",
            "target_value",
            "target_unit",
            "target_date",
            "status",
        ]),
        EntityType::WellnessHabit => parts_for(&["name", "cadence", "streak"]),
        EntityType::ActivityLog => parts_for(&[
            "activity_type",
            "logged_at",
            "duration_min",
            "steps",
            "calories",
        ]),
        EntityType::SleepLog => parts_for(&["night_of", "total_hours", "efficiency", "awakenings"]),
        EntityType::Vital => {
            parts_for(&["kind", "value", "value_secondary", "unit", "observed_at"])
        }
        EntityType::LabMarker => parts_for(&[
            "marker",
            "value",
            "unit",
            "reference_low",
            "reference_high",
            "observed_at",
        ]),
        EntityType::BodyMetric => {
            parts_for(&["weight_kg", "body_fat_pct", "waist_cm", "observed_at"])
        }
        EntityType::HealthSpendingAccount => {
            parts_for(&["account_type", "balance", "contribution_ytd", "currency"])
        }
        EntityType::MedicalExpense => {
            parts_for(&["expense_date", "amount", "category", "description"])
        }
        EntityType::BenefitDeadline => parts_for(&["benefit_type", "deadline_date", "description"]),
        EntityType::HealthRecommendation => parts_for(&[
            "title",
            "description",
            "recommendation_type",
            "priority",
            "confidence",
            "status",
        ]),
        // Career X2 — curated field lists (never dump raw sensitive payloads:
        // no resume content_ref, no clearance, no free-text notes).
        // (CareerProfile arm is defined above, X1-aware.)
        EntityType::CareerGoal => {
            parts_for(&["title", "goal_type", "target_role", "target_date", "status"])
        }
        EntityType::ExperienceRecord => parts_for(&[
            "title",
            "employer",
            "industry",
            "start_date",
            "end_date",
            "is_current",
        ]),
        EntityType::Skill => parts_for(&["name", "category"]),
        EntityType::UserSkill => parts_for(&["proficiency", "years_experience", "last_used"]),
        EntityType::SkillGap => parts_for(&["skill_name", "target_role", "severity"]),
        EntityType::Credential => parts_for(&["name", "credential_type", "issuer", "issued_date"]),
        EntityType::Certification => parts_for(&["name", "issuer", "earned_date", "status"]),
        EntityType::Degree => parts_for(&["level", "field", "institution", "conferred_date"]),
        EntityType::Resume => parts_for(&["title", "version"]),
        EntityType::PortfolioItem => parts_for(&["title", "kind", "description"]),
        EntityType::JobTarget => parts_for(&[
            "role_title",
            "industry",
            "location",
            "target_comp_median",
            "status",
        ]),
        EntityType::JobApplication => parts_for(&["employer", "role", "status", "applied_date"]),
        EntityType::Interview => parts_for(&["stage", "outcome", "scheduled_at"]),
        EntityType::CompensationRecord => parts_for(&[
            "role",
            "employer",
            "comp_median",
            "currency",
            "effective_date",
        ]),
        EntityType::CompensationProjection => parts_for(&[
            "scenario",
            "value_low",
            "value_median",
            "value_high",
            "confidence",
        ]),
        EntityType::CareerRecommendation => parts_for(&[
            "title",
            "description",
            "recommendation_type",
            "priority",
            "confidence",
            "status",
        ]),
        // Education E1 — curated field lists.
        EntityType::EducationProfile => parts_for(&["highest_level", "learning_preferences"]),
        EntityType::EducationGoal => {
            parts_for(&["title", "goal_type", "target_role", "target_date", "status"])
        }
        EntityType::LearningPath => parts_for(&["title", "description", "status"]),
        EntityType::School => {
            parts_for(&["name", "school_type", "location", "accreditation_status"])
        }
        EntityType::Program => parts_for(&[
            "name",
            "level",
            "major",
            "modality",
            "duration_months",
            "tuition",
            "graduation_rate",
            "median_salary",
        ]),
        EntityType::ProgramComparison => parts_for(&["title", "status"]),
        EntityType::EducationRecommendation => parts_for(&[
            "title",
            "description",
            "recommendation_type",
            "priority",
            "confidence",
            "status",
        ]),
        // Family F1 — curated; minimal PII (relationships/bands/flags, never names).
        EntityType::FamilyProfile => {
            parts_for(&["household_size", "marital_status", "num_dependents"])
        }
        EntityType::Dependent => parts_for(&["relationship", "birth_year"]),
        EntityType::SpouseProfile => parts_for(&["employment_status", "income_band"]),
        EntityType::GuardianshipPlan => parts_for(&["status", "designated_guardian"]),
        EntityType::EstatePlan => {
            parts_for(&["status", "has_will", "has_poa", "has_beneficiaries"])
        }
        EntityType::InsuranceProfile => {
            parts_for(&["life_coverage", "disability_coverage", "currency"])
        }
        EntityType::CollegePlanning => {
            parts_for(&["target_year", "projected_cost", "saved_amount", "vehicle"])
        }
        EntityType::FamilyRecommendation => parts_for(&[
            "title",
            "description",
            "recommendation_type",
            "priority",
            "confidence",
            "status",
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
fn relationships_for(
    et: &EntityType,
    user_id: &str,
    attrs: &Map<String, Value>,
) -> Vec<Relationship> {
    if user_id.is_empty() {
        return Vec::new();
    }
    // Registry-driven domains (finance today) own their typed edges via the
    // ontology registry — typed user edge + inter-entity FK edges. Mapped
    // entities NEVER fall back to RELATED_TO. See ontology.rs / relationships.rs.
    if let Some(rels) = crate::relationships::registry_relationships(et, user_id, attrs) {
        return rels;
    }
    // Legacy typed-label match for not-yet-migrated domains; unmapped types fall
    // back to RELATED_TO. Migrate these into the ontology registry over time.
    let user_label: &str = match et {
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
        // Finance is handled by the ontology registry above (early return).
        _ => "RELATED_TO",
    };

    // Non-registry domains: the single user -> entity edge.
    // (:UserProfile)-[:LABEL]->(:Entity).
    vec![Relationship {
        label: user_label.into(),
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

    // ---- Typed finance relationships (replaces the RELATED_TO star) ----

    fn rels(et: &str, payload: Value) -> Vec<Relationship> {
        normalize(&job_with(et, payload), Utc::now())
            .unwrap()
            .relationships
    }
    fn has_edge(rels: &[Relationship], label: &str, target_type: &str) -> bool {
        rels.iter()
            .any(|r| r.label == label && r.target_entity_type == target_type)
    }

    #[test]
    fn financial_account_emits_owns_account() {
        let r = rels(
            "financial_account",
            json!({"name": "Checking", "account_type": "depository"}),
        );
        assert!(has_edge(&r, "OWNS_ACCOUNT", "user_profile"));
        assert!(!has_edge(&r, "RELATED_TO", "user_profile"));
    }

    #[test]
    fn transaction_emits_has_transaction_to_user_and_account() {
        let acct = Uuid::new_v4().to_string();
        let r = rels(
            "transaction",
            json!({"amount": 19.57, "merchant": "Netflix", "account_id": acct}),
        );
        // user -> transaction
        assert!(has_edge(&r, "HAS_TRANSACTION", "user_profile"));
        // account -> transaction (inter-entity, from the account_id FK)
        assert!(r.iter().any(|x| x.label == "HAS_TRANSACTION"
            && x.target_entity_type == "financial_account"
            && x.target_entity_id == acct));
        assert!(!has_edge(&r, "RELATED_TO", "user_profile"));
    }

    #[test]
    fn transaction_without_account_id_keeps_only_user_edge_not_fallback() {
        let r = rels("transaction", json!({"amount": 5.0, "merchant": "X"}));
        assert!(has_edge(&r, "HAS_TRANSACTION", "user_profile"));
        assert!(!has_edge(&r, "HAS_TRANSACTION", "financial_account")); // no FK -> no inter-entity edge
        assert!(!has_edge(&r, "RELATED_TO", "user_profile")); // still typed, never fallback
    }

    #[test]
    fn asset_emits_has_asset() {
        assert!(has_edge(
            &rels("asset", json!({"name": "Car"})),
            "HAS_ASSET",
            "user_profile"
        ));
    }

    #[test]
    fn investment_holding_emits_has_holding_and_account_link() {
        let acct = Uuid::new_v4().to_string();
        let r = rels(
            "investment_holding",
            json!({"name": "VTI", "account_id": acct}),
        );
        assert!(has_edge(&r, "HAS_HOLDING", "user_profile"));
        assert!(r.iter().any(|x| x.label == "HAS_HOLDING"
            && x.target_entity_type == "financial_account"
            && x.target_entity_id == acct));
    }

    #[test]
    fn retirement_plan_emits_contributes_to() {
        assert!(has_edge(
            &rels("retirement_plan", json!({"name": "401k"})),
            "CONTRIBUTES_TO",
            "user_profile"
        ));
    }

    #[test]
    fn financial_goal_emits_has_goal() {
        assert!(has_edge(
            &rels("financial_goal", json!({"title": "Save"})),
            "HAS_GOAL",
            "user_profile"
        ));
    }

    #[test]
    fn no_finance_entity_falls_back_to_related_to() {
        for et in [
            "financial_account",
            "transaction",
            "asset",
            "debt",
            "investment_holding",
            "retirement_plan",
            "financial_goal",
        ] {
            let r = rels(
                et,
                json!({"account_id": Uuid::new_v4().to_string(), "name": "x"}),
            );
            assert!(
                !r.iter().any(|x| x.label == "RELATED_TO"),
                "{et} fell back to RELATED_TO"
            );
        }
    }

    #[test]
    fn relationship_creation_is_idempotent_via_merge() {
        // Reprocessing the same job must not duplicate edges: every node + edge is
        // a MERGE, never a CREATE.
        let acct = Uuid::new_v4().to_string();
        let canon = normalize(
            &job_with("transaction", json!({"amount": 1.0, "account_id": acct})),
            Utc::now(),
        )
        .unwrap();
        let cypher = crate::neo4j_client::Neo4jClient::merge_cypher_for(&canon);
        assert!(cypher.contains("MERGE (t:FinancialAccount"));
        assert!(cypher.contains("MERGE (t)-[:HAS_TRANSACTION]->(n)"));
        assert!(!cypher.contains("CREATE "));
    }

    #[test]
    fn unknown_relationship_still_uses_related_to_fallback() {
        let r = rels("nonexistent_type", json!({"title": "x"}));
        assert_eq!(r.len(), 1);
        assert!(has_edge(&r, "RELATED_TO", "user_profile"));
    }

    // ---- Finance elite schema + evidence graph (migration 117) ----
    // enum-before-trigger: every new entity_type round-trips (NOT unknown), gets a
    // title + a non-empty summary (so it is embedded, not skipped), and is financial.
    #[test]
    fn finance_elite_and_evidence_normalize_with_title_and_summary() {
        let cases = [
            (
                "financial_recommendation",
                json!({"title": "Pay highest-APR debt first", "recommendation_type": "debt_optimization", "priority": "high", "confidence": 0.8}),
            ),
            (
                "liability",
                json!({"name": "Auto loan", "liability_type": "loan", "balance": 12000}),
            ),
            (
                "cash_flow_snapshot",
                json!({"period_start": "2026-06-01", "period_end": "2026-06-30", "net_cash_flow": 540}),
            ),
            (
                "net_worth_snapshot",
                json!({"as_of_date": "2026-06-30", "net_worth": 17000}),
            ),
            (
                "budget_category",
                json!({"name": "Dining", "monthly_limit": 300}),
            ),
            (
                "income_source",
                json!({"name": "Salary", "monthly_amount": 6000}),
            ),
            (
                "expense_category",
                json!({"name": "Rent", "is_essential": true}),
            ),
            (
                "financial_event",
                json!({"event_type": "large_purchase", "amount": 2500}),
            ),
            (
                "evidence",
                json!({"metric_name": "apr", "metric_value": "24.99", "explanation": "costly balance"}),
            ),
            (
                "assumption",
                json!({"assumption_text": "income stays flat", "confidence": 0.7}),
            ),
            (
                "tradeoff",
                json!({"option_a": "pay debt", "option_b": "invest"}),
            ),
            (
                "advice_boundary",
                json!({"boundary_type": "investment", "disclaimer_text": "not financial advice"}),
            ),
        ];
        for (et, payload) in cases {
            let canon = normalize(&job_with(et, payload), Utc::now()).unwrap();
            assert_eq!(canon.entity_type, et, "{et}: entity_type mismatch");
            assert_ne!(
                canon.entity_type, "unknown",
                "{et}: deserialized to unknown"
            );
            assert!(!canon.title.trim().is_empty(), "{et}: empty title");
            assert!(
                !canon.summary.trim().is_empty(),
                "{et}: empty summary (would be skipped)"
            );
            assert_eq!(canon.domain, "financial", "{et}: wrong domain");
        }
    }

    // ---- Recommendation fan-out into the evidence graph (Phase 2) ----
    #[test]
    fn recommendation_fans_out_into_evidence_graph() {
        let mut job = job_with(
            "financial_recommendation",
            json!({
                "title": "Build your emergency fund",
                "recommendation_type": "emergency_fund",
                "evidence_json": [
                    {"metric_name": "cash", "metric_value": "500", "source_table": "finance.financial_accounts", "confidence": 1.0, "explanation": "current cash"},
                    {"metric_name": "monthly_expenses", "metric_value": "2000", "source_table": "finance.transactions", "confidence": 0.7, "explanation": "3mo avg"}
                ],
                "assumptions_json": [
                    {"assumption_text": "expenses stay flat", "confidence": 0.7, "user_confirmed": false, "source": "model"}
                ],
                "tradeoffs_json": [
                    {"option_a": "save more", "option_b": "invest", "benefit": "liquidity", "cost": "lower returns", "affected_domains": ["finance"]}
                ],
                "governance_verdict": {"passed": true, "boundary_type": "financial_planning", "disclaimer_text": "Not individualized investment advice", "requires_human_review": false}
            }),
        );
        job.entity_id = "REC1".into();
        let children = expand_children(&job, Utc::now());
        assert_eq!(children.len(), 5); // 2 evidence + 1 assumption + 1 tradeoff + 1 boundary
        let count = |t: &str| children.iter().filter(|c| c.entity_type == t).count();
        assert_eq!(count("evidence"), 2);
        assert_eq!(count("assumption"), 1);
        assert_eq!(count("tradeoff"), 1);
        assert_eq!(count("advice_boundary"), 1);
        for c in &children {
            assert_eq!(c.tenant_id, job.user_id); // tenant-safe
            assert!(c.entity_id.starts_with("REC1::")); // deterministic -> idempotent
            assert!(!c.summary.trim().is_empty()); // embeddable
            assert!(c.relationships.iter().all(|r| r.label != "RELATED_TO")); // no fallback
            assert!(c
                .relationships
                .iter()
                .any(|r| r.target_entity_type == "financial_recommendation"
                    && r.target_entity_id == "REC1"));
        }
        let ev = children
            .iter()
            .find(|c| c.entity_type == "evidence")
            .unwrap();
        assert!(ev.relationships.iter().any(|r| r.label == "HAS_EVIDENCE"));
        // provenance: an Evidence node keeps the FACT's source_table, not the rec table
        assert!(
            children
                .iter()
                .any(|c| c.entity_type == "evidence"
                    && c.source_table == "finance.financial_accounts")
        );
        let asm = children
            .iter()
            .find(|c| c.entity_type == "assumption")
            .unwrap();
        assert!(asm
            .relationships
            .iter()
            .any(|r| r.label == "HAS_ASSUMPTION"));
        let bnd = children
            .iter()
            .find(|c| c.entity_type == "advice_boundary")
            .unwrap();
        assert!(bnd
            .relationships
            .iter()
            .any(|r| r.label == "REQUIRES_REVIEW"));
    }

    #[test]
    fn expand_children_empty_for_non_recommendation_and_deterministic() {
        assert!(expand_children(
            &job_with("financial_account", json!({"name": "x"})),
            Utc::now()
        )
        .is_empty());
        let mut rec = job_with(
            "financial_recommendation",
            json!({"title": "t", "evidence_json": [{"metric_name": "m", "metric_value": "1"}]}),
        );
        rec.entity_id = "REC1".into();
        let a = expand_children(&rec, Utc::now());
        let b = expand_children(&rec, Utc::now());
        assert_eq!(a[0].entity_id, b[0].entity_id); // reprocessing -> same id -> MERGE
        assert_eq!(a[0].entity_id, "REC1::evidence::0");
    }

    // ---- Health & Wellness (H1; migration 119) ----
    #[test]
    fn health_entities_normalize_with_title_summary_domain() {
        let cases = [
            (
                "health_goal",
                json!({"title": "Sleep 7.5h nightly", "goal_type": "sleep", "target_value": 7.5}),
            ),
            (
                "wellness_habit",
                json!({"name": "Evening wind-down", "cadence": "daily"}),
            ),
            (
                "activity_log",
                json!({"activity_type": "walk", "duration_min": 30, "steps": 4000}),
            ),
            (
                "sleep_log",
                json!({"night_of": "2026-06-07", "total_hours": 5.7, "efficiency": 0.82}),
            ),
            (
                "vital",
                json!({"kind": "heart_rate", "value": 62, "unit": "bpm"}),
            ),
            (
                "lab_marker",
                json!({"marker": "vitamin_d", "value": 28, "unit": "ng/mL"}),
            ),
            ("body_metric", json!({"weight_kg": 80, "body_fat_pct": 18})),
            (
                "health_spending_account",
                json!({"account_type": "hsa", "balance": 1200}),
            ),
            (
                "medical_expense",
                json!({"amount": 150, "category": "dental"}),
            ),
            (
                "benefit_deadline",
                json!({"benefit_type": "fsa", "deadline_date": "2026-12-31"}),
            ),
            (
                "health_recommendation",
                json!({"title": "Improve your sleep consistency", "recommendation_type": "improve_sleep", "priority": "medium"}),
            ),
        ];
        for (et, payload) in cases {
            let c = normalize(&job_with(et, payload), Utc::now()).unwrap();
            assert_eq!(c.entity_type, et, "{et}: entity_type mismatch");
            assert_ne!(c.entity_type, "unknown", "{et}: deserialized to unknown");
            assert!(!c.title.trim().is_empty(), "{et}: empty title");
            assert!(!c.summary.trim().is_empty(), "{et}: empty summary");
            assert_eq!(c.domain, "health", "{et}: wrong domain");
        }
    }

    #[test]
    fn health_recommendation_fans_out_to_health_recommendation() {
        let mut job = job_with(
            "health_recommendation",
            json!({
                "title": "Improve your sleep consistency",
                "recommendation_type": "improve_sleep",
                "evidence_json": [{"metric_name": "avg_sleep_hours", "metric_value": "5.7", "source_table": "health.sleep_logs", "confidence": 0.8, "explanation": "14-night average"}],
                "assumptions_json": [{"assumption_text": "wearable sleep data is accurate", "confidence": 0.7}],
                "governance_verdict": {"passed": true, "boundary_type": "medical", "disclaimer_text": "Wellness guidance, not medical advice"}
            }),
        );
        job.entity_id = "HREC1".into();
        let children = expand_children(&job, Utc::now());
        assert_eq!(children.len(), 3); // 1 evidence + 1 assumption + 1 boundary
        for c in &children {
            // children link to the HEALTH recommendation (domain-generic fan-out)
            assert!(
                c.relationships
                    .iter()
                    .any(|r| r.target_entity_type == "health_recommendation"
                        && r.target_entity_id == "HREC1"),
                "{} not linked to health_recommendation",
                c.entity_type
            );
            assert!(c.relationships.iter().all(|r| r.label != "RELATED_TO"));
        }
        let ev = children
            .iter()
            .find(|c| c.entity_type == "evidence")
            .unwrap();
        assert!(ev.relationships.iter().any(|r| r.label == "HAS_EVIDENCE"));
        // medical boundary node present
        assert!(children.iter().any(|c| c.entity_type == "advice_boundary"));
    }

    // ---- Career X2 ----
    #[test]
    fn career_entities_normalize_with_title_summary_domain() {
        let cases = [
            (
                "career_profile",
                json!({"current_title": "Analyst", "industry": "tech", "years_experience": 5}),
            ),
            (
                "career_goal",
                json!({"title": "Become a senior engineer", "goal_type": "advancement", "target_role": "Senior SWE"}),
            ),
            (
                "experience_record",
                json!({"title": "Analyst", "employer": "Acme", "start_date": "2021-01-01"}),
            ),
            (
                "skill",
                json!({"name": "Python", "category": "programming"}),
            ),
            (
                "user_skill",
                json!({"proficiency": "advanced", "years_experience": 4}),
            ),
            (
                "skill_gap",
                json!({"skill_name": "Kubernetes", "target_role": "Platform Eng", "severity": "medium"}),
            ),
            (
                "credential",
                json!({"name": "AWS SAA", "credential_type": "certification", "issuer": "AWS"}),
            ),
            (
                "degree",
                json!({"level": "BS", "field": "Computer Science", "institution": "State U"}),
            ),
            (
                "resume",
                json!({"title": "Engineering resume", "version": 2}),
            ),
            (
                "portfolio_item",
                json!({"title": "Side project", "kind": "repo"}),
            ),
            (
                "job_target",
                json!({"role_title": "Staff Engineer", "industry": "tech", "location": "Remote"}),
            ),
            (
                "job_application",
                json!({"position": "Staff Engineer", "company": "BigCo", "status": "applied"}),
            ),
            (
                "interview",
                json!({"stage": "onsite", "outcome": "pending"}),
            ),
            (
                "compensation_record",
                json!({"role": "Analyst", "employer": "Acme", "comp_median": 120000}),
            ),
            (
                "compensation_projection",
                json!({"scenario": "after_degree", "value_median": 150000, "confidence": 0.6}),
            ),
            (
                "career_recommendation",
                json!({"title": "Close your Kubernetes gap", "recommendation_type": "skill_gap_closure", "priority": "high"}),
            ),
        ];
        for (et, payload) in cases {
            let c = normalize(&job_with(et, payload), Utc::now()).unwrap();
            assert_eq!(c.entity_type, et, "{et}: entity_type mismatch");
            assert_ne!(c.entity_type, "unknown", "{et}: deserialized to unknown");
            assert!(!c.title.trim().is_empty(), "{et}: empty title");
            assert!(!c.summary.trim().is_empty(), "{et}: empty summary");
            assert_eq!(c.domain, "career", "{et}: wrong domain");
            assert!(
                c.relationships.iter().all(|r| r.label != "RELATED_TO"),
                "{et}: RELATED_TO fallback"
            );
        }
    }

    #[test]
    fn career_user_anchor_edges() {
        assert!(has_edge(
            &rels("career_profile", json!({"current_title": "A"})),
            "HAS_CAREER",
            "user_profile"
        ));
        assert!(has_edge(
            &rels("career_goal", json!({"title": "g"})),
            "HAS_GOAL",
            "user_profile"
        ));
        assert!(has_edge(
            &rels("experience_record", json!({"employer": "e"})),
            "HAS_EXPERIENCE",
            "user_profile"
        ));
        assert!(has_edge(
            &rels("user_skill", json!({"proficiency": "x"})),
            "HAS_SKILL",
            "user_profile"
        ));
        assert!(has_edge(
            &rels("job_target", json!({"role_title": "r"})),
            "TARGETS_ROLE",
            "user_profile"
        ));
        assert!(has_edge(
            &rels("compensation_record", json!({"role": "r"})),
            "HAS_COMPENSATION",
            "user_profile"
        ));
        assert!(has_edge(
            &rels("compensation_projection", json!({"scenario": "s"})),
            "HAS_COMPENSATION_PROJECTION",
            "user_profile"
        ));
        assert!(has_edge(
            &rels("career_recommendation", json!({"title": "t"})),
            "HAS_RECOMMENDATION",
            "user_profile"
        ));
    }

    #[test]
    fn career_optional_fk_emits_only_when_present() {
        let app = Uuid::new_v4().to_string();
        // interview WITH job_application_id -> inter-entity edge from job_application
        let with_fk = rels(
            "interview",
            json!({"stage": "onsite", "job_application_id": app}),
        );
        assert!(with_fk
            .iter()
            .any(|r| r.label == "INCLUDES_INTERVIEW" && r.target_entity_type == "job_application"));
        assert!(has_edge(&with_fk, "HAS_INTERVIEW", "user_profile")); // still user-anchored
                                                                      // interview WITHOUT the FK -> only the user anchor, no faked inter-entity edge
        let no_fk = rels("interview", json!({"stage": "onsite"}));
        assert!(!no_fk.iter().any(|r| r.label == "INCLUDES_INTERVIEW"));
        assert!(has_edge(&no_fk, "HAS_INTERVIEW", "user_profile"));
        assert!(no_fk.iter().all(|r| r.label != "RELATED_TO"));
        // user_skill WITH skill_id -> HAS_PROFICIENCY from skill
        let sk = Uuid::new_v4().to_string();
        let us = rels(
            "user_skill",
            json!({"proficiency": "advanced", "skill_id": sk}),
        );
        assert!(us
            .iter()
            .any(|r| r.label == "HAS_PROFICIENCY" && r.target_entity_type == "skill"));
    }

    #[test]
    fn career_recommendation_fans_out() {
        let mut job = job_with(
            "career_recommendation",
            json!({
                "title": "Close your Kubernetes gap",
                "recommendation_type": "skill_gap_closure",
                "evidence_json": [{"metric_name": "comp_uplift", "metric_value": "18000", "source_table": "ln_central.compensation_bands", "confidence": 0.7, "explanation": "OEWS band delta"}],
                "assumptions_json": [{"assumption_text": "market demand stays stable", "confidence": 0.6}],
                "governance_verdict": {"passed": true, "boundary_type": "career_guidance", "disclaimer_text": "Career coaching, not a guarantee of hire or pay"}
            }),
        );
        job.entity_id = "CREC1".into();
        let children = expand_children(&job, Utc::now());
        assert_eq!(children.len(), 3); // evidence + assumption + boundary
        for c in &children {
            assert!(
                c.relationships
                    .iter()
                    .any(|r| r.target_entity_type == "career_recommendation"
                        && r.target_entity_id == "CREC1"),
                "{} not linked to career_recommendation",
                c.entity_type
            );
            assert!(c.relationships.iter().all(|r| r.label != "RELATED_TO"));
        }
        assert!(children.iter().any(|c| c.entity_type == "evidence"
            && c.relationships.iter().any(|r| r.label == "HAS_EVIDENCE")));
        assert!(children.iter().any(|c| c.entity_type == "advice_boundary"));
    }

    #[test]
    fn career_recommendation_fan_out_is_deterministic() {
        let mut job = job_with(
            "career_recommendation",
            json!({
                "title": "x", "evidence_json": [{"metric_name": "m", "metric_value": "1", "source_table": "t"}]
            }),
        );
        job.entity_id = "CRECDET".into();
        let a = expand_children(&job, Utc::now());
        let b = expand_children(&job, Utc::now());
        let ids =
            |v: &[CanonicalGraphObject]| v.iter().map(|c| c.entity_id.clone()).collect::<Vec<_>>();
        assert_eq!(ids(&a), ids(&b)); // deterministic child ids -> idempotent MERGE
    }

    #[test]
    fn career_summary_does_not_leak_raw_sensitive_fields() {
        // resume content_ref must NOT be embedded
        let r = normalize(&job_with("resume", json!({"title": "Resume", "version": 1, "content_ref": "s3://bucket/SECRETKEY/resume.pdf"})), Utc::now()).unwrap();
        assert!(
            !r.summary.contains("SECRETKEY"),
            "resume leaked content_ref: {}",
            r.summary
        );
        // compensation_record summary uses comp_median, not the raw base/bonus breakdown
        let c = normalize(
            &job_with(
                "compensation_record",
                json!({"role": "Analyst", "comp_median": 120000, "base": 999111, "bonus": 888222}),
            ),
            Utc::now(),
        )
        .unwrap();
        assert!(
            !c.summary.contains("999111") && !c.summary.contains("888222"),
            "comp record leaked base/bonus: {}",
            c.summary
        );
    }

    #[test]
    fn career_user_anchor_targets_owner_not_another_tenant() {
        let job = job_with("career_profile", json!({"current_title": "A"}));
        let owner = job.user_id.to_string();
        let canon = normalize(&job, Utc::now()).unwrap();
        let anchor = canon
            .relationships
            .iter()
            .find(|r| r.label == "HAS_CAREER")
            .unwrap();
        // the edge always anchors to the row's own user_id -> never cross-tenant
        assert_eq!(anchor.target_entity_id, owner);
    }

    // ---- Education E1 ----
    #[test]
    fn education_entities_normalize_and_user_anchor_edges() {
        let cases = [
            (
                "education_profile",
                json!({"highest_level": "bachelors", "learning_preferences": "online"}),
                "HAS_EDUCATION",
            ),
            (
                "education_goal",
                json!({"title": "Earn an MS in CS", "goal_type": "degree", "target_role": "Platform Engineer"}),
                "HAS_EDUCATION_GOAL",
            ),
            (
                "learning_path",
                json!({"title": "K8s mastery", "status": "planned"}),
                "HAS_LEARNING_PATH",
            ),
            (
                "school",
                json!({"name": "State University", "school_type": "public", "location": "US"}),
                "CONSIDERS_SCHOOL",
            ),
            (
                "program",
                json!({"name": "MS Computer Science", "level": "masters", "tuition": 40000}),
                "EVALUATES_PROGRAM",
            ),
            (
                "program_comparison",
                json!({"title": "MS vs bootcamp", "status": "draft"}),
                "HAS_PROGRAM_COMPARISON",
            ),
            (
                "education_recommendation",
                json!({"title": "Pick the lower-debt program", "recommendation_type": "lower_cost_alternative", "priority": "high"}),
                "HAS_RECOMMENDATION",
            ),
        ];
        for (et, payload, rel) in cases {
            let c = normalize(&job_with(et, payload), Utc::now()).unwrap();
            assert_eq!(c.entity_type, et, "{et}: entity_type");
            assert_ne!(c.entity_type, "unknown", "{et}: unknown");
            assert!(!c.title.trim().is_empty(), "{et}: empty title");
            assert!(!c.summary.trim().is_empty(), "{et}: empty summary");
            assert_eq!(c.domain, "education", "{et}: domain");
            assert!(
                has_edge(&c.relationships, rel, "user_profile"),
                "{et}: missing {rel}"
            );
            assert!(
                c.relationships.iter().all(|r| r.label != "RELATED_TO"),
                "{et}: RELATED_TO"
            );
        }
    }

    #[test]
    fn program_offers_edge_only_with_school_fk() {
        let sid = Uuid::new_v4().to_string();
        let with_fk = rels("program", json!({"name": "MS CS", "school_id": sid}));
        assert!(with_fk
            .iter()
            .any(|r| r.label == "OFFERS" && r.target_entity_type == "school"));
        let no_fk = rels("program", json!({"name": "MS CS"}));
        assert!(!no_fk.iter().any(|r| r.label == "OFFERS")); // no fake edge
        assert!(has_edge(&no_fk, "EVALUATES_PROGRAM", "user_profile"));
    }

    #[test]
    fn education_recommendation_fans_out() {
        let mut job = job_with(
            "education_recommendation",
            json!({
                "title": "Lower-cost alternative",
                "recommendation_type": "lower_cost_alternative",
                "evidence_json": [{"metric_name": "net_cost_delta", "metric_value": "22000", "source_table": "education.programs", "confidence": 0.7, "explanation": "cheaper program, comparable ROI"}],
                "assumptions_json": [{"assumption_text": "Scorecard earnings approximate outcomes", "confidence": 0.6}],
                "governance_verdict": {"passed": true, "boundary_type": "education_guidance", "disclaimer_text": "Decision support, not admissions or financial advice"}
            }),
        );
        job.entity_id = "EREC1".into();
        let children = expand_children(&job, Utc::now());
        assert_eq!(children.len(), 3);
        for c in &children {
            assert!(c
                .relationships
                .iter()
                .any(|r| r.target_entity_type == "education_recommendation"
                    && r.target_entity_id == "EREC1"));
            assert!(c.relationships.iter().all(|r| r.label != "RELATED_TO"));
        }
        assert!(children.iter().any(|c| c.entity_type == "evidence"
            && c.relationships.iter().any(|r| r.label == "HAS_EVIDENCE")));
        assert!(children.iter().any(|c| c.entity_type == "advice_boundary"));
    }

    // ---- Family F1 ----
    #[test]
    fn family_entities_normalize_and_user_anchor_edges() {
        let cases = [
            (
                "family_profile",
                json!({"household_size": 4, "marital_status": "married", "num_dependents": 2}),
                "HAS_FAMILY",
            ),
            (
                "dependent",
                json!({"relationship": "child", "birth_year": 2015}),
                "HAS_DEPENDENT",
            ),
            (
                "spouse_profile",
                json!({"employment_status": "employed", "income_band": "80-100k"}),
                "HAS_SPOUSE",
            ),
            (
                "guardianship_plan",
                json!({"status": "designated", "designated_guardian": "sibling"}),
                "HAS_GUARDIANSHIP_PLAN",
            ),
            (
                "estate_plan",
                json!({"status": "incomplete", "has_will": false}),
                "HAS_ESTATE_PLAN",
            ),
            (
                "insurance_profile",
                json!({"life_coverage": 500000, "disability_coverage": 0}),
                "HAS_INSURANCE_PROFILE",
            ),
            (
                "college_planning",
                json!({"target_year": 2033, "projected_cost": 120000, "vehicle": "529"}),
                "HAS_COLLEGE_PLAN",
            ),
            (
                "family_recommendation",
                json!({"title": "Add term life coverage", "recommendation_type": "insurance_gap", "priority": "high"}),
                "HAS_RECOMMENDATION",
            ),
        ];
        for (et, payload, rel) in cases {
            let c = normalize(&job_with(et, payload), Utc::now()).unwrap();
            assert_eq!(c.entity_type, et, "{et}: entity_type");
            assert_ne!(c.entity_type, "unknown", "{et}: unknown");
            assert!(!c.title.trim().is_empty(), "{et}: empty title");
            assert!(!c.summary.trim().is_empty(), "{et}: empty summary");
            assert_eq!(c.domain, "family", "{et}: domain");
            assert!(
                has_edge(&c.relationships, rel, "user_profile"),
                "{et}: missing {rel}"
            );
            assert!(
                c.relationships.iter().all(|r| r.label != "RELATED_TO"),
                "{et}: RELATED_TO"
            );
        }
    }

    #[test]
    fn dependent_covers_edge_only_with_guardian_fk() {
        let gid = Uuid::new_v4().to_string();
        let with_fk = rels(
            "dependent",
            json!({"relationship": "child", "guardianship_plan_id": gid}),
        );
        assert!(with_fk
            .iter()
            .any(|r| r.label == "COVERS_DEPENDENT" && r.target_entity_type == "guardianship_plan"));
        let no_fk = rels("dependent", json!({"relationship": "child"}));
        assert!(!no_fk.iter().any(|r| r.label == "COVERS_DEPENDENT"));
        assert!(has_edge(&no_fk, "HAS_DEPENDENT", "user_profile"));
    }

    #[test]
    fn family_recommendation_fans_out() {
        let mut job = job_with(
            "family_recommendation",
            json!({
                "title": "Close your life-insurance gap",
                "recommendation_type": "insurance_gap",
                "evidence_json": [{"metric_name": "coverage_gap", "metric_value": "400000", "source_table": "family.insurance_profiles", "confidence": 0.7, "explanation": "need minus coverage"}],
                "assumptions_json": [{"assumption_text": "income replacement multiple = 10x", "confidence": 0.6}],
                "governance_verdict": {"passed": true, "boundary_type": "family_planning", "disclaimer_text": "Planning guidance; consult a licensed agent/advisor"}
            }),
        );
        job.entity_id = "FREC1".into();
        let children = expand_children(&job, Utc::now());
        assert_eq!(children.len(), 3);
        for c in &children {
            assert!(c
                .relationships
                .iter()
                .any(|r| r.target_entity_type == "family_recommendation"
                    && r.target_entity_id == "FREC1"));
            assert!(c.relationships.iter().all(|r| r.label != "RELATED_TO"));
        }
        assert!(children.iter().any(|c| c.entity_type == "evidence"
            && c.relationships.iter().any(|r| r.label == "HAS_EVIDENCE")));
        assert!(children.iter().any(|c| c.entity_type == "advice_boundary"));
    }
}
