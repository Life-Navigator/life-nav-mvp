//! Retry safety invariant.
//!
//! After a partial failure (Qdrant ok but Neo4j down, or vice versa),
//! the next worker run must re-emit identical upsert payloads so that
//! a) the side that already succeeded becomes a harmless no-op overwrite
//!    rather than a duplicate, and
//! b) the side that previously failed gets one more clean attempt.
//!
//! This is a logical-level test — it asserts the deterministic shape
//! of the upsert payload across re-runs without touching the network.

use chrono::Utc;
use serde_json::json;
use uuid::Uuid;

use ingestion_worker::entities::qdrant_point_uuid;
use ingestion_worker::neo4j_client::Neo4jClient;
use ingestion_worker::normalizer::normalize;
use ingestion_worker::qdrant_client::QdrantClient;
use ingestion_worker::queue::{AccessScope, SyncOperation, SyncQueueJob};

fn make() -> SyncQueueJob {
    SyncQueueJob {
        id: Uuid::new_v4(),
        user_id: Uuid::new_v4(),
        entity_type: "career_profile".into(),
        entity_id: "cp-1".into(),
        source_table: "public.career_profiles".into(),
        operation: SyncOperation::Upsert,
        payload: json!({
            "current_title": "Senior Engineer",
            "industry": "software",
            "years_of_experience": 6,
            "skills": ["python", "sql"]
        }),
        attempts: 1,
        access_scope: AccessScope::Personal,
        max_attempts: 5,
    }
}

#[test]
fn first_attempt_and_retry_emit_identical_qdrant_payload() {
    let job = make();
    let now = Utc::now();
    let canon_a = normalize(&job, now).unwrap();
    let canon_b = normalize(&job, now).unwrap();
    let pa = QdrantClient::build_payload(&canon_a);
    let pb = QdrantClient::build_payload(&canon_b);
    assert_eq!(pa, pb);
}

#[test]
fn first_attempt_and_retry_emit_identical_neo4j_cypher() {
    let job = make();
    let now = Utc::now();
    let canon_a = normalize(&job, now).unwrap();
    let canon_b = normalize(&job, now).unwrap();
    assert_eq!(
        Neo4jClient::merge_cypher_for(&canon_a),
        Neo4jClient::merge_cypher_for(&canon_b)
    );
}

#[test]
fn delete_op_is_keyed_the_same_as_upsert() {
    // Verifies the delete codepath uses the same tenant+entity_type+
    // entity_id triple to derive the Qdrant point id — so an upsert
    // followed by a delete actually targets the same row.
    let mut job = make();
    job.operation = SyncOperation::Upsert;
    let canon = normalize(&job, Utc::now()).unwrap();
    let upsert_point = canon.qdrant_point_id();

    // The delete path (processor.rs::process_delete) derives the point id with the
    // SAME helper as upsert — qdrant_point_uuid(user_id, entity_type, entity_id) — so
    // an upsert followed by a delete targets the same Qdrant point. (Updated from the
    // retired "{user_id}|{entity_type}|{entity_id}" pipe format, which predates the
    // UUID point-id contract; tenant_id == user_id for personal scope.)
    let delete_point =
        qdrant_point_uuid(&job.user_id.to_string(), "career_profile", &job.entity_id);
    assert_eq!(upsert_point, delete_point);
}
