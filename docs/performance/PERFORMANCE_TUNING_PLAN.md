# Performance Tuning Plan: 1K-10K Users

**Rule: Measure First. No Guessing.**

This document provides a measurement-first approach to scaling LifeNavigator from 1,000 to 10,000 concurrent users. All recommendations are based on metrics collection and analysis.

---

## 1. Baseline Measurement Instrumentation

### 1.1 Database Metrics Collection

**Enable `pg_stat_statements` on all PostgreSQL databases:**

```sql
-- Run on Main/HIPAA/Financial databases
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Verify enabled
SELECT * FROM pg_available_extensions WHERE name = 'pg_stat_statements';
```

**Add to prometheus metrics collection** (`backend/app/core/metrics.py`):

```python
from prometheus_client import Gauge, Histogram
import asyncpg

# Database connection pool metrics (already exists, verify these are exposed)
db_pool_size = Gauge('db_pool_size', 'Database connection pool size', ['database'])
db_pool_active = Gauge('db_pool_connections_active', 'Active connections', ['database'])
db_pool_idle = Gauge('db_pool_connections_idle', 'Idle connections', ['database'])
db_pool_waiting = Gauge('db_pool_connections_waiting', 'Waiting for connection', ['database'])

# Query performance metrics (ADD THESE)
db_query_duration = Histogram(
    'db_query_duration_seconds',
    'Database query duration',
    ['database', 'operation'],  # operation: SELECT, INSERT, UPDATE, DELETE
    buckets=[0.01, 0.05, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
)

db_slow_queries = Gauge(
    'db_slow_queries_total',
    'Number of slow queries (>1s)',
    ['database']
)

# Read/Write ratio tracking (ADD THIS)
db_operations_total = Counter(
    'db_operations_total',
    'Total database operations',
    ['database', 'operation']  # SELECT, INSERT, UPDATE, DELETE
)
```

**Collect pool metrics every 30 seconds:**

```python
# Add to backend/app/core/database.py

async def collect_pool_metrics():
    """Background task to collect pool metrics."""
    while True:
        try:
            for db_name, engine in [
                ("main", _engine_main),
                ("hipaa", _engine_hipaa),
                ("financial", _engine_financial),
            ]:
                if engine:
                    pool = engine.pool
                    db_pool_size.labels(database=db_name).set(pool.size())
                    db_pool_active.labels(database=db_name).set(pool.checkedout())
                    db_pool_idle.labels(database=db_name).set(pool.size() - pool.checkedout())

            await asyncio.sleep(30)
        except Exception as e:
            logger.error("pool_metrics_collection_failed", error=str(e))
            await asyncio.sleep(30)
```

### 1.2 Redis Metrics Collection

**Add Redis metrics** (`backend/app/core/metrics.py`):

```python
# Redis performance metrics
redis_command_duration = Histogram(
    'redis_command_duration_seconds',
    'Redis command duration',
    ['command'],  # GET, SET, EXISTS, SETEX, DELETE
    buckets=[0.001, 0.005, 0.01, 0.05, 0.1, 0.5]
)

redis_hits_total = Counter('redis_cache_hits_total', 'Redis cache hits', ['key_prefix'])
redis_misses_total = Counter('redis_cache_misses_total', 'Redis cache misses', ['key_prefix'])
redis_pool_size = Gauge('redis_pool_size', 'Redis connection pool size')
redis_pool_active = Gauge('redis_pool_connections_active', 'Active Redis connections')
```

**Instrument Redis client** (`backend/app/core/redis.py`):

```python
# Add timing decorator
import time
from functools import wraps

def track_redis_operation(command: str):
    """Decorator to track Redis operation timing."""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start
                redis_command_duration.labels(command=command).observe(duration)
                return result
            except Exception as e:
                duration = time.time() - start
                redis_command_duration.labels(command=f"{command}_error").observe(duration)
                raise
        return wrapper
    return decorator

# Apply to cache functions
@track_redis_operation("GET")
async def cache_get(key: str) -> Optional[str]:
    # existing implementation
    ...

@track_redis_operation("SET")
async def cache_set(key: str, value: str, expire: int = 3600) -> None:
    # existing implementation
    ...
```

### 1.3 Current State Assessment Queries

**Run these queries BEFORE making any changes to establish baseline:**

```sql
-- Query 1: Top 20 slowest queries (Main DB)
SELECT
    ROUND(mean_exec_time::numeric, 2) AS avg_time_ms,
    ROUND(total_exec_time::numeric, 2) AS total_time_ms,
    calls,
    ROUND((total_exec_time / SUM(total_exec_time) OVER ())::numeric * 100, 2) AS pct_total_time,
    LEFT(query, 100) AS query_preview
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Query 2: Connection pool usage (run via psql)
SELECT
    count(*) AS total_connections,
    count(*) FILTER (WHERE state = 'active') AS active,
    count(*) FILTER (WHERE state = 'idle') AS idle,
    count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
    count(*) FILTER (WHERE wait_event_type IS NOT NULL) AS waiting
FROM pg_stat_activity
WHERE datname = current_database();

-- Query 3: Read vs Write ratio
SELECT
    SUM(CASE WHEN query LIKE 'SELECT%' THEN calls ELSE 0 END) AS total_reads,
    SUM(CASE WHEN query LIKE 'INSERT%' OR query LIKE 'UPDATE%' OR query LIKE 'DELETE%' THEN calls ELSE 0 END) AS total_writes,
    ROUND(
        SUM(CASE WHEN query LIKE 'SELECT%' THEN calls ELSE 0 END)::numeric /
        NULLIF(SUM(CASE WHEN query LIKE 'INSERT%' OR query LIKE 'UPDATE%' OR query LIKE 'DELETE%' THEN calls ELSE 0 END), 0),
        2
    ) AS read_write_ratio
FROM pg_stat_statements;

-- Query 4: Table bloat and vacuum stats
SELECT
    schemaname,
    relname,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_pct,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC
LIMIT 20;

-- Query 5: Index usage statistics
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND pg_relation_size(indexrelid) > 1048576  -- Indexes > 1MB
ORDER BY pg_relation_size(indexrelid) DESC;
```

