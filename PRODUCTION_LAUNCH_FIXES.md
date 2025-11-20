# Production Launch Fixes - Implementation Guide

**Date:** November 19, 2025
**Status:** IN PROGRESS
**Target:** Close all critical gaps before pilot launch

---

## ✅ **COMPLETED: E2E Testing Infrastructure**

### What Was Done

1. **✅ Playwright Configuration Created**
   - File: `apps/web/playwright.config.ts`
   - Multi-browser support (Chrome, Firefox, Safari, Mobile)
   - Screenshots and videos on failure
   - HTML, JSON, and JUnit reporters
   - CI/CD integration ready

2. **✅ 5 Critical E2E Test Suites Implemented**

   **Test Suite 1: Authentication (`e2e/auth.spec.ts`)**
   - ✅ User registration flow
   - ✅ Login with valid credentials
   - ✅ Invalid credentials handling
   - ✅ 2FA flow
   - ✅ Password reset
   - ✅ Logout functionality
   - ✅ Session persistence
   - ✅ Protected route redirects
   - **8 comprehensive tests**

   **Test Suite 2: Onboarding (`e2e/onboarding.spec.ts`)**
   - ✅ Complete onboarding flow
   - ✅ Skipping optional steps
   - ✅ Progress saving and resuming
   - ✅ Required field validation
   - ✅ Progress indicator
   - ✅ Back button navigation
   - **6 comprehensive tests**

   **Test Suite 3: Dashboard (`e2e/dashboard.spec.ts`)**
   - ✅ Loading all modules
   - ✅ Module navigation
   - ✅ Activity feed
   - ✅ Quick stats widgets
   - ✅ AI assistant interaction
   - ✅ Activity filtering
   - ✅ Sidebar navigation
   - ✅ User profile menu
   - ✅ Mobile responsiveness
   - ✅ Offline state handling
   - **10 comprehensive tests**

   **Test Suite 4: Finance Module (`e2e/finance.spec.ts`)**
   - ✅ Adding financial accounts
   - ✅ Receipt upload and OCR processing
   - ✅ Budget creation
   - ✅ Transaction filtering
   - ✅ Financial report generation
   - ✅ Plaid bank connection
   - ✅ Transaction categorization
   - ✅ Budget alerts
   - **8 comprehensive tests**

   **Test Suite 5: Health Module (`e2e/health.spec.ts`)**
   - ✅ Adding medications
   - ✅ Tracking health metrics
   - ✅ Logging health conditions
   - ✅ Health timeline
   - ✅ Medication reminders
   - ✅ Symptom tracking
   - ✅ Wearable data sync
   - ✅ Health report generation
   - **8 comprehensive tests**

3. **✅ Package.json Updated**
   - Added Playwright test scripts
   - Added testing dependencies
   - Ready to run: `pnpm test:e2e`

### Next Steps for E2E

```bash
# Install dependencies
cd apps/web
pnpm install

# Install Playwright browsers
pnpm playwright:install

# Run tests
pnpm test:e2e

# Run with UI (for debugging)
pnpm test:e2e:ui

# Run in headed mode (see browser)
pnpm test:e2e:headed
```

### Add to CI/CD

Add to `.github/workflows/web.yml`:

```yaml
- name: Install Playwright Browsers
  run: pnpm --filter @life-navigator/web playwright:install --with-deps

- name: Run E2E Tests
  run: pnpm --filter @life-navigator/web test:e2e

- name: Upload Playwright Report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: apps/web/playwright-report/
    retention-days: 30
```

---

## 🔧 **IN PROGRESS: Observability Activation**

### 1. Sentry Error Tracking

#### Current Status
- ✅ Sentry SDK installed (`backend/pyproject.toml`: `sentry-sdk[fastapi] = "^1.40.0"`)
- ✅ Initialization code exists (`backend/app/main.py:72-79`)
- ⚠️ **Missing:** Actual DSN configuration

#### Implementation Steps

**Step 1: Create Sentry Project**

1. Go to https://sentry.io
2. Create new project (Python/FastAPI)
3. Copy DSN (looks like: `https://xxxxx@o123456.ingest.sentry.io/7654321`)

**Step 2: Add to GCP Secret Manager**

