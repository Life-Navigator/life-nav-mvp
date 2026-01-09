"""
Risk Engine Service Client
===========================================================================
Client for calling internal risk-engine service.

Security:
- Service-to-service JWT authentication
- Audience validation (aud="risk-engine")
- Scope enforcement per endpoint
- Network-level isolation via K8s NetworkPolicy
"""

import httpx
import jwt
from typing import Dict, Any, AsyncGenerator
from datetime import datetime, timedelta
from ..core.config import settings


class RiskEngineError(Exception):
    """Risk engine error."""

    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class RiskEngineClient:
    """
    Client for risk-engine service.

    Uses service-to-service JWT authentication with audience enforcement.
    """

    def __init__(self):
        # Risk engine internal URL (private network only)
        # This should NEVER be accessible from outside the cluster
        self.base_url = settings.RISK_ENGINE_INTERNAL_URL or "http://risk-engine:8001"

        # Service-to-service JWT secret
        self.jwt_secret = settings.RISK_ENGINE_JWT_SECRET

        # HTTP client with timeout
        self.client = httpx.AsyncClient(timeout=30.0)

    def _generate_service_token(self, scope: str) -> str:
        """
        Generate service-to-service JWT token.

        Token includes:
        - aud: "risk-engine" (audience validation)
        - scope: specific endpoint scope
        - iss: "life-navigator-backend"
        - exp: 5 minutes
        """
        now = datetime.utcnow()
        exp = now + timedelta(minutes=5)

        payload = {
            "iss": "life-navigator-backend",
            "aud": "risk-engine",
            "scope": scope,
            "iat": now,
            "exp": exp,
        }

        token = jwt.encode(payload, self.jwt_secret, algorithm="HS256")
        return token

    async def compute_snapshot(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Compute risk snapshot.

        POST /v1/risk/snapshot

        Required scope: risk-engine:snapshot
        """
        token = self._generate_service_token("risk-engine:snapshot")

        try:
            response = await self.client.post(
                f"{self.base_url}/v1/risk/snapshot",
                json=request,
                headers={"Authorization": f"Bearer {token}"},
            )

            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            raise RiskEngineError(
                f"Risk engine returned {e.response.status_code}: {e.response.text}",
                status_code=e.response.status_code,
            )
        except httpx.TimeoutException:
            raise RiskEngineError("Risk engine timeout", status_code=504)
        except Exception as e:
            raise RiskEngineError(f"Risk engine request failed: {str(e)}")

    async def stream_computation(
        self, request: Dict[str, Any]
    ) -> AsyncGenerator[str, None]:
        """
        Stream risk computation (SSE).

        POST /v1/risk/stream

        Required scope: risk-engine:stream
        """
        token = self._generate_service_token("risk-engine:stream")

        try:
            async with self.client.stream(
                "POST",
                f"{self.base_url}/v1/risk/stream",
                json=request,
                headers={"Authorization": f"Bearer {token}"},
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if line:
                        yield line + "\n"

        except httpx.HTTPStatusError as e:
            raise RiskEngineError(
                f"Risk engine stream failed: {e.response.status_code}",
                status_code=e.response.status_code,
            )
        except httpx.TimeoutException:
            raise RiskEngineError("Risk engine stream timeout", status_code=504)
        except Exception as e:
            raise RiskEngineError(f"Risk engine stream failed: {str(e)}")

    async def send_heartbeat(self, stream_id: str) -> Dict[str, Any]:
        """
        Send heartbeat for stream.

        POST /v1/risk/stream/heartbeat

        Required scope: risk-engine:stream
        """
        token = self._generate_service_token("risk-engine:stream")

        try:
            response = await self.client.post(
                f"{self.base_url}/v1/risk/stream/heartbeat",
                json={"stream_id": stream_id},
                headers={"Authorization": f"Bearer {token}"},
            )

            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            raise RiskEngineError(
                f"Heartbeat failed: {e.response.status_code}",
                status_code=e.response.status_code,
            )

    async def explain_risk(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get risk explanation.

        POST /v1/risk/explain

        Required scope: risk-engine:explain
        """
        token = self._generate_service_token("risk-engine:explain")

        try:
            response = await self.client.post(
                f"{self.base_url}/v1/risk/explain",
                json=request,
                headers={"Authorization": f"Bearer {token}"},
            )

            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            raise RiskEngineError(
                f"Explain risk failed: {e.response.status_code}",
                status_code=e.response.status_code,
            )

    async def get_recommendations(self, request: Dict[str, Any]) -> Dict[str, Any]:
        """
        Get actionable recommendations.

        POST /v1/risk/recommend

        Required scope: risk-engine:recommend
        """
        token = self._generate_service_token("risk-engine:recommend")

        try:
            response = await self.client.post(
                f"{self.base_url}/v1/risk/recommend",
                json=request,
                headers={"Authorization": f"Bearer {token}"},
            )

            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            raise RiskEngineError(
                f"Get recommendations failed: {e.response.status_code}",
                status_code=e.response.status_code,
            )

    async def close(self):
        """Close HTTP client."""
        await self.client.aclose()

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
