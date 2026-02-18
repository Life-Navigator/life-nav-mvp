/*!
Fast metrics aggregation with parallel processing
*/

use pyo3::prelude::*;
use rayon::prelude::*;

/// Metrics aggregator (parallel computation)
#[pyclass]
pub struct MetricsAggregator {
    window_size: usize,
}

#[pymethods]
impl MetricsAggregator {
    #[new]
    #[pyo3(signature = (window_size=100))]
    pub fn new(window_size: usize) -> Self {
        MetricsAggregator { window_size }
    }

    /// Compute moving average (parallel)
    pub fn moving_average(&self, values: Vec<f32>) -> Vec<f32> {
        if values.len() < self.window_size {
            return vec![values.iter().sum::<f32>() / values.len() as f32];
        }

        values
            .par_windows(self.window_size)
            .map(|window| window.iter().sum::<f32>() / window.len() as f32)
            .collect()
    }

    /// Compute percentiles (p50, p95, p99)
    pub fn percentiles(&self, values: Vec<f32>) -> (f32, f32, f32) {
        if values.is_empty() {
            return (0.0, 0.0, 0.0);
        }

        let mut sorted = values.clone();
        sorted.par_sort_unstable_by(|a, b| a.partial_cmp(b).unwrap());

        let p50 = sorted[sorted.len() / 2];
        let p95 = sorted[(sorted.len() * 95) / 100];
        let p99 = sorted[(sorted.len() * 99) / 100];

        (p50, p95, p99)
    }

    /// Compute statistics: (mean, std, min, max)
    pub fn statistics(&self, values: Vec<f32>) -> (f32, f32, f32, f32) {
        if values.is_empty() {
            return (0.0, 0.0, 0.0, 0.0);
        }

        let sum: f32 = values.par_iter().sum();
        let mean = sum / values.len() as f32;

        let variance: f32 = values
            .par_iter()
            .map(|x| (x - mean).powi(2))
            .sum::<f32>()
            / values.len() as f32;

        let std = variance.sqrt();
        let min = values.par_iter().fold(|| f32::MAX, |a, &b| a.min(b)).reduce(|| f32::MAX, |a, b| a.min(b));
        let max = values.par_iter().fold(|| f32::MIN, |a, &b| a.max(b)).reduce(|| f32::MIN, |a, b| a.max(b));

        (mean, std, min, max)
    }
}
