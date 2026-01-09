/**
 * Utility Functions
 * =============================================================================
 * Helper functions for working with risk data
 */

import {
  TimeSeries,
  TimeSeriesPoint,
  PercentileBand,
  RiskResponse,
  GoalResult,
} from './types';

/**
 * Format probability as percentage
 */
export function formatProbability(probability: number): string {
  return `${(probability * 100).toFixed(1)}%`;
}

/**
 * Format currency
 */
export function formatCurrency(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Get color for success probability
 */
export function getSuccessColor(probability: number): string {
  if (probability >= 0.8) return '#10b981'; // Green
  if (probability >= 0.6) return '#f59e0b'; // Amber
  return '#ef4444'; // Red
}

/**
 * Extract percentile band data for charting
 */
export function extractPercentileBands(
  series: TimeSeries
): Array<{
  timestamp: number;
  p5: number;
  p25: number;
  p50: number;
  p75: number;
  p95: number;
}> {
  if (!series.percentile_bands) return [];

  return series.percentile_bands.map((band) => ({
    timestamp: band.timestamp,
    p5: band.p5,
    p25: band.p25,
    p50: band.p50,
    p75: band.p75,
    p95: band.p95,
  }));
}

/**
 * Get goal success status
 */
export function getGoalStatus(goal: GoalResult): 'on-track' | 'at-risk' | 'off-track' {
  if (goal.success_probability >= 0.75) return 'on-track';
  if (goal.success_probability >= 0.5) return 'at-risk';
  return 'off-track';
}

/**
 * Calculate overall portfolio health score (0-100)
 */
export function calculateHealthScore(response: RiskResponse): number {
  const successProb = response.overall.win_probability;

  // Simple scoring: success probability * 100
  // Could be more sophisticated in production
  return Math.round(successProb * 100);
}

/**
 * Get timeline data for chart
 */
export function getTimelineData(
  series: TimeSeries
): Array<{ x: string; y: number }> {
  return series.data.map((point) => ({
    x: point.label || new Date(point.timestamp * 1000).toLocaleDateString(),
    y: point.value,
  }));
}

/**
 * Parse stream event
 */
export function parseStreamEvent(eventData: string): any {
  try {
    return JSON.parse(eventData);
  } catch (error) {
    console.error('Failed to parse stream event:', error);
    return null;
  }
}

/**
 * Calculate delta magnitude (for UI visual cues)
 */
export function getDeltaMagnitude(delta_pct: number): 'small' | 'medium' | 'large' {
  const abs = Math.abs(delta_pct);
  if (abs < 0.05) return 'small';
  if (abs < 0.15) return 'medium';
  return 'large';
}

/**
 * Format recommendation impact
 */
export function formatImpact(impact_pct: number): string {
  const sign = impact_pct > 0 ? '+' : '';
  return `${sign}${(impact_pct * 100).toFixed(1)}%`;
}