```bash
# Create secret
gcloud secrets create sentry-dsn \
  --replication-policy="automatic" \
  --data-file=- <<< "https://your-actual-dsn@sentry.io/project-id"

# Grant access to GKE service account
gcloud secrets add-iam-policy-binding sentry-dsn \
  --member="serviceAccount:life-navigator-gke@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

**Step 3: Update Kubernetes ExternalSecret**

File: `k8s/base/backend/external-secrets.yaml`

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: backend-secrets
  namespace: life-navigator
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: gcpsm-secret-store
    kind: SecretStore
  target:
    name: backend-secrets
    creationPolicy: Owner
  data:
    - secretKey: SENTRY_DSN
      remoteRef:
        key: sentry-dsn
    - secretKey: DATABASE_URL
      remoteRef:
        key: database-url
    - secretKey: JWT_SECRET_KEY
      remoteRef:
        key: jwt-secret-key
    # Add other secrets...
```

**Step 4: Update Deployment to Use Secret**

File: `k8s/base/backend/deployment.yaml`

```yaml
spec:
  containers:
    - name: backend
      env:
        - name: SENTRY_DSN
          valueFrom:
            secretKeyRef:
              name: backend-secrets
              key: SENTRY_DSN
        - name: SENTRY_ENVIRONMENT
          value: "production"
        - name: SENTRY_TRACES_SAMPLE_RATE
          value: "0.1"  # 10% sampling in prod
```

**Step 5: Verify**

```python
# Test in backend/app/main.py
# Sentry will auto-capture exceptions and errors
logger.info("Sentry is active!", dsn_configured=bool(settings.SENTRY_DSN))
```

---

### 2. OpenTelemetry Tracing

#### Current Status
- ✅ OpenTelemetry packages installed
- ✅ Configuration variables defined (`backend/app/core/config.py:174-178`)
- ⚠️ **Missing:** Initialization code

#### Implementation Steps

**Step 1: Create Initialization Module**

File: `backend/app/core/telemetry.py`

```python
"""
OpenTelemetry configuration for distributed tracing.
"""

from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource, SERVICE_NAME, SERVICE_VERSION

from app import __version__
from app.core.config import settings
from app.core.logging import logger


def configure_telemetry(app):
    """
    Configure OpenTelemetry tracing.

    Args:
        app: FastAPI application instance
    """
    if not settings.OTEL_TRACES_ENABLED:
        logger.info("OpenTelemetry tracing disabled")
        return

    logger.info(
        "Configuring OpenTelemetry",
        endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT,
        service=settings.OTEL_SERVICE_NAME
    )

    # Create resource with service information
    resource = Resource.create({
        SERVICE_NAME: settings.OTEL_SERVICE_NAME,
        SERVICE_VERSION: __version__,
        "deployment.environment": settings.ENVIRONMENT,
    })

    # Create tracer provider
    provider = TracerProvider(resource=resource)

    # Create OTLP exporter
    otlp_exporter = OTLPSpanExporter(
        endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT,
        insecure=False,  # Use TLS in production
    )

    # Add batch span processor
    provider.add_span_processor(
        BatchSpanProcessor(otlp_exporter)
    )

    # Set as global tracer provider
    trace.set_tracer_provider(provider)

    # Instrument FastAPI app
    FastAPIInstrumentor.instrument_app(app)

    logger.info("OpenTelemetry configured successfully")
```

**Step 2: Update main.py**

```python
# Add to backend/app/main.py

from app.core.telemetry import configure_telemetry

# After creating app
app = FastAPI(...)

# Configure OpenTelemetry
configure_telemetry(app)
```

**Step 3: Deploy OTLP Backend**

**Option 1: Google Cloud Trace (Recommended for GCP)**

```bash
# No additional deployment needed!
# Google Cloud Trace natively supports OTLP

# Set endpoint to Cloud Trace
export OTEL_EXPORTER_OTLP_ENDPOINT="https://cloudtrace.googleapis.com/v2/projects/YOUR_PROJECT/traces:batchWrite"
```

Update `k8s/base/backend/configmap.yaml`:

```yaml
data:
  OTEL_TRACES_ENABLED: "true"
  OTEL_METRICS_ENABLED: "true"
  OTEL_SERVICE_NAME: "life-navigator-backend"
  OTEL_EXPORTER_OTLP_ENDPOINT: "https://cloudtrace.googleapis.com"
```

**Option 2: Jaeger (Self-hosted)**

