# Market Data Service Architecture

**Status:** Active
**Last Updated:** 2026-01-09
**Owner:** Platform Engineering

---

## Purpose

The market-data service provides normalized, production-grade market data feeds to the risk-engine for Monte Carlo simulations and goal probability calculations.

**Key Principle**: Risk-engine NEVER calls external market APIs directly. Only market-data does.

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│ External Data Sources (FREE Public APIs)                            │
│                                                                       │
│  FRED (Federal Reserve)         Yahoo Finance                       │
│  - Rates (2y, 10y)              - S&P 500 (^GSPC)                  │
│  - Inflation (CPI)              - VIX (^VIX)                        │
│  - Unemployment                 - Bond ETFs (TLT, SHY)              │
│  - Fed Funds Rate               - Crypto (BTC, ETH)                 │
│                                 - Gold (GLD)                         │
└────────────────────┬──────────────────────┬──────────────────────────┘
                     │                      │
                     │ Daily fetch          │
                     │ (6 AM UTC)           │
                     │                      │
                     ▼                      ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Market-Data Service (Internal Microservice)                          │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │  Collectors  │  │ Normalizers  │  │  Validators  │               │
│  ├──────────────┤  ├──────────────┤  ├──────────────┤               │
│  │ FREDCollector│  │ Feature      │  │ Snapshot     │               │
│  │ YahooCollector│ │ Computer     │  │ Validator    │               │
│  │ ECB (stub)   │  │ Regime       │  │              │               │
│  │ AlphaVantage │  │ Computer     │  │              │               │
│  │ (stub)       │  │              │  │              │               │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘               │
│         │                 │                 │                        │
│         └────────┬────────┴─────────────────┘                        │
│                  │                                                    │
│                  ▼                                                    │
│         ┌─────────────────┐                                          │
│         │ Snapshot Builder│                                          │
│         └────────┬─────────┘                                         │
│                  │                                                    │
│                  ▼                                                    │
│         ┌─────────────────┐                                          │
│         │   GCS Storage   │                                          │
│         │  (JSON files)   │                                          │
│         └─────────────────┘                                          │
│                                                                       │
│  API Endpoints (FastAPI):                                            │
│  - POST /v1/snapshots/build                                          │
│  - GET  /v1/snapshots/latest                                         │
│  - GET  /v1/snapshots/{date}                                         │
│                                                                       │
└────────────────────┬──────────────────────────────────────────────────┘
                     │
                     │ ClusterIP (K8s internal)
                     │ Service-to-Service JWT
                     │ aud="market-data"
                     │ scope="market:read"
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Main Backend (FastAPI)                                               │
│                                                                       │
│  ┌───────────────────────┐     ┌───────────────────────┐            │
│  │ MarketDataClient      │     │ MarketContextEnricher │            │
│  ├───────────────────────┤     ├───────────────────────┤            │
│  │ - Fetch snapshots     │────▶│ - Map to market_ctx   │            │
│  │ - Generate S2S JWT    │     │ - Add to RiskRequest  │            │
│  │ - Handle failures     │     │ - Fallback values     │            │
│  └───────────────────────┘     └───────────┬───────────┘            │
│                                             │                         │
└─────────────────────────────────────────────┼─────────────────────────┘
                                              │
                                              │ Private network
                                              │ S2S JWT (risk-engine)
                                              │
                                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Risk Engine                                                           │
│                                                                       │
│  Receives enriched RiskRequest with:                                 │
│  - market_context: {equity_vol, rates, inflation, risk_on_score...} │
│  - request_meta: {market_snapshot_id, confidence, staleness...}     │
│                                                                       │
│  NEVER calls external APIs directly                                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### 1. Daily Snapshot Build (Automated)

Triggered by K8s CronJob at 6 AM UTC:

