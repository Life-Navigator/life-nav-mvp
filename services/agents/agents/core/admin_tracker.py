"""
Admin Dashboard Tracker - Automatic metrics collection for all agents

Integrates with the BaseAgent to automatically send metrics to the admin dashboard.
"""

import httpx
import asyncio
from typing import Dict, Any, Optional
from datetime import datetime
from utils.logging import get_logger

logger = get_logger(__name__)


class AdminTracker:
    """
    Tracks agent execution and sends metrics to admin dashboard.

    Features:
    - Automatic request tracking
    - Experiment metrics collection
    - Training run updates
    - Cost tracking
    - Error reporting
    """

    def __init__(
        self,
        admin_api_url: str = "http://localhost:8000/api/admin/v2",
        enabled: bool = True,
        async_mode: bool = True
    ):
        """
        Initialize admin tracker.

        Args:
            admin_api_url: Base URL for admin API
            enabled: Whether tracking is enabled
            async_mode: Send metrics asynchronously (non-blocking)
        """
        self.admin_api_url = admin_api_url
        self.enabled = enabled
        self.async_mode = async_mode
        self.client = httpx.AsyncClient(timeout=5.0) if async_mode else httpx.Client(timeout=5.0)

        # Current experiment context (set by training runs)
        self.current_experiment_id: Optional[str] = None
        self.current_training_run_id: Optional[str] = None

    async def track_request(
        self,
        request_id: str,
        agent_id: str,
        user_id: str,
        user_query: str,
        intent: str,
        intent_confidence: float,
        latency_ms: float,
        tokens_used: int,
        cost: float,
        status: str,
        steps: list[Dict[str, Any]],
        error_message: Optional[str] = None
    ) -> None:
        """
        Track a complete agent request execution.

        This creates a RequestTrace in the admin dashboard.
        """
        if not self.enabled:
            return

        payload = {
            "request_id": request_id,
            "user_query": user_query,
            "user_id": user_id,
            "timestamp": datetime.utcnow().isoformat(),
            "total_latency_ms": int(latency_ms),
            "status": status,
            "error_message": error_message,
            "steps": steps,
            "model_version": self._get_current_model_version(),
            "intent": intent,
            "intent_confidence": intent_confidence,
            "tokens_used": tokens_used,
            "cost": cost
        }

        await self._send_async(
            "POST",
            f"{self.admin_api_url}/track/request",
            json=payload
        )

    async def track_experiment_metric(
        self,
        experiment_id: str,
        metric_name: str,
        metric_value: float,
        step: Optional[int] = None
    ) -> None:
        """
        Track a metric for an ongoing experiment.

        Used during training or evaluation to log metrics in real-time.
        """
        if not self.enabled:
            return

        payload = {
            "experiment_id": experiment_id,
            "metric_name": metric_name,
            "metric_value": metric_value,
            "step": step,
            "timestamp": datetime.utcnow().isoformat()
        }

        await self._send_async(
            "POST",
            f"{self.admin_api_url}/experiments/{experiment_id}/metrics",
            json=payload
        )

    async def track_training_step(
        self,
        training_run_id: str,
        step: int,
        train_loss: float,
        val_loss: Optional[float] = None,
        train_accuracy: Optional[float] = None,
        val_accuracy: Optional[float] = None,
        learning_rate: Optional[float] = None,
        gradient_norm: Optional[float] = None
    ) -> None:
        """
        Track a training step for fine-tuning visualization.

        Updates training curves in real-time.
        """
        if not self.enabled:
            return

        payload = {
            "step": step,
            "train_loss": train_loss,
            "val_loss": val_loss,
            "train_accuracy": train_accuracy,
            "val_accuracy": val_accuracy,
            "learning_rate": learning_rate,
            "gradient_norm": gradient_norm
        }

        await self._send_async(
            "POST",
            f"{self.admin_api_url}/training/runs/{training_run_id}/step",
            json=payload
        )

    async def track_cost(
        self,
        agent_id: str,
        user_id: str,
        intent: str,
        tokens_used: int,
        cost: float
    ) -> None:
        """
        Track cost for analytics.

        Enables cost breakdown by agent/user/intent.
        """
        if not self.enabled:
            return

        payload = {
            "agent_id": agent_id,
            "user_id": user_id,
            "intent": intent,
            "tokens_used": tokens_used,
            "cost": cost,
            "timestamp": datetime.utcnow().isoformat()
        }

        await self._send_async(
            "POST",
            f"{self.admin_api_url}/analytics/track-cost",
            json=payload
        )

    async def report_anomaly(
        self,
        anomaly_type: str,
        metric_name: str,
        current_value: float,
        expected_value: float,
        affected_agents: list[str],
        severity: str = "medium"
    ) -> None:
        """
        Report an anomaly detected by the agent.

        Creates an alert in the admin dashboard.
        """
        if not self.enabled:
            return

        payload = {
            "type": anomaly_type,
            "severity": severity,
            "detected_at": datetime.utcnow().isoformat(),
            "metric_name": metric_name,
            "current_value": current_value,
            "expected_value": expected_value,
            "deviation_percent": ((current_value - expected_value) / expected_value) * 100,
            "affected_agents": affected_agents,
            "sample_request_ids": []
        }

        await self._send_async(
            "POST",
            f"{self.admin_api_url}/debug/anomalies",
            json=payload
        )

    def set_experiment(self, experiment_id: str) -> None:
        """Set the current experiment context"""
        self.current_experiment_id = experiment_id

    def set_training_run(self, training_run_id: str) -> None:
        """Set the current training run context"""
        self.current_training_run_id = training_run_id

    def _get_current_model_version(self) -> str:
        """Get current model version identifier"""
        # In production, get from environment or model registry
        return "llama4-maverick-base-v1"

    async def _send_async(self, method: str, url: str, **kwargs) -> None:
        """
        Send HTTP request asynchronously (non-blocking).

        Failures are logged but don't affect agent execution.
        """
        if self.async_mode:
            # Fire and forget - don't block agent execution
            asyncio.create_task(self._do_send(method, url, **kwargs))
        else:
            await self._do_send(method, url, **kwargs)

    async def _do_send(self, method: str, url: str, **kwargs) -> None:
        """Actually send the HTTP request"""
        try:
            if isinstance(self.client, httpx.AsyncClient):
                response = await self.client.request(method, url, **kwargs)
            else:
                response = self.client.request(method, url, **kwargs)

            if response.status_code >= 400:
                logger.warning(f"Admin tracker request failed: {response.status_code} {response.text}")
        except Exception as e:
            logger.warning(f"Admin tracker failed to send metrics: {e}")

    async def close(self) -> None:
        """Close HTTP client"""
        if isinstance(self.client, httpx.AsyncClient):
            await self.client.aclose()
        else:
            self.client.close()


# Global tracker instance (configure in your app startup)
_global_tracker: Optional[AdminTracker] = None


def get_tracker() -> Optional[AdminTracker]:
    """Get global admin tracker instance"""
    return _global_tracker


def init_tracker(
    admin_api_url: str = "http://localhost:8000/api/admin/v2",
    enabled: bool = True
) -> AdminTracker:
    """
    Initialize global admin tracker.

    Call this once during app startup.
    """
    global _global_tracker
    _global_tracker = AdminTracker(admin_api_url=admin_api_url, enabled=enabled)
    logger.info(f"Admin tracker initialized: {admin_api_url}")
    return _global_tracker
