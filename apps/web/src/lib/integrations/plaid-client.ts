/**
 * Plaid API Client Configuration
 *
 * This module provides a configured Plaid client for financial data integration.
 * Supports sandbox, development, and production environments.
 */

import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';

// Note: Environment variable validation is done at runtime via isPlaidConfigured
// This allows the build to complete even without Plaid credentials

// Determine Plaid environment
const getPlaidEnvironment = (): PlaidEnvironments => {
  const env = process.env.PLAID_ENV || 'sandbox';

  switch (env.toLowerCase()) {
    case 'sandbox':
      return PlaidEnvironments.sandbox;
    case 'development':
      return PlaidEnvironments.development;
    case 'production':
      return PlaidEnvironments.production;
    default:
      console.warn(`Unknown PLAID_ENV: ${env}, defaulting to sandbox`);
      return PlaidEnvironments.sandbox;
  }
};

// Plaid client configuration
const configuration = new Configuration({
  basePath: getPlaidEnvironment(),
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || '',
      'PLAID-SECRET': process.env.PLAID_SECRET || '',
    },
  },
});

// Create and export Plaid client
export const plaidClient = new PlaidApi(configuration);

// Export environment helper
export const plaidEnvironment = process.env.PLAID_ENV || 'sandbox';
export const isPlaidConfigured = Boolean(
  process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET
);

/**
 * Plaid products to request access to
 * https://plaid.com/docs/api/products/
 */
export const PLAID_PRODUCTS = ['auth', 'transactions', 'identity', 'assets', 'investments'] as const;

/**
 * Supported Plaid country codes
 */
export const PLAID_COUNTRY_CODES = ['US', 'CA'] as const;

/**
 * Plaid Link customization
 */
export const PLAID_LINK_CUSTOMIZATION = {
  name: 'Life Navigator',
  logo: 'https://nexlevel-intelligence.com/logo.png',
  primaryColor: '#3b82f6',
};
