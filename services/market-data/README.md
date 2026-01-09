# Market Data Service

**Production-grade market data feed pipeline for LifeNavigator risk-engine.**

## Purpose

This service:
1. Collects market data from FREE public APIs (FRED, Yahoo Finance)
2. Normalizes into a single `MarketSnapshot` schema
3. Computes derived features (volatility, risk-on score, regime indicators)
4. Stores snapshots in GCS for auditability
5. Provides internal API for other services

**Key Principle**: Risk-engine NEVER calls external APIs directly. Only market-data does.

---

## Features

- ✅ **FRED collector**: Macro indicators, rates, yields, inflation, unemployment
- ✅ **Yahoo Finance collector**: Equity, bond, commodity, crypto proxies
- ✅ **Normalized schema**: Single `MarketSnapshot` format consumed by risk-engine
- ✅ **Derived features**: Volatility, yield curve slope, risk-on score, regime indicators
- ✅ **GCS storage**: Compliant, auditable snapshot persistence
- ✅ **Service-to-service auth**: JWT with audience + scope validation
- ✅ **Observability**: Prometheus metrics, structured JSON logs
- ✅ **Deterministic**: Same inputs → same outputs (reproducible)
- ✅ **Resilient**: Retries, backoff, circuit breaker behavior
- ✅ **Secure**: No PHI/PCI, network isolation, non-root containers

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ External Data Sources (Public APIs)                            │
│ - FRED (Fed economic data)                                     │
│ - Yahoo Finance (market proxies)                               │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ HTTP (daily fetch)
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Market-Data Service (Internal)                                  │
│ - Collectors: Fetch raw data                                   │
│ - Normalizers: Compute features                                │
│ - Validators: Sanity checks                                    │
│ - Storage: GCS persistence                                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ ClusterIP (K8s NetworkPolicy)
                     │ Service-to-Service JWT
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Main Backend (FastAPI)                                          │
│ - MarketDataClient                                              │
│ - MarketContextEnricher                                         │
│ - Enriches RiskRequest with market_context                     │
└────────────────────┬────────────────────────────────────────────┘
                     │
                     │ Private network
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│ Risk Engine                                                     │
│ - Receives enriched RiskRequest with market_context            │
│ - NEVER calls external APIs                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Sources

### FRED (Federal Reserve Economic Data)

FREE API (optional key for higher rate limits):
- **CPIAUCSL**: Consumer Price Index (inflation)
- **FEDFUNDS**: Federal Funds Rate
- **DGS2**: 2-Year Treasury Yield
- **DGS10**: 10-Year Treasury Yield
- **UNRATE**: Unemployment Rate

Get API key: https://fred.stlouisfed.org/docs/api/api_key.html

### Yahoo Finance

FREE, no API key required:
- **^GSPC**: S&P 500 (equity proxy)
- **^VIX**: CBOE Volatility Index
- **TLT**: iShares 20+ Year Treasury ETF (long bonds)
- **SHY**: iShares 1-3 Year Treasury ETF (short bonds)
- **GLD**: Gold ETF
- **BTC-USD**: Bitcoin
- **ETH-USD**: Ethereum

---

## Normalized Schema

All data is normalized into `MarketSnapshot`:

