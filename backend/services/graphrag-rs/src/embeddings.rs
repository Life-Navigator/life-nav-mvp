//! Embeddings service for text vectorization

use reqwest::Client;
use serde::{Deserialize, Serialize};
use crate::config::EmbeddingsConfig;
use crate::error::{GraphRAGError, Result};

#[derive(Clone)]
pub struct EmbeddingsService {
    client: Client,
    service_url: String,
    model: String,
}

impl EmbeddingsService {
    pub fn new(config: &EmbeddingsConfig) -> Self {
        Self {
            client: Client::new(),
            service_url: config.service_url.clone(),
            model: config.model.clone(),
        }
    }

    /// Generate embedding for a single text
    pub async fn embed_text(&self, text: &str) -> Result<Vec<f32>> {
        let embeddings = self.embed_batch(vec![text.to_string()]).await?;
        embeddings.into_iter().next()
            .ok_or_else(|| GraphRAGError::Embeddings("No embedding returned".to_string()))
    }

    /// Generate embeddings for multiple texts (batch processing)
    pub async fn embed_batch(&self, texts: Vec<String>) -> Result<Vec<Vec<f32>>> {
        // Try Maverick-compatible endpoint first (llama.cpp embedding endpoint)
        let url = format!("{}/embedding", self.service_url);

        let mut embeddings = Vec::new();

        for text in texts {
            let request = EmbeddingRequest {
                content: text,
            };

            let response = self
                .client
                .post(&url)
                .json(&request)
                .send()
                .await?;

            if !response.status().is_success() {
                return Err(GraphRAGError::Embeddings(format!(
                    "Embedding request failed: {}",
                    response.status()
                )));
            }

            let result: EmbeddingResponse = response.json().await?;
            embeddings.push(result.embedding);
        }

        Ok(embeddings)
    }

    /// Generate embedding for query (with optional prefix for asymmetric models)
    pub async fn embed_query(&self, query: &str) -> Result<Vec<f32>> {
        // For some models, queries benefit from a prefix like "query: "
        // For now, just use the text as-is
        self.embed_text(query).await
    }

    /// Generate embedding for document (with optional prefix)
    pub async fn embed_document(&self, document: &str) -> Result<Vec<f32>> {
        // For some models, documents benefit from a prefix like "passage: "
        self.embed_text(document).await
    }

    /// Calculate cosine similarity between two embeddings
    pub fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
        if a.len() != b.len() {
            return 0.0;
        }

        let dot_product: f32 = a.iter().zip(b.iter()).map(|(x, y)| x * y).sum();
        let magnitude_a: f32 = a.iter().map(|x| x * x).sum::<f32>().sqrt();
        let magnitude_b: f32 = b.iter().map(|x| x * x).sum::<f32>().sqrt();

        if magnitude_a == 0.0 || magnitude_b == 0.0 {
            return 0.0;
        }

        dot_product / (magnitude_a * magnitude_b)
    }
}

// Request/Response types for Maverick embedding endpoint
#[derive(Debug, Serialize)]
struct EmbeddingRequest {
    content: String,
}

#[derive(Debug, Deserialize)]
struct EmbeddingResponse {
    embedding: Vec<f32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cosine_similarity() {
        let vec1 = vec![1.0, 0.0, 0.0];
        let vec2 = vec![1.0, 0.0, 0.0];
        let vec3 = vec![0.0, 1.0, 0.0];

        assert!((EmbeddingsService::cosine_similarity(&vec1, &vec2) - 1.0).abs() < 0.001);
        assert!((EmbeddingsService::cosine_similarity(&vec1, &vec3) - 0.0).abs() < 0.001);
    }

    #[test]
    fn test_cosine_similarity_different_lengths() {
        let vec1 = vec![1.0, 0.0];
        let vec2 = vec![1.0, 0.0, 0.0];

        assert_eq!(EmbeddingsService::cosine_similarity(&vec1, &vec2), 0.0);
    }

    #[tokio::test]
    #[ignore] // Requires running Maverick
    async fn test_embed_text() {
        let config = crate::config::Config::default_dev();
        let service = EmbeddingsService::new(&config.embeddings);

        let result = service.embed_text("Hello world").await;
        assert!(result.is_ok());

        if let Ok(embedding) = result {
            assert!(!embedding.is_empty());
            assert_eq!(embedding.len(), config.embeddings.dimension);
        }
    }
}
