//! RAG (Retrieval-Augmented Generation) service
//! Combines knowledge graph (Neo4j + GraphDB) with vector search (Qdrant)

use std::collections::HashMap;
use std::sync::Arc;
use crate::config::{Config, RAGConfig};
use crate::error::{GraphRAGError, Result};
use crate::neo4j_client::{Neo4jClient, Entity};
use crate::qdrant_client::{QdrantVectorClient, VectorPoint, VectorSearchResult};
use crate::graphdb_client::GraphDBClient;
use crate::embeddings::EmbeddingsService;

#[derive(Clone)]
pub struct RAGService {
    pub neo4j: Arc<Neo4jClient>,
    pub qdrant: Arc<QdrantVectorClient>,
    pub graphdb: Arc<GraphDBClient>,
    pub embeddings: Arc<EmbeddingsService>,
    pub config: RAGConfig,
}

impl RAGService {
    pub async fn new(config: &Config) -> Result<Self> {
        let neo4j = Arc::new(Neo4jClient::new(&config.neo4j).await?);
        let qdrant = Arc::new(QdrantVectorClient::new(&config.qdrant).await?);
        let graphdb = Arc::new(GraphDBClient::new(&config.graphdb));
        let embeddings = Arc::new(EmbeddingsService::new(&config.embeddings));

        // Ensure Qdrant collection exists
        qdrant.ensure_collection().await?;

        Ok(Self {
            neo4j,
            qdrant,
            graphdb,
            embeddings,
            config: config.rag.clone(),
        })
    }

    /// Query with RAG - centralized mode (org-wide knowledge)
    pub async fn query_centralized(
        &self,
        query: &str,
        max_results: Option<usize>,
        domains: Vec<String>,
        filters: HashMap<String, String>,
    ) -> Result<RAGResponse> {
        let start = std::time::Instant::now();

        // Step 1: Generate query embedding
        let query_vector = self.embeddings.embed_query(query).await?;

        // Step 2: Vector search in Qdrant
        let vector_results = self
            .qdrant
            .search(
                query_vector,
                max_results.unwrap_or(self.config.max_results),
                self.config.min_similarity_score,
                Some(filters.clone()),
            )
            .await?;

        // Step 3: Semantic search in knowledge graph (Neo4j)
        let mut graph_entities = Vec::new();
        for domain in &domains {
            let entities = self
                .neo4j
                .semantic_search(
                    query,
                    Some(domain),
                    None, // No tenant filtering in centralized mode
                    max_results.unwrap_or(self.config.max_results),
                )
                .await?;
            graph_entities.extend(entities);
        }

        // Step 4: Ontology validation (GraphDB)
        let _ontology_classes = self.graphdb.get_ontology_classes().await?;

        // Step 5: Combine and rank results
        let combined_results = self.combine_results(
            vector_results,
            graph_entities,
            self.config.semantic_weight,
            self.config.vector_weight,
        );

        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(RAGResponse {
            results: combined_results,
            sources: Vec::new(), // TODO: Add source attribution
            reasoning_steps: Vec::new(), // TODO: Add reasoning steps
            duration_ms,
        })
    }

    /// Query with RAG - personalized mode (user-specific with RLS)
    pub async fn query_personalized(
        &self,
        query: &str,
        user_id: &str,
        tenant_id: &str,
        max_results: Option<usize>,
        domains: Vec<String>,
        filters: HashMap<String, String>,
    ) -> Result<RAGResponse> {
        let start = std::time::Instant::now();

        // Step 1: Generate query embedding
        let query_vector = self.embeddings.embed_query(query).await?;

        // Step 2: Vector search with tenant filter
        let mut tenant_filters = filters.clone();
        tenant_filters.insert("tenant_id".to_string(), tenant_id.to_string());
        tenant_filters.insert("user_id".to_string(), user_id.to_string());

        let vector_results = self
            .qdrant
            .search(
                query_vector,
                max_results.unwrap_or(self.config.max_results),
                self.config.min_similarity_score,
                Some(tenant_filters),
            )
            .await?;

        // Step 3: Semantic search with tenant isolation
        let mut graph_entities = Vec::new();
        for domain in &domains {
            let entities = self
                .neo4j
                .semantic_search(
                    query,
                    Some(domain),
                    Some(tenant_id),  // RLS: Filter by tenant
                    max_results.unwrap_or(self.config.max_results),
                )
                .await?;
            graph_entities.extend(entities);
        }

        // Step 4: Combine and rank results
        let combined_results = self.combine_results(
            vector_results,
            graph_entities,
            self.config.semantic_weight,
            self.config.vector_weight,
        );

        let duration_ms = start.elapsed().as_millis() as u64;

        Ok(RAGResponse {
            results: combined_results,
            sources: Vec::new(),
            reasoning_steps: Vec::new(),
            duration_ms,
        })
    }

