//! Provider GraphRAG entity coverage (migration 085).
//!
//! Verifies the 7 new provider-* entity types parse cleanly, emit a
//! stable Person → entity edge label per Sprint I spec, and produce a
//! non-empty summary.

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
        source_table: "providers.t".into(),
        operation: SyncOperation::Upsert,
        payload: json!({
            "provider_type": "trainer",
            "legal_name": "Jane Trainer",
            "primary_domains": ["health"],
            "specialties": ["strength","conditioning"],
            "verified": true,
            "status": "active",
            "allowed_domains": ["health"],
            "max_sensitivity": "medium",
            "can_issue_recommendations": true,
            "initiated_by": "patient",
            "accepted_at": "2026-05-31T00:00:00Z",
            "scope_kind": "grant",
            "entity_type": "health_metric",
            "domain": "health",
            "title": "Add 2 Zone 2 sessions",
            "body": "30-45 min @ ~65% HRmax",
            "rationale": "VO2max improvement",
            "expected_horizon_months": 3,
            "expected_strength": 0.6,
            "dimension": "VO2max",
            "observed_value": 42.5,
            "expected_value": 41.0,
            "delta": 1.5,
            "accuracy_score": 0.88,
            "outcome_quality": 0.75,
            "source": "wearable",
            "entry_kind": "protocol",
            "tags": ["aerobic","base-building"],
            "visibility": "shared_with_patients",
            "period": "monthly",
            "period_start": "2026-05-01",
            "active_patient_count": 12,
            "recommendations_issued": 35,
            "recommendations_completed": 22,
            "success_rate": 0.62,
            "mean_outcome_quality": 0.71,
        }),
        attempts: 0,
        max_attempts: 5,
        access_scope: AccessScope::Personal,
    }
}

const NEW_ENTITY_TYPES: &[&str] = &[
    "provider_profile",
    "provider_engagement",
    "provider_consent_scope",
    "provider_recommendation",
    "provider_outcome",
    "provider_knowledge_entry",
    "provider_analytics",
];

#[test]
fn every_provider_entity_type_parses() {
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
fn every_provider_entity_type_emits_a_named_person_edge() {
    let allowed: &[&str] = &[
        "HAS_PROVIDER_PROFILE",
        "HAS_PROVIDER_ENGAGEMENT",
        "HAS_CONSENT_SCOPE",
        "RECOMMENDED_BY_PROVIDER",
        "PROVIDER_OUTCOME",
        "AUTHORED_KNOWLEDGE",
        "ANALYZED_BY_PROVIDER",
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
fn every_provider_entity_type_produces_a_non_empty_summary() {
    for et in NEW_ENTITY_TYPES {
        let canon = normalize(&job_for(et), Utc::now()).unwrap();
        assert!(
            !canon.summary.trim().is_empty(),
            "entity_type={et} produced an empty summary"
        );
    }
}
