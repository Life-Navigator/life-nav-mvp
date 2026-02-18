//! Orchestrator - L0 Agent
//!
//! Top-level agent that analyzes intent and routes to domain managers

use crate::agent_core::*;
use crate::maverick_client::{MaverickClient, ChatMessage, CompletionRequest};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use chrono::Utc;

/// Intent patterns for routing
const INTENT_PATTERNS: &[(&str, Domain, &[&str])] = &[
    // Finance domain
    ("budget", Domain::Finance, &["budget", "spend", "expense", "money", "cost"]),
    ("investment", Domain::Finance, &["invest", "stock", "portfolio", "dividend", "crypto"]),
    ("savings", Domain::Finance, &["save", "saving", "emergency fund"]),
    ("debt", Domain::Finance, &["debt", "loan", "credit", "payoff", "owe"]),
    ("tax", Domain::Finance, &["tax", "deduction", "filing", "return"]),

    // Career domain
    ("job_search", Domain::Career, &["job", "career", "work", "employment", "hire"]),
    ("resume", Domain::Career, &["resume", "cv", "application"]),
    ("interview", Domain::Career, &["interview", "prepare", "questions"]),

    // Health domain
    ("fitness", Domain::Health, &["fitness", "exercise", "workout", "gym"]),
    ("nutrition", Domain::Health, &["nutrition", "diet", "food", "meal"]),
    ("medical", Domain::Health, &["medical", "doctor", "health", "symptom"]),

    // Education domain
    ("learning", Domain::Education, &["learn", "study", "course", "education"]),
    ("certification", Domain::Education, &["certification", "certificate", "credential"]),

    // Goals domain
    ("goal_setting", Domain::Goals, &["goal", "objective", "target", "achieve"]),
    ("tracking", Domain::Goals, &["track", "progress", "milestone"]),
];

/// Orchestrator - L0 strategic planning agent
pub struct Orchestrator {
    config: AgentConfig,
    llm: Arc<MaverickClient>,
    domain_managers: Arc<RwLock<HashMap<Domain, Arc<dyn Agent>>>>,
    metrics: Arc<RwLock<AgentMetrics>>,
}

impl Orchestrator {
    pub fn new(llm: Arc<MaverickClient>) -> Self {
        let config = AgentConfig {
            agent_type: AgentType::Orchestrator,
            name: "Orchestrator".to_string(),
            description: "Top-level agent for intent analysis and routing".to_string(),
            system_prompt: Some(
                "You are an intelligent routing assistant. Analyze user requests and determine \
                the appropriate domain and task type. Be concise and precise.".to_string()
            ),
            max_concurrent_tasks: 100,
            timeout_seconds: 60.0,
            retry_attempts: 2,
            temperature: 0.3, // Lower temperature for more consistent routing
            max_tokens: 200,
            ..Default::default()
        };

        Self {
            config,
            llm,
            domain_managers: Arc::new(RwLock::new(HashMap::new())),
            metrics: Arc::new(RwLock::new(AgentMetrics::default())),
        }
    }

    /// Register a domain manager
    pub async fn register_domain_manager(&self, domain: Domain, manager: Arc<dyn Agent>) {
        let mut managers = self.domain_managers.write().await;
        managers.insert(domain, manager);
    }

    /// Route to appropriate domain manager
    async fn route_to_domain(&self, intent: &Intent, task: AgentTask) -> Result<AgentResult, AgentError> {
        let managers = self.domain_managers.read().await;

        match managers.get(&intent.domain) {
            Some(manager) => manager.execute(task).await,
            None => {
                // Fallback to general domain
                match managers.get(&Domain::General) {
                    Some(general) => general.execute(task).await,
                    None => Err(AgentError::NoAgentFound(format!(
                        "No domain manager found for {:?}",
                        intent.domain
                    ))),
                }
            }
        }
    }
}