```bash
# Deploy Jaeger in K8s
kubectl apply -f - <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jaeger
  namespace: life-navigator
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jaeger
  template:
    metadata:
      labels:
        app: jaeger
    spec:
      containers:
      - name: jaeger
        image: jaegertracing/all-in-one:latest
        ports:
        - containerPort: 16686  # UI
        - containerPort: 4317   # OTLP gRPC
        - containerPort: 4318   # OTLP HTTP
        env:
        - name: COLLECTOR_OTLP_ENABLED
          value: "true"
---
apiVersion: v1
kind: Service
metadata:
  name: jaeger
  namespace: life-navigator
spec:
  selector:
    app: jaeger
  ports:
  - name: ui
    port: 16686
    targetPort: 16686
  - name: otlp-grpc
    port: 4317
    targetPort: 4317
  - name: otlp-http
    port: 4318
    targetPort: 4318
EOF

# Set endpoint
export OTEL_EXPORTER_OTLP_ENDPOINT="http://jaeger:4317"
```

---

### 3. Log Aggregation (Cloud Logging)

#### Current Status
- ✅ Structured logging with `structlog`
- ✅ JSON output in production
- ⚠️ **Missing:** Centralized log collection

#### Implementation (Google Cloud Logging)

**Automatic Collection (Recommended)**

GKE automatically sends container stdout/stderr to Cloud Logging!

**Step 1: Verify Logging is Active**

```bash
# Check if logs are flowing
gcloud logging read "resource.type=k8s_container AND resource.labels.namespace_name=life-navigator" --limit 10
```

**Step 2: Create Log-based Metrics**

```bash
# Create metric for errors
gcloud logging metrics create backend_errors \
  --description="Count of backend errors" \
  --log-filter='resource.type="k8s_container"
    resource.labels.namespace_name="life-navigator"
    resource.labels.container_name="backend"
    severity>=ERROR'

# Create metric for 5xx responses
gcloud logging metrics create http_5xx_responses \
  --description="Count of HTTP 5xx responses" \
  --log-filter='resource.type="k8s_container"
    resource.labels.namespace_name="life-navigator"
    jsonPayload.status_code>=500'
```

**Step 3: Set Log Retention**

```bash
# Set to 30 days (HIPAA compliance minimum)
gcloud logging buckets update _Default \
  --location=global \
  --retention-days=90
```

**Step 4: Create Log Sink for Long-term Storage**

```bash
# Create GCS bucket for archive
gsutil mb gs://life-navigator-logs-archive

# Create sink
gcloud logging sinks create life-navigator-logs-archive \
  gs://life-navigator-logs-archive \
  --log-filter='resource.labels.namespace_name="life-navigator"'

# Grant permissions
PROJECT_ID=$(gcloud config get-value project)
gsutil iam ch serviceAccount:cloud-logs@system.gserviceaccount.com:objectCreator gs://life-navigator-logs-archive
```

---

## 🔒 **PENDING: Security Configuration Fixes**

### 1. Fix CORS Configuration

#### Current Issue

File: `backend/app/main.py` (around line 131-140)

```python
# ❌ INSECURE - Allows all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # DANGER!
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

#### Fixed Configuration

Create file: `backend/app/core/cors.py`

```python
"""
CORS configuration for production.
"""

from app.core.config import settings

def get_allowed_origins() -> list[str]:
    """
    Get list of allowed CORS origins based on environment.

    Returns:
        List of allowed origin URLs
    """
    if settings.is_development:
        # Allow localhost in development
        return [
            "http://localhost:3000",
            "http://localhost:3001",
            "http://localhost:3002",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:3001",
        ]

    elif settings.is_staging:
        return [
            "https://staging.life-navigator.app",
            "https://staging-api.life-navigator.app",
        ]

    else:  # Production
        return [
            "https://life-navigator.app",
            "https://www.life-navigator.app",
            "https://app.life-navigator.app",
            "capacitor://localhost",  # iOS mobile app
            "http://localhost",        # Android mobile app
            # Add Vercel preview URLs if needed
            # "https://*.vercel.app",  # Note: Need regex support
        ]


CORS_CONFIG = {
    "allow_origins": get_allowed_origins(),
    "allow_credentials": True,
    "allow_methods": ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    "allow_headers": [
        "Accept",
        "Accept-Language",
        "Content-Type",
        "Authorization",
        "X-Request-ID",
        "X-Correlation-ID",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers",
    ],
    "expose_headers": [
        "X-Request-ID",
        "X-Correlation-ID",
        "X-RateLimit-Limit",
        "X-RateLimit-Remaining",
        "X-RateLimit-Reset",
    ],
    "max_age": 600,  # 10 minutes
}
```

Update `backend/app/main.py`:

```python
from app.core.cors import CORS_CONFIG

