//! Elite-Level Error Handling System
//!
//! Comprehensive error types with detailed context, retry policies, and observability.

use std::fmt;
use thiserror::Error;
use pyo3::prelude::*;

/// Main database error type with detailed categorization
#[derive(Error, Debug, Clone)]
pub enum DatabaseError {
    /// Connection-level errors (can be retried)
    #[error("Connection error: {message} (attempt {attempt}/{max_attempts})")]
    Connection {
        message: String,
        attempt: u32,
        max_attempts: u32,
        retryable: bool,
    },

    /// Query execution errors
    #[error("Query error: {message}\nQuery: {query}\nParams: {params}")]
    Query {
        message: String,
        query: String,
        params: String,
        error_code: Option<String>,
    },

    /// Transaction errors
    #[error("Transaction error: {message} (tx_id: {transaction_id})")]
    Transaction {
        message: String,
        transaction_id: String,
        rollback_attempted: bool,
    },

    /// Timeout errors
    #[error("Timeout: {operation} exceeded {duration_ms}ms")]
    Timeout {
        operation: String,
        duration_ms: u64,
        threshold_ms: u64,
    },

    /// Serialization/deserialization errors
    #[error("Serialization error: {message}\nData type: {data_type}")]
    Serialization {
        message: String,
        data_type: String,
        value_sample: Option<String>,
    },

    /// Authentication/authorization errors
    #[error("Auth error: {message}")]
    Auth {
        message: String,
        user_id: Option<String>,
        required_permission: Option<String>,
    },

    /// Validation errors
    #[error("Validation error: {field} - {message}")]
    Validation {
        field: String,
        message: String,
        invalid_value: Option<String>,
    },

    /// Resource not found
    #[error("Not found: {resource_type} with {identifier}")]
    NotFound {
        resource_type: String,
        identifier: String,
    },

    /// Constraint violation (unique, foreign key, etc.)
    #[error("Constraint violation: {constraint_type} - {message}")]
    Constraint {
        constraint_type: String,
        message: String,
        violated_value: Option<String>,
    },

    /// Rate limiting
    #[error("Rate limit exceeded: {limit} requests per {window_seconds}s")]
    RateLimit {
        limit: u32,
        window_seconds: u32,
        retry_after_seconds: u32,
    },

    /// Circuit breaker open
    #[error("Circuit breaker open: {service} - {consecutive_failures} consecutive failures")]
    CircuitBreakerOpen {
        service: String,
        consecutive_failures: u32,
        retry_after_seconds: u32,
    },

    /// Configuration errors
    #[error("Configuration error: {message}")]
    Config {
        message: String,
        field: Option<String>,
    },

    /// Internal errors (shouldn't happen, indicates bug)
    #[error("Internal error: {message}\nLocation: {location}")]
    Internal {
        message: String,
        location: String,
        backtrace: Option<String>,
    },
}

impl DatabaseError {
    /// Check if error is retryable
    pub fn is_retryable(&self) -> bool {
        match self {
            DatabaseError::Connection { retryable, .. } => *retryable,
            DatabaseError::Timeout { .. } => true,
            DatabaseError::RateLimit { .. } => true,
            DatabaseError::CircuitBreakerOpen { .. } => false, // Wait for circuit to close
            DatabaseError::Query { error_code, .. } => {
                // Retry on specific Neo4j error codes
                if let Some(code) = error_code {
                    matches!(
                        code.as_str(),
                        "Neo.TransientError.Transaction.LockClientStopped"
                            | "Neo.TransientError.Transaction.Terminated"
                            | "Neo.TransientError.Network.CommunicationError"
                    )
                } else {
                    false
                }
            }
            _ => false,
        }
    }

    /// Get retry delay in milliseconds (with exponential backoff)
    pub fn retry_delay_ms(&self, attempt: u32) -> u64 {
        match self {
            DatabaseError::Connection { .. } => {
                // Exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms
                std::cmp::min(100 * 2u64.pow(attempt), 5000)
            }
            DatabaseError::Timeout { .. } => {
                // Linear backoff for timeouts
                std::cmp::min(500 * (attempt as u64 + 1), 3000)
            }
            DatabaseError::RateLimit {
                retry_after_seconds,
                ..
            } => *retry_after_seconds as u64 * 1000,
            _ => 1000, // Default 1 second
        }
    }

    /// Get error severity level
    pub fn severity(&self) -> ErrorSeverity {
        match self {
            DatabaseError::Internal { .. } => ErrorSeverity::Critical,
            DatabaseError::Connection { .. } => ErrorSeverity::High,
            DatabaseError::Query { .. } => ErrorSeverity::Medium,
            DatabaseError::Timeout { .. } => ErrorSeverity::Medium,
            DatabaseError::Auth { .. } => ErrorSeverity::High,
            DatabaseError::Validation { .. } => ErrorSeverity::Low,
            DatabaseError::NotFound { .. } => ErrorSeverity::Low,
            DatabaseError::RateLimit { .. } => ErrorSeverity::Medium,
            DatabaseError::CircuitBreakerOpen { .. } => ErrorSeverity::High,
            _ => ErrorSeverity::Medium,
        }
    }

