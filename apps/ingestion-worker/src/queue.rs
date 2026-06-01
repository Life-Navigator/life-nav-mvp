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

/// Which sink a job's projections target.
///
///   * `Personal` — per-tenant point in the personal Qdrant collection
///     and per-tenant node in the personal Neo4j database. tenant_id =
///     the user_id.
///   * `Central`  — global-knowledge point in the central Qdrant
///     collection and global node in the central Neo4j database.
///     tenant_id is the nil UUID; no user binding.
#[derive(Clone, Copy, Debug, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AccessScope {
    #[default]
    Personal,
    Central,
}

impl AccessScope {
    pub fn as_str(&self) -> &'static str {
        match self {
            AccessScope::Personal => "personal",
            AccessScope::Central => "central",
        }
    }

    pub fn is_central(&self) -> bool {
        matches!(self, AccessScope::Central)
    }
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
    /// Added by migration 077. Defaults to `Personal` so jobs queued
    /// before 077 deploy continue to route into the personal sinks.
    #[serde(default)]
    pub access_scope: AccessScope,
}

fn default_max_attempts() -> i32 {
    5
}
