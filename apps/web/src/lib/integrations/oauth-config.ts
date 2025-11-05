// src/lib/integrations/oauth-config.ts

/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes?: string[];
  redirectUri?: string;
  authorizationMethod?: 'header' | 'body' | 'query';
  pkce?: boolean; // Whether to use PKCE (Proof Key for Code Exchange)
  responseType?: 'code' | 'token';
  grantType?: 'authorization_code' | 'refresh_token' | 'client_credentials';
  additionalParams?: Record<string, string>;
  apiBaseUrl?: string; // Base URL for API calls
}

/**
 * Provider connection strategy
 */
export type ConnectionStrategy = 'oauth2' | 'oauth1' | 'api_key' | 'sdk' | 'form';

/**
 * Extended OAuth provider configuration with additional metadata
 */
export interface ProviderConfig extends OAuthProviderConfig {
  id: string;
  name: string;
  description: string;
  category: 'finance' | 'education' | 'career' | 'healthcare' | 'automotive' | 'smarthome';
  strategy: ConnectionStrategy;
  logo: string;
  syncSupported: boolean;  // Whether this provider supports automated data syncing
  syncInterval?: number;   // Minutes between automatic syncs, if supported
  docsUrl?: string;        // URL to developer documentation for this provider
}

/**
 * OAuth provider configurations
 */
