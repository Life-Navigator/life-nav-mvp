'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import DeviceMockup, { PhoneScreen } from '@/components/site/DeviceMockup';
import FloatingInsightCard from '@/components/site/FloatingInsightCard';

export default function HeroScene() {
  const rootRef = useRef<HTMLElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Scroll-linked parallax on the product scene + floating cards.
    let raf = 0;
    const onScroll = () => {
      if (reduce) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        sceneRef.current?.querySelectorAll<HTMLElement>('[data-par]').forEach((node) => {
          const f = parseFloat(node.dataset.par || '0');
          node.style.setProperty('--py', `${y * f}px`);
        });
      });
    };

    // Pointer-reactive spotlight + gentle scene tilt — the "alive" signal.
    const onMove = (e: PointerEvent) => {
      const el = rootRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', `${px * 100}%`);
      el.style.setProperty('--my', `${py * 100}%`);
      if (reduce) return;
      const scene = sceneRef.current;
      if (scene) {
        scene.style.setProperty('--tilt', `${(px - 0.5) * 6}deg`);
        scene.style.setProperty('--lift', `${(py - 0.5) * -10}px`);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section ref={rootRef} className="relative overflow-hidden text-white">
      {/* layered atmosphere */}
      <div aria-hidden className="aurora pointer-events-none absolute inset-0 opacity-80" />
      <div aria-hidden className="tech-grid pointer-events-none absolute inset-0 opacity-60" />
      {/* cursor spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 transition-opacity duration-500"
        style={{
          background:
            'radial-gradient(36rem 36rem at var(--mx,50%) var(--my,20%), rgba(45,212,191,0.12), transparent 60%)',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-36 pb-24 text-center sm:pt-40">
        <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-white/70 backdrop-blur-sm rise">
          <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#2dd4bf]" />
          Invite-only beta · Decision Intelligence Platform
        </div>

        <h1 className="font-display text-[2.75rem] font-medium leading-[1.02] tracking-tight sm:text-6xl lg:text-[5.25rem] rise">
          Decision Intelligence
          <br />
          <span className="italic-display text-gradient">for Life.</span>
        </h1>

        <p className="measure mx-auto mt-7 text-base leading-relaxed text-white/65 sm:text-lg rise">
          LifeNavigator connects your finances, career, education, health, and goals into one
          trusted AI system — helping you make better decisions grounded in your own data.
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row rise">
          <Link
            href="/auth?mode=create"
            className="btn-primary w-full rounded-xl px-7 py-3.5 font-medium sm:w-auto"
          >
            Request Beta Invite
          </Link>
          <Link
            href="/product"
            className="btn-ghost group w-full rounded-xl px-7 py-3.5 font-medium text-white sm:w-auto"
          >
            Explore Platform
            <span className="ml-1.5 inline-block transition-transform group-hover:translate-x-1">
              →
            </span>
          </Link>
        </div>

        {/* trust microcopy */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-white/40 rise">
          {[
            'Grounded in your data',
            'No invented facts',
            'Central governance + personal context',
          ].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5">
              <svg
                viewBox="0 0 16 16"
                className="h-3 w-3 text-[#5eead4]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M3 8.5l3 3 7-8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t}
            </span>
          ))}
        </div>

        {/* ---- product scene ---- */}
        <div
          ref={sceneRef}
          className="relative mx-auto mt-16 max-w-4xl [perspective:1800px] sm:mt-20"
          style={{ transform: 'translateY(var(--lift,0px))' }}
        >
          <div
            data-par="-0.03"
            className="relative mx-auto w-full [transform:translateY(var(--py,0px))_rotateX(9deg)_rotateY(var(--tilt,0deg))] [transform-style:preserve-3d] transition-transform duration-300 ease-out"
          >
            <div className="pointer-events-none absolute -inset-x-12 -top-12 bottom-0 -z-10 rounded-[3rem] bg-[#2dd4bf]/12 blur-3xl" />
            <DeviceMockup variant="laptop" />
          </div>

          {/* phone companion */}
          <div
            data-par="-0.08"
            className="absolute -bottom-10 -left-2 hidden origin-bottom-left scale-[0.78] sm:block float"
            style={{ transform: 'translateY(var(--py,0px)) scale(0.78)' }}
          >
            <DeviceMockup variant="phone">
              <PhoneScreen />
            </DeviceMockup>
          </div>

          {/* floating insight cards */}
          <div
            data-par="-0.02"
            className="absolute -right-6 top-4 hidden w-60 md:block float"
            style={{ transform: 'translateY(var(--py,0px))' }}
          >
            <FloatingInsightCard
              eyebrow="Grounded"
              spark
              title="Grounded in your data"
              detail="Every figure is read from your accounts — never invented."
            />
          </div>
          <div
            data-par="-0.05"
            className="absolute -left-8 top-28 hidden w-56 lg:block float-2"
            style={{ transform: 'translateY(var(--py,0px))' }}
          >
            <FloatingInsightCard
              eyebrow="Plaid-connected"
              spark
              title="Financial intelligence"
              detail="Bank-grade, read-only account connectivity."
            />
          </div>
          <div
            data-par="-0.1"
            className="absolute -right-4 bottom-0 hidden w-52 md:block float-2"
            style={{ transform: 'translateY(var(--py,0px))' }}
          >
            <FloatingInsightCard
              eyebrow="Governed"
              spark
              title="Fail-closed AI"
              detail="Unknown? It says so. No guessing."
            />
          </div>
        </div>

        {/* logo trust strip */}
        <div className="mt-24 sm:mt-20 rise">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/30">
            One connected system across every life domain
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm font-medium text-white/45">
            {['Finance', 'Career', 'Education', 'Health', 'Family', 'Goals'].map((d) => (
              <span key={d} className="transition-colors hover:text-white/80">
                {d}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
