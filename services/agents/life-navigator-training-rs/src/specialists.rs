//! Specialist Agents - L2 Agents
//!
//! Domain-specific task execution agents

use crate::agent_core::*;
use crate::maverick_client::MaverickClient;
use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::Utc;

/// Generic Specialist Agent
pub struct SpecialistAgent {
    config: AgentConfig,
    llm: Arc<MaverickClient>,
    metrics: Arc<RwLock<AgentMetrics>>,
}

impl SpecialistAgent {
    pub fn new(
        name: String,
        description: String,
        system_prompt: String,
        llm: Arc<MaverickClient>,
    ) -> Self {
        let config = AgentConfig {
            agent_type: AgentType::Specialist,
            name,
            description,
            system_prompt: Some(system_prompt),
            max_concurrent_tasks: 10,
            timeout_seconds: 30.0,
            retry_attempts: 3,
            temperature: 0.7,
            max_tokens: 800,
            ..Default::default()
        };

        Self {
            config,
            llm,
            metrics: Arc::new(RwLock::new(AgentMetrics::default())),
        }
    }

    /// Create a budget specialist
    pub fn budget_specialist(llm: Arc<MaverickClient>) -> Self {
        Self::new(
            "Budget Specialist".to_string(),
            "Analyzes spending, creates budgets, and provides financial recommendations".to_string(),
            "You are a budget and spending analysis expert. Help users understand their spending \
            patterns, create budgets, and provide actionable recommendations to improve their \
            financial health. Be specific with numbers and percentages.".to_string(),
            llm,
        )
    }

    /// Create an investment specialist
    pub fn investment_specialist(llm: Arc<MaverickClient>) -> Self {
        Self::new(
            "Investment Specialist".to_string(),
            "Provides investment advice, portfolio analysis, and market insights".to_string(),
            "You are an investment and portfolio management expert. Help users make informed \
            investment decisions, analyze portfolios, and understand market trends. Always \
            include risk disclaimers.".to_string(),
            llm,
        )
    }

    /// Create a job search specialist
    pub fn job_search_specialist(llm: Arc<MaverickClient>) -> Self {
        Self::new(
            "Job Search Specialist".to_string(),
            "Assists with job search strategies, applications, and career planning".to_string(),
            "You are a job search and career planning expert. Help users find relevant job \
            opportunities, improve their job search strategy, and provide actionable career advice.".to_string(),
            llm,
        )
    }

    /// Create a resume specialist
    pub fn resume_specialist(llm: Arc<MaverickClient>) -> Self {
        Self::new(
            "Resume Specialist".to_string(),
            "Optimizes resumes, cover letters, and professional profiles".to_string(),
            "You are a resume and professional branding expert. Help users create compelling \
            resumes, cover letters, and LinkedIn profiles that highlight their strengths and \
            achievements.".to_string(),
            llm,
        )
    }
}

#[async_trait]
impl Agent for SpecialistAgent {
    async fn execute(&self, task: AgentTask) -> Result<AgentResult, AgentError> {
        use crate::maverick_client::ChatMessage;

        let start = std::time::Instant::now();
        let mut reasoning_steps = Vec::new();

        // Step 1: Prepare request
        reasoning_steps.push(ReasoningStep {
            step: 1,
            description: format!("Executing {} task", self.config.name),
            action: "task_preparation".to_string(),
            result: None,
            timestamp: Utc::now(),
        });

        // Step 2: Call LLM
        reasoning_steps.push(ReasoningStep {
            step: 2,
            description: "Generating response with LLM".to_string(),
            action: "llm_inference".to_string(),
            result: None,
            timestamp: Utc::now(),
        });

        let messages = vec![ChatMessage {
            role: "user".to_string(),
            content: task.input_text.clone(),
        }];

        let response = self.llm.chat(
            messages,
            self.config.system_prompt.clone(),
            self.config.temperature,
            self.config.max_tokens,
        ).await.map_err(|e| AgentError::LLMError(e.to_string()))?;

        reasoning_steps.push(ReasoningStep {
            step: 3,
            description: "Response generated successfully".to_string(),
            action: "completion".to_string(),
            result: Some(format!("Generated {} tokens", response.tokens_predicted)),
            timestamp: Utc::now(),
        });

        let duration = start.elapsed().as_millis() as u64;

        let result = AgentResult {
            task_id: task.id,
            status: TaskStatus::Completed,
            result: Some(response.content),
            error_message: None,
            reasoning_steps,
            confidence_score: 0.85,
            sources: vec![
                Source {
                    source_type: "llm".to_string(),
                    source_id: "maverick".to_string(),
                    relevance: 1.0,
                    content: None,
                },
            ],
            tokens_used: response.tokens_predicted,
            duration_ms: duration,
            completed_at: Utc::now(),
        };

        // Update metrics
        let mut metrics = self.metrics.write().await;
        metrics.update(&result);

        Ok(result)
    }

    async fn analyze_intent(&self, _input: &str) -> Result<Intent, AgentError> {
        // Specialists don't analyze intent, they execute
        Err(AgentError::IntentError("Specialists don't analyze intent".to_string()))
    }

    fn capabilities(&self) -> Vec<Capability> {
        vec![
            Capability {
                name: "task_execution".to_string(),
                description: format!("{} task execution", self.config.name),
                parameters: std::collections::HashMap::new(),
                confidence: 0.85,
            },
        ]
    }

    fn config(&self) -> &AgentConfig {
        &self.config
    }

    fn can_handle(&self, _task_type: &str) -> bool {
        true // Specialists handle tasks routed to them
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_budget_specialist_creation() {
        let llm = Arc::new(MaverickClient::new(None));
        let specialist = SpecialistAgent::budget_specialist(llm);
        assert_eq!(specialist.config.name, "Budget Specialist");
        assert_eq!(specialist.config.agent_type, AgentType::Specialist);
    }

    #[test]
    fn test_job_search_specialist_creation() {
        let llm = Arc::new(MaverickClient::new(None));
        let specialist = SpecialistAgent::job_search_specialist(llm);
        assert_eq!(specialist.config.name, "Job Search Specialist");
    }
}
