//! Core agent types, traits, and enums
//!
//! Defines the foundation for the hierarchical agent system with
//! 4 levels: Orchestrator -> Domain Manager -> Specialist -> Tool User

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use async_trait::async_trait;
use uuid::Uuid;
use chrono::{DateTime, Utc};

/// Agent hierarchy levels
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AgentType {
    /// L0 - Strategic planning and routing
    Orchestrator,
    /// L1 - Domain coordination
    DomainManager,
    /// L2 - Task execution
    Specialist,
    /// L3 - External API calls
    ToolUser,
}

/// Agent execution state
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AgentState {
    Idle,
    Processing,
    Completed,
    Error,
    Shutdown,
}

/// Task execution status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum TaskStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Domain categories
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Domain {
    Finance,
    Career,
    Health,
    Education,
    Goals,
    General,
}

/// Intent patterns for routing
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Intent {
    pub domain: Domain,
    pub task_type: String,
    pub confidence: f64,
}

/// Agent capability descriptor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Capability {
    pub name: String,
    pub description: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub confidence: f64,
}

/// Agent task input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTask {
    pub id: Uuid,
    pub user_id: Uuid,
    pub tenant_id: String,
    pub task_type: String,
    pub input_text: String,
    pub context: Option<HashMap<String, serde_json::Value>>,
    pub created_at: DateTime<Utc>,
}

impl AgentTask {
    pub fn new(user_id: Uuid, tenant_id: String, task_type: String, input_text: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            user_id,
            tenant_id,
            task_type,
            input_text,
            context: None,
            created_at: Utc::now(),
        }
    }

    pub fn with_context(mut self, context: HashMap<String, serde_json::Value>) -> Self {
        self.context = Some(context);
        self
    }
}

/// Agent task result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResult {
    pub task_id: Uuid,
    pub status: TaskStatus,
    pub result: Option<String>,
    pub error_message: Option<String>,
    pub reasoning_steps: Vec<ReasoningStep>,
    pub confidence_score: f64,
    pub sources: Vec<Source>,
    pub tokens_used: u32,
    pub duration_ms: u64,
    pub completed_at: DateTime<Utc>,
}

/// Reasoning step for explainability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningStep {
    pub step: u32,
    pub description: String,
    pub action: String,
    pub result: Option<String>,
    pub timestamp: DateTime<Utc>,
}

/// Data source attribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Source {
    pub source_type: String,
    pub source_id: String,
    pub relevance: f64,
    pub content: Option<String>,
}

/// Agent configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub agent_id: Uuid,
    pub agent_type: AgentType,
    pub name: String,
    pub description: String,
    pub system_prompt: Option<String>,
    pub capabilities: Vec<Capability>,
    pub max_concurrent_tasks: usize,
    pub timeout_seconds: f64,
    pub retry_attempts: u32,
    pub temperature: f64,
    pub max_tokens: u32,
}

impl Default for AgentConfig {
    fn default() -> Self {
        Self {
            agent_id: Uuid::new_v4(),
            agent_type: AgentType::Specialist,
            name: "Default Agent".to_string(),
            description: "A default agent".to_string(),
            system_prompt: None,
            capabilities: Vec::new(),
            max_concurrent_tasks: 5,
            timeout_seconds: 30.0,
            retry_attempts: 3,
            temperature: 0.7,
            max_tokens: 500,
        }
    }
}

/// Core Agent trait - all agents must implement this
#[async_trait]
pub trait Agent: Send + Sync {
    /// Execute a task and return a result
    async fn execute(&self, task: AgentTask) -> Result<AgentResult, AgentError>;

    /// Analyze input and determine intent
    async fn analyze_intent(&self, input: &str) -> Result<Intent, AgentError>;

    /// Get agent capabilities
    fn capabilities(&self) -> Vec<Capability>;

    /// Get agent configuration
    fn config(&self) -> &AgentConfig;

    /// Get agent type
    fn agent_type(&self) -> AgentType {
        self.config().agent_type
    }

    /// Check if agent can handle a task
    fn can_handle(&self, task_type: &str) -> bool;
}

/// Agent execution error types
#[derive(Debug, thiserror::Error)]
pub enum AgentError {
    #[error("Task execution failed: {0}")]
    ExecutionError(String),

    #[error("Task timeout after {0}s")]
    Timeout(f64),

    #[error("Intent analysis failed: {0}")]
    IntentError(String),

    #[error("No suitable agent found for task: {0}")]
    NoAgentFound(String),

    #[error("LLM error: {0}")]
    LLMError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Invalid configuration: {0}")]
    ConfigError(String),

    #[error("Context retrieval error: {0}")]
    ContextError(String),

    #[error("Unknown error: {0}")]
    Unknown(String),
}

impl From<reqwest::Error> for AgentError {
    fn from(err: reqwest::Error) -> Self {
        AgentError::NetworkError(err.to_string())
    }
}

impl From<serde_json::Error> for AgentError {
    fn from(err: serde_json::Error) -> Self {
        AgentError::Unknown(err.to_string())
    }
}

/// Agent metrics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMetrics {
    pub agent_id: Uuid,
    pub total_tasks: u64,
    pub successful_tasks: u64,
    pub failed_tasks: u64,
    pub average_duration_ms: f64,
    pub average_tokens: f64,
    pub total_tokens: u64,
    pub last_active_at: Option<DateTime<Utc>>,
}

impl Default for AgentMetrics {
    fn default() -> Self {
        Self {
            agent_id: Uuid::new_v4(),
            total_tasks: 0,
            successful_tasks: 0,
            failed_tasks: 0,
            average_duration_ms: 0.0,
            average_tokens: 0.0,
            total_tokens: 0,
            last_active_at: None,
        }
    }
}

impl AgentMetrics {
    pub fn update(&mut self, result: &AgentResult) {
        self.total_tasks += 1;
        match result.status {
            TaskStatus::Completed => self.successful_tasks += 1,
            TaskStatus::Failed => self.failed_tasks += 1,
            _ => {}
        }

        // Update averages
        let n = self.total_tasks as f64;
        self.average_duration_ms =
            (self.average_duration_ms * (n - 1.0) + result.duration_ms as f64) / n;
        self.average_tokens =
            (self.average_tokens * (n - 1.0) + result.tokens_used as f64) / n;
        self.total_tokens += result.tokens_used as u64;
        self.last_active_at = Some(Utc::now());
    }

    pub fn success_rate(&self) -> f64 {
        if self.total_tasks == 0 {
            0.0
        } else {
            self.successful_tasks as f64 / self.total_tasks as f64
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_agent_task_creation() {
        let task = AgentTask::new(
            Uuid::new_v4(),
            "tenant_123".to_string(),
            "budget_analysis".to_string(),
            "What's my spending this month?".to_string(),
        );

        assert_eq!(task.task_type, "budget_analysis");
        assert!(task.context.is_none());
    }

    #[test]
    fn test_agent_metrics() {
        let mut metrics = AgentMetrics::default();

        let result = AgentResult {
            task_id: Uuid::new_v4(),
            status: TaskStatus::Completed,
            result: Some("Success".to_string()),
            error_message: None,
            reasoning_steps: vec![],
            confidence_score: 0.95,
            sources: vec![],
            tokens_used: 100,
            duration_ms: 500,
            completed_at: Utc::now(),
        };

        metrics.update(&result);

        assert_eq!(metrics.total_tasks, 1);
        assert_eq!(metrics.successful_tasks, 1);
        assert_eq!(metrics.success_rate(), 1.0);
        assert_eq!(metrics.average_tokens, 100.0);
    }
}
