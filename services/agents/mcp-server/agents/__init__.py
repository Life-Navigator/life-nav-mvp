"""A2A Multi-Agent Framework"""

from .base.agent import BaseAgent, AgentConfig, AgentStatus, AgentCapability
from .base.message import (
    Message,
    MessageType,
    MessagePriority,
    TaskRequest,
    TaskResponse,
)
from .base.message_bus import MessageBus
from .coordinator.agent_coordinator import AgentCoordinator
from .coordinator.workflow_engine import (
    WorkflowEngine,
    Workflow,
    WorkflowStep,
    WorkflowStepType,
)
from .specialized.research_agent import ResearchAgent
from .specialized.analyst_agent import AnalystAgent
from .specialized.writer_agent import WriterAgent

__all__ = [
    # Base components
    "BaseAgent",
    "AgentConfig",
    "AgentStatus",
    "AgentCapability",
    "Message",
    "MessageType",
    "MessagePriority",
    "TaskRequest",
    "TaskResponse",
    "MessageBus",
    # Coordination
    "AgentCoordinator",
    "WorkflowEngine",
    "Workflow",
    "WorkflowStep",
    "WorkflowStepType",
    # Specialized agents
    "ResearchAgent",
    "AnalystAgent",
    "WriterAgent",
]