# Replace existing CORS middleware with:
app.add_middleware(CORSMiddleware, **CORS_CONFIG)
```

---

### 2. GCP Secret Manager Setup Script

Create file: `scripts/deploy/setup-secrets.sh`

```bash
#!/bin/bash
#
# Setup GCP Secret Manager secrets for Life Navigator
#
# Usage: ./scripts/deploy/setup-secrets.sh [environment]
#

set -euo pipefail

ENVIRONMENT="${1:-dev}"
PROJECT_ID=$(gcloud config get-value project)
SA_EMAIL="life-navigator-gke@${PROJECT_ID}.iam.gserviceaccount.com"

echo "🔐 Setting up secrets for environment: $ENVIRONMENT"
echo "📦 Project: $PROJECT_ID"

# Function to create secret
create_secret() {
    local secret_name=$1
    local secret_value=$2

    echo "Creating secret: $secret_name"

    # Check if secret exists
    if gcloud secrets describe "$secret_name" >/dev/null 2>&1; then
        echo "  ↳ Secret already exists, creating new version"
        echo -n "$secret_value" | gcloud secrets versions add "$secret_name" --data-file=-
    else
        echo "  ↳ Creating new secret"
        echo -n "$secret_value" | gcloud secrets create "$secret_name" \
            --replication-policy="automatic" \
            --data-file=-

        # Grant access to service account
        gcloud secrets add-iam-policy-binding "$secret_name" \
            --member="serviceAccount:$SA_EMAIL" \
            --role="roles/secretmanager.secretAccessor" \
            >/dev/null 2>&1
    fi
}

# Generate secure random values
generate_secret_key() {
    openssl rand -hex 32
}

# Main secrets
echo ""
echo "📝 Core Secrets"
echo "==============="

# JWT Secret Key
JWT_SECRET=$(generate_secret_key)
create_secret "jwt-secret-key-${ENVIRONMENT}" "$JWT_SECRET"

# Database URL (replace with actual values)
read -sp "Enter PostgreSQL password: " POSTGRES_PASSWORD
echo ""
DB_URL="postgresql://lifenavigator:${POSTGRES_PASSWORD}@life-navigator-postgres:5432/lifenavigator"
create_secret "database-url-${ENVIRONMENT}" "$DB_URL"

# Redis URL
read -sp "Enter Redis password (or press Enter to skip): " REDIS_PASSWORD
echo ""
if [ -n "$REDIS_PASSWORD" ]; then
    REDIS_URL="redis://:${REDIS_PASSWORD}@life-navigator-redis:6379/0"
else
    REDIS_URL="redis://life-navigator-redis:6379/0"
fi
create_secret "redis-url-${ENVIRONMENT}" "$REDIS_URL"

echo ""
echo "🔧 Neo4j Secrets"
echo "==============="

read -sp "Enter Neo4j password: " NEO4J_PASSWORD
echo ""
create_secret "neo4j-password-${ENVIRONMENT}" "$NEO4J_PASSWORD"
create_secret "neo4j-uri-${ENVIRONMENT}" "bolt://life-navigator-neo4j:7687"

echo ""
echo "🤖 AI/ML Service Secrets"
echo "========================"

read -p "Enter Anthropic API Key (or press Enter to skip): " ANTHROPIC_KEY
if [ -n "$ANTHROPIC_KEY" ]; then
    create_secret "anthropic-api-key-${ENVIRONMENT}" "$ANTHROPIC_KEY"
fi

read -p "Enter OpenAI API Key (or press Enter to skip): " OPENAI_KEY
if [ -n "$OPENAI_KEY" ]; then
    create_secret "openai-api-key-${ENVIRONMENT}" "$OPENAI_KEY"
fi

echo ""
echo "🏦 Finance Integration Secrets"
echo "==============================="

read -p "Enter Plaid Client ID (or press Enter to skip): " PLAID_CLIENT_ID
if [ -n "$PLAID_CLIENT_ID" ]; then
    create_secret "plaid-client-id-${ENVIRONMENT}" "$PLAID_CLIENT_ID"

    read -sp "Enter Plaid Secret: " PLAID_SECRET
    echo ""
    create_secret "plaid-secret-${ENVIRONMENT}" "$PLAID_SECRET"
fi