```python
{
  "snapshot_id": "20240109_060000_abc123",
  "as_of": "2024-01-09T06:00:00Z",
  "created_at": "2024-01-09T06:01:23Z",

  # Volatilities (annualized, 0-1 scale)
  "equity_vol": {value: 0.15, confidence: "high", source: "yahoo", ...},
  "bond_vol": {value: 0.06, confidence: "high", ...},
  "crypto_vol": {value: 0.80, confidence: "medium", ...},

  # Interest rates (decimal, e.g., 0.045 = 4.5%)
  "rates_2y": {value: 0.04, confidence: "high", source: "fred", ...},
  "rates_10y": {value: 0.045, confidence: "high", ...},
  "yield_curve_slope": {value: 50.0, confidence: "high", ...},  # bps

  # Macro indicators
  "inflation_yoy": {value: 0.03, confidence: "high", ...},
  "unemployment_rate": {value: 0.04, confidence: "high", ...},

  # Regime features (derived)
  "regime_features": {
    "risk_on_score": {value: 0.7, confidence: "high", ...},  # 0-1
    "volatility_regime": {value: 0.0, confidence: "high", ...},  # 0/0.5/1
    "equity_momentum_60d": {value: 0.12, confidence: "high", ...},
    "vol_shock": {value: 0.0, confidence: "high", ...},
    ...
  },

  "overall_confidence": "high",  # high/medium/low/none
  "warnings": []
}
```

---

## Environment Variables

Required:

```bash
# Service config
SERVICE_NAME=market-data
ENVIRONMENT=production
PORT=8002

# Security - JWT validation
JWT_SECRET=<32+ char secret>  # Shared with main backend

# Storage - GCS
GCS_BUCKET_NAME=lifenav-market-snapshots
GCS_PROJECT_ID=life-navigator

# Optional - FRED API key (recommended)
FRED_API_KEY=<your_fred_api_key>
```

Optional:

```bash
# Logging
LOG_LEVEL=INFO

# HTTP client
HTTP_TIMEOUT_SECONDS=30
HTTP_MAX_RETRIES=3

# Feature flags
ENABLE_ECB_COLLECTOR=false
ENABLE_ALPHAVANTAGE_COLLECTOR=false
```

---

## Local Development

### 1. Install dependencies

```bash
cd services/market-data
pip install -e ".[dev]"
```

### 2. Set environment variables

```bash
export JWT_SECRET="your-jwt-secret-at-least-32-chars"
export GCS_BUCKET_NAME="lifenav-market-snapshots-dev"
export GCS_PROJECT_ID="life-navigator-dev"
export FRED_API_KEY="optional-fred-api-key"
```

### 3. Run the service

```bash
python -m app.main
```

Service runs on http://localhost:8002

### 4. Trigger a snapshot build

```bash
# Generate a service token (use proper JWT in production)
TOKEN="your-test-jwt-token"

curl -X POST http://localhost:8002/v1/snapshots/build \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

### 5. Fetch latest snapshot

```bash
curl http://localhost:8002/v1/snapshots/latest \
  -H "Authorization: Bearer $TOKEN"
```

---

## Testing

Run all tests:

```bash
pytest
```

Run with coverage:

```bash
pytest --cov=app --cov-report=html
```

Test categories:
- `test_schema_contract.py`: Schema validation and serialization
- `test_fred_collector.py`: FRED collector (mocked)
- `test_yahoo_collector.py`: Yahoo collector (mocked)
- `test_snapshot_builder.py`: End-to-end snapshot build
- `test_api_latest_snapshot.py`: API endpoint tests

---

## Deployment

### Build Docker image

```bash
docker build -t gcr.io/life-navigator/market-data:latest .
```

### Push to GCR

```bash
docker push gcr.io/life-navigator/market-data:latest
```

### Deploy to Kubernetes

```bash
kubectl apply -f infrastructure/k8s/base/market-data/
```

This creates:
- Deployment (2 replicas)
- Service (ClusterIP)
- NetworkPolicy (backend-only access)
- HorizontalPodAutoscaler
- ServiceMonitor (Prometheus)
- CronJob (daily snapshot build at 6 AM UTC)

---

## Backend Integration

### 1. Main backend calls market-data

```python
from app.core.service_clients.market_data_client import MarketDataClient

client = MarketDataClient()
snapshot_response = await client.get_latest_snapshot()
```

### 2. Enrich RiskRequest

```python
from app.services.market_context_enricher import MarketContextEnricher

