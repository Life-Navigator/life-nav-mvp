# Performance Tuning Quick Start

**⚠️ CRITICAL: Follow the measurement-first principle. Do NOT skip Week 1.**

---

## Week 1: Measurement Only (NO CHANGES)

### Day 1: Enable Metrics Collection

**1. Enable pg_stat_statements on all databases:**

```bash
# Run on Main, HIPAA, and Financial databases
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
psql $DATABASE_HIPAA_URL -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
psql $DATABASE_FINANCIAL_URL -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"
```

**2. Add metrics collection to backend:**

The file `backend/app/core/metrics.py` has been created. Add it to your FastAPI app:

```python
# backend/app/main.py

from prometheus_client import make_asgi_app
from app.core.metrics import app_info
from app.core.config import settings

# Set app info
app_info.info({
    'version': settings.VERSION,
    'environment': settings.ENVIRONMENT,
    'component': 'backend',
})

# Mount Prometheus metrics endpoint
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
```

**3. Start collecting database pool metrics:**

```python
# backend/app/main.py

import asyncio
from app.core.database import collect_pool_metrics

@app.on_event("startup")
async def startup_event():
    # Start background metric collection
    asyncio.create_task(collect_pool_metrics())
```

Add this function to `backend/app/core/database.py`:

```python
import asyncio
from app.core.metrics import db_pool_size, db_pool_connections_active, db_pool_connections_idle
from app.core.logging import logger

async def collect_pool_metrics():
    """Background task to collect pool metrics every 30 seconds."""
    while True:
        try:
            for db_name, engine in [
                ("main", _engine_main),
                ("hipaa", _engine_financial),
                ("financial", _engine_supabase),
            ]:
                if engine:
                    pool = engine.pool
                    db_pool_size.labels(database=db_name).set(pool.size())
                    db_pool_connections_active.labels(database=db_name).set(pool.checkedout())
                    db_pool_connections_idle.labels(database=db_name).set(pool.size() - pool.checkedout())

            await asyncio.sleep(30)
        except Exception as e:
            logger.error("pool_metrics_collection_failed", error=str(e))
            await asyncio.sleep(30)
```

**4. Deploy metrics collection to staging:**

```bash
# Build and deploy
cd apps/web
pnpm run build

# Deploy to staging (adjust for your deployment method)
kubectl apply -k k8s/overlays/staging
```

### Day 2-7: Collect Baseline Data

**Run baseline queries daily:**

```bash
# Create baseline directory
mkdir -p docs/performance/baseline

# Collect daily snapshots
psql $DATABASE_URL -f docs/performance/queries/baseline.sql > docs/performance/baseline/$(date +%Y%m%d)_main.txt
psql $DATABASE_HIPAA_URL -f docs/performance/queries/baseline.sql > docs/performance/baseline/$(date +%Y%m%d)_hipaa.txt
psql $DATABASE_FINANCIAL_URL -f docs/performance/queries/baseline.sql > docs/performance/baseline/$(date +%Y%m%d)_financial.txt
```

**Monitor Grafana dashboards:**

- Open your Grafana instance
- Navigate to "API Health" dashboard
- Observe:
  - Request rate over 7 days
  - p95/p99 latency trends
  - Error rate
  - Connection pool utilization

**DO NOT MAKE ANY OPTIMIZATION CHANGES YET.**

---

## Week 2: Analysis

### Day 8: Analyze Baseline Data

**1. Review connection pool usage:**

```promql
# Query in Grafana
max_over_time(db_pool_connections_active{database="main"}[7d])
avg_over_time(db_pool_connections_active{database="main"}[7d])

# Calculate utilization
(db_pool_connections_active / db_pool_size) * 100
```

**Decision Matrix:**

| Peak Utilization | Action |
|-----------------|--------|
| < 50% | No change needed |
| 50-70% | Monitor, no change |
| 70-85% | Plan to increase by 50% |
| > 85% | URGENT: Increase immediately |

**2. Review slow queries:**

```bash
# Extract slowest queries from baseline
grep "avg_time_ms" docs/performance/baseline/*_main.txt | sort -rn | head -20
```

For each slow query:
- Copy query text
- Run `EXPLAIN ANALYZE` on staging
- Document findings in `docs/performance/analysis/slow_queries.md`

**3. Check read/write ratio:**

Look at baseline output section "READ vs WRITE RATIO":
- If read:write > 10:1 → Consider read replica (after optimization)
- If read:write < 5:1 → Read replica not needed yet

**4. Identify cache candidates:**

```bash
# From baseline: "MOST FREQUENTLY EXECUTED QUERIES"
grep "calls" docs/performance/baseline/*_main.txt | grep "SELECT" | sort -rn | head -10
```

Prioritize queries with:
- High call count (> 1000 calls/day)
- Low-moderate latency (10-100ms)
- Infrequent data changes (e.g., user profiles, goals list)

---

