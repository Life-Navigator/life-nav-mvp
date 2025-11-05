"""Agent Coordinator - Orchestrates Multi-Agent Collaboration"""

import asyncio
from typing import Dict, List, Any, Optional, Set
from datetime import datetime
import structlog

from ..base.agent import BaseAgent, AgentStatus, AgentCapability
from ..base.message import (
    Message,
    MessageType,
    MessagePriority,
    TaskRequest,
    TaskResponse
)
from ..base.message_bus import MessageBus

logger = structlog.get_logger(__name__)


class AgentCoordinator:
    """
    Coordinates multiple agents in the A2A framework.

    Features:
    - Agent registration and discovery
    - Capability-based task routing
    - Load balancing across agents
    - Health monitoring
    - Task delegation and result aggregation

    Usage:
        coordinator = AgentCoordinator(message_bus)
        await coordinator.start()

        # Register agents
        await coordinator.register_agent(research_agent)
        await coordinator.register_agent(analyst_agent)

        # Delegate task
        result = await coordinator.delegate_task(task_request)
    """

    def __init__(self, message_bus: MessageBus):
        self.message_bus = message_bus

        # Agent registry: agent_id -> agent instance
        self._agents: Dict[str, BaseAgent] = {}

        # Capability index: capability -> set of agent_ids
        self._capability_index: Dict[AgentCapability, Set[str]] = {}

        # Agent load: agent_id -> number of active tasks
        self._agent_load: Dict[str, int] = {}

        # Statistics
        self._stats = {
            "tasks_delegated": 0,
            "tasks_completed": 0,
            "tasks_failed": 0,
            "agents_registered": 0,
            "agents_active": 0,
        }

        self._running = False
        self._monitor_task: Optional[asyncio.Task] = None

    async def start(self) -> None:
        """Start the coordinator"""
        if self._running:
            logger.warning("coordinator_already_running")
            return

        self._running = True

        # Start health monitoring
        self._monitor_task = asyncio.create_task(self._monitor_agents())

        logger.info("coordinator_started")

    async def stop(self) -> None:
        """Stop the coordinator"""
        if not self._running:
            return

        self._running = False

        # Stop monitoring
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass

        # Stop all agents
        for agent in self._agents.values():
            try:
                await agent.stop()
            except Exception as e:
                logger.error(
                    "agent_stop_failed",
                    agent_id=agent.agent_id,
                    error=str(e)
                )

        logger.info("coordinator_stopped", stats=self._stats)

    async def register_agent(self, agent: BaseAgent) -> None:
        """
        Register an agent with the coordinator.

        Args:
            agent: Agent instance to register
        """
        agent_id = agent.agent_id

        # Add to registry
        self._agents[agent_id] = agent
        self._agent_load[agent_id] = 0

        # Index capabilities
        for capability in agent.config.capabilities:
            if capability not in self._capability_index:
                self._capability_index[capability] = set()
            self._capability_index[capability].add(agent_id)

        self._stats["agents_registered"] += 1
        if agent.status == AgentStatus.READY:
            self._stats["agents_active"] += 1

        logger.info(
            "agent_registered",
            agent_id=agent_id,
            name=agent.name,
            capabilities=[c.value for c in agent.config.capabilities]
        )

    async def unregister_agent(self, agent_id: str) -> None:
        """Unregister an agent"""
        if agent_id not in self._agents:
            logger.warning("agent_not_found", agent_id=agent_id)
            return

        agent = self._agents[agent_id]

        # Remove from capability index
        for capability in agent.config.capabilities:
            if capability in self._capability_index:
                self._capability_index[capability].discard(agent_id)

        # Remove from registry
        del self._agents[agent_id]
        del self._agent_load[agent_id]

        self._stats["agents_registered"] -= 1

        logger.info("agent_unregistered", agent_id=agent_id)

    async def delegate_task(
        self,
        task: TaskRequest,
        timeout: Optional[float] = None
    ) -> Optional[TaskResponse]:
        """
        Delegate a task to the most appropriate agent.

        Args:
            task: Task to delegate
            timeout: Response timeout in seconds

        Returns:
            Task response or None if failed/timeout
        """
        self._stats["tasks_delegated"] += 1

        # Find agents with required capabilities
        capable_agents = self._find_capable_agents(task)

        if not capable_agents:
            logger.warning(
                "no_capable_agents",
                task_id=task.task_id,
                requirements=task.requirements
            )
            self._stats["tasks_failed"] += 1
            return TaskResponse(
                task_id=task.task_id,
                status="failed",
                error="No agents available with required capabilities"
            )

        # Select best agent based on load
        agent_id = self._select_agent(capable_agents)
        agent = self._agents[agent_id]

        logger.info(
            "delegating_task",
            task_id=task.task_id,
            task_type=task.task_type,
            agent_id=agent_id,
            agent_name=agent.name
        )

        # Update load
        self._agent_load[agent_id] += 1

        try:
            # Send task to agent
            response = await agent.send_task(
                task=task,
                recipient=agent_id,
                timeout=timeout or task.deadline.timestamp() if task.deadline else 30.0
            )

            if response and response.status == "success":
                self._stats["tasks_completed"] += 1
            else:
                self._stats["tasks_failed"] += 1

            return response

        except Exception as e:
            logger.error(
                "task_delegation_failed",
                task_id=task.task_id,
                agent_id=agent_id,
                error=str(e),
                exc_info=True
            )
            self._stats["tasks_failed"] += 1
            return TaskResponse(
                task_id=task.task_id,
                status="failed",
                error=str(e)
            )

        finally:
            # Update load
            self._agent_load[agent_id] -= 1

    async def delegate_to_multiple(
        self,
        task: TaskRequest,
        num_agents: int = 3,
        timeout: Optional[float] = None
    ) -> List[TaskResponse]:
        """
        Delegate the same task to multiple agents and aggregate results.

        Useful for:
        - Consensus building
        - Quality improvement through voting
        - Redundancy and reliability

        Args:
            task: Task to delegate
            num_agents: Number of agents to use
            timeout: Response timeout

        Returns:
            List of task responses
        """
        # Find capable agents
        capable_agents = self._find_capable_agents(task)

        if not capable_agents:
            return []

        # Select top N agents
        selected_agents = self._select_multiple_agents(capable_agents, num_agents)

        # Send task to all selected agents in parallel
        tasks = []
        for agent_id in selected_agents:
            agent = self._agents[agent_id]
            self._agent_load[agent_id] += 1

            task_future = agent.send_task(
                task=task,
                recipient=agent_id,
                timeout=timeout or 30.0
            )
            tasks.append((agent_id, task_future))

        # Gather results
        responses = []
        for agent_id, task_future in tasks:
            try:
                response = await task_future
                if response:
                    responses.append(response)
            except Exception as e:
                logger.error(
                    "parallel_task_failed",
                    agent_id=agent_id,
                    task_id=task.task_id,
                    error=str(e)
                )
            finally:
                self._agent_load[agent_id] -= 1

        return responses

    async def broadcast_task(
        self,
        task: TaskRequest,
        capability: Optional[AgentCapability] = None
    ) -> None:
        """
        Broadcast a task to all agents (or agents with specific capability).

        Args:
            task: Task to broadcast
            capability: Optional capability filter
        """
        # Create message
        message = task.to_message(
            sender="coordinator",
            recipient=None  # Broadcast
        )

        if capability:
            # Send to topic
            message.topic = f"task.{capability.value}"

        await self.message_bus.send(message)

        logger.info(
            "task_broadcast",
            task_id=task.task_id,
            capability=capability.value if capability else "all"
        )

    def _find_capable_agents(self, task: TaskRequest) -> List[str]:
        """Find agents capable of handling a task"""
        if not task.requirements:
            # No requirements - all ready agents can handle it
            return [
                agent_id
                for agent_id, agent in self._agents.items()
                if agent.status == AgentStatus.READY
            ]

        # Find agents with all required capabilities
        capable = None
        for req in task.requirements:
            try:
                capability = AgentCapability(req)
                agent_ids = self._capability_index.get(capability, set())

                if capable is None:
                    capable = set(agent_ids)
                else:
                    capable &= agent_ids
            except ValueError:
                logger.warning("unknown_capability", capability=req)

        # Filter by status
        if capable:
            capable = [
                agent_id
                for agent_id in capable
                if self._agents[agent_id].status == AgentStatus.READY
            ]
            return list(capable)

        return []

    def _select_agent(self, agent_ids: List[str]) -> str:
        """Select the best agent based on current load"""
        if not agent_ids:
            raise ValueError("No agents available")

        # Simple load balancing - select agent with lowest load
        return min(agent_ids, key=lambda aid: self._agent_load.get(aid, 0))

    def _select_multiple_agents(
        self,
        agent_ids: List[str],
        count: int
    ) -> List[str]:
        """Select multiple agents based on load"""
        if not agent_ids:
            return []

        # Sort by load and take top N
        sorted_agents = sorted(
            agent_ids,
            key=lambda aid: self._agent_load.get(aid, 0)
        )

        return sorted_agents[:min(count, len(sorted_agents))]

    async def _monitor_agents(self) -> None:
        """Monitor agent health"""
        while self._running:
            try:
                await asyncio.sleep(30)  # Check every 30 seconds

                active_count = 0
                for agent_id, agent in self._agents.items():
                    status = agent.status

                    if status == AgentStatus.READY:
                        active_count += 1
                    elif status == AgentStatus.ERROR:
                        logger.warning(
                            "agent_error_detected",
                            agent_id=agent_id,
                            name=agent.name
                        )

                self._stats["agents_active"] = active_count

                logger.debug(
                    "agent_health_check",
                    total_agents=len(self._agents),
                    active_agents=active_count,
                    total_load=sum(self._agent_load.values())
                )

            except Exception as e:
                logger.error(
                    "monitoring_error",
                    error=str(e),
                    exc_info=True
                )

    def get_agent(self, agent_id: str) -> Optional[BaseAgent]:
        """Get agent by ID"""
        return self._agents.get(agent_id)

    def list_agents(self) -> List[Dict[str, Any]]:
        """List all registered agents"""
        return [
            {
                "agent_id": agent.agent_id,
                "name": agent.name,
                "status": agent.status.value,
                "capabilities": [c.value for c in agent.config.capabilities],
                "active_tasks": self._agent_load.get(agent.agent_id, 0),
            }
            for agent in self._agents.values()
        ]

    def get_agents_by_capability(
        self,
        capability: AgentCapability
    ) -> List[BaseAgent]:
        """Get all agents with a specific capability"""
        agent_ids = self._capability_index.get(capability, set())
        return [self._agents[aid] for aid in agent_ids if aid in self._agents]

    def get_stats(self) -> Dict[str, Any]:
        """Get coordinator statistics"""
        return {
            **self._stats,
            "agents_by_capability": {
                cap.value: len(agents)
                for cap, agents in self._capability_index.items()
            },
            "total_load": sum(self._agent_load.values()),
            "avg_load": (
                sum(self._agent_load.values()) / len(self._agent_load)
                if self._agent_load else 0
            ),
        }
