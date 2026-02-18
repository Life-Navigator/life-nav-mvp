"""Base Agent Implementation"""

import asyncio
from abc import ABC, abstractmethod
from enum import Enum
from typing import Dict, List, Any, Optional
from datetime import datetime
import uuid
import structlog
from pydantic import BaseModel, Field

from .message import Message, MessageType, TaskRequest, TaskResponse
from .message_bus import MessageBus

logger = structlog.get_logger(__name__)


class AgentStatus(str, Enum):
    """Agent lifecycle status"""
    CREATED = "created"
    INITIALIZING = "initializing"
    READY = "ready"
    BUSY = "busy"
    ERROR = "error"
    STOPPED = "stopped"


class AgentCapability(str, Enum):
    """Standard agent capabilities"""
    RESEARCH = "research"  # Information gathering
    ANALYSIS = "analysis"  # Data analysis
    WRITING = "writing"  # Content generation
    PLANNING = "planning"  # Task planning
    EXECUTION = "execution"  # Action execution
    MEMORY = "memory"  # Memory operations
    SEARCH = "search"  # Search operations
    COORDINATION = "coordination"  # Multi-agent coordination


class AgentConfig(BaseModel):
    """Agent configuration"""
    agent_id: str = Field(default_factory=lambda: f"agent_{uuid.uuid4().hex[:8]}")
    name: str
    description: str
    capabilities: List[AgentCapability] = Field(default_factory=list)

    # Resource limits
    max_concurrent_tasks: int = 5
    task_timeout_seconds: int = 300

    # Integration settings
    enable_memory: bool = True
    enable_tools: bool = True

    # Custom configuration
    custom_config: Dict[str, Any] = Field(default_factory=dict)


