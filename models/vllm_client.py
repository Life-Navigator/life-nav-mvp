"""
vLLM Client with Load Balancing and Flash Attention 2

Handles LLM inference for agent reasoning, intent analysis, and task decomposition.
Provides automatic failover, response caching, and health monitoring.
"""

from typing import List, Dict, Any, Optional, Union
import asyncio
import aiohttp
from dataclasses import dataclass
from enum import Enum
import time
import hashlib
import json

from utils.logging import get_logger
from utils.errors import LLMError, LLMTimeoutError, LLMConnectionError
from utils.config import get_config

logger = get_logger(__name__)


class LLMModel(str, Enum):
    """Supported LLM models"""
    LLAMA_4_MAVERICK = "meta-llama/Llama-4-Maverick-17B-128E"
    LLAMA_4_MAVERICK_70B = "meta-llama/Llama-4-Maverick-70B-Instruct"  # Alternative larger model


@dataclass
class LLMResponse:
    """Structured LLM response

    Attributes:
        content: Generated text content
        model: Model identifier used
        tokens_used: Total tokens consumed
        latency_ms: Response latency in milliseconds
        finish_reason: Reason completion finished (stop, length, etc)
    """
    content: str
    model: str
    tokens_used: int
    latency_ms: float
    finish_reason: str


@dataclass
class Message:
    """Chat message

    Attributes:
        role: Message role (system, user, assistant)
        content: Message content
    """
    role: str
    content: str