    /// Convert to metrics label
    pub fn to_metric_label(&self) -> &'static str {
        match self {
            DatabaseError::Connection { .. } => "connection_error",
            DatabaseError::Query { .. } => "query_error",
            DatabaseError::Transaction { .. } => "transaction_error",
            DatabaseError::Timeout { .. } => "timeout_error",
            DatabaseError::Serialization { .. } => "serialization_error",
            DatabaseError::Auth { .. } => "auth_error",
            DatabaseError::Validation { .. } => "validation_error",
            DatabaseError::NotFound { .. } => "not_found_error",
            DatabaseError::Constraint { .. } => "constraint_error",
            DatabaseError::RateLimit { .. } => "rate_limit_error",
            DatabaseError::CircuitBreakerOpen { .. } => "circuit_breaker_error",
            DatabaseError::Config { .. } => "config_error",
            DatabaseError::Internal { .. } => "internal_error",
        }
    }
}

/// Error severity levels for alerting
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum ErrorSeverity {
    Low,
    Medium,
    High,
    Critical,
}

impl fmt::Display for ErrorSeverity {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ErrorSeverity::Low => write!(f, "LOW"),
            ErrorSeverity::Medium => write!(f, "MEDIUM"),
            ErrorSeverity::High => write!(f, "HIGH"),
            ErrorSeverity::Critical => write!(f, "CRITICAL"),
        }
    }
}

/// Convert DatabaseError to Python exception
impl From<DatabaseError> for PyErr {
    fn from(err: DatabaseError) -> PyErr {
        use pyo3::exceptions::*;

        match &err {
            DatabaseError::Auth { .. } => PyPermissionError::new_err(err.to_string()),
            DatabaseError::Validation { .. } => PyValueError::new_err(err.to_string()),
            DatabaseError::NotFound { .. } => PyKeyError::new_err(err.to_string()),
            DatabaseError::Timeout { .. } => PyTimeoutError::new_err(err.to_string()),
            DatabaseError::RateLimit { .. } => {
                PyRuntimeError::new_err(format!("RateLimitError: {}", err))
            }
            DatabaseError::CircuitBreakerOpen { .. } => {
                PyRuntimeError::new_err(format!("CircuitBreakerOpen: {}", err))
            }
            DatabaseError::Connection { .. } => PyConnectionError::new_err(err.to_string()),
            _ => PyRuntimeError::new_err(err.to_string()),
        }
    }
}

/// Result type alias for database operations
pub type DbResult<T> = Result<T, DatabaseError>;

/// Error context builder for detailed error information
pub struct ErrorContext {
    operation: String,
    query: Option<String>,
    params: Option<String>,
    user_id: Option<String>,
}

impl ErrorContext {
    pub fn new(operation: impl Into<String>) -> Self {
        Self {
            operation: operation.into(),
            query: None,
            params: None,
            user_id: None,
        }
    }

    pub fn with_query(mut self, query: impl Into<String>) -> Self {
        self.query = Some(query.into());
        self
    }

    pub fn with_params(mut self, params: impl Into<String>) -> Self {
        self.params = Some(params.into());
        self
    }

    pub fn with_user(mut self, user_id: impl Into<String>) -> Self {
        self.user_id = Some(user_id.into());
        self
    }

    /// Build a query error with full context
    pub fn query_error(self, message: impl Into<String>) -> DatabaseError {
        DatabaseError::Query {
            message: message.into(),
            query: self.query.unwrap_or_else(|| "N/A".to_string()),
            params: self.params.unwrap_or_else(|| "N/A".to_string()),
            error_code: None,
        }
    }

    /// Build a connection error with retry info
    pub fn connection_error(
        self,
        message: impl Into<String>,
        attempt: u32,
        max_attempts: u32,
    ) -> DatabaseError {
        DatabaseError::Connection {
            message: message.into(),
            attempt,
            max_attempts,
            retryable: attempt < max_attempts,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_retryable() {
        let err = DatabaseError::Connection {
            message: "test".to_string(),
            attempt: 1,
            max_attempts: 3,
            retryable: true,
        };
        assert!(err.is_retryable());

        let err = DatabaseError::Validation {
            field: "test".to_string(),
            message: "invalid".to_string(),
            invalid_value: None,
        };
        assert!(!err.is_retryable());
    }

    #[test]
    fn test_retry_delay() {
        let err = DatabaseError::Connection {
            message: "test".to_string(),
            attempt: 1,
            max_attempts: 3,
            retryable: true,
        };

        assert_eq!(err.retry_delay_ms(0), 100);
        assert_eq!(err.retry_delay_ms(1), 200);
        assert_eq!(err.retry_delay_ms(2), 400);
        assert_eq!(err.retry_delay_ms(10), 5000); // Capped at 5s
    }

    #[test]
    fn test_error_severity() {
        let err = DatabaseError::Internal {
            message: "bug".to_string(),
            location: "test".to_string(),
            backtrace: None,
        };
        assert_eq!(err.severity(), ErrorSeverity::Critical);

        let err = DatabaseError::NotFound {
            resource_type: "Entity".to_string(),
            identifier: "123".to_string(),
        };
        assert_eq!(err.severity(), ErrorSeverity::Low);
    }

    #[test]
    fn test_error_context() {
        let err = ErrorContext::new("test_operation")
            .with_query("MATCH (n) RETURN n")
            .with_params("{id: '123'}")
            .query_error("Query failed");

        if let DatabaseError::Query { query, params, .. } = err {
            assert_eq!(query, "MATCH (n) RETURN n");
            assert_eq!(params, "{id: '123'}");
        } else {
            panic!("Wrong error type");
        }
    }
}