**Save baseline results:**

```bash
# Create baseline report
mkdir -p docs/performance/baseline
psql $DATABASE_URL -f docs/performance/queries/baseline.sql > docs/performance/baseline/$(date +%Y%m%d)_main.txt
psql $DATABASE_HIPAA_URL -f docs/performance/queries/baseline.sql > docs/performance/baseline/$(date +%Y%m%d)_hipaa.txt
psql $DATABASE_FINANCIAL_URL -f docs/performance/queries/baseline.sql > docs/performance/baseline/$(date +%Y%m%d)_financial.txt
```

### 1.4 Application-Level Metrics Dashboard

**Create Grafana dashboard for performance baseline** (add to existing dashboards):

```json
{
  "title": "Performance Baseline",
  "panels": [
    {
      "title": "Requests Per Second",
      "targets": [{
        "expr": "rate(http_requests_total{job=\"backend\"}[5m])"
      }]
    },
    {
      "title": "Database Query Latency (p50/p95/p99)",
      "targets": [
        {"expr": "histogram_quantile(0.50, rate(db_query_duration_seconds_bucket[5m]))"},
        {"expr": "histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))"},
        {"expr": "histogram_quantile(0.99, rate(db_query_duration_seconds_bucket[5m]))"}
      ]
    },
    {
      "title": "Connection Pool Utilization (%)",
      "targets": [{
        "expr": "(db_pool_connections_active / db_pool_size) * 100"
      }],
      "alert": {
        "conditions": [{"evaluator": {"type": "gt", "params": [80]}}]
      }
    },
    {
      "title": "Redis Hit Rate (%)",
      "targets": [{
        "expr": "(rate(redis_cache_hits_total[5m]) / (rate(redis_cache_hits_total[5m]) + rate(redis_cache_misses_total[5m]))) * 100"
      }]
    }
  ]
}
```

---

## 2. Connection Pool Tuning

### 2.1 Calculation Methodology

**MEASURE FIRST:** Connection pool size should be based on:

1. **Concurrent request load** (from metrics)
2. **Query execution time** (from `pg_stat_statements`)
3. **Database max_connections** limit
4. **Application concurrency model** (async workers)

**Formula:**

```
pool_size = (concurrent_requests × avg_query_time_seconds) / worker_threads
max_overflow = pool_size × 0.5  (50% buffer for spikes)
```

**Example calculation:**

```
# Assumptions (measure from baseline):
- Concurrent requests at peak: 500 req/s
- Average query time: 50ms (0.05s)
- Worker threads: 4 (API_WORKERS=4)

pool_size = (500 × 0.05) / 4 = 6.25 ≈ 8 (round up)
max_overflow = 8 × 0.5 = 4
```

### 2.2 Database-Specific Tuning

**Current settings** (from `backend/app/core/config.py`):
- `DATABASE_POOL_SIZE = 20`
- `DATABASE_MAX_OVERFLOW = 10`
- `DATABASE_HIPAA_POOL_SIZE = 10`
- `DATABASE_HIPAA_MAX_OVERFLOW = 5`
- `DATABASE_FINANCIAL_POOL_SIZE = 10`
- `DATABASE_FINANCIAL_MAX_OVERFLOW = 5`

**Tuning process:**

1. **Measure current pool usage** for 48 hours:
   ```promql
   # Grafana query
   max_over_time(db_pool_connections_active{database="main"}[1d])
   avg_over_time(db_pool_connections_active{database="main"}[1d])
   ```

2. **Identify if pools are saturated:**
   ```promql
   # Alert if pool utilization > 90% for 5 minutes
   (db_pool_connections_active / db_pool_size) * 100 > 90
   ```

3. **Adjust based on measured peak usage:**

   ```python
   # If measured peak usage is 85% of pool_size, increase by 50%
   # Example: Main DB shows 17/20 connections active at peak

   # Current: pool_size=20, max_overflow=10 (total=30)
   # Peak usage: 17 active = 85% utilization
   # Action: Increase to pool_size=30, max_overflow=15 (total=45)

   DATABASE_POOL_SIZE = 30
   DATABASE_MAX_OVERFLOW = 15
   ```

