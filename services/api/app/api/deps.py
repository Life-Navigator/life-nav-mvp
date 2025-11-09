"""
API dependencies module

This module re-exports common dependencies used across API endpoints.
"""

from app.core.database import get_db
from app.core.dependencies import (
    get_current_user,
    get_current_active_user,
    get_tenant_id,
)

__all__ = [
    "get_db",
    "get_current_user",
    "get_current_active_user",
    "get_tenant_id",
]
