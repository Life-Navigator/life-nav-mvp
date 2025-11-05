/**
 * Backend Services Configuration
 * 
 * This module configures connections to backend services with proper authentication
 * and security measures.
 */
import { SecureServiceClient } from './secure-service-client';

// Environment-based configuration
const getServiceUrl = (service: string): string => {
  const env = process.env.APP_ENV || 'local';
  
  // Default URLs for different environments
  const serviceUrls: Record<string, Record<string, string>> = {
    local: {
      financial: process.env.FINANCIAL_API_URL || 'http://localhost:8000/api/v1',
      health: process.env.HEALTH_API_URL || 'http://localhost:8000/api/v1',
      career: process.env.CAREER_API_URL || 'http://localhost:8000/api/v1',
      education: process.env.EDUCATION_API_URL || 'http://localhost:8000/api/v1',
      analytics: process.env.ANALYTICS_API_URL || 'http://localhost:8001/api/v1',
    },
    dev: {
      financial: process.env.FINANCIAL_API_URL || 'https://api-dev.lifenavigator.example/api/v1',
      health: process.env.HEALTH_API_URL || 'https://api-dev.lifenavigator.example/api/v1',
      career: process.env.CAREER_API_URL || 'https://api-dev.lifenavigator.example/api/v1',
      education: process.env.EDUCATION_API_URL || 'https://api-dev.lifenavigator.example/api/v1',
      analytics: process.env.ANALYTICS_API_URL || 'https://analytics-dev.lifenavigator.example/api/v1',
    },
    staging: {
      financial: process.env.FINANCIAL_API_URL || 'https://api-staging.lifenavigator.example/api/v1',
      health: process.env.HEALTH_API_URL || 'https://api-staging.lifenavigator.example/api/v1',
      career: process.env.CAREER_API_URL || 'https://api-staging.lifenavigator.example/api/v1',
      education: process.env.EDUCATION_API_URL || 'https://api-staging.lifenavigator.example/api/v1',
      analytics: process.env.ANALYTICS_API_URL || 'https://analytics-staging.lifenavigator.example/api/v1',
    },
    prod: {
      financial: process.env.FINANCIAL_API_URL || 'https://api.lifenavigator.example/api/v1',
      health: process.env.HEALTH_API_URL || 'https://api.lifenavigator.example/api/v1',
      career: process.env.CAREER_API_URL || 'https://api.lifenavigator.example/api/v1',
      education: process.env.EDUCATION_API_URL || 'https://api.lifenavigator.example/api/v1',
      analytics: process.env.ANALYTICS_API_URL || 'https://analytics.lifenavigator.example/api/v1',
    },
  };
  
  return serviceUrls[env]?.[service] || serviceUrls.local[service];
};

// Get service API key from environment variables
const getServiceApiKey = (service: string): string | undefined => {
  const keyMap: Record<string, string | undefined> = {
    financial: process.env.FINANCIAL_API_KEY,
    health: process.env.HEALTH_API_KEY,
    career: process.env.CAREER_API_KEY,
    education: process.env.EDUCATION_API_KEY,
    analytics: process.env.ANALYTICS_API_KEY,
  };
  
  return keyMap[service];
};

/**
 * Create and configure a secure client for a specific backend service
 */
export function getBackendService(service: 'financial' | 'health' | 'career' | 'education' | 'analytics'): SecureServiceClient {
  return new SecureServiceClient({
    baseUrl: getServiceUrl(service),
    apiKey: getServiceApiKey(service),
    serviceName: 'nextjs-frontend',
    timeout: 30000, // 30 seconds
    retries: 3,
  });
}

// Pre-configured service clients
export const financialService = getBackendService('financial');
export const healthService = getBackendService('health');
export const careerService = getBackendService('career');
export const educationService = getBackendService('education');
export const analyticsService = getBackendService('analytics');

/**
 * Create a backend client with a user's session token
 * For authenticated requests to backend services
 */
export function createAuthenticatedBackendClient(
  service: 'financial' | 'health' | 'career' | 'education' | 'analytics',
  sessionToken: string
): SecureServiceClient {
  const client = getBackendService(service);
  
  // Wrap the client with authentication intercepts
  const authenticatedClient = {
    get: async <T = any>(endpoint: string, options: any = {}) => {
      return client.get<T>(endpoint, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${sessionToken}`,
        },
      });
    },
    post: async <T = any>(endpoint: string, data: any, options: any = {}) => {
      return client.post<T>(endpoint, data, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${sessionToken}`,
        },
      });
    },
    put: async <T = any>(endpoint: string, data: any, options: any = {}) => {
      return client.put<T>(endpoint, data, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${sessionToken}`,
        },
      });
    },
    patch: async <T = any>(endpoint: string, data: any, options: any = {}) => {
      return client.patch<T>(endpoint, data, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${sessionToken}`,
        },
      });
    },
    delete: async <T = any>(endpoint: string, options: any = {}) => {
      return client.delete<T>(endpoint, {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${sessionToken}`,
        },
      });
    },
  };
  
  return authenticatedClient as unknown as SecureServiceClient;
}