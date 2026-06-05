import Link from 'next/link';

export default function EnterpriseCTA() {
  return (
    <section className="px-6 pb-28">
      <div className="edge-glow relative mx-auto max-w-5xl overflow-hidden rounded-[2.25rem] border border-white/10 bg-[#070709] px-8 py-20 text-center">
        <div aria-hidden className="aurora pointer-events-none absolute inset-0 opacity-80" />
        <div aria-hidden className="tech-grid pointer-events-none absolute inset-0 opacity-70" />
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-[#5eead4]/60 to-transparent"
        />
        <div className="relative">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.04] px-3.5 py-1.5 text-[13px] text-white/70 backdrop-blur-sm">
            <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-[#2dd4bf]" />
            Invite-only beta · free during preview
          </div>
          <h2 className="font-display text-4xl font-medium tracking-tight text-white sm:text-[3.25rem]">
            Stop managing information.
            <br />
            <span className="italic-display text-gradient">Start deciding with confidence.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-white/60">
            LifeNavigator is in invite-only beta. Request access and preview the future of personal
            decision intelligence — grounded in your data, governed for trust.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/beta"
              className="btn-primary w-full rounded-xl px-8 py-3.5 font-medium sm:w-auto"
            >
              Request Beta Invite
            </Link>
            <Link
              href="/how-it-works"
              className="btn-ghost group w-full rounded-xl px-8 py-3.5 font-medium text-white sm:w-auto"
            >
              Explore Platform
              <span className="ml-1.5 inline-block transition-transform group-hover:translate-x-1">
                →
              </span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
