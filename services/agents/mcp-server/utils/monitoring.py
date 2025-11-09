"""
Enterprise-Grade Error Monitoring and Alerting

Provides comprehensive monitoring and alerting for errors:
- Real-time error tracking
- Aggregated metrics
- Alert triggers and notifications
- SLA monitoring
- Trend analysis
- Integration with observability platforms
"""

import asyncio
import time
from typing import Optional, Dict, Any, List, Callable
from datetime import datetime
from enum import Enum
from collections import defaultdict, deque
import structlog

from .errors import BaseError, ErrorSeverity
from .circuit_breaker import circuit_breaker_manager
from .retry import get_retry_stats
from .dead_letter_queue import get_dlq_stats

logger = structlog.get_logger(__name__)


# ============================================================================
# Alert Severity and Types
# ============================================================================

class AlertSeverity(str, Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"
    EMERGENCY = "emergency"


class AlertType(str, Enum):
    """Types of alerts"""
    ERROR_RATE = "error_rate"
    ERROR_SPIKE = "error_spike"
    CIRCUIT_BREAKER_OPEN = "circuit_breaker_open"
    DLQ_THRESHOLD = "dlq_threshold"
    SLA_BREACH = "sla_breach"
    RESOURCE_EXHAUSTED = "resource_exhausted"


# ============================================================================
# Alert Configuration
# ============================================================================

class AlertConfig:
    """
    Configuration for alert thresholds.

    Attributes:
        error_rate_threshold: Error rate % to trigger alert (0-100)
        error_spike_multiplier: Error spike multiplier (e.g., 3x normal)
        dlq_threshold: DLQ size to trigger alert
        sla_threshold: SLA breach threshold (e.g., 99.9%)
        window_minutes: Time window for calculations
        cooldown_seconds: Cooldown between alerts
    """

    def __init__(
        self,
        error_rate_threshold: float = 5.0,  # 5%
        error_spike_multiplier: float = 3.0,  # 3x
        dlq_threshold: int = 100,
        sla_threshold: float = 99.0,  # 99%
        window_minutes: int = 5,
        cooldown_seconds: int = 300  # 5 minutes
    ):
        self.error_rate_threshold = error_rate_threshold
        self.error_spike_multiplier = error_spike_multiplier
        self.dlq_threshold = dlq_threshold
        self.sla_threshold = sla_threshold
        self.window_minutes = window_minutes
        self.cooldown_seconds = cooldown_seconds


# ============================================================================
# Alert
# ============================================================================

class Alert:
    """Represents an alert"""

    def __init__(
        self,
        alert_type: AlertType,
        severity: AlertSeverity,
        title: str,
        description: str,
        metrics: Dict[str, Any],
        recommendations: Optional[List[str]] = None
    ):
        self.id = f"alert_{int(time.time() * 1000)}"
        self.alert_type = alert_type
        self.severity = severity
        self.title = title
        self.description = description
        self.metrics = metrics
        self.recommendations = recommendations or []
        self.created_at = datetime.utcnow().isoformat()
        self.acknowledged = False
        self.acknowledged_at: Optional[str] = None
        self.resolved = False
        self.resolved_at: Optional[str] = None

    def acknowledge(self):
        """Acknowledge the alert"""
        self.acknowledged = True
        self.acknowledged_at = datetime.utcnow().isoformat()

    def resolve(self):
        """Resolve the alert"""
        self.resolved = True
        self.resolved_at = datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "type": self.alert_type.value,
            "severity": self.severity.value,
            "title": self.title,
            "description": self.description,
            "metrics": self.metrics,
            "recommendations": self.recommendations,
            "created_at": self.created_at,
            "acknowledged": self.acknowledged,
            "acknowledged_at": self.acknowledged_at,
            "resolved": self.resolved,
            "resolved_at": self.resolved_at
        }


# ============================================================================
# Error Metrics Tracker
# ============================================================================

