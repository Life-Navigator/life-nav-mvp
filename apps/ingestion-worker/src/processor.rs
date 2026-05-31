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
use crate::queue::{SyncOperation, SyncQueueJob};
use crate::supabase_client::SupabaseClient;

pub struct Processor<'a> {
    pub supabase: &'a SupabaseClient,
    pub gemini: &'a GeminiClient,
    pub qdrant: &'a QdrantClient,
    pub neo4j: &'a Neo4jClient,
}

#[derive(Debug, Clone, Copy)]
pub struct ProcessOutcome {
    pub qdrant_synced: bool,
    pub neo4j_synced: bool,
}

impl<'a> Processor<'a> {
    pub async fn process_job(&self, job: &SyncQueueJob) -> Result<ProcessOutcome> {
        match job.operation {
            SyncOperation::Upsert => self.process_upsert(job).await,
            SyncOperation::Delete => self.process_delete(job).await,
        }
    }

    async fn process_upsert(&self, job: &SyncQueueJob) -> Result<ProcessOutcome> {
        let canon = normalize(job, Utc::now())?;

        // Skip empty summaries — the source row had nothing embeddable.
        if canon.summary.trim().is_empty() {
            warn!(
                entity_type = %job.entity_type,
                entity_id = %job.entity_id,
                "empty summary; persisting Neo4j only"
            );
            let neo4j = self.neo4j.upsert_node(&canon).await.is_ok();
            return Ok(ProcessOutcome {
                qdrant_synced: false,
                neo4j_synced: neo4j,
            });
        }

        // 1. Embed.
        let vector = self.gemini.embed(&canon.summary).await?;

        // 2. Qdrant upsert.
        let qdrant = self.qdrant.upsert(&canon, vector).await.is_ok();
        if qdrant {
            info!(
                entity_type = %job.entity_type,
                entity_id = %job.entity_id,
                "qdrant upsert ok"
            );
        }

        // 3. Neo4j upsert.
        let neo4j = self.neo4j.upsert_node(&canon).await.is_ok();
        if neo4j {
            info!(
                entity_type = %job.entity_type,
                entity_id = %job.entity_id,
                "neo4j upsert ok"
            );
        }

        Ok(ProcessOutcome {
            qdrant_synced: qdrant,
            neo4j_synced: neo4j,
        })
    }

    async fn process_delete(&self, job: &SyncQueueJob) -> Result<ProcessOutcome> {
        let entity_type = EntityType::from_queue_str(&job.entity_type);
        let point_id = format!("{}|{}|{}", job.user_id, entity_type.as_str(), job.entity_id);
        let q = self.qdrant.delete(&point_id).await.is_ok();
        let n = self
            .neo4j
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
