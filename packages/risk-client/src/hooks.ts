/**
 * React Hooks for Risk Client
 * =============================================================================
 * Easy-to-use hooks for risk computation in React applications
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  RiskComputeRequest,
  RiskResponse,
  StreamEvent,
  StreamDelta,
} from './types';
import { RiskClient } from './client';

// ===========================================================================
// useRiskSnapshot Hook
// ===========================================================================

export interface UseRiskSnapshotOptions {
  /**
   * Auto-fetch on mount
   */
  enabled?: boolean;

  /**
   * Refetch interval (ms)
   */
  refetchInterval?: number;

  /**
   * On success callback
   */
  onSuccess?: (data: RiskResponse) => void;

  /**
   * On error callback
   */
  onError?: (error: Error) => void;
}

export interface UseRiskSnapshotResult {
  data: RiskResponse | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for one-time risk computation
 *
 * @example
 * ```tsx
 * const { data, isLoading, error, refetch } = useRiskSnapshot({
 *   goal_context: { goals: [...] },
 *   mode: ComputeMode.BALANCED,
 * });
 *
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 *
 * return <RiskDashboard data={data} />;
 * ```
 */
export function useRiskSnapshot(
  client: RiskClient,
  request: RiskComputeRequest,
  options: UseRiskSnapshotOptions = {}
): UseRiskSnapshotResult {
  const [data, setData] = useState<RiskResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { enabled = true, refetchInterval, onSuccess, onError } = options;

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await client.computeRisk(request);
      setData(result);
      onSuccess?.(result);
    } catch (err) {
      const error = err as Error;
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [client, request, onSuccess, onError]);

  // Auto-fetch on mount
  useEffect(() => {
    if (enabled) {
      fetch();
    }
  }, [enabled, fetch]);

  // Refetch interval
  useEffect(() => {
    if (refetchInterval && enabled) {
      const interval = setInterval(fetch, refetchInterval);
      return () => clearInterval(interval);
    }
  }, [refetchInterval, enabled, fetch]);

  return {
    data,
    isLoading,
    error,
    refetch: fetch,
  };
}

// ===========================================================================
// useRiskStream Hook
// ===========================================================================

export interface UseRiskStreamOptions {
  /**
   * Auto-connect on mount
   */
  enabled?: boolean;

  /**
   * On snapshot callback
   */
  onSnapshot?: (snapshot: RiskResponse) => void;

  /**
   * On delta callback
   */
  onDelta?: (delta: StreamDelta) => void;

  /**
   * On progress callback
   */
  onProgress?: (progress: number) => void;

  /**
   * On error callback
   */
  onError?: (error: Error) => void;

  /**
   * On complete callback
   */
  onComplete?: () => void;
}

export interface UseRiskStreamResult {
  snapshot: RiskResponse | null;
  deltas: StreamEvent[];
  isConnected: boolean;
  error: Error | null;
  connect: () => void;
  disconnect: () => void;
}

/**
 * Hook for real-time risk computation streaming
 *
 * @example
 * ```tsx
 * const { snapshot, deltas, isConnected, connect, disconnect } = useRiskStream({
 *   goal_context: { goals: [...] },
 *   mode: ComputeMode.BALANCED,
 * }, {
 *   onSnapshot: (snapshot) => console.log('Got snapshot:', snapshot),
 *   onDelta: (delta) => console.log('Got delta:', delta),
 * });
 *
 * return (
 *   <div>
 *     <button onClick={connect} disabled={isConnected}>
 *       Start Stream
 *     </button>
 *     <button onClick={disconnect} disabled={!isConnected}>
 *       Stop Stream
 *     </button>
 *     {snapshot && <RiskDashboard data={snapshot} />}
 *   </div>
 * );
 * ```
 */
export function useRiskStream(
  client: RiskClient,
  request: RiskComputeRequest,
  options: UseRiskStreamOptions = {}
): UseRiskStreamResult {
  const [snapshot, setSnapshot] = useState<RiskResponse | null>(null);
  const [deltas, setDeltas] = useState<StreamEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const streamRef = useRef<{ close: () => void; sendHeartbeat: () => Promise<void> } | null>(
    null
  );

  const {
    enabled = false,
    onSnapshot,
    onDelta,
    onProgress,
    onError,
    onComplete,
  } = options;

  const connect = useCallback(() => {
    // Close existing stream
    if (streamRef.current) {
      streamRef.current.close();
    }

    setIsConnected(true);
    setError(null);
    setDeltas([]);

    streamRef.current = client.streamRisk(request, {
      onSnapshot: (data) => {
        setSnapshot(data);
        onSnapshot?.(data);
      },
      onDelta: (delta) => {
        setDeltas((prev) => [...prev, delta]);
        if (delta.delta) {
          onDelta?.(delta.delta);
        }
      },
      onProgress: (progress) => {
        onProgress?.(progress);
      },
      onError: (err) => {
        setError(err);
        setIsConnected(false);
        onError?.(err);
      },
      onComplete: () => {
        setIsConnected(false);
        onComplete?.();
      },
    });
  }, [client, request, onSnapshot, onDelta, onProgress, onError, onComplete]);

  const disconnect = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.close();
      streamRef.current = null;
    }
    setIsConnected(false);
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, connect, disconnect]);

  return {
    snapshot,
    deltas,
    isConnected,
    error,
    connect,
    disconnect,
  };
}

// ===========================================================================
// useRiskExplanation Hook
// ===========================================================================

export interface UseRiskExplanationResult {
  data: any | null;
  isLoading: boolean;
  error: Error | null;
  explain: () => Promise<void>;
}

/**
 * Hook for getting risk explanation (drivers, decomposition, counterfactuals)
 *
 * @example
 * ```tsx
 * const { data, isLoading, explain } = useRiskExplanation(client, request);
 *
 * <button onClick={explain}>Explain Risk</button>
 * {data && <DriverChart drivers={data.drivers} />}
 * ```
 */
export function useRiskExplanation(
  client: RiskClient,
  request: RiskComputeRequest
): UseRiskExplanationResult {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const explain = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await client.explainRisk(request);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [client, request]);

  return {
    data,
    isLoading,
    error,
    explain,
  };
}

// ===========================================================================
// useRiskRecommendations Hook
// ===========================================================================

export interface UseRiskRecommendationsResult {
  data: any | null;
  isLoading: boolean;
  error: Error | null;
  fetch: () => Promise<void>;
}

/**
 * Hook for getting actionable recommendations
 *
 * @example
 * ```tsx
 * const { data, isLoading, fetch } = useRiskRecommendations(client, request);
 *
 * useEffect(() => {
 *   fetch();
 * }, []);
 *
 * {data && <RecommendationCards recommendations={data.recommendations} />}
 * ```
 */
export function useRiskRecommendations(
  client: RiskClient,
  request: RiskComputeRequest
): UseRiskRecommendationsResult {
  const [data, setData] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await client.getRecommendations(request);
      setData(result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, [client, request]);

  return {
    data,
    isLoading,
    error,
    fetch,
  };
}
