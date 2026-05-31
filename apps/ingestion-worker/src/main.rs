//! Worker entry point.
//!
//!   1. Read config.
//!   2. Init tracing.
//!   3. Build clients.
//!   4. Loop: claim a batch from graphrag.sync_queue, process each,
//!      report results, sleep.
//!   5. On SIGINT/SIGTERM, finish the current job and exit cleanly.

use std::time::Duration;

use tokio::signal;
use tracing::{error, info, warn};

use ingestion_worker::config::Config;
use ingestion_worker::errors::Result;
use ingestion_worker::gemini_client::GeminiClient;
use ingestion_worker::neo4j_client::Neo4jClient;
use ingestion_worker::processor::Processor;
use ingestion_worker::qdrant_client::QdrantClient;
use ingestion_worker::supabase_client::SupabaseClient;
use ingestion_worker::telemetry;

#[tokio::main]
async fn main() -> Result<()> {
    let cfg = Config::from_env()?;
    telemetry::init(&cfg.log_level);

    info!(
        poll_interval_seconds = cfg.worker_poll_interval_seconds,
        batch_size = cfg.worker_batch_size,
        "ingestion-worker starting"
    );

    let supabase = SupabaseClient::new(&cfg)?;
    let gemini = GeminiClient::new(&cfg)?;
    let qdrant = QdrantClient::new(&cfg)?;
    let neo4j = Neo4jClient::new(&cfg)?;
    let processor = Processor {
        supabase: &supabase,
        gemini: &gemini,
        qdrant: &qdrant,
        neo4j: &neo4j,
    };

    let mut shutdown = std::pin::pin!(shutdown_signal());

    loop {
        tokio::select! {
            _ = &mut shutdown => {
                info!("shutdown signal received; exiting after current batch");
                break;
            }
            _ = tick(&processor, &supabase, &cfg) => {}
        }
    }

    info!("ingestion-worker stopped cleanly");
    Ok(())
}

async fn tick(processor: &Processor<'_>, supabase: &SupabaseClient, cfg: &Config) {
    match supabase.claim_jobs(cfg.worker_batch_size).await {
        Ok(jobs) if jobs.is_empty() => {
            tokio::time::sleep(Duration::from_secs(cfg.worker_poll_interval_seconds)).await;
        }
        Ok(jobs) => {
            let count = jobs.len();
            info!(claimed = count, "claimed batch");
            for job in jobs {
                let job_id = job.id;
                match processor.process_job(&job).await {
                    Ok(outcome) => {
                        let error = if !outcome.qdrant_synced || !outcome.neo4j_synced {
                            Some(format!(
                                "partial: qdrant={} neo4j={}",
                                outcome.qdrant_synced, outcome.neo4j_synced
                            ))
                        } else {
                            None
                        };
                        if let Err(e) = supabase
                            .complete_job(
                                job_id,
                                outcome.neo4j_synced,
                                outcome.qdrant_synced,
                                error.as_deref(),
                            )
                            .await
                        {
                            error!(?e, %job_id, "complete_sync_job failed");
                        }
                    }
                    Err(e) => {
                        warn!(?e, %job_id, "process_job failed");
                        if let Err(e2) = supabase
                            .complete_job(job_id, false, false, Some(&e.to_string()))
                            .await
                        {
                            error!(?e2, %job_id, "complete_sync_job after failure also failed");
                        }
                    }
                }
            }
        }
        Err(e) => {
            error!(?e, "claim_sync_jobs failed; backing off");
            tokio::time::sleep(Duration::from_secs(cfg.worker_poll_interval_seconds)).await;
        }
    }
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c().await.ok();
    };
    #[cfg(unix)]
    let term = async {
        let mut s = signal::unix::signal(signal::unix::SignalKind::terminate()).unwrap();
        s.recv().await;
    };
    #[cfg(not(unix))]
    let term = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {}
        _ = term => {}
    }
}