4. **Verify database max_connections allows headroom:**
   ```sql
   -- Check PostgreSQL max_connections
   SHOW max_connections;

   -- Current connections vs max
   SELECT count(*) as current_connections,
          (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
          ROUND(count(*) * 100.0 / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'), 2) as pct_used
   FROM pg_stat_activity;
   ```

   **Rule:** Total pool size across all apps should be < 80% of `max_connections`.

### 2.3 Per-Database Recommendations

| Database | Workload Type | Measured Queries/s | Recommended Pool | Reasoning |
|----------|---------------|-------------------|------------------|-----------|
| **Main (Supabase)** | High read, moderate write | *MEASURE* | Calculate from formula | Most traffic (auth, users, goals, etc.) |
| **HIPAA** | Low-moderate read, low write | *MEASURE* | Start at 10, monitor | Health data accessed less frequently |
| **Financial** | Moderate read, low write | *MEASURE* | Start at 10, monitor | Financial queries on-demand |

**Measurement period: 7 days minimum** before making changes.

### 2.4 Pool Timeout Tuning

**Current:** `DATABASE_POOL_TIMEOUT = 30` seconds

**Adjust based on p95 query latency:**

```python
# If p95 query latency is 200ms:
DATABASE_POOL_TIMEOUT = max(30, p95_query_latency_seconds * 10)

# Example: p95 = 0.5s → timeout = max(30, 5) = 30s (keep current)
# Example: p95 = 5s → timeout = max(30, 50) = 50s (increase)
```

**Alert if timeout is reached:**

```promql
rate(db_pool_timeout_errors_total[5m]) > 0
```

---

## 3. Read Replica Strategy

### 3.1 When to Add Read Replicas

**MEASURE FIRST. Add read replicas ONLY when:**

| Metric | Threshold | Action |
|--------|-----------|--------|
| **Read/Write ratio** | > 10:1 | Consider read replica |
| **Primary CPU usage** | > 70% sustained | Add read replica |
| **Read query latency p95** | > 500ms AND CPU > 50% | Add read replica |
| **Replication lag tolerance** | Can tolerate 100ms-1s lag | Proceed with replica |

**Measurement query:**

```sql
-- Run this to determine read/write ratio
WITH query_stats AS (
    SELECT
        CASE
            WHEN query LIKE 'SELECT%' THEN 'read'
            WHEN query LIKE 'INSERT%' OR query LIKE 'UPDATE%' OR query LIKE 'DELETE%' THEN 'write'
            ELSE 'other'
        END AS query_type,
        calls,
        total_exec_time
    FROM pg_stat_statements
)
SELECT
    query_type,
    SUM(calls) AS total_calls,
    ROUND(SUM(total_exec_time)::numeric / 1000, 2) AS total_time_seconds,
    ROUND(SUM(calls) * 100.0 / SUM(SUM(calls)) OVER (), 2) AS pct_of_total_calls
FROM query_stats
GROUP BY query_type;
```

### 3.2 Implementation Strategy

**Do NOT add read replicas prematurely.** First optimize:

1. **Add missing indexes** (see Section 4)
2. **Enable query result caching** (see Section 5)
3. **Optimize slow queries** (see Section 4)
4. **Increase connection pool** (see Section 2)

**Only after optimization, if thresholds are still exceeded, add replica.**

### 3.3 Read Replica Configuration (When Triggered)

**For Main database only** (highest traffic):

```python
# Add to backend/app/core/config.py
DATABASE_READ_REPLICA_URLS: list[str] = []  # e.g., ["postgresql://read-replica-1", "postgresql://read-replica-2"]
DATABASE_READ_REPLICA_POOL_SIZE: int = 20
DATABASE_READ_REPLICA_MAX_OVERFLOW: int = 10

# Add to backend/app/core/database.py
import random

_read_replica_engines: list[AsyncEngine] = []

def get_read_engine() -> AsyncEngine:
    """
    Get a read replica engine (round-robin).
    Falls back to primary if no replicas configured.
    """
    if _read_replica_engines:
        return random.choice(_read_replica_engines)
    return get_main_engine()

# Usage in queries:
# Use get_read_engine() for SELECT queries that tolerate replication lag
# Use get_main_engine() for writes and read-after-write consistency
```

**Routing logic:**

```python
# backend/app/api/deps.py

async def get_read_session() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for read-only queries (can use replica)."""
    engine = get_read_engine()
    async_session_maker = async_sessionmaker(engine, ...)
    async with async_session_maker() as session:
        yield session

# Use in endpoints:
@router.get("/goals")
async def list_goals(
    db: AsyncSession = Depends(get_read_session),  # Use replica
):
    # Read-only query, can tolerate replication lag
    ...

@router.post("/goals")
async def create_goal(
    db: AsyncSession = Depends(get_main_session),  # Use primary
):
    # Write operation, must use primary
    ...
```

### 3.4 Monitoring Replication Lag

**Once replicas are added:**

```sql
-- Run on primary to check replica lag
SELECT
    client_addr AS replica_ip,
    state,
    sync_state,
    EXTRACT(EPOCH FROM (NOW() - pg_last_xact_replay_timestamp())) AS replication_lag_seconds
FROM pg_stat_replication;
```

**Prometheus metric:**

```python
db_replication_lag_seconds = Gauge(
    'db_replication_lag_seconds',
    'Replication lag in seconds',
    ['replica']
)
```

