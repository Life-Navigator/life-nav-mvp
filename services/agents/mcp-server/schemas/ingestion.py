"""Schemas for Data Ingestion API"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime


class DocumentUploadRequest(BaseModel):
    """Request to upload and ingest a document"""
    user_id: str = Field(..., description="User ID for row-level security")
    is_centralized: bool = Field(
        default=False,
        description="If True, add to centralized knowledge base (no RLS)"
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Additional metadata for the document"
    )


class DocumentUploadResponse(BaseModel):
    """Response from document upload"""
    job_id: str = Field(..., description="Ingestion job ID for tracking")
    file_name: str = Field(..., description="Name of uploaded file")
    file_size: int = Field(..., description="File size in bytes")
    status: str = Field(..., description="Initial status (pending)")
    message: str = Field(..., description="Success message")


class JobStatusResponse(BaseModel):
    """Response for job status query"""
    job_id: str
    status: str  # pending, processing, completed, failed
    progress: float  # 0-100
    total_steps: int
    completed_steps: int
    errors: List[str]
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


class JobListResponse(BaseModel):
    """Response for listing jobs"""
    jobs: List[JobStatusResponse]
    total: int
    page: int
    page_size: int


class IngestionStatsResponse(BaseModel):
    """Statistics for ingestion system"""
    total_jobs: int
    active_jobs: int
    completed_jobs: int
    failed_jobs: int
    total_documents_processed: int
    total_entities_extracted: int
    total_concepts_extracted: int
    total_embeddings_generated: int