const OAUTH_CONFIGS: Record<string, ProviderConfig> = {
  // Financial providers
  plaid: {
    id: 'plaid',
    name: 'Plaid',
    description: 'Connect bank accounts, credit cards, and investments',
    category: 'finance',
    strategy: 'sdk',
    clientId: process.env.PLAID_CLIENT_ID || 'mock_client_id',
    clientSecret: process.env.PLAID_CLIENT_SECRET || 'mock_client_secret',
    authorizationUrl: 'https://cdn.plaid.com/link/v2/stable/link.html',
    tokenUrl: 'https://sandbox.plaid.com/item/public_token/exchange',
    apiBaseUrl: 'https://sandbox.plaid.com',
    scopes: ['transactions', 'investments', 'auth'],
    syncSupported: true,
    syncInterval: 720, // 12 hours
    logo: '/images/integrations/plaid.png',
    additionalParams: {
      env: process.env.PLAID_ENV || 'sandbox', // sandbox, development, or production
    },
    docsUrl: 'https://plaid.com/docs/api/',
  },
  
  ynab: {
    id: 'ynab',
    name: 'YNAB (You Need A Budget)',
    description: 'Import budgets from You Need A Budget',
    category: 'finance',
    strategy: 'oauth2',
    clientId: process.env.YNAB_CLIENT_ID || 'mock_client_id',
    clientSecret: process.env.YNAB_CLIENT_SECRET || 'mock_client_secret',
    authorizationUrl: 'https://app.youneedabudget.com/oauth/authorize',
    tokenUrl: 'https://api.youneedabudget.com/v1/oauth/token',
    apiBaseUrl: 'https://api.youneedabudget.com/v1',
    redirectUri: `${process.env.NEXTAUTH_URL}/api/integrations/oauth/callback/ynab`,
    scopes: [],
    responseType: 'code',
    grantType: 'authorization_code',
    authorizationMethod: 'header',
    pkce: false,
    syncSupported: true,
    syncInterval: 1440, // 24 hours
    logo: '/images/integrations/ynab.png',
    docsUrl: 'https://api.youneedabudget.com/',
  },
  
  mint: {
    id: 'mint',
    name: 'Mint',
    description: 'Import budgets and financial goals',
    category: 'finance',
    strategy: 'oauth2',
    clientId: process.env.MINT_CLIENT_ID || 'mock_client_id',
    clientSecret: process.env.MINT_CLIENT_SECRET || 'mock_client_secret',
    authorizationUrl: 'https://mint.intuit.com/oauth2/v1/authorize',
    tokenUrl: 'https://mint.intuit.com/oauth2/v1/tokens/bearer',
    apiBaseUrl: 'https://mint.intuit.com/api',
    redirectUri: `${process.env.NEXTAUTH_URL}/api/integrations/oauth/callback/mint`,
    scopes: ['read'],
    responseType: 'code',
    authorizationMethod: 'header',
    pkce: false,
    syncSupported: true,
    syncInterval: 1440, // 24 hours
    logo: '/images/integrations/mint.png',
    docsUrl: 'https://developer.intuit.com/app/developer/homepage',
  },
  
  coinbase: {
    id: 'coinbase',
    name: 'Coinbase',
    description: 'Connect your cryptocurrency accounts',
    category: 'finance',
    strategy: 'oauth2',
    clientId: process.env.COINBASE_CLIENT_ID || 'mock_client_id',
    clientSecret: process.env.COINBASE_CLIENT_SECRET || 'mock_client_secret',
    authorizationUrl: 'https://www.coinbase.com/oauth/authorize',
    tokenUrl: 'https://api.coinbase.com/oauth/token',
    apiBaseUrl: 'https://api.coinbase.com/v2',
    redirectUri: `${process.env.NEXTAUTH_URL}/api/integrations/oauth/callback/coinbase`,
    scopes: ['wallet:accounts:read', 'wallet:transactions:read'],
    responseType: 'code',
    authorizationMethod: 'header',
    syncSupported: true,
    syncInterval: 720, // 12 hours
    logo: '/images/integrations/coinbase.png',
    docsUrl: 'https://developers.coinbase.com/api/v2',
  },
  
  // Education providers
  canvas: {
    id: 'canvas',
    name: 'Canvas',
    description: 'Connect your educational courses and assignments',
    category: 'education',
    strategy: 'oauth2',
    clientId: process.env.CANVAS_CLIENT_ID || 'mock_client_id',
    clientSecret: process.env.CANVAS_CLIENT_SECRET || 'mock_client_secret',
    authorizationUrl: 'https://canvas.instructure.com/login/oauth2/auth',
    tokenUrl: 'https://canvas.instructure.com/login/oauth2/token',
    apiBaseUrl: 'https://canvas.instructure.com/api/v1',
    redirectUri: `${process.env.NEXTAUTH_URL}/api/integrations/oauth/callback/canvas`,
    scopes: ['url:GET|/api/v1/courses', 'url:GET|/api/v1/users/self/grades'],
    responseType: 'code',
    authorizationMethod: 'body',
    syncSupported: true,
    syncInterval: 1440, // 24 hours
    logo: '/images/integrations/canvas.png',
    docsUrl: 'https://canvas.instructure.com/doc/api/',
  },
  
  google_classroom: {
    id: 'google_classroom',
    name: 'Google Classroom',
    description: 'Connect your Google Classroom courses',
    category: 'education',
    strategy: 'oauth2',
    clientId: process.env.GOOGLE_CLIENT_ID || 'mock_client_id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    apiBaseUrl: 'https://classroom.googleapis.com/v1',
    redirectUri: `${process.env.NEXTAUTH_URL}/api/integrations/oauth/callback/google_classroom`,
    scopes: [
      'https://www.googleapis.com/auth/classroom.courses.readonly', 
      'https://www.googleapis.com/auth/classroom.coursework.me.readonly'
    ],
    responseType: 'code',
    authorizationMethod: 'body',
    syncSupported: true,
    syncInterval: 1440, // 24 hours
    logo: '/images/integrations/google_classroom.png',
    docsUrl: 'https://developers.google.com/classroom/reference/rest',
  },
  
  // Healthcare providers
  epic_mychart: {
    id: 'epic_mychart',
    name: 'Epic MyChart',
    description: 'Connect your health records and appointments',
    category: 'healthcare',
    strategy: 'oauth2',
    clientId: process.env.EPIC_CLIENT_ID || 'mock_client_id',
    clientSecret: process.env.EPIC_CLIENT_SECRET || 'mock_client_secret',
    authorizationUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
    tokenUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
    apiBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
    redirectUri: `${process.env.NEXTAUTH_URL}/api/integrations/oauth/callback/epic_mychart`,
    scopes: ['patient/Patient.read', 'patient/Observation.read', 'patient/Appointment.read'],
    responseType: 'code',
    authorizationMethod: 'header',
    syncSupported: true,
    syncInterval: 1440, // 24 hours
    logo: '/images/integrations/epic.png',
    docsUrl: 'https://fhir.epic.com/Documentation',
  },
  
  docuscan: {
    id: 'docuscan',
    name: 'DocuScan',
    description: 'Document scanning and secure storage',
    category: 'healthcare',
    strategy: 'api_key',
    clientId: process.env.DOCUSCAN_CLIENT_ID || 'mock_client_id',
    clientSecret: process.env.DOCUSCAN_API_KEY || 'mock_client_secret',
    authorizationUrl: '', // Not applicable for API key auth
    tokenUrl: '',
    apiBaseUrl: 'https://api.docuscan.example.com',
    syncSupported: false, // Manual uploads only
    logo: '/images/integrations/docuscan.png',
  },
  
  // Career providers
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn',
    description: 'Connect your professional network',
    category: 'career',
    strategy: 'oauth2',
    clientId: process.env.LINKEDIN_CLIENT_ID || 'mock_client_id',
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET || 'mock_client_secret',
    authorizationUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
    apiBaseUrl: 'https://api.linkedin.com/v2',
    redirectUri: `${process.env.NEXTAUTH_URL}/api/integrations/oauth/callback/linkedin`,
    scopes: ['r_liteprofile', 'r_emailaddress'],
    responseType: 'code',
    authorizationMethod: 'query',
    syncSupported: false, // LinkedIn typically has rate limits that make frequent syncing impractical
    logo: '/images/integrations/linkedin.png',
    docsUrl: 'https://docs.microsoft.com/en-us/linkedin/consumer/',
  },
  
  // Automotive providers
  smartcar: {
    id: 'smartcar',
    name: 'Smartcar',
    description: 'Connect your vehicle data',
    category: 'automotive',
    strategy: 'oauth2',
    clientId: process.env.SMARTCAR_CLIENT_ID || 'mock_client_id',
    clientSecret: process.env.SMARTCAR_CLIENT_SECRET || 'mock_client_secret',
    authorizationUrl: 'https://connect.smartcar.com/oauth/authorize',
    tokenUrl: 'https://auth.smartcar.com/oauth/token',
    apiBaseUrl: 'https://api.smartcar.com/v2.0',
    redirectUri: `${process.env.NEXTAUTH_URL}/api/integrations/oauth/callback/smartcar`,
    scopes: ['read_vehicle_info', 'read_odometer', 'read_location'],
    responseType: 'code',
    authorizationMethod: 'header',
    syncSupported: true,
    syncInterval: 720, // 12 hours
    logo: '/images/integrations/smartcar.png',
    docsUrl: 'https://smartcar.com/docs/api',
  },
  
  // Smart home providers
  google_home: {
    id: 'google_home',
    name: 'Google Home',
    description: 'Connect your smart home devices',
    category: 'smarthome',
    strategy: 'oauth2',
    clientId: process.env.GOOGLE_CLIENT_ID || 'mock_client_id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'mock_client_secret',
    authorizationUrl: 'https://accounts.google.com/o/oauth2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    apiBaseUrl: 'https://homegraph.googleapis.com/v1',
    redirectUri: `${process.env.NEXTAUTH_URL}/api/integrations/oauth/callback/google_home`,
    scopes: ['https://www.googleapis.com/auth/homegraph'],
    responseType: 'code',
    authorizationMethod: 'body',
    syncSupported: true,
    syncInterval: 720, // 12 hours
    logo: '/images/integrations/google_home.png',
    docsUrl: 'https://developers.google.com/assistant/smarthome/concepts/homegraph',
  }
};

