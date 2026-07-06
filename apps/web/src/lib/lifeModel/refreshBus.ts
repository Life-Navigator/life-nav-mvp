'use client';

import { useEffect, useState } from 'react';

// Lightweight in-tab event bus so a sanctioned chat write (e.g. approving a short-term goal in the
// advisor) re-renders coverage / goals / dashboard cards LIVE, without a full page reload. Previously a
// chat write only showed "on next read", which made goal-setting feel like nothing happened.
// SSR-safe: no window access at module scope.

const EVENT = 'lifemodel:updated';

/** Fire after any approved write that changes the life model (goals, facts, coverage). */
export function emitLifeModelUpdated(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Returns a counter that increments on every emitLifeModelUpdated(). Add it to a data-fetch effect's
 * dependency array so the fetch re-runs when the life model changes.
 *
 *   const rev = useLifeModelRevision();
 *   useEffect(() => { fetchCoverage(); }, [rev]);
 */
export function useLifeModelRevision(): number {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const on = () => setRev((r) => r + 1);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  return rev;
}
