//! Gemini embedding client. Calls
//! `https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent`
//! and returns a `Vec<f32>` of `EMBEDDING_DIMENSION` floats.

use reqwest::Client as Http;
use serde::{Deserialize, Serialize};

use crate::config::Config;
use crate::errors::{Result, WorkerError};

pub const EMBEDDING_DIMENSION: usize = 768;

pub struct GeminiClient {
    http: Http,
    api_key: String,
    model: String,
}

impl GeminiClient {
    pub fn new(cfg: &Config) -> Result<Self> {
        let http = Http::builder()
            .gzip(true)
            .timeout(std::time::Duration::from_secs(30))
            .build()?;
        Ok(Self {
            http,
            api_key: cfg.gemini_api_key.clone(),
            model: cfg.gemini_embedding_model.clone(),
        })
    }

    /// Embed `text`. Returns a 768-dim vector. Empty `text` returns an
    /// error rather than an all-zero vector.
    pub async fn embed(&self, text: &str) -> Result<Vec<f32>> {
        if text.trim().is_empty() {
            return Err(WorkerError::Gemini("refused to embed empty text".into()));
        }
        let url = format!(
            "https://generativelanguage.googleapis.com/v1beta/models/{}:embedContent?key={}",
            self.model, self.api_key
        );
        let body = EmbedRequest {
            content: EmbedContent {
                parts: vec![EmbedPart {
                    text: text.to_string(),
                }],
            },
        };
        let res = self.http.post(&url).json(&body).send().await?;
        if !res.status().is_success() {
            return Err(WorkerError::Gemini(format!(
                "{}: {}",
                res.status(),
                res.text().await.unwrap_or_default()
            )));
        }
        let resp: EmbedResponse = res.json().await?;
        Ok(resp.embedding.values)
    }
}

#[derive(Debug, Serialize)]
struct EmbedRequest {
    content: EmbedContent,
}
#[derive(Debug, Serialize)]
struct EmbedContent {
    parts: Vec<EmbedPart>,
}
#[derive(Debug, Serialize)]
struct EmbedPart {
    text: String,
}
#[derive(Debug, Deserialize)]
struct EmbedResponse {
    embedding: EmbedValues,
}
#[derive(Debug, Deserialize)]
struct EmbedValues {
    values: Vec<f32>,
}