## Week 3: Implementation

### Day 9: Connection Pool Tuning

**Based on measured peak usage:**

```python
# backend/app/core/config.py

# Example: If measured peak was 17/20 (85% utilization)
DATABASE_POOL_SIZE: int = 30  # Increased from 20
DATABASE_MAX_OVERFLOW: int = 15  # Increased from 10

# Adjust per-database if needed
DATABASE_HIPAA_POOL_SIZE: int = 15  # If measured peak was high
DATABASE_FINANCIAL_POOL_SIZE: int = 15
```

**Deploy and monitor for 24 hours.**

### Day 10-11: Add Missing Indexes

**For each slow query identified:**

1. **Get execution plan:**
   ```sql
   EXPLAIN (ANALYZE, BUFFERS) SELECT ...your slow query...;
   ```

2. **Look for:**
   - `Seq Scan` on large tables → Add index
   - High cost on JOIN → Index foreign keys
   - Expensive Sort → Add ORDER BY index

3. **Create indexes (use CONCURRENTLY to avoid locks):**
   ```sql
   -- Example: Goals filtered by user and tenant
   CREATE INDEX CONCURRENTLY idx_goals_user_tenant_active
   ON goals(user_id, tenant_id, created_at DESC)
   WHERE deleted_at IS NULL;

   -- Example: Health conditions lookup
   CREATE INDEX CONCURRENTLY idx_health_conditions_user_lookup
   ON health_conditions(user_id, tenant_id)
   INCLUDE (name, status, diagnosis_date);
   ```

4. **Verify improvement:**
   ```sql
   -- Re-run EXPLAIN after index creation
   EXPLAIN (ANALYZE, BUFFERS) SELECT ...your slow query...;

   -- Should now show "Index Scan" instead of "Seq Scan"
   ```

### Day 12-13: Implement Caching

**Create cache helper** (`backend/app/core/cache.py`):

```python
from typing import Optional
import json
import hashlib
from app.core.redis import cache_get, cache_set, cache_delete
from app.core.metrics import track_cache_operation

# TTL configurations
CACHE_TTL_USER_CONTEXT = 3600  # 1 hour
CACHE_TTL_GOALS_LIST = 300  # 5 minutes
CACHE_TTL_GRAPHRAG = 1800  # 30 minutes

async def get_cached_goals(user_id: str) -> Optional[list]:
    """Get cached goals list."""
    key = f"goals:user:{user_id}:list"
    cached = await cache_get(key)

    if cached:
        track_cache_operation(key_prefix="goals", hit=True)
        return json.loads(cached)

    track_cache_operation(key_prefix="goals", hit=False)
    return None

async def cache_goals(user_id: str, goals: list, ttl: int = CACHE_TTL_GOALS_LIST):
    """Cache goals list."""
    key = f"goals:user:{user_id}:list"
    await cache_set(key, json.dumps(goals), expire=ttl)

async def invalidate_goals_cache(user_id: str):
    """Invalidate goals cache on create/update/delete."""
    key = f"goals:user:{user_id}:list"
    await cache_delete(key)
```

**Apply to high-frequency endpoints:**

```python
# backend/app/api/endpoints/goals.py

from app.core.cache import get_cached_goals, cache_goals, invalidate_goals_cache

@router.get("/goals")
async def list_goals(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    # Try cache first
    cached_goals = await get_cached_goals(current_user.id)
    if cached_goals:
        return cached_goals

    # Cache miss - query database
    result = await db.execute(
        select(Goal)
        .where(Goal.user_id == current_user.id)
        .where(Goal.tenant_id == current_user.tenant_id)
        .order_by(Goal.created_at.desc())
    )
    goals = [g.dict() for g in result.scalars().all()]

    # Cache result
    await cache_goals(current_user.id, goals)

    return goals

@router.post("/goals")
async def create_goal(
    goal_data: GoalCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    # Create goal
    new_goal = Goal(**goal_data.dict(), user_id=current_user.id, tenant_id=current_user.tenant_id)
    db.add(new_goal)
    await db.commit()

    # Invalidate cache
    await invalidate_goals_cache(current_user.id)

    return new_goal
```

### Day 14: Deploy and Monitor

```bash
# Deploy to staging
kubectl apply -k k8s/overlays/staging

# Monitor for 24 hours
# - Check cache hit rate (target: > 70%)
# - Check query latency improvements
# - Verify no errors introduced
```

---

## Week 4: Load Testing

### Day 15: Prepare Load Test

**1. Create test users:**

