//! Maverick LLM Client - Rust interface to locally-hosted Llama-4
//!
//! High-performance async client for llama.cpp server

use serde::{Deserialize, Serialize};
use reqwest::Client;
use std::time::Duration;

/// Maverick completion request
#[derive(Debug, Clone, Serialize)]
pub struct CompletionRequest {
    pub prompt: String,
    pub n_predict: u32,
    pub temperature: f64,
    pub top_p: f64,
    pub top_k: u32,
    pub stop: Vec<String>,
    pub stream: bool,
}

impl Default for CompletionRequest {
    fn default() -> Self {
        Self {
            prompt: String::new(),
            n_predict: 500,
            temperature: 0.7,
            top_p: 0.9,
            top_k: 40,
            stop: vec!["\nUser:".to_string(), "\n\n".to_string()],
            stream: false,
        }
    }
}

/// Maverick completion response
#[derive(Debug, Clone, Deserialize)]
pub struct CompletionResponse {
    pub content: String,
    pub tokens_predicted: u32,
    pub tokens_evaluated: u32,
    pub truncated: bool,
    pub stopped_eos: bool,
    pub stopped_word: bool,
    pub stopped_limit: bool,
    pub stopping_word: Option<String>,
}

/// Chat message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// Chat response
#[derive(Debug, Clone)]
pub struct ChatResponse {
    pub content: String,
    pub tokens_predicted: u32,
    pub role: String,
    pub finish_reason: String,
}

/// Maverick LLM Client
#[derive(Clone)]
pub struct MaverickClient {
    client: Client,
    base_url: String,
}

impl MaverickClient {
    /// Create a new Maverick client
    pub fn new(base_url: Option<String>) -> Self {
        let base_url = base_url.unwrap_or_else(|| "http://localhost:8090".to_string());

        let client = Client::builder()
            .timeout(Duration::from_secs(60))
            .build()
            .expect("Failed to create HTTP client");

        Self { client, base_url }
    }

    /// Request completion from Maverick
    pub async fn completion(&self, request: CompletionRequest) -> Result<CompletionResponse, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/completion", self.base_url);

        let response = self
            .client
            .post(&url)
            .json(&request)
            .send()
            .await?;

        if !response.status().is_success() {
            return Err(format!("Maverick error: {}", response.status()).into());
        }

        let result: CompletionResponse = response.json().await?;
        Ok(result)
    }

    /// Chat with Maverick using message history
    pub async fn chat(
        &self,
        messages: Vec<ChatMessage>,
        system_prompt: Option<String>,
        temperature: f64,
        max_tokens: u32,
    ) -> Result<ChatResponse, Box<dyn std::error::Error + Send + Sync>> {
        // Build prompt from messages
        let mut prompt_parts = Vec::new();

        if let Some(system) = system_prompt {
            prompt_parts.push(format!("System: {}\n", system));
        }

        for msg in messages {
            let role = capitalize_first(&msg.role);
            prompt_parts.push(format!("{}: {}", role, msg.content));
        }

        prompt_parts.push("Assistant:".to_string());
        let full_prompt = prompt_parts.join("\n\n");

        // Call completion
        let request = CompletionRequest {
            prompt: full_prompt,
            n_predict: max_tokens,
            temperature,
            top_p: 0.9,
            top_k: 40,
            stop: vec!["\nUser:".to_string(), "\nSystem:".to_string(), "\n\n".to_string()],
            stream: false,
        };

        let response = self.completion(request).await?;

        // Format as chat response
        let finish_reason = if response.stopped_word || response.stopped_eos {
            "stop"
        } else {
            "length"
        };

        Ok(ChatResponse {
            content: response.content.trim().to_string(),
            tokens_predicted: response.tokens_predicted,
            role: "assistant".to_string(),
            finish_reason: finish_reason.to_string(),
        })
    }

    /// Health check
    pub async fn health_check(&self) -> bool {
        let url = format!("{}/health", self.base_url);

        match self.client.get(&url).timeout(Duration::from_secs(5)).send().await {
            Ok(response) => response.status().is_success(),
            Err(_) => false,
        }
    }

    /// Get model info
    pub async fn model_info(&self) -> Result<serde_json::Value, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!("{}/props", self.base_url);

        let response = self.client.get(&url).send().await?;

        if !response.status().is_success() {
            return Ok(serde_json::json!({
                "model": "maverick",
                "context_length": 4096,
                "status": "unknown"
            }));
        }

        let info = response.json().await?;
        Ok(info)
    }
}

fn capitalize_first(s: &str) -> String {
    let mut chars = s.chars();
    match chars.next() {
        None => String::new(),
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_completion_request_default() {
        let request = CompletionRequest::default();
        assert_eq!(request.n_predict, 500);
        assert_eq!(request.temperature, 0.7);
        assert!(!request.stream);
    }

    #[test]
    fn test_chat_message() {
        let msg = ChatMessage {
            role: "user".to_string(),
            content: "Hello".to_string(),
        };
        assert_eq!(msg.role, "user");
    }

    #[test]
    fn test_capitalize_first() {
        assert_eq!(capitalize_first("user"), "User");
        assert_eq!(capitalize_first("assistant"), "Assistant");
        assert_eq!(capitalize_first(""), "");
    }
}
