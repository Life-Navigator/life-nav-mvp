//! gRPC service implementation for GraphRAG

use tonic::{Request, Response, Status};
use std::sync::Arc;
use std::collections::HashMap;

use crate::rag_service::RAGService;
use crate::config::Config;

// Include generated proto code
pub mod graphrag {
    tonic::include_proto!("graphrag.v1");
}

use graphrag::graph_rag_server::GraphRag;
use graphrag::*;

pub struct GraphRAGService {
    rag: Arc<RAGService>,
}

impl GraphRAGService {
    pub async fn new(config: &Config) -> Result<Self, Box<dyn std::error::Error>> {
        let rag = Arc::new(RAGService::new(config).await?);
        Ok(Self { rag })
    }
}

#[tonic::async_trait]
impl GraphRag for GraphRAGService {
    async fn query_centralized(
        &self,
        request: Request<QueryRequest>,
    ) -> Result<Response<QueryResponse>, Status> {
        let req = request.into_inner();

        let filters: HashMap<String, String> = req.filters.into_iter().collect();

        let result = self
            .rag
            .query_centralized(
                &req.query,
                if req.max_results > 0 {
                    Some(req.max_results as usize)
                } else {
                    None
                },
                req.domains,
                filters,
            )
            .await
            .map_err(|e| Status::internal(e.to_string()))?;

        let response = QueryResponse {
            answer: "Generated answer placeholder".to_string(), // TODO: Integrate LLM for generation
            sources: result
                .sources
                .into_iter()
                .map(|s| Source {
                    source_type: s.source_type,
                    source_uri: s.source_uri,
                    content: s.content,
                    relevance: s.relevance as f64,
                    metadata: HashMap::new(),
                })
                .collect(),
            reasoning: result
                .reasoning_steps
                .into_iter()
                .map(|r| ReasoningStep {
                    step: r.step as i32,
                    description: r.description,
                    action: r.action,
                    result: r.result,
                })
                .collect(),
            confidence: 0.85, // TODO: Calculate actual confidence
            entities: result
                .results
                .into_iter()
                .filter_map(|r| r.entity)
                .map(convert_entity_to_proto)
                .collect(),
            duration_ms: result.duration_ms as i64,
        };

        Ok(Response::new(response))
    }

    async fn query_personalized(
        &self,
        request: Request<PersonalizedQueryRequest>,
    ) -> Result<Response<QueryResponse>, Status> {
        let req = request.into_inner();

        let filters: HashMap<String, String> = req.filters.into_iter().collect();

        let result = self
            .rag
            .query_personalized(
                &req.query,
                &req.user_id,
                &req.tenant_id,
                if req.max_results > 0 {
                    Some(req.max_results as usize)
                } else {
                    None
                },
                req.domains,
                filters,
            )
            .await
            .map_err(|e| Status::internal(e.to_string()))?;

        let response = QueryResponse {
            answer: "Generated answer placeholder".to_string(),
            sources: Vec::new(),
            reasoning: Vec::new(),
            confidence: 0.85,
            entities: result
                .results
                .into_iter()
                .filter_map(|r| r.entity)
                .map(convert_entity_to_proto)
                .collect(),
            duration_ms: result.duration_ms as i64,
        };

        Ok(Response::new(response))
    }

    async fn semantic_search(
        &self,
        request: Request<SemanticSearchRequest>,
    ) -> Result<Response<SemanticSearchResponse>, Status> {
        let req = request.into_inner();

        let entities = self
            .rag
            .neo4j
            .semantic_search(
                &req.query,
                if req.entity_type.is_empty() {
                    None
                } else {
                    Some(&req.entity_type)
                },
                if req.tenant_id.is_empty() {
                    None
                } else {
                    Some(&req.tenant_id)
                },
                req.limit as usize,
            )
            .await
            .map_err(|e| Status::internal(e.to_string()))?;

        let response = SemanticSearchResponse {
            entities: entities.into_iter().map(convert_entity_to_proto).collect(),
            total_count: 0, // TODO: Add total count
            duration_ms: 0,
        };

        Ok(Response::new(response))
    }

