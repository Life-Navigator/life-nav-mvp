"""
Prometheus metrics instrumentation for performance monitoring.

Metrics Categories:
- HTTP metrics: Request rate, latency, errors
- Database metrics: Connection pool, query performance
- Redis metrics: Cache hit rate, command latency
- Business metrics: User operations, GraphRAG queries

Usage:
    from app.core.metrics import http_requests_total, http_request_duration
    http_requests_total.labels(method="GET", endpoint="/goals", status=200).inc()
"""

from prometheus_client import Counter, Histogram, Gauge, Info
import time

# ============================================================================
# HTTP/API Metrics
# ============================================================================

http_requests_total = Counter(
    'http_requests_total',
    'Total HTTP requests',
    ['method', 'endpoint', 'status']
)

http_request_duration_seconds = Histogram(
    'http_request_duration_seconds',
    'HTTP request latency',
    ['method', 'endpoint'],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0]
)

http_requests_in_progress = Gauge(
    'http_requests_in_progress',
    'Number of HTTP requests in progress',
    ['method', 'endpoint']
)

http_errors_total = Counter(
    'http_errors_total',
    'Total HTTP errors',
    ['method', 'endpoint', 'error_type']
)

# ============================================================================
# Database Metrics
# ============================================================================

# Connection pool metrics
db_pool_size = Gauge(
    'db_pool_size',
    'Database connection pool size',
    ['database']
)

db_pool_connections_active = Gauge(
    'db_pool_connections_active',
    'Active database connections',
    ['database']
)

db_pool_connections_idle = Gauge(
    'db_pool_connections_idle',
    'Idle database connections',
    ['database']
)

db_pool_connections_waiting = Gauge(
    'db_pool_connections_waiting',
    'Waiting for database connection',
    ['database']
)

db_pool_timeout_errors_total = Counter(
    'db_pool_timeout_errors_total',
    'Database pool timeout errors',
    ['database']
)

# Query performance metrics
db_query_duration_seconds = Histogram(
    'db_query_duration_seconds',
    'Database query duration',
    ['database', 'operation'],  # operation: SELECT, INSERT, UPDATE, DELETE
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

db_slow_queries_total = Counter(
    'db_slow_queries_total',
    'Number of slow queries (>1s)',
    ['database', 'operation']
)

db_operations_total = Counter(
    'db_operations_total',
    'Total database operations',
    ['database', 'operation']  # SELECT, INSERT, UPDATE, DELETE
)

db_transaction_duration_seconds = Histogram(
    'db_transaction_duration_seconds',
    'Database transaction duration',
    ['database'],
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
)

db_connection_errors_total = Counter(
    'db_connection_errors_total',
    'Database connection errors',
    ['database', 'error_type']
)

# ============================================================================
# Redis Metrics
# ============================================================================

redis_command_duration_seconds = Histogram(
    'redis_command_duration_seconds',
    'Redis command duration',
    ['command'],  # GET, SET, EXISTS, SETEX, DELETE
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0]
)

redis_cache_hits_total = Counter(
    'redis_cache_hits_total',
    'Redis cache hits',
    ['key_prefix']
)

redis_cache_misses_total = Counter(
    'redis_cache_misses_total',
    'Redis cache misses',
    ['key_prefix']
)

redis_pool_size = Gauge(
    'redis_pool_size',
    'Redis connection pool size'
)

redis_pool_connections_active = Gauge(
    'redis_pool_connections_active',
    'Active Redis connections'
)

redis_operations_total = Counter(
    'redis_operations_total',
    'Total Redis operations',
    ['command', 'status']  # status: success, error
)

# ============================================================================
# GraphRAG Metrics
# ============================================================================

graphrag_requests_total = Counter(
    'graphrag_requests_total',
    'Total GraphRAG requests',
    ['query_type', 'status']  # query_type: personalized, centralized, semantic, vector
)