class BaseAgent(ABC):
    """
    Base class for all agents in the A2A framework.

    Features:
    - Lifecycle management (initialize, start, stop)
    - Message handling via MessageBus
    - Task execution with concurrency control
    - Capability declaration
    - Tool and memory integration
    - Health monitoring

    Usage:
        class MyAgent(BaseAgent):
            async def initialize(self) -> None:
                await super().initialize()
                # Custom initialization

            async def handle_task(self, task: TaskRequest) -> TaskResponse:
                # Implement task handling
                return TaskResponse(...)

        agent = MyAgent(config, message_bus, ...)
        await agent.start()
    """

    def __init__(
        self,
        config: AgentConfig,
        message_bus: MessageBus,
        plugin_manager: Optional[Any] = None
    ):
        self.config = config
        self.message_bus = message_bus
        self.plugin_manager = plugin_manager

        self.agent_id = config.agent_id
        self.name = config.name
        self.status = AgentStatus.CREATED

        # Active tasks
        self._active_tasks: Dict[str, asyncio.Task] = {}
        self._task_semaphore = asyncio.Semaphore(config.max_concurrent_tasks)

        # Statistics
        self._stats = {
            "tasks_received": 0,
            "tasks_completed": 0,
            "tasks_failed": 0,
            "messages_sent": 0,
            "messages_received": 0,
        }

        self._created_at = datetime.utcnow()
        self._last_activity = datetime.utcnow()

    async def start(self) -> None:
        """Start the agent"""
        try:
            self.status = AgentStatus.INITIALIZING
            logger.info("agent_starting", agent_id=self.agent_id, name=self.name)

            # Initialize the agent
            await self.initialize()

            # Subscribe to message bus
            await self.message_bus.subscribe(self.agent_id, self._handle_message)

            # Subscribe to relevant topics
            for capability in self.config.capabilities:
                topic = f"task.{capability.value}"
                await self.message_bus.subscribe_topic(
                    self.agent_id,
                    topic,
                    self._handle_message
                )

            self.status = AgentStatus.READY
            logger.info("agent_started", agent_id=self.agent_id, name=self.name)

        except Exception as e:
            self.status = AgentStatus.ERROR
            logger.error(
                "agent_start_failed",
                agent_id=self.agent_id,
                error=str(e),
                exc_info=True
            )
            raise

    async def stop(self) -> None:
        """Stop the agent"""
        logger.info("agent_stopping", agent_id=self.agent_id)

        # Cancel all active tasks
        for task_id, task in self._active_tasks.items():
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        self._active_tasks.clear()

        # Unsubscribe from message bus
        await self.message_bus.unsubscribe(self.agent_id)

        # Cleanup
        await self.cleanup()

        self.status = AgentStatus.STOPPED
        logger.info("agent_stopped", agent_id=self.agent_id, stats=self._stats)

    @abstractmethod
    async def initialize(self) -> None:
        """
        Initialize the agent.

        Override this method to perform custom initialization.
        """
        pass

    @abstractmethod
    async def handle_task(self, task: TaskRequest) -> TaskResponse:
        """
        Handle a task request.

        This is the main method that agents must implement.

        Args:
            task: Task request to handle

        Returns:
            Task response with result
        """
        pass

    async def cleanup(self) -> None:
        """
        Cleanup resources.

        Override this method to perform custom cleanup.
        """
        pass

    async def _handle_message(self, message: Message) -> None:
        """Handle incoming message from message bus"""
        self._stats["messages_received"] += 1
        self._last_activity = datetime.utcnow()

        logger.debug(
            "message_received",
            agent_id=self.agent_id,
            message_id=message.id,
            type=message.type,
            sender=message.sender
        )

        try:
            if message.type == MessageType.TASK_REQUEST:
                await self._handle_task_request(message)

            elif message.type == MessageType.QUERY:
                await self._handle_query(message)

            elif message.type == MessageType.COLLABORATION_REQUEST:
                await self._handle_collaboration_request(message)

            else:
                # Allow subclasses to handle other message types
                await self.on_message(message)

        except Exception as e:
            logger.error(
                "message_handling_failed",
                agent_id=self.agent_id,
                message_id=message.id,
                error=str(e),
                exc_info=True
            )

            # Send error response if required
            if message.requires_response:
                error_response = message.create_error(
                    sender=self.agent_id,
                    error=str(e)
                )
                await self.send_message(error_response)

    async def _handle_task_request(self, message: Message) -> None:
        """Handle task request message"""
        self._stats["tasks_received"] += 1

        # Parse task request
        task = TaskRequest(**message.content)

        # Check if we can handle this task
        if not self._can_handle_task(task):
            logger.warning(
                "task_rejected_no_capability",
                agent_id=self.agent_id,
                task_id=task.task_id,
                task_type=task.task_type
            )

            if message.requires_response:
                response = TaskResponse(
                    task_id=task.task_id,
                    status="failed",
                    error="Agent does not have required capabilities"
                )
                await self.send_message(
                    response.to_message(
                        sender=self.agent_id,
                        recipient=message.sender,
                        reply_to=message.id
                    )
                )
            return

        # Execute task asynchronously
        task_future = asyncio.create_task(
            self._execute_task(task, message)
        )
        self._active_tasks[task.task_id] = task_future

    async def _execute_task(
        self,
        task: TaskRequest,
        original_message: Message
    ) -> None:
        """Execute a task with concurrency control"""
        async with self._task_semaphore:
            start_time = datetime.utcnow()
            self.status = AgentStatus.BUSY

            try:
                logger.info(
                    "task_executing",
                    agent_id=self.agent_id,
                    task_id=task.task_id,
                    task_type=task.task_type
                )

                # Execute the task with timeout
                response = await asyncio.wait_for(
                    self.handle_task(task),
                    timeout=self.config.task_timeout_seconds
                )

                execution_time = (datetime.utcnow() - start_time).total_seconds() * 1000
                response.execution_time_ms = execution_time

                self._stats["tasks_completed"] += 1
                logger.info(
                    "task_completed",
                    agent_id=self.agent_id,
                    task_id=task.task_id,
                    execution_time_ms=execution_time
                )

            except asyncio.TimeoutError:
                self._stats["tasks_failed"] += 1
                logger.error(
                    "task_timeout",
                    agent_id=self.agent_id,
                    task_id=task.task_id,
                    timeout=self.config.task_timeout_seconds
                )
                response = TaskResponse(
                    task_id=task.task_id,
                    status="failed",
                    error=f"Task timeout after {self.config.task_timeout_seconds}s"
                )

            except Exception as e:
                self._stats["tasks_failed"] += 1
                logger.error(
                    "task_failed",
                    agent_id=self.agent_id,
                    task_id=task.task_id,
                    error=str(e),
                    exc_info=True
                )
                response = TaskResponse(
                    task_id=task.task_id,
                    status="failed",
                    error=str(e)
                )

            finally:
                # Remove from active tasks
                self._active_tasks.pop(task.task_id, None)

                # Update status
                if not self._active_tasks:
                    self.status = AgentStatus.READY

            # Send response if required
            if original_message.requires_response:
                response_message = response.to_message(
                    sender=self.agent_id,
                    recipient=original_message.sender,
                    reply_to=original_message.id
                )
                await self.send_message(response_message)

    async def _handle_query(self, message: Message) -> None:
        """Handle query message"""
        # Default implementation - subclasses can override
        if message.requires_response:
            response = message.create_response(
                sender=self.agent_id,
                content={
                    "agent_id": self.agent_id,
                    "name": self.name,
                    "status": self.status.value,
                    "capabilities": [c.value for c in self.config.capabilities],
                }
            )
            await self.send_message(response)

    async def _handle_collaboration_request(self, message: Message) -> None:
        """Handle collaboration request"""
        # Default implementation - subclasses can override
        await self.on_collaboration_request(message)

    async def on_message(self, message: Message) -> None:
        """
        Handle custom message types.

        Override this method to handle additional message types.
        """
        logger.debug(
            "unhandled_message_type",
            agent_id=self.agent_id,
            message_type=message.type
        )

    async def on_collaboration_request(self, message: Message) -> None:
        """
        Handle collaboration requests.

        Override this method to implement collaboration behavior.
        """
        logger.debug(
            "collaboration_request_ignored",
            agent_id=self.agent_id,
            message_id=message.id
        )

    def _can_handle_task(self, task: TaskRequest) -> bool:
        """Check if agent can handle a task based on capabilities"""
        # If no requirements, we can try to handle it
        if not task.requirements:
            return True

        # Check if we have all required capabilities
        agent_capabilities = {c.value for c in self.config.capabilities}
        return all(req in agent_capabilities for req in task.requirements)

    async def send_message(self, message: Message) -> bool:
        """Send a message via the message bus"""
        self._stats["messages_sent"] += 1
        return await self.message_bus.send(message)

    async def broadcast(self, message: Message) -> bool:
        """Broadcast a message to all agents"""
        self._stats["messages_sent"] += 1
        return await self.message_bus.broadcast(message)

    async def send_task(
        self,
        task: TaskRequest,
        recipient: Optional[str] = None,
        timeout: Optional[float] = None
    ) -> Optional[TaskResponse]:
        """
        Send a task to another agent and wait for response.

        Args:
            task: Task to send
            recipient: Target agent ID (None for topic-based routing)
            timeout: Response timeout in seconds

        Returns:
            Task response or None if timeout
        """
        message = task.to_message(
            sender=self.agent_id,
            recipient=recipient
        )

        if timeout:
            response_message = await self.message_bus.request(message, timeout=timeout)
            if response_message:
                return TaskResponse(**response_message.content)
            return None
        else:
            await self.send_message(message)
            return None

    async def use_tool(
        self,
        tool_name: str,
        parameters: Dict[str, Any],
        user_id: str
    ) -> Any:
        """
        Use a tool via the plugin manager.

        Args:
            tool_name: Name of the tool
            parameters: Tool parameters
            user_id: User identifier for context

        Returns:
            Tool result
        """
        if not self.config.enable_tools or not self.plugin_manager:
            raise ValueError("Tools not enabled for this agent")

        return await self.plugin_manager.invoke_tool(
            tool_name=tool_name,
            parameters=parameters,
            user_id=user_id
        )

    async def store_memory(
        self,
        content: str,
        memory_type: str,
        user_id: str,
        metadata: Optional[Dict] = None
    ) -> Any:
        """Store information in memory system"""
        if not self.config.enable_memory or not self.plugin_manager:
            raise ValueError("Memory not enabled for this agent")

        return await self.use_tool(
            tool_name="store_memory",
            parameters={
                "content": content,
                "memory_type": memory_type,
                "metadata": metadata or {}
            },
            user_id=user_id
        )

    async def recall_memory(
        self,
        query: str,
        user_id: str,
        memory_types: Optional[List[str]] = None
    ) -> Any:
        """Recall information from memory system"""
        if not self.config.enable_memory or not self.plugin_manager:
            raise ValueError("Memory not enabled for this agent")

        return await self.use_tool(
            tool_name="recall_memory",
            parameters={
                "query": query,
                "memory_types": memory_types
            },
            user_id=user_id
        )

    def get_status(self) -> Dict[str, Any]:
        """Get agent status information"""
        uptime = (datetime.utcnow() - self._created_at).total_seconds()
        idle_time = (datetime.utcnow() - self._last_activity).total_seconds()

        return {
            "agent_id": self.agent_id,
            "name": self.name,
            "status": self.status.value,
            "capabilities": [c.value for c in self.config.capabilities],
            "active_tasks": len(self._active_tasks),
            "max_concurrent_tasks": self.config.max_concurrent_tasks,
            "stats": self._stats,
            "uptime_seconds": uptime,
            "idle_seconds": idle_time,
            "created_at": self._created_at.isoformat(),
            "last_activity": self._last_activity.isoformat(),
        }
