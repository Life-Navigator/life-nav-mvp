'use client';

import { useEffect, useRef, useState } from 'react';

// Progressive "typing" reveal of REAL text (ChatGPT feel). The text is the actual returned message — we
// only reveal it incrementally. Respects prefers-reduced-motion (instant), caps total duration for long
// messages, and calls onTick so the chat can stay scrolled to the bottom while it types.

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
  opts?: { tickMs?: number; onTick?: () => void }
) {
  const tickMs = opts?.tickMs ?? 18;
  const reduced = usePrefersReducedMotion();
  const [count, setCount] = useState(animate ? 0 : text.length);
  const onTickRef = useRef(opts?.onTick);
  onTickRef.current = opts?.onTick;

  useEffect(() => {
    if (!animate || reduced || !text) {
      setCount(text.length);
      return;
    }
    setCount(0);
    let i = 0;
    // chunk scales with length so even a long message finishes in ~3s, short ones feel like typing
    const chunk = Math.max(1, Math.ceil(text.length / 180));
    const id = setInterval(() => {
      i = Math.min(text.length, i + chunk);
      setCount(i);
      onTickRef.current?.();
      if (i >= text.length) clearInterval(id);
    }, tickMs);
    return () => clearInterval(id);
  }, [text, animate, reduced, tickMs]);

  return { shown: text.slice(0, count), done: count >= text.length };
}

export default function StreamingText({
  text,
  animate = true,
  onTick,
  className,
}: {
  text: string;
  animate?: boolean;
  onTick?: () => void;
  className?: string;
}) {
  const { shown, done } = useStreamedText(text || '', animate, { onTick });
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
