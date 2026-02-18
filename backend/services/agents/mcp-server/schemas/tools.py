"""Tool Schemas"""

from enum import Enum
from typing import Any, Dict, Optional
from pydantic import BaseModel, Field


class ParameterType(str, Enum):
    """Tool parameter types"""
    STRING = "string"
    INTEGER = "integer"
    FLOAT = "float"
    BOOLEAN = "boolean"
    OBJECT = "object"
    ARRAY = "array"


class ToolParameter(BaseModel):
    """Tool parameter definition"""
    name: str
    type: ParameterType
    description: str
    required: bool = True
    default: Optional[Any] = None
    enum: Optional[list] = None


class ToolSchema(BaseModel):
    """Tool schema definition"""
    name: str
    description: str
    parameters: list[ToolParameter] = Field(default_factory=list)
    returns: Dict[str, Any] = Field(default_factory=dict)
    examples: list[Dict[str, Any]] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class ToolResult(BaseModel):
    """Result from tool execution"""
    success: bool
    data: Any = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class ToolError(BaseModel):
    """Error from tool execution"""
    error_type: str
    message: str
    details: Optional[Dict[str, Any]] = None
    recoverable: bool = True
