/**
 * Risk Client
 * =============================================================================
 * Client for calling risk-engine API via main backend proxy
 *
 * IMPORTANT: Frontend never calls risk-engine directly.
 * All requests go through main backend /api/risk/* proxy.
 */

import EventSource from 'eventsource';
import {
  RiskComputeRequest,
  RiskResponse,
  StreamEvent,
  RiskComputeRequestSchema,
  RiskResponseSchema,
} from './types';

export interface RiskClientConfig {
  /**
   * Base URL for main backend API
   * Example: "https://api.lifenavigator.com" or "http://localhost:3000"
   */
  baseUrl: string;

  /**
   * Auth token (JWT)
   * Will be sent as: Authorization: Bearer {token}
   */
  getAuthToken: () => Promise<string> | string;

  /**
   * Optional fetch implementation (for React Native)
   */
  fetch?: typeof fetch;
}

export class RiskClient {
  private config: RiskClientConfig;

  constructor(config: RiskClientConfig) {
    this.config = config;
  }

  /**
   * Compute risk snapshot (one-time computation)
   *
   * POST /api/risk/snapshot
   */
  async computeRisk(request: RiskComputeRequest): Promise<RiskResponse> {
    // Validate request
    const validated = RiskComputeRequestSchema.parse(request);

    const token = await this.config.getAuthToken();

    const fetchFn = this.config.fetch || fetch;

    const response = await fetchFn(`${this.config.baseUrl}/api/risk/snapshot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validated),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({
        message: 'Request failed',
      }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    const data = await response.json();

    // Validate response
    return RiskResponseSchema.parse(data) as RiskResponse;
  }

  /**
   * Stream risk computation (real-time updates)
   *
   * POST /api/risk/stream (SSE)
   */
  streamRisk(
    request: RiskComputeRequest,
    callbacks: {
      onSnapshot?: (snapshot: RiskResponse) => void;
      onDelta?: (delta: StreamEvent) => void;
      onProgress?: (progress: number) => void;
      onError?: (error: Error) => void;
      onComplete?: () => void;
    }
  ): {
    close: () => void;
    sendHeartbeat: () => Promise<void>;
  } {
    // Validate request
    const validated = RiskComputeRequestSchema.parse(request);

    let eventSource: EventSource | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let streamId: string | null = null;

    const connect = async () => {
      const token = await this.config.getAuthToken();

      // Create SSE connection
      const url = new URL(`${this.config.baseUrl}/api/risk/stream`);

      // EventSource doesn't support POST with body, so we send via query params
      // In production, might use different approach (e.g., WebSockets)
      url.searchParams.set('request', JSON.stringify(validated));

      eventSource = new EventSource(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // Handle snapshot events
      eventSource.addEventListener('snapshot', (event: MessageEvent) => {
        try {
          const data: StreamEvent = JSON.parse(event.data);
          if (data.snapshot && callbacks.onSnapshot) {
            callbacks.onSnapshot(data.snapshot);
          }
          streamId = `stream-${data.sequence}`;
        } catch (error) {
          callbacks.onError?.(error as Error);
        }
      });

      // Handle delta events
      eventSource.addEventListener('delta', (event: MessageEvent) => {
        try {
          const data: StreamEvent = JSON.parse(event.data);
          if (callbacks.onDelta) {
            callbacks.onDelta(data);
          }
        } catch (error) {
          callbacks.onError?.(error as Error);
        }
      });

      // Handle heartbeat events
      eventSource.addEventListener('heartbeat', (event: MessageEvent) => {
        // Heartbeat received - connection is alive
      });

      // Handle error events
      eventSource.addEventListener('error', (event: MessageEvent) => {
        try {
          const data: StreamEvent = JSON.parse(event.data);
          if (data.error_message) {
            callbacks.onError?.(new Error(data.error_message));
          }
        } catch (error) {
          callbacks.onError?.(error as Error);
        }
        close();
      });

      // Handle complete events
      eventSource.addEventListener('complete', (event: MessageEvent) => {
        callbacks.onComplete?.();
        close();
      });

      // Handle connection errors
      eventSource.onerror = (error) => {
        callbacks.onError?.(new Error('SSE connection error'));
        close();
      };

      // Start heartbeat (every 10 seconds)
      heartbeatInterval = setInterval(() => {
        sendHeartbeat().catch((error) => {
          console.error('Heartbeat failed:', error);
        });
      }, 10000);
    };

    const close = () => {
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    };

    const sendHeartbeat = async () => {
      if (!streamId) return;

      const token = await this.config.getAuthToken();
      const fetchFn = this.config.fetch || fetch;

      await fetchFn(`${this.config.baseUrl}/api/risk/stream/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stream_id: streamId }),
      });
    };

    // Start connection
    connect().catch((error) => {
      callbacks.onError?.(error);
    });

    return { close, sendHeartbeat };
  }

  /**
   * Explain risk outcome (get drivers, decomposition, counterfactuals)
   *
   * POST /api/risk/explain
   */
  async explainRisk(request: RiskComputeRequest): Promise<any> {
    const validated = RiskComputeRequestSchema.parse(request);

    const token = await this.config.getAuthToken();
    const fetchFn = this.config.fetch || fetch;

    const response = await fetchFn(`${this.config.baseUrl}/api/risk/explain`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validated),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get recommendations (actionable improvements)
   *
   * POST /api/risk/recommend
   */
  async getRecommendations(request: RiskComputeRequest): Promise<any> {
    const validated = RiskComputeRequestSchema.parse(request);

    const token = await this.config.getAuthToken();
    const fetchFn = this.config.fetch || fetch;

    const response = await fetchFn(`${this.config.baseUrl}/api/risk/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(validated),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }
}

/**
 * Create risk client instance
 */
export function createRiskClient(config: RiskClientConfig): RiskClient {
  return new RiskClient(config);
}
