'use client';
import { useCallback, useState } from 'react';

/** One pilot-instrument submission. `kind` names the instrument; `metrics` holds 0-10 scores. */
export interface PilotFeedback {
  kind: string;
  metrics?: Record<string, number>;
  insight_detected?: boolean;
  surprised?: boolean;
  thumbs?: 'up' | 'down';
  nps?: number;
  comment?: string;
  context?: Record<string, unknown>;
}

type Status = 'idle' | 'submitting' | 'done' | 'error';

/**
 * Submits a pilot-measurement instrument to the canonical feedback path (/api/feedback/pilot →
 * core-api /v1/feedback → analytics.pilot_feedback). Fire-and-forget friendly; never throws into the UI.
 */
export function usePilotFeedback() {
  const [status, setStatus] = useState<Status>('idle');

  const submit = useCallback(async (fb: PilotFeedback): Promise<boolean> => {
    setStatus('submitting');
    try {
      const r = await fetch('/api/feedback/pilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fb),
      });
      const ok = r.ok;
      setStatus(ok ? 'done' : 'error');
      return ok;
    } catch {
      setStatus('error');
      return false;
    }
  }, []);

  return { submit, status };
}
