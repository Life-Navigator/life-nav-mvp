//! Qdrant HTTP client. Upserts vector points keyed by a deterministic
//! `qdrant_point_id()` so re-runs are idempotent.
//!
//! Every payload includes:
//!   tenant_id, user_id, entity_type, entity_id, domain, source_table,
//!   created_at, updated_at, access_scope (personal | central),
//!   sensitivity_level.
//!
//! Routing is encoded by which collection the client points at — the
//! worker constructs **two** clients (personal + central) at startup
//! and the processor picks per job.

use reqwest::Client as Http;
use serde::Serialize;
use serde_json::Value;

use crate::config::Config;
use crate::entities::CanonicalGraphObject;
use crate::errors::{Result, WorkerError};
use crate::queue::AccessScope;

pub struct QdrantClient {
    http: Http,
    base_url: String,
    api_key: String,
    collection: String,
    scope: AccessScope,
}

impl QdrantClient {
    /// Build the personal-collection client.
    pub fn new(cfg: &Config) -> Result<Self> {
        Self::with_scope(cfg, AccessScope::Personal)
    }

    /// Build a client bound to the collection for a specific scope.
    pub fn with_scope(cfg: &Config, scope: AccessScope) -> Result<Self> {
        let http = Http::builder()
            .gzip(true)
            .timeout(std::time::Duration::from_secs(30))
            .build()?;
        let collection = match scope {
            AccessScope::Personal => cfg.qdrant_personal_collection.clone(),
            AccessScope::Central => cfg.qdrant_central_collection.clone(),
        };
        Ok(Self {
            http,
            base_url: cfg.qdrant_url.trim_end_matches('/').to_string(),
            api_key: cfg.qdrant_api_key.clone(),
            collection,
            scope,
        })
    }

    pub fn scope(&self) -> AccessScope {
        self.scope
    }

    pub fn collection(&self) -> &str {
        &self.collection
    }

    /// Build the payload shape Qdrant stores alongside the vector. This
    /// is also called by the tenant-isolation integration test.
    pub fn build_payload(canon: &CanonicalGraphObject) -> Value {
        Self::build_payload_with_scope(canon, AccessScope::Personal)
    }

    pub fn build_payload_with_scope(canon: &CanonicalGraphObject, scope: AccessScope) -> Value {
        serde_json::json!({
            "tenant_id":         canon.tenant_id.to_string(),
            "user_id":           canon.user_id.to_string(),
            "entity_type":       canon.entity_type,
            "entity_id":         canon.entity_id,
            "domain":            canon.domain,
            "source_table":      canon.source_table,
            "created_at":        canon.created_at.to_rfc3339(),
            "updated_at":        canon.updated_at.to_rfc3339(),
            "access_scope":      scope.as_str(),
            "sensitivity_level": canon.sensitivity_level.as_str(),
            "title":             canon.title,
            "summary":           canon.summary,
        })
    }

    pub async fn upsert(&self, canon: &CanonicalGraphObject, vector: Vec<f32>) -> Result<()> {
        let url = format!(
            "{}/collections/{}/points?wait=true",
            self.base_url, self.collection
        );
        let payload = Self::build_payload_with_scope(canon, self.scope);
        let body = UpsertRequest {
            points: vec![Point {
                id: canon.qdrant_point_id(),
                vector,
                payload,
            }],
        };
        let res = self
            .http
            .put(&url)
            .header("api-key", &self.api_key)
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await?;
        if !res.status().is_success() {
            return Err(WorkerError::Qdrant(format!(
                "{}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            )));
        }
        Ok(())
    }

    pub async fn delete(&self, point_id: &str) -> Result<()> {
        let url = format!(
            "{}/collections/{}/points/delete?wait=true",
            self.base_url, self.collection
        );
        let body = serde_json::json!({ "points": [point_id] });
        let res = self
            .http
            .post(&url)
            .header("api-key", &self.api_key)
            .header("content-type", "application/json")
            .json(&body)
            .send()
            .await?;
        if !res.status().is_success() {
            return Err(WorkerError::Qdrant(format!(
                "{}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            )));
        }
        Ok(())
    }
}

#[derive(Debug, Serialize)]
struct UpsertRequest {
    points: Vec<Point>,
}
#[derive(Debug, Serialize)]
struct Point {
    id: String,
    vector: Vec<f32>,
    payload: Value,
}
