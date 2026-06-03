//! Gemini embedding client. Calls
//! `https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent`
//! and returns a `Vec<f32>` of `EMBEDDING_DIMENSION` floats.

use std::time::Duration;

use reqwest::Client as Http;
use serde::{Deserialize, Serialize};

use crate::config::Config;
use crate::errors::{Result, WorkerError};

pub const EMBEDDING_DIMENSION: usize = 768;

// Transient Gemini statuses worth retrying: rate limit (429), provider
// overload (503), internal (500). Auth (401/403), validation (400), and
// safety blocks (HTTP 200 + blockReason) are NOT retried.
const GEMINI_RETRY_STATUSES: [u16; 3] = [429, 500, 503];
const GEMINI_MAX_RETRIES: u32 = 2;
const GEMINI_BACKOFF_MS: [u64; 2] = [500, 1500];

fn is_transient(status: u16) -> bool {
    GEMINI_RETRY_STATUSES.contains(&status)
}

/// Backoff for a 0-based retry attempt. `jitter` is capped at base/2, giving
/// +0..50% jitter. Clamps to the last entry past the schedule's end.
fn backoff_delay(attempt: u32, jitter: u64) -> Duration {
    let base = GEMINI_BACKOFF_MS[(attempt as usize).min(GEMINI_BACKOFF_MS.len() - 1)];
    Duration::from_millis(base + jitter.min(base / 2))
}

/// Cheap jitter in `[0, span)` derived from the clock — avoids a rand crate.
fn jitter_ms(span: u64) -> u64 {
    if span == 0 {
        return 0;
    }
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos() as u64)
        .unwrap_or(0);
    nanos % span
}

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
        // Retry transient provider errors (429/500/503) with exponential
        // backoff + jitter (max 2 retries: ~500ms, then ~1500ms).
        let mut attempt: u32 = 0;
        let res = loop {
            let res = self.http.post(&url).json(&body).send().await?;
            let status = res.status().as_u16();
            if res.status().is_success()
                || !is_transient(status)
                || attempt >= GEMINI_MAX_RETRIES
            {
                break res;
            }
            let base = GEMINI_BACKOFF_MS[(attempt as usize).min(GEMINI_BACKOFF_MS.len() - 1)];
            let delay = backoff_delay(attempt, jitter_ms(base / 2));
            // Log status/attempt only — never the prompt, payload, or key.
            tracing::warn!(
                label = "embed",
                status,
                attempt = attempt + 1,
                max_retries = GEMINI_MAX_RETRIES,
                delay_ms = delay.as_millis() as u64,
                "gemini transient error; retrying"
            );
            tokio::time::sleep(delay).await;
            attempt += 1;
        };
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_transient_statuses_retry() {
        for s in [429u16, 500, 503] {
            assert!(is_transient(s), "{s} should be transient");
        }
        for s in [200u16, 400, 401, 403, 404] {
            assert!(!is_transient(s), "{s} should NOT be transient");
        }
    }

    #[test]
    fn backoff_schedule_matches_spec() {
        assert_eq!(backoff_delay(0, 0).as_millis(), 500); // retry 1
        assert_eq!(backoff_delay(1, 0).as_millis(), 1500); // retry 2
        assert_eq!(backoff_delay(9, 0).as_millis(), 1500); // clamps to last
    }

    #[test]
    fn jitter_is_capped_at_half_base() {
        assert_eq!(backoff_delay(0, 9_999).as_millis(), 500 + 250);
        assert_eq!(backoff_delay(1, 9_999).as_millis(), 1500 + 750);
    }

    #[test]
    fn jitter_within_bounds() {
        for _ in 0..200 {
            assert!(jitter_ms(250) < 250);
        }
        assert_eq!(jitter_ms(0), 0);
    }
}