/**
 * Get configuration for a specific OAuth provider
 */
export function getOAuthProviderConfig(providerId: string): ProviderConfig | undefined {
  return OAUTH_CONFIGS[providerId];
}

/**
 * Get all available OAuth providers
 */
export function getAllProviders(): ProviderConfig[] {
  return Object.values(OAUTH_CONFIGS);
}

/**
 * Get providers by category
 */
export function getProvidersByCategory(category: string): ProviderConfig[] {
  return Object.values(OAUTH_CONFIGS).filter(provider => provider.category === category);
}

/**
 * Build OAuth authorization URL with all necessary parameters
 */
export function buildAuthorizationUrl(
  providerId: string, 
  state: string, 
  codeVerifier?: string
): string | null {
  const config = getOAuthProviderConfig(providerId);
  if (!config) return null;
  
  const url = new URL(config.authorizationUrl);
  
  // Add standard OAuth parameters
  url.searchParams.append('client_id', config.clientId);
  url.searchParams.append('redirect_uri', config.redirectUri || `${process.env.NEXTAUTH_URL}/api/integrations/oauth/callback`);
  url.searchParams.append('response_type', config.responseType || 'code');
  url.searchParams.append('state', state);
  
  // Add scopes if provided
  if (config.scopes && config.scopes.length > 0) {
    url.searchParams.append('scope', config.scopes.join(' '));
  }
  
  // Add PKCE parameters if required
  if (config.pkce && codeVerifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    crypto.subtle.digest('SHA-256', data).then(arrayBuffer => {
      const hash = String.fromCharCode(...new Uint8Array(arrayBuffer));
      const codeChallenge = btoa(hash)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      url.searchParams.append('code_challenge', codeChallenge);
      url.searchParams.append('code_challenge_method', 'S256');
    });
  }
  
  // Add any additional parameters specified in the config
  if (config.additionalParams) {
    Object.entries(config.additionalParams).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }
  
  return url.toString();
}

/**
 * Utility function to generate a random state parameter for OAuth flow
 */
export function generateOAuthState(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate a code verifier for PKCE
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => String.fromCharCode(byte)).join('');
}