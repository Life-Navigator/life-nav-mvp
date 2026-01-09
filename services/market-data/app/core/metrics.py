"""
Prometheus metrics for observability.

Tracks:
- Fetch latencies by source
- Snapshot build success/failure rates
- Staleness and confidence metrics
- Error counts by type
"""

from prometheus_client import Counter, Gauge, Histogram, CollectorRegistry

from app.core.config import settings

# Create custom registry
registry = CollectorRegistry()

# Fetch latency by source
fetch_latency = Histogram(
    "market_data_fetch_latency_seconds",
    "Latency of external data fetches",
    ["source"],  # fred, yahoo, ecb, alphavantage
    registry=registry,
    buckets=(0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0),
)

# Snapshot build metrics
snapshot_build_total = Counter(
    "market_snapshot_build_total",
    "Total snapshot builds",
    ["status"],  # success, fail
    registry=registry,
)

snapshot_build_duration = Histogram(
    "market_snapshot_build_duration_seconds",
    "Time to build a complete snapshot",
    registry=registry,
    buckets=(1.0, 5.0, 10.0, 30.0, 60.0, 120.0, 300.0),
)

# Snapshot quality metrics
snapshot_staleness = Gauge(
    "market_snapshot_staleness_seconds",
    "Age of the latest snapshot",
    registry=registry,
)

snapshot_confidence = Gauge(
    "market_snapshot_confidence",
    "Overall snapshot confidence (0-3: none/low/medium/high)",
    registry=registry,
)

# Error tracking
data_errors_total = Counter(
    "market_data_errors_total",
    "Total data fetch errors",
    ["source", "error_type"],  # timeout, parse_error, validation_error, etc.
    registry=registry,
)

# API request metrics
api_requests_total = Counter(
    "market_data_api_requests_total",
    "Total API requests",
    ["endpoint", "status"],
    registry=registry,
)

api_request_duration = Histogram(
    "market_data_api_request_duration_seconds",
    "API request duration",
    ["endpoint"],
    registry=registry,
    buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0),
)


def set_confidence_gauge(confidence_str: str) -> None:
    """
    Map confidence level to numeric gauge value.

    none=0, low=1, medium=2, high=3
    """
    confidence_map = {"none": 0, "low": 1, "medium": 2, "high": 3}
    snapshot_confidence.set(confidence_map.get(confidence_str, 0))
