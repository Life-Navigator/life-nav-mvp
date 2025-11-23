"""
OpenTelemetry Instrumentation for Life Navigator Backend.

Provides distributed tracing, metrics, and logging for production observability.
Integrates with Google Cloud Trace and Cloud Monitoring.
"""

import logging

from opentelemetry import metrics, trace
from opentelemetry.exporter.otlp.proto.grpc.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor
from opentelemetry.instrumentation.logging import LoggingInstrumentor
from opentelemetry.instrumentation.redis import RedisInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from app.core.config import settings

logger = logging.getLogger(__name__)


def init_telemetry() -> None:
    """
    Initialize OpenTelemetry instrumentation.

    Sets up:
    - Distributed tracing with Cloud Trace
    - Metrics with Cloud Monitoring
    - Automatic instrumentation for FastAPI, SQLAlchemy, Redis, HTTPX
    - Correlation between traces and logs
    """
    if not settings.OTEL_TRACES_ENABLED and not settings.OTEL_METRICS_ENABLED:
        logger.info("OpenTelemetry disabled via configuration")
        return

    # Create resource to identify this service
    resource = Resource.create({
        "service.name": settings.OTEL_SERVICE_NAME,
        "service.version": settings.VERSION,
        "deployment.environment": settings.ENVIRONMENT,
        "cloud.provider": "gcp",
        "cloud.platform": "gcp_kubernetes_engine",
    })

    # Initialize Tracing
    if settings.OTEL_TRACES_ENABLED:
        _init_tracing(resource)
        logger.info(
            f"OpenTelemetry tracing initialized - service={settings.OTEL_SERVICE_NAME}, endpoint={settings.OTEL_EXPORTER_OTLP_ENDPOINT}"
        )

    # Initialize Metrics
    if settings.OTEL_METRICS_ENABLED:
        _init_metrics(resource)
        logger.info(
            f"OpenTelemetry metrics initialized - service={settings.OTEL_SERVICE_NAME}"
        )

    # Instrument libraries
    _instrument_libraries()
    logger.info("OpenTelemetry instrumentation complete")


def _init_tracing(resource: Resource) -> None:
    """Initialize distributed tracing."""
    # Create OTLP trace exporter (sends to Cloud Trace via GKE default config)
    trace_exporter = OTLPSpanExporter(
        endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT,
        insecure=settings.is_development,  # Use insecure channel in dev
    )

    # Create tracer provider with batch span processor
    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(
        BatchSpanProcessor(
            trace_exporter,
            max_queue_size=2048,
            max_export_batch_size=512,
            export_timeout_millis=30000,
        )
    )

    # Set as global tracer provider
    trace.set_tracer_provider(tracer_provider)


def _init_metrics(resource: Resource) -> None:
    """Initialize metrics collection."""
    # Create OTLP metrics exporter
    metric_exporter = OTLPMetricExporter(
        endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT,
        insecure=settings.is_development,
    )

    # Create metric reader with 60-second export interval
    metric_reader = PeriodicExportingMetricReader(
        metric_exporter,
        export_interval_millis=60000,  # Export every 60 seconds
    )

    # Create meter provider
    meter_provider = MeterProvider(
        resource=resource,
        metric_readers=[metric_reader],
    )

    # Set as global meter provider
    metrics.set_meter_provider(meter_provider)


def _instrument_libraries() -> None:
    """
    Automatically instrument common libraries.

    Instruments:
    - FastAPI (HTTP requests/responses)
    - SQLAlchemy (database queries)
    - Redis (cache operations)
    - HTTPX (external HTTP calls)
    - Logging (correlate logs with traces)
    """
    # Instrument logging to correlate with traces
    LoggingInstrumentor().instrument(set_logging_format=True)

    # Instrument HTTPX for external API calls
    HTTPXClientInstrumentor().instrument()

    # Instrument Redis for cache operations
    try:
        RedisInstrumentor().instrument()
    except Exception as e:
        logger.warning("Failed to instrument Redis", error=str(e))


def instrument_fastapi(app) -> None:
    """
    Instrument FastAPI application.

    Must be called after app creation but before first request.
    Creates spans for all HTTP requests with:
    - HTTP method, path, status code
    - Request duration
    - Exceptions and errors

    Args:
        app: FastAPI application instance
    """
    if not settings.OTEL_TRACES_ENABLED:
        return

    FastAPIInstrumentor.instrument_app(
        app,
        tracer_provider=trace.get_tracer_provider(),
        excluded_urls="/health,/metrics",  # Don't trace health checks
    )
    logger.info("FastAPI instrumented for OpenTelemetry")


def instrument_sqlalchemy_engine(engine) -> None:
    """
    Instrument SQLAlchemy engine for database query tracing.

    Args:
        engine: SQLAlchemy async engine instance
    """
    if not settings.OTEL_TRACES_ENABLED:
        return

    try:
        SQLAlchemyInstrumentor().instrument(
            engine=engine.sync_engine,
            tracer_provider=trace.get_tracer_provider(),
        )
        logger.info("SQLAlchemy engine instrumented for OpenTelemetry")
    except Exception as e:
        logger.warning("Failed to instrument SQLAlchemy", error=str(e))


def get_tracer(name: str) -> trace.Tracer:
    """
    Get a tracer for manual span creation.

    Args:
        name: Name of the tracer (usually module name)

    Returns:
        Tracer instance for creating custom spans

    Example:
        ```python
        tracer = get_tracer(__name__)

        with tracer.start_as_current_span("my_operation") as span:
            span.set_attribute("user_id", user.id)
            result = do_work()
            span.set_attribute("result_count", len(result))
        ```
    """
    return trace.get_tracer(name)


def get_meter(name: str) -> metrics.Meter:
    """
    Get a meter for custom metrics.

    Args:
        name: Name of the meter (usually module name)

    Returns:
        Meter instance for creating custom metrics

    Example:
        ```python
        meter = get_meter(__name__)

        request_counter = meter.create_counter(
            "api.requests",
            description="Total API requests",
        )

        request_counter.add(1, {"endpoint": "/users", "status": "200"})
        ```
    """
    return metrics.get_meter(name)


def shutdown_telemetry() -> None:
    """
    Gracefully shutdown telemetry providers.

    Ensures all pending spans and metrics are exported before shutdown.
    Should be called during application shutdown.
    """
    if settings.OTEL_TRACES_ENABLED:
        trace_provider = trace.get_tracer_provider()
        if hasattr(trace_provider, "shutdown"):
            trace_provider.shutdown()
            logger.info("OpenTelemetry trace provider shutdown")

    if settings.OTEL_METRICS_ENABLED:
        meter_provider = metrics.get_meter_provider()
        if hasattr(meter_provider, "shutdown"):
            meter_provider.shutdown()
            logger.info("OpenTelemetry meter provider shutdown")