class VLLMClient:
    """
    vLLM client with production features:
    - Multi-instance load balancing
    - Automatic failover on instance failure
    - Response caching for identical prompts
    - Token usage tracking
    - Flash Attention 2 optimization (automatic)

    Example:
        >>> async with VLLMClient() as client:
        ...     response = await client.chat("What is 2+2?")
        ...     print(response)
    """

    def __init__(
        self,
        instances: Optional[List[str]] = None,
        model: str = LLMModel.LLAMA_4_MAVERICK,
        timeout: float = 30.0,
        max_retries: int = 3,
        enable_caching: bool = True
    ):
        """
        Initialize vLLM client.

        Args:
            instances: List of vLLM instance URLs. Defaults to config values.
            model: Model identifier to use
            timeout: Request timeout in seconds
            max_retries: Max retry attempts on failure
            enable_caching: Enable response caching for identical prompts
        """
        config = get_config()

        # Use configured instances if not provided
        self.instances = instances or [
            config.llm.instance_1,
            config.llm.instance_2
        ]
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries
        self.enable_caching = enable_caching

        # Load balancing state
        self._instance_health: Dict[str, bool] = {url: True for url in self.instances}
        self._instance_latency: Dict[str, float] = {url: 0.0 for url in self.instances}
        self._request_count: Dict[str, int] = {url: 0 for url in self.instances}

        # Response cache (simple in-memory for now)
        self._cache: Dict[str, LLMResponse] = {}

        # Async HTTP session
        self._session: Optional[aiohttp.ClientSession] = None

        logger.info(
            f"vLLM client initialized",
            extra={
                "instances": len(self.instances),
                "model": self.model,
                "timeout": self.timeout,
                "caching_enabled": self.enable_caching
            }
        )

    async def __aenter__(self):
        """Async context manager entry"""
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.disconnect()

    async def connect(self):
        """Initialize HTTP session and verify instances"""
        if not self._session:
            self._session = aiohttp.ClientSession(
                timeout=aiohttp.ClientTimeout(total=self.timeout)
            )
            logger.info("HTTP session created")

            # Initial health check of all instances
            await self.health_check_all()

    async def disconnect(self):
        """Close HTTP session"""
        if self._session:
            await self._session.close()
            self._session = None
            logger.info("HTTP session closed")

    async def health_check(self, instance_url: str) -> bool:
        """
        Check health of specific vLLM instance.

        Args:
            instance_url: URL of vLLM instance to check

        Returns:
            True if instance is healthy and responsive
        """
        try:
            async with self._session.get(
                f"{instance_url}/health",
                timeout=aiohttp.ClientTimeout(total=5.0)
            ) as response:
                healthy = response.status == 200
                self._instance_health[instance_url] = healthy

                if healthy:
                    logger.debug(f"Instance healthy: {instance_url}")
                else:
                    logger.warning(f"Instance unhealthy: {instance_url} (status {response.status})")

                return healthy

        except Exception as e:
            logger.warning(f"Health check failed for {instance_url}: {e}")
            self._instance_health[instance_url] = False
            return False

    async def health_check_all(self) -> Dict[str, bool]:
        """
        Check health of all configured instances.

        Returns:
            Dictionary mapping instance URLs to health status
        """
        results = await asyncio.gather(
            *[self.health_check(url) for url in self.instances],
            return_exceptions=True
        )

        health_status = {}
        for url, result in zip(self.instances, results):
            if isinstance(result, Exception):
                health_status[url] = False
                logger.error(f"Health check exception for {url}: {result}")
            else:
                health_status[url] = result

        healthy_count = sum(1 for h in health_status.values() if h)
        logger.info(f"Health check complete: {healthy_count}/{len(self.instances)} instances healthy")

        return health_status

    def _select_instance(self) -> str:
        """
        Select best vLLM instance using weighted round-robin.

        Considers:
        - Health status (unhealthy instances excluded)
        - Recent latency (prefer faster instances)
        - Request count (balance load across instances)

        Returns:
            Selected instance URL

        Raises:
            LLMError: If no healthy instances available
        """
        # Filter to healthy instances
        healthy_instances = [
            url for url in self.instances
            if self._instance_health.get(url, True)
        ]

        if not healthy_instances:
            logger.error("No healthy vLLM instances available")
            raise LLMError("No healthy vLLM instances")

        # If only one healthy instance, use it
        if len(healthy_instances) == 1:
            return healthy_instances[0]

        # Select instance with lowest score
        # Score = latency * (1 + requests/1000)
        # Penalizes both slow instances and overloaded instances
        instance_scores = {}
        for url in healthy_instances:
            latency = self._instance_latency.get(url, 0)
            requests = self._request_count.get(url, 0)

            # Avoid division by zero for first request
            if latency == 0:
                latency = 100  # Default score for untested instances

            score = latency * (1 + requests / 1000.0)
            instance_scores[url] = score

        # Select instance with lowest score
        selected = min(instance_scores, key=instance_scores.get)

        logger.debug(
            f"Selected instance: {selected}",
            extra={
                "latency_ms": self._instance_latency[selected],
                "request_count": self._request_count[selected],
                "score": instance_scores[selected]
            }
        )

        return selected

    async def complete(
        self,
        messages: Union[List[Message], List[Dict[str, str]]],
        temperature: float = 0.7,
        max_tokens: int = 1024,
        top_p: float = 0.9,
        stream: bool = False,
        **kwargs
    ) -> LLMResponse:
        """
        Generate completion from messages.

        Args:
            messages: List of chat messages (Message objects or dicts)
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Maximum tokens to generate
            top_p: Nucleus sampling parameter
            stream: Enable streaming (not yet implemented)
            **kwargs: Additional vLLM parameters

        Returns:
            LLMResponse with generated text and metadata

        Raises:
            LLMError: If all retry attempts fail
        """
        # Convert Message objects to dicts if needed
        if messages and isinstance(messages[0], Message):
            messages = [{"role": msg.role, "content": msg.content} for msg in messages]

        # Check cache
        cache_key = self._get_cache_key(messages, temperature, max_tokens)
        if self.enable_caching and cache_key in self._cache:
            logger.debug("Cache hit for prompt")
            return self._cache[cache_key]

        # Retry loop with exponential backoff
        last_error = None
        for attempt in range(self.max_retries):
            try:
                # Select best instance
                instance_url = self._select_instance()

                # Make request
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

                logger.info(
                    "LLM completion successful",
                    extra={
                        "tokens": llm_response.tokens_used,
                        "latency_ms": latency_ms,
                        "instance": instance_url,
                        "attempt": attempt + 1
                    }
                )

                return llm_response

            except (LLMConnectionError, LLMTimeoutError) as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    backoff = 2 ** attempt  # 1s, 2s, 4s exponential backoff
                    logger.warning(
                        f"Retrying after {backoff}s (attempt {attempt + 1}/{self.max_retries}): {e}"
                    )
                    await asyncio.sleep(backoff)
                else:
                    logger.error(f"Max retries exceeded: {e}")
                    raise LLMError(f"Failed after {self.max_retries} attempts: {e}")

            except Exception as e:
                logger.error(f"LLM request failed: {e}", exc_info=True)
                raise LLMError(f"LLM request error: {e}")

        # Should not reach here, but just in case
        raise LLMError(f"All retry attempts failed: {last_error}")

    async def _make_request(
        self,
        instance_url: str,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int,
        top_p: float,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Make HTTP request to vLLM instance.

        Args:
            instance_url: URL of vLLM instance
            messages: Chat messages
            temperature: Sampling temperature
            max_tokens: Max tokens to generate
            top_p: Nucleus sampling parameter
            **kwargs: Additional parameters

        Returns:
            Raw JSON response from vLLM

        Raises:
            RetryableError: For transient errors (503, timeouts)
            LLMError: For permanent errors (400, 401, etc)
        """
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
                    # Service unavailable - mark instance as unhealthy and retry
                    self._instance_health[instance_url] = False
                    raise LLMConnectionError(f"vLLM instance overloaded: {instance_url}")

                else:
                    error_text = await response.text()
                    logger.error(
                        f"vLLM error response",
                        extra={
                            "status": response.status,
                            "instance": instance_url,
                            "error": error_text
                        }
                    )
                    raise LLMError(f"vLLM error {response.status}: {error_text}")

        except asyncio.TimeoutError:
            self._instance_health[instance_url] = False
            raise LLMTimeoutError(f"Request timeout for {instance_url}")

        except aiohttp.ClientError as e:
            self._instance_health[instance_url] = False
            raise LLMConnectionError(f"Connection error: {e}")

    def _parse_response(self, data: Dict[str, Any], latency_ms: float) -> LLMResponse:
        """
        Parse vLLM API response into LLMResponse object.

        Args:
            data: Raw JSON response
            latency_ms: Measured latency

        Returns:
            Structured LLMResponse

        Raises:
            LLMError: If response format is invalid
        """
        try:
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
        except (KeyError, IndexError) as e:
            logger.error(f"Invalid vLLM response format: {e}", extra={"response": data})
            raise LLMError(f"Invalid vLLM response format: {e}")

    def _get_cache_key(
        self,
        messages: List[Dict[str, str]],
        temperature: float,
        max_tokens: int
    ) -> str:
        """
        Generate cache key from request parameters.

        Args:
            messages: Chat messages
            temperature: Sampling temperature
            max_tokens: Max tokens

        Returns:
            SHA256 hash of request parameters
        """
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
        """
        Simplified chat interface for single-turn conversations.

        Args:
            prompt: User prompt
            system_prompt: Optional system prompt for context
            temperature: Sampling temperature
            max_tokens: Max tokens to generate

        Returns:
            Generated text content

        Example:
            >>> response = await client.chat("What is the capital of France?")
            >>> print(response)
            "The capital of France is Paris."
        """
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

    def get_stats(self) -> Dict[str, Any]:
        """
        Get current client statistics.

        Returns:
            Dictionary with client statistics
        """
        return {
            "instances": len(self.instances),
            "healthy_instances": sum(1 for h in self._instance_health.values() if h),
            "total_requests": sum(self._request_count.values()),
            "cache_size": len(self._cache),
            "instance_health": self._instance_health.copy(),
            "instance_latency": self._instance_latency.copy(),
            "instance_requests": self._request_count.copy()
        }


# Global vLLM client instance (lazy initialization)
_global_client: Optional[VLLMClient] = None


async def get_vllm_client() -> VLLMClient:
    """
    Get or create global vLLM client instance.

    Returns:
        Shared VLLMClient instance
    """
    global _global_client

    if _global_client is None:
        _global_client = VLLMClient()
        await _global_client.connect()
        logger.info("Global vLLM client created")

    return _global_client


async def cleanup_vllm_client():
    """
    Cleanup global vLLM client instance.
    Call this on application shutdown.
    """
    global _global_client

    if _global_client is not None:
        await _global_client.disconnect()
        _global_client = None
        logger.info("Global vLLM client cleaned up")
