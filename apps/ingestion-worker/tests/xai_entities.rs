//! XAI + Trust Layer entity coverage (migration 082).
//!
//! Verifies that every new XAI entity_type parses cleanly, emits a
//! stable Person → entity edge label (per Sprint E spec), and produces
//! a non-empty summary so the chain can be retrieved by phrase match.

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
            "target_kind": "recommendation_output",
            "engine_versions": {"probability":"v1","impact":"v1"},
            "duration_ms": 42,
            "computed_at": "2026-05-31T00:00:00Z",
            "max_depth": 5,
            "source_kind": "central_ontology",
            "source_label": "CFA Charter",
            "citation_reference": "CFA Institute",
            "confidence": 0.9,
            "weight": 1.0,
            "scenario_label": "base_magnitude doubled",
            "expected_outcome": "reranked",
            "sensitivity": 0.7,
            "delta_summary": "1-year probability_delta: 12% -> 22%",
            "assumption_text": "Long-horizon estimates assume no structural life event.",
            "severity": "critical",
            "source_engine": "probability",
        }),
        attempts: 0,
        max_attempts: 5,
        access_scope: AccessScope::Personal,
    }
}

const NEW_ENTITY_TYPES: &[&str] = &[
    "recommendation_audit_trail",
    "why_chain",
    "evidence_link",
    "counterfactual_scenario",
    "recommendation_assumption",
];

#[test]
fn every_xai_entity_type_parses() {
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
fn every_xai_entity_type_emits_a_named_person_edge() {
    let allowed: &[&str] = &[
        "AUDITED_BY",
        "HAS_WHY_CHAIN",
        "SUPPORTED_BY",
        "COUNTERFACTUAL_OF",
        "ASSUMED_BY",
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
fn every_xai_entity_type_produces_a_non_empty_summary() {
    for et in NEW_ENTITY_TYPES {
        let canon = normalize(&job_for(et), Utc::now()).unwrap();
        assert!(
            !canon.summary.trim().is_empty(),
            "entity_type={et} produced an empty summary"
        );
    }
}
