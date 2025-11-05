//! Elite-Level Retry Logic & Circuit Breaker
//!
//! Production-grade retry strategies with exponential backoff and circuit breaker pattern.

use std::future::Future;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use parking_lot::RwLock;
use crate::error::{DatabaseError, DbResult};

/// Retry policy configuration
#[derive(Debug, Clone)]
pub struct RetryPolicy {
    /// Maximum number of retry attempts
    pub max_attempts: u32,
    /// Initial retry delay in milliseconds
    pub initial_delay_ms: u64,
    /// Maximum retry delay in milliseconds
    pub max_delay_ms: u64,
    /// Backoff multiplier (typically 2.0 for exponential)
    pub backoff_multiplier: f64,
    /// Jitter factor (0.0 to 1.0)
    pub jitter_factor: f64,
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_attempts: 3,
            initial_delay_ms: 100,
            max_delay_ms: 5000,
            backoff_multiplier: 2.0,
            jitter_factor: 0.1,
        }
    }
}

impl RetryPolicy {
    /// Create an aggressive retry policy (more attempts, shorter delays)
    pub fn aggressive() -> Self {
        Self {
            max_attempts: 5,
            initial_delay_ms: 50,
            max_delay_ms: 2000,
            backoff_multiplier: 1.5,
            jitter_factor: 0.2,
        }
    }

    /// Create a conservative retry policy (fewer attempts, longer delays)
    pub fn conservative() -> Self {
        Self {
            max_attempts: 2,
            initial_delay_ms: 500,
            max_delay_ms: 10000,
            backoff_multiplier: 3.0,
            jitter_factor: 0.05,
        }
    }

    /// Calculate retry delay for given attempt with exponential backoff + jitter
    pub fn delay_for_attempt(&self, attempt: u32) -> Duration {
        let base_delay = (self.initial_delay_ms as f64)
            * self.backoff_multiplier.powi(attempt as i32);

        let capped_delay = base_delay.min(self.max_delay_ms as f64);

        // Add jitter to prevent thundering herd
        let jitter = (rand::random::<f64>() - 0.5) * 2.0 * self.jitter_factor * capped_delay;
        let final_delay = (capped_delay + jitter).max(0.0);

        Duration::from_millis(final_delay as u64)
    }
}

/// Circuit breaker states
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CircuitState {
    /// Circuit is closed, requests pass through normally
    Closed,
    /// Circuit is open, requests are rejected immediately
    Open,
    /// Circuit is half-open, testing if service recovered
    HalfOpen,
}

/// Circuit breaker configuration
#[derive(Debug, Clone)]
pub struct CircuitBreakerConfig {
    /// Number of consecutive failures before opening circuit
    pub failure_threshold: u32,
    /// Time to wait before attempting recovery (half-open state)
    pub recovery_timeout_ms: u64,
    /// Number of successful requests needed to close circuit from half-open
    pub success_threshold: u32,
    /// Time window for counting failures (ms)
    pub failure_window_ms: u64,
}

impl Default for CircuitBreakerConfig {
    fn default() -> Self {
        Self {
            failure_threshold: 5,
            recovery_timeout_ms: 30000, // 30 seconds
            success_threshold: 3,
            failure_window_ms: 60000, // 1 minute
        }
    }
}

/// Circuit breaker implementation
pub struct CircuitBreaker {
    config: CircuitBreakerConfig,
    state: RwLock<CircuitState>,
    consecutive_failures: AtomicU32,
    consecutive_successes: AtomicU32,
    last_failure_time: RwLock<Option<Instant>>,
    total_failures: AtomicU64,
    total_successes: AtomicU64,
    circuit_opened_count: AtomicU64,
}

impl CircuitBreaker {
    pub fn new(config: CircuitBreakerConfig) -> Self {
        Self {
            config,
            state: RwLock::new(CircuitState::Closed),
            consecutive_failures: AtomicU32::new(0),
            consecutive_successes: AtomicU32::new(0),
            last_failure_time: RwLock::new(None),
            total_failures: AtomicU64::new(0),
            total_successes: AtomicU64::new(0),
            circuit_opened_count: AtomicU64::new(0),
        }
    }

