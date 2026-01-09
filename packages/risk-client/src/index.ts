/**
 * LifeNavigator Risk Client
 * =============================================================================
 * Shared client for risk-engine API (web + mobile)
 *
 * Architecture:
 * - Web (Next.js): tRPC → main backend → risk-engine
 * - Mobile (Expo): REST API → main backend → risk-engine
 *
 * Frontend never calls risk-engine directly - always through main backend proxy.
 */

export * from './types';
export * from './client';
export * from './hooks';
export * from './utils';
