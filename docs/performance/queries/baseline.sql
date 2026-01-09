-- ============================================================================
-- Performance Baseline Queries
-- ============================================================================
-- Run these queries to establish performance baseline before optimization.
-- Save output with: psql $DATABASE_URL -f baseline.sql > baseline_YYYYMMDD.txt
-- ============================================================================

\timing on
\x off

\echo ''
\echo '============================================================================'
\echo 'PERFORMANCE BASELINE REPORT'
\echo '============================================================================'
\echo ''
\echo 'Database:' :DBNAME
\echo 'Timestamp:' `date`
\echo ''

-- Query 1: Top 20 Slowest Queries by Average Execution Time
\echo ''
\echo '1. TOP 20 SLOWEST QUERIES (by avg execution time)'
\echo '-------------------------------------------------------------------'
SELECT
    ROUND(mean_exec_time::numeric, 2) AS avg_time_ms,
    ROUND(total_exec_time::numeric, 2) AS total_time_ms,
    calls,
    ROUND((total_exec_time / SUM(total_exec_time) OVER ())::numeric * 100, 2) AS pct_total_time,
    LEFT(query, 120) AS query_preview
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%pg_catalog%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Query 2: Top 20 Queries by Total Time (cumulative impact)
\echo ''
\echo '2. TOP 20 QUERIES BY TOTAL TIME (highest cumulative impact)'
\echo '-------------------------------------------------------------------'
SELECT
    ROUND(total_exec_time::numeric, 2) AS total_time_ms,
    calls,
    ROUND(mean_exec_time::numeric, 2) AS avg_time_ms,
    ROUND((total_exec_time / SUM(total_exec_time) OVER ())::numeric * 100, 2) AS pct_total_time,
    LEFT(query, 120) AS query_preview
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%pg_catalog%'
ORDER BY total_exec_time DESC
LIMIT 20;

-- Query 3: Read vs Write Ratio
\echo ''
\echo '3. READ vs WRITE RATIO'
\echo '-------------------------------------------------------------------'
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
GROUP BY query_type
ORDER BY total_calls DESC;

-- Query 4: Connection Pool Usage
\echo ''
\echo '4. CONNECTION POOL USAGE'
\echo '-------------------------------------------------------------------'
SELECT
    count(*) AS total_connections,
    count(*) FILTER (WHERE state = 'active') AS active,
    count(*) FILTER (WHERE state = 'idle') AS idle,
    count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
    count(*) FILTER (WHERE state = 'idle in transaction (aborted)') AS idle_in_transaction_aborted,
    count(*) FILTER (WHERE wait_event_type IS NOT NULL) AS waiting,
    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') AS max_connections,
    ROUND(count(*) * 100.0 / (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'), 2) AS pct_used
FROM pg_stat_activity
WHERE datname = current_database();

-- Query 5: Long-Running Queries
\echo ''
\echo '5. LONG-RUNNING QUERIES (active > 5 seconds)'
\echo '-------------------------------------------------------------------'
SELECT
    pid,
    usename,
    application_name,
    client_addr,
    state,
    EXTRACT(EPOCH FROM (now() - query_start))::int AS duration_seconds,
    LEFT(query, 120) AS query_preview
FROM pg_stat_activity
WHERE state = 'active'
  AND query NOT LIKE '%pg_stat_activity%'
  AND now() - query_start > interval '5 seconds'
ORDER BY query_start;

-- Query 6: Table Bloat and Vacuum Stats
\echo ''
\echo '6. TABLE BLOAT AND VACUUM STATISTICS'
\echo '-------------------------------------------------------------------'
SELECT
    schemaname,
    relname,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_pct,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE n_live_tup > 0
ORDER BY n_dead_tup DESC
LIMIT 20;

-- Query 7: Sequential Scans on Large Tables (missing index candidates)
\echo ''
\echo '7. SEQUENTIAL SCANS ON LARGE TABLES (missing index candidates)'
\echo '-------------------------------------------------------------------'
SELECT
    schemaname,
    tablename,
    seq_scan AS sequential_scans,
    seq_tup_read AS tuples_read,
    idx_scan AS index_scans,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    ROUND(seq_tup_read / NULLIF(seq_scan, 0), 2) AS avg_tuples_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 0
  AND pg_relation_size(schemaname||'.'||tablename) > 10485760  -- Tables > 10MB
ORDER BY seq_tup_read DESC
LIMIT 20;

-- Query 8: Unused Indexes (candidates for removal)
\echo ''
\echo '8. UNUSED INDEXES (size > 1MB, never scanned)'
\echo '-------------------------------------------------------------------'
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
    pg_relation_size(indexrelid) AS index_size_bytes
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND pg_relation_size(indexrelid) > 1048576  -- Indexes > 1MB
ORDER BY pg_relation_size(indexrelid) DESC;

-- Query 9: Index Hit Rate (should be > 99%)
\echo ''
\echo '9. INDEX HIT RATE (target: > 99%)'
\echo '-------------------------------------------------------------------'
SELECT
    'index hit rate' AS metric,
    ROUND(
        (sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit + idx_blks_read), 0)) * 100,
        2
    ) AS percentage,
    CASE
        WHEN (sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit + idx_blks_read), 0)) * 100 > 99 THEN 'GOOD'
        WHEN (sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit + idx_blks_read), 0)) * 100 > 95 THEN 'OK'
        ELSE 'NEEDS IMPROVEMENT'
    END AS status
