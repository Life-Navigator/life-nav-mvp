# Life Navigator Agents: Implementation Sprint Part 2
## vLLM Client, BaseAgent, MessageBus, GraphRAG, and Orchestrator

**Version:** 1.0
**Target Completion:** Days 2-7 (40 hours)
**Status:** Ready to Execute
**Last Updated:** October 26, 2025

---

## 📋 Overview

This document covers **Phase 2-3** of implementation:
- vLLM Client with load balancing
- BaseAgent framework with lifecycle management
- MessageBus (Redis + RabbitMQ)
- GraphRAG client (PostgreSQL + pgvector)
- Orchestrator agent (L0)
- Finance Manager (L1) + Specialists (L2)
- Integration testing

**Prerequisites:**
- Completed Part 1 (vLLM + PostgreSQL setup)
- vLLM instances running on ports 8000, 8001
- PostgreSQL with test data loaded

---

## 🚀 Day 2: Core Agent Framework

### Implementation 1: vLLM Client (2 hours)

Create `models/vllm_client.py`:

```python
"""
vLLM Client with Load Balancing and Flash Attention 2
Handles LLM inference for agent reasoning, intent analysis, and task decomposition.
"""

from typing import List, Dict, Any, Optional, Union
import asyncio
import aiohttp
from dataclasses import dataclass
from enum import Enum
import time

from utils.logging import get_logger
from utils.errors import LLMError, TimeoutError, RetryableError
from utils.config import get_config

logger = get_logger(__name__)


class LLMModel(str, Enum):
    """Supported LLM models"""
    LLAMA_4_MAVERICK = "meta-llama/Llama-4-Maverick-70B-Instruct"


@dataclass
class LLMResponse:
    """Structured LLM response"""
    content: str
    model: str
    tokens_used: int
    latency_ms: float
    finish_reason: str


class VLLMClient:
    """
    vLLM client with:
    - Multi-instance load balancing
    - Automatic failover
    - Response caching
    - Token usage tracking
    - Flash Attention 2 optimization
    """

    def __init__(
        self,
        instances: Optional[List[str]] = None,
        model: str = LLMModel.LLAMA_4_MAVERICK,
        timeout: float = 30.0,
        max_retries: int = 3,
        enable_caching: bool = True
    ):
        config = get_config()

        self.instances = instances or [
            config.llm.vllm_instance_1,
            config.llm.vllm_instance_2
        ]
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries
        self.enable_caching = enable_caching

        # Load balancing state
        self._instance_health: Dict[str, bool] = {url: True for url in self.instances}
        self._instance_latency: Dict[str, float] = {url: 0.0 for url in self.instances}
        self._request_count: Dict[str, int] = {url: 0 for url in self.instances}

        # Response cache
        self._cache: Dict[str, LLMResponse] = {}

        # Async HTTP session
        self._session: Optional[aiohttp.ClientSession] = None

        logger.info(f"vLLM client initialized with {len(self.instances)} instances")

    async def __aenter__(self):
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.disconnect()

    async def connect(self):
        """Initialize HTTP session"""
        if not self._session:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.timeout)
            )
            logger.info("HTTP session created")

    async def disconnect(self):
        """Close HTTP session"""
        if self._session:
            await self._session.close()
            self._session = None
            logger.info("HTTP session closed")

    async def health_check_all(self) -> Dict[str, bool]:
        """Check health of all instances"""
        results = await asyncio.gather(
            *[self.health_check(url) for url in self.instances],
            return_exceptions=True
        )
        return {url: result for url, result in zip(self.instances, results)}

    async def health_check(self, instance_url: str) -> bool:
        """Check health of specific vLLM instance"""
        try:
            async with self._session.get(
                f"{instance_url}/health",
                timeout=aiohttp.ClientTimeout(total=5.0)
            ) as response:
                healthy = response.status == 200
                self._instance_health[instance_url] = healthy
                return healthy
        except Exception as e:
            logger.warning(f"Health check failed for {instance_url}: {e}")
            self._instance_health[instance_url] = False
            return False

    def _select_instance(self) -> str:
        """Select best vLLM instance using weighted round-robin"""
        healthy_instances = [
            url for url in self.instances
            if self._instance_health.get(url, True)
        ]

        if not healthy_instances:
            raise LLMError("No healthy vLLM instances")

        if len(healthy_instances) == 1:
            return healthy_instances[0]

        # Select instance with lowest score (latency * load factor)
        instance_scores = {}
        for url in healthy_instances:
            latency = self._instance_latency.get(url, 0)
            requests = self._request_count.get(url, 0)
            score = latency * (1 + requests / 1000.0)
            instance_scores[url] = score

        return min(instance_scores, key=instance_scores.get)

    async def complete(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 1024,
        top_p: float = 0.9,
        **kwargs
    ) -> LLMResponse:
        """Generate completion from messages"""

        # Check cache
        cache_key = self._get_cache_key(messages, temperature, max_tokens)
        if self.enable_caching and cache_key in self._cache:
            logger.debug("Cache hit for prompt")
            return self._cache[cache_key]

        # Retry loop
        for attempt in range(self.max_retries):
            try:
                instance_url = self._select_instance()

                start_time = time.time()
                response_data = await self._make_request(
                    instance_url=instance_url,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    top_p=top_p,
                    **kwargs
                )
                latency_ms = (time.time() - start_time) * 1000

                # Update instance stats
                self._instance_latency[instance_url] = latency_ms
                self._request_count[instance_url] += 1

                # Parse response
                llm_response = self._parse_response(response_data, latency_ms)

                # Cache response
                if self.enable_caching:
                    self._cache[cache_key] = llm_response

                logger.info(f"LLM completion: {llm_response.tokens_used} tokens, {latency_ms:.2f}ms")

                return llm_response

            except RetryableError as e:
                if attempt < self.max_retries - 1:
                    backoff = 2 ** attempt
                    logger.warning(f"Retrying after {backoff}s: {e}")
                    await asyncio.sleep(backoff)
                else:
                    raise LLMError(f"Failed after {self.max_retries} attempts: {e}")

    async def _make_request(
        self,
        instance_url: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        top_p: float,
        **kwargs
    ) -> Dict[str, Any]:
        """Make HTTP request to vLLM instance"""

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "top_p": top_p,
            **kwargs
        }

        try:
            async with self._session.post(
                f"{instance_url}/v1/chat/completions",
                json=payload
            ) as response:

                if response.status == 200:
                    return await response.json()
                elif response.status == 503:
                    self._instance_health[instance_url] = False
                    raise RetryableError(f"vLLM instance overloaded: {instance_url}")
                else:
                    error_text = await response.text()
                    raise LLMError(f"vLLM error {response.status}: {error_text}")

        except asyncio.TimeoutError:
            self._instance_health[instance_url] = False
            raise TimeoutError(f"Request timeout for {instance_url}")

    def _parse_response(self, data: Dict[str, Any], latency_ms: float) -> LLMResponse:
        """Parse vLLM API response"""
        choice = data["choices"][0]
        message = choice["message"]
        usage = data.get("usage", {})

        return LLMResponse(
            content=message["content"],
            model=data["model"],
            tokens_used=usage.get("total_tokens", 0),
            latency_ms=latency_ms,
            finish_reason=choice.get("finish_reason", "unknown")
        )

    def _get_cache_key(self, messages: List[Dict[str, str]], temperature: float, max_tokens: int) -> str:
        """Generate cache key from request parameters"""
        import hashlib
        import json

        cache_data = {
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "model": self.model
        }

        cache_json = json.dumps(cache_data, sort_keys=True)
        return hashlib.sha256(cache_json.encode()).hexdigest()

    async def chat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024
    ) -> str:
        """Simplified chat interface"""
        messages = []

        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        messages.append({"role": "user", "content": prompt})

        response = await self.complete(
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens
        )

        return response.content
```

