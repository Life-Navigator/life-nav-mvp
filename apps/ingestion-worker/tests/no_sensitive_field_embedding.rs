//! No sensitive field is ever embedded or persisted to Qdrant / Neo4j.
//!
//! The normalizer is the single chokepoint. Anything matched by
//! `SENSITIVE_FIELD_PATTERN` in telemetry.rs must be:
//!   - dropped from `attributes` (so it doesn't ride along to Qdrant
//!     payload or Neo4j SET clause),
//!   - kept out of `summary` (so it never reaches Gemini).
//!
//! This test exercises every known sensitive-field name we currently
//! filter on. Add new fields to telemetry::SENSITIVE_FIELD_PATTERN and
//! to the LIST below in the same PR.

use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use ingestion_worker::neo4j_client::Neo4jClient;
use ingestion_worker::normalizer::normalize;
use ingestion_worker::qdrant_client::QdrantClient;
use ingestion_worker::queue::{AccessScope, SyncOperation, SyncQueueJob};

const SENSITIVE_NAMES: &[&str] = &[
    "member_id",
    "group_number",
    "account_number",
    "routing_number",
    "ssn",
    "social_security",
    "notes_encrypted",
    "member_id_encrypted",
    "group_number_encrypted",
    "account_number_encrypted",
    "routing_number_encrypted",
    "access_token",
    "refresh_token",
    "password",
    "api_key",
];

fn job_with_sensitive_payload() -> SyncQueueJob {
    let mut payload = serde_json::Map::new();
    for name in SENSITIVE_NAMES {
        payload.insert((*name).into(), json!("SENSITIVE_VALUE_DO_NOT_EMBED"));
    }
    payload.insert("plan_name".into(), json!("BCBS PPO 500"));
    payload.insert("carrier".into(), json!("BlueCross"));
    SyncQueueJob {
        id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        entity_type: "health_insurance_plan".into(),
        entity_id: "plan-1".into(),
        source_table: "public.insurance_plans".into(),
        operation: SyncOperation::Upsert,
        payload: serde_json::Value::Object(payload),
        attempts: 0,
        max_attempts: 5,
        access_scope: AccessScope::Personal,
    }
}

#[test]
fn summary_contains_no_sensitive_value() {
    let canon = normalize(&job_with_sensitive_payload(), Utc::now()).unwrap();
    assert!(
        !canon.summary.contains("SENSITIVE_VALUE_DO_NOT_EMBED"),
        "summary leaked a sensitive value: {}",
        canon.summary
    );
}

#[test]
fn attributes_contain_no_sensitive_keys() {
    let canon = normalize(&job_with_sensitive_payload(), Utc::now()).unwrap();
    for name in SENSITIVE_NAMES {
        assert!(
            !canon.attributes.contains_key(*name),
            "attributes leaked sensitive key {name}"
        );
    }
}

#[test]
fn qdrant_payload_excludes_sensitive_fields() {
    let canon = normalize(&job_with_sensitive_payload(), Utc::now()).unwrap();
    let payload = QdrantClient::build_payload(&canon);
    let payload_str = serde_json::to_string(&payload).unwrap();
    assert!(
        !payload_str.contains("SENSITIVE_VALUE_DO_NOT_EMBED"),
        "qdrant payload leaked a sensitive value"
    );
    for name in SENSITIVE_NAMES {
        let key = format!("\"{}\"", name);
        assert!(
            !payload_str.contains(&key),
            "qdrant payload exposed sensitive key {name}"
        );
    }
}

#[test]
fn neo4j_params_attrs_exclude_sensitive_fields() {
    let canon = normalize(&job_with_sensitive_payload(), Utc::now()).unwrap();
    let params = Neo4jClient::build_params(&canon);
    let attrs = params.get("attrs").and_then(|v| v.as_object()).unwrap();
    for name in SENSITIVE_NAMES {
        assert!(
            !attrs.contains_key(*name),
            "neo4j params attrs leaked sensitive key {name}"
        );
    }
    let serialized = serde_json::to_string(attrs).unwrap();
    assert!(
        !serialized.contains("SENSITIVE_VALUE_DO_NOT_EMBED"),
        "neo4j attrs leaked a sensitive value"
    );
}
