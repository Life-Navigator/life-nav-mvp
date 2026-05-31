//! Qdrant HTTP client. Upserts vector points keyed by a deterministic
//! `qdrant_point_id()` so re-runs are idempotent.
//!
//! Every payload includes:
//!   tenant_id, user_id, entity_type, entity_id, domain, source_table,
//!   created_at, updated_at, access_scope='personal', sensitivity_level.

use reqwest::Client as Http;
use serde::Serialize;
use serde_json::Value;

use crate::config::Config;
use crate::entities::CanonicalGraphObject;
use crate::errors::{Result, WorkerError};

pub struct QdrantClient {
    http: Http,
    base_url: String,
    api_key: String,
    collection: String,
}

impl QdrantClient {
    pub fn new(cfg: &Config) -> Result<Self> {
        let http = Http::builder()
            .gzip(true)
            .timeout(std::time::Duration::from_secs(30))
            .build()?;
        Ok(Self {
            http,
            base_url: cfg.qdrant_url.trim_end_matches('/').to_string(),
            api_key: cfg.qdrant_api_key.clone(),
            collection: cfg.qdrant_personal_collection.clone(),
        })
    }

    /// Build the payload shape Qdrant stores alongside the vector. This
    /// is also called by the tenant-isolation integration test.
    pub fn build_payload(canon: &CanonicalGraphObject) -> Value {
        serde_json::json!({
            "tenant_id":         canon.tenant_id.to_string(),
            "user_id":           canon.user_id.to_string(),
            "entity_type":       canon.entity_type,
            "entity_id":         canon.entity_id,
            "domain":            canon.domain,
            "source_table":      canon.source_table,
            "created_at":        canon.created_at.to_rfc3339(),
            "updated_at":        canon.updated_at.to_rfc3339(),
            "access_scope":      "personal",
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
        let payload = Self::build_payload(canon);
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
