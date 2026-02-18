//! PyO3 bindings for Python FFI
//!
//! Exposes Rust agent framework to Python with zero-copy where possible

use pyo3::prelude::*;
use pyo3::exceptions::PyRuntimeError;
use pyo3::types::{PyDict, PyList};
use std::sync::Arc;
use std::collections::HashMap;
use tokio::runtime::Runtime;

use crate::agent_core::*;
use crate::maverick_client::MaverickClient;
use crate::orchestrator::Orchestrator;
use crate::domain_manager::DomainManager;
use crate::specialists::SpecialistAgent;

/// Python wrapper for AgentTask
#[pyclass]
#[derive(Clone)]
pub struct PyAgentTask {
    inner: AgentTask,
}

#[pymethods]
impl PyAgentTask {
    #[new]
    fn new(
        user_id: String,
        tenant_id: String,
        task_type: String,
        input_text: String,
        context: Option<&PyDict>,
    ) -> PyResult<Self> {
        let user_uuid = uuid::Uuid::parse_str(&user_id)
            .map_err(|e| PyRuntimeError::new_err(format!("Invalid user_id UUID: {}", e)))?;

        let mut task = AgentTask::new(user_uuid, tenant_id, task_type, input_text);

        if let Some(ctx) = context {
            let mut context_map = HashMap::new();
            for (key, value) in ctx.iter() {
                let key_str = key.to_string();
                let value_json: serde_json::Value = pythonize::depythonize(value)
                    .map_err(|e| PyRuntimeError::new_err(format!("Failed to convert context: {}", e)))?;
                context_map.insert(key_str, value_json);
            }
            task = task.with_context(context_map);
        }

        Ok(Self { inner: task })
    }

    #[getter]
    fn id(&self) -> String {
        self.inner.id.to_string()
    }

    #[getter]
    fn task_type(&self) -> String {
        self.inner.task_type.clone()
    }

    #[getter]
    fn input_text(&self) -> String {
        self.inner.input_text.clone()
    }
}

/// Python wrapper for AgentResult
#[pyclass]
#[derive(Clone)]
pub struct PyAgentResult {
    inner: AgentResult,
}

#[pymethods]
impl PyAgentResult {
    #[getter]
    fn task_id(&self) -> String {
        self.inner.task_id.to_string()
    }

    #[getter]
    fn status(&self) -> String {
        format!("{:?}", self.inner.status).to_uppercase()
    }

    #[getter]
    fn result(&self) -> Option<String> {
        self.inner.result.clone()
    }

    #[getter]
    fn error_message(&self) -> Option<String> {
        self.inner.error_message.clone()
    }

    #[getter]
    fn tokens_used(&self) -> u32 {
        self.inner.tokens_used
    }

    #[getter]
    fn duration_ms(&self) -> u64 {
        self.inner.duration_ms
    }

    #[getter]
    fn confidence_score(&self) -> f64 {
        self.inner.confidence_score
    }

    #[getter]
    fn reasoning_steps(&self, py: Python) -> PyResult<PyObject> {
        pythonize::pythonize(py, &self.inner.reasoning_steps)
            .map_err(|e| PyRuntimeError::new_err(format!("Failed to serialize reasoning steps: {}", e)))
    }

    #[getter]
    fn sources(&self, py: Python) -> PyResult<PyObject> {
        pythonize::pythonize(py, &self.inner.sources)
            .map_err(|e| PyRuntimeError::new_err(format!("Failed to serialize sources: {}", e)))
    }

    fn to_dict(&self, py: Python) -> PyResult<PyObject> {
        pythonize::pythonize(py, &self.inner)
            .map_err(|e| PyRuntimeError::new_err(format!("Failed to serialize result: {}", e)))
    }
}

/// Python wrapper for Orchestrator
#[pyclass]
pub struct PyOrchestrator {
    orchestrator: Arc<Orchestrator>,
    runtime: Arc<Runtime>,
}

#[pymethods]
impl PyOrchestrator {
    #[new]
    fn new(maverick_url: Option<String>) -> PyResult<Self> {
        let runtime = Runtime::new()
            .map_err(|e| PyRuntimeError::new_err(format!("Failed to create runtime: {}", e)))?;

        let llm = Arc::new(MaverickClient::new(maverick_url));
        let orchestrator = Arc::new(Orchestrator::new(llm.clone()));

        // Create domain managers and register them
        let finance_manager = Arc::new(DomainManager::new(Domain::Finance, llm.clone()));
        let career_manager = Arc::new(DomainManager::new(Domain::Career, llm.clone()));
        let health_manager = Arc::new(DomainManager::new(Domain::Health, llm.clone()));
        let general_manager = Arc::new(DomainManager::new(Domain::General, llm.clone()));

        // Register specialists with finance manager
        runtime.block_on(async {
            finance_manager.register_specialist(
                "budget".to_string(),
                Arc::new(SpecialistAgent::budget_specialist(llm.clone())),
            ).await;

            finance_manager.register_specialist(
                "investment".to_string(),
                Arc::new(SpecialistAgent::investment_specialist(llm.clone())),
            ).await;

            // Register specialists with career manager
            career_manager.register_specialist(
                "job_search".to_string(),
                Arc::new(SpecialistAgent::job_search_specialist(llm.clone())),
            ).await;

            career_manager.register_specialist(
                "resume".to_string(),
                Arc::new(SpecialistAgent::resume_specialist(llm.clone())),
            ).await;

            // Register domain managers with orchestrator
            orchestrator.register_domain_manager(Domain::Finance, finance_manager as Arc<dyn Agent>).await;
            orchestrator.register_domain_manager(Domain::Career, career_manager as Arc<dyn Agent>).await;
            orchestrator.register_domain_manager(Domain::Health, health_manager as Arc<dyn Agent>).await;
            orchestrator.register_domain_manager(Domain::General, general_manager as Arc<dyn Agent>).await;
        });

        Ok(Self {
            orchestrator,
            runtime: Arc::new(runtime),
        })
    }

    fn execute_task(&self, task: &PyAgentTask) -> PyResult<PyAgentResult> {
        let task_clone = task.inner.clone();
        let orchestrator = self.orchestrator.clone();

        let result = self.runtime.block_on(async move {
            orchestrator.execute(task_clone).await
        });

        match result {
            Ok(agent_result) => Ok(PyAgentResult { inner: agent_result }),
            Err(e) => Err(PyRuntimeError::new_err(format!("Task execution failed: {}", e))),
        }
    }

    fn analyze_intent(&self, input_text: String) -> PyResult<PyObject> {
        let orchestrator = self.orchestrator.clone();

        let result = self.runtime.block_on(async move {
            orchestrator.analyze_intent(&input_text).await
        });

        match result {
            Ok(intent) => {
                Python::with_gil(|py| {
                    pythonize::pythonize(py, &intent)
                        .map_err(|e| PyRuntimeError::new_err(format!("Failed to serialize intent: {}", e)))
                })
            }
            Err(e) => Err(PyRuntimeError::new_err(format!("Intent analysis failed: {}", e))),
        }
    }
}

// Python module initialization is done in lib.rs
// Export the classes to be registered there
