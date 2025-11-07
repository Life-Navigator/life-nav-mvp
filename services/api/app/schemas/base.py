"""
Base schemas
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, UUID4


class BaseSchema(BaseModel):
    """Base schema with common configuration"""

    class Config:
        from_attributes = True
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


class BaseResponseSchema(BaseSchema):
    """Base response schema with common fields"""

    id: UUID4
    created_at: datetime
    updated_at: Optional[datetime] = None


class PaginationParams(BaseModel):
    """Pagination parameters"""

    skip: int = 0
    limit: int = 20


class PaginatedResponse(BaseModel):
    """Paginated response wrapper"""

    items: list
    total: int
    skip: int
    limit: int
    has_more: bool
