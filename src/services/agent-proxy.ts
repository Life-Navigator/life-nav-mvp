/**
 * Agent Proxy Service
 *
 * Handles all communication between the platform and the agent system.
 * Provides retry logic, timeout handling, and response validation.
 */

import { AgentValidationError } from '@/types/agents';

// ============================================
// CONFIGURATION TYPES
// ============================================

export interface AgentProxyConfig {
  baseUrl: string;           // e.g., http://localhost:8000
  timeout: number;           // milliseconds, default 30000
  retries: number;           // default 3
  retryDelayMs: number;      // default 1000
}

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface AgentRequest {
  user_id: string;           // UUID from auth
  message: string;           // User input
  context: {
    domain?: string;         // finance, career, health, legal, personal
    session_id: string;       // Current conversation session
    previous_messages?: Array<{
      role: 'user' | 'agent';
      content: string;
    }>;
    user_profile?: Record<string, unknown>; // Optional user context
  };
  action: 'onboarding' | 'chat' | 'quick_response' | 'analyze';
  metadata?: {
    request_id: string;      // For tracking
    timestamp: string;        // ISO 8601
    environment: 'development' | 'staging' | 'production';
  };
}

export interface AgentResponse {
  success: boolean;
  data?: {
    response: string;         // Main response text
    agent_name: string;       // Which agent responded
    confidence?: number;      // 0-100
    sources?: string[];       // Data sources used
    action_items?: Array<{
      action: string;
      timeline?: string;
      priority: 'low' | 'medium' | 'high';
    }>;
    escalation?: {
      required: boolean;
      type?: 'financial' | 'legal' | 'medical' | 'crisis';
      reason: string;
    };
  };
  error?: {
    code: string;             // ERROR_CODE
    message: string;          // Human readable
    details?: Record<string, unknown>;
    timestamp: string;
  };
  metrics: {
    response_time_ms: number;
    tokens_used?: number;
    model_version: string;
  };
}

// ============================================
// CUSTOM ERRORS
// ============================================

export class AgentProxyError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AgentProxyError';
  }
}

export class AgentTimeoutError extends AgentProxyError {
  constructor(message: string = 'Agent request timed out', public requestId?: string) {
    super(message, 'AGENT_TIMEOUT', { requestId });
    this.name = 'AgentTimeoutError';
  }
}

// ============================================
// LOGGER INTERFACE
// ============================================

interface Logger {
  info: (message: string, meta?: Record<string, unknown>) => void;
  error: (message: string, meta?: Record<string, unknown>) => void;
  warn: (message: string, meta?: Record<string, unknown>) => void;
}

// Simple console logger for now (will be replaced with Winston)
const defaultLogger: Logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(`[INFO] ${message}`, meta || '');
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(`[ERROR] ${message}`, meta || '');
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(`[WARN] ${message}`, meta || '');
  },
};

// ============================================
// AGENT PROXY CLASS
// ============================================

export class AgentProxy {
  private config: AgentProxyConfig;
  private logger: Logger;

  constructor(config: AgentProxyConfig, logger: Logger = defaultLogger) {
    this.config = {
      baseUrl: config.baseUrl,
      timeout: config.timeout || 30000,
      retries: config.retries || 3,
      retryDelayMs: config.retryDelayMs || 1000,
    };
    this.logger = logger;
  }

  /**
   * Send a request to the agent system
   */
  async send(request: AgentRequest): Promise<AgentResponse> {
    // 1. Validate request structure
    this.validateRequest(request);

    // 2. Add request_id and timestamp if missing
    const enrichedRequest: AgentRequest = {
      ...request,
      metadata: {
        request_id: request.metadata?.request_id || this.generateRequestId(),
        timestamp: request.metadata?.timestamp || new Date().toISOString(),
        environment: request.metadata?.environment || this.getEnvironment(),
      },
    };

    const startTime = Date.now();

    try {
      // 3. Implement retry logic with exponential backoff
      const response = await this.retry(
        () => this.executeRequest(enrichedRequest),
        this.config.retries
      );

      // 4. Parse response
      const responseData = await response.json();

      // 5. Validate against AgentResponse type
      const validatedResponse = this.validateResponse(responseData);

      // Calculate actual response time
      const responseTime = Date.now() - startTime;
      validatedResponse.metrics.response_time_ms = responseTime;

      // 6. Log request/response
      this.logger.info('Agent request successful', {
        request_id: enrichedRequest.metadata?.request_id,
        action: enrichedRequest.action,
        response_time_ms: responseTime,
        agent_name: validatedResponse.data?.agent_name,
      });

      // 7. Return normalized AgentResponse
      return validatedResponse;
    } catch (error) {
      // Log error with request_id
      this.logger.error('Agent request failed', {
        request_id: enrichedRequest.metadata?.request_id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  /**
   * Execute the HTTP request to the agent system
   */
  private async executeRequest(
    request: AgentRequest,
    attempt: number = 1
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/agent/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'LifeNavigator-Platform/1.0',
          'X-Request-ID': request.metadata?.request_id || '',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new AgentProxyError(
          `Agent API returned ${response.status}`,
          `HTTP_${response.status}`,
          {
            status: response.status,
            statusText: response.statusText,
          }
        );
      }

      return response;
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle timeout specifically
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AgentTimeoutError(
          `Request timed out after ${this.config.timeout}ms`,
          request.metadata?.request_id
        );
      }

      throw error;
    }
  }

  /**
   * Retry logic with exponential backoff
   */
  private async retry<T>(
    fn: () => Promise<T>,
    maxAttempts: number = this.config.retries
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        // Don't retry on 4xx errors (client errors)
        if (error instanceof AgentProxyError) {
          const statusMatch = error.code.match(/HTTP_(\d+)/);
          if (statusMatch) {
            const status = parseInt(statusMatch[1]);
            if (status >= 400 && status < 500) {
              this.logger.warn('Client error, not retrying', {
                code: error.code,
                attempt,
              });
              throw error;
            }
          }
        }

        // If this was the last attempt, throw the error
        if (attempt === maxAttempts) {
          this.logger.error('Max retry attempts reached', {
            attempts: maxAttempts,
            error: lastError.message,
          });
          throw lastError;
        }

        // Calculate exponential backoff delay
        const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);

        this.logger.warn('Retrying request after error', {
          attempt,
          maxAttempts,
          delay,
          error: lastError.message,
        });

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Retry failed with unknown error');
  }

