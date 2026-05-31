//! Worker error type. Every fallible function returns `Result<T>`.

use thiserror::Error;

pub type Result<T> = std::result::Result<T, WorkerError>;

#[derive(Debug, Error)]
pub enum WorkerError {
    #[error("missing required env var: {0}")]
    MissingEnv(String),

    #[error("supabase request failed: {0}")]
    Supabase(String),

    #[error("gemini request failed: {0}")]
    Gemini(String),

    #[error("qdrant request failed: {0}")]
    Qdrant(String),

    #[error("neo4j request failed: {0}")]
    Neo4j(String),

    #[error("normalizer error for entity_type={entity_type}: {reason}")]
    Normalizer { entity_type: String, reason: String },

    #[error("http transport error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("config error: {0}")]
    Config(String),

    #[error("other: {0}")]
    Other(String),
}