class ErrorMetricsTracker:
    """
    Tracks error metrics in a sliding time window.

    Provides:
    - Error counts by severity/category
    - Error rate calculations
    - Spike detection
    - Trend analysis
    """

    def __init__(self, window_minutes: int = 5):
        self.window_minutes = window_minutes
        self.window_seconds = window_minutes * 60

        # Time-series data (timestamp, error_data)
        self._error_events: deque = deque(maxlen=10000)
        self._request_events: deque = deque(maxlen=10000)

        # Aggregated metrics
        self._metrics_by_severity: Dict[str, int] = defaultdict(int)
        self._metrics_by_category: Dict[str, int] = defaultdict(int)
        self._metrics_by_type: Dict[str, int] = defaultdict(int)

        # Baseline for spike detection
        self._baseline_error_rate: Optional[float] = None

        logger.info(
            "error_metrics_tracker_initialized",
            window_minutes=window_minutes
        )

    def _cleanup_old_events(self):
        """Remove events outside the time window"""
        cutoff_time = time.time() - self.window_seconds

        # Clean error events
        while self._error_events and self._error_events[0]["timestamp"] < cutoff_time:
            event = self._error_events.popleft()
            # Update aggregated metrics
            self._metrics_by_severity[event["severity"]] -= 1
            self._metrics_by_category[event["category"]] -= 1
            self._metrics_by_type[event["error_type"]] -= 1

        # Clean request events
        while self._request_events and self._request_events[0] < cutoff_time:
            self._request_events.popleft()

    def track_error(self, error: BaseError):
        """
        Track an error event.

        Args:
            error: BaseError instance
        """
        self._cleanup_old_events()

        event = {
            "timestamp": time.time(),
            "error_id": error.error_id,
            "error_type": type(error).__name__,
            "severity": error.severity.value,
            "category": error.category.value,
            "message": error.message
        }

        self._error_events.append(event)
        self._metrics_by_severity[error.severity.value] += 1
        self._metrics_by_category[error.category.value] += 1
        self._metrics_by_type[type(error).__name__] += 1

        logger.debug(
            "error_tracked",
            error_id=error.error_id,
            error_type=event["error_type"],
            severity=error.severity.value
        )

    def track_request(self, success: bool = True):
        """
        Track a request (successful or failed).

        Args:
            success: Whether request was successful
        """
        self._cleanup_old_events()
        self._request_events.append(time.time())

        if not success:
            # Error is tracked separately via track_error
            pass

    def get_error_rate(self) -> float:
        """
        Calculate current error rate.

        Returns:
            Error rate as percentage (0-100)
        """
        self._cleanup_old_events()

        total_requests = len(self._request_events)
        if total_requests == 0:
            return 0.0

        total_errors = len(self._error_events)
        return (total_errors / total_requests) * 100

    def get_error_count(self, severity: Optional[ErrorSeverity] = None) -> int:
        """
        Get error count, optionally filtered by severity.

        Args:
            severity: Filter by severity

        Returns:
            Error count
        """
        self._cleanup_old_events()

        if severity:
            return self._metrics_by_severity.get(severity.value, 0)

        return len(self._error_events)

    def detect_spike(self) -> bool:
        """
        Detect if there's an error spike.

        Returns:
            True if spike detected, False otherwise
        """
        current_rate = self.get_error_rate()

        # Calculate baseline if not set
        if self._baseline_error_rate is None:
            self._baseline_error_rate = max(1.0, current_rate)
            return False

        # Detect spike (3x baseline)
        spike_threshold = self._baseline_error_rate * 3.0
        is_spike = current_rate > spike_threshold

        # Update baseline slowly
        self._baseline_error_rate = (
            0.9 * self._baseline_error_rate + 0.1 * current_rate
        )

        return is_spike

    def get_metrics(self) -> Dict[str, Any]:
        """Get current metrics"""
        self._cleanup_old_events()

        return {
            "window_minutes": self.window_minutes,
            "total_errors": len(self._error_events),
            "total_requests": len(self._request_events),
            "error_rate": self.get_error_rate(),
            "errors_by_severity": dict(self._metrics_by_severity),
            "errors_by_category": dict(self._metrics_by_category),
            "errors_by_type": dict(self._metrics_by_type),
            "baseline_error_rate": self._baseline_error_rate
        }


# ============================================================================
# Alert Manager
# ============================================================================