    /// Check if request should be allowed
    pub fn should_allow_request(&self) -> Result<(), DatabaseError> {
        let state = *self.state.read();

        match state {
            CircuitState::Closed => Ok(()),
            CircuitState::Open => {
                // Check if recovery timeout has elapsed
                if let Some(last_failure) = *self.last_failure_time.read() {
                    let recovery_timeout = Duration::from_millis(self.config.recovery_timeout_ms);

                    if last_failure.elapsed() >= recovery_timeout {
                        // Try half-open state
                        *self.state.write() = CircuitState::HalfOpen;
                        self.consecutive_successes.store(0, Ordering::Relaxed);
                        Ok(())
                    } else {
                        Err(DatabaseError::CircuitBreakerOpen {
                            service: "database".to_string(),
                            consecutive_failures: self
                                .consecutive_failures
                                .load(Ordering::Relaxed),
                            retry_after_seconds: (recovery_timeout
                                - last_failure.elapsed())
                            .as_secs() as u32,
                        })
                    }
                } else {
                    // No last failure time, allow request
                    Ok(())
                }
            }
            CircuitState::HalfOpen => Ok(()), // Allow limited requests in half-open
        }
    }

    /// Record successful request
    pub fn record_success(&self) {
        self.total_successes.fetch_add(1, Ordering::Relaxed);

        let state = *self.state.read();

        match state {
            CircuitState::Closed => {
                // Reset failure counter on success
                self.consecutive_failures.store(0, Ordering::Relaxed);
            }
            CircuitState::HalfOpen => {
                let successes = self
                    .consecutive_successes
                    .fetch_add(1, Ordering::Relaxed)
                    + 1;

                if successes >= self.config.success_threshold {
                    // Close circuit, service recovered
                    *self.state.write() = CircuitState::Closed;
                    self.consecutive_failures.store(0, Ordering::Relaxed);
                    self.consecutive_successes.store(0, Ordering::Relaxed);
                }
            }
            CircuitState::Open => {
                // Shouldn't happen, but reset if it does
                *self.state.write() = CircuitState::Closed;
                self.consecutive_failures.store(0, Ordering::Relaxed);
            }
        }
    }

