"""
OCR Processing Endpoints.
Handles document OCR processing and data extraction.

Security:
- Authentication required for all endpoints
- File validation before processing
- Rate limiting to prevent abuse
"""

from dataclasses import asdict
from typing import Any
from uuid import UUID

import httpx
from fastapi import APIRouter, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.api.deps import CurrentUser, DBSession, TenantID
from app.core.config import settings
from app.core.logging import logger

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# Rate limits for OCR processing (expensive operation)
RATE_LIMIT_OCR = "10/minute"


class OCRProcessRequest(BaseModel):
    """Request to process a document with OCR."""
    file_url: str = Field(..., alias="fileUrl")
    file_id: str = Field(..., alias="fileId")
    document_type: str = Field(default="generic", alias="documentType")
    domain: str = Field(default="generic")

    class Config:
        populate_by_name = True


class ExtractedEntityResponse(BaseModel):
    """Extracted entity from OCR."""
    entity_type: str
    value: str
    confidence: float
    normalized_value: Any | None = None


class ExtractedTransactionResponse(BaseModel):
    """Extracted transaction from OCR."""
    date: str | None
    description: str
    amount: float
    transaction_type: str
    confidence: float


class ExtractedHealthDataResponse(BaseModel):
    """Extracted health data from OCR."""
    test_name: str | None
    result_value: str | None
    result_unit: str | None
    reference_range: str | None
    date: str | None
    provider: str | None
    confidence: float


class OCRProcessResponse(BaseModel):
    """Response from OCR processing."""
    success: bool
    document_type: str
    raw_text: str = ""
    entities: list[ExtractedEntityResponse] = []
    transactions: list[ExtractedTransactionResponse] = []
    health_data: list[ExtractedHealthDataResponse] = []
    confidence: float = 0.0
    page_count: int = 0
    processing_time_ms: int = 0
    error: str | None = None
    extracted_data: dict | None = None


async def fetch_file_content(file_url: str) -> bytes:
    """Fetch file content from URL."""
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.get(file_url)
            response.raise_for_status()
            return response.content
    except httpx.HTTPError as e:
        logger.error("Failed to fetch file", url=file_url, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to fetch file from storage"
        )


@router.post("/process", response_model=OCRProcessResponse)
@limiter.limit(RATE_LIMIT_OCR)
async def process_document(
    request: Request,
    ocr_request: OCRProcessRequest,
    current_user: CurrentUser,
):
    """
    Process a document with OCR and extract structured data.

    Supports:
    - Financial documents (bank statements, receipts, invoices)
    - Health documents (lab results, prescriptions)
    - Career documents (resumes, certificates)
    - Education documents (transcripts, diplomas)

    Returns extracted text, entities, and domain-specific data.
    """
    from app.services.ocr_service import get_ocr_service, OCRResult

    logger.info(
        "OCR processing started",
        user_id=str(current_user.id),
        file_id=ocr_request.file_id,
        document_type=ocr_request.document_type,
        domain=ocr_request.domain,
    )

    try:
        # Fetch file content
        file_bytes = await fetch_file_content(ocr_request.file_url)

        # Process with OCR service
        service = get_ocr_service()
        result: OCRResult = await service.process_document(
            file_bytes=file_bytes,
            document_type=ocr_request.document_type,
        )

        # Convert dataclass results to response models
        entities = [
            ExtractedEntityResponse(
                entity_type=e.entity_type,
                value=e.value,
                confidence=e.confidence,
                normalized_value=e.normalized_value,
            )
            for e in result.entities
        ]

        transactions = [
            ExtractedTransactionResponse(
                date=t.date.isoformat() if t.date else None,
                description=t.description,
                amount=float(t.amount),
                transaction_type=t.transaction_type,
                confidence=t.confidence,
            )
            for t in result.transactions
        ]

        health_data = [
            ExtractedHealthDataResponse(
                test_name=h.test_name,
                result_value=h.result_value,
                result_unit=h.result_unit,
                reference_range=h.reference_range,
                date=h.date.isoformat() if h.date else None,
                provider=h.provider,
                confidence=h.confidence,
            )
            for h in result.health_data
        ]

        # Build extracted data summary
        extracted_data = {
            "entities": [asdict(e) for e in result.entities],
            "transactions": [
                {
                    "date": t.date.isoformat() if t.date else None,
                    "description": t.description,
                    "amount": float(t.amount),
                    "transaction_type": t.transaction_type,
                    "confidence": t.confidence,
                }
                for t in result.transactions
            ],
            "healthData": [
                {
                    "test_name": h.test_name,
                    "result_value": h.result_value,
                    "result_unit": h.result_unit,
                    "reference_range": h.reference_range,
                    "date": h.date.isoformat() if h.date else None,
                    "provider": h.provider,
                    "confidence": h.confidence,
                }
                for h in result.health_data
            ],
        }

        logger.info(
            "OCR processing complete",
            user_id=str(current_user.id),
            file_id=ocr_request.file_id,
            success=result.success,
            entity_count=len(entities),
            transaction_count=len(transactions),
            health_data_count=len(health_data),
            processing_time_ms=result.processing_time_ms,
        )

        return OCRProcessResponse(
            success=result.success,
            document_type=result.document_type.value,
            raw_text=result.raw_text,
            entities=entities,
            transactions=transactions,
            health_data=health_data,
            confidence=result.confidence,
            page_count=result.page_count,
            processing_time_ms=result.processing_time_ms,
            error=result.error,
            extracted_data=extracted_data,
        )

    except Exception as e:
        logger.error(
            "OCR processing failed",
            user_id=str(current_user.id),
            file_id=ocr_request.file_id,
            error=str(e),
            error_type=type(e).__name__,
        )

        # Return error response instead of raising
        return OCRProcessResponse(
            success=False,
            document_type=ocr_request.document_type,
            error="OCR processing failed. Please try again.",
        )