class AlertManager:
    """
    Manages alerts and notifications.

    Provides:
    - Alert creation and tracking
    - Alert deduplication
    - Notification delivery
    - Alert history
    """

    def __init__(self, config: Optional[AlertConfig] = None):
        self.config = config or AlertConfig()
        self._alerts: Dict[str, Alert] = {}
        self._alert_cooldowns: Dict[AlertType, float] = {}
        self._notification_handlers: List[Callable] = []

        logger.info("alert_manager_initialized")

    def add_notification_handler(self, handler: Callable[[Alert], None]):
        """
        Add notification handler.

        Args:
            handler: Async function that receives Alert
        """
        self._notification_handlers.append(handler)
        logger.info("notification_handler_added")

    def _should_create_alert(self, alert_type: AlertType) -> bool:
        """Check if alert should be created (cooldown check)"""
        last_alert_time = self._alert_cooldowns.get(alert_type)

        if last_alert_time is None:
            return True

        elapsed = time.time() - last_alert_time
        return elapsed >= self.config.cooldown_seconds

    async def create_alert(
        self,
        alert_type: AlertType,
        severity: AlertSeverity,
        title: str,
        description: str,
        metrics: Dict[str, Any],
        recommendations: Optional[List[str]] = None
    ) -> Optional[Alert]:
        """
        Create and send alert.

        Args:
            alert_type: Type of alert
            severity: Alert severity
            title: Alert title
            description: Alert description
            metrics: Related metrics
            recommendations: Action recommendations

        Returns:
            Created Alert or None if suppressed by cooldown
        """
        # Check cooldown
        if not self._should_create_alert(alert_type):
            logger.debug(
                "alert_suppressed_by_cooldown",
                alert_type=alert_type.value
            )
            return None

        # Create alert
        alert = Alert(
            alert_type=alert_type,
            severity=severity,
            title=title,
            description=description,
            metrics=metrics,
            recommendations=recommendations
        )

        # Store alert
        self._alerts[alert.id] = alert
        self._alert_cooldowns[alert_type] = time.time()

        logger.warning(
            "alert_created",
            alert_id=alert.id,
            alert_type=alert_type.value,
            severity=severity.value,
            title=title
        )

        # Send notifications
        await self._send_notifications(alert)

        return alert

    async def _send_notifications(self, alert: Alert):
        """Send alert notifications"""
        for handler in self._notification_handlers:
            try:
                await handler(alert)
            except Exception as e:
                logger.error(
                    "notification_handler_failed",
                    alert_id=alert.id,
                    error=str(e)
                )

    def acknowledge_alert(self, alert_id: str) -> bool:
        """Acknowledge an alert"""
        alert = self._alerts.get(alert_id)
        if not alert:
            return False

        alert.acknowledge()
        logger.info("alert_acknowledged", alert_id=alert_id)
        return True

    def resolve_alert(self, alert_id: str) -> bool:
        """Resolve an alert"""
        alert = self._alerts.get(alert_id)
        if not alert:
            return False

        alert.resolve()
        logger.info("alert_resolved", alert_id=alert_id)
        return True

    def get_active_alerts(self) -> List[Alert]:
        """Get all active (unresolved) alerts"""
        return [
            alert for alert in self._alerts.values()
            if not alert.resolved
        ]

    def get_alert_history(self, limit: int = 100) -> List[Alert]:
        """Get alert history"""
        alerts = list(self._alerts.values())
        alerts.sort(key=lambda a: a.created_at, reverse=True)
        return alerts[:limit]


# ============================================================================
# Error Monitor
# ============================================================================

