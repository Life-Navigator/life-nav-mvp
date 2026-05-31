//! Mirrors the `graphrag.sync_queue` row shape returned by
//! `graphrag.claim_sync_jobs(p_limit)`.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum SyncOperation {
    Upsert,
    Delete,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct SyncQueueJob {
    pub id: Uuid,
    pub user_id: Uuid,
    pub entity_type: String,
    /// `entity_id` is stored as TEXT in the source table to accommodate
    /// non-uuid identifiers in the future. Today every callsite passes a
    /// uuid.
    pub entity_id: String,
    pub source_table: String,
    pub operation: SyncOperation,
    #[serde(default)]
    pub payload: serde_json::Value,
    #[serde(default)]
    pub attempts: i32,
    #[serde(default = "default_max_attempts")]
    pub max_attempts: i32,
}

fn default_max_attempts() -> i32 {
    5
}
