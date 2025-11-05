"""Context Schemas"""

from enum import Enum
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ContextType(str, Enum):
    """Types of context"""
    CONVERSATIONAL = "conversational"
    SEMANTIC = "semantic"
    GRAPH = "graph"
    TEMPORAL = "temporal"
    USER_PROFILE = "user_profile"


class ContextMetadata(BaseModel):
    """Metadata for context"""
    source: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    relevance_score: float = Field(ge=0.0, le=1.0)
    tokens: int = 0


class ConversationalContext(BaseModel):
    """Conversational context from chat history"""
    messages: List[Dict[str, str]] = Field(default_factory=list)
    conversation_id: str
    summary: Optional[str] = None
    metadata: ContextMetadata


class SemanticContext(BaseModel):
    """Semantic context from vector search"""
    documents: List[Dict[str, Any]] = Field(default_factory=list)
    query_embedding: Optional[List[float]] = None
    metadata: ContextMetadata


class GraphContext(BaseModel):
    """Graph context from knowledge graph"""
    entities: List[Dict[str, Any]] = Field(default_factory=list)
    relationships: List[Dict[str, Any]] = Field(default_factory=list)
    cypher_query: Optional[str] = None
    metadata: ContextMetadata


class TemporalContext(BaseModel):
    """Temporal context (time-based)"""
    recent_events: List[Dict[str, Any]] = Field(default_factory=list)
    time_range: Optional[Dict[str, datetime]] = None
    metadata: ContextMetadata


class UserProfileContext(BaseModel):
    """User profile context"""
    preferences: Dict[str, Any] = Field(default_factory=dict)
    interests: List[str] = Field(default_factory=list)
    history: Dict[str, Any] = Field(default_factory=dict)
    metadata: ContextMetadata
