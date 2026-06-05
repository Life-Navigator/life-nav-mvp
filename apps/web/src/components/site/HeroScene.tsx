'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import DeviceMockup, { PhoneScreen } from '@/components/site/DeviceMockup';
import FloatingInsightCard from '@/components/site/FloatingInsightCard';

export default function HeroScene() {
  const sceneRef = useRef<HTMLDivElement | null>(null);

  // Subtle scroll-linked parallax on the product scene + floating cards.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        const el = sceneRef.current;
        if (!el) return;
        el.querySelectorAll<HTMLElement>('[data-par]').forEach((node) => {
          const f = parseFloat(node.dataset.par || '0');
          node.style.transform = `translate3d(0, ${y * f}px, 0)`;
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
    <section className="relative overflow-hidden text-white">
      <div aria-hidden className="aurora pointer-events-none absolute inset-0 opacity-70" />

      <div className="relative mx-auto max-w-6xl px-6 pt-40 pb-28 text-center">
        <div className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-sm text-white/70 rise">
          <span className="h-1.5 w-1.5 rounded-full bg-[#2dd4bf]" />
          Invite-only beta · Decision Intelligence Platform
        </div>
        <h1 className="font-display text-5xl font-semibold leading-[1.02] sm:text-6xl lg:text-[5rem] rise">
          Decision Intelligence
          <br />
          <span className="text-gradient">for Life</span>
        </h1>
        <p className="measure mx-auto mt-7 text-lg leading-relaxed text-white/65 rise">
          LifeNavigator connects your finances, career, education, health, and goals into one
          trusted AI system — helping you make better decisions grounded in your own data.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row rise">
          <Link
            href="/beta"
            className="w-full rounded-xl bg-white px-7 py-3.5 font-medium text-[#07070a] transition-transform hover:-translate-y-0.5 sm:w-auto"
          >
            Request Beta Invite
          </Link>
          <Link
            href="/how-it-works"
            className="w-full rounded-xl border border-white/20 px-7 py-3.5 font-medium text-white transition-colors hover:bg-white/5 sm:w-auto"
          >
            Explore the Platform
          </Link>
        </div>

        {/* Product scene */}
        <div ref={sceneRef} className="relative mx-auto mt-20 max-w-4xl [perspective:1600px]">
          <div
            data-par="-0.03"
            className="relative mx-auto w-full [transform:rotateX(8deg)] [transform-style:preserve-3d]"
          >
            <div className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 -z-10 rounded-[3rem] bg-[#2dd4bf]/10 blur-3xl" />
            <DeviceMockup variant="laptop" />
          </div>

          {/* phone companion — overlaps bottom-left, hidden on small screens */}
          <div
            data-par="-0.08"
            className="absolute -bottom-12 -left-4 hidden origin-bottom-left scale-[0.8] sm:block float"
          >
            <DeviceMockup variant="phone">
              <PhoneScreen />
            </DeviceMockup>
          </div>

          {/* floating insight cards */}
          <div data-par="-0.02" className="absolute -right-6 top-6 hidden w-60 md:block float">
            <FloatingInsightCard
              eyebrow="Grounded"
              spark
              title="Grounded in your data"
              detail="Every figure is read from your accounts — never invented."
            />
          </div>
          <div data-par="-0.05" className="absolute -left-8 top-24 hidden w-56 lg:block float-2">
            <FloatingInsightCard
              eyebrow="Plaid-connected"
              spark
              title="Financial intelligence"
              detail="Bank-grade, read-only account connectivity."
            />
          </div>
          <div data-par="-0.1" className="absolute -right-4 bottom-2 hidden w-52 md:block float-2">
            <FloatingInsightCard
              eyebrow="Governed"
              spark
              title="Fail-closed AI"
              detail="Unknown? It says so. No guessing."
            />
          </div>
        </div>

        <p className="mt-28 text-sm text-white/45 sm:mt-24 rise">
          Grounded in your data · Governed for trust · Built for real life
        </p>
      </div>
    </section>
  );
}
