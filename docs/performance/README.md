# Performance Engineering Documentation

**Measurement-first approach to scaling LifeNavigator from 1,000 to 10,000+ concurrent users.**

---

## Overview

This directory contains comprehensive performance tuning documentation following a **measurement-first, no-guessing** principle. All optimizations are based on actual metrics, load testing, and database analysis.

---

## Quick Navigation

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[QUICK_START.md](./QUICK_START.md)** | Step-by-step 4-week implementation | Start here for immediate action |
| **[PERFORMANCE_TUNING_PLAN.md](./PERFORMANCE_TUNING_PLAN.md)** | Comprehensive technical guide | Reference for detailed methodology |
| **[queries/baseline.sql](./queries/baseline.sql)** | Database performance queries | Run weekly for performance review |

---

## Files in This Directory

```
docs/performance/
├── README.md                          # This file
├── QUICK_START.md                     # 4-week implementation guide
├── PERFORMANCE_TUNING_PLAN.md         # Comprehensive technical plan
├── queries/
│   └── baseline.sql                   # Database performance queries
├── baseline/                          # Baseline metrics (create during Week 1)
│   ├── YYYYMMDD_main.txt
│   ├── YYYYMMDD_hipaa.txt
│   └── YYYYMMDD_financial.txt
├── analysis/                          # Analysis results (create during Week 2)
│   ├── slow_queries.md
│   ├── cache_candidates.md
│   └── pool_sizing.md
└── results/                           # Load test results (create during Week 4)
    └── YYYYMMDD_load_test_results.json
```

---

## Performance Tuning Components

### 1. Baseline Measurement (Week 1)
- Enable `pg_stat_statements` on all databases
- Collect Prometheus metrics (API, DB, Redis)
- Run baseline SQL queries daily for 7 days
- **DO NOT optimize yet - measure only**

📄 **Reference:** `QUICK_START.md` Week 1

### 2. Connection Pool Tuning (Week 3)
- Calculate pool size from measured concurrency
- Adjust per-database based on workload
- Monitor utilization < 70% target
- Verify database `max_connections` headroom

📄 **Reference:** `PERFORMANCE_TUNING_PLAN.md` Section 2

### 3. Query Optimization (Week 3)
- Analyze slow queries from `pg_stat_statements`
- Add indexes based on `EXPLAIN ANALYZE`
- Fix N+1 queries with `selectinload()`
- Enable slow query logging (queries > 1s)

📄 **Reference:** `PERFORMANCE_TUNING_PLAN.md` Section 4

### 4. Caching Strategy (Week 3)
- Identify high-frequency queries
- Implement Redis caching for:
  - User-tenant context (1 hour TTL)
  - Goals list (5 min TTL)
  - GraphRAG results (30 min TTL)
- Target: 70%+ cache hit rate

📄 **Reference:** `PERFORMANCE_TUNING_PLAN.md` Section 5

### 5. Read Replicas (If Needed)
- **Only add if:**
  - Read/write ratio > 10:1
  - Primary CPU > 70%
  - Read query p95 > 500ms
- Optimize first (indexes, caching) before adding replicas

📄 **Reference:** `PERFORMANCE_TUNING_PLAN.md` Section 3

### 6. Load Testing (Week 4)
- Create 100 test users
- Run k6 load test (1000 concurrent users)
- Monitor Grafana dashboards during test
- Validate success criteria

📄 **Reference:** `backend/tests/load/k6-load-test.js`

---

## Success Criteria

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| p95 API Latency | < 500ms | < 1000ms |
| p99 API Latency | < 2000ms | < 5000ms |
| Error Rate | < 0.1% | < 1% |
| DB Pool Utilization | < 70% | < 90% |
| DB Query p95 | < 100ms | < 500ms |
| Redis Hit Rate | > 70% | > 50% |
| CPU Usage | < 60% | < 80% |

**If critical thresholds exceeded:** See emergency runbook in `docs/runbooks/db-pool-saturation.md`

---

## Implementation Timeline

### Week 1: Measurement Only
- Day 1: Enable metrics collection
- Day 2-7: Collect baseline data
- **Output:** 7 days of baseline metrics

### Week 2: Analysis
- Day 8: Analyze connection pool usage
- Day 9: Review slow queries
- Day 10: Check read/write ratio
- Day 11: Identify cache candidates
- **Output:** Optimization plan with measured targets

### Week 3: Implementation
- Day 12: Tune connection pools
- Day 13-14: Add missing indexes
- Day 15-16: Implement caching
- Day 17: Deploy to staging
- **Output:** Optimized staging environment

