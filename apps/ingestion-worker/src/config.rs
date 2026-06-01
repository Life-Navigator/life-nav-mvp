//! Runtime configuration. Read once at startup from environment variables.

use std::env;

use crate::errors::{Result, WorkerError};

#[derive(Clone, Debug)]
pub struct Config {
    pub supabase_url: String,
    pub supabase_service_role_key: String,

    pub gemini_api_key: String,
    pub gemini_embedding_model: String,

    pub qdrant_url: String,
    pub qdrant_api_key: String,
    pub qdrant_personal_collection: String,
    pub qdrant_central_collection: String,

    pub neo4j_uri: String,
    pub neo4j_username: String,
    pub neo4j_password: String,
    pub neo4j_personal_database: String,
    pub neo4j_central_database: String,

    pub worker_poll_interval_seconds: u64,
    pub worker_batch_size: usize,
    pub worker_max_retries: u32,

    pub log_level: String,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            supabase_url: required("SUPABASE_URL")?,
            supabase_service_role_key: required("SUPABASE_SERVICE_ROLE_KEY")?,

            gemini_api_key: required("GEMINI_API_KEY")?,
            gemini_embedding_model: env::var("GEMINI_EMBEDDING_MODEL")
                .unwrap_or_else(|_| "text-embedding-004".to_string()),

            qdrant_url: required("QDRANT_URL")?,
            qdrant_api_key: required("QDRANT_API_KEY")?,
            qdrant_personal_collection: env::var("QDRANT_PERSONAL_COLLECTION")
                .unwrap_or_else(|_| "life_navigator".to_string()),
            qdrant_central_collection: env::var("QDRANT_CENTRAL_COLLECTION")
                .unwrap_or_else(|_| "ln_central".to_string()),

            neo4j_uri: required("NEO4J_URI")?,
            neo4j_username: required("NEO4J_USERNAME")?,
            neo4j_password: required("NEO4J_PASSWORD")?,
            neo4j_personal_database: env::var("NEO4J_PERSONAL_DATABASE")
                .unwrap_or_else(|_| "neo4j".to_string()),
            neo4j_central_database: env::var("NEO4J_CENTRAL_DATABASE")
                .unwrap_or_else(|_| "central".to_string()),

            worker_poll_interval_seconds: parse_or(env::var("WORKER_POLL_INTERVAL_SECONDS"), 5),
            worker_batch_size: parse_or(env::var("WORKER_BATCH_SIZE"), 25),
            worker_max_retries: parse_or(env::var("WORKER_MAX_RETRIES"), 5),

            log_level: env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string()),
        })
    }
}

fn required(key: &str) -> Result<String> {
    env::var(key).map_err(|_| WorkerError::MissingEnv(key.to_string()))
}

fn parse_or<T: std::str::FromStr>(
    val: std::result::Result<String, env::VarError>,
    default: T,
) -> T {
    val.ok().and_then(|s| s.parse().ok()).unwrap_or(default)
}