**Alert if lag > 5 seconds:**

```yaml
# Add to prometheus-rules.yaml
- alert: HighReplicationLag
  expr: db_replication_lag_seconds > 5
  for: 2m
  labels:
    severity: warning
  annotations:
    summary: "Database replication lag is high"
    description: "Replica {{ $labels.replica }} is {{ $value }}s behind"
```

---

## 4. Query Optimization

### 4.1 Enable Slow Query Logging

**PostgreSQL configuration** (Cloud SQL):

```sql
-- Enable slow query logging (queries > 1 second)
ALTER DATABASE lifenavigator SET log_min_duration_statement = 1000;

-- For more aggressive detection during tuning:
ALTER DATABASE lifenavigator SET log_min_duration_statement = 500;

-- Verify
SELECT name, setting FROM pg_settings WHERE name = 'log_min_duration_statement';
```

**Export slow queries to monitoring:**

```python
# Add to backend/app/core/database.py

from sqlalchemy import event
import time

@event.listens_for(AsyncEngine, "before_cursor_execute")
def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    conn.info.setdefault("query_start_time", []).append(time.time())

@event.listens_for(AsyncEngine, "after_cursor_execute")
def after_cursor_execute(conn, cursor, statement, parameters, context, executemany):
    total_time = time.time() - conn.info["query_start_time"].pop()

    # Track slow queries (> 1 second)
    if total_time > 1.0:
        db_slow_queries.labels(database=context.engine.url.database).inc()
        logger.warning(
            "slow_query_detected",
            duration_seconds=round(total_time, 3),
            query=statement[:200],  # Truncate for logging
        )

    # Record histogram
    operation = statement.split()[0].upper()  # SELECT, INSERT, UPDATE, DELETE
    db_query_duration.labels(
        database=context.engine.url.database,
        operation=operation
    ).observe(total_time)
```

### 4.2 Index Recommendations Process

**Step 1: Identify missing indexes**

```sql
-- Find sequential scans on large tables (missing index candidates)
SELECT
    schemaname,
    tablename,
    seq_scan AS sequential_scans,
    seq_tup_read AS tuples_read,
    idx_scan AS index_scans,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    ROUND(seq_tup_read / NULLIF(seq_scan, 0), 2) AS avg_tuples_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 100
  AND pg_relation_size(schemaname||'.'||tablename) > 10485760  -- Tables > 10MB
ORDER BY seq_scan DESC
LIMIT 20;
```

**Step 2: Analyze slow query execution plans**

```sql
-- For each slow query identified, get execution plan
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT ... -- your slow query here
```

**Look for:**
- `Seq Scan` on large tables → Add index
- `rows=1000000 loops=5` (nested loop with many rows) → Consider JOIN optimization
- `Filter: (condition)` with high rows removed → Add index on filter column
- `Bitmap Heap Scan` with high cost → Consider covering index

**Step 3: Create indexes based on analysis**

```sql
-- Example: Add index on frequently filtered columns
CREATE INDEX CONCURRENTLY idx_goals_user_tenant
ON goals(user_id, tenant_id)
WHERE deleted_at IS NULL;

-- Example: Covering index for common query
CREATE INDEX CONCURRENTLY idx_health_conditions_lookup
ON health_conditions(user_id, tenant_id, created_at DESC)
INCLUDE (name, status);

-- Example: Partial index for active records
CREATE INDEX CONCURRENTLY idx_users_active
ON users(email)
WHERE status = 'active';
```

**Note:** Use `CREATE INDEX CONCURRENTLY` to avoid locking the table.

### 4.3 Common Optimization Patterns

| Pattern | Issue | Solution | Validation |
|---------|-------|----------|-----------|
| **N+1 queries** | Multiple queries in loop | Use `selectinload()` or `joinedload()` in SQLAlchemy | Count queries with `echo=True` |
| **Missing WHERE index** | `Seq Scan` on filtered column | Add single-column index | `EXPLAIN ANALYZE` shows `Index Scan` |
| **Missing JOIN index** | Slow JOIN performance | Add index on foreign key | Check `JOIN` cost in `EXPLAIN` |
| **Missing ORDER BY index** | `Sort` step with high cost | Add index matching ORDER BY | `EXPLAIN` shows `Index Scan` (no sort) |
| **Large OFFSET** | Slow pagination on page 100+ | Use cursor-based pagination | Response time consistent across pages |

**Example N+1 fix:**

```python
# BEFORE (N+1 queries):
users = await db.execute(select(User))
for user in users:
    goals = await db.execute(select(Goal).where(Goal.user_id == user.id))

# AFTER (1 query):
from sqlalchemy.orm import selectinload
users = await db.execute(
    select(User).options(selectinload(User.goals))
)
```

### 4.4 Query Monitoring Dashboard

**Add to Grafana** (new panel in Database dashboard):

```json
{
  "title": "Slow Queries per Database",
  "targets": [{
    "expr": "rate(db_slow_queries_total[5m])"
  }],
  "alert": {
    "conditions": [{"evaluator": {"type": "gt", "params": [10]}}],
    "message": "More than 10 slow queries/min detected"
  }
}
```

---

## 5. Redis Caching Strategy

### 5.1 Current Redis Usage

