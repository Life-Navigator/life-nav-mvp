'use client';

import { useCallback, useRef, useState } from 'react';
import {
  ADVISOR_ERROR,
  ADVISOR_WELCOME,
  sendAdvisorMessage,
  type AdvisorMessage,
} from '@/lib/chat/advisor';

/**
 * Shared advisor-chat behavior for both the dashboard Advisor and the floating chat. Owns message
 * list, send flow, loading + error state, and a stable conversation id so cross-turn context threads.
 * UI shells differ, but the conversation engine is ONE — no duplicated chat systems.
 *
 * `seedWelcome` controls whether the advisor's opening line is shown immediately (true) or only after
 * the first turn (false). Onboarding incompleteness is the caller's concern (it picks the welcome copy
 * and may disable input); this hook always talks to advisor mode and never falls back to discovery.
 */
export function useAdvisorChat(opts?: { welcome?: string; seedWelcome?: boolean }) {
  const welcome = opts?.welcome ?? ADVISOR_WELCOME;
  const [messages, setMessages] = useState<AdvisorMessage[]>(
    opts?.seedWelcome === false ? [] : [{ role: 'advisor', text: welcome }]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationId = useRef<string>(
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `conv-${Date.now()}`
  );

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || loading) return;
      setError(null);
      setMessages((m) => [...m, { role: 'user', text }]);
      setLoading(true);
      try {
        const turn = await sendAdvisorMessage(text, conversationId.current);
        setMessages((m) => [...m, { role: 'advisor', text: turn.assistant_message }]);
      } catch {
        // Surface a safe advisor-mode error — never silently switch to onboarding/discovery mode.
        setError(ADVISOR_ERROR);
      } finally {
        setLoading(false);
      }
    },
    [loading]
  );

  return { messages, loading, error, send };
}