    /// Record failed request
    pub fn record_failure(&self) {
        self.total_failures.fetch_add(1, Ordering::Relaxed);
        *self.last_failure_time.write() = Some(Instant::now());

        let failures = self
            .consecutive_failures
            .fetch_add(1, Ordering::Relaxed)
            + 1;

        if failures >= self.config.failure_threshold {
            // Open circuit
            *self.state.write() = CircuitState::Open;
            self.consecutive_successes.store(0, Ordering::Relaxed);
            self.circuit_opened_count.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// Get current circuit state
    pub fn state(&self) -> CircuitState {
        *self.state.read()
    }

    /// Get circuit statistics
    pub fn stats(&self) -> CircuitBreakerStats {
        CircuitBreakerStats {
            state: self.state(),
            consecutive_failures: self.consecutive_failures.load(Ordering::Relaxed),
            consecutive_successes: self.consecutive_successes.load(Ordering::Relaxed),
            total_failures: self.total_failures.load(Ordering::Relaxed),
            total_successes: self.total_successes.load(Ordering::Relaxed),
            circuit_opened_count: self.circuit_opened_count.load(Ordering::Relaxed),
        }
    }

    /// Reset circuit breaker (manual override)
    pub fn reset(&self) {
        *self.state.write() = CircuitState::Closed;
        self.consecutive_failures.store(0, Ordering::Relaxed);
        self.consecutive_successes.store(0, Ordering::Relaxed);
        *self.last_failure_time.write() = None;
    }
}

/// Circuit breaker statistics
#[derive(Debug, Clone)]
pub struct CircuitBreakerStats {
    pub state: CircuitState,
    pub consecutive_failures: u32,
    pub consecutive_successes: u32,
    pub total_failures: u64,
    pub total_successes: u64,
    pub circuit_opened_count: u64,
}

/// Retry executor with circuit breaker
pub struct RetryExecutor {
    policy: RetryPolicy,
    circuit_breaker: Arc<CircuitBreaker>,
}

impl RetryExecutor {
    pub fn new(policy: RetryPolicy, circuit_breaker: Arc<CircuitBreaker>) -> Self {
        Self {
            policy,
            circuit_breaker,
        }
    }

    /// Execute operation with retry logic and circuit breaker
    pub async fn execute<F, Fut, T>(&self, operation: F) -> DbResult<T>
    where
        F: Fn() -> Fut,
        Fut: Future<Output = DbResult<T>>,
    {
        // Check circuit breaker
        self.circuit_breaker.should_allow_request()?;

        let mut last_error: Option<DatabaseError> = None;

        for attempt in 0..self.policy.max_attempts {
            match operation().await {
                Ok(result) => {
                    self.circuit_breaker.record_success();
                    return Ok(result);
                }
                Err(err) => {
                    // Check if error is retryable
                    if !err.is_retryable() || attempt == self.policy.max_attempts - 1 {
                        self.circuit_breaker.record_failure();
                        return Err(err);
                    }

                    // Wait before retry with exponential backoff
                    let delay = self.policy.delay_for_attempt(attempt);
                    tokio::time::sleep(delay).await;

                    last_error = Some(err);
                }
            }
        }

        // All retries exhausted
        self.circuit_breaker.record_failure();
        Err(last_error.unwrap_or_else(|| DatabaseError::Internal {
            message: "Retry exhausted without error".to_string(),
            location: "retry_executor".to_string(),
            backtrace: None,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_retry_policy_delay() {
        let policy = RetryPolicy::default();

        let delay0 = policy.delay_for_attempt(0);
        let delay1 = policy.delay_for_attempt(1);
        let delay2 = policy.delay_for_attempt(2);

        // Should increase exponentially
        assert!(delay1 > delay0);
        assert!(delay2 > delay1);

        // Should be capped at max_delay_ms
        let delay10 = policy.delay_for_attempt(10);
        assert_eq!(delay10.as_millis(), policy.max_delay_ms as u128);
    }

    #[test]
    fn test_circuit_breaker_closed() {
        let breaker = CircuitBreaker::new(CircuitBreakerConfig::default());

        assert_eq!(breaker.state(), CircuitState::Closed);
        assert!(breaker.should_allow_request().is_ok());
    }

    #[test]
    fn test_circuit_breaker_opens() {
        let config = CircuitBreakerConfig {
            failure_threshold: 3,
            ..Default::default()
        };
        let breaker = CircuitBreaker::new(config);

        // Record 3 failures
        breaker.record_failure();
        breaker.record_failure();
        breaker.record_failure();

        assert_eq!(breaker.state(), CircuitState::Open);
        assert!(breaker.should_allow_request().is_err());
    }

    #[test]
    fn test_circuit_breaker_recovery() {
        let config = CircuitBreakerConfig {
            failure_threshold: 2,
            recovery_timeout_ms: 100,
            success_threshold: 2,
            ..Default::default()
        };
        let breaker = CircuitBreaker::new(config);

        // Open circuit
        breaker.record_failure();
        breaker.record_failure();
        assert_eq!(breaker.state(), CircuitState::Open);

        // Wait for recovery timeout
        std::thread::sleep(Duration::from_millis(150));

        // Should allow request (half-open)
        assert!(breaker.should_allow_request().is_ok());
        assert_eq!(breaker.state(), CircuitState::HalfOpen);

        // Record successes to close circuit
        breaker.record_success();
        breaker.record_success();
        assert_eq!(breaker.state(), CircuitState::Closed);
    }

    #[tokio::test]
    async fn test_retry_executor_success() {
        let policy = RetryPolicy::default();
        let breaker = Arc::new(CircuitBreaker::new(CircuitBreakerConfig::default()));
        let executor = RetryExecutor::new(policy, breaker);

        let result = executor
            .execute(|| async { Ok::<i32, DatabaseError>(42) })
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }

    #[tokio::test]
    async fn test_retry_executor_retry_and_succeed() {
        let policy = RetryPolicy {
            max_attempts: 3,
            initial_delay_ms: 10,
            ..Default::default()
        };
        let breaker = Arc::new(CircuitBreaker::new(CircuitBreakerConfig::default()));
        let executor = RetryExecutor::new(policy, breaker.clone());

        let attempt_counter = Arc::new(AtomicU32::new(0));
        let attempt_counter_clone = attempt_counter.clone();

        let result = executor
            .execute(move || {
                let counter = attempt_counter_clone.clone();
                async move {
                    let attempt = counter.fetch_add(1, Ordering::Relaxed);
                    if attempt < 2 {
                        Err(DatabaseError::Connection {
                            message: "temp error".to_string(),
                            attempt,
                            max_attempts: 3,
                            retryable: true,
                        })
                    } else {
                        Ok(42)
                    }
                }
            })
            .await;

        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
        assert_eq!(attempt_counter.load(Ordering::Relaxed), 3);
        assert_eq!(breaker.state(), CircuitState::Closed);
    }
}
