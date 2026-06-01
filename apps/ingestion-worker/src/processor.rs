//! Per-job orchestration.
//!
//! ```text
//! SyncQueueJob
//!     |
//!     v
//! normalize(job)  -> CanonicalGraphObject (sensitive fields stripped)
//!     |
//!     |  Upsert: embed + Qdrant + Neo4j
//!     |  Delete: delete from Qdrant + Neo4j; no embedding needed.
//!     v
//! complete_sync_job(neo4j_synced, qdrant_synced, error)
//! ```
//!
//! Access-scope routing
//! --------------------
//! Each job carries `access_scope: Personal | Central` (column added by
//! migration 077). The processor holds **two** Qdrant clients and
//! **two** Neo4j clients — one bound to the personal collection /
//! database, one bound to the central collection / database — and
//! picks the matching pair per job. There is no codepath that writes
//! a personal job into the central sink or vice versa.
//!
//! Partial failures are reported per-side so the next claim sees the
//! job as `failed` (or `pending` if retries remain) but knows exactly
//! which side already succeeded — the next run will idempotently
//! re-upsert the side that did succeed, so we never lose data.

use chrono::Utc;
use tracing::{info, warn};

use crate::entities::EntityType;
use crate::errors::Result;
use crate::gemini_client::GeminiClient;
use crate::neo4j_client::Neo4jClient;
use crate::normalizer::normalize;
use crate::qdrant_client::QdrantClient;
use crate::queue::{AccessScope, SyncOperation, SyncQueueJob};
use crate::supabase_client::SupabaseClient;

pub struct Processor<'a> {
    pub supabase: &'a SupabaseClient,
    pub gemini: &'a GeminiClient,
    pub qdrant_personal: &'a QdrantClient,
    pub qdrant_central: &'a QdrantClient,
    pub neo4j_personal: &'a Neo4jClient,
    pub neo4j_central: &'a Neo4jClient,
}

#[derive(Debug, Clone, Copy)]
pub struct ProcessOutcome {
    pub qdrant_synced: bool,
    pub neo4j_synced: bool,
}

impl<'a> Processor<'a> {
    /// Pick the right Qdrant + Neo4j client for the job's access scope.
    fn route(&self, scope: AccessScope) -> (&'a QdrantClient, &'a Neo4jClient) {
        match scope {
            AccessScope::Personal => (self.qdrant_personal, self.neo4j_personal),
            AccessScope::Central => (self.qdrant_central, self.neo4j_central),
        }
    }

    pub async fn process_job(&self, job: &SyncQueueJob) -> Result<ProcessOutcome> {
        match job.operation {
            SyncOperation::Upsert => self.process_upsert(job).await,
            SyncOperation::Delete => self.process_delete(job).await,
        }
    }

    async fn process_upsert(&self, job: &SyncQueueJob) -> Result<ProcessOutcome> {
        let canon = normalize(job, Utc::now())?;
        let (qdrant, neo4j) = self.route(job.access_scope);

        // Skip empty summaries — the source row had nothing embeddable.
        if canon.summary.trim().is_empty() {
            warn!(
                entity_type = %job.entity_type,
                entity_id = %job.entity_id,
                access_scope = %job.access_scope.as_str(),
                "empty summary; persisting Neo4j only"
            );
            let neo4j_ok = neo4j.upsert_node(&canon).await.is_ok();
            return Ok(ProcessOutcome {
                qdrant_synced: false,
                neo4j_synced: neo4j_ok,
            });
        }

        // 1. Embed.
        let vector = self.gemini.embed(&canon.summary).await?;

        // 2. Qdrant upsert (routed by access_scope).
        let qdrant_ok = qdrant.upsert(&canon, vector).await.is_ok();
        if qdrant_ok {
            info!(
                entity_type = %job.entity_type,
                entity_id = %job.entity_id,
                access_scope = %job.access_scope.as_str(),
                collection = %qdrant.collection(),
                "qdrant upsert ok"
            );
        }

        // 3. Neo4j upsert (routed by access_scope).
        let neo4j_ok = neo4j.upsert_node(&canon).await.is_ok();
        if neo4j_ok {
            info!(
                entity_type = %job.entity_type,
                entity_id = %job.entity_id,
                access_scope = %job.access_scope.as_str(),
                database = %neo4j.database(),
                "neo4j upsert ok"
            );
        }

        Ok(ProcessOutcome {
            qdrant_synced: qdrant_ok,
            neo4j_synced: neo4j_ok,
        })
    }

    async fn process_delete(&self, job: &SyncQueueJob) -> Result<ProcessOutcome> {
        let entity_type = EntityType::from_queue_str(&job.entity_type);
        let (qdrant, neo4j) = self.route(job.access_scope);
        let point_id = format!("{}|{}|{}", job.user_id, entity_type.as_str(), job.entity_id);
        let q = qdrant.delete(&point_id).await.is_ok();
        let n = neo4j
            .delete_node(
                &job.user_id.to_string(),
                entity_type.as_str(),
                &job.entity_id,
            )
            .await
            .is_ok();
        Ok(ProcessOutcome {
            qdrant_synced: q,
            neo4j_synced: n,
        })
    }
}