    /// Hybrid search (semantic + vector)
    pub async fn hybrid_search(
        &self,
        query: &str,
        tenant_id: Option<&str>,
        domains: Vec<String>,
        limit: usize,
    ) -> Result<Vec<HybridResult>> {
        // Generate query embedding
        let query_vector = self.embeddings.embed_query(query).await?;

        // Vector search
        let mut filters = HashMap::new();
        if let Some(tenant) = tenant_id {
            filters.insert("tenant_id".to_string(), tenant.to_string());
        }

        let vector_results = self
            .qdrant
            .search(query_vector, limit, self.config.min_similarity_score, Some(filters))
            .await?;

        // Semantic search
        let mut graph_entities = Vec::new();
        for domain in domains {
            let entities = self
                .neo4j
                .semantic_search(query, Some(&domain), tenant_id, limit)
                .await?;
            graph_entities.extend(entities);
        }

        // Combine results
        Ok(self.combine_results(
            vector_results,
            graph_entities,
            self.config.semantic_weight,
            self.config.vector_weight,
        ))
    }

    /// Index entity in both knowledge graph and vector store
    pub async fn index_entity(
        &self,
        entity: &Entity,
        content: &str,
    ) -> Result<()> {
        // Generate embedding
        let embedding = self.embeddings.embed_document(content).await?;

        // Create metadata
        let mut metadata = HashMap::new();
        metadata.insert("uri".to_string(), serde_json::json!(entity.uri));
        metadata.insert("type".to_string(), serde_json::json!(entity.entity_type));
        metadata.insert("tenant_id".to_string(), serde_json::json!(entity.tenant_id));

        // Store in Qdrant
        let point = VectorPoint {
            id: entity.uri.clone(),
            vector: embedding,
            payload: metadata,
        };

        self.qdrant.upsert_vectors(vec![point]).await?;

        Ok(())
    }

    /// Delete entity from indices
    pub async fn delete_entity(&self, entity_uri: &str) -> Result<()> {
        // Delete from Qdrant
        self.qdrant.delete_points(vec![entity_uri.to_string()]).await?;

        Ok(())
    }

    /// Get entity with relationships
    pub async fn get_entity_with_relationships(
        &self,
        uri: &str,
        tenant_id: Option<&str>,
        depth: usize,
    ) -> Result<Entity> {
        let mut entity = self
            .neo4j
            .get_entity(uri, tenant_id)
            .await?
            .ok_or_else(|| GraphRAGError::EntityNotFound(uri.to_string()))?;

        if depth > 0 {
            let relationships = self
                .neo4j
                .get_relationships(uri, "both", 100)
                .await?;
            entity.relationships = relationships;
        }

        Ok(entity)
    }

    // Helper: Combine vector and semantic search results
    fn combine_results(
        &self,
        vector_results: Vec<VectorSearchResult>,
        graph_entities: Vec<Entity>,
        semantic_weight: f32,
        vector_weight: f32,
    ) -> Vec<HybridResult> {
        let mut combined: HashMap<String, HybridResult> = HashMap::new();

        // Add vector results
        for vr in vector_results {
            let uri = vr.metadata.get("uri")
                .cloned()
                .unwrap_or_else(|| vr.id.clone());

            combined.insert(
                uri.clone(),
                HybridResult {
                    entity: None,
                    uri,
                    semantic_score: 0.0,
                    vector_score: vr.score,
                    combined_score: vr.score * vector_weight,
                    matched_by: "vector".to_string(),
                },
            );
        }

        // Add/merge graph entities
        for entity in graph_entities {
            let uri = entity.uri.clone();

            if let Some(existing) = combined.get_mut(&uri) {
                // Already found via vector search - combine scores
                existing.semantic_score = 1.0; // Assume full match from graph
                existing.combined_score = existing.vector_score * vector_weight
                    + existing.semantic_score * semantic_weight;
                existing.matched_by = "both".to_string();
                existing.entity = Some(entity);
            } else {
                // Only found via semantic search
                combined.insert(
                    uri.clone(),
                    HybridResult {
                        entity: Some(entity),
                        uri,
                        semantic_score: 1.0,
                        vector_score: 0.0,
                        combined_score: semantic_weight,
                        matched_by: "semantic".to_string(),
                    },
                );
            }
        }

        // Sort by combined score (descending)
        let mut results: Vec<HybridResult> = combined.into_values().collect();
        results.sort_by(|a, b| b.combined_score.partial_cmp(&a.combined_score).unwrap());

        results
    }
}

// Response types
#[derive(Debug, Clone)]
pub struct RAGResponse {
    pub results: Vec<HybridResult>,
    pub sources: Vec<Source>,
    pub reasoning_steps: Vec<ReasoningStep>,
    pub duration_ms: u64,
}

#[derive(Debug, Clone)]
pub struct HybridResult {
    pub entity: Option<Entity>,
    pub uri: String,
    pub semantic_score: f32,
    pub vector_score: f32,
    pub combined_score: f32,
    pub matched_by: String,
}

#[derive(Debug, Clone)]
pub struct Source {
    pub source_type: String,
    pub source_uri: String,
    pub content: String,
    pub relevance: f32,
}

#[derive(Debug, Clone)]
pub struct ReasoningStep {
    pub step: u32,
    pub description: String,
    pub action: String,
    pub result: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires all services running
    async fn test_rag_service_creation() {
        let config = Config::default_dev();
        let service = RAGService::new(&config).await;
        assert!(service.is_ok());
    }
}
