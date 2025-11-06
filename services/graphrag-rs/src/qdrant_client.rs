//! Qdrant client for vector search operations

use qdrant_client::prelude::*;
use qdrant_client::qdrant::{
    CreateCollection, Distance, VectorParams, VectorsConfig, SearchPoints, PointStruct,
    Filter, Condition, FieldCondition, Match,
};
use std::collections::HashMap;
use crate::config::QdrantConfig;
use crate::error::{GraphRAGError, Result};

#[derive(Clone)]
pub struct QdrantVectorClient {
    client: QdrantClient,
    collection_name: String,
    vector_size: usize,
}

impl QdrantVectorClient {
    /// Create new Qdrant client
    pub async fn new(config: &QdrantConfig) -> Result<Self> {
        let mut client_config = QdrantClientConfig::from_url(&config.url);

        if let Some(api_key) = &config.api_key {
            client_config = client_config.with_api_key(api_key);
        }

        let client = QdrantClient::new(Some(client_config))
            .map_err(|e| GraphRAGError::Qdrant(e.to_string()))?;

        Ok(Self {
            client,
            collection_name: config.collection_name.clone(),
            vector_size: config.vector_size,
        })
    }

    /// Create collection if it doesn't exist
    pub async fn ensure_collection(&self) -> Result<()> {
        // Check if collection exists
        let collections = self.client.list_collections().await
            .map_err(|e| GraphRAGError::Qdrant(e.to_string()))?;

        let exists = collections.collections.iter()
            .any(|c| c.name == self.collection_name);

        if !exists {
            // Create collection with cosine distance
            self.client
                .create_collection(&CreateCollection {
                    collection_name: self.collection_name.clone(),
                    vectors_config: Some(VectorsConfig {
                        config: Some(qdrant_client::qdrant::vectors_config::Config::Params(
                            VectorParams {
                                size: self.vector_size as u64,
                                distance: Distance::Cosine.into(),
                                ..Default::default()
                            },
                        )),
                    }),
                    ..Default::default()
                })
                .await
                .map_err(|e| GraphRAGError::Qdrant(e.to_string()))?;
        }

        Ok(())
    }

    /// Insert or update vectors
    pub async fn upsert_vectors(
        &self,
        points: Vec<VectorPoint>,
    ) -> Result<()> {
        let qdrant_points: Vec<PointStruct> = points
            .into_iter()
            .map(|p| PointStruct {
                id: Some(p.id.into()),
                vectors: Some(p.vector.into()),
                payload: p.payload.into_iter().collect(),
            })
            .collect();

        self.client
            .upsert_points_blocking(self.collection_name.clone(), None, qdrant_points, None)
            .await
            .map_err(|e| GraphRAGError::Qdrant(e.to_string()))?;

        Ok(())
    }

    /// Search for similar vectors
    pub async fn search(
        &self,
        query_vector: Vec<f32>,
        limit: usize,
        min_score: f32,
        filters: Option<HashMap<String, String>>,
    ) -> Result<Vec<VectorSearchResult>> {
        let mut search_request = SearchPoints {
            collection_name: self.collection_name.clone(),
            vector: query_vector,
            limit: limit as u64,
            score_threshold: Some(min_score),
            with_payload: Some(true.into()),
            ..Default::default()
        };

        // Add filters if provided
        if let Some(filter_map) = filters {
            let mut conditions = Vec::new();

            for (key, value) in filter_map {
                conditions.push(Condition::field(
                    FieldCondition::new_match(key, Match::new_keyword(value)),
                ));
            }

            if !conditions.is_empty() {
                search_request.filter = Some(Filter {
                    must: conditions,
                    ..Default::default()
                });
            }
        }

        let search_result = self.client
            .search_points(&search_request)
            .await
            .map_err(|e| GraphRAGError::Qdrant(e.to_string()))?;

        let results = search_result
            .result
            .into_iter()
            .map(|scored_point| {
                let mut metadata = HashMap::new();
                for (key, value) in scored_point.payload {
                    if let Some(kind) = value.kind {
                        metadata.insert(key, format!("{:?}", kind));
                    }
                }

                VectorSearchResult {
                    id: match scored_point.id {
                        Some(point_id) => match point_id.point_id_options {
                            Some(qdrant_client::qdrant::point_id::PointIdOptions::Uuid(uuid)) => uuid,
                            Some(qdrant_client::qdrant::point_id::PointIdOptions::Num(num)) => num.to_string(),
                            None => String::new(),
                        },
                        None => String::new(),
                    },
                    score: scored_point.score,
                    metadata,
                }
            })
            .collect();

        Ok(results)
    }

    /// Delete points by IDs
    pub async fn delete_points(&self, ids: Vec<String>) -> Result<()> {
        let point_ids: Vec<qdrant_client::qdrant::PointId> = ids
            .into_iter()
            .map(|id| id.into())
            .collect();

        self.client
            .delete_points(self.collection_name.clone(), None, &point_ids.into(), None)
            .await
            .map_err(|e| GraphRAGError::Qdrant(e.to_string()))?;

        Ok(())
    }

    /// Get collection info
    pub async fn collection_info(&self) -> Result<CollectionInfo> {
        let info = self.client
            .collection_info(&self.collection_name)
            .await
            .map_err(|e| GraphRAGError::Qdrant(e.to_string()))?;

        Ok(CollectionInfo {
            points_count: info.result.map(|r| r.points_count).unwrap_or(0),
            segments_count: info.result.map(|r| r.segments_count).unwrap_or(0),
        })
    }
}

// Domain types
#[derive(Debug, Clone)]
pub struct VectorPoint {
    pub id: String,
    pub vector: Vec<f32>,
    pub payload: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone)]
pub struct VectorSearchResult {
    pub id: String,
    pub score: f32,
    pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct CollectionInfo {
    pub points_count: u64,
    pub segments_count: usize,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires running Qdrant
    async fn test_qdrant_connection() {
        let config = crate::config::Config::default_dev();
        let client = QdrantVectorClient::new(&config.qdrant).await;
        assert!(client.is_ok());
    }

    #[tokio::test]
    #[ignore]
    async fn test_create_collection() {
        let config = crate::config::Config::default_dev();
        let client = QdrantVectorClient::new(&config.qdrant).await.unwrap();
        let result = client.ensure_collection().await;
        assert!(result.is_ok());
    }
}
