//! Central vs personal access-scope routing contract.
//!
//! Phase-1 of the Central Knowledge sprint adds the `access_scope`
//! column to `graphrag.sync_queue`. The worker must:
//!
//!   1. Surface the scope on every `SyncQueueJob` (defaults to
//!      Personal so pre-077 jobs continue to route correctly).
//!   2. Emit a Qdrant payload whose `access_scope` field matches the
//!      job's scope — *never* hardcoded to `"personal"`.
//!   3. Be able to construct Qdrant + Neo4j clients bound to either
//!      collection / database, so the processor can branch per job.
//!
//! These tests exercise the pure builders so they don't need a real
//! Qdrant or Neo4j; the routing branch in `processor.rs` is type-safe
//! and exercised by the existing tenant_isolation suite which still
//! passes after this change.

use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use ingestion_worker::entities::{CanonicalGraphObject, EntityType, SensitivityLevel};
use ingestion_worker::qdrant_client::QdrantClient;
use ingestion_worker::queue::{AccessScope, SyncOperation, SyncQueueJob};

fn nil_uuid() -> Uuid {
    Uuid::nil()
}

fn personal_canon() -> CanonicalGraphObject {
    let uid = Uuid::new_v4();
    CanonicalGraphObject {
        tenant_id: uid,
        user_id: uid,
        entity_id: "g-1".into(),
        entity_type: EntityType::Goal.as_str().into(),
        domain: EntityType::Goal.domain().into(),
        source_table: "public.goals".into(),
        title: "Goal".into(),
        summary: "Personal goal".into(),
        attributes: serde_json::Map::new(),
        relationships: vec![],
        sensitivity_level: SensitivityLevel::Low,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

fn central_canon() -> CanonicalGraphObject {
    CanonicalGraphObject {
        tenant_id: nil_uuid(),
        user_id: nil_uuid(),
        entity_id: "central-fact-1".into(),
        entity_type: "concept".into(),
        domain: "finance".into(),
        source_table: "central.ontology_entities".into(),
        title: "Income".into(),
        summary: "Central fact about Income".into(),
        attributes: serde_json::Map::new(),
        relationships: vec![],
        sensitivity_level: SensitivityLevel::Low,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

// --- 1. Default scope is Personal --------------------------------------

#[test]
fn default_access_scope_is_personal() {
    let s: AccessScope = Default::default();
    assert_eq!(s, AccessScope::Personal);
    assert_eq!(s.as_str(), "personal");
    assert!(!s.is_central());
}

#[test]
fn central_scope_string_is_central() {
    let s = AccessScope::Central;
    assert_eq!(s.as_str(), "central");
    assert!(s.is_central());
}

// --- 2. SyncQueueJob deserializes access_scope from the queue row -----

#[test]
fn job_deserializes_access_scope_from_row_json() {
    // Mimics graphrag.claim_sync_jobs returning a central row.
    let row = json!({
        "id": Uuid::new_v4().to_string(),
        "user_id": Uuid::nil().to_string(),
        "entity_type": "central_ontology_entity",
        "entity_id": Uuid::new_v4().to_string(),
        "source_table": "central.ontology_entities",
        "operation": "upsert",
        "payload": {},
        "attempts": 0,
        "max_attempts": 5,
        "access_scope": "central"
    });
    let job: SyncQueueJob = serde_json::from_value(row).expect("must parse");
    assert_eq!(job.access_scope, AccessScope::Central);
    assert_eq!(job.operation, SyncOperation::Upsert);
}

#[test]
fn job_defaults_to_personal_when_column_missing() {
    // Pre-077 rows or jobs serialized without the column.
    let row = json!({
        "id": Uuid::new_v4().to_string(),
        "user_id": Uuid::new_v4().to_string(),
        "entity_type": "goal",
        "entity_id": Uuid::new_v4().to_string(),
        "source_table": "public.goals",
        "operation": "upsert",
        "payload": {},
        "attempts": 0,
        "max_attempts": 5
    });
    let job: SyncQueueJob = serde_json::from_value(row).expect("must parse");
    assert_eq!(job.access_scope, AccessScope::Personal);
}

// --- 3. Qdrant payload reflects the job's scope, not a hard-coded value

#[test]
fn qdrant_payload_for_personal_scope_says_personal() {
    let p = QdrantClient::build_payload_with_scope(&personal_canon(), AccessScope::Personal);
    assert_eq!(p["access_scope"], json!("personal"));
}

#[test]
fn qdrant_payload_for_central_scope_says_central() {
    let p = QdrantClient::build_payload_with_scope(&central_canon(), AccessScope::Central);
    assert_eq!(p["access_scope"], json!("central"));
    // Central rows have nil tenant_id by convention.
    assert_eq!(p["tenant_id"], json!(Uuid::nil().to_string()));
}

#[test]
fn legacy_build_payload_still_returns_personal_for_back_compat() {
    // Older test/integration callers use the original `build_payload`
    // helper; it must keep returning `access_scope: personal`.
    let p = QdrantClient::build_payload(&personal_canon());
    assert_eq!(p["access_scope"], json!("personal"));
}

// --- 4. Two scopes produce distinct payload values --------------------

#[test]
fn personal_and_central_payloads_have_distinct_scope_values() {
    let p = QdrantClient::build_payload_with_scope(&personal_canon(), AccessScope::Personal);
    let c = QdrantClient::build_payload_with_scope(&central_canon(), AccessScope::Central);
    assert_ne!(p["access_scope"], c["access_scope"]);
}