class ErrorMonitor:
    """
    Main error monitoring system.

    Combines metrics tracking and alerting.
    """

    def __init__(
        self,
        config: Optional[AlertConfig] = None,
        enable_auto_alerts: bool = True
    ):
        self.config = config or AlertConfig()
        self.metrics_tracker = ErrorMetricsTracker(
            window_minutes=self.config.window_minutes
        )
        self.alert_manager = AlertManager(config=self.config)
        self.enable_auto_alerts = enable_auto_alerts

        # Background monitoring task
        self._monitoring_task: Optional[asyncio.Task] = None

        logger.info(
            "error_monitor_initialized",
            enable_auto_alerts=enable_auto_alerts
        )

    def track_error(self, error: BaseError):
        """Track an error and check for alerts"""
        self.metrics_tracker.track_error(error)

        # Immediate alert for critical errors
        if error.severity in [ErrorSeverity.CRITICAL, ErrorSeverity.FATAL]:
            asyncio.create_task(self._alert_critical_error(error))

    async def _alert_critical_error(self, error: BaseError):
        """Create alert for critical error"""
        await self.alert_manager.create_alert(
            alert_type=AlertType.ERROR_SPIKE,
            severity=AlertSeverity.CRITICAL,
            title=f"Critical Error: {error.error_code}",
            description=error.message,
            metrics={"error_id": error.error_id},
            recommendations=[
                "Investigate error immediately",
                "Check error context and logs",
                "Review recent deployments"
            ]
        )

    async def _check_alerts(self):
        """Check all alert conditions"""
        metrics = self.metrics_tracker.get_metrics()

        # Check error rate
        error_rate = metrics["error_rate"]
        if error_rate > self.config.error_rate_threshold:
            await self.alert_manager.create_alert(
                alert_type=AlertType.ERROR_RATE,
                severity=AlertSeverity.WARNING,
                title=f"High Error Rate: {error_rate:.2f}%",
                description=f"Error rate ({error_rate:.2f}%) exceeds threshold ({self.config.error_rate_threshold}%)",
                metrics=metrics,
                recommendations=[
                    "Investigate recent errors",
                    "Check for failing services",
                    "Review recent changes"
                ]
            )

        # Check for error spike
        if self.metrics_tracker.detect_spike():
            await self.alert_manager.create_alert(
                alert_type=AlertType.ERROR_SPIKE,
                severity=AlertSeverity.CRITICAL,
                title="Error Spike Detected",
                description=f"Error rate spiked to {error_rate:.2f}%",
                metrics=metrics,
                recommendations=[
                    "Check for recent deployments",
                    "Review circuit breaker status",
                    "Investigate root cause"
                ]
            )

        # Check circuit breakers
        cb_stats = circuit_breaker_manager.get_all_stats()
        for name, stats in cb_stats.items():
            if stats["state"] == "open":
                await self.alert_manager.create_alert(
                    alert_type=AlertType.CIRCUIT_BREAKER_OPEN,
                    severity=AlertSeverity.CRITICAL,
                    title=f"Circuit Breaker Open: {name}",
                    description=f"Circuit breaker '{name}' is open due to failures",
                    metrics=stats,
                    recommendations=[
                        f"Service '{name}' is failing",
                        "Check service health",
                        "Review error logs"
                    ]
                )

        # Check DLQ
        dlq_stats = get_dlq_stats()
        total_dlq = dlq_stats.get("total_items", 0)
        if total_dlq > self.config.dlq_threshold:
            await self.alert_manager.create_alert(
                alert_type=AlertType.DLQ_THRESHOLD,
                severity=AlertSeverity.WARNING,
                title=f"DLQ Threshold Exceeded: {total_dlq} items",
                description=f"Dead letter queue has {total_dlq} items (threshold: {self.config.dlq_threshold})",
                metrics=dlq_stats,
                recommendations=[
                    "Review failed jobs in DLQ",
                    "Attempt manual replay",
                    "Investigate root causes"
                ]
            )

    async def start_monitoring(self):
        """Start background monitoring"""
        if self._monitoring_task:
            logger.warning("monitoring_already_started")
            return

        async def monitor_loop():
            while True:
                try:
                    if self.enable_auto_alerts:
                        await self._check_alerts()
                    await asyncio.sleep(60)  # Check every minute
                except Exception as e:
                    logger.error("monitoring_loop_error", error=str(e))

        self._monitoring_task = asyncio.create_task(monitor_loop())
        logger.info("error_monitoring_started")

    async def stop_monitoring(self):
        """Stop background monitoring"""
        if self._monitoring_task:
            self._monitoring_task.cancel()
            self._monitoring_task = None
            logger.info("error_monitoring_stopped")

    def get_dashboard_data(self) -> Dict[str, Any]:
        """Get comprehensive dashboard data"""
        return {
            "metrics": self.metrics_tracker.get_metrics(),
            "alerts": {
                "active": [a.to_dict() for a in self.alert_manager.get_active_alerts()],
                "recent": [a.to_dict() for a in self.alert_manager.get_alert_history(limit=10)]
            },
            "circuit_breakers": circuit_breaker_manager.get_all_stats(),
            "retry": get_retry_stats(),
            "dlq": get_dlq_stats()
        }


# ============================================================================
# Global Monitor Instance
# ============================================================================

# Global error monitor
error_monitor = ErrorMonitor()


# ============================================================================
# Notification Handlers
# ============================================================================

async def log_notification_handler(alert: Alert):
    """Simple logging notification handler"""
    logger.warning(
        "alert_notification",
        alert_id=alert.id,
        alert_type=alert.alert_type.value,
        severity=alert.severity.value,
        title=alert.title,
        description=alert.description
    )


async def slack_notification_handler(alert: Alert):
    """Slack notification handler (placeholder)"""
    # TODO: Implement Slack webhook integration
    logger.info(
        "slack_notification",
        alert_id=alert.id,
        title=alert.title
    )


async def email_notification_handler(alert: Alert):
    """Email notification handler (placeholder)"""
    # TODO: Implement email notification
    logger.info(
        "email_notification",
        alert_id=alert.id,
        title=alert.title
    )


# Setup default handlers
error_monitor.alert_manager.add_notification_handler(log_notification_handler)


if __name__ == "__main__":
    # Example usage
    import asyncio
    from .errors import NetworkError

    async def main():
        # Create monitor
        monitor = ErrorMonitor()

        # Start monitoring
        await monitor.start_monitoring()

        # Simulate errors
        for i in range(10):
            error = NetworkError(f"Network error {i}", url="https://api.example.com")
            monitor.track_error(error)
            await asyncio.sleep(0.1)

        # Get dashboard data
        dashboard = monitor.get_dashboard_data()
        print("Dashboard:", dashboard)

        # Wait for monitoring
        await asyncio.sleep(5)

        # Stop monitoring
        await monitor.stop_monitoring()

    asyncio.run(main())
