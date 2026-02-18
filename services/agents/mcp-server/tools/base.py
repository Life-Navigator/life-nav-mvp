"""Base Tool Class"""

from typing import Any, Callable, Dict
from pydantic import BaseModel


class Tool(BaseModel):
    """
    Tool definition for LLM invocation.

    Tools are functions that LLMs can call to perform actions.
    Each tool has:
    - Name and description
    - JSON Schema for parameters
    - Handler function for execution
    """

    name: str
    description: str
    parameters_schema: Dict[str, Any]
    handler: Callable

    class Config:
        arbitrary_types_allowed = True

    def __repr__(self) -> str:
        return f"<Tool(name={self.name})>"
