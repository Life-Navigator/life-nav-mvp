"""Universal report schema (Sprint 3) — the typed structure every report uses.

A ReportDefinition is the JSON-first, renderer-agnostic source of truth: ordered sections,
chart definitions, and typed references to the evidence / recommendations / assumptions that
back every claim. It is built deterministically from domain data so it is REPRODUCIBLE
(same inputs -> same content_hash). Renderers (PDF later) consume this; they never invent.
"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class EvidenceReference(BaseModel):
    metric_name: str
    metric_value: Any
    source_table: str
    confidence: Optional[float] = None
    explanation: Optional[str] = None


class RecommendationReference(BaseModel):
    id: str
    title: str
    recommendation_type: Optional[str] = None
    priority: Optional[str] = None


class AssumptionReference(BaseModel):
    text: str
    confidence: Optional[float] = None
    user_confirmed: bool = False


class ChartDefinition(BaseModel):
    key: str
    type: str  # bar | range | radar | line | scenario
    title: str
    series: list[dict[str, Any]] = Field(default_factory=list)
    source: Optional[str] = None
    spec: dict[str, Any] = Field(default_factory=dict)


class ReportSection(BaseModel):
    key: str
    title: str
    ord: int
    body: dict[str, Any] = Field(default_factory=dict)
    evidence: list[EvidenceReference] = Field(default_factory=list)
    recommendations: list[RecommendationReference] = Field(default_factory=list)
    assumptions: list[AssumptionReference] = Field(default_factory=list)
    charts: list[str] = Field(default_factory=list)  # keys into ReportDefinition.charts


class ReportDefinition(BaseModel):
    report_type: str  # full | financial | education | decision
    title: str
    version: int = 1
    sections: list[ReportSection] = Field(default_factory=list)
    charts: list[ChartDefinition] = Field(default_factory=list)
    citations: list[str] = Field(default_factory=list)
    confidence: Optional[dict[str, Any]] = None
    governance: Optional[dict[str, Any]] = None
    metadata: dict[str, Any] = Field(default_factory=dict)
