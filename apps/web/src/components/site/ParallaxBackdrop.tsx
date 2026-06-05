'use client';

import { useEffect, useRef } from 'react';

/**
 * Fixed, full-viewport cinematic backdrop. Large blurred aurora orbs drift at
 * different rates as you scroll — the page content scrolls over them, creating
 * clearly visible parallax depth. Reduced-motion: orbs hold still.
 */
export default function ParallaxBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        ref.current?.querySelectorAll<HTMLElement>('[data-orb]').forEach((o) => {
          const f = parseFloat(o.dataset.orb || '0');
          o.style.transform = `translate3d(0, ${y * f}px, 0)`;
        });
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div ref={ref} aria-hidden className="fixed inset-0 -z-10 overflow-hidden bg-[#06060a]">
        <div
          data-orb="0.22"
          className="absolute -left-48 -top-24 h-[44rem] w-[44rem] rounded-full opacity-80 blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.28), transparent 62%)' }}
        />
        <div
          data-orb="0.42"
          className="absolute -right-56 top-32 h-[42rem] w-[42rem] rounded-full opacity-80 blur-[120px]"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.26), transparent 62%)' }}
        />
        <div
          data-orb="0.14"
          className="absolute left-1/4 top-[70vh] h-[46rem] w-[46rem] rounded-full opacity-70 blur-[130px]"
          style={{ background: 'radial-gradient(circle, rgba(168,85,247,0.2), transparent 62%)' }}
        />
        <div
          data-orb="0.30"
          className="absolute right-1/4 top-[150vh] h-[40rem] w-[40rem] rounded-full opacity-60 blur-[130px]"
          style={{ background: 'radial-gradient(circle, rgba(45,212,191,0.18), transparent 62%)' }}
        />
        <div className="tech-grid absolute inset-0 opacity-50" />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(120% 80% at 50% -10%, transparent 40%, rgba(6,6,10,0.85) 100%)',
          }}
        />
      </div>
      {/* film grain over the whole stage */}
      <div aria-hidden className="grain pointer-events-none" />
    </>
  );
}