enricher = MarketContextEnricher()
enriched_request = await enricher.enrich_risk_request(request_body)
```

### 3. Forward to risk-engine

The enriched request now contains `market_context`:

```python
{
  "market_context": {
    "equity_vol_annual": 0.15,
    "bond_vol_annual": 0.06,
    "rates_short_term": 0.04,
    "rates_long_term": 0.045,
    "inflation_yoy": 0.03,
    "risk_on_score": 0.7,
    "volatility_regime": "low"
  },
  "request_meta": {
    "market_snapshot_id": "20240109_060000_abc123",
    "market_snapshot_confidence": "high",
    "market_snapshot_staleness_seconds": 3600
  },
  ...
}
```

---

## Observability

### Prometheus Metrics

Exposed at `/metrics`:

- `market_data_fetch_latency_seconds{source}`: Fetch latency by source
- `market_snapshot_build_total{status}`: Build attempts (success/fail)
- `market_snapshot_build_duration_seconds`: Build duration
- `market_snapshot_staleness_seconds`: Age of latest snapshot
- `market_snapshot_confidence`: Overall confidence (0-3)
- `market_data_errors_total{source,error_type}`: Error counts
- `market_data_api_requests_total{endpoint,status}`: API request counts

### Structured Logging

JSON logs with:
- `timestamp`: ISO 8601
- `level`: DEBUG/INFO/WARNING/ERROR
- `message`: Log message
- `context`: Request ID, source, etc.

**NO sensitive data logged** (API keys, raw payloads redacted).

---

## Failure Modes & Operational Notes

### Scenario 1: FRED unavailable

- **Impact**: Missing rates, inflation, unemployment
- **Fallback**: Use last known values or baseline defaults
- **Confidence**: Marked as LOW
- **Action**: Monitor `market_data_errors_total{source="fred"}`

### Scenario 2: Yahoo Finance unavailable

- **Impact**: Missing volatilities, equity data
- **Fallback**: Use baseline historical averages
- **Confidence**: Marked as LOW
- **Action**: Check network connectivity, retry logic

### Scenario 3: GCS storage failure

- **Impact**: Cannot store new snapshots
- **Fallback**: Log error, alert ops team
- **Action**: Check GCS permissions, bucket existence

### Scenario 4: Stale snapshot (>2 days old)

- **Impact**: Risk computations use outdated market context
- **Fallback**: Add warning to RiskResponse
- **Action**: Trigger manual build via `/v1/snapshots/build`

---

## Security

1. **No external access**: ClusterIP only, NetworkPolicy restricts ingress
2. **Service-to-service JWT**: All API calls require valid token with `aud="market-data"`
3. **No PHI/PCI**: Only numeric market data, no user data
4. **Non-root container**: Runs as UID 1000
5. **Read-only root filesystem**: No write access except temp dirs
6. **Secrets management**: JWT secret, FRED API key stored in K8s Secrets
7. **Audit trail**: All snapshots timestamped and stored in GCS

---

## Compliance

- **Licensing**: Only stores derived metrics (volatility, returns), NOT raw vendor payloads
- **Rate limits**: FRED (5/min without key), Yahoo (no hard limit but throttled)
- **Data retention**: Snapshots retained indefinitely in GCS for audit
- **Attribution**: Data sources documented in provenance

---

## Future Enhancements

- ✅ ECB collector (EUR rates, inflation)
- ✅ AlphaVantage collector (intraday data)
- ✅ Cloud SQL storage (secondary store for queries)
- ✅ Range queries (`/v1/snapshots/range`)
- ✅ Credit spread computation (corporate bond spreads)
- ✅ FX volatility (multi-currency support)
- ✅ Hourly snapshots (instead of daily)
- ✅ Streaming updates (SSE for real-time regime changes)

---

## Support

- **Issues**: Report to #platform-engineering (Slack)
- **Documentation**: [docs/architecture/SERVICES.md](../../docs/architecture/SERVICES.md)
- **Security**: security@lifenavigator.com

---

**Last Updated**: 2024-01-09
