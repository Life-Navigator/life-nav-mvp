"""
LN-Core Multi-Agent System Client.

Handles authenticated communication with the ln-core service in ln-core-prod
for AI agent operations including chat, task execution, and orchestration.

Uses Google Cloud Run service-to-service authentication via ID tokens.
"""

from typing import Any
import httpx
import google.auth
import google.auth.transport.requests
from google.oauth2 import id_token

from app.core.config import settings
from app.core.logging import logger


class LNCoreClientError(Exception):
    """Custom exception for LN-Core client errors."""
    pass


class LNCoreClient:
    """
    Client for the LN-Core Multi-Agent System.

    Provides authenticated access to the ln-core service for:
    - Chat/conversation with AI agents
    - Task execution
    - Agent orchestration
    """

    def __init__(self):
        self._base_url = settings.LN_CORE_URL
        self._timeout = settings.LN_CORE_TIMEOUT
        self._client: httpx.AsyncClient | None = None
        self._id_token: str | None = None

    async def _get_id_token(self) -> str:
        """
        Get Google Cloud ID token for service-to-service authentication.

        Uses the service account credentials to obtain an ID token
        that can be used to authenticate with Cloud Run services.
        """
        if not self._base_url:
            raise LNCoreClientError("LN_CORE_URL not configured")

        try:
            # Get credentials and create a request session
            credentials, project = google.auth.default()
            auth_req = google.auth.transport.requests.Request()

            # Fetch ID token for the target audience (ln-core URL)
            token = id_token.fetch_id_token(auth_req, self._base_url)
            return token

        except Exception as e:
            logger.error("Failed to get ID token for ln-core", error=str(e))
            raise LNCoreClientError(f"Authentication failed: {e}")

    async def _ensure_client(self) -> httpx.AsyncClient:
        """Ensure httpx client is initialized with proper auth headers."""
        if self._client is None or self._client.is_closed:
            token = await self._get_id_token()
            self._client = httpx.AsyncClient(
                base_url=self._base_url,
                timeout=self._timeout,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
            )
        return self._client

    async def close(self):
        """Close the HTTP client."""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None

    async def health_check(self) -> dict[str, Any]:
        """
        Check the health of the ln-core service.

        Returns:
            Health status including service availability and version.
        """
        if not self._base_url:
            return {
                "status": "unavailable",
                "error": "LN_CORE_URL not configured",
            }

        try:
            client = await self._ensure_client()
            response = await client.get("/health")
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error("LN-Core health check failed", status=e.response.status_code)
            return {"status": "unhealthy", "error": str(e)}
        except Exception as e:
            logger.error("LN-Core health check error", error=str(e))
            return {"status": "error", "error": str(e)}

    async def chat(
        self,
        agent_id: str,
        message: str,
        user_id: str,
        conversation_id: str | None = None,
        system_prompt_override: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> dict[str, Any]:
        """
        Send a chat message to an agent in ln-core.

        Args:
            agent_id: The ID of the agent to chat with
            message: The user's message
            user_id: The user's ID for context
            conversation_id: Optional existing conversation ID to continue
            system_prompt_override: Optional system prompt to override agent's default
            temperature: Optional temperature override
            max_tokens: Optional max tokens override

        Returns:
            Chat response including agent's reply and metadata.
        """
        if not self._base_url:
            raise LNCoreClientError("LN_CORE_URL not configured")

        client = await self._ensure_client()

        payload = {
            "message": message,
        }
        if conversation_id:
            payload["conversation_id"] = conversation_id
        if system_prompt_override:
            payload["system_prompt_override"] = system_prompt_override
        if temperature is not None:
            payload["temperature"] = temperature
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens

        try:
            response = await client.post(
                f"/api/v1/agents/{agent_id}/chat",
                json=payload,
                headers={"X-User-ID": user_id},
            )
            response.raise_for_status()

            result = response.json()
            logger.info(
                "LN-Core chat completed",
                agent_id=agent_id,
                conversation_id=result.get("conversation_id"),
                tokens_used=result.get("tokens_used"),
            )
            return result

        except httpx.HTTPStatusError as e:
            logger.error(
                "LN-Core chat failed",
                agent_id=agent_id,
                status=e.response.status_code,
                error=e.response.text,
            )
            raise LNCoreClientError(f"Chat request failed: {e.response.status_code}")
        except Exception as e:
            logger.error("LN-Core chat error", agent_id=agent_id, error=str(e))
            raise LNCoreClientError(f"Chat request error: {e}")

    async def execute_task(
        self,
        agent_id: str,
        task_type: str,
        input_text: str,
        user_id: str,
        context: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """
        Execute a task with an agent in ln-core.

        Args:
            agent_id: The ID of the agent to execute the task
            task_type: Type of task (e.g., "analysis", "planning", "research")
            input_text: The task input/instructions
            user_id: The user's ID for context
            context: Optional additional context for the task

        Returns:
            Task result including output and metadata.
        """
        if not self._base_url:
            raise LNCoreClientError("LN_CORE_URL not configured")

        client = await self._ensure_client()

        payload = {
            "task_type": task_type,
            "input_text": input_text,
        }
        if context:
            payload["context"] = context

        try:
            response = await client.post(
                f"/api/v1/agents/{agent_id}/tasks",
                json=payload,
                headers={"X-User-ID": user_id},
            )
            response.raise_for_status()

            result = response.json()
            logger.info(
                "LN-Core task completed",
                agent_id=agent_id,
                task_type=task_type,
                status=result.get("status"),
            )
            return result

        except httpx.HTTPStatusError as e:
            logger.error(
                "LN-Core task failed",
                agent_id=agent_id,
                task_type=task_type,
                status=e.response.status_code,
            )
            raise LNCoreClientError(f"Task execution failed: {e.response.status_code}")
        except Exception as e:
            logger.error("LN-Core task error", agent_id=agent_id, error=str(e))
            raise LNCoreClientError(f"Task execution error: {e}")

    async def list_agents(self, user_id: str) -> list[dict[str, Any]]:
        """
        List available agents for a user.

        Args:
            user_id: The user's ID

        Returns:
            List of agent configurations.
        """
        if not self._base_url:
            raise LNCoreClientError("LN_CORE_URL not configured")

        client = await self._ensure_client()

        try:
            response = await client.get(
                "/api/v1/agents/",
                headers={"X-User-ID": user_id},
            )
            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error("LN-Core list agents failed", status=e.response.status_code)
            raise LNCoreClientError(f"List agents failed: {e.response.status_code}")
        except Exception as e:
            logger.error("LN-Core list agents error", error=str(e))
            raise LNCoreClientError(f"List agents error: {e}")

    async def get_conversations(
        self,
        agent_id: str,
        user_id: str,
        skip: int = 0,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """
        Get conversations for an agent.

        Args:
            agent_id: The agent ID
            user_id: The user's ID
            skip: Number of conversations to skip
            limit: Maximum number of conversations to return

        Returns:
            List of conversations.
        """
        if not self._base_url:
            raise LNCoreClientError("LN_CORE_URL not configured")

        client = await self._ensure_client()

        try:
            response = await client.get(
                f"/api/v1/agents/{agent_id}/conversations",
                params={"skip": skip, "limit": limit},
                headers={"X-User-ID": user_id},
            )
            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error("LN-Core get conversations failed", status=e.response.status_code)
            raise LNCoreClientError(f"Get conversations failed: {e.response.status_code}")
        except Exception as e:
            logger.error("LN-Core get conversations error", error=str(e))
            raise LNCoreClientError(f"Get conversations error: {e}")


# Singleton instance
_ln_core_client: LNCoreClient | None = None


def get_ln_core_client() -> LNCoreClient:
    """Get or create the LN-Core client singleton."""
    global _ln_core_client
    if _ln_core_client is None:
        _ln_core_client = LNCoreClient()
    return _ln_core_client


async def shutdown_ln_core_client():
    """Shutdown the LN-Core client."""
    global _ln_core_client
    if _ln_core_client:
        await _ln_core_client.close()
        _ln_core_client = None