  /**
   * Validate request structure
   */
  private validateRequest(request: AgentRequest): void {
    if (!request.user_id || typeof request.user_id !== 'string') {
      throw new AgentValidationError('user_id is required and must be a string', {
        field: 'user_id',
      });
    }

    if (!request.message || typeof request.message !== 'string') {
      throw new AgentValidationError('message is required and must be a string', {
        field: 'message',
      });
    }

    if (!request.context || typeof request.context !== 'object') {
      throw new AgentValidationError('context is required and must be an object', {
        field: 'context',
      });
    }

    if (!request.context.session_id || typeof request.context.session_id !== 'string') {
      throw new AgentValidationError(
        'context.session_id is required and must be a string',
        { field: 'context.session_id' }
      );
    }

    const validActions = ['onboarding', 'chat', 'quick_response', 'analyze'];
    if (!validActions.includes(request.action)) {
      throw new AgentValidationError(
        `action must be one of: ${validActions.join(', ')}`,
        { field: 'action', value: request.action }
      );
    }
  }

  /**
   * Validate response structure
   */
  private validateResponse(data: unknown): AgentResponse {
    if (typeof data !== 'object' || data === null) {
      throw new AgentValidationError('Response must be an object', { data });
    }

    const response = data as Record<string, unknown>;

    // Validate required fields
    if (typeof response.success !== 'boolean') {
      throw new AgentValidationError('Response.success must be a boolean', { data });
    }

    // If success=true, validate data fields
    if (response.success === true) {
      if (!response.data || typeof response.data !== 'object') {
        throw new AgentValidationError(
          'Response.data is required when success=true',
          { data }
        );
      }

      const responseData = response.data as Record<string, unknown>;

      if (typeof responseData.response !== 'string') {
        throw new AgentValidationError('Response.data.response must be a string', {
          data,
        });
      }

      if (typeof responseData.agent_name !== 'string') {
        throw new AgentValidationError('Response.data.agent_name must be a string', {
          data,
        });
      }
    }

    // If success=false, validate error fields
    if (response.success === false) {
      if (!response.error || typeof response.error !== 'object') {
        throw new AgentValidationError(
          'Response.error is required when success=false',
          { data }
        );
      }

      const errorData = response.error as Record<string, unknown>;

      if (typeof errorData.code !== 'string') {
        throw new AgentValidationError('Response.error.code must be a string', {
          data,
        });
      }

      if (typeof errorData.message !== 'string') {
        throw new AgentValidationError('Response.error.message must be a string', {
          data,
        });
      }
    }

    // Validate metrics
    if (!response.metrics || typeof response.metrics !== 'object') {
      throw new AgentValidationError('Response.metrics is required', { data });
    }

    const metrics = response.metrics as Record<string, unknown>;

    if (typeof metrics.model_version !== 'string') {
      throw new AgentValidationError('Response.metrics.model_version must be a string', {
        data,
      });
    }

    // Return validated response (type assertion is safe after validation)
    return data as AgentResponse;
  }

  /**
   * Generate a unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Get current environment
   */
  private getEnvironment(): 'development' | 'staging' | 'production' {
    const env = process.env.NODE_ENV || 'development';
    if (env === 'production') return 'production';
    if (env === 'staging') return 'staging';
    return 'development';
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

export const agentProxy = new AgentProxy({
  baseUrl: process.env.AGENT_API_URL || 'http://localhost:8000',
  timeout: parseInt(process.env.AGENT_TIMEOUT || '30000'),
  retries: parseInt(process.env.AGENT_RETRIES || '3'),
  retryDelayMs: parseInt(process.env.AGENT_RETRY_DELAY || '1000'),
});
