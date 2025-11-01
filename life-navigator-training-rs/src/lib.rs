/*!
Life Navigator Training - Rust Performance Module

High-performance data preprocessing with PyO3 Python bindings.
Leverages Rust's fearless concurrency (NO GIL!) for parallel processing.

Benefits over Python:
- 5-10x faster JSONL loading (parallel with Rayon)
- No GIL - true parallelism
- Zero-copy operations
- Memory-efficient streaming
*/

use pyo3::prelude::*;

mod preprocessor;
mod checkpoint;
mod metrics;
mod parser;
mod text_processor;
mod graph;

use preprocessor::DataPreprocessor;
use checkpoint::CheckpointManager;
use metrics::MetricsAggregator;
use parser::{DocumentParser, ParsedDocument};
use text_processor::TextProcessor;
use graph::{InMemoryGraph, Entity, Relationship, VectorSimilarity, ResultRanker};

/// Life Navigator Rust Training Module
#[pymodule]
fn life_navigator_rs(_py: Python, m: &PyModule) -> PyResult<()> {
    // Data preprocessing
    m.add_class::<DataPreprocessor>()?;

    // Document parsing
    m.add_class::<DocumentParser>()?;
    m.add_class::<ParsedDocument>()?;

    // Text processing
    m.add_class::<TextProcessor>()?;

    // Checkpoint management
    m.add_class::<CheckpointManager>()?;

    // Metrics aggregation
    m.add_class::<MetricsAggregator>()?;

    // Graph operations (NEW!)
    m.add_class::<InMemoryGraph>()?;
    m.add_class::<Entity>()?;
    m.add_class::<Relationship>()?;
    m.add_class::<VectorSimilarity>()?;
    m.add_class::<ResultRanker>()?;

    // Version info
    m.add("__version__", env!("CARGO_PKG_VERSION"))?;

    Ok(())
}