**Existing implementations:**
- ✅ Token blacklist (security-critical, fail-secure)
- ✅ Basic cache functions (`cache_set`, `cache_get`, `cache_delete`)

**Current pool:** `REDIS_MAX_CONNECTIONS = 50`

### 5.2 Caching Expansion Strategy

**MEASURE FIRST:** Identify cache candidates by query frequency:

```sql
-- Top 20 most frequently executed queries
SELECT
    calls,
    ROUND(mean_exec_time::numeric, 2) AS avg_time_ms,
    ROUND((calls * mean_exec_time)::numeric / 1000, 2) AS total_time_saved_if_cached_seconds,
    LEFT(query, 100) AS query_preview
FROM pg_stat_statements
WHERE query LIKE 'SELECT%'
  AND mean_exec_time > 10  -- Queries taking > 10ms
ORDER BY (calls * mean_exec_time) DESC
LIMIT 20;
```

### 5.3 Cache Implementation Priorities

**Priority 1: User Session Data** (already implemented via token blacklist)

**Priority 2: User Tenant Context**

```python
# backend/app/core/cache.py (NEW FILE)

from typing import Optional
import json
from app.core.redis import get_redis, cache_get, cache_set
from app.core.logging import logger

CACHE_TTL_USER_TENANT = 3600  # 1 hour
CACHE_TTL_GOALS = 300  # 5 minutes
CACHE_TTL_GRAPHRAG_RESULTS = 1800  # 30 minutes

async def cache_user_tenant_context(user_id: str, tenant_id: str, ttl: int = CACHE_TTL_USER_TENANT) -> None:
    """Cache user-tenant relationship."""
    key = f"user_tenant:{user_id}"
    await cache_set(key, tenant_id, expire=ttl)

async def get_cached_user_tenant(user_id: str) -> Optional[str]:
    """Get cached tenant_id for user."""
    key = f"user_tenant:{user_id}"
    return await cache_get(key)

async def invalidate_user_tenant_cache(user_id: str) -> None:
    """Invalidate user-tenant cache (call on tenant change)."""
    from app.core.redis import cache_delete
    key = f"user_tenant:{user_id}"
    await cache_delete(key)
```

**Priority 3: Goals List (high-frequency, low-change)**

```python
# Add to backend/app/api/endpoints/goals.py

from app.core.cache import cache_get, cache_set
import json

@router.get("/goals")
async def list_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_read_session),  # Use read replica if available
):
    cache_key = f"goals:user:{current_user.id}:list"

    # Try cache first
    cached = await cache_get(cache_key)
    if cached:
        redis_hits_total.labels(key_prefix="goals").inc()
        return json.loads(cached)

    redis_misses_total.labels(key_prefix="goals").inc()

    # Cache miss - query database
    result = await db.execute(
        select(Goal)
        .where(Goal.user_id == current_user.id)
        .where(Goal.tenant_id == current_user.tenant_id)
        .order_by(Goal.created_at.desc())
    )
    goals = result.scalars().all()

    # Cache result for 5 minutes
    await cache_set(cache_key, json.dumps([g.dict() for g in goals]), expire=300)

    return goals

@router.post("/goals")
async def create_goal(
    goal_data: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_main_session),  # Write to primary
):
    # Create goal
    new_goal = Goal(**goal_data.dict(), user_id=current_user.id, tenant_id=current_user.tenant_id)
    db.add(new_goal)
    await db.commit()

    # Invalidate cache
    cache_key = f"goals:user:{current_user.id}:list"
    await cache_delete(cache_key)

    return new_goal
```

**Priority 4: GraphRAG Query Results** (already has caching in graphrag-rs service)

**Backend-side cache wrapper:**

```python
# Add to backend/app/clients/graphrag.py

from app.core.redis import cache_get, cache_set
import hashlib
import json

async def query_personalized_with_cache(
    self,
    query: str,
    user_id: str,
    tenant_id: str,
    **kwargs
) -> dict:
    """
    Query GraphRAG with result caching.

    Note: GraphRAG service already has internal caching.
    This adds an additional layer for identical queries within 30 minutes.
    """
    # Generate cache key from query + user context
    cache_input = f"{query}:{user_id}:{tenant_id}:{json.dumps(kwargs, sort_keys=True)}"
    cache_key_hash = hashlib.sha256(cache_input.encode()).hexdigest()
    cache_key = f"graphrag:query:{cache_key_hash}"

    # Try cache
    cached = await cache_get(cache_key)
    if cached:
        logger.info("graphrag_cache_hit", user_id=user_id)
        return json.loads(cached)

    # Cache miss - query GraphRAG service
    result = await self.query_personalized(query, user_id, tenant_id, **kwargs)

    # Cache result for 30 minutes
    await cache_set(cache_key, json.dumps(result), expire=1800)

    return result
```

### 5.4 Cache Hit Rate Targets

**Measure cache effectiveness:**

```promql
# Target: 70%+ cache hit rate for cached endpoints
(rate(redis_cache_hits_total[5m]) / (rate(redis_cache_hits_total[5m]) + rate(redis_cache_misses_total[5m]))) * 100
```

**Alert if hit rate drops below 50%:**

