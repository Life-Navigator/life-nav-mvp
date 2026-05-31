"""Shared request / response models."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class QueryRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    domain: Optional[str] = None
    limit: int = Field(default=10, ge=1, le=50)


class RecommendationEnvelope(BaseModel):
    """Compliance-vetted output shape every recommendation route returns."""

    summary: str
    recommended_actions: list[str] = Field(default_factory=list)
    rationale: str = ""
    relevant_goals: list[str] = Field(default_factory=list)
    constraints_considered: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    compliance_notes: list[str] = Field(default_factory=list)
    confidence_score: float = Field(default=0.5, ge=0, le=1)
    next_best_action: Optional[str] = None
    should_refer_to_partner: bool = False
    partner_type: Optional[str] = None


class ErrorEnvelope(BaseModel):
    error: str
    detail: Optional[Any] = None
