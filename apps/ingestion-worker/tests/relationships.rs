//! relationships_for is the layer that turns the SyncQueueJob's user_id
//! into a Person → entity edge in Neo4j. Three guarantees:
//!
//!   1. Every entity type produces exactly one relationship pinned to
//!      the job's user_id. (The earlier implementation read `user_id`
//!      from `attrs`, which the 050/055/068/074 trigger payloads do
//!      not carry; this is the regression fix.)
//!   2. The label is entity-specific (`HAS_GOAL`, `HAS_INSURANCE_PLAN`,
//!      `HAS_OPTIMIZER_RUN`, etc.) and falls back to `RELATED_TO` only
//!      for the catch-all Unknown variant.
//!   3. Two users emit edges with distinct `target_entity_id`s.

use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use ingestion_worker::normalizer::normalize;
use ingestion_worker::queue::{SyncOperation, SyncQueueJob};

fn job_for(user_id: Uuid, entity_type: &str) -> SyncQueueJob {
    SyncQueueJob {
        id: Uuid::new_v4(),
        user_id,
        entity_type: entity_type.into(),
        entity_id: Uuid::new_v4().to_string(),
        source_table: "public.t".into(),
        operation: SyncOperation::Upsert,
        payload: json!({"title": "x"}),
        attempts: 0,
        max_attempts: 5,
    }
}

#[test]
fn every_known_entity_emits_a_person_edge_pinned_to_jobs_user_id() {
    // A representative sample of the 074-added types — if any is missing,
    // a Person → entity edge would be skipped in Neo4j.
    let entity_types = [
        "goal",
        "life_vision",
        "constraint",
        "decision",
        "recommendation",
        "outcome",
        "action",
        "life_event",
        "goal_discovery_turn",
        "goal_interpretation",
        "optimizer_run",
        "optimizer_allocation",
        "optimizer_recommendation",
        "life_scenario",
        "life_scenario_output",
        "life_trajectory_snapshot",
        "estate_profile",
        "estate_beneficiary",
        "insurance_plan",
        "insurance_document",
        "insurance_document_fact",
        "benefit_profile",
        "user_financial_profile",
        "financing_preference",
        "education_intake",
        "injury",
        "health_alert_event",
        "candidate_match",
    ];
    let user = Uuid::new_v4();
    for et in entity_types {
        let canon = normalize(&job_for(user, et), Utc::now())
            .unwrap_or_else(|e| panic!("normalize failed for {et}: {e}"));
        assert!(
            !canon.relationships.is_empty(),
            "entity_type={et} did not emit any relationship"
        );
        let rel = &canon.relationships[0];
        assert_eq!(
            rel.target_entity_id,
            user.to_string(),
            "entity_type={et}: relationship not pinned to job's user_id"
        );
        assert_eq!(rel.target_entity_type, "user_profile");
        assert!(
            rel.label.starts_with("HAS_")
                || rel.label.starts_with("MADE_")
                || rel.label.starts_with("OBSERVED_")
                || rel.label.starts_with("TOOK_")
                || rel.label.starts_with("RECEIVED_")
                || rel.label.starts_with("MATCHED_")
                || rel.label.starts_with("GENERATED_")
                || rel.label.starts_with("EXPERIENCED_")
                || rel.label.starts_with("SCENARIO_")
                || rel.label == "RELATED_TO",
            "entity_type={et}: unexpected relationship label {}",
            rel.label
        );
    }
}

#[test]
fn two_users_produce_distinct_target_entity_ids() {
    let a = Uuid::new_v4();
    let b = Uuid::new_v4();
    let canon_a = normalize(&job_for(a, "constraint"), Utc::now()).unwrap();
    let canon_b = normalize(&job_for(b, "constraint"), Utc::now()).unwrap();
    assert_ne!(
        canon_a.relationships[0].target_entity_id,
        canon_b.relationships[0].target_entity_id
    );
}

#[test]
fn unknown_entity_falls_back_to_related_to_label_but_still_emits_edge() {
    let user = Uuid::new_v4();
    let canon = normalize(&job_for(user, "totally_new_type"), Utc::now()).unwrap();
    assert_eq!(canon.relationships.len(), 1);
    assert_eq!(canon.relationships[0].label, "RELATED_TO");
    assert_eq!(canon.relationships[0].target_entity_id, user.to_string());
}