```yaml
# Add to prometheus-rules.yaml
- alert: LowCacheHitRate
  expr: |
    (rate(redis_cache_hits_total[5m]) / (rate(redis_cache_hits_total[5m]) + rate(redis_cache_misses_total[5m]))) * 100 < 50
  for: 10m
  labels:
    severity: warning
  annotations:
    summary: "Redis cache hit rate is below 50%"
    description: "Cache hit rate is {{ $value }}% for {{ $labels.key_prefix }}"
```

### 5.5 Redis Connection Pool Tuning

**MEASURE connection usage:**

```python
# Add to backend/app/core/redis.py

from prometheus_client import Gauge

redis_pool_size = Gauge('redis_pool_size', 'Redis pool size')
redis_pool_active = Gauge('redis_pool_connections_active', 'Active Redis connections')

async def collect_redis_pool_metrics():
    """Collect Redis pool metrics."""
    while True:
        client = await get_redis()
        if client:
            connection_pool = client.connection_pool
            redis_pool_size.set(connection_pool.max_connections)
            # Active connections = created connections
            redis_pool_active.set(len(connection_pool._available_connections))
        await asyncio.sleep(30)
```

**Adjust pool based on measured peak:**

```python
# Current: REDIS_MAX_CONNECTIONS = 50
# If measured peak usage is 45/50 (90%), increase to 75
REDIS_MAX_CONNECTIONS = 75
```

---

## 6. Load Testing Plan

### 6.1 Tool Selection: k6

**Why k6:**
- Excellent for API load testing
- Native JavaScript/TypeScript scripting
- Prometheus integration for metrics correlation
- Cloud execution via Grafana Cloud k6 (optional)

**Installation:**

```bash
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Docker
docker pull grafana/k6:latest
```

### 6.2 Load Test Scenarios

**Create:** `backend/tests/load/k6-test-plan.js`

```javascript
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const authLatency = new Trend('auth_latency');
const goalsLatency = new Trend('goals_latency');
const graphragLatency = new Trend('graphrag_latency');

// Test configuration
export const options = {
  stages: [
    // Ramp-up: 0 → 100 users over 2 minutes
    { duration: '2m', target: 100 },

    // Steady state: 100 users for 10 minutes
    { duration: '10m', target: 100 },

    // Ramp-up to 500 users over 5 minutes
    { duration: '5m', target: 500 },

    // Steady state: 500 users for 10 minutes
    { duration: '10m', target: 500 },

    // Spike test: 1000 users for 2 minutes
    { duration: '2m', target: 1000 },

    // Steady state: 1000 users for 5 minutes
    { duration: '5m', target: 1000 },

    // Ramp-down: 1000 → 0 over 2 minutes
    { duration: '2m', target: 0 },
  ],

  thresholds: {
    // 95% of requests must complete within 500ms
    'http_req_duration': ['p(95)<500'],

    // Error rate must be below 1%
    'errors': ['rate<0.01'],

    // 99% of requests must complete within 2s
    'http_req_duration': ['p(99)<2000'],
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:8000';
const API_PREFIX = '/api/v1';

// Test user credentials (pre-create in test database)
const TEST_USERS = [
  { email: 'load-test-1@example.com', password: 'LoadTest123!' },
  { email: 'load-test-2@example.com', password: 'LoadTest123!' },
  // Add 100 test users
];

export default function () {
  // Select a random test user
  const user = TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];

  let authToken;

  // Scenario 1: Authentication (10% of load)
  if (Math.random() < 0.1) {
    group('Authentication', function () {
      const loginRes = http.post(
        `${BASE_URL}${API_PREFIX}/auth/login`,
        JSON.stringify({
          email: user.email,
          password: user.password,
        }),
        {
          headers: { 'Content-Type': 'application/json' },
          tags: { name: 'Login' },
        }
      );

      authLatency.add(loginRes.timings.duration);

      const loginSuccess = check(loginRes, {
        'login status is 200': (r) => r.status === 200,
        'token received': (r) => r.json('access_token') !== undefined,
      });

      if (!loginSuccess) {
        errorRate.add(1);
        return;
      }

      authToken = loginRes.json('access_token');
    });
  } else {
    // Reuse token (simulate authenticated session)
    // In real scenario, extract from previous login
    authToken = 'Bearer mock-token-for-load-test';
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${authToken}`,
  };

  // Scenario 2: Fetch Goals (50% of load)
  if (Math.random() < 0.5) {
    group('Goals - List', function () {
      const goalsRes = http.get(
        `${BASE_URL}${API_PREFIX}/goals`,
        { headers, tags: { name: 'GetGoals' } }
      );

      goalsLatency.add(goalsRes.timings.duration);

      const goalsSuccess = check(goalsRes, {
        'goals status is 200': (r) => r.status === 200,
        'goals returned': (r) => r.json('goals') !== undefined,
      });

      if (!goalsSuccess) {
        errorRate.add(1);
      }
    });
  }

  // Scenario 3: Create Goal (20% of load)
  if (Math.random() < 0.2) {
    group('Goals - Create', function () {
      const createGoalRes = http.post(
        `${BASE_URL}${API_PREFIX}/goals`,
        JSON.stringify({
          title: `Load Test Goal ${Date.now()}`,
          description: 'Generated by k6 load test',
          category: 'career',
          target_date: '2026-12-31',
        }),
        { headers, tags: { name: 'CreateGoal' } }
      );

      const createSuccess = check(createGoalRes, {
        'goal created': (r) => r.status === 201,
      });

      if (!createSuccess) {
        errorRate.add(1);
      }
    });
  }

  // Scenario 4: GraphRAG Query (15% of load)
  if (Math.random() < 0.15) {
    group('GraphRAG - Query', function () {
      const graphragRes = http.post(
        `${BASE_URL}${API_PREFIX}/graphrag/query`,
        JSON.stringify({
          query: 'What are my career goals?',
          max_results: 10,
        }),
        { headers, tags: { name: 'GraphRAGQuery' } }
      );

      graphragLatency.add(graphragRes.timings.duration);

      const graphragSuccess = check(graphragRes, {
        'graphrag query success': (r) => r.status === 200,
        'answer provided': (r) => r.json('answer') !== undefined,
      });

      if (!graphragSuccess) {
        errorRate.add(1);
      }
    });
  }

  // Scenario 5: Health Data Access (5% of load)
  if (Math.random() < 0.05) {
    group('Health - List Conditions', function () {
      const healthRes = http.get(
        `${BASE_URL}${API_PREFIX}/health/conditions`,
        { headers, tags: { name: 'GetHealthConditions' } }
      );

      const healthSuccess = check(healthRes, {
        'health query success': (r) => r.status === 200,
      });

      if (!healthSuccess) {
        errorRate.add(1);
      }
    });
  }

  // Think time: 1-3 seconds between requests
  sleep(Math.random() * 2 + 1);
}

