"""
BaseAgent: Production-grade agent framework

Provides the foundation for all agents in the Life Navigator system with:
- Lifecycle management (startup/shutdown/health)
- Task execution with automatic retry and error recovery
- Integration with reasoning, audit, provenance, and error recovery systems
- Message bus integration for agent communication
- GraphRAG integration for context gathering
- Metrics tracking and observability
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List, TYPE_CHECKING
import asyncio
from datetime import datetime, timezone
from uuid import UUID, uuid4

from models.agent_models import (
    AgentTask,
    AgentState,
    AgentType,
    AgentMetrics,
    AgentCapability,
    TaskStatus
)
from agents.core.reasoning import ReasoningEngine
from agents.core.audit import AuditTrail, AuditEventType, AuditEvent
from agents.core.error_recovery import ErrorRecoveryManager
from agents.core.provenance import ProvenanceTracker
from agents.core.admin_tracker import get_tracker
from utils.logging import get_logger
from utils.errors import (
    AgentError,
    TaskExecutionError,
    AgentTimeoutError
)

# Type hints for dependencies that may not exist yet
if TYPE_CHECKING:
    from messaging.message_bus import MessageBus
    from graphrag.client import GraphRAGClient
    from models.vllm_client import VLLMClient
    from agents.tools.mcp_client import MCPClient


class BaseAgent(ABC):
    """
    Production-ready agent base class.

    All agents in the system inherit from BaseAgent, which provides:
    - Automatic state management
    - Task execution with retry logic and error recovery
    - Integration with reasoning chains for explainability
    - Audit trail for compliance
    - Provenance tracking for data lineage
    - Message bus integration for inter-agent communication
    - GraphRAG integration for context retrieval
    - Metrics collection for monitoring

    Subclasses must implement:
    - handle_task(): Core task execution logic
    - handle_query(): Query handling logic

    Example:
        >>> class BudgetAgent(BaseAgent):
        ...     async def handle_task(self, task: AgentTask) -> Dict[str, Any]:
        ...         # Gather context
        ...         context = await self.gather_context(task.metadata.user_id)
        ...         # Execute business logic
        ...         result = await self.analyze_budget(context)
        ...         return {"status": "success", "data": result}
    """

    def __init__(
        self,
        agent_id: str,
        agent_type: AgentType,
        capabilities: List[AgentCapability],
        message_bus: Optional["MessageBus"] = None,
        graphrag_client: Optional["GraphRAGClient"] = None,
        vllm_client: Optional["VLLMClient"] = None,
        mcp_client: Optional["MCPClient"] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialize agent.

        Args:
            agent_id: Unique agent identifier
            agent_type: Agent type (ORCHESTRATOR, DOMAIN_MANAGER, SPECIALIST, TOOL_USER)
            capabilities: List of agent capabilities
            message_bus: Message bus for inter-agent communication (optional)
            graphrag_client: GraphRAG client for context retrieval (optional)
            vllm_client: vLLM client for LLM inference (optional)
            mcp_client: MCP client for requesting data from app layer (optional)
            config: Optional configuration overrides
        """
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.capabilities = capabilities
        self.state = AgentState.IDLE

        # Core integrations (optional for now to support phased implementation)
        self.message_bus = message_bus
        self.graphrag = graphrag_client
        self.vllm = vllm_client
        self.mcp = mcp_client  # MCP client for data requests

        # Observability systems (always available)
        self.reasoning = ReasoningEngine()
        self.audit = AuditTrail()
        self.recovery = ErrorRecoveryManager(self.reasoning)
        self.provenance = ProvenanceTracker()

        # Admin dashboard tracker (optional, auto-configured)
        self.admin_tracker = get_tracker()

        # Configuration
        self.config = config or {}
        self.timeout = self.config.get("task_timeout", 30.0)
        self.max_retries = self.config.get("max_retries", 3)

        # Metrics & logging
        self.logger = get_logger(f"agent.{agent_type.value}.{agent_id}")
        self.metrics = AgentMetrics(
            agent_id=agent_id,
            current_state=AgentState.IDLE,
            total_tasks_processed=0,
            successful_tasks=0,
            failed_tasks=0,
            average_duration_ms=0.0,
            active_tasks=0,
            uptime_seconds=0.0,
            last_activity=datetime.now(timezone.utc)
        )

        # Runtime state
        self._current_task: Optional[AgentTask] = None
        self._current_chain_id: Optional[str] = None
        self._shutdown_event = asyncio.Event()
        self._message_tasks: List[asyncio.Task] = []
        self._startup_time: Optional[datetime] = None

        self.logger.info(
            f"Agent initialized: {agent_id}",
            extra={
                "agent_type": agent_type.value,
                "capabilities": [cap.name for cap in capabilities],
                "has_message_bus": message_bus is not None,
                "has_graphrag": graphrag_client is not None,
                "has_vllm": vllm_client is not None,
                "has_mcp": mcp_client is not None
            }
        )

    # ========== Lifecycle Methods ==========

    async def startup(self):
        """
        Initialize agent resources and subscribe to messages.

        This is called once when the agent starts. It:
        - Sets agent state to IDLE
        - Subscribes to message bus topics (if available)
        - Logs startup event to audit trail
        - Records startup time for uptime tracking

        Raises:
            AgentError: If startup fails
        """
        self.logger.info(f"Starting agent {self.agent_id}")

        try:
            self._startup_time = datetime.now(timezone.utc)
            self.state = AgentState.IDLE
            self.metrics.current_state = AgentState.IDLE

            # Subscribe to relevant message topics (if message bus available)
            if self.message_bus:
                await self._subscribe_to_messages()

            # Log startup to audit trail
            await self.audit.record_event(
                AuditEvent(
                    event_type=AuditEventType.AGENT_STARTED,
                    user_id="system",
                    agent_id=self.agent_id,
                    agent_type=self.agent_type,
                    correlation_id=str(uuid4()),
                    description=f"Agent {self.agent_id} started",
                    details={
                        "capabilities": [cap.dict() for cap in self.capabilities],
                        "config": self.config
                    }
                )
            )

            self.logger.info(f"Agent {self.agent_id} started successfully")

        except Exception as e:
            self.logger.error(f"Startup failed: {e}", error=e)
            self.state = AgentState.ERROR
            self.metrics.current_state = AgentState.ERROR
            raise AgentError(f"Agent startup failed: {e}")

    async def shutdown(self):
        """
        Clean up agent resources.

        This is called once when the agent stops. It:
        - Sets agent state to SHUTDOWN
        - Unsubscribes from message bus topics
        - Cancels any pending tasks
        - Logs shutdown event to audit trail
        - Flushes any buffered audit events
        """
        self.logger.info(f"Shutting down agent {self.agent_id}")

        try:
            self.state = AgentState.SHUTDOWN
            self.metrics.current_state = AgentState.SHUTDOWN
            self._shutdown_event.set()

            # Unsubscribe from messages
            if self.message_bus:
                await self._unsubscribe_from_messages()

            # Cancel all message handler tasks
            for task in self._message_tasks:
                if not task.done():
                    task.cancel()

            if self._message_tasks:
                await asyncio.gather(*self._message_tasks, return_exceptions=True)

            # Log shutdown
            await self.audit.record_event(
                AuditEvent(
                    event_type=AuditEventType.AGENT_STOPPED,
                    user_id="system",
                    agent_id=self.agent_id,
                    agent_type=self.agent_type,
                    correlation_id=str(uuid4()),
                    description=f"Agent {self.agent_id} stopped",
                    details={"final_metrics": self.metrics.dict()}
                )
            )

            # Flush audit events (if method exists)
            if hasattr(self.audit, 'flush'):
                await self.audit.flush()

            self.logger.info(f"Agent {self.agent_id} shutdown complete")

        except Exception as e:
            self.logger.error(f"Shutdown error: {e}", error=e)

    async def health_check(self) -> bool:
        """
        Check agent health status.

        Returns:
            True if agent is healthy and all dependencies are operational

        Checks:
        - Agent state (not ERROR or SHUTDOWN)
        - Message bus connection (if applicable)
        - GraphRAG connection (if applicable)
        """
        try:
            # Check state
            if self.state in (AgentState.ERROR, AgentState.SHUTDOWN):
                self.logger.warning(f"Agent unhealthy: state={self.state.value}")
                return False

            # Verify message bus connection (if available)
            if self.message_bus and not await self.message_bus.is_connected():
                self.logger.warning("Message bus not connected")
                return False

            # Verify GraphRAG connection (if available)
            if self.graphrag and not await self.graphrag.is_connected():
                self.logger.warning("GraphRAG not connected")
                return False

            return True

        except Exception as e:
            self.logger.error(f"Health check failed: {e}", error=e)
            return False

    # ========== Task Execution ==========

    async def execute_task(self, task: AgentTask) -> Dict[str, Any]:
        """
        Main entry point for task execution.

        Features:
        - Timeout enforcement
        - Retry logic with exponential backoff
        - Reasoning capture for explainability
        - Error recovery strategies
        - Provenance tracking for data lineage
        - Metrics collection for monitoring
        - Audit logging for compliance

        Args:
            task: Task to execute

        Returns:
            Dictionary with task result:
                - status: "success" or "failed"
                - data: Result data (if successful)
                - error: Error message (if failed)
                - task_id: Task identifier
                - duration_ms: Execution duration

        The result format is flexible to support different agent types.
        """
        task_id = task.metadata.task_id
        start_time = datetime.now(timezone.utc)

        try:
            # Update state
            self.state = AgentState.PROCESSING
            self.metrics.current_state = AgentState.PROCESSING
            self.metrics.active_tasks += 1
            self._current_task = task

            # Update task metadata
            task.metadata.status = TaskStatus.IN_PROGRESS
            task.metadata.started_at = start_time

            # Log task start
            await self.audit.record_event(
                AuditEvent(
                    event_type=AuditEventType.TASK_STARTED,
                    user_id=task.metadata.user_id,
                    agent_id=self.agent_id,
                    agent_type=self.agent_type,
                    task_id=str(task_id),
                    correlation_id=task.metadata.correlation_id,
                    description=f"Task {task_id} started: {task.task_type}",
                    details={
                        "task_type": task.task_type,
                        "priority": task.metadata.priority.value,
                        "payload": task.payload
                    }
                )
            )

            # Start reasoning chain
            chain = self.reasoning.start_chain(
                task_id=str(task_id),
                agent_type=self.agent_type
            )
            self._current_chain_id = chain.chain_id

            # Execute with timeout
            result = await asyncio.wait_for(
                self._execute_with_retry(task),
                timeout=self.timeout
            )

            # Calculate duration
            end_time = datetime.now(timezone.utc)
            duration_ms = (end_time - start_time).total_seconds() * 1000

            # Update task metadata
            task.metadata.status = TaskStatus.COMPLETED
            task.metadata.completed_at = end_time

            # Record success metrics
            self.metrics.successful_tasks += 1
            self.metrics.total_tasks_processed += 1
            self.metrics.last_activity = end_time
            self._update_avg_duration(duration_ms)

            # Log completion
            await self.audit.record_event(
                AuditEvent(
                    event_type=AuditEventType.TASK_COMPLETED,
                    user_id=task.metadata.user_id,
                    agent_id=self.agent_id,
                    agent_type=self.agent_type,
                    task_id=str(task_id),
                    correlation_id=task.metadata.correlation_id,
                    description=f"Task {task_id} completed: {task.task_type}",
                    details={
                        "duration_ms": duration_ms,
                        "result_summary": result.get("summary", "Task completed")
                    }
                )
            )

            self.logger.info(
                f"Task {task_id} completed successfully",
                extra={"duration_ms": duration_ms, "task_type": task.task_type}
            )

            # Add duration to result
            result["duration_ms"] = duration_ms
            result["task_id"] = str(task_id)

            # Track to admin dashboard
            await self._track_to_dashboard(
                task=task,
                status="success",
                duration_ms=duration_ms,
                error_message=None
            )

            return result

        except asyncio.TimeoutError:
            return await self._handle_timeout(task, start_time)

        except Exception as e:
            return await self._handle_error(task, e, start_time)

        finally:
            self.state = AgentState.IDLE
            self.metrics.current_state = AgentState.IDLE
            self.metrics.active_tasks -= 1
            self._current_task = None

            # Update uptime
            if self._startup_time:
                uptime_delta = datetime.now(timezone.utc) - self._startup_time
                self.metrics.uptime_seconds = uptime_delta.total_seconds()

    async def _execute_with_retry(self, task: AgentTask) -> Dict[str, Any]:
        """
        Execute task with exponential backoff retry.

        Args:
            task: Task to execute

        Returns:
            Task result dictionary

        Raises:
            TaskExecutionError: If all retries fail
        """
        last_error = None

        for attempt in range(self.max_retries):
            try:
                self.reasoning.add_thought(
                    chain_id=self._current_chain_id,
                    thought=f"Attempt {attempt + 1}/{self.max_retries}",
                    confidence=0.8
                )

                # Call agent-specific implementation
                result = await self.handle_task(task)

                # Track provenance (simple tracking for now)
                # TODO: Enhance with full DataSource objects
                # self.provenance.add_data_source(decision_id, source)

                self.reasoning.add_result(
                    chain_id=self._current_chain_id,
                    result="Task completed successfully",
                    success=True,
                    result_data=result
                )

                return result

            except Exception as e:
                last_error = e

                # Log error to reasoning chain
                self.reasoning.add_thought(
                    chain_id=self._current_chain_id,
                    thought=f"Error on attempt {attempt + 1}: {str(e)}",
                    confidence=0.5
                )

                # Determine if we should retry
                # For now, retry all exceptions unless max retries reached
                if attempt < self.max_retries - 1:
                    backoff = 2 ** attempt  # 1s, 2s, 4s exponential backoff
                    self.logger.warning(
                        f"Attempt {attempt + 1} failed, retrying in {backoff}s: {e}",
                        extra={"task_id": str(task.metadata.task_id), "error": str(e)}
                    )
                    await asyncio.sleep(backoff)
                    continue
                else:
                    # Max retries reached
                    self.logger.error(
                        f"Task failed after {self.max_retries} attempts",
                        extra={
                            "task_id": str(task.metadata.task_id),
                            "attempt": attempt + 1,
                            "error": str(e)
                        }
                    )
                    raise

        # All retries exhausted
        raise TaskExecutionError(
            f"Task failed after {self.max_retries} attempts: {last_error}"
        )

    # ========== Abstract Methods (Subclass Implementation) ==========

    @abstractmethod
    async def handle_task(self, task: AgentTask) -> Dict[str, Any]:
        """
        Agent-specific task handling logic.
        MUST be implemented by all agent subclasses.

        Args:
            task: Task to handle

        Returns:
            Dictionary with task result:
                - status: "success" or "failed"
                - data: Result data (structure depends on task type)
                - summary: Human-readable summary of result

        Example:
            >>> async def handle_task(self, task: AgentTask) -> Dict[str, Any]:
            ...     user_id = task.metadata.user_id
            ...     context = await self.gather_context(user_id, domains=["finance"])
            ...     result = self.analyze_data(context)
            ...     return {
            ...         "status": "success",
            ...         "data": result,
            ...         "summary": "Analysis complete"
            ...     }
        """
        pass

    @abstractmethod
    async def handle_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
        """
        Agent-specific query handling logic.
        Used for read-only information retrieval.

        Args:
            query: Query to handle with structure:
                - query_type: Type of query
                - parameters: Query parameters
                - user_id: User making the query

        Returns:
            Dictionary with query result:
                - status: "success" or "failed"
                - data: Query result data
                - summary: Human-readable summary

        Example:
            >>> async def handle_query(self, query: Dict[str, Any]) -> Dict[str, Any]:
            ...     user_id = query["user_id"]
            ...     context = await self.gather_context(user_id)
            ...     return {
            ...         "status": "success",
            ...         "data": context,
            ...         "summary": f"Retrieved context for user {user_id}"
            ...     }
        """
        pass

    # ========== Context Gathering ==========

    async def gather_context(
        self,
        user_id: str,
        domains: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Retrieve relevant user context from GraphRAG.

        Args:
            user_id: User identifier
            domains: List of domains to query (default: agent's domain)

        Returns:
            Dictionary of user context data organized by domain

        Example:
            >>> context = await agent.gather_context("user-123", domains=["finance"])
            >>> print(context["finance"]["accounts"])
            [{"account_id": "...", "balance": 1000.00}, ...]
        """
        if not self.graphrag:
            self.logger.warning("GraphRAG client not available, returning empty context")
            return {}

        if self._current_chain_id:
            self.reasoning.add_observation(
                chain_id=self._current_chain_id,
                observation=f"Gathering context for user {user_id}, domains: {domains}",
                data_sources=[f"user_{user_id}"],
                confidence=1.0
            )

        try:
            context = await self.graphrag.get_user_context(
                user_id=user_id,
                domains=domains or [self.agent_type.value.lower()]
            )

            # Track data access for provenance (simple tracking for now)
            # TODO: Enhance with full DataSource objects
            # self.provenance.add_data_source(decision_id, source)

            if self._current_chain_id:
                self.reasoning.add_observation(
                    chain_id=self._current_chain_id,
                    observation=f"Retrieved context with {len(context)} domains",
                    data_sources=[f"graphrag_{user_id}"],
                    confidence=1.0
                )

            return context

        except Exception as e:
            self.logger.error(f"Context gathering failed: {e}", error=e)
            if self._current_chain_id:
                self.reasoning.add_thought(
                    chain_id=self._current_chain_id,
                    thought=f"Context gathering failed: {e}",
                    confidence=0.3
                )
            return {}

    # ========== Message Bus Integration ==========

    async def _subscribe_to_messages(self):
        """Subscribe to relevant message topics"""
        if not self.message_bus:
            return

        # Subscribe to task assignments
        task_topic = f"agent.{self.agent_id}.tasks"
        await self.message_bus.subscribe(
            topic=task_topic,
            handler=self._handle_incoming_task
        )

        # Subscribe to queries
        query_topic = f"agent.{self.agent_id}.queries"
        await self.message_bus.subscribe(
            topic=query_topic,
            handler=self._handle_incoming_query
        )

        self.logger.info(
            f"Subscribed to message topics",
            extra={"topics": [task_topic, query_topic]}
        )

    async def _unsubscribe_from_messages(self):
        """Unsubscribe from message topics"""
        if not self.message_bus:
            return

        # Implementation depends on message bus
        # Will be implemented when MessageBus is created
        pass

    async def _handle_incoming_task(self, message: Dict[str, Any]):
        """Handle task message from message bus"""
        try:
            task = AgentTask(**message["payload"])

            self.logger.info(
                f"Received task from message bus",
                extra={"task_id": str(task.metadata.task_id), "task_type": task.task_type}
            )

            # Execute task
            result = await self.execute_task(task)

            # Publish result back to message bus
            if self.message_bus:
                await self.message_bus.publish(
                    topic=f"tasks.{task.metadata.task_id}.result",
                    payload=result,
                    reliable=True
                )

        except Exception as e:
            self.logger.error(f"Error handling incoming task: {e}", error=e)

    async def _handle_incoming_query(self, message: Dict[str, Any]):
        """Handle query message from message bus"""
        try:
            query = message["payload"]

            self.logger.info(
                f"Received query from message bus",
                extra={"query_type": query.get("query_type")}
            )

            # Execute query
            result = await self.handle_query(query)

            # Publish result
            if self.message_bus:
                await self.message_bus.publish(
                    topic=f"queries.{query['query_id']}.result",
                    payload=result
                )

        except Exception as e:
            self.logger.error(f"Error handling incoming query: {e}", error=e)

    async def publish_event(self, event_type: str, data: Dict[str, Any]):
        """
        Publish event to message bus.

        Args:
            event_type: Type of event
            data: Event data
        """
        if not self.message_bus:
            return

        await self.message_bus.publish(
            topic=f"events.{self.agent_type.value}.{event_type}",
            payload={
                "event_type": event_type,
                "agent_id": self.agent_id,
                "agent_type": self.agent_type.value,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": data
            }
        )

    # ========== Error Handling ==========

    async def _handle_timeout(
        self,
        task: AgentTask,
        start_time: datetime
    ) -> Dict[str, Any]:
        """Handle task timeout"""
        end_time = datetime.now(timezone.utc)
        duration_ms = (end_time - start_time).total_seconds() * 1000

        # Update task metadata
        task.metadata.status = TaskStatus.FAILED
        task.metadata.completed_at = end_time
        task.metadata.error = f"Task exceeded timeout of {self.timeout}s"

        # Update metrics
        self.metrics.failed_tasks += 1
        self.metrics.total_tasks_processed += 1
        self.metrics.last_activity = end_time

        await self.audit.record_event(
            AuditEvent(
                event_type=AuditEventType.TASK_FAILED,
                user_id=task.metadata.user_id,
                agent_id=self.agent_id,
                agent_type=self.agent_type,
                task_id=str(task.metadata.task_id),
                correlation_id=task.metadata.correlation_id,
                description=f"Task {task.metadata.task_id} timed out after {self.timeout}s",
                details={
                    "error": "timeout",
                    "timeout_seconds": self.timeout,
                    "duration_ms": duration_ms
                }
            )
        )

        self.logger.error(
            f"Task {task.metadata.task_id} timed out",
            extra={
                "timeout_seconds": self.timeout,
                "duration_ms": duration_ms,
                "task_type": task.task_type
            }
        )

        # Track timeout to admin dashboard
        await self._track_to_dashboard(
            task=task,
            status="failed",
            duration_ms=duration_ms,
            error_message=f"Task exceeded timeout of {self.timeout}s"
        )

        return {
            "status": "failed",
            "error": f"Task exceeded timeout of {self.timeout}s",
            "task_id": str(task.metadata.task_id),
            "duration_ms": duration_ms
        }

    async def _handle_error(
        self,
        task: AgentTask,
        error: Exception,
        start_time: datetime
    ) -> Dict[str, Any]:
        """Handle task execution error"""
        end_time = datetime.now(timezone.utc)
        duration_ms = (end_time - start_time).total_seconds() * 1000

        # Update task metadata
        task.metadata.status = TaskStatus.FAILED
        task.metadata.completed_at = end_time
        task.metadata.error = str(error)

        # Update metrics
        self.metrics.failed_tasks += 1
        self.metrics.total_tasks_processed += 1
        self.metrics.last_activity = end_time
        self.state = AgentState.ERROR
        self.metrics.current_state = AgentState.ERROR

        await self.audit.record_event(
            AuditEvent(
                event_type=AuditEventType.TASK_FAILED,
                user_id=task.metadata.user_id,
                agent_id=self.agent_id,
                agent_type=self.agent_type,
                task_id=str(task.metadata.task_id),
                correlation_id=task.metadata.correlation_id,
                description=f"Task {task.metadata.task_id} failed: {type(error).__name__}",
                details={
                    "error_type": type(error).__name__,
                    "error_message": str(error),
                    "duration_ms": duration_ms
                }
            )
        )

        self.logger.error(
            f"Task {task.metadata.task_id} failed",
            error=error,
            extra={
                "error_type": type(error).__name__,
                "duration_ms": duration_ms,
                "task_type": task.task_type
            }
        )

        # Track error to admin dashboard
        await self._track_to_dashboard(
            task=task,
            status="failed",
            duration_ms=duration_ms,
            error_message=f"{type(error).__name__}: {str(error)}"
        )

        return {
            "status": "failed",
            "error": str(error),
            "error_type": type(error).__name__,
            "task_id": str(task.metadata.task_id),
            "duration_ms": duration_ms
        }

    # ========== Metrics ==========

    def _update_avg_duration(self, duration_ms: float):
        """Update rolling average task duration"""
        total = self.metrics.total_tasks_processed
        current_avg = self.metrics.average_duration_ms

        if total == 0:
            self.metrics.average_duration_ms = duration_ms
        else:
            # Weighted moving average
            self.metrics.average_duration_ms = (
                (current_avg * (total - 1) + duration_ms) / total
            )

    def get_metrics(self) -> AgentMetrics:
        """
        Get current agent metrics.

        Returns:
            AgentMetrics with current statistics
        """
        return self.metrics

    async def _track_to_dashboard(
        self,
        task: AgentTask,
        status: str,
        duration_ms: float,
        error_message: Optional[str] = None
    ) -> None:
        """
        Send task execution metrics to admin dashboard.

        This is called automatically after task completion/failure
        to enable real-time monitoring in the admin UI.

        Args:
            task: Task that was executed
            status: "success" or "failed"
            duration_ms: Task execution duration
            error_message: Error message if failed
        """
        if not self.admin_tracker:
            return

        try:
            # Extract reasoning steps from current chain
            steps = []
            if self._current_chain_id and hasattr(self.reasoning, 'get_chain'):
                chain = self.reasoning.get_chain(self._current_chain_id)
                if chain:
                    steps = [
                        {
                            "type": step.get("type", "unknown"),
                            "content": step.get("content", ""),
                            "confidence": step.get("confidence", 1.0),
                            "timestamp": step.get("timestamp", datetime.now(timezone.utc).isoformat())
                        }
                        for step in chain.steps
                    ]

            # Extract user query from payload
            user_query = task.payload.get("query", "") if task.payload else ""
            if not user_query and hasattr(task, "description"):
                user_query = task.description

            # Calculate tokens and cost (placeholder for now)
            # TODO: Extract from vLLM client metrics
            tokens_used = 0
            cost = 0.0

            # Track to dashboard
            await self.admin_tracker.track_request(
                request_id=str(task.metadata.task_id),
                agent_id=self.agent_id,
                user_id=task.metadata.user_id,
                user_query=user_query or f"{task.task_type} task",
                intent=task.task_type,
                intent_confidence=1.0,  # TODO: Extract from orchestrator
                latency_ms=duration_ms,
                tokens_used=tokens_used,
                cost=cost,
                status=status,
                steps=steps,
                error_message=error_message
            )

        except Exception as e:
            # Don't let tracking errors affect agent execution
            self.logger.warning(f"Failed to track to admin dashboard: {e}")

    # ========== Utility Methods ==========

    async def wait_for_result(
        self,
        task_id: UUID,
        timeout: float = 30.0
    ) -> Dict[str, Any]:
        """
        Wait for task result from message bus.

        Args:
            task_id: Task identifier
            timeout: Timeout in seconds

        Returns:
            Task result dictionary

        Raises:
            AgentTimeoutError: If timeout is exceeded
        """
        if not self.message_bus:
            raise AgentError("Message bus not available")

        result_topic = f"tasks.{task_id}.result"
        result_future = asyncio.Future()

        async def result_handler(message: Dict[str, Any]):
            if not result_future.done():
                result_future.set_result(message["payload"])

        # Subscribe to result topic
        await self.message_bus.subscribe(result_topic, result_handler)

        try:
            result = await asyncio.wait_for(result_future, timeout=timeout)
            return result
        except asyncio.TimeoutError:
            raise AgentTimeoutError(
                f"Timeout waiting for result: {task_id}"
            )
