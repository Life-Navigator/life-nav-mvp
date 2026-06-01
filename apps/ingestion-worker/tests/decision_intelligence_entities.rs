//! Decision-intelligence entity coverage (migration 080).
//!
//! Every new entity_type that 080's sync triggers can produce must:
//!   1. Parse from a queue row JSON string into the right EntityType
//!      variant (never falling back to Unknown).
//!   2. Carry a stable Person → entity edge label so the central +
//!      personal Neo4j projections are connected, not isolated.
//!   3. Produce a non-empty summary for retrieval matching.

#![recursion_limit = "256"]

use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use ingestion_worker::entities::EntityType;
use ingestion_worker::normalizer::normalize;
use ingestion_worker::queue::{AccessScope, SyncOperation, SyncQueueJob};

fn job_for(entity_type: &str) -> SyncQueueJob {
    SyncQueueJob {
        id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        entity_type: entity_type.into(),
        entity_id: Uuid::new_v4().to_string(),
        source_table: "decision_intelligence.t".into(),
        operation: SyncOperation::Upsert,
        payload: json!({
            // Field bag broad enough that at least one summary part is
            // produced for every new entity type.
            "score": 0.42,
            "confidence": 0.7,
            "source": "engine",
            "delta": 0.1,
            "event_type": "outcome_observed",
            "occurred_at": "2026-05-31T00:00:00Z",
            "reason": "outcome aligned with expectation",
            "period": "monthly",
            "period_start": "2026-05-01",
            "events_count": 3,
            "target_date": "2026-12-31",
            "predicted_score": 0.6,
            "model_version": "progress_v1",
            "validation_score": 0.55,
            "validation_error": 0.05,
            "source_domain": "health",
            "target_domain": "career",
            "label": "CONTRIBUTED_TO",
            "strength": 0.6,
            "attributed_to_action_id": "act_1_req_x",
            "attribution_share": 0.7,
            "reasoning": "outcome credit",
            "predicted_confidence": 0.8,
            "actual_correct": true,
            "actual_value": 0.7,
            "bucket": "0.7-0.8",
            "action_id": "act_1_req_x",
            "predicted_strength": 0.7,
            "observed_outcome_quality": 0.6,
            "observed_strength": 0.65,
            "accuracy_score": 0.85,
            "advisor_run_id": Uuid::new_v4().to_string(),
            "total_actions": 8,
            "completed_actions": 5,
            "mean_predicted_confidence": 0.7,
            "mean_observed_outcome_quality": 0.6,
            "brier_score": 0.08,
            "calibration_error": 0.04,
            "confidence_accuracy_gap": 0.1,
            "recommendation_type": "all",
            "domain": "finance",
            "total": 12,
            "success_rate": 0.71,
            "completion_rate": 0.6,
            "mean_outcome_quality": 0.7,
            "root_goal_concept": "Financial Independence",
            "pathway_label": "Income Growth First",
            "sample_size": 42,
            "mean_duration_months": 18.5,
        }),
        attempts: 0,
        max_attempts: 5,
        access_scope: AccessScope::Personal,
    }
}

const NEW_ENTITY_TYPES: &[&str] = &[
    "goal_progress_snapshot",
    "goal_progress_event",
    "goal_progress_score",
    "goal_progress_prediction",
    "cross_domain_impact",
    "outcome_attribution",
    "prediction_calibration",
    "recommendation_accuracy",
    "advisor_accuracy",
    "recommendation_quality_metric",
    "pathway_effectiveness",
];

#[test]
fn every_new_entity_type_parses() {
    for et in NEW_ENTITY_TYPES {
        let parsed = EntityType::from_queue_str(et);
        assert!(
            !matches!(parsed, EntityType::Unknown),
            "entity_type {et} fell back to Unknown",
        );
        assert_eq!(parsed.as_str(), *et);
    }
}

#[test]
fn every_new_entity_type_emits_a_named_person_edge() {
    let allowed: &[&str] = &[
        "HAS_GOAL_PROGRESS_SNAPSHOT",
        "GOAL_PROGRESS_EVENT",
        "HAS_GOAL_PROGRESS_SCORE",
        "PREDICTED_GOAL_PROGRESS",
        "CROSS_DOMAIN_IMPACT",
        "ATTRIBUTED_OUTCOME",
        "CALIBRATION_OBSERVATION",
        "RECOMMENDATION_ACCURACY",
        "ADVISOR_ACCURACY_SNAPSHOT",
        "RECOMMENDATION_QUALITY_METRIC",
        "EFFECTIVE_PATHWAY",
    ];
    for et in NEW_ENTITY_TYPES {
        let canon = normalize(&job_for(et), Utc::now())
            .unwrap_or_else(|e| panic!("normalize failed for {et}: {e}"));
        assert_eq!(canon.relationships.len(), 1, "entity_type={et}");
        let rel = &canon.relationships[0];
        assert!(
            allowed.contains(&rel.label.as_str()),
            "entity_type={et}: unexpected edge label {}",
            rel.label
        );
        assert_eq!(rel.target_entity_type, "user_profile");
    }
}

#[test]
fn every_new_entity_type_produces_a_non_empty_summary() {
    for et in NEW_ENTITY_TYPES {
        let canon = normalize(&job_for(et), Utc::now()).unwrap();
        assert!(
            !canon.summary.trim().is_empty(),
            "entity_type={et} produced an empty summary"
        );
    }
}