### Week 4: Validation
- Day 18: Prepare load test
- Day 19: Run load test
- Day 20-21: Analyze results
- Day 22: Deploy to production if success criteria met
- **Output:** Load test results + production deployment

---

## Ongoing Maintenance

### Weekly (Monday Morning)
```bash
# 1. Run baseline queries
psql $DATABASE_URL -f docs/performance/queries/baseline.sql > docs/performance/baseline/$(date +%Y%m%d)_main.txt

# 2. Review slow queries
grep "avg_time_ms" docs/performance/baseline/*_main.txt | sort -rn | head -10

# 3. Check pool utilization in Grafana
# Query: (db_pool_connections_active / db_pool_size) * 100

# 4. Review cache hit rates
# Query: (rate(redis_cache_hits_total[7d]) / (rate(redis_cache_hits_total[7d]) + rate(redis_cache_misses_total[7d]))) * 100
```

### Monthly
- Run 15-minute smoke load test (100 users)
- Review database size growth
- Capacity planning assessment
- Update optimization plan if needed

### Quarterly
- Full load test (1 hour, 1000 users)
- Re-baseline performance metrics
- Review and update tuning parameters

---

## Related Documentation

**Observability:**
- [Grafana Dashboards](../monitoring/dashboards/)
- [Prometheus Alerts](../../k8s/base/monitoring/prometheus-rules.yaml)
- [Runbooks](../runbooks/)

**Code:**
- [Metrics Instrumentation](../../backend/app/core/metrics.py)
- [Database Configuration](../../backend/app/core/database.py)
- [Redis Client](../../backend/app/core/redis.py)
- [Load Test](../../backend/tests/load/k6-load-test.js)

**Infrastructure:**
- [Kubernetes Configs](../../k8s/)
- [Database Deployment](../../k8s/base/backend/deployment.yaml)

---

## Key Principles

1. ✅ **Measure first, optimize second**
   - Never tune without baseline metrics
   - Collect 7 days minimum before changes

2. ✅ **One change at a time**
   - Apply changes incrementally
   - Validate each change with metrics
   - Easier to identify what worked/failed

3. ✅ **Load test before production**
   - Staging environment MUST pass load test
   - Never deploy performance changes directly to prod
   - Keep staging infrastructure similar to prod

4. ✅ **Monitor continuously**
   - Weekly performance reviews
   - Alert on degradation early
   - Proactive optimization vs reactive firefighting

5. ✅ **Document everything**
   - Save baseline metrics
   - Document optimization reasoning
   - Track load test results over time

---

## Common Mistakes to Avoid

❌ **"Our database is slow, let's add a read replica"**
- ✅ Measure first: Is it actually the database? Check query latency, pool usage, and slow queries.
- ✅ Optimize first: Add indexes, implement caching, tune pool size.
- ✅ Read replicas are expensive and add complexity - last resort.

❌ **"Let's cache everything for 1 hour"**
- ✅ Measure query frequency and change rate.
- ✅ Cache only high-frequency, low-change data.
- ✅ Start with short TTLs (5 min) and increase if hit rate is high.

❌ **"Connection pool is at 90%, let's double it"**
- ✅ Calculate from formula: `(concurrent_requests × avg_query_time) / workers`
- ✅ Check for connection leaks (long-running queries, unclosed sessions)
- ✅ Verify database `max_connections` allows headroom

❌ **"We'll optimize after launch"**
- ✅ Establish baseline metrics NOW (Week 1)
- ✅ Optimization is easier with early data
- ✅ Reactive optimization under load is stressful and error-prone

---

## Need Help?

1. **Performance degradation emergency:** See `docs/runbooks/db-pool-saturation.md`
2. **Slow queries:** Review `PERFORMANCE_TUNING_PLAN.md` Section 4
3. **Cache not helping:** Check `PERFORMANCE_TUNING_PLAN.md` Section 5.4
4. **Load test failing:** Review `QUICK_START.md` Week 4

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-01-09 | Initial performance tuning plan created | Claude |

---

## Metrics Quick Reference

**Database Pool Utilization:**
```promql
(db_pool_connections_active / db_pool_size) * 100
```

**Query Latency p95:**
```promql
histogram_quantile(0.95, rate(db_query_duration_seconds_bucket[5m]))
```

**Cache Hit Rate:**
```promql
(rate(redis_cache_hits_total[5m]) / (rate(redis_cache_hits_total[5m]) + rate(redis_cache_misses_total[5m]))) * 100
```

**API Latency p95:**
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Error Rate:**
```promql
(sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100
```

---

**Remember: Measure first. No guessing. ✅**
