'use client';

import { useEffect, useRef, useState } from 'react';
import { streamDurationMs } from '@/lib/arcana/streaming';

// Progressive "typing" reveal of REAL text (ChatGPT feel). The text is the actual returned message — we
// only reveal it incrementally. Respects prefers-reduced-motion (instant), targets a total duration that
// scales with length (short ~0.4s, long ≤5s), supports an `instant` mode and an external `stop` (jump to
// full), and calls onTick so the chat can stay scrolled to the bottom while it types.

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

export function useStreamedText(
  text: string,
  animate: boolean,
  opts?: {
    tickMs?: number;
    /** Total target duration; defaults to a length-scaled value (streamDurationMs). */
    durationMs?: number;
    onTick?: () => void;
    /** Render the full text immediately (safety responses, flag-off). */
    instant?: boolean;
    /** External stop signal — jump straight to the full (already-approved) text. */
    stop?: boolean;
    /** Fired once the full text is shown (natural completion or stop). */
    onDone?: () => void;
  }
) {
  const tickMs = opts?.tickMs ?? 16;
  const instant = opts?.instant ?? false;
  const stop = opts?.stop ?? false;
  const reduced = usePrefersReducedMotion();
  const startFull = !animate || instant;
  const [count, setCount] = useState(startFull ? text.length : 0);
  const onTickRef = useRef(opts?.onTick);
  onTickRef.current = opts?.onTick;
  const onDoneRef = useRef(opts?.onDone);
  onDoneRef.current = opts?.onDone;

  useEffect(() => {
    if (!animate || instant || reduced || !text) {
      setCount(text.length);
      onDoneRef.current?.();
      return;
    }
    setCount(0);
    let i = 0;
    const total = opts?.durationMs ?? streamDurationMs(text.length);
    const steps = Math.max(1, Math.round(total / tickMs));
    const chunk = Math.max(1, Math.ceil(text.length / steps));
    const id = setInterval(() => {
      i = Math.min(text.length, i + chunk);
      setCount(i);
      onTickRef.current?.();
      if (i >= text.length) {
        clearInterval(id);
        onDoneRef.current?.();
      }
    }, tickMs);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, animate, instant, reduced, tickMs, opts?.durationMs]);

  // External stop → reveal the full (already-approved) text immediately.
  useEffect(() => {
    if (stop && count < text.length) {
      setCount(text.length);
      onDoneRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stop]);

  return { shown: text.slice(0, count), done: count >= text.length };
}

export default function StreamingText({
  text,
  animate = true,
  durationMs,
  instant = false,
  stop = false,
  onTick,
  onDone,
  className,
}: {
  text: string;
  animate?: boolean;
  durationMs?: number;
  instant?: boolean;
  stop?: boolean;
  onTick?: () => void;
  onDone?: () => void;
  className?: string;
}) {
  const { shown, done } = useStreamedText(text || '', animate, {
    durationMs,
    instant,
    stop,
    onTick,
    onDone,
  });
  return (
    <span className={className}>
      {shown}
      {!done && (
        <span
          aria-hidden
          className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] animate-pulse rounded-sm bg-current align-middle opacity-70"
        />
      )}
    </span>
  );
}
