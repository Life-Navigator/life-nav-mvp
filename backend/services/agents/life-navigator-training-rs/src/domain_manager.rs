//! Domain Managers - L1 Agents
//!
//! Coordinate specialists within a domain (Finance, Career, etc.)

use crate::agent_core::*;
use crate::maverick_client::MaverickClient;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::Utc;

/// Specialist routing patterns for Finance domain
const FINANCE_SPECIALIST_ROUTING: &[(&str, &[&str])] = &[
    ("budget", &["budget", "spending", "expense", "monthly"]),
    ("investment", &["invest", "stock", "portfolio", "trade", "dividend"]),
    ("savings", &["save", "saving", "emergency", "rainy day"]),
    ("debt", &["debt", "loan", "payoff", "owe", "credit card"]),
    ("tax", &["tax", "deduction", "filing", "return", "irs"]),
];

/// Specialist routing patterns for Career domain
const CAREER_SPECIALIST_ROUTING: &[(&str, &[&str])] = &[
    ("job_search", &["job", "position", "opening", "apply", "hire"]),
    ("resume", &["resume", "cv", "application", "cover letter"]),
    ("interview", &["interview", "prepare", "questions", "behavioral"]),
    ("skills", &["skill", "learn", "training", "certification"]),
];

/// Domain Manager - coordinates specialists within a domain
pub struct DomainManager {
    config: AgentConfig,
    domain: Domain,
    llm: Arc<MaverickClient>,
    specialists: Arc<RwLock<HashMap<String, Arc<dyn Agent>>>>,
    metrics: Arc<RwLock<AgentMetrics>>,
}

impl DomainManager {
    pub fn new(domain: Domain, llm: Arc<MaverickClient>) -> Self {
        let (name, description, system_prompt) = match domain {
            Domain::Finance => (
                "Finance Manager",
                "Coordinates financial specialists for budgeting, investing, savings, debt, and taxes",
                "You are a financial management assistant. Route tasks to appropriate specialists \
                based on the financial domain: budgeting, investments, savings, debt, or taxes."
            ),
            Domain::Career => (
                "Career Manager",
                "Coordinates career specialists for job search, resume, and interview prep",
                "You are a career development assistant. Route tasks to appropriate specialists \
                based on the career domain: job search, resume optimization, or interview preparation."
            ),
            Domain::Health => (
                "Health Manager",
                "Coordinates health specialists for fitness, nutrition, and medical queries",
                "You are a health management assistant. Route tasks to appropriate specialists \
                based on the health domain: fitness, nutrition, or medical queries."
            ),
            Domain::Education => (
                "Education Manager",
                "Coordinates education specialists for learning and certifications",
                "You are an education management assistant. Route tasks to appropriate specialists \
                based on the educational domain: learning resources or certifications."
            ),
            Domain::Goals => (
                "Goals Manager",
                "Coordinates goal-setting and tracking specialists",
                "You are a goal management assistant. Route tasks to appropriate specialists \
                based on goal-related activities: setting, tracking, or achievement."
            ),
            Domain::General => (
                "General Manager",
                "Handles general queries that don't fit specific domains",
                "You are a general-purpose assistant. Handle queries that don't fit specific domains."
            ),
        };

        let config = AgentConfig {
            agent_type: AgentType::DomainManager,
            name: name.to_string(),
            description: description.to_string(),
            system_prompt: Some(system_prompt.to_string()),
            max_concurrent_tasks: 20,
            timeout_seconds: 45.0,
            retry_attempts: 3,
            temperature: 0.5,
            max_tokens: 1000,
            ..Default::default()
        };

        Self {
            config,
            domain,
            llm,
            specialists: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(AgentMetrics::default())),
        }
    }

    /// Register a specialist agent
    pub async fn register_specialist(&self, task_type: String, specialist: Arc<dyn Agent>) {
        let mut specialists = self.specialists.write().await;
        specialists.insert(task_type, specialist);
    }

    /// Route to appropriate specialist
    async fn route_to_specialist(&self, task_type: &str, task: AgentTask) -> Result<AgentResult, AgentError> {
        let specialists = self.specialists.read().await;

        match specialists.get(task_type) {
            Some(specialist) => specialist.execute(task).await,
            None => {
                // Fallback: execute with LLM directly
                self.execute_with_llm(task).await
            }
        }
    }

    /// Determine specialist type from input
    fn determine_specialist(&self, input: &str) -> String {
        let input_lower = input.to_lowercase();

        let routing_patterns = match self.domain {
            Domain::Finance => FINANCE_SPECIALIST_ROUTING,
            Domain::Career => CAREER_SPECIALIST_ROUTING,
            _ => &[],
        };

        for (specialist_type, keywords) in routing_patterns {
            for keyword in *keywords {
                if input_lower.contains(keyword) {
                    return specialist_type.to_string();
                }
            }
        }

        // Default specialist type
        "general".to_string()
    }

    /// Execute task directly with LLM (fallback)
    async fn execute_with_llm(&self, task: AgentTask) -> Result<AgentResult, AgentError> {
        use crate::maverick_client::{ChatMessage, CompletionRequest};

        let start = std::time::Instant::now();
        let mut reasoning_steps = Vec::new();

        reasoning_steps.push(ReasoningStep {
            step: 1,
            description: "No specialist found, executing with LLM directly".to_string(),
            action: "llm_execution".to_string(),
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
            step: 2,
            description: "Generated response with LLM".to_string(),
            action: "completion".to_string(),
            result: Some(format!("Tokens: {}", response.tokens_predicted)),
            timestamp: Utc::now(),
        });

        let duration = start.elapsed().as_millis() as u64;

        Ok(AgentResult {
            task_id: task.id,
            status: TaskStatus::Completed,
            result: Some(response.content),
            error_message: None,
            reasoning_steps,
            confidence_score: 0.7,
            sources: vec![],
            tokens_used: response.tokens_predicted,
            duration_ms: duration,
            completed_at: Utc::now(),
        })
    }
}

