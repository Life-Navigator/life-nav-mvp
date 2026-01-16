"""
Vertex AI Gemini Client for Multi-Agent System

Drop-in replacement for VLLMClient with identical interface.
This allows zero-code-change migration from local vLLM to Vertex AI Gemini.
"""

import os
import time
import hashlib
import json
import asyncio
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass
from enum import Enum
import logging

# Vertex AI imports
from vertexai.generative_models import GenerativeModel, GenerationConfig
import vertexai

logger = logging.getLogger(__name__)


class LLMModel(str, Enum):
    """Supported Gemini models (matching vLLM interface)"""
    GEMINI_2_FLASH = "gemini-2.0-flash-exp"
    GEMINI_15_FLASH = "gemini-1.5-flash-002"
    GEMINI_15_PRO = "gemini-1.5-pro-002"


@dataclass
class LLMResponse:
    """Response structure matching VLLMClient interface"""
    content: str
    model: str
    tokens_used: int
    latency_ms: float
    finish_reason: str


@dataclass
class Message:
    """Message structure matching VLLMClient interface"""
    role: str
    content: str


class GeminiClient:
    """
    Vertex AI Gemini client with VLLMClient-compatible interface.

    This is a drop-in replacement - agents using vllm.chat() will work unchanged.
    """

    def __init__(
        self,
        instances: Optional[List[str]] = None,  # Ignored (for compatibility)
        model: str = LLMModel.GEMINI_2_FLASH,
        timeout: float = 60.0,
        max_retries: int = 3,
        enable_caching: bool = True,
        project_id: Optional[str] = None,
        location: str = "us-central1"
    ):
        """
        Initialize Gemini client.

        Args:
            instances: Ignored (for VLLMClient compatibility)
            model: Gemini model name
            timeout: Request timeout
            max_retries: Max retry attempts
            enable_caching: Enable response caching
            project_id: GCP project ID
            location: GCP region
        """
        self.project_id = project_id or os.getenv("GCP_PROJECT_ID")
        self.location = location
        self.model = model
        self.timeout = timeout
        self.max_retries = max_retries
        self.enable_caching = enable_caching

        # Initialize Vertex AI
        vertexai.init(project=self.project_id, location=self.location)

        # Initialize model
        self.client = GenerativeModel(
            model_name=self.model,
            generation_config=GenerationConfig(
                temperature=0.7,
                top_p=0.9,
                top_k=40,
                max_output_tokens=2048,
            )
        )

        # Tracking (VLLMClient compatibility)
        self._instance_health = {self.project_id: True}
        self._instance_latency = {self.project_id: 0.0}
        self._request_count = {self.project_id: 0}
        self._cache: Dict[str, LLMResponse] = {}

        # Cost tracking
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cost_usd = 0.0

        logger.info(
            "Gemini client initialized",
            extra={
                "project": self.project_id,
                "location": self.location,
                "model": self.model,
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
        """Initialize connection (compatibility method)"""
        await self.health_check_all()

    async def disconnect(self):
        """Close connection (compatibility method)"""
        pass

    async def health_check(self, instance_url: str) -> bool:
        """
        Health check (VLLMClient compatibility).

        Args:
            instance_url: Ignored (for compatibility)

        Returns:
            True if healthy
        """
        return await self._health_check()

    async def health_check_all(self) -> Dict[str, bool]:
        """Health check all instances (VLLMClient compatibility)"""
        is_healthy = await self._health_check()
        return {self.project_id: is_healthy}

    async def _health_check(self) -> bool:
        """Internal health check"""
        try:
            test_response = await self.chat(
                prompt="Respond with OK",
                temperature=0.0,
                max_tokens=5
            )
            self._instance_health[self.project_id] = True
            return True
        except Exception as e:
            logger.error(f"Gemini health check failed: {e}")
            self._instance_health[self.project_id] = False
            return False

    async def chat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024
    ) -> str:
        """
        Simple chat interface (VLLMClient-compatible).

        Args:
            prompt: User prompt
            system_prompt: System instruction
            temperature: Sampling temperature
            max_tokens: Max output tokens

        Returns:
            Generated text
        """
        # Build full prompt
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"

        # Check cache
        cache_key = self._get_cache_key(full_prompt, temperature, max_tokens)
        if self.enable_caching and cache_key in self._cache:
            logger.debug("Cache hit")
            return self._cache[cache_key].content

        # Retry loop
        last_error = None
        for attempt in range(self.max_retries):
            try:
                start_time = time.time()

                # Update config
                self.client._generation_config.temperature = temperature
                self.client._generation_config.max_output_tokens = max_tokens

                # Generate (run in executor to avoid blocking)
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.client.generate_content(full_prompt)
                )

                latency_ms = (time.time() - start_time) * 1000

                # Extract
                content = response.text
                usage = response.usage_metadata
                input_tokens = usage.prompt_token_count
                output_tokens = usage.candidates_token_count

                # Track
                self.total_input_tokens += input_tokens
                self.total_output_tokens += output_tokens
                self.total_cost_usd += self._calculate_cost(input_tokens, output_tokens)
                self._request_count[self.project_id] += 1
                self._instance_latency[self.project_id] = latency_ms

                # Cache
                llm_response = LLMResponse(
                    content=content,
                    model=self.model,
                    tokens_used=input_tokens + output_tokens,
                    latency_ms=latency_ms,
                    finish_reason="stop"
                )

                if self.enable_caching:
                    self._cache[cache_key] = llm_response

                logger.info(
                    "Gemini completion successful",
                    extra={
                        "tokens": input_tokens + output_tokens,
                        "latency_ms": latency_ms,
                        "attempt": attempt + 1
                    }
                )

                return content

            except Exception as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    backoff = 2 ** attempt
                    logger.warning(f"Retrying after {backoff}s (attempt {attempt + 1}): {e}")
                    await asyncio.sleep(backoff)
                else:
                    logger.error(f"Failed after {self.max_retries} attempts: {e}")
                    raise Exception(f"Gemini API error: {e}")

        raise Exception(f"Failed: {last_error}")

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
        Generate completion (VLLMClient-compatible).

        Args:
            messages: List of messages
            temperature: Sampling temperature
            max_tokens: Max output tokens
            top_p: Nucleus sampling
            stream: Streaming (not implemented)
            **kwargs: Additional parameters

        Returns:
            LLMResponse object
        """
        # Convert Message objects to dicts
        if messages and isinstance(messages[0], Message):
            messages = [{"role": msg.role, "content": msg.content} for msg in messages]

        # Extract system and user prompts
        system_prompt = None
        prompt_parts = []

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if role == "system":
                system_prompt = content
            elif role == "user":
                prompt_parts.append(content)

        prompt = "\n\n".join(prompt_parts)

        # Call chat
        content = await self.chat(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens
        )

        # Return structured response
        return LLMResponse(
            content=content,
            model=self.model,
            tokens_used=len(content.split()) * 1.3,  # Estimate
            latency_ms=0.0,  # Already tracked
            finish_reason="stop"
        )

    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost in USD"""
        input_cost = (input_tokens / 1_000_000) * 0.075
        output_cost = (output_tokens / 1_000_000) * 0.30
        return input_cost + output_cost

    def _get_cache_key(self, prompt: str, temperature: float, max_tokens: int) -> str:
        """Generate cache key"""
        data = {"prompt": prompt, "temp": temperature, "max": max_tokens, "model": self.model}
        return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()

    def get_stats(self) -> Dict[str, Any]:
        """Get statistics (VLLMClient-compatible)"""
        return {
            "instances": 1,
            "healthy_instances": 1 if self._instance_health[self.project_id] else 0,
            "total_requests": self._request_count[self.project_id],
            "cache_size": len(self._cache),
            "instance_health": self._instance_health.copy(),
            "instance_latency": self._instance_latency.copy(),
            "instance_requests": self._request_count.copy(),
            "total_cost_usd": self.total_cost_usd,
            "total_tokens": self.total_input_tokens + self.total_output_tokens
        }


# Global client (VLLMClient compatibility)
_global_client: Optional[GeminiClient] = None


async def get_gemini_client() -> GeminiClient:
    """Get or create global client"""
    global _global_client

    if _global_client is None:
        _global_client = GeminiClient()
        await _global_client.connect()
        logger.info("Global Gemini client created")

    return _global_client


async def cleanup_gemini_client():
    """Cleanup global client"""
    global _global_client

    if _global_client is not None:
        await _global_client.disconnect()
        _global_client = None
        logger.info("Global Gemini client cleaned up")


# Alias for VLLMClient compatibility
VLLMClient = GeminiClient
get_vllm_client = get_gemini_client
cleanup_vllm_client = cleanup_gemini_client