export function handleSummary(data) {
  return {
    'load-test-results.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}
```

### 6.3 Load Test Execution

**Pre-test checklist:**

1. ✅ Baseline metrics captured (Section 1.3)
2. ✅ Grafana dashboards open (API, Database, Infrastructure)
3. ✅ Alerts configured but not paging (observe only)
4. ✅ Database pg_stat_statements reset: `SELECT pg_stat_statements_reset();`
5. ✅ Test users created (100 users in test tenant)

**Run load test:**

```bash
# Staging environment first (NOT production)
export API_URL=https://staging-api.lifenavigator.com
export K6_PROMETHEUS_RW_SERVER_URL=http://prometheus:9090/api/v1/write

k6 run \
  --out experimental-prometheus-rw \
  backend/tests/load/k6-test-plan.js
```

**During test, monitor:**

1. **Grafana - API Health Dashboard:**
   - Request rate (should reach 500-1000 req/s)
   - Error rate (should stay < 1%)
   - p95 latency (should stay < 500ms)

2. **Grafana - Database Dashboard:**
   - Connection pool utilization (should stay < 80%)
   - Query latency (should stay < 100ms for reads)
   - Slow queries (should be 0)

3. **Grafana - Infrastructure Dashboard:**
   - CPU usage (should stay < 70%)
   - Memory usage (should stay < 80%)
   - Redis hit rate (should be > 70%)

**Capture results:**

```bash
# Save k6 results
k6 run --out json=load-test-results.json backend/tests/load/k6-test-plan.js

# Save database metrics post-test
psql $DATABASE_URL -f docs/performance/queries/baseline.sql > docs/performance/results/$(date +%Y%m%d)_post_load_test.txt
```

### 6.4 Success Criteria

| Metric | Target | Critical Threshold | Action if Failed |
|--------|--------|-------------------|------------------|
| **p95 API Latency** | < 500ms | < 1000ms | Investigate slow queries, add caching |
| **p99 API Latency** | < 2000ms | < 5000ms | Optimize slowest 1% of queries |
| **Error Rate** | < 0.1% | < 1% | Check logs for errors, fix bugs |
| **Database Pool Utilization** | < 70% | < 90% | Increase pool size (Section 2) |
| **Database Query Latency (p95)** | < 100ms | < 500ms | Add indexes, optimize queries (Section 4) |
| **Redis Hit Rate** | > 70% | > 50% | Review cache strategy, increase TTL |
| **CPU Usage (API Pods)** | < 60% | < 80% | Scale horizontally (increase replicas) |
| **Memory Usage (API Pods)** | < 70% | < 85% | Check for memory leaks, scale up |

**If success criteria not met:**

1. **DO NOT tune blindly.** Capture exact failure mode from metrics.
2. **Identify bottleneck:** CPU, memory, database, network, or application logic?
3. **Apply targeted optimization** from Sections 2-5.
4. **Re-run load test** to validate improvement.
5. **Iterate until success criteria met.**

### 6.5 Load Test Schedule

**Frequency:**

- **Before major releases:** Run full load test (1 hour duration)
- **Weekly (staging):** Run 15-minute smoke test (100 users)
- **After optimization changes:** Run targeted test (specific endpoint)

**Baseline comparison:**

```bash
# Compare two test runs
k6 inspect load-test-results-baseline.json load-test-results-after-optimization.json
```

---

## 7. Continuous Measurement

### 7.1 Weekly Performance Review

**Every Monday, review:**

1. **Query performance trends** (last 7 days):
   ```sql
   -- Run on all databases
   SELECT
       LEFT(query, 100) AS query_preview,
       calls,
       ROUND(mean_exec_time::numeric, 2) AS avg_time_ms,
       ROUND(total_exec_time::numeric / 1000, 2) AS total_time_seconds
   FROM pg_stat_statements
   WHERE mean_exec_time > 100
   ORDER BY total_exec_time DESC
   LIMIT 20;
   ```

2. **Connection pool utilization** (max over 7 days):
   ```promql
   max_over_time(db_pool_connections_active[7d]) / db_pool_size
   ```

3. **Cache hit rates** (average over 7 days):
   ```promql
   avg_over_time(
     (rate(redis_cache_hits_total[5m]) /
      (rate(redis_cache_hits_total[5m]) + rate(redis_cache_misses_total[5m])))
     [7d]
   )
   ```

4. **API latency trends** (p95 over 7 days):
   ```promql
   histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[7d]))
   ```

### 7.2 Monthly Capacity Planning

**Every month, assess:**

1. **User growth rate:** How many new users added?
2. **Database size growth:** Run `SELECT pg_size_pretty(pg_database_size('lifenavigator'));`
3. **Peak traffic trends:** Has peak req/s increased?
4. **Resource utilization trends:** Are we approaching 80% capacity?

**If approaching limits:**

- **Database:** Consider read replica (Section 3.1)
- **API:** Scale horizontally (increase Kubernetes replicas)
- **Redis:** Increase pool size (Section 5.5)

---

## 8. Implementation Timeline

### Week 1: Instrumentation & Baseline

- [ ] Add database metrics collection (Section 1.1)
- [ ] Add Redis metrics collection (Section 1.2)
- [ ] Enable pg_stat_statements on all databases
- [ ] Run baseline queries and save results (Section 1.3)
- [ ] Create performance baseline Grafana dashboard (Section 1.4)
- [ ] **DO NOT make any changes yet - measure for 7 days**

### Week 2: Analysis & Planning

- [ ] Analyze baseline metrics
- [ ] Identify top 10 slow queries
- [ ] Calculate connection pool sizing (Section 2.1)
- [ ] Determine if read replicas needed (Section 3.1)
- [ ] Identify cache candidates (Section 5.2)

### Week 3: Optimization Implementation

- [ ] Apply connection pool tuning (Section 2.2)
- [ ] Create missing indexes (Section 4.2)
- [ ] Implement caching for high-frequency queries (Section 5.3)
- [ ] Fix N+1 queries (Section 4.3)
- [ ] Deploy to staging

### Week 4: Load Testing & Validation

- [ ] Create test users for load testing
- [ ] Run k6 load test on staging (Section 6.3)
- [ ] Review success criteria (Section 6.4)
- [ ] Iterate on failures
- [ ] Deploy to production with monitoring

### Ongoing: Monitoring & Iteration

- [ ] Weekly performance review (Section 7.1)
- [ ] Monthly capacity planning (Section 7.2)
- [ ] Quarterly load testing

---

## 9. Emergency Runbook: Performance Degradation

**Symptoms:**
- API latency > 2s
- Error rate > 5%
- Database pool saturation

**Immediate Actions:**

```bash
# 1. Check current load
kubectl top pods -n life-navigator