#[async_trait]
impl Agent for DomainManager {
    async fn execute(&self, task: AgentTask) -> Result<AgentResult, AgentError> {
        let start = std::time::Instant::now();
        let mut reasoning_steps = Vec::new();

        // Step 1: Determine specialist
        reasoning_steps.push(ReasoningStep {
            step: 1,
            description: format!("Analyzing task for {:?} domain", self.domain),
            action: "specialist_analysis".to_string(),
            result: None,
            timestamp: Utc::now(),
        });

        let specialist_type = self.determine_specialist(&task.input_text);

        reasoning_steps.push(ReasoningStep {
            step: 2,
            description: format!("Routing to {} specialist", specialist_type),
            action: "specialist_routing".to_string(),
            result: Some(specialist_type.clone()),
            timestamp: Utc::now(),
        });

        // Step 2: Route to specialist
        let mut result = self.route_to_specialist(&specialist_type, task).await?;

        // Add domain manager's reasoning steps
        result.reasoning_steps.splice(0..0, reasoning_steps);

        // Update duration
        let duration = start.elapsed().as_millis() as u64;
        result.duration_ms += duration;

        // Update metrics
        let mut metrics = self.metrics.write().await;
        metrics.update(&result);

        Ok(result)
    }

    async fn analyze_intent(&self, input: &str) -> Result<Intent, AgentError> {
        let specialist_type = self.determine_specialist(input);

        Ok(Intent {
            domain: self.domain,
            task_type: specialist_type,
            confidence: 0.75,
        })
    }

    fn capabilities(&self) -> Vec<Capability> {
        vec![
            Capability {
                name: "specialist_routing".to_string(),
                description: format!("Route tasks to {} specialists", format!("{:?}", self.domain).to_lowercase()),
                parameters: HashMap::new(),
                confidence: 0.9,
            },
        ]
    }

    fn config(&self) -> &AgentConfig {
        &self.config
    }

    fn can_handle(&self, task_type: &str) -> bool {
        // Domain managers can attempt to handle any task in their domain
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_determine_specialist_finance() {
        let llm = Arc::new(MaverickClient::new(None));
        let manager = DomainManager::new(Domain::Finance, llm);

        assert_eq!(manager.determine_specialist("What's my budget?"), "budget");
        assert_eq!(manager.determine_specialist("Should I invest in stocks?"), "investment");
        assert_eq!(manager.determine_specialist("How to pay off debt?"), "debt");
    }

    #[test]
    fn test_determine_specialist_career() {
        let llm = Arc::new(MaverickClient::new(None));
        let manager = DomainManager::new(Domain::Career, llm);

        assert_eq!(manager.determine_specialist("Help me find a job"), "job_search");
        assert_eq!(manager.determine_specialist("Optimize my resume"), "resume");
    }
}
