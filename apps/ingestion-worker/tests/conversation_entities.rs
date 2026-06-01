//! Conversation Intelligence entity coverage (migration 084).
//!
//! Verifies that every new discovery / challenge / trace entity_type
//! parses cleanly, emits the right Person → entity edge label per
//! Sprint H spec, and produces a non-empty summary so it can be
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
            "domain": "financial",
            "status": "active",
            "current_depth": 2,
            "dominant_driver": "financial_security",
            "secondary_driver": "image",
            "driver_confidence": 0.6,
            "inferred_root_goal": "Financial Independence",
            "assumption_text": "No matching pathway history yet.",
            "challenge_kind": "counter_evidence",
            "response_state": "pending",
            "changed_outcome": false,
            "turn_index": 3,
            "classified_intent": "explain_recommendation",
            "turn_kind": "explain",
            "explainer_kind": "tradeoff",
            "used_llm": true,
            "missing_info_count": 1,
            "contradiction_count": 0,
        }),
        attempts: 0,
        max_attempts: 5,
        access_scope: AccessScope::Personal,
    }
}

const NEW_ENTITY_TYPES: &[&str] = &[
    "discovery_session",
    "assumption_challenge",
    "conversation_trace",
];

#[test]
fn every_conversation_entity_type_parses() {
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
fn every_conversation_entity_type_emits_a_named_person_edge() {
    let allowed: &[&str] = &["HAS_DISCOVERY_SESSION", "CHALLENGED_BY", "TRACED_BY"];
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
fn every_conversation_entity_type_produces_a_non_empty_summary() {
    for et in NEW_ENTITY_TYPES {
        let canon = normalize(&job_for(et), Utc::now()).unwrap();
        assert!(
            !canon.summary.trim().is_empty(),
            "entity_type={et} produced an empty summary"
        );
    }
}
