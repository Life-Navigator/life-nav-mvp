//! Configuration management for GraphRAG service

use serde::{Deserialize, Serialize};
use crate::error::{GraphRAGError, Result};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub server: ServerConfig,
    pub neo4j: Neo4jConfig,
    pub qdrant: QdrantConfig,
    pub graphdb: GraphDBConfig,
    pub embeddings: EmbeddingsConfig,
    pub rag: RAGConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Neo4jConfig {
    pub uri: String,
    pub user: String,
    pub password: String,
    #[serde(default = "default_neo4j_database")]
    pub database: String,
    #[serde(default = "default_max_connections")]
    pub max_connections: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QdrantConfig {
    pub url: String,
    #[serde(default)]
    pub api_key: Option<String>,
    #[serde(default = "default_collection_name")]
    pub collection_name: String,
    #[serde(default = "default_vector_size")]
    pub vector_size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphDBConfig {
    pub url: String,
    #[serde(default = "default_graphdb_repository")]
    pub repository: String,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmbeddingsConfig {
    pub service_url: String,
    #[serde(default = "default_embedding_model")]
    pub model: String,
    #[serde(default = "default_vector_size")]
    pub dimension: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RAGConfig {
    #[serde(default = "default_max_results")]
    pub max_results: usize,
    #[serde(default = "default_min_score")]
    pub min_similarity_score: f32,
    #[serde(default = "default_semantic_weight")]
    pub semantic_weight: f32,
    #[serde(default = "default_vector_weight")]
    pub vector_weight: f32,
}

// Default functions
fn default_host() -> String {
    "0.0.0.0".to_string()
}

fn default_port() -> u16 {
    50051
}

fn default_neo4j_database() -> String {
    "neo4j".to_string()
}

fn default_max_connections() -> usize {
    10
}

fn default_collection_name() -> String {
    "life_navigator".to_string()
}

fn default_vector_size() -> usize {
    384  // Default for sentence transformers
}

fn default_graphdb_repository() -> String {
    "life-navigator".to_string()
}

fn default_embedding_model() -> String {
    "all-MiniLM-L6-v2".to_string()
}

fn default_max_results() -> usize {
    10
}

fn default_min_score() -> f32 {
    0.5
}

fn default_semantic_weight() -> f32 {
    0.6
}

fn default_vector_weight() -> f32 {
    0.4
}

impl Config {
    /// Load configuration from environment and config file
    pub fn load() -> Result<Self> {
        // Load from environment variables first
        dotenv::dotenv().ok();

        let config = config::Config::builder()
            .add_source(config::Environment::with_prefix("GRAPHRAG"))
            .build()
            .map_err(|e| GraphRAGError::Config(e.to_string()))?;

        config
            .try_deserialize()
            .map_err(|e| GraphRAGError::Config(e.to_string()))
    }

    /// Create default configuration for development
    pub fn default_dev() -> Self {
        Self {
            server: ServerConfig {
                host: "0.0.0.0".to_string(),
                port: 50051,
            },
            neo4j: Neo4jConfig {
                uri: "bolt://localhost:7687".to_string(),
                user: "neo4j".to_string(),
                password: "password".to_string(),
                database: "neo4j".to_string(),
                max_connections: 10,
            },
            qdrant: QdrantConfig {
                url: "http://localhost:6333".to_string(),
                api_key: None,
                collection_name: "life_navigator".to_string(),
                vector_size: 384,
            },
            graphdb: GraphDBConfig {
                url: "http://localhost:7200".to_string(),
                repository: "life-navigator".to_string(),
                username: None,
                password: None,
            },
            embeddings: EmbeddingsConfig {
                service_url: "http://localhost:8090".to_string(),  // Maverick
                model: "all-MiniLM-L6-v2".to_string(),
                dimension: 384,
            },
            rag: RAGConfig {
                max_results: 10,
                min_similarity_score: 0.5,
                semantic_weight: 0.6,
                vector_weight: 0.4,
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default_dev();
        assert_eq!(config.server.port, 50051);
        assert_eq!(config.neo4j.database, "neo4j");
        assert_eq!(config.qdrant.vector_size, 384);
    }
}