#[async_trait]
impl Agent for Orchestrator {
    async fn execute(&self, task: AgentTask) -> Result<AgentResult, AgentError> {
        let start = std::time::Instant::now();
        let mut reasoning_steps = Vec::new();

        // Step 1: Analyze intent
        reasoning_steps.push(ReasoningStep {
            step: 1,
            description: "Analyzing user intent".to_string(),
            action: "intent_analysis".to_string(),
            result: None,
            timestamp: Utc::now(),
        });

        let intent = self.analyze_intent(&task.input_text).await?;

        reasoning_steps.push(ReasoningStep {
            step: 2,
            description: format!("Identified domain: {:?}", intent.domain),
            action: "domain_routing".to_string(),
            result: Some(format!("Domain: {:?}, Confidence: {:.2}", intent.domain, intent.confidence)),
            timestamp: Utc::now(),
        });

        // Step 2: Route to domain manager
        reasoning_steps.push(ReasoningStep {
            step: 3,
            description: "Routing to domain manager".to_string(),
            action: "execute_subdomain".to_string(),
            result: None,
            timestamp: Utc::now(),
        });

        let mut result = self.route_to_domain(&intent, task.clone()).await?;

        // Add orchestrator's reasoning steps
        result.reasoning_steps.splice(0..0, reasoning_steps);

        // Update metrics
        let duration = start.elapsed().as_millis() as u64;
        result.duration_ms += duration;

        let mut metrics = self.metrics.write().await;
        metrics.update(&result);

        Ok(result)
    }

    async fn analyze_intent(&self, input: &str) -> Result<Intent, AgentError> {
        let input_lower = input.to_lowercase();

        // Pattern matching for fast routing
        for (intent_name, domain, keywords) in INTENT_PATTERNS {
            for keyword in *keywords {
                if input_lower.contains(keyword) {
                    return Ok(Intent {
                        domain: *domain,
                        task_type: intent_name.to_string(),
                        confidence: 0.8,
                    });
                }
            }
        }

        // Fallback: Use LLM for intent analysis
        let prompt = format!(
            "Analyze this user request and identify the domain:\n\n\
            User: {}\n\n\
            Domains: finance, career, health, education, goals, general\n\n\
            Respond with just the domain name.",
            input
        );

        let request = CompletionRequest {
            prompt,
            n_predict: 20,
            temperature: 0.3,
            ..Default::default()
        };

        let response = self.llm.completion(request).await
            .map_err(|e| AgentError::IntentError(e.to_string()))?;

        let domain_str = response.content.trim().to_lowercase();
        let domain = match domain_str.as_str() {
            "finance" => Domain::Finance,
            "career" => Domain::Career,
            "health" => Domain::Health,
            "education" => Domain::Education,
            "goals" => Domain::Goals,
            _ => Domain::General,
        };

        Ok(Intent {
            domain,
            task_type: "general_query".to_string(),
            confidence: 0.6,
        })
    }

    fn capabilities(&self) -> Vec<Capability> {
        vec![
            Capability {
                name: "intent_analysis".to_string(),
                description: "Analyze user intent and determine domain".to_string(),
                parameters: HashMap::new(),
                confidence: 0.95,
            },
            Capability {
                name: "task_routing".to_string(),
                description: "Route tasks to appropriate domain managers".to_string(),
                parameters: HashMap::new(),
                confidence: 0.98,
            },
        ]
    }

    fn config(&self) -> &AgentConfig {
        &self.config
    }

    fn can_handle(&self, _task_type: &str) -> bool {
        true // Orchestrator can handle all task types
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_intent_analysis_finance() {
        let llm = Arc::new(MaverickClient::new(None));
        let orchestrator = Orchestrator::new(llm);

        let intent = orchestrator.analyze_intent("What's my budget for this month?").await.unwrap();
        assert_eq!(intent.domain, Domain::Finance);
    }

    #[tokio::test]
    async fn test_intent_analysis_career() {
        let llm = Arc::new(MaverickClient::new(None));
        let orchestrator = Orchestrator::new(llm);

        let intent = orchestrator.analyze_intent("Help me find a job").await.unwrap();
        assert_eq!(intent.domain, Domain::Career);
    }
}