read -p "Enter Stripe API Key (or press Enter to skip): " STRIPE_KEY
if [ -n "$STRIPE_KEY" ]; then
    create_secret "stripe-api-key-${ENVIRONMENT}" "$STRIPE_KEY"
fi

echo ""
echo "📧 Communication Secrets"
echo "======================="

read -p "Enter SendGrid API Key (or press Enter to skip): " SENDGRID_KEY
if [ -n "$SENDGRID_KEY" ]; then
    create_secret "sendgrid-api-key-${ENVIRONMENT}" "$SENDGRID_KEY"
fi

read -p "Enter Twilio Account SID (or press Enter to skip): " TWILIO_SID
if [ -n "$TWILIO_SID" ]; then
    create_secret "twilio-account-sid-${ENVIRONMENT}" "$TWILIO_SID"

    read -sp "Enter Twilio Auth Token: " TWILIO_TOKEN
    echo ""
    create_secret "twilio-auth-token-${ENVIRONMENT}" "$TWILIO_TOKEN"
fi

echo ""
echo "📊 Observability Secrets"
echo "======================="

read -p "Enter Sentry DSN (or press Enter to skip): " SENTRY_DSN
if [ -n "$SENTRY_DSN" ]; then
    create_secret "sentry-dsn-${ENVIRONMENT}" "$SENTRY_DSN"
fi

echo ""
echo "✅ All secrets created successfully!"
echo ""
echo "🔍 Verify secrets:"
echo "   gcloud secrets list --filter='name~${ENVIRONMENT}'"
echo ""
echo "📝 Next steps:"
echo "   1. Update k8s/base/*/external-secrets.yaml"
echo "   2. Apply ExternalSecrets: kubectl apply -f k8s/shared/external-secrets.yaml"
echo "   3. Verify secrets in K8s: kubectl get secrets -n life-navigator"
```

Make executable:

```bash
chmod +x scripts/deploy/setup-secrets.sh
```

Run it:

```bash
./scripts/deploy/setup-secrets.sh production
```

---

### 3. Update Kubernetes Network Policies

File: `k8s/shared/networkpolicies.yaml` (create if doesn't exist)

```yaml
---
# Backend Network Policy - Strict ingress/egress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-netpol
  namespace: life-navigator
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
    - Ingress
    - Egress

  ingress:
    # Allow from ingress controller
    - from:
      - namespaceSelector:
          matchLabels:
            name: ingress-nginx
      ports:
      - protocol: TCP
        port: 8000

    # Allow from same namespace (for debugging)
    - from:
      - podSelector:
          matchLabels:
            app: backend
      ports:
      - protocol: TCP
        port: 8000

  egress:
    # Allow DNS
    - to:
      - namespaceSelector:
          matchLabels:
            name: kube-system
      - podSelector:
          matchLabels:
            k8s-app: kube-dns
      ports:
      - protocol: UDP
        port: 53

    # Allow PostgreSQL
    - to:
      - podSelector:
          matchLabels:
            app: postgres
      ports:
      - protocol: TCP
        port: 5432

    # Allow Redis
    - to:
      - podSelector:
          matchLabels:
            app: redis
      ports:
      - protocol: TCP
        port: 6379

    # Allow HTTPS (for external APIs)
    - to:
      - namespaceSelector: {}
      ports:
      - protocol: TCP
        port: 443

    # Allow Sentry
    - to:
      - namespaceSelector: {}
      ports:
      - protocol: TCP
        port: 443

---
# Default deny all ingress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-ingress
  namespace: life-navigator
spec:
  podSelector: {}
  policyTypes:
    - Ingress

---
# Allow ingress from same namespace
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-same-namespace
  namespace: life-navigator
spec:
  podSelector: {}
  policyTypes:
    - Ingress
  ingress:
    - from:
      - podSelector: {}
```

Apply:

```bash
kubectl apply -f k8s/shared/networkpolicies.yaml
```

---

## 📱 **PENDING: Mobile App Testing**

Create file: `apps/mobile/__tests__/App.test.tsx`

```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import App from '../App';

describe('App', () => {
  it('renders correctly', () => {
    const { getByText } = render(<App />);
    // Add your assertions here
    expect(getByText).toBeDefined();
  });
});
```

Create file: `apps/mobile/jest.config.js`

```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)'
  ],
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/coverage/**',
    '!**/node_modules/**',
    '!**/babel.config.js',
    '!**/jest.setup.js'
  ],
};
```

Create file: `apps/mobile/jest.setup.js`

```javascript
import '@testing-library/jest-native/extend-expect';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Expo modules
jest.mock('expo-font');
jest.mock('expo-asset');
```

Update `apps/mobile/package.json`:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  },
  "devDependencies": {
    "@testing-library/react-native": "^12.0.0",
    "@testing-library/jest-native": "^5.4.0",
    "jest": "^29.0.0",
    "jest-expo": "^50.0.0"
  }
}
```

