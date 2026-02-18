"""
Resilient HTTP client with retries, backoff, and circuit breaker behavior.

Used for all external API calls (FRED, Yahoo, ECB, AlphaVantage).
"""

import asyncio
from typing import Any, Optional

import httpx
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    RetryError,
)

from app.core.config import settings
from app.core.logging import get_logger
from app.core.metrics import fetch_latency, data_errors_total

logger = get_logger(__name__)


class HTTPClient:
    """
    Async HTTP client with retry logic and observability.

    Features:
    - Automatic retries with exponential backoff
    - Timeout enforcement
    - Prometheus metrics
    - Structured logging
    - Error classification
    """

    def __init__(
        self,
        timeout_seconds: int = settings.HTTP_TIMEOUT_SECONDS,
        max_retries: int = settings.HTTP_MAX_RETRIES,
        backoff_factor: float = settings.HTTP_RETRY_BACKOFF_FACTOR,
    ):
        self.timeout = httpx.Timeout(timeout_seconds)
        self.max_retries = max_retries
        self.backoff_factor = backoff_factor

        # Create HTTP client
        self.client = httpx.AsyncClient(
            timeout=self.timeout,
            follow_redirects=True,
            limits=httpx.Limits(max_keepalive_connections=20, max_connections=100),
        )

    async def close(self) -> None:
        """Close the HTTP client"""
        await self.client.aclose()

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((httpx.TimeoutException, httpx.NetworkError)),
        reraise=True,
    )
    async def get_with_retry(
        self,
        url: str,
        source: str,
        params: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> httpx.Response:
        """
        GET request with automatic retries.

        Args:
            url: Target URL
            source: Data source name (for metrics)
            params: Query parameters
            headers: HTTP headers

        Returns:
            Response object

        Raises:
            httpx.HTTPError on failure after retries
        """
        try:
            with fetch_latency.labels(source=source).time():
                logger.debug(
                    "http_request",
                    method="GET",
                    url=url,
                    source=source,
                )

                response = await self.client.get(url, params=params, headers=headers)
                response.raise_for_status()

                logger.debug(
                    "http_response",
                    status=response.status_code,
                    source=source,
                )

                return response

        except httpx.TimeoutException as e:
            logger.warning("http_timeout", source=source, url=url, error=str(e))
            data_errors_total.labels(source=source, error_type="timeout").inc()
            raise

        except httpx.HTTPStatusError as e:
            logger.warning(
                "http_error",
                source=source,
                url=url,
                status=e.response.status_code,
                error=str(e),
            )
            data_errors_total.labels(source=source, error_type=f"http_{e.response.status_code}").inc()
            raise

        except httpx.NetworkError as e:
            logger.warning("http_network_error", source=source, url=url, error=str(e))
            data_errors_total.labels(source=source, error_type="network").inc()
            raise

        except Exception as e:
            logger.error("http_unexpected_error", source=source, url=url, error=str(e))
            data_errors_total.labels(source=source, error_type="unknown").inc()
            raise

    async def get_json(
        self,
        url: str,
        source: str,
        params: Optional[dict[str, Any]] = None,
        headers: Optional[dict[str, str]] = None,
    ) -> dict[str, Any]:
        """
        GET request expecting JSON response.

        Returns:
            Parsed JSON as dict

        Raises:
            ValueError if response is not valid JSON
        """
        try:
            response = await self.get_with_retry(url, source, params, headers)
            return response.json()

        except (ValueError, TypeError) as e:
            logger.warning("json_parse_error", source=source, url=url, error=str(e))
            data_errors_total.labels(source=source, error_type="parse_error").inc()
            raise ValueError(f"Failed to parse JSON from {source}: {e}")


# Global HTTP client instance
_http_client: Optional[HTTPClient] = None


async def get_http_client() -> HTTPClient:
    """Get or create global HTTP client"""
    global _http_client
    if _http_client is None:
        _http_client = HTTPClient()
    return _http_client


async def close_http_client() -> None:
    """Close global HTTP client"""
    global _http_client
    if _http_client is not None:
        await _http_client.close()
        _http_client = None