@router.post("/process-upload")
@limiter.limit(RATE_LIMIT_OCR)
async def process_uploaded_file(
    request: Request,
    file: UploadFile,
    current_user: CurrentUser,
    document_type: str = "generic",
):
    """
    Process an uploaded file directly with OCR.

    Alternative to process endpoint - accepts file upload instead of URL.
    """
    from app.services.ocr_service import get_ocr_service

    # Validate file type
    allowed_types = {
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/tiff",
    }

    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type: {file.content_type}. Allowed: PDF, PNG, JPEG, TIFF"
        )

    # Validate file size (50MB max)
    max_size = 50 * 1024 * 1024
    content = await file.read()

    if len(content) > max_size:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File too large. Maximum size: {max_size // (1024 * 1024)}MB"
        )

    logger.info(
        "Direct OCR upload processing",
        user_id=str(current_user.id),
        filename=file.filename,
        content_type=file.content_type,
        size=len(content),
        document_type=document_type,
    )

    try:
        service = get_ocr_service()
        result = await service.process_document(
            file_bytes=content,
            document_type=document_type,
        )

        return OCRProcessResponse(
            success=result.success,
            document_type=result.document_type.value,
            raw_text=result.raw_text,
            entities=[
                ExtractedEntityResponse(
                    entity_type=e.entity_type,
                    value=e.value,
                    confidence=e.confidence,
                    normalized_value=e.normalized_value,
                )
                for e in result.entities
            ],
            transactions=[
                ExtractedTransactionResponse(
                    date=t.date.isoformat() if t.date else None,
                    description=t.description,
                    amount=float(t.amount),
                    transaction_type=t.transaction_type,
                    confidence=t.confidence,
                )
                for t in result.transactions
            ],
            health_data=[
                ExtractedHealthDataResponse(
                    test_name=h.test_name,
                    result_value=h.result_value,
                    result_unit=h.result_unit,
                    reference_range=h.reference_range,
                    date=h.date.isoformat() if h.date else None,
                    provider=h.provider,
                    confidence=h.confidence,
                )
                for h in result.health_data
            ],
            confidence=result.confidence,
            page_count=result.page_count,
            processing_time_ms=result.processing_time_ms,
            error=result.error,
        )

    except Exception as e:
        logger.error(
            "Direct OCR upload failed",
            user_id=str(current_user.id),
            filename=file.filename,
            error=str(e),
        )

        return OCRProcessResponse(
            success=False,
            document_type=document_type,
            error="OCR processing failed. Please try again.",
        )