---

## 📊 **PENDING: Grafana Dashboards**

Create file: `k8s/base/monitoring/grafana-dashboard-configmap.yaml`

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboard-life-navigator
  namespace: monitoring
  labels:
    grafana_dashboard: "1"
data:
  life-navigator.json: |
    {
      "dashboard": {
        "title": "Life Navigator - Production Dashboard",
        "tags": ["life-navigator", "production"],
        "timezone": "browser",
        "panels": [
          {
            "title": "Request Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "sum(rate(http_requests_total{job=\"backend\"}[5m])) by (status_code)",
                "legendFormat": "{{status_code}}"
              }
            ]
          },
          {
            "title": "Error Rate",
            "type": "graph",
            "targets": [
              {
                "expr": "sum(rate(http_requests_total{job=\"backend\",status_code=~\"5..\"}[5m]))",
                "legendFormat": "5xx Errors"
              }
            ]
          },
          {
            "title": "Response Time (p95)",
            "type": "graph",
            "targets": [
              {
                "expr": "histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket{job=\"backend\"}[5m])) by (le))",
                "legendFormat": "p95"
              }
            ]
          },
          {
            "title": "Pod CPU Usage",
            "type": "graph",
            "targets": [
              {
                "expr": "sum(rate(container_cpu_usage_seconds_total{namespace=\"life-navigator\"}[5m])) by (pod)",
                "legendFormat": "{{pod}}"
              }
            ]
          },
          {
            "title": "Pod Memory Usage",
            "type": "graph",
            "targets": [
              {
                "expr": "sum(container_memory_working_set_bytes{namespace=\"life-navigator\"}) by (pod)",
                "legendFormat": "{{pod}}"
              }
            ]
          },
          {
            "title": "Database Connections",
            "type": "graph",
            "targets": [
              {
                "expr": "pg_stat_database_numbackends{datname=\"lifenavigator\"}",
                "legendFormat": "Active Connections"
              }
            ]
          }
        ]
      }
    }
```

---

## 🚀 **Deployment Checklist**

### Week 1: Critical Fixes

- [x] ✅ E2E tests implemented (5 test suites, 40+ tests)
- [x] ✅ Package.json updated with test scripts
- [ ] ⏳ Run `pnpm install` and `pnpm playwright:install`
- [ ] ⏳ Sentry DSN created and configured
- [ ] ⏳ OpenTelemetry initialized
- [ ] ⏳ CORS configuration fixed
- [ ] ⏳ GCP secrets populated
- [ ] ⏳ Network policies updated

### Week 2: Testing & Validation

- [ ] ⏳ Run all E2E tests (`pnpm test:e2e`)
- [ ] ⏳ Fix any failing tests
- [ ] ⏳ Mobile app tests implemented
- [ ] ⏳ Verify Sentry capturing errors
- [ ] ⏳ Verify traces in Cloud Trace/Jaeger
- [ ] ⏳ Verify logs in Cloud Logging

### Week 3: Production Deployment

- [ ] ⏳ Deploy to staging environment
- [ ] ⏳ Run smoke tests
- [ ] ⏳ Load testing
- [ ] ⏳ Security scan
- [ ] ⏳ Deploy to production
- [ ] ⏳ Monitor for 24 hours

---

## 📞 **Support Commands**

### Run E2E Tests

```bash
cd apps/web
pnpm test:e2e
```

### Deploy Secrets

```bash
./scripts/deploy/setup-secrets.sh production
```

### Verify Sentry

```python
# In backend, trigger test error
raise Exception("Test Sentry integration")
```

### Check Logs

```bash
# View backend logs
kubectl logs -f deployment/backend -n life-navigator

# View all logs in Cloud Logging
gcloud logging read "resource.type=k8s_container" --limit 50
```

### Verify Network Policies

```bash
# List network policies
kubectl get networkpolicies -n life-navigator

# Describe policy
kubectl describe networkpolicy backend-netpol -n life-navigator
```

---

**Status:** Implementation guide complete. Ready to execute fixes.
**Next:** Run through each section systematically.