```python
# backend/scripts/create_load_test_users.py
import asyncio
from app.core.database import get_session_context
from app.models.user import User, Tenant
from app.core.security import get_password_hash

async def create_test_users():
    async with get_session_context("main") as db:
        # Create test tenant
        tenant = Tenant(name="Load Test Tenant", slug="load-test")
        db.add(tenant)
        await db.flush()

        # Create 100 test users
        for i in range(1, 101):
            user = User(
                email=f"load-test-{i}@example.com",
                password_hash=get_password_hash("LoadTest123!"),
                tenant_id=tenant.id,
                mfa_enabled=False,  # Disable MFA for load testing
                status="active",
            )
            db.add(user)

        await db.commit()
        print(f"Created 100 test users in tenant {tenant.id}")

if __name__ == "__main__":
    asyncio.run(create_test_users())
```

**2. Open Grafana dashboards:**
- API Health
- Database Health
- Infrastructure

### Day 16: Run Load Test

```bash
# Install k6
brew install k6  # macOS
# or: sudo apt install k6  # Linux

# Set target environment
export API_URL=https://staging-api.lifenavigator.com

# Run load test (duration: ~39 minutes)
k6 run \
  --out json=load-test-results.json \
  backend/tests/load/k6-load-test.js

# During test, watch Grafana dashboards
```

**Monitor for:**
- ✅ p95 API latency < 500ms
- ✅ Error rate < 1%
- ✅ Database pool utilization < 80%
- ✅ Redis hit rate > 70%

### Day 17-18: Analyze Results

**Extract key metrics:**

```bash
# From k6 output, check:
# - http_req_duration p95 and p99
# - error rate
# - auth_success_rate

# From database, check slow queries during load:
psql $DATABASE_URL -c "
  SELECT calls, ROUND(mean_exec_time::numeric, 2) AS avg_ms, LEFT(query, 100)
  FROM pg_stat_statements
  WHERE mean_exec_time > 100
  ORDER BY total_exec_time DESC
  LIMIT 20;
"
```

**If success criteria met:**
- ✅ Document results
- ✅ Deploy to production with monitoring
- ✅ Schedule weekly performance reviews

**If success criteria NOT met:**
- ❌ Identify specific bottleneck from metrics
- ❌ Apply targeted fix (more indexes, caching, pool size)
- ❌ Re-run load test
- ❌ Iterate until criteria met

---

## Common Pitfalls to Avoid

❌ **DON'T:**
- Tune without measuring first
- Add read replicas prematurely
- Guess at connection pool sizes
- Skip load testing
- Cache everything "just in case"
- Ignore slow query analysis

✅ **DO:**
- Collect 7 days of baseline metrics
- Apply changes one at a time
- Validate each change with metrics
- Load test before production
- Cache based on frequency analysis
- Review performance weekly

---

## Quick Reference: Success Criteria

| Metric | Target | Action if Failed |
|--------|--------|------------------|
| **p95 API Latency** | < 500ms | Add caching, optimize queries |
| **p99 API Latency** | < 2s | Investigate outliers, add indexes |
| **Error Rate** | < 0.1% | Fix bugs, improve error handling |
| **DB Pool Utilization** | < 70% | Increase pool size |
| **DB Query p95** | < 100ms | Add indexes, optimize queries |
| **Redis Hit Rate** | > 70% | Review cache strategy, increase TTL |
| **CPU Usage** | < 60% | Scale horizontally |

---

## Next Steps After Week 4

**Ongoing (Weekly):**
- Review slow query report
- Check connection pool trends
- Monitor cache hit rates
- Review error logs

**Monthly:**
- Run smoke load test (15 min, 100 users)
- Review database growth
- Capacity planning assessment

**Quarterly:**
- Full load test (1 hour, 1000 users)
- Re-baseline performance metrics
- Review and update optimization strategy

---

## Emergency: Performance Degradation

**If API latency suddenly spikes or error rate increases:**

```bash
# 1. Check current load
kubectl top pods -n life-navigator

# 2. Check database connections
psql $DATABASE_URL -c "SELECT count(*), state FROM pg_stat_activity GROUP BY state;"

# 3. Temporary mitigation: Scale up
kubectl scale deployment/backend -n life-navigator --replicas=6

# 4. Increase pool size (if saturated)
kubectl set env deployment/backend -n life-navigator \
  DATABASE_POOL_SIZE=40 \
  DATABASE_MAX_OVERFLOW=20

# 5. Check for slow queries and kill if needed
psql $DATABASE_URL -c "
  SELECT pid, now() - query_start AS duration, LEFT(query, 100)
  FROM pg_stat_activity
  WHERE state = 'active' AND now() - query_start > interval '10 seconds'
  ORDER BY duration DESC;
"

# Kill problematic query:
# psql $DATABASE_URL -c "SELECT pg_terminate_backend(PID);"
```

**Follow-up:** Root cause analysis with Grafana + database metrics.

---

## Help & Documentation

- **Full Plan:** `docs/performance/PERFORMANCE_TUNING_PLAN.md`
- **Baseline Queries:** `docs/performance/queries/baseline.sql`
- **Load Test:** `backend/tests/load/k6-load-test.js`
- **Metrics:** `backend/app/core/metrics.py`
- **Runbooks:** `docs/runbooks/`
