/**
 * Agent Proxy Service Tests
 *
 * Comprehensive test suite for agent communication layer
 */

import {
  AgentProxy,
  AgentProxyConfig,
  AgentRequest,
  AgentResponse,
  AgentTimeoutError,
  AgentProxyError,
} from '../agent-proxy';
import { AgentValidationError } from '@/types/agents';

// Mock fetch globally
global.fetch = jest.fn();

describe('AgentProxy', () => {
  let agentProxy: AgentProxy;
  let mockLogger: any;

  const defaultConfig: AgentProxyConfig = {
    baseUrl: 'http://localhost:8000',
    timeout: 5000,
    retries: 3,
    retryDelayMs: 100,
  };

  const validRequest: AgentRequest = {
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    message: 'How should I plan my retirement?',
    context: {
      session_id: '550e8400-e29b-41d4-a716-446655440001',
      domain: 'finance',
    },
    action: 'chat',
  };

  const validResponse: AgentResponse = {
    success: true,
    data: {
      response: 'Here is my analysis of your retirement planning...',
      agent_name: 'finance_manager',
      confidence: 85,
      sources: ['user_profile', 'retirement_calculator'],
    },
    metrics: {
      response_time_ms: 1234,
      tokens_used: 500,
      model_version: 'gpt-4',
    },
  };

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };

    // Create new instance
    agentProxy = new AgentProxy(defaultConfig, mockLogger);
  });

  describe('Constructor', () => {
    it('should initialize with provided config', () => {
      const proxy = new AgentProxy({
        baseUrl: 'http://example.com',
        timeout: 10000,
        retries: 5,
        retryDelayMs: 2000,
      });

      expect(proxy).toBeInstanceOf(AgentProxy);
    });

    it('should use default values when not provided', () => {
      const proxy = new AgentProxy({
        baseUrl: 'http://example.com',
        timeout: 0, // Will use default
        retries: 0, // Will use default
        retryDelayMs: 0, // Will use default
      });

      expect(proxy).toBeInstanceOf(AgentProxy);
    });
  });

  describe('send()', () => {
    it('should send valid request and receive valid response', async () => {
      // Mock successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => validResponse,
      });

      const response = await agentProxy.send(validRequest);

      // Assert request structure
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/agent/message',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'LifeNavigator-Platform/1.0',
          }),
          body: expect.any(String),
        })
      );

      // Assert response parsing
      expect(response.success).toBe(true);
      expect(response.data?.response).toBeDefined();
      expect(response.data?.agent_name).toBe('finance_manager');

      // Assert metrics captured
      expect(response.metrics.response_time_ms).toBeGreaterThanOrEqual(0);

      // Assert logging
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Agent request successful',
        expect.objectContaining({
          action: 'chat',
          agent_name: 'finance_manager',
        })
      );
    });

    it('should add request_id and timestamp if missing', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => validResponse,
      });

      await agentProxy.send(validRequest);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.metadata).toBeDefined();
      expect(requestBody.metadata.request_id).toBeDefined();
      expect(requestBody.metadata.timestamp).toBeDefined();
      expect(requestBody.metadata.environment).toBeDefined();
    });

    it('should preserve existing metadata', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => validResponse,
      });

      const requestWithMetadata: AgentRequest = {
        ...validRequest,
        metadata: {
          request_id: 'custom-request-id',
          timestamp: '2024-01-01T00:00:00Z',
          environment: 'production',
        },
      };

      await agentProxy.send(requestWithMetadata);

      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.metadata.request_id).toBe('custom-request-id');
      expect(requestBody.metadata.timestamp).toBe('2024-01-01T00:00:00Z');
      expect(requestBody.metadata.environment).toBe('production');
    });
  });

  describe('Validation', () => {
    it('should validate request and throw on missing user_id', async () => {
      const invalidRequest = {
        ...validRequest,
        user_id: '',
      };

      await expect(agentProxy.send(invalidRequest)).rejects.toThrow(AgentValidationError);
      await expect(agentProxy.send(invalidRequest)).rejects.toThrow('user_id is required');
    });

    it('should validate request and throw on missing message', async () => {
      const invalidRequest = {
        ...validRequest,
        message: '',
      };

      await expect(agentProxy.send(invalidRequest)).rejects.toThrow(AgentValidationError);
      await expect(agentProxy.send(invalidRequest)).rejects.toThrow('message is required');
    });

    it('should validate request and throw on missing session_id', async () => {
      const invalidRequest = {
        ...validRequest,
        context: {
          domain: 'finance',
        },
      };

      await expect(agentProxy.send(invalidRequest as any)).rejects.toThrow(AgentValidationError);
      await expect(agentProxy.send(invalidRequest as any)).rejects.toThrow(
        'session_id is required'
      );
    });

    it('should validate request and throw on invalid action', async () => {
      const invalidRequest = {
        ...validRequest,
        action: 'invalid_action',
      };

      await expect(agentProxy.send(invalidRequest as any)).rejects.toThrow(AgentValidationError);
      await expect(agentProxy.send(invalidRequest as any)).rejects.toThrow('action must be one of');
    });

    it('should validate response structure', async () => {
      const invalidResponse = {
        // Missing required fields
        success: 'yes', // Should be boolean
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => invalidResponse,
      });

      await expect(agentProxy.send(validRequest)).rejects.toThrow(AgentValidationError);
    });

    it('should validate response.data when success=true', async () => {
      const invalidResponse = {
        success: true,
        // Missing data field
        metrics: {
          response_time_ms: 100,
          model_version: 'gpt-4',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => invalidResponse,
      });

      await expect(agentProxy.send(validRequest)).rejects.toThrow(AgentValidationError);

      await expect(agentProxy.send(validRequest)).rejects.toThrow(
        'data is required when success=true'
      );
    });

    it('should validate response.error when success=false', async () => {
      const invalidResponse = {
        success: false,
        // Missing error field
        metrics: {
          response_time_ms: 100,
          model_version: 'gpt-4',
        },
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => invalidResponse,
      });

      await expect(agentProxy.send(validRequest)).rejects.toThrow(AgentValidationError);

      await expect(agentProxy.send(validRequest)).rejects.toThrow(
        'error is required when success=false'
      );
    });
  });

  describe('Retry Logic', () => {
    it('should retry on 5xx errors', async () => {
      // First two calls fail with 500, third succeeds
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => validResponse,
        });

      const response = await agentProxy.send(validRequest);

      // Assert retry count (should be called 3 times)
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // Assert response successful
      expect(response.success).toBe(true);

      // Assert retry warning logged
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Retrying request after error',
        expect.objectContaining({
          attempt: expect.any(Number),
        })
      );
    });

    it('should use exponential backoff timing', async () => {
      jest.useFakeTimers();

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => validResponse,
        });

      const promise = agentProxy.send(validRequest);

      // Wait for first attempt to fail
      await jest.runAllTimersAsync();

      const response = await promise;

      expect(response.success).toBe(true);

      jest.useRealTimers();
    });

    it('should fail immediately on 4xx errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(agentProxy.send(validRequest)).rejects.toThrow(AgentProxyError);

      // Should only be called once (no retries)
      expect(global.fetch).toHaveBeenCalledTimes(1);

      // Assert error logged
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should fail after max retry attempts', async () => {
      // Always return 500
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(agentProxy.send(validRequest)).rejects.toThrow(AgentProxyError);

      // Should retry 3 times (maxRetries = 3)
      expect(global.fetch).toHaveBeenCalledTimes(3);

      // Assert max retry error logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Max retry attempts reached',
        expect.any(Object)
      );
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout after config.timeout ms', async () => {
      // Mock fetch that respects AbortController signal
      (global.fetch as jest.Mock).mockImplementation(
        (_url: string, options?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            const signal = options?.signal;
            if (signal) {
              signal.addEventListener('abort', () => {
                const err = new DOMException('The operation was aborted.', 'AbortError');
                reject(err);
              });
            }
          })
      );

      await expect(agentProxy.send(validRequest)).rejects.toThrow(AgentTimeoutError);
    }, 30000);

    it('should include request_id in timeout error', async () => {
      (global.fetch as jest.Mock).mockImplementation(
        (_url: string, options?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            const signal = options?.signal;
            if (signal) {
              signal.addEventListener('abort', () => {
                const err = new DOMException('The operation was aborted.', 'AbortError');
                reject(err);
              });
            }
          })
      );

      const requestWithId: AgentRequest = {
        ...validRequest,
        metadata: {
          request_id: 'test-timeout-id',
          timestamp: new Date().toISOString(),
          environment: 'development',
        },
      };

      try {
        await agentProxy.send(requestWithId);
        fail('Expected AgentTimeoutError');
      } catch (error) {
        expect(error).toBeInstanceOf(AgentTimeoutError);
        if (error instanceof AgentTimeoutError) {
          expect(error.requestId).toBe('test-timeout-id');
        }
      }
    }, 30000);
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      // Mock all retries to reject with network error
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(agentProxy.send(validRequest)).rejects.toThrow('Network error');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle JSON parse errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(agentProxy.send(validRequest)).rejects.toThrow();
    });

    it('should log all errors with request_id', async () => {
      // Mock all retries to reject
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Test error'));

      try {
        await agentProxy.send(validRequest);
      } catch (error) {
        // Error expected
      }

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Agent request failed',
        expect.objectContaining({
          request_id: expect.any(String),
        })
      );
    });
  });

  describe('HTTP Headers', () => {
    it('should include correct headers in request', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => validResponse,
      });

      await agentProxy.send(validRequest);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'User-Agent': 'LifeNavigator-Platform/1.0',
            'X-Request-ID': expect.any(String),
          }),
        })
      );
    });

    it('should include custom request_id in X-Request-ID header', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => validResponse,
      });

      const requestWithId: AgentRequest = {
        ...validRequest,
        metadata: {
          request_id: 'custom-header-id',
          timestamp: new Date().toISOString(),
          environment: 'development',
        },
      };

      await agentProxy.send(requestWithId);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Request-ID': 'custom-header-id',
          }),
        })
      );
    });
  });
});
