//! GraphRAG Service Library
//!
//! High-performance Rust implementation of hybrid knowledge graph + vector RAG

pub mod config;
pub mod error;
pub mod neo4j_client;
pub mod qdrant_client;
pub mod graphdb_client;
pub mod embeddings;
pub mod rag_service;
pub mod grpc_service;

pub use config::Config;
pub use error::{GraphRAGError, Result};
pub use rag_service::RAGService;