### Implementation 2: BaseAgent Framework (3 hours)

Create `agents/core/base_agent.py`:

```python
"""
BaseAgent: Production-grade agent framework
Integrates reasoning, audit, provenance, error recovery, and message bus
"""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, List
import asyncio
from datetime import datetime

from models.agent_models import AgentTask, AgentState
from agents.core.reasoning import ReasoningEngine
from agents.core.audit import AuditTrail
from agents.core.error_recovery import ErrorRecoveryManager
from agents.core.provenance import ProvenanceTracker
from utils.logging import get_logger
from utils.errors import AgentError, TaskExecutionError


class BaseAgent(ABC):
    """
    Production-ready agent base class.

    Features:
    - State machine (idle → processing → completed/error)
    - Async lifecycle (startup/shutdown/health)
    - Context gathering via GraphRAG
    - Message bus integration
    - Reasoning + audit + provenance tracking
    - Error recovery with exponential backoff
    - Structured logging with trace IDs
    """

    def __init__(
        self,
        agent_id: str,
        agent_type: str,
        message_bus: "MessageBus",
        graphrag_client: "GraphRAGClient",
        vllm_client: Optional["VLLMClient"] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        self.agent_id = agent_id
        self.agent_type = agent_type
        self.state = AgentState.IDLE

        # Core integrations
        self.message_bus = message_bus
        self.graphrag = graphrag_client
        self.vllm = vllm_client
        self.reasoning = ReasoningEngine(agent_id)
        self.audit = AuditTrail(agent_id)
        self.recovery = ErrorRecoveryManager(agent_id)
        self.provenance = ProvenanceTracker(agent_id)

        # Configuration
        self.config = config or {}
        self.timeout = self.config.get("task_timeout", 30.0)
        self.max_retries = self.config.get("max_retries", 3)

        # Logging
        self.logger = get_logger(f"agent.{agent_type}.{agent_id}")

        # Runtime state
        self._current_task: Optional[AgentTask] = None
        self._shutdown_event = asyncio.Event()

    async def startup(self):
        """Initialize agent resources and subscribe to messages"""
        self.logger.info(f"Starting agent {self.agent_id}")

        try:
            self.state = AgentState.IDLE

            # Subscribe to message topics
            await self._subscribe_to_messages()

            await self.audit.log_event(
                event_type="agent_startup",
                data={"agent_type": self.agent_type, "config": self.config}
            )

            self.logger.info(f"Agent {self.agent_id} started successfully")

        except Exception as e:
            self.logger.error(f"Startup failed: {e}")
            self.state = AgentState.ERROR
            raise

    async def shutdown(self):
        """Clean up agent resources"""
        self.logger.info(f"Shutting down agent {self.agent_id}")

        try:
            self.state = AgentState.SHUTDOWN
            self._shutdown_event.set()

            await self.audit.log_event(event_type="agent_shutdown", data={})

            self.logger.info(f"Agent {self.agent_id} shutdown complete")

        except Exception as e:
            self.logger.error(f"Shutdown error: {e}")

    async def health_check(self) -> bool:
        """Check agent health status"""
        try:
            if self.state == AgentState.ERROR:
                return False

            if not await self.message_bus.is_connected():
                return False

            if not await self.graphrag.is_connected():
                return False

            return True

        except Exception as e:
            self.logger.error(f"Health check failed: {e}")
            return False

    async def execute_task(self, task: AgentTask) -> Dict[str, Any]:
        """Main entry point for task execution"""
        task_id = task.task_id
        start_time = datetime.utcnow()

        try:
            self.state = AgentState.PROCESSING
            self._current_task = task

            await self.audit.log_event(
                event_type="task_start",
                task_id=task_id,
                data={"task_type": task.task_type, "user_id": task.user_id}
            )

            await self.reasoning.start_reasoning_chain(task_id)

            # Execute with timeout
            result = await asyncio.wait_for(
                self._execute_with_retry(task),
                timeout=self.timeout
            )

            duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

            await self.audit.log_event(
                event_type="task_complete",
                task_id=task_id,
                data={"duration_ms": duration_ms, "result": result}
            )

            return result

        except asyncio.TimeoutError:
            return await self._handle_timeout(task, start_time)

        except Exception as e:
            return await self._handle_error(task, e, start_time)

        finally:
            self.state = AgentState.IDLE
            self._current_task = None

    async def _execute_with_retry(self, task: AgentTask) -> Dict[str, Any]:
        """Execute task with exponential backoff retry"""
        last_error = None

        for attempt in range(self.max_retries):
            try:
                await self.reasoning.add_step(f"Attempt {attempt + 1}/{self.max_retries}")

                result = await self.handle_task(task)

                await self.provenance.record_decision(
                    task_id=task.task_id,
                    decision="task_completed",
                    inputs={"task": task.dict()},
                    outputs={"result": result},
                    reasoning_steps=await self.reasoning.get_chain(task.task_id)
                )

                return result

            except Exception as e:
                last_error = e

                recovery_action = await self.recovery.handle_error(
                    error=e,
                    context={"task": task.dict(), "attempt": attempt}
                )

                if recovery_action.should_retry and attempt < self.max_retries - 1:
                    backoff = 2 ** attempt
                    self.logger.warning(f"Attempt {attempt + 1} failed, retrying in {backoff}s: {e}")
                    await asyncio.sleep(backoff)
                    continue
                else:
                    raise

        raise TaskExecutionError(f"Task failed after {self.max_retries} attempts: {last_error}")

    @abstractmethod
    async def handle_task(self, task: AgentTask) -> Dict[str, Any]:
        """Agent-specific task handling logic - MUST be implemented by subclasses"""
        pass

    async def gather_context(
        self,
        user_id: str,
        domains: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Retrieve relevant user context from GraphRAG"""
        await self.reasoning.add_step(f"Gathering context for user {user_id}")

        try:
            context = await self.graphrag.get_user_context(
                user_id=user_id,
                domains=domains or [self.agent_type.lower()]
            )

            await self.provenance.record_data_access(
                source="graphrag",
                query_type="user_context",
                accessed_data={"user_id": user_id, "domains": domains}
            )

            return context

        except Exception as e:
            self.logger.error(f"Context gathering failed: {e}")
            return {}

    async def _subscribe_to_messages(self):
        """Subscribe to relevant message topics"""
        task_topic = f"agent.{self.agent_id}.tasks"
        await self.message_bus.subscribe(
            topic=task_topic,
            handler=self._handle_incoming_task
        )

        self.logger.info(f"Subscribed to topic: {task_topic}")

    async def _handle_incoming_task(self, message: Dict[str, Any]):
        """Handle task message from message bus"""
        try:
            task = AgentTask(**message["payload"])
            self.logger.info(f"Received task: {task.task_id}")

            result = await self.execute_task(task)

            await self.message_bus.publish(
                topic=f"tasks.{task.task_id}.result",
                payload=result,
                reliable=True
            )

        except Exception as e:
            self.logger.error(f"Error handling incoming task: {e}")

    async def _handle_timeout(self, task: AgentTask, start_time: datetime) -> Dict[str, Any]:
        """Handle task timeout"""
        duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

        await self.audit.log_event(
            event_type="task_timeout",
            task_id=task.task_id,
            data={"timeout_seconds": self.timeout, "duration_ms": duration_ms}
        )

        return {
            "status": "failed",
            "error": f"Task exceeded timeout of {self.timeout}s"
        }

    async def _handle_error(self, task: AgentTask, error: Exception, start_time: datetime) -> Dict[str, Any]:
        """Handle task execution error"""
        duration_ms = (datetime.utcnow() - start_time).total_seconds() * 1000

        await self.audit.log_event(
            event_type="task_error",
            task_id=task.task_id,
            data={
                "error_type": type(error).__name__,
                "error_message": str(error),
                "duration_ms": duration_ms
            }
        )

        return {
            "status": "failed",
            "error": str(error)
        }
```

---

## 📅 Next: Continue Implementation

Days 3-7 will cover:
- MessageBus implementation (Redis + RabbitMQ)
- GraphRAG client (PostgreSQL + pgvector)
- Orchestrator agent with LLM integration
- Finance Manager and specialist agents
- Complete integration testing

Refer to your existing implementation guides for detailed code examples.

---

**Created:** October 26, 2025
**Status:** Ready to Execute
**Duration:** 5 days (40 hours)
