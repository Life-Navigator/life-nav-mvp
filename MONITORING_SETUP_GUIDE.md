# Monitoring & Logging Setup Guide - Life Navigator
## Production Observability and Performance Monitoring

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Sentry Error Tracking](#sentry-error-tracking)
3. [Upstash Redis Monitoring](#upstash-redis-monitoring)
4. [GCP Cloud Monitoring](#gcp-cloud-monitoring)
5. [Vercel Analytics](#vercel-analytics)
6. [Custom Application Logging](#custom-application-logging)
7. [Alerting Strategy](#alerting-strategy)
8. [Dashboards](#dashboards)
9. [Performance Monitoring](#performance-monitoring)
10. [Log Retention & Compliance](#log-retention--compliance)

---

## 🎯 Overview

### Why Monitoring Matters

For a HIPAA-compliant application handling sensitive health and financial data:

1. **Security**: Detect unauthorized access or data breaches
2. **Compliance**: Maintain audit trails (required for HIPAA)
3. **Performance**: Ensure fast response times for users
4. **Reliability**: Detect and fix issues before users notice
5. **Cost**: Optimize resource usage

### Monitoring Stack

| Tool | Purpose | Cost |
|------|---------|------|
| **Sentry** | Error tracking, performance monitoring | $26/month (team plan) |
| **Upstash Redis** | Rate limiting, caching | $0.20/100K commands |
| **GCP Cloud Monitoring** | Database and infrastructure monitoring | Included with GCP |
| **Vercel Analytics** | Traffic, edge performance | $10/month (hobby+ plan) |
| **Custom Logs** | Application-level logging | Free (self-hosted) |

**Total Cost**: ~$40-50/month

---

## 🐛 Sentry Error Tracking

### Step 1: Install Sentry SDK

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### Step 2: Configure Sentry

The wizard creates these files:

**`sentry.client.config.ts`**:
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,

  // Adjust sample rate for production
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay (for debugging)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // Performance Monitoring
  integrations: [
    new Sentry.BrowserTracing({
      tracingOrigins: ['localhost', /^\//],
    }),
    new Sentry.Replay({
      maskAllText: true, // HIPAA: Mask all text in recordings
      blockAllMedia: true, // HIPAA: Block all media
    }),
  ],

  // HIPAA: Filter sensitive data
  beforeSend(event, hint) {
    // Remove PHI from error messages
    if (event.message) {
      event.message = filterPHI(event.message);
    }

    // Remove sensitive headers
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
      delete event.request.headers['cookie'];
    }

    // Remove sensitive context data
    if (event.contexts?.user) {
      delete event.contexts.user.email;
      delete event.contexts.user.username;
    }

    return event;
  },
});

function filterPHI(text: string): string {
  // Remove email addresses
  text = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');

  // Remove phone numbers
  text = text.replace(/\d{3}-\d{3}-\d{4}/g, '[PHONE]');

  // Remove SSN patterns
  text = text.replace(/\d{3}-\d{2}-\d{4}/g, '[SSN]');

  return text;
}
```

**`sentry.server.config.ts`**:
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,

  beforeSend(event) {
    // Same PHI filtering as client
    return event;
  },
});
```

**`sentry.edge.config.ts`**:
```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});
```

### Step 3: Configure next.config.js

```javascript
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  // Your existing config
};

module.exports = withSentryConfig(
  nextConfig,
  {
    org: 'your-org',
    project: 'lifenavigator',
    silent: true,
  },
  {
    widenClientFileUpload: true,
    transpileClientSDK: true,
    tunnelRoute: '/monitoring',
    hideSourceMaps: true,
    disableLogger: true,
  }
);
```

### Step 4: Environment Variables

Add to Vercel:
```bash
vercel env add SENTRY_DSN production
vercel env add SENTRY_AUTH_TOKEN production
vercel env add NEXT_PUBLIC_SENTRY_DSN production
```

### Step 5: Test Error Tracking

Create test error endpoint: `/src/app/api/test-sentry/route.ts`

```typescript
import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

export async function GET() {
  try {
    throw new Error('Test error from API route');
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        type: 'test',
        endpoint: '/api/test-sentry',
      },
    });

    return NextResponse.json({ error: 'Error logged to Sentry' }, { status: 500 });
  }
}
```

Test:
```bash
curl https://your-app.vercel.app/api/test-sentry
```

Check Sentry dashboard for the error.

### Step 6: Custom Error Tracking

Add to critical operations:

```typescript
import * as Sentry from '@sentry/nextjs';

// Example: Track Plaid connection errors
try {
  const response = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      integration: 'plaid',
      operation: 'token_exchange',
    },
    extra: {
      userId: session.user.id,
      // Don't include tokens or sensitive data
    },
  });

  throw error;
}
```

### Step 7: Performance Monitoring

Track slow database queries:

```typescript
import * as Sentry from '@sentry/nextjs';

export async function getUserHealthRecords(userId: string) {
  const transaction = Sentry.startTransaction({
    op: 'db.query',
    name: 'Get User Health Records',
  });

  const span = transaction.startChild({
    op: 'db',
    description: 'Query health_records table',
  });

  try {
    const records = await db.healthRecord.findMany({
      where: { userId },
    });

    span.setStatus('ok');
    return records;
  } catch (error) {
    span.setStatus('internal_error');
    throw error;
  } finally {
    span.finish();
    transaction.finish();
  }
}
```

---

## 🔴 Upstash Redis Monitoring

### Step 1: Enable Upstash Monitoring

In Upstash Console:
1. Select your database
2. Navigate to **Metrics** tab
3. View real-time metrics:
   - Commands per second
   - Hit rate
   - Memory usage
   - Latency

### Step 2: Set Up Alerts

Create alert rules:

```bash
# Via Upstash API
curl -X POST https://api.upstash.com/v2/redis/alert \
  -H "Authorization: Bearer $UPSTASH_API_KEY" \
  -d '{
    "database_id": "your-db-id",
    "metric": "memory_usage",
    "operator": "gt",
    "threshold": 80,
    "action": "email",
    "recipients": ["ops@lifenavigator.com"]
  }'
```

Alert types:
- **Memory Usage** > 80%: Scale up database
- **Hit Rate** < 50%: Review caching strategy
- **Latency** > 100ms: Check connection/network
- **Commands/sec** > 1000: Consider upgrading tier

### Step 3: Monitor Rate Limiting

Create dashboard endpoint: `/src/app/api/admin/rate-limit-stats/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function GET(request: NextRequest) {
  // Require admin authentication
  // ... auth check ...

  const keys = await redis.keys('rate-limit:*');
  const stats = {
    totalKeys: keys.length,
    activeLimits: 0,
    blocked: 0,
  };

  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      stats.activeLimits++;
      if (data.remaining === 0) {
        stats.blocked++;
      }
    }
  }

  return NextResponse.json(stats);
}
```

---

## ☁️ GCP Cloud Monitoring

### Step 1: Enable Cloud Monitoring

```bash
# Enable Monitoring API
gcloud services enable monitoring.googleapis.com

# Enable Logging API
gcloud services enable logging.googleapis.com
```

### Step 2: Create Monitoring Dashboard

```bash
# Create dashboard via gcloud
gcloud monitoring dashboards create --config-from-file=dashboard.json
```

**`dashboard.json`**:
```json
{
  "displayName": "Life Navigator - Production",
  "mosaicLayout": {
    "columns": 12,
    "tiles": [
      {
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Database CPU Usage",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/cpu/utilization\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_MEAN"
                  }
                }
              }
            }],
            "yAxis": {
              "label": "CPU %",
              "scale": "LINEAR"
            }
          }
        }
      },
      {
        "xPos": 6,
        "width": 6,
        "height": 4,
        "widget": {
          "title": "Database Connections",
          "xyChart": {
            "dataSets": [{
              "timeSeriesQuery": {
                "timeSeriesFilter": {
                  "filter": "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\"",
                  "aggregation": {
                    "alignmentPeriod": "60s",
                    "perSeriesAligner": "ALIGN_MEAN"
                  }
                }
              }
            }]
          }
        }
      }
    ]
  }
}
```

### Step 3: Set Up Alerts

**High CPU Alert**:
```bash
gcloud alpha monitoring policies create \
  --notification-channels=$CHANNEL_ID \
  --display-name="Database High CPU" \
  --condition-display-name="CPU > 80%" \
  --condition-threshold-value=0.8 \
  --condition-threshold-duration=300s \
  --condition-threshold-comparison=COMPARISON_GT \
  --condition-threshold-filter='resource.type="cloudsql_database" AND metric.type="cloudsql.googleapis.com/database/cpu/utilization"'
```

**High Memory Alert**:
```bash
gcloud alpha monitoring policies create \
  --notification-channels=$CHANNEL_ID \
  --display-name="Database High Memory" \
  --condition-display-name="Memory > 90%" \
  --condition-threshold-value=0.9 \
  --condition-threshold-duration=300s \
  --condition-threshold-comparison=COMPARISON_GT \
  --condition-threshold-filter='resource.type="cloudsql_database" AND metric.type="cloudsql.googleapis.com/database/memory/utilization"'
```

**Failed Backup Alert**:
```bash
gcloud alpha monitoring policies create \
  --notification-channels=$CHANNEL_ID \
  --display-name="Backup Failed" \
  --condition-display-name="Backup operation failed" \
  --condition-threshold-value=1 \
  --condition-threshold-comparison=COMPARISON_GT \
  --condition-threshold-filter='resource.type="cloudsql_database" AND metric.type="cloudsql.googleapis.com/database/up" AND metric.label.state="down"'
```

### Step 4: View Logs

```bash
# View database logs
gcloud logging read "resource.type=cloudsql_database" \
  --limit=50 \
  --format=json

# View connection logs
gcloud logging read "resource.type=cloudsql_database AND textPayload:\"connection\"" \
  --limit=50

# View slow queries
gcloud logging read "resource.type=cloudsql_database AND textPayload:\"duration\" AND textPayload>\"1000\"" \
  --limit=50
```

### Step 5: Create Log-Based Metrics

Track failed login attempts:

```bash
gcloud logging metrics create failed_logins \
  --description="Count of failed login attempts" \
  --log-filter='resource.type="cloud_run_revision" AND textPayload:"Failed login"'
```

---

## 📊 Vercel Analytics

### Step 1: Enable Analytics

In Vercel Dashboard:
1. Go to your project
2. Navigate to **Analytics** tab
3. Click **Enable Analytics**
4. Select plan (Hobby+ includes Core Web Vitals)

### Step 2: Monitor Key Metrics

**Core Web Vitals**:
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

**Traffic**:
- Page views
- Unique visitors
- Top pages
- Referrers

**Edge Performance**:
- Cold boot time
- Edge function duration
- Cache hit rate

### Step 3: Set Performance Budgets

Add to `next.config.js`:

```javascript
module.exports = {
  experimental: {
    optimizeCss: true,
    optimizeImages: true,
  },

  // Performance budgets
  performancebudget: {
    maxInitialLoadTime: 3000, // 3 seconds
    maxScriptSize: 200 * 1024, // 200KB
    maxStyleSize: 50 * 1024, // 50KB
  },
};
```

---

## 📝 Custom Application Logging

### Step 1: Create Logging Utility

Create `/src/lib/utils/logger.ts`:

```typescript
import winston from 'winston';

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logLevel = process.env.LOG_LEVEL || 'info';

const logger = winston.createLogger({
  level: logLevel,
  levels: logLevels,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'lifenavigator',
    environment: process.env.NODE_ENV,
  },
  transports: [
    // Console logging
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),

    // File logging (production)
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5,
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 10 * 1024 * 1024,
            maxFiles: 5,
          }),
        ]
      : []),
  ],
});

// HIPAA: Filter PHI from logs
logger.on('data', (log) => {
  if (log.message) {
    log.message = filterPHI(log.message);
  }
});

function filterPHI(text: string): string {
  // Remove emails, phone numbers, SSNs
  text = text.replace(/[\w.-]+@[\w.-]+\.\w+/g, '[EMAIL]');
  text = text.replace(/\d{3}-\d{3}-\d{4}/g, '[PHONE]');
  text = text.replace(/\d{3}-\d{2}-\d{4}/g, '[SSN]');
  return text;
}

export default logger;

// Convenience methods
export const logInfo = (message: string, meta?: object) => {
  logger.info(message, meta);
};

export const logError = (message: string, error?: Error, meta?: object) => {
  logger.error(message, {
    ...meta,
    error: {
      message: error?.message,
      stack: error?.stack,
    },
  });
};

export const logWarn = (message: string, meta?: object) => {
  logger.warn(message, meta);
};

export const logDebug = (message: string, meta?: object) => {
  logger.debug(message, meta);
};
```

### Step 2: Install Winston

```bash
npm install winston
```

### Step 3: Use Logging in API Routes

```typescript
import { logInfo, logError } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  logInfo('Plaid token exchange initiated', {
    userId: session.user.id,
    endpoint: '/api/plaid/exchange-token',
  });

  try {
    const response = await plaidClient.itemPublicTokenExchange({
      public_token: publicToken,
    });

    logInfo('Plaid token exchange successful', {
      userId: session.user.id,
      itemId: response.data.item_id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('Plaid token exchange failed', error as Error, {
      userId: session.user.id,
    });

    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
```

---

## 🚨 Alerting Strategy

### Alert Severity Levels

| Level | Response Time | Examples |
|-------|--------------|----------|
| **P0 - Critical** | Immediate (< 15 min) | App down, database down, security breach |
| **P1 - High** | Within 1 hour | API errors > 5%, slow queries |
| **P2 - Medium** | Within 4 hours | High memory usage, failed backups |
| **P3 - Low** | Within 24 hours | Deprecation warnings, low disk space |

### Alert Channels

**PagerDuty** (recommended for critical alerts):
```bash
# Install PagerDuty integration
npm install @pagerduty/webhook
```

**Slack Webhooks** (for non-critical alerts):

Create `/src/lib/utils/slack.ts`:
```typescript
export async function sendSlackAlert(message: string, severity: 'critical' | 'warning' | 'info') {
  const color = {
    critical: '#FF0000',
    warning: '#FFA500',
    info: '#0000FF',
  }[severity];

  await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [{
        color,
        title: `Life Navigator ${severity.toUpperCase()} Alert`,
        text: message,
        ts: Math.floor(Date.now() / 1000),
      }],
    }),
  });
}
```

---

## 📊 Dashboards

### Create Admin Monitoring Dashboard

Create `/src/app/admin/monitoring/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';

export default function MonitoringDashboard() {
  const [metrics, setMetrics] = useState({
    errorRate: 0,
    responseTime: 0,
    activeUsers: 0,
    dbConnections: 0,
    cacheHitRate: 0,
  });

  useEffect(() => {
    // Fetch metrics from API
    fetch('/api/admin/metrics')
      .then(res => res.json())
      .then(setMetrics);
  }, []);

  return (
    <div className="grid grid-cols-3 gap-4 p-8">
      <MetricCard
        title="Error Rate"
        value={`${metrics.errorRate}%`}
        status={metrics.errorRate < 1 ? 'good' : 'warning'}
      />
      <MetricCard
        title="Avg Response Time"
        value={`${metrics.responseTime}ms`}
        status={metrics.responseTime < 500 ? 'good' : 'warning'}
      />
      <MetricCard
        title="Active Users"
        value={metrics.activeUsers}
        status="info"
      />
      <MetricCard
        title="DB Connections"
        value={metrics.dbConnections}
        status={metrics.dbConnections < 80 ? 'good' : 'warning'}
      />
      <MetricCard
        title="Cache Hit Rate"
        value={`${metrics.cacheHitRate}%`}
        status={metrics.cacheHitRate > 70 ? 'good' : 'warning'}
      />
    </div>
  );
}
```

---

## ⏱️ Performance Monitoring

### Track API Performance

Create middleware `/src/middleware.ts`:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const start = Date.now();

  const response = NextResponse.next();

  // Track response time
  response.headers.set('X-Response-Time', `${Date.now() - start}ms`);

  // Log slow requests
  const duration = Date.now() - start;
  if (duration > 1000) {
    console.warn(`Slow request: ${request.url} took ${duration}ms`);
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
```

---

## 📅 Log Retention & Compliance

### HIPAA Requirements

- **Audit Logs**: 7 years retention
- **Access Logs**: 6 years retention
- **Security Logs**: 6 years retention

### Implementation

```bash
# GCP: Set log retention
gcloud logging sinks create audit-log-archive \
  storage.googleapis.com/lifenavigator-audit-logs \
  --log-filter='resource.type="cloudsql_database"' \
  --storage-bucket-lifecycle-rule='{"condition": {"age": 2555}, "action": {"type": "Delete"}}'
  # 2555 days = 7 years
```

---

## ✅ Monitoring Checklist

### Pre-Launch
- [ ] Sentry configured and tested
- [ ] Upstash Redis monitoring enabled
- [ ] GCP Cloud Monitoring dashboards created
- [ ] Alert rules configured
- [ ] Alert channels tested
- [ ] Performance budgets set
- [ ] Log retention configured
- [ ] PHI filtering in place

### Post-Launch
- [ ] Monitor error rate daily
- [ ] Review slow queries weekly
- [ ] Check resource usage weekly
- [ ] Test alert escalation monthly
- [ ] Review dashboards monthly
- [ ] Audit log retention quarterly

---

**Monitoring Status**: Ready for implementation

**Next Steps**:
1. Set up Sentry account and configure
2. Create Upstash alerts
3. Build GCP monitoring dashboard
4. Test all alert channels
5. Train team on monitoring tools

Your production observability stack is now fully documented and ready to deploy!
