'use client';

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react';

/**
 * Scroll-reveal wrapper. Fades/slides children in once when they enter the
 * viewport. Reduced-motion users get the content immediately (CSS handles it).
 */
export default function MotionSection({
  children,
  as: Tag = 'div',
  className = '',
  delay = 0,
  id,
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  delay?: number;
  id?: string;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const t = setTimeout(() => setShown(true), delay);
            io.disconnect();
            return () => clearTimeout(t);
          }
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);

  return (
    <Tag ref={ref} id={id} className={`reveal ${className}`} data-shown={shown}>
      {children}
    </Tag>
  );
}
