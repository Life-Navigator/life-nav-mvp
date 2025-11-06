//! GraphRAG Service - High-performance knowledge graph + vector RAG
//!
//! Combines Neo4j knowledge graph, Qdrant vector search, and GraphDB ontology
//! for hybrid retrieval-augmented generation with multi-tenant RLS support.

use tonic::transport::Server;
use tracing::{info, error};
use tracing_subscriber;

mod config;
mod error;
mod neo4j_client;
mod qdrant_client;
mod graphdb_client;
mod embeddings;
mod rag_service;
mod grpc_service;

use config::Config;
use grpc_service::{GraphRAGService, graphrag::graph_rag_server::GraphRagServer};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    info!("🚀 Starting GraphRAG service...");

    // Load configuration
    let config = Config::load().unwrap_or_else(|e| {
        error!("Failed to load config: {}, using default dev config", e);
        Config::default_dev()
    });

    info!("Configuration loaded successfully");
    info!("  Neo4j: {}", config.neo4j.uri);
    info!("  Qdrant: {}", config.qdrant.url);
    info!("  GraphDB: {}/repositories/{}", config.graphdb.url, config.graphdb.repository);
    info!("  Embeddings: {}", config.embeddings.service_url);

    // Build gRPC service
    let graphrag_service = GraphRAGService::new(&config).await?;
    info!("GraphRAG service initialized successfully");

    // Build gRPC server
    let addr = format!("{}:{}", config.server.host, config.server.port)
        .parse()?;

    info!("🎯 Starting gRPC server on {}", addr);

    Server::builder()
        .add_service(GraphRagServer::new(graphrag_service))
        .serve(addr)
        .await?;

    Ok(())
}
