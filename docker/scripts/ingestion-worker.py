#!/usr/bin/env python3
"""
Ingestion Worker - Cloud Run Job Entry Point

This script runs as a Cloud Run Job triggered on-demand.
It processes documents from Cloud Storage and ingests them into the knowledge graph.
"""

import asyncio
import logging
import os
import sys
from datetime import datetime

# Configure logging for Cloud Run (JSON format for Cloud Logging)
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


async def process_pending_documents():
    """Process all pending documents in the ingestion queue."""
    logger.info("Starting document ingestion job")
    start_time = datetime.utcnow()

    documents_processed = 0
    documents_failed = 0

    try:
        # Import app modules
        from mcp_server.ingestion.pipeline import IngestionPipeline
        from graphrag.document_ingestion import DocumentIngestion

        # Initialize the ingestion pipeline
        pipeline = IngestionPipeline()
        doc_ingestion = DocumentIngestion()

        # Get Cloud Storage bucket for pending documents
        bucket_name = os.getenv("DOCUMENTS_BUCKET", "life-navigator-documents-beta")
        pending_prefix = os.getenv("PENDING_PREFIX", "pending/")

        logger.info(f"Processing documents from gs://{bucket_name}/{pending_prefix}")

        # List pending documents from Cloud Storage
        from google.cloud import storage

        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blobs = list(bucket.list_blobs(prefix=pending_prefix))

        logger.info(f"Found {len(blobs)} documents to process")

        for blob in blobs:
            if blob.name.endswith('/'):
                continue  # Skip directories

            doc_name = blob.name.split('/')[-1]
            logger.info(f"Processing: {doc_name}")

            try:
                # Download document to temp location
                temp_path = f"/tmp/{doc_name}"
                blob.download_to_filename(temp_path)

                # Process through ingestion pipeline
                result = await pipeline.process_document(
                    file_path=temp_path,
                    metadata={
                        "source": f"gs://{bucket_name}/{blob.name}",
                        "ingestion_time": datetime.utcnow().isoformat(),
                    }
                )

                # Ingest into knowledge graph
                await doc_ingestion.ingest(
                    document=result.document,
                    entities=result.entities,
                    relationships=result.relationships
                )

                # Move to processed folder
                processed_blob = bucket.blob(f"processed/{doc_name}")
                bucket.copy_blob(blob, bucket, f"processed/{doc_name}")
                blob.delete()

                documents_processed += 1
                logger.info(f"Successfully processed: {doc_name}")

                # Cleanup temp file
                os.remove(temp_path)

            except Exception as e:
                documents_failed += 1
                logger.error(f"Failed to process {doc_name}: {e}")

                # Move to failed folder
                try:
                    bucket.copy_blob(blob, bucket, f"failed/{doc_name}")
                    blob.delete()
                except Exception:
                    pass

    except ImportError as e:
        logger.warning(f"App modules not fully available: {e}")
        logger.info("Running in minimal mode...")

        # Minimal mode - just list what would be processed
        try:
            from google.cloud import storage

            bucket_name = os.getenv("DOCUMENTS_BUCKET", "life-navigator-documents-beta")
            storage_client = storage.Client()
            bucket = storage_client.bucket(bucket_name)
            blobs = list(bucket.list_blobs(prefix="pending/", max_results=100))

            logger.info(f"Would process {len(blobs)} documents (minimal mode)")
            for blob in blobs[:10]:  # Log first 10
                logger.info(f"  - {blob.name}")

        except Exception as storage_error:
            logger.error(f"Storage access failed: {storage_error}")

    elapsed = (datetime.utcnow() - start_time).total_seconds()

    logger.info("=" * 60)
    logger.info(f"Ingestion job completed in {elapsed:.2f}s")
    logger.info(f"Documents processed: {documents_processed}")
    logger.info(f"Documents failed: {documents_failed}")
    logger.info("=" * 60)

    return documents_failed == 0


async def run_single_document(document_path: str):
    """Process a single document specified via environment variable."""
    logger.info(f"Processing single document: {document_path}")

    try:
        from mcp_server.ingestion.pipeline import IngestionPipeline

        pipeline = IngestionPipeline()
        result = await pipeline.process_document(file_path=document_path)

        logger.info(f"Document processed successfully")
        logger.info(f"  Entities extracted: {len(result.entities)}")
        logger.info(f"  Relationships found: {len(result.relationships)}")

        return True

    except Exception as e:
        logger.error(f"Failed to process document: {e}")
        return False


def main():
    """Main entry point for Cloud Run Job."""
    logger.info("=" * 60)
    logger.info("Life Navigator - Ingestion Worker")
    logger.info(f"Job started at: {datetime.utcnow().isoformat()}")
    logger.info(f"Environment: {os.getenv('ENVIRONMENT', 'unknown')}")
    logger.info("=" * 60)

    # Check for single document mode
    single_doc = os.getenv("DOCUMENT_PATH")

    try:
        if single_doc:
            success = asyncio.run(run_single_document(single_doc))
        else:
            success = asyncio.run(process_pending_documents())

        if success:
            logger.info("Ingestion job completed successfully")
            sys.exit(0)
        else:
            logger.error("Ingestion job completed with errors")
            sys.exit(1)

    except Exception as e:
        logger.exception(f"Ingestion job failed with exception: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