# 2. Check database connections
psql $DATABASE_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# 3. Check for slow queries (kill if needed)
psql $DATABASE_URL -c "
  SELECT pid, now() - query_start AS duration, query
  FROM pg_stat_activity
  WHERE state = 'active' AND now() - query_start > interval '10 seconds'
  ORDER BY duration DESC;
"

# Kill slow query if needed:
# SELECT pg_terminate_backend(PID);

# 4. Increase connection pool (temporary)
kubectl set env deployment/backend -n life-navigator \
  DATABASE_POOL_SIZE=40 \
  DATABASE_MAX_OVERFLOW=20

# 5. Scale API pods (immediate relief)
kubectl scale deployment/backend -n life-navigator --replicas=6
```

**Follow-up:**
1. Review Grafana dashboards to identify root cause
2. Apply targeted optimization (Section 2-5)
3. Schedule load test to validate fix

---

## Summary

**Measurement-First Principles:**

1. ✅ **No changes without baseline metrics**
2. ✅ **Connection pools sized by formula, not guessing**
3. ✅ **Read replicas only when thresholds exceeded**
4. ✅ **Indexes added based on execution plans**
5. ✅ **Caching based on query frequency analysis**
6. ✅ **Load testing validates all changes**

**Expected Outcomes (after full implementation):**

| Metric | Before | After Target | Validation Method |
|--------|--------|--------------|-------------------|
| p95 API Latency | *MEASURE* | < 500ms | k6 load test |
| Database Query p95 | *MEASURE* | < 100ms | pg_stat_statements |
| Connection Pool Utilization | *MEASURE* | < 70% | Prometheus metrics |
| Cache Hit Rate | 0% (no caching) | > 70% | Redis metrics |
| Error Rate under Load | *MEASURE* | < 0.1% | k6 load test |
| Concurrent Users Supported | *MEASURE* | 10,000+ | k6 load test |

**Next Steps:**

1. **Start with Week 1 tasks** - instrumentation only
2. **Wait 7 days** - collect baseline metrics
3. **Review this document** with measured data
4. **Apply optimizations** in Week 3
5. **Validate with load testing** in Week 4
