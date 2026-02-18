"""
Maverick LLM Client - Interface to locally-hosted LLM via vLLM
Optimized for DGX/GCP enterprise deployment with vLLM OpenAI-compatible API
"""

import httpx
from typing import Optional, Dict, Any, List
import logging

logger = logging.getLogger(__name__)


class MaverickClient:
    """Client for Maverick locally-hosted LLM (vLLM server on port 8090)"""

    def __init__(self, base_url: str = "http://localhost:8090", timeout: float = 60.0):
        self.base_url = base_url
        self.timeout = timeout
        self.client = httpx.AsyncClient(timeout=timeout)

    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()

    async def completion(
        self,
        prompt: str,
        n_predict: int = 500,
        temperature: float = 0.7,
        top_p: float = 0.9,
        top_k: int = 40,
        stop: Optional[List[str]] = None,
        stream: bool = False,
    ) -> Dict[str, Any]:
        """
        Request completion from Maverick LLM (vLLM OpenAI-compatible API)

        Args:
            prompt: The input prompt
            n_predict: Max tokens to generate (default 500)
            temperature: Sampling temperature 0.0-2.0 (default 0.7)
            top_p: Nucleus sampling threshold (default 0.9)
            top_k: Top-k sampling (default 40)
            stop: Stop sequences (default ["\nUser:", "\n\n"])
            stream: Stream response (default False)

        Returns:
            {
                "content": "Generated text...",
                "tokens_predicted": 123,
                "finish_reason": "stop"
            }
        """
        if stop is None:
            stop = ["\nUser:", "\n\n"]

        # vLLM uses OpenAI-compatible /v1/completions endpoint
        payload = {
            "model": "default",  # vLLM uses the loaded model
            "prompt": prompt,
            "max_tokens": n_predict,
            "temperature": temperature,
            "top_p": top_p,
            "stop": stop,
            "stream": stream,
        }

        try:
            logger.debug(f"Sending completion request to {self.base_url}/v1/completions")
            response = await self.client.post(
                f"{self.base_url}/v1/completions", json=payload
            )
            response.raise_for_status()
            result = response.json()

            # Extract from OpenAI format
            choice = result.get("choices", [{}])[0]
            return {
                "content": choice.get("text", ""),
                "tokens_predicted": result.get("usage", {}).get("completion_tokens", 0),
                "finish_reason": choice.get("finish_reason", "unknown")
            }

        except httpx.HTTPStatusError as e:
            logger.error(
                f"HTTP error from Maverick: {e.response.status_code} - {e.response.text}"
            )
            raise Exception(f"Maverick LLM error: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"Request error to Maverick: {str(e)}")
            raise Exception(f"Failed to connect to Maverick LLM: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error calling Maverick: {str(e)}")
            raise

    async def chat(
        self,
        messages: List[Dict[str, str]],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: int = 500,
    ) -> Dict[str, Any]:
        """
        Chat-style completion with message history (vLLM OpenAI-compatible API)

        Args:
            messages: List of {role: "user"|"assistant"|"system", content: "..."}
            system_prompt: Optional system prompt (prepended to messages)
            temperature: Sampling temperature
            max_tokens: Max tokens to generate

        Returns:
            {
                "content": "Assistant response",
                "tokens_predicted": 123,
                "role": "assistant",
                "finish_reason": "stop"
            }
        """
        # Build messages list for OpenAI format
        formatted_messages = []

        if system_prompt:
            formatted_messages.append({"role": "system", "content": system_prompt})

        formatted_messages.extend(messages)

        # vLLM uses OpenAI-compatible /v1/chat/completions endpoint
        payload = {
            "model": "default",  # vLLM uses the loaded model
            "messages": formatted_messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "top_p": 0.9,
        }

        try:
            logger.debug(f"Sending chat request to {self.base_url}/v1/chat/completions")
            response = await self.client.post(
                f"{self.base_url}/v1/chat/completions", json=payload
            )
            response.raise_for_status()
            result = response.json()

            # Extract from OpenAI format
            choice = result.get("choices", [{}])[0]
            message = choice.get("message", {})

            return {
                "content": message.get("content", "").strip(),
                "tokens_predicted": result.get("usage", {}).get("completion_tokens", 0),
                "role": "assistant",
                "finish_reason": choice.get("finish_reason", "stop"),
            }

        except httpx.HTTPStatusError as e:
            logger.error(
                f"HTTP error from Maverick: {e.response.status_code} - {e.response.text}"
            )
            raise Exception(f"Maverick LLM error: {e.response.status_code}")
        except httpx.RequestError as e:
            logger.error(f"Request error to Maverick: {str(e)}")
            raise Exception(f"Failed to connect to Maverick LLM: {str(e)}")
        except Exception as e:
            logger.error(f"Unexpected error calling Maverick: {str(e)}")
            raise

    async def health_check(self) -> bool:
        """
        Check if Maverick LLM is healthy

        Returns:
            True if healthy, False otherwise
        """
        try:
            response = await self.client.get(f"{self.base_url}/health", timeout=5.0)
            return response.status_code == 200
        except Exception as e:
            logger.warning(f"Maverick health check failed: {str(e)}")
            return False

    async def get_model_info(self) -> Dict[str, Any]:
        """
        Get model information (if endpoint exists)

        Returns:
            Model metadata dict
        """
        try:
            response = await self.client.get(f"{self.base_url}/props")
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.warning(f"Could not fetch model info: {str(e)}")
            return {"model": "maverick", "context_length": 4096, "status": "unknown"}


# Global client instance (will be initialized on app startup)
maverick_client: Optional[MaverickClient] = None


async def get_maverick_client() -> MaverickClient:
    """Dependency for FastAPI endpoints"""
    global maverick_client
    if maverick_client is None:
        maverick_client = MaverickClient()
    return maverick_client


async def shutdown_maverick_client():
    """Shutdown client on app shutdown"""
    global maverick_client
    if maverick_client:
        await maverick_client.close()
        maverick_client = None
