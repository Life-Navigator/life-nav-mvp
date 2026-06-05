'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

/**
 * Scroll-reveal wrapper. CRITICAL: content is VISIBLE by default. We only "arm"
 * (hide → reveal-on-scroll) elements that are below the fold at mount, so a
 * failed/slow hydration or an unsupported observer can never leave a section
 * stuck invisible. Above-the-fold sections show immediately.
 */
export default function MotionSection({
  children,
  as: Tag = 'div',
  className = '',
  id,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  id?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (typeof IntersectionObserver === 'undefined') return;

    const rect = el.getBoundingClientRect();
    // Already in (or near) the viewport → leave visible, don't animate.
    if (rect.top < window.innerHeight * 0.85) return;

    setArmed(true);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag ref={ref} id={id} className={`reveal ${className}`} data-armed={armed} data-shown={shown}>
      {children}
    </Tag>
  );
}