```
1. CronJob POST /v1/snapshots/build (S2S JWT with market:build scope)
2. SnapshotBuilder orchestrates:
   a. Fetch FRED data (rates, inflation, unemployment)
   b. Fetch Yahoo data (equities, bonds, crypto, VIX)
   c. Compute derived features:
      - Volatility (rolling 20-day annualized)
      - Yield curve slope (10y - 2y)
      - Risk-on score (composite indicator)
      - Volatility regime (low/medium/high)
      - Momentum (60-day returns)
   d. Validate snapshot (sanity checks, range validation)
   e. Store in GCS:
      - snapshots/YYYY-MM-DD/{snapshot_id}.json
      - provenance/YYYY-MM-DD/{snapshot_id}_provenance.json
      - snapshots/latest.json (updated)
3. Update Prometheus metrics
4. Return success/failure status
```

### 2. Risk Computation Request (Real-time)

When web/mobile requests risk computation:

```
1. Frontend → Backend: POST /api/risk/snapshot
   {
     "goal_context": {...},
     "mode": "balanced"
     // NO market_context (frontend doesn't send this)
   }

2. Backend enrichment pipeline:
   a. MarketDataClient.get_latest_snapshot()
      - Generates S2S JWT (aud="market-data", scope="market:read")
      - Calls market-data GET /v1/snapshots/latest
      - Receives SnapshotResponse with MarketSnapshot

   b. MarketContextEnricher.enrich_risk_request()
      - Maps MarketSnapshot → market_context format
      - Example mapping:
        * snapshot.equity_vol.value → market_context.equity_vol_annual
        * snapshot.rates_2y.value → market_context.rates_short_term
        * snapshot.regime_features.risk_on_score.value → market_context.risk_on_score

      - Adds metadata to request_meta:
        * market_snapshot_id
        * market_snapshot_confidence
        * market_snapshot_staleness_seconds

      - If snapshot unavailable:
        * Use FALLBACK_MARKET_CONTEXT (conservative baseline values)
        * Mark confidence as "low"
        * Add warning

3. Backend → Risk Engine: POST /v1/risk/snapshot
   {
     "goal_context": {...},
     "mode": "balanced",
     "market_context": {                    // ← ENRICHED
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
       "market_snapshot_staleness_seconds": 3600,
       "warnings": []
     }
   }

4. Risk Engine uses market_context for simulation parameters
5. Backend → Frontend: Return RiskResponse
```

---

## Normalized Schema

### MarketSnapshot

```python
{
  "snapshot_id": "20240109_060000_abc123",
  "as_of": "2024-01-09T06:00:00Z",
  "created_at": "2024-01-09T06:01:23Z",
  "version": "1.0",

  # Volatilities (annualized, 0-1 scale)
  "equity_vol": {
    "value": 0.15,
    "confidence": "high",
    "source": "yahoo",
    "staleness_seconds": 0,
    "missing": false
  },
  "bond_vol": {...},
  "crypto_vol": {...},
  "fx_vol": {...},

  # Rates (decimal, e.g., 0.045 = 4.5%)
  "rates_2y": {
    "value": 0.04,
    "confidence": "high",
    "source": "fred",
    "staleness_seconds": 0,
    "missing": false
  },
  "rates_10y": {...},
  "yield_curve_slope": {
    "value": 50.0,  # basis points
    "confidence": "high",
    "source": "fred",
    "staleness_seconds": 0,
    "missing": false
  },

  # Macro
  "inflation_yoy": {...},
  "unemployment_rate": {...},
  "credit_spread_proxy": {...},

  # Regime features (derived)
  "regime_features": {
    "risk_on_score": {"value": 0.7, "confidence": "high", ...},
    "volatility_regime": {"value": 0.0, "confidence": "high", ...},  # 0=low, 0.5=medium, 1=high
    "equity_momentum_60d": {"value": 0.12, "confidence": "high", ...},
    "vol_shock": {"value": 0.0, "confidence": "high", ...},
    ...
  },

  "overall_confidence": "high",
  "warnings": []
}
```

