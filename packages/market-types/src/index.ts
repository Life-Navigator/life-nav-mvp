/**
 * TypeScript types for Market Data Service
 *
 * Mirrors the Python Pydantic schema for MarketSnapshot.
 * Used by web and mobile apps to consume market data.
 */

export enum DataSource {
  FRED = 'fred',
  YAHOO = 'yahoo',
  ECB = 'ecb',
  ALPHAVANTAGE = 'alphavantage',
  FALLBACK = 'fallback',
}

export enum ConfidenceLevel {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
  NONE = 'none',
}

export interface FieldConfidence {
  value: number | null;
  confidence: ConfidenceLevel;
  source: DataSource;
  staleness_seconds: number;
  missing: boolean;
  warning?: string;
}

export interface RegimeFeatures {
  risk_on_score: FieldConfidence;
  recession_probability: FieldConfidence;
  volatility_regime: FieldConfidence;
  liquidity_score: FieldConfidence;
  equity_momentum_60d: FieldConfidence;
  rates_trend: FieldConfidence;
  vol_shock: FieldConfidence;
  credit_shock: FieldConfidence;
}

export interface MarketSnapshot {
  // Metadata
  snapshot_id: string;
  as_of: string; // ISO 8601 timestamp
  created_at: string; // ISO 8601 timestamp
  version: string;

  // Volatilities
  equity_vol: FieldConfidence;
  bond_vol: FieldConfidence;
  crypto_vol: FieldConfidence;
  fx_vol: FieldConfidence;

  // Interest rates
  rates_2y: FieldConfidence;
  rates_10y: FieldConfidence;
  yield_curve_slope: FieldConfidence;

  // Macro indicators
  inflation_yoy: FieldConfidence;
  unemployment_rate: FieldConfidence;

  // Credit
  credit_spread_proxy: FieldConfidence;

  // Regime features
  regime_features: RegimeFeatures;

  // Overall quality
  overall_confidence: ConfidenceLevel;
  warnings: string[];
}

export interface Provenance {
  snapshot_id: string;
  sources_used: DataSource[];
  fred_series_fetched: string[];
  yahoo_symbols_fetched: string[];
  fetch_timestamp: string; // ISO 8601
  build_duration_seconds: number;
  errors: string[];
}

export interface SnapshotResponse {
  snapshot: MarketSnapshot;
  provenance: Provenance;
  staleness_seconds: number;
  warnings: string[];
}

/**
 * Market context fields used by risk-engine.
 *
 * This is the enriched format that backend sends to risk-engine.
 */
export interface MarketContext {
  equity_vol_annual?: number;
  bond_vol_annual?: number;
  rates_short_term?: number;
  rates_long_term?: number;
  inflation_yoy?: number;
  risk_on_score?: number;
  volatility_regime?: 'low' | 'medium' | 'high';
}
