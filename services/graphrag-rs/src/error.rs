//! Error types for GraphRAG service

use thiserror::Error;

#[derive(Debug, Error)]
pub enum GraphRAGError {
    #[error("Neo4j error: {0}")]
    Neo4j(#[from] neo4rs::Error),

    #[error("Qdrant error: {0}")]
    Qdrant(String),

    #[error("GraphDB error: {0}")]
    GraphDB(String),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Configuration error: {0}")]
    Config(String),

    #[error("Entity not found: {0}")]
    EntityNotFound(String),

    #[error("Invalid query: {0}")]
    InvalidQuery(String),

    #[error("Embeddings error: {0}")]
    Embeddings(String),

    #[error("gRPC error: {0}")]
    Grpc(#[from] tonic::Status),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl From<GraphRAGError> for tonic::Status {
    fn from(err: GraphRAGError) -> Self {
        match err {
            GraphRAGError::EntityNotFound(msg) => {
                tonic::Status::not_found(msg)
            }
            GraphRAGError::InvalidQuery(msg) => {
                tonic::Status::invalid_argument(msg)
            }
            GraphRAGError::Config(msg) => {
                tonic::Status::failed_precondition(msg)
            }
            GraphRAGError::Grpc(status) => status,
            _ => tonic::Status::internal(err.to_string()),
        }
    }
}

pub type Result<T> = std::result::Result<T, GraphRAGError>;
