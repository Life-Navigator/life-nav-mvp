//! Idempotency invariant.
//!
//! Re-processing the same job (same tenant + entity_type + entity_id)
//! must produce the same Qdrant point id and the same Neo4j MERGE
//! statement. That guarantees upserts overwrite cleanly — a retry can
//! never produce a duplicate node or a duplicate vector.

use chrono::{TimeZone, Utc};
use serde_json::json;
use uuid::Uuid;

use ingestion_worker::neo4j_client::Neo4jClient;
use ingestion_worker::normalizer::normalize;
use ingestion_worker::queue::{SyncOperation, SyncQueueJob};

#[test]
fn same_inputs_produce_same_qdrant_point_id() {
    let user = Uuid::new_v4();
    let mk = || SyncQueueJob {
        id: Uuid::new_v4(),
        user_id: user,
        entity_type: "financial_account".into(),
        entity_id: "acc-9".into(),
        source_table: "finance.financial_accounts".into(),
        operation: SyncOperation::Upsert,
        payload: json!({
            "account_name": "Ally HYSA",
            "account_type": "savings",
            "current_balance": 30000
        }),
        attempts: 0,
        max_attempts: 5,
    };
    let now = Utc.with_ymd_and_hms(2026, 6, 1, 12, 0, 0).unwrap();
    let c1 = normalize(&mk(), now).unwrap();
    let c2 = normalize(&mk(), now).unwrap();
    assert_eq!(c1.qdrant_point_id(), c2.qdrant_point_id());
}

#[test]
fn same_inputs_produce_same_neo4j_merge_cypher() {
    let user = Uuid::new_v4();
    let mk = || SyncQueueJob {
        id: Uuid::new_v4(),
        user_id: user,
        entity_type: "goal".into(),
        entity_id: "g-3".into(),
        source_table: "public.goals".into(),
        operation: SyncOperation::Upsert,
        payload: json!({"title": "Buy a home", "category": "financial"}),
        attempts: 0,
        max_attempts: 5,
    };
    let now = Utc.with_ymd_and_hms(2026, 6, 1, 12, 0, 0).unwrap();
    let c1 = normalize(&mk(), now).unwrap();
    let c2 = normalize(&mk(), now).unwrap();
    assert_eq!(
        Neo4jClient::merge_cypher_for(&c1),
        Neo4jClient::merge_cypher_for(&c2)
    );
}

#[test]
fn upsert_is_keyed_by_tenant_plus_entity_type_plus_entity_id() {
    let user = Uuid::new_v4();
    let now = Utc::now();

    let job_v1 = SyncQueueJob {
        id: Uuid::new_v4(),
        user_id: user,
        entity_type: "debt".into(),
        entity_id: "d-1".into(),
        source_table: "finance.debts".into(),
        operation: SyncOperation::Upsert,
        payload: json!({"debt_name": "Card A", "current_balance": 1000}),
        attempts: 0,
        max_attempts: 5,
    };
    let job_v2 = SyncQueueJob {
        // payload changed (balance ↓ 200) but the same tenant + entity_id
        payload: json!({"debt_name": "Card A", "current_balance": 800}),
        ..job_v1.clone()
    };

    let c1 = normalize(&job_v1, now).unwrap();
    let c2 = normalize(&job_v2, now).unwrap();
    assert_eq!(c1.qdrant_point_id(), c2.qdrant_point_id());
    // Different payload should be reflected in the summary though.
    assert_ne!(c1.summary, c2.summary);
}