    async fn vector_search(
        &self,
        request: Request<VectorSearchRequest>,
    ) -> Result<Response<VectorSearchResponse>, Status> {
        let req = request.into_inner();

        let query_vector = if !req.query_vector.is_empty() {
            req.query_vector
        } else if !req.query_text.is_empty() {
            self.rag
                .embeddings
                .embed_query(&req.query_text)
                .await
                .map_err(|e| Status::internal(e.to_string()))?
        } else {
            return Err(Status::invalid_argument(
                "Either query_vector or query_text must be provided",
            ));
        };

        let filters: HashMap<String, String> = req.filters.into_iter().collect();

        let results = self
            .rag
            .qdrant
            .search(
                query_vector,
                req.limit as usize,
                req.min_score as f32,
                Some(filters),
            )
            .await
            .map_err(|e| Status::internal(e.to_string()))?;

        let response = VectorSearchResponse {
            results: results
                .into_iter()
                .map(|r| VectorResult {
                    id: r.id,
                    score: r.score as f64,
                    content: r.metadata.get("content").cloned().unwrap_or_default(),
                    metadata: r.metadata,
                    vector: Vec::new(), // Don't return vectors by default
                })
                .collect(),
            duration_ms: 0,
        };

        Ok(Response::new(response))
    }

    async fn hybrid_search(
        &self,
        request: Request<HybridSearchRequest>,
    ) -> Result<Response<HybridSearchResponse>, Status> {
        let req = request.into_inner();

        let tenant_id = if req.tenant_id.is_empty() {
            None
        } else {
            Some(req.tenant_id.as_str())
        };

        let results = self
            .rag
            .hybrid_search(&req.query, tenant_id, req.domains, req.limit as usize)
            .await
            .map_err(|e| Status::internal(e.to_string()))?;

        let response = HybridSearchResponse {
            results: results
                .into_iter()
                .map(|r| HybridResult {
                    entity: r.entity.map(convert_entity_to_proto),
                    semantic_score: r.semantic_score as f64,
                    vector_score: r.vector_score as f64,
                    combined_score: r.combined_score as f64,
                    matched_by: r.matched_by,
                })
                .collect(),
            duration_ms: 0,
        };

        Ok(Response::new(response))
    }

    async fn get_entity(
        &self,
        request: Request<GetEntityRequest>,
    ) -> Result<Response<Entity>, Status> {
        let req = request.into_inner();

        let entity = self
            .rag
            .get_entity_with_relationships(
                &req.uri,
                None,
                req.relationship_depth as usize,
            )
            .await
            .map_err(|e| Status::not_found(e.to_string()))?;

        Ok(Response::new(convert_entity_to_proto(entity)))
    }

    async fn get_relationships(
        &self,
        request: Request<GetRelationshipsRequest>,
    ) -> Result<Response<RelationshipsResponse>, Status> {
        let req = request.into_inner();

        let relationships = self
            .rag
            .neo4j
            .get_relationships(&req.entity_uri, &req.direction, req.limit as usize)
            .await
            .map_err(|e| Status::internal(e.to_string()))?;

        let response = RelationshipsResponse {
            relationships: relationships
                .into_iter()
                .map(|r| Relationship {
                    predicate: r.predicate,
                    subject_uri: r.subject_uri,
                    object_uri: r.object_uri,
                    object: r.object.map(convert_entity_to_proto),
                })
                .collect(),
            total_count: 0,
        };

        Ok(Response::new(response))
    }

    async fn stream_entities(
        &self,
        _request: Request<StreamEntitiesRequest>,
    ) -> Result<Response<Self::StreamEntitiesStream>, Status> {
        Err(Status::unimplemented("Stream entities not yet implemented"))
    }

    type StreamEntitiesStream = tokio_stream::wrappers::ReceiverStream<Result<Entity, Status>>;

    async fn health_check(
        &self,
        _request: Request<HealthCheckRequest>,
    ) -> Result<Response<HealthCheckResponse>, Status> {
        let mut services = HashMap::new();
        services.insert("neo4j".to_string(), "healthy".to_string());
        services.insert("qdrant".to_string(), "healthy".to_string());
        services.insert("graphdb".to_string(), "healthy".to_string());

        let response = HealthCheckResponse {
            status: "healthy".to_string(),
            services,
            version: env!("CARGO_PKG_VERSION").to_string(),
        };

        Ok(Response::new(response))
    }
}

// Helper function to convert domain Entity to proto Entity
fn convert_entity_to_proto(entity: crate::neo4j_client::Entity) -> Entity {
    Entity {
        uri: entity.uri,
        r#type: entity.entity_type,
        label: entity.label,
        properties: entity.properties,
        relationships: entity
            .relationships
            .into_iter()
            .map(|r| Relationship {
                predicate: r.predicate,
                subject_uri: r.subject_uri,
                object_uri: r.object_uri,
                object: r.object.map(convert_entity_to_proto),
            })
            .collect(),
        tenant_id: entity.tenant_id,
        created_at: entity.created_at,
        updated_at: entity.updated_at,
    }
}
