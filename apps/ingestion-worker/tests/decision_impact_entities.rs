//! Decision-impact entity coverage (migration 081).
//!
//! Verifies that every new entity_type that 081's sync triggers can
//! produce parses cleanly, gets a stable Person → entity edge label
//! (per spec), and produces a non-empty summary so it can be
//! retrieved by phrase match.

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
            "time_horizon": "1_year",
            "worst_case": 0.31,
            "p10": 0.42,
            "p25": 0.51,
            "most_likely": 0.64,
            "p75": 0.73,
            "p90": 0.81,
            "best_case": 0.88,
            "confidence": 0.74,
            "range_width": 0.57,
            "snapshot_at": "2026-05-31T00:00:00Z",
            "decision_label": "Reduce credit utilization below 10%",
            "probability_delta": 0.12,
            "timeline_delta_months": -3.0,
            "risk_delta": -0.05,
            "is_structural": false,
            "structural_variable": null,
            "pathway_label": "Income Growth First",
            "path_kind": "most_likely",
            "projected_score": 0.6,
            "projected_at": "2026-12-31",
            "rank": 1,
            "target_goal_concept": "Home Ownership",
            "domain": "financial",
            "marginal_impact": 0.18,
            "factor_kind": "horizon_length",
            "factor_label": "Horizon: 1_year",
            "effect": -0.2,
        }),
        attempts: 0,
        max_attempts: 5,
        access_scope: AccessScope::Personal,
    }
}

const NEW_ENTITY_TYPES: &[&str] = &[
    "goal_probability_distribution",
    "goal_probability_snapshot",
    "goal_decision_impact",
    "goal_pathway_probability",
    "goal_future_state",
    "decision_marginal_impact",
    "trajectory_variance_factor",
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
        "HAS_PROBABILITY_DISTRIBUTION",
        "HAS_PROBABILITY_SNAPSHOT",
        "CHANGES_PROBABILITY_OF",
        "HAS_PATHWAY_PROBABILITY",
        "PROJECTS_FUTURE_STATE",
        "RANKED_MARGINAL_IMPACT",
        "TRAJECTORY_VARIANCE_FACTOR",
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
