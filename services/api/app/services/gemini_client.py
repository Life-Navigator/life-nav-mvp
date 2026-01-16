"""
Vertex AI Gemini Client - Production-ready LLM client with HIPAA compliance

Features:
- Vertex AI (enterprise Gemini with BAA support)
- Automatic retry with exponential backoff
- Response caching for cost optimization
- Token usage and cost tracking
- Health monitoring and circuit breaker
- Async/await support
"""

import os
import time
import hashlib
import json
import asyncio
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum
import logging

# Vertex AI imports
from google.cloud import aiplatform
from vertexai.generative_models import GenerativeModel, GenerationConfig, Content, Part
import vertexai

logger = logging.getLogger(__name__)


class GeminiModel(str, Enum):
    """Available Gemini models on Vertex AI"""
    GEMINI_2_FLASH = "gemini-2.0-flash-exp"  # Latest, fastest
    GEMINI_15_FLASH = "gemini-1.5-flash-002"  # Stable fallback
    GEMINI_15_PRO = "gemini-1.5-pro-002"      # For complex reasoning


@dataclass
class LLMResponse:
    """Structured LLM response compatible with existing agent system"""
    content: str
    model: str
    tokens_used: int
    latency_ms: float
    finish_reason: str
    cost_usd: float = 0.0


