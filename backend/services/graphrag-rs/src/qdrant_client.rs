//! Qdrant client for vector search operations

use qdrant_client::Qdrant;
use qdrant_client::qdrant::{
    Distance, VectorParams, PointStruct,
    Filter, Condition, FieldCondition, Match,
};
use std::collections::HashMap;
use std::sync::Arc;
use crate::config::QdrantConfig;
use crate::error::{GraphRAGError, Result};

#[derive(Clone)]
pub struct QdrantVectorClient {
    client: Arc<Qdrant>,
    collection_name: String,
    vector_size: usize,
}

impl QdrantVectorClient {
    /// Create new Qdrant client
    pub async fn new(config: &QdrantConfig) -> Result<Self> {
        let mut builder = Qdrant::from_url(&config.url);

        if let Some(api_key) = &config.api_key {
            builder = builder.api_key(api_key.clone());
        }

        let client = builder.build()
            .map_err(|e| GraphRAGError::Qdrant(e.to_string()))?;

        Ok(Self {
            client: Arc::new(client),
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
            // Create collection with cosine distance using builder API
            self.client
                .create_collection(
                    qdrant_client::qdrant::CreateCollectionBuilder::new(&self.collection_name)
                        .vectors_config(VectorParams {
                            size: self.vector_size as u64,
                            distance: Distance::Cosine.into(),
                            ..Default::default()
                        })
                )
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
            .map(|p| {
                // Convert serde_json::Value to qdrant::Value
                let mut payload = HashMap::new();
                for (key, value) in p.payload {
                    let qdrant_value = match value {
                        serde_json::Value::String(s) => qdrant_client::qdrant::Value {
                            kind: Some(qdrant_client::qdrant::value::Kind::StringValue(s)),
                        },
                        serde_json::Value::Number(n) if n.is_i64() => qdrant_client::qdrant::Value {
                            kind: Some(qdrant_client::qdrant::value::Kind::IntegerValue(n.as_i64().unwrap())),
                        },
                        serde_json::Value::Number(n) if n.is_f64() => qdrant_client::qdrant::Value {
                            kind: Some(qdrant_client::qdrant::value::Kind::DoubleValue(n.as_f64().unwrap())),
                        },
                        serde_json::Value::Bool(b) => qdrant_client::qdrant::Value {
                            kind: Some(qdrant_client::qdrant::value::Kind::BoolValue(b)),
                        },
                        _ => qdrant_client::qdrant::Value {
                            kind: Some(qdrant_client::qdrant::value::Kind::StringValue(value.to_string())),
                        },
                    };
                    payload.insert(key, qdrant_value);
                }

                PointStruct {
                    id: Some(p.id.into()),
                    vectors: Some(p.vector.into()),
                    payload,
                }
            })
            .collect();

        self.client
            .upsert_points(
                qdrant_client::qdrant::UpsertPointsBuilder::new(&self.collection_name, qdrant_points)
            )
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
        let mut search_builder = qdrant_client::qdrant::SearchPointsBuilder::new(
            &self.collection_name,
            query_vector,
            limit as u64,
        )
        .score_threshold(min_score)
        .with_payload(true);

        // Add filters if provided
        if let Some(filter_map) = filters {
            let mut conditions = Vec::new();

            for (key, value) in filter_map {
                conditions.push(Condition {
                    condition_one_of: Some(qdrant_client::qdrant::condition::ConditionOneOf::Field(
                        FieldCondition {
                            key,
                            r#match: Some(Match {
                                match_value: Some(qdrant_client::qdrant::r#match::MatchValue::Keyword(value)),
                            }),
                            ..Default::default()
                        },
                    )),
                });
            }

            if !conditions.is_empty() {
                search_builder = search_builder.filter(Filter {
                    must: conditions,
                    ..Default::default()
                });
            }
        }

        let search_result = self.client
            .search_points(search_builder)
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
            .delete_points(
                qdrant_client::qdrant::DeletePointsBuilder::new(&self.collection_name)
                    .points(point_ids)
            )
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

        let (points_count, segments_count) = match info.result {
            Some(result) => (
                result.points_count.unwrap_or(0),
                result.segments_count as usize,
            ),
            None => (0, 0),
        };

        Ok(CollectionInfo {
            points_count,
            segments_count,
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
