'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Scroll-linked "dolly" zoom. As the element scrolls up through the viewport it
 * starts small (far away) and scales toward `to` (close), with a matching depth
 * blur/opacity ramp. Pure transform/opacity on a single node — cheap and
 * GPU-composited. Disabled (rendered at full size) under reduced-motion.
 */
export default function ScrollZoom({
  children,
  from = 0.62,
  to = 1,
  className = '',
}: {
  children: ReactNode;
  from?: number;
  to?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      // Honor reduced-motion: show the content at full size, no scroll effect.
      el.style.transform = `scale(${to})`;
      el.style.opacity = '1';
      el.style.filter = 'none';
      return;
    }

    let raf = 0;
    const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

    const update = () => {
      raf = 0;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // p: 0 when the element's top is at the bottom of the viewport (entering,
      // far away) → 1 when it has risen to ~35% from the top (close).
      const start = vh * 0.95;
      const end = vh * 0.35;
      const p = clamp((start - rect.top) / (start - end), 0, 1);
      const eased = p * p * (3 - 2 * p); // smoothstep
      const scale = from + (to - from) * eased;
      el.style.transform = `scale(${scale.toFixed(4)})`;
      el.style.opacity = (0.45 + 0.55 * eased).toFixed(3);
      el.style.filter = eased < 0.98 ? `blur(${((1 - eased) * 4).toFixed(2)}px)` : 'none';
    };

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };

    // Prime initial state, then track scroll + resize.
    el.style.willChange = 'transform, opacity, filter';
    el.style.transformOrigin = 'center 45%';
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [from, to]);

  return (
    <div ref={ref} className={className} style={{ transform: `scale(${from})` }}>
      {children}
    </div>
  );
}
