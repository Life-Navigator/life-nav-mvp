//! Elite-Level Observability System
//!
//! Production-grade metrics, tracing, and performance monitoring.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Instant;
use parking_lot::RwLock;
use std::collections::HashMap;

/// Database operation metrics tracker
pub struct OperationMetrics {
    /// Total operations executed
    pub total_operations: AtomicU64,
    /// Total errors
    pub total_errors: AtomicU64,
    /// Total retries
    pub total_retries: AtomicU64,
    /// Cache hits
    pub cache_hits: AtomicU64,
    /// Cache misses
    pub cache_misses: AtomicU64,
    /// Active connections
    pub active_connections: AtomicU64,
    /// Operation durations (operation_name -> durations in ms)
    operation_durations: Arc<RwLock<HashMap<String, Vec<f64>>>>,
}

impl OperationMetrics {
    pub fn new() -> Self {
        Self {
            total_operations: AtomicU64::new(0),
            total_errors: AtomicU64::new(0),
            total_retries: AtomicU64::new(0),
            cache_hits: AtomicU64::new(0),
            cache_misses: AtomicU64::new(0),
            active_connections: AtomicU64::new(0),
            operation_durations: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Record operation completion
    pub fn record_operation(&self, operation: &str, duration_ms: f64, success: bool) {
        self.total_operations.fetch_add(1, Ordering::Relaxed);

        if !success {
            self.total_errors.fetch_add(1, Ordering::Relaxed);
        }

        // Record duration
        let mut durations = self.operation_durations.write();
        durations
            .entry(operation.to_string())
            .or_insert_with(Vec::new)
            .push(duration_ms);

        // Keep only last 10,000 datapoints per operation
        if let Some(vec) = durations.get_mut(operation) {
            if vec.len() > 10_000 {
                vec.drain(0..vec.len() - 10_000);
            }
        }
    }

    /// Record retry attempt
    pub fn record_retry(&self) {
        self.total_retries.fetch_add(1, Ordering::Relaxed);
    }

    /// Record cache hit
    pub fn record_cache_hit(&self) {
        self.cache_hits.fetch_add(1, Ordering::Relaxed);
    }

    /// Record cache miss
    pub fn record_cache_miss(&self) {
        self.cache_misses.fetch_add(1, Ordering::Relaxed);
    }

    /// Get operation statistics
    pub fn get_operation_stats(&self, operation: &str) -> Option<OperationStats> {
        let durations = self.operation_durations.read();
        durations.get(operation).map(|values| {
            if values.is_empty() {
                return OperationStats::default();
            }

            let mut sorted = values.clone();
            sorted.sort_by(|a, b| a.partial_cmp(b).unwrap());

            let sum: f64 = sorted.iter().sum();
            let count = sorted.len() as f64;

            OperationStats {
                count: sorted.len() as u64,
                min_ms: *sorted.first().unwrap(),
                max_ms: *sorted.last().unwrap(),
                avg_ms: sum / count,
                p50_ms: sorted[(count * 0.50) as usize],
                p95_ms: sorted[(count * 0.95) as usize],
                p99_ms: sorted[(count * 0.99) as usize],
            }
        })
    }

    /// Get cache hit ratio
    pub fn cache_hit_ratio(&self) -> f64 {
        let hits = self.cache_hits.load(Ordering::Relaxed) as f64;
        let misses = self.cache_misses.load(Ordering::Relaxed) as f64;
        let total = hits + misses;

        if total == 0.0 {
            0.0
        } else {
            hits / total
        }
    }

    /// Get error rate
    pub fn error_rate(&self) -> f64 {
        let errors = self.total_errors.load(Ordering::Relaxed) as f64;
        let total = self.total_operations.load(Ordering::Relaxed) as f64;

        if total == 0.0 {
            0.0
        } else {
            errors / total
        }
    }

    /// Export metrics as Prometheus format
    pub fn export_prometheus(&self) -> String {
        let mut output = String::new();

        // Basic counters
        output.push_str(&format!(
            "db_operations_total {}\n",
            self.total_operations.load(Ordering::Relaxed)
        ));
        output.push_str(&format!(
            "db_errors_total {}\n",
            self.total_errors.load(Ordering::Relaxed)
        ));
        output.push_str(&format!(
            "db_retries_total {}\n",
            self.total_retries.load(Ordering::Relaxed)
        ));
        output.push_str(&format!(
            "db_cache_hits_total {}\n",
            self.cache_hits.load(Ordering::Relaxed)
        ));
        output.push_str(&format!(
            "db_cache_misses_total {}\n",
            self.cache_misses.load(Ordering::Relaxed)
        ));

        // Derived metrics
        output.push_str(&format!("db_error_rate {}\n", self.error_rate()));
        output.push_str(&format!("db_cache_hit_ratio {}\n", self.cache_hit_ratio()));

        // Per-operation metrics
        let durations = self.operation_durations.read();
        for (operation, _) in durations.iter() {
            if let Some(stats) = self.get_operation_stats(operation) {
                output.push_str(&format!(
                    "db_operation_duration_ms{{operation=\"{}\"}} {}\n",
                    operation, stats.avg_ms
                ));
                output.push_str(&format!(
                    "db_operation_duration_p95_ms{{operation=\"{}\"}} {}\n",
                    operation, stats.p95_ms
                ));
                output.push_str(&format!(
                    "db_operation_duration_p99_ms{{operation=\"{}\"}} {}\n",
                    operation, stats.p99_ms
                ));
            }
        }

        output
    }
}

/// Statistics for a specific operation
#[derive(Debug, Clone, Default)]
pub struct OperationStats {
    pub count: u64,
    pub min_ms: f64,
    pub max_ms: f64,
    pub avg_ms: f64,
    pub p50_ms: f64,
    pub p95_ms: f64,
    pub p99_ms: f64,
}

/// Timer for measuring operation duration
pub struct OpTimer {
    start: Instant,
    operation: String,
    metrics: Arc<OperationMetrics>,
}

impl OpTimer {
    pub fn new(operation: impl Into<String>, metrics: Arc<OperationMetrics>) -> Self {
        Self {
            start: Instant::now(),
            operation: operation.into(),
            metrics,
        }
    }

    /// Get elapsed time in milliseconds
    pub fn elapsed_ms(&self) -> f64 {
        self.start.elapsed().as_secs_f64() * 1000.0
    }

    /// Complete the timer with success status
    pub fn complete(self, success: bool) {
        let duration_ms = self.start.elapsed().as_secs_f64() * 1000.0;
        self.metrics
            .record_operation(&self.operation, duration_ms, success);
    }
}

impl Drop for OpTimer {
    fn drop(&mut self) {
        // Auto-complete as success if not explicitly completed
        let duration_ms = self.start.elapsed().as_secs_f64() * 1000.0;
        self.metrics
            .record_operation(&self.operation, duration_ms, true);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn test_operation_metrics() {
        let metrics = OperationMetrics::new();

        // Record some operations
        metrics.record_operation("test_query", 10.0, true);
        metrics.record_operation("test_query", 20.0, true);
        metrics.record_operation("test_query", 30.0, false);

        assert_eq!(metrics.total_operations.load(Ordering::Relaxed), 3);
        assert_eq!(metrics.total_errors.load(Ordering::Relaxed), 1);

        let stats = metrics.get_operation_stats("test_query").unwrap();
        assert_eq!(stats.count, 3);
        assert_eq!(stats.min_ms, 10.0);
        assert_eq!(stats.max_ms, 30.0);
        assert_eq!(stats.avg_ms, 20.0);
    }

    #[test]
    fn test_cache_metrics() {
        let metrics = OperationMetrics::new();

        metrics.record_cache_hit();
        metrics.record_cache_hit();
        metrics.record_cache_miss();

        assert_eq!(metrics.cache_hits.load(Ordering::Relaxed), 2);
        assert_eq!(metrics.cache_misses.load(Ordering::Relaxed), 1);
        assert!((metrics.cache_hit_ratio() - 0.666).abs() < 0.01);
    }

    #[test]
    fn test_timer() {
        let metrics = Arc::new(OperationMetrics::new());

        {
            let timer = OpTimer::new("test_operation", metrics.clone());
            thread::sleep(Duration::from_millis(10));
            timer.complete(true);
        }

        assert_eq!(metrics.total_operations.load(Ordering::Relaxed), 1);
        let stats = metrics.get_operation_stats("test_operation").unwrap();
        assert!(stats.avg_ms >= 10.0);
    }

    #[test]
    fn test_prometheus_export() {
        let metrics = OperationMetrics::new();
        metrics.record_operation("query", 15.0, true);
        metrics.record_cache_hit();

        let output = metrics.export_prometheus();

        assert!(output.contains("db_operations_total 1"));
        assert!(output.contains("db_cache_hits_total 1"));
        assert!(output.contains("db_operation_duration_ms{operation=\"query\"}"));
    }
}