FROM pg_statio_user_indexes
UNION ALL
SELECT
    'table hit rate' AS metric,
    ROUND(
        (sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0)) * 100,
        2
    ) AS percentage,
    CASE
        WHEN (sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0)) * 100 > 99 THEN 'GOOD'
        WHEN (sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0)) * 100 > 95 THEN 'OK'
        ELSE 'NEEDS IMPROVEMENT'
    END AS status
FROM pg_statio_user_tables;

-- Query 10: Database Size and Growth
\echo ''
\echo '10. DATABASE SIZE AND TABLE SIZES'
\echo '-------------------------------------------------------------------'
SELECT
    'DATABASE TOTAL' AS object,
    pg_size_pretty(pg_database_size(current_database())) AS size,
    pg_database_size(current_database()) AS size_bytes
UNION ALL
SELECT
    schemaname || '.' || tablename AS object,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY size_bytes DESC
LIMIT 21;

-- Query 11: Lock Waits (potential contention)
\echo ''
\echo '11. LOCK WAITS (potential contention)'
\echo '-------------------------------------------------------------------'
SELECT
    pg_stat_activity.pid,
    pg_stat_activity.usename,
    pg_stat_activity.state,
    pg_locks.locktype,
    pg_locks.mode,
    pg_locks.granted,
    pg_stat_activity.query_start,
    EXTRACT(EPOCH FROM (now() - pg_stat_activity.query_start))::int AS wait_seconds,
    LEFT(pg_stat_activity.query, 120) AS query_preview
FROM pg_stat_activity
JOIN pg_locks ON pg_locks.pid = pg_stat_activity.pid
WHERE NOT pg_locks.granted
  AND pg_stat_activity.datname = current_database()
ORDER BY wait_seconds DESC;

-- Query 12: Most Frequently Executed Queries
\echo ''
\echo '12. MOST FREQUENTLY EXECUTED QUERIES (top 20)'
\echo '-------------------------------------------------------------------'
SELECT
    calls,
    ROUND(mean_exec_time::numeric, 2) AS avg_time_ms,
    ROUND(total_exec_time::numeric, 2) AS total_time_ms,
    ROUND((calls * mean_exec_time / 1000)::numeric, 2) AS potential_cache_savings_seconds,
    LEFT(query, 120) AS query_preview
FROM pg_stat_statements
WHERE query NOT LIKE '%pg_stat_statements%'
  AND query NOT LIKE '%pg_catalog%'
  AND calls > 100
ORDER BY calls DESC
LIMIT 20;

\echo ''
\echo '============================================================================'
\echo 'BASELINE REPORT COMPLETE'
\echo '============================================================================'
\echo ''
\echo 'Next Steps:'
\echo '1. Save this output to docs/performance/baseline/YYYYMMDD_DBNAME.txt'
\echo '2. Run on all databases (main, hipaa, financial)'
\echo '3. Review results with PERFORMANCE_TUNING_PLAN.md'
\echo '4. Wait 7 days before making optimization changes'
\echo ''
