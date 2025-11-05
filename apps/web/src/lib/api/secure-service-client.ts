/**
 * Secure Service Client
 * 
 * This module provides a secure client for cross-service communication,
 * specifically for communicating with the Python backend.
 */
import crypto from 'crypto';

interface ServiceClientOptions {
  baseUrl: string;
  apiKey?: string;
  serviceName?: string;
  timeout?: number;
  retries?: number;
}

type FetchOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
  retry?: number;
};

export class ServiceError extends Error {
  status: number;
  
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ServiceError';
    this.status = status;
  }
}

export class SecureServiceClient {
  private baseUrl: string;
  private apiKey: string | undefined;
  private serviceName: string;
  private timeout: number;
  private maxRetries: number;
  
  constructor(options: ServiceClientOptions) {
    this.baseUrl = options.baseUrl.endsWith('/') 
      ? options.baseUrl.slice(0, -1) 
      : options.baseUrl;
    this.apiKey = options.apiKey;
    this.serviceName = options.serviceName || 'nextjs-frontend';
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.maxRetries = options.retries || 3;
  }
  
  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return crypto.randomUUID();
  }
  
  /**
   * Generate a timestamp for request signing
   */
  private getTimestamp(): string {
    return Math.floor(Date.now() / 1000).toString();
  }
  
  /**
   * Generate signature for request authentication
   */
  private generateSignature(method: string, path: string, timestamp: string, body?: string): string {
    if (!this.apiKey) return '';
    
    const payload = `${method.toUpperCase()}\n${path}\n${timestamp}\n${body || ''}`;
    return crypto
      .createHmac('sha256', this.apiKey)
      .update(payload)
      .digest('hex');
  }
  
  /**
   * Add security headers to the request
   */
  private addSecurityHeaders(
    headers: Record<string, string>,
    method: string,
    path: string,
    body?: any
  ): Record<string, string> {
    const requestId = this.generateRequestId();
    const timestamp = this.getTimestamp();
    const bodyStr = body ? JSON.stringify(body) : '';
    
    const signature = this.generateSignature(method, path, timestamp, bodyStr);
    
    return {
      ...headers,
      'X-Request-ID': requestId,
      'X-Timestamp': timestamp,
      'X-Service-Name': this.serviceName,
      ...(this.apiKey ? { 'X-Signature': signature } : {}),
    };
  }
  
  /**
   * Make a secure request to the service
   */
  private async request<T = any>(
    endpoint: string,
    options: FetchOptions = {}
  ): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = this.timeout,
      retry = 0,
    } = options;
    
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = `${this.baseUrl}${path}`;
    
    // Add security headers
    const secureHeaders = this.addSecurityHeaders(
      {
        'Content-Type': 'application/json',
        ...headers,
      },
      method,
      path,
      body
    );
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        method,
        headers: secureHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      // Handle rate limiting with exponential backoff
      if (response.status === 429 && retry < this.maxRetries) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1', 10);
        const delay = Math.min(
          Math.pow(2, retry) * 1000, 
          10000
        ) + Math.floor(Math.random() * 1000);
        
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000 || delay));
        
        return this.request<T>(endpoint, {
          ...options,
          retry: retry + 1,
        });
      }
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || errorData.error || `Service request failed with status ${response.status}`;
        throw new ServiceError(errorMessage, response.status);
      }
      
      // For 204 No Content responses
      if (response.status === 204) {
        return {} as T;
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      // Handle timeout and network errors with retries
      if (
        (error instanceof Error && error.name === 'AbortError' || 
        error instanceof TypeError && error.message.includes('network')) && 
        retry < this.maxRetries
      ) {
        const delay = Math.min(
          Math.pow(2, retry) * 1000, 
          10000
        ) + Math.floor(Math.random() * 1000);
        
        await new Promise(resolve => setTimeout(resolve, delay));
        
        return this.request<T>(endpoint, {
          ...options,
          retry: retry + 1,
        });
      }
      
      // Rethrow service errors
      if (error instanceof ServiceError) {
        throw error;
      }
      
      // Convert other errors to ServiceError
      throw new ServiceError(
        error instanceof Error ? error.message : 'Unknown service error',
        500
      );
    }
  }
  
  /**
   * Make a GET request
   */
  public async get<T = any>(
    endpoint: string,
    options: Omit<FetchOptions, 'method' | 'body'> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }
  
  /**
   * Make a POST request
   */
  public async post<T = any>(
    endpoint: string,
    data: any,
    options: Omit<FetchOptions, 'method'> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'POST', body: data });
  }
  
  /**
   * Make a PUT request
   */
  public async put<T = any>(
    endpoint: string,
    data: any,
    options: Omit<FetchOptions, 'method'> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PUT', body: data });
  }
  
  /**
   * Make a PATCH request
   */
  public async patch<T = any>(
    endpoint: string,
    data: any,
    options: Omit<FetchOptions, 'method'> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'PATCH', body: data });
  }
  
  /**
   * Make a DELETE request
   */
  public async delete<T = any>(
    endpoint: string,
    options: Omit<FetchOptions, 'method'> = {}
  ): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }
}