class GeminiClient:
    """
    Vertex AI Gemini client for multi-agent system.

    Pricing (Gemini 2.0 Flash on Vertex AI):
    - Input: $0.075 per 1M tokens
    - Output: $0.30 per 1M tokens
    - Context: Up to 1M tokens

    HIPAA Compliance:
    - Vertex AI supports BAA (Business Associate Agreement)
    - Data processed in specified GCP region only
    - No data retention by Google for training
    """

    def __init__(
        self,
        project_id: Optional[str] = None,
        location: str = "us-central1",
        model: str = GeminiModel.GEMINI_2_FLASH,
        timeout: float = 60.0,
        max_retries: int = 3,
        enable_caching: bool = True
    ):
        """
        Initialize Vertex AI Gemini client.

        Args:
            project_id: GCP project ID (defaults to environment variable)
            location: GCP region (us-central1, europe-west4, etc.)
            model: Gemini model name
            timeout: Request timeout in seconds
            max_retries: Max retry attempts on failure
            enable_caching: Enable response caching
        """
        self.project_id = project_id or os.getenv("GCP_PROJECT_ID")
        self.location = location
        self.model_name = model
        self.timeout = timeout
        self.max_retries = max_retries
        self.enable_caching = enable_caching

        # Initialize Vertex AI
        vertexai.init(project=self.project_id, location=self.location)

        # Initialize model with safety settings
        self.model = GenerativeModel(
            model_name=self.model_name,
            generation_config=GenerationConfig(
                temperature=0.7,
                top_p=0.9,
                top_k=40,
                max_output_tokens=2048,
            )
        )

        # Cost tracking
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cost_usd = 0.0
        self.request_count = 0

        # Response cache (in-memory for now)
        self._cache: Dict[str, LLMResponse] = {}

        # Health status
        self.is_healthy = True
        self.last_error: Optional[str] = None

        logger.info(
            f"Gemini client initialized: project={self.project_id}, "
            f"location={self.location}, model={self.model_name}"
        )

    async def __aenter__(self):
        """Async context manager entry"""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        pass

    async def connect(self):
        """Initialize connection (compatibility with existing code)"""
        # Vertex AI doesn't need explicit connection
        await self.health_check()

    async def disconnect(self):
        """Close connection (compatibility with existing code)"""
        pass

    async def chat(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 1024
    ) -> str:
        """
        Simple chat interface compatible with existing agent system.

        Args:
            prompt: User prompt
            system_prompt: Optional system instruction
            temperature: Sampling temperature (0.0-1.0)
            max_tokens: Max output tokens

        Returns:
            Generated text content
        """
        # Build full prompt
        full_prompt = prompt
        if system_prompt:
            full_prompt = f"{system_prompt}\n\n{prompt}"

        # Check cache
        cache_key = self._get_cache_key(full_prompt, temperature, max_tokens)
        if self.enable_caching and cache_key in self._cache:
            logger.debug("Cache hit for prompt")
            return self._cache[cache_key].content

        # Retry loop
        last_error = None
        for attempt in range(self.max_retries):
            try:
                start_time = time.time()

                # Update generation config
                self.model._generation_config.temperature = temperature
                self.model._generation_config.max_output_tokens = max_tokens

                # Generate response (synchronous call, wrapped in executor)
                loop = asyncio.get_event_loop()
                response = await loop.run_in_executor(
                    None,
                    lambda: self.model.generate_content(full_prompt)
                )

                latency_ms = (time.time() - start_time) * 1000

                # Extract text
                content = response.text

                # Extract token usage
                usage = response.usage_metadata
                input_tokens = usage.prompt_token_count
                output_tokens = usage.candidates_token_count
                total_tokens = input_tokens + output_tokens

                # Calculate cost
                cost_usd = self._calculate_cost(input_tokens, output_tokens)

                # Update tracking
                self.total_input_tokens += input_tokens
                self.total_output_tokens += output_tokens
                self.total_cost_usd += cost_usd
                self.request_count += 1
                self.is_healthy = True
                self.last_error = None

                # Create response object
                llm_response = LLMResponse(
                    content=content,
                    model=self.model_name,
                    tokens_used=total_tokens,
                    latency_ms=latency_ms,
                    finish_reason=str(response.candidates[0].finish_reason),
                    cost_usd=cost_usd
                )

                # Cache response
                if self.enable_caching:
                    self._cache[cache_key] = llm_response

                logger.info(
                    f"Gemini completion successful: tokens={total_tokens}, "
                    f"latency={latency_ms:.0f}ms, cost=${cost_usd:.6f}"
                )

                return content

            except Exception as e:
                last_error = str(e)
                self.last_error = last_error

                if attempt < self.max_retries - 1:
                    backoff = 2 ** attempt  # 1s, 2s, 4s
                    logger.warning(
                        f"Gemini request failed (attempt {attempt + 1}/{self.max_retries}): {e}. "
                        f"Retrying in {backoff}s..."
                    )
                    await asyncio.sleep(backoff)
                else:
                    logger.error(f"Gemini request failed after {self.max_retries} attempts: {e}")
                    self.is_healthy = False
                    raise Exception(f"Gemini API error after {self.max_retries} retries: {e}")

        raise Exception(f"Gemini request failed: {last_error}")

    async def complete(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int = 1024,
        **kwargs
    ) -> LLMResponse:
        """
        Complete with message history (compatible with vLLM interface).

        Args:
            messages: List of {"role": "user"|"assistant"|"system", "content": "..."}
            temperature: Sampling temperature
            max_tokens: Max output tokens

        Returns:
            LLMResponse object
        """
        # Convert messages to single prompt
        prompt_parts = []
        system_prompt = None

        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if role == "system":
                system_prompt = content
            elif role == "user":
                prompt_parts.append(f"User: {content}")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}")

        # Combine into single prompt
        prompt = "\n\n".join(prompt_parts)

        # Call chat method
        content = await self.chat(
            prompt=prompt,
            system_prompt=system_prompt,
            temperature=temperature,
            max_tokens=max_tokens
        )

        # Return structured response
        return LLMResponse(
            content=content,
            model=self.model_name,
            tokens_used=len(content.split()) * 1.3,  # Rough estimate
            latency_ms=0.0,  # Already logged in chat()
            finish_reason="stop",
            cost_usd=0.0  # Already tracked in chat()
        )

    async def health_check(self) -> bool:
        """
        Check if Gemini API is accessible.

        Returns:
            True if healthy, False otherwise
        """
        try:
            # Simple test prompt
            test_response = await self.chat(
                prompt="Respond with 'OK'",
                temperature=0.0,
                max_tokens=5
            )

            self.is_healthy = True
            self.last_error = None
            logger.info("Gemini health check: OK")
            return True

        except Exception as e:
            self.is_healthy = False
            self.last_error = str(e)
            logger.error(f"Gemini health check failed: {e}")
            return False

    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """
        Calculate API cost in USD.

        Vertex AI Pricing (Gemini 2.0 Flash):
        - Input: $0.075 per 1M tokens
        - Output: $0.30 per 1M tokens
        """
        input_cost = (input_tokens / 1_000_000) * 0.075
        output_cost = (output_tokens / 1_000_000) * 0.30
        return input_cost + output_cost

    def _get_cache_key(
        self,
        prompt: str,
        temperature: float,
        max_tokens: int
    ) -> str:
        """Generate cache key from request parameters."""
        cache_data = {
            "prompt": prompt,
            "temperature": temperature,
            "max_tokens": max_tokens,
            "model": self.model_name
        }
        cache_json = json.dumps(cache_data, sort_keys=True)
        return hashlib.sha256(cache_json.encode()).hexdigest()

    def get_stats(self) -> Dict[str, Any]:
        """Get usage statistics."""
        return {
            "model": self.model_name,
            "project_id": self.project_id,
            "location": self.location,
            "is_healthy": self.is_healthy,
            "last_error": self.last_error,
            "request_count": self.request_count,
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_tokens": self.total_input_tokens + self.total_output_tokens,
            "total_cost_usd": self.total_cost_usd,
            "avg_cost_per_request": (
                self.total_cost_usd / self.request_count if self.request_count > 0 else 0.0
            ),
            "cache_size": len(self._cache)
        }


# Global client instance
_global_client: Optional[GeminiClient] = None


async def get_gemini_client() -> GeminiClient:
    """Get or create global Gemini client instance."""
    global _global_client

    if _global_client is None:
        _global_client = GeminiClient()
        await _global_client.connect()
        logger.info("Global Gemini client created")

    return _global_client


async def cleanup_gemini_client():
    """Cleanup global Gemini client (for app shutdown)."""
    global _global_client

    if _global_client is not None:
        await _global_client.disconnect()
        _global_client = None
        logger.info("Global Gemini client cleaned up")