---

## Security & Compliance

### 1. Network Isolation

- **NetworkPolicy**: Only main backend can call market-data (no frontend access)
- **Service Type**: ClusterIP (internal only, no external access)
- **Egress**: Only DNS + HTTPS (FRED, Yahoo)

### 2. Authentication

- **Service-to-Service JWT**:
  - `iss`: "life-navigator-backend"
  - `aud`: "market-data"
  - `scope`: "market:read" or "market:build"
  - `exp`: 5 minutes

### 3. Data Compliance

- **NO PHI/PCI**: Only numeric market data (no user data)
- **NO raw vendor payloads**: Only derived metrics stored (licensing compliance)
- **Audit trail**: All snapshots timestamped in GCS
- **Sensitive data redaction**: API keys never logged

### 4. Container Security

- Non-root user (UID 1000)
- Read-only root filesystem
- Drop all capabilities
- Resource limits enforced

---

## Observability

### Prometheus Metrics

```
market_data_fetch_latency_seconds{source="fred|yahoo"}
market_snapshot_build_total{status="success|fail"}
market_snapshot_build_duration_seconds
market_snapshot_staleness_seconds
market_snapshot_confidence (0-3: none/low/medium/high)
market_data_errors_total{source, error_type}
market_data_api_requests_total{endpoint, status}
```

### Alerts

- **Stale Snapshot** (>48 hours): PagerDuty alert
- **Build Failures** (3 consecutive): Alert ops team
- **High Error Rate** (>10% in 5min): Alert platform team

---

## Failure Modes & Resilience

| Failure | Impact | Mitigation | Confidence |
|---------|--------|------------|-----------|
| FRED unavailable | Missing rates/inflation | Use last snapshot or fallback values | LOW |
| Yahoo unavailable | Missing volatility/equity data | Use historical baseline | LOW |
| GCS storage failure | Cannot store snapshots | Log error, retry, alert | N/A |
| Snapshot >2 days old | Stale market data | Add warning to RiskResponse | LOW |
| All sources down | No fresh data | Use fallback baseline values | NONE |

### Fallback Values

```python
FALLBACK_MARKET_CONTEXT = {
    "equity_vol_annual": 0.18,  # Long-term avg
    "bond_vol_annual": 0.06,
    "rates_short_term": 0.04,
    "rates_long_term": 0.045,
    "inflation_yoy": 0.03,
    "risk_on_score": 0.5,  # Neutral
    "volatility_regime": "medium",
}
```

---

## Operational Runbook

### Manual Snapshot Build

```bash
# Generate service token
export TOKEN=$(generate_service_token market:build)

# Trigger build
curl -X POST https://market-data:8002/v1/snapshots/build \
  -H "Authorization: Bearer $TOKEN"
```

### Check Latest Snapshot

```bash
curl https://market-data:8002/v1/snapshots/latest \
  -H "Authorization: Bearer $TOKEN"
```

### View Metrics

```bash
kubectl port-forward svc/market-data 9090:9090
open http://localhost:9090/metrics
```

### Logs

```bash
kubectl logs -f deployment/market-data -n lifenav-backend
```

---

## Future Enhancements

- ✅ ECB collector (EUR rates, HICP inflation)
- ✅ AlphaVantage collector (intraday data)
- ✅ Cloud SQL storage (queryable time series)
- ✅ Credit spreads (corporate bond data)
- ✅ FX volatility (multi-currency)
- ✅ Hourly snapshots (instead of daily)
- ✅ Streaming updates (SSE for regime changes)

---

## Related Documentation

- [Market Data Service README](../../services/market-data/README.md)
- [Risk Engine Data Boundary](../security/RISK_ENGINE_DATA_BOUNDARY.md)
- [Services Architecture](./SERVICES.md)
- [Data Flows](./DATA_FLOWS.md)

---

**Questions?** Contact platform-engineering@lifenavigator.com
