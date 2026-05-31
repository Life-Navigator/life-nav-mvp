//! Thin Supabase HTTP client. Calls only the two RPCs the worker needs:
//! `graphrag.claim_sync_jobs` and `graphrag.complete_sync_job`. Uses
//! the service-role key — the worker has no concept of "current user".
//!
//! The service-role key never appears in logs; it's only attached to
//! outbound headers.

use reqwest::Client as Http;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::config::Config;
use crate::errors::{Result, WorkerError};
use crate::queue::SyncQueueJob;

pub struct SupabaseClient {
    http: Http,
    base_url: String,
    service_key: String,
}

impl SupabaseClient {
    pub fn new(cfg: &Config) -> Result<Self> {
        let http = Http::builder()
            .gzip(true)
            .timeout(std::time::Duration::from_secs(30))
            .build()?;
        Ok(Self {
            http,
            base_url: cfg.supabase_url.trim_end_matches('/').to_string(),
            service_key: cfg.supabase_service_role_key.clone(),
        })
    }

    /// Calls `graphrag.claim_sync_jobs(p_limit)`. Returns up to `limit`
    /// jobs that were flipped to `processing` by the RPC.
    pub async fn claim_jobs(&self, limit: usize) -> Result<Vec<SyncQueueJob>> {
        let url = format!("{}/rest/v1/rpc/claim_sync_jobs", self.base_url);
        let res = self
            .http
            .post(&url)
            .header("apikey", &self.service_key)
            .header("authorization", format!("Bearer {}", self.service_key))
            .header("content-type", "application/json")
            .header("content-profile", "graphrag")
            .json(&json!({ "p_limit": limit as i64 }))
            .send()
            .await?;

        if !res.status().is_success() {
            return Err(WorkerError::Supabase(format!(
                "claim_sync_jobs {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            )));
        }
        let jobs: Vec<SyncQueueJob> = res.json().await?;
        Ok(jobs)
    }

    /// Calls `graphrag.complete_sync_job(p_job_id, p_neo4j_synced,
    /// p_qdrant_synced, p_error)`.
    pub async fn complete_job(
        &self,
        job_id: Uuid,
        neo4j_synced: bool,
        qdrant_synced: bool,
        error: Option<&str>,
    ) -> Result<()> {
        let url = format!("{}/rest/v1/rpc/complete_sync_job", self.base_url);
        let body = json!({
            "p_job_id": job_id,
            "p_neo4j_synced": neo4j_synced,
            "p_qdrant_synced": qdrant_synced,
            "p_error": error,
        });
        let res = self
            .http
            .post(&url)
            .header("apikey", &self.service_key)
            .header("authorization", format!("Bearer {}", self.service_key))
            .header("content-type", "application/json")
            .header("content-profile", "graphrag")
            .json(&body)
            .send()
            .await?;
        if !res.status().is_success() {
            return Err(WorkerError::Supabase(format!(
                "complete_sync_job {}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            )));
        }
        Ok(())
    }
}

/// Payload returned from RPC. Kept here so other modules don't need to
/// depend on supabase internals.
#[derive(Debug, Serialize, Deserialize)]
pub struct ClaimSyncJobsArgs {
    pub p_limit: i64,
}
