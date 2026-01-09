/**
 * Zod validation schemas for market data types.
 *
 * Runtime validation for API responses.
 */

import { z } from 'zod';

export const DataSourceSchema = z.enum(['fred', 'yahoo', 'ecb', 'alphavantage', 'fallback']);

export const ConfidenceLevelSchema = z.enum(['high', 'medium', 'low', 'none']);

export const FieldConfidenceSchema = z.object({
  value: z.number().nullable(),
  confidence: ConfidenceLevelSchema,
  source: DataSourceSchema,
  staleness_seconds: z.number().int().nonnegative(),
  missing: z.boolean(),
  warning: z.string().optional(),
});

export const RegimeFeaturesSchema = z.object({
  risk_on_score: FieldConfidenceSchema,
  recession_probability: FieldConfidenceSchema,
  volatility_regime: FieldConfidenceSchema,
  liquidity_score: FieldConfidenceSchema,
  equity_momentum_60d: FieldConfidenceSchema,
  rates_trend: FieldConfidenceSchema,
  vol_shock: FieldConfidenceSchema,
  credit_shock: FieldConfidenceSchema,
});

export const MarketSnapshotSchema = z.object({
  snapshot_id: z.string().min(10),
  as_of: z.string().datetime(),
  created_at: z.string().datetime(),
  version: z.string(),
  equity_vol: FieldConfidenceSchema,
  bond_vol: FieldConfidenceSchema,
  crypto_vol: FieldConfidenceSchema,
  fx_vol: FieldConfidenceSchema,
  rates_2y: FieldConfidenceSchema,
  rates_10y: FieldConfidenceSchema,
  yield_curve_slope: FieldConfidenceSchema,
  inflation_yoy: FieldConfidenceSchema,
  unemployment_rate: FieldConfidenceSchema,
  credit_spread_proxy: FieldConfidenceSchema,
  regime_features: RegimeFeaturesSchema,
  overall_confidence: ConfidenceLevelSchema,
  warnings: z.array(z.string()),
});

export const ProvenanceSchema = z.object({
  snapshot_id: z.string(),
  sources_used: z.array(DataSourceSchema),
  fred_series_fetched: z.array(z.string()),
  yahoo_symbols_fetched: z.array(z.string()),
  fetch_timestamp: z.string().datetime(),
  build_duration_seconds: z.number().nonnegative(),
  errors: z.array(z.string()),
});

export const SnapshotResponseSchema = z.object({
  snapshot: MarketSnapshotSchema,
  provenance: ProvenanceSchema,
  staleness_seconds: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
});

export const MarketContextSchema = z.object({
  equity_vol_annual: z.number().optional(),
  bond_vol_annual: z.number().optional(),
  rates_short_term: z.number().optional(),
  rates_long_term: z.number().optional(),
  inflation_yoy: z.number().optional(),
  risk_on_score: z.number().min(0).max(1).optional(),
  volatility_regime: z.enum(['low', 'medium', 'high']).optional(),
});