graphrag_request_duration_seconds = Histogram(
    'graphrag_request_duration_seconds',
    'GraphRAG request latency',
    ['query_type'],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0]
)

graphrag_cache_hits_total = Counter(
    'graphrag_cache_hits_total',
    'GraphRAG cache hits'
)

graphrag_cache_misses_total = Counter(
    'graphrag_cache_misses_total',
    'GraphRAG cache misses'
)

# ============================================================================
# Business Metrics
# ============================================================================

user_operations_total = Counter(
    'user_operations_total',
    'User operations by type',
    ['operation', 'domain']  # operation: create, read, update, delete; domain: goals, health, finance, career
)

auth_attempts_total = Counter(
    'auth_attempts_total',
    'Authentication attempts',
    ['result']  # success, failed_password, failed_mfa, failed_user_not_found
)

mfa_verifications_total = Counter(
    'mfa_verifications_total',
    'MFA verification attempts',
    ['result']  # success, failed
)

# ============================================================================
# System Metrics
# ============================================================================

app_info = Info(
    'app',
    'Application information'
)

# Set app info on module load
app_info.info({
    'version': '0.1.0',
    'environment': 'development',  # Will be overridden by config
    'component': 'backend',
})

# ============================================================================
# Helper Functions
# ============================================================================

def track_query_duration(database: str, operation: str, duration_seconds: float) -> None:
    """
    Track query duration and increment slow query counter if needed.

    Args:
        database: Database name (main, hipaa, financial)
        operation: SQL operation (SELECT, INSERT, UPDATE, DELETE)
        duration_seconds: Query execution time in seconds
    """
    db_query_duration_seconds.labels(database=database, operation=operation).observe(duration_seconds)
    db_operations_total.labels(database=database, operation=operation).inc()

    if duration_seconds > 1.0:
        db_slow_queries_total.labels(database=database, operation=operation).inc()


def track_redis_operation(command: str, duration_seconds: float, success: bool = True) -> None:
    """
    Track Redis operation duration and status.

    Args:
        command: Redis command (GET, SET, EXISTS, etc.)
        duration_seconds: Command execution time in seconds
        success: Whether operation succeeded
    """
    redis_command_duration_seconds.labels(command=command).observe(duration_seconds)
    redis_operations_total.labels(
        command=command,
        status='success' if success else 'error'
    ).inc()


def track_cache_operation(key_prefix: str, hit: bool) -> None:
    """
    Track cache hit or miss.

    Args:
        key_prefix: Cache key prefix (e.g., 'goals', 'user_tenant')
        hit: True for cache hit, False for cache miss
    """
    if hit:
        redis_cache_hits_total.labels(key_prefix=key_prefix).inc()
    else:
        redis_cache_misses_total.labels(key_prefix=key_prefix).inc()


def track_graphrag_request(query_type: str, duration_seconds: float, success: bool = True, cache_hit: bool = False) -> None:
    """
    Track GraphRAG request metrics.

    Args:
        query_type: Type of query (personalized, centralized, semantic, vector)
        duration_seconds: Request execution time in seconds
        success: Whether request succeeded
        cache_hit: Whether result came from cache
    """
    status = 'success' if success else 'error'
    graphrag_requests_total.labels(query_type=query_type, status=status).inc()
    graphrag_request_duration_seconds.labels(query_type=query_type).observe(duration_seconds)

    if cache_hit:
        graphrag_cache_hits_total.inc()
    else:
        graphrag_cache_misses_total.inc()


def track_user_operation(operation: str, domain: str) -> None:
    """
    Track user business operations.

    Args:
        operation: CRUD operation (create, read, update, delete)
        domain: Business domain (goals, health, finance, career)
    """
    user_operations_total.labels(operation=operation, domain=domain).inc()


def track_auth_attempt(result: str) -> None:
    """
    Track authentication attempt.

    Args:
        result: Result of auth attempt (success, failed_password, failed_mfa, failed_user_not_found)
    """
    auth_attempts_total.labels(result=result).inc()
