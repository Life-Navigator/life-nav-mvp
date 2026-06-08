//! LifeNavigator ingestion worker.
//!
//! Public modules so the integration tests under `tests/` can exercise
//! the pure-logic layers (normalizer, payload builders, sensitivity
//! filter) without needing the network.
//!
//! Runtime composition lives in `src/main.rs`.

pub mod config;
pub mod entities;
pub mod errors;
pub mod gemini_client;
pub mod neo4j_client;
pub mod normalizer;
pub mod ontology;
pub mod processor;
pub mod qdrant_client;
pub mod queue;
pub mod relationships;
pub mod supabase_client;
pub mod telemetry;

pub use entities::{CanonicalGraphObject, EntityType, Relationship, SensitivityLevel};
pub use errors::{Result, WorkerError};
pub use queue::SyncQueueJob;
