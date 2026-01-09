"""
Market Data Service Client

Service-to-service client for calling market-data microservice.
Uses JWT authentication with market:read scope.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from jose import jwt

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


class MarketDataClient:
    """
    Client for market-data service.

    Handles:
    - Service-to-service JWT generation
    - Snapshot retrieval
    - Error handling and retries
    """

    def __init__(self):
        self.base_url = settings.MARKET_DATA_SERVICE_URL  # e.g., http://market-data:8002
        self.jwt_secret = settings.JWT_SECRET
        self.client = httpx.AsyncClient(timeout=30.0)

    async def close(self) -> None:
        """Close HTTP client"""
        await self.client.aclose()

    def _generate_service_token(self, scope: str = "market:read") -> str:
        """
        Generate service-to-service JWT for market-data.

        Args:
            scope: Required scope (default: market:read)

        Returns:
            JWT token string
        """
        payload = {
            "iss": "life-navigator-backend",
            "aud": "market-data",
            "scope": scope,
            "iat": datetime.now(timezone.utc),
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        }

        token = jwt.encode(payload, self.jwt_secret, algorithm="HS256")
        return token

    async def get_latest_snapshot(self) -> Optional[dict]:
        """
        Fetch the latest market snapshot.

        Returns:
            Snapshot dict with structure:
            {
                "snapshot": {...},
                "provenance": {...},
                "staleness_seconds": int,
                "warnings": [...]
            }

            Or None if unavailable
        """
        try:
            token = self._generate_service_token("market:read")

            response = await self.client.get(
                f"{self.base_url}/v1/snapshots/latest",
                headers={"Authorization": f"Bearer {token}"},
            )

            if response.status_code == 404:
                logger.warning("market_snapshot_not_found")
                return None

            response.raise_for_status()

            snapshot_response = response.json()

            logger.info(
                "market_snapshot_retrieved",
                snapshot_id=snapshot_response.get("snapshot", {}).get("snapshot_id"),
                staleness_seconds=snapshot_response.get("staleness_seconds"),
            )

            return snapshot_response

        except httpx.HTTPStatusError as e:
            logger.error(
                "market_data_http_error",
                status=e.response.status_code,
                error=str(e),
            )
            return None

        except Exception as e:
            logger.error("market_data_client_error", error=str(e))
            return None

    async def get_snapshot_by_date(self, as_of_date: datetime) -> Optional[dict]:
        """
        Fetch snapshot for a specific date.

        Args:
            as_of_date: Date to retrieve

        Returns:
            Snapshot response or None
        """
        try:
            token = self._generate_service_token("market:read")
            date_str = as_of_date.strftime("%Y-%m-%d")

            response = await self.client.get(
                f"{self.base_url}/v1/snapshots/{date_str}",
                headers={"Authorization": f"Bearer {token}"},
            )

            if response.status_code == 404:
                logger.warning("market_snapshot_not_found_for_date", date=date_str)
                return None

            response.raise_for_status()
            return response.json()

        except httpx.HTTPStatusError as e:
            logger.error(
                "market_data_http_error",
                status=e.response.status_code,
                date=as_of_date,
            )
            return None

        except Exception as e:
            logger.error("market_data_client_error", error=str(e), date=as_of_date)
            return None